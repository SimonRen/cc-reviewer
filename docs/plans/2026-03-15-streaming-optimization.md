# Streaming & Performance Optimization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate false timeouts by enabling JSONL streaming in both CLIs, and reduce review latency via prompt/schema trimming.

**Architecture:** Add a shared `CliExecutor` for process management and per-CLI `EventDecoder` modules that parse JSONL events into progress callbacks + final response text. Existing schema parsers (`parseReviewOutput`, `parsePeerOutput`) remain unchanged — they receive extracted text, not raw JSONL.

**Tech Stack:** TypeScript, Node.js child_process, vitest

**Spec:** `docs/specs/2026-03-15-streaming-optimization-design.md`

---

## Chunk 1: Transport Layer (CliExecutor + EventDecoders)

### Task 1: CliExecutor — Shared Process Management

**Files:**
- Create: `mcp-server/src/executor.ts`
- Test: `mcp-server/src/__tests__/executor.test.ts`

This extracts the duplicated `runCli` logic from both adapters into a shared module.

- [ ] **Step 1: Write the failing test for CliExecutor**

```typescript
// mcp-server/src/__tests__/executor.test.ts
import { describe, it, expect } from 'vitest';
import { CliExecutor } from '../executor.js';

describe('CliExecutor', () => {
  it('should capture stdout lines from a simple command', async () => {
    const executor = new CliExecutor();
    const result = await executor.run({
      command: 'bash',
      args: ['-c', 'printf "line1\nline2\nline3\n"'],
      cwd: '/tmp',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual(['line1', 'line2', 'line3']);
  });

  it('should call onLine callback for each stdout line', async () => {
    const lines: string[] = [];
    const executor = new CliExecutor();
    await executor.run({
      command: 'bash',
      args: ['-c', 'printf "a\nb\nc\n"'],
      cwd: '/tmp',
      onLine: (line) => lines.push(line),
    });

    expect(lines).toEqual(['a', 'b', 'c']);
  });

  it('should deliver prompt via stdin when provided', async () => {
    const executor = new CliExecutor();
    const result = await executor.run({
      command: 'cat',
      args: [],
      cwd: '/tmp',
      stdin: 'hello from stdin',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual(['hello from stdin']);
  });

  it('should reject with TIMEOUT after inactivity', async () => {
    const executor = new CliExecutor();
    await expect(
      executor.run({
        command: 'sleep',
        args: ['10'],
        cwd: '/tmp',
        inactivityTimeoutMs: 200,
        maxTimeoutMs: 5000,
      })
    ).rejects.toThrow('TIMEOUT');
  }, 3000);

  it('should reset inactivity timer on stdout data', async () => {
    const executor = new CliExecutor();
    // bash -c produces output every 100ms for 500ms — should NOT timeout with 300ms inactivity
    const result = await executor.run({
      command: 'bash',
      args: ['-c', 'for i in 1 2 3 4 5; do echo $i; sleep 0.1; done'],
      cwd: '/tmp',
      inactivityTimeoutMs: 300,
      maxTimeoutMs: 5000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines.length).toBe(5);
  }, 5000);

  it('should support dynamic timeout adjustment via setInactivityTimeout', async () => {
    const executor = new CliExecutor();
    // Start with 5s timeout, tighten to 200ms after first line
    const result = await executor.run({
      command: 'bash',
      args: ['-c', 'echo fast; sleep 1; echo slow'],
      cwd: '/tmp',
      inactivityTimeoutMs: 5000,
      maxTimeoutMs: 10000,
    });

    // Without dynamic adjustment, this should succeed (1s gap < 5s timeout)
    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines.length).toBe(2);
  }, 10000);

  it('should enforce max buffer size', async () => {
    const executor = new CliExecutor();
    // Generate output larger than 1KB using pure shell
    const result = await executor.run({
      command: 'bash',
      args: ['-c', 'head -c 2000 /dev/zero | tr "\\0" "x"'],
      cwd: '/tmp',
      maxBufferSize: 1024,
    });

    expect(result.truncated).toBe(true);
  });

  it('should capture stderr', async () => {
    const executor = new CliExecutor();
    const result = await executor.run({
      command: 'bash',
      args: ['-c', 'echo error >&2'],
      cwd: '/tmp',
    });

    expect(result.stderr).toContain('error');
  });

  it('should not resolve/reject twice on timeout then close', async () => {
    const executor = new CliExecutor();
    // This should reject with TIMEOUT, and not throw unhandled rejection on close
    await expect(
      executor.run({
        command: 'sleep',
        args: ['10'],
        cwd: '/tmp',
        inactivityTimeoutMs: 100,
        maxTimeoutMs: 5000,
      })
    ).rejects.toThrow('TIMEOUT');
  }, 3000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --filter="executor"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CliExecutor**

```typescript
// mcp-server/src/executor.ts
import { spawn, ChildProcess } from 'child_process';

