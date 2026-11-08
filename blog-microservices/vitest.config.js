// vitest.config.js
// -----------------------------------------------------------------------------
// Configuração GLOBAL do Vitest, na raiz do monorepo.
//
// Ela define dois PROJETOS de teste, que correspondem às duas camadas
// da nossa pirâmide de testes:
//
//   - unit        → testa funções e classes isoladamente (sem banco, sem rede,
//                   sem subir servidor).
//   - integration → testa as rotas HTTP com Supertest, usando um banco SQLite
//                   em memória.
//
// Os arquivos são localizados pelo padrão:
//   services/<nome-do-servico>/tests/<unit|integration>/**/*.test.js
// -----------------------------------------------------------------------------

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // false: describe, it e expect precisam ser importados explicitamente.
    // Deixa claro, no próprio arquivo, de onde vem cada função de teste.
    globals: false,

    // Não há DOM neste projeto: todo teste roda no ambiente Node.js.
    environment: 'node',

    // Evita que mocks e espiões de um teste "vazem" para o próximo.
    clearMocks: true,
    restoreMocks: true,

    // Cobertura de código: executada com `npm run test:coverage`.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['services/*/src/**/*.js'],
      // As metas mínimas (thresholds) serão definidas a partir da Etapa 2,
      // quando houver código de aplicação para medir.
    },

    // Cada projeto herda (extends: true) as opções definidas acima
    // e acrescenta as suas próprias.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['services/*/tests/unit/**/*.test.js'],
          testTimeout: 5000,
          hookTimeout: 5000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['services/*/tests/integration/**/*.test.js'],
          testTimeout: 15000,
          hookTimeout: 15000,

          // Testes de integração compartilham recursos (banco, portas).
          // Rodar um arquivo por vez evita que um teste interfira no outro.
          fileParallelism: false,

          // Variáveis de ambiente usadas apenas pelos testes de integração.
          // ':memory:' cria um SQLite em memória: é rápido e é descartado
          // quando o teste termina, então cada execução começa limpa.
          env: {
            NODE_ENV: 'test',
            USERS_DB_PATH: ':memory:',
            BLOG_DB_PATH: ':memory:',
          },
        },
      },
    ],
  },
});
