import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Environnement de test : edge-runtime (compatible Cloudflare Workers)
    environment: 'node',

    // Dossier contenant les tests
    include: ['src/tests/**/*.test.ts'],

    // Rapport lisible dans le terminal
    reporters: ['verbose'],

    // Couverture de code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**']
    },

    // Timeout par test (5 secondes)
    testTimeout: 5000,
  }
})
