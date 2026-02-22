/**
 * Tests for schema.ts - JSON Schema and Zod validation consistency
 */

import { describe, it, expect } from 'vitest';

import {
  ReviewFinding,
  CodeLocation,
  ReviewOutput,
  getReviewOutputJsonSchema,
  parseReviewOutput,
} from '../schema.js';

// =============================================================================
// ZOD SCHEMA TESTS
// =============================================================================

describe('CodeLocation Schema', () => {
  it('should require file field', () => {
    const result = CodeLocation.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should accept file-only location', () => {
    const result = CodeLocation.safeParse({ file: 'test.ts' });
    expect(result.success).toBe(true);
  });

  it('should accept full location', () => {
    const result = CodeLocation.safeParse({
      file: 'test.ts',
      line_start: 10,
      line_end: 20,
      column_start: 0,
      column_end: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative line numbers', () => {
    const result = CodeLocation.safeParse({
      file: 'test.ts',
      line_start: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('ReviewFinding Schema', () => {
  const validFinding = {
    id: 'find-1',
    category: 'security',
    severity: 'high',
    confidence: 0.9,
    title: 'SQL Injection',
    description: 'User input is not sanitized',
  };

  it('should accept valid finding', () => {
    const result = ReviewFinding.safeParse(validFinding);
    expect(result.success).toBe(true);
  });

  it('should accept finding with location', () => {
    const result = ReviewFinding.safeParse({
      ...validFinding,
      location: { file: 'db.ts', line_start: 42 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid severity', () => {
    const result = ReviewFinding.safeParse({
      ...validFinding,
      severity: 'extreme', // invalid
    });
    expect(result.success).toBe(false);
  });

  it('should reject confidence > 1', () => {
    const result = ReviewFinding.safeParse({
      ...validFinding,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject confidence < 0', () => {
    const result = ReviewFinding.safeParse({
      ...validFinding,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('should validate CWE ID format', () => {
    const validCwe = ReviewFinding.safeParse({
      ...validFinding,
      cwe_id: 'CWE-89',
    });
    expect(validCwe.success).toBe(true);

    const invalidCwe = ReviewFinding.safeParse({
      ...validFinding,
      cwe_id: 'CWE89', // missing dash
    });
    expect(invalidCwe.success).toBe(false);
  });
});

// =============================================================================
// JSON SCHEMA CONSISTENCY TESTS
// =============================================================================

describe('JSON Schema Consistency', () => {
  it('should have all severity levels', () => {
    const schema = getReviewOutputJsonSchema() as any;
    const severityEnum = schema.properties.findings.items.properties.severity.enum;

    expect(severityEnum).toContain('critical');
    expect(severityEnum).toContain('high');
    expect(severityEnum).toContain('medium');
    expect(severityEnum).toContain('low');
    expect(severityEnum).toContain('info');
  });

  it('should have confidence constraints', () => {
    const schema = getReviewOutputJsonSchema() as any;
    const confidenceSchema = schema.properties.findings.items.properties.confidence;

    expect(confidenceSchema.minimum).toBe(0);
    expect(confidenceSchema.maximum).toBe(1);
  });
});

// =============================================================================
// PARSE OUTPUT TESTS
// =============================================================================

describe('parseReviewOutput', () => {
  const validOutput = {
    reviewer: 'test',
    findings: [],
    agreements: [],
    disagreements: [],
    alternatives: [],
    risk_assessment: {
      overall_level: 'low',
      score: 20,
      summary: 'Low risk',
      top_concerns: [],
    },
  };

  it('should parse valid JSON string', () => {
    const result = parseReviewOutput(JSON.stringify(validOutput));
    expect(result).not.toBeNull();
    expect(result?.reviewer).toBe('test');
  });

  it('should extract JSON from markdown code blocks', () => {
    const markdown = `Here is the review:

\`\`\`json
${JSON.stringify(validOutput)}
\`\`\`

That's all.`;

    const result = parseReviewOutput(markdown);
    expect(result).not.toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const result = parseReviewOutput('not valid json');
    expect(result).toBeNull();
  });

  it('should normalize incomplete output with defaults', () => {
    const incomplete = { reviewer: 'test' }; // missing required fields get normalized
    const result = parseReviewOutput(JSON.stringify(incomplete));
    expect(result).not.toBeNull();
    expect(result!.reviewer).toBe('test');
    expect(result!.findings).toEqual([]);
    expect(result!.agreements).toEqual([]);
    expect(result!.disagreements).toEqual([]);
    expect(result!.alternatives).toEqual([]);
  });

  it('should return null for unrecognizable structure', () => {
    // No recognizable review fields - should not attempt normalization
    const invalid = { foo: 'bar', baz: 123 };
    expect(parseReviewOutput(JSON.stringify(invalid))).toBeNull();
    // Arrays should also fail
    expect(parseReviewOutput(JSON.stringify([1, 2, 3]))).toBeNull();
  });
});
