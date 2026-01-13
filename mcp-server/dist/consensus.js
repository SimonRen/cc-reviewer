/**
 * Consensus Calculation for Multi-Model Reviews
 *
 * Implements the "Council Review" pattern:
 * 1. Collect reviews from multiple models
 * 2. (Optional) Run peer review for cross-validation
 * 3. Calculate consensus using confidence-weighted voting
 * 4. Synthesize final output with agreement indicators
 */
export const DEFAULT_CONSENSUS_CONFIG = {
    minConsensusThreshold: 0.3,
    agreementBoost: 1.5,
    disputePenalty: 0.5,
    includeSingleSourceFindings: true,
    singleSourceMinConfidence: 0.7,
};
// =============================================================================
// FINDING SIMILARITY
// =============================================================================
/**
 * Calculate similarity between two findings.
 * Used to detect when multiple models found the same issue.
 */
export function findingSimilarity(a, b) {
    let score = 0;
    let weights = 0;
    // Same category is important
    if (a.category === b.category) {
        score += 0.3;
    }
    weights += 0.3;
    // Same severity indicates similar assessment
    if (a.severity === b.severity) {
        score += 0.1;
    }
    weights += 0.1;
    // Location overlap is very important
    if (a.location && b.location) {
        if (a.location.file === b.location.file) {
            score += 0.2;
            // Check line overlap
            if (a.location.line_start && b.location.line_start) {
                const lineDistance = Math.abs(a.location.line_start - b.location.line_start);
                if (lineDistance === 0) {
                    score += 0.2;
                }
                else if (lineDistance <= 5) {
                    score += 0.1;
                }
            }
        }
        weights += 0.4;
    }
    // Title/description similarity (simple word overlap)
    const aWords = new Set([...a.title.toLowerCase().split(/\W+/), ...a.description.toLowerCase().split(/\W+/)]);
    const bWords = new Set([...b.title.toLowerCase().split(/\W+/), ...b.description.toLowerCase().split(/\W+/)]);
    const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
    const union = new Set([...aWords, ...bWords]);
    const textSimilarity = intersection.length / union.size;
    score += textSimilarity * 0.2;
    weights += 0.2;
    return score / weights;
}
/**
 * Group similar findings across models
 */
export function groupSimilarFindings(reviews, similarityThreshold = 0.6) {
    const groups = new Map();
    // Collect all findings with their source
    const allFindings = [];
    for (const [modelId, review] of reviews) {
        for (const finding of review.findings) {
            allFindings.push({ finding, source: modelId });
        }
    }
    // Group by category first for efficiency
    const byCategory = new Map();
    for (const item of allFindings) {
        const cat = item.finding.category;
        if (!byCategory.has(cat)) {
            byCategory.set(cat, []);
        }
        byCategory.get(cat).push(item);
    }
    // Within each category, cluster similar findings
    for (const [category, findings] of byCategory) {
        const clusters = [];
        const used = new Set();
        for (let i = 0; i < findings.length; i++) {
            if (used.has(i))
                continue;
            const cluster = {
                finding: findings[i].finding,
                sources: [findings[i].source],
            };
            used.add(i);
            // Find similar findings
            for (let j = i + 1; j < findings.length; j++) {
                if (used.has(j))
                    continue;
                const similarity = findingSimilarity(findings[i].finding, findings[j].finding);
                if (similarity >= similarityThreshold) {
                    cluster.sources.push(findings[j].source);
                    used.add(j);
                    // Merge: prefer higher confidence finding as representative
                    if (findings[j].finding.confidence > cluster.finding.confidence) {
                        cluster.finding = findings[j].finding;
                    }
                }
            }
            clusters.push(cluster);
        }
        groups.set(category, clusters);
    }
    return groups;
}
// =============================================================================
// CONSENSUS CALCULATION
// =============================================================================
/**
 * Calculate consensus score for a finding cluster
 */
