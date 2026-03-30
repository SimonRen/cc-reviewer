/**
 * ClaudeEventDecoder — Parses Claude CLI stream-json JSONL events.
 *
 * Event stream format (with --output-format stream-json --verbose):
 *   {"type":"system","subtype":"init",...}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...},...}
 *   {"type":"result","subtype":"success","result":"...","duration_ms":...,"usage":{...}}
 */

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface ClaudeEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  message?: {
    content?: Array<{ type: string; text?: string }>;
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

// =============================================================================
// DECODER
// =============================================================================

export class ClaudeEventDecoder {
  onProgress?: (eventType: string, detail?: string) => void;

  private _finalResponse: string | null = null;
  private _usage: ClaudeEvent['usage'] | null = null;
  private _error: string | null = null;
  private _eventCount = 0;
  private _durationMs: number | null = null;

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  processLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let event: ClaudeEvent;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      event = parsed as ClaudeEvent;
    } catch {
      return;
    }

    if (!event.type) return;
    this._handleEvent(event);
  }

  getFinalResponse(): string | null {
    return this._finalResponse;
  }

  getUsage(): ClaudeEvent['usage'] | null {
    return this._usage;
  }

  getError(): string | null {
    return this._error;
  }

  getDurationMs(): number | null {
    return this._durationMs;
  }

  hasNoOutput(): boolean {
    return this._eventCount > 0 && this._finalResponse === null;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private _handleEvent(event: ClaudeEvent): void {
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

  private _describeEvent(event: ClaudeEvent): string | undefined {
    switch (event.type) {
      case 'system':
        if (event.subtype === 'init') return `model: ${event.model || 'opus'}`;
        if (event.subtype) return event.subtype;
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
