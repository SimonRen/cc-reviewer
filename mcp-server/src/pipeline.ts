/**
 * Review Response Processing Pipeline
 *
 * Processes reviewer output through multiple stages:
 * 1. Parse - Extract structured data
 * 2. Verify - Check file/line references exist
 * 3. Cross-check - Compare with CC's knowledge
 * 4. Prioritize - Rank by impact and confidence
 * 5. Plan - Generate actionable next steps
 */

import { ReviewOutput, ReviewFinding } from './schema.js';
import { ReviewContext, VerificationData, verifyFileLineReference } from './context.js';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, normalize } from 'path';

// =============================================================================
// PIPELINE TYPES
// =============================================================================

export interface PipelineStage<TInput, TOutput> {
  name: string;
  process(input: TInput, context: PipelineContext): Promise<TOutput>;
}

export interface PipelineContext {
  workingDir: string;
  reviewContext: ReviewContext;
  verificationData?: VerificationData;
}

export interface VerifiedFinding extends ReviewFinding {
  verification: {
    fileExists: boolean;
    lineValid: boolean;
    codeSnippetMatches?: boolean;
    verificationNotes?: string;
  };
  crossCheck: {
    alreadyAddressedByCC: boolean;
    conflictsWithCC: boolean;
    ccMentioned: boolean;
  };
  adjustedConfidence: number; // After verification adjustments
}

export interface ActionItem {
  finding: VerifiedFinding;
  action: 'fix_now' | 'investigate' | 'defer' | 'reject';
  priority: number; // 0-100
  suggestedFix?: string;
  reason: string;
}

export interface ProcessedReview {
  original: ReviewOutput;
  verified: VerifiedFinding[];
  rejected: { finding: ReviewFinding; reason: string }[];
  actionPlan: ActionItem[];
  summary: {
    totalFindings: number;
    verifiedCount: number;
    rejectedCount: number;
    actionableCount: number;
    topPriority: ActionItem[];
  };
}

// =============================================================================
// FILE CACHE (Performance optimization)
// =============================================================================

/**
 * Simple file cache to avoid re-reading files for each finding
 */
export class FileCache {
  private contentCache = new Map<string, string | null>(); // null = file doesn't exist
  private lineCountCache = new Map<string, number>();
  private linesCache = new Map<string, string[]>();

  constructor(private workingDir: string) {}

  /**
   * Check if file exists (cached)
   */
  exists(relativePath: string): boolean {
    const fullPath = resolve(this.workingDir, normalize(relativePath));

    if (this.contentCache.has(fullPath)) {
      return this.contentCache.get(fullPath) !== null;
    }

    // Check existence and cache
    if (existsSync(fullPath)) {
      // Don't read content yet - just mark as existing
      return true;
    } else {
      this.contentCache.set(fullPath, null);
      return false;
    }
  }

  /**
   * Get file content (cached, lazy-loaded)
   */
  getContent(relativePath: string): string | null {
    const fullPath = resolve(this.workingDir, normalize(relativePath));

    if (this.contentCache.has(fullPath)) {
      return this.contentCache.get(fullPath) ?? null;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      this.contentCache.set(fullPath, content);
      return content;
    } catch {
      this.contentCache.set(fullPath, null);
      return null;
    }
  }

  /**
   * Get lines array (cached)
   */
  getLines(relativePath: string): string[] | null {
    const fullPath = resolve(this.workingDir, normalize(relativePath));

    if (this.linesCache.has(fullPath)) {
      return this.linesCache.get(fullPath) ?? null;
    }

    const content = this.getContent(relativePath);
    if (content === null) return null;

    const lines = content.split('\n');
    this.linesCache.set(fullPath, lines);
    this.lineCountCache.set(fullPath, lines.length);
    return lines;
  }

  /**
   * Get line count (cached)
   */
  getLineCount(relativePath: string): number | null {
    const fullPath = resolve(this.workingDir, normalize(relativePath));

    if (this.lineCountCache.has(fullPath)) {
      return this.lineCountCache.get(fullPath) ?? null;
    }

    const lines = this.getLines(relativePath);
    return lines?.length ?? null;
  }

  /**
   * Get stats about cache usage
   */
  getStats(): { filesChecked: number; filesLoaded: number } {
    let filesLoaded = 0;
    for (const content of this.contentCache.values()) {
      if (content !== null) filesLoaded++;
    }
    return {
      filesChecked: this.contentCache.size,
      filesLoaded,
    };
  }
}

