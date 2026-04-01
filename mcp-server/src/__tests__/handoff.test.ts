import { describe, it, expect } from 'vitest';
import {
  buildHandoffPrompt,
  buildAdversarialHandoffPrompt,
  buildSimpleHandoff,
  parseStructuredCcOutput,
  selectRole,
  ADVERSARIAL_REVIEWER,
  Handoff,
} from '../handoff.js';

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

describe('adversarial handoff prompt', () => {
  const mockHandoff: Handoff = {
    workingDir: '/test/dir',
    summary: 'Implemented caching layer with Redis',
    uncertainties: [{ topic: 'TTL', question: 'Is 5min TTL right?', severity: 'important' }],
    priorityFiles: ['src/cache.ts'],
  };

  it('should use ADVERSARIAL_REVIEWER role', () => {
    const prompt = buildAdversarialHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).toContain(`# ROLE: ${ADVERSARIAL_REVIEWER.name}`);
    expect(prompt).toContain('break confidence');
  });

  it('should contain all adversarial stance sections', () => {
    const prompt = buildAdversarialHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).toContain('<operating_stance>');
    expect(prompt).toContain('</operating_stance>');
    expect(prompt).toContain('<attack_surface>');
    expect(prompt).toContain('</attack_surface>');
    expect(prompt).toContain('<review_method>');
    expect(prompt).toContain('</review_method>');
    expect(prompt).toContain('<finding_bar>');
    expect(prompt).toContain('</finding_bar>');
    expect(prompt).toContain('<calibration_rules>');
    expect(prompt).toContain('</calibration_rules>');
    expect(prompt).toContain('<grounding_rules>');
    expect(prompt).toContain('</grounding_rules>');
  });

  it('should include standard handoff sections (task, uncertainties, files)', () => {
    const prompt = buildAdversarialHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).toContain('## YOUR TASK');
    expect(prompt).toContain('Review code in `/test/dir`');
    expect(prompt).toContain('READ-ONLY');
    expect(prompt).toContain("## CC'S UNCERTAINTIES");
    expect(prompt).toContain('## PRIORITY FILES');
  });

  it('should include customInstructions as adversarial focus', () => {
    const handoff: Handoff = {
      workingDir: '/test/dir',
      summary: 'Test',
      customInstructions: 'Focus on race conditions and rollback safety',
    };
    const prompt = buildAdversarialHandoffPrompt({ handoff });
    expect(prompt).toContain('## ADVERSARIAL FOCUS');
    expect(prompt).toContain('race conditions and rollback safety');
  });

  it('should omit adversarial focus section when no customInstructions', () => {
    const prompt = buildAdversarialHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).not.toContain('## ADVERSARIAL FOCUS');
  });

  it('should render focusAreas in adversarial prompt', () => {
    const handoff: Handoff = {
      workingDir: '/test/dir',
      summary: 'Test',
      focusAreas: ['security', 'performance'],
    };
    const prompt = buildAdversarialHandoffPrompt({ handoff });
    expect(prompt).toContain('## FOCUS AREAS');
    expect(prompt).toContain('**security**');
    expect(prompt).toContain('**performance**');
  });

  it('should omit focusAreas section when not provided', () => {
    const prompt = buildAdversarialHandoffPrompt({ handoff: mockHandoff });
    expect(prompt).not.toContain('## FOCUS AREAS');
  });
});

// =============================================================================
// parseStructuredCcOutput
// =============================================================================

