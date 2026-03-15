/**
 * Gemini CLI Adapter
 *
 * Implements the ReviewerAdapter interface for Google's Gemini CLI.
 * Returns raw text — no JSON parsing or schema enforcement.
 * CC handles interpretation of the reviewer's response.
 */
import { ReviewerAdapter, ReviewerCapabilities, ReviewRequest, ReviewResult, PeerRequest, PeerResult } from './base.js';
export declare class GeminiAdapter implements ReviewerAdapter {
    readonly id = "gemini";
    getCapabilities(): ReviewerCapabilities;
    isAvailable(): Promise<boolean>;
    runReview(request: ReviewRequest): Promise<ReviewResult>;
    runPeerRequest(request: PeerRequest): Promise<PeerResult>;
    private runCli;
    private handleException;
    private categorizeError;
    private getSuggestion;
}
export declare const geminiAdapter: GeminiAdapter;