// =============================================================================
// VERIFICATION STAGE
// =============================================================================

/**
 * Build verification data by scanning the filesystem
 */
export async function buildVerificationData(workingDir: string): Promise<VerificationData> {
  const existingFiles = new Set<string>();
  const fileContents = new Map<string, string>();
  const fileLineCounts = new Map<string, number>();

  // This would recursively scan the directory
  // For now, we'll verify on-demand
  return { existingFiles, fileContents, fileLineCounts };
}

/**
 * Verify a single finding's references
 * @param finding The finding to verify
 * @param workingDir Working directory for path resolution
 * @param cache Optional file cache for performance (recommended for multiple findings)
 */
export async function verifyFinding(
  finding: ReviewFinding,
  workingDir: string,
  cache?: FileCache
): Promise<VerifiedFinding> {
  const verification = {
    fileExists: true,
    lineValid: true,
    codeSnippetMatches: undefined as boolean | undefined,
    verificationNotes: undefined as string | undefined,
  };

  // Check file exists
  if (finding.location) {
    // Sanitize path to prevent traversal attacks
    const normalizedFile = normalize(finding.location.file);
    const fullPath = resolve(workingDir, normalizedFile);
    const resolvedWorkingDir = resolve(workingDir);

    // Block path traversal attempts (paths that escape working directory)
    if (!fullPath.startsWith(resolvedWorkingDir + '/') && fullPath !== resolvedWorkingDir) {
      verification.fileExists = false;
      verification.verificationNotes = `Path traversal blocked: ${finding.location.file}`;
      return {
        ...finding,
        verification,
        crossCheck: { alreadyAddressedByCC: false, conflictsWithCC: false, ccMentioned: false },
        adjustedConfidence: finding.confidence * 0.05, // Severe penalty for traversal attempt
      };
    }

    // Use cache if provided, otherwise direct filesystem access
    const fileExists = cache
      ? cache.exists(normalizedFile)
      : existsSync(fullPath);

    if (!fileExists) {
      verification.fileExists = false;
      verification.verificationNotes = `File not found: ${finding.location.file}`;
    } else if (finding.location.line_start) {
      // Check line count using cache
      try {
        const lines = cache
          ? cache.getLines(normalizedFile)
          : readFileSync(fullPath, 'utf-8').split('\n');

        if (!lines) {
          verification.verificationNotes = `Error reading file: ${finding.location.file}`;
        } else if (finding.location.line_start > lines.length) {
          verification.lineValid = false;
          verification.verificationNotes = `Line ${finding.location.line_start} exceeds file length (${lines.length} lines)`;
        } else {
          // If evidence provided, check if it matches
          if (finding.evidence) {
            const lineContent = lines[finding.location.line_start - 1] || '';
            const evidenceClean = finding.evidence.replace(/\s+/g, ' ').trim();
            const lineClean = lineContent.replace(/\s+/g, ' ').trim();

            // Fuzzy match - check if evidence appears in or near the line
            if (lineClean.includes(evidenceClean.slice(0, 50)) ||
                evidenceClean.includes(lineClean.slice(0, 50))) {
              verification.codeSnippetMatches = true;
            } else {
              verification.codeSnippetMatches = false;
              verification.verificationNotes = `Code at line ${finding.location.line_start} doesn't match evidence`;
            }
          }
        }
      } catch (err) {
        verification.verificationNotes = `Error reading file: ${(err as Error).message}`;
      }
    }
  }

  // Calculate adjusted confidence
  let adjustedConfidence = finding.confidence;

  if (!verification.fileExists) {
    adjustedConfidence *= 0.1; // Major penalty for non-existent file
  } else if (!verification.lineValid) {
    adjustedConfidence *= 0.3; // Significant penalty for invalid line
  } else if (verification.codeSnippetMatches === false) {
    adjustedConfidence *= 0.5; // Moderate penalty for mismatched evidence
  } else if (verification.codeSnippetMatches === true) {
    adjustedConfidence = Math.min(1, adjustedConfidence * 1.2); // Boost for matching evidence
  }

  return {
    ...finding,
    verification,
    crossCheck: {
      alreadyAddressedByCC: false,
      conflictsWithCC: false,
      ccMentioned: false,
    },
    adjustedConfidence,
  };
}

// =============================================================================
// CROSS-CHECK STAGE
// =============================================================================

/**
 * Cross-check findings against CC's analysis
 */
