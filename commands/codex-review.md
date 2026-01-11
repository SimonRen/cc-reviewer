# /codex-review

Get Codex's second-opinion feedback on Claude Code's recent work.

## Usage

```
/codex-review [custom prompt]
/codex-review --focus=<areas> [custom prompt]
/codex-review --file=<path> [custom prompt]
```

## Options

- `--focus=<areas>`: Comma-separated focus areas (security, performance, architecture, correctness, maintainability, scalability, testing, documentation)
- `--file=<path>`: Review specific file instead of auto-detecting CC's recent output
- `[custom prompt]`: Additional instructions for the reviewer

## Examples

```
/codex-review
/codex-review --focus=security
/codex-review "Check for race conditions in async code"
/codex-review --focus=performance "Focus on database query efficiency"
/codex-review --file=src/auth.ts "Verify JWT handling is secure"
```

## Instructions for Claude Code

When the user runs `/codex-review`, follow this process:

### 1. Identify What to Review

Determine what CC output to send for review:

1. If `--file=<path>` is specified, read that file as the content to review
2. Otherwise, look for CC's recent substantial output in the conversation:
   - Recent security scan findings
   - Architecture/implementation plans
   - Code analysis or proposals
   - Any structured output CC produced

If no clear output is found, ask the user what they'd like reviewed.

### 2. Parse Options

Extract from the command:
- `focusAreas`: Parse `--focus=security,performance` into array `["security", "performance"]`
- `customPrompt`: Any text after the command and options
- `filePath`: Value from `--file=` if present

### 3. Call the MCP Tool

Use the `codex_feedback` tool with:

```json
{
  "workingDir": "<current working directory>",
  "ccOutput": "<CC's output to review>",
  "outputType": "<plan|findings|analysis|proposal>",
  "analyzedFiles": ["<paths CC referenced>"],
  "focusAreas": ["<parsed focus areas>"],
  "customPrompt": "<user's custom instructions>"
}
```

### 4. Present Feedback

Display Codex's response with clear formatting:

```markdown
## Codex Review

[Codex's structured feedback]

---

### CC Assessment

Based on Codex's feedback:

✓ **Agreements**: [List confirmed findings]
✗ **Disagreements**: [Note where CC disagrees with Codex]
+ **Additions**: [New findings worth considering]

### Proposed Updates

[Show how CC would update its original output based on valid feedback]

Would you like me to apply these updates?
```

### 5. Handle Errors

If the tool returns an error:
- Show the error message clearly
- Suggest alternatives (e.g., "Try `/gemini-review` instead")
- Offer to retry if it was a timeout

## Focus Areas Reference

| Area | Description |
|------|-------------|
| security | Vulnerabilities, auth, input validation |
| performance | Speed, memory, efficiency |
| architecture | Design patterns, structure, coupling |
| correctness | Logic errors, edge cases, bugs |
| maintainability | Code clarity, documentation, complexity |
| scalability | Load handling, bottlenecks |
| testing | Test coverage, test quality |
| documentation | Comments, docs, API docs |
