/**
 * Prompt Builder for AI Review
 *
 * Builds structured prompts that request JSON output from external CLIs.
 * Supports expert roles for specialized reviews.
 */
import { FOCUS_AREA_DESCRIPTIONS } from './types.js';
import { getReviewOutputJsonSchema } from './schema.js';
import { selectExpertRole, EXPERT_ROLES } from './adapters/base.js';
// =============================================================================
// JSON SCHEMA PROMPT SECTION
// =============================================================================
/**
 * Generate the JSON schema section for the prompt
 */
function buildJsonSchemaSection() {
    const schema = getReviewOutputJsonSchema();
    return `OUTPUT FORMAT (JSON):
You MUST respond with valid JSON matching this schema:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

IMPORTANT:
- Output ONLY the JSON object, no markdown wrapping, no explanation before/after
- All fields marked "required" MUST be present
- Use empty arrays [] for sections with no findings
- Confidence scores are 0-1 (e.g., 0.85 for 85% confident)
- Severity levels: critical > high > medium > low > info
- Include file:line in location when you reference specific code`;
}
// =============================================================================
// EXPERT ROLE PROMPT
// =============================================================================
/**
 * Build the expert role section of the prompt
 */
function buildExpertSection(role) {
    return `ROLE: ${role.name}

${role.systemPrompt}

EVALUATION CRITERIA:
${role.evaluationCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
}
/**
 * Build the main review prompt
 */
export function buildReviewPrompt(options) {
    const { request, expertRole, reviewerName, useJsonOutput = true, retryContext, } = options;
    const role = expertRole || selectExpertRole(request.focusAreas);
    const focusDescription = request.focusAreas && request.focusAreas.length > 0
        ? request.focusAreas.map(f => `${f} (${FOCUS_AREA_DESCRIPTIONS[f]})`).join(', ')
        : 'General review';
    const filesAnalyzed = request.analyzedFiles && request.analyzedFiles.length > 0
        ? request.analyzedFiles.join(', ')
        : 'Not specified';
    const sections = [];
    // Section 1: Expert Role
    sections.push(buildExpertSection(role));
    // Section 2: Task Description
    sections.push(`
---

TASK: Review Claude Code's ${request.outputType} and provide structured feedback.

You are reviewing another AI assistant's (Claude Code) analysis of a codebase.
Your job is to:
1. VALIDATE correct findings (agreements)
2. CHALLENGE incorrect assessments (disagreements)
3. ADD issues they missed (new findings)
4. SUGGEST alternatives where applicable
5. ASSESS overall risk`);
    // Section 3: Context
    sections.push(`
---

CONTEXT:
  Working Directory: ${request.workingDir}
  Output Type: ${request.outputType}
  Focus Areas: ${focusDescription}
  Files Analyzed: ${filesAnalyzed}
  Reviewer ID: ${reviewerName}

CLAUDE CODE'S OUTPUT TO REVIEW:
\`\`\`
${request.ccOutput}
\`\`\``);
    // Section 4: Custom Instructions
    if (request.customPrompt) {
        sections.push(`
---

ADDITIONAL INSTRUCTIONS:
${request.customPrompt}`);
    }
    // Section 5: Constraints
    sections.push(`
---

CONSTRAINTS:
• You have filesystem access - READ files to verify claims
• Do NOT modify any files (advisory mode only)
• Reference specific file:line when making claims
• Do NOT hallucinate file paths - verify they exist
• Be skeptical - verify before agreeing with CC's findings`);
    // Section 6: Output Format
    if (useJsonOutput) {
        sections.push(`
---

${buildJsonSchemaSection()}`);
    }
    else {
        // Legacy markdown format for backwards compatibility
        sections.push(`
---

OUTPUT FORMAT (Markdown):
## Agreements
- [Finding]: [Why correct]

## Disagreements
- [Finding]: [Why wrong] - [Correct assessment]

## Additions
- [New finding]: [File:line] - [Impact]

## Alternatives
- [Topic]: [Alternative] - [Tradeoffs]

## Risk Assessment
[Low/Medium/High] - [Reason]`);
    }
    // Section 7: Retry Context (if applicable)
    if (retryContext) {
        sections.push(`
---

⚠️ RETRY ATTEMPT ${retryContext.attemptNumber}/3

Previous attempt failed with: ${retryContext.previousError}

Previous output (truncated):
${retryContext.previousOutput.slice(0, 500)}...

Please ensure your response is valid JSON matching the schema exactly.`);
    }
    return sections.join('\n');
}
// =============================================================================
// PEER REVIEW PROMPT
// =============================================================================
/**
 * Build a prompt for peer review (one model reviewing another's output)
 */
