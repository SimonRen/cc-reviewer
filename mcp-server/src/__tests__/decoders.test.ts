/**
 * Tests for decoders — CodexEventDecoder + GeminiEventDecoder
 */

import { describe, it, expect, vi } from 'vitest';
import { CodexEventDecoder } from '../decoders/codex.js';
import { GeminiEventDecoder } from '../decoders/gemini.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

/** Feed an array of event objects as JSONL lines into the decoder. */
function feedEvents(decoder: CodexEventDecoder, events: object[]): void {
  for (const event of events) {
    decoder.processLine(JSON.stringify(event));
  }
}

// =============================================================================
// SAMPLE EVENTS
// =============================================================================

const THREAD_STARTED = { type: 'thread.started', thread_id: 'abc123' };
const TURN_STARTED = { type: 'turn.started' };
const CMD_ITEM_STARTED = {
  type: 'item.started',
  item: { id: 'item_0', type: 'command_execution', command: 'git diff', status: 'in_progress' },
};
const CMD_ITEM_COMPLETED = {
  type: 'item.completed',
  item: { id: 'item_0', type: 'command_execution', command: 'git diff', exit_code: 0, status: 'completed' },
};
const AGENT_MSG_INTERMEDIATE = {
  type: 'item.completed',
  item: { id: 'item_1', type: 'agent_message', text: '{"reviewer":"codex","partial":true}' },
};
const AGENT_MSG_FINAL = {
  type: 'item.completed',
  item: { id: 'item_2', type: 'agent_message', text: '{"reviewer":"codex","findings":[]}' },
};
const TURN_COMPLETED = {
  type: 'turn.completed',
  usage: { input_tokens: 100, cached_input_tokens: 10, output_tokens: 50 },
};

// =============================================================================
// TEST SUITE 1 — getFinalResponse
// =============================================================================

describe('CodexEventDecoder — getFinalResponse', () => {
  it('returns null when no events have been processed', () => {
    const decoder = new CodexEventDecoder();
    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('returns null when only non-agent_message items are present', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [THREAD_STARTED, TURN_STARTED, CMD_ITEM_STARTED, CMD_ITEM_COMPLETED]);
    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('returns text from a single agent_message item.completed', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [THREAD_STARTED, TURN_STARTED, AGENT_MSG_FINAL, TURN_COMPLETED]);
    expect(decoder.getFinalResponse()).toBe('{"reviewer":"codex","findings":[]}');
  });

  it('returns text from the LAST agent_message when multiple are present', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [
      THREAD_STARTED,
      TURN_STARTED,
      AGENT_MSG_INTERMEDIATE,
      CMD_ITEM_STARTED,
      CMD_ITEM_COMPLETED,
      AGENT_MSG_FINAL,
      TURN_COMPLETED,
    ]);
    // Must be the final agent_message, not the intermediate one
    expect(decoder.getFinalResponse()).toBe('{"reviewer":"codex","findings":[]}');
  });

  it('ignores item.completed events that are not agent_message type', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [CMD_ITEM_COMPLETED]);
    expect(decoder.getFinalResponse()).toBeNull();
  });
});

// =============================================================================
// TEST SUITE 2 — onProgress callback
// =============================================================================

describe('CodexEventDecoder — onProgress', () => {
  it('calls onProgress for every valid event with the event type', () => {
    const decoder = new CodexEventDecoder();
    const calls: Array<{ eventType: string; detail?: string }> = [];
    decoder.onProgress = (eventType, detail) => calls.push({ eventType, detail });

    feedEvents(decoder, [THREAD_STARTED, TURN_STARTED, CMD_ITEM_COMPLETED, AGENT_MSG_FINAL, TURN_COMPLETED]);

    const types = calls.map((c) => c.eventType);
    expect(types).toContain('thread.started');
    expect(types).toContain('turn.started');
    expect(types).toContain('item.completed');
    expect(types).toContain('turn.completed');
  });

  it('provides a detail string for command_execution items', () => {
    const decoder = new CodexEventDecoder();
    const details: Array<string | undefined> = [];
    decoder.onProgress = (_type, detail) => details.push(detail);

    feedEvents(decoder, [CMD_ITEM_COMPLETED]);

    // At least one call should mention the command
    const hasCommandDetail = details.some((d) => d !== undefined && d.includes('git diff'));
    expect(hasCommandDetail).toBe(true);
  });

  it('does not throw if onProgress is not set', () => {
    const decoder = new CodexEventDecoder();
    // No onProgress assigned — should not throw
    expect(() => feedEvents(decoder, [THREAD_STARTED, TURN_STARTED, TURN_COMPLETED])).not.toThrow();
  });
});

// =============================================================================
// TEST SUITE 3 — malformed JSONL handling
// =============================================================================

