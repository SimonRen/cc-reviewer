#!/usr/bin/env node
/**
 * AI Reviewer MCP Server (Council Review Edition)
 *
 * Provides tools for getting second-opinion feedback from external AI CLIs
 * (Codex and Gemini) on Claude Code's work.
 *
 * Features:
 * - Single model review (codex_feedback, gemini_feedback)
 * - Multi-model parallel review (multi_feedback)
 * - Council review with consensus (council_feedback) - NEW
 * - Structured JSON output with confidence scores
 * - Expert role specialization per focus area
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  handleCodexFeedback,
  handleGeminiFeedback,
  handleMultiFeedback,
  handleCouncilFeedback,
  FeedbackInputSchema,
  CouncilInputSchema,
  TOOL_DEFINITIONS
} from './tools/feedback.js';
import { logCliStatus } from './cli/check.js';
import { installCommands } from './commands.js';

// Import adapters to register them
import './adapters/index.js';

// Create the MCP server
const server = new Server(
  {
    name: 'ai-reviewer',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      TOOL_DEFINITIONS.codex_feedback,
      TOOL_DEFINITIONS.gemini_feedback,
      TOOL_DEFINITIONS.multi_feedback,
      TOOL_DEFINITIONS.council_feedback,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'codex_feedback': {
        const input = FeedbackInputSchema.parse(args);
        return await handleCodexFeedback(input);
      }

      case 'gemini_feedback': {
        const input = FeedbackInputSchema.parse(args);
        return await handleGeminiFeedback(input);
      }

      case 'multi_feedback': {
        const input = FeedbackInputSchema.parse(args);
        return await handleMultiFeedback(input);
      }

      case 'council_feedback': {
        const input = CouncilInputSchema.parse(args);
        return await handleCouncilFeedback(input);
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
  } catch (error) {
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
  // Auto-install slash commands
  const result = installCommands();
  if (result.success) {
    console.error(`[cc-reviewer] Installed ${result.installed.length} slash commands`);
  } else {
    console.error(`[cc-reviewer] Warning: Could not install commands: ${result.error}`);
  }

  // Log CLI availability status on startup
  await logCliStatus();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI Reviewer MCP Server v2.0 (Council Review) running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
