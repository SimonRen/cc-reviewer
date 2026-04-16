#!/usr/bin/env node
/**
 * AI Reviewer MCP Server
 *
 * Provides tools for getting second-opinion reviews from external AI CLIs
 * (Codex and Gemini) on Claude Code's work.
 *
 * Features:
 * - Single model review (codex_review, gemini_review)
 * - Multi-model parallel review (multi_review)
 * - Structured JSON output with confidence scores
 * - Expert role specialization per focus area
 *
 * Usage:
 * - npx cc-reviewer          # Run MCP server (normal usage)
 * - npx cc-reviewer update   # Install/update slash commands
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { handleCodexReview, handleGeminiReview, handleClaudeReview, handleMultiReview, ReviewInputSchema, TOOL_DEFINITIONS } from './tools/feedback.js';
import { logCliStatus } from './cli/check.js';
import { installCommands } from './commands.js';
import { initConfig } from './config.js';
// Read version from package.json
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const __pkg = JSON.parse(readFileSync(__pkgPath, 'utf-8'));
const VERSION = __pkg.version;
// Handle subcommands
const subcommand = process.argv[2];
if (subcommand === 'update' || subcommand === '--setup' || subcommand === '--commands') {
    const result = installCommands();
    if (result.success) {
        console.log(`cc-reviewer v${VERSION}`);
        if (result.removed.length > 0) {
            console.log(`✓ Removed ${result.removed.length} deprecated commands: ${result.removed.map(c => `/${c}`).join(', ')}`);
        }
        console.log(`✓ Installed ${result.installed.length} slash commands: ${result.installed.map(c => `/${c}`).join(', ')}`);
        process.exit(0);
    }
    else {
        console.error(`✗ Failed to install commands: ${result.error}`);
        process.exit(1);
    }
}
// Import adapters to register them
import './adapters/index.js';
// Create the MCP server
const server = new Server({
    name: 'ai-reviewer',
    version: VERSION,
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            TOOL_DEFINITIONS.codex_review,
            TOOL_DEFINITIONS.gemini_review,
            TOOL_DEFINITIONS.claude_review,
            TOOL_DEFINITIONS.multi_review,
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'codex_review': {
                const input = ReviewInputSchema.parse(args);
                return await handleCodexReview(input);
            }
            case 'gemini_review': {
                const input = ReviewInputSchema.parse(args);
                return await handleGeminiReview(input);
            }
            case 'claude_review': {
                const input = ReviewInputSchema.parse(args);
                return await handleClaudeReview(input);
            }
            case 'multi_review': {
                const input = ReviewInputSchema.parse(args);
                return await handleMultiReview(input);
            }
            default:
                return {
                    content: [{
                            type: 'text',
                            text: `Unknown tool: ${name}`
                        }],
                    isError: true
                };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }],
            isError: true
        };
    }
});
// Start the server
async function main() {
    // Initialize config (writes defaults to ~/.config/cc-reviewer/config.json on first run)
    try {
        const cfg = initConfig();
        console.error(cfg.created
            ? `[cc-reviewer] Initialized config at ${cfg.path}`
            : `[cc-reviewer] Loaded config from ${cfg.path}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[cc-reviewer] Warning: Could not initialize config: ${msg}`);
    }
    // Auto-install slash commands
    const result = installCommands();
    if (result.success) {
        console.error(`[cc-reviewer] Installed ${result.installed.length} slash commands`);
    }
    else {
        console.error(`[cc-reviewer] Warning: Could not install commands: ${result.error}`);
    }
    // Log CLI availability status on startup
    await logCliStatus();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('AI Reviewer MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
