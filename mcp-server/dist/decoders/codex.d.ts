/**
 * CodexEventDecoder
 *
 * Parses JSONL streaming events emitted by `codex exec --json` on stdout.
 * Extracts the final agent_message text and usage statistics.
 *
 * Event stream format:
 *   {"type":"thread.started","thread_id":"..."}
 *   {"type":"turn.started"}
 *   {"type":"item.started","item":{...}}
 *   {"type":"item.completed","item":{...}}
 *   {"type":"turn.completed","usage":{...}}
 */
export interface CodexEvent {
    type: string;
    thread_id?: string;
    item?: {
        id: string;
        type: string;
        text?: string;
        command?: string;
        status?: string;
        exit_code?: number;
        message?: string;
    };
    usage?: {
        input_tokens: number;
        cached_input_tokens?: number;
        output_tokens: number;
    };
    error?: {
        message: string;
    };
    message?: string;
}
export declare class CodexEventDecoder {
    /**
     * Optional callback invoked for every successfully parsed event.
     * @param eventType - The `type` field of the event (e.g. "item.completed").
     * @param detail    - A human-readable detail string for logging (may be undefined).
     */
    onProgress?: (eventType: string, detail?: string) => void;
    private _finalResponse;
    private _usage;
    private _error;
    private _eventCount;
    /**
     * Parse a single JSONL line. Silently skips malformed or empty input.
     */
    processLine(line: string): void;
    /**
     * Returns the text from the LAST `item.completed` event whose item type is
     * `"agent_message"`, or `null` if no such event has been seen.
     */
    getFinalResponse(): string | null;
    /**
     * Returns the usage stats from the most recent `turn.completed` event, or
     * `null` if no such event has been seen.
     */
    getUsage(): CodexEvent['usage'] | null;
    /**
     * Returns the error message from `error` or `turn.failed` events, or `null`.
     */
    getError(): string | null;
    /**
     * Returns true if events were received but no agent_message was produced.
     * Combined with a fast exit, this indicates rate limiting or instant rejection.
     */
    hasNoOutput(): boolean;
    private _handleEvent;
}
