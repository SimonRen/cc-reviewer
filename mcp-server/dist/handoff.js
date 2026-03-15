/**
 * Review Handoff Protocol
 *
 * Defines the minimal, targeted information that should flow from CC to reviewers.
 *
 * Philosophy:
 * - Reviewers have filesystem + git access - don't duplicate what they can discover
 * - Pass ONLY what CC uniquely knows: uncertainties, decisions, questions
 * - Let reviewer use their tools (git diff, file reading) for actual code
 */
import { z } from 'zod';
// =============================================================================
// HANDOFF SCHEMA - What CC Passes to Reviewer
// =============================================================================
/**
 * Uncertainty that CC has - things the reviewer should verify
 */
export const UncertaintySchema = z.object({
    topic: z.string().describe('What CC is uncertain about'),
    question: z.string().describe('The specific question'),
    ccAssumption: z.string().optional().describe("What CC assumed/did - reviewer should verify"),
    relevantFiles: z.array(z.string()).optional().describe('Files related to this uncertainty'),
    severity: z.enum(['critical', 'important', 'minor']).optional(),
});
/**
 * Decision CC made - for reviewer to evaluate
 */
export const DecisionSchema = z.object({
    decision: z.string().describe('What CC decided'),
    rationale: z.string().describe('Why CC chose this'),
    alternatives: z.array(z.string()).optional().describe('Other options considered'),
    tradeoffs: z.string().optional().describe('Known tradeoffs of this choice'),
});
/**
 * Question CC wants the reviewer to answer
 */
export const QuestionSchema = z.object({
    question: z.string(),
    context: z.string().optional(),
    ccGuess: z.string().optional().describe("CC's best guess - for comparison"),
});
/**
 * The complete handoff from CC to reviewer
 * Intentionally minimal - only what CC uniquely knows
 */
export const HandoffSchema = z.object({
    // Working directory (required for filesystem access)
    workingDir: z.string(),
    // Brief summary of what CC did (1-3 sentences)
    summary: z.string().describe('Brief: what CC did and why'),
    // CC's uncertainties - things reviewer should verify
    uncertainties: z.array(UncertaintySchema).optional(),
    // Key decisions CC made - for reviewer to evaluate
    decisions: z.array(DecisionSchema).optional(),
    // Specific questions CC wants answered
    questions: z.array(QuestionSchema).optional(),
    // Files to prioritize (if CC knows which are most important)
    priorityFiles: z.array(z.string()).optional(),
    // Focus areas (security, performance, etc.)
    focusAreas: z.array(z.string()).optional(),
    // Overall confidence (0-1)
    confidence: z.number().min(0).max(1).optional(),
    // Custom instructions from user
    customInstructions: z.string().optional(),
});
/**
 * Strong generic role - when no specific focus is given
 * This is NOT a weak fallback - it's a comprehensive reviewer
 */
export const COMPREHENSIVE_REVIEWER = {
    id: 'comprehensive',
    name: 'Comprehensive Code Reviewer',
    description: 'Systematic review across all dimensions, prioritizing high-impact issues',
    isGeneric: true,
    applicableFocusAreas: [],
    systemPrompt: `Senior staff engineer. Be skeptical — catch mistakes, don't rubber-stamp.
Priority: correctness > security > performance > maintainability.
Review changes using git diff and file reading. Only report real issues with evidence.`,
    reviewInstructions: '',
};
/**
 * Change-focused reviewer - specifically for reviewing diffs
 */
export const CHANGE_FOCUSED_REVIEWER = {
    id: 'change_focused',
    name: 'Change Reviewer',
    description: 'Focused on reviewing the delta - what changed and its implications',
    isGeneric: true,
    applicableFocusAreas: [],
    systemPrompt: `Change reviewer. Focus on: goal achievement, regressions, edge cases, side effects.
Reference specific lines in the diff. Use git diff and file reading to verify.`,
    reviewInstructions: '',
};
/**
 * Specialized roles - when specific focus is requested
 */
