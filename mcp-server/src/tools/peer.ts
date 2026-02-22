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
import { PeerOutput } from '../schema.js';

export type PeerInput = {
  workingDir: string;
  prompt: string;
  taskType?: string;
  relevantFiles?: string[];
  context?: string;
  focusAreas?: string[];
  customPrompt?: string;
  reasoningEffort?: 'high' | 'xhigh';
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
  };
}

export function formatPeerResponse(result: PeerResult, modelName: string): string {
  if (!result.success) {
    return formatPeerErrorResponse(result.error, result.suggestion);
  }

  const output = result.output;
  const lines: string[] = [];

  lines.push(`## ${modelName} Response\n`);
  lines.push(`**Execution Time:** ${(result.executionTimeMs / 1000).toFixed(1)}s`);
  lines.push(`**Confidence:** ${Math.round(output.confidence * 100)}%\n`);

  // Main answer
  lines.push(`### Answer\n`);
  lines.push(output.answer);
  lines.push('');

  // Key points
  if (output.key_points.length > 0) {
    lines.push(`### Key Points\n`);
    for (const point of output.key_points) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  // Suggested actions
  if (output.suggested_actions.length > 0) {
    lines.push(`### Suggested Actions\n`);
    const priorityEmoji: Record<string, string> = {
      high: '🔴', medium: '🟡', low: '🟢',
    };
    for (const action of output.suggested_actions) {
      lines.push(`${priorityEmoji[action.priority] || '•'} **${action.action}**`);
      if (action.file) {
        lines.push(`  📍 ${action.file}`);
      }
      lines.push(`  ${action.rationale}`);
      lines.push('');
    }
  }

  // File references
  if (output.file_references.length > 0) {
    lines.push(`### Files Examined\n`);
    for (const ref of output.file_references) {
      const loc = ref.lines ? `${ref.path}:${ref.lines}` : ref.path;
      lines.push(`- \`${loc}\` — ${ref.relevance}`);
    }
    lines.push('');
  }

  // Alternatives
  if (output.alternatives && output.alternatives.length > 0) {
    lines.push(`### Alternatives\n`);
    for (const alt of output.alternatives) {
      lines.push(`**${alt.topic}**`);
      lines.push(`  Current: ${alt.current_approach}`);
      lines.push(`  Alternative: ${alt.alternative}`);
      lines.push(`  Recommendation: ${alt.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatPeerErrorResponse(error: { type: string; message: string }, suggestion?: string): string {
  const emoji: Record<string, string> = {
    cli_not_found: '❌',
    timeout: '⏱️',
    rate_limit: '🚫',
    auth_error: '🔐',
    parse_error: '⚠️',
    cli_error: '❌',
  };

  let response = `${emoji[error.type] || '❌'} **${error.type}**: ${error.message}`;

  if (suggestion) {
    response += `\n\n💡 ${suggestion}`;
  }

  return response;
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

  return { content: [{ type: 'text', text: formatPeerResponse(result, 'Codex') }] };
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

  return { content: [{ type: 'text', text: formatPeerResponse(result, 'Gemini') }] };
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

  const successful: { model: string; output: PeerOutput }[] = [];
  const failed: { model: string; error: string }[] = [];

  for (const { adapter, result } of results) {
    if (result.success) {
      successful.push({ model: adapter.id, output: result.output });
    } else {
      failed.push({ model: adapter.id, error: result.error.message });
    }
  }

  const lines: string[] = [];

  if (failed.length === results.length) {
    lines.push('## Multi-Model Response ❌ All Failed\n');
  } else if (failed.length > 0) {
    lines.push('## Multi-Model Response ⚠️ Partial Success\n');
  } else {
    lines.push('## Multi-Model Response ✓\n');
  }

  lines.push(`**Models:** ${availableAdapters.map(a => a.id).join(', ')}`);
  lines.push('');

  for (const { model, output } of successful) {
    lines.push(`### ${model.charAt(0).toUpperCase() + model.slice(1)} Response\n`);
    lines.push(formatPeerResponse({ success: true, output, executionTimeMs: 0 }, model));
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('### Failures\n');
    for (const { model, error } of failed) {
      lines.push(`**${model}:** ${error}`);
    }
    lines.push('');
  }

  if (successful.length > 1) {
    lines.push(`---\n\n**Synthesis Instructions:**\n- Compare perspectives from each model\n- Note agreements and disagreements\n- Use your judgment to form a final answer`);
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
      },
      required: ['workingDir', 'prompt'],
    },
  },
};
