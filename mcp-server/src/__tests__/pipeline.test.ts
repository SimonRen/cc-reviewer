/**
 * Tests for pipeline.ts - verification and security features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { FileCache, verifyFinding } from '../pipeline.js';
import { ReviewFinding } from '../schema.js';

// =============================================================================
// TEST SETUP
// =============================================================================

const TEST_DIR = join(tmpdir(), 'pipeline-test-' + Date.now());

function createTestFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fullPath, content);
}

function createTestFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    id: 'test-1',
    category: 'correctness',
    severity: 'medium',
    confidence: 0.8,
    title: 'Test finding',
    description: 'Test description',
    ...overrides,
  };
}

// =============================================================================
// FILE CACHE TESTS
// =============================================================================

describe('FileCache', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    createTestFile('existing.ts', 'line 1\nline 2\nline 3\n');
    createTestFile('subdir/nested.ts', 'nested content');
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should return true for existing files', () => {
    const cache = new FileCache(TEST_DIR);
    expect(cache.exists('existing.ts')).toBe(true);
  });

  it('should return false for non-existing files', () => {
    const cache = new FileCache(TEST_DIR);
    expect(cache.exists('nonexistent.ts')).toBe(false);
  });

  it('should cache file existence checks', () => {
    const cache = new FileCache(TEST_DIR);

    // First call
    cache.exists('existing.ts');
    cache.exists('nonexistent.ts');

    // Stats should show 1 file checked (non-existent cached as null)
    const stats = cache.getStats();
    expect(stats.filesChecked).toBe(1); // Only non-existent is cached on exists()
  });

  it('should return file content', () => {
    const cache = new FileCache(TEST_DIR);
    const content = cache.getContent('existing.ts');
    expect(content).toBe('line 1\nline 2\nline 3\n');
  });

  it('should return null for non-existing file content', () => {
    const cache = new FileCache(TEST_DIR);
    const content = cache.getContent('nonexistent.ts');
    expect(content).toBeNull();
  });

  it('should cache file content', () => {
    const cache = new FileCache(TEST_DIR);

    // Read twice
    cache.getContent('existing.ts');
    cache.getContent('existing.ts');

    const stats = cache.getStats();
    expect(stats.filesLoaded).toBe(1);
  });

  it('should return lines array', () => {
    const cache = new FileCache(TEST_DIR);
    const lines = cache.getLines('existing.ts');
    expect(lines).toEqual(['line 1', 'line 2', 'line 3', '']);
  });

  it('should return correct line count', () => {
    const cache = new FileCache(TEST_DIR);
    const count = cache.getLineCount('existing.ts');
    expect(count).toBe(4); // 3 lines + empty line from trailing newline
  });

  it('should handle nested paths', () => {
    const cache = new FileCache(TEST_DIR);
    expect(cache.exists('subdir/nested.ts')).toBe(true);
    expect(cache.getContent('subdir/nested.ts')).toBe('nested content');
  });
});

// =============================================================================
// PATH TRAVERSAL TESTS
// =============================================================================

describe('Path Traversal Protection', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    createTestFile('safe.ts', 'safe content\nline 2\nline 3');
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should block ../../../etc/passwd traversal', async () => {
    const finding = createTestFinding({
      location: { file: '../../../etc/passwd', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(false);
    expect(result.verification.verificationNotes).toContain('Path traversal blocked');
    expect(result.adjustedConfidence).toBeLessThan(0.1);
  });

  it('should block absolute path /etc/passwd', async () => {
    const finding = createTestFinding({
      location: { file: '/etc/passwd', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(false);
    expect(result.verification.verificationNotes).toContain('Path traversal blocked');
  });

  it('should block ../ at start of path', async () => {
    const finding = createTestFinding({
      location: { file: '../sibling/file.ts', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(false);
    expect(result.verification.verificationNotes).toContain('Path traversal blocked');
  });

  it('should allow valid relative paths', async () => {
    const finding = createTestFinding({
      location: { file: 'safe.ts', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(true);
    expect(result.verification.lineValid).toBe(true);
  });

  it('should allow paths with ./ prefix', async () => {
    const finding = createTestFinding({
      location: { file: './safe.ts', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(true);
  });
});

// =============================================================================
// VERIFY FINDING TESTS
// =============================================================================

describe('verifyFinding', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    createTestFile('test.ts', 'const x = 1;\nconst y = 2;\nconst z = 3;');
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should verify existing file without location', async () => {
    const finding = createTestFinding(); // No location

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(true);
    expect(result.verification.lineValid).toBe(true);
  });

  it('should verify existing file with valid line', async () => {
    const finding = createTestFinding({
      location: { file: 'test.ts', line_start: 2 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(true);
    expect(result.verification.lineValid).toBe(true);
  });

  it('should detect non-existing file', async () => {
    const finding = createTestFinding({
      location: { file: 'nonexistent.ts', line_start: 1 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(false);
    expect(result.adjustedConfidence).toBeLessThan(finding.confidence);
  });

  it('should detect invalid line number', async () => {
    const finding = createTestFinding({
      location: { file: 'test.ts', line_start: 999 },
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.fileExists).toBe(true);
    expect(result.verification.lineValid).toBe(false);
    expect(result.verification.verificationNotes).toContain('exceeds file length');
  });

  it('should verify matching evidence', async () => {
    const finding = createTestFinding({
      location: { file: 'test.ts', line_start: 2 },
      evidence: 'const y = 2',
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.codeSnippetMatches).toBe(true);
    expect(result.adjustedConfidence).toBeGreaterThanOrEqual(finding.confidence);
  });

  it('should detect non-matching evidence', async () => {
    const finding = createTestFinding({
      location: { file: 'test.ts', line_start: 2 },
      evidence: 'completely different code',
    });

    const result = await verifyFinding(finding, TEST_DIR);

    expect(result.verification.codeSnippetMatches).toBe(false);
    expect(result.adjustedConfidence).toBeLessThan(finding.confidence);
  });

  it('should use cache when provided', async () => {
    const cache = new FileCache(TEST_DIR);
    const finding = createTestFinding({
      location: { file: 'test.ts', line_start: 1 },
    });

    // Verify multiple times with same cache
    await verifyFinding(finding, TEST_DIR, cache);
    await verifyFinding(finding, TEST_DIR, cache);
    await verifyFinding(finding, TEST_DIR, cache);

    const stats = cache.getStats();
    expect(stats.filesLoaded).toBe(1);
  });
});
