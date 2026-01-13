/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Specializes in correctness, edge cases, and performance analysis.
 */
import { ReviewerAdapter, ReviewerCapabilities, ReviewRequest, ReviewResult } from './base.js';
export declare class CodexAdapter implements ReviewerAdapter {
    readonly id = "codex";
    getCapabilities(): ReviewerCapabilities;
    isAvailable(): Promise<boolean>;
    runReview(request: ReviewRequest): Promise<ReviewResult>;
    private runWithRetry;
    private runCli;
    private categorizeError;
    private getSuggestion;
    private parseRetryAfter;
}
export declare const codexAdapter: CodexAdapter;
