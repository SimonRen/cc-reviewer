# /multi-review

Get parallel second-opinion feedback from both Codex and Gemini on Claude Code's recent work, then synthesize their perspectives.

## Usage

```
/multi-review [custom prompt]
/multi-review --focus=<areas> [custom prompt]
/multi-review --file=<path> [custom prompt]
```

## Options

- `--focus=<areas>`: Comma-separated focus areas (security, performance, architecture, correctness, maintainability, scalability, testing, documentation)
- `--file=<path>`: Review specific file instead of auto-detecting CC's recent output
- `[custom prompt]`: Additional instructions for both reviewers

## Examples

```
/multi-review
/multi-review --focus=security,architecture
/multi-review "Pay attention to error handling patterns"
/multi-review --focus=performance "Compare approaches for caching strategy"
/multi-review --file=src/api/routes.ts "Full review of API design"
```

## Instructions for Claude Code

When the user runs `/multi-review`, follow this process:

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
- `focusAreas`: Parse `--focus=security,architecture` into array `["security", "architecture"]`
- `customPrompt`: Any text after the command and options
- `filePath`: Value from `--file=` if present

### 3. Call the MCP Tool

Use the `multi_feedback` tool with:

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

### 4. Synthesize and Present

After receiving feedback from both models, CC must synthesize (not just concatenate):

```markdown
## Multi-Model Review Synthesis

### ✓✓ Consensus (High Confidence)
[Findings where both Codex and Gemini agree - these are highly reliable]

### ⚖️ Conflicts
| Topic | Codex | Gemini | CC Recommendation |
|-------|-------|--------|-------------------|
| [Topic] | [Position] | [Position] | [CC's judgment + reasoning] |

### 💡 Unique Insights

**From Codex:**
- [Insight]: [CC's assessment - worth considering? Why might Gemini have missed this?]

**From Gemini:**
- [Insight]: [CC's assessment - worth considering? Why might Codex have missed this?]

### Risk Assessment
[Low/Medium/High] - [Synthesized reasoning from both models]

---

### Action Items

**Required (Blocking):**
- [ ] [High-confidence issues from consensus]

**Suggested (Nice-to-have):**
- [ ] [Lower-confidence suggestions]

Would you like me to apply the required changes? Include suggestions?
```

### 5. Handle Partial Failures

If only one model responds:
- Show the successful feedback
- Note which model failed and why
- Offer to retry the failed model
- Still provide CC's assessment of the available feedback

If both fail:
- Show both error messages
- Suggest troubleshooting steps
- Offer alternatives

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

## Synthesis Guidelines

When synthesizing multi-model feedback, CC should:

1. **Weight Consensus Highly**: If both models identify the same issue, it's very likely valid
2. **Resolve Conflicts Thoughtfully**: Don't just pick one - explain the tradeoffs
3. **Evaluate Unique Insights**: Consider why only one model caught it
4. **Maintain Authority**: CC makes the final judgment, external models advise
5. **Be Transparent**: Show reasoning, not just conclusions
