/**
 * Review Handoff Protocol
 *
 * Defines the minimal, targeted information that should flow from CC to reviewers.
 *
 * Philosophy:
 * - Reviewers have filesystem access - don't duplicate what they can discover
 * - Pass ONLY what CC uniquely knows: uncertainties, decisions, questions
 * - Let reviewer use their tools (file reading) for actual code
 * - Do NOT assume git — working directory may not be a git repo
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
Only report real issues with evidence.`,
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
Reference specific lines in the source files.`,
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
Rate by exploitability + impact.`,
};
export const PERFORMANCE_REVIEWER = {
    id: 'performance',
    name: 'Performance Engineer',
    description: 'Performance and efficiency analysis',
    isGeneric: false,
    applicableFocusAreas: ['performance', 'scalability'],
    systemPrompt: `Performance engineer. Focus on complexity (Big-O), N+1 queries, memory, blocking I/O.
Provide complexity analysis and specific optimizations.`,
};
export const ARCHITECTURE_REVIEWER = {
    id: 'architecture',
    name: 'Software Architect',
    description: 'Design patterns, structure, and maintainability',
    isGeneric: false,
    applicableFocusAreas: ['architecture', 'maintainability'],
    systemPrompt: `Software architect. Focus on SOLID, coupling/cohesion, abstractions, patterns.
Suggest refactorings with specific patterns.`,
};
export const CORRECTNESS_REVIEWER = {
    id: 'correctness',
    name: 'Correctness Analyst',
    description: 'Logic errors, edge cases, and bug detection',
    isGeneric: false,
    applicableFocusAreas: ['correctness', 'testing'],
    systemPrompt: `Correctness analyst. Focus on logic errors, edge cases, race conditions, error handling.
Provide triggering inputs and expected vs actual behavior.
For significant bugs, suggest a concrete regression test (name, inputs, expected output).`,
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
 * Select and compose roles based on focus areas.
 *
 * When multiple focus areas map to different roles (e.g. security + performance),
 * composes them into a single role with merged prompts instead of picking one winner.
 */
export function selectRole(focusAreas) {
    if (!focusAreas || focusAreas.length === 0) {
        return COMPREHENSIVE_REVIEWER;
    }
    // Collect all unique matching roles (preserving insertion order)
    const matched = new Map();
    for (const focus of focusAreas) {
        for (const role of Object.values(ROLES)) {
            if (!role.isGeneric && role.applicableFocusAreas.includes(focus)) {
                matched.set(role.id, role);
            }
        }
    }
    if (matched.size === 0)
        return CHANGE_FOCUSED_REVIEWER;
    if (matched.size === 1)
        return [...matched.values()][0];
    // Compose multiple roles into one
    const roles = [...matched.values()];
    return {
        id: roles.map(r => r.id).join('+'),
        name: roles.map(r => r.name).join(' + '),
        description: roles.map(r => r.description).join('; '),
        isGeneric: false,
        applicableFocusAreas: focusAreas,
        systemPrompt: roles.map(r => `**As ${r.name}:** ${r.systemPrompt}`).join('\n'),
    };
}
// =============================================================================
// ADVERSARIAL REVIEWER — Challenge mode for multi_review
// =============================================================================
export const ADVERSARIAL_REVIEWER = {
    id: 'adversarial',
    name: 'Adversarial Reviewer',
    description: 'Actively tries to break confidence in the change — challenges assumptions, not just bugs',
    isGeneric: false,
    applicableFocusAreas: [],
    systemPrompt: `Senior staff engineer performing an adversarial review. Your job is to break confidence in the change, not to validate it.`,
};
/**
 * Build an adversarial handoff prompt with challenge-mode stance sections.
 * Same structure as buildHandoffPrompt but adds adversarial XML sections
 * and uses the ADVERSARIAL_REVIEWER role.
 */
