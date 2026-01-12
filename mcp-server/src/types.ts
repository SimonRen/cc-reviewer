/**
 * Types for AI Reviewer MCP Server
 */

// Supported output types from Claude Code
export type OutputType = 'plan' | 'findings' | 'analysis' | 'proposal';

// Supported focus areas for review
export type FocusArea =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'correctness'
  | 'maintainability'
  | 'scalability'
  | 'testing'
  | 'documentation';

// Supported CLI types
export type CliType = 'codex' | 'gemini';

// Reasoning effort level for Codex
export type ReasoningEffort = 'high' | 'xhigh';

// Request to get feedback from an external CLI
export interface FeedbackRequest {
  workingDir: string;         // CLI working directory
  ccOutput: string;           // CC's findings/plan (small)
  outputType: OutputType;     // What type of output
  analyzedFiles?: string[];   // File paths CC referenced
  focusAreas?: FocusArea[];   // Areas to focus review
  customPrompt?: string;      // User's custom instructions
  reasoningEffort?: ReasoningEffort; // Codex reasoning effort (default: high)
}

// Successful feedback result
export interface FeedbackSuccess {
  success: true;
  feedback: string;
  model: CliType;
}

// Failed feedback result
export interface FeedbackFailure {
  success: false;
  error: FeedbackError;
  suggestion?: string;
  model: CliType;
}

export type FeedbackResult = FeedbackSuccess | FeedbackFailure;

// Error types for feedback failures
export type FeedbackError =
  | { type: 'cli_not_found'; cli: CliType; installCmd: string }
  | { type: 'timeout'; cli: CliType; durationMs: number }
  | { type: 'rate_limit'; cli: CliType; retryAfterMs?: number }
  | { type: 'auth_error'; cli: CliType; message: string }
  | { type: 'invalid_response'; cli: CliType; rawOutput: string }
  | { type: 'cli_error'; cli: CliType; exitCode: number; stderr: string };

// Result from multi-model review
export interface MultiFeedbackResult {
  successful: Array<{ model: CliType; feedback: string }>;
  failed: Array<{ model: CliType; error: FeedbackError }>;
  partialSuccess: boolean;
  allFailed: boolean;
}

// CLI availability status
export interface CliStatus {
  codex: boolean;
  gemini: boolean;
}

// Structured feedback output from external CLI
export interface StructuredFeedback {
  agreements: Array<{ finding: string; reason: string }>;
  disagreements: Array<{ finding: string; reason: string; correction: string }>;
  additions: Array<{ finding: string; location: string; impact: string }>;
  alternatives: Array<{ topic: string; alternative: string; tradeoffs: string }>;
  riskAssessment: { level: 'Low' | 'Medium' | 'High'; reason: string };
}

// Reviewer persona configuration
export interface ReviewerPersona {
  name: string;
  focus: string;
  style: string;
}

export const REVIEWER_PERSONAS: Record<CliType, ReviewerPersona> = {
  codex: {
    name: 'Codex',
    focus: 'correctness, edge cases, performance',
    style: 'Apply pragmatic skepticism - verify before agreeing.'
  },
  gemini: {
    name: 'Gemini',
    focus: 'design patterns, scalability, tech debt',
    style: 'Think holistically - consider broader context.'
  }
};

// Focus area descriptions
export const FOCUS_AREA_DESCRIPTIONS: Record<FocusArea, string> = {
  security: 'Vulnerabilities, auth, input validation',
  performance: 'Speed, memory, efficiency',
  architecture: 'Design patterns, structure, coupling',
  correctness: 'Logic errors, edge cases, bugs',
  maintainability: 'Code clarity, documentation, complexity',
  scalability: 'Load handling, bottlenecks',
  testing: 'Test coverage, test quality',
  documentation: 'Comments, docs, API docs'
};
