# Peer Ask Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `ask_codex`, `ask_gemini`, and `ask_multi` MCP tools so external CLIs can serve as general-purpose coworkers, not just reviewers.

**Architecture:** New Zod schemas (`PeerOutput`, `PeerInput`) + new prompt builder (`buildPeerPrompt`) + `runPeerRequest()` on each adapter (reuses existing `runCli()`) + new tool handlers in `tools/peer.ts` + new slash commands. Existing review tools are untouched.

**Tech Stack:** TypeScript, Zod, MCP SDK, vitest

---

### Task 1: Add PeerOutput and PeerInput Schemas

**Files:**
- Modify: `mcp-server/src/schema.ts` (append after line 544, before EOF)
- Test: `mcp-server/src/__tests__/schema.test.ts`

**Step 1: Write the failing tests**

Add to `mcp-server/src/__tests__/schema.test.ts` (append after the last `describe` block):

```typescript
import {
  PeerOutput,
  PeerInputSchema,
  getPeerOutputJsonSchema,
  parsePeerOutput,
} from '../schema.js';

// =============================================================================
// PEER OUTPUT SCHEMA TESTS
// =============================================================================

describe('PeerOutput Schema', () => {
  const validPeerOutput = {
    responder: 'codex',
    timestamp: '2026-02-22T00:00:00Z',
    answer: 'The bug is in the authentication middleware.',
    confidence: 0.85,
    key_points: ['Auth middleware skips validation for /api/health', 'Missing token check'],
    suggested_actions: [
      {
        action: 'Add token validation to middleware',
        priority: 'high',
        file: 'src/middleware/auth.ts',
        rationale: 'Currently unauthenticated requests pass through',
      },
    ],
    file_references: [
      {
        path: 'src/middleware/auth.ts',
        lines: '15-30',
        relevance: 'Authentication check logic',
      },
    ],
  };

  it('should accept valid peer output', () => {
    const result = PeerOutput.safeParse(validPeerOutput);
    expect(result.success).toBe(true);
  });

  it('should accept output without optional fields', () => {
    const minimal = {
      responder: 'gemini',
      timestamp: '2026-02-22T00:00:00Z',
      answer: 'Here is the explanation.',
      confidence: 0.7,
      key_points: ['Point 1'],
      suggested_actions: [],
      file_references: [],
    };
    const result = PeerOutput.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(PeerOutput.safeParse({}).success).toBe(false);
    expect(PeerOutput.safeParse({ responder: 'codex' }).success).toBe(false);
    expect(PeerOutput.safeParse({ answer: 'test' }).success).toBe(false);
  });

  it('should reject confidence out of range', () => {
    expect(PeerOutput.safeParse({ ...validPeerOutput, confidence: 1.5 }).success).toBe(false);
    expect(PeerOutput.safeParse({ ...validPeerOutput, confidence: -0.1 }).success).toBe(false);
  });

  it('should accept output with alternatives', () => {
    const withAlts = {
      ...validPeerOutput,
      alternatives: [{
        topic: 'Auth strategy',
        current_approach: 'JWT middleware',
        alternative: 'Session-based auth',
        tradeoffs: { pros: ['Simpler'], cons: ['Stateful'] },
        recommendation: 'consider',
      }],
    };
    const result = PeerOutput.safeParse(withAlts);
    expect(result.success).toBe(true);
  });

  it('should validate suggested_actions priority enum', () => {
    const badPriority = {
      ...validPeerOutput,
      suggested_actions: [{
        action: 'test',
        priority: 'urgent', // invalid
        rationale: 'test',
      }],
    };
    expect(PeerOutput.safeParse(badPriority).success).toBe(false);
  });
});

describe('PeerInputSchema', () => {
  it('should accept valid input with required fields only', () => {
    const result = PeerInputSchema.safeParse({
      workingDir: '/path/to/project',
      prompt: 'Help me find the bug in auth',
    });
    expect(result.success).toBe(true);
  });

  it('should accept input with all optional fields', () => {
    const result = PeerInputSchema.safeParse({
      workingDir: '/path/to/project',
      prompt: 'Help me plan the refactor',
      taskType: 'plan',
      relevantFiles: ['src/auth.ts', 'src/middleware.ts'],
      context: 'Getting 401 errors on valid tokens',
      focusAreas: ['security', 'correctness'],
      customPrompt: 'Focus on JWT validation',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing workingDir', () => {
    expect(PeerInputSchema.safeParse({ prompt: 'help' }).success).toBe(false);
  });

  it('should reject missing prompt', () => {
    expect(PeerInputSchema.safeParse({ workingDir: '/tmp' }).success).toBe(false);
  });

  it('should reject invalid taskType', () => {
    expect(PeerInputSchema.safeParse({
      workingDir: '/tmp',
      prompt: 'help',
      taskType: 'invalid',
    }).success).toBe(false);
  });
});

describe('getPeerOutputJsonSchema', () => {
  it('should return valid JSON schema object', () => {
    const schema = getPeerOutputJsonSchema() as any;
    expect(schema.type).toBe('object');
    expect(schema.required).toContain('responder');
    expect(schema.required).toContain('answer');
    expect(schema.required).toContain('confidence');
    expect(schema.required).toContain('key_points');
    expect(schema.required).toContain('suggested_actions');
    expect(schema.required).toContain('file_references');
  });

  it('should have correct suggested_actions item structure', () => {
    const schema = getPeerOutputJsonSchema() as any;
    const actionProps = schema.properties.suggested_actions.items.properties;
    expect(actionProps.action).toBeDefined();
    expect(actionProps.priority).toBeDefined();
    expect(actionProps.priority.enum).toEqual(['high', 'medium', 'low']);
    expect(actionProps.rationale).toBeDefined();
  });
});

describe('parsePeerOutput', () => {
  const validOutput = {
    responder: 'codex',
    timestamp: '2026-02-22T00:00:00Z',
    answer: 'The issue is X.',
    confidence: 0.8,
    key_points: ['Point 1'],
    suggested_actions: [],
    file_references: [],
  };

  it('should parse valid JSON string', () => {
    const result = parsePeerOutput(JSON.stringify(validOutput));
    expect(result).not.toBeNull();
    expect(result?.responder).toBe('codex');
  });

  it('should extract JSON from markdown code blocks', () => {
    const markdown = `Here:\n\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\`\nDone.`;
    const result = parsePeerOutput(markdown);
    expect(result).not.toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parsePeerOutput('not json')).toBeNull();
  });

  it('should handle Gemini envelope', () => {
    const envelope = JSON.stringify({
      session_id: 'abc',
      response: '```json\n' + JSON.stringify(validOutput) + '\n```',
    });
    const result = parsePeerOutput(envelope);
    expect(result).not.toBeNull();
  });

  it('should normalize missing optional arrays', () => {
    const partial = { responder: 'codex', answer: 'test', confidence: 0.5 };
    const result = parsePeerOutput(JSON.stringify(partial));
    expect(result).not.toBeNull();
    expect(result!.key_points).toEqual([]);
    expect(result!.suggested_actions).toEqual([]);
    expect(result!.file_references).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npm test -- --filter="schema"`
Expected: FAIL — `PeerOutput`, `PeerInputSchema`, `getPeerOutputJsonSchema`, `parsePeerOutput` are not exported from `schema.ts`

**Step 3: Write the implementation**

Add to `mcp-server/src/schema.ts` (append before EOF, after the `parseLegacyMarkdownOutput` function at line 544):

```typescript
// =============================================================================
// PEER OUTPUT SCHEMA (General-purpose coworker responses)
// =============================================================================

export const SuggestedAction = z.object({
  action: z.string().describe('What to do'),
  priority: z.enum(['high', 'medium', 'low']),
  file: z.string().optional().describe('Relevant file path'),
  rationale: z.string().describe('Why this action is recommended'),
});
export type SuggestedAction = z.infer<typeof SuggestedAction>;

export const FileReference = z.object({
  path: z.string().describe('Relative file path'),
  lines: z.string().optional().describe('Line range, e.g. "10-25"'),
  relevance: z.string().describe('Why this file matters'),
});
export type FileReference = z.infer<typeof FileReference>;

export const PeerOutput = z.object({
  responder: z.string().describe('"codex" or "gemini"'),
  timestamp: z.string().optional(),

  // Core response
  answer: z.string().describe('Main response text (markdown)'),
  confidence: ConfidenceScore.describe('Confidence in the response (0-1)'),

  // Structured breakdown
  key_points: z.array(z.string()).describe('Bullet summary of main points'),

  // Actionable items
  suggested_actions: z.array(SuggestedAction).describe('Recommended actions'),

  // File references
  file_references: z.array(FileReference).describe('Files examined by the peer'),

  // Optional
  alternatives: z.array(Alternative).optional().describe('Alternative approaches'),
  execution_notes: z.string().optional().describe('Notes about the process'),
});
export type PeerOutput = z.infer<typeof PeerOutput>;

// =============================================================================
// PEER INPUT SCHEMA
// =============================================================================

export const TaskType = z.enum(['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general']);
export type TaskType = z.infer<typeof TaskType>;

export const PeerInputSchema = z.object({
  workingDir: z.string().describe('Working directory for filesystem access'),
  prompt: z.string().describe('The question or request from CC'),
  taskType: TaskType.optional().describe('Hint about the type of task'),
  relevantFiles: z.array(z.string()).optional().describe('Files the peer should focus on'),
  context: z.string().optional().describe('Additional context (error messages, prior analysis)'),
  focusAreas: z.array(z.enum([
    'security', 'performance', 'architecture', 'correctness',
    'maintainability', 'scalability', 'testing', 'documentation'
  ])).optional().describe('Areas to focus on'),
  customPrompt: z.string().optional().describe('Additional instructions for the peer'),
});
export type PeerInput = z.infer<typeof PeerInputSchema>;

// =============================================================================
// PEER OUTPUT JSON SCHEMA (for embedding in prompts)
// =============================================================================

export function getPeerOutputJsonSchema(): object {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['responder', 'answer', 'confidence', 'key_points', 'suggested_actions', 'file_references'],
    properties: {
      responder: { type: 'string' },
      timestamp: { type: 'string' },
      answer: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      key_points: {
        type: 'array',
        items: { type: 'string' },
      },
      suggested_actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['action', 'priority', 'rationale'],
          properties: {
            action: { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            file: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
      file_references: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path', 'relevance'],
          properties: {
            path: { type: 'string' },
            lines: { type: 'string' },
            relevance: { type: 'string' },
          },
        },
      },
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['topic', 'current_approach', 'alternative', 'tradeoffs', 'recommendation'],
          properties: {
            topic: { type: 'string' },
            current_approach: { type: 'string' },
            alternative: { type: 'string' },
            tradeoffs: {
              type: 'object',
              additionalProperties: false,
              required: ['pros', 'cons'],
              properties: {
                pros: { type: 'array', items: { type: 'string' } },
                cons: { type: 'array', items: { type: 'string' } },
              },
            },
            recommendation: { type: 'string', enum: ['strongly_prefer', 'consider', 'situational', 'informational'] },
          },
        },
      },
      execution_notes: { type: 'string' },
    },
  };
}

