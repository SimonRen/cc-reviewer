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
// =============================================================================
// DECODER
// =============================================================================
export class CodexEventDecoder {
    /**
     * Optional callback invoked for every successfully parsed event.
     * @param eventType - The `type` field of the event (e.g. "item.completed").
     * @param detail    - A human-readable detail string for logging (may be undefined).
     */
    onProgress;
    // The text from the most recently seen item.completed with item.type === "agent_message"
    _finalResponse = null;
    // Token usage from the most recently seen turn.completed
    _usage = null;
    // =============================================================================
    // PUBLIC API
    // =============================================================================
    /**
     * Parse a single JSONL line. Silently skips malformed or empty input.
     */
    processLine(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            return;
        let event;
        try {
            const parsed = JSON.parse(trimmed);
            // Must be a plain object, not an array or primitive
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
                return;
            event = parsed;
        }
        catch {
            // Malformed JSON — silently skip
            return;
        }
        this._handleEvent(event);
    }
    /**
     * Returns the text from the LAST `item.completed` event whose item type is
     * `"agent_message"`, or `null` if no such event has been seen.
     */
    getFinalResponse() {
        return this._finalResponse;
    }
    /**
     * Returns the usage stats from the most recent `turn.completed` event, or
     * `null` if no such event has been seen.
     */
    getUsage() {
        return this._usage;
    }
    // =============================================================================
    // PRIVATE HELPERS
    // =============================================================================
    _handleEvent(event) {
        // Track the last agent_message text
        if (event.type === 'item.completed' &&
            event.item?.type === 'agent_message' &&
            typeof event.item.text === 'string') {
            this._finalResponse = event.item.text;
        }
        // Track usage from turn completion
        if (event.type === 'turn.completed' && event.usage != null) {
            this._usage = event.usage;
        }
        // Notify caller
        this.onProgress?.(event.type, describeEvent(event));
    }
}
// =============================================================================
// INTERNAL HELPERS
// =============================================================================
/**
 * Returns a short human-readable description of an event for progress logging.
 * Returns `undefined` for event types that carry no meaningful extra detail.
 */
function describeEvent(event) {
    if (event.type === 'thread.started' && event.thread_id) {
        return `thread: ${event.thread_id}`;
    }
    if ((event.type === 'item.started' || event.type === 'item.completed') &&
        event.item != null) {
        const { type: itemType, command, status } = event.item;
        if (itemType === 'command_execution') {
            const parts = [];
            if (command)
                parts.push(`command: ${command}`);
            if (status)
                parts.push(`status: ${status}`);
            return parts.length > 0 ? parts.join(', ') : undefined;
        }
        if (itemType === 'agent_message') {
            return 'agent message';
        }
        return itemType;
    }
    if (event.type === 'turn.completed' && event.usage) {
        const { input_tokens, output_tokens } = event.usage;
        return `tokens: ${input_tokens} in / ${output_tokens} out`;
    }
    return undefined;
}
