/**
 * Tests for peer tool handlers
 */

import { describe, it, expect } from 'vitest';

import { PEER_TOOL_DEFINITIONS, formatPeerResponse } from '../tools/peer.js';

// =============================================================================
// TOOL DEFINITIONS TESTS
// =============================================================================

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

// =============================================================================
// FORMAT PEER RESPONSE TESTS
// =============================================================================

describe('formatPeerResponse', () => {
  it('should format successful response', () => {
    const result = {
      success: true as const,
      output: {
        responder: 'codex',
        answer: 'The bug is in auth.ts line 42.',
        confidence: 0.9,
        key_points: ['Bug in auth validation', 'Missing null check'],
        suggested_actions: [{
          action: 'Add null check',
          priority: 'high' as const,
          file: 'src/auth.ts',
          rationale: 'Prevents NPE',
        }],
        file_references: [{
          path: 'src/auth.ts',
          lines: '40-45',
          relevance: 'Auth validation logic',
        }],
      },
      executionTimeMs: 5000,
    };

    const formatted = formatPeerResponse(result, 'Codex');
    expect(formatted).toContain('Codex');
    expect(formatted).toContain('The bug is in auth.ts line 42.');
    expect(formatted).toContain('90%');
    expect(formatted).toContain('Add null check');
    expect(formatted).toContain('src/auth.ts');
  });

  it('should format error response', () => {
    const result = {
      success: false as const,
      error: { type: 'cli_not_found' as const, message: 'Codex CLI not found' },
      suggestion: 'Install with: npm install -g @openai/codex',
      executionTimeMs: 100,
    };

    const formatted = formatPeerResponse(result, 'Codex');
    expect(formatted).toContain('cli_not_found');
    expect(formatted).toContain('Codex CLI not found');
  });

  it('should format response with alternatives', () => {
    const result = {
      success: true as const,
      output: {
        responder: 'gemini',
        answer: 'Consider using Redis.',
        confidence: 0.75,
        key_points: ['Redis is fast'],
        suggested_actions: [],
        file_references: [],
        alternatives: [{
          topic: 'Caching',
          current_approach: 'In-memory',
          alternative: 'Redis',
          tradeoffs: { pros: ['Persistent'], cons: ['Complexity'] },
          recommendation: 'consider' as const,
        }],
      },
      executionTimeMs: 3000,
    };

    const formatted = formatPeerResponse(result, 'Gemini');
    expect(formatted).toContain('Alternatives');
    expect(formatted).toContain('Caching');
    expect(formatted).toContain('Redis');
  });
});
