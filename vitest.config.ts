import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = process.cwd();
const alias = {
  '@atc/shared': path.resolve(root, 'packages/shared/src/index.ts'),
  '@atc/config': path.resolve(root, 'packages/config/src/index.ts'),
  '@atc/market-data': path.resolve(root, 'packages/market-data/src/index.ts'),
  '@atc/technical-analysis': path.resolve(root, 'packages/technical-analysis/src/index.ts'),
  '@atc/news': path.resolve(root, 'packages/news/src/index.ts'),
  '@atc/economic-calendar': path.resolve(root, 'packages/economic-calendar/src/index.ts'),
  '@atc/ai-copilot': path.resolve(root, 'packages/ai-copilot/src/index.ts'),
  '@atc/ai-engine': path.resolve(root, 'packages/ai-engine/src/index.ts'),
  '@atc/risk-engine': path.resolve(root, 'packages/risk-engine/src/index.ts'),
  '@atc/trading-domain': path.resolve(root, 'packages/trading-domain/src/index.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/**/src/**/*.ts', 'apps/api/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
