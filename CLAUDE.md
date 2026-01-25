# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

All commands run from `mcp-server/`:

```bash
npm install           # Install dependencies
npm run build         # Build TypeScript to dist/
npm run dev           # Watch mode (tsc --watch)
npm test              # Run vitest tests
npm run test:watch    # Watch mode tests
npm start             # Run the MCP server
```

Run a single test:
```bash
npm test -- --filter="pipeline"
npm test -- --filter="schema"
```

## Publishing

Uses npm Trusted Publishing with OIDC (no tokens needed):
```bash
gh workflow run publish.yml -f version=patch   # or minor/major/skip
```

Or create a GitHub release to auto-publish.

## Architecture

### MCP Server (`mcp-server/src/`)

This is an MCP (Model Context Protocol) server that provides AI code review tools to Claude Code. External AI CLIs (Codex, Gemini) review Claude's work and return structured feedback.

**Core Flow:**
1. Claude Code calls MCP tools (`codex_feedback`, `gemini_feedback`, `multi_feedback`)
2. Tools invoke external AI CLIs with Claude's work + working directory
3. CLIs read files directly from filesystem and return structured JSON
4. Pipeline verifies findings (file exists? line valid? evidence matches?)
5. Verified feedback returned to Claude for synthesis

**Key Modules:**

- `index.ts` - MCP server entry point, tool routing, auto-installs slash commands on startup
- `tools/feedback.ts` - MCP tool implementations (`handleCodexFeedback`, `handleGeminiFeedback`, etc.) and `TOOL_DEFINITIONS`
- `adapters/base.ts` - Adapter interface + registry for AI reviewers. Expert roles (security_auditor, performance_engineer, architect, correctness_analyst) provide specialized prompts. `selectExpertRole()` picks role based on focus areas
- `adapters/codex.ts`, `adapters/gemini.ts` - CLI-specific implementations that spawn external processes
- `pipeline.ts` - Finding verification pipeline. `FileCache` for performance. Path traversal protection with `resolve()` + `normalize()`. `verifyFinding()` adjusts confidence based on evidence matching
- `schema.ts` - Zod schemas for structured output (ReviewFinding, Agreement, Disagreement, etc.). `parseReviewOutput()` extracts JSON from CLI responses
- `handoff.ts` - Minimal handoff protocol: pass only what CC uniquely knows (uncertainties, decisions, questions), let reviewer discover code via filesystem
- `context.ts` - Review context with verification data

**Design Principles:**
- CC is primary - external models only review, never do the work
- Working directory strategy - pass cwd + small CC output; external CLIs read files directly
- Synthesis not passthrough - CC always judges external feedback before incorporating
- Structured JSON output - Zod schemas replace fragile regex markdown parsing

### Slash Commands (`commands/`)

Markdown files that define user-facing commands (auto-installed to `~/.claude/commands/`):
- `/codex` - Review with Codex (focus: correctness, edge cases, performance)
- `/gemini` - Review with Gemini (focus: design patterns, scalability, tech debt)
- `/multi` - Both models in parallel

## External CLI Requirements

At least one must be installed:
```bash
npm install -g @openai/codex-cli && codex login
npm install -g @google/gemini-cli && gemini
```

## Testing

Tests are in `mcp-server/src/__tests__/`:
- `pipeline.test.ts` - Path traversal security, file caching, verification logic
- `schema.test.ts` - Zod schema validation

## Adding a New Adapter

To add support for a new AI CLI:
1. Create `adapters/<name>.ts` implementing `ReviewerAdapter` interface
2. Register adapter via `registerAdapter()` in `adapters/index.ts`
3. Adapter must implement `isAvailable()`, `getCapabilities()`, and `runReview()`
