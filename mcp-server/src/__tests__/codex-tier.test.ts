/**
 * Tests for Codex adapter service tier defaulting.
 *
 * Verifies the review chain makes `fast` the implicit default and that
 * explicit 'default' opts out of the flag entirely.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { setConfigPathForTesting } from '../config.js';

type CapturedArgs = string[];
const capturedArgs: CapturedArgs[] = [];

vi.mock('../executor.js', () => {
  return {
    CliExecutor: class {
      args: string[];
      constructor(opts: { args: string[] }) {
        this.args = opts.args;
        capturedArgs.push(opts.args);
      }
      async run() {
        return { stdout: '', stderr: '', exitCode: 0, truncated: false, stdoutLines: [], rawStdout: '' };
      }
    },
  };
});

vi.mock('../decoders/index.js', () => {
  return {
    CodexEventDecoder: class {
      onProgress: unknown = null;
      processLine() {}
      getError() { return null; }
      getFinalResponse() { return 'ok'; }
      hasNoOutput() { return false; }
    },
  };
});

const { CodexAdapter } = await import('../adapters/codex.js');

function findServiceTierArg(args: string[]): string | undefined {
  const idx = args.findIndex((a) => typeof a === 'string' && a.startsWith('service_tier='));
  return idx >= 0 ? args[idx] : undefined;
}

// Isolate from the user's real config — use a non-existent path so defaults apply.
setConfigPathForTesting('/tmp/__cc_reviewer_test_nonexistent/config.json');
afterAll(() => setConfigPathForTesting(null));

describe('CodexAdapter — serviceTier defaulting', () => {
  beforeEach(() => {
    capturedArgs.length = 0;
  });

  it('defaults to fast when serviceTier is omitted', async () => {
    const adapter = new CodexAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    expect(capturedArgs).toHaveLength(1);
    expect(findServiceTierArg(capturedArgs[0])).toBe('service_tier=fast');
  });

  it("omits the flag when serviceTier is explicitly 'default' (opt-out)", async () => {
    const adapter = new CodexAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
      serviceTier: 'default',
    });

    expect(findServiceTierArg(capturedArgs[0])).toBeUndefined();
  });

  it("passes service_tier=fast when serviceTier is 'fast'", async () => {
    const adapter = new CodexAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
      serviceTier: 'fast',
    });

    expect(findServiceTierArg(capturedArgs[0])).toBe('service_tier=fast');
  });

  it("passes service_tier=flex when serviceTier is 'flex'", async () => {
    const adapter = new CodexAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
      serviceTier: 'flex',
    });

    expect(findServiceTierArg(capturedArgs[0])).toBe('service_tier=flex');
  });
});
