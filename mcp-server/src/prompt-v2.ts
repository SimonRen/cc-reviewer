/**
 * Enhanced Prompt Builder v2
 *
 * Builds prompts using rich context with:
 * - Layered information (summary → details)
 * - Focus-area specific emphasis
 * - Smart diff integration
 * - Explicit verification requirements
 * - Targeted questions from CC
 */

import { ReviewContext, contextToPromptString, optimizeContext } from './context.js';
import { getReviewOutputJsonSchema } from './schema.js';
import { EXPERT_ROLES, ExpertRole, selectExpertRole } from './adapters/base.js';
import { FocusArea, FOCUS_AREA_DESCRIPTIONS } from './types.js';

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

const PROMPT_TEMPLATES = {
  security: `You are conducting a SECURITY AUDIT. Your primary focus:

1. **Input Validation**
   - Look for unsanitized user input
   - Check for injection vulnerabilities (SQL, NoSQL, Command, XSS)
   - Verify input length/type constraints

2. **Authentication & Authorization**
   - Session management flaws
   - Privilege escalation vectors
   - Missing access controls

3. **Data Protection**
   - Sensitive data exposure
   - Insecure storage
   - Missing encryption

4. **Dependencies**
   - Known vulnerable packages
   - Outdated dependencies

For EACH security finding, provide:
- CWE ID if applicable
- Attack scenario (how could this be exploited?)
- Severity based on impact + exploitability`,

  performance: `You are conducting a PERFORMANCE REVIEW. Your primary focus:

1. **Algorithmic Complexity**
   - Time complexity (Big-O notation required)
   - Space complexity
   - Identify O(n²) or worse operations

2. **Database & I/O**
   - N+1 query problems
   - Missing indexes
   - Unoptimized queries
   - Blocking I/O in async contexts

3. **Memory Management**
   - Memory leaks
   - Unnecessary object creation
   - Large object retention

4. **Caching Opportunities**
   - Repeated expensive operations
   - Missing memoization
   - Cache invalidation issues

For EACH performance finding, provide:
- Big-O analysis where applicable
- Estimated impact (e.g., "10x slower for 1000 items")
- Concrete optimization suggestion`,

  architecture: `You are conducting an ARCHITECTURE REVIEW. Your primary focus:

1. **SOLID Principles**
   - Single Responsibility violations
   - Open/Closed principle adherence
   - Interface segregation
   - Dependency inversion

2. **Code Organization**
   - Coupling between modules
   - Cohesion within modules
   - Layering violations

3. **Design Patterns**
   - Missing beneficial patterns
   - Anti-patterns present
   - Pattern misuse

4. **Maintainability**
   - Code complexity (cyclomatic complexity)
   - Test coverage implications
   - Documentation gaps

For EACH architecture finding, provide:
- Specific principle/pattern violated
- Concrete refactoring suggestion
- Impact on maintainability`,

  correctness: `You are conducting a CORRECTNESS REVIEW. Your primary focus:

1. **Logic Errors**
   - Off-by-one errors
   - Incorrect conditionals
   - Wrong operator usage

2. **Edge Cases**
   - Null/undefined handling
   - Empty collections
   - Boundary conditions
   - Integer overflow

3. **Concurrency**
   - Race conditions
   - Deadlock potential
   - State inconsistency

4. **Error Handling**
   - Uncaught exceptions
   - Silent failures
   - Incorrect error propagation

For EACH correctness finding, provide:
- Specific input that triggers the bug
- Expected vs actual behavior
- Fix with test case suggestion`,
};

// =============================================================================
// PROMPT BUILDER
// =============================================================================

export interface EnhancedPromptOptions {
  context: ReviewContext;
  reviewerName: string;
  focusAreas?: FocusArea[];
  maxContextTokens?: number;
  includeFullDiffs?: boolean;
  retryContext?: {
    attemptNumber: number;
    previousError: string;
  };
}

/**
 * Build an enhanced review prompt using rich context
 */
