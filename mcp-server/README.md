# CC Reviewer - AI Code Review for Claude Code

Get second-opinion feedback from OpenAI Codex and Google Gemini CLIs on Claude Code's work, then synthesize and incorporate.

## Quick Install

```bash
claude mcp add -s user cc-reviewer -- npx -y cc-reviewer
```

That's it! Restart Claude Code and the tools are available.

Verify with:
```bash
claude mcp list
# cc-reviewer: npx -y cc-reviewer - ✓ Connected
```

### Alternative: Manual Install

```bash
git clone https://github.com/SimonRen/cc-reviewer.git
cd cc-reviewer/mcp-server
npm install && npm run build
claude mcp add -s user cc-reviewer -- node /path/to/cc-reviewer/mcp-server/dist/index.js
```

## Prerequisites

Install at least one AI CLI:

```bash
# OpenAI Codex CLI
npm install -g @openai/codex-cli
codex login

# Google Gemini CLI
npm install -g @google/gemini-cli
gemini  # follow auth prompts
```

## Slash Commands (Optional)

Copy the slash commands to your global commands folder:

```bash
# Clone repo (if not already)
git clone https://github.com/SimonRen/cc-reviewer.git

# Copy commands
cp cc-reviewer/commands/*.md ~/.claude/commands/
```

Then use:

```bash
/codex                    # Review with Codex
/codex security           # Focus on security
/codex-xhigh              # Codex with xhigh reasoning effort

/gemini                   # Review with Gemini
/gemini architecture      # Focus on architecture

/multi                    # Both models in parallel
/council                  # Multi-model consensus with verification
```

## How It Works

```
CC does work → User: /codex → External CLI reviews → CC synthesizes → Updated output
```

**Key Principles:**
- **CC is primary**: Claude Code does all the work; external models only review
- **Working directory strategy**: Pass `cwd` + small CC output; external CLIs read files directly
- **Synthesis, not passthrough**: CC always judges external feedback before incorporating

## Focus Areas

| Area | Description |
|------|-------------|
| `security` | Vulnerabilities, auth, input validation |
| `performance` | Speed, memory, efficiency |
| `architecture` | Design patterns, structure, coupling |
| `correctness` | Logic errors, edge cases, bugs |
| `maintainability` | Code clarity, documentation, complexity |
| `scalability` | Load handling, bottlenecks |
| `testing` | Test coverage, test quality |
| `documentation` | Comments, docs, API docs |

## MCP Tools

The plugin exposes four MCP tools:

| Tool | Description |
|------|-------------|
| `codex_feedback` | Get Codex review (correctness, edge cases, performance) |
| `gemini_feedback` | Get Gemini review (design patterns, scalability, tech debt) |
| `multi_feedback` | Parallel review from both models |
| `council_feedback` | Multi-model consensus with verification pipeline |

## Output Format

External CLIs return structured JSON feedback with:
- **Findings**: Issues with severity, confidence, location, and suggestions
- **Agreements**: Validations of CC's correct assessments
- **Disagreements**: Challenges to CC's claims with corrections
- **Alternatives**: Different approaches with tradeoffs
- **Risk Assessment**: Overall risk level with top concerns

## Development

```bash
cd mcp-server
npm install
npm run build       # Build once
npm run dev         # Watch mode
npm test            # Run tests
npm run test:watch  # Watch mode tests
npm start           # Run server
```

## Publishing

Uses npm Trusted Publishing (OIDC, no tokens):
```bash
gh workflow run publish.yml -f version=patch  # or minor/major
```

## License

MIT
