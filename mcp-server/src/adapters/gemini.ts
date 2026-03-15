/**
 * Gemini CLI Adapter
 *
 * Implements the ReviewerAdapter interface for Google's Gemini CLI.
 * Specializes in architecture, design patterns, and large-context analysis.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
  ReviewerAdapter,
  ReviewerCapabilities,
  ReviewRequest,
  ReviewResult,
  ReviewError,
  PeerRequest,
  PeerResult,
  registerAdapter,
} from './base.js';
import { parseReviewOutput, parseLegacyMarkdownOutput, parsePeerOutput, isSubstantiveReview } from '../schema.js';
import { CliExecutor } from '../executor.js';
import { GeminiEventDecoder } from '../decoders/index.js';
import {
  buildSimpleHandoff,
  buildHandoffPrompt,
  buildPeerPrompt,
  selectRole,
  FocusArea,
} from '../handoff.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const COLD_START_TIMEOUT_MS = 300_000; // 5 min — waiting for first JSONL event
const STREAMING_TIMEOUT_MS = 90_000;  // 90s — if events stop mid-stream
const MAX_TIMEOUT_MS = 3_600_000;     // 60 min absolute max
const MAX_RETRIES = 2;
const MAX_BUFFER_SIZE = 1024 * 1024;  // 1MB max buffer

// =============================================================================
// GEMINI ADAPTER
// =============================================================================

export class GeminiAdapter implements ReviewerAdapter {
  readonly id = 'gemini';

  getCapabilities(): ReviewerCapabilities {
    return {
      name: 'Gemini',
      description: 'Google Gemini - excels at architecture analysis, design patterns, and large codebase understanding',
      strengths: ['architecture', 'maintainability', 'scalability', 'documentation'],
      weaknesses: ['security'],
      hasFilesystemAccess: true,
      supportsStructuredOutput: true,
      maxContextTokens: 2000000, // Gemini has very large context
      reasoningLevels: undefined, // Gemini doesn't have configurable reasoning
    };
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('gemini', ['--version'], {
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

  async runReview(request: ReviewRequest): Promise<ReviewResult> {
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

  private async runWithRetry(
    request: ReviewRequest,
    attempt: number,
    startTime: number,
    previousError?: string,
    previousOutput?: string
  ): Promise<ReviewResult> {
    try {
      // Build the prompt using handoff protocol
      const handoff = buildSimpleHandoff(
        request.workingDir,
        request.ccOutput,
        request.analyzedFiles,
        request.focusAreas,
        request.customPrompt
      );

      // Select role based on focus areas (Gemini defaults to architect)
      const role = selectRole(request.focusAreas as FocusArea[] | undefined);

      // Build prompt with retry context if needed
      let prompt = buildHandoffPrompt({
        handoff,
        role,
        outputFormat: 'json',
      });

      // Add retry context if this is a retry attempt
      if (attempt > 0) {
        prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
          `Previous output had issues: ${previousError}\n` +
          `Please fix these issues and provide valid JSON output.\n` +
          (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
      }

      // Run the CLI
      const result = await this.runCli(prompt, request.workingDir);

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
        output = parseLegacyMarkdownOutput(result.stdout, 'gemini');
        usedFallback = true;
      }

      // If no valid output, retry or fail
      if (!output) {
        if (attempt < MAX_RETRIES) {
          return this.runWithRetry(
            request,
            attempt + 1,
            startTime,
            'Output did not match expected JSON schema',
            result.stdout
          );
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
          console.error(`[gemini] Received empty output, retrying...`);
          return this.runWithRetry(
            request,
            attempt + 1,
            startTime,
            usedFallback
              ? 'Received markdown output instead of JSON. Please provide valid JSON output.'
              : 'Output contained no substantive review content. Please provide findings or analysis.',
            result.stdout
          );
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

    } catch (error) {
      const err = error as Error & { code?: string };

      if (err.code === 'ENOENT') {
        return {
          success: false,
          error: {
            type: 'cli_not_found',
            message: 'Gemini CLI not found',
          },
          suggestion: 'Install with: npm install -g @google/gemini-cli',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (err.message === 'TIMEOUT') {
        return {
          success: false,
          error: {
            type: 'timeout',
            message: 'No output for 10 minutes - process may be hung',
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


  async runPeerRequest(request: PeerRequest): Promise<PeerResult> {
    const startTime = Date.now();

    if (!existsSync(request.workingDir)) {
      return {
        success: false,
        error: { type: 'cli_error', message: `Working directory does not exist: ${request.workingDir}` },
        suggestion: 'Check that the working directory path is correct',
        executionTimeMs: Date.now() - startTime,
      };
    }

    return this.runPeerWithRetry(request, 0, startTime);
  }

  private async runPeerWithRetry(
    request: PeerRequest,
    attempt: number,
    startTime: number,
    previousError?: string,
    previousOutput?: string
  ): Promise<PeerResult> {
    try {
      let prompt = buildPeerPrompt({
        workingDir: request.workingDir,
        prompt: request.prompt,
        taskType: request.taskType,
        relevantFiles: request.relevantFiles,
        context: request.context,
        focusAreas: request.focusAreas,
        customInstructions: request.customPrompt,
        outputFormat: 'json',
      });

      if (attempt > 0) {
        prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
          `Previous output had issues: ${previousError}\n` +
          `Please fix these issues and provide valid JSON output.\n` +
          (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
      }

      const result = await this.runCli(prompt, request.workingDir);

      if (result.exitCode !== 0) {
        const error = this.categorizeError(result.stderr);
        return {
          success: false, error,
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
          return this.runPeerWithRetry(request, attempt + 1, startTime,
            'Output did not match expected JSON schema', result.stdout);
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
        success: true, output,
        rawOutput: result.stdout,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT') {
        return { success: false, error: { type: 'cli_not_found', message: 'Gemini CLI not found' },
          suggestion: 'Install with: npm install -g @google/gemini-cli', executionTimeMs: Date.now() - startTime };
      }
      if (err.message === 'TIMEOUT') {
        return { success: false, error: { type: 'timeout', message: 'No output for 10 minutes' },
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

  private async runCli(
    prompt: string,
    workingDir: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
    const args = [
      '--yolo',
      '--output-format', 'stream-json',  // JSONL streaming events (was: json)
      '--include-directories', workingDir,
      '-p', '',  // Headless mode; prompt via stdin
    ];

    const decoder = new GeminiEventDecoder();
    const cliStartTime = Date.now();
    let firstEventReceived = false;

    console.error('[gemini] Running review...');

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
      inactivityTimeoutMs: COLD_START_TIMEOUT_MS,
      maxTimeoutMs: MAX_TIMEOUT_MS,
      maxBufferSize: MAX_BUFFER_SIZE,
      onLine: (line: string) => {
        decoder.processLine(line);

        if (!firstEventReceived) {
          firstEventReceived = true;
          executor.setInactivityTimeout(STREAMING_TIMEOUT_MS);
        }
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

  private categorizeError(stderr: string): ReviewError {
    const lower = stderr.toLowerCase();

    if (lower.includes('rate limit') || lower.includes('quota')) {
      return {
        type: 'rate_limit',
        message: 'Rate limit or quota exceeded',
        details: { retryAfterMs: this.parseRetryAfter(stderr) },
      };
    }

    if (lower.includes('unauthorized') || lower.includes('authentication') ||
        lower.includes('api key') || stderr.includes('401') || stderr.includes('403')) {
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

  private getSuggestion(error: ReviewError): string {
    switch (error.type) {
      case 'rate_limit':
        return 'Wait and retry, or use /codex instead';
      case 'auth_error':
        return 'Run `gemini` and follow auth prompts, or set GEMINI_API_KEY';
      case 'cli_not_found':
        return 'Install with: npm install -g @google/gemini-cli';
      default:
        return 'Check the error message and try again';
    }
  }

  private parseRetryAfter(errorMessage: string): number | undefined {
    const match = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i);
    return match ? parseInt(match[1]) * 1000 : undefined;
  }
}

// Register the adapter
registerAdapter(new GeminiAdapter());

// Export for direct use
export const geminiAdapter = new GeminiAdapter();
