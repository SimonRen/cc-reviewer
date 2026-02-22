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

Release-based publish via npm Trusted Publishing (OIDC, no tokens needed).
CI triggers on GitHub Release, validates the tag matches `package.json`.

```bash
# 1. Bump version in package.json
# 2. Rebuild and test
cd mcp-server && npm run build && npm test
# 3. Commit, tag, push, release
git add -A && git commit -m "v1.x.x"
git tag v1.x.x
git push && git push --tags
gh release create v1.x.x --title "v1.x.x" --generate-notes
```

## Architecture

### MCP Server (`mcp-server/src/`)

This is an MCP (Model Context Protocol) server that provides AI code review and general-purpose peer assistance tools to Claude Code. External AI CLIs (Codex, Gemini) act as coworkers — reviewing, planning, debugging, explaining, and answering questions.

**Review Flow** (`codex_review`, `gemini_review`, `multi_review`):
1. Claude Code calls MCP review tools with its work + working directory
2. Tools invoke external AI CLIs which read files and return structured findings
3. Pipeline verifies findings (file exists? line valid? evidence matches?)
4. Verified feedback returned to Claude for synthesis

**Peer Ask Flow** (`ask_codex`, `ask_gemini`, `ask_multi`):
1. Claude Code calls MCP ask tools with a prompt + working directory
2. Tools invoke external AI CLIs as collaborative peer engineers
3. CLIs read files, analyze code, and return structured answers
4. Response includes answer, key points, suggested actions, and file references

**Key Modules:**

- `index.ts` - MCP server entry point, tool routing, auto-installs slash commands on startup
- `tools/feedback.ts` - Review tool implementations (`handleCodexReview`, `handleGeminiReview`, etc.) and `TOOL_DEFINITIONS`
- `tools/peer.ts` - Peer ask tool implementations (`handleAskCodex`, `handleAskGemini`, `handleAskMulti`) and `PEER_TOOL_DEFINITIONS`
- `adapters/base.ts` - Adapter interface + registry for AI reviewers. Expert roles (security_auditor, performance_engineer, architect, correctness_analyst) provide specialized prompts. `selectExpertRole()` picks role based on focus areas
- `adapters/codex.ts`, `adapters/gemini.ts` - CLI-specific implementations that spawn external processes
- `pipeline.ts` - Finding verification pipeline. `FileCache` for performance. Path traversal protection with `resolve()` + `normalize()`. `verifyFinding()` adjusts confidence based on evidence matching
- `schema.ts` - Zod schemas for structured output (ReviewFinding, PeerOutput, Agreement, etc.). `parseReviewOutput()` and `parsePeerOutput()` extract JSON from CLI responses
- `handoff.ts` - Handoff protocol: `buildHandoffPrompt()` for reviews, `buildPeerPrompt()` for general peer requests. Pass only what CC uniquely knows; let CLIs discover code via filesystem
- `context.ts` - Review context with verification data

**Design Principles:**
- CC is primary - external models assist (review or answer), CC always judges and decides
- Working directory strategy - pass cwd + small context; external CLIs read files directly
- Synthesis not passthrough - CC always judges external feedback before incorporating
- Structured JSON output - Zod schemas replace fragile regex markdown parsing

### Slash Commands (`commands/`)

Markdown files that define user-facing commands (auto-installed to `~/.claude/commands/`):
- `/codex` - Review with Codex (focus: correctness, edge cases, performance)
- `/gemini` - Review with Gemini (focus: design patterns, scalability, tech debt)
- `/multi` - Both models in parallel
- `/ask-codex` - Ask Codex for help (planning, debugging, explaining, fixing, etc.)
- `/ask-gemini` - Ask Gemini for help (planning, debugging, explaining, fixing, etc.)
- `/ask-multi` - Ask both models for help in parallel

## External CLI Requirements

At least one must be installed:
```bash
npm install -g @openai/codex-cli && codex login
npm install -g @google/gemini-cli && gemini
```

## Testing

Tests are in `mcp-server/src/__tests__/`:
- `pipeline.test.ts` - Path traversal security, file caching, verification logic
- `schema.test.ts` - Zod schema validation (review + peer schemas)
- `peer.test.ts` - Peer tool definitions, response formatting

## Adding a New Adapter

To add support for a new AI CLI:
1. Create `adapters/<name>.ts` implementing `ReviewerAdapter` interface
2. Register adapter via `registerAdapter()` in `adapters/index.ts`
3. Adapter must implement `isAvailable()`, `getCapabilities()`, `runReview()`, and `runPeerRequest()`
