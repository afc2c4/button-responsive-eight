// tests/unit/config.test.js
// -----------------------------------------------------------------------------
// Testes da validação de configuração do ms-blog.
//
// loadConfig recebe um objeto de ambiente comum, então não há dublê nem
// alteração em process.env. O teste passa o ambiente que quiser.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

describe('config do ms-blog', () => {
  it('usa valores padrão quando só o segredo é informado', () => {
    const config = loadConfig({ JWT_SECRET: SEGREDO });

    expect(config.port).toBe(3002);
    expect(config.dbPath).toBe('./data/ms-blog.sqlite');
    expect(config.usersService).toEqual({ baseUrl: 'http://localhost:3001', timeoutMs: 3000 });
  });

  it('remove a barra final da URL do ms-users', () => {
    const config = loadConfig({
      JWT_SECRET: SEGREDO,
      USERS_SERVICE_URL: 'http://ms-users.internal:3001/',
    });

    expect(config.usersService.baseUrl).toBe('http://ms-users.internal:3001');
  });

  it('rejeita URL do ms-users malformada na inicialização', () => {
    expect(() =>
      loadConfig({ JWT_SECRET: SEGREDO, USERS_SERVICE_URL: 'isto-nao-e-url' }),
    ).toThrow('USERS_SERVICE_URL não é uma URL válida');
  });

  it('rejeita protocolo que não seja HTTP', () => {
    expect(() =>
      loadConfig({ JWT_SECRET: SEGREDO, USERS_SERVICE_URL: 'ftp://ms-users.internal' }),
    ).toThrow('USERS_SERVICE_URL deve usar http:// ou https://');
  });

  it('exige um JWT_SECRET com pelo menos 32 caracteres', () => {
    expect(() => loadConfig({ JWT_SECRET: 'curto' })).toThrow('JWT_SECRET é obrigatório');
  });
});
