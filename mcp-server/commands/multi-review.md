# Multi Review

Get parallel standard AND adversarial reviews from all available models (Codex, Gemini, Claude Opus).

Each model runs twice: once as a standard reviewer (finding bugs, issues, improvements) and once as an adversarial challenger (breaking confidence in the change, questioning assumptions, targeting hidden failure paths). Results are presented in two sections.

Use `$ARGUMENTS` to steer the adversarial focus (e.g., "focus the challenge on race conditions and rollback safety").

## Arguments
- `$ARGUMENTS` - Optional: focus area, custom instructions, or adversarial steering

## When to Use

Use `/multi-review` when you want thorough parallel reviews from all available models. Every invocation includes both standard and adversarial passes.

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
