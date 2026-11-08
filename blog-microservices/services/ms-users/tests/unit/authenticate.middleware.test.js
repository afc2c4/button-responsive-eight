// tests/unit/authenticate.middleware.test.js
// -----------------------------------------------------------------------------
// Testes unitários do middleware que protege as rotas autenticadas.
//
// O Express não é necessário aqui: req, res e next são objetos simples
// (e vi.fn() para o next). Assim o teste fica rápido e focado na decisão:
// deixar a requisição seguir ou bloqueá-la.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticate } from '../../src/middlewares/authenticate.js';
import { UnauthorizedError } from '../../src/errors/app-error.js';
import { createTokenIssuerStub } from './doubles/index.js';

describe('middleware authenticate · proteção de rotas', () => {
  let tokenIssuer;
  let authenticate;
  let next;

  beforeEach(() => {
    tokenIssuer = createTokenIssuerStub();
    authenticate = createAuthenticate({ tokenIssuer });
    next = vi.fn();
  });

  it('bloqueia requisição sem cabeçalho Authorization', () => {
    const req = { headers: {} };

    authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(tokenIssuer.verify).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('bloqueia esquema de autenticação diferente de Bearer', () => {
    const req = { headers: { authorization: 'Basic dXN1YXJpbzpzZW5oYQ==' } };

    authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(tokenIssuer.verify).not.toHaveBeenCalled();
  });

  it('bloqueia token inválido ou expirado', () => {
    tokenIssuer.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = { headers: { authorization: 'Bearer token-expirado' } };

    authenticate(req, {}, next);

    const [erro] = next.mock.calls[0];
    expect(erro).toBeInstanceOf(UnauthorizedError);
    expect(erro.message).toBe('Token inválido ou expirado');
    expect(req.user).toBeUndefined();
  });

  it('bloqueia token válido cujo sub não é um identificador numérico', () => {
    tokenIssuer.verify.mockReturnValue({ sub: 'nao-e-numero', email: 'x@exemplo.com' });
    const req = { headers: { authorization: 'Bearer token-estranho' } };

    authenticate(req, {}, next);

    const [erro] = next.mock.calls[0];
    expect(erro).toBeInstanceOf(UnauthorizedError);
    expect(req.user).toBeUndefined();
  });

  it('anexa o usuário em req.user e segue o fluxo quando o token é válido', () => {
    tokenIssuer.verify.mockReturnValue({ sub: '5', email: 'ana@exemplo.com' });
    const req = { headers: { authorization: 'Bearer token-valido' } };

    authenticate(req, {}, next);

    expect(tokenIssuer.verify).toHaveBeenCalledWith('token-valido');
    expect(req.user).toEqual({ id: 5, email: 'ana@exemplo.com' });
    // next() sem argumentos significa "tudo certo, siga para a rota".
    expect(next).toHaveBeenCalledWith();
  });
});
