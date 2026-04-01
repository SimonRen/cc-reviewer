# Adversarial Challenge in `multi_review` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `multi_review` always run both standard and adversarial review passes across all available adapters in parallel (up to 6 concurrent reviews), with results presented in two separate sections.

**Architecture:** Add `reviewMode` field to `ReviewRequest`. Add `ADVERSARIAL_REVIEWER` role and `buildAdversarialHandoffPrompt()` to `handoff.ts`. Each adapter's `runReview()` checks `reviewMode` to pick the prompt builder. `handleMultiReview()` spawns 2 reviews per adapter via `Promise.all()`.

**Tech Stack:** TypeScript, Zod, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `mcp-server/src/adapters/base.ts` | Modify (line 46-70) | Add `reviewMode` to `ReviewRequest` |
| `mcp-server/src/handoff.ts` | Modify (add after line 201) | Add `ADVERSARIAL_REVIEWER` role + `buildAdversarialHandoffPrompt()` |
| `mcp-server/src/adapters/codex.ts` | Modify (lines 82-89) | Use adversarial prompt when `reviewMode === 'adversarial'` |
| `mcp-server/src/adapters/gemini.ts` | Modify (lines 79-86) | Use adversarial prompt when `reviewMode === 'adversarial'` |
| `mcp-server/src/adapters/claude.ts` | Modify (lines 87-94) | Use adversarial prompt when `reviewMode === 'adversarial'` |
| `mcp-server/src/tools/feedback.ts` | Modify (lines 109-140) | Spawn 2x parallel reviews, format two sections |
| `mcp-server/commands/multi-review.md` | Modify | Update description to reflect adversarial passes |
| `mcp-server/src/__tests__/handoff.test.ts` | Modify | Add tests for adversarial prompt |
| `mcp-server/src/__tests__/feedback.test.ts` | Create | Test multi-review double-spawn and formatting |

---

### Task 1: Add `reviewMode` to `ReviewRequest`

**Files:**
- Modify: `mcp-server/src/adapters/base.ts:46-70`

- [ ] **Step 1: Add `reviewMode` field to `ReviewRequest` interface**

In `mcp-server/src/adapters/base.ts`, add the field after `serviceTier` (line 69):

```typescript
  /** Review mode: standard finds bugs, adversarial challenges assumptions */
  reviewMode?: 'standard' | 'adversarial';
```

- [ ] **Step 2: Verify build**

Run: `cd mcp-server && npm run build`
Expected: Clean compilation (new optional field is backwards-compatible)

- [ ] **Step 3: Run existing tests**

Run: `cd mcp-server && npm test`
Expected: All existing tests pass (optional field, no breakage)

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/adapters/base.ts
git commit -m "feat: add reviewMode to ReviewRequest interface"
```

---

### Task 2: Add adversarial reviewer role and prompt builder

**Files:**
- Modify: `mcp-server/src/handoff.ts` (add after line 201)
- Test: `mcp-server/src/__tests__/handoff.test.ts`

- [ ] **Step 1: Write failing tests for adversarial prompt**

Add to `mcp-server/src/__tests__/handoff.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildHandoffPrompt,
  buildAdversarialHandoffPrompt,
  ADVERSARIAL_REVIEWER,
  Handoff,
} from '../handoff.js';

// ... existing tests stay unchanged ...

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npm test -- --filter="handoff"`
Expected: FAIL — `buildAdversarialHandoffPrompt` and `ADVERSARIAL_REVIEWER` not found

- [ ] **Step 3: Implement ADVERSARIAL_REVIEWER role and buildAdversarialHandoffPrompt**

In `mcp-server/src/handoff.ts`, add after the `selectRole` function (after line 201):

```typescript
// =============================================================================
// ADVERSARIAL REVIEWER — Challenge mode for multi_review
// =============================================================================

export const ADVERSARIAL_REVIEWER: ReviewerRole = {
  id: 'adversarial',
  name: 'Adversarial Reviewer',
  description: 'Actively tries to break confidence in the change — challenges assumptions, not just bugs',
  isGeneric: false,
  applicableFocusAreas: [],
  systemPrompt: `Senior staff engineer performing an adversarial review. Your job is to break confidence in the change, not to validate it.`,
};

/**
 * Build an adversarial handoff prompt with challenge-mode stance sections.
 * Same structure as buildHandoffPrompt but adds adversarial XML sections
 * and uses the ADVERSARIAL_REVIEWER role.
 */
