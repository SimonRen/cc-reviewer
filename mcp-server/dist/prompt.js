/**
 * 7-Section Prompt Builder for External CLI Delegation
 */
import { REVIEWER_PERSONAS, FOCUS_AREA_DESCRIPTIONS } from './types.js';
/**
 * Build the 7-section delegation prompt for external CLIs
 */
export function build7SectionPrompt(request) {
    const { workingDir, ccOutput, outputType, analyzedFiles = [], focusAreas = [], customPrompt } = request;
    const focusDescription = focusAreas.length > 0
        ? focusAreas.map(f => `${f} (${FOCUS_AREA_DESCRIPTIONS[f]})`).join(', ')
        : 'General review';
    const filesAnalyzed = analyzedFiles.length > 0
        ? analyzedFiles.join(', ')
        : 'Not specified';
    const customInstructions = customPrompt
        ? `\n  Special Instructions: ${customPrompt}`
        : '';
    return `TASK: Review CC's ${outputType} and provide structured feedback.

EXPECTED OUTCOME: Identify agreements, disagreements, additions, and alternatives.

CONTEXT:
  Working Directory: ${workingDir}
  Output Type: ${outputType}
  Files Analyzed: ${filesAnalyzed}
  CC's Output:
${indent(ccOutput, 4)}

CONSTRAINTS:
  Focus Areas: ${focusDescription}
  Advisory mode only (no file changes)
  You have filesystem access${customInstructions}

MUST DO:
  • Review CC's findings critically
  • Verify claims by reading files yourself
  • Reference specific file:line when relevant
  • Follow OUTPUT FORMAT exactly

MUST NOT DO:
  • Make any file changes
  • Hallucinate file paths
  • Return unstructured text

OUTPUT FORMAT:
## Agreements
- [Finding]: [Why correct]

## Disagreements
- [Finding]: [Why wrong] - [Correct assessment]

## Additions
- [New finding]: [File:line] - [Impact]

## Alternatives
- [Topic]: [Alternative] - [Tradeoffs]

## Risk Assessment
[Low/Medium/High] - [Reason]`;
}
/**
 * Build the developer instructions (persona) for a specific CLI
 */
export function buildDeveloperInstructions(cli) {
    const persona = REVIEWER_PERSONAS[cli];
    return `You are a ${persona.name} code review expert.

Focus on: ${persona.focus}

Style: ${persona.style}

You are reviewing another AI assistant's (Claude Code) work on a codebase.
Your job is to provide a second opinion - validate their findings, challenge
incorrect assessments, and add anything they missed.

Be specific. Reference file paths and line numbers when relevant.
Use the structured OUTPUT FORMAT provided in the prompt.`;
}
/**
 * Build a retry prompt that includes previous attempt information
 */
export function buildRetryPrompt(request, attemptNumber, previousError, previousOutput) {
    const basePrompt = build7SectionPrompt(request);
    return `TASK: Review CC's ${request.outputType} (RETRY - attempt ${attemptNumber}/3)

PREVIOUS ATTEMPT FAILED:
  Error: ${previousError}
  Raw output (truncated): ${previousOutput.slice(0, 300)}...

ADDITIONAL INSTRUCTION: Follow the OUTPUT FORMAT exactly. Each section header
must start with "## " and contain structured content.

${basePrompt.split('\n').slice(1).join('\n')}`;
}
/**
 * Helper to indent text
 */
function indent(text, spaces) {
    const padding = ' '.repeat(spaces);
    return text.split('\n').map(line => padding + line).join('\n');
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
/**
 * Validate that external CLI output follows expected structure
 */
export function isValidFeedbackOutput(output) {
    const requiredSections = [
        /^## Agreements$/m,
        /^## Disagreements$/m,
        /^## Additions$/m,
        /^## Alternatives$/m,
        /^## Risk Assessment$/m
    ];
    // Must have all required sections: Agreements, Disagreements, Additions, Alternatives, Risk Assessment
    const hasRequiredSections = requiredSections.every(regex => regex.test(output));
    // Must not be empty or too short
    const hasContent = output.length > 100;
    return hasRequiredSections && hasContent;
}
