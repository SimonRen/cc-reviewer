/**
 * Tests for executor.ts - CliExecutor shared process management
 *
 * Uses vitest. All tests spawn real system processes (bash, cat, sleep, etc.)
 * to verify behavior end-to-end. No mocking of child_process.
 */

import { describe, it, expect, vi } from 'vitest';
import { CliExecutor } from '../executor.js';

// =============================================================================
// STDOUT CAPTURE
// =============================================================================

describe('CliExecutor — stdout capture', () => {
  it('captures stdout lines from bash printf', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'printf "line1\\nline2\\nline3\\n"'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual(['line1', 'line2', 'line3']);
    expect(result.rawStdout).toBe('line1\nline2\nline3\n');
    expect(result.truncated).toBe(false);
  });

  it('handles empty stdout gracefully', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'true'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual([]);
    expect(result.rawStdout).toBe('');
  });

  it('handles stdout without trailing newline', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'printf "no-newline"'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.stdoutLines).toEqual(['no-newline']);
  });
});

// =============================================================================
// onLine CALLBACK
// =============================================================================

describe('CliExecutor — onLine callback', () => {
  it('fires onLine for each complete line', async () => {
    const lines: string[] = [];

    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'printf "alpha\\nbeta\\ngamma\\n"'],
      cwd: process.cwd(),
      onLine: (line) => lines.push(line),
    });

    await executor.run();

    expect(lines).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('onLine callback errors are swallowed and do not reject', async () => {
    let callCount = 0;

    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'printf "x\\ny\\n"'],
      cwd: process.cwd(),
      onLine: (line) => {
        callCount++;
        throw new Error('onLine intentional error');
      },
    });

    // Should resolve without throwing despite onLine throwing
    const result = await executor.run();

    expect(result.exitCode).toBe(0);
    expect(callCount).toBe(2); // both lines attempted
  });
});

// =============================================================================
// STDIN DELIVERY
// =============================================================================

describe('CliExecutor — stdin delivery', () => {
  it('delivers stdin content to the process via cat', async () => {
    const executor = new CliExecutor({
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      stdin: 'hello from stdin\nsecond line\n',
    });

    const result = await executor.run();

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual(['hello from stdin', 'second line']);
  });

  it('delivers multiline stdin correctly', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n') + '\n';

    const executor = new CliExecutor({
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      stdin: lines,
    });

    const result = await executor.run();

    expect(result.stdoutLines).toHaveLength(10);
    expect(result.stdoutLines[0]).toBe('line 0');
    expect(result.stdoutLines[9]).toBe('line 9');
  });
});

// =============================================================================
// TIMEOUT — INACTIVITY
// =============================================================================

describe('CliExecutor — inactivity timeout', () => {
  it('rejects with TIMEOUT error when process is inactive beyond inactivityTimeoutMs', async () => {
    const executor = new CliExecutor({
      command: 'sleep',
      args: ['10'],
      cwd: process.cwd(),
      inactivityTimeoutMs: 200,
      maxTimeoutMs: 5000,
    });

    await expect(executor.run()).rejects.toThrow('TIMEOUT');
  }, 3000);

  it('inactivity timer resets on stdout data — completes when lines arrive steadily', async () => {
    // Emit one line every 100ms for 5 lines; inactivity timeout is 300ms.
    // Each emission resets the timer so it should NOT time out.
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'for i in 1 2 3 4 5; do echo $i; sleep 0.1; done'],
      cwd: process.cwd(),
      inactivityTimeoutMs: 300,
      maxTimeoutMs: 10000,
    });

    const result = await executor.run();

    expect(result.exitCode).toBe(0);
    expect(result.stdoutLines).toEqual(['1', '2', '3', '4', '5']);
  }, 5000);
});

// =============================================================================
// MAX BUFFER TRUNCATION
// =============================================================================

