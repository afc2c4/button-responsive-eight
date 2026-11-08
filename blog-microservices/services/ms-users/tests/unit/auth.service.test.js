// tests/unit/auth.service.test.js
// -----------------------------------------------------------------------------
// Testes unitários da autenticação (login com e-mail e senha, emissão de JWT).
//
// Isolamento: repositório, hasher e emissor de token são STUBS.
// Assim testamos a LÓGICA do login: quando emitir token, quando recusar,
// qual mensagem devolver e quais chamadas fazer. O scrypt e o JWT reais
// têm testes próprios, fora deste arquivo.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService, INVALID_CREDENTIALS_MESSAGE } from '../../src/services/auth.service.js';
import { UnauthorizedError, ValidationError } from '../../src/errors/app-error.js';
import { DUMMY_PASSWORD_HASH } from '../../src/security/password.js';
import {
  createPasswordHasherStub,
  createTokenIssuerStub,
  createUsersRepositoryStub,
} from './doubles/index.js';

const USUARIO_EXISTENTE = Object.freeze({
  id: 1,
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  passwordHash: 'scrypt:salt:hash-guardado',
});

describe('AuthService · login', () => {
  let usersRepository;
  let passwordHasher;
  let tokenIssuer;
  let authService;

  beforeEach(() => {
    usersRepository = createUsersRepositoryStub();
    passwordHasher = createPasswordHasherStub();
    tokenIssuer = createTokenIssuerStub();
    authService = createAuthService({
      usersRepository,
      passwordHasher,
      tokenIssuer,
      tokenExpiresInSeconds: 3600,
    });
  });

  it('emite um access token quando e-mail e senha conferem', async () => {
    usersRepository.findByEmail.mockResolvedValue(USUARIO_EXISTENTE);
    passwordHasher.verify.mockResolvedValue(true);
    tokenIssuer.sign.mockReturnValue('jwt-falso');

    const sessao = await authService.login({
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
    });

    // Mock: a senha digitada é comparada com o hash GUARDADO, nunca com texto puro.
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'senha-forte-123',
      'scrypt:salt:hash-guardado',
    );
    // Mock: o token leva o id (sub) e o e-mail do usuário.
    expect(tokenIssuer.sign).toHaveBeenCalledWith({ sub: '1', email: 'ana@exemplo.com' });

    expect(sessao).toEqual({
      accessToken: 'jwt-falso',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
  });

  it('recusa senha incorreta e não emite nenhum token', async () => {
    usersRepository.findByEmail.mockResolvedValue(USUARIO_EXISTENTE);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'ana@exemplo.com', password: 'senha-errada' }),
    ).rejects.toThrow(UnauthorizedError);

    expect(tokenIssuer.sign).not.toHaveBeenCalled();
  });

  it('responde com a MESMA mensagem quando o e-mail não existe', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'fantasma@exemplo.com', password: 'qualquer-senha' }),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);

    expect(tokenIssuer.sign).not.toHaveBeenCalled();
  });

  it('executa a verificação de senha mesmo quando o e-mail não existe', async () => {
    // Este é o teste que protege contra "enumeração de usuários":
    // o login gasta o mesmo trabalho nos dois casos, usando o hash de referência.
    usersRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'fantasma@exemplo.com', password: 'qualquer-senha' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(passwordHasher.verify).toHaveBeenCalledWith('qualquer-senha', DUMMY_PASSWORD_HASH);
  });

  it('normaliza o e-mail antes de buscar o usuário', async () => {
    usersRepository.findByEmail.mockResolvedValue(USUARIO_EXISTENTE);
    passwordHasher.verify.mockResolvedValue(true);
    tokenIssuer.sign.mockReturnValue('jwt-falso');

    await authService.login({ email: '  ANA@Exemplo.com ', password: 'senha-forte-123' });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('ana@exemplo.com');
  });

  it('valida a entrada antes de consultar o repositório', async () => {
    await expect(authService.login({ email: 'ana@exemplo.com' })).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });
});
