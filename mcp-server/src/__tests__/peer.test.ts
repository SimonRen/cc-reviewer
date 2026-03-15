/**
 * Tests for peer tool definitions
 */

import { describe, it, expect } from 'vitest';
import { PEER_TOOL_DEFINITIONS } from '../tools/peer.js';

describe('Peer Tool Definitions', () => {
  it('should define ask_codex tool', () => {
    expect(PEER_TOOL_DEFINITIONS.ask_codex).toBeDefined();
    expect(PEER_TOOL_DEFINITIONS.ask_codex.name).toBe('ask_codex');
  });

  it('should define ask_gemini tool', () => {
    expect(PEER_TOOL_DEFINITIONS.ask_gemini).toBeDefined();
    expect(PEER_TOOL_DEFINITIONS.ask_gemini.name).toBe('ask_gemini');
  });

  it('should define ask_multi tool', () => {
    expect(PEER_TOOL_DEFINITIONS.ask_multi).toBeDefined();
    expect(PEER_TOOL_DEFINITIONS.ask_multi.name).toBe('ask_multi');
  });

  it('should require workingDir and prompt', () => {
    for (const tool of Object.values(PEER_TOOL_DEFINITIONS)) {
      const schema = tool.inputSchema as any;
      expect(schema.required).toContain('workingDir');
      expect(schema.required).toContain('prompt');
    }
  });

  it('should have taskType enum', () => {
    const schema = PEER_TOOL_DEFINITIONS.ask_codex.inputSchema as any;
    expect(schema.properties.taskType.enum).toEqual(
      ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general']
    );
  });
});