export function crossCheckWithCC(
  finding: VerifiedFinding,
  ccAnalysis: ReviewContext['analysis']
): VerifiedFinding {
  const crossCheck = { ...finding.crossCheck };

  // Check if CC already mentioned this
  if (ccAnalysis.findings) {
    for (const ccFinding of ccAnalysis.findings) {
      // Simple similarity check - could be more sophisticated
      const descMatch = ccFinding.description.toLowerCase().includes(
        finding.title.toLowerCase().slice(0, 30)
      );
      const locMatch = ccFinding.location &&
        finding.location?.file &&
        ccFinding.location.includes(finding.location.file);

      if (descMatch || locMatch) {
        crossCheck.ccMentioned = true;

        if (ccFinding.addressed) {
          crossCheck.alreadyAddressedByCC = true;
        }
        break;
      }
    }
  }

  // Check if this contradicts CC's assumptions
  if (ccAnalysis.assumptions) {
    for (const assumption of ccAnalysis.assumptions) {
      if (finding.description.toLowerCase().includes('incorrect') &&
          finding.description.toLowerCase().includes(assumption.toLowerCase().slice(0, 20))) {
        crossCheck.conflictsWithCC = true;
        break;
      }
    }
  }

  return { ...finding, crossCheck };
}

// =============================================================================
// PRIORITIZATION STAGE
// =============================================================================

const SEVERITY_SCORES: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10,
};

/**
 * Calculate priority score for a finding
 */
export function calculatePriority(finding: VerifiedFinding): number {
  const severityScore = SEVERITY_SCORES[finding.severity] || 50;
  const confidenceScore = finding.adjustedConfidence * 100;

  // Weight factors
  const hasLocation = finding.location ? 1.1 : 0.9;
  const hasSuggestion = finding.suggestion ? 1.1 : 1.0;
  const isVerified = finding.verification.codeSnippetMatches ? 1.2 : 1.0;
  const notAddressed = finding.crossCheck.alreadyAddressedByCC ? 0.3 : 1.0;

  // Combine scores
  let priority = (severityScore * 0.4 + confidenceScore * 0.6) *
    hasLocation * hasSuggestion * isVerified * notAddressed;

  // Cap at 100
  return Math.min(100, Math.max(0, priority));
}

/**
 * Determine action for a finding
 */
export function determineAction(
  finding: VerifiedFinding,
  priority: number
): { action: ActionItem['action']; reason: string } {
  // Reject if verification failed
  if (!finding.verification.fileExists) {
    return { action: 'reject', reason: 'Referenced file does not exist (possible hallucination)' };
  }

  if (!finding.verification.lineValid) {
    return { action: 'reject', reason: 'Referenced line number is invalid' };
  }

  if (finding.verification.codeSnippetMatches === false) {
    return { action: 'investigate', reason: 'Code evidence does not match - needs manual verification' };
  }

  // Already addressed by CC
  if (finding.crossCheck.alreadyAddressedByCC) {
    return { action: 'reject', reason: 'Already addressed by Claude Code' };
  }

  // Low confidence
  if (finding.adjustedConfidence < 0.3) {
    return { action: 'defer', reason: 'Low confidence - may not be accurate' };
  }

  // Critical findings
  if (finding.severity === 'critical' && priority > 70) {
    return { action: 'fix_now', reason: 'Critical severity with high confidence' };
  }

  // High priority
  if (priority > 60) {
    return { action: 'fix_now', reason: 'High priority issue' };
  }

  // Medium priority
  if (priority > 40) {
    return { action: 'investigate', reason: 'Worth investigating further' };
  }

  // Low priority
  return { action: 'defer', reason: 'Lower priority - can address later' };
}

// =============================================================================
// FULL PIPELINE
// =============================================================================

/**
 * Process a review output through the full verification pipeline
 */
