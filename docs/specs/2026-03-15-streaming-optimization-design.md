# MCP Server Streaming & Performance Optimization — Design Spec

## Problem

Both Codex and Gemini adapters use non-streaming output modes. Codex produces zero stdout during reasoning, triggering the 2-minute inactivity timeout on legitimate xhigh reviews. Gemini buffers the entire response with `--output-format json`.

## Root Cause

- Codex: no `--json` flag → stdout empty until full response → false timeout
- Gemini: `--output-format json` → buffered until done → long silence
- Both CLIs support streaming JSONL modes that emit events throughout execution

## Solution Overview

1. **Enable streaming** — Codex `--json`, Gemini `--output-format stream-json`
2. **Add transport decoder layer** — parse JSONL events, extract final response text
3. **Extract shared CliExecutor** — DRY up duplicate `runCli` methods
4. **Optimize prompts** — trim role prompts, remove dead code
5. **Trim output schema** — reduce required fields from 8 to 3
6. **Centralize substance check** — `isSubstantiveReview()` replaces inline field checks

## Streaming Event Formats (Verified on Machine)

### Codex `--json`

```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"...","type":"command_execution","command":"...","status":"in_progress"}}
{"type":"item.completed","item":{"id":"...","type":"command_execution","command":"...","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"...","type":"agent_message","text":"<response>"}}
{"type":"turn.completed","usage":{"input_tokens":...,"output_tokens":...}}
```

- Final response: last `item.completed` where `item.type === "agent_message"` → `.item.text`
- `--json` + `--output-schema` confirmed working together

### Gemini `--output-format stream-json`

```jsonl
{"type":"init","session_id":"...","model":"..."}
{"type":"message","role":"user","content":"..."}
{"type":"message","role":"assistant","content":"partial...","delta":true}
{"type":"tool_use","tool_name":"...","tool_id":"..."}
{"type":"tool_result","tool_id":"...","status":"success"}
{"type":"message","role":"assistant","content":"more...","delta":true}
{"type":"result","status":"success","stats":{...}}
```

- Final response: concatenate all `message` events where `role === "assistant"` and `delta === true`

## Architecture

```
                    ┌─────────────┐
                    │ CliExecutor │  shared process management
                    │ spawn + IO  │  timeout, buffer, JSONL line splitting
                    └──────┬──────┘
                           │ raw stdout lines
                    ┌──────▼──────┐
                    │ EventDecoder│  per-CLI JSONL parser
                    │ codex/gemini│  emits: progress callbacks + final text
                    └──────┬──────┘
                           │ final response text (JSON string)
                    ┌──────▼──────┐
                    │ parseReview │  unchanged schema validators
                    │   Output()  │
                    └─────────────┘
```

### CliExecutor (new shared module)

Extracted from the duplicate `runCli` methods in both adapters:
- Spawns process with args
- Manages inactivity + max timeouts
- Splits stdout into newline-delimited lines
- Calls a per-line callback (for event decoding)
- Returns `{ lines: string[], stderr: string, exitCode: number, truncated: boolean }`

### EventDecoder (per-CLI)

**CodexEventDecoder:**
- Parses each JSONL line as a Codex event
- Extracts final response from last `item.completed` with `type: "agent_message"`
- Calls progress callback on each event (for logging)

**GeminiEventDecoder:**
- Parses each JSONL line as a Gemini event
- Concatenates assistant message deltas
- Calls progress callback on each event

### Timeout Strategy (Phased)

- **Phase 1 (cold start):** Before first JSONL event arrives — `high: 3min / xhigh: 5min`
- **Phase 2 (streaming):** After first JSONL event — 90s inactivity timeout
- Every JSONL event resets the timer
- Process liveness probe (`kill(pid, 0)`) every 30s during Phase 1

## Prompt Optimization

### Dead code removal
- Remove dead imports of `buildReviewPrompt`, `isValidFeedbackOutput` from adapters
- Remove `EXPERT_ROLES`, `selectExpertRole()`, `ExpertRole` interface from `base.ts`
- Remove `expertRole` field from `ReviewRequest`
- Keep `prompt.ts` — legacy CLI wrappers in `src/cli/` still use it

### Role prompt trimming (~40% fewer tokens)
- Trim verbose system prompts to concise directives
- Keep compact role-specific instruction blocks (what to focus on)
- Remove generic "run git diff" steps that models already know

## Schema Trimming

### Required fields: 8 → 3
- `reviewer` (required)
- `findings` (required)
- `risk_assessment` (required)
- `corrections` (optional, renamed from `disagreements`)
- `agreements` (optional)
- `alternatives` (optional)
- `uncertainty_responses` (optional)
- `question_answers` (optional)

### Dropped fields
- `timestamp` — timestamped in MCP layer
- `files_examined` — unused downstream
- `execution_notes` — unused downstream
- `cwe_id`, `owasp_category`, `tags` — rarely populated
- `column_start`, `column_end` — never accurate

### Centralized substance check
- New `isSubstantiveReview(output)` function replaces inline `hasMinimalData` checks
- Checks: has findings OR has corrections OR has non-default risk assessment OR answered questions

## Progress Reporting

Log JSONL event types to stderr:
```
[codex] Starting review (xhigh reasoning, fast tier)...
[codex] thread.started (0s)
[codex] turn.started — model reasoning (2s)
[codex] item.started — command_execution (15s)
[codex] item.completed — agent_message received (45s)
[codex] ✓ Review complete (45s)
```

## Backward Compatibility

- `parseReviewOutput()` and `parsePeerOutput()` unchanged — they receive extracted text, not raw JSONL
- Legacy markdown fallback parser kept
- `prompt.ts` kept for `src/cli/` wrappers
- Schema changes are additive (fields become optional, not deleted)
- `normalizeReviewOutput()` updated to handle missing optional fields
