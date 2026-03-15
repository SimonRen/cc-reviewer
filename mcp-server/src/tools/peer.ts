/**
 * MCP Peer Tool Implementations
 *
 * General-purpose coworker tools:
 * 1. ask_codex - Ask Codex for help
 * 2. ask_gemini - Ask Gemini for help
 * 3. ask_multi - Ask both in parallel
 */

import { FocusArea } from '../types.js';
import {
  PeerRequest,
  PeerResult,
  getAdapter,
  getAvailableAdapters,
} from '../adapters/index.js';
// No schema imports — raw text output, CC interprets

export type PeerInput = {
  workingDir: string;
  prompt: string;
  taskType?: string;
  relevantFiles?: string[];
  context?: string;
  focusAreas?: string[];
  customPrompt?: string;
  reasoningEffort?: 'high' | 'xhigh';
  serviceTier?: 'default' | 'fast' | 'flex';
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function toPeerRequest(input: PeerInput): PeerRequest {
  return {
    workingDir: input.workingDir,
    prompt: input.prompt,
    taskType: input.taskType as PeerRequest['taskType'],
    relevantFiles: input.relevantFiles,
    context: input.context,
    focusAreas: input.focusAreas as FocusArea[] | undefined,
    customPrompt: input.customPrompt,
    reasoningEffort: input.reasoningEffort,
    serviceTier: input.serviceTier,
  };
}

function formatPeerResult(result: PeerResult, modelName: string): string {
  if (!result.success) {
    const emoji: Record<string, string> = {
      cli_not_found: '❌', timeout: '⏱️', rate_limit: '🚫',
      auth_error: '🔐', cli_error: '❌',
    };
    let msg = `${emoji[result.error.type] || '❌'} **${result.error.type}**: ${result.error.message}`;
    if (result.suggestion) msg += `\n\n💡 ${result.suggestion}`;
    return msg;
  }

  return `## ${modelName} Response\n\n**Execution Time:** ${(result.executionTimeMs / 1000).toFixed(1)}s\n\n${result.output}`;
}

// =============================================================================
// SINGLE MODEL HANDLERS
// =============================================================================

export async function handleAskCodex(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const adapter = getAdapter('codex');
  if (!adapter) {
    return { content: [{ type: 'text', text: '❌ Codex adapter not registered' }] };
  }

  const available = await adapter.isAvailable();
  if (!available) {
    return {
      content: [{
        type: 'text',
        text: '❌ Codex CLI not found.\n\nInstall with: npm install -g @openai/codex\n\nAlternative: Use ask_gemini instead'
      }]
    };
  }

  const request = toPeerRequest(input);
  const result = await adapter.runPeerRequest(request);

  return { content: [{ type: 'text', text: formatPeerResult(result, 'Codex') }] };
}

export async function handleAskGemini(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const adapter = getAdapter('gemini');
  if (!adapter) {
    return { content: [{ type: 'text', text: '❌ Gemini adapter not registered' }] };
  }

  const available = await adapter.isAvailable();
  if (!available) {
    return {
      content: [{
        type: 'text',
        text: '❌ Gemini CLI not found.\n\nInstall with: npm install -g @google/gemini-cli\n\nAlternative: Use ask_codex instead'
      }]
    };
  }

  const request = toPeerRequest(input);
  const result = await adapter.runPeerRequest(request);

  return { content: [{ type: 'text', text: formatPeerResult(result, 'Gemini') }] };
}

// =============================================================================
// MULTI-MODEL HANDLER
// =============================================================================

export async function handleAskMulti(input: PeerInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const request = toPeerRequest(input);
  const availableAdapters = await getAvailableAdapters();

  if (availableAdapters.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `❌ No AI CLIs found.\n\nInstall at least one:\n  - Codex: npm install -g @openai/codex\n  - Gemini: npm install -g @google/gemini-cli`
      }]
    };
  }

  const promises = availableAdapters.map(async (adapter) => {
    const result = await adapter.runPeerRequest(request);
    return { adapter, result };
  });

  const results = await Promise.all(promises);

  const lines: string[] = [];
  const allFailed = results.every(r => !r.result.success);
  const someFailed = results.some(r => !r.result.success);

  if (allFailed) lines.push('## Multi-Model Response ❌ All Failed\n');
  else if (someFailed) lines.push('## Multi-Model Response ⚠️ Partial Success\n');
  else lines.push('## Multi-Model Response ✓\n');

  lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')}\n`);

  for (const { adapter, result } of results) {
    lines.push(formatPeerResult(result, adapter.getCapabilities().name));
    lines.push('');
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const PEER_TOOL_DEFINITIONS = {
  ask_codex: {
    name: 'ask_codex',
    description: "Ask OpenAI Codex CLI for help as a peer engineer. Use for planning, debugging, explaining, fixing, exploring, or answering questions. Codex excels at correctness, logic, and edge cases.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
        reasoningEffort: {
          type: 'string',
          enum: ['high', 'xhigh'],
          description: 'Codex reasoning effort (default: high)',
        },
        serviceTier: {
          type: 'string',
          enum: ['default', 'fast', 'flex'],
          description: 'Codex service tier (fast = priority processing, flex = cheaper/slower)',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
  ask_gemini: {
    name: 'ask_gemini',
    description: "Ask Google Gemini CLI for help as a peer engineer. Use for planning, debugging, explaining, fixing, exploring, or answering questions. Gemini excels at architecture, patterns, and scalability.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
  ask_multi: {
    name: 'ask_multi',
    description: "Ask both Codex and Gemini CLIs for help in parallel. Get multiple perspectives on planning, debugging, explaining, or any task. Synthesize the responses yourself.",
    inputSchema: {
      type: 'object',
      properties: {
        workingDir: {
          type: 'string',
          description: 'Working directory for filesystem access',
        },
        prompt: {
          type: 'string',
          description: 'Your question or request',
        },
        taskType: {
          type: 'string',
          enum: ['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general'],
          description: 'Hint about the type of task',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files the peer should focus on',
        },
        context: {
          type: 'string',
          description: 'Additional context (error messages, prior analysis)',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['security', 'performance', 'architecture', 'correctness', 'maintainability', 'scalability', 'testing', 'documentation'],
          },
          description: 'Areas to focus on',
        },
        customPrompt: {
          type: 'string',
          description: 'Additional instructions for the peer',
        },
        serviceTier: {
          type: 'string',
          enum: ['default', 'fast', 'flex'],
          description: 'Codex service tier (fast = priority processing, flex = cheaper/slower). Only applies to Codex.',
        },
      },
      required: ['workingDir', 'prompt'],
    },
  },
};
