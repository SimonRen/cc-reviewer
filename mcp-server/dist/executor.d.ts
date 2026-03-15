/**
 * CliExecutor — Shared process management for external AI CLI tools.
 *
 * Extracted from the duplicated spawn logic in codex.ts and gemini.ts to
 * provide a single, well-tested implementation of:
 *   - Child-process spawning with stdin delivery
 *   - Line-buffered stdout parsing (JSONL-friendly)
 *   - Inactivity and absolute-max timeouts
 *   - Max buffer size enforcement with truncation flag
 *   - Settled guard to prevent double resolve/reject
 *   - Dynamic inactivity timeout adjustment via setInactivityTimeout()
 */
export interface CliExecutorOptions {
    /** Executable to spawn (e.g. 'codex', 'gemini', 'bash'). */
    command: string;
    /** Arguments passed to the command. */
    args: string[];
    /** Working directory for the spawned process. */
    cwd: string;
    /** Optional content to write to the process's stdin then close it. */
    stdin?: string;
    /** Additional environment variables merged over process.env. */
    env?: Record<string, string>;
    /**
     * Called for each complete newline-delimited line on stdout.
     * Errors thrown inside are swallowed so they cannot break the executor.
     */
    onLine?: (line: string) => void;
    /**
     * Called whenever a chunk of data arrives on stderr.
     * Errors thrown inside are swallowed so they cannot break the executor.
     */
    onStderr?: (data: string) => void;
    /**
     * Milliseconds of stdout/stderr inactivity before the process is killed
     * and the promise rejects with Error('TIMEOUT').
     * Default: 120_000 (2 minutes).
     */
    inactivityTimeoutMs?: number;
    /**
     * Absolute maximum runtime in milliseconds regardless of activity.
     * Process is killed and the promise rejects with Error('MAX_TIMEOUT').
     * Default: 3_600_000 (60 minutes).
     */
    maxTimeoutMs?: number;
    /**
     * Maximum number of bytes accumulated in rawStdout before truncation.
     * Once exceeded, rawStdout is capped and truncated is set to true.
     * Default: 1_048_576 (1 MB).
     */
    maxBufferSize?: number;
}
export interface CliResult {
    /** Lines split on '\n', excluding the trailing empty string from a final newline. */
    stdoutLines: string[];
    /** Raw accumulated stdout string (may be truncated). */
    rawStdout: string;
    /** Accumulated stderr string. */
    stderr: string;
    /** Process exit code; -1 if the process was killed without an exit code. */
    exitCode: number;
    /** True when rawStdout was capped at maxBufferSize. */
    truncated: boolean;
}
export declare class CliExecutor {
    private readonly opts;
    /**
     * Mutable inactivity timeout — callers can tighten it after first streaming
     * event via setInactivityTimeout(). Changing it clears and restarts the
     * currently running inactivity timer immediately.
     */
    private currentInactivityMs;
    /**
     * Handle to the live inactivity timer (kept here so setInactivityTimeout
     * can reset it from outside the Promise closure via the shared ref below).
     */
    private inactivityTimer;
    /**
     * Injected by run() so setInactivityTimeout can restart the timer using
     * the correct reject handle while the process is still running.
     */
    private resetInactivityFn;
    constructor(options: CliExecutorOptions);
    /**
     * Dynamically adjust the inactivity timeout.
     *
     * If the process is currently running, the active inactivity timer is
     * cancelled and restarted with the new duration immediately. Subsequent
     * activity resets will also use this new value.
     *
     * Typical use: tighten the timeout once the first streaming event arrives,
     * so a stalled process is detected sooner after it starts responding.
     */
    setInactivityTimeout(ms: number): void;
    /**
     * Spawn the process and return a promise that resolves with CliResult on
     * normal completion (any exit code) or rejects with:
     *   - Error('TIMEOUT')     — inactivity timeout exceeded
     *   - Error('MAX_TIMEOUT') — absolute max timeout exceeded
     *   - ENOENT / other spawn errors propagated from child_process
     */
    run(): Promise<CliResult>;
}
