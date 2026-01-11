/**
 * CLI Availability Checker
 */

import { spawn } from 'child_process';
import { CliStatus, CliType } from '../types.js';

/**
 * Check if a command exists on the system
 */
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', [command], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check availability of all supported CLIs
 */
export async function checkCliAvailability(): Promise<CliStatus> {
  const [codex, gemini] = await Promise.all([
    commandExists('codex'),
    commandExists('gemini')
  ]);

  return { codex, gemini };
}

/**
 * Check if a specific CLI is available
 */
export async function isCliAvailable(cli: CliType): Promise<boolean> {
  return commandExists(cli);
}

/**
 * Get CLI version (for debugging)
 */
export async function getCliVersion(cli: CliType): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(cli, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        resolve(stdout.trim().split('\n')[0]);
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Log CLI availability status (for startup debugging)
 */
export async function logCliStatus(): Promise<void> {
  const status = await checkCliAvailability();

  console.error('AI Reviewer CLI Status:');
  console.error(`  - Codex: ${status.codex ? '✓ Available' : '✗ Not found'}`);
  console.error(`  - Gemini: ${status.gemini ? '✓ Available' : '✗ Not found'}`);

  if (!status.codex && !status.gemini) {
    console.error('\nWarning: No AI CLIs found. Install with:');
    console.error('  npm install -g @openai/codex-cli');
    console.error('  npm install -g @google/gemini-cli');
  }
}