describe('parseStructuredCcOutput', () => {
  it('should parse all structured sections', () => {
    const ccOutput = `SUMMARY:
Implemented caching layer with Redis.

UNCERTAINTIES (verify these):
1. Is the cache TTL appropriate?
2. Does invalidation handle all update paths?

QUESTIONS:
1. Should I use write-through or write-behind?

PRIORITY FILES:
- src/cache.ts
- src/api/products.ts`;

    const result = parseStructuredCcOutput(ccOutput);

    expect(result.summary).toBe('Implemented caching layer with Redis.');
    expect(result.uncertainties).toHaveLength(2);
    expect(result.uncertainties![0].question).toBe('Is the cache TTL appropriate?');
    expect(result.uncertainties![1].question).toBe('Does invalidation handle all update paths?');
    expect(result.questions).toHaveLength(1);
    expect(result.questions![0].question).toBe('Should I use write-through or write-behind?');
    expect(result.priorityFiles).toEqual(['src/cache.ts', 'src/api/products.ts']);
  });

  it('should fall back to whole text as summary when unstructured', () => {
    const ccOutput = 'Just some free-form text about what I did.';
    const result = parseStructuredCcOutput(ccOutput);
    expect(result.summary).toBe(ccOutput);
    expect(result.uncertainties).toBeUndefined();
    expect(result.questions).toBeUndefined();
  });

  it('should handle SUMMARY-only output', () => {
    const ccOutput = 'SUMMARY:\nDid a thing.';
    const result = parseStructuredCcOutput(ccOutput);
    expect(result.summary).toBe('Did a thing.');
  });

  it('should parse DECISIONS section', () => {
    const ccOutput = `SUMMARY:
Refactored auth.

DECISIONS:
1. Used JWT over session cookies
2. Stored refresh tokens in httpOnly cookies`;

    const result = parseStructuredCcOutput(ccOutput);
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions![0].decision).toBe('Used JWT over session cookies');
  });

  it('should truncate long uncertainty topics', () => {
    const longText = 'A'.repeat(100);
    const ccOutput = `SUMMARY:\nTest\n\nUNCERTAINTIES:\n1. ${longText}`;
    const result = parseStructuredCcOutput(ccOutput);
    expect(result.uncertainties![0].topic.length).toBeLessThanOrEqual(60);
    expect(result.uncertainties![0].question).toBe(longText); // full text preserved
  });

  // --- Regression tests from multi-review findings ---

  it('should NOT split on lowercase prose that starts with a header word', () => {
    const ccOutput = `SUMMARY:
Implemented parser.
Questions: remaining cleanup is low risk.
This is still part of the summary.

UNCERTAINTIES:
1. Is this robust?`;

    const result = parseStructuredCcOutput(ccOutput);
    expect(result.summary).toContain('Questions: remaining cleanup is low risk.');
    expect(result.summary).toContain('This is still part of the summary.');
    expect(result.uncertainties).toHaveLength(1);
  });

  it('should handle empty SUMMARY section without duplicating entire blob', () => {
    const ccOutput = `SUMMARY:

QUESTIONS:
1. Should we keep this?`;

    const result = parseStructuredCcOutput(ccOutput);
    // Empty summary should fall back to full text, not empty string
    expect(result.summary).toBe(ccOutput);
    expect(result.questions).toHaveLength(1);
  });

  it('should parse bullet-formatted lists (not just numbered)', () => {
    const ccOutput = `SUMMARY:
Did a thing.

QUESTIONS:
- Should we use Redis?
- Is the TTL correct?

UNCERTAINTIES:
- Cache invalidation might be incomplete
- Race condition in the update path`;

    const result = parseStructuredCcOutput(ccOutput);
    expect(result.questions).toHaveLength(2);
    expect(result.questions![0].question).toBe('Should we use Redis?');
    expect(result.uncertainties).toHaveLength(2);
  });

  it('should parse "1)" style numbered lists', () => {
    const ccOutput = `SUMMARY:\nTest\n\nQUESTIONS:\n1) First question\n2) Second question`;
    const result = parseStructuredCcOutput(ccOutput);
    expect(result.questions).toHaveLength(2);
    expect(result.questions![0].question).toBe('First question');
  });

  it('should extract a short topic from first clause, not duplicate question', () => {
    const ccOutput = `SUMMARY:\nTest\n\nUNCERTAINTIES:\n1. Is the cache TTL appropriate, given the write frequency of product data?`;
    const result = parseStructuredCcOutput(ccOutput);
    expect(result.uncertainties![0].topic).toBe('Is the cache TTL appropriate');
    expect(result.uncertainties![0].question).toContain('given the write frequency');
  });

  it('should handle decorated SUMMARY header like "SUMMARY (brief):"', () => {
    const ccOutput = `SUMMARY (brief):
Did some work.

QUESTIONS:
1. Is this right?`;

    const result = parseStructuredCcOutput(ccOutput);
    expect(result.summary).toBe('Did some work.');
    expect(result.questions).toHaveLength(1);
  });
});

// =============================================================================
// buildSimpleHandoff (structured parsing integration)
// =============================================================================

