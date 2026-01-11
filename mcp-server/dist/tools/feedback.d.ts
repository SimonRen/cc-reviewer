/**
 * MCP Tool Implementations for AI Reviewer
 */
import { z } from 'zod';
export declare const FeedbackInputSchema: z.ZodObject<{
    workingDir: z.ZodString;
    ccOutput: z.ZodString;
    outputType: z.ZodEnum<["plan", "findings", "analysis", "proposal"]>;
    analyzedFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    focusAreas: z.ZodOptional<z.ZodArray<z.ZodEnum<["security", "performance", "architecture", "correctness", "maintainability", "scalability", "testing", "documentation"]>, "many">>;
    customPrompt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workingDir: string;
    ccOutput: string;
    outputType: "plan" | "findings" | "analysis" | "proposal";
    analyzedFiles?: string[] | undefined;
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    customPrompt?: string | undefined;
}, {
    workingDir: string;
    ccOutput: string;
    outputType: "plan" | "findings" | "analysis" | "proposal";
    analyzedFiles?: string[] | undefined;
    focusAreas?: ("security" | "performance" | "architecture" | "correctness" | "maintainability" | "scalability" | "testing" | "documentation")[] | undefined;
    customPrompt?: string | undefined;
}>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
/**
 * Codex feedback tool handler
 */
export declare function handleCodexFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
/**
 * Gemini feedback tool handler
 */
export declare function handleGeminiFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
/**
 * Multi-model feedback tool handler (parallel execution)
 */
export declare function handleMultiFeedback(input: FeedbackInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
/**
 * Tool definitions for MCP registration
 */
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
};
