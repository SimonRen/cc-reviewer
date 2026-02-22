/**
 * Structured Output Schemas for AI Review
 *
 * Uses Zod for strict validation of reviewer output.
 * This replaces the fragile regex-based markdown validation.
 */
import { z } from 'zod';
// =============================================================================
// SEVERITY & CONFIDENCE SCALES
// =============================================================================
export const SeverityLevel = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const ConfidenceLevel = z.enum(['verified', 'high', 'medium', 'low', 'uncertain']);
// Numeric confidence score (0-1)
export const ConfidenceScore = z.number().min(0).max(1);
// =============================================================================
// CODE LOCATION
// =============================================================================
export const CodeLocation = z.object({
    file: z.string().describe('Relative file path from working directory'),
    line_start: z.number().int().positive().optional().describe('Starting line number'),
    line_end: z.number().int().positive().optional().describe('Ending line number'),
    column_start: z.number().int().nonnegative().optional().describe('Starting column'),
    column_end: z.number().int().nonnegative().optional().describe('Ending column'),
});
// =============================================================================
// REVIEW FINDING
// =============================================================================
export const ReviewFinding = z.object({
    id: z.string().describe('Unique identifier for this finding'),
    category: z.enum([
        'security',
        'performance',
        'architecture',
        'correctness',
        'maintainability',
        'scalability',
        'testing',
        'documentation',
        'best-practice',
        'other'
    ]).describe('Primary category of the finding'),
    severity: SeverityLevel.describe('Impact severity level'),
    confidence: ConfidenceScore.describe('Confidence in this finding (0-1)'),
    title: z.string().max(120).describe('Brief title summarizing the issue'),
    description: z.string().describe('Detailed explanation of the finding'),
    location: CodeLocation.optional().describe('Where in the code this applies'),
    evidence: z.string().optional().describe('Code snippet or proof supporting the finding'),
    suggestion: z.string().optional().describe('Recommended fix or improvement'),
    // Security-specific metadata
    cwe_id: z.string().regex(/^CWE-\d+$/).optional().describe('CWE identifier for security issues'),
    owasp_category: z.string().optional().describe('OWASP Top 10 category if applicable'),
    // Tags for filtering
    tags: z.array(z.string()).optional().describe('Additional classification tags'),
});
// =============================================================================
// AGREEMENT/DISAGREEMENT WITH CC's WORK
// =============================================================================
export const Agreement = z.object({
    original_claim: z.string().describe("The claim from CC's output being validated"),
    assessment: z.enum(['correct', 'mostly_correct', 'partially_correct']),
    confidence: ConfidenceScore,
    supporting_evidence: z.string().optional().describe('Evidence supporting agreement'),
    notes: z.string().optional().describe('Additional context or caveats'),
});
export const Disagreement = z.object({
    original_claim: z.string().describe("The claim from CC's output being challenged"),
    issue: z.enum(['incorrect', 'misleading', 'incomplete', 'outdated', 'hallucinated']),
    confidence: ConfidenceScore,
    reason: z.string().describe('Why this claim is problematic'),
    correction: z.string().optional().describe('The correct assessment'),
    evidence: z.string().optional().describe('Evidence supporting the disagreement'),
});
// =============================================================================
// ALTERNATIVE APPROACH
// =============================================================================
export const Alternative = z.object({
    topic: z.string().describe('What aspect this alternative addresses'),
    current_approach: z.string().describe("Description of CC's approach"),
    alternative: z.string().describe('The suggested alternative'),
    tradeoffs: z.object({
        pros: z.array(z.string()),
        cons: z.array(z.string()),
    }),
    recommendation: z.enum(['strongly_prefer', 'consider', 'situational', 'informational']),
});
// =============================================================================
// RISK ASSESSMENT
// =============================================================================
export const RiskAssessment = z.object({
    overall_level: z.enum(['critical', 'high', 'medium', 'low', 'minimal']),
    score: z.number().min(0).max(100).describe('Numeric risk score 0-100'),
    summary: z.string().max(300).describe('Brief risk summary'),
    top_concerns: z.array(z.string()).describe('Top risk factors'),
    mitigations: z.array(z.string()).optional().describe('Suggested mitigations'),
});
// =============================================================================
// UNCERTAINTY & QUESTION RESPONSES
// =============================================================================
export const UncertaintyResponse = z.object({
    uncertainty_index: z.number().int().positive().describe('1-based index of the uncertainty being addressed'),
    verified: z.boolean().describe('Whether the uncertainty was verified'),
    finding: z.string().describe('What the reviewer found'),
    recommendation: z.string().nullable().optional().describe('What CC should do'),
});
export const QuestionAnswer = z.object({
    question_index: z.number().int().positive().describe('1-based index of the question being answered'),
    answer: z.string().describe('The reviewer answer'),
    confidence: ConfidenceScore.nullable().optional().describe('Confidence in the answer (0-1)'),
});
// =============================================================================
// COMPLETE REVIEW OUTPUT (Single Reviewer)
// =============================================================================
export const ReviewOutput = z.object({
    reviewer: z.string().describe('Name of the reviewing model'),
    timestamp: z.string().datetime().nullable().optional(),
    // Core sections
    findings: z.array(ReviewFinding).describe('New issues discovered'),
    agreements: z.array(Agreement).describe("Validation of CC's correct assessments"),
    disagreements: z.array(Disagreement).describe("Challenges to CC's claims"),
    alternatives: z.array(Alternative).describe('Alternative approaches to consider'),
    // Responses to CC's uncertainties and questions — nullable because OpenAI strict mode sends null
    uncertainty_responses: z.array(UncertaintyResponse).nullable().optional().describe('Responses to CC uncertainties'),
    question_answers: z.array(QuestionAnswer).nullable().optional().describe('Answers to CC questions'),
    // Summary
    risk_assessment: RiskAssessment,
    // Metadata — nullable because OpenAI strict mode sends null
    files_examined: z.array(z.string()).nullable().optional().describe('Files the reviewer actually read'),
    execution_notes: z.string().nullable().optional().describe('Notes about the review process'),
});
// =============================================================================
// PEER REVIEW (Model reviewing another model's output)
// =============================================================================
export const PeerScore = z.object({
    finding_id: z.string(),
    validity: z.enum(['valid', 'questionable', 'invalid', 'cannot_assess']),
    confidence: ConfidenceScore,
    notes: z.string().optional(),
});
export const PeerReview = z.object({
    reviewer: z.string().describe('Model doing the peer review'),
    reviewed_model: z.string().describe('Model being reviewed (anonymized)'),
    scores: z.array(PeerScore),
    overall_quality: z.number().min(0).max(1),
    summary: z.string().optional(),
});
// =============================================================================
// JSON SCHEMA GENERATION FOR PROMPTS
// =============================================================================
/**
 * Generate a simplified JSON schema for embedding in prompts.
 * External CLIs don't support Zod directly, so we provide a JSON schema.
 */
