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
import { spawn } from 'child_process';
// =============================================================================
// EXECUTOR
// =============================================================================
export class CliExecutor {
    opts;
    /**
     * Mutable inactivity timeout — callers can tighten it after first streaming
     * event via setInactivityTimeout(). Changing it clears and restarts the
     * currently running inactivity timer immediately.
     */
    currentInactivityMs;
    /**
     * Handle to the live inactivity timer (kept here so setInactivityTimeout
     * can reset it from outside the Promise closure via the shared ref below).
     */
    inactivityTimer;
    /**
     * Injected by run() so setInactivityTimeout can restart the timer using
     * the correct reject handle while the process is still running.
     */
    resetInactivityFn;
    constructor(options) {
        this.opts = {
            command: options.command,
            args: options.args,
            cwd: options.cwd,
            stdin: options.stdin,
            env: options.env,
            onLine: options.onLine,
            onStderr: options.onStderr,
            inactivityTimeoutMs: options.inactivityTimeoutMs ?? 120_000,
            maxTimeoutMs: options.maxTimeoutMs ?? 3_600_000,
            maxBufferSize: options.maxBufferSize ?? 1_048_576,
        };
        this.currentInactivityMs = this.opts.inactivityTimeoutMs;
    }
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
    setInactivityTimeout(ms) {
        this.currentInactivityMs = ms;
        // Restart the running timer (if any) with the new duration.
        this.resetInactivityFn?.();
    }
    /**
     * Spawn the process and return a promise that resolves with CliResult on
     * normal completion (any exit code) or rejects with:
     *   - Error('TIMEOUT')     — inactivity timeout exceeded
     *   - Error('MAX_TIMEOUT') — absolute max timeout exceeded
     *   - ENOENT / other spawn errors propagated from child_process
     */
    run() {
        return new Promise((resolve, reject) => {
            // ------------------------------------------------------------------
            // Settled guard — prevents double resolve/reject when, e.g., the
            // inactivity timer fires and then the `close` event also fires.
            // ------------------------------------------------------------------
            let settled = false;
            const settle = (fn) => {
                if (settled)
                    return;
                settled = true;
                fn();
            };
            // ------------------------------------------------------------------
            // Spawn
            // ------------------------------------------------------------------
            const proc = spawn(this.opts.command, this.opts.args, {
                cwd: this.opts.cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: this.opts.env
                    ? { ...process.env, ...this.opts.env }
                    : { ...process.env },
            });
            // ------------------------------------------------------------------
            // Stdin delivery
            // ------------------------------------------------------------------
            // Guard against EPIPE: log but do not reject — the close handler owns
            // the final resolution. EPIPE means the child exited before consuming
            // all of stdin, which is fine (e.g. the child crashed early).
            proc.stdin.on('error', (err) => {
                if (err.code === 'EPIPE') {
                    console.error(`[executor] stdin EPIPE (child closed early): ${err.message}`);
                }
                else {
                    console.error(`[executor] stdin error: ${err.message}`);
                }
            });
            if (this.opts.stdin !== undefined) {
                proc.stdin.write(this.opts.stdin);
            }
            proc.stdin.end();
            // ------------------------------------------------------------------
            // State
            // ------------------------------------------------------------------
            let rawStdout = '';
            let stderr = '';
            let truncated = false;
            /** Partial line buffer — accumulates data until a '\n' is seen. */
            let lineBuffer = '';
            // ------------------------------------------------------------------
            // Timers
            // ------------------------------------------------------------------
            const maxTimer = setTimeout(() => {
                proc.kill('SIGTERM');
                settle(() => reject(new Error('MAX_TIMEOUT')));
            }, this.opts.maxTimeoutMs);
            const resetInactivity = () => {
                clearTimeout(this.inactivityTimer);
                this.inactivityTimer = setTimeout(() => {
                    proc.kill('SIGTERM');
                    settle(() => reject(new Error('TIMEOUT')));
                }, this.currentInactivityMs);
            };
            // Expose reset function so setInactivityTimeout() can restart it.
            this.resetInactivityFn = resetInactivity;
            // Start the inactivity clock.
            resetInactivity();
            // ------------------------------------------------------------------
            // stdout handler — line buffering
            // ------------------------------------------------------------------
            proc.stdout.on('data', (chunk) => {
                resetInactivity();
                const incoming = chunk.toString();
                // Buffer management: cap rawStdout at maxBufferSize.
                if (!truncated) {
                    const remaining = this.opts.maxBufferSize - rawStdout.length;
                    if (incoming.length <= remaining) {
                        rawStdout += incoming;
                    }
                    else {
                        rawStdout += incoming.slice(0, remaining);
                        truncated = true;
                    }
                }
                // Line splitting — process complete lines from the combined buffer.
                lineBuffer += incoming;
                const newlineIdx = lineBuffer.lastIndexOf('\n');
                if (newlineIdx === -1) {
                    // No complete line yet — keep buffering.
                    return;
                }
                // Extract all complete lines (everything up to and including the last '\n').
                const completePart = lineBuffer.slice(0, newlineIdx + 1);
                lineBuffer = lineBuffer.slice(newlineIdx + 1);
                const lines = completePart.split('\n');
                // The last element is always '' because split on a trailing '\n' produces
                // an empty string — skip it.
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i];
                    if (this.opts.onLine) {
                        try {
                            this.opts.onLine(line);
                        }
                        catch {
                            // Intentionally swallowed — callers must not break the executor.
                        }
                    }
                }
            });
            // ------------------------------------------------------------------
            // stderr handler
            // ------------------------------------------------------------------
            proc.stderr.on('data', (chunk) => {
                resetInactivity();
                const data = chunk.toString();
                if (stderr.length < this.opts.maxBufferSize) {
                    const remaining = this.opts.maxBufferSize - stderr.length;
                    stderr += data.length <= remaining ? data : data.slice(0, remaining);
                }
                if (this.opts.onStderr) {
                    try {
                        this.opts.onStderr(data);
                    }
                    catch {
                        // Intentionally swallowed.
                    }
                }
            });
            // ------------------------------------------------------------------
            // close handler — normal resolution path
            // ------------------------------------------------------------------
            proc.on('close', (code) => {
                clearTimeout(this.inactivityTimer);
                clearTimeout(maxTimer);
                this.resetInactivityFn = undefined;
                // Flush any partial line still in the buffer.
                if (lineBuffer.length > 0) {
                    if (this.opts.onLine) {
                        try {
                            this.opts.onLine(lineBuffer);
                        }
                        catch {
                            // Intentionally swallowed.
                        }
                    }
                }
                // Build the final lines array from rawStdout (split after the fact so
                // the list is consistent with rawStdout even when truncated).
                const rawLines = rawStdout.split('\n');
                // Drop a trailing empty string produced by a final '\n'.
                if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
                    rawLines.pop();
                }
                settle(() => resolve({
                    stdoutLines: rawLines,
                    rawStdout,
                    stderr,
                    exitCode: code ?? -1,
                    truncated,
                }));
            });
            // ------------------------------------------------------------------
            // error handler — spawn failures (e.g. ENOENT)
            // ------------------------------------------------------------------
            proc.on('error', (err) => {
                clearTimeout(this.inactivityTimer);
                clearTimeout(maxTimer);
                this.resetInactivityFn = undefined;
                settle(() => reject(err));
            });
        });
    }
}