export function buildEnhancedPrompt(options: EnhancedPromptOptions): string {
  const {
    context,
    reviewerName,
    focusAreas = [],
    maxContextTokens = 100000,
    includeFullDiffs = true,
    retryContext,
  } = options;

  // Optimize context for token budget
  const optimizedContext = optimizeContext(context, {
    maxTokens: maxContextTokens,
    focusAreas,
    includeFullContent: false,
    includeDiffs: includeFullDiffs,
  });

  const sections: string[] = [];

  // ==========================================================================
  // SECTION 1: ROLE & EXPERTISE
  // ==========================================================================

  const role = selectExpertRole(focusAreas);
  const focusTemplate = focusAreas.length > 0
    ? PROMPT_TEMPLATES[focusAreas[0] as keyof typeof PROMPT_TEMPLATES]
    : null;

  sections.push(`# ROLE: ${role.name}

${role.systemPrompt}

${focusTemplate || ''}`);

  // ==========================================================================
  // SECTION 2: TASK DESCRIPTION
  // ==========================================================================

  sections.push(`
---

# TASK

You are reviewing work done by Claude Code (CC), another AI assistant.

**Your job is to:**
1. ✓ VALIDATE correct findings (agreements)
2. ✗ CHALLENGE incorrect claims (disagreements)
3. + ADD issues CC missed (new findings)
4. ⟷ SUGGEST alternatives where applicable
5. ⚠ ASSESS overall risk

**Critical requirement:** You must READ THE ACTUAL FILES to verify claims.
Do not trust CC's descriptions blindly - verify by reading the code yourself.`);

  // ==========================================================================
  // SECTION 3: CONTEXT (What CC Did)
  // ==========================================================================

  sections.push(`
---

# CONTEXT

${contextToPromptString(optimizedContext)}`);

  // ==========================================================================
  // SECTION 4: CC'S UNCERTAINTIES (Priority for Reviewer)
  // ==========================================================================

  if (context.analysis.uncertainties && context.analysis.uncertainties.length > 0) {
    sections.push(`
---

# CC'S UNCERTAINTIES - PLEASE VERIFY

CC flagged these items as uncertain. Your verification is especially valuable here:

${context.analysis.uncertainties.map((u, i) => `
${i + 1}. **${u.topic}**
   Question: ${u.question}
   ${u.ccBestGuess ? `CC's current assumption: ${u.ccBestGuess}` : ''}
`).join('\n')}`);
  }

  // ==========================================================================
  // SECTION 5: SPECIFIC QUESTIONS (If CC has them)
  // ==========================================================================

  if (context.scope?.questions && context.scope.questions.length > 0) {
    sections.push(`
---

# SPECIFIC QUESTIONS FROM CC

Please address these specific questions:

${context.scope.questions.map((q, i) => `
${i + 1}. ${q.question}
   ${q.context ? `Context: ${q.context}` : ''}
   ${q.ccAnswer ? `CC thinks: ${q.ccAnswer} (verify this)` : ''}
`).join('\n')}`);
  }

  // ==========================================================================
  // SECTION 6: REVIEW PRIORITIES (What to Focus On)
  // ==========================================================================

  if (context.scope?.mustReview && context.scope.mustReview.length > 0) {
    sections.push(`
---

# PRIORITY REVIEW AREAS

Focus your attention on these files:

${context.scope.mustReview.map(r => `
- **${r.path}**: ${r.reason}
  ${r.specificConcerns ? `Concerns: ${r.specificConcerns.join(', ')}` : ''}
`).join('\n')}`);
  }

  // ==========================================================================
  // SECTION 7: VERIFICATION REQUIREMENTS
  // ==========================================================================

  sections.push(`
---

# VERIFICATION REQUIREMENTS

For EVERY finding you report, you MUST:

1. **Verify the file exists** - Read it yourself before claiming issues
2. **Provide exact location** - file:line format (e.g., \`src/auth.ts:42\`)
3. **Include evidence** - Quote the problematic code snippet
4. **State confidence** - 0.0 to 1.0 based on how certain you are
5. **Provide rationale** - Why this is an issue

**DO NOT:**
- Claim issues in files you haven't read
- Invent file paths or line numbers
- Assume code structure without verifying
- Report vague findings without specific locations`);

  // ==========================================================================
  // SECTION 8: OUTPUT FORMAT
  // ==========================================================================

  const schema = getReviewOutputJsonSchema();

  sections.push(`
---

# OUTPUT FORMAT

Respond with valid JSON matching this schema:

\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

**Output rules:**
- Output ONLY the JSON object
- No markdown wrapping, no explanatory text before/after
- All required fields must be present
- Use empty arrays [] for sections with no findings
- Confidence scores are 0.0-1.0 (e.g., 0.85 for 85% confident)
- Severity levels: critical > high > medium > low > info
- Include file:line in location for ALL findings`);

  // ==========================================================================
  // SECTION 9: RETRY CONTEXT (If Applicable)
  // ==========================================================================

  if (retryContext) {
    sections.push(`
---

# ⚠️ RETRY ATTEMPT ${retryContext.attemptNumber}/3

Previous attempt failed: ${retryContext.previousError}

Please ensure:
- Your response is valid JSON matching the schema EXACTLY
- All required fields are present
- No trailing commas or syntax errors
- No text outside the JSON object`);
  }

  return sections.join('\n');
}

