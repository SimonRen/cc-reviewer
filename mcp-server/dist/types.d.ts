/**
 * Types for AI Reviewer MCP Server
 */
export type OutputType = 'plan' | 'findings' | 'analysis' | 'proposal';
export type FocusArea = 'security' | 'performance' | 'architecture' | 'correctness' | 'maintainability' | 'scalability' | 'testing' | 'documentation';
export type CliType = 'codex' | 'gemini';
export type ReasoningEffort = 'high' | 'xhigh';
export type TaskType = 'plan' | 'debug' | 'explain' | 'question' | 'fix' | 'explore' | 'general';
export interface FeedbackRequest {
    workingDir: string;
    ccOutput: string;
    outputType: OutputType;
    analyzedFiles?: string[];
    focusAreas?: FocusArea[];
    customPrompt?: string;
    reasoningEffort?: ReasoningEffort;
}
export interface FeedbackSuccess {
    success: true;
    feedback: string;
    model: CliType;
}
export interface FeedbackFailure {
    success: false;
    error: FeedbackError;
    suggestion?: string;
    model: CliType;
}
export type FeedbackResult = FeedbackSuccess | FeedbackFailure;
export type FeedbackError = {
    type: 'cli_not_found';
    cli: CliType;
    installCmd: string;
} | {
    type: 'timeout';
    cli: CliType;
    durationMs: number;
} | {
    type: 'rate_limit';
    cli: CliType;
    retryAfterMs?: number;
} | {
    type: 'auth_error';
    cli: CliType;
    message: string;
} | {
    type: 'invalid_response';
    cli: CliType;
    rawOutput: string;
} | {
    type: 'cli_error';
    cli: CliType;
    exitCode: number;
    stderr: string;
};
export interface MultiFeedbackResult {
    successful: Array<{
        model: CliType;
        feedback: string;
    }>;
    failed: Array<{
        model: CliType;
        error: FeedbackError;
    }>;
    partialSuccess: boolean;
    allFailed: boolean;
}
export interface CliStatus {
    codex: boolean;
    gemini: boolean;
}
export interface StructuredFeedback {
    agreements: Array<{
        finding: string;
        reason: string;
    }>;
    disagreements: Array<{
        finding: string;
        reason: string;
        correction: string;
    }>;
    additions: Array<{
        finding: string;
        location: string;
        impact: string;
    }>;
    alternatives: Array<{
        topic: string;
        alternative: string;
        tradeoffs: string;
    }>;
    riskAssessment: {
        level: 'Low' | 'Medium' | 'High';
        reason: string;
    };
}
export interface ReviewerPersona {
    name: string;
    focus: string;
    style: string;
}
export declare const REVIEWER_PERSONAS: Record<CliType, ReviewerPersona>;
export declare const FOCUS_AREA_DESCRIPTIONS: Record<FocusArea, string>;
