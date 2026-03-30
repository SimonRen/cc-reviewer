/**
 * ClaudeEventDecoder — Parses Claude CLI stream-json JSONL events.
 *
 * Event stream format (with --output-format stream-json --verbose):
 *   {"type":"system","subtype":"init",...}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...},...}
 *   {"type":"result","subtype":"success","result":"...","duration_ms":...,"usage":{...}}
 */
// =============================================================================
// DECODER
// =============================================================================
export class ClaudeEventDecoder {
    onProgress;
    _finalResponse = null;
    _usage = null;
    _error = null;
    _eventCount = 0;
    _durationMs = null;
    // =============================================================================
    // PUBLIC API
    // =============================================================================
    processLine(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            return;
        let event;
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
                return;
            event = parsed;
        }
        catch {
            return;
        }
        if (!event.type)
            return;
        this._handleEvent(event);
    }
    getFinalResponse() {
        return this._finalResponse;
    }
    getUsage() {
        return this._usage;
    }
    getError() {
        return this._error;
    }
    getDurationMs() {
        return this._durationMs;
    }
    hasNoOutput() {
        return this._eventCount > 0 && this._finalResponse === null;
    }
    // =============================================================================
    // PRIVATE HELPERS
    // =============================================================================
    _handleEvent(event) {
        this._eventCount++;
        switch (event.type) {
            case 'result':
                // The result event contains the final text response
                if (event.subtype === 'success' && typeof event.result === 'string') {
                    this._finalResponse = event.result;
                }
                if (event.is_error) {
                    this._error = event.result || 'Claude review failed';
                }
                if (event.usage) {
                    this._usage = event.usage;
                }
                if (event.duration_ms != null) {
                    this._durationMs = event.duration_ms;
                }
                break;
            case 'assistant':
                // Track usage from assistant messages
                if (event.message?.usage) {
                    this._usage = event.message.usage;
                }
                break;
            case 'error':
                this._error = event.result || 'Unknown error from Claude CLI';
                break;
        }
        this.onProgress?.(event.type, this._describeEvent(event));
    }
    _describeEvent(event) {
        switch (event.type) {
            case 'system':
                if (event.subtype === 'init')
                    return `model: ${event.model || 'opus'}`;
                if (event.subtype)
                    return event.subtype;
                return undefined;
            case 'assistant':
                return 'assistant message';
            case 'tool_use':
                return event.tool_name ? `tool: ${event.tool_name}` : 'tool use';
            case 'result':
                return `status: ${event.subtype || 'unknown'}`;
            default:
                return undefined;
        }
    }
}
