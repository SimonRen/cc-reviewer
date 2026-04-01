/**
 * Shared module for slash command installation
 *
 * Used by index.ts (auto-install on MCP server startup and `update` subcommand)
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Old command filenames that should be pruned on upgrade */
const DEPRECATED_COMMANDS = [
    'codex.md',
    'gemini.md',
    'multi.md',
    'codex-xhigh.md',
    'ask-codex.md',
    'ask-gemini.md',
    'ask-multi.md',
    'multi-review-adv.md',
];
/**
 * Get source and target paths for command files
 */
export function getCommandPaths() {
    return {
        source: join(__dirname, '..', 'commands'),
        target: join(homedir(), '.claude', 'commands'),
    };
}
/**
 * Install slash commands to ~/.claude/commands/
 *
 * @returns Result object with success status and installed commands
 */
export function installCommands() {
    const { source, target } = getCommandPaths();
    // Check source exists
    if (!existsSync(source)) {
        return { success: false, installed: [], removed: [], error: 'Commands directory not found' };
    }
    // Create target directory, handle errors (not a dir, permission denied)
    try {
        if (existsSync(target)) {
            if (!statSync(target).isDirectory()) {
                return { success: false, installed: [], removed: [], error: `${target} exists but is not a directory` };
            }
        }
        else {
            mkdirSync(target, { recursive: true });
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, installed: [], removed: [], error: `Cannot create target directory: ${msg}` };
    }
    const files = readdirSync(source).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
        return { success: false, installed: [], removed: [], error: 'No command files found' };
    }
    // Prune deprecated commands from target
    const removed = [];
    for (const oldFile of DEPRECATED_COMMANDS) {
        const oldPath = join(target, oldFile);
        if (existsSync(oldPath)) {
            try {
                unlinkSync(oldPath);
                removed.push(oldFile.replace('.md', ''));
            }
            catch {
                // Best-effort removal — don't fail the install
            }
        }
    }
    // Copy current files
    const installed = [];
    try {
        for (const file of files) {
            copyFileSync(join(source, file), join(target, file));
            installed.push(file.replace('.md', ''));
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, installed, removed, error: `Copy failed: ${msg}` };
    }
    return { success: true, installed, removed };
}
