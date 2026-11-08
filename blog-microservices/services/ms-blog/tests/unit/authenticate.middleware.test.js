// tests/unit/authenticate.middleware.test.js
// -----------------------------------------------------------------------------
// Testes unitários do middleware que protege a criação, a edição e a remoção
// de posts. req, res e next são objetos simples (next é um vi.fn()), e o
// verificador de token é um stub. Nenhum JWT real é criado aqui.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticate } from '../../src/middlewares/authenticate.js';
import { UnauthorizedError } from '../../src/errors/app-error.js';

describe('middleware authenticate do ms-blog', () => {
  let tokenVerifier;
  let authenticate;
  let next;

  beforeEach(() => {
    // Stub do verificador: controla o resultado sem depender de criptografia.
    tokenVerifier = { verify: vi.fn() };
    authenticate = createAuthenticate({ tokenVerifier });
    next = vi.fn();
  });

  it('bloqueia requisição sem cabeçalho Authorization', () => {
    const req = { headers: {} };

    authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('bloqueia token inválido ou expirado', () => {
    tokenVerifier.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = { headers: { authorization: 'Bearer token-expirado' } };

    authenticate(req, {}, next);

    const [erro] = next.mock.calls[0];
    expect(erro).toBeInstanceOf(UnauthorizedError);
    expect(erro.message).toBe('Token inválido ou expirado');
    expect(req.user).toBeUndefined();
  });

  it('anexa o autor em req.user e segue o fluxo quando o token é válido', () => {
    tokenVerifier.verify.mockReturnValue({ sub: '5', email: 'ana@exemplo.com' });
    const req = { headers: { authorization: 'Bearer token-valido' } };

    authenticate(req, {}, next);

    expect(tokenVerifier.verify).toHaveBeenCalledWith('token-valido');
    expect(req.user).toEqual({ id: 5, email: 'ana@exemplo.com' });
    expect(next).toHaveBeenCalledWith();
  });
});
