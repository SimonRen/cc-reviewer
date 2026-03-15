import { describe, it, expect } from 'vitest';
import { buildHandoffPrompt, buildPeerPrompt, Handoff } from '../handoff.js';

describe('handoff prompt building', () => {
  const mockHandoff: Handoff = {
    workingDir: '/test/dir',
    summary: 'Did some work',
    confidence: 0.8,
    uncertainties: [{ topic: 'Auth', question: 'Is it safe?', severity: 'critical' }],
    questions: [{ question: 'Why?' }],
    priorityFiles: ['src/index.ts']
  };

  it('should build a handoff prompt with all sections', () => {
    const prompt = buildHandoffPrompt({ handoff: mockHandoff, outputFormat: 'json' });
    
    expect(prompt).toContain('# ROLE: Comprehensive Code Reviewer');
    expect(prompt).toContain('## YOUR TASK');
    expect(prompt).toContain('Review recent work in `/test/dir`');
    expect(prompt).toContain('**Summary:** Did some work');
    expect(prompt).toContain('**CC Confidence:** 80%');
    expect(prompt).toContain("## CC'S UNCERTAINTIES");
    expect(prompt).toContain('### 1. Auth ⚠️');
    expect(prompt).toContain('## QUESTIONS FROM CC');
    expect(prompt).toContain('## PRIORITY FILES');
    expect(prompt).toContain('## OUTPUT FORMAT');
    expect(prompt).toContain('"findings":');
  });

  it('should build a schema-enforced prompt without JSON template', () => {
    const prompt = buildHandoffPrompt({ handoff: mockHandoff, outputFormat: 'schema-enforced' });
    expect(prompt).toContain('Respond with valid JSON matching the schema');
    expect(prompt).not.toContain('"findings":');
  });
});

describe('peer prompt building', () => {
  it('should build a peer prompt', () => {
    const prompt = buildPeerPrompt({
      workingDir: '/test/dir',
      prompt: 'Help me debug',
      outputFormat: 'json',
      relevantFiles: ['src/debug.ts']
    });

    expect(prompt).toContain('# ROLE: Comprehensive Code Reviewer — Peer Engineer');
    expect(prompt).toContain('## YOUR TASK');
    expect(prompt).toContain('**Request:** Help me debug');
    expect(prompt).toContain('## RELEVANT FILES');
    expect(prompt).toContain('src/debug.ts');
    expect(prompt).toContain('## OUTPUT FORMAT');
    expect(prompt).not.toContain('HOW TO WORK');
  });

  it('should handle schema-enforced peer prompt', () => {
    const prompt = buildPeerPrompt({
      workingDir: '/test/dir',
      prompt: 'Help me debug',
      outputFormat: 'schema-enforced'
    });
    expect(prompt).toContain('Respond with valid JSON matching the schema');
    expect(prompt).not.toContain('"responder":');
  });
});
