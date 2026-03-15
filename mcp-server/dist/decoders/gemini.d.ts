/**
 * GeminiEventDecoder — Parses Gemini CLI stream-json JSONL events.
 *
 * Concatenates assistant message deltas into a final response,
 * tracks stats from the result event, and emits progress callbacks.
 */
export interface GeminiEvent {
    type: string;
    session_id?: string;
    model?: string;
    role?: string;
    content?: string;
    delta?: boolean;
    tool_name?: string;
    tool_id?: string;
    status?: string;
    stats?: {
        total_tokens: number;
        input_tokens: number;
        output_tokens: number;
        duration_ms: number;
        [key: string]: unknown;
    };
}
export declare class GeminiEventDecoder {
    private assistantChunks;
    private _stats;
    onProgress?: (eventType: string, detail?: string) => void;
    processLine(line: string): void;
    getFinalResponse(): string;
    getStats(): GeminiEvent['stats'] | null;
    private describeEvent;
}
