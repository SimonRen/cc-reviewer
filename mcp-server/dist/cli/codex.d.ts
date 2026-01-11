/**
 * Codex CLI Wrapper
 *
 * Uses OpenAI's Codex CLI in non-interactive mode (codex exec)
 * Reference: https://developers.openai.com/codex/cli/reference/
 */
import { FeedbackRequest, FeedbackResult } from '../types.js';
/**
 * Run Codex CLI with the given request
 */
export declare function runCodexReview(request: FeedbackRequest): Promise<FeedbackResult>;
