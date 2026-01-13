/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Specializes in correctness, edge cases, and performance analysis.
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
  EXPERT_ROLES,
} from './base.js';
import { ReviewOutput, parseReviewOutput, parseLegacyMarkdownOutput } from '../schema.js';
import { buildReviewPrompt, isValidFeedbackOutput } from '../prompt.js';
import {
  buildSimpleHandoff,
  buildHandoffPrompt,
  selectRole,
  FocusArea,
} from '../handoff.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const INACTIVITY_TIMEOUT_MS = 120000;  // 2 min of no output = timeout
const MAX_TIMEOUT_MS = 3600000;        // 60 min absolute max
const MAX_RETRIES = 2;
const MAX_BUFFER_SIZE = 1024 * 1024;   // 1MB max buffer

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
      supportsStructuredOutput: true,
      maxContextTokens: 128000,
      reasoningLevels: ['high', 'xhigh'],
    };
  }

  async isAvailable(): Promise<boolean> {
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

      // Select role based on focus areas
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
      const result = await this.runCli(prompt, request.workingDir, request.reasoningEffort || 'high');

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

      // If JSON parsing fails, try legacy markdown
      if (!output) {
        output = parseLegacyMarkdownOutput(result.stdout, 'codex');
      }

      // If still no valid output, retry or fail
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

  private runCli(
    prompt: string,
    workingDir: string,
    reasoningEffort: 'high' | 'xhigh'
  ): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        '-m', 'gpt-5.2-codex',
        '-c', `model_reasoning_effort=${reasoningEffort}`,
        '-c', 'model_reasoning_summary_format=experimental',
        '--dangerously-bypass-approvals-and-sandbox',
        '--skip-git-repo-check',
        '-C', workingDir,
        prompt
      ];

      const proc = spawn('codex', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let truncated = false;
      let inactivityTimer: NodeJS.Timeout;

      const maxTimer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('MAX_TIMEOUT'));
      }, MAX_TIMEOUT_MS);

      const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error('TIMEOUT'));
        }, INACTIVITY_TIMEOUT_MS);
      };

      resetInactivityTimer();

      proc.stdout.on('data', (data) => {
        resetInactivityTimer();
        if (stdout.length < MAX_BUFFER_SIZE) {
          stdout += data.toString();
          if (stdout.length > MAX_BUFFER_SIZE) {
            stdout = stdout.slice(0, MAX_BUFFER_SIZE);
            truncated = true;
          }
        }
      });

      proc.stderr.on('data', (data) => {
        resetInactivityTimer();
        if (stderr.length < MAX_BUFFER_SIZE) {
          stderr += data.toString();
          if (stderr.length > MAX_BUFFER_SIZE) {
            stderr = stderr.slice(0, MAX_BUFFER_SIZE);
          }
        }
      });

      proc.on('close', (code) => {
        clearTimeout(inactivityTimer);
        clearTimeout(maxTimer);
        resolve({ stdout, stderr, exitCode: code ?? -1, truncated });
      });

      proc.on('error', (err) => {
        clearTimeout(inactivityTimer);
        clearTimeout(maxTimer);
        reject(err);
      });
    });
  }

  private categorizeError(stderr: string): ReviewError {
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

  private getSuggestion(error: ReviewError): string {
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

  private parseRetryAfter(errorMessage: string): number | undefined {
    const match = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i);
    return match ? parseInt(match[1]) * 1000 : undefined;
  }
}

// Register the adapter
registerAdapter(new CodexAdapter());

// Export for direct use
export const codexAdapter = new CodexAdapter();