// =============================================================================
// PEER OUTPUT PARSING
// =============================================================================

function normalizePeerOutput(parsed: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...parsed };

  if (!normalized.responder) {
    normalized.responder = 'external';
  }

  // Default missing arrays
  normalized.key_points = normalized.key_points ?? [];
  normalized.suggested_actions = normalized.suggested_actions ?? [];
  normalized.file_references = normalized.file_references ?? [];

  // Default confidence
  if (normalized.confidence === undefined) {
    normalized.confidence = 0.5;
  }

  // Default answer
  if (!normalized.answer && typeof normalized.response === 'string') {
    normalized.answer = normalized.response;
  }

  return normalized;
}

export function parsePeerOutput(rawOutput: string): PeerOutput | null {
  try {
    let jsonStr = rawOutput;

    // Unwrap Gemini envelope
    try {
      const envelope = JSON.parse(rawOutput);
      if (envelope && typeof envelope.session_id === 'string' && typeof envelope.response === 'string') {
        jsonStr = envelope.response;
      }
    } catch {
      // Not an envelope
    }

    // Extract from ```json ... ``` blocks
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    // Find JSON object boundaries
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Try direct parse
    const result = PeerOutput.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    // Normalize and retry
    const recognizedFields = ['responder', 'answer', 'response', 'key_points', 'suggested_actions', 'file_references', 'confidence'];
    const hasRecognizedField = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) &&
      recognizedFields.some(f => f in parsed);
    if (!hasRecognizedField) {
      return null;
    }

    const normalized = normalizePeerOutput(parsed);
    const retryResult = PeerOutput.safeParse(normalized);
    if (retryResult.success) {
      return retryResult.data;
    }

    return null;
  } catch {
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="schema"`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add mcp-server/src/schema.ts mcp-server/src/__tests__/schema.test.ts
git commit -m "feat: add PeerOutput and PeerInput schemas for ask tools"
```

---

### Task 2: Add PeerRequest/PeerResult Types and Adapter Interface

**Files:**
- Modify: `mcp-server/src/types.ts` (add `TaskType` type)
- Modify: `mcp-server/src/adapters/base.ts` (add `PeerRequest`, `PeerResult`, extend `ReviewerAdapter`)

**Step 1: Write the failing test**

No separate test file needed — the types are validated implicitly by Task 3 (adapter implementations) and Task 5 (handler tests). We'll verify via `npm run build` (TypeScript compiler).

**Step 2: Add TaskType to types.ts**

Append to `mcp-server/src/types.ts` (after line 23, the `ReasoningEffort` type):

```typescript
// Task types for peer ask tools
export type TaskType = 'plan' | 'debug' | 'explain' | 'question' | 'fix' | 'explore' | 'general';
```

**Step 3: Add PeerRequest, PeerResult, and extend ReviewerAdapter in base.ts**

Add the following to `mcp-server/src/adapters/base.ts`:

After the `ReviewRequest` interface (after line 70), add:

```typescript
// =============================================================================
// PEER REQUEST (General-purpose coworker tasks)
// =============================================================================

export interface PeerRequest {
  /** Working directory containing the code */
  workingDir: string;

  /** The question or request from CC */
  prompt: string;

  /** Hint about the type of task */
  taskType?: TaskType;

  /** Files the peer should focus on */
  relevantFiles?: string[];

  /** Additional context (error messages, prior analysis) */
  context?: string;

  /** Areas to focus on */
  focusAreas?: FocusArea[];

  /** Custom instructions from the user */
  customPrompt?: string;

  /** Reasoning effort level (for models that support it) */
  reasoningEffort?: ReasoningEffort;
}
```

Add `PeerOutput` import at the top of `base.ts` (line 9):

```typescript
import { ReviewOutput, ReviewFinding, PeerOutput } from '../schema.js';
```

Add `TaskType` to the import from `types.js` (line 10):

```typescript
import { FocusArea, OutputType, ReasoningEffort, TaskType } from '../types.js';
```

After `ReviewResult` (after line 290), add:

```typescript
// =============================================================================
// PEER RESULT
// =============================================================================

export interface PeerSuccess {
  success: true;
  output: PeerOutput;
  rawOutput?: string;
  executionTimeMs: number;
}

export interface PeerFailure {
  success: false;
  error: ReviewError; // Reuse same error type
  suggestion?: string;
  rawOutput?: string;
  executionTimeMs: number;
}

export type PeerResult = PeerSuccess | PeerFailure;
```

Add `runPeerRequest` to the `ReviewerAdapter` interface (after `runReview` at line 317):

```typescript
  /** Run a general-purpose peer request and return structured output */
  runPeerRequest(request: PeerRequest): Promise<PeerResult>;
```

**Step 4: Build to verify types compile**

Run: `cd mcp-server && npm run build`
Expected: FAIL — adapters don't implement `runPeerRequest` yet (that's Task 3)

