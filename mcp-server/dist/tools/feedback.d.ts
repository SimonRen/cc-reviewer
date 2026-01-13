/**
 * MCP Tool Implementations for Council Review
 *
 * Provides three levels of review:
 * 1. Single model review (codex_feedback, gemini_feedback)
 * 2. Multi-model parallel review (multi_feedback)
 * 3. Council review with consensus (council_feedback) - NEW
 */
import { z } from 'zod';
export declare const FeedbackInputSchema: z.ZodObject<{
    workingDir: z.ZodString;
    ccOutput: z.ZodString;
    outputType: z.ZodEnum<["plan", "findings", "analysis", "proposal"]>;
    analyzedFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    focusAreas: z.ZodOptional<z.ZodArray<z.ZodEnum<["security", "performance", "architecture", "correctness", "maintainability", "scalability", "testing", "documentation"]>, "many">>;
    customPrompt: z.ZodOptional<z.ZodString>;
    reasoningEffort: z.ZodOptional<z.ZodEnum<["high", "xhigh"]>>;
}, "strip", z.ZodTypeAny, {
    workingDir: string;
    ccOutput: string;
    outputType: "findings" | "analysis" | "plan" | "proposal";
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
}, {
    workingDir: string;
    ccOutput: string;
    outputType: "findings" | "analysis" | "plan" | "proposal";
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
}>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
export declare const CouncilInputSchema: z.ZodObject<{
    workingDir: z.ZodString;
    ccOutput: z.ZodString;
    outputType: z.ZodEnum<["plan", "findings", "analysis", "proposal"]>;
    analyzedFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    focusAreas: z.ZodOptional<z.ZodArray<z.ZodEnum<["security", "performance", "architecture", "correctness", "maintainability", "scalability", "testing", "documentation"]>, "many">>;
    customPrompt: z.ZodOptional<z.ZodString>;
    reasoningEffort: z.ZodOptional<z.ZodEnum<["high", "xhigh"]>>;
} & {
    minConsensusThreshold: z.ZodOptional<z.ZodNumber>;
    includeSingleSource: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    workingDir: string;
    ccOutput: string;
    outputType: "findings" | "analysis" | "plan" | "proposal";
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
    minConsensusThreshold?: number | undefined;
    includeSingleSource?: boolean | undefined;
}, {
    workingDir: string;
    ccOutput: string;
    outputType: "findings" | "analysis" | "plan" | "proposal";
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
    minConsensusThreshold?: number | undefined;
    includeSingleSource?: boolean | undefined;
}>;
export type CouncilInput = z.infer<typeof CouncilInputSchema>;
export declare function handleCodexFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleGeminiFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleMultiFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleCouncilFeedback(input: CouncilInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare const TOOL_DEFINITIONS: {
    codex_feedback: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                ccOutput: {
                    type: string;
                    description: string;
                };
                outputType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                analyzedFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                focusAreas: {
                    type: string;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                };
                customPrompt: {
                    type: string;
                    description: string;
                };
                reasoningEffort: {
                    type: string;
                    enum: string[];
                    description: string;
                };
            };
            required: string[];
        };
    };
    gemini_feedback: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                ccOutput: {
                    type: string;
                    description: string;
                };
                outputType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                analyzedFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                focusAreas: {
                    type: string;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                };
                customPrompt: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    multi_feedback: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                ccOutput: {
                    type: string;
                    description: string;
                };
                outputType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                analyzedFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                focusAreas: {
                    type: string;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                };
                customPrompt: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    council_feedback: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                ccOutput: {
                    type: string;
                    description: string;
                };
                outputType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                analyzedFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                focusAreas: {
                    type: string;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                };
                customPrompt: {
                    type: string;
                    description: string;
                };
                minConsensusThreshold: {
                    type: string;
                    description: string;
                };
                includeSingleSource: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
