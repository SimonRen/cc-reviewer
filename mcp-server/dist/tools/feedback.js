/**
 * MCP Tool Implementations for AI Reviewer
 */
import { z } from 'zod';
import { runCodexReview } from '../cli/codex.js';
import { runGeminiReview } from '../cli/gemini.js';
import { isCliAvailable } from '../cli/check.js';
import { formatErrorForUser } from '../errors.js';
// Input schema for feedback tools
export const FeedbackInputSchema = z.object({
    workingDir: z.string().describe('Working directory for the CLI to operate in'),
    ccOutput: z.string().describe("Claude Code's output to review (findings, plan, analysis)"),
    outputType: z.enum(['plan', 'findings', 'analysis', 'proposal']).describe('Type of output being reviewed'),
    analyzedFiles: z.array(z.string()).optional().describe('File paths that CC analyzed'),
    focusAreas: z.array(z.enum([
        'security', 'performance', 'architecture', 'correctness',
        'maintainability', 'scalability', 'testing', 'documentation'
    ])).optional().describe('Areas to focus the review on'),
    customPrompt: z.string().optional().describe('Custom instructions for the reviewer'),
    reasoningEffort: z.enum(['high', 'xhigh']).optional().describe('Codex reasoning effort level (default: high, use xhigh for deeper analysis)')
});
/**
 * Convert tool input to FeedbackRequest
 */
function toFeedbackRequest(input) {
    return {
        workingDir: input.workingDir,
        ccOutput: input.ccOutput,
        outputType: input.outputType,
        analyzedFiles: input.analyzedFiles,
        focusAreas: input.focusAreas,
        customPrompt: input.customPrompt,
        reasoningEffort: input.reasoningEffort
    };
}
/**
 * Format successful feedback for display
 */
function formatSuccessResponse(result) {
    if (!result.success) {
        return formatErrorResponse(result);
    }
    return `## ${result.model.charAt(0).toUpperCase() + result.model.slice(1)} Review

${result.feedback}`;
}
/**
 * Format error response for display
 */
function formatErrorResponse(result) {
    if (result.success) {
        return result.feedback;
    }
    let response = formatErrorForUser(result.error);
    if (result.suggestion) {
        response += `\n\n💡 Suggestion: ${result.suggestion}`;
    }
    return response;
}
/**
 * Codex feedback tool handler
 */
export async function handleCodexFeedback(input) {
    // Check if Codex CLI is available
    const available = await isCliAvailable('codex');
    if (!available) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Codex CLI not found.\n\nInstall with: npm install -g @openai/codex\n\nAlternative: Use gemini_feedback instead'
                }]
        };
    }
    const request = toFeedbackRequest(input);
    const result = await runCodexReview(request);
    return {
        content: [{
                type: 'text',
                text: formatSuccessResponse(result)
            }]
    };
}
/**
 * Gemini feedback tool handler
 */
export async function handleGeminiFeedback(input) {
    // Check if Gemini CLI is available
    const available = await isCliAvailable('gemini');
    if (!available) {
        return {
            content: [{
                    type: 'text',
                    text: '❌ Gemini CLI not found.\n\nInstall with: npm install -g @google/generative-ai-cli\n\nAlternative: Use codex_feedback instead'
                }]
        };
    }
    const request = toFeedbackRequest(input);
    const result = await runGeminiReview(request);
    return {
        content: [{
                type: 'text',
                text: formatSuccessResponse(result)
            }]
    };
}
/**
 * Multi-model feedback tool handler (parallel execution)
 */
