/**
 * Review Response Processing Pipeline
 *
 * Processes reviewer output through multiple stages:
 * 1. Parse - Extract structured data
 * 2. Verify - Check file/line references exist
 * 3. Cross-check - Compare with CC's knowledge
 * 4. Prioritize - Rank by impact and confidence
 * 5. Plan - Generate actionable next steps
 */
import { ReviewOutput, ReviewFinding } from './schema.js';
import { ReviewContext, VerificationData } from './context.js';
export interface PipelineStage<TInput, TOutput> {
    name: string;
    process(input: TInput, context: PipelineContext): Promise<TOutput>;
}
export interface PipelineContext {
    workingDir: string;
    reviewContext: ReviewContext;
    verificationData?: VerificationData;
}
export interface VerifiedFinding extends ReviewFinding {
    verification: {
        fileExists: boolean;
        lineValid: boolean;
        codeSnippetMatches?: boolean;
        verificationNotes?: string;
    };
    crossCheck: {
        alreadyAddressedByCC: boolean;
        conflictsWithCC: boolean;
        ccMentioned: boolean;
    };
    adjustedConfidence: number;
}
export interface ActionItem {
    finding: VerifiedFinding;
    action: 'fix_now' | 'investigate' | 'defer' | 'reject';
    priority: number;
    suggestedFix?: string;
    reason: string;
}
export interface ProcessedReview {
    original: ReviewOutput;
    verified: VerifiedFinding[];
    rejected: {
        finding: ReviewFinding;
        reason: string;
    }[];
    actionPlan: ActionItem[];
    summary: {
        totalFindings: number;
        verifiedCount: number;
        rejectedCount: number;
        actionableCount: number;
        topPriority: ActionItem[];
    };
}
/**
 * Simple file cache to avoid re-reading files for each finding
 */
export declare class FileCache {
    private workingDir;
    private contentCache;
    private lineCountCache;
    private linesCache;
    constructor(workingDir: string);
    /**
     * Check if file exists (cached)
     */
    exists(relativePath: string): boolean;
    /**
     * Get file content (cached, lazy-loaded)
     */
    getContent(relativePath: string): string | null;
    /**
     * Get lines array (cached)
     */
    getLines(relativePath: string): string[] | null;
    /**
     * Get line count (cached)
     */
    getLineCount(relativePath: string): number | null;
    /**
     * Get stats about cache usage
     */
    getStats(): {
        filesChecked: number;
        filesLoaded: number;
    };
}
/**
 * Build verification data by scanning the filesystem
 */
export declare function buildVerificationData(workingDir: string): Promise<VerificationData>;
/**
 * Verify a single finding's references
 * @param finding The finding to verify
 * @param workingDir Working directory for path resolution
 * @param cache Optional file cache for performance (recommended for multiple findings)
 */
export declare function verifyFinding(finding: ReviewFinding, workingDir: string, cache?: FileCache): Promise<VerifiedFinding>;
/**
 * Cross-check findings against CC's analysis
 */
export declare function crossCheckWithCC(finding: VerifiedFinding, ccAnalysis: ReviewContext['analysis']): VerifiedFinding;
/**
 * Calculate priority score for a finding
 */
export declare function calculatePriority(finding: VerifiedFinding): number;
/**
 * Determine action for a finding
 */
export declare function determineAction(finding: VerifiedFinding, priority: number): {
    action: ActionItem['action'];
    reason: string;
};
/**
 * Process a review output through the full verification pipeline
 */
export declare function processReviewOutput(output: ReviewOutput, context: ReviewContext): Promise<ProcessedReview>;
/**
 * Format processed review for display
 */
export declare function formatProcessedReview(processed: ProcessedReview): string;
export interface FollowUpQuestion {
    topic: string;
    question: string;
    relatedFindings: string[];
    context: string;
}
/**
 * Generate follow-up questions for uncertain findings
 */
export declare function generateFollowUpQuestions(processed: ProcessedReview): FollowUpQuestion[];
