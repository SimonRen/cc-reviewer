/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Returns raw text — no JSON parsing or schema enforcement.
 * CC handles interpretation of the reviewer's response.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { registerAdapter, } from './base.js';
import { CliExecutor } from '../executor.js';
import { CodexEventDecoder } from '../decoders/index.js';
import { buildSimpleHandoff, buildHandoffPrompt, selectRole, } from '../handoff.js';
// =============================================================================
// CONFIGURATION
// =============================================================================
const INACTIVITY_TIMEOUT_MS = {
    high: 180_000, // 3 min — covers reasoning gaps between tool use bursts
    xhigh: 300_000, // 5 min — xhigh has longer reasoning phases
};
const MAX_TIMEOUT_MS = 3_600_000; // 60 min absolute max
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
            supportsStructuredOutput: false,
            maxContextTokens: 128000,
            reasoningLevels: ['high', 'xhigh'],
        };
    }
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('codex', ['--version'], {
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
            const result = await this.runCli(prompt, request.workingDir, request.reasoningEffort || 'high', request.serviceTier);
            if (result.exitCode !== 0) {
                const error = this.categorizeError(result.stderr);
                return { success: false, error, suggestion: this.getSuggestion(error), executionTimeMs: Date.now() - startTime };
            }
            if (!result.stdout.trim()) {
                return {
                    success: false,
                    error: { type: 'cli_error', message: 'Codex returned empty response' },
                    suggestion: 'Try again or use /gemini-review instead',
                    executionTimeMs: Date.now() - startTime,
                };
            }
            return { success: true, output: result.stdout, executionTimeMs: Date.now() - startTime };
        }
        catch (error) {
            return this.handleException(error, startTime);
        }
    }
    async runCli(prompt, workingDir, reasoningEffort, serviceTier) {
        const args = [
            'exec',
            '--json', // JSONL streaming events
            '-m', 'gpt-5.4',
            '-c', `model_reasoning_effort=${reasoningEffort}`,
            '-c', 'model_reasoning_summary_format=experimental',
            '--dangerously-bypass-approvals-and-sandbox',
            '--skip-git-repo-check',
            '-C', workingDir,
            '-', // Read prompt from stdin
        ];
        if (serviceTier && serviceTier !== 'default') {
            args.push('-c', `service_tier=${serviceTier}`);
        }
        const decoder = new CodexEventDecoder();
        const cliStartTime = Date.now();
        const tierLabel = serviceTier && serviceTier !== 'default' ? ` [${serviceTier}]` : '';
        console.error(`[codex] Running with ${reasoningEffort} reasoning${tierLabel}...`);
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
            inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS[reasoningEffort] || INACTIVITY_TIMEOUT_MS.high,
            maxTimeoutMs: MAX_TIMEOUT_MS,
            maxBufferSize: MAX_BUFFER_SIZE,
            onLine: (line) => {
                decoder.processLine(line);
            },
        });
        const result = await executor.run();
        const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
        console.error(`[codex] ✓ complete (${elapsed}s)`);
        // Check for errors captured from JSONL events
        const decoderError = decoder.getError();
        if (decoderError) {
            return { stdout: '', stderr: decoderError, exitCode: 1, truncated: false };
        }
        const finalResponse = decoder.getFinalResponse();
        if (!finalResponse && decoder.hasNoOutput()) {
            return { stdout: '', stderr: 'No response from Codex — possible rate limit or model rejection', exitCode: 1, truncated: false };
        }
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
            return { success: false, error: { type: 'cli_not_found', message: 'Codex CLI not found' },
                suggestion: 'Install with: npm install -g @openai/codex-cli', executionTimeMs: Date.now() - startTime };
        }
        if (err.message === 'TIMEOUT') {
            return { success: false, error: { type: 'timeout', message: 'Codex timed out — no events received' },
                suggestion: 'Try a smaller scope or use /gemini-review', executionTimeMs: Date.now() - startTime };
        }
        if (err.message === 'MAX_TIMEOUT') {
            return { success: false, error: { type: 'timeout', message: 'Task exceeded 60 minute maximum' },
                suggestion: 'Try a smaller scope', executionTimeMs: Date.now() - startTime };
        }
        return { success: false, error: { type: 'cli_error', message: err.message }, executionTimeMs: Date.now() - startTime };
    }
    categorizeError(stderr) {
        const lower = stderr.toLowerCase();
        if (lower.includes('rate limit') || lower.includes('possible rate limit') || lower.includes('no response from codex')) {
            return { type: 'rate_limit', message: 'Codex rate limit — no tokens available' };
        }
        if (lower.includes('unauthorized') || lower.includes('authentication') || stderr.includes('401') || stderr.includes('403')) {
            return { type: 'auth_error', message: 'Authentication failed', details: { stderr } };
        }
        if (lower.includes('invalid_json_schema') || lower.includes('invalid_request_error')) {
            return { type: 'cli_error', message: `API error: ${stderr.slice(0, 300)}` };
        }
        return { type: 'cli_error', message: stderr || 'Unknown error' };
    }
    getSuggestion(error) {
        switch (error.type) {
            case 'rate_limit': return 'Wait and retry, or use /gemini-review instead';
            case 'auth_error': return 'Run `codex login` to authenticate';
            case 'cli_not_found': return 'Install with: npm install -g @openai/codex-cli';
            default: return 'Check the error message and try again';
        }
    }
}
// Register the adapter
registerAdapter(new CodexAdapter());
export const codexAdapter = new CodexAdapter();
