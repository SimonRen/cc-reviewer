/**
 * MCP Tool Implementations
 *
 * Provides two levels of review:
 * 1. Single model review (codex_review, gemini_review)
 * 2. Multi-model parallel review (multi_review)
 */
import { z } from 'zod';
export declare const ReviewInputSchema: z.ZodObject<{
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
    focusAreas?: ("performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
}, {
    workingDir: string;
    ccOutput: string;
    outputType: "findings" | "analysis" | "plan" | "proposal";
    focusAreas?: ("performance" | "security" | "testing" | "architecture" | "correctness" | "maintainability" | "scalability" | "documentation")[] | undefined;
    analyzedFiles?: string[] | undefined;
    customPrompt?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
}>;
export type ReviewInput = z.infer<typeof ReviewInputSchema>;
export declare function handleCodexReview(input: ReviewInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleGeminiReview(input: ReviewInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleMultiReview(input: ReviewInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare const TOOL_DEFINITIONS: {
    codex_review: {
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
    gemini_review: {
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
    multi_review: {
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
};
