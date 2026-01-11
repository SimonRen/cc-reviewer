/**
 * Codex CLI Wrapper
 *
 * Uses OpenAI's Codex CLI in non-interactive mode (codex exec)
 * Reference: https://developers.openai.com/codex/cli/reference/
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { FeedbackRequest, FeedbackResult } from '../types.js';
import { build7SectionPrompt, buildDeveloperInstructions, buildRetryPrompt, isValidFeedbackOutput } from '../prompt.js';
import { createTimeoutError, createCliNotFoundError, getSuggestion } from '../errors.js';

const TIMEOUT_MS = 180000; // 3 minutes (Codex can be slow)
const MAX_RETRIES = 2;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer to prevent memory issues

/**
 * Run Codex CLI with the given request
 */
export async function runCodexReview(request: FeedbackRequest): Promise<FeedbackResult> {
  // Validate workingDir exists before running
  if (!existsSync(request.workingDir)) {
    return {
      success: false,
      error: {
        type: 'cli_error',
        cli: 'codex',
        exitCode: -1,
        stderr: `Working directory does not exist: ${request.workingDir}`
      },
      suggestion: 'Check that the working directory path is correct',
      model: 'codex'
    };
  }

  return runWithRetry(request, 0);
}

/**
 * Run Codex with retry logic
 */
async function runWithRetry(
  request: FeedbackRequest,
  attempt: number,
  previousError?: string,
  previousOutput?: string
): Promise<FeedbackResult> {
  try {
    // Build the prompt (use retry prompt if this is a retry)
    const basePrompt = attempt === 0
      ? build7SectionPrompt(request)
      : buildRetryPrompt(request, attempt + 1, previousError!, previousOutput!);

    const developerInstructions = buildDeveloperInstructions('codex');

    // Combine developer instructions with the prompt for Codex
    // Codex exec doesn't have a separate system instruction flag
    const fullPrompt = `${developerInstructions}\n\n---\n\n${basePrompt}`;

    // Run the CLI
    const result = await runCodexCli(fullPrompt, request.workingDir);

    // Check for CLI errors
    if (result.exitCode !== 0) {
      // Check for specific error patterns in stderr
      if (result.stderr.toLowerCase().includes('rate limit')) {
        return {
          success: false,
          error: {
            type: 'rate_limit',
            cli: 'codex',
            retryAfterMs: parseRetryAfter(result.stderr)
          },
          suggestion: 'Wait and retry, or use /gemini-review instead',
          model: 'codex'
        };
      }

      if (result.stderr.toLowerCase().includes('unauthorized') ||
          result.stderr.toLowerCase().includes('authentication') ||
          result.stderr.includes('401') ||
          result.stderr.includes('403')) {
        return {
          success: false,
          error: {
            type: 'auth_error',
            cli: 'codex',
            message: result.stderr
          },
          suggestion: 'Run `codex login` to authenticate',
          model: 'codex'
        };
      }

      return {
        success: false,
        error: {
          type: 'cli_error',
          cli: 'codex',
          exitCode: result.exitCode,
          stderr: result.stderr
        },
        model: 'codex'
      };
    }

    // Check for buffer truncation warning
    if (result.truncated) {
      return {
        success: false,
        error: {
          type: 'cli_error',
          cli: 'codex',
          exitCode: 0,
          stderr: 'Output exceeded maximum buffer size (1MB) and was truncated'
        },
        suggestion: 'Try reviewing a smaller scope with --focus',
        model: 'codex'
      };
    }

    // Validate the response structure
    if (!isValidFeedbackOutput(result.stdout)) {
      if (attempt < MAX_RETRIES) {
        // Retry with history
        return runWithRetry(
          request,
          attempt + 1,
          'Output missing required sections (Agreements, Disagreements, Additions, Alternatives, Risk Assessment)',
          result.stdout
        );
      }
      // Max retries reached, return invalid response error
      return {
        success: false,
        error: {
          type: 'invalid_response',
          cli: 'codex',
          rawOutput: result.stdout
        },
        suggestion: getSuggestion({ type: 'invalid_response', cli: 'codex', rawOutput: result.stdout }),
        model: 'codex'
      };
    }

    return {
      success: true,
      feedback: result.stdout,
      model: 'codex'
    };

  } catch (error) {
    const err = error as Error & { code?: string };

    // Handle CLI not found (ENOENT for the codex binary itself)
    if (err.code === 'ENOENT') {
      return {
        success: false,
        error: createCliNotFoundError('codex'),
        suggestion: getSuggestion(createCliNotFoundError('codex')),
        model: 'codex'
      };
    }

    if (err.message === 'TIMEOUT') {
      return {
        success: false,
        error: createTimeoutError('codex', TIMEOUT_MS),
        suggestion: getSuggestion(createTimeoutError('codex', TIMEOUT_MS)),
        model: 'codex'
      };
    }

    // Generic error
    return {
      success: false,
      error: {
        type: 'cli_error',
        cli: 'codex',
        exitCode: -1,
        stderr: err.message
      },
      model: 'codex'
    };
  }
}

/**
 * Execute the Codex CLI in non-interactive mode
 *
 * Uses user's preferred flags:
 * codex exec -m gpt-5.2-codex -c model_reasoning_effort="xhigh" \
 *   -c model_reasoning_summary_format=experimental --search \
 *   --dangerously-bypass-approvals-and-sandbox "<prompt>"
 */
function runCodexCli(
  prompt: string,
  workingDir: string
): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    // Build CLI arguments for non-interactive execution
    // Uses: codex exec -m gpt-5.2-codex -c model_reasoning_effort="xhigh" ...
    const args = [
      'exec',
      '-m', 'gpt-5.2-codex',
      '-c', 'model_reasoning_effort=xhigh',
      '-c', 'model_reasoning_summary_format=experimental',
      '--search',
      '--dangerously-bypass-approvals-and-sandbox',
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

    proc.stdout.on('data', (data) => {
      if (stdout.length < MAX_BUFFER_SIZE) {
        stdout += data.toString();
        if (stdout.length > MAX_BUFFER_SIZE) {
          stdout = stdout.slice(0, MAX_BUFFER_SIZE);
          truncated = true;
        }
      }
    });

    proc.stderr.on('data', (data) => {
      if (stderr.length < MAX_BUFFER_SIZE) {
        stderr += data.toString();
        if (stderr.length > MAX_BUFFER_SIZE) {
          stderr = stderr.slice(0, MAX_BUFFER_SIZE);
        }
      }
    });

    // Timeout handling
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('TIMEOUT'));
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
        truncated
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Parse retry-after duration from error message
 */
function parseRetryAfter(errorMessage: string): number | undefined {
  const match = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1]) * 1000; // Convert to ms
  }
  return undefined;
}
