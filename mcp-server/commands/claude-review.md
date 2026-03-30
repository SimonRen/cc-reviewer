# Claude Review

Get a review from a fresh Claude (Opus) instance with clean context — zero memory of this session.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## Claude Strengths
- **Deep Analysis**: Thorough reasoning across all dimensions
- **Correctness**: Logic errors, edge cases, subtle bugs
- **Security**: Vulnerability detection, auth analysis
- **Architecture**: Design patterns, coupling, abstractions
- **Clean Context**: No confirmation bias from the current session

## Before Calling - PREPARE THE HANDOFF

### 1. Summarize What You Did (Brief!)
```
"Implemented WebSocket reconnection with exponential backoff
and added session persistence across reconnects."
```

### 2. List Your Uncertainties
What should Claude verify?

```
UNCERTAINTIES:
- "Is the backoff strategy correct for this use case?"
- "Could there be a race condition between reconnect and message send?"
```

### 3. Ask Specific Questions
```
QUESTIONS:
- "Is the session token handling secure during reconnect?"
- "Should I handle partial message delivery differently?"
```

## Tool Invocation

Call `claude_review` with:

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
