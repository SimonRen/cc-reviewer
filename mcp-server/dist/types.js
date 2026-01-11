/**
 * Types for AI Reviewer MCP Server
 */
export const REVIEWER_PERSONAS = {
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
export const FOCUS_AREA_DESCRIPTIONS = {
    security: 'Vulnerabilities, auth, input validation',
    performance: 'Speed, memory, efficiency',
    architecture: 'Design patterns, structure, coupling',
    correctness: 'Logic errors, edge cases, bugs',
    maintainability: 'Code clarity, documentation, complexity',
    scalability: 'Load handling, bottlenecks',
    testing: 'Test coverage, test quality',
    documentation: 'Comments, docs, API docs'
};
