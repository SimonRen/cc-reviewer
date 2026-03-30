/**
 * Claude CLI Adapter
 *
 * Implements the ReviewerAdapter interface for Anthropic's Claude CLI.
 * Spawns a FRESH Claude Code instance with zero session context.
 * Returns raw text — CC handles interpretation.
 *
 * Read-only enforcement (defense-in-depth):
 *   1. --permission-mode plan     (CLI-level read-only)
 *   2. --disallowed-tools         (write tools explicitly blocked)
 *   3. Handoff prompt             (explicit READ-ONLY instruction)
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { registerAdapter, } from './base.js';
import { CliExecutor } from '../executor.js';
import { ClaudeEventDecoder } from '../decoders/index.js';
import { buildSimpleHandoff, buildHandoffPrompt, selectRole, } from '../handoff.js';
// =============================================================================
// CONFIGURATION
// =============================================================================
const INACTIVITY_TIMEOUT_MS = 300_000; // 5 min — Opus has long thinking phases
const MAX_TIMEOUT_MS = 3_600_000; // 60 min absolute max
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer
// Write tools explicitly blocked as defense-in-depth
const DISALLOWED_TOOLS = 'Edit Write NotebookEdit';
// =============================================================================
// CLAUDE ADAPTER
// =============================================================================
export class ClaudeAdapter {
    id = 'claude';
    getCapabilities() {
        return {
            name: 'Claude',
            description: 'Anthropic Claude (Opus) - fresh instance with clean context, excels at deep analysis across all dimensions',
            strengths: ['correctness', 'security', 'architecture', 'maintainability'],
            weaknesses: [],
            hasFilesystemAccess: true,
            supportsStructuredOutput: false,
            maxContextTokens: 200000,
            reasoningLevels: undefined,
        };
    }
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('claude', ['--version'], {
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
                    error: { type: 'cli_error', message: 'Claude returned empty response' },
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
            '-p', // Non-interactive, print and exit
            '--model', 'opus', // Use Opus
            '--permission-mode', 'plan', // Read-only enforcement (layer 1)
            '--verbose', // Required for stream-json
            '--output-format', 'stream-json', // Structured streaming events
            '--no-session-persistence', // Ephemeral — no trace
            '--disable-slash-commands', // No skills — minimal startup
            '--disallowed-tools', DISALLOWED_TOOLS, // Block write tools (layer 2)
            '-', // Read prompt from stdin
        ];
        const decoder = new ClaudeEventDecoder();
        const cliStartTime = Date.now();
        console.error('[claude] Running Opus review...');
        decoder.onProgress = (eventType, detail) => {
            const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
            const detailStr = detail ? ` — ${detail}` : '';
            console.error(`[claude] ${eventType}${detailStr} (${elapsed}s)`);
        };
        const executor = new CliExecutor({
            command: 'claude',
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
        console.error(`[claude] ✓ complete (${elapsed}s)`);
        // Check for errors captured from stream events
        const decoderError = decoder.getError();
        if (decoderError) {
            return { stdout: '', stderr: decoderError, exitCode: 1, truncated: false };
        }
        const finalResponse = decoder.getFinalResponse();
        if (!finalResponse && decoder.hasNoOutput()) {
            return { stdout: '', stderr: 'No response from Claude — possible rate limit or auth issue', exitCode: 1, truncated: false };
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
            return { success: false, error: { type: 'cli_not_found', message: 'Claude CLI not found' },
                suggestion: 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code', executionTimeMs: Date.now() - startTime };
        }
        if (err.message === 'TIMEOUT') {
            return { success: false, error: { type: 'timeout', message: 'Claude timed out — no events received' },
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
        if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('no response from claude')) {
            return { type: 'rate_limit', message: 'Claude rate limit — try again later' };
        }
        if (lower.includes('unauthorized') || lower.includes('authentication') || lower.includes('api key') || stderr.includes('401') || stderr.includes('403')) {
            return { type: 'auth_error', message: 'Authentication failed', details: { stderr } };
        }
        return { type: 'cli_error', message: stderr || 'Unknown error' };
    }
    getSuggestion(error) {
        switch (error.type) {
            case 'rate_limit': return 'Wait and retry, or use /codex-review or /gemini-review instead';
            case 'auth_error': return 'Run `claude auth` to authenticate';
            case 'cli_not_found': return 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code';
            default: return 'Check the error message and try again';
        }
    }
}
// Register the adapter
registerAdapter(new ClaudeAdapter());
export const claudeAdapter = new ClaudeAdapter();
