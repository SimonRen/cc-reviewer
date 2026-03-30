/**
 * MCP Tool Implementations — Review Tools
 *
 * Returns raw reviewer text to CC. No JSON parsing, no reformatting.
 * CC handles interpretation and synthesis.
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
// HELPERS
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
function formatResult(result, modelName) {
    if (!result.success) {
        const emoji = {
            cli_not_found: '❌', timeout: '⏱️', rate_limit: '🚫',
            auth_error: '🔐', cli_error: '❌',
        };
        let msg = `${emoji[result.error.type] || '❌'} **${result.error.type}**: ${result.error.message}`;
        if (result.suggestion)
            msg += `\n\n💡 ${result.suggestion}`;
        return msg;
    }
    return `## ${modelName} Review\n\n**Execution Time:** ${(result.executionTimeMs / 1000).toFixed(1)}s\n\n${result.output}`;
}
// =============================================================================
// SINGLE MODEL HANDLERS
// =============================================================================
export async function handleCodexReview(input) {
    const adapter = getAdapter('codex');
    if (!adapter)
        return { content: [{ type: 'text', text: '❌ Codex adapter not registered' }] };
    const available = await adapter.isAvailable();
    if (!available)
        return { content: [{ type: 'text', text: '❌ Codex CLI not found.\n\nInstall with: npm install -g @openai/codex-cli\n\nAlternative: Use gemini_review instead' }] };
    const result = await adapter.runReview(toReviewRequest(input));
    return { content: [{ type: 'text', text: formatResult(result, 'Codex') }] };
}
export async function handleGeminiReview(input) {
    const adapter = getAdapter('gemini');
    if (!adapter)
        return { content: [{ type: 'text', text: '❌ Gemini adapter not registered' }] };
    const available = await adapter.isAvailable();
    if (!available)
        return { content: [{ type: 'text', text: '❌ Gemini CLI not found.\n\nInstall with: npm install -g @google/gemini-cli\n\nAlternative: Use codex_review instead' }] };
    const result = await adapter.runReview(toReviewRequest(input));
    return { content: [{ type: 'text', text: formatResult(result, 'Gemini') }] };
}
export async function handleClaudeReview(input) {
    const adapter = getAdapter('claude');
    if (!adapter)
        return { content: [{ type: 'text', text: '❌ Claude adapter not registered' }] };
    const available = await adapter.isAvailable();
    if (!available)
        return { content: [{ type: 'text', text: '❌ Claude CLI not found.\n\nInstall Claude Code: https://docs.anthropic.com/en/docs/claude-code\n\nAlternative: Use codex_review or gemini_review instead' }] };
    const result = await adapter.runReview(toReviewRequest(input));
    return { content: [{ type: 'text', text: formatResult(result, 'Claude (Opus)') }] };
}
// =============================================================================
// MULTI-MODEL HANDLER
// =============================================================================
export async function handleMultiReview(input) {
    const request = toReviewRequest(input);
    const availableAdapters = await getAvailableAdapters();
    if (availableAdapters.length === 0) {
        return { content: [{ type: 'text', text: '❌ No AI CLIs found.\n\nInstall at least one:\n  - Codex: npm install -g @openai/codex-cli\n  - Gemini: npm install -g @google/gemini-cli' }] };
    }
    const results = await Promise.all(availableAdapters.map(async (adapter) => {
        const result = await adapter.runReview({ ...request });
        return { adapter, result };
    }));
    const lines = [];
    const allFailed = results.every(r => !r.result.success);
    const someFailed = results.some(r => !r.result.success);
    if (allFailed)
        lines.push('## Multi-Model Review ❌ All Failed\n');
    else if (someFailed)
        lines.push('## Multi-Model Review ⚠️ Partial Success\n');
    else
        lines.push('## Multi-Model Review ✓\n');
    lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')}\n`);
    for (const { adapter, result } of results) {
        lines.push(formatResult(result, adapter.getCapabilities().name));
        lines.push('');
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
}
// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
export const TOOL_DEFINITIONS = {
    codex_review: {
        name: 'codex_review',
        description: "ONLY use when user explicitly requests '/codex-review' or 'review with codex'. Get external second-opinion from OpenAI Codex CLI. Codex focuses on correctness, edge cases, and performance. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: { type: 'string', description: 'Working directory for the CLI to operate in' },
                ccOutput: { type: 'string', description: "Claude Code's output to review (findings, plan, analysis)" },
                outputType: { type: 'string', enum: ['plan', 'findings', 'analysis', 'proposal'], description: 'Type of output being reviewed' },
                analyzedFiles: { type: 'array', items: { type: 'string' }, description: 'File paths that CC analyzed' },
                focusAreas: { type: 'array', items: { type: 'string', enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'] }, description: 'Areas to focus the review on' },
                customPrompt: { type: 'string', description: 'Custom instructions for the reviewer' },
                reasoningEffort: { type: 'string', enum: ['high', 'xhigh'], description: 'Codex reasoning effort (default: high, use xhigh for deeper analysis)' },
                serviceTier: { type: 'string', enum: ['default', 'fast', 'flex'], description: 'Codex service tier (fast = priority processing, flex = cheaper/slower)' }
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
    gemini_review: {
        name: 'gemini_review',
        description: "ONLY use when user explicitly requests '/gemini-review' or 'review with gemini'. Get external second-opinion from Google Gemini CLI. Gemini focuses on design patterns, scalability, and tech debt. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: { type: 'string', description: 'Working directory for the CLI to operate in' },
                ccOutput: { type: 'string', description: "Claude Code's output to review (findings, plan, analysis)" },
                outputType: { type: 'string', enum: ['plan', 'findings', 'analysis', 'proposal'], description: 'Type of output being reviewed' },
                analyzedFiles: { type: 'array', items: { type: 'string' }, description: 'File paths that CC analyzed' },
                focusAreas: { type: 'array', items: { type: 'string', enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'] }, description: 'Areas to focus the review on' },
                customPrompt: { type: 'string', description: 'Custom instructions for the reviewer' },
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
    claude_review: {
        name: 'claude_review',
        description: "ONLY use when user explicitly requests '/claude-review' or 'review with claude'. Get second-opinion from a fresh Claude (Opus) instance with clean context — no memory of this session. Excels at deep analysis across all dimensions. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: { type: 'string', description: 'Working directory for the CLI to operate in' },
                ccOutput: { type: 'string', description: "Claude Code's output to review (findings, plan, analysis)" },
                outputType: { type: 'string', enum: ['plan', 'findings', 'analysis', 'proposal'], description: 'Type of output being reviewed' },
                analyzedFiles: { type: 'array', items: { type: 'string' }, description: 'File paths that CC analyzed' },
                focusAreas: { type: 'array', items: { type: 'string', enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'] }, description: 'Areas to focus the review on' },
                customPrompt: { type: 'string', description: 'Custom instructions for the reviewer' },
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
    multi_review: {
        name: 'multi_review',
        description: "ONLY use when user explicitly requests '/multi-review' or 'review with all models'. Get parallel second-opinions from Codex, Gemini, and a fresh Claude (Opus) instance. Returns combined reviews for synthesis. DO NOT use for general 'review' requests.",
        inputSchema: {
            type: 'object',
            properties: {
                workingDir: { type: 'string', description: 'Working directory for the CLI to operate in' },
                ccOutput: { type: 'string', description: "Claude Code's output to review (findings, plan, analysis)" },
                outputType: { type: 'string', enum: ['plan', 'findings', 'analysis', 'proposal'], description: 'Type of output being reviewed' },
                analyzedFiles: { type: 'array', items: { type: 'string' }, description: 'File paths that CC analyzed' },
                focusAreas: { type: 'array', items: { type: 'string', enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'] }, description: 'Areas to focus the review on' },
                customPrompt: { type: 'string', description: 'Custom instructions for the reviewer' },
                serviceTier: { type: 'string', enum: ['default', 'fast', 'flex'], description: 'Codex service tier (fast = priority processing, flex = cheaper/slower). Only applies to Codex.' }
            },
            required: ['workingDir', 'ccOutput', 'outputType']
        }
    },
};
