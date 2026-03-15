/**
 * GeminiEventDecoder — Parses Gemini CLI stream-json JSONL events.
 *
 * Concatenates assistant message deltas into a final response,
 * tracks stats from the result event, and emits progress callbacks.
 */
export class GeminiEventDecoder {
    assistantChunks = [];
    _stats = null;
    onProgress;
    processLine(line) {
        let event;
        try {
            const parsed = JSON.parse(line);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
                return;
            event = parsed;
        }
        catch {
            return;
        }
        if (!event.type)
            return;
        this.onProgress?.(event.type, this.describeEvent(event));
        switch (event.type) {
            case 'message':
                if (event.role === 'assistant' && event.delta && event.content) {
                    this.assistantChunks.push(event.content);
                }
                break;
            case 'result':
                if (event.stats) {
                    this._stats = event.stats;
                }
                break;
        }
    }
    getFinalResponse() {
        return this.assistantChunks.join('');
    }
    getStats() {
        return this._stats;
    }
    describeEvent(event) {
        switch (event.type) {
            case 'init':
                return `model: ${event.model || 'unknown'}`;
            case 'tool_use':
                return `tool: ${event.tool_name || 'unknown'}`;
            case 'tool_result':
                return `status: ${event.status || 'unknown'}`;
            case 'result':
                return `status: ${event.status || 'unknown'}`;
            default:
                return '';
        }
    }
}
