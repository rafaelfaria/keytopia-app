import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the free-tools logic.
 *
 * Deliberately node-environment and dependency-free: what needs testing here is
 * arithmetic, aggregation, determinism and the registries agreeing with each
 * other, none of which needs a DOM. The one module that touches localStorage
 * (src/lib/tools/storage.ts) is written to work without it and is tested
 * against a minimal in-memory stand-in, which also exercises the private-mode
 * path that would otherwise never run.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