export function getReviewOutputJsonSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        required: ['reviewer', 'findings', 'agreements', 'disagreements', 'alternatives', 'risk_assessment', 'uncertainty_responses', 'question_answers'],
        properties: {
            reviewer: { type: 'string' },
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'category', 'severity', 'confidence', 'title', 'description'],
                    properties: {
                        id: { type: 'string' },
                        category: {
                            type: 'string',
                            enum: ['security', 'performance', 'architecture', 'correctness',
                                'maintainability', 'scalability', 'testing', 'documentation',
                                'best-practice', 'other']
                        },
                        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        title: { type: 'string', maxLength: 120 },
                        description: { type: 'string' }
                    }
                }
            },
            agreements: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['original_claim', 'assessment', 'confidence'],
                    properties: {
                        original_claim: { type: 'string' },
                        assessment: { type: 'string', enum: ['correct', 'mostly_correct', 'partially_correct'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 }
                    }
                }
            },
            disagreements: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['original_claim', 'issue', 'confidence', 'reason'],
                    properties: {
                        original_claim: { type: 'string' },
                        issue: { type: 'string', enum: ['incorrect', 'misleading', 'incomplete', 'outdated', 'hallucinated'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        reason: { type: 'string' }
                    }
                }
            },
            alternatives: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['topic', 'current_approach', 'alternative', 'tradeoffs', 'recommendation'],
                    properties: {
                        topic: { type: 'string' },
                        current_approach: { type: 'string' },
                        alternative: { type: 'string' },
                        tradeoffs: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['pros', 'cons'],
                            properties: {
                                pros: { type: 'array', items: { type: 'string' } },
                                cons: { type: 'array', items: { type: 'string' } }
                            }
                        },
                        recommendation: { type: 'string', enum: ['strongly_prefer', 'consider', 'situational', 'informational'] }
                    }
                }
            },
            uncertainty_responses: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['uncertainty_index', 'verified', 'finding', 'recommendation'],
                    properties: {
                        uncertainty_index: { type: 'integer', minimum: 1 },
                        verified: { type: 'boolean' },
                        finding: { type: 'string' },
                        recommendation: { anyOf: [{ type: 'string' }, { type: 'null' }] }
                    }
                }
            },
            question_answers: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['question_index', 'answer', 'confidence'],
                    properties: {
                        question_index: { type: 'integer', minimum: 1 },
                        answer: { type: 'string' },
                        confidence: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] }
                    }
                }
            },
            risk_assessment: {
                type: 'object',
                additionalProperties: false,
                required: ['overall_level', 'score', 'summary', 'top_concerns'],
                properties: {
                    overall_level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'minimal'] },
                    score: { type: 'number', minimum: 0, maximum: 100 },
                    summary: { type: 'string', maxLength: 300 },
                    top_concerns: { type: 'array', items: { type: 'string' } }
                }
            }
        }
    };
}
/**
 * Normalize reviewer output that deviates from the strict schema.
 * Handles common patterns from external CLIs (e.g. Gemini returning
 * agreements as strings instead of objects, missing required fields).
 */
