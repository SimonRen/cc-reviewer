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
import { buildSimpleHandoff, buildHandoffPrompt, buildAdversarialHandoffPrompt, selectRole, } from '../handoff.js';
import { getConfig } from '../config.js';
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
            let settled = false;
            const done = (result) => { if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(result);
            } };
            const proc = spawn('gemini', ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            proc.on('close', (code) => done(code === 0));
            proc.on('error', () => done(false));
            const timer = setTimeout(() => { proc.kill(); done(false); }, 5000);
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
            const prompt = request.reviewMode === 'adversarial'
                ? buildAdversarialHandoffPrompt({ handoff })
                : buildHandoffPrompt({ handoff, role: selectRole(request.focusAreas) });
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
        const cfg = getConfig().gemini;
        const args = [
            '--sandbox',
            '--approval-mode', 'plan',
            '--output-format', 'stream-json',
            '--include-directories', workingDir,
            '-p', '',
        ];
        if (cfg.model) {
            args.push('--model', cfg.model);
        }
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
            inactivityTimeoutMs: cfg.inactivityTimeoutMs,
            maxTimeoutMs: cfg.maxTimeoutMs,
            maxBufferSize: cfg.maxBufferSize,
            onLine: (line) => {
                decoder.processLine(line);
            },
        });
        const result = await executor.run();
        const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
        console.error(`[gemini] ✓ complete (${elapsed}s)`);
        const finalResponse = decoder.getFinalResponse();
        if (!finalResponse && result.exitCode === 0) {
            return { stdout: '', stderr: 'Gemini produced no output — review may have failed silently', exitCode: 1, truncated: false };
        }
        return {
            stdout: finalResponse || '',
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
            return { type: 'rate_limit', message: `Rate limit or quota exceeded: ${stderr.slice(0, 500)}` };
        }
        if (lower.includes('unauthorized') || lower.includes('authentication') || lower.includes('api key') || stderr.includes('401') || stderr.includes('403')) {
            return { type: 'auth_error', message: `Authentication failed: ${stderr.slice(0, 500)}`, details: { stderr } };
        }
        return { type: 'cli_error', message: stderr.slice(0, 500) || 'Unknown error' };
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