export function buildAdversarialHandoffPrompt(options: PromptOptions): string {
  const { handoff } = options;
  const role = ADVERSARIAL_REVIEWER;

  const sections: string[] = [];

  // SECTION 1: ROLE
  sections.push(`# ROLE: ${role.name}\n\n${role.systemPrompt}`);

  // SECTION 2: ADVERSARIAL STANCE
  sections.push(`## ADVERSARIAL STANCE

<operating_stance>
Default to skepticism. Assume the change can fail in subtle, high-cost,
or user-visible ways until the evidence says otherwise. Do not give credit
for good intent, partial fixes, or likely follow-up work.
</operating_stance>

<attack_surface>
Prioritized failure categories:
1. Auth/permissions bypass
2. Data loss or corruption
3. Rollback safety
4. Race conditions / concurrency
5. Empty-state / null / timeout handling
6. Version skew / backwards compatibility
7. Observability gaps (missing logs, metrics, alerts)
</attack_surface>

<review_method>
Actively try to disprove the change. Look for violated invariants,
missing guards, unhandled failure paths. If the user supplied a focus area,
weight it heavily, but still report any other material issue you can defend.
</review_method>

<finding_bar>
Material findings only. Each must answer:
1. What can go wrong?
2. Why is this code path vulnerable?
3. What is the likely impact?
4. What concrete change would reduce the risk?
</finding_bar>

<calibration_rules>
Prefer one strong finding over several weak ones. If you cannot defend
a finding from the provided code, drop it.
</calibration_rules>

<grounding_rules>
Be aggressive, but stay grounded. Every finding must be defensible from
the repository context. No speculative findings. No "might be an issue"
without concrete evidence from the code.
</grounding_rules>`);

  // SECTION 3: TASK (same as standard)
  sections.push(`## YOUR TASK

Review code in \`${handoff.workingDir}\`.

**Summary:** ${handoff.summary}${handoff.confidence !== undefined && handoff.confidence < 0.9 ? `\n**CC Confidence:** ${Math.round(handoff.confidence * 100)}% — verify weak areas` : ''}

**IMPORTANT:**
- This is a READ-ONLY review. Do NOT create, modify, or delete any files. Only read files to verify claims.
- Do NOT assume a git repository exists. Do NOT run git commands. Read files directly from the filesystem.`);

  // SECTION 4: CC'S UNCERTAINTIES
  if (handoff.uncertainties && handoff.uncertainties.length > 0) {
    sections.push(`## CC'S UNCERTAINTIES

${handoff.uncertainties.map((u, i) => `### ${i + 1}. ${u.topic} ${u.severity === 'critical' ? '⚠️' : ''}
- **Question:** ${u.question}
${u.ccAssumption ? `- **CC assumed:** ${u.ccAssumption}` : ''}
${u.relevantFiles ? `- **Files:** ${u.relevantFiles.join(', ')}` : ''}`).join('\n\n')}`);
  }

  // SECTION 5: SPECIFIC QUESTIONS
  if (handoff.questions && handoff.questions.length > 0) {
    sections.push(`## QUESTIONS FROM CC

${handoff.questions.map((q, i) => `${i + 1}. **${q.question}**
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccGuess ? `CC Guess: ${q.ccGuess}` : ''}`).join('\n')}`);
  }

  // SECTION 6: DECISIONS TO EVALUATE
  if (handoff.decisions && handoff.decisions.length > 0) {
    sections.push(`## DECISIONS TO EVALUATE

${handoff.decisions.map((d, i) => `${i + 1}. **${d.decision}**
   Rationale: ${d.rationale}
   ${d.alternatives ? `Alternatives: ${d.alternatives.join(', ')}` : ''}`).join('\n')}`);
  }

  // SECTION 7: PRIORITY FILES
  if (handoff.priorityFiles && handoff.priorityFiles.length > 0) {
    sections.push(`## PRIORITY FILES\n\n${handoff.priorityFiles.map(f => `- \`${f}\``).join('\n')}`);
  }

  // SECTION 8: ADVERSARIAL FOCUS (customInstructions steers the challenge)
  if (handoff.customInstructions) {
    sections.push(`## ADVERSARIAL FOCUS\n\n${handoff.customInstructions}`);
  }

  return sections.join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="handoff"`
Expected: All tests pass including new adversarial tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/handoff.ts mcp-server/src/__tests__/handoff.test.ts
git commit -m "feat: add ADVERSARIAL_REVIEWER role and buildAdversarialHandoffPrompt"
```

---

### Task 3: Update adapters to support reviewMode

**Files:**
- Modify: `mcp-server/src/adapters/codex.ts:82-89`
- Modify: `mcp-server/src/adapters/gemini.ts:79-86`
- Modify: `mcp-server/src/adapters/claude.ts:87-94`