function normalizeReviewOutput(parsed) {
    const normalized = { ...parsed };
    // Default reviewer if missing
    if (!normalized.reviewer) {
        normalized.reviewer = 'external';
    }
    // Normalize agreements: string[] -> Agreement[]
    if (Array.isArray(normalized.agreements)) {
        normalized.agreements = normalized.agreements.map((a) => {
            if (typeof a === 'string') {
                return { original_claim: a, assessment: 'correct', confidence: 0.7 };
            }
            return a;
        });
    }
    else {
        normalized.agreements = normalized.agreements ?? [];
    }
    // Default missing arrays
    normalized.disagreements = normalized.disagreements ?? [];
    normalized.alternatives = normalized.alternatives ?? [];
    normalized.findings = normalized.findings ?? [];
    // Normalize optional response arrays — drop non-array values
    if (normalized.uncertainty_responses !== undefined && !Array.isArray(normalized.uncertainty_responses)) {
        delete normalized.uncertainty_responses;
    }
    if (normalized.question_answers !== undefined && !Array.isArray(normalized.question_answers)) {
        delete normalized.question_answers;
    }
    // Normalize risk_assessment from simplified formats
    if (!normalized.risk_assessment) {
        const ra = normalized.risk_assessment;
        normalized.risk_assessment = {
            overall_level: 'medium',
            score: 50,
            summary: 'Risk assessment not provided by reviewer',
            top_concerns: [],
        };
    }
    else if (typeof normalized.risk_assessment === 'object') {
        const ra = normalized.risk_assessment;
        // Handle "level" instead of "overall_level", with case normalization
        if (ra.level && !ra.overall_level) {
            ra.overall_level = typeof ra.level === 'string' ? ra.level.toLowerCase() : ra.level;
        }
        else if (typeof ra.overall_level === 'string') {
            ra.overall_level = ra.overall_level.toLowerCase();
        }
        // Default missing fields
        ra.score = ra.score ?? 50;
        ra.summary = ra.summary ?? 'No summary provided';
        ra.top_concerns = ra.top_concerns ?? [];
    }
    return normalized;
}
/**
 * Attempt to parse and validate reviewer output.
 * Returns the validated output or null if invalid.
 */
