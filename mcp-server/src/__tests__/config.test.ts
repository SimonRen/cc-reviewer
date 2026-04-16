/**
 * Tests for runtime configuration module.
 *
 * Verifies:
 *   - Default config shape matches expectations
 *   - Missing file → defaults (no crash)
 *   - Partial user config deep-merges with defaults
 *   - Invalid JSON → falls back to defaults with warning
 *   - Schema violations → falls back to defaults with warning
 *   - initConfig() creates the file when missing
 *   - initConfig() reads existing file without overwriting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getConfig,
  initConfig,
  setConfigPathForTesting,
  DEFAULT_CONFIG,
  ConfigSchema,
} from '../config.js';

// Each test gets its own temp directory so tests are fully isolated.
let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `cc-reviewer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  configPath = join(tempDir, 'config.json');
  setConfigPathForTesting(configPath);
});

afterEach(() => {
  setConfigPathForTesting(null);
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// DEFAULTS
// =============================================================================

describe('DEFAULT_CONFIG', () => {
  it('has expected codex defaults', () => {
    expect(DEFAULT_CONFIG.codex).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      serviceTier: 'fast',
      inactivityTimeoutMs: { high: 180_000, xhigh: 300_000 },
      maxTimeoutMs: 3_600_000,
      maxBufferSize: 1_048_576,
    });
  });

  it('has expected claude defaults', () => {
    expect(DEFAULT_CONFIG.claude).toEqual({
      model: 'opus',
      inactivityTimeoutMs: 300_000,
      maxTimeoutMs: 3_600_000,
      maxBufferSize: 1_048_576,
    });
  });

  it('has expected gemini defaults', () => {
    expect(DEFAULT_CONFIG.gemini).toEqual({
      model: 'gemini-3.1-pro-preview',
      inactivityTimeoutMs: 300_000,
      maxTimeoutMs: 3_600_000,
      maxBufferSize: 1_048_576,
    });
  });
});

// =============================================================================
// getConfig — FILE MISSING
// =============================================================================

describe('getConfig — file missing', () => {
  it('returns defaults when config file does not exist', () => {
    const cfg = getConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });
});

// =============================================================================
// getConfig — PARTIAL CONFIGS (DEEP MERGE)
// =============================================================================

describe('getConfig — partial config deep-merge', () => {
  it('fills missing top-level keys with defaults', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ codex: { model: 'o3' } }));

    const cfg = getConfig();
    // Overridden field
    expect(cfg.codex.model).toBe('o3');
    // Rest of codex filled from defaults
    expect(cfg.codex.reasoningEffort).toBe('high');
    expect(cfg.codex.serviceTier).toBe('fast');
    expect(cfg.codex.inactivityTimeoutMs).toEqual({ high: 180_000, xhigh: 300_000 });
    // Other adapters untouched
    expect(cfg.claude).toEqual(DEFAULT_CONFIG.claude);
    expect(cfg.gemini).toEqual(DEFAULT_CONFIG.gemini);
  });

  it('fills missing nested keys inside inactivityTimeoutMs', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({
      codex: { inactivityTimeoutMs: { high: 60_000 } },
    }));

    const cfg = getConfig();
    expect(cfg.codex.inactivityTimeoutMs.high).toBe(60_000);
    expect(cfg.codex.inactivityTimeoutMs.xhigh).toBe(300_000); // default
  });

  it('allows setting gemini model to a string', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ gemini: { model: 'gemini-2.5-pro' } }));

    const cfg = getConfig();
    expect(cfg.gemini.model).toBe('gemini-2.5-pro');
  });
});

// =============================================================================
// getConfig — ERROR HANDLING
// =============================================================================

describe('getConfig — error handling', () => {
  it('returns defaults on invalid JSON', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, '{ not valid json !!!');

    const cfg = getConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('resets only the broken adapter on schema violation (negative timeout)', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({
      codex: { maxTimeoutMs: -1 },
      gemini: { model: 'gemini-2.5-flash' },
    }));

    const cfg = getConfig();
    // Codex section falls back to defaults
    expect(cfg.codex).toEqual(DEFAULT_CONFIG.codex);
    // Gemini section survives — not nuked by codex error
    expect(cfg.gemini.model).toBe('gemini-2.5-flash');
    // Claude untouched
    expect(cfg.claude).toEqual(DEFAULT_CONFIG.claude);
  });

  it('resets only the broken adapter on schema violation (invalid enum)', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({
      codex: { reasoningEffort: 'ultra' },
      claude: { model: 'sonnet' },
    }));

    const cfg = getConfig();
    // Codex section falls back to defaults
    expect(cfg.codex).toEqual(DEFAULT_CONFIG.codex);
    // Claude section survives
    expect(cfg.claude.model).toBe('sonnet');
  });
});

// =============================================================================
// initConfig
// =============================================================================

describe('initConfig', () => {
  it('creates directory and file with defaults when missing', () => {
    expect(existsSync(configPath)).toBe(false);

    const result = initConfig();

    expect(result.created).toBe(true);
    expect(result.path).toBe(configPath);
    expect(existsSync(configPath)).toBe(true);

    const written = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(written).toEqual(DEFAULT_CONFIG);
  });

  it('does not overwrite existing config', () => {
    mkdirSync(tempDir, { recursive: true });
    const custom = { codex: { model: 'custom-model' } };
    writeFileSync(configPath, JSON.stringify(custom));

    const result = initConfig();

    expect(result.created).toBe(false);
    // File on disk is unchanged
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(raw).toEqual(custom);
    // Loaded config has defaults merged in
    const cfg = getConfig();
    expect(cfg.codex.model).toBe('custom-model');
    expect(cfg.codex.reasoningEffort).toBe('high');
  });

  it('populates cache so subsequent getConfig() is consistent', () => {
    initConfig();
    const a = getConfig();
    const b = getConfig();
    expect(a).toBe(b); // same reference — cached
  });
});

// =============================================================================
// HOT-RELOAD (mtime-based)
// =============================================================================

describe('getConfig — hot-reload on file change', () => {
  it('picks up changes when the file is modified after initial load', async () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ codex: { model: 'old-model' } }));

    const cfg1 = getConfig();
    expect(cfg1.codex.model).toBe('old-model');

    // Ensure mtime advances (filesystem resolution can be 1s on some OS)
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(configPath, JSON.stringify({ codex: { model: 'new-model' } }));

    const cfg2 = getConfig();
    expect(cfg2.codex.model).toBe('new-model');
  });

  it('returns cached config when file has not changed', () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ codex: { model: 'stable' } }));

    const cfg1 = getConfig();
    const cfg2 = getConfig();
    expect(cfg1).toBe(cfg2); // same reference — no reload
  });
});

// =============================================================================
// ConfigSchema.parse round-trip
// =============================================================================

describe('ConfigSchema', () => {
  it('round-trips DEFAULT_CONFIG through parse unchanged', () => {
    const reparsed = ConfigSchema.parse(DEFAULT_CONFIG);
    expect(reparsed).toEqual(DEFAULT_CONFIG);
  });
});
