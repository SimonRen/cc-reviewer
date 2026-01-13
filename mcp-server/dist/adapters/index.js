/**
 * Adapter Registry
 *
 * Exports all registered adapters and utility functions.
 */
// Import adapters to register them
import './codex.js';
import './gemini.js';
// Re-export everything from base
export * from './base.js';
// Export specific adapters
export { codexAdapter } from './codex.js';
export { geminiAdapter } from './gemini.js';