export function buildAdversarialHandoffPrompt(options) {
    const { handoff } = options;
    const role = ADVERSARIAL_REVIEWER;
    const sections = [];
    // SECTION 1: ROLE
    sections.push(`# ROLE: ${role.name}\n\n${role.systemPrompt}`);
    // SECTION 2: ADVERSARIAL STANCE
    sections.push(`## ADVERSARIAL STANCE

<operating_stance>
Default to skepticism. Assume the change can fail in subtle, high-cost,
or user-visible ways until the evidence says otherwise. Do not give credit
for good intent, partial fixes, or likely follow-up work.
</operating_stance>

<attack_surface>
Prioritized failure categories:
1. Auth/permissions bypass
2. Data loss or corruption
3. Rollback safety
4. Race conditions / concurrency
5. Empty-state / null / timeout handling
6. Version skew / backwards compatibility
7. Observability gaps (missing logs, metrics, alerts)
</attack_surface>

<review_method>
Actively try to disprove the change. Look for violated invariants,
missing guards, unhandled failure paths. If the user supplied a focus area,
weight it heavily, but still report any other material issue you can defend.
</review_method>

<finding_bar>
Material findings only. Each must answer:
1. What can go wrong?
2. Why is this code path vulnerable?
3. What is the likely impact?
4. What concrete change would reduce the risk?
</finding_bar>

<calibration_rules>
Prefer one strong finding over several weak ones. If you cannot defend
a finding from the provided code, drop it.
</calibration_rules>

<grounding_rules>
Be aggressive, but stay grounded. Every finding must be defensible from
the repository context. No speculative findings. No "might be an issue"
without concrete evidence from the code.
</grounding_rules>`);
    // SECTION 3: TASK (same as standard)
    sections.push(`## YOUR TASK

Review code in \`${handoff.workingDir}\`.

**Summary:** ${handoff.summary}${handoff.confidence !== undefined && handoff.confidence < 0.9 ? `\n**CC Confidence:** ${Math.round(handoff.confidence * 100)}% — verify weak areas` : ''}

**IMPORTANT:**
- This is a READ-ONLY review. Do NOT create, modify, or delete any files. Only read files to verify claims.
- Do NOT assume a git repository exists. Do NOT run git commands. Read files directly from the filesystem.`);
    // SECTION 4: CC'S UNCERTAINTIES
    if (handoff.uncertainties && handoff.uncertainties.length > 0) {
        sections.push(`## CC'S UNCERTAINTIES

${handoff.uncertainties.map((u, i) => `### ${i + 1}. ${u.topic} ${u.severity === 'critical' ? '⚠️' : ''}
- **Question:** ${u.question}
${u.ccAssumption ? `- **CC assumed:** ${u.ccAssumption}` : ''}
${u.relevantFiles ? `- **Files:** ${u.relevantFiles.join(', ')}` : ''}`).join('\n\n')}`);
    }
    // SECTION 5: SPECIFIC QUESTIONS
    if (handoff.questions && handoff.questions.length > 0) {
        sections.push(`## QUESTIONS FROM CC

${handoff.questions.map((q, i) => `${i + 1}. **${q.question}**
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccGuess ? `CC Guess: ${q.ccGuess}` : ''}`).join('\n')}`);
    }
    // SECTION 6: DECISIONS TO EVALUATE
    if (handoff.decisions && handoff.decisions.length > 0) {
        sections.push(`## DECISIONS TO EVALUATE

${handoff.decisions.map((d, i) => `${i + 1}. **${d.decision}**${d.rationale ? `\n   Rationale: ${d.rationale}` : ''}${d.alternatives ? `\n   Alternatives: ${d.alternatives.join(', ')}` : ''}`).join('\n')}`);
    }
    // SECTION 7: FOCUS AREAS
    if (handoff.focusAreas && handoff.focusAreas.length > 0) {
        sections.push(`## FOCUS AREAS\n\nWeight these areas heavily in your adversarial analysis:\n${handoff.focusAreas.map(f => `- **${f}**`).join('\n')}`);
    }
    // SECTION 8: PRIORITY FILES
    if (handoff.priorityFiles && handoff.priorityFiles.length > 0) {
        sections.push(`## PRIORITY FILES\n\n${handoff.priorityFiles.map(f => `- \`${f}\``).join('\n')}`);
    }
    // SECTION 9: ADVERSARIAL FOCUS (customInstructions steers the challenge)
    if (handoff.customInstructions) {
        sections.push(`## ADVERSARIAL FOCUS\n\n${handoff.customInstructions}`);
    }
    return sections.join('\n\n');
}
// =============================================================================
// FOCUS-AREA CHECKLISTS — Specific patterns to look for (ported from prompt-v2)
// =============================================================================
const FOCUS_CHECKLISTS = {
    security: `Check for:
- Injection vulnerabilities (SQL, NoSQL, Command, XSS)
- Auth/authorization bypass, session management flaws
- Sensitive data exposure, insecure storage, missing encryption
- Input validation gaps (type, range, format)
- Path traversal, SSRF, unsafe deserialization
For each: CWE ID if applicable, attack scenario, severity by impact + exploitability.`,
    performance: `Check for:
- Algorithmic complexity (provide Big-O notation)
- N+1 queries, missing indexes, unoptimized queries
- Blocking I/O in async contexts
- Memory leaks, unbounded allocations, large object retention
- Missing caching/memoization, repeated expensive operations
For each: Big-O analysis, estimated impact, concrete optimization.`,
    architecture: `Check for:
- SOLID violations (SRP, OCP, LSP, ISP, DIP)
- High coupling between modules, low cohesion within
- Layering violations, circular dependencies
- Anti-patterns (god classes, deep nesting, magic numbers, leaky abstractions)
- Missing or misused design patterns
For each: specific principle violated, refactoring suggestion, maintainability impact.`,
    correctness: `Check for:
- Off-by-one errors, incorrect conditionals, wrong operators
- Null/undefined handling, empty collections, boundary conditions
- Race conditions, deadlock potential, state inconsistency
- Uncaught exceptions, silent failures, incorrect error propagation
For each: triggering input, expected vs actual behavior.
For significant bugs: suggest a concrete regression test.`,
    testing: `Check for:
- Missing test coverage for changed code paths
- Tests that pass for wrong reasons (tautologies, mocked-away logic)
- Non-deterministic tests (timing, ordering, randomness)
- Missing edge case tests (null, empty, boundary, error paths)
For significant gaps: suggest a concrete test (name, inputs, expected output).`,
    scalability: `Check for:
- Algorithmic complexity that degrades at scale (provide Big-O)
- Unbounded growth (queues, caches, in-memory collections)
- Missing pagination, rate limiting, or backpressure
- Single points of contention (locks, shared state, single-threaded bottlenecks)
For each: estimated impact at 10x/100x current load.`,
    maintainability: `Check for:
- God classes, deep nesting (>3 levels), magic numbers
- Tight coupling between modules, leaky abstractions
- Code duplication that should be extracted
- Missing or misleading comments on non-obvious logic
For each: specific refactoring suggestion with rationale.`,
    documentation: `Check for:
- Public API functions missing doc comments
- Outdated or misleading comments that contradict the code
- Missing README updates for changed behavior
- Undocumented configuration, environment variables, or flags
For each: what specifically should be documented and where.`,
};
/**
 * Build the review prompt using minimal, targeted context.
 * No output format constraints — reviewer responds naturally, CC interprets.
 */