export function calculateConsensusScore(cluster, totalModels, config = DEFAULT_CONSENSUS_CONFIG) {
    const { finding, sources } = cluster;
    // Base score is the finding's own confidence
    let score = finding.confidence;
    // Boost for agreement (multiple sources)
    const agreementRatio = sources.length / totalModels;
    if (sources.length > 1) {
        score *= 1 + (config.agreementBoost - 1) * agreementRatio;
    }
    // Weight by severity (higher severity = more important)
    const severityWeight = {
        critical: 1.2,
        high: 1.1,
        medium: 1.0,
        low: 0.9,
        info: 0.8,
    }[finding.severity];
    score *= severityWeight;
    // Normalize to 0-1
    return Math.min(1, Math.max(0, score));
}
/**
 * Build consensus findings from grouped findings
 */
export function buildConsensusFindings(reviews, config = DEFAULT_CONSENSUS_CONFIG) {
    const groups = groupSimilarFindings(reviews);
    const totalModels = reviews.size;
    const consensusFindings = [];
    for (const [_category, clusters] of groups) {
        for (const cluster of clusters) {
            const consensusScore = calculateConsensusScore(cluster, totalModels, config);
            // Filter based on configuration
            if (consensusScore < config.minConsensusThreshold) {
                continue;
            }
            if (cluster.sources.length === 1 && !config.includeSingleSourceFindings) {
                continue;
            }
            if (cluster.sources.length === 1 && cluster.finding.confidence < config.singleSourceMinConfidence) {
                continue;
            }
            consensusFindings.push({
                ...cluster.finding,
                consensus_score: consensusScore,
                agreement_count: cluster.sources.length,
                sources: cluster.sources,
                peer_validation: cluster.sources.length > 1 ? 'validated' : 'unreviewed',
            });
        }
    }
    // Sort by consensus score descending
    consensusFindings.sort((a, b) => b.consensus_score - a.consensus_score);
    return consensusFindings;
}
// =============================================================================
// AGREEMENT SYNTHESIS
// =============================================================================
/**
 * Find unanimous agreements (all models agreed on something)
 */
export function findUnanimousAgreements(reviews) {
    if (reviews.size < 2)
        return [];
    const allAgreements = new Map();
    for (const review of reviews.values()) {
        for (const agreement of review.agreements) {
            const key = agreement.original_claim.toLowerCase().trim();
            allAgreements.set(key, (allAgreements.get(key) || 0) + 1);
        }
    }
    // Return claims that all models agreed on
    const unanimous = [];
    for (const [claim, count] of allAgreements) {
        if (count === reviews.size) {
            unanimous.push(claim);
        }
    }
    return unanimous;
}
/**
 * Detect conflicts between models (one says X, another says not-X)
 */
export function detectConflicts(reviews) {
    const conflicts = [];
    // Check for direct disagreements about the same claim
    const claimPositions = new Map();
    for (const [modelId, review] of reviews) {
        for (const agreement of review.agreements) {
            const key = agreement.original_claim.toLowerCase().trim();
            if (!claimPositions.has(key)) {
                claimPositions.set(key, {});
            }
            claimPositions.get(key)[modelId] = 'agree';
        }
        for (const disagreement of review.disagreements) {
            const key = disagreement.original_claim.toLowerCase().trim();
            if (!claimPositions.has(key)) {
                claimPositions.set(key, {});
            }
            claimPositions.get(key)[modelId] = 'disagree';
        }
    }
    // Find claims where models disagree with each other
    for (const [claim, positions] of claimPositions) {
        const modelIds = Object.keys(positions);
        if (modelIds.length < 2)
            continue;
        const agrees = modelIds.filter(m => positions[m] === 'agree');
        const disagrees = modelIds.filter(m => positions[m] === 'disagree');
        if (agrees.length > 0 && disagrees.length > 0) {
            conflicts.push({
                topic: claim,
                positions: Object.fromEntries(modelIds.map(m => [m, positions[m] === 'agree' ? 'Supports this claim' : 'Disputes this claim'])),
            });
        }
    }
    return conflicts;
}
// =============================================================================
// UNIQUE INSIGHTS
// =============================================================================
/**
 * Find findings that only one model discovered
 */
