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
import { ReviewerAdapter, ReviewerCapabilities, ReviewRequest, ReviewResult } from './base.js';
export declare class ClaudeAdapter implements ReviewerAdapter {
    readonly id = "claude";
    getCapabilities(): ReviewerCapabilities;
    isAvailable(): Promise<boolean>;
    runReview(request: ReviewRequest): Promise<ReviewResult>;
    private runCli;
    private handleException;
    private categorizeError;
    private getSuggestion;
}
export declare const claudeAdapter: ClaudeAdapter;
