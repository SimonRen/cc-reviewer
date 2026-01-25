#!/usr/bin/env node
/**
 * AI Reviewer MCP Server
 *
 * Provides tools for getting second-opinion reviews from external AI CLIs
 * (Codex and Gemini) on Claude Code's work.
 *
 * Features:
 * - Single model review (codex_review, gemini_review)
 * - Multi-model parallel review (multi_review)
 * - Structured JSON output with confidence scores
 * - Expert role specialization per focus area
 */
import './adapters/index.js';
