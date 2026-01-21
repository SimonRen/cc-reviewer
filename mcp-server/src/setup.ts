#!/usr/bin/env node
/**
 * Setup script for cc-reviewer slash commands
 *
 * Copies the slash command files to ~/.claude/commands/
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function setup() {
  const commandsSource = join(__dirname, '..', 'commands');
  const commandsTarget = join(homedir(), '.claude', 'commands');

  console.log('CC Reviewer - Setup Slash Commands\n');

  // Check if source commands exist
  if (!existsSync(commandsSource)) {
    console.error('Error: Commands directory not found in package.');
    console.error('Expected at:', commandsSource);
    process.exit(1);
  }

  // Create target directory if it doesn't exist
  if (!existsSync(commandsTarget)) {
    console.log(`Creating ${commandsTarget}...`);
    mkdirSync(commandsTarget, { recursive: true });
  }

  // Copy command files
  const files = readdirSync(commandsSource).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.error('Error: No command files found.');
    process.exit(1);
  }

  console.log('Installing slash commands:\n');

  for (const file of files) {
    const source = join(commandsSource, file);
    const target = join(commandsTarget, file);
    const commandName = file.replace('.md', '');

    copyFileSync(source, target);
    console.log(`  /${commandName} -> ${target}`);
  }

  console.log('\n✓ Done! Restart Claude Code to use the commands.\n');
  console.log('Available commands:');
  console.log('  /codex       - Review with OpenAI Codex');
  console.log('  /codex-xhigh - Review with Codex (xhigh reasoning)');
  console.log('  /gemini      - Review with Google Gemini');
  console.log('  /multi       - Review with both Codex and Gemini');
  console.log('  /council     - Council review with consensus\n');
}

setup();