describe('CodexEventDecoder — malformed input', () => {
  it('silently skips completely empty lines', () => {
    const decoder = new CodexEventDecoder();
    expect(() => decoder.processLine('')).not.toThrow();
    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('silently skips lines with invalid JSON', () => {
    const decoder = new CodexEventDecoder();
    expect(() => decoder.processLine('not valid json')).not.toThrow();
    expect(() => decoder.processLine('{broken:')).not.toThrow();
    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('silently skips lines with valid JSON that is not an object', () => {
    const decoder = new CodexEventDecoder();
    expect(() => decoder.processLine('"just a string"')).not.toThrow();
    expect(() => decoder.processLine('[1, 2, 3]')).not.toThrow();
    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('continues processing valid events after malformed lines', () => {
    const decoder = new CodexEventDecoder();
    decoder.processLine('not json at all');
    decoder.processLine(JSON.stringify(AGENT_MSG_FINAL));
    decoder.processLine('{another: broken line}');

    expect(decoder.getFinalResponse()).toBe('{"reviewer":"codex","findings":[]}');
  });

  it('does not call onProgress for malformed lines', () => {
    const decoder = new CodexEventDecoder();
    const callCount = { n: 0 };
    decoder.onProgress = () => { callCount.n++; };

    decoder.processLine('bad json');
    decoder.processLine('');

    expect(callCount.n).toBe(0);
  });
});

// =============================================================================
// TEST SUITE 4 — getUsage
// =============================================================================

describe('CodexEventDecoder — getUsage', () => {
  it('returns null when no turn.completed event has been processed', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [THREAD_STARTED, TURN_STARTED]);
    expect(decoder.getUsage()).toBeNull();
  });

  it('returns usage stats from turn.completed event', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [THREAD_STARTED, TURN_STARTED, AGENT_MSG_FINAL, TURN_COMPLETED]);

    const usage = decoder.getUsage();
    expect(usage).not.toBeNull();
    expect(usage!.input_tokens).toBe(100);
    expect(usage!.output_tokens).toBe(50);
    expect(usage!.cached_input_tokens).toBe(10);
  });

  it('captures usage even without a final agent_message', () => {
    const decoder = new CodexEventDecoder();
    feedEvents(decoder, [THREAD_STARTED, TURN_COMPLETED]);

    const usage = decoder.getUsage();
    expect(usage).not.toBeNull();
    expect(usage!.input_tokens).toBe(100);
    expect(usage!.output_tokens).toBe(50);
  });

  it('handles turn.completed without cached_input_tokens field', () => {
    const decoder = new CodexEventDecoder();
    decoder.processLine(JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 200, output_tokens: 75 },
    }));

    const usage = decoder.getUsage();
    expect(usage).not.toBeNull();
    expect(usage!.input_tokens).toBe(200);
    expect(usage!.output_tokens).toBe(75);
    expect(usage!.cached_input_tokens).toBeUndefined();
  });
});

// =============================================================================
// GEMINI EVENT DECODER TESTS
// =============================================================================

describe('GeminiEventDecoder — getFinalResponse', () => {
  it('returns empty string when no events processed', () => {
    const decoder = new GeminiEventDecoder();
    expect(decoder.getFinalResponse()).toBe('');
  });

  it('concatenates assistant message deltas into final response', () => {
    const decoder = new GeminiEventDecoder();
    const lines = [
      '{"type":"init","session_id":"abc","model":"gemini-3"}',
      '{"type":"message","role":"user","content":"review this"}',
      '{"type":"message","role":"assistant","content":"{\\"reviewer\\":","delta":true}',
      '{"type":"tool_use","tool_name":"read_file","tool_id":"t1","parameters":{}}',
      '{"type":"tool_result","tool_id":"t1","status":"success","output":"file contents"}',
      '{"type":"message","role":"assistant","content":"\\"gemini\\"}","delta":true}',
      '{"type":"result","status":"success","stats":{"total_tokens":100,"input_tokens":80,"output_tokens":20,"duration_ms":5000}}',
    ];

    for (const line of lines) {
      decoder.processLine(line);
    }

    expect(decoder.getFinalResponse()).toBe('{"reviewer":"gemini"}');
  });

  it('ignores user messages', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('{"type":"message","role":"user","content":"hello"}');
    expect(decoder.getFinalResponse()).toBe('');
  });

  it('ignores assistant messages without delta flag', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('{"type":"message","role":"assistant","content":"no delta"}');
    expect(decoder.getFinalResponse()).toBe('');
  });
});

describe('GeminiEventDecoder — onProgress', () => {
  it('calls onProgress for every valid event', () => {
    const decoder = new GeminiEventDecoder();
    const events: string[] = [];
    decoder.onProgress = (type) => events.push(type);

    decoder.processLine('{"type":"init","session_id":"abc","model":"gemini-3"}');
    decoder.processLine('{"type":"tool_use","tool_name":"read_file","tool_id":"t1"}');
    decoder.processLine('{"type":"result","status":"success","stats":{"total_tokens":100,"input_tokens":80,"output_tokens":20,"duration_ms":5000}}');

    expect(events).toEqual(['init', 'tool_use', 'result']);
  });

  it('provides detail for tool_use events', () => {
    const decoder = new GeminiEventDecoder();
    const details: Array<string | undefined> = [];
    decoder.onProgress = (_type, detail) => details.push(detail);

    decoder.processLine('{"type":"tool_use","tool_name":"read_file","tool_id":"t1"}');

    expect(details.some(d => d?.includes('read_file'))).toBe(true);
  });
});

describe('GeminiEventDecoder — malformed input', () => {
  it('handles malformed JSONL lines gracefully', () => {
    const decoder = new GeminiEventDecoder();
    expect(() => decoder.processLine('not json')).not.toThrow();
    expect(decoder.getFinalResponse()).toBe('');
  });

  it('skips non-object JSON values', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('"just a string"');
    decoder.processLine('[1,2,3]');
    expect(decoder.getFinalResponse()).toBe('');
  });
});

describe('GeminiEventDecoder — getStats', () => {
  it('returns null when no result event processed', () => {
    const decoder = new GeminiEventDecoder();
    expect(decoder.getStats()).toBeNull();
  });

  it('extracts stats from result event', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('{"type":"result","status":"success","stats":{"total_tokens":100,"input_tokens":80,"output_tokens":20,"duration_ms":5000}}');

    expect(decoder.getStats()).toEqual({
      total_tokens: 100,
      input_tokens: 80,
      output_tokens: 20,
      duration_ms: 5000,
    });
  });
});
