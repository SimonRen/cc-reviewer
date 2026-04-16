/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Returns raw text — no JSON parsing or schema enforcement.
 * CC handles interpretation of the reviewer's response.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
  ReviewerAdapter,
  ReviewerCapabilities,
  ReviewRequest,
  ReviewResult,
  ReviewError,
  registerAdapter,
} from './base.js';
import { CliExecutor } from '../executor.js';
import { CodexEventDecoder } from '../decoders/index.js';
import {
  buildSimpleHandoff,
  buildHandoffPrompt,
  buildAdversarialHandoffPrompt,
  selectRole,
  FocusArea,
} from '../handoff.js';
import { getConfig } from '../config.js';

// =============================================================================
// CODEX ADAPTER
// =============================================================================

export class CodexAdapter implements ReviewerAdapter {
  readonly id = 'codex';

  getCapabilities(): ReviewerCapabilities {
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

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
      const proc = spawn('codex', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc.on('close', (code) => done(code === 0));
      proc.on('error', () => done(false));
      const timer = setTimeout(() => { proc.kill(); done(false); }, 5000);
    });
  }

  async runReview(request: ReviewRequest): Promise<ReviewResult> {
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
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const prompt = request.reviewMode === 'adversarial'
        ? buildAdversarialHandoffPrompt({ handoff })
        : buildHandoffPrompt({ handoff, role: selectRole(request.focusAreas as FocusArea[] | undefined) });

      const cfg = getConfig().codex;
      const result = await this.runCli(
        prompt,
        request.workingDir,
        request.reasoningEffort ?? cfg.reasoningEffort,
        request.serviceTier
      );

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
    } catch (error) {
      return this.handleException(error, startTime);
    }
  }

  private async runCli(
    prompt: string,
    workingDir: string,
    reasoningEffort: 'high' | 'xhigh',
    serviceTier?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
    const cfg = getConfig().codex;
    const args = [
      'exec',
      '--json',  // JSONL streaming events
      '-m', cfg.model,
      '-c', `model_reasoning_effort=${reasoningEffort}`,
      '-c', 'model_reasoning_summary_format=experimental',
      '--full-auto',
      '--sandbox', 'read-only',
      '--skip-git-repo-check',
      '-C', workingDir,
      '-',  // Read prompt from stdin
    ];

    // Caller-supplied serviceTier overrides config. Explicit 'default' is an
    // opt-out and emits no flag (uses Codex API default).
    const effectiveTier = serviceTier ?? cfg.serviceTier;
    if (effectiveTier !== 'default') {
      args.push('-c', `service_tier=${effectiveTier}`);
    }

    const decoder = new CodexEventDecoder();
    const cliStartTime = Date.now();

    const tierLabel = effectiveTier !== 'default' ? ` [${effectiveTier}]` : '';
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
      inactivityTimeoutMs: cfg.inactivityTimeoutMs[reasoningEffort] ?? cfg.inactivityTimeoutMs.high,
      maxTimeoutMs: cfg.maxTimeoutMs,
      maxBufferSize: cfg.maxBufferSize,
      onLine: (line: string) => {
        decoder.processLine(line);
      },
    });

    const result = await executor.run();
    const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
    console.error(`[codex] ✓ complete (${elapsed}s)`);

    // Check for errors captured from JSONL events
    const decoderError = decoder.getError();
    if (decoderError) {
      const combined = result.stderr ? `${decoderError}\n\nCLI stderr: ${result.stderr}` : decoderError;
      return { stdout: '', stderr: combined, exitCode: 1, truncated: false };
    }

    const finalResponse = decoder.getFinalResponse();
    if (!finalResponse && decoder.hasNoOutput()) {
      const combined = result.stderr ? `No output from Codex\n\nCLI stderr: ${result.stderr}` : 'No output from Codex';
      return { stdout: '', stderr: combined, exitCode: 1, truncated: false };
    }

    if (!finalResponse) {
      const combined = result.stderr ? `No result event from Codex\n\nCLI stderr: ${result.stderr}` : 'No result event from Codex';
      return { stdout: '', stderr: combined, exitCode: 1, truncated: false };
    }

    return {
      stdout: finalResponse,
      stderr: result.stderr,
      exitCode: result.exitCode,
      truncated: result.truncated,
    };
  }

  private handleException(error: unknown, startTime: number): ReviewResult {
    const err = error as Error & { code?: string };
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

  private categorizeError(stderr: string): ReviewError {
    const lower = stderr.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('rate_limit')) {
      return { type: 'rate_limit', message: `Codex rate limit: ${stderr.slice(0, 500)}` };
    }
    if (lower.includes('unauthorized') || lower.includes('authentication') || stderr.includes('401') || stderr.includes('403')) {
      return { type: 'auth_error', message: `Authentication failed: ${stderr.slice(0, 500)}`, details: { stderr } };
    }
    if (lower.includes('invalid_json_schema') || lower.includes('invalid_request_error')) {
      return { type: 'cli_error', message: `API error: ${stderr.slice(0, 500)}` };
    }
    return { type: 'cli_error', message: stderr.slice(0, 500) || 'Unknown error' };
  }

  private getSuggestion(error: ReviewError): string {
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
