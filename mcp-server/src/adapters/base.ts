/**
 * Base Adapter Interface for AI Reviewers
 *
 * This provides a generic interface that any AI CLI can implement.
 * Makes it easy to add new models (Ollama, Azure, etc.) without
 * changing the core orchestration logic.
 */

// Schema types no longer used — adapters return raw text, CC handles interpretation
import { FocusArea, OutputType, ReasoningEffort, ServiceTier, TaskType } from '../types.js';

// =============================================================================
// REVIEWER CAPABILITIES
// =============================================================================

export interface ReviewerCapabilities {
  /** Display name for this reviewer */
  name: string;

  /** Short description of the reviewer's strengths */
  description: string;

  /** Focus areas this reviewer excels at */
  strengths: FocusArea[];

  /** Focus areas this reviewer is weaker at */
  weaknesses: FocusArea[];

  /** Whether the reviewer can read files from the filesystem */
  hasFilesystemAccess: boolean;

  /** Whether the reviewer supports JSON structured output */
  supportsStructuredOutput: boolean;

  /** Maximum context window size (tokens) */
  maxContextTokens: number;

  /** Supported reasoning effort levels (if applicable) */
  reasoningLevels?: ReasoningEffort[];
}

// =============================================================================
// REVIEW REQUEST
// =============================================================================

export interface ReviewRequest {
  /** Working directory containing the code */
  workingDir: string;

  /** Claude Code's output to review */
  ccOutput: string;

  /** Type of output being reviewed */
  outputType: OutputType;

  /** Specific files that CC analyzed */
  analyzedFiles?: string[];

  /** Areas to focus the review on */
  focusAreas?: FocusArea[];

  /** Custom instructions from the user */
  customPrompt?: string;

  /** Reasoning effort level (for models that support it) */
  reasoningEffort?: ReasoningEffort;

  /** Service tier (for models that support it: priority = fast, flex = cheap) */
  serviceTier?: ServiceTier;
}

// =============================================================================
// EXPERT ROLES (Legacy — used by prompt.ts and src/cli/ wrappers)
// Active MCP adapters use handoff.ts roles instead.
// =============================================================================

/** @deprecated Use handoff.ts roles instead */
export interface ExpertRole {
  name: string;
  description: string;
  systemPrompt: string;
  focusAreas: FocusArea[];
  evaluationCriteria: string[];
}

/** @deprecated Use handoff.ts selectRole() instead */
export const EXPERT_ROLES: Record<string, ExpertRole> = {
  security_auditor: {
    name: 'Security Auditor', description: 'Security vulnerabilities',
    systemPrompt: 'Security auditor. Focus on injection, auth bypass, data exposure, input validation.',
    focusAreas: ['security'], evaluationCriteria: ['Injection', 'Auth', 'Data exposure'],
  },
  performance_engineer: {
    name: 'Performance Engineer', description: 'Performance optimization',
    systemPrompt: 'Performance engineer. Focus on complexity, N+1 queries, memory leaks.',
    focusAreas: ['performance', 'scalability'], evaluationCriteria: ['Complexity', 'Memory', 'I/O'],
  },
  architect: {
    name: 'Software Architect', description: 'Architecture and design',
    systemPrompt: 'Software architect. Focus on SOLID, coupling, abstractions.',
    focusAreas: ['architecture', 'maintainability'], evaluationCriteria: ['SOLID', 'Coupling', 'Patterns'],
  },
  correctness_analyst: {
    name: 'Correctness Analyst', description: 'Logic errors and bugs',
    systemPrompt: 'Correctness analyst. Focus on logic errors, edge cases, race conditions.',
    focusAreas: ['correctness', 'testing'], evaluationCriteria: ['Logic', 'Edge cases', 'Concurrency'],
  },
  general_reviewer: {
    name: 'General Reviewer', description: 'Balanced review',
    systemPrompt: 'Senior engineer. Review correctness, security, performance, maintainability.',
    focusAreas: ['security', 'performance', 'architecture', 'correctness', 'maintainability'],
    evaluationCriteria: ['Correctness', 'Security', 'Performance', 'Quality'],
  },
};

/** @deprecated Use handoff.ts selectRole() instead */
export function selectExpertRole(focusAreas?: FocusArea[]): ExpertRole {
  if (!focusAreas || focusAreas.length === 0) return EXPERT_ROLES.general_reviewer;
  if (focusAreas.includes('security')) return EXPERT_ROLES.security_auditor;
  if (focusAreas.includes('performance') || focusAreas.includes('scalability')) return EXPERT_ROLES.performance_engineer;
  if (focusAreas.includes('architecture') || focusAreas.includes('maintainability')) return EXPERT_ROLES.architect;
  if (focusAreas.includes('correctness') || focusAreas.includes('testing')) return EXPERT_ROLES.correctness_analyst;
  return EXPERT_ROLES.general_reviewer;
}

