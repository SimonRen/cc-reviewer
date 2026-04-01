# Multi Adversarial Review

Run adversarial challenge reviews from all available models (Codex, Gemini, Claude) in parallel. Each model actively tries to break confidence in the change — targeting hidden assumptions, violated invariants, and unhandled failure paths.

Use `$ARGUMENTS` to steer the adversarial focus (e.g., "challenge the caching design" or "look for race conditions").

## Arguments
- `$ARGUMENTS` - Optional: steer the adversarial focus

## When to Use

Use `/multi-review-adv` when you want every available model to challenge your work from an adversarial stance. Unlike `/multi-review` (which finds bugs), this targets assumptions and design decisions.

## Examples

```
/multi-review-adv
/multi-review-adv challenge whether this was the right caching and retry design
/multi-review-adv look for race conditions and question the chosen approach
/multi-review-adv focus on rollback safety and data loss scenarios
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
- "Was this the right caching strategy?"
- "Is there a race condition in the invalidation logic?"
```

## Tool Invocation

Call `multi_review_adv` with:

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

Adversarial reviews challenge assumptions and design decisions, not just bugs.

### Synthesize

1. **Evaluate each challenge on merit**
   - Strong challenges with code evidence deserve serious consideration
   - Speculative challenges without evidence can be noted but deprioritized

2. **Find convergence across models**
   - Multiple models flagging the same assumption = high confidence issue
   - Single-model challenge = investigate further

3. **Verify all findings**
   - Check file/line references exist
   - Read actual code
   - Mark your confidence:
     - ✓✓ Verified — code confirms the issue
     - ✓ Plausible — worth investigating
     - ? Speculative — no concrete evidence
     - ✗ Rejected — finding is wrong

4. **Make YOUR recommendation**
   - Don't just relay findings
   - Apply your judgment
   - Some adversarial challenges are intentionally aggressive — filter signal from noise

$ARGUMENTS
