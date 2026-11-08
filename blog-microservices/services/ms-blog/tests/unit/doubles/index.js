// tests/unit/doubles/index.js
// -----------------------------------------------------------------------------
// Dublês (stubs e mocks) das dependências externas do ms-blog.
//
// Cada função cria um objeto com a MESMA FORMA da dependência real, mas com
// métodos vi.fn(). Assim o service recebe algo que parece o repositório ou o
// cliente HTTP, sem que haja banco ou rede por trás.
//
//   - vi.fn() com mockResolvedValue → STUB: controla o que a dependência devolve.
//   - expect(fn).toHaveBeenCalledWith → MOCK: verifica como a dependência foi usada.
//
// Os dublês são criados em beforeEach nos testes. Ver o documento 03 da Etapa 3.
// -----------------------------------------------------------------------------

import { vi } from 'vitest';

/**
 * Substitui o repositório de posts (o SQLite).
 * Isola a camada de banco: o teste nunca grava nem lê dados reais.
 */
export function createPostsRepositoryStub() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Substitui o cliente HTTP do ms-users.
 * Isola a comunicação entre serviços: o teste controla se o autor "existe",
 * "não existe" ou se o ms-users "está fora do ar".
 */
export function createUsersClientStub() {
  return {
    findUserById: vi.fn(),
  };
}
