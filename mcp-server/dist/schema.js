/**
 * Structured Output Schemas for Council Review
 *
 * Uses Zod for strict validation of reviewer output.
 * This replaces the fragile regex-based markdown validation.
 */
import { z } from 'zod';
// =============================================================================
// SEVERITY & CONFIDENCE SCALES
// =============================================================================
export const SeverityLevel = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const ConfidenceLevel = z.enum(['verified', 'high', 'medium', 'low', 'uncertain']);
// Numeric confidence score (0-1) for consensus calculations
export const ConfidenceScore = z.number().min(0).max(1);
// =============================================================================
// CODE LOCATION
// =============================================================================
export const CodeLocation = z.object({
    file: z.string().describe('Relative file path from working directory'),
    line_start: z.number().int().positive().optional().describe('Starting line number'),
    line_end: z.number().int().positive().optional().describe('Ending line number'),
    column_start: z.number().int().nonnegative().optional().describe('Starting column'),
    column_end: z.number().int().nonnegative().optional().describe('Ending column'),
});
// =============================================================================
// REVIEW FINDING
// =============================================================================
export const ReviewFinding = z.object({
    id: z.string().describe('Unique identifier for this finding'),
    category: z.enum([
        'security',
        'performance',
        'architecture',
        'correctness',
        'maintainability',
        'scalability',
        'testing',
        'documentation',
        'best-practice',
        'other'
    ]).describe('Primary category of the finding'),
    severity: SeverityLevel.describe('Impact severity level'),
    confidence: ConfidenceScore.describe('Confidence in this finding (0-1)'),
    title: z.string().max(120).describe('Brief title summarizing the issue'),
    description: z.string().describe('Detailed explanation of the finding'),
    location: CodeLocation.optional().describe('Where in the code this applies'),
    evidence: z.string().optional().describe('Code snippet or proof supporting the finding'),
    suggestion: z.string().optional().describe('Recommended fix or improvement'),
    // Security-specific metadata
    cwe_id: z.string().regex(/^CWE-\d+$/).optional().describe('CWE identifier for security issues'),
    owasp_category: z.string().optional().describe('OWASP Top 10 category if applicable'),
    // Tags for filtering
    tags: z.array(z.string()).optional().describe('Additional classification tags'),
});
// =============================================================================
// AGREEMENT/DISAGREEMENT WITH CC's WORK
// =============================================================================
export const Agreement = z.object({
    original_claim: z.string().describe("The claim from CC's output being validated"),
    assessment: z.enum(['correct', 'mostly_correct', 'partially_correct']),
    confidence: ConfidenceScore,
    supporting_evidence: z.string().optional().describe('Evidence supporting agreement'),
    notes: z.string().optional().describe('Additional context or caveats'),
});
export const Disagreement = z.object({
    original_claim: z.string().describe("The claim from CC's output being challenged"),
    issue: z.enum(['incorrect', 'misleading', 'incomplete', 'outdated', 'hallucinated']),
    confidence: ConfidenceScore,
    reason: z.string().describe('Why this claim is problematic'),
    correction: z.string().optional().describe('The correct assessment'),
    evidence: z.string().optional().describe('Evidence supporting the disagreement'),
});
// =============================================================================
// ALTERNATIVE APPROACH
// =============================================================================
export const Alternative = z.object({
    topic: z.string().describe('What aspect this alternative addresses'),
    current_approach: z.string().describe("Description of CC's approach"),
    alternative: z.string().describe('The suggested alternative'),
    tradeoffs: z.object({
        pros: z.array(z.string()),
        cons: z.array(z.string()),
    }),
    recommendation: z.enum(['strongly_prefer', 'consider', 'situational', 'informational']),
});
// =============================================================================
// RISK ASSESSMENT
// =============================================================================
export const RiskAssessment = z.object({
    overall_level: z.enum(['critical', 'high', 'medium', 'low', 'minimal']),
    score: z.number().min(0).max(100).describe('Numeric risk score 0-100'),
    summary: z.string().max(300).describe('Brief risk summary'),
    top_concerns: z.array(z.string()).max(5).describe('Top risk factors'),
    mitigations: z.array(z.string()).optional().describe('Suggested mitigations'),
});
// =============================================================================
// COMPLETE REVIEW OUTPUT (Single Reviewer)
// =============================================================================
export const ReviewOutput = z.object({
    reviewer: z.string().describe('Name of the reviewing model'),
    timestamp: z.string().datetime().optional(),
    // Core sections
    findings: z.array(ReviewFinding).describe('New issues discovered'),
    agreements: z.array(Agreement).describe("Validation of CC's correct assessments"),
    disagreements: z.array(Disagreement).describe("Challenges to CC's claims"),
    alternatives: z.array(Alternative).describe('Alternative approaches to consider'),
    // Summary
    risk_assessment: RiskAssessment,
    // Metadata
    files_examined: z.array(z.string()).optional().describe('Files the reviewer actually read'),
    execution_notes: z.string().optional().describe('Notes about the review process'),
});
// =============================================================================
// PEER REVIEW (Model reviewing another model's output)
// =============================================================================
export const PeerScore = z.object({
    finding_id: z.string(),
    validity: z.enum(['valid', 'questionable', 'invalid', 'cannot_assess']),
    confidence: ConfidenceScore,
    notes: z.string().optional(),
});
export const PeerReview = z.object({
    reviewer: z.string().describe('Model doing the peer review'),
    reviewed_model: z.string().describe('Model being reviewed (anonymized)'),
    scores: z.array(PeerScore),
    overall_quality: z.number().min(0).max(1),
    summary: z.string().optional(),
});
// =============================================================================
// CONSENSUS FINDING (After multi-model synthesis)
// =============================================================================
export const ConsensusFinding = z.object({
    // Original finding data
    ...ReviewFinding.shape,
    // Consensus metadata
    consensus_score: z.number().min(0).max(1).describe('Weighted consensus confidence'),
    agreement_count: z.number().int().nonnegative().describe('How many models agreed'),
    sources: z.array(z.string()).describe('Which reviewers found this'),
    peer_validation: z.enum(['validated', 'mixed', 'disputed', 'unreviewed']).optional(),
});
// =============================================================================
// COUNCIL REVIEW OUTPUT (Multi-model synthesis)
// =============================================================================
export const CouncilReviewOutput = z.object({
    // Individual reviews (for transparency)
    individual_reviews: z.record(z.string(), ReviewOutput).describe('Raw outputs per model'),
    // Synthesized results
    consensus_findings: z.array(ConsensusFinding).describe('Findings with consensus scores'),
    // Cross-model analysis
    unanimous_agreements: z.array(z.string()).describe('Things all models agreed on'),
    conflicts: z.array(z.object({
        topic: z.string(),
        positions: z.record(z.string(), z.string()),
        recommendation: z.string().optional(),
    })).describe('Disagreements between models'),
    unique_insights: z.record(z.string(), z.array(z.string())).describe('Unique findings per model'),
    // Overall assessment
    combined_risk: RiskAssessment,
    // Metadata
    models_participated: z.array(z.string()),
    models_failed: z.array(z.string()).optional(),
    synthesis_notes: z.string().optional(),
});
// =============================================================================
// JSON SCHEMA GENERATION FOR PROMPTS
// =============================================================================
/**
 * Generate a simplified JSON schema for embedding in prompts.
 * External CLIs don't support Zod directly, so we provide a JSON schema.
 */