export function findUniqueInsights(reviews) {
    const groups = groupSimilarFindings(reviews);
    const unique = {};
    for (const clusters of groups.values()) {
        for (const cluster of clusters) {
            if (cluster.sources.length === 1 && cluster.finding.confidence >= 0.6) {
                const source = cluster.sources[0];
                if (!unique[source]) {
                    unique[source] = [];
                }
                unique[source].push(`[${cluster.finding.severity}] ${cluster.finding.title}`);
            }
        }
    }
    return unique;
}
// =============================================================================
// COMBINED RISK ASSESSMENT
// =============================================================================
/**
 * Combine risk assessments from multiple models
 */
export function combineRiskAssessments(reviews) {
    const assessments = Array.from(reviews.values()).map(r => r.risk_assessment);
    if (assessments.length === 0) {
        return {
            overall_level: 'medium',
            score: 50,
            summary: 'No risk assessments available',
            top_concerns: [],
        };
    }
    // Average the scores
    const avgScore = assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length;
    const levelOrder = ['minimal', 'low', 'medium', 'high', 'critical'];
    let highestLevel = 'minimal';
    for (const assessment of assessments) {
        if (levelOrder.indexOf(assessment.overall_level) > levelOrder.indexOf(highestLevel)) {
            highestLevel = assessment.overall_level;
        }
    }
    // Collect all unique concerns
    const allConcerns = new Set();
    for (const assessment of assessments) {
        for (const concern of assessment.top_concerns) {
            allConcerns.add(concern);
        }
    }
    // Collect all mitigations
    const allMitigations = new Set();
    for (const assessment of assessments) {
        if (assessment.mitigations) {
            for (const mitigation of assessment.mitigations) {
                allMitigations.add(mitigation);
            }
        }
    }
    return {
        overall_level: highestLevel,
        score: Math.round(avgScore),
        summary: `Combined assessment from ${assessments.length} models. ` +
            `Scores ranged from ${Math.min(...assessments.map(a => a.score))} to ${Math.max(...assessments.map(a => a.score))}.`,
        top_concerns: Array.from(allConcerns).slice(0, 5),
        mitigations: allMitigations.size > 0 ? Array.from(allMitigations) : undefined,
    };
}
// =============================================================================
// FULL COUNCIL SYNTHESIS
// =============================================================================
/**
 * Synthesize multiple reviews into a council review output
 */
export function synthesizeCouncilReview(reviews, config = DEFAULT_CONSENSUS_CONFIG) {
    const consensusFindings = buildConsensusFindings(reviews, config);
    const unanimousAgreements = findUnanimousAgreements(reviews);
    const conflicts = detectConflicts(reviews);
    const uniqueInsights = findUniqueInsights(reviews);
    const combinedRisk = combineRiskAssessments(reviews);
    return {
        individual_reviews: Object.fromEntries(reviews),
        consensus_findings: consensusFindings,
        unanimous_agreements: unanimousAgreements,
        conflicts,
        unique_insights: uniqueInsights,
        combined_risk: combinedRisk,
        models_participated: Array.from(reviews.keys()),
        synthesis_notes: `Synthesized ${reviews.size} model reviews. ` +
            `Found ${consensusFindings.length} consensus findings, ` +
            `${conflicts.length} conflicts, ` +
            `${Object.values(uniqueInsights).flat().length} unique insights.`,
    };
}
// =============================================================================
// FORMATTING FOR DISPLAY
// =============================================================================
/**
 * Format consensus findings for markdown display
 */
