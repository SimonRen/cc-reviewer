/**
 * 7-Section Prompt Builder for External CLI Delegation
 */
import { FeedbackRequest, CliType } from './types.js';
/**
 * Build the 7-section delegation prompt for external CLIs
 */
export declare function build7SectionPrompt(request: FeedbackRequest): string;
/**
 * Build the developer instructions (persona) for a specific CLI
 */
export declare function buildDeveloperInstructions(cli: CliType): string;
/**
 * Build a retry prompt that includes previous attempt information
 */
export declare function buildRetryPrompt(request: FeedbackRequest, attemptNumber: number, previousError: string, previousOutput: string): string;
/**
 * Detect output type from CC's output content
 */
export declare function detectOutputType(ccOutput: string): 'findings' | 'plan' | 'proposal' | 'analysis';
/**
 * Validate that external CLI output follows expected structure
 */
export declare function isValidFeedbackOutput(output: string): boolean;
