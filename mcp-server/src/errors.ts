/**
 * Error Handling for AI Reviewer MCP Server
 */

import { FeedbackError, CliType } from './types.js';

// CLI installation commands
// Codex: https://developers.openai.com/codex/cli/
// Gemini: https://github.com/google-gemini/gemini-cli
const INSTALL_COMMANDS: Record<CliType, string> = {
  codex: 'npm install -g @openai/codex-cli',
  gemini: 'npm install -g @google/gemini-cli',
  claude: 'https://docs.anthropic.com/en/docs/claude-code'
};

// Environment variables for API keys
const ENV_VARS: Record<CliType, string> = {
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  claude: 'ANTHROPIC_API_KEY'
};

// Authentication commands
const AUTH_COMMANDS: Record<CliType, string> = {
  codex: 'codex login',
  gemini: 'gemini (follow prompts)',
  claude: 'claude auth'
};

/**
 * Create a CLI not found error
 */
export function createCliNotFoundError(cli: CliType): FeedbackError {
  return {
    type: 'cli_not_found',
    cli,
    installCmd: INSTALL_COMMANDS[cli]
  };
}

/**
 * Create a timeout error
 */
export function createTimeoutError(cli: CliType, durationMs: number): FeedbackError {
  return {
    type: 'timeout',
    cli,
    durationMs
  };
}

/**
 * Create a rate limit error
 */
export function createRateLimitError(cli: CliType, retryAfterMs?: number): FeedbackError {
  return {
    type: 'rate_limit',
    cli,
    retryAfterMs
  };
}

/**
 * Create an auth error
 */
export function createAuthError(cli: CliType, message: string): FeedbackError {
  return {
    type: 'auth_error',
    cli,
    message
  };
}

/**
 * Create an invalid response error
 */
export function createInvalidResponseError(cli: CliType, rawOutput: string): FeedbackError {
  return {
    type: 'invalid_response',
    cli,
    rawOutput
  };
}

/**
 * Create a CLI crash error
 */
export function createCliError(cli: CliType, exitCode: number, stderr: string): FeedbackError {
  return {
    type: 'cli_error',
    cli,
    exitCode,
    stderr
  };
}

/**
 * Format an error for user display
 */
export function formatErrorForUser(error: FeedbackError): string {
  const others: CliType[] = (['codex', 'gemini', 'claude'] as CliType[]).filter(c => c !== error.cli);
  const otherCli = others[0];

  switch (error.type) {
    case 'cli_not_found':
      return `❌ ${error.cli} CLI not found.

Install with: ${error.installCmd}

Alternative: Use /${otherCli}-review instead`;

    case 'timeout':
      return `⏱️ ${error.cli} timed out after ${Math.round(error.durationMs / 1000)}s.

This might happen with complex reviews. Try:
• Reviewing a smaller scope
• Using --focus to narrow the review`;

    case 'rate_limit':
      const retryMsg = error.retryAfterMs
        ? `Try again in ${Math.ceil(error.retryAfterMs / 1000)}s`
        : 'Wait a moment and try again';
      return `🚫 ${error.cli} rate limit hit.

${retryMsg}

Alternative: Use /${otherCli}-review instead`;

    case 'auth_error':
      return `🔐 ${error.cli} authentication failed.

${error.message}

Check your API key: ${ENV_VARS[error.cli]}
Run: ${AUTH_COMMANDS[error.cli]}`;

    case 'invalid_response':
      return `⚠️ ${error.cli} returned an unusable response.

The output couldn't be parsed as valid feedback.
Raw output (truncated): ${error.rawOutput.slice(0, 200)}...`;

    case 'cli_error':
      return `❌ ${error.cli} crashed (exit code ${error.exitCode}).

${error.stderr}`;
  }
}

/**
 * Detect error type from CLI output and error messages
 */
export function detectErrorType(
  cli: CliType,
  error: Error & { code?: string },
  stdout: string,
  stderr: string,
  exitCode: number | null
): FeedbackError {
  // CLI not found
  if (error.code === 'ENOENT') {
    return createCliNotFoundError(cli);
  }

  // Rate limit
  if (
    stderr.toLowerCase().includes('rate limit') ||
    stdout.toLowerCase().includes('rate limit')
  ) {
    const retryAfterMatch = stderr.match(/retry after (\d+)/i);
    const retryAfterMs = retryAfterMatch ? parseInt(retryAfterMatch[1]) * 1000 : undefined;
    return createRateLimitError(cli, retryAfterMs);
  }

  // Auth error
  if (
    stderr.toLowerCase().includes('unauthorized') ||
    stderr.toLowerCase().includes('authentication') ||
    stderr.toLowerCase().includes('401') ||
    stderr.toLowerCase().includes('403')
  ) {
    return createAuthError(cli, stderr);
  }

  // Generic CLI error
  if (exitCode !== null && exitCode !== 0) {
    return createCliError(cli, exitCode, stderr);
  }

  // Invalid response (fallback)
  return createInvalidResponseError(cli, stdout);
}

/**
 * Parse retry-after from error response
 */
export function parseRetryAfter(errorMessage: string): number | undefined {
  const match = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1]) * 1000; // Convert to ms
  }
  return undefined;
}

/**
 * Generate suggestion based on error type
 */
export function getSuggestion(error: FeedbackError): string | undefined {
  switch (error.type) {
    case 'cli_not_found':
      return `Install ${error.cli} CLI or use the other model`;
    case 'timeout':
      return 'Try reviewing a smaller scope or using --focus';
    case 'rate_limit':
      return error.retryAfterMs
        ? `Wait ${Math.ceil(error.retryAfterMs / 1000)}s and retry`
        : 'Wait a moment and retry';
    case 'auth_error':
      return `Check your ${ENV_VARS[error.cli]} environment variable`;
    case 'invalid_response':
      return 'Retry with a more specific focus area';
    case 'cli_error':
      return 'Check the CLI documentation for troubleshooting';
    default:
      return undefined;
  }
}