export const SECURITY_REVIEWER = {
    id: 'security',
    name: 'Security Auditor',
    description: 'Deep security analysis with OWASP/CWE focus',
    isGeneric: false,
    applicableFocusAreas: ['security'],
    systemPrompt: `Security auditor. Focus on injection, auth bypass, data exposure, input validation.
Rate by exploitability + impact. Use git diff and file reading to verify.`,
    reviewInstructions: '',
};
export const PERFORMANCE_REVIEWER = {
    id: 'performance',
    name: 'Performance Engineer',
    description: 'Performance and efficiency analysis',
    isGeneric: false,
    applicableFocusAreas: ['performance', 'scalability'],
    systemPrompt: `Performance engineer. Focus on complexity (Big-O), N+1 queries, memory, blocking I/O.
Provide complexity analysis and specific optimizations. Use git diff and file reading.`,
    reviewInstructions: '',
};
export const ARCHITECTURE_REVIEWER = {
    id: 'architecture',
    name: 'Software Architect',
    description: 'Design patterns, structure, and maintainability',
    isGeneric: false,
    applicableFocusAreas: ['architecture', 'maintainability'],
    systemPrompt: `Software architect. Focus on SOLID, coupling/cohesion, abstractions, patterns.
Suggest refactorings. Use git diff and file reading to verify.`,
    reviewInstructions: '',
};
export const CORRECTNESS_REVIEWER = {
    id: 'correctness',
    name: 'Correctness Analyst',
    description: 'Logic errors, edge cases, and bug detection',
    isGeneric: false,
    applicableFocusAreas: ['correctness', 'testing'],
    systemPrompt: `Correctness analyst. Focus on logic errors, edge cases, race conditions, error handling.
Provide triggering inputs. Use git diff and file reading to verify.`,
    reviewInstructions: '',
};
// All roles indexed by ID
export const ROLES = {
    comprehensive: COMPREHENSIVE_REVIEWER,
    change_focused: CHANGE_FOCUSED_REVIEWER,
    security: SECURITY_REVIEWER,
    performance: PERFORMANCE_REVIEWER,
    architecture: ARCHITECTURE_REVIEWER,
    correctness: CORRECTNESS_REVIEWER,
};
/**
 * Select the best role based on focus areas
 */
export function selectRole(focusAreas) {
    if (!focusAreas || focusAreas.length === 0) {
        return COMPREHENSIVE_REVIEWER;
    }
    for (const focus of focusAreas) {
        for (const role of Object.values(ROLES)) {
            if (!role.isGeneric && role.applicableFocusAreas.includes(focus)) {
                return role;
            }
        }
    }
    return CHANGE_FOCUSED_REVIEWER;
}
/**
 * Build the review prompt using minimal, targeted context
 */
export function buildHandoffPrompt(options) {
    const { handoff, outputFormat } = options;
    const role = options.role || selectRole(handoff.focusAreas);
    const sections = [];
    // SECTION 1: ROLE
    sections.push(`# ROLE: ${role.name}\n\n${role.systemPrompt}`);
    // SECTION 2: TASK
    sections.push(`## YOUR TASK

Review recent work in \`${handoff.workingDir}\`.

**Summary:** ${handoff.summary}${handoff.confidence !== undefined && handoff.confidence < 0.9 ? `\n**CC Confidence:** ${Math.round(handoff.confidence * 100)}% — verify weak areas` : ''}`);
    // SECTION 3: CC'S UNCERTAINTIES
    if (handoff.uncertainties && handoff.uncertainties.length > 0) {
        sections.push(`## CC'S UNCERTAINTIES - VERIFY THESE

${handoff.uncertainties.map((u, i) => `### ${i + 1}. ${u.topic} ${u.severity === 'critical' ? '⚠️' : ''}
- **Question:** ${u.question}
${u.ccAssumption ? `- **CC assumed:** ${u.ccAssumption}` : ''}
${u.relevantFiles ? `- **Files:** ${u.relevantFiles.join(', ')}` : ''}`).join('\n\n')}`);
    }
    // SECTION 4: SPECIFIC QUESTIONS
    if (handoff.questions && handoff.questions.length > 0) {
        sections.push(`## QUESTIONS FROM CC

${handoff.questions.map((q, i) => `${i + 1}. **${q.question}**
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccGuess ? `CC Guess: ${q.ccGuess}` : ''}`).join('\n')}`);
    }
    // SECTION 5: DECISIONS TO EVALUATE
    if (handoff.decisions && handoff.decisions.length > 0) {
        sections.push(`## DECISIONS TO EVALUATE

${handoff.decisions.map((d, i) => `${i + 1}. **${d.decision}**
   Rationale: ${d.rationale}
   ${d.alternatives ? `Alternatives: ${d.alternatives.join(', ')}` : ''}`).join('\n')}`);
    }
    // SECTION 6: PRIORITY FILES
    if (handoff.priorityFiles && handoff.priorityFiles.length > 0) {
        sections.push(`## PRIORITY FILES\n\n${handoff.priorityFiles.map(f => `- \`${f}\``).join('\n')}`);
    }
    // SECTION 7: OUTPUT FORMAT
    if (outputFormat === 'schema-enforced') {
        sections.push(`## OUTPUT FORMAT
