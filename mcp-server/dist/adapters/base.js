/**
 * Base Adapter Interface for AI Reviewers
 *
 * This provides a generic interface that any AI CLI can implement.
 * Makes it easy to add new models (Ollama, Azure, etc.) without
 * changing the core orchestration logic.
 */
/** @deprecated Use handoff.ts selectRole() instead */
export const EXPERT_ROLES = {
    security_auditor: {
        name: 'Security Auditor', description: 'Security vulnerabilities',
        systemPrompt: 'Security auditor. Focus on injection, auth bypass, data exposure, input validation.',
        focusAreas: ['security'], evaluationCriteria: ['Injection', 'Auth', 'Data exposure'],
    },
    performance_engineer: {
        name: 'Performance Engineer', description: 'Performance optimization',
        systemPrompt: 'Performance engineer. Focus on complexity, N+1 queries, memory leaks.',
        focusAreas: ['performance', 'scalability'], evaluationCriteria: ['Complexity', 'Memory', 'I/O'],
    },
    architect: {
        name: 'Software Architect', description: 'Architecture and design',
        systemPrompt: 'Software architect. Focus on SOLID, coupling, abstractions.',
        focusAreas: ['architecture', 'maintainability'], evaluationCriteria: ['SOLID', 'Coupling', 'Patterns'],
    },
    correctness_analyst: {
        name: 'Correctness Analyst', description: 'Logic errors and bugs',
        systemPrompt: 'Correctness analyst. Focus on logic errors, edge cases, race conditions.',
        focusAreas: ['correctness', 'testing'], evaluationCriteria: ['Logic', 'Edge cases', 'Concurrency'],
    },
    general_reviewer: {
        name: 'General Reviewer', description: 'Balanced review',
        systemPrompt: 'Senior engineer. Review correctness, security, performance, maintainability.',
        focusAreas: ['security', 'performance', 'architecture', 'correctness', 'maintainability'],
        evaluationCriteria: ['Correctness', 'Security', 'Performance', 'Quality'],
    },
};
/** @deprecated Use handoff.ts selectRole() instead */
export function selectExpertRole(focusAreas) {
    if (!focusAreas || focusAreas.length === 0)
        return EXPERT_ROLES.general_reviewer;
    if (focusAreas.includes('security'))
        return EXPERT_ROLES.security_auditor;
    if (focusAreas.includes('performance') || focusAreas.includes('scalability'))
        return EXPERT_ROLES.performance_engineer;
    if (focusAreas.includes('architecture') || focusAreas.includes('maintainability'))
        return EXPERT_ROLES.architect;
    if (focusAreas.includes('correctness') || focusAreas.includes('testing'))
        return EXPERT_ROLES.correctness_analyst;
    return EXPERT_ROLES.general_reviewer;
}
// =============================================================================
// ADAPTER REGISTRY
// =============================================================================
const adapterRegistry = new Map();
export function registerAdapter(adapter) {
    adapterRegistry.set(adapter.id, adapter);
}
export function getAdapter(id) {
    return adapterRegistry.get(id);
}
export function getAllAdapters() {
    return Array.from(adapterRegistry.values());
}
export async function getAvailableAdapters() {
    const adapters = getAllAdapters();
    const availability = await Promise.all(adapters.map(async (adapter) => ({
        adapter,
        available: await adapter.isAvailable(),
    })));
    return availability.filter((a) => a.available).map((a) => a.adapter);
}
/**
 * Select the best available adapter for given focus areas
 */
export async function selectBestAdapter(focusAreas) {
    const available = await getAvailableAdapters();
    if (available.length === 0)
        return null;
    if (!focusAreas || focusAreas.length === 0) {
        return available[0]; // Return first available
    }
    // Score each adapter by how well it matches the focus areas
    const scored = available.map((adapter) => {
        const caps = adapter.getCapabilities();
        let score = 0;
        for (const focus of focusAreas) {
            if (caps.strengths.includes(focus))
                score += 2;
            else if (!caps.weaknesses.includes(focus))
                score += 1;
            else
                score -= 1;
        }
        return { adapter, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].adapter;
}