export async function handleMultiFeedback(input) {
    const request = toFeedbackRequest(input);
    // Check availability of both CLIs
    const [codexAvailable, geminiAvailable] = await Promise.all([
        isCliAvailable('codex'),
        isCliAvailable('gemini')
    ]);
    if (!codexAvailable && !geminiAvailable) {
        return {
            content: [{
                    type: 'text',
                    text: `❌ No AI CLIs found.

Install at least one:
  - Codex: npm install -g @openai/codex
  - Gemini: npm install -g @google/generative-ai-cli`
                }]
        };
    }
    // Run available CLIs in parallel
    const promises = [];
    const cliNames = [];
    if (codexAvailable) {
        promises.push(runCodexReview(request));
        cliNames.push('codex');
    }
    if (geminiAvailable) {
        promises.push(runGeminiReview(request));
        cliNames.push('gemini');
    }
    const results = await Promise.allSettled(promises);
    // Process results
    const multiResult = {
        successful: [],
        failed: [],
        partialSuccess: false,
        allFailed: false
    };
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            const feedbackResult = result.value;
            if (feedbackResult.success) {
                multiResult.successful.push({
                    model: feedbackResult.model,
                    feedback: feedbackResult.feedback
                });
            }
            else {
                multiResult.failed.push({
                    model: feedbackResult.model,
                    error: feedbackResult.error
                });
            }
        }
        else {
            // Promise rejected (unexpected)
            multiResult.failed.push({
                model: cliNames[index],
                error: {
                    type: 'cli_error',
                    cli: cliNames[index],
                    exitCode: -1,
                    stderr: result.reason?.message || 'Unknown error'
                }
            });
        }
    });
    multiResult.partialSuccess = multiResult.successful.length > 0 && multiResult.failed.length > 0;
    multiResult.allFailed = multiResult.successful.length === 0;
    // Format response
    return {
        content: [{
                type: 'text',
                text: formatMultiResponse(multiResult, codexAvailable, geminiAvailable)
            }]
    };
}
/**
 * Format multi-model response
 */
function formatMultiResponse(result, codexAvailable, geminiAvailable) {
    const parts = [];
    // Header with status
    if (result.allFailed) {
        parts.push('## Multi-Model Review - All Failed ❌\n');
    }
    else if (result.partialSuccess) {
        parts.push('## Multi-Model Review - Partial Success ⚠️\n');
    }
    else {
        parts.push('## Multi-Model Review ✓\n');
    }
    // Show availability status
    const statusLines = [];
    if (!codexAvailable)
        statusLines.push('- Codex: Not available');
    if (!geminiAvailable)
        statusLines.push('- Gemini: Not available');
    if (statusLines.length > 0) {
        parts.push('**CLI Status:**');
        parts.push(statusLines.join('\n'));
        parts.push('');
    }
    // Successful reviews
    if (result.successful.length > 0) {
        for (const success of result.successful) {
            parts.push(`### ${success.model.charAt(0).toUpperCase() + success.model.slice(1)} Review\n`);
            parts.push(success.feedback);
            parts.push('');
        }
    }
    // Failed reviews
    if (result.failed.length > 0) {
        parts.push('### Failures\n');
        for (const failure of result.failed) {
            parts.push(`**${failure.model}:** ${formatErrorForUser(failure.error)}\n`);
        }
    }
    // Synthesis instruction (only if we have successful results)
    if (result.successful.length > 1) {
        parts.push(`---

**Note:** Both models provided feedback above. Please synthesize their perspectives:
- Mark agreements with ✓✓
- Resolve conflicts with your recommendation
- Highlight unique insights from each model`);
    }
    return parts.join('\n');
}
/**
 * Tool definitions for MCP registration
 */
export const TOOL_DEFINITIONS = {
    codex_feedback: {
        name: 'codex_feedback',
        description: "Get Codex's review of Claude Code's work. Codex focuses on correctness, edge cases, and performance.",
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
    gemini_feedback: {
        name: 'gemini_feedback',
        description: "Get Gemini's review of Claude Code's work. Gemini focuses on design patterns, scalability, and tech debt.",
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
    multi_feedback: {
        name: 'multi_feedback',
        description: "Get parallel reviews from all available AI CLIs (Codex and Gemini). Returns combined feedback for synthesis.",
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
    }
};
