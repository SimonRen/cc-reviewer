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
export declare const CodexConfigSchema: z.ZodDefault<z.ZodObject<{
    model: z.ZodDefault<z.ZodString>;
    reasoningEffort: z.ZodDefault<z.ZodEnum<["high", "xhigh"]>>;
    serviceTier: z.ZodDefault<z.ZodEnum<["default", "fast", "flex"]>>;
    inactivityTimeoutMs: z.ZodDefault<z.ZodObject<{
        high: z.ZodDefault<z.ZodNumber>;
        xhigh: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        high: number;
        xhigh: number;
    }, {
        high?: number | undefined;
        xhigh?: number | undefined;
    }>>;
    maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maxBufferSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    model: string;
    reasoningEffort: "high" | "xhigh";
    serviceTier: "default" | "fast" | "flex";
    inactivityTimeoutMs: {
        high: number;
        xhigh: number;
    };
    maxTimeoutMs: number;
    maxBufferSize: number;
}, {
    model?: string | undefined;
    reasoningEffort?: "high" | "xhigh" | undefined;
    serviceTier?: "default" | "fast" | "flex" | undefined;
    inactivityTimeoutMs?: {
        high?: number | undefined;
        xhigh?: number | undefined;
    } | undefined;
    maxTimeoutMs?: number | undefined;
    maxBufferSize?: number | undefined;
}>>;
export declare const ClaudeConfigSchema: z.ZodDefault<z.ZodObject<{
    model: z.ZodDefault<z.ZodString>;
    inactivityTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maxBufferSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    model: string;
    inactivityTimeoutMs: number;
    maxTimeoutMs: number;
    maxBufferSize: number;
}, {
    model?: string | undefined;
    inactivityTimeoutMs?: number | undefined;
    maxTimeoutMs?: number | undefined;
    maxBufferSize?: number | undefined;
}>>;
export declare const GeminiConfigSchema: z.ZodDefault<z.ZodObject<{
    model: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    inactivityTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maxBufferSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    model: string | null;
    inactivityTimeoutMs: number;
    maxTimeoutMs: number;
    maxBufferSize: number;
}, {
    model?: string | null | undefined;
    inactivityTimeoutMs?: number | undefined;
    maxTimeoutMs?: number | undefined;
    maxBufferSize?: number | undefined;
}>>;
export declare const ConfigSchema: z.ZodDefault<z.ZodObject<{
    codex: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodString>;
        reasoningEffort: z.ZodDefault<z.ZodEnum<["high", "xhigh"]>>;
        serviceTier: z.ZodDefault<z.ZodEnum<["default", "fast", "flex"]>>;
        inactivityTimeoutMs: z.ZodDefault<z.ZodObject<{
            high: z.ZodDefault<z.ZodNumber>;
            xhigh: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            high: number;
            xhigh: number;
        }, {
            high?: number | undefined;
            xhigh?: number | undefined;
        }>>;
        maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
        maxBufferSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        reasoningEffort: "high" | "xhigh";
        serviceTier: "default" | "fast" | "flex";
        inactivityTimeoutMs: {
            high: number;
            xhigh: number;
        };
        maxTimeoutMs: number;
        maxBufferSize: number;
    }, {
        model?: string | undefined;
        reasoningEffort?: "high" | "xhigh" | undefined;
        serviceTier?: "default" | "fast" | "flex" | undefined;
        inactivityTimeoutMs?: {
            high?: number | undefined;
            xhigh?: number | undefined;
        } | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    }>>;
    claude: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodString>;
        inactivityTimeoutMs: z.ZodDefault<z.ZodNumber>;
        maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
        maxBufferSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        inactivityTimeoutMs: number;
        maxTimeoutMs: number;
        maxBufferSize: number;
    }, {
        model?: string | undefined;
        inactivityTimeoutMs?: number | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    }>>;
    gemini: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        inactivityTimeoutMs: z.ZodDefault<z.ZodNumber>;
        maxTimeoutMs: z.ZodDefault<z.ZodNumber>;
        maxBufferSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        model: string | null;
        inactivityTimeoutMs: number;
        maxTimeoutMs: number;
        maxBufferSize: number;
    }, {
        model?: string | null | undefined;
        inactivityTimeoutMs?: number | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    codex: {
        model: string;
        reasoningEffort: "high" | "xhigh";
        serviceTier: "default" | "fast" | "flex";
        inactivityTimeoutMs: {
            high: number;
            xhigh: number;
        };
        maxTimeoutMs: number;
        maxBufferSize: number;
    };
    claude: {
        model: string;
        inactivityTimeoutMs: number;
        maxTimeoutMs: number;
        maxBufferSize: number;
    };
    gemini: {
        model: string | null;
        inactivityTimeoutMs: number;
        maxTimeoutMs: number;
        maxBufferSize: number;
    };
}, {
    codex?: {
        model?: string | undefined;
        reasoningEffort?: "high" | "xhigh" | undefined;
        serviceTier?: "default" | "fast" | "flex" | undefined;
        inactivityTimeoutMs?: {
            high?: number | undefined;
            xhigh?: number | undefined;
        } | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    } | undefined;
    claude?: {
        model?: string | undefined;
        inactivityTimeoutMs?: number | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    } | undefined;
    gemini?: {
        model?: string | null | undefined;
        inactivityTimeoutMs?: number | undefined;
        maxTimeoutMs?: number | undefined;
        maxBufferSize?: number | undefined;
    } | undefined;
}>>;
export type Config = z.infer<typeof ConfigSchema>;
export type CodexConfig = z.infer<typeof CodexConfigSchema>;
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export declare const DEFAULT_CONFIG: Config;
export declare function getConfigPath(): string;
export declare function getConfig(): Config;
/**
 * Create the config file with defaults if it does not exist.
 * Uses the exclusive `wx` flag for atomic creation — safe against TOCTOU races
 * when multiple server instances start concurrently.
 * Refreshes the cached config so subsequent `getConfig()` calls see disk state.
 */
export declare function initConfig(): {
    path: string;
    created: boolean;
};
/** Test-only hook. Redirects the config path and clears the cache. */
export declare function setConfigPathForTesting(path: string | null): void;
