# Adversarial Challenge in `multi_review` — Design Spec

**Date:** 2026-04-01
**Status:** Draft

## Summary

Enhance `multi_review` to always run both standard and adversarial review passes across all available adapters in parallel. A 3-adapter setup produces 6 concurrent reviews. Results are presented in two clearly separated sections: Standard Review Findings and Challenge Review Findings.

No new tools, no new parameters, no new slash commands. The adversarial pass is built into `multi_review` as default behavior.

## Motivation

Standard code review catches bugs, style issues, and known anti-patterns. But it tends toward agreement — reviewers validate the implementation rather than questioning whether it was the right approach. Adversarial review fills this gap by actively trying to disprove the change, targeting hidden assumptions, violated invariants, and unhandled failure paths.

Inspired by `openai/codex-plugin-cc`'s `/codex:adversarial-review`, which uses a purpose-built prompt that shifts from "find bugs" to "break confidence in the change."

## Design

### 1. Adversarial Handoff Prompt

A new function `buildAdversarialHandoffPrompt()` in `handoff.ts` that produces a prompt with these XML-structured sections:

```
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
missing guards, unhandled failure paths. If the user supplied a focus area
(via customPrompt), weight it heavily, but still report any other material
issue you can defend.
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
</grounding_rules>
```

The function signature mirrors `buildHandoffPrompt()` but selects a different role and injects the adversarial stance sections. It reuses the same `HandoffOptions` type — no new parameters needed.

**Role selection:** A new `ADVERSARIAL_REVIEWER` role in the roles map:
- Name: "Adversarial Reviewer"
- System prompt: "You are a senior staff engineer performing an adversarial review. Your job is to break confidence in the change, not to validate it."
- Priority: assumptions > invariants > failure paths > security > correctness

**Steering:** The existing `customPrompt` field (passed through as `customInstructions` in the handoff) serves as the free-text focus area. No new field needed.

### 2. Parallel Execution in `handleMultiReview`

Current behavior:
```
for each available adapter:
  spawn standard review  →  [results]
```

New behavior:
```
for each available adapter:
  spawn standard review      →  [standard results]
  spawn adversarial review   →  [challenge results]
await all in parallel
```

Implementation: In `handleMultiReview()` (`feedback.ts`), after collecting available adapters, build two review requests per adapter — one with the standard handoff prompt, one with the adversarial handoff prompt. Use `Promise.all()` to run all in parallel (same pattern as current multi-review, just doubled).

The adversarial review request is identical to the standard one except:
- Different handoff prompt (adversarial variant)
- A tag/label to identify it as a challenge review in results

### 3. Review Request Changes

Add an optional `reviewMode` field to the internal `ReviewRequest` type (NOT to the MCP tool schema — this is internal only):

```typescript
reviewMode?: 'standard' | 'adversarial';  // default: 'standard'
```

This field is used by the handoff prompt builder to select which prompt template to use. It does not appear in `ReviewInputSchema` or the MCP tool definition — the user never sets it. `handleMultiReview` sets it internally when spawning the parallel reviews.

### 4. Result Formatting

The `formatResult()` function (or a new `formatMultiResult()`) produces output with two sections:

```markdown
## Standard Review Findings

### Codex
[findings...]

### Gemini
[findings...]

### Claude
[findings...]

## Challenge Review Findings

### Codex (Adversarial)
[findings...]

### Gemini (Adversarial)
[findings...]

### Claude (Adversarial)
[findings...]
```

Each section includes the same structured output: findings, agreements, disagreements, alternatives, risk assessment. The adversarial section will naturally have more disagreements and fewer agreements due to the prompt posture.

### 5. Schema — No Changes

Adversarial reviews return the same `ReviewOutput` schema. The adversarial prompt shifts what the reviewer focuses on, but the output structure is identical. No new Zod schemas needed.

### 6. Pipeline/Verification — No Changes

Both standard and adversarial findings go through the same `verifyFinding()` pipeline. Adversarial findings with weak evidence get their confidence adjusted down, same as standard ones.

### 7. Slash Command Update

Update `commands/multi-review.md` to reflect the new behavior:
- Description mentions both standard and adversarial passes
- Note that `$ARGUMENTS` / `customPrompt` steers the adversarial focus
- Example: `/multi-review focus the challenge on race conditions and rollback safety`

### 8. Individual Review Tools — No Changes

`codex_review`, `gemini_review`, and `claude_review` remain standard-only. The adversarial pass is exclusive to `multi_review`.

## Files Changed

| File | Change |
|------|--------|
| `mcp-server/src/handoff.ts` | Add `ADVERSARIAL_REVIEWER` role, `buildAdversarialHandoffPrompt()` function |
| `mcp-server/src/tools/feedback.ts` | Update `handleMultiReview()` to spawn 2x parallel reviews, update result formatting |
| `mcp-server/src/types.ts` | Add `reviewMode` to `ReviewRequest` type |
| `mcp-server/commands/multi-review.md` | Update description and examples |

## Files NOT Changed

| File | Why |
|------|-----|
| `schema.ts` | Same output schema for both modes |
| `pipeline.ts` | Same verification for both modes |
| `adapters/*.ts` | No adapter changes — prompt handles the posture |
| `index.ts` | No new tools registered |
| `commands.ts` | No new commands to install |
| `context.ts` | No context changes |

## Testing

- Unit test: `buildAdversarialHandoffPrompt()` produces expected XML sections
- Unit test: `handleMultiReview()` spawns 2x reviews per adapter
- Unit test: Result formatting separates standard and challenge sections
- Integration: Verify adversarial findings go through same pipeline verification

## Risks

- **Token cost doubles** for `multi_review` — 6 reviews instead of 3. This is acceptable since multi-review is already the "thorough" option.
- **Latency** — parallel execution means wall-clock time is bounded by the slowest single review, not the sum. Doubling parallel work doesn't double wait time.
- **Adversarial noise** — grounding rules and calibration rules in the prompt mitigate low-quality findings. Pipeline verification further filters.
