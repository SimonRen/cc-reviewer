/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Specializes in correctness, edge cases, and performance analysis.
 */
import { spawn } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { registerAdapter, } from './base.js';
import { parseReviewOutput, parseLegacyMarkdownOutput, getReviewOutputJsonSchema, getPeerOutputJsonSchema, parsePeerOutput, isSubstantiveReview } from '../schema.js';
import { CliExecutor } from '../executor.js';
import { CodexEventDecoder } from '../decoders/index.js';
import { buildSimpleHandoff, buildHandoffPrompt, buildPeerPrompt, selectRole, } from '../handoff.js';
// =============================================================================
// CONFIGURATION
// =============================================================================
const COLD_START_TIMEOUT_MS = {
    high: 180_000, // 3 min — waiting for first JSONL event
    xhigh: 300_000, // 5 min — xhigh thinks longer before first event
};
const STREAMING_TIMEOUT_MS = 90_000; // 90s — if events stop mid-stream
const MAX_TIMEOUT_MS = 3_600_000; // 60 min absolute max
const MAX_RETRIES = 2;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer
// =============================================================================
// CODEX ADAPTER
// =============================================================================
export class CodexAdapter {
    id = 'codex';
    getCapabilities() {
        return {
            name: 'Codex',
            description: 'OpenAI Codex - excels at correctness analysis, edge cases, and performance optimization',
            strengths: ['correctness', 'performance', 'security', 'testing'],
            weaknesses: ['documentation'],
            hasFilesystemAccess: true,
            supportsStructuredOutput: true,
            maxContextTokens: 128000,
            reasoningLevels: ['high', 'xhigh'],
        };
    }
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('codex', ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            proc.on('close', (code) => {
                resolve(code === 0);
            });
            proc.on('error', () => {
                resolve(false);
            });
            // Timeout after 5s
            setTimeout(() => {
                proc.kill();
                resolve(false);
            }, 5000);
        });
    }
    async runReview(request) {
        const startTime = Date.now();
        // Validate working directory
        if (!existsSync(request.workingDir)) {
            return {
                success: false,
                error: {
                    type: 'cli_error',
                    message: `Working directory does not exist: ${request.workingDir}`,
                },
                suggestion: 'Check that the working directory path is correct',
                executionTimeMs: Date.now() - startTime,
            };
        }
        return this.runWithRetry(request, 0, startTime);
    }
    async runWithRetry(request, attempt, startTime, previousError, previousOutput) {
        try {
            // Build the prompt using handoff protocol
            const handoff = buildSimpleHandoff(request.workingDir, request.ccOutput, request.analyzedFiles, request.focusAreas, request.customPrompt);
            // Select role based on focus areas
            const role = selectRole(request.focusAreas);
            // Build prompt with retry context if needed
            // Use 'schema-enforced' since Codex gets --output-schema flag (avoids redundant inline JSON template)
            let prompt = buildHandoffPrompt({
                handoff,
                role,
                outputFormat: 'schema-enforced',
            });
            // Add retry context if this is a retry attempt
            if (attempt > 0) {
                prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
                    `Previous output had issues: ${previousError}\n` +
                    `Please fix these issues and provide valid JSON output.\n` +
                    (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
            }
            // Run the CLI
            const result = await this.runCli(prompt, request.workingDir, request.reasoningEffort || 'high', getReviewOutputJsonSchema, request.serviceTier);
            // Handle CLI errors
            if (result.exitCode !== 0) {
                const error = this.categorizeError(result.stderr);
                return {
                    success: false,
                    error,
                    suggestion: this.getSuggestion(error),
                    rawOutput: result.stderr,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            // Handle buffer truncation
            if (result.truncated) {
                return {
                    success: false,
                    error: {
                        type: 'cli_error',
                        message: 'Output exceeded maximum buffer size (1MB) and was truncated',
                    },
                    suggestion: 'Try reviewing a smaller scope with --focus',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            // Parse the output
            let output = parseReviewOutput(result.stdout);
            let usedFallback = false;
            // If JSON parsing fails, try legacy markdown
            if (!output) {
                output = parseLegacyMarkdownOutput(result.stdout, 'codex');
                usedFallback = true;
            }
            // If no valid output, retry or fail
            if (!output) {
                if (attempt < MAX_RETRIES) {
                    return this.runWithRetry(request, attempt + 1, startTime, 'Output did not match expected JSON schema', result.stdout);
                }
                return {
                    success: false,
                    error: {
                        type: 'parse_error',
                        message: 'Failed to parse reviewer output after retries',
                        details: { rawOutput: result.stdout.slice(0, 1000) },
                    },
                    suggestion: 'The model may not be following the output format. Try a different focus area.',
                    rawOutput: result.stdout,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            // Check for empty/minimal output — centralized substance check
            if (!isSubstantiveReview(output)) {
                if (attempt < MAX_RETRIES) {
                    console.error(`[codex] Received empty output, retrying...`);
                    return this.runWithRetry(request, attempt + 1, startTime, usedFallback
                        ? 'Received markdown output instead of JSON. Please provide valid JSON output.'
                        : 'Output contained no substantive review content. Please provide findings or analysis.', result.stdout);
                }
                return {
                    success: false,
                    error: {
                        type: 'parse_error',
                        message: 'Reviewer returned empty output after retries',
                        details: { rawOutput: result.stdout.slice(0, 1000) },
                    },
                    suggestion: 'The model returned no substantive review. Try a different focus area.',
                    rawOutput: result.stdout,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            return {
                success: true,
                output,
                rawOutput: result.stdout,
                executionTimeMs: Date.now() - startTime,
            };
        }
        catch (error) {
            const err = error;
            if (err.code === 'ENOENT') {
                return {
                    success: false,
                    error: {
                        type: 'cli_not_found',
                        message: 'Codex CLI not found',
                    },
                    suggestion: 'Install with: npm install -g @openai/codex',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            if (err.message === 'TIMEOUT') {
                return {
                    success: false,
                    error: {
                        type: 'timeout',
                        message: 'No output for 2 minutes - process may be hung',
                    },
                    suggestion: 'Try a smaller scope or use --focus',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            if (err.message === 'MAX_TIMEOUT') {
                return {
                    success: false,
                    error: {
                        type: 'timeout',
                        message: 'Task exceeded 60 minute maximum',
                    },
                    suggestion: 'Try a smaller scope',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            return {
                success: false,
                error: {
                    type: 'cli_error',
                    message: err.message,
                },
                executionTimeMs: Date.now() - startTime,
            };
        }
    }
    async runPeerRequest(request) {
        const startTime = Date.now();
        if (!existsSync(request.workingDir)) {
            return {
                success: false,
                error: {
                    type: 'cli_error',
                    message: `Working directory does not exist: ${request.workingDir}`,
                },
                suggestion: 'Check that the working directory path is correct',
                executionTimeMs: Date.now() - startTime,
            };
        }
        return this.runPeerWithRetry(request, 0, startTime);
    }
    async runPeerWithRetry(request, attempt, startTime, previousError, previousOutput) {
        try {
            // Use 'schema-enforced' since Codex gets --output-schema flag (avoids redundant inline JSON template)
            let prompt = buildPeerPrompt({
                workingDir: request.workingDir,
                prompt: request.prompt,
                taskType: request.taskType,
                relevantFiles: request.relevantFiles,
                context: request.context,
                focusAreas: request.focusAreas,
                customInstructions: request.customPrompt,
                outputFormat: 'schema-enforced',
            });
            if (attempt > 0) {
                prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
                    `Previous output had issues: ${previousError}\n` +
                    `Please fix these issues and provide valid JSON output.\n` +
                    (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
            }
            const result = await this.runCli(prompt, request.workingDir, request.reasoningEffort || 'high', getPeerOutputJsonSchema, request.serviceTier);
            if (result.exitCode !== 0) {
                const error = this.categorizeError(result.stderr);
                return {
                    success: false,
                    error,
                    suggestion: this.getSuggestion(error),
                    rawOutput: result.stderr,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            if (result.truncated) {
                return {
                    success: false,
                    error: { type: 'cli_error', message: 'Output exceeded maximum buffer size (1MB)' },
                    suggestion: 'Try a more focused request',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            const output = parsePeerOutput(result.stdout);
            if (!output) {
                if (attempt < MAX_RETRIES) {
                    return this.runPeerWithRetry(request, attempt + 1, startTime, 'Output did not match expected JSON schema', result.stdout);
                }
                return {
                    success: false,
                    error: { type: 'parse_error', message: 'Failed to parse peer output after retries',
                        details: { rawOutput: result.stdout.slice(0, 1000) } },
                    suggestion: 'The model may not be following the output format.',
                    rawOutput: result.stdout,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            return {
                success: true,
                output,
                rawOutput: result.stdout,
                executionTimeMs: Date.now() - startTime,
            };
        }
        catch (error) {
            const err = error;
            if (err.code === 'ENOENT') {
                return { success: false, error: { type: 'cli_not_found', message: 'Codex CLI not found' },
                    suggestion: 'Install with: npm install -g @openai/codex', executionTimeMs: Date.now() - startTime };
            }
            if (err.message === 'TIMEOUT') {
                return { success: false, error: { type: 'timeout', message: 'No output for 2 minutes' },
                    suggestion: 'Try a simpler request', executionTimeMs: Date.now() - startTime };
            }
            if (err.message === 'MAX_TIMEOUT') {
                return { success: false, error: { type: 'timeout', message: 'Task exceeded 60 minute maximum' },
                    suggestion: 'Try a smaller scope', executionTimeMs: Date.now() - startTime };
            }
            return { success: false, error: { type: 'cli_error', message: err.message },
                executionTimeMs: Date.now() - startTime };
        }
    }
    async runCli(prompt, workingDir, reasoningEffort, schemaGetter, serviceTier) {
        // Create temp schema file for structured output
        let schemaFile = null;
        try {
            const tempDir = mkdtempSync(join(tmpdir(), 'codex-schema-'));
            schemaFile = join(tempDir, 'schema.json');
            const schema = schemaGetter();
            writeFileSync(schemaFile, JSON.stringify(schema, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[codex] Warning: Failed to create schema file:', err);
            schemaFile = null;
        }
        const args = [
            'exec',
            '--json', // JSONL streaming events
            '-m', 'gpt-5.4',
            '-c', `model_reasoning_effort=${reasoningEffort}`,
            '-c', 'model_reasoning_summary_format=experimental',
            '--dangerously-bypass-approvals-and-sandbox',
            '--skip-git-repo-check',
            '-C', workingDir,
        ];
        if (serviceTier && serviceTier !== 'default') {
            args.push('-c', `service_tier=${serviceTier}`);
        }
        if (schemaFile) {
            args.push('--output-schema', schemaFile);
        }
        args.push('-'); // Read prompt from stdin
        const decoder = new CodexEventDecoder();
        const cliStartTime = Date.now();
        let firstEventReceived = false;
        const tierLabel = serviceTier && serviceTier !== 'default' ? ` [${serviceTier}]` : '';
        console.error(`[codex] Running review with ${reasoningEffort} reasoning${tierLabel}...`);
        decoder.onProgress = (eventType, detail) => {
            const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
            const detailStr = detail ? ` — ${detail}` : '';
            console.error(`[codex] ${eventType}${detailStr} (${elapsed}s)`);
        };
        const executor = new CliExecutor({
            command: 'codex',
            args,
            cwd: workingDir,
            stdin: prompt,
            inactivityTimeoutMs: COLD_START_TIMEOUT_MS[reasoningEffort] || COLD_START_TIMEOUT_MS.high,
            maxTimeoutMs: MAX_TIMEOUT_MS,
            maxBufferSize: MAX_BUFFER_SIZE,
            onLine: (line) => {
                decoder.processLine(line);
                // Phase transition: tighten timeout after first event
                if (!firstEventReceived) {
                    firstEventReceived = true;
                    executor.setInactivityTimeout(STREAMING_TIMEOUT_MS);
                }
            },
        });
        try {
            const result = await executor.run();
            const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
            console.error(`[codex] ✓ complete (${elapsed}s)`);
            const finalResponse = decoder.getFinalResponse();
            return {
                stdout: finalResponse || result.rawStdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                truncated: result.truncated,
            };
        }
        finally {
            if (schemaFile) {
                try {
                    unlinkSync(schemaFile);
                }
                catch { /* ignore */ }
            }
        }
    }
    categorizeError(stderr) {
        const lower = stderr.toLowerCase();
        if (lower.includes('rate limit')) {
            return {
                type: 'rate_limit',
                message: 'Rate limit exceeded',
                details: { retryAfterMs: this.parseRetryAfter(stderr) },
            };
        }
        if (lower.includes('unauthorized') || lower.includes('authentication') ||
            stderr.includes('401') || stderr.includes('403')) {
            return {
                type: 'auth_error',
                message: 'Authentication failed',
                details: { stderr },
            };
        }
        return {
            type: 'cli_error',
            message: stderr || 'Unknown error',
        };
    }
    getSuggestion(error) {
        switch (error.type) {
            case 'rate_limit':
                return 'Wait and retry, or use /gemini instead';
            case 'auth_error':
                return 'Run `codex login` to authenticate';
            case 'cli_not_found':
                return 'Install with: npm install -g @openai/codex';
            default:
                return 'Check the error message and try again';
        }
    }
    parseRetryAfter(errorMessage) {
        const match = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i);
        return match ? parseInt(match[1]) * 1000 : undefined;
    }
}
// Register the adapter
registerAdapter(new CodexAdapter());
// Export for direct use
export const codexAdapter = new CodexAdapter();
