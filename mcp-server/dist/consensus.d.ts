/**
 * Consensus Calculation for Multi-Model Reviews
 *
 * Implements the "Council Review" pattern:
 * 1. Collect reviews from multiple models
 * 2. (Optional) Run peer review for cross-validation
 * 3. Calculate consensus using confidence-weighted voting
 * 4. Synthesize final output with agreement indicators
 */
import { ReviewOutput, ReviewFinding, ConsensusFinding, RiskAssessment, CouncilReviewOutput } from './schema.js';
export interface ConsensusConfig {
    /** Minimum consensus score to include a finding (0-1) */
    minConsensusThreshold: number;
    /** Weight multiplier when multiple models agree */
    agreementBoost: number;
    /** Weight reduction for findings with peer disputes */
    disputePenalty: number;
    /** Whether to include findings from only one model */
    includeSingleSourceFindings: boolean;
    /** Minimum confidence for single-source findings */
    singleSourceMinConfidence: number;
}
export declare const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig;
/**
 * Calculate similarity between two findings.
 * Used to detect when multiple models found the same issue.
 */
export declare function findingSimilarity(a: ReviewFinding, b: ReviewFinding): number;
/**
 * Group similar findings across models
 */
export declare function groupSimilarFindings(reviews: Map<string, ReviewOutput>, similarityThreshold?: number): Map<string, {
    finding: ReviewFinding;
    sources: string[];
}[]>;
/**
 * Calculate consensus score for a finding cluster
 */
export declare function calculateConsensusScore(cluster: {
    finding: ReviewFinding;
    sources: string[];
}, totalModels: number, config?: ConsensusConfig): number;
/**
 * Build consensus findings from grouped findings
 */
export declare function buildConsensusFindings(reviews: Map<string, ReviewOutput>, config?: ConsensusConfig): ConsensusFinding[];
/**
 * Find unanimous agreements (all models agreed on something)
 */
export declare function findUnanimousAgreements(reviews: Map<string, ReviewOutput>): string[];
export interface ModelConflict {
    topic: string;
    positions: Record<string, string>;
    recommendation?: string;
}
/**
 * Detect conflicts between models (one says X, another says not-X)
 */
export declare function detectConflicts(reviews: Map<string, ReviewOutput>): ModelConflict[];
/**
 * Find findings that only one model discovered
 */
export declare function findUniqueInsights(reviews: Map<string, ReviewOutput>): Record<string, string[]>;
/**
 * Combine risk assessments from multiple models
 */
export declare function combineRiskAssessments(reviews: Map<string, ReviewOutput>): RiskAssessment;
/**
 * Synthesize multiple reviews into a council review output
 */
export declare function synthesizeCouncilReview(reviews: Map<string, ReviewOutput>, config?: ConsensusConfig): CouncilReviewOutput;
/**
 * Format consensus findings for markdown display
 */
export declare function formatConsensusFindings(findings: ConsensusFinding[]): string;
/**
 * Format conflicts for markdown display
 */
export declare function formatConflicts(conflicts: ModelConflict[]): string;
/**
 * Format full council review for markdown display
 */
export declare function formatCouncilReview(review: CouncilReviewOutput): string;
