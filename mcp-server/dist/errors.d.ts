/**
 * Error Handling for AI Reviewer MCP Server
 */
import { FeedbackError, CliType } from './types.js';
/**
 * Create a CLI not found error
 */
export declare function createCliNotFoundError(cli: CliType): FeedbackError;
/**
 * Create a timeout error
 */
export declare function createTimeoutError(cli: CliType, durationMs: number): FeedbackError;
/**
 * Create a rate limit error
 */
export declare function createRateLimitError(cli: CliType, retryAfterMs?: number): FeedbackError;
/**
 * Create an auth error
 */
export declare function createAuthError(cli: CliType, message: string): FeedbackError;
/**
 * Create an invalid response error
 */
export declare function createInvalidResponseError(cli: CliType, rawOutput: string): FeedbackError;
/**
 * Create a CLI crash error
 */
export declare function createCliError(cli: CliType, exitCode: number, stderr: string): FeedbackError;
/**
 * Format an error for user display
 */
export declare function formatErrorForUser(error: FeedbackError): string;
/**
 * Detect error type from CLI output and error messages
 */
export declare function detectErrorType(cli: CliType, error: Error & {
    code?: string;
}, stdout: string, stderr: string, exitCode: number | null): FeedbackError;
/**
 * Parse retry-after from error response
 */
export declare function parseRetryAfter(errorMessage: string): number | undefined;
/**
 * Generate suggestion based on error type
 */
export declare function getSuggestion(error: FeedbackError): string | undefined;