export function getReviewOutputJsonSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        required: ['reviewer', 'findings', 'agreements', 'disagreements', 'alternatives', 'risk_assessment'],
        properties: {
            reviewer: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'category', 'severity', 'confidence', 'title', 'description'],
                    properties: {
                        id: { type: 'string' },
                        category: {
                            type: 'string',
                            enum: ['security', 'performance', 'architecture', 'correctness',
                                'maintainability', 'scalability', 'testing', 'documentation',
                                'best-practice', 'other']
                        },
                        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        title: { type: 'string', maxLength: 120 },
                        description: { type: 'string' },
                        location: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['file'], // file is required to match Zod schema
                            properties: {
                                file: { type: 'string', description: 'Relative file path from working directory' },
                                line_start: { type: 'integer', minimum: 1, description: 'Starting line number' },
                                line_end: { type: 'integer', minimum: 1, description: 'Ending line number' },
                                column_start: { type: 'integer', minimum: 0, description: 'Starting column' },
                                column_end: { type: 'integer', minimum: 0, description: 'Ending column' }
                            }
                        },
                        evidence: { type: 'string' },
                        suggestion: { type: 'string' },
                        cwe_id: { type: 'string', pattern: '^CWE-\\d+$' },
                        owasp_category: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } }
                    }
                }
            },
            agreements: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['original_claim', 'assessment', 'confidence'],
                    properties: {
                        original_claim: { type: 'string' },
                        assessment: { type: 'string', enum: ['correct', 'mostly_correct', 'partially_correct'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        supporting_evidence: { type: 'string' },
                        notes: { type: 'string' }
                    }
                }
            },
            disagreements: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['original_claim', 'issue', 'confidence', 'reason'],
                    properties: {
                        original_claim: { type: 'string' },
                        issue: { type: 'string', enum: ['incorrect', 'misleading', 'incomplete', 'outdated', 'hallucinated'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        reason: { type: 'string' },
                        correction: { type: 'string' },
                        evidence: { type: 'string' }
                    }
                }
            },
            alternatives: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['topic', 'current_approach', 'alternative', 'tradeoffs', 'recommendation'],
                    properties: {
                        topic: { type: 'string' },
                        current_approach: { type: 'string' },
                        alternative: { type: 'string' },
                        tradeoffs: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                pros: { type: 'array', items: { type: 'string' } },
                                cons: { type: 'array', items: { type: 'string' } }
                            }
                        },
                        recommendation: { type: 'string', enum: ['strongly_prefer', 'consider', 'situational', 'informational'] }
                    }
                }
            },
            risk_assessment: {
                type: 'object',
                additionalProperties: false,
                required: ['overall_level', 'score', 'summary', 'top_concerns'],
                properties: {
                    overall_level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'minimal'] },
                    score: { type: 'number', minimum: 0, maximum: 100 },
                    summary: { type: 'string', maxLength: 300 },
                    top_concerns: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                    mitigations: { type: 'array', items: { type: 'string' } }
                }
            },
            files_examined: { type: 'array', items: { type: 'string' } },
            execution_notes: { type: 'string' }
        }
    };
}
/**
 * Attempt to parse and validate reviewer output.
 * Returns the validated output or null if invalid.
 */
