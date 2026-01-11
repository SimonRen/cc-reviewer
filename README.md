# AI Reviewer Plugin for Claude Code

Get second-opinion feedback from OpenAI Codex and Google Gemini CLIs on Claude Code's work, then synthesize and incorporate.

## Quick Install

```bash
# Clone the repo
git clone https://github.com/jmulro/ai-reviewer.git
cd ai-reviewer

# Build the MCP server
cd mcp-server
npm install
npm run build
cd ..

# Add to Claude Code (global)
cat >> ~/.claude/settings.json << 'EOF'
{
  "mcpServers": {
    "ai-reviewer": {
      "command": "node",
      "args": ["$PWD/mcp-server/dist/index.js"]
    }
  }
}
EOF
```

Or add manually to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "ai-reviewer": {
      "command": "node",
      "args": ["/path/to/ai-reviewer/mcp-server/dist/index.js"]
    }
  }
}
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

After installing, restart Claude Code and use:

```bash
/codex-review                              # Review CC's recent work with Codex
/codex-review --focus=security             # Focus on security
/codex-review "Check for race conditions"  # Custom instructions

/gemini-review                             # Review with Gemini
/gemini-review --focus=architecture        # Focus on architecture

/multi-review                              # Both models in parallel
/multi-review --focus=security,performance # Focused multi-review
```

## How It Works

```
CC does work → User: /codex-review → External CLI reviews → CC synthesizes → Updated output
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

## Output Format

External CLIs return structured feedback:

```markdown
## Agreements
- [Finding]: [Why correct]

## Disagreements
- [Finding]: [Why wrong] - [Correct assessment]

## Additions
- [New finding]: [File:line] - [Impact]

## Alternatives
- [Topic]: [Alternative] - [Tradeoffs]

## Risk Assessment
[Low/Medium/High] - [Reason]
```

## MCP Tools

The plugin exposes three MCP tools:

| Tool | Description |
|------|-------------|
| `codex_feedback` | Get Codex review (correctness, edge cases, performance) |
| `gemini_feedback` | Get Gemini review (design patterns, scalability, tech debt) |
| `multi_feedback` | Parallel review from both models |

## Project Structure

```
ai-reviewer/
├── README.md
├── .gitignore
├── .mcp.json                     # MCP server config
├── .claude-plugin/
│   └── plugin.json               # Plugin metadata
├── commands/
│   ├── codex-review.md           # /codex-review command
│   ├── gemini-review.md          # /gemini-review command
│   └── multi-review.md           # /multi-review command
└── mcp-server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts              # MCP server entry
        ├── types.ts              # TypeScript types
        ├── prompt.ts             # 7-section prompt builder
        ├── errors.ts             # Error handling
        ├── cli/
        │   ├── check.ts          # CLI availability
        │   ├── codex.ts          # Codex wrapper
        │   └── gemini.ts         # Gemini wrapper
        └── tools/
            └── feedback.ts       # MCP tool handlers
```

## CLI Configuration

### Codex
Uses your preferred flags:
```bash
codex exec -m gpt-5.2-codex \
  -c model_reasoning_effort=xhigh \
  -c model_reasoning_summary_format=experimental \
  --search \
  --dangerously-bypass-approvals-and-sandbox
```

### Gemini
```bash
gemini -p "<prompt>" --include-directories <workingDir>
```

## Error Handling

| Error | Response |
|-------|----------|
| CLI not found | Install instructions + suggest other CLI |
| Timeout (3min) | Suggest smaller scope or --focus |
| Rate limit | Retry suggestion + alternative CLI |
| Auth error | API key check + login command |
| Invalid response | Auto-retry 2x, then show raw |

## Development

```bash
cd mcp-server
npm install
npm run build    # Build once
npm run dev      # Watch mode
npm start        # Run server
```

## License

MIT