**Step 5: Commit**

```bash
git add mcp-server/src/types.ts mcp-server/src/adapters/base.ts
git commit -m "feat: add PeerRequest/PeerResult types and extend adapter interface"
```

---

### Task 3: Add buildPeerPrompt to Handoff Module

**Files:**
- Modify: `mcp-server/src/handoff.ts` (add `buildPeerPrompt` function)

**Step 1: Write failing test**

Type-checked at compile time + integration-tested in Task 6. No dedicated unit test needed for a prompt builder (it returns a string).

**Step 2: Implement buildPeerPrompt**

Add to `mcp-server/src/handoff.ts` after `enhanceHandoff` (after line 557, before EOF):

```typescript
// =============================================================================
// PEER PROMPT BUILDER (General-purpose coworker requests)
// =============================================================================

export interface PeerPromptOptions {
  workingDir: string;
  prompt: string;
  taskType?: string;
  relevantFiles?: string[];
  context?: string;
  focusAreas?: FocusArea[];
  customInstructions?: string;
  outputFormat: 'json';
}

/**
 * Build a prompt for general-purpose peer assistance (not review).
 * The peer acts as a collaborative coworker, not a critic.
 */
export function buildPeerPrompt(options: PeerPromptOptions): string {
  const { workingDir, prompt, taskType, relevantFiles, context, focusAreas, customInstructions } = options;

  // Select role based on focus areas (reuse existing role selection)
  const role = selectRole(focusAreas);

  const sections: string[] = [];

  // SECTION 1: ROLE (adapted from review role)
  sections.push(`# ROLE: ${role.name} — Peer Engineer

