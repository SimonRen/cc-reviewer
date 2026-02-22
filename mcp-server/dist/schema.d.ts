/**
 * Structured Output Schemas for AI Review
 *
 * Uses Zod for strict validation of reviewer output.
 * This replaces the fragile regex-based markdown validation.
 */
import { z } from 'zod';
export declare const SeverityLevel: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
export type SeverityLevel = z.infer<typeof SeverityLevel>;
export declare const ConfidenceLevel: z.ZodEnum<["verified", "high", "medium", "low", "uncertain"]>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;
export declare const ConfidenceScore: z.ZodNumber;
export type ConfidenceScore = z.infer<typeof ConfidenceScore>;
export declare const CodeLocation: z.ZodObject<{
    file: z.ZodString;
    line_start: z.ZodOptional<z.ZodNumber>;
    line_end: z.ZodOptional<z.ZodNumber>;
    column_start: z.ZodOptional<z.ZodNumber>;
    column_end: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    file: string;
    line_start?: number | undefined;
    line_end?: number | undefined;
    column_start?: number | undefined;
    column_end?: number | undefined;
}, {
    file: string;
    line_start?: number | undefined;
    line_end?: number | undefined;
    column_start?: number | undefined;
    column_end?: number | undefined;
}>;
export type CodeLocation = z.infer<typeof CodeLocation>;
export declare const ReviewFinding: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["security", "performance", "architecture", "correctness", "maintainability", "scalability", "testing", "documentation", "best-practice", "other"]>;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    confidence: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    location: z.ZodOptional<z.ZodObject<{
        file: z.ZodString;
        line_start: z.ZodOptional<z.ZodNumber>;
        line_end: z.ZodOptional<z.ZodNumber>;
        column_start: z.ZodOptional<z.ZodNumber>;
        column_end: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line_start?: number | undefined;
        line_end?: number | undefined;
        column_start?: number | undefined;
        column_end?: number | undefined;
    }, {
        file: string;
        line_start?: number | undefined;
        line_end?: number | undefined;
        column_start?: number | undefined;
        column_end?: number | undefined;
    }>>;
    evidence: z.ZodOptional<z.ZodString>;
    suggestion: z.ZodOptional<z.ZodString>;
    cwe_id: z.ZodOptional<z.ZodString>;
    owasp_category: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    severity: "info" | "high" | "critical" | "medium" | "low";
    title: string;
    description: string;
    category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
    confidence: number;
    id: string;
    location?: {
        file: string;
        line_start?: number | undefined;
        line_end?: number | undefined;
        column_start?: number | undefined;
        column_end?: number | undefined;
    } | undefined;
    evidence?: string | undefined;
    suggestion?: string | undefined;
    cwe_id?: string | undefined;
    owasp_category?: string | undefined;
    tags?: string[] | undefined;
}, {
    severity: "info" | "high" | "critical" | "medium" | "low";
    title: string;
    description: string;
    category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
    confidence: number;
    id: string;
    location?: {
        file: string;
        line_start?: number | undefined;
        line_end?: number | undefined;
        column_start?: number | undefined;
        column_end?: number | undefined;
    } | undefined;
    evidence?: string | undefined;
    suggestion?: string | undefined;
    cwe_id?: string | undefined;
    owasp_category?: string | undefined;
    tags?: string[] | undefined;
}>;
export type ReviewFinding = z.infer<typeof ReviewFinding>;
export declare const Agreement: z.ZodObject<{
    original_claim: z.ZodString;
    assessment: z.ZodEnum<["correct", "mostly_correct", "partially_correct"]>;
    confidence: z.ZodNumber;
    supporting_evidence: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    original_claim: string;
    assessment: "correct" | "mostly_correct" | "partially_correct";
    supporting_evidence?: string | undefined;
    notes?: string | undefined;
}, {
    confidence: number;
    original_claim: string;
    assessment: "correct" | "mostly_correct" | "partially_correct";
    supporting_evidence?: string | undefined;
    notes?: string | undefined;
}>;
export type Agreement = z.infer<typeof Agreement>;
export declare const Disagreement: z.ZodObject<{
    original_claim: z.ZodString;
    issue: z.ZodEnum<["incorrect", "misleading", "incomplete", "outdated", "hallucinated"]>;
    confidence: z.ZodNumber;
    reason: z.ZodString;
    correction: z.ZodOptional<z.ZodString>;
    evidence: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    reason: string;
    original_claim: string;
    issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
    evidence?: string | undefined;
    correction?: string | undefined;
}, {
    confidence: number;
    reason: string;
    original_claim: string;
    issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
    evidence?: string | undefined;
    correction?: string | undefined;
}>;
export type Disagreement = z.infer<typeof Disagreement>;
export declare const Alternative: z.ZodObject<{
    topic: z.ZodString;
    current_approach: z.ZodString;
    alternative: z.ZodString;
    tradeoffs: z.ZodObject<{
        pros: z.ZodArray<z.ZodString, "many">;
        cons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        pros: string[];
        cons: string[];
    }, {
        pros: string[];
        cons: string[];
    }>;
    recommendation: z.ZodEnum<["strongly_prefer", "consider", "situational", "informational"]>;
}, "strip", z.ZodTypeAny, {
    topic: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    current_approach: string;
    alternative: string;
    recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
}, {
    topic: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    current_approach: string;
    alternative: string;
    recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
}>;
export type Alternative = z.infer<typeof Alternative>;
export declare const RiskAssessment: z.ZodObject<{
    overall_level: z.ZodEnum<["critical", "high", "medium", "low", "minimal"]>;
    score: z.ZodNumber;
    summary: z.ZodString;
    top_concerns: z.ZodArray<z.ZodString, "many">;
    mitigations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    overall_level: "high" | "critical" | "medium" | "low" | "minimal";
    score: number;
    top_concerns: string[];
    mitigations?: string[] | undefined;
}, {
    summary: string;
    overall_level: "high" | "critical" | "medium" | "low" | "minimal";
    score: number;
    top_concerns: string[];
    mitigations?: string[] | undefined;
}>;
export type RiskAssessment = z.infer<typeof RiskAssessment>;
export declare const UncertaintyResponse: z.ZodObject<{
    uncertainty_index: z.ZodNumber;
    verified: z.ZodBoolean;
    finding: z.ZodString;
    recommendation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    verified: boolean;
    uncertainty_index: number;
    finding: string;
    recommendation?: string | undefined;
}, {
    verified: boolean;
    uncertainty_index: number;
    finding: string;
    recommendation?: string | undefined;
}>;
export type UncertaintyResponse = z.infer<typeof UncertaintyResponse>;
export declare const QuestionAnswer: z.ZodObject<{
    question_index: z.ZodNumber;
    answer: z.ZodString;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    question_index: number;
    answer: string;
    confidence?: number | undefined;
}, {
    question_index: number;
    answer: string;
    confidence?: number | undefined;
}>;
export type QuestionAnswer = z.infer<typeof QuestionAnswer>;
export declare const ReviewOutput: z.ZodObject<{
    reviewer: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        category: z.ZodEnum<["security", "performance", "architecture", "correctness", "maintainability", "scalability", "testing", "documentation", "best-practice", "other"]>;
        severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        confidence: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        location: z.ZodOptional<z.ZodObject<{
            file: z.ZodString;
            line_start: z.ZodOptional<z.ZodNumber>;
            line_end: z.ZodOptional<z.ZodNumber>;
            column_start: z.ZodOptional<z.ZodNumber>;
            column_end: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        }, {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodString>;
        suggestion: z.ZodOptional<z.ZodString>;
        cwe_id: z.ZodOptional<z.ZodString>;
        owasp_category: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        severity: "info" | "high" | "critical" | "medium" | "low";
        title: string;
        description: string;
        category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
        confidence: number;
        id: string;
        location?: {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        } | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        cwe_id?: string | undefined;
        owasp_category?: string | undefined;
        tags?: string[] | undefined;
    }, {
        severity: "info" | "high" | "critical" | "medium" | "low";
        title: string;
        description: string;
        category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
        confidence: number;
        id: string;
        location?: {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        } | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        cwe_id?: string | undefined;
        owasp_category?: string | undefined;
        tags?: string[] | undefined;
    }>, "many">;
    agreements: z.ZodArray<z.ZodObject<{
        original_claim: z.ZodString;
        assessment: z.ZodEnum<["correct", "mostly_correct", "partially_correct"]>;
        confidence: z.ZodNumber;
        supporting_evidence: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        original_claim: string;
        assessment: "correct" | "mostly_correct" | "partially_correct";
        supporting_evidence?: string | undefined;
        notes?: string | undefined;
    }, {
        confidence: number;
        original_claim: string;
        assessment: "correct" | "mostly_correct" | "partially_correct";
        supporting_evidence?: string | undefined;
        notes?: string | undefined;
    }>, "many">;
    disagreements: z.ZodArray<z.ZodObject<{
        original_claim: z.ZodString;
        issue: z.ZodEnum<["incorrect", "misleading", "incomplete", "outdated", "hallucinated"]>;
        confidence: z.ZodNumber;
        reason: z.ZodString;
        correction: z.ZodOptional<z.ZodString>;
        evidence: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        reason: string;
        original_claim: string;
        issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
        evidence?: string | undefined;
        correction?: string | undefined;
    }, {
        confidence: number;
        reason: string;
        original_claim: string;
        issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
        evidence?: string | undefined;
        correction?: string | undefined;
    }>, "many">;
    alternatives: z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        current_approach: z.ZodString;
        alternative: z.ZodString;
        tradeoffs: z.ZodObject<{
            pros: z.ZodArray<z.ZodString, "many">;
            cons: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            pros: string[];
            cons: string[];
        }, {
            pros: string[];
            cons: string[];
        }>;
        recommendation: z.ZodEnum<["strongly_prefer", "consider", "situational", "informational"]>;
    }, "strip", z.ZodTypeAny, {
        topic: string;
        tradeoffs: {
            pros: string[];
            cons: string[];
        };
        current_approach: string;
        alternative: string;
        recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
    }, {
        topic: string;
        tradeoffs: {
            pros: string[];
            cons: string[];
        };
        current_approach: string;
        alternative: string;
        recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
    }>, "many">;
    uncertainty_responses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uncertainty_index: z.ZodNumber;
        verified: z.ZodBoolean;
        finding: z.ZodString;
        recommendation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        verified: boolean;
        uncertainty_index: number;
        finding: string;
        recommendation?: string | undefined;
    }, {
        verified: boolean;
        uncertainty_index: number;
        finding: string;
        recommendation?: string | undefined;
    }>, "many">>;
    question_answers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        question_index: z.ZodNumber;
        answer: z.ZodString;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        question_index: number;
        answer: string;
        confidence?: number | undefined;
    }, {
        question_index: number;
        answer: string;
        confidence?: number | undefined;
    }>, "many">>;
    risk_assessment: z.ZodObject<{
        overall_level: z.ZodEnum<["critical", "high", "medium", "low", "minimal"]>;
        score: z.ZodNumber;
        summary: z.ZodString;
        top_concerns: z.ZodArray<z.ZodString, "many">;
        mitigations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        overall_level: "high" | "critical" | "medium" | "low" | "minimal";
        score: number;
        top_concerns: string[];
        mitigations?: string[] | undefined;
    }, {
        summary: string;
        overall_level: "high" | "critical" | "medium" | "low" | "minimal";
        score: number;
        top_concerns: string[];
        mitigations?: string[] | undefined;
    }>;
    files_examined: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    execution_notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    findings: {
        severity: "info" | "high" | "critical" | "medium" | "low";
        title: string;
        description: string;
        category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
        confidence: number;
        id: string;
        location?: {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        } | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        cwe_id?: string | undefined;
        owasp_category?: string | undefined;
        tags?: string[] | undefined;
    }[];
    alternatives: {
        topic: string;
        tradeoffs: {
            pros: string[];
            cons: string[];
        };
        current_approach: string;
        alternative: string;
        recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
    }[];
    reviewer: string;
    agreements: {
        confidence: number;
        original_claim: string;
        assessment: "correct" | "mostly_correct" | "partially_correct";
        supporting_evidence?: string | undefined;
        notes?: string | undefined;
    }[];
    disagreements: {
        confidence: number;
        reason: string;
        original_claim: string;
        issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
        evidence?: string | undefined;
        correction?: string | undefined;
    }[];
    risk_assessment: {
        summary: string;
        overall_level: "high" | "critical" | "medium" | "low" | "minimal";
        score: number;
        top_concerns: string[];
        mitigations?: string[] | undefined;
    };
    timestamp?: string | undefined;
    uncertainty_responses?: {
        verified: boolean;
        uncertainty_index: number;
        finding: string;
        recommendation?: string | undefined;
    }[] | undefined;
    question_answers?: {
        question_index: number;
        answer: string;
        confidence?: number | undefined;
    }[] | undefined;
    files_examined?: string[] | undefined;
    execution_notes?: string | undefined;
}, {
    findings: {
        severity: "info" | "high" | "critical" | "medium" | "low";
        title: string;
        description: string;
        category: "other" | "performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation" | "best-practice";
        confidence: number;
        id: string;
        location?: {
            file: string;
            line_start?: number | undefined;
            line_end?: number | undefined;
            column_start?: number | undefined;
            column_end?: number | undefined;
        } | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        cwe_id?: string | undefined;
        owasp_category?: string | undefined;
        tags?: string[] | undefined;
    }[];
    alternatives: {
        topic: string;
        tradeoffs: {
            pros: string[];
            cons: string[];
        };
        current_approach: string;
        alternative: string;
        recommendation: "strongly_prefer" | "consider" | "situational" | "informational";
    }[];
    reviewer: string;
    agreements: {
        confidence: number;
        original_claim: string;
        assessment: "correct" | "mostly_correct" | "partially_correct";
        supporting_evidence?: string | undefined;
        notes?: string | undefined;
    }[];
    disagreements: {
        confidence: number;
        reason: string;
        original_claim: string;
        issue: "incorrect" | "misleading" | "incomplete" | "outdated" | "hallucinated";
        evidence?: string | undefined;
        correction?: string | undefined;
    }[];
    risk_assessment: {
        summary: string;
        overall_level: "high" | "critical" | "medium" | "low" | "minimal";
        score: number;
        top_concerns: string[];
        mitigations?: string[] | undefined;
    };
    timestamp?: string | undefined;
    uncertainty_responses?: {
        verified: boolean;
        uncertainty_index: number;
        finding: string;
        recommendation?: string | undefined;
    }[] | undefined;
    question_answers?: {
        question_index: number;
        answer: string;
        confidence?: number | undefined;
    }[] | undefined;
    files_examined?: string[] | undefined;
    execution_notes?: string | undefined;
}>;
export type ReviewOutput = z.infer<typeof ReviewOutput>;
export declare const PeerScore: z.ZodObject<{
    finding_id: z.ZodString;
    validity: z.ZodEnum<["valid", "questionable", "invalid", "cannot_assess"]>;
    confidence: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    finding_id: string;
    validity: "valid" | "questionable" | "invalid" | "cannot_assess";
    notes?: string | undefined;
}, {
    confidence: number;
    finding_id: string;
    validity: "valid" | "questionable" | "invalid" | "cannot_assess";
    notes?: string | undefined;
}>;
export type PeerScore = z.infer<typeof PeerScore>;
export declare const PeerReview: z.ZodObject<{
    reviewer: z.ZodString;
    reviewed_model: z.ZodString;
    scores: z.ZodArray<z.ZodObject<{
        finding_id: z.ZodString;
        validity: z.ZodEnum<["valid", "questionable", "invalid", "cannot_assess"]>;
        confidence: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        finding_id: string;
        validity: "valid" | "questionable" | "invalid" | "cannot_assess";
        notes?: string | undefined;
    }, {
        confidence: number;
        finding_id: string;
        validity: "valid" | "questionable" | "invalid" | "cannot_assess";
        notes?: string | undefined;
    }>, "many">;
    overall_quality: z.ZodNumber;
    summary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reviewer: string;
    reviewed_model: string;
    scores: {
        confidence: number;
        finding_id: string;
        validity: "valid" | "questionable" | "invalid" | "cannot_assess";
        notes?: string | undefined;
    }[];
    overall_quality: number;
    summary?: string | undefined;
}, {
    reviewer: string;
    reviewed_model: string;
    scores: {
        confidence: number;
        finding_id: string;
        validity: "valid" | "questionable" | "invalid" | "cannot_assess";
        notes?: string | undefined;
    }[];
    overall_quality: number;
    summary?: string | undefined;
}>;
export type PeerReview = z.infer<typeof PeerReview>;
/**
 * Generate a simplified JSON schema for embedding in prompts.
 * External CLIs don't support Zod directly, so we provide a JSON schema.
 */
export declare function getReviewOutputJsonSchema(): object;
/**
 * Attempt to parse and validate reviewer output.
 * Returns the validated output or null if invalid.
 */
export declare function parseReviewOutput(rawOutput: string): ReviewOutput | null;
/**
 * Convert legacy markdown format to structured output (best effort).
 * This provides backwards compatibility during transition.
 */
export declare function parseLegacyMarkdownOutput(markdown: string, reviewer: string): ReviewOutput | null;
