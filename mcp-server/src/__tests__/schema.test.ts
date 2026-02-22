/**
 * Tests for schema.ts - JSON Schema and Zod validation consistency
 */

import { describe, it, expect } from 'vitest';

import {
  ReviewFinding,
  CodeLocation,
  ReviewOutput,
  UncertaintyResponse,
  QuestionAnswer,
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

  it('should preserve uncertainty_responses when present', () => {
    const withResponses = {
      ...validOutput,
      uncertainty_responses: [
        { uncertainty_index: 1, verified: true, finding: 'Confirmed safe' },
      ],
    };
    const result = parseReviewOutput(JSON.stringify(withResponses));
    expect(result).not.toBeNull();
    expect(result!.uncertainty_responses).toHaveLength(1);
    expect(result!.uncertainty_responses![0].verified).toBe(true);
  });

  it('should preserve question_answers when present', () => {
    const withAnswers = {
      ...validOutput,
      question_answers: [
        { question_index: 1, answer: 'Yes, it is thread-safe', confidence: 0.9 },
      ],
    };
    const result = parseReviewOutput(JSON.stringify(withAnswers));
    expect(result).not.toBeNull();
    expect(result!.question_answers).toHaveLength(1);
    expect(result!.question_answers![0].answer).toBe('Yes, it is thread-safe');
  });

  it('should omit optional fields when absent', () => {
    const result = parseReviewOutput(JSON.stringify(validOutput));
    expect(result).not.toBeNull();
    expect(result!.uncertainty_responses).toBeUndefined();
    expect(result!.question_answers).toBeUndefined();
  });

  it('should normalize non-array uncertainty_responses to undefined', () => {
    const withBadField = {
      ...validOutput,
      uncertainty_responses: 'not an array',
    };
    const result = parseReviewOutput(JSON.stringify(withBadField));
    expect(result).not.toBeNull();
    expect(result!.uncertainty_responses).toBeUndefined();
  });
});

// =============================================================================
// UNCERTAINTY RESPONSE & QUESTION ANSWER SCHEMA TESTS
// =============================================================================

describe('UncertaintyResponse Schema', () => {
  it('should accept valid response', () => {
    const result = UncertaintyResponse.safeParse({
      uncertainty_index: 1,
      verified: true,
      finding: 'The race condition exists as suspected',
      recommendation: 'Add mutex lock',
    });
    expect(result.success).toBe(true);
  });

  it('should accept response without optional recommendation', () => {
    const result = UncertaintyResponse.safeParse({
      uncertainty_index: 2,
      verified: false,
      finding: 'Could not reproduce',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(UncertaintyResponse.safeParse({ uncertainty_index: 1 }).success).toBe(false);
    expect(UncertaintyResponse.safeParse({ verified: true }).success).toBe(false);
    expect(UncertaintyResponse.safeParse({ finding: 'test' }).success).toBe(false);
  });

  it('should reject non-positive index', () => {
    const result = UncertaintyResponse.safeParse({
      uncertainty_index: 0,
      verified: true,
      finding: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('QuestionAnswer Schema', () => {
  it('should accept valid answer with confidence', () => {
    const result = QuestionAnswer.safeParse({
      question_index: 1,
      answer: 'Yes, it handles edge cases',
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it('should accept answer without optional confidence', () => {
    const result = QuestionAnswer.safeParse({
      question_index: 3,
      answer: 'The function is not thread-safe',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(QuestionAnswer.safeParse({ question_index: 1 }).success).toBe(false);
    expect(QuestionAnswer.safeParse({ answer: 'test' }).success).toBe(false);
  });

  it('should reject confidence out of range', () => {
    expect(QuestionAnswer.safeParse({
      question_index: 1,
      answer: 'test',
      confidence: 1.5,
    }).success).toBe(false);

    expect(QuestionAnswer.safeParse({
      question_index: 1,
      answer: 'test',
      confidence: -0.1,
    }).success).toBe(false);
  });
});

// =============================================================================
// JSON SCHEMA - NEW FIELDS TESTS
// =============================================================================

describe('JSON Schema - New Fields', () => {
  it('should include uncertainty_responses as non-required', () => {
    const schema = getReviewOutputJsonSchema() as any;
    expect(schema.properties.uncertainty_responses).toBeDefined();
    expect(schema.required).not.toContain('uncertainty_responses');
  });

  it('should include question_answers as non-required', () => {
    const schema = getReviewOutputJsonSchema() as any;
    expect(schema.properties.question_answers).toBeDefined();
    expect(schema.required).not.toContain('question_answers');
  });

  it('should have correct structure for uncertainty_responses items', () => {
    const schema = getReviewOutputJsonSchema() as any;
    const itemProps = schema.properties.uncertainty_responses.items.properties;
    expect(itemProps.uncertainty_index).toBeDefined();
    expect(itemProps.verified).toBeDefined();
    expect(itemProps.finding).toBeDefined();
    expect(itemProps.recommendation).toBeDefined();
  });

  it('should have correct structure for question_answers items', () => {
    const schema = getReviewOutputJsonSchema() as any;
    const itemProps = schema.properties.question_answers.items.properties;
    expect(itemProps.question_index).toBeDefined();
    expect(itemProps.answer).toBeDefined();
    expect(itemProps.confidence).toBeDefined();
  });
});