export function parseReviewOutput(rawOutput) {
    try {
        // Try to extract JSON from the output (may be wrapped in markdown code blocks)
        let jsonStr = rawOutput;
        // Gemini CLI with --output-format json wraps the response in an envelope:
        // { "session_id": "...", "response": "```json\n{...}\n```" }
        // Try to unwrap this envelope first, but only if it matches the envelope shape.
        try {
            const envelope = JSON.parse(rawOutput);
            if (envelope && typeof envelope.session_id === 'string' && typeof envelope.response === 'string') {
                jsonStr = envelope.response;
            }
        }
        catch {
            // Not a valid JSON envelope, continue with raw output
        }
        // Extract from ```json ... ``` blocks
        const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1].trim();
        }
        // Try to find JSON object boundaries
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(jsonStr);
        // Try direct parse first
        const result = ReviewOutput.safeParse(parsed);
        if (result.success) {
            return result.data;
        }
        // Normalize common deviations from external CLIs (e.g. Gemini)
        // Only attempt if parsed object has at least one recognizable review field
        const recognizedFields = ['findings', 'agreements', 'disagreements', 'alternatives', 'risk_assessment', 'reviewer'];
        const hasRecognizedField = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) &&
            recognizedFields.some(f => f in parsed);
        if (!hasRecognizedField) {
            return null;
        }
        const normalized = normalizeReviewOutput(parsed);
        const retryResult = ReviewOutput.safeParse(normalized);
        if (retryResult.success) {
            return retryResult.data;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Convert legacy markdown format to structured output (best effort).
 * This provides backwards compatibility during transition.
 */
export function parseLegacyMarkdownOutput(markdown, reviewer) {
    try {
        const output = {
            reviewer,
            findings: [],
            agreements: [],
            disagreements: [],
            alternatives: [],
            risk_assessment: {
                overall_level: 'medium',
                score: 50,
                summary: 'Unable to parse structured risk assessment',
                top_concerns: [],
            },
        };
        // Parse ## Agreements section
        const agreementsMatch = markdown.match(/## Agreements\n([\s\S]*?)(?=##|$)/);
        if (agreementsMatch) {
            const lines = agreementsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    output.agreements.push({
                        original_claim: content.split(':')[0] || content,
                        assessment: 'correct',
                        confidence: 0.7,
                    });
                }
            }
        }
        // Parse ## Disagreements section
        const disagreementsMatch = markdown.match(/## Disagreements\n([\s\S]*?)(?=##|$)/);
        if (disagreementsMatch) {
            const lines = disagreementsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    output.disagreements.push({
                        original_claim: content.split(':')[0] || content,
                        issue: 'incorrect',
                        confidence: 0.7,
                        reason: content,
                    });
                }
            }
        }
        // Parse ## Additions section as findings
        const additionsMatch = markdown.match(/## Additions\n([\s\S]*?)(?=##|$)/);
        if (additionsMatch) {
            const lines = additionsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            let idx = 0;
            for (const line of lines) {
                const content = line.replace(/^-\s*/, '').trim();
                if (content) {
                    const locationMatch = content.match(/([^:]+):(\d+)/);
                    output.findings.push({
                        id: `legacy-${idx++}`,
                        category: 'other',
                        severity: 'medium',
                        confidence: 0.6,
                        title: content.slice(0, 100),
                        description: content,
                        location: locationMatch ? {
                            file: locationMatch[1],
                            line_start: parseInt(locationMatch[2]),
                        } : undefined,
                    });
                }
            }
        }
        // Parse ## Risk Assessment
        const riskMatch = markdown.match(/## Risk Assessment\n([\s\S]*?)(?=##|$)/);
        if (riskMatch) {
            const riskContent = riskMatch[1].trim();
            const levelMatch = riskContent.match(/\b(critical|high|medium|low|minimal)\b/i);
            if (levelMatch) {
                output.risk_assessment.overall_level = levelMatch[1].toLowerCase();
                output.risk_assessment.score = {
                    critical: 90, high: 70, medium: 50, low: 30, minimal: 10
                }[output.risk_assessment.overall_level];
            }
            output.risk_assessment.summary = riskContent.slice(0, 300);
        }
        return output;
    }
    catch {
        return null;
    }
}
// =============================================================================
// PEER OUTPUT SCHEMA (General-purpose coworker responses)
// =============================================================================
export const SuggestedAction = z.object({
    action: z.string().describe('What to do'),
    priority: z.enum(['high', 'medium', 'low']),
    file: z.string().nullable().optional().describe('Relevant file path'),
    rationale: z.string().describe('Why this action is recommended'),
});
export const FileReference = z.object({
    path: z.string().describe('Relative file path'),
    lines: z.string().nullable().optional().describe('Line range, e.g. "10-25"'),
    relevance: z.string().describe('Why this file matters'),
});
export const PeerOutput = z.object({
    responder: z.string().describe('"codex" or "gemini"'),
    timestamp: z.string().nullable().optional(),
    // Core response
    answer: z.string().describe('Main response text (markdown)'),
    confidence: ConfidenceScore.describe('Confidence in the response (0-1)'),
    // Structured breakdown
    key_points: z.array(z.string()).describe('Bullet summary of main points'),
    // Actionable items
    suggested_actions: z.array(SuggestedAction).describe('Recommended actions'),
    // File references
    file_references: z.array(FileReference).describe('Files examined by the peer'),
    // Optional — nullable because OpenAI strict mode sends null instead of omitting
    alternatives: z.array(Alternative).nullable().optional().describe('Alternative approaches'),
    execution_notes: z.string().nullable().optional().describe('Notes about the process'),
});
// =============================================================================
// PEER INPUT SCHEMA
// =============================================================================
export const TaskType = z.enum(['plan', 'debug', 'explain', 'question', 'fix', 'explore', 'general']);
export const PeerInputSchema = z.object({
    workingDir: z.string().describe('Working directory for filesystem access'),
    prompt: z.string().describe('The question or request from CC'),
    taskType: TaskType.optional().describe('Hint about the type of task'),
    relevantFiles: z.array(z.string()).optional().describe('Files the peer should focus on'),
    context: z.string().optional().describe('Additional context (error messages, prior analysis)'),
    focusAreas: z.array(z.enum([
        'security', 'performance', 'architecture', 'correctness',
        'maintainability', 'scalability', 'testing', 'documentation'
    ])).optional().describe('Areas to focus on'),
    customPrompt: z.string().optional().describe('Additional instructions for the peer'),
});
// =============================================================================
// PEER OUTPUT JSON SCHEMA (for embedding in prompts)
// =============================================================================
export function getPeerOutputJsonSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        required: ['responder', 'answer', 'confidence', 'key_points', 'suggested_actions', 'file_references', 'timestamp', 'alternatives', 'execution_notes'],
        properties: {
            responder: { type: 'string' },
            timestamp: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            answer: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            key_points: {
                type: 'array',
                items: { type: 'string' },
            },
            suggested_actions: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['action', 'priority', 'rationale', 'file'],
                    properties: {
                        action: { type: 'string' },
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        file: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                        rationale: { type: 'string' },
                    },
                },
            },
            file_references: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['path', 'relevance', 'lines'],
                    properties: {
                        path: { type: 'string' },
                        lines: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                        relevance: { type: 'string' },
                    },
                },
            },
            alternatives: {
                anyOf: [
                    {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['topic', 'current_approach', 'alternative', 'tradeoffs', 'recommendation'],
                            properties: {
                                topic: { type: 'string' },
                                current_approach: { type: 'string' },
                                alternative: { type: 'string' },
                                tradeoffs: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['pros', 'cons'],
                                    properties: {
                                        pros: { type: 'array', items: { type: 'string' } },
                                        cons: { type: 'array', items: { type: 'string' } },
                                    },
                                },
                                recommendation: { type: 'string', enum: ['strongly_prefer', 'consider', 'situational', 'informational'] },
                            },
                        },
                    },
                    { type: 'null' },
                ],
            },
            execution_notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
    };
}
// =============================================================================
// PEER OUTPUT PARSING
// =============================================================================
function normalizePeerOutput(parsed) {
    const normalized = { ...parsed };
    if (!normalized.responder) {
        normalized.responder = 'external';
    }
    normalized.key_points = normalized.key_points ?? [];
    normalized.suggested_actions = normalized.suggested_actions ?? [];
    normalized.file_references = normalized.file_references ?? [];
    if (normalized.confidence === undefined) {
        normalized.confidence = 0.5;
    }
    if (!normalized.answer && typeof normalized.response === 'string') {
        normalized.answer = normalized.response;
    }
    return normalized;
}
export function parsePeerOutput(rawOutput) {
    try {
        let jsonStr = rawOutput;
        // Unwrap Gemini envelope
        try {
            const envelope = JSON.parse(rawOutput);
            if (envelope && typeof envelope.session_id === 'string' && typeof envelope.response === 'string') {
                jsonStr = envelope.response;
            }
        }
        catch {
            // Not an envelope
        }
        // Extract from ```json ... ``` blocks
        const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1].trim();
        }
        // Find JSON object boundaries
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(jsonStr);
        // Try direct parse
        const result = PeerOutput.safeParse(parsed);
        if (result.success) {
            return result.data;
        }
        // Normalize and retry
        const recognizedFields = ['responder', 'answer', 'response', 'key_points', 'suggested_actions', 'file_references', 'confidence'];
        const hasRecognizedField = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) &&
            recognizedFields.some(f => f in parsed);
        if (!hasRecognizedField) {
            return null;
        }
        const normalized = normalizePeerOutput(parsed);
        const retryResult = PeerOutput.safeParse(normalized);
        if (retryResult.success) {
            return retryResult.data;
        }
        return null;
    }
    catch {
        return null;
    }
}
