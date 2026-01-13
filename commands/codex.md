# Codex Feedback

Get a review from OpenAI Codex CLI, specialized in correctness and security.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## Codex Strengths
- **Correctness**: Logic errors, edge cases, bugs
- **Security**: Vulnerabilities, injection attacks
- **Performance**: Efficiency analysis

## Before Calling - PREPARE THE HANDOFF

### 1. Summarize What You Did (Brief!)
```
"Added user registration with email validation and password hashing."
```

### 2. List Your Uncertainties
What should Codex verify?

```
UNCERTAINTIES:
- "Is the email regex sufficient for validation?"
- "Is bcrypt properly configured for password security?"
```

### 3. Ask Specific Questions
```
QUESTIONS:
- "Are there SQL injection vectors I missed?"
- "Is the rate limiting on registration adequate?"
```

## Tool Invocation

Call `codex_feedback` with:

```json
{
  "workingDir": "<current directory>",
  "ccOutput": "<structured handoff - see below>",
  "outputType": "analysis",
  "focusAreas": ["<from $ARGUMENTS>"],
  "reasoningEffort": "high"  // or "xhigh" for deeper analysis
}
```

### Structure your ccOutput:

```
SUMMARY:
<what you did, 1-3 sentences>

UNCERTAINTIES (verify these):
1. <your uncertainty>
2. <another uncertainty>

QUESTIONS:
1. <specific question>

PRIORITY FILES:
- <file to focus on>
```

## After Receiving Review

1. **Verify file references exist**
   - Check mentioned file:line locations
   - Flag any that don't exist

2. **Cross-check findings**
   - Read the actual code
   - Confirm the issue exists

3. **Mark confidence:**
   - ✓✓ Verified by you
   - ✓ Plausible, not verified
   - ? Needs investigation
   - ✗ Rejected

4. **Apply judgment**
   - You may disagree with findings
   - Make YOUR recommendation

$ARGUMENTS
