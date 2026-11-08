// tests/unit/users.client.test.js
// -----------------------------------------------------------------------------
// Testes unitários do cliente HTTP que consulta o ms-users.
//
// Aqui o dublê fica na fronteira de REDE: injetamos um fetch falso no lugar do
// fetch global. Assim testamos a tradução das respostas (200, 404, 500, timeout)
// sem subir o ms-users.
//
// Exceção intencional: o teste de timeout usa o AbortSignal de verdade,
// porque é justamente o comportamento do sinal que queremos verificar.
// -----------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';
import { createUsersClient } from '../../src/clients/users.client.js';
import { ServiceUnavailableError } from '../../src/errors/app-error.js';

const BASE_URL = 'http://ms-users.test';

describe('UsersClient · findUserById', () => {
  it('monta a URL correta e devolve só id e nome do usuário', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 7, name: 'Ana', email: 'ana@exemplo.com', createdAt: 'c' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

    const usuario = await client.findUserById(7);

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/users/7`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // O e-mail do ms-users não deve atravessar a fronteira entre os serviços.
    expect(usuario).toEqual({ id: 7, name: 'Ana' });
  });

  it('devolve null quando o ms-users responde 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

    await expect(client.findUserById(999)).resolves.toBeNull();
  });

  it('transforma erro 500 do ms-users em ServiceUnavailableError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

    await expect(client.findUserById(1)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('transforma falha de conexão em ServiceUnavailableError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

    await expect(client.findUserById(1)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('transforma resposta com JSON inválido em ServiceUnavailableError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('isto não é json', { status: 200 }));
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

    await expect(client.findUserById(1)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('desiste após o tempo limite, sem deixar a requisição presa', async () => {
    // Um "ms-users" que nunca responde: só termina quando o sinal de cancelamento dispara.
    const fetchImpl = (url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 20, fetchImpl });

    await expect(client.findUserById(1)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
