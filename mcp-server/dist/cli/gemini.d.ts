/**
 * Gemini CLI Wrapper
 *
 * Uses Google's Gemini CLI in non-interactive mode (gemini -p)
 * Reference: https://github.com/google-gemini/gemini-cli
 * Package: @google/gemini-cli
 */
import { FeedbackRequest, FeedbackResult } from '../types.js';
/**
 * Run Gemini CLI with the given request
 */
export declare function runGeminiReview(request: FeedbackRequest): Promise<FeedbackResult>;