- [ ] **Step 1: Update Codex adapter**

In `mcp-server/src/adapters/codex.ts`, replace the prompt-building block in `runReview()` (lines 82-89):

Old:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const role = selectRole(request.focusAreas as FocusArea[] | undefined);
      const prompt = buildHandoffPrompt({ handoff, role });
```

New:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const prompt = request.reviewMode === 'adversarial'
        ? buildAdversarialHandoffPrompt({ handoff })
        : buildHandoffPrompt({ handoff, role: selectRole(request.focusAreas as FocusArea[] | undefined) });
```

Also add the import at the top of the file. Update the existing import from `../handoff.js` to include `buildAdversarialHandoffPrompt`:

```typescript
import { buildSimpleHandoff, buildHandoffPrompt, buildAdversarialHandoffPrompt, selectRole } from '../handoff.js';
```

- [ ] **Step 2: Update Gemini adapter**

Same change in `mcp-server/src/adapters/gemini.ts` (lines 79-86):

Old:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const role = selectRole(request.focusAreas as FocusArea[] | undefined);
      const prompt = buildHandoffPrompt({ handoff, role });
```

New:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const prompt = request.reviewMode === 'adversarial'
        ? buildAdversarialHandoffPrompt({ handoff })
        : buildHandoffPrompt({ handoff, role: selectRole(request.focusAreas as FocusArea[] | undefined) });
```

Also update the import from `../handoff.js` to include `buildAdversarialHandoffPrompt`.

- [ ] **Step 3: Update Claude adapter**

Same change in `mcp-server/src/adapters/claude.ts` (lines 87-94):

Old:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const role = selectRole(request.focusAreas as FocusArea[] | undefined);
      const prompt = buildHandoffPrompt({ handoff, role });
```

New:
```typescript
      const handoff = buildSimpleHandoff(
        request.workingDir, request.ccOutput,
        request.analyzedFiles, request.focusAreas, request.customPrompt
      );
      const prompt = request.reviewMode === 'adversarial'
        ? buildAdversarialHandoffPrompt({ handoff })
        : buildHandoffPrompt({ handoff, role: selectRole(request.focusAreas as FocusArea[] | undefined) });
```

Also update the import from `../handoff.js` to include `buildAdversarialHandoffPrompt`.

- [ ] **Step 4: Verify build**

Run: `cd mcp-server && npm run build`
Expected: Clean compilation

- [ ] **Step 5: Run all tests**

Run: `cd mcp-server && npm test`
Expected: All existing tests pass (adapters not unit-tested directly, but build confirms type safety)

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/adapters/codex.ts mcp-server/src/adapters/gemini.ts mcp-server/src/adapters/claude.ts
git commit -m "feat: adapters select prompt builder based on reviewMode"
```

---

### Task 4: Update `handleMultiReview` to spawn 2x parallel reviews

**Files:**
- Modify: `mcp-server/src/tools/feedback.ts:109-140`
- Create: `mcp-server/src/__tests__/feedback.test.ts`

- [ ] **Step 1: Write failing test for multi-review double-spawn**

Create `mcp-server/src/__tests__/feedback.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the adapters module before importing feedback
vi.mock('../adapters/index.js', () => {
  const makeAdapter = (id: string) => ({
    id,
    getCapabilities: () => ({ name: id.charAt(0).toUpperCase() + id.slice(1) }),
    isAvailable: vi.fn().mockResolvedValue(true),
    runReview: vi.fn().mockResolvedValue({
      success: true,
      output: `Review from ${id}`,
      executionTimeMs: 1000,
    }),
  });

  const codex = makeAdapter('codex');
  const gemini = makeAdapter('gemini');

  return {
    getAdapter: vi.fn((id: string) => ({ codex, gemini }[id])),
    getAvailableAdapters: vi.fn().mockResolvedValue([codex, gemini]),
    codex,
    gemini,
  };
});

import { handleMultiReview, ReviewInput } from '../tools/feedback.js';
import { getAvailableAdapters } from '../adapters/index.js';

describe('handleMultiReview with adversarial', () => {
  const input: ReviewInput = {
    workingDir: '/test/dir',
    ccOutput: 'Implemented feature X',
    outputType: 'analysis',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should spawn 2 reviews per adapter (standard + adversarial)', async () => {
    const adapters = await getAvailableAdapters();
    await handleMultiReview(input);

    // Each adapter should be called twice: once standard, once adversarial
    for (const adapter of adapters) {
      expect(adapter.runReview).toHaveBeenCalledTimes(2);

      const calls = (adapter.runReview as ReturnType<typeof vi.fn>).mock.calls;
      const modes = calls.map((c: any[]) => c[0].reviewMode);
      expect(modes).toContain(undefined); // standard (no reviewMode)
      expect(modes).toContain('adversarial');
    }
  });

  it('should format output with Standard and Challenge sections', async () => {
    const result = await handleMultiReview(input);
    const text = result.content[0].text;

    expect(text).toContain('## Standard Review Findings');
    expect(text).toContain('## Challenge Review Findings');
  });

  it('should label adversarial results with (Adversarial)', async () => {
    const result = await handleMultiReview(input);
    const text = result.content[0].text;

    expect(text).toContain('(Adversarial)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --filter="feedback"`
