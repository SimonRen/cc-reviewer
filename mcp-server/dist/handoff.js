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
    systemPrompt: `You are a senior staff engineer conducting a thorough code review.

Your approach:
1. SCAN broadly first - look for obvious issues across all categories
2. DEEP DIVE on red flags - investigate suspicious patterns
3. PRIORITIZE by impact - focus on issues that matter most
4. BE SKEPTICAL - your job is to catch mistakes, not rubber-stamp

Review dimensions (in priority order):
1. **Correctness** - Does it work? Logic errors, edge cases, bugs
2. **Security** - Vulnerabilities, input validation, auth issues
3. **Performance** - Obvious inefficiencies, N+1 queries, memory leaks
4. **Maintainability** - Code clarity, unnecessary complexity

You don't need to find something in every category.
Focus on what's actually wrong, not theoretical issues.`,
    reviewInstructions: `
1. Run \`git diff HEAD~1\` (or appropriate range) to see what changed
2. Read the changed files to understand the modifications
3. Look for issues in the categories above
4. Verify any claims CC made
5. Answer CC's specific questions if provided`,
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
    systemPrompt: `You are reviewing a set of code changes (not the entire codebase).

Your focus:
1. **Does the change achieve its goal?** - Does it do what was intended?
2. **Regressions** - Does it break existing functionality?
3. **Edge cases** - Are there inputs/states not handled?
4. **Side effects** - Unintended consequences of the change?

For each issue:
- Reference the specific line in the diff
- Explain why it's problematic
- Suggest a fix`,
    reviewInstructions: `
1. Run \`git diff\` to see the actual changes
2. For each changed file:
   - Understand what was modified
   - Check if the change is correct
   - Look for edge cases not handled
3. Verify the change doesn't break related code`,
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
    systemPrompt: `You are a security auditor specializing in application security.

Primary focus:
1. **Injection attacks** - SQL, NoSQL, Command, XSS, SSTI
2. **Authentication/Authorization** - Bypass, privilege escalation, session issues
3. **Data exposure** - Sensitive data leaks, insecure storage
4. **Input validation** - Missing or insufficient validation

For each finding:
- Provide CWE ID if applicable
- Describe attack scenario
- Rate by exploitability + impact`,
    reviewInstructions: `
1. Run \`git diff\` to identify security-relevant changes
2. Focus on:
   - Input handling (user data, API inputs)
   - Authentication/authorization logic
   - Data access and storage
   - Cryptographic operations
3. For each vulnerability, provide proof-of-concept scenario`,
};
export const PERFORMANCE_REVIEWER = {
    id: 'performance',
    name: 'Performance Engineer',
    description: 'Performance and efficiency analysis',
    isGeneric: false,
    applicableFocusAreas: ['performance', 'scalability'],
    systemPrompt: `You are a performance engineer analyzing code efficiency.

Primary focus:
1. **Algorithmic complexity** - Time/space complexity (provide Big-O)
2. **Database operations** - N+1 queries, missing indexes, inefficient queries
3. **Memory** - Leaks, unnecessary allocations, large object retention
4. **I/O** - Blocking operations, unnecessary network calls

For each finding:
- Provide complexity analysis
- Estimate performance impact
- Suggest specific optimization`,
    reviewInstructions: `
1. Run \`git diff\` to identify performance-relevant changes
2. Analyze:
   - Loop structures and their complexity
   - Database queries and access patterns
   - Memory allocations in hot paths
   - Async/blocking operations
3. Provide Big-O notation where applicable`,
};
export const ARCHITECTURE_REVIEWER = {
    id: 'architecture',
    name: 'Software Architect',
    description: 'Design patterns, structure, and maintainability',
    isGeneric: false,
    applicableFocusAreas: ['architecture', 'maintainability'],
    systemPrompt: `You are a software architect reviewing code structure and design.

Primary focus:
1. **SOLID principles** - Violations and improvements
2. **Coupling/Cohesion** - Module dependencies and responsibilities
3. **Patterns** - Missing patterns, anti-patterns, pattern misuse
4. **Abstraction** - Leaky abstractions, wrong abstraction levels

For each finding:
- Identify the principle/pattern violated
- Explain the impact on maintainability
- Suggest refactoring approach`,
    reviewInstructions: `
1. Run \`git diff\` to see structural changes
2. Analyze:
   - Class/module responsibilities
   - Dependencies between components
   - Interface design
   - Error handling patterns
3. Consider long-term maintainability`,
};
export const CORRECTNESS_REVIEWER = {
    id: 'correctness',
    name: 'Correctness Analyst',
    description: 'Logic errors, edge cases, and bug detection',
    isGeneric: false,
    applicableFocusAreas: ['correctness', 'testing'],
    systemPrompt: `You are analyzing code for correctness and logic errors.

Primary focus:
1. **Logic errors** - Wrong conditions, incorrect operators, off-by-one
2. **Edge cases** - Null/undefined, empty collections, boundaries
3. **Concurrency** - Race conditions, deadlocks, state consistency
4. **Error handling** - Uncaught exceptions, silent failures

For each finding:
- Provide specific input that triggers the bug
- Show expected vs actual behavior
- Suggest fix with test case`,
    reviewInstructions: `
1. Run \`git diff\` to see logic changes
2. Trace execution paths looking for:
   - Incorrect conditional logic
   - Unhandled edge cases
   - Missing error handling
   - State inconsistencies
3. For each bug, provide a triggering input`,
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
        // No focus specified - use comprehensive reviewer (NOT a weak fallback!)
        return COMPREHENSIVE_REVIEWER;
    }
    // Find specialized role that matches
    for (const focus of focusAreas) {
        for (const role of Object.values(ROLES)) {
            if (!role.isGeneric && role.applicableFocusAreas.includes(focus)) {
                return role;
            }
        }
    }
    // No specialized match - use change-focused or comprehensive
    return CHANGE_FOCUSED_REVIEWER;
}
/**
 * Build the review prompt using minimal, targeted context
 */
