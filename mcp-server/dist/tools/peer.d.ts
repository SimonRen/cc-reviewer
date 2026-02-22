/**
 * MCP Peer Tool Implementations
 *
 * General-purpose coworker tools:
 * 1. ask_codex - Ask Codex for help
 * 2. ask_gemini - Ask Gemini for help
 * 3. ask_multi - Ask both in parallel
 */
import { PeerResult } from '../adapters/index.js';
export type PeerInput = {
    workingDir: string;
    prompt: string;
    taskType?: string;
    relevantFiles?: string[];
    context?: string;
    focusAreas?: string[];
    customPrompt?: string;
    reasoningEffort?: 'high' | 'xhigh';
};
export declare function formatPeerResponse(result: PeerResult, modelName: string): string;
export declare function handleAskCodex(input: PeerInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleAskGemini(input: PeerInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare function handleAskMulti(input: PeerInput): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export declare const PEER_TOOL_DEFINITIONS: {
    ask_codex: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                prompt: {
                    type: string;
                    description: string;
                };
                taskType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                relevantFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                context: {
                    type: string;
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
    ask_gemini: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                prompt: {
                    type: string;
                    description: string;
                };
                taskType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                relevantFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                context: {
                    type: string;
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
    ask_multi: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                prompt: {
                    type: string;
                    description: string;
                };
                taskType: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                relevantFiles: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                context: {
                    type: string;
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
