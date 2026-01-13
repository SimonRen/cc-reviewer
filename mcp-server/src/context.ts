/**
 * Rich Context Protocol for Review Handoff
 *
 * Defines the structured information that should flow from CC to reviewers.
 * This replaces the simple "ccOutput: string" with a rich, queryable context.
 */

import { z } from 'zod';

// =============================================================================
// FILE CHANGE CONTEXT
// =============================================================================

/**
 * Represents a change to a single file with semantic understanding
 */
export const FileChangeSchema = z.object({
  path: z.string().describe('Relative path from working directory'),
  language: z.string().optional().describe('Programming language'),
  changeType: z.enum(['created', 'modified', 'deleted', 'renamed']),

  // The actual changes
  diff: z.string().optional().describe('Unified diff format'),
  linesAdded: z.number().int().nonnegative().optional(),
  linesRemoved: z.number().int().nonnegative().optional(),

  // For small/new files, include full content
  content: z.string().optional().describe('Full file content (for new/small files)'),

  // Semantic understanding
  changedSymbols: z.array(z.object({
    name: z.string(),
    type: z.enum(['function', 'class', 'variable', 'type', 'import', 'export', 'other']),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
  })).optional().describe('Symbols that were modified'),

  // Relationships
  imports: z.array(z.string()).optional().describe('Modules this file imports'),
  importedBy: z.array(z.string()).optional().describe('Files that import this module'),
  testFile: z.string().optional().describe('Related test file path'),
});
export type FileChange = z.infer<typeof FileChangeSchema>;

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Results from running tests, build, lint, etc.
 */
export const ExecutionContextSchema = z.object({
  // Test results
  tests: z.object({
    ran: z.boolean(),
    passed: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
    skipped: z.number().int().nonnegative().optional(),
    failures: z.array(z.object({
      testName: z.string(),
      file: z.string().optional(),
      error: z.string(),
    })).optional(),
  }).optional(),

  // Build status
  build: z.object({
    ran: z.boolean(),
    success: z.boolean().optional(),
    errors: z.array(z.object({
      file: z.string(),
      line: z.number().int().positive().optional(),
      message: z.string(),
    })).optional(),
    warnings: z.array(z.object({
      file: z.string(),
      line: z.number().int().positive().optional(),
      message: z.string(),
    })).optional(),
  }).optional(),

  // Type checking
  typeCheck: z.object({
    ran: z.boolean(),
    errors: z.array(z.object({
      file: z.string(),
      line: z.number().int().positive().optional(),
      message: z.string(),
      code: z.string().optional(), // e.g., "TS2345"
    })).optional(),
  }).optional(),

  // Linting
  lint: z.object({
    ran: z.boolean(),
    issues: z.array(z.object({
      file: z.string(),
      line: z.number().int().positive().optional(),
      rule: z.string().optional(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string(),
    })).optional(),
  }).optional(),
});
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

// =============================================================================
// GIT CONTEXT
// =============================================================================

export const GitContextSchema = z.object({
  branch: z.string().optional(),
  baseBranch: z.string().optional().describe('Branch this was based on (e.g., main)'),

  // Recent commits by CC
  commits: z.array(z.object({
    hash: z.string(),
    message: z.string(),
    filesChanged: z.array(z.string()),
  })).optional(),

  // If this is for a PR
  pullRequest: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    targetBranch: z.string().optional(),
  }).optional(),

  // Uncommitted changes
  uncommittedChanges: z.boolean().optional(),
});
export type GitContext = z.infer<typeof GitContextSchema>;

// =============================================================================
// CC'S ANALYSIS & DECISIONS
// =============================================================================

export const CCAnalysisSchema = z.object({
  // What CC was asked to do
  originalRequest: z.string().describe("User's original request/task"),
  taskType: z.enum(['feature', 'bugfix', 'refactor', 'security-fix', 'performance', 'review', 'other']).optional(),

  // What CC did
  summary: z.string().describe('Brief summary of changes made'),

  // CC's findings (if reviewing/analyzing)
  findings: z.array(z.object({
    category: z.string(),
    description: z.string(),
    location: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    addressed: z.boolean().optional().describe('Whether CC already fixed this'),
  })).optional(),

  // What CC is uncertain about
  uncertainties: z.array(z.object({
    topic: z.string(),
    question: z.string(),
    ccBestGuess: z.string().optional().describe("CC's current assumption"),
  })).optional().describe('Things CC is unsure about - reviewer should verify'),

  // Assumptions CC made
  assumptions: z.array(z.string()).optional(),

  // Decisions CC made and why
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternatives: z.array(z.string()).optional(),
  })).optional(),

  // Overall confidence
  confidence: z.number().min(0).max(1).optional().describe("CC's overall confidence in the work"),
});
export type CCAnalysis = z.infer<typeof CCAnalysisSchema>;