export function buildPeerReviewPrompt(reviewerName, anonymizedReviewerId, reviewToScore, originalCcOutput) {
    return `ROLE: Peer Reviewer

You are evaluating another AI reviewer's analysis for accuracy and quality.

---

ORIGINAL TASK:
Claude Code produced this output that was being reviewed:
\`\`\`
${originalCcOutput}
\`\`\`

---

REVIEW TO EVALUATE (from ${anonymizedReviewerId}):
\`\`\`
${reviewToScore}
\`\`\`

---

TASK: Score each finding in the review above.

For each finding, assess:
1. Is the finding valid? (Does the issue actually exist in the code?)
2. Is it correctly categorized and described?
3. Is the evidence accurate?

OUTPUT FORMAT (JSON):
{
  "reviewer": "${reviewerName}",
  "reviewed_model": "${anonymizedReviewerId}",
  "scores": [
    {
      "finding_id": "<id from the review>",
      "validity": "valid" | "questionable" | "invalid" | "cannot_assess",
      "confidence": 0.0-1.0,
      "notes": "<optional explanation>"
    }
  ],
  "overall_quality": 0.0-1.0,
  "summary": "<brief assessment of the review quality>"
}

Output ONLY the JSON, no other text.`;
}
/**
 * Legacy function - builds old-style 7-section prompt
 * @deprecated Use buildReviewPrompt instead
 */
export function build7SectionPrompt(request) {
    return buildReviewPrompt({
        request: {
            workingDir: request.workingDir,
            ccOutput: request.ccOutput,
            outputType: request.outputType,
            analyzedFiles: request.analyzedFiles,
            focusAreas: request.focusAreas,
            customPrompt: request.customPrompt,
        },
        reviewerName: 'external',
        useJsonOutput: false, // Legacy uses markdown
    });
}
/**
 * Legacy function - builds developer instructions
 * @deprecated Use buildReviewPrompt with expertRole instead
 */
export function buildDeveloperInstructions(cli) {
    const roleMap = {
        codex: EXPERT_ROLES.correctness_analyst,
        gemini: EXPERT_ROLES.architect,
    };
    return buildExpertSection(roleMap[cli]);
}
/**
 * Legacy function - builds retry prompt
 * @deprecated Use buildReviewPrompt with retryContext instead
 */
export function buildRetryPrompt(request, attemptNumber, previousError, previousOutput) {
    return buildReviewPrompt({
        request: {
            workingDir: request.workingDir,
            ccOutput: request.ccOutput,
            outputType: request.outputType,
            analyzedFiles: request.analyzedFiles,
            focusAreas: request.focusAreas,
            customPrompt: request.customPrompt,
        },
        reviewerName: 'external',
        useJsonOutput: false,
        retryContext: {
            attemptNumber,
            previousError,
            previousOutput,
        },
    });
}
/**
 * Validate feedback output structure
 * Now supports both JSON and legacy markdown formats
 */
export function isValidFeedbackOutput(output) {
    // Try JSON first
    try {
        const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, output];
        let jsonStr = jsonMatch[1] || output;
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(jsonStr);
            // Check for required fields
            if (parsed.findings !== undefined &&
                parsed.agreements !== undefined &&
                parsed.disagreements !== undefined &&
                parsed.risk_assessment !== undefined) {
                return true;
            }
        }
    }
    catch {
        // Not valid JSON, try markdown
    }
    // Legacy markdown validation
    const requiredSections = [
        /^## Agreements$/m,
        /^## Disagreements$/m,
        /^## Additions$/m,
        /^## Alternatives$/m,
        /^## Risk Assessment$/m
    ];
    const hasRequiredSections = requiredSections.every(regex => regex.test(output));
    const hasContent = output.length > 100;
    return hasRequiredSections && hasContent;
}
/**
 * Detect output type from CC's output content
 */
export function detectOutputType(ccOutput) {
    if (/\b(vulnerab|injection|XSS|CSRF|SSRF|auth.*issue|security)/i.test(ccOutput)) {
        return 'findings';
    }
    if (/\b(fix|bug|issue|error|proposed fix|solution|patch)/i.test(ccOutput)) {
        return 'proposal';
    }
    if (/\b(architect|design|plan|implement|phase|step \d|structure)/i.test(ccOutput)) {
        return 'plan';
    }
    return 'analysis';
}
