# Council Review

Get a Council Review with automatic consensus from multiple AI models.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## Before Calling - PREPARE THE HANDOFF

The quality of review depends on what you share. Before calling the tool:

### 1. Summarize What You Did (1-3 sentences)
```
Example: "Implemented JWT authentication for the /api/users endpoints.
Added token validation middleware and refresh token rotation."
```

### 2. List Your Uncertainties (CRITICAL!)
What are you unsure about? What do you want verified?

```
Example uncertainties:
- "Is the token expiry handling correct for edge cases?"
- "Does the refresh rotation prevent token replay attacks?"
- "Should I validate the audience claim?"
```

### 3. Formulate Specific Questions
What do you specifically want the reviewer to answer?

```
Example questions:
- "Is the bcrypt cost factor (12) appropriate for this use case?"
- "Does this break backwards compatibility with existing sessions?"
```

### 4. Note Key Decisions (Optional)
Major choices you made that reviewer should evaluate:

```
Example: "Chose JWT over sessions because the API is stateless.
Alternative was Redis-backed sessions but added infrastructure complexity."
```

## Tool Invocation

Call `council_feedback` with:

```json
{
  "workingDir": "<current directory>",
  "ccOutput": "<your brief summary + uncertainties + questions>",
  "outputType": "analysis",
  "focusAreas": ["<from $ARGUMENTS if applicable>"],
  "customPrompt": "<any specific instructions>"
}
```

### Format your ccOutput like this:

```
SUMMARY:
<1-3 sentences of what you did>

UNCERTAINTIES (please verify):
1. <uncertainty 1>
2. <uncertainty 2>

QUESTIONS:
1. <specific question 1>
2. <specific question 2>

KEY DECISIONS:
- <decision>: <rationale>

PRIORITY FILES:
- path/to/critical/file.ts
- path/to/another/file.ts
```

## After Receiving Review

### Validate the Response

1. **Check uncertainty responses**
   - Did reviewer verify your uncertain areas?
   - Do you agree with their assessment?

2. **Check question answers**
   - Were your questions answered?
   - Is the reasoning sound?

3. **Evaluate new findings**
   - For each finding, verify the file/line exists
   - Read the code yourself to confirm
   - Mark your confidence:
     - ✓✓✓ Consensus + you verified
     - ✓✓ Multiple models agreed
     - ✓ Single source, plausible
     - ? Needs investigation
     - ✗ Rejected after checking

4. **Resolve conflicts**
   - If models disagree, YOU decide
   - Don't just pick majority - read the code

$ARGUMENTS