export function buildHandoffPrompt(options) {
    const { handoff } = options;
    const role = options.role || selectRole(handoff.focusAreas);
    const sections = [];
    // SECTION 1: ROLE
    sections.push(`# ROLE: ${role.name}\n\n${role.systemPrompt}`);
    // SECTION 2: REVIEW CHECKLIST (focus-area-specific patterns to look for)
    const focusAreas = handoff.focusAreas;
    if (focusAreas && focusAreas.length > 0) {
        const checklists = focusAreas
            .map(f => FOCUS_CHECKLISTS[f])
            .filter((c) => !!c);
        if (checklists.length > 0) {
            sections.push(`## REVIEW CHECKLIST\n\n${checklists.join('\n\n')}`);
        }
    }
    // SECTION 3: TASK
    sections.push(`## YOUR TASK

Review code in \`${handoff.workingDir}\`.

**Summary:** ${handoff.summary}${handoff.confidence !== undefined && handoff.confidence < 0.9 ? `\n**CC Confidence:** ${Math.round(handoff.confidence * 100)}% — verify weak areas` : ''}

**IMPORTANT:**
- This is a READ-ONLY review. Do NOT create, modify, or delete any files. Only read files to verify claims.
- Do NOT assume a git repository exists. Do NOT run git commands. Read files directly from the filesystem.`);
    // SECTION 4: CC'S UNCERTAINTIES
    if (handoff.uncertainties && handoff.uncertainties.length > 0) {
        sections.push(`## CC'S UNCERTAINTIES

${handoff.uncertainties.map((u, i) => `### ${i + 1}. ${u.topic} ${u.severity === 'critical' ? '⚠️' : ''}
- **Question:** ${u.question}
${u.ccAssumption ? `- **CC assumed:** ${u.ccAssumption}` : ''}
${u.relevantFiles ? `- **Files:** ${u.relevantFiles.join(', ')}` : ''}`).join('\n\n')}`);
    }
    // SECTION 5: SPECIFIC QUESTIONS
    if (handoff.questions && handoff.questions.length > 0) {
        sections.push(`## QUESTIONS FROM CC

${handoff.questions.map((q, i) => `${i + 1}. **${q.question}**
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccGuess ? `CC Guess: ${q.ccGuess}` : ''}`).join('\n')}`);
    }
    // SECTION 6: DECISIONS TO EVALUATE
    if (handoff.decisions && handoff.decisions.length > 0) {
        sections.push(`## DECISIONS TO EVALUATE

${handoff.decisions.map((d, i) => `${i + 1}. **${d.decision}**${d.rationale ? `\n   Rationale: ${d.rationale}` : ''}${d.alternatives ? `\n   Alternatives: ${d.alternatives.join(', ')}` : ''}`).join('\n')}`);
    }
    // SECTION 7: PRIORITY FILES
    if (handoff.priorityFiles && handoff.priorityFiles.length > 0) {
        sections.push(`## PRIORITY FILES\n\n${handoff.priorityFiles.map(f => `- \`${f}\``).join('\n')}`);
    }
    // SECTION 8: CUSTOM INSTRUCTIONS
    if (handoff.customInstructions) {
        sections.push(`## ADDITIONAL INSTRUCTIONS\n\n${handoff.customInstructions}`);
    }
    return sections.join('\n\n');
}
// =============================================================================
// STRUCTURED ccOutput PARSER
// =============================================================================
/**
 * Parse structured ccOutput into Handoff fields.
 *
 * The slash commands tell CC to format its output as:
 *   SUMMARY:
 *   <text>
 *
 *   UNCERTAINTIES (verify these):
 *   1. <text>
 *
 *   QUESTIONS:
 *   1. <text>
 *
 *   PRIORITY FILES:
 *   - <file>
 *
 * If no sections detected, returns { summary: ccOutput } (graceful fallback).
 */
