/**
 * Gemini CLI Adapter
 *
 * Implements the ReviewerAdapter interface for Google's Gemini CLI.
 * Specializes in architecture, design patterns, and large-context analysis.
 */
import { ReviewerAdapter, ReviewerCapabilities, ReviewRequest, ReviewResult, PeerRequest, PeerResult } from './base.js';
export declare class GeminiAdapter implements ReviewerAdapter {
    readonly id = "gemini";
    getCapabilities(): ReviewerCapabilities;
    isAvailable(): Promise<boolean>;
    runReview(request: ReviewRequest): Promise<ReviewResult>;
    private runWithRetry;
    runPeerRequest(request: PeerRequest): Promise<PeerResult>;
    private runPeerWithRetry;
    private runCli;
    private categorizeError;
    private getSuggestion;
    private parseRetryAfter;
}
export declare const geminiAdapter: GeminiAdapter;