export function buildHandoffPrompt(options) {
    const { handoff, outputFormat } = options;
    const role = options.role || selectRole(handoff.focusAreas);
    const sections = [];
    // ==========================================================================
    // SECTION 1: ROLE
    // ==========================================================================
    sections.push(`# ROLE: ${role.name}

${role.systemPrompt}`);
    // ==========================================================================
    // SECTION 2: TASK + HOW TO REVIEW
    // ==========================================================================
    sections.push(`
---

# YOUR TASK

Review Claude Code's (CC) recent work on this codebase.

**Working Directory:** \`${handoff.workingDir}\`

**What CC Did:**
${handoff.summary}

${handoff.confidence !== undefined ? `**CC's Confidence:** ${Math.round(handoff.confidence * 100)}%` : ''}

---

# HOW TO REVIEW

${role.reviewInstructions}

**Key commands:**
- \`git diff HEAD~1\` - See recent changes
- \`git log --oneline -10\` - Recent commit history
- Read files directly to verify claims`);
    // ==========================================================================
    // SECTION 3: CC'S UNCERTAINTIES (This is the key value-add!)
    // ==========================================================================
    if (handoff.uncertainties && handoff.uncertainties.length > 0) {
        sections.push(`
---

# CC'S UNCERTAINTIES - VERIFY THESE

CC flagged these items as uncertain. Your verification is especially valuable:

${handoff.uncertainties.map((u, i) => `
### ${i + 1}. ${u.topic} ${u.severity === 'critical' ? '⚠️ CRITICAL' : ''}

**Question:** ${u.question}
${u.ccAssumption ? `**CC assumed:** ${u.ccAssumption}` : ''}
${u.relevantFiles ? `**Check:** ${u.relevantFiles.join(', ')}` : ''}
`).join('\n')}`);
    }
    // ==========================================================================
    // SECTION 4: SPECIFIC QUESTIONS
    // ==========================================================================
    if (handoff.questions && handoff.questions.length > 0) {
        sections.push(`
---

# QUESTIONS FROM CC

Please answer these specific questions:

${handoff.questions.map((q, i) => `
${i + 1}. **${q.question}**
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccGuess ? `CC thinks: "${q.ccGuess}" - verify this` : ''}
`).join('\n')}`);
    }
    // ==========================================================================
    // SECTION 5: DECISIONS TO EVALUATE (Optional)
    // ==========================================================================
    if (handoff.decisions && handoff.decisions.length > 0) {
        sections.push(`
---

# CC'S DECISIONS - EVALUATE

CC made these key decisions. Do you agree?

${handoff.decisions.map((d, i) => `
${i + 1}. **Decision:** ${d.decision}
   **Rationale:** ${d.rationale}
   ${d.alternatives ? `**Alternatives considered:** ${d.alternatives.join(', ')}` : ''}
`).join('\n')}`);
    }
    // ==========================================================================
    // SECTION 6: PRIORITY FILES (Optional)
    // ==========================================================================
    if (handoff.priorityFiles && handoff.priorityFiles.length > 0) {
        sections.push(`
---

# PRIORITY FILES

Focus your review on these files:
${handoff.priorityFiles.map(f => `- \`${f}\``).join('\n')}`);
    }
    // ==========================================================================
    // SECTION 7: OUTPUT FORMAT
    // ==========================================================================
    if (outputFormat === 'json') {
        sections.push(`
---

# OUTPUT FORMAT

Respond with valid JSON:

