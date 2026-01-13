/**
 * Adapter Registry
 *
 * Exports all registered adapters and utility functions.
 */
import './codex.js';
import './gemini.js';
export * from './base.js';
export { codexAdapter } from './codex.js';
export { geminiAdapter } from './gemini.js';
