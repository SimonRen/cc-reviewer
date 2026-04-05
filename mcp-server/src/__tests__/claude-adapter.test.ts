/**
 * Tests for Claude adapter — CLI args and error categorization
 */

import { describe, it, expect } from 'vitest';
import { ClaudeAdapter } from '../adapters/claude.js';

// =============================================================================
// ACCESS PRIVATE METHODS VIA TYPE COERCION
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new ClaudeAdapter() as any;

// =============================================================================
// categorizeError
// =============================================================================

describe('ClaudeAdapter — categorizeError', () => {
  it('detects rate limit errors', () => {
    expect(adapter.categorizeError('rate limit exceeded').type).toBe('rate_limit');
    expect(adapter.categorizeError('rate_limit: too many requests').type).toBe('rate_limit');
    expect(adapter.categorizeError('quota exceeded').type).toBe('rate_limit');
  });

  it('detects auth errors from standard keywords', () => {
    expect(adapter.categorizeError('Unauthorized access').type).toBe('auth_error');
    expect(adapter.categorizeError('authentication failed').type).toBe('auth_error');
    expect(adapter.categorizeError('invalid api key').type).toBe('auth_error');
    expect(adapter.categorizeError('HTTP 401 error').type).toBe('auth_error');
    expect(adapter.categorizeError('status code 403').type).toBe('auth_error');
  });

  it('detects "not logged in" as auth error', () => {
    const result = adapter.categorizeError('Not logged in · Please run /login');
    expect(result.type).toBe('auth_error');
    expect(result.message).toContain('Authentication failed');
  });

  it('falls back to cli_error for unknown errors', () => {
    expect(adapter.categorizeError('something went wrong').type).toBe('cli_error');
    expect(adapter.categorizeError('').type).toBe('cli_error');
  });

  it('truncates long error messages to 500 chars', () => {
    const longMessage = 'x'.repeat(1000);
    const result = adapter.categorizeError(longMessage);
    expect(result.message.length).toBeLessThanOrEqual(600); // 500 + prefix
  });
});

// =============================================================================
// getSuggestion
// =============================================================================

describe('ClaudeAdapter — getSuggestion', () => {
  it('suggests claude auth for auth errors', () => {
    const suggestion = adapter.getSuggestion({ type: 'auth_error', message: '' });
    expect(suggestion).toContain('claude auth');
  });

  it('suggests waiting for rate limit errors', () => {
    const suggestion = adapter.getSuggestion({ type: 'rate_limit', message: '' });
    expect(suggestion).toContain('Wait');
  });

  it('suggests install for cli_not_found', () => {
    const suggestion = adapter.getSuggestion({ type: 'cli_not_found', message: '' });
    expect(suggestion).toContain('Install');
  });
});

// =============================================================================
// CLI args (--setting-sources instead of --bare)
// =============================================================================

describe('ClaudeAdapter — CLI args', () => {
  // Access the runCli method's args construction indirectly by inspecting the class
  // We verify the adapter uses --setting-sources '' and NOT --bare
  it('does not use --bare flag (it kills OAuth/keychain auth)', () => {
    // Read the source of runCli to verify args — we test the built artifact
    const source = adapter.runCli.toString();
    expect(source).not.toContain("'--bare'");
  });

  it('uses --setting-sources to skip hooks/plugins without killing auth', () => {
    const source = adapter.runCli.toString();
    expect(source).toContain('--setting-sources');
  });

  it('enforces read-only via --permission-mode plan', () => {
    const source = adapter.runCli.toString();
    expect(source).toContain('--permission-mode');
    expect(source).toContain('plan');
  });

  it('blocks write tools via --disallowed-tools', () => {
    const source = adapter.runCli.toString();
    expect(source).toContain('--disallowed-tools');
    // DISALLOWED_TOOLS is a module-level constant ('Edit Write NotebookEdit'),
    // referenced by name in transpiled output — verify the constant exists
    expect(source).toContain('DISALLOWED_TOOLS');
  });
});
