/**
 * Prompt Builder for AI Review
 *
 * Builds structured prompts that request JSON output from external CLIs.
 * Supports expert roles for specialized reviews.
 */
import { FocusArea, OutputType } from './types.js';
import { ReviewRequest, ExpertRole } from './adapters/base.js';
export interface PromptBuildOptions {
    /** Request details */
    request: ReviewRequest;
    /** Override the expert role */
    expertRole?: ExpertRole;
    /** Model identifier for the reviewer field */
    reviewerName: string;
    /** Whether to use JSON output (true) or legacy markdown (false) */
    useJsonOutput?: boolean;
    /** Retry context */
    retryContext?: {
        attemptNumber: number;
        previousError: string;
        previousOutput: string;
    };
}
/**
 * Build the main review prompt
 */
export declare function buildReviewPrompt(options: PromptBuildOptions): string;
/**
 * Build a prompt for peer review (one model reviewing another's output)
 */
export declare function buildPeerReviewPrompt(reviewerName: string, anonymizedReviewerId: string, reviewToScore: string, originalCcOutput: string): string;
export { FocusArea, OutputType };
/**
 * Legacy function - builds old-style 7-section prompt
 * @deprecated Use buildReviewPrompt instead
 */
export declare function build7SectionPrompt(request: {
    workingDir: string;
    ccOutput: string;
    outputType: OutputType;
    analyzedFiles?: string[];
    focusAreas?: FocusArea[];
    customPrompt?: string;
}): string;
/**
 * Legacy function - builds developer instructions
 * @deprecated Use buildReviewPrompt with expertRole instead
 */
export declare function buildDeveloperInstructions(cli: 'codex' | 'gemini'): string;
/**
 * Legacy function - builds retry prompt
 * @deprecated Use buildReviewPrompt with retryContext instead
 */
export declare function buildRetryPrompt(request: {
    workingDir: string;
    ccOutput: string;
    outputType: OutputType;
    analyzedFiles?: string[];
    focusAreas?: FocusArea[];
    customPrompt?: string;
}, attemptNumber: number, previousError: string, previousOutput: string): string;
/**
 * Validate feedback output structure
 * Now supports both JSON and legacy markdown formats
 */
export declare function isValidFeedbackOutput(output: string): boolean;
/**
 * Detect output type from CC's output content
 */
export declare function detectOutputType(ccOutput: string): OutputType;