// =============================================================================
// REVIEW SCOPE & GUIDANCE
// =============================================================================

export const ReviewScopeSchema = z.object({
  // What MUST be reviewed (critical paths)
  mustReview: z.array(z.object({
    path: z.string(),
    reason: z.string(),
    specificConcerns: z.array(z.string()).optional(),
  })).optional(),

  // What SHOULD be reviewed (important but not critical)
  shouldReview: z.array(z.object({
    path: z.string(),
    reason: z.string(),
  })).optional(),

  // What MAY be reviewed (nice to have)
  mayReview: z.array(z.string()).optional(),

  // What to SKIP (already validated, unchanged, etc.)
  skipReview: z.array(z.object({
    path: z.string(),
    reason: z.string(),
  })).optional(),

  // Specific questions CC wants answered
  questions: z.array(z.object({
    question: z.string(),
    context: z.string().optional(),
    relevantFiles: z.array(z.string()).optional(),
    ccAnswer: z.string().optional().describe("What CC thinks - for comparison"),
  })).optional(),
});
export type ReviewScope = z.infer<typeof ReviewScopeSchema>;

// =============================================================================
// FULL REVIEW CONTEXT
// =============================================================================

/**
 * Complete context for a review request.
 * This is what should be passed from CC to reviewers.
 */
export const ReviewContextSchema = z.object({
  // Metadata
  timestamp: z.string().datetime().optional(),
  workingDir: z.string(),

  // Code changes
  changes: z.object({
    files: z.array(FileChangeSchema),
    totalLinesAdded: z.number().int().nonnegative().optional(),
    totalLinesRemoved: z.number().int().nonnegative().optional(),
    impactedModules: z.array(z.string()).optional(),
  }),

  // CC's work
  analysis: CCAnalysisSchema,

  // Execution results
  execution: ExecutionContextSchema.optional(),

  // Git info
  git: GitContextSchema.optional(),

  // Review guidance
  scope: ReviewScopeSchema.optional(),

  // Focus areas
  focusAreas: z.array(z.string()).optional(),

  // Custom instructions
  customInstructions: z.string().optional(),
});
export type ReviewContext = z.infer<typeof ReviewContextSchema>;

// =============================================================================
// CONTEXT BUILDERS
// =============================================================================

/**
 * Build a minimal context from legacy inputs
 */
export function buildMinimalContext(
  workingDir: string,
  ccOutput: string,
  analyzedFiles?: string[],
  focusAreas?: string[],
  customPrompt?: string
): ReviewContext {
  return {
    workingDir,
    changes: {
      files: (analyzedFiles || []).map(path => ({
        path,
        changeType: 'modified' as const,
      })),
    },
    analysis: {
      originalRequest: 'Not specified',
      summary: ccOutput,
    },
    focusAreas,
    customInstructions: customPrompt,
  };
}

/**
 * Build context from git diff
 */
export async function buildContextFromGitDiff(
  workingDir: string,
  baseBranch: string = 'main'
): Promise<Partial<ReviewContext>> {
  // This would shell out to git to get actual diff info
  // For now, return a placeholder
  return {
    workingDir,
    git: {
      baseBranch,
    },
  };
}

// =============================================================================
// CONTEXT OPTIMIZATION
// =============================================================================

export interface OptimizationOptions {
  maxTokens: number;
  focusAreas?: string[];
  includeFullContent: boolean;
  includeDiffs: boolean;
}

/**
 * Optimize context to fit within token limits while preserving important info
 */
export function optimizeContext(
  context: ReviewContext,
  options: OptimizationOptions
): ReviewContext {
  const optimized = { ...context };

  // Prioritize files based on focus areas
  if (options.focusAreas && options.focusAreas.length > 0) {
    const priorityPatterns = getPriorityPatterns(options.focusAreas);

    optimized.changes.files = optimized.changes.files.sort((a, b) => {
      const aPriority = getPriority(a.path, priorityPatterns);
      const bPriority = getPriority(b.path, priorityPatterns);
      return bPriority - aPriority;
    });
  }

  // Truncate diffs if too large
  if (!options.includeDiffs) {
    optimized.changes.files = optimized.changes.files.map(f => ({
      ...f,
      diff: undefined,
    }));
  }

  // Remove full content if not needed
  if (!options.includeFullContent) {
    optimized.changes.files = optimized.changes.files.map(f => ({
      ...f,
      content: undefined,
    }));
  }

  return optimized;
}

function getPriorityPatterns(focusAreas: string[]): RegExp[] {
  const patterns: RegExp[] = [];

  if (focusAreas.includes('security')) {
    patterns.push(/auth/i, /login/i, /password/i, /crypto/i, /token/i, /api/i);
  }
  if (focusAreas.includes('performance')) {
    patterns.push(/database/i, /query/i, /cache/i, /service/i);
  }
  if (focusAreas.includes('testing')) {
    patterns.push(/test/i, /spec/i, /mock/i);
  }

  return patterns;
}

