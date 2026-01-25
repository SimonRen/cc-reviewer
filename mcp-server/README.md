# CC Reviewer - AI Code Review for Claude Code

Get second-opinion feedback from OpenAI Codex and Google Gemini CLIs on Claude Code's work, then synthesize and incorporate.

## Quick Install

**Step 1: Add the MCP server**
```bash
claude mcp add -s user cc-reviewer -- npx -y cc-reviewer
```

**Step 2: Restart Claude Code**

The MCP tools and slash commands (`/codex`, `/gemini`, `/multi`) are automatically installed.

**Manual command install** (if needed):
```bash
npx cc-reviewer --setup
```

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

## Usage

These tools provide **external second-opinion reviews** from Codex and Gemini CLIs. They are designed to complement Claude Code's native review capabilities, not replace them.

**When to use:**
- `/codex` or "review with codex" - Get external Codex review
- `/gemini` or "review with gemini" - Get external Gemini review
- `/multi` - Get parallel reviews from both CLIs

**For regular reviews:** Just say "review" and Claude Code will use its native capabilities. These external tools are only invoked when explicitly requested.

## Slash Commands

These commands are available after restart:

```bash
/codex                    # Review with Codex
/codex security           # Focus on security
/codex-xhigh              # Codex with xhigh reasoning effort

/gemini                   # Review with Gemini
/gemini architecture      # Focus on architecture

/multi                    # Both models in parallel
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

The plugin exposes three MCP tools:

| Tool | Description |
|------|-------------|
| `codex_review` | Get Codex review (correctness, edge cases, performance) |
| `gemini_review` | Get Gemini review (design patterns, scalability, tech debt) |
| `multi_review` | Parallel review from both models |

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
