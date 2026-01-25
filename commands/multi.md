# Multi Feedback

Get parallel reviews from both Codex and Gemini, raw output for manual synthesis.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## When to Use

Use `/multi` when you want parallel reviews from both Codex and Gemini.

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

Call `multi_feedback` with:

```json
{
  "workingDir": "<current directory>",
  "ccOutput": "<structured handoff>",
  "outputType": "analysis",
  "focusAreas": ["<from $ARGUMENTS>"]
}
```

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

You will receive separate reviews from each model.

### Synthesize Manually

1. **Find agreements** (both models say same thing)
   - Higher confidence
   - Still verify yourself

2. **Identify conflicts** (they disagree)
   - Read the code
   - YOU decide who's right

3. **Note unique insights**
   - Findings only one model found
   - Evaluate on merit

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
