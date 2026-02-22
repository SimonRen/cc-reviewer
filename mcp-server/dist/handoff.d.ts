/**
 * Review Handoff Protocol
 *
 * Defines the minimal, targeted information that should flow from CC to reviewers.
 *
 * Philosophy:
 * - Reviewers have filesystem + git access - don't duplicate what they can discover
 * - Pass ONLY what CC uniquely knows: uncertainties, decisions, questions
 * - Let reviewer use their tools (git diff, file reading) for actual code
 */
import { z } from 'zod';
import { FocusArea } from './types.js';
export { FocusArea } from './types.js';
/**
 * Uncertainty that CC has - things the reviewer should verify
 */
export declare const UncertaintySchema: z.ZodObject<{
    topic: z.ZodString;
    question: z.ZodString;
    ccAssumption: z.ZodOptional<z.ZodString>;
    relevantFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    severity: z.ZodOptional<z.ZodEnum<["critical", "important", "minor"]>>;
}, "strip", z.ZodTypeAny, {
    topic: string;
    question: string;
    severity?: "critical" | "important" | "minor" | undefined;
    relevantFiles?: string[] | undefined;
    ccAssumption?: string | undefined;
}, {
    topic: string;
    question: string;
    severity?: "critical" | "important" | "minor" | undefined;
    relevantFiles?: string[] | undefined;
    ccAssumption?: string | undefined;
}>;
export type Uncertainty = z.infer<typeof UncertaintySchema>;
/**
 * Decision CC made - for reviewer to evaluate
 */
export declare const DecisionSchema: z.ZodObject<{
    decision: z.ZodString;
    rationale: z.ZodString;
    alternatives: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tradeoffs: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: string;
    rationale: string;
    alternatives?: string[] | undefined;
    tradeoffs?: string | undefined;
}, {
    decision: string;
    rationale: string;
    alternatives?: string[] | undefined;
    tradeoffs?: string | undefined;
}>;
export type Decision = z.infer<typeof DecisionSchema>;
/**
 * Question CC wants the reviewer to answer
 */
export declare const QuestionSchema: z.ZodObject<{
    question: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    ccGuess: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    question: string;
    context?: string | undefined;
    ccGuess?: string | undefined;
}, {
    question: string;
    context?: string | undefined;
    ccGuess?: string | undefined;
}>;
export type Question = z.infer<typeof QuestionSchema>;
/**
 * The complete handoff from CC to reviewer
 * Intentionally minimal - only what CC uniquely knows
 */
export declare const HandoffSchema: z.ZodObject<{
    workingDir: z.ZodString;
    summary: z.ZodString;
    uncertainties: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        question: z.ZodString;
        ccAssumption: z.ZodOptional<z.ZodString>;
        relevantFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        severity: z.ZodOptional<z.ZodEnum<["critical", "important", "minor"]>>;
    }, "strip", z.ZodTypeAny, {
        topic: string;
        question: string;
        severity?: "critical" | "important" | "minor" | undefined;
        relevantFiles?: string[] | undefined;
        ccAssumption?: string | undefined;
    }, {
        topic: string;
        question: string;
        severity?: "critical" | "important" | "minor" | undefined;
        relevantFiles?: string[] | undefined;
        ccAssumption?: string | undefined;
    }>, "many">>;
    decisions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        decision: z.ZodString;
        rationale: z.ZodString;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        tradeoffs: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
        tradeoffs?: string | undefined;
    }, {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
        tradeoffs?: string | undefined;
    }>, "many">>;
    questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
        ccGuess: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        question: string;
        context?: string | undefined;
        ccGuess?: string | undefined;
    }, {
        question: string;
        context?: string | undefined;
        ccGuess?: string | undefined;
    }>, "many">>;
    priorityFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    focusAreas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    confidence: z.ZodOptional<z.ZodNumber>;
    customInstructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    workingDir: string;
    confidence?: number | undefined;
    uncertainties?: {
        topic: string;
        question: string;
        severity?: "critical" | "important" | "minor" | undefined;
        relevantFiles?: string[] | undefined;
        ccAssumption?: string | undefined;
    }[] | undefined;
    decisions?: {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
        tradeoffs?: string | undefined;
    }[] | undefined;
    questions?: {
        question: string;
        context?: string | undefined;
        ccGuess?: string | undefined;
    }[] | undefined;
    focusAreas?: string[] | undefined;
    customInstructions?: string | undefined;
    priorityFiles?: string[] | undefined;
}, {
    summary: string;
    workingDir: string;
    confidence?: number | undefined;
    uncertainties?: {
        topic: string;
        question: string;
        severity?: "critical" | "important" | "minor" | undefined;
        relevantFiles?: string[] | undefined;
        ccAssumption?: string | undefined;
    }[] | undefined;
    decisions?: {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
        tradeoffs?: string | undefined;
    }[] | undefined;
    questions?: {
        question: string;
        context?: string | undefined;
        ccGuess?: string | undefined;
    }[] | undefined;
    focusAreas?: string[] | undefined;
    customInstructions?: string | undefined;
    priorityFiles?: string[] | undefined;
}>;
export type Handoff = z.infer<typeof HandoffSchema>;
export interface ReviewerRole {
    id: string;
    name: string;
    description: string;
    isGeneric: boolean;
    applicableFocusAreas: FocusArea[];
    systemPrompt: string;
    reviewInstructions: string;
}
/**
 * Strong generic role - when no specific focus is given
 * This is NOT a weak fallback - it's a comprehensive reviewer
 */
export declare const COMPREHENSIVE_REVIEWER: ReviewerRole;
/**
 * Change-focused reviewer - specifically for reviewing diffs
 */
export declare const CHANGE_FOCUSED_REVIEWER: ReviewerRole;
/**
 * Specialized roles - when specific focus is requested
 */
export declare const SECURITY_REVIEWER: ReviewerRole;
export declare const PERFORMANCE_REVIEWER: ReviewerRole;
export declare const ARCHITECTURE_REVIEWER: ReviewerRole;
export declare const CORRECTNESS_REVIEWER: ReviewerRole;
export declare const ROLES: Record<string, ReviewerRole>;
/**
 * Select the best role based on focus areas
 */
export declare function selectRole(focusAreas?: FocusArea[]): ReviewerRole;
export interface PromptOptions {
    handoff: Handoff;
    role?: ReviewerRole;
    outputFormat: 'json' | 'markdown';
}
/**
 * Build the review prompt using minimal, targeted context
 */
export declare function buildHandoffPrompt(options: PromptOptions): string;
/**
 * Build a handoff from legacy simple inputs
 */
export declare function buildSimpleHandoff(workingDir: string, ccOutput: string, analyzedFiles?: string[], focusAreas?: string[], customPrompt?: string): Handoff;
/**
 * Enhance a simple handoff with uncertainties/questions
 * CC should call this to add its specific concerns
 */
export declare function enhanceHandoff(handoff: Handoff, uncertainties?: Uncertainty[], questions?: Question[], decisions?: Decision[]): Handoff;
export interface PeerPromptOptions {
    workingDir: string;
    prompt: string;
    taskType?: string;
    relevantFiles?: string[];
    context?: string;
    focusAreas?: FocusArea[];
    customInstructions?: string;
    outputFormat: 'json';
}
/**
 * Build a prompt for general-purpose peer assistance (not review).
 * The peer acts as a collaborative coworker, not a critic.
 */
export declare function buildPeerPrompt(options: PeerPromptOptions): string;