export interface CliExecutorOptions {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
  env?: Record<string, string>;
  onLine?: (line: string) => void;
  onStderr?: (data: string) => void;
  inactivityTimeoutMs?: number;
  maxTimeoutMs?: number;
  maxBufferSize?: number;
}

export interface CliResult {
  stdoutLines: string[];
  rawStdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TIMEOUT_MS = 3_600_000;
const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024;

export class CliExecutor {
  /** Allow callers to dynamically tighten the inactivity timeout mid-execution */
  private _currentInactivityMs = DEFAULT_INACTIVITY_TIMEOUT_MS;
  private _inactivityTimer?: NodeJS.Timeout;
  private _proc?: import('child_process').ChildProcess;
  private _settled = false;
  private _reject?: (err: Error) => void;

  setInactivityTimeout(ms: number): void {
    this._currentInactivityMs = ms;
    // Reset timer with new duration immediately
    if (this._inactivityTimer && this._reject) {
      this._resetInactivityTimer();
    }
  }

  private _resetInactivityTimer(): void {
    clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      if (!this._settled) {
        this._settled = true;
        this._proc?.kill('SIGTERM');
        this._reject?.(new Error('TIMEOUT'));
      }
    }, this._currentInactivityMs);
  }

  run(options: CliExecutorOptions): Promise<CliResult> {
    const {
      command,
      args,
      cwd,
      stdin,
      env,
      onLine,
      onStderr,
      inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
      maxTimeoutMs = DEFAULT_MAX_TIMEOUT_MS,
      maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
    } = options;

    this._currentInactivityMs = inactivityTimeoutMs;
    this._settled = false;

    return new Promise((resolve, reject) => {
      this._reject = reject;

      const proc = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env ? { ...process.env, ...env } : { ...process.env },
      });
      this._proc = proc;

      // Guard against EPIPE
      proc.stdin.on('error', (err) => {
        console.error(`[executor] stdin error: ${err.message}`);
      });

      // Deliver stdin if provided
      if (stdin !== undefined) {
        proc.stdin.write(stdin);
      }
      proc.stdin.end();

      let rawStdout = '';
      let stderr = '';
      let truncated = false;
      const stdoutLines: string[] = [];
      let lineBuffer = '';

      // Absolute max timeout
      const maxTimer = setTimeout(() => {
        if (!this._settled) {
          this._settled = true;
          proc.kill('SIGTERM');
          reject(new Error('MAX_TIMEOUT'));
        }
      }, maxTimeoutMs);

      // Start inactivity timer
      this._resetInactivityTimer();

      proc.stdout.on('data', (data: Buffer) => {
        if (this._settled) return;
        this._resetInactivityTimer();
        const chunk = data.toString();

        // Buffer management
        if (rawStdout.length < maxBufferSize) {
          rawStdout += chunk;
          if (rawStdout.length > maxBufferSize) {
            rawStdout = rawStdout.slice(0, maxBufferSize);
            truncated = true;
          }
        } else {
          truncated = true;
        }

        // Line splitting with carry buffer for partial lines
        lineBuffer += chunk;
        const parts = lineBuffer.split('\n');
        // Last element may be incomplete — keep it in buffer
        lineBuffer = parts.pop() || '';

        for (const line of parts) {
          const trimmed = line.trimEnd();
          if (trimmed) {
            stdoutLines.push(trimmed);
            try { onLine?.(trimmed); } catch { /* defensive */ }
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (this._settled) return;
        this._resetInactivityTimer();
        const chunk = data.toString();
        try { onStderr?.(chunk); } catch { /* defensive */ }
        if (stderr.length < maxBufferSize) {
          stderr += chunk;
          if (stderr.length > maxBufferSize) {
            stderr = stderr.slice(0, maxBufferSize);
          }
        }
      });

      proc.on('close', (code) => {
        clearTimeout(this._inactivityTimer);
        clearTimeout(maxTimer);

        if (this._settled) return; // Already rejected by timeout
        this._settled = true;

        // Flush remaining line buffer
        if (lineBuffer.trim()) {
          const trimmed = lineBuffer.trim();
          stdoutLines.push(trimmed);
          try { onLine?.(trimmed); } catch { /* defensive */ }
        }

        resolve({ stdoutLines, rawStdout, stderr, exitCode: code ?? -1, truncated });
      });

      proc.on('error', (err) => {
        clearTimeout(this._inactivityTimer);
        clearTimeout(maxTimer);
        if (!this._settled) {
          this._settled = true;
          reject(err);
        }
      });
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="executor"`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/executor.ts src/__tests__/executor.test.ts
git commit -m "feat: add CliExecutor — shared process management with line-buffered output"
```

---

### Task 2: Codex EventDecoder

**Files:**
- Create: `mcp-server/src/decoders/codex.ts`
- Test: `mcp-server/src/__tests__/decoders.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// mcp-server/src/__tests__/decoders.test.ts
import { describe, it, expect } from 'vitest';
import { CodexEventDecoder } from '../decoders/codex.js';
// NOTE: GeminiEventDecoder imported in Task 3 after it exists

describe('CodexEventDecoder', () => {
  it('should extract final agent_message text', () => {
    const decoder = new CodexEventDecoder();
    const lines = [
      '{"type":"thread.started","thread_id":"abc"}',
      '{"type":"turn.started"}',
      '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"thinking..."}}',
      '{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"git diff","status":"in_progress"}}',
      '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"git diff","exit_code":0,"status":"completed"}}',
      '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"{\\"reviewer\\":\\"codex\\"}"}}',
      '{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":50}}',
    ];

    for (const line of lines) {
      decoder.processLine(line);
    }

    expect(decoder.getFinalResponse()).toBe('{"reviewer":"codex"}');
  });

  it('should track progress events', () => {
    const decoder = new CodexEventDecoder();
    const events: string[] = [];
    decoder.onProgress = (type) => events.push(type);

    decoder.processLine('{"type":"thread.started","thread_id":"abc"}');
    decoder.processLine('{"type":"turn.started"}');

    expect(events).toEqual(['thread.started', 'turn.started']);
  });

  it('should handle malformed JSONL lines gracefully', () => {
    const decoder = new CodexEventDecoder();
    decoder.processLine('not json');
    decoder.processLine('{"type":"turn.started"}');

    expect(decoder.getFinalResponse()).toBeNull();
  });

  it('should extract usage stats from turn.completed', () => {
    const decoder = new CodexEventDecoder();
    decoder.processLine('{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":50}}');

    expect(decoder.getUsage()).toEqual({ input_tokens: 100, output_tokens: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --filter="decoders"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CodexEventDecoder**

```typescript
// mcp-server/src/decoders/codex.ts
export interface CodexEvent {
  type: string;
  thread_id?: string;
  item?: {
    id: string;
    type: string;
    text?: string;
    command?: string;
    status?: string;
    exit_code?: number;
    message?: string;
  };
  usage?: {
    input_tokens: number;
    cached_input_tokens?: number;
    output_tokens: number;
  };
  error?: { message: string };
  message?: string;
}

export class CodexEventDecoder {
  private lastAgentMessage: string | null = null;
  private usage: CodexEvent['usage'] | null = null;
  onProgress?: (eventType: string, detail?: string) => void;

  processLine(line: string): void {
    let event: CodexEvent;
    try {
      event = JSON.parse(line);
    } catch {
      // Malformed line — skip
      return;
    }

    if (!event.type) return;

    this.onProgress?.(event.type, this.describeEvent(event));

    switch (event.type) {
      case 'item.completed':
        if (event.item?.type === 'agent_message' && event.item.text) {
          this.lastAgentMessage = event.item.text;
        }
        break;
      case 'turn.completed':
        if (event.usage) {
          this.usage = event.usage;
        }
        break;
      case 'error':
      case 'turn.failed':
        // Log but don't throw — let the caller handle via exit code
        break;
    }
  }

  getFinalResponse(): string | null {
    return this.lastAgentMessage;
  }

  getUsage(): CodexEvent['usage'] | null {
    return this.usage;
  }

  private describeEvent(event: CodexEvent): string {
    switch (event.type) {
      case 'item.started':
        return event.item?.type === 'command_execution'
          ? `command: ${event.item.command}`
          : event.item?.type || '';
      case 'item.completed':
        return event.item?.type || '';
      case 'error':
        return event.message || '';
      case 'turn.failed':
        return event.error?.message || '';
      default:
        return '';
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="decoders"`
Expected: CodexEventDecoder tests PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/decoders/codex.ts src/__tests__/decoders.test.ts
git commit -m "feat: add CodexEventDecoder — parse Codex JSONL streaming events"
```

---

### Task 3: Gemini EventDecoder

**Files:**
- Create: `mcp-server/src/decoders/gemini.ts`
- Create: `mcp-server/src/decoders/index.ts`
- Modify: `mcp-server/src/__tests__/decoders.test.ts`

- [ ] **Step 1: Update import and add Gemini tests to decoders.test.ts**

Update the import at the top of `decoders.test.ts`:
```typescript
import { CodexEventDecoder } from '../decoders/codex.js';
import { GeminiEventDecoder } from '../decoders/gemini.js';
```

Then append Gemini tests:

```typescript
// Append to mcp-server/src/__tests__/decoders.test.ts

describe('GeminiEventDecoder', () => {
  it('should concatenate assistant message deltas into final response', () => {
    const decoder = new GeminiEventDecoder();
    const lines = [
      '{"type":"init","session_id":"abc","model":"gemini-3"}',
      '{"type":"message","role":"user","content":"review this"}',
      '{"type":"message","role":"assistant","content":"{\\"reviewer\\":","delta":true}',
      '{"type":"tool_use","tool_name":"read_file","tool_id":"t1","parameters":{}}',
      '{"type":"tool_result","tool_id":"t1","status":"success","output":"file contents"}',
      '{"type":"message","role":"assistant","content":"\\"gemini\\"}","delta":true}',
      '{"type":"result","status":"success","stats":{"total_tokens":100,"input_tokens":80,"output_tokens":20,"duration_ms":5000}}',
    ];

    for (const line of lines) {
      decoder.processLine(line);
    }

    expect(decoder.getFinalResponse()).toBe('{"reviewer":"gemini"}');
  });

  it('should track progress events', () => {
    const decoder = new GeminiEventDecoder();
    const events: string[] = [];
    decoder.onProgress = (type) => events.push(type);

    decoder.processLine('{"type":"init","session_id":"abc","model":"gemini-3"}');
    decoder.processLine('{"type":"tool_use","tool_name":"read_file","tool_id":"t1"}');

    expect(events).toEqual(['init', 'tool_use']);
  });

  it('should handle malformed JSONL lines gracefully', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('not json');
    expect(decoder.getFinalResponse()).toBe('');
  });

  it('should extract stats from result event', () => {
    const decoder = new GeminiEventDecoder();
    decoder.processLine('{"type":"result","status":"success","stats":{"total_tokens":100,"input_tokens":80,"output_tokens":20,"duration_ms":5000}}');

    expect(decoder.getStats()).toEqual({
      total_tokens: 100,
      input_tokens: 80,
      output_tokens: 20,
      duration_ms: 5000,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --filter="decoders"`
Expected: FAIL — GeminiEventDecoder not found

- [ ] **Step 3: Implement GeminiEventDecoder and index.ts**

```typescript
// mcp-server/src/decoders/gemini.ts
export interface GeminiEvent {
  type: string;
  session_id?: string;
  model?: string;
  role?: string;
  content?: string;
  delta?: boolean;
  tool_name?: string;
  tool_id?: string;
  status?: string;
  stats?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
    [key: string]: unknown;
  };
}

export class GeminiEventDecoder {
  private assistantChunks: string[] = [];
  private stats: GeminiEvent['stats'] | null = null;
  onProgress?: (eventType: string, detail?: string) => void;

  processLine(line: string): void {
    let event: GeminiEvent;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    if (!event.type) return;

    this.onProgress?.(event.type, this.describeEvent(event));

    switch (event.type) {
      case 'message':
        if (event.role === 'assistant' && event.delta && event.content) {
          this.assistantChunks.push(event.content);
        }
        break;
      case 'result':
        if (event.stats) {
          this.stats = event.stats;
        }
        break;
    }
  }

  getFinalResponse(): string {
    return this.assistantChunks.join('');
  }

  getStats(): GeminiEvent['stats'] | null {
    return this.stats;
  }

  private describeEvent(event: GeminiEvent): string {
    switch (event.type) {
      case 'init':
        return `model: ${event.model || 'unknown'}`;
      case 'tool_use':
        return `tool: ${event.tool_name || 'unknown'}`;
      case 'tool_result':
        return `status: ${event.status || 'unknown'}`;
      case 'result':
        return `status: ${event.status || 'unknown'}`;
      default:
        return '';
    }
  }
}
```

```typescript
// mcp-server/src/decoders/index.ts
export { CodexEventDecoder } from './codex.js';
export type { CodexEvent } from './codex.js';
export { GeminiEventDecoder } from './gemini.js';
export type { GeminiEvent } from './gemini.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --filter="decoders"`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/decoders/ src/__tests__/decoders.test.ts
git commit -m "feat: add GeminiEventDecoder + decoder barrel export"
```

---

## Chunk 2: Adapter Integration

### Task 4: Wire Codex Adapter to Streaming

**Files:**
- Modify: `mcp-server/src/adapters/codex.ts`

Replace the existing `runCli` method to use `CliExecutor` + `CodexEventDecoder`. Add `--json` flag. Implement phased timeout.

- [ ] **Step 1: Update imports and constants**

In `codex.ts`, replace the timeout constants and add new imports:

```typescript
// Replace existing imports/constants at top of codex.ts
import { CliExecutor } from '../executor.js';
import { CodexEventDecoder } from '../decoders/index.js';

// Replace the old single timeout with phased timeouts
const COLD_START_TIMEOUT_MS: Record<string, number> = {
  high: 180_000,   // 3 min — waiting for first event
  xhigh: 300_000,  // 5 min — xhigh thinks longer
};
const STREAMING_TIMEOUT_MS = 90_000;  // 90s — if events stop mid-stream
const MAX_TIMEOUT_MS = 3_600_000;     // 60 min absolute max
const MAX_RETRIES = 2;
const MAX_BUFFER_SIZE = 1024 * 1024;
```

- [ ] **Step 2: Replace `runCli` method with streaming version**

Replace the entire `private runCli(...)` method. Key changes:
- Add `--json` flag for JSONL streaming
- Use `CliExecutor` with `CodexEventDecoder`
- Implement phased timeout: cold start → streaming (via `executor.setInactivityTimeout()`)
- Plain `async` method — no `new Promise(async ...)` anti-pattern

```typescript
private async runCli(
  prompt: string,
  workingDir: string,
  reasoningEffort: 'high' | 'xhigh',
  schemaGetter: () => object,
  serviceTier?: string
): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
  // Create temp schema file for structured output
  let schemaFile: string | null = null;
  try {
    const tempDir = mkdtempSync(join(tmpdir(), 'codex-schema-'));
    schemaFile = join(tempDir, 'schema.json');
    const schema = schemaGetter();
    writeFileSync(schemaFile, JSON.stringify(schema, null, 2), 'utf-8');
  } catch (err) {
    console.error('[codex] Warning: Failed to create schema file:', err);
    schemaFile = null;
  }

  const args = [
    'exec',
    '--json',  // JSONL streaming events
    '-m', 'gpt-5.4',
    '-c', `model_reasoning_effort=${reasoningEffort}`,
    '-c', 'model_reasoning_summary_format=experimental',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    '-C', workingDir,
  ];

  if (serviceTier && serviceTier !== 'default') {
    args.push('-c', `service_tier=${serviceTier}`);
  }

  if (schemaFile) {
    args.push('--output-schema', schemaFile);
  }

  args.push('-');  // Read prompt from stdin

  const decoder = new CodexEventDecoder();
  const cliStartTime = Date.now();
  let firstEventReceived = false;

  const tierLabel = serviceTier && serviceTier !== 'default' ? ` [${serviceTier}]` : '';
  console.error(`[codex] Running review with ${reasoningEffort} reasoning${tierLabel}...`);

  // Progress logging
  decoder.onProgress = (eventType, detail) => {
    const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
    const detailStr = detail ? ` — ${detail}` : '';
    console.error(`[codex] ${eventType}${detailStr} (${elapsed}s)`);
  };

  const executor = new CliExecutor();
  const coldStartTimeout = COLD_START_TIMEOUT_MS[reasoningEffort] || COLD_START_TIMEOUT_MS.high;

  try {
    const result = await executor.run({
      command: 'codex',
      args,
      cwd: workingDir,
      stdin: prompt,
      inactivityTimeoutMs: coldStartTimeout,
      maxTimeoutMs: MAX_TIMEOUT_MS,
      maxBufferSize: MAX_BUFFER_SIZE,
      onLine: (line) => {
        decoder.processLine(line);

        // Phase transition: tighten timeout after first event
        if (!firstEventReceived) {
          firstEventReceived = true;
          executor.setInactivityTimeout(STREAMING_TIMEOUT_MS);
        }
      },
    });

    const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
    console.error(`[codex] ✓ complete (${elapsed}s)`);

    // Extract final response from decoded events
    const finalResponse = decoder.getFinalResponse();

    return {
      stdout: finalResponse || result.rawStdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      truncated: result.truncated,
    };
  } finally {
    // Cleanup temp schema file
    if (schemaFile) {
      try { unlinkSync(schemaFile); } catch { /* ignore */ }
    }
  }
}
```

- [ ] **Step 3: Remove dead imports**

Remove the entire `prompt.ts` import line from `codex.ts:24`:
```typescript
// DELETE this entire line:
import { buildReviewPrompt, isValidFeedbackOutput } from '../prompt.js';
```

Also remove the unused `EXPERT_ROLES` from the `base.js` import at `codex.ts:21-22`:
```typescript
// Remove EXPERT_ROLES from this import:
import {
  ReviewerAdapter,
  ReviewerCapabilities,
  ReviewRequest,
  ReviewResult,
  ReviewError,
  PeerRequest,
  PeerResult,
  registerAdapter,
  // DELETE: EXPERT_ROLES,
} from './base.js';
```

- [ ] **Step 4: Build and run existing tests**

Run: `cd mcp-server && npm run build && npm test`
Expected: All existing tests PASS (schema, pipeline, peer tests are not affected by adapter internals)

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/adapters/codex.ts
git commit -m "feat: switch Codex adapter to --json streaming with EventDecoder"
```

---

### Task 5: Wire Gemini Adapter to Streaming

**Files:**
- Modify: `mcp-server/src/adapters/gemini.ts`

Same pattern as Codex — replace `runCli` to use `CliExecutor` + `GeminiEventDecoder`. Switch `--output-format json` to `stream-json`.

- [ ] **Step 1: Update imports**

```typescript
import { CliExecutor } from '../executor.js';
import { GeminiEventDecoder } from '../decoders/index.js';
```

- [ ] **Step 2: Replace `runCli` method with streaming version**

Plain `async` method — no `new Promise(async ...)` anti-pattern:

```typescript
private async runCli(
  prompt: string,
  workingDir: string
): Promise<{ stdout: string; stderr: string; exitCode: number; truncated: boolean }> {
  const args = [
    '--yolo',
    '--output-format', 'stream-json',  // JSONL streaming events (was: json)
    '--include-directories', workingDir,
    '-p', '',  // Headless mode; prompt via stdin
  ];

  const decoder = new GeminiEventDecoder();
  const cliStartTime = Date.now();

  console.error('[gemini] Running review...');

  decoder.onProgress = (eventType, detail) => {
    const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
    const detailStr = detail ? ` — ${detail}` : '';
    console.error(`[gemini] ${eventType}${detailStr} (${elapsed}s)`);
  };

  const executor = new CliExecutor();

  const result = await executor.run({
    command: 'gemini',
    args,
    cwd: workingDir,
    stdin: prompt,
    inactivityTimeoutMs: 300_000,  // 5 min cold start — Gemini can have long tool use phases
    maxTimeoutMs: MAX_TIMEOUT_MS,
    maxBufferSize: MAX_BUFFER_SIZE,
    onLine: (line) => {
      decoder.processLine(line);
    },
  });

  const elapsed = Math.round((Date.now() - cliStartTime) / 1000);
  console.error(`[gemini] ✓ complete (${elapsed}s)`);

  const finalResponse = decoder.getFinalResponse();

  return {
    stdout: finalResponse || result.rawStdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    truncated: result.truncated,
  };
}
```

- [ ] **Step 3: Remove dead imports**

Remove the entire `prompt.ts` import line from `gemini.ts:22`:
```typescript
// DELETE this entire line:
import { buildReviewPrompt } from '../prompt.js';
```

Also remove the unused `EXPERT_ROLES` from the `base.js` import at `gemini.ts:19-20`:
```typescript
// Remove EXPERT_ROLES from this import:
import {
  ReviewerAdapter,
  ReviewerCapabilities,
  ReviewRequest,
  ReviewResult,
  ReviewError,
  PeerRequest,
  PeerResult,
  registerAdapter,
  // DELETE: EXPERT_ROLES,
} from './base.js';
```

- [ ] **Step 4: Build and run tests**

Run: `cd mcp-server && npm run build && npm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/adapters/gemini.ts
git commit -m "feat: switch Gemini adapter to stream-json with EventDecoder"
```

---

## Chunk 3: Schema & Prompt Optimization

### Task 6: Schema Trimming + `isSubstantiveReview()`

**Files:**
- Modify: `mcp-server/src/schema.ts`
- Modify: `mcp-server/src/adapters/codex.ts` (remove inline `hasMinimalData`)
- Modify: `mcp-server/src/adapters/gemini.ts` (remove inline `hasMinimalData`)
- Modify: `mcp-server/src/__tests__/schema.test.ts`

- [ ] **Step 1: Add tests for `isSubstantiveReview`**

Append to `mcp-server/src/__tests__/schema.test.ts`:

```typescript
import { isSubstantiveReview } from '../schema.js';

describe('isSubstantiveReview', () => {
  it('should return false for completely empty review', () => {
    const output = {
      reviewer: 'codex',
      findings: [],
      risk_assessment: { overall_level: 'medium' as const, score: 50, summary: '', top_concerns: [] },
    };
    expect(isSubstantiveReview(output)).toBe(false);
  });

  it('should return true when findings exist', () => {
    const output = {
      reviewer: 'codex',
      findings: [{ id: 'f1', category: 'correctness' as const, severity: 'medium' as const, confidence: 0.8, title: 'Bug', description: 'desc' }],
      risk_assessment: { overall_level: 'medium' as const, score: 50, summary: '', top_concerns: [] },
    };
    expect(isSubstantiveReview(output)).toBe(true);
  });

  it('should return true when corrections exist', () => {
    const output = {
      reviewer: 'codex',
      findings: [],
      disagreements: [{ original_claim: 'x', issue: 'incorrect' as const, confidence: 0.8, reason: 'wrong' }],
      risk_assessment: { overall_level: 'medium' as const, score: 50, summary: '', top_concerns: [] },
    };
    expect(isSubstantiveReview(output)).toBe(true);
  });

  it('should return true when risk assessment is non-default', () => {
    const output = {
      reviewer: 'codex',
      findings: [],
      risk_assessment: { overall_level: 'high' as const, score: 75, summary: 'serious issues', top_concerns: ['x'] },
    };
    expect(isSubstantiveReview(output)).toBe(true);
  });

  it('should return true when uncertainty_responses exist', () => {
    const output = {
      reviewer: 'codex',
      findings: [],
      uncertainty_responses: [{ uncertainty_index: 1, verified: true, finding: 'confirmed' }],
      risk_assessment: { overall_level: 'medium' as const, score: 50, summary: '', top_concerns: [] },
    };
    expect(isSubstantiveReview(output)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --filter="schema"`
Expected: FAIL — `isSubstantiveReview` not found

- [ ] **Step 3: Implement `isSubstantiveReview` and update schema**

Add to `schema.ts` after `parseReviewOutput`:

```typescript
/**
 * Check if a review output contains substantive content worth returning.
 * Centralizes the "is this review empty?" check that was duplicated in adapters.
 */
export function isSubstantiveReview(output: ReviewOutput): boolean {
  // Has findings?
  if (output.findings.length > 0) return true;

  // Has corrections/disagreements?
  if (output.disagreements && output.disagreements.length > 0) return true;

  // Has uncertainty responses?
  if (output.uncertainty_responses && output.uncertainty_responses.length > 0) return true;

  // Has question answers?
  if (output.question_answers && output.question_answers.length > 0) return true;

  // Has non-default risk assessment?
  if (output.risk_assessment.overall_level !== 'medium' || output.risk_assessment.score !== 50) return true;

  // Has agreements? (low signal but still content)
  if (output.agreements && output.agreements.length > 0) return true;

  // Has alternatives?
  if (output.alternatives && output.alternatives.length > 0) return true;

  return false;
}
```

Update `getReviewOutputJsonSchema()` — change `required` to only include core fields:

```typescript
// In getReviewOutputJsonSchema(), change the required array:
required: ['reviewer', 'findings', 'risk_assessment'],
// Keep all properties defined but make agreements, disagreements, alternatives,
// uncertainty_responses, question_answers optional by not listing in required
```

- [ ] **Step 4: Update adapters to use `isSubstantiveReview`**

In both `codex.ts` and `gemini.ts`, replace the inline `hasMinimalData` block:

```typescript
// Replace lines like:
// const hasMinimalData = output.findings.length === 0 && ...
// if (hasMinimalData) { ...

// With:
import { isSubstantiveReview } from '../schema.js';

if (!isSubstantiveReview(output)) {
  if (attempt < MAX_RETRIES) {
    console.error(`[codex] Received empty output, retrying...`);
    return this.runWithRetry(
      request, attempt + 1, startTime,
      usedFallback
        ? 'Received markdown output instead of JSON. Please provide valid JSON output.'
        : 'Output contained no substantive review content. Please provide findings or analysis.',
      result.stdout
    );
  }
  // ... existing failure return
}
```

- [ ] **Step 5: Run tests**

Run: `cd mcp-server && npm run build && npm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd mcp-server && git add src/schema.ts src/adapters/codex.ts src/adapters/gemini.ts src/__tests__/schema.test.ts
git commit -m "feat: add isSubstantiveReview(), trim schema required fields to 3"
```

---

### Task 7: Prompt Optimization — Trim Role Prompts

**Files:**
- Modify: `mcp-server/src/handoff.ts`

- [ ] **Step 1: Trim COMPREHENSIVE_REVIEWER systemPrompt**

```typescript
// Replace the existing systemPrompt in COMPREHENSIVE_REVIEWER:
systemPrompt: `Senior staff engineer code reviewer. Be skeptical — catch mistakes, don't rubber-stamp.
Priority: correctness > security > performance > maintainability.
Only report real issues with evidence. Skip theoretical concerns.`,
```

- [ ] **Step 2: Trim all specialized reviewer systemPrompts similarly**

Each should be ~2-4 lines. For example:

```typescript
// SECURITY_REVIEWER
systemPrompt: `Security auditor. Focus on injection, auth bypass, data exposure, input validation.
Provide CWE IDs when applicable. Describe attack scenarios. Rate by exploitability + impact.`,

// PERFORMANCE_REVIEWER
systemPrompt: `Performance engineer. Focus on algorithmic complexity (Big-O), N+1 queries, memory leaks, blocking I/O.
Provide complexity analysis and specific optimizations.`,

// ARCHITECTURE_REVIEWER
systemPrompt: `Software architect. Focus on SOLID violations, coupling/cohesion, wrong abstractions, pattern misuse.
Suggest refactoring with specific patterns.`,

// CORRECTNESS_REVIEWER
systemPrompt: `Correctness analyst. Focus on logic errors, off-by-one, null/undefined, race conditions, error handling gaps.
Provide triggering inputs and expected vs actual behavior.`,

// CHANGE_FOCUSED_REVIEWER
systemPrompt: `Change reviewer. Focus on: does the change achieve its goal? Regressions? Unhandled edge cases? Side effects?
Reference specific lines in the diff.`,
```

- [ ] **Step 3: Trim reviewInstructions to a single line**

Replace all per-role `reviewInstructions` with:

```typescript
reviewInstructions: `\nUse git diff and file reading to review the changes. Verify claims with evidence.`,
```

- [ ] **Step 4: Build and run tests**

Run: `cd mcp-server && npm run build && npm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/handoff.ts
git commit -m "perf: trim role prompts ~40% — concise directives, remove verbose instructions"
```

---

### Task 8: Dead Code Cleanup

**Files:**
- Modify: `mcp-server/src/adapters/base.ts`
- Modify: `mcp-server/src/tools/feedback.ts`

- [ ] **Step 1: Remove `EXPERT_ROLES`, `selectExpertRole`, `ExpertRole` from base.ts**

Delete lines 110-305 from `base.ts` (the entire `ExpertRole` interface, `EXPERT_ROLES` object, and `selectExpertRole` function). Keep the `ReviewerAdapter` interface and registry.

- [ ] **Step 2: Remove `expertRole` from `ReviewRequest` interface**

In `base.ts`, remove:
```typescript
/** Expert role configuration (optional override) */
expertRole?: ExpertRole;
```

- [ ] **Step 3: Remove `selectExpertRole` usage from feedback.ts**

In `feedback.ts:16-17`, remove `selectExpertRole` from the combined import (keep the other imports):
```typescript
import {
  ReviewRequest,
  ReviewResult,
  getAdapter,
  getAvailableAdapters,
  // DELETE: selectExpertRole,
} from '../adapters/index.js';
```

Remove all three usage sites:
- Line 213: `request.expertRole = selectExpertRole(input.focusAreas as FocusArea[] | undefined);`
- Line 247: `request.expertRole = selectExpertRole(input.focusAreas as FocusArea[] | undefined);`
- Line 285: `adapterRequest.expertRole = selectExpertRole(input.focusAreas as FocusArea[] | undefined);`

Also update `adapters/index.ts` — remove the re-export of `selectExpertRole` and `EXPERT_ROLES` if present.

- [ ] **Step 4: Build and run tests**

Run: `cd mcp-server && npm run build && npm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd mcp-server && git add src/adapters/base.ts src/tools/feedback.ts
git commit -m "chore: remove dead EXPERT_ROLES system — adapters use handoff.ts roles"
```

---

## Chunk 4: Integration Testing

### Task 9: End-to-End Smoke Test

**Files:** None — manual testing

- [ ] **Step 1: Build the project**

Run: `cd mcp-server && npm run build`
Expected: No TypeScript errors

- [ ] **Step 2: Run all unit tests**

Run: `cd mcp-server && npm test`
Expected: All PASS

- [ ] **Step 3: Smoke test Codex streaming**

Run a real Codex review with the MCP server to verify streaming works end-to-end. Use a simple prompt:

```bash
cd /Users/simonren/Developer/simonren/cc-reviewer
# Start the MCP server and invoke codex_review via the CC slash command
# Or test directly via the adapter
```

Verify:
- JSONL progress events logged to stderr
- Review output returned successfully
- No timeout during reasoning phase

- [ ] **Step 4: Smoke test Gemini streaming**

Same as above but with Gemini. Verify:
- `stream-json` events logged to stderr
- Response correctly extracted from delta messages
- No buffering delay

- [ ] **Step 5: Smoke test with xhigh reasoning**

Test Codex with `reasoningEffort: 'xhigh'` to verify the extended cold start timeout works:
- Model should think for 1-3 minutes without timeout
- Events should flow during tool use
- Final response extracted correctly

- [ ] **Step 6: Version bump and commit**

Bump version in `mcp-server/package.json` from `1.9.1` to `2.0.0`.
Also verify `mcp-server/src/index.ts` version string matches (may already be `2.0.0`).

```bash
cd mcp-server
npm run build && npm test
git add package.json src/index.ts
git commit -m "v2.0.0 — streaming optimization: JSONL events, trimmed prompts/schema"
```

## Deferred Items (Documented Deviations from Spec)

The following spec items were intentionally deferred to keep this release focused:

1. **`disagreements` → `corrections` rename** — Would break backward compatibility with existing CC integrations. Defer to a future major version or add as an alias.
2. **Field removal from Zod types** (`timestamp`, `files_examined`, `execution_notes`, `cwe_id`, `owasp_category`, `tags`, `column_start/end`) — Made optional in JSON schema but kept in Zod types for backward compatibility. Can be removed once all consumers are verified.
3. **`normalizeReviewOutput()` update** — The function already handles missing optional fields via `??` defaulting. No changes needed since we only made fields optional (not removed).
4. **Process liveness probe** (`kill(pid, 0)` every 30s during Phase 1) — Streaming events already serve as liveness signals. If Codex is alive and reasoning, it emits `thread.started` and `turn.started` almost immediately. Probe adds complexity with minimal benefit now that streaming is enabled.
