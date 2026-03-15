/**
 * Codex CLI Adapter
 *
 * Implements the ReviewerAdapter interface for OpenAI's Codex CLI.
 * Returns raw text — no JSON parsing or schema enforcement.
 * CC handles interpretation of the reviewer's response.
 */
import { ReviewerAdapter, ReviewerCapabilities, ReviewRequest, ReviewResult, PeerRequest, PeerResult } from './base.js';
export declare class CodexAdapter implements ReviewerAdapter {
    readonly id = "codex";
    getCapabilities(): ReviewerCapabilities;
    isAvailable(): Promise<boolean>;
    runReview(request: ReviewRequest): Promise<ReviewResult>;
    runPeerRequest(request: PeerRequest): Promise<PeerResult>;
    private runCli;
    private handleException;
    private categorizeError;
    private getSuggestion;
}
export declare const codexAdapter: CodexAdapter;