// =============================================================================
// DIFF-FOCUSED PROMPT
// =============================================================================

/**
 * Build a prompt focused on reviewing a specific diff
 */
export function buildDiffReviewPrompt(
  diff: string,
  filePath: string,
  context: Partial<ReviewContext>,
  focusAreas?: FocusArea[]
): string {
  const role = selectExpertRole(focusAreas);

  return `# ROLE: ${role.name}

${role.systemPrompt}

---

# TASK: Review This Diff

You are reviewing changes to \`${filePath}\`.

**Diff:**
\`\`\`diff
${diff}
\`\`\`

**Focus on:**
${focusAreas?.map(f => `- ${f}: ${FOCUS_AREA_DESCRIPTIONS[f]}`).join('\n') || '- General code quality'}

**For each issue found:**
1. Specify the line number (from the diff, use + lines for new code)
2. Explain the issue clearly
3. Suggest a fix
4. Rate confidence (0.0-1.0)

Output JSON with format:
\`\`\`json
{
  "findings": [
    {
      "line": <number>,
      "severity": "critical|high|medium|low|info",
      "category": "security|performance|correctness|...",
      "title": "<brief title>",
      "description": "<detailed explanation>",
      "suggestion": "<how to fix>",
      "confidence": <0.0-1.0>
    }
  ],
  "overall_assessment": "<brief summary>",
  "risk_level": "critical|high|medium|low|minimal"
}
\`\`\``;
}

// =============================================================================
// INCREMENTAL REVIEW PROMPT
// =============================================================================

/**
 * Build a follow-up prompt for clarification
 */
export function buildFollowUpPrompt(
  originalContext: ReviewContext,
  previousReview: string,
  questions: Array<{ question: string; context?: string }>
): string {
  return `# FOLLOW-UP REVIEW

You previously reviewed this code and provided findings.

**Original Summary:**
${originalContext.analysis.summary}

**Your Previous Review:**
${previousReview.slice(0, 2000)}${previousReview.length > 2000 ? '...' : ''}

---

# CLARIFICATION NEEDED

Please address these follow-up questions:

${questions.map((q, i) => `
${i + 1}. ${q.question}
   ${q.context ? `Context: ${q.context}` : ''}
`).join('\n')}

---

For each question, provide:
1. Your assessment
2. Evidence from the code
3. Confidence level

Output JSON:
\`\`\`json
{
  "answers": [
    {
      "question_number": <1-N>,
      "answer": "<your answer>",
      "evidence": "<code snippet or file:line reference>",
      "confidence": <0.0-1.0>
    }
  ]
}
\`\`\``;
}
