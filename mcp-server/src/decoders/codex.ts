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
// PUBLIC TYPES
// =============================================================================

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
  error?: { message: string };
  message?: string;
}

// =============================================================================
// DECODER
// =============================================================================

export class CodexEventDecoder {
  /**
   * Optional callback invoked for every successfully parsed event.
   * @param eventType - The `type` field of the event (e.g. "item.completed").
   * @param detail    - A human-readable detail string for logging (may be undefined).
   */
  onProgress?: (eventType: string, detail?: string) => void;

  // The text from the most recently seen item.completed with item.type === "agent_message"
  private _finalResponse: string | null = null;

  // Token usage from the most recently seen turn.completed
  private _usage: CodexEvent['usage'] | null = null;

  // Error message from error/turn.failed events
  private _error: string | null = null;

  // Count of events received (0 = possible rate limit / instant rejection)
  private _eventCount = 0;

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Parse a single JSONL line. Silently skips malformed or empty input.
   */
  processLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let event: CodexEvent;
    try {
      const parsed = JSON.parse(trimmed);
      // Must be a plain object, not an array or primitive
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      event = parsed as CodexEvent;
    } catch {
      // Malformed JSON — silently skip
      return;
    }

    this._handleEvent(event);
  }

  /**
   * Returns the text from the LAST `item.completed` event whose item type is
   * `"agent_message"`, or `null` if no such event has been seen.
   */
  getFinalResponse(): string | null {
    return this._finalResponse;
  }

  /**
   * Returns the usage stats from the most recent `turn.completed` event, or
   * `null` if no such event has been seen.
   */
  getUsage(): CodexEvent['usage'] | null {
    return this._usage;
  }

  /**
   * Returns the error message from `error` or `turn.failed` events, or `null`.
   */
  getError(): string | null {
    return this._error;
  }

  /**
   * Returns true if events were received but no agent_message was produced.
   * Combined with a fast exit, this indicates rate limiting or instant rejection.
   */
  hasNoOutput(): boolean {
    return this._eventCount > 0 && this._finalResponse === null;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private _handleEvent(event: CodexEvent): void {
    this._eventCount++;

    // Track the last agent_message text
    if (
      event.type === 'item.completed' &&
      event.item?.type === 'agent_message' &&
      typeof event.item.text === 'string'
    ) {
      this._finalResponse = event.item.text;
    }

    // Track usage from turn completion
    if (event.type === 'turn.completed' && event.usage != null) {
      this._usage = event.usage;
    }

    // Capture errors from error/turn.failed events
    if (event.type === 'error') {
      this._error = event.message || 'Unknown error from Codex';
    }
    if (event.type === 'turn.failed') {
      this._error = event.error?.message || 'Turn failed';
    }
    // Capture error items (e.g. model errors reported as item.completed with type=error)
    if (event.type === 'item.completed' && event.item?.type === 'error') {
      this._error = event.item.message || event.item.text || 'Model error';
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
function describeEvent(event: CodexEvent): string | undefined {
  if (event.type === 'thread.started' && event.thread_id) {
    return `thread: ${event.thread_id}`;
  }

  if (
    (event.type === 'item.started' || event.type === 'item.completed') &&
    event.item != null
  ) {
    const { type: itemType, command, status } = event.item;

    if (itemType === 'command_execution') {
      const parts: string[] = [];
      if (command) parts.push(`command: ${command}`);
      if (status) parts.push(`status: ${status}`);
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