export function parseStructuredCcOutput(ccOutput) {
    // Quick check: does it look structured? Case-SENSITIVE to avoid matching
    // prose like "Summary: I think..." — slash commands produce ALL-CAPS headers.
    if (!/^SUMMARY[^:\n]*:/m.test(ccOutput)) {
        return { summary: ccOutput };
    }
    // Known section headers — case-SENSITIVE (ALL-CAPS only) to prevent
    // header injection from natural prose starting with "Questions:" etc.
    const KNOWN_HEADERS = ['SUMMARY', 'UNCERTAINTIES', 'QUESTIONS', 'PRIORITY FILES', 'DECISIONS'];
    const headerPattern = new RegExp(`^(${KNOWN_HEADERS.join('|')})[^:\\n]*:`, 'gm' // no 'i' flag — case-sensitive
    );
    // Find all header positions
    const headers = [];
    let match;
    while ((match = headerPattern.exec(ccOutput)) !== null) {
        const raw = match[1].trim();
        const name = KNOWN_HEADERS.find(h => raw.startsWith(h)) || raw;
        headers.push({ name, contentStart: match.index + match[0].length });
    }
    if (headers.length === 0) {
        return { summary: ccOutput };
    }
    // Extract content between headers
    const sections = new Map();
    for (let i = 0; i < headers.length; i++) {
        const start = headers[i].contentStart;
        const end = i + 1 < headers.length
            ? ccOutput.lastIndexOf('\n', headers[i + 1].contentStart - headers[i + 1].name.length - 1)
            : ccOutput.length;
        sections.set(headers[i].name, ccOutput.slice(start, end).trim());
    }
    const rawSummary = sections.get('SUMMARY');
    const result = {
        summary: rawSummary && rawSummary.length > 0 ? rawSummary : ccOutput,
    };
    // Parse uncertainties (numbered or bulleted list)
    const uncertText = sections.get('UNCERTAINTIES');
    if (uncertText) {
        const items = parseListItems(uncertText);
        if (items.length > 0) {
            result.uncertainties = items.map(item => ({
                topic: extractTopic(item),
                question: item,
            }));
        }
    }
    // Parse questions (numbered or bulleted list)
    const questionsText = sections.get('QUESTIONS');
    if (questionsText) {
        const items = parseListItems(questionsText);
        if (items.length > 0) {
            result.questions = items.map(item => ({ question: item }));
        }
    }
    // Parse priority files (bullet or numbered list)
    const filesText = sections.get('PRIORITY FILES');
    if (filesText) {
        const items = parseListItems(filesText);
        if (items.length > 0) {
            result.priorityFiles = items;
        }
    }
    // Parse decisions (numbered or bulleted list)
    const decisionsText = sections.get('DECISIONS');
    if (decisionsText) {
        const items = parseListItems(decisionsText);
        if (items.length > 0) {
            result.decisions = items.map(item => ({ decision: item, rationale: '' }));
        }
    }
    return result;
}
/**
 * Extract a short topic from an item — uses first sentence/clause up to 60 chars.
 * Avoids redundant rendering where topic === question.
 */