${role.systemPrompt}

You are acting as a collaborative peer engineer, NOT a reviewer.
Your job is to help Claude Code (CC) with whatever it needs:
planning, debugging, explaining, fixing, exploring, or answering questions.
Be direct, specific, and actionable.`);

  // SECTION 2: TASK
  const taskLabel = taskType ? ` [${taskType.toUpperCase()}]` : '';
  sections.push(`
---

# YOUR TASK${taskLabel}

**Working Directory:** \`${workingDir}\`

**CC's Request:**
${prompt}
${context ? `\n**Additional Context:**\n${context}` : ''}`);

  // SECTION 3: RELEVANT FILES
  if (relevantFiles && relevantFiles.length > 0) {
    sections.push(`
---

# RELEVANT FILES

CC suggests focusing on these files:
${relevantFiles.map(f => `- \`${f}\``).join('\n')}

Read these files to understand the context. Also explore related files if needed.`);
  }

  // SECTION 4: FOCUS AREAS
  if (focusAreas && focusAreas.length > 0) {
    sections.push(`
---

# FOCUS AREAS

Prioritize these aspects: ${focusAreas.join(', ')}`);
  }

  // SECTION 5: CUSTOM INSTRUCTIONS
  if (customInstructions) {
    sections.push(`
---

# ADDITIONAL INSTRUCTIONS

${customInstructions}`);
  }

  // SECTION 6: HOW TO WORK
  sections.push(`
---

# HOW TO WORK

