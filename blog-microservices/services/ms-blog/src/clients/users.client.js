// src/clients/users.client.js
// -----------------------------------------------------------------------------
// Cliente HTTP que o ms-blog usa para conversar com o ms-users.
//
// Este é o ÚNICO arquivo do ms-blog que faz chamadas de rede para outro serviço.
// Isso tem duas consequências práticas:
//   1. Quando a comunicação muda (ex.: trocar HTTP por mensagens), só este
//      arquivo muda.
//   2. Nos testes, basta substituir este cliente para simular qualquer resposta
//      do ms-users, inclusive falhas, sem subir o serviço de verdade.
//
// Traduções feitas aqui:
//   200 → { id, name }            usuário existe
//   404 → null                    usuário não existe (não é erro de infraestrutura)
//   5xx, timeout, conexão recusada, JSON inválido → ServiceUnavailableError (503)
// -----------------------------------------------------------------------------

import { ServiceUnavailableError } from '../errors/app-error.js';

export function createUsersClient({ baseUrl, timeoutMs, fetchImpl = globalThis.fetch }) {
  return Object.freeze({
    /**
     * Busca um usuário no ms-users.
     * @returns {Promise<{id: number, name: string} | null>}
     */
    async findUserById(userId) {
      const url = `${baseUrl}/users/${encodeURIComponent(String(userId))}`;

      let response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          // Sem timeout, uma chamada presa ficaria segurando a requisição do blog.
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Conexão recusada, DNS, timeout: tudo isso significa "não consegui falar com o ms-users".
        throw new ServiceUnavailableError('Serviço de usuários indisponível');
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Serviço de usuários respondeu com status ${response.status}`,
        );
      }

      let body;
      try {
        body = await response.json();
      } catch {
        throw new ServiceUnavailableError('Resposta inválida do serviço de usuários');
      }

      // Só copiamos os campos que o blog precisa. Qualquer outro dado do ms-users
      // fica de fora, o que reduz o acoplamento entre os serviços.
      return { id: body.id, name: body.name };
    },
  });
}