describe('buildSimpleHandoff', () => {
  it('should parse structured ccOutput into typed Handoff fields', () => {
    const ccOutput = `SUMMARY:
Added auth middleware.

UNCERTAINTIES (verify these):
1. Is the token refresh logic correct?

QUESTIONS:
1. Should we use RS256 or HS256?

PRIORITY FILES:
- src/auth.ts`;

    const handoff = buildSimpleHandoff('/test', ccOutput, ['src/index.ts'], ['security']);

    expect(handoff.summary).toBe('Added auth middleware.');
    expect(handoff.uncertainties).toHaveLength(1);
    expect(handoff.uncertainties![0].question).toBe('Is the token refresh logic correct?');
    expect(handoff.questions).toHaveLength(1);
    expect(handoff.priorityFiles).toEqual(['src/auth.ts', 'src/index.ts']); // merged + deduped
    expect(handoff.focusAreas).toEqual(['security']);
  });

  it('should handle unstructured ccOutput gracefully', () => {
    const handoff = buildSimpleHandoff('/test', 'Just did some work', ['file.ts']);
    expect(handoff.summary).toBe('Just did some work');
    expect(handoff.uncertainties).toBeUndefined();
    expect(handoff.priorityFiles).toEqual(['file.ts']);
  });

  it('should deduplicate priority files', () => {
    const ccOutput = `SUMMARY:\nTest\n\nPRIORITY FILES:\n- src/a.ts\n- src/b.ts`;
    const handoff = buildSimpleHandoff('/test', ccOutput, ['src/a.ts', 'src/c.ts']);
    expect(handoff.priorityFiles).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });
});

// =============================================================================
// selectRole (composable)
// =============================================================================

describe('selectRole (composable)', () => {
  it('should return comprehensive reviewer when no focus areas', () => {
    const role = selectRole();
    expect(role.id).toBe('comprehensive');
  });

  it('should return single role for one focus area', () => {
    const role = selectRole(['security']);
    expect(role.id).toBe('security');
  });

  it('should compose roles for multiple focus areas mapping to different roles', () => {
    const role = selectRole(['security', 'performance']);
    expect(role.id).toBe('security+performance');
    expect(role.name).toContain('Security Auditor');
    expect(role.name).toContain('Performance Engineer');
    expect(role.systemPrompt).toContain('**As Security Auditor:**');
    expect(role.systemPrompt).toContain('**As Performance Engineer:**');
  });

  it('should not duplicate when multiple focus areas map to the same role', () => {
    // 'performance' and 'scalability' both map to PERFORMANCE_REVIEWER
    const role = selectRole(['performance', 'scalability']);
    expect(role.id).toBe('performance'); // single role, not composed
  });

  it('should return change_focused when no roles match', () => {
    const role = selectRole(['documentation' as any]);
    expect(role.id).toBe('change_focused');
  });

  it('should compose three roles', () => {
    const role = selectRole(['security', 'performance', 'correctness']);
    expect(role.id).toBe('security+performance+correctness');
  });
});

// =============================================================================
// Focus-area checklists in prompts
// =============================================================================

describe('focus-area checklists', () => {
  it('should include checklist when focus areas are provided', () => {
    const handoff: Handoff = {
      workingDir: '/test',
      summary: 'Test',
      focusAreas: ['security'],
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('## REVIEW CHECKLIST');
    expect(prompt).toContain('Injection vulnerabilities');
    expect(prompt).toContain('CWE ID');
  });

  it('should include multiple checklists for multiple focus areas', () => {
    const handoff: Handoff = {
      workingDir: '/test',
      summary: 'Test',
      focusAreas: ['security', 'performance'],
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('Injection vulnerabilities');
    expect(prompt).toContain('Big-O notation');
  });

  it('should not include checklist when no focus areas', () => {
    const handoff: Handoff = { workingDir: '/test', summary: 'Test' };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).not.toContain('## REVIEW CHECKLIST');
  });

  it('should include test suggestion in correctness checklist', () => {
    const handoff: Handoff = {
      workingDir: '/test',
      summary: 'Test',
      focusAreas: ['correctness'],
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('regression test');
  });

  it('should include checklist for alias focus areas (testing, scalability, maintainability, documentation)', () => {
    for (const area of ['testing', 'scalability', 'maintainability', 'documentation']) {
      const handoff: Handoff = { workingDir: '/test', summary: 'Test', focusAreas: [area] };
      const prompt = buildHandoffPrompt({ handoff });
      expect(prompt, `missing checklist for ${area}`).toContain('## REVIEW CHECKLIST');
    }
  });

  it('should omit empty rationale from decisions rendering', () => {
    const handoff: Handoff = {
      workingDir: '/test',
      summary: 'Test',
      decisions: [{ decision: 'Used Redis', rationale: '' }],
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('**Used Redis**');
    expect(prompt).not.toContain('Rationale: \n');
    expect(prompt).not.toMatch(/Rationale:\s*$/m);
  });

  it('should include rationale when present in decisions', () => {
    const handoff: Handoff = {
      workingDir: '/test',
      summary: 'Test',
      decisions: [{ decision: 'Used Redis', rationale: 'Reduces latency by 10x' }],
    };
    const prompt = buildHandoffPrompt({ handoff });
    expect(prompt).toContain('Rationale: Reduces latency by 10x');
  });
});