1. Read the relevant files in the working directory
2. Use \`git log --oneline -10\` and \`git diff\` if useful
3. Think through the problem step by step
4. Provide a clear, actionable answer
5. Reference specific files and line numbers
6. Suggest concrete next steps`);

  // SECTION 7: OUTPUT FORMAT
  sections.push(`
---

# OUTPUT FORMAT

Respond with valid JSON:

\`\`\`json
{
  "responder": "<your-name>",
  "answer": "Your detailed response in markdown",
  "confidence": 0.0-1.0,
  "key_points": ["Point 1", "Point 2"],
  "suggested_actions": [
    {
      "action": "What to do",
      "priority": "high|medium|low",
      "file": "path/to/file.ts",
      "rationale": "Why"
    }
  ],
  "file_references": [
    {
      "path": "path/to/file.ts",
      "lines": "10-25",
      "relevance": "Why this file matters"
    }
  ],
  "alternatives": [
    {
      "topic": "The decision point",
      "current_approach": "What exists now",
      "alternative": "Different approach",
      "tradeoffs": { "pros": ["..."], "cons": ["..."] },
      "recommendation": "strongly_prefer|consider|situational|informational"
    }
  ],
  "execution_notes": "Any notes about your process"
}
\`\`\`

**Rules:**
- Read files before making claims
- Reference specific file paths and line numbers
- Be concrete and actionable — no vague suggestions
- Confidence reflects how sure YOU are about your answer
- Include alternatives when there are meaningful tradeoffs`);

  return sections.join('\n');
}
```

**Step 3: Build to verify compilation**

Run: `cd mcp-server && npm run build`
Expected: Compiles (but adapters still broken — that's Task 4)

**Step 4: Commit**

```bash
git add mcp-server/src/handoff.ts
git commit -m "feat: add buildPeerPrompt for general-purpose peer requests"
```

---

### Task 4: Implement runPeerRequest on Codex and Gemini Adapters

**Files:**
- Modify: `mcp-server/src/adapters/codex.ts` (add `runPeerRequest` method)
- Modify: `mcp-server/src/adapters/gemini.ts` (add `runPeerRequest` method)

**Step 1: Implement on CodexAdapter**

Add `PeerRequest`, `PeerResult` to imports from `./base.js` in `codex.ts` (line 17):

```typescript
import {
  ReviewerAdapter,
  ReviewerCapabilities,
  ReviewRequest,
  ReviewResult,
  ReviewError,
  PeerRequest,
  PeerResult,
  registerAdapter,
  EXPERT_ROLES,
} from './base.js';
```

Add `PeerOutput, parsePeerOutput, getPeerOutputJsonSchema` to import from `../schema.js` (line 21):

```typescript
import { ReviewOutput, parseReviewOutput, parseLegacyMarkdownOutput, getReviewOutputJsonSchema, PeerOutput, parsePeerOutput, getPeerOutputJsonSchema } from '../schema.js';
```

Add `buildPeerPrompt` to import from `../handoff.js` (line 23):

```typescript
import {
  buildSimpleHandoff,
  buildHandoffPrompt,
  buildPeerPrompt,
  selectRole,
  FocusArea,
} from '../handoff.js';
```

Add `runPeerRequest` method to `CodexAdapter` class (after `runReview` method, around line 98):

```typescript
  async runPeerRequest(request: PeerRequest): Promise<PeerResult> {
    const startTime = Date.now();

    if (!existsSync(request.workingDir)) {
      return {
        success: false,
        error: {
          type: 'cli_error',
          message: `Working directory does not exist: ${request.workingDir}`,
        },
        suggestion: 'Check that the working directory path is correct',
        executionTimeMs: Date.now() - startTime,
      };
    }

    return this.runPeerWithRetry(request, 0, startTime);
  }

  private async runPeerWithRetry(
    request: PeerRequest,
    attempt: number,
    startTime: number,
    previousError?: string,
    previousOutput?: string
  ): Promise<PeerResult> {
    try {
      let prompt = buildPeerPrompt({
        workingDir: request.workingDir,
        prompt: request.prompt,
        taskType: request.taskType,
        relevantFiles: request.relevantFiles,
        context: request.context,
        focusAreas: request.focusAreas,
        customInstructions: request.customPrompt,
        outputFormat: 'json',
      });

      if (attempt > 0) {
        prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
          `Previous output had issues: ${previousError}\n` +
          `Please fix these issues and provide valid JSON output.\n` +
          (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
      }

      const result = await this.runCli(prompt, request.workingDir, request.reasoningEffort || 'high');

      if (result.exitCode !== 0) {
        const error = this.categorizeError(result.stderr);
        return {
          success: false,
          error,
          suggestion: this.getSuggestion(error),
          rawOutput: result.stderr,
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (result.truncated) {
        return {
          success: false,
          error: { type: 'cli_error', message: 'Output exceeded maximum buffer size (1MB)' },
          suggestion: 'Try a more focused request',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const output = parsePeerOutput(result.stdout);

      if (!output) {
        if (attempt < MAX_RETRIES) {
          return this.runPeerWithRetry(request, attempt + 1, startTime,
            'Output did not match expected JSON schema', result.stdout);
        }
        return {
          success: false,
          error: { type: 'parse_error', message: 'Failed to parse peer output after retries',
            details: { rawOutput: result.stdout.slice(0, 1000) } },
          suggestion: 'The model may not be following the output format.',
          rawOutput: result.stdout,
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        output,
        rawOutput: result.stdout,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT') {
        return { success: false, error: { type: 'cli_not_found', message: 'Codex CLI not found' },
          suggestion: 'Install with: npm install -g @openai/codex', executionTimeMs: Date.now() - startTime };
      }
      if (err.message === 'TIMEOUT') {
        return { success: false, error: { type: 'timeout', message: 'No output for 2 minutes' },
          suggestion: 'Try a simpler request', executionTimeMs: Date.now() - startTime };
      }
      if (err.message === 'MAX_TIMEOUT') {
        return { success: false, error: { type: 'timeout', message: 'Task exceeded 60 minute maximum' },
          suggestion: 'Try a smaller scope', executionTimeMs: Date.now() - startTime };
      }
      return { success: false, error: { type: 'cli_error', message: err.message },
        executionTimeMs: Date.now() - startTime };
    }
  }
```

**Step 2: Implement on GeminiAdapter**

Same pattern. Add `PeerRequest`, `PeerResult` to imports from `./base.js` in `gemini.ts`. Add `parsePeerOutput` to import from `../schema.js`. Add `buildPeerPrompt` to import from `../handoff.js`.

Add `runPeerRequest` and `runPeerWithRetry` to `GeminiAdapter` (same shape as Codex but uses `this.runCli(prompt, request.workingDir)` without `reasoningEffort`):

```typescript
  async runPeerRequest(request: PeerRequest): Promise<PeerResult> {
    const startTime = Date.now();

    if (!existsSync(request.workingDir)) {
      return {
        success: false,
        error: { type: 'cli_error', message: `Working directory does not exist: ${request.workingDir}` },
        suggestion: 'Check that the working directory path is correct',
        executionTimeMs: Date.now() - startTime,
      };
    }

    return this.runPeerWithRetry(request, 0, startTime);
  }

  private async runPeerWithRetry(
    request: PeerRequest,
    attempt: number,
    startTime: number,
    previousError?: string,
    previousOutput?: string
  ): Promise<PeerResult> {
    try {
      let prompt = buildPeerPrompt({
        workingDir: request.workingDir,
        prompt: request.prompt,
        taskType: request.taskType,
        relevantFiles: request.relevantFiles,
        context: request.context,
        focusAreas: request.focusAreas,
        customInstructions: request.customPrompt,
        outputFormat: 'json',
      });

      if (attempt > 0) {
        prompt += `\n\n---\n\n# RETRY ATTEMPT ${attempt + 1}\n\n` +
          `Previous output had issues: ${previousError}\n` +
          `Please fix these issues and provide valid JSON output.\n` +
          (previousOutput ? `\nPrevious output (for reference):\n${previousOutput.slice(0, 500)}...` : '');
      }

      const result = await this.runCli(prompt, request.workingDir);

      if (result.exitCode !== 0) {
        const error = this.categorizeError(result.stderr);
        return {
          success: false, error,
          suggestion: this.getSuggestion(error),
          rawOutput: result.stderr,
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (result.truncated) {
        return {
          success: false,
          error: { type: 'cli_error', message: 'Output exceeded maximum buffer size (1MB)' },
          suggestion: 'Try a more focused request',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const output = parsePeerOutput(result.stdout);

      if (!output) {
        if (attempt < MAX_RETRIES) {
          return this.runPeerWithRetry(request, attempt + 1, startTime,
            'Output did not match expected JSON schema', result.stdout);
        }
        return {
          success: false,
          error: { type: 'parse_error', message: 'Failed to parse peer output after retries',
            details: { rawOutput: result.stdout.slice(0, 1000) } },
          suggestion: 'The model may not be following the output format.',
          rawOutput: result.stdout,
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: true, output,
        rawOutput: result.stdout,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT') {
        return { success: false, error: { type: 'cli_not_found', message: 'Gemini CLI not found' },
          suggestion: 'Install with: npm install -g @google/gemini-cli', executionTimeMs: Date.now() - startTime };
      }
      if (err.message === 'TIMEOUT') {
        return { success: false, error: { type: 'timeout', message: 'No output for 10 minutes' },
          suggestion: 'Try a simpler request', executionTimeMs: Date.now() - startTime };
      }
      if (err.message === 'MAX_TIMEOUT') {
        return { success: false, error: { type: 'timeout', message: 'Task exceeded 60 minute maximum' },
          suggestion: 'Try a smaller scope', executionTimeMs: Date.now() - startTime };
      }
      return { success: false, error: { type: 'cli_error', message: err.message },
        executionTimeMs: Date.now() - startTime };
    }
  }
```

**Step 3: Build to verify compilation**

Run: `cd mcp-server && npm run build`
Expected: PASS — all types align, project compiles

**Step 4: Run existing tests to verify no regressions**

Run: `cd mcp-server && npm test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add mcp-server/src/adapters/codex.ts mcp-server/src/adapters/gemini.ts
git commit -m "feat: implement runPeerRequest on Codex and Gemini adapters"
```

---

### Task 5: Create Tool Handlers and Definitions (tools/peer.ts)

**Files:**
- Create: `mcp-server/src/tools/peer.ts`
- Test: `mcp-server/src/__tests__/peer.test.ts`

**Step 1: Write failing tests**

Create `mcp-server/src/__tests__/peer.test.ts`:

```typescript
/**
 * Tests for peer tool handlers
 */

import { describe, it, expect } from 'vitest';

import {
  PeerInputSchema,
  PeerOutput,
  getPeerOutputJsonSchema,
  parsePeerOutput,
} from '../schema.js';
import { PEER_TOOL_DEFINITIONS } from '../tools/peer.js';

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
  // Import after module loads
  let formatPeerResponse: (result: any, modelName: string) => string;

  it('should format successful response', async () => {
    const mod = await import('../tools/peer.js');
    formatPeerResponse = mod.formatPeerResponse;

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

  it('should format error response', async () => {
    const mod = await import('../tools/peer.js');
    formatPeerResponse = mod.formatPeerResponse;

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
});
```

**Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npm test -- --filter="peer"`
Expected: FAIL — `tools/peer.ts` doesn't exist

**Step 3: Create tools/peer.ts**

Create `mcp-server/src/tools/peer.ts`:

```typescript
/**
 * MCP Peer Tool Implementations
 *
 * General-purpose coworker tools:
 * 1. ask_codex - Ask Codex for help
 * 2. ask_gemini - Ask Gemini for help
 * 3. ask_multi - Ask both in parallel
 */

import { FocusArea } from '../types.js';
import {
  PeerRequest,
  PeerResult,
  getAdapter,
  getAvailableAdapters,
  selectExpertRole,
} from '../adapters/index.js';
import { PeerInputSchema, PeerOutput } from '../schema.js';

export type PeerInput = {
  workingDir: string;
  prompt: string;
  taskType?: string;
  relevantFiles?: string[];
  context?: string;
  focusAreas?: string[];
  customPrompt?: string;
  reasoningEffort?: 'high' | 'xhigh';
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function toPeerRequest(input: PeerInput): PeerRequest {
  return {
    workingDir: input.workingDir,
    prompt: input.prompt,
    taskType: input.taskType as PeerRequest['taskType'],
    relevantFiles: input.relevantFiles,
    context: input.context,
    focusAreas: input.focusAreas as FocusArea[] | undefined,
    customPrompt: input.customPrompt,
    reasoningEffort: input.reasoningEffort,
  };
}

export function formatPeerResponse(result: PeerResult, modelName: string): string {
  if (!result.success) {
    return formatPeerErrorResponse(result.error, result.suggestion);
  }

  const output = result.output;
  const lines: string[] = [];

  lines.push(`## ${modelName} Response\n`);
  lines.push(`**Execution Time:** ${(result.executionTimeMs / 1000).toFixed(1)}s`);
  lines.push(`**Confidence:** ${Math.round(output.confidence * 100)}%\n`);

  // Main answer
  lines.push(`### Answer\n`);
  lines.push(output.answer);
  lines.push('');

  // Key points
  if (output.key_points.length > 0) {
    lines.push(`### Key Points\n`);
    for (const point of output.key_points) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  // Suggested actions
  if (output.suggested_actions.length > 0) {
    lines.push(`### Suggested Actions\n`);
    const priorityEmoji: Record<string, string> = {
      high: '🔴', medium: '🟡', low: '🟢',
    };
    for (const action of output.suggested_actions) {
      lines.push(`${priorityEmoji[action.priority] || '•'} **${action.action}**`);
      if (action.file) {
        lines.push(`  📍 ${action.file}`);
      }
      lines.push(`  ${action.rationale}`);
      lines.push('');
    }
  }

  // File references
  if (output.file_references.length > 0) {
    lines.push(`### Files Examined\n`);
    for (const ref of output.file_references) {
      const loc = ref.lines ? `${ref.path}:${ref.lines}` : ref.path;
      lines.push(`- \`${loc}\` — ${ref.relevance}`);
    }
    lines.push('');
  }

  // Alternatives
  if (output.alternatives && output.alternatives.length > 0) {
    lines.push(`### Alternatives\n`);
    for (const alt of output.alternatives) {
      lines.push(`**${alt.topic}**`);
      lines.push(`  Current: ${alt.current_approach}`);
      lines.push(`  Alternative: ${alt.alternative}`);
      lines.push(`  Recommendation: ${alt.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatPeerErrorResponse(error: { type: string; message: string }, suggestion?: string): string {
  const emoji: Record<string, string> = {
    cli_not_found: '❌',
    timeout: '⏱️',
    rate_limit: '🚫',
    auth_error: '🔐',
    parse_error: '⚠️',
    cli_error: '❌',
  };

  let response = `${emoji[error.type] || '❌'} **${error.type}**: ${error.message}`;

  if (suggestion) {
    response += `\n\n💡 ${suggestion}`;
  }

  return response;
}

// =============================================================================
// SINGLE MODEL HANDLERS
// =============================================================================

export async function handleAskCodex(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const adapter = getAdapter('codex');
  if (!adapter) {
    return { content: [{ type: 'text', text: '❌ Codex adapter not registered' }] };
  }

  const available = await adapter.isAvailable();
  if (!available) {
    return {
      content: [{
        type: 'text',
        text: '❌ Codex CLI not found.\n\nInstall with: npm install -g @openai/codex\n\nAlternative: Use ask_gemini instead'
      }]
    };
  }

  const request = toPeerRequest(input);
  const result = await adapter.runPeerRequest(request);

  return { content: [{ type: 'text', text: formatPeerResponse(result, 'Codex') }] };
}

export async function handleAskGemini(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const adapter = getAdapter('gemini');
  if (!adapter) {
    return { content: [{ type: 'text', text: '❌ Gemini adapter not registered' }] };
  }

  const available = await adapter.isAvailable();
  if (!available) {
    return {
      content: [{
        type: 'text',
        text: '❌ Gemini CLI not found.\n\nInstall with: npm install -g @google/gemini-cli\n\nAlternative: Use ask_codex instead'
      }]
    };
  }

  const request = toPeerRequest(input);
  const result = await adapter.runPeerRequest(request);

  return { content: [{ type: 'text', text: formatPeerResponse(result, 'Gemini') }] };
}

// =============================================================================
// MULTI-MODEL HANDLER
// =============================================================================

export async function handleAskMulti(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const request = toPeerRequest(input);
  const availableAdapters = await getAvailableAdapters();

  if (availableAdapters.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `❌ No AI CLIs found.\n\nInstall at least one:\n  - Codex: npm install -g @openai/codex\n  - Gemini: npm install -g @google/gemini-cli`
      }]
    };
  }

  const promises = availableAdapters.map(async (adapter) => {
    const result = await adapter.runPeerRequest(request);
    return { adapter, result };
  });

  const results = await Promise.all(promises);

  const successful: { model: string; output: PeerOutput }[] = [];
  const failed: { model: string; error: string }[] = [];

  for (const { adapter, result } of results) {
    if (result.success) {
      successful.push({ model: adapter.id, output: result.output });
    } else {
      failed.push({ model: adapter.id, error: result.error.message });
    }
  }

  const lines: string[] = [];

  if (failed.length === results.length) {
    lines.push('## Multi-Model Response ❌ All Failed\n');
  } else if (failed.length > 0) {
    lines.push('## Multi-Model Response ⚠️ Partial Success\n');
  } else {
    lines.push('## Multi-Model Response ✓\n');
  }

  lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')}`);
  lines.push('');

  for (const { model, output } of successful) {
    lines.push(`### ${model.charAt(0).toUpperCase() + model.slice(1)} Response\n`);
    lines.push(formatPeerResponse({ success: true, output, executionTimeMs: 0 }, model));
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('### Failures\n');
    for (const { model, error } of failed) {
      lines.push(`**${model}:** ${error}`);
    }
    lines.push('');
  }

  if (successful.length > 1) {
    lines.push(`---\n\n**Synthesis Instructions:**\n- Compare perspectives from each model\n- Note agreements and disagreements\n- Use your judgment to form a final answer`);
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const PEER_TOOL_DEFINITIONS = {
  ask_codex: {
    name: 'ask_codex',
    description: "Ask OpenAI Codex CLI for help as a peer engineer. Use for planning, debugging, explaining, fixing, exploring, or answering questions. Codex excels at correctness, logic, and edge cases.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
        reasoningEffort: {
          type: 'string',
          enum: ['high', 'xhigh'],
          description: 'Codex reasoning effort (default: high)',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
  ask_gemini: {
    name: 'ask_gemini',
    description: "Ask Google Gemini CLI for help as a peer engineer. Use for planning, debugging, explaining, fixing, exploring, or answering questions. Gemini excels at architecture, patterns, and scalability.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
  ask_multi: {
    name: 'ask_multi',
    description: "Ask both Codex and Gemini CLIs for help in parallel. Get multiple perspectives on planning, debugging, explaining, or any task. Synthesize the responses yourself.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="peer"`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add mcp-server/src/tools/peer.ts mcp-server/src/__tests__/peer.test.ts
git commit -m "feat: add peer tool handlers and definitions for ask_codex/gemini/multi"
```

---

### Task 6: Register Tools in MCP Server (index.ts)

**Files:**
- Modify: `mcp-server/src/index.ts`

**Step 1: Add imports**

Add after the existing feedback imports (line 32):

```typescript
import {
  handleAskCodex,
  handleAskGemini,
  handleAskMulti,
  PEER_TOOL_DEFINITIONS,
} from './tools/peer.js';
import { PeerInputSchema } from './schema.js';
```

**Step 2: Register tools in ListTools handler**

Modify the `ListToolsRequestSchema` handler (line 65-73) to include peer tools:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      TOOL_DEFINITIONS.codex_review,
      TOOL_DEFINITIONS.gemini_review,
      TOOL_DEFINITIONS.multi_review,
      PEER_TOOL_DEFINITIONS.ask_codex,
      PEER_TOOL_DEFINITIONS.ask_gemini,
      PEER_TOOL_DEFINITIONS.ask_multi,
    ],
  };
});
```

**Step 3: Add case handlers in CallTool**

Add cases to the `switch` in the `CallToolRequestSchema` handler (after `case 'multi_review'` around line 94):

```typescript
      case 'ask_codex': {
        const input = PeerInputSchema.parse(args);
        return await handleAskCodex(input);
      }

      case 'ask_gemini': {
        const input = PeerInputSchema.parse(args);
        return await handleAskGemini(input);
      }

      case 'ask_multi': {
        const input = PeerInputSchema.parse(args);
        return await handleAskMulti(input);
      }
```

**Step 4: Build to verify compilation**

Run: `cd mcp-server && npm run build`
Expected: PASS

**Step 5: Run all tests**

Run: `cd mcp-server && npm test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: register ask_codex, ask_gemini, ask_multi tools in MCP server"
```

---

### Task 7: Create Slash Commands

**Files:**
- Create: `mcp-server/commands/ask-codex.md`
- Create: `mcp-server/commands/ask-gemini.md`
- Create: `mcp-server/commands/ask-multi.md`

**Step 1: Create ask-codex.md**

```markdown
# Ask Codex

Ask OpenAI Codex CLI for help as a peer engineer.

## Arguments
- `$ARGUMENTS` - Your question or request

## Codex Strengths
- **Correctness**: Logic errors, edge cases, bugs
- **Performance**: Efficiency, complexity analysis
- **Security**: Vulnerability detection

## Tool Invocation

Call `ask_codex` with:

```json
{
  "workingDir": "<current directory>",
  "prompt": "<your question or request from $ARGUMENTS>",
  "taskType": "<infer from request: plan|debug|explain|question|fix|explore|general>",
  "relevantFiles": ["<files related to the question>"],
  "context": "<any error messages or prior analysis>"
}
```

## After Receiving Response

1. **Read the answer** and key points
2. **Check file references** — verify they exist
3. **Evaluate suggested actions** — do they make sense?
4. **Apply your judgment** — you may disagree
5. **Act on the suggestions** or ask follow-up questions

$ARGUMENTS
```

**Step 2: Create ask-gemini.md**

```markdown
# Ask Gemini

Ask Google Gemini CLI for help as a peer engineer.

## Arguments
- `$ARGUMENTS` - Your question or request

## Gemini Strengths
- **Architecture**: Design patterns, structure
- **Scalability**: Load handling, bottlenecks
- **Maintainability**: Code clarity, tech debt

## Tool Invocation

Call `ask_gemini` with:

```json
{
  "workingDir": "<current directory>",
  "prompt": "<your question or request from $ARGUMENTS>",
  "taskType": "<infer from request: plan|debug|explain|question|fix|explore|general>",
  "relevantFiles": ["<files related to the question>"],
  "context": "<any error messages or prior analysis>"
}
```

## After Receiving Response

1. **Read the answer** and key points
2. **Check file references** — verify they exist
3. **Evaluate suggested actions** — do they make sense?
4. **Apply your judgment** — you may disagree
5. **Act on the suggestions** or ask follow-up questions

$ARGUMENTS
```

**Step 3: Create ask-multi.md**

```markdown
# Ask Multi

Ask both Codex and Gemini for help in parallel — get multiple perspectives.

## Arguments
- `$ARGUMENTS` - Your question or request

## When to Use

Use `/ask-multi` when you want perspectives from both models on the same question.

## Tool Invocation

Call `ask_multi` with:

```json
{
  "workingDir": "<current directory>",
  "prompt": "<your question or request from $ARGUMENTS>",
  "taskType": "<infer from request: plan|debug|explain|question|fix|explore|general>",
  "relevantFiles": ["<files related to the question>"],
  "context": "<any error messages or prior analysis>"
}
```

## After Receiving Responses

You will receive separate responses from each model.

### Synthesize

1. **Find agreements** — both models say the same thing (higher confidence)
2. **Identify conflicts** — they disagree (YOU decide who's right)
3. **Note unique insights** — findings only one model provided
4. **Verify file references** — check they exist
5. **Make YOUR recommendation** — don't just relay, apply judgment

$ARGUMENTS
```

**Step 4: Verify commands will be auto-installed**

Run: `cd mcp-server && npm run build && node dist/index.js --setup`
Expected: Output shows 6 installed slash commands (codex, gemini, multi, ask-codex, ask-gemini, ask-multi)

**Step 5: Commit**

```bash
git add mcp-server/commands/ask-codex.md mcp-server/commands/ask-gemini.md mcp-server/commands/ask-multi.md
git commit -m "feat: add slash commands for ask-codex, ask-gemini, ask-multi"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Architecture section**

Add the new tools to the architecture documentation in `CLAUDE.md`. After the existing tool descriptions, add:

```markdown
- `tools/peer.ts` - Peer tool implementations (`handleAskCodex`, `handleAskGemini`, `handleAskMulti`) and `PEER_TOOL_DEFINITIONS`
```

Update the Core Flow to mention peer tools alongside review tools.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with peer ask tools documentation"
```

---

### Task 9: Final Integration Test

**Step 1: Build everything**

Run: `cd mcp-server && npm run build`
Expected: PASS — clean compilation

**Step 2: Run full test suite**

Run: `cd mcp-server && npm test`
Expected: ALL PASS

**Step 3: Run lint and typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: PASS

**Step 4: Verify tool listing**

Run: `cd mcp-server && node -e "import('./dist/tools/peer.js').then(m => console.log(Object.keys(m.PEER_TOOL_DEFINITIONS)))"`
Expected: `['ask_codex', 'ask_gemini', 'ask_multi']`

**Step 5: Verify slash command installation**

Run: `cd mcp-server && node dist/index.js --setup`
Expected: 6 commands installed

---

## Dependency Graph

```
Task 1 (schemas) ─────┐
                       ├── Task 4 (adapter impls) ── Task 5 (tool handlers) ── Task 6 (index.ts) ── Task 7 (commands) ── Task 8 (docs) ── Task 9 (integration)
Task 2 (types/iface) ─┤
                       │
Task 3 (prompt builder)┘
```

Tasks 1, 2, 3 can run in parallel. Task 4 depends on all three. Tasks 5-9 are sequential.