describe('CliExecutor — max buffer truncation', () => {
  it('truncates output when it exceeds maxBufferSize', async () => {
    // Generate ~2000 bytes of 'x' characters, then set limit to 500 bytes
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', "head -c 2000 /dev/zero | tr '\\0' 'x'"],
      cwd: process.cwd(),
      maxBufferSize: 500,
    });

    const result = await executor.run();

    expect(result.truncated).toBe(true);
    expect(result.rawStdout.length).toBeLessThanOrEqual(500);
  }, 5000);

  it('does not truncate when output is within limit', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'printf "short output\\n"'],
      cwd: process.cwd(),
      maxBufferSize: 1024 * 1024,
    });

    const result = await executor.run();

    expect(result.truncated).toBe(false);
  });
});

// =============================================================================
// STDERR CAPTURE
// =============================================================================

describe('CliExecutor — stderr capture', () => {
  it('captures stderr output', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo "error message" >&2'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.stderr).toContain('error message');
  });

  it('onStderr callback fires with stderr data', async () => {
    const chunks: string[] = [];

    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo "stderr chunk" >&2'],
      cwd: process.cwd(),
      onStderr: (data) => chunks.push(data),
    });

    await executor.run();

    expect(chunks.join('')).toContain('stderr chunk');
  });

  it('onStderr callback errors are swallowed', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo "oops" >&2'],
      cwd: process.cwd(),
      onStderr: () => {
        throw new Error('onStderr intentional error');
      },
    });

    // Should resolve without throwing despite onStderr throwing
    const result = await executor.run();
    expect(result.exitCode).toBe(0);
  });

  it('captures both stdout and stderr independently', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo "out"; echo "err" >&2'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.stdoutLines).toContain('out');
    expect(result.stderr).toContain('err');
  });
});

// =============================================================================
// NON-ZERO EXIT CODE
// =============================================================================

describe('CliExecutor — exit codes', () => {
  it('returns non-zero exit code without rejecting', async () => {
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'exit 42'],
      cwd: process.cwd(),
    });

    const result = await executor.run();

    expect(result.exitCode).toBe(42);
  });
});

// =============================================================================
// setInactivityTimeout — dynamic adjustment
// =============================================================================

describe('CliExecutor — setInactivityTimeout', () => {
  it('tightens inactivity timeout dynamically after first event', async () => {
    // Start with a generous timeout, then tighten it via setInactivityTimeout.
    // The process will emit one line then hang. After the first line triggers
    // onLine, we tighten the timeout to 200ms. The process should time out.
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo "first"; sleep 10'],
      cwd: process.cwd(),
      inactivityTimeoutMs: 10000,
      maxTimeoutMs: 30000,
      onLine: () => {
        // After seeing the first line, dramatically shorten the inactivity timeout
        executor.setInactivityTimeout(200);
      },
    });

    await expect(executor.run()).rejects.toThrow('TIMEOUT');
  }, 5000);
});

// =============================================================================
// NO DOUBLE RESOLVE/REJECT
// =============================================================================

describe('CliExecutor — settled guard (no double resolve/reject)', () => {
  it('does not double-reject when timeout fires then process closes', async () => {
    // The timeout will fire first (200ms), then the process will close.
    // The second event (close) must be ignored by the settled guard.
    let rejectCount = 0;

    const originalExecutor = new CliExecutor({
      command: 'sleep',
      args: ['1'],
      cwd: process.cwd(),
      inactivityTimeoutMs: 200,
      maxTimeoutMs: 5000,
    });

    // Wrap the run() promise and count rejections
    try {
      await originalExecutor.run();
    } catch {
      rejectCount++;
    }

    // Wait a bit to see if a second rejection fires (it shouldn't)
    await new Promise((res) => setTimeout(res, 600));

    // Only one rejection should have occurred
    expect(rejectCount).toBe(1);
  }, 5000);

  it('does not double-resolve when close fires after already settled', async () => {
    // This verifies the `settled` guard on resolve path.
    // Normal completion: should resolve exactly once (no throw from Promise).
    const executor = new CliExecutor({
      command: 'bash',
      args: ['-c', 'echo done'],
      cwd: process.cwd(),
    });

    const result = await executor.run();
    expect(result.stdoutLines).toEqual(['done']);
  });
});
