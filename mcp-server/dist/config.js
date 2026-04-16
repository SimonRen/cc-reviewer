/**
 * Runtime configuration for cc-reviewer.
 *
 * Config file: ~/.config/cc-reviewer/config.json
 *
 * Semantics:
 *   - Lazy, cached load. `getConfig()` returns the cached config or reads once.
 *   - Missing file → defaults in memory (no write). Use `initConfig()` from the
 *     server entry point to create the file with defaults on first launch.
 *   - Invalid JSON or schema violations → fall back to defaults, warn on stderr.
 *   - Partial user configs are deep-merged against defaults via Zod `.default()`.
 *   - Tool-call arguments still override config (e.g. `reasoningEffort` on a
 *     single `codex_review` call). Config only sets defaults.
 */
import { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
// =============================================================================
// SCHEMA
// =============================================================================
export const CodexConfigSchema = z
    .object({
    model: z.string().default('gpt-5.4'),
    reasoningEffort: z.enum(['high', 'xhigh']).default('high'),
    serviceTier: z.enum(['default', 'fast', 'flex']).default('fast'),
    inactivityTimeoutMs: z
        .object({
        high: z.number().int().positive().default(180_000),
        xhigh: z.number().int().positive().default(300_000),
    })
        .default({}),
    maxTimeoutMs: z.number().int().positive().default(3_600_000),
    maxBufferSize: z.number().int().positive().default(1_048_576),
})
    .default({});
export const ClaudeConfigSchema = z
    .object({
    model: z.string().default('opus'),
    inactivityTimeoutMs: z.number().int().positive().default(300_000),
    maxTimeoutMs: z.number().int().positive().default(3_600_000),
    maxBufferSize: z.number().int().positive().default(1_048_576),
})
    .default({});
export const GeminiConfigSchema = z
    .object({
    model: z.string().nullable().default('gemini-3.1-pro-preview'),
    inactivityTimeoutMs: z.number().int().positive().default(300_000),
    maxTimeoutMs: z.number().int().positive().default(3_600_000),
    maxBufferSize: z.number().int().positive().default(1_048_576),
})
    .default({});
export const ConfigSchema = z
    .object({
    codex: CodexConfigSchema,
    claude: ClaudeConfigSchema,
    gemini: GeminiConfigSchema,
})
    .default({});
export const DEFAULT_CONFIG = ConfigSchema.parse({});
// =============================================================================
// STATE
// =============================================================================
const DEFAULT_CONFIG_PATH = join(homedir(), '.config', 'cc-reviewer', 'config.json');
let _configPath = DEFAULT_CONFIG_PATH;
let _cached = null;
let _cachedMtimeMs = 0;
// =============================================================================
// PUBLIC API
// =============================================================================
export function getConfigPath() {
    return _configPath;
}
export function getConfig() {
    // Hot-reload: re-read if the file's mtime has changed since last load.
    if (_cached) {
        try {
            if (existsSync(_configPath)) {
                const mtime = statSync(_configPath).mtimeMs;
                if (mtime !== _cachedMtimeMs) {
                    _cached = loadConfigFromDisk(_configPath);
                    _cachedMtimeMs = mtime;
                }
            }
        }
        catch {
            // statSync failure is non-fatal — keep using the cached config.
        }
        return _cached;
    }
    _cached = loadConfigFromDisk(_configPath);
    if (existsSync(_configPath)) {
        try {
            _cachedMtimeMs = statSync(_configPath).mtimeMs;
        }
        catch { /* ignore */ }
    }
    return _cached;
}
/**
 * Create the config file with defaults if it does not exist.
 * Uses the exclusive `wx` flag for atomic creation — safe against TOCTOU races
 * when multiple server instances start concurrently.
 * Refreshes the cached config so subsequent `getConfig()` calls see disk state.
 */
export function initConfig() {
    const path = _configPath;
    mkdirSync(dirname(path), { recursive: true });
    try {
        writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', { encoding: 'utf-8', flag: 'wx' });
        _cached = DEFAULT_CONFIG;
        _cachedMtimeMs = statSync(path).mtimeMs;
        return { path, created: true };
    }
    catch (error) {
        if (error.code === 'EEXIST') {
            _cached = loadConfigFromDisk(path);
            try {
                _cachedMtimeMs = statSync(path).mtimeMs;
            }
            catch { /* ignore */ }
            return { path, created: false };
        }
        throw error;
    }
}
/** Test-only hook. Redirects the config path and clears the cache. */
export function setConfigPathForTesting(path) {
    _configPath = path ?? DEFAULT_CONFIG_PATH;
    _cached = null;
    _cachedMtimeMs = 0;
}
// =============================================================================
// INTERNAL
// =============================================================================
/**
 * Parse each adapter's config independently so a typo in one section only
 * resets that adapter to defaults — the other adapters' settings survive.
 */
function loadConfigFromDisk(path) {
    if (!existsSync(path))
        return DEFAULT_CONFIG;
    let raw;
    try {
        raw = JSON.parse(readFileSync(path, 'utf-8'));
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            console.error(`[cc-reviewer] Config at ${path} is not a JSON object — using defaults.`);
            return DEFAULT_CONFIG;
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[cc-reviewer] Invalid JSON in ${path} — using defaults. Error: ${msg}`);
        return DEFAULT_CONFIG;
    }
    const adapters = [
        { key: 'codex', schema: CodexConfigSchema },
        { key: 'claude', schema: ClaudeConfigSchema },
        { key: 'gemini', schema: GeminiConfigSchema },
    ];
    const result = {};
    for (const { key, schema } of adapters) {
        const section = raw[key];
        try {
            result[key] = schema.parse(section);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[cc-reviewer] Invalid "${key}" config — using ${key} defaults. Error: ${msg}`);
            result[key] = schema.parse(undefined);
        }
    }
    return result;
}
