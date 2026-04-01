import { describe, it, expect } from 'vitest';
import { buildHandoffPrompt, Handoff } from '../handoff.js';

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
    const prompt = buildHandoffPrompt({ handoff: mockHandoff });

    expect(prompt).toContain('# ROLE: Comprehensive Code Reviewer');
    expect(prompt).toContain('## YOUR TASK');
    expect(prompt).toContain('Review code in `/test/dir`');
    expect(prompt).toContain('Do NOT assume a git repository exists');
    expect(prompt).toContain('**Summary:** Did some work');
    expect(prompt).toContain('**CC Confidence:** 80%');
    expect(prompt).toContain("## CC'S UNCERTAINTIES");
    expect(prompt).toContain('### 1. Auth');
    expect(prompt).toContain('## QUESTIONS FROM CC');
    expect(prompt).toContain('## PRIORITY FILES');
  });

  it('should not contain any output format instructions', () => {
    const prompt = buildHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).not.toContain('OUTPUT FORMAT');
    expect(prompt).not.toContain('"findings"');
    expect(prompt).not.toContain('JSON');
  });

  it('should render customInstructions when provided', () => {
    const handoff: Handoff = {
      workingDir: '/test/dir',
      summary: 'Test',
      customInstructions: 'Only review error handling',
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('## ADDITIONAL INSTRUCTIONS');
    expect(prompt).toContain('Only review error handling');
  });

  it('should omit customInstructions section when not provided', () => {
    const handoff: Handoff = { workingDir: '/test/dir', summary: 'Test' };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).not.toContain('ADDITIONAL INSTRUCTIONS');
  });
});

