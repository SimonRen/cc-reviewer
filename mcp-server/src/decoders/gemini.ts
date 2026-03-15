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

export class GeminiEventDecoder {
  private assistantChunks: string[] = [];
  private _stats: GeminiEvent['stats'] | null = null;
  onProgress?: (eventType: string, detail?: string) => void;

  processLine(line: string): void {
    let event: GeminiEvent;
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      event = parsed;
    } catch {
      return;
    }

    if (!event.type) return;

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

  getFinalResponse(): string {
    return this.assistantChunks.join('');
  }

  getStats(): GeminiEvent['stats'] | null {
    return this._stats;
  }

  private describeEvent(event: GeminiEvent): string {
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