function extractTopic(item) {
    // Try first clause (up to first comma, period, dash, or question mark)
    const clauseMatch = item.match(/^(.+?)[,.\-?]/);
    const clause = clauseMatch ? clauseMatch[1].trim() : item;
    if (clause.length <= 60)
        return clause;
    return clause.slice(0, 57) + '...';
}
/**
 * Parse a list section that may use numbered ("1. foo") or bulleted ("- foo") format.
 * Supports multi-line continuation for both styles.
 */
function parseListItems(text) {
    const items = [];
    let current = '';
    for (const line of text.split('\n')) {
        // Match numbered: "1. foo", "2) bar"
        const numbered = line.match(/^\d+[.)]\s+(.+)/);
        // Match bulleted: "- foo", "* bar"
        const bulleted = line.match(/^[-*]\s+(.+)/);
        if (numbered || bulleted) {
            if (current)
                items.push(current.trim());
            current = (numbered || bulleted)[1];
        }
        else if (current && line.trim()) {
            // Continuation line for multi-line items
            current += ' ' + line.trim();
        }
    }
    if (current)
        items.push(current.trim());
    return items;
}
// =============================================================================
// HELPER: Build handoff from simple inputs
// =============================================================================
/**
 * Build a handoff from MCP tool inputs.
 *
 * Parses structured sections (SUMMARY, UNCERTAINTIES, QUESTIONS, PRIORITY FILES)
 * from ccOutput when present, populating typed Handoff fields so reviewers
 * receive machine-usable context instead of a single summary blob.
 */
export function buildSimpleHandoff(workingDir, ccOutput, analyzedFiles, focusAreas, customPrompt) {
    const parsed = parseStructuredCcOutput(ccOutput);
    // Merge analyzedFiles with any priority files parsed from ccOutput (dedup)
    const mergedFiles = dedupStrings([
        ...(parsed.priorityFiles || []),
        ...(analyzedFiles || []),
    ]);
    return {
        workingDir,
        summary: parsed.summary,
        uncertainties: parsed.uncertainties,
        questions: parsed.questions,
        decisions: parsed.decisions,
        priorityFiles: mergedFiles.length > 0 ? mergedFiles : undefined,
        focusAreas,
        customInstructions: customPrompt,
    };
}
function dedupStrings(arr) {
    return [...new Set(arr)];
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