export function formatConsensusFindings(findings) {
    if (findings.length === 0) {
        return '_No consensus findings_';
    }
    const lines = [];
    // Group by severity
    const bySeverity = new Map();
    for (const finding of findings) {
        if (!bySeverity.has(finding.severity)) {
            bySeverity.set(finding.severity, []);
        }
        bySeverity.get(finding.severity).push(finding);
    }
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const severityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
        info: 'ℹ️',
    };
    for (const severity of severityOrder) {
        const severityFindings = bySeverity.get(severity);
        if (!severityFindings || severityFindings.length === 0)
            continue;
        lines.push(`\n### ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity\n`);
        for (const finding of severityFindings) {
            const consensusIndicator = finding.agreement_count > 1
                ? `✓✓ (${finding.agreement_count} models agree)`
                : '✓';
            const confidence = Math.round(finding.consensus_score * 100);
            lines.push(`**${finding.title}** ${consensusIndicator} [${confidence}% confidence]`);
            if (finding.location) {
                const loc = finding.location.line_start
                    ? `${finding.location.file}:${finding.location.line_start}`
                    : finding.location.file;
                lines.push(`  📍 ${loc}`);
            }
            lines.push(`  ${finding.description}`);
            if (finding.suggestion) {
                lines.push(`  💡 ${finding.suggestion}`);
            }
            if (finding.cwe_id) {
                lines.push(`  🔒 ${finding.cwe_id}${finding.owasp_category ? ` (${finding.owasp_category})` : ''}`);
            }
            lines.push('');
        }
    }
    return lines.join('\n');
}
/**
 * Format conflicts for markdown display
 */
export function formatConflicts(conflicts) {
    if (conflicts.length === 0) {
        return '_No conflicts detected_';
    }
    const lines = [];
    for (const conflict of conflicts) {
        lines.push(`**${conflict.topic}**`);
        for (const [model, position] of Object.entries(conflict.positions)) {
            lines.push(`  - ${model}: ${position}`);
        }
        if (conflict.recommendation) {
            lines.push(`  → Recommendation: ${conflict.recommendation}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Format full council review for markdown display
 */
export function formatCouncilReview(review) {
    const lines = [];
    // Header
    lines.push('# Council Review Report\n');
    lines.push(`**Models:** ${review.models_participated.join(', ')}`);
    if (review.models_failed && review.models_failed.length > 0) {
        lines.push(`**Failed:** ${review.models_failed.join(', ')}`);
    }
    lines.push('');
    // Risk Summary
    const riskEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
        minimal: '✅',
    };
    lines.push(`## Risk Assessment ${riskEmoji[review.combined_risk.overall_level]}\n`);
    lines.push(`**Level:** ${review.combined_risk.overall_level.toUpperCase()} (Score: ${review.combined_risk.score}/100)`);
    lines.push(`\n${review.combined_risk.summary}\n`);
    if (review.combined_risk.top_concerns.length > 0) {
        lines.push('**Top Concerns:**');
        for (const concern of review.combined_risk.top_concerns) {
            lines.push(`- ${concern}`);
        }
        lines.push('');
    }
    // Consensus Findings
    lines.push('## Consensus Findings\n');
    lines.push(formatConsensusFindings(review.consensus_findings));
    // Unanimous Agreements
    if (review.unanimous_agreements.length > 0) {
        lines.push('\n## Unanimous Agreements ✓✓\n');
        lines.push('_All models agreed on these assessments:_\n');
        for (const agreement of review.unanimous_agreements) {
            lines.push(`- ${agreement}`);
        }
        lines.push('');
    }
    // Conflicts
    if (review.conflicts.length > 0) {
        lines.push('\n## Conflicts ⚠️\n');
        lines.push('_Models disagreed on these points (CC should decide):_\n');
        lines.push(formatConflicts(review.conflicts));
    }
    // Unique Insights
    const uniqueEntries = Object.entries(review.unique_insights).filter(([_, insights]) => insights.length > 0);
    if (uniqueEntries.length > 0) {
        lines.push('\n## Unique Insights\n');
        lines.push('_Findings from individual models that others missed:_\n');
        for (const [model, insights] of uniqueEntries) {
            lines.push(`**${model}:**`);
            for (const insight of insights) {
                lines.push(`- ${insight}`);
            }
            lines.push('');
        }
    }
    // Synthesis notes
    if (review.synthesis_notes) {
        lines.push(`\n---\n_${review.synthesis_notes}_`);
    }
    return lines.join('\n');
}
