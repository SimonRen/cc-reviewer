# Gemini Feedback

Get a review from Google Gemini CLI, specialized in architecture and large-scale analysis.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## Gemini Strengths
- **Architecture**: Design patterns, code structure
- **Large Context**: Can analyze entire codebases
- **Maintainability**: Code clarity, complexity
- **Scalability**: System design concerns

## Before Calling - PREPARE THE HANDOFF

### 1. Summarize What You Did (Brief!)
```
"Refactored the payment service to use the repository pattern,
extracted common validation logic into a shared module."
```

### 2. List Your Uncertainties
What should Gemini verify?

```
UNCERTAINTIES:
- "Does the new abstraction layer add unnecessary complexity?"
- "Is the module boundary in the right place?"
```

### 3. Ask Specific Questions
```
QUESTIONS:
- "Should PaymentValidator be its own service or stay as a utility?"
- "Is there a better pattern for the retry logic?"
```

## Tool Invocation

Call `gemini_feedback` with:

```json
{
  "workingDir": "<current directory>",
  "ccOutput": "<structured handoff - see below>",
  "outputType": "analysis",
  "focusAreas": ["<from $ARGUMENTS>"]
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

KEY DECISIONS:
- <decision>: <rationale>

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