function getPriority(path: string, patterns: RegExp[]): number {
  return patterns.filter(p => p.test(path)).length;
}

// =============================================================================
// CONTEXT SERIALIZATION FOR PROMPTS
// =============================================================================

/**
 * Convert context to a string suitable for inclusion in prompts
 */
export function contextToPromptString(context: ReviewContext): string {
  const sections: string[] = [];

  // Section 1: Task Overview
  sections.push(`## Task Overview
**Original Request:** ${context.analysis.originalRequest}
**Summary:** ${context.analysis.summary}
${context.analysis.taskType ? `**Task Type:** ${context.analysis.taskType}` : ''}
${context.analysis.confidence !== undefined ? `**CC Confidence:** ${Math.round(context.analysis.confidence * 100)}%` : ''}`);

  // Section 2: Files Changed
  if (context.changes.files.length > 0) {
    sections.push(`\n## Files Changed (${context.changes.files.length})`);

    for (const file of context.changes.files) {
      let fileInfo = `\n### ${file.path} [${file.changeType}]`;

      if (file.changedSymbols && file.changedSymbols.length > 0) {
        fileInfo += `\nModified: ${file.changedSymbols.map(s => `${s.name} (${s.type})`).join(', ')}`;
      }

      if (file.linesAdded !== undefined || file.linesRemoved !== undefined) {
        fileInfo += `\nLines: +${file.linesAdded || 0} / -${file.linesRemoved || 0}`;
      }

      if (file.diff) {
        fileInfo += `\n\`\`\`diff\n${file.diff}\n\`\`\``;
      }

      sections.push(fileInfo);
    }
  }

  // Section 3: CC's Uncertainties (IMPORTANT for reviewer)
  if (context.analysis.uncertainties && context.analysis.uncertainties.length > 0) {
    sections.push(`\n## CC's Uncertainties (Please Verify)`);
    for (const u of context.analysis.uncertainties) {
      sections.push(`\n**${u.topic}**
Question: ${u.question}
${u.ccBestGuess ? `CC's guess: ${u.ccBestGuess}` : ''}`);
    }
  }

  // Section 4: Questions for Reviewer
  if (context.scope?.questions && context.scope.questions.length > 0) {
    sections.push(`\n## Specific Questions`);
    for (const q of context.scope.questions) {
      sections.push(`\n- ${q.question}${q.ccAnswer ? ` (CC thinks: ${q.ccAnswer})` : ''}`);
    }
  }

  // Section 5: Execution Results
  if (context.execution) {
    const exec = context.execution;
    const execLines: string[] = [];

    if (exec.tests?.ran) {
      const t = exec.tests;
      execLines.push(`Tests: ${t.passed || 0} passed, ${t.failed || 0} failed, ${t.skipped || 0} skipped`);
      if (t.failures && t.failures.length > 0) {
        for (const f of t.failures.slice(0, 3)) {
          execLines.push(`  ❌ ${f.testName}: ${f.error.slice(0, 100)}`);
        }
      }
    }

    if (exec.build?.ran) {
      execLines.push(`Build: ${exec.build.success ? '✓ Success' : '❌ Failed'}`);
    }

    if (exec.typeCheck?.ran && exec.typeCheck.errors && exec.typeCheck.errors.length > 0) {
      execLines.push(`Type Errors: ${exec.typeCheck.errors.length}`);
    }

    if (execLines.length > 0) {
      sections.push(`\n## Execution Results\n${execLines.join('\n')}`);
    }
  }

  // Section 6: Review Priorities
  if (context.scope?.mustReview && context.scope.mustReview.length > 0) {
    sections.push(`\n## Priority Review Areas`);
    for (const r of context.scope.mustReview) {
      sections.push(`- **${r.path}**: ${r.reason}`);
    }
  }

  return sections.join('\n');
}

// =============================================================================
// VERIFICATION HELPERS
// =============================================================================

/**
 * Data needed to verify reviewer claims
 */
export interface VerificationData {
  existingFiles: Set<string>;
  fileContents: Map<string, string>;
  fileLineCounts: Map<string, number>;
}

/**
 * Check if a file:line reference is valid
 */
export function verifyFileLineReference(
  reference: { file: string; line?: number },
  verification: VerificationData
): { valid: boolean; reason?: string } {
  if (!verification.existingFiles.has(reference.file)) {
    return { valid: false, reason: `File does not exist: ${reference.file}` };
  }

  if (reference.line !== undefined) {
    const lineCount = verification.fileLineCounts.get(reference.file);
    if (lineCount && reference.line > lineCount) {
      return { valid: false, reason: `Line ${reference.line} exceeds file length (${lineCount} lines)` };
    }
  }

  return { valid: true };
}
