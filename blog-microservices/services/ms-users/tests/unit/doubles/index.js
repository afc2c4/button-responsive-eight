// tests/unit/doubles/index.js
// -----------------------------------------------------------------------------
// Dublês (test doubles) reutilizados pelos testes unitários do ms-users.
//
// Cada função cria um OBJETO COM A MESMA FORMA da dependência real, mas cujas
// funções são vi.fn(): funções falsas que:
//   - devolvem o que o teste mandar (stub: controla a ENTRADA do código testado);
//   - registram cada chamada (mock: permite VERIFICAR a saída do código testado).
//
// Como o service só enxerga a forma do objeto, ele não percebe a diferença
// entre o dublê e a implementação real. Nenhum banco, nenhum hash de verdade
// e nenhuma rede são usados.
// -----------------------------------------------------------------------------

import { vi } from 'vitest';

/**
 * Substitui o usersRepository.
 * Cada método precisa de um valor de retorno definido pelo teste (mockResolvedValue).
 */
export function createUsersRepositoryStub() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/** Substitui o passwordHasher (scrypt). Evita o custo de CPU do hash real. */
export function createPasswordHasherStub() {
  return {
    hash: vi.fn(),
    verify: vi.fn(),
  };
}

/** Substitui o emissor de JWT. Evita depender de criptografia e de relógio. */
export function createTokenIssuerStub() {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
  };
}
