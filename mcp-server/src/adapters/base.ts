/**
 * Base Adapter Interface for AI Reviewers
 *
 * This provides a generic interface that any AI CLI can implement.
 * Makes it easy to add new models (Ollama, Azure, etc.) without
 * changing the core orchestration logic.
 */

import { ReviewOutput, ReviewFinding, PeerOutput } from '../schema.js';
import { FocusArea, OutputType, ReasoningEffort, TaskType } from '../types.js';

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

  /** Expert role configuration (optional override) */
  expertRole?: ExpertRole;
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
}

// =============================================================================
// EXPERT ROLES (Specialized prompts per focus area)
// =============================================================================

export interface ExpertRole {
  name: string;
  description: string;
  systemPrompt: string;
  focusAreas: FocusArea[];
  evaluationCriteria: string[];
}

export const EXPERT_ROLES: Record<string, ExpertRole> = {
  security_auditor: {
    name: 'Security Auditor',
    description: 'Specializes in security vulnerabilities and secure coding practices',
    systemPrompt: `You are a senior security auditor with expertise in:
- OWASP Top 10 vulnerabilities (injection, broken auth, XSS, CSRF, etc.)
- Authentication and authorization flaws
- Input validation and sanitization
- Cryptographic weaknesses and misuse
- Sensitive data exposure
- Security misconfigurations
- Dependency vulnerabilities

When reviewing code:
1. Identify specific vulnerability patterns with CWE IDs when applicable
2. Rate severity using CVSS-like scoring (critical/high/medium/low/info)
3. Provide concrete proof-of-concept or attack scenarios
4. Suggest specific remediations with code examples
5. Note any security best practices being followed (to validate CC's work)`,
    focusAreas: ['security'],
    evaluationCriteria: [
      'SQL/NoSQL injection vectors',
      'XSS (stored, reflected, DOM)',
      'Authentication bypass',
      'Authorization flaws (IDOR, privilege escalation)',
      'Insecure deserialization',
      'SSRF vulnerabilities',
      'Path traversal',
      'Command injection',
      'Secrets in code',
      'Insecure dependencies',
    ],
  },

  performance_engineer: {
    name: 'Performance Engineer',
    description: 'Specializes in performance optimization and efficiency',
    systemPrompt: `You are a senior performance engineer with expertise in:
- Algorithm complexity analysis (Big-O notation)
- Memory management and leak detection
- Database query optimization
- Caching strategies
- Concurrency and parallelism
- I/O optimization
- Bundle size and load time optimization

When reviewing code:
1. Analyze algorithmic complexity with Big-O notation
2. Identify memory leaks, unnecessary allocations, or retention issues
3. Spot N+1 query problems and suggest batching/caching
4. Recommend specific optimizations with expected improvements
5. Validate any performance claims from CC with analysis`,
    focusAreas: ['performance', 'scalability'],
    evaluationCriteria: [
      'Time complexity',
      'Space complexity',
      'Memory leaks',
      'Unnecessary re-renders',
      'N+1 queries',
      'Missing indexes',
      'Inefficient loops',
      'Blocking operations',
      'Cache invalidation',
      'Resource pooling',
    ],
  },

  architect: {
    name: 'Software Architect',
    description: 'Specializes in design patterns, architecture, and maintainability',
    systemPrompt: `You are a senior software architect with expertise in:
- Design patterns (GoF, enterprise patterns)
- SOLID principles
- Clean architecture and DDD
- API design and contracts
- Dependency management
- Code organization and modularity
- Technical debt assessment

When reviewing code:
1. Evaluate adherence to design patterns and principles
2. Identify coupling issues and suggest decoupling strategies
3. Assess abstraction levels and cohesion
4. Recommend refactoring opportunities with specific patterns
5. Evaluate API design for consistency and usability`,
    focusAreas: ['architecture', 'maintainability'],
    evaluationCriteria: [
      'Single responsibility',
      'Open/closed principle',
      'Liskov substitution',
      'Interface segregation',
      'Dependency inversion',
      'Coupling and cohesion',
      'Abstraction levels',
      'Error handling patterns',
      'API consistency',
      'Technical debt indicators',
    ],
  },

  correctness_analyst: {
    name: 'Correctness Analyst',
    description: 'Specializes in logic errors, edge cases, and bugs',
    systemPrompt: `You are a meticulous code analyst focused on correctness:
- Logic errors and off-by-one mistakes
- Edge cases and boundary conditions
- Null/undefined handling
- Type safety issues
- Race conditions and concurrency bugs
- Error handling completeness
- State management issues

When reviewing code:
1. Trace execution paths looking for logic errors
2. Identify missing edge case handling
3. Spot potential null pointer/undefined errors
4. Check for race conditions in async code
5. Verify error handling covers failure modes`,
    focusAreas: ['correctness', 'testing'],
    evaluationCriteria: [
      'Off-by-one errors',
      'Null/undefined safety',
      'Boundary conditions',
      'Integer overflow',
      'Floating point precision',
      'Race conditions',
      'Deadlocks',
      'Exception handling',
      'State consistency',
      'Test coverage gaps',
    ],
  },

  general_reviewer: {
    name: 'General Reviewer',
    description: 'Balanced review across all areas',
    systemPrompt: `You are a senior software engineer conducting a thorough code review.
Review the code across multiple dimensions:
- Correctness: Logic errors, edge cases, bugs
- Security: Vulnerabilities, input validation
- Performance: Efficiency, complexity
- Maintainability: Readability, patterns, documentation

Prioritize findings by impact and likelihood. Be specific with file paths
and line numbers. Provide actionable suggestions.`,
    focusAreas: ['security', 'performance', 'architecture', 'correctness', 'maintainability'],
    evaluationCriteria: [
      'Logic correctness',
      'Security vulnerabilities',
      'Performance issues',
      'Code quality',
      'Documentation',
    ],
  },
};

/**
 * Select the best expert role based on requested focus areas
 */
export function selectExpertRole(focusAreas?: FocusArea[]): ExpertRole {
  if (!focusAreas || focusAreas.length === 0) {
    return EXPERT_ROLES.general_reviewer;
  }

  // Prioritize security if it's in the list
  if (focusAreas.includes('security')) {
    return EXPERT_ROLES.security_auditor;
  }

  // Check for performance/scalability
  if (focusAreas.includes('performance') || focusAreas.includes('scalability')) {
    return EXPERT_ROLES.performance_engineer;
  }

  // Check for architecture/maintainability
  if (focusAreas.includes('architecture') || focusAreas.includes('maintainability')) {
    return EXPERT_ROLES.architect;
  }

  // Check for correctness/testing
  if (focusAreas.includes('correctness') || focusAreas.includes('testing')) {
    return EXPERT_ROLES.correctness_analyst;
  }

  return EXPERT_ROLES.general_reviewer;
}

// =============================================================================
// REVIEW RESULT
// =============================================================================

export interface ReviewSuccess {
  success: true;
  output: ReviewOutput;
  rawOutput?: string; // Original output for debugging
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
  output: PeerOutput;
  rawOutput?: string;
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
    reviewToScore: ReviewOutput
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
