/**
 * ClaudeEventDecoder — Parses Claude CLI stream-json JSONL events.
 *
 * Event stream format (with --output-format stream-json --verbose):
 *   {"type":"system","subtype":"init",...}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...},...}
 *   {"type":"result","subtype":"success","result":"...","duration_ms":...,"usage":{...}}
 */
export interface ClaudeEvent {
    type: string;
    subtype?: string;
    session_id?: string;
    model?: string;
    result?: string;
    is_error?: boolean;
    duration_ms?: number;
    message?: {
        content?: Array<{
            type: string;
            text?: string;
        }>;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
        };
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
    };
    tool_use_id?: string;
    tool_name?: string;
}
export declare class ClaudeEventDecoder {
    onProgress?: (eventType: string, detail?: string) => void;
    private _finalResponse;
    private _usage;
    private _error;
    private _eventCount;
    private _durationMs;
    processLine(line: string): void;
    getFinalResponse(): string | null;
    getUsage(): ClaudeEvent['usage'] | null;
    getError(): string | null;
    getDurationMs(): number | null;
    hasNoOutput(): boolean;
    private _handleEvent;
    private _describeEvent;
}