\`\`\`json
{
  "findings": [
    {
      "id": "unique-id",
      "category": "security|performance|correctness|architecture|other",
      "severity": "critical|high|medium|low|info",
      "confidence": 0.0-1.0,
      "title": "Brief title",
      "description": "Detailed explanation",
      "location": { "file": "path/to/file.ts", "line_start": 42 },
      "evidence": "Code snippet proving the issue",
      "suggestion": "How to fix"
    }
  ],
  "uncertainty_responses": [
    {
      "uncertainty_index": 1,
      "verified": true|false,
      "finding": "What you found",
      "recommendation": "What CC should do"
    }
  ],
  "question_answers": [
    {
      "question_index": 1,
      "answer": "Your answer",
      "confidence": 0.0-1.0
    }
  ],
  "agreements": ["Things CC did well"],
  "risk_assessment": {
    "level": "critical|high|medium|low|minimal",
    "summary": "Brief risk summary"
  }
}
\`\`\`

**Rules:**
- Use \`git diff\` and file reading to verify before claiming issues
- Include evidence (code snippets) for findings
- Confidence reflects how sure YOU are (not CC)
- Answer CC's uncertainties and questions explicitly`);
    }
    else {
        sections.push(`
---

# OUTPUT FORMAT

Structure your response as:

## Findings
List issues found, with severity and location.

## Uncertainty Responses
Address each of CC's uncertainties.

## Question Answers
Answer CC's specific questions.

## Agreements
What CC did well.

## Risk Assessment
Overall risk level and summary.`);
    }
    return sections.join('\n');
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
    const { workingDir, prompt, taskType, relevantFiles, context, focusAreas, customInstructions } = options;
    // Select role based on focus areas (reuse existing role selection)
    const role = selectRole(focusAreas);
    const sections = [];
    // SECTION 1: ROLE (adapted from review role)
    sections.push(`# ROLE: ${role.name} — Peer Engineer

${role.systemPrompt}

You are acting as a collaborative peer engineer, NOT a reviewer.
Your job is to help Claude Code (CC) with whatever it needs:
planning, debugging, explaining, fixing, exploring, or answering questions.
Be direct, specific, and actionable.`);
    // SECTION 2: TASK
    const taskLabel = taskType ? ` [${taskType.toUpperCase()}]` : '';
    sections.push(`
---

# YOUR TASK${taskLabel}

**Working Directory:** \`${workingDir}\`

**CC's Request:**
${prompt}
${context ? `\n**Additional Context:**\n${context}` : ''}`);
    // SECTION 3: RELEVANT FILES
    if (relevantFiles && relevantFiles.length > 0) {
        sections.push(`
---

# RELEVANT FILES

CC suggests focusing on these files:
${relevantFiles.map(f => `- \`${f}\``).join('\n')}

Read these files to understand the context. Also explore related files if needed.`);
    }
    // SECTION 4: FOCUS AREAS
    if (focusAreas && focusAreas.length > 0) {
        sections.push(`
---

# FOCUS AREAS

Prioritize these aspects: ${focusAreas.join(', ')}`);
    }
    // SECTION 5: CUSTOM INSTRUCTIONS
    if (customInstructions) {
        sections.push(`
---

# ADDITIONAL INSTRUCTIONS

${customInstructions}`);
    }
    // SECTION 6: HOW TO WORK
    sections.push(`
---

# HOW TO WORK

1. Read the relevant files in the working directory
2. Use \`git log --oneline -10\` and \`git diff\` if useful
3. Think through the problem step by step
4. Provide a clear, actionable answer
5. Reference specific files and line numbers
6. Suggest concrete next steps`);
    // SECTION 7: OUTPUT FORMAT
    sections.push(`
---

# OUTPUT FORMAT

Respond with valid JSON:

\`\`\`json
{
  "responder": "<your-name>",
  "answer": "Your detailed response in markdown",
  "confidence": 0.0-1.0,
  "key_points": ["Point 1", "Point 2"],
  "suggested_actions": [
    {
      "action": "What to do",
      "priority": "high|medium|low",
      "file": "path/to/file.ts",
      "rationale": "Why"
    }
  ],
  "file_references": [
    {
      "path": "path/to/file.ts",
      "lines": "10-25",
      "relevance": "Why this file matters"
    }
  ],
  "alternatives": [
    {
      "topic": "The decision point",
      "current_approach": "What exists now",
      "alternative": "Different approach",
      "tradeoffs": { "pros": ["..."], "cons": ["..."] },
      "recommendation": "strongly_prefer|consider|situational|informational"
    }
  ],
  "execution_notes": "Any notes about your process"
}
\`\`\`

**Rules:**
- Read files before making claims
- Reference specific file paths and line numbers
- Be concrete and actionable — no vague suggestions
- Confidence reflects how sure YOU are about your answer
- Include alternatives when there are meaningful tradeoffs`);
    return sections.join('\n');
}
