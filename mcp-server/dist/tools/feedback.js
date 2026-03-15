/**
 * MCP Tool Implementations
 *
 * Provides two levels of review:
 * 1. Single model review (codex_review, gemini_review)
 * 2. Multi-model parallel review (multi_review)
 */
import { z } from 'zod';
import { getAdapter, getAvailableAdapters, } from '../adapters/index.js';
// =============================================================================
// INPUT SCHEMAS
// =============================================================================
export const ReviewInputSchema = z.object({
    workingDir: z.string().describe('Working directory for the CLI to operate in'),
    ccOutput: z.string().describe("Claude Code's output to review (findings, plan, analysis)"),
    outputType: z.enum(['plan', 'findings', 'analysis', 'proposal']).describe('Type of output being reviewed'),
    analyzedFiles: z.array(z.string()).optional().describe('File paths that CC analyzed'),
    focusAreas: z.array(z.enum([
        'security', 'performance', 'architecture', 'correctness',
        'maintainability', 'scalability', 'testing', 'documentation'
    ])).optional().describe('Areas to focus the review on'),
    customPrompt: z.string().optional().describe('Custom instructions for the reviewer'),
    reasoningEffort: z.enum(['high', 'xhigh']).optional().describe('Codex reasoning effort level (default: high, use xhigh for deeper analysis)'),
    serviceTier: z.enum(['default', 'fast', 'flex']).optional().describe('Codex service tier (default: default, fast = priority processing, flex = cheaper/slower)')
});
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function toReviewRequest(input) {
    return {
        workingDir: input.workingDir,
        ccOutput: input.ccOutput,
        outputType: input.outputType,
        analyzedFiles: input.analyzedFiles,
        focusAreas: input.focusAreas,
        customPrompt: input.customPrompt,
        reasoningEffort: input.reasoningEffort,
        serviceTier: input.serviceTier,
    };
}
function formatSingleReviewResponse(result, modelName) {
    if (!result.success) {
        return formatErrorResponse(result.error, result.suggestion);
    }
    const output = result.output;
    const lines = [];
    lines.push(`## ${modelName} Review\n`);
    lines.push(`**Execution Time:** ${(result.executionTimeMs / 1000).toFixed(1)}s\n`);
    // Risk Assessment
    const riskEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
        minimal: '✅',
    };
    lines.push(`### Risk Assessment ${riskEmoji[output.risk_assessment.overall_level]}`);
    lines.push(`**${output.risk_assessment.overall_level.toUpperCase()}** (Score: ${output.risk_assessment.score}/100)`);
    lines.push(`${output.risk_assessment.summary}\n`);
    // Findings
    if (output.findings.length > 0) {
        lines.push(`### New Findings (${output.findings.length})\n`);
        for (const finding of output.findings) {
            const severityEmoji = {
                critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', info: 'ℹ️'
            };
            const confidence = Math.round(finding.confidence * 100);
            lines.push(`${severityEmoji[finding.severity]} **${finding.title}** [${confidence}% confidence]`);
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
            lines.push('');
        }
    }
    // Uncertainty Responses
    if (output.uncertainty_responses && output.uncertainty_responses.length > 0) {
        lines.push(`### Uncertainty Responses (${output.uncertainty_responses.length})\n`);
        for (const ur of output.uncertainty_responses) {
            const icon = ur.verified ? '✓' : '✗';
            lines.push(`${icon} **Uncertainty #${ur.uncertainty_index}**: ${ur.finding}`);
            if (ur.recommendation) {
                lines.push(`  → ${ur.recommendation}`);
            }
            lines.push('');
        }
    }
    // Question Answers
    if (output.question_answers && output.question_answers.length > 0) {
        lines.push(`### Question Answers (${output.question_answers.length})\n`);
        for (const qa of output.question_answers) {
            const confidence = qa.confidence != null ? ` [${Math.round(qa.confidence * 100)}%]` : '';
            lines.push(`**Q${qa.question_index}**${confidence}: ${qa.answer}`);
            lines.push('');
        }
    }
    // Agreements
    if (output.agreements.length > 0) {
        lines.push(`### Agreements (${output.agreements.length})\n`);
        for (const agreement of output.agreements) {
            const confidence = Math.round(agreement.confidence * 100);
            lines.push(`✓ **${agreement.original_claim}** [${confidence}%]`);
            if (agreement.supporting_evidence) {
                lines.push(`  ${agreement.supporting_evidence}`);
            }
            lines.push('');
        }
    }
    // Disagreements
    if (output.disagreements.length > 0) {
        lines.push(`### Disagreements (${output.disagreements.length})\n`);
        for (const disagreement of output.disagreements) {
            const confidence = Math.round(disagreement.confidence * 100);
            lines.push(`✗ **${disagreement.original_claim}** [${disagreement.issue}] [${confidence}%]`);
            lines.push(`  ${disagreement.reason}`);
            if (disagreement.correction) {
                lines.push(`  → Correction: ${disagreement.correction}`);
            }
            lines.push('');
        }
    }
    // Alternatives
    if (output.alternatives.length > 0) {
        lines.push(`### Alternatives (${output.alternatives.length})\n`);
        for (const alt of output.alternatives) {
            lines.push(`**${alt.topic}**`);
            lines.push(`  Current: ${alt.current_approach}`);
            lines.push(`  Alternative: ${alt.alternative}`);
            lines.push(`  Recommendation: ${alt.recommendation}`);
            lines.push('');
        }
    }
    return lines.join('\n');
}
function formatErrorResponse(error, suggestion) {
    const emoji = {
        cli_not_found: '❌',
        timeout: '⏱️',
        rate_limit: '🚫',
        auth_error: '🔐',
        parse_error: '⚠️',
        cli_error: '❌',
    };
    let response = `${emoji[error.type] || '❌'} **${error.type}**: ${error.message}`;
    if (suggestion) {
        response += `\n\n💡 ${suggestion}`;
    }
    return response;
}
// =============================================================================
// SINGLE MODEL HANDLERS
// =============================================================================
export async function handleCodexReview(input) {
    const adapter = getAdapter('codex');
    if (!adapter) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Codex adapter not registered'
                }]
        };
    }
    const available = await adapter.isAvailable();
    if (!available) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Codex CLI not found.\n\nInstall with: npm install -g @openai/codex\n\nAlternative: Use gemini_review instead'
                }]
        };
    }
    const request = toReviewRequest(input);
    const result = await adapter.runReview(request);
    return {
        content: [{
                type: 'text',
                text: formatSingleReviewResponse(result, 'Codex')
            }]
    };
}
export async function handleGeminiReview(input) {
    const adapter = getAdapter('gemini');
    if (!adapter) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Gemini adapter not registered'
                }]
        };
    }
    const available = await adapter.isAvailable();
    if (!available) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Gemini CLI not found.\n\nInstall with: npm install -g @google/gemini-cli\n\nAlternative: Use codex_review instead'
                }]
        };
    }
    const request = toReviewRequest(input);
    const result = await adapter.runReview(request);
    return {
        content: [{
                type: 'text',
                text: formatSingleReviewResponse(result, 'Gemini')
            }]
    };
}
// =============================================================================
// MULTI-MODEL HANDLER
// =============================================================================
export async function handleMultiReview(input) {
    const request = toReviewRequest(input);
    // Get all available adapters
    const availableAdapters = await getAvailableAdapters();
    if (availableAdapters.length === 0) {
        return {
            content: [{
                    type: 'text',
                    text: `❌ No AI CLIs found.

Install at least one:
  - Codex: npm install -g @openai/codex
  - Gemini: npm install -g @google/gemini-cli`
                }]
        };
    }
    // Run all available adapters in parallel
    const promises = availableAdapters.map(async (adapter) => {
        const adapterRequest = { ...request };
        const result = await adapter.runReview(adapterRequest);
        return { adapter, result };
    });
    const results = await Promise.all(promises);
    // Collect successful and failed results
    const successful = [];
    const failed = [];
    for (const { adapter, result } of results) {
        if (result.success) {
            successful.push({ model: adapter.id, output: result.output });
        }
        else {
            failed.push({ model: adapter.id, error: result.error.message });
        }
    }
    // Build response
    const lines = [];
    // Header
    if (failed.length === results.length) {
        lines.push('## Multi-Model Review ❌ All Failed\n');
    }
    else if (failed.length > 0) {
        lines.push('## Multi-Model Review ⚠️ Partial Success\n');
    }
    else {
        lines.push('## Multi-Model Review ✓\n');
    }
    lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')}`);
    lines.push('');
    // Successful reviews
    for (const { model, output } of successful) {
        lines.push(`### ${model.charAt(0).toUpperCase() + model.slice(1)} Review\n`);
        lines.push(formatSingleReviewResponse({ success: true, output, executionTimeMs: 0 }, model));
        lines.push('');
    }
    // Failed reviews
    if (failed.length > 0) {
        lines.push('### Failures\n');
        for (const { model, error } of failed) {
            lines.push(`**${model}:** ${error}`);
        }
        lines.push('');
    }
    // Synthesis instructions (only if multiple successful)
    if (successful.length > 1) {
        lines.push(`---

**Synthesis Instructions:**
- ✓✓ Mark agreements where both models concur
- Resolve conflicts with your own judgment
- Note unique insights from each model`);
    }
    return {
        content: [{
                type: 'text',
                text: lines.join('\n')
            }]
    };
}
// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
export const TOOL_DEFINITIONS = {
    codex_review: {
        name: 'codex_review',
        description: "ONLY use when user explicitly requests '/codex' or 'review with codex'. Get external second-opinion from OpenAI Codex CLI. Codex focuses on correctness, edge cases, and performance. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: {
                    type: 'string',
                    description: 'Working directory for the CLI to operate in'
                },
                ccOutput: {
                    type: 'string',
                    description: "Claude Code's output to review (findings, plan, analysis)"
                },
                outputType: {
                    type: 'string',
                    enum: ['plan', 'findings', 'analysis', 'proposal'],
                    description: 'Type of output being reviewed'
                },
                analyzedFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File paths that CC analyzed'
                },
                focusAreas: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation']
                    },
                    description: 'Areas to focus the review on'
                },
                customPrompt: {
                    type: 'string',
                    description: 'Custom instructions for the reviewer'
                },
                reasoningEffort: {
                    type: 'string',
                    enum: ['high', 'xhigh'],
                    description: 'Codex reasoning effort (default: high, use xhigh for deeper analysis)'
                },
                serviceTier: {
                    type: 'string',
                    enum: ['default', 'fast', 'flex'],
                    description: 'Codex service tier (fast = priority processing, flex = cheaper/slower)'
                }
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
    gemini_review: {
        name: 'gemini_review',
        description: "ONLY use when user explicitly requests '/gemini' or 'review with gemini'. Get external second-opinion from Google Gemini CLI. Gemini focuses on design patterns, scalability, and tech debt. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: {
                    type: 'string',
                    description: 'Working directory for the CLI to operate in'
                },
                ccOutput: {
                    type: 'string',
                    description: "Claude Code's output to review (findings, plan, analysis)"
                },
                outputType: {
                    type: 'string',
                    enum: ['plan', 'findings', 'analysis', 'proposal'],
                    description: 'Type of output being reviewed'
                },
                analyzedFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File paths that CC analyzed'
                },
                focusAreas: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation']
                    },
                    description: 'Areas to focus the review on'
                },
                customPrompt: {
                    type: 'string',
                    description: 'Custom instructions for the reviewer'
                }
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
    multi_review: {
        name: 'multi_review',
        description: "ONLY use when user explicitly requests '/multi' or 'review with both codex and gemini'. Get parallel second-opinions from both external CLIs (Codex and Gemini). Returns combined reviews for synthesis. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: {
                    type: 'string',
                    description: 'Working directory for the CLI to operate in'
                },
                ccOutput: {
                    type: 'string',
                    description: "Claude Code's output to review (findings, plan, analysis)"
                },
                outputType: {
                    type: 'string',
                    enum: ['plan', 'findings', 'analysis', 'proposal'],
                    description: 'Type of output being reviewed'
                },
                analyzedFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File paths that CC analyzed'
                },
                focusAreas: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation']
                    },
                    description: 'Areas to focus the review on'
                },
                customPrompt: {
                    type: 'string',
                    description: 'Custom instructions for the reviewer'
                },
                serviceTier: {
                    type: 'string',
                    enum: ['default', 'fast', 'flex'],
                    description: 'Codex service tier (fast = priority processing, flex = cheaper/slower). Only applies to Codex.'
                }
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
};