export function parseReviewOutput(rawOutput) {
    try {
        // Try to extract JSON from the output (may be wrapped in markdown code blocks)
        let jsonStr = rawOutput;
        // Extract from ```json ... ``` blocks
        const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1].trim();
        }
        // Try to find JSON object boundaries
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(jsonStr);
        return ReviewOutput.parse(parsed);
    }
    catch {
        return null;
    }
}
/**
 * Convert legacy markdown format to structured output (best effort).
 * This provides backwards compatibility during transition.
 */
export function parseLegacyMarkdownOutput(markdown, reviewer) {
    try {
        const output = {
            reviewer,
            findings: [],
            agreements: [],
            disagreements: [],
            alternatives: [],
            risk_assessment: {
                overall_level: 'medium',
                score: 50,
                summary: 'Unable to parse structured risk assessment',
                top_concerns: [],
            },
        };
        // Parse ## Agreements section
        const agreementsMatch = markdown.match(/## Agreements\n([\s\S]*?)(?=##|$)/);
        if (agreementsMatch) {
            const lines = agreementsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    output.agreements.push({
                        original_claim: content.split(':')[0] || content,
                        assessment: 'correct',
                        confidence: 0.7,
                    });
                }
            }
        }
        // Parse ## Disagreements section
        const disagreementsMatch = markdown.match(/## Disagreements\n([\s\S]*?)(?=##|$)/);
        if (disagreementsMatch) {
            const lines = disagreementsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    output.disagreements.push({
                        original_claim: content.split(':')[0] || content,
                        issue: 'incorrect',
                        confidence: 0.7,
                        reason: content,
                    });
                }
            }
        }
        // Parse ## Additions section as findings
        const additionsMatch = markdown.match(/## Additions\n([\s\S]*?)(?=##|$)/);
        if (additionsMatch) {
            const lines = additionsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            let idx = 0;
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    const locationMatch = content.match(/([^:]+):(\d+)/);
                    output.findings.push({
                        id: `legacy-${idx++}`,
                        category: 'other',
                        severity: 'medium',
                        confidence: 0.6,
                        title: content.slice(0, 100),
                        description: content,
                        location: locationMatch ? {
                            file: locationMatch[1],
                            line_start: parseInt(locationMatch[2]),
                        } : undefined,
                    });
                }
            }
        }
        // Parse ## Risk Assessment
        const riskMatch = markdown.match(/## Risk Assessment\n([\s\S]*?)(?=##|$)/);
        if (riskMatch) {
            const riskContent = riskMatch[1].trim();
            const levelMatch = riskContent.match(/\b(critical|high|medium|low|minimal)\b/i);
            if (levelMatch) {
                output.risk_assessment.overall_level = levelMatch[1].toLowerCase();
                output.risk_assessment.score = {
                    critical: 90, high: 70, medium: 50, low: 30, minimal: 10
                }[output.risk_assessment.overall_level];
            }
            output.risk_assessment.summary = riskContent.slice(0, 300);
        }
        return output;
    }
    catch {
        return null;
    }
}
