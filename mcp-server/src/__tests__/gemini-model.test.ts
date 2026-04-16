/**
 * Tests for Gemini adapter — model flag and config integration.
 *
 * Verifies:
 *   - Default config (model: null) omits --model flag entirely
 *   - Config with a model string passes --model <value> to the CLI
 *   - Config change is reflected in subsequent runReview calls
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
        return { stdout: '', stderr: '', exitCode: 0, truncated: false };
      }
    },
  };
});

vi.mock('../decoders/index.js', () => {
  return {
    GeminiEventDecoder: class {
      onProgress: unknown = null;
      processLine() {}
      getError() { return null; }
      getFinalResponse() { return 'ok'; }
      hasNoOutput() { return false; }
    },
  };
});

const { GeminiAdapter } = await import('../adapters/gemini.js');

function findModelArgs(args: string[]): { flag: string; value: string } | undefined {
  const idx = args.indexOf('--model');
  if (idx >= 0 && idx + 1 < args.length) {
    return { flag: args[idx], value: args[idx + 1] };
  }
  return undefined;
}

// =============================================================================
// DEFAULT CONFIG — --model gemini-3.1-pro-preview
// =============================================================================

describe('GeminiAdapter — model flag with default config', () => {
  let tempDir: string;

  beforeEach(() => {
    capturedArgs.length = 0;
    // Point to non-existent path → defaults apply
    tempDir = join(tmpdir(), `cc-reviewer-gemini-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setConfigPathForTesting(join(tempDir, 'config.json'));
  });

  afterAll(() => setConfigPathForTesting(null));

  it('passes --model gemini-3.1-pro-preview by default', async () => {
    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    expect(capturedArgs).toHaveLength(1);
    const modelArg = findModelArgs(capturedArgs[0]);
    expect(modelArg).toBeDefined();
    expect(modelArg!.value).toBe('gemini-3.1-pro-preview');
  });

  it('omits --model when config explicitly sets model to null', async () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ gemini: { model: null } })
    );
    setConfigPathForTesting(join(tempDir, 'config.json'));

    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    expect(capturedArgs).toHaveLength(1);
    expect(findModelArgs(capturedArgs[0])).toBeUndefined();

    rmSync(tempDir, { recursive: true, force: true });
  });
});

// =============================================================================
// CONFIGURED MODEL — --model FLAG PRESENT
// =============================================================================

describe('GeminiAdapter — model flag with configured model', () => {
  let tempDir: string;

  beforeEach(() => {
    capturedArgs.length = 0;
    tempDir = join(tmpdir(), `cc-reviewer-gemini-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterAll(() => {
    setConfigPathForTesting(null);
  });

  it('passes --model gemini-2.5-pro when configured', async () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ gemini: { model: 'gemini-2.5-pro' } })
    );
    setConfigPathForTesting(join(tempDir, 'config.json'));

    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    expect(capturedArgs).toHaveLength(1);
    const modelArg = findModelArgs(capturedArgs[0]);
    expect(modelArg).toBeDefined();
    expect(modelArg!.value).toBe('gemini-2.5-pro');

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('passes --model gemini-2.5-flash when configured', async () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ gemini: { model: 'gemini-2.5-flash' } })
    );
    setConfigPathForTesting(join(tempDir, 'config.json'));

    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    expect(capturedArgs).toHaveLength(1);
    const modelArg = findModelArgs(capturedArgs[0]);
    expect(modelArg).toBeDefined();
    expect(modelArg!.value).toBe('gemini-2.5-flash');

    rmSync(tempDir, { recursive: true, force: true });
  });
});

// =============================================================================
// ARGS STRUCTURE — --model POSITION
// =============================================================================

describe('GeminiAdapter — CLI args structure', () => {
  let tempDir: string;

  beforeEach(() => {
    capturedArgs.length = 0;
    tempDir = join(tmpdir(), `cc-reviewer-gemini-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterAll(() => setConfigPathForTesting(null));

  it('always includes --sandbox, --approval-mode plan, --output-format stream-json', async () => {
    setConfigPathForTesting(join(tempDir, 'nonexistent.json'));

    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    const args = capturedArgs[0];
    expect(args).toContain('--sandbox');
    expect(args).toContain('--approval-mode');
    expect(args[args.indexOf('--approval-mode') + 1]).toBe('plan');
    expect(args).toContain('--output-format');
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
  });

  it('places --model after the base args when model is set', async () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ gemini: { model: 'gemini-2.5-pro' } })
    );
    setConfigPathForTesting(join(tempDir, 'config.json'));

    const adapter = new GeminiAdapter();
    await adapter.runReview({
      workingDir: process.cwd(),
      ccOutput: 'test',
      outputType: 'analysis',
    });

    const args = capturedArgs[0];
    const modelIdx = args.indexOf('--model');
    const sandboxIdx = args.indexOf('--sandbox');
    // --model comes after the base flags
    expect(modelIdx).toBeGreaterThan(sandboxIdx);

    rmSync(tempDir, { recursive: true, force: true });
  });
});
