#!/usr/bin/env node
/**
 * Setup script for cc-reviewer slash commands
 *
 * Copies the slash command files to ~/.claude/commands/
 */

import { installCommands, getCommandPaths } from './commands.js';

function setup() {
  const { target } = getCommandPaths();

  console.log('CC Reviewer - Setup Slash Commands\n');

  const result = installCommands();

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log('Installed slash commands:\n');
  for (const cmd of result.installed) {
    console.log(`  /${cmd} -> ${target}/${cmd}.md`);
  }

  console.log('\n✓ Done! Restart Claude Code to use the commands.\n');
  console.log('Available commands:');
  for (const cmd of result.installed) {
    console.log(`  /${cmd}`);
  }
  console.log('');
}

setup();