Expected: FAIL — current `handleMultiReview` only spawns 1 review per adapter

- [ ] **Step 3: Implement the updated handleMultiReview**

Replace `handleMultiReview` in `mcp-server/src/tools/feedback.ts` (lines 109-140):

```typescript
export async function handleMultiReview(input: ReviewInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const request = toReviewRequest(input);
  const availableAdapters = await getAvailableAdapters();

  if (availableAdapters.length === 0) {
    return { content: [{ type: 'text', text: '❌ No AI CLIs found.\n\nInstall at least one:\n  - Codex: npm install -g @openai/codex-cli\n  - Gemini: npm install -g @google/gemini-cli' }] };
  }

  // Spawn 2 reviews per adapter: standard + adversarial (all in parallel)
  const reviewPromises = availableAdapters.flatMap((adapter) => [
    adapter.runReview({ ...request }).then(result => ({ adapter, result, mode: 'standard' as const })),
    adapter.runReview({ ...request, reviewMode: 'adversarial' as const }).then(result => ({ adapter, result, mode: 'adversarial' as const })),
  ]);

  const results = await Promise.all(reviewPromises);

  const standardResults = results.filter(r => r.mode === 'standard');
  const adversarialResults = results.filter(r => r.mode === 'adversarial');

  const allStandardFailed = standardResults.every(r => !r.result.success);
  const allAdversarialFailed = adversarialResults.every(r => !r.result.success);
  const someFailed = results.some(r => !r.result.success);

  const lines: string[] = [];

  if (allStandardFailed && allAdversarialFailed) lines.push('## Multi-Model Review ❌ All Failed\n');
  else if (someFailed) lines.push('## Multi-Model Review ⚠️ Partial Success\n');
  else lines.push('## Multi-Model Review ✓\n');

  lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')} (standard + adversarial)\n`);

  // Standard section
  lines.push('## Standard Review Findings\n');
  for (const { adapter, result } of standardResults) {
    lines.push(formatResult(result, adapter.getCapabilities().name));
    lines.push('');
  }

  // Adversarial section
  lines.push('## Challenge Review Findings\n');
  for (const { adapter, result } of adversarialResults) {
    lines.push(formatResult(result, `${adapter.getCapabilities().name} (Adversarial)`));
    lines.push('');
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="feedback"`
Expected: All feedback tests pass

- [ ] **Step 5: Run full test suite**

Run: `cd mcp-server && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/tools/feedback.ts mcp-server/src/__tests__/feedback.test.ts
git commit -m "feat: multi_review spawns standard + adversarial passes in parallel"
```

---

### Task 5: Update `/multi-review` slash command

**Files:**
- Modify: `mcp-server/commands/multi-review.md`

- [ ] **Step 1: Update the slash command description**

Replace the full content of `mcp-server/commands/multi-review.md`:

```markdown
# Multi Review

Get parallel standard AND adversarial reviews from Codex, Gemini, and a fresh Claude (Opus) instance.

Each model runs twice: once as a standard reviewer (finding bugs, issues, improvements) and once as an adversarial challenger (breaking confidence in the change, questioning assumptions, targeting hidden failure paths).

Use `$ARGUMENTS` to steer the adversarial focus — e.g., "focus the challenge on race conditions and rollback safety".

## Arguments
- `$ARGUMENTS` - Optional: focus area, custom instructions, or adversarial steering

## When to Use

Use `/multi-review` when you want thorough parallel reviews from all available models. Every invocation includes both standard and adversarial passes — no flags needed.

## Examples

```
/multi-review
/multi-review focus the challenge on race conditions and rollback safety
/multi-review challenge whether this was the right caching and retry design
```

## Before Calling - PREPARE THE HANDOFF

### 1. Summarize What You Did (Brief!)
```
"Implemented caching layer for the product catalog API using Redis.
Added cache invalidation on product updates."
```

### 2. List Your Uncertainties
```
UNCERTAINTIES:
- "Is the cache TTL appropriate for this data?"
- "Does the invalidation handle all update scenarios?"
- "Is the Redis connection pooling configured correctly?"
```

### 3. Ask Specific Questions
```
QUESTIONS:
- "Should I use write-through or write-behind caching?"
- "Is there a race condition in the invalidation logic?"
```

## Tool Invocation

Call `multi_review` with:

```json
{
  "workingDir": "<current directory>",
  "ccOutput": "<structured handoff>",
  "outputType": "analysis",
  "focusAreas": ["<from $ARGUMENTS>"],
  "customPrompt": "<steering text from $ARGUMENTS for adversarial focus>"
}
```

### Service Tier (from $ARGUMENTS, applies to Codex only)
- If user says "fast mode", "fast", or "priority" → set `serviceTier: "fast"`
- If user says "flex", "cheap", or "budget" → set `serviceTier: "flex"`
- Otherwise → omit `serviceTier`

### Structure your ccOutput:

```
SUMMARY:
<what you did, 1-3 sentences>

UNCERTAINTIES (verify these):
1. <uncertainty>
2. <uncertainty>

QUESTIONS:
1. <question>

PRIORITY FILES:
- <file>
```

## After Receiving Review

You will receive two sections: **Standard Review Findings** and **Challenge Review Findings**.

### Synthesize

1. **Standard findings** — bugs, issues, improvements from each model
   - Find agreements across models (higher confidence)
   - Identify conflicts (YOU decide who's right)

2. **Challenge findings** — adversarial challenges from each model
   - These target assumptions and design decisions, not just bugs
   - Evaluate on merit — some challenges are speculative by design
   - Strong challenges with evidence deserve serious consideration

3. **Cross-reference** standard vs challenge findings
   - Standard + challenge agreement = high confidence issue
   - Challenge-only finding = investigate further before acting

4. **Verify all findings**
   - Check file/line references exist
   - Read actual code
   - Mark your confidence:
     - ✓✓ Verified
     - ✓ Plausible
     - ? Investigate
     - ✗ Rejected

5. **Make YOUR recommendation**
   - Don't just relay findings
   - Apply your judgment

$ARGUMENTS
```

- [ ] **Step 2: Verify the file is valid markdown**

Run: `cd mcp-server && cat commands/multi-review.md | head -5`
Expected: Shows the updated header

- [ ] **Step 3: Commit**

```bash
git add mcp-server/commands/multi-review.md
git commit -m "docs: update /multi-review command for adversarial passes"
```

---

### Task 6: Update `multi_review` tool description

**Files:**
- Modify: `mcp-server/src/tools/feedback.ts:197-213`

- [ ] **Step 1: Update the tool description in TOOL_DEFINITIONS**

In `mcp-server/src/tools/feedback.ts`, update the `multi_review` entry in `TOOL_DEFINITIONS` (line 197-213):

Old:
```typescript
  multi_review: {
    name: 'multi_review',
    description: "ONLY use when user explicitly requests '/multi-review' or 'review with all models'. Get parallel second-opinions from Codex, Gemini, and a fresh Claude (Opus) instance. Returns combined reviews for synthesis. DO NOT use for general 'review' requests.",
```

New:
```typescript
  multi_review: {
    name: 'multi_review',
    description: "ONLY use when user explicitly requests '/multi-review' or 'review with all models'. Get parallel standard AND adversarial reviews from all available models. Each model runs twice: standard (bugs/issues) + adversarial (challenge assumptions/design decisions). Use customPrompt to steer the adversarial focus. DO NOT use for general 'review' requests.",
```

- [ ] **Step 2: Build and test**

Run: `cd mcp-server && npm run build && npm test`
Expected: Clean build, all tests pass

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/tools/feedback.ts
git commit -m "docs: update multi_review tool description for adversarial"
```

---

### Task 7: Full integration verification

- [ ] **Step 1: Clean build from scratch**

Run: `cd mcp-server && rm -rf dist && npm run build`
Expected: Clean compilation with zero errors

- [ ] **Step 2: Run full test suite**

Run: `cd mcp-server && npm test`
Expected: All tests pass (existing + new handoff + new feedback tests)

- [ ] **Step 3: Verify slash command installs correctly**

Run: `cd mcp-server && node dist/index.js update 2>&1 | head -20`
Expected: Shows multi-review.md in installed list

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "feat: multi_review now runs standard + adversarial passes in parallel"
```