// =============================================================================
// PEER REQUEST (General-purpose coworker tasks)
// =============================================================================

export interface PeerRequest {
  /** Working directory containing the code */
  workingDir: string;

  /** The question or request from CC */
  prompt: string;

  /** Hint about the type of task */
  taskType?: TaskType;

  /** Files the peer should focus on */
  relevantFiles?: string[];

  /** Additional context (error messages, prior analysis) */
  context?: string;

  /** Areas to focus on */
  focusAreas?: FocusArea[];

  /** Custom instructions from the user */
  customPrompt?: string;

  /** Reasoning effort level (for models that support it) */
  reasoningEffort?: ReasoningEffort;

  /** Service tier (for models that support it: priority = fast, flex = cheap) */
  serviceTier?: ServiceTier;
}

// =============================================================================
// EXPERT ROLES (Specialized prompts per focus area)
// =============================================================================

// =============================================================================
// REVIEW RESULT
// =============================================================================

export interface ReviewSuccess {
  success: true;
  output: string;  // Raw reviewer text — CC interprets it
  executionTimeMs: number;
}

export interface ReviewFailure {
  success: false;
  error: ReviewError;
  suggestion?: string;
  rawOutput?: string;
  executionTimeMs: number;
}

export type ReviewResult = ReviewSuccess | ReviewFailure;

export interface ReviewError {
  type: 'cli_not_found' | 'timeout' | 'rate_limit' | 'auth_error' | 'invalid_response' | 'cli_error' | 'parse_error';
  message: string;
  details?: Record<string, unknown>;
}


// =============================================================================
// PEER RESULT
// =============================================================================

export interface PeerSuccess {
  success: true;
  output: string;  // Raw peer text — CC interprets it
  executionTimeMs: number;
}

export interface PeerFailure {
  success: false;
  error: ReviewError;
  suggestion?: string;
  rawOutput?: string;
  executionTimeMs: number;
}

export type PeerResult = PeerSuccess | PeerFailure;

// =============================================================================
// REVIEWER ADAPTER INTERFACE
// =============================================================================

/**
 * Base interface that all reviewer adapters must implement.
 * This allows easy addition of new AI CLIs without changing orchestration logic.
 */
export interface ReviewerAdapter {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** Get capabilities and metadata for this reviewer */
  getCapabilities(): ReviewerCapabilities;

  /** Check if the CLI is available and properly configured */
  isAvailable(): Promise<boolean>;

  /** Run a review and return structured output */
  runReview(request: ReviewRequest): Promise<ReviewResult>;

  /** Run a general-purpose peer request and return structured output */
  runPeerRequest(request: PeerRequest): Promise<PeerResult>;

  /**
   * Optional: Run peer review of another model's output
   * Future capability - not currently implemented by any adapter
   */
  runPeerReview?(
    originalRequest: ReviewRequest,
    reviewToScore: string
  ): Promise<ReviewResult>;
}

// =============================================================================
// ADAPTER REGISTRY
// =============================================================================

const adapterRegistry = new Map<string, ReviewerAdapter>();

export function registerAdapter(adapter: ReviewerAdapter): void {
  adapterRegistry.set(adapter.id, adapter);
}

export function getAdapter(id: string): ReviewerAdapter | undefined {
  return adapterRegistry.get(id);
}

export function getAllAdapters(): ReviewerAdapter[] {
  return Array.from(adapterRegistry.values());
}

export async function getAvailableAdapters(): Promise<ReviewerAdapter[]> {
  const adapters = getAllAdapters();
  const availability = await Promise.all(
    adapters.map(async (adapter) => ({
      adapter,
      available: await adapter.isAvailable(),
    }))
  );
  return availability.filter((a) => a.available).map((a) => a.adapter);
}

/**
 * Select the best available adapter for given focus areas
 */
export async function selectBestAdapter(focusAreas?: FocusArea[]): Promise<ReviewerAdapter | null> {
  const available = await getAvailableAdapters();
  if (available.length === 0) return null;

  if (!focusAreas || focusAreas.length === 0) {
    return available[0]; // Return first available
  }

  // Score each adapter by how well it matches the focus areas
  const scored = available.map((adapter) => {
    const caps = adapter.getCapabilities();
    let score = 0;

    for (const focus of focusAreas) {
      if (caps.strengths.includes(focus)) score += 2;
      else if (!caps.weaknesses.includes(focus)) score += 1;
      else score -= 1;
    }

    return { adapter, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].adapter;
}
