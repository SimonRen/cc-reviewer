/**
 * Shared module for slash command installation
 *
 * Used by both:
 * - setup.ts (manual CLI tool: npx cc-reviewer-commands)
 * - index.ts (auto-install on MCP server startup)
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface InstallResult {
  success: boolean;
  installed: string[];
  error?: string;
}

/**
 * Get source and target paths for command files
 */
export function getCommandPaths(): { source: string; target: string } {
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
export function installCommands(): InstallResult {
  const { source, target } = getCommandPaths();

  // Check source exists
  if (!existsSync(source)) {
    return { success: false, installed: [], error: 'Commands directory not found' };
  }

  // Create target directory, handle errors (not a dir, permission denied)
  try {
    if (existsSync(target)) {
      if (!statSync(target).isDirectory()) {
        return { success: false, installed: [], error: `${target} exists but is not a directory` };
      }
    } else {
      mkdirSync(target, { recursive: true });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, installed: [], error: `Cannot create target directory: ${msg}` };
  }

  const files = readdirSync(source).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    return { success: false, installed: [], error: 'No command files found' };
  }

  // Copy files, handle errors
  const installed: string[] = [];
  try {
    for (const file of files) {
      copyFileSync(join(source, file), join(target, file));
      installed.push(file.replace('.md', ''));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, installed, error: `Copy failed: ${msg}` };
  }

  return { success: true, installed };
}