export async function processReviewOutput(
  output: ReviewOutput,
  context: ReviewContext
): Promise<ProcessedReview> {
  const verified: VerifiedFinding[] = [];
  const rejected: { finding: ReviewFinding; reason: string }[] = [];
  const actionPlan: ActionItem[] = [];

  // Create file cache for efficient verification of multiple findings
  const fileCache = new FileCache(context.workingDir);

  // Process each finding
  for (const finding of output.findings) {
    // Stage 1: Verify (with cache for performance)
    let verifiedFinding = await verifyFinding(finding, context.workingDir, fileCache);

    // Stage 2: Cross-check
    verifiedFinding = crossCheckWithCC(verifiedFinding, context.analysis);

    // Stage 3: Prioritize
    const priority = calculatePriority(verifiedFinding);

    // Stage 4: Determine action
    const { action, reason } = determineAction(verifiedFinding, priority);

    if (action === 'reject') {
      rejected.push({ finding, reason });
    } else {
      verified.push(verifiedFinding);
      actionPlan.push({
        finding: verifiedFinding,
        action,
        priority,
        suggestedFix: finding.suggestion,
        reason,
      });
    }
  }

  // Sort action plan by priority
  actionPlan.sort((a, b) => b.priority - a.priority);

  // Build summary
  const actionableCount = actionPlan.filter(a => a.action === 'fix_now').length;

  return {
    original: output,
    verified,
    rejected,
    actionPlan,
    summary: {
      totalFindings: output.findings.length,
      verifiedCount: verified.length,
      rejectedCount: rejected.length,
      actionableCount,
      topPriority: actionPlan.filter(a => a.action === 'fix_now'),
    },
  };
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format processed review for display
 */
export function formatProcessedReview(processed: ProcessedReview): string {
  const lines: string[] = [];

  // Summary header
  lines.push('# Review Analysis\n');
  lines.push(`**Total Findings:** ${processed.summary.totalFindings}`);
  lines.push(`**Verified:** ${processed.summary.verifiedCount}`);
  lines.push(`**Rejected:** ${processed.summary.rejectedCount}`);
  lines.push(`**Actionable:** ${processed.summary.actionableCount}`);
  lines.push('');

  // Action items by category
  const fixNow = processed.actionPlan.filter(a => a.action === 'fix_now');
  const investigate = processed.actionPlan.filter(a => a.action === 'investigate');
  const defer = processed.actionPlan.filter(a => a.action === 'defer');

  if (fixNow.length > 0) {
    lines.push('## Fix Now (High Priority)\n');
    for (const item of fixNow) {
      const f = item.finding;
      lines.push(`### ${f.title}`);
      lines.push(`**Severity:** ${f.severity} | **Confidence:** ${Math.round(f.adjustedConfidence * 100)}% | **Priority:** ${Math.round(item.priority)}`);
      if (f.location) {
        lines.push(`**Location:** ${f.location.file}${f.location.line_start ? `:${f.location.line_start}` : ''}`);
      }
      lines.push(`\n${f.description}`);
      if (f.suggestion) {
        lines.push(`\n💡 **Suggestion:** ${f.suggestion}`);
      }
      lines.push('');
    }
  }

  if (investigate.length > 0) {
    lines.push('## Investigate\n');
    for (const item of investigate) {
      const f = item.finding;
      lines.push(`- **${f.title}** [${f.severity}] - ${item.reason}`);
      if (f.location) {
        lines.push(`  📍 ${f.location.file}${f.location.line_start ? `:${f.location.line_start}` : ''}`);
      }
    }
    lines.push('');
  }

  if (defer.length > 0) {
    lines.push('## Deferred\n');
    for (const item of defer) {
      const f = item.finding;
      lines.push(`- ${f.title} [${f.severity}] - ${item.reason}`);
    }
    lines.push('');
  }

  if (processed.rejected.length > 0) {
    lines.push('## Rejected (Verification Failed)\n');
    for (const { finding, reason } of processed.rejected) {
      lines.push(`- ~~${finding.title}~~ - ${reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// ITERATION SUPPORT
// =============================================================================

export interface FollowUpQuestion {
  topic: string;
  question: string;
  relatedFindings: string[];
  context: string;
}

/**
 * Generate follow-up questions for uncertain findings
 */
export function generateFollowUpQuestions(processed: ProcessedReview): FollowUpQuestion[] {
  const questions: FollowUpQuestion[] = [];

  // Ask about investigate items
  for (const item of processed.actionPlan.filter(a => a.action === 'investigate')) {
    const f = item.finding;

    if (f.verification.codeSnippetMatches === false) {
      questions.push({
        topic: f.title,
        question: `The evidence for "${f.title}" doesn't match the code at the specified location. Can you verify this finding?`,
        relatedFindings: [f.id],
        context: `File: ${f.location?.file}, Line: ${f.location?.line_start}`,
      });
    }

    if (f.crossCheck.conflictsWithCC) {
      questions.push({
        topic: f.title,
        question: `This finding conflicts with CC's assumptions. Which assessment is correct?`,
        relatedFindings: [f.id],
        context: f.description,
      });
    }
  }

  return questions;
}