Respond with valid JSON matching the schema. Use \`git diff\` and file reading to verify findings. Confidence reflects YOUR certainty.`);
    }
    else if (outputFormat === 'json') {
        sections.push(`## OUTPUT FORMAT
Respond with valid JSON:
\`\`\`json
{
  "findings": [{
    "id": "string",
    "category": "security|performance|correctness|architecture|other",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.0-1.0,
    "title": "string",
    "description": "string",
    "location": { "file": "string", "line_start": 0 },
    "evidence": "code snippet",
    "suggestion": "string"
  }],
  "uncertainty_responses": [{"uncertainty_index": 0, "verified": true, "finding": "string", "recommendation": "string"}],
  "question_answers": [{"question_index": 0, "answer": "string", "confidence": 0.0-1.0}],
  "agreements": ["string"],
  "risk_assessment": { "level": "critical|high|medium|low|minimal", "summary": "string" }
}
\`\`\``);
    }
    else {
        sections.push(`## OUTPUT FORMAT
Structure: ## Findings, ## Uncertainty Responses, ## Question Answers, ## Agreements, ## Risk Assessment.`);
    }
    return sections.join('\n\n');
}
// =============================================================================
// HELPER: Build handoff from simple inputs (backwards compatibility)
// =============================================================================
/**
 * Build a handoff from legacy simple inputs
 */
export function buildSimpleHandoff(workingDir, ccOutput, analyzedFiles, focusAreas, customPrompt) {
    return {
        workingDir,
        summary: ccOutput,
        priorityFiles: analyzedFiles,
        focusAreas,
        customInstructions: customPrompt,
    };
}
/**
 * Enhance a simple handoff with uncertainties/questions
 * CC should call this to add its specific concerns
 */
export function enhanceHandoff(handoff, uncertainties, questions, decisions) {
    return {
        ...handoff,
        uncertainties: uncertainties || handoff.uncertainties,
        questions: questions || handoff.questions,
        decisions: decisions || handoff.decisions,
    };
}
/**
 * Build a prompt for general-purpose peer assistance (not review).
 * The peer acts as a collaborative coworker, not a critic.
 */
export function buildPeerPrompt(options) {
    const { workingDir, prompt, taskType, relevantFiles, context, focusAreas, customInstructions, outputFormat } = options;
    const role = selectRole(focusAreas);
    const sections = [];
    // SECTION 1: ROLE
    sections.push(`# ROLE: ${role.name} — Peer Engineer

${role.systemPrompt}
Collaborate with CC. Help with planning, debugging, or answering questions. Be direct and actionable.`);
    // SECTION 2: TASK
    const taskLabel = taskType ? ` [${taskType.toUpperCase()}]` : '';
    sections.push(`## YOUR TASK${taskLabel}

**Request:** ${prompt}${context ? `\n**Context:** ${context}` : ''}`);
    // SECTION 3: RELEVANT FILES
    if (relevantFiles && relevantFiles.length > 0) {
        sections.push(`## RELEVANT FILES\n${relevantFiles.map(f => `- \`${f}\``).join('\n')}`);
    }
    // SECTION 4: FOCUS AREAS
    if (focusAreas && focusAreas.length > 0) {
        sections.push(`## FOCUS AREAS\n\n${focusAreas.join(', ')}`);
    }
    // SECTION 5: CUSTOM INSTRUCTIONS
    if (customInstructions) {
        sections.push(`## ADDITIONAL INSTRUCTIONS\n\n${customInstructions}`);
    }
    // SECTION 6: OUTPUT FORMAT
    if (outputFormat === 'schema-enforced') {
        sections.push(`## OUTPUT FORMAT
Respond with valid JSON matching the schema. Read files before making claims. Confidence reflects YOUR certainty.`);
    }
    else {
        sections.push(`## OUTPUT FORMAT
Respond with valid JSON:
\`\`\`json
{
  "responder": "string",
  "answer": "markdown",
  "confidence": 0.0-1.0,
  "key_points": ["string"],
  "suggested_actions": [{ "action": "string", "priority": "high|medium|low", "file": "string", "rationale": "string" }],
  "file_references": [{ "path": "string", "lines": "string", "relevance": "string" }],
  "alternatives": [{ "topic": "string", "current_approach": "string", "alternative": "string", "tradeoffs": { "pros": [], "cons": [] }, "recommendation": "string" }],
  "execution_notes": "string"
}
\`\`\``);
    }
    return sections.join('\n\n');
}
