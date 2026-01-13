/**
 * Enhanced Prompt Builder v2
 *
 * Builds prompts using rich context with:
 * - Layered information (summary → details)
 * - Focus-area specific emphasis
 * - Smart diff integration
 * - Explicit verification requirements
 * - Targeted questions from CC
 */
import { ReviewContext } from './context.js';
import { FocusArea } from './types.js';
export interface EnhancedPromptOptions {
    context: ReviewContext;
    reviewerName: string;
    focusAreas?: FocusArea[];
    maxContextTokens?: number;
    includeFullDiffs?: boolean;
    retryContext?: {
        attemptNumber: number;
        previousError: string;
    };
}
/**
 * Build an enhanced review prompt using rich context
 */
export declare function buildEnhancedPrompt(options: EnhancedPromptOptions): string;
/**
 * Build a prompt focused on reviewing a specific diff
 */
export declare function buildDiffReviewPrompt(diff: string, filePath: string, context: Partial<ReviewContext>, focusAreas?: FocusArea[]): string;
/**
 * Build a follow-up prompt for clarification
 */
export declare function buildFollowUpPrompt(originalContext: ReviewContext, previousReview: string, questions: Array<{
    question: string;
    context?: string;
}>): string;
