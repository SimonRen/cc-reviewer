# Design: Peer Ask Tools for cc-reviewer MCP

**Date:** 2026-02-22
**Status:** Approved
**Type:** Feature expansion

## Summary

Expand cc-reviewer from a review-only MCP to a general-purpose coworker by adding three new "ask" tools (`ask_codex`, `ask_gemini`, `ask_multi`). These tools let Claude Code request help with anything — planning, debugging, explaining, fixing, exploring — not just reviewing changes.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend CLIs | Codex + Gemini (same as review) | Already have filesystem access, structured output, and adapter infrastructure |
| Interaction model | Fire-and-forget | Matches current architecture, keeps it simple |
| Tool surface | Parallel new tools (not extending existing) | Clean separation, no breaking changes to review tools |
| Tool naming | `ask_codex`, `ask_gemini`, `ask_multi` | Mirrors `codex_review`, `gemini_review`, `multi_review` |
| Output schema | New flexible `PeerOutput` schema | Review schema is too rigid for Q&A/planning/debugging |

## New Tools

| Tool | Backend | Description |
|------|---------|-------------|
| `ask_codex` | Codex CLI | General-purpose peer assistance (strengths: correctness, logic, edge cases) |
| `ask_gemini` | Gemini CLI | General-purpose peer assistance (strengths: architecture, patterns, scalability) |
| `ask_multi` | Both in parallel | Get perspectives from both, CC synthesizes |

## Input Schema (`PeerInputSchema`)

```typescript
{
  workingDir: string            // required - project root for filesystem access
  prompt: string                // required - the question/request from CC
  taskType?: 'plan' | 'debug' | 'explain' | 'question' | 'fix' | 'explore' | 'general'
  relevantFiles?: string[]      // optional - files the peer should focus on
  context?: string              // optional - additional context (error messages, prior analysis)
  focusAreas?: FocusArea[]      // optional - reuse existing focus area enum
  customPrompt?: string         // optional - additional instructions for the peer
}
```

Key difference from review tools: `prompt` replaces `ccOutput` + `outputType`. Intent is expressed directly.

## Output Schema (`PeerOutput`)

```typescript
{
  responder: string               // "codex" | "gemini"
  timestamp: string

  // Core response
  answer: string                  // Main response text (markdown)
  confidence: number              // 0-1

  // Structured breakdown
  key_points: string[]            // Bullet summary of main points

  // Actionable items
  suggested_actions: Array<{
    action: string                // What to do
    priority: 'high' | 'medium' | 'low'
    file?: string                 // Relevant file
    rationale: string             // Why
  }>

  // File references (what the peer examined)
  file_references: Array<{
    path: string
    lines?: string                // e.g., "10-25"
    relevance: string             // Why this file matters
  }>

  // Optional
  alternatives?: Array<{
    topic: string
    current_approach: string
    alternative: string
    tradeoffs: { pros: string[], cons: string[] }
    recommendation: string
  }>

  execution_notes?: string
}
```

## Architecture

### Prompt Builder

New `buildPeerPrompt()` in `handoff.ts`:

- **Review frame:** "You are reviewing CC's work. Here are CC's uncertainties..."
- **Peer frame:** "You are a peer engineer. CC is asking for your help with: [prompt]. You have filesystem access to [workingDir]. Focus on: [relevantFiles]."

Reuses expert roles from adapter base, but frames the request as collaborative help rather than review.

### Adapter Changes

Add to `ReviewerAdapter` interface:

```typescript
runPeerRequest(request: PeerRequest): Promise<PeerResult>
```

Under the hood, `runPeerRequest()` reuses the same `runCli()` (spawn process, stdin prompt, collect output). Only the prompt content and output schema differ.

### Tool Handlers

New file `tools/peer.ts`:

- `handleAskCodex(input: PeerInput)` - Codex adapter
- `handleAskGemini(input: PeerInput)` - Gemini adapter
- `handleAskMulti(input: PeerInput)` - Both in parallel

Same pattern as `tools/feedback.ts`: validate input, build request, call adapter, parse output, format response.

### Pipeline (Lighter)

For peer responses, skip the full review verification pipeline. Instead, `processPeerOutput()`:

- Validate file references exist (reuse `FileCache`)
- Block references outside `workingDir` (path traversal protection)
- Pass through structured response

### Slash Commands

New markdown files in `commands/`:

- `ask-codex.md` - "Ask Codex for help"
- `ask-gemini.md` - "Ask Gemini for help"
- `ask-multi.md` - "Ask both for perspectives"

## Files Changed/Created

| File | Change |
|------|--------|
| `src/schema.ts` | Add `PeerInputSchema`, `PeerOutputSchema`, `parsePeerOutput()`, `getPeerOutputJsonSchema()` |
| `src/handoff.ts` | Add `buildPeerPrompt()` with peer-specific roles |
| `src/adapters/base.ts` | Add `PeerRequest`, `PeerResult` types, `runPeerRequest()` to interface |
| `src/adapters/codex.ts` | Implement `runPeerRequest()` (reuses `runCli()`) |
| `src/adapters/gemini.ts` | Implement `runPeerRequest()` (reuses `runCli()`) |
| `src/tools/peer.ts` | **New** - handlers + tool definitions for ask_codex/gemini/multi |
| `src/pipeline.ts` | Add `processPeerOutput()` (lighter validation) |
| `src/index.ts` | Register new tools, import peer handlers |
| `commands/ask-codex.md` | **New** slash command |
| `commands/ask-gemini.md` | **New** slash command |
| `commands/ask-multi.md` | **New** slash command |
| `src/__tests__/peer.test.ts` | **New** tests for peer schema + handlers |

## Non-Goals

- Multi-turn conversation (fire-and-forget only)
- New CLI backends (Codex + Gemini only)
- Changes to existing review tools (they remain untouched)
- Streaming responses (same batch model as reviews)
