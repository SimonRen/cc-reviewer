/**
 * Gemini CLI Adapter
 *
 * Implements the ReviewerAdapter interface for Google's Gemini CLI.
 * Returns raw text — no JSON parsing or schema enforcement.
 * CC handles interpretation of the reviewer's response.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { registerAdapter, } from './base.js';
import { CliExecutor } from '../executor.js';
import { GeminiEventDecoder } from '../decoders/index.js';
import { buildSimpleHandoff, buildHandoffPrompt, selectRole, } from '../handoff.js';
// =============================================================================
// CONFIGURATION
// =============================================================================
const INACTIVITY_TIMEOUT_MS = 300_000; // 5 min — covers reasoning gaps between tool use
const MAX_TIMEOUT_MS = 3_600_000; // 60 min absolute max
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer
// =============================================================================
// GEMINI ADAPTER
// =============================================================================
export class GeminiAdapter {
    id = 'gemini';
    getCapabilities() {
        return {
            name: 'Gemini',
            description: 'Google Gemini - excels at architecture analysis, design patterns, and large codebase understanding',
            strengths: ['architecture', 'maintainability', 'scalability', 'documentation'],
            weaknesses: ['security'],
            hasFilesystemAccess: true,
            supportsStructuredOutput: false,
            maxContextTokens: 2000000,
            reasoningLevels: undefined,
        };
    }
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('gemini', ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
            setTimeout(() => { proc.kill(); resolve(false); }, 5000);
        });
    }
    async runReview(request) {
        const startTime = Date.now();
        if (!existsSync(request.workingDir)) {
            return {
                success: false,
                error: { type: 'cli_error', message: `Working directory does not exist: ${request.workingDir}` },
                suggestion: 'Check that the working directory path is correct',
                executionTimeMs: Date.now() - startTime,
            };
        }
        try {
            const handoff = buildSimpleHandoff(request.workingDir, request.ccOutput, request.analyzedFiles, request.focusAreas, request.customPrompt);
            const role = selectRole(request.focusAreas);
            const prompt = buildHandoffPrompt({ handoff, role });
            const result = await this.runCli(prompt, request.workingDir);
            if (result.exitCode !== 0) {
                const error = this.categorizeError(result.stderr);
                return { success: false, error, suggestion: this.getSuggestion(error), executionTimeMs: Date.now() - startTime };
            }
            if (!result.stdout.trim()) {
                return {
                    success: false,
                    error: { type: 'cli_error', message: 'Gemini returned empty response' },
                    suggestion: 'Try again or use /codex-review instead',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            return { success: true, output: result.stdout, executionTimeMs: Date.now() - startTime };
        }
        catch (error) {
            return this.handleException(error, startTime);
        }
    }
    async runCli(prompt, workingDir) {
        const args = [
            '--sandbox',
            '--approval-mode', 'plan',
            '--output-format', 'stream-json',
            '--include-directories', workingDir,
            '-p', '',
        ];
        const decoder = new GeminiEventDecoder();
        const cliStartTime = Date.now();
        console.error('[gemini] Running...');
        decoder.onProgress = (eventType, detail) => {
            const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
            const detailStr = detail ? ` — ${detail}` : '';
            console.error(`[gemini] ${eventType}${detailStr} (${elapsed}s)`);
        };
        const executor = new CliExecutor({
            command: 'gemini',
            args,
            cwd: workingDir,
            stdin: prompt,
            inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
            maxTimeoutMs: MAX_TIMEOUT_MS,
            maxBufferSize: MAX_BUFFER_SIZE,
            onLine: (line) => {
                decoder.processLine(line);
            },
        });
        const result = await executor.run();
        const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
        console.error(`[gemini] ✓ complete (${elapsed}s)`);
        const finalResponse = decoder.getFinalResponse();
        return {
            stdout: finalResponse || result.rawStdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            truncated: result.truncated,
        };
    }
    handleException(error, startTime) {
        const err = error;
        if (err.code === 'ENOENT') {
            return { success: false, error: { type: 'cli_not_found', message: 'Gemini CLI not found' },
                suggestion: 'Install with: npm install -g @google/gemini-cli', executionTimeMs: Date.now() - startTime };
        }
        if (err.message === 'TIMEOUT') {
            return { success: false, error: { type: 'timeout', message: 'Gemini timed out — no events received' },
                suggestion: 'Try a smaller scope or use /codex-review', executionTimeMs: Date.now() - startTime };
        }
        if (err.message === 'MAX_TIMEOUT') {
            return { success: false, error: { type: 'timeout', message: 'Task exceeded 60 minute maximum' },
                suggestion: 'Try a smaller scope', executionTimeMs: Date.now() - startTime };
        }
        return { success: false, error: { type: 'cli_error', message: err.message }, executionTimeMs: Date.now() - startTime };
    }
    categorizeError(stderr) {
        const lower = stderr.toLowerCase();
        if (lower.includes('rate limit') || lower.includes('quota')) {
            return { type: 'rate_limit', message: 'Rate limit or quota exceeded' };
        }
        if (lower.includes('unauthorized') || lower.includes('authentication') || lower.includes('api key') || stderr.includes('401') || stderr.includes('403')) {
            return { type: 'auth_error', message: 'Authentication failed', details: { stderr } };
        }
        return { type: 'cli_error', message: stderr || 'Unknown error' };
    }
    getSuggestion(error) {
        switch (error.type) {
            case 'rate_limit': return 'Wait and retry, or use /codex-review instead';
            case 'auth_error': return 'Run `gemini` and follow auth prompts, or set GEMINI_API_KEY';
            case 'cli_not_found': return 'Install with: npm install -g @google/gemini-cli';
            default: return 'Check the error message and try again';
        }
    }
}
// Register the adapter
registerAdapter(new GeminiAdapter());
export const geminiAdapter = new GeminiAdapter();
