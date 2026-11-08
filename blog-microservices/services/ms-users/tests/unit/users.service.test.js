// tests/unit/users.service.test.js
// -----------------------------------------------------------------------------
// Testes unitários das regras de negócio do CRUD de usuários.
//
// Isolamento: o usersService recebe um repositório STUB e um hasher STUB.
// Nenhum destes testes abre banco, calcula scrypt de verdade ou usa a rede.
// Se um teste falhar, o defeito está na regra de negócio, e não na infraestrutura.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import { createUsersService } from '../../src/services/users.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/errors/app-error.js';
import { createPasswordHasherStub, createUsersRepositoryStub } from './doubles/index.js';

const ENTRADA_VALIDA = Object.freeze({
  name: '  Ana Souza  ',
  email: 'Ana@Exemplo.com',
  password: 'senha-forte-123',
});

describe('UsersService · criação de usuário (register)', () => {
  let usersRepository;
  let passwordHasher;
  let usersService;

  beforeEach(() => {
    // Recriados a cada teste. Motivo: a implementação configurada com
    // mockResolvedValue num teste (ex.: findByEmail) continuaria valendo no
    // teste seguinte, porque clearMocks zera só o histórico de chamadas.
    usersRepository = createUsersRepositoryStub();
    passwordHasher = createPasswordHasherStub();
    usersService = createUsersService({ usersRepository, passwordHasher });
  });

  it('cadastra o usuário quando o e-mail ainda não existe', async () => {
    // Stubs: definimos o que cada dependência devolve.
    usersRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('scrypt:salt:hash-falso');
    usersRepository.create.mockResolvedValue({
      id: 1,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      passwordHash: 'scrypt:salt:hash-falso',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const resultado = await usersService.register(ENTRADA_VALIDA);

    // Mocks: verificamos as interações com as dependências.
    expect(usersRepository.findByEmail).toHaveBeenCalledWith('ana@exemplo.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('senha-forte-123');
    expect(usersRepository.create).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      passwordHash: 'scrypt:salt:hash-falso',
    });

    expect(resultado).toEqual({
      id: 1,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('não devolve a senha nem o hash no retorno', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('scrypt:salt:hash-falso');
    usersRepository.create.mockResolvedValue({
      id: 1,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      passwordHash: 'scrypt:salt:hash-falso',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const resultado = await usersService.register(ENTRADA_VALIDA);

    expect(resultado).not.toHaveProperty('passwordHash');
    expect(resultado).not.toHaveProperty('password');
  });

  it('bloqueia o cadastro quando o e-mail já existe, sem gerar hash nem gravar', async () => {
    usersRepository.findByEmail.mockResolvedValue({ id: 7, email: 'ana@exemplo.com' });

    await expect(usersService.register(ENTRADA_VALIDA)).rejects.toThrow(ConflictError);

    // O ponto mais importante do teste: a gravação NUNCA é tentada.
    expect(usersRepository.create).not.toHaveBeenCalled();
    // E o custo do hash também é evitado.
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('considera duplicado o mesmo e-mail com maiúsculas e espaços diferentes', async () => {
    usersRepository.findByEmail.mockResolvedValue({ id: 7, email: 'ana@exemplo.com' });

    await expect(
      usersService.register({ ...ENTRADA_VALIDA, email: '  ANA@exemplo.COM ' }),
    ).rejects.toThrow(ConflictError);

    // A consulta usa o e-mail já normalizado.
    expect(usersRepository.findByEmail).toHaveBeenCalledWith('ana@exemplo.com');
  });

  it('rejeita senha curta sem consultar o repositório', async () => {
    await expect(
      usersService.register({ ...ENTRADA_VALIDA, password: '123' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { password: expect.any(String) },
    });

    expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('rejeita e-mail malformado com detalhe do campo', async () => {
    const erro = await usersService
      .register({ ...ENTRADA_VALIDA, email: 'ana-sem-arroba.com' })
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ValidationError);
    expect(erro.details).toEqual({ email: 'E-mail inválido' });
    expect(usersRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('propaga falhas de infraestrutura do repositório sem transformá-las', async () => {
    usersRepository.findByEmail.mockRejectedValue(new Error('banco indisponível'));

    await expect(usersService.register(ENTRADA_VALIDA)).rejects.toThrow('banco indisponível');
    expect(usersRepository.create).not.toHaveBeenCalled();
  });
});

describe('UsersService · regras de dono na atualização (update)', () => {
  let usersRepository;
  let passwordHasher;
  let usersService;

  beforeEach(() => {
    usersRepository = createUsersRepositoryStub();
    passwordHasher = createPasswordHasherStub();
    usersService = createUsersService({ usersRepository, passwordHasher });
  });

  it('impede que um usuário altere a conta de outro', async () => {
    // Usuário 2 tenta alterar o usuário 1.
    await expect(usersService.update(2, 1, { name: 'Invasor' })).rejects.toThrow(ForbiddenError);

    expect(usersRepository.findById).not.toHaveBeenCalled();
    expect(usersRepository.update).not.toHaveBeenCalled();
  });

  it('impede trocar o e-mail para um endereço já usado por outra conta', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
    });
    usersRepository.findByEmail.mockResolvedValue({ id: 2, email: 'bia@exemplo.com' });

    await expect(usersService.update(1, 1, { email: 'bia@exemplo.com' })).rejects.toThrow(
      ConflictError,
    );
    expect(usersRepository.update).not.toHaveBeenCalled();
  });

  it('não trata como duplicado o próprio e-mail, e só envia os campos que mudaram', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    usersRepository.update.mockResolvedValue({
      id: 1,
      name: 'Ana Maria',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const resultado = await usersService.update(1, 1, {
      name: 'Ana Maria',
      email: 'ana@exemplo.com',
    });

    // O e-mail não mudou, então não entra no patch.
    expect(usersRepository.update).toHaveBeenCalledWith(1, { name: 'Ana Maria' });
    expect(resultado).toEqual({
      id: 1,
      name: 'Ana Maria',
      email: 'ana@exemplo.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('gera um novo hash quando a senha é alterada', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@exemplo.com',
      passwordHash: 'hash-antigo',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    passwordHasher.hash.mockResolvedValue('hash-novo');
    usersRepository.update.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@exemplo.com',
      passwordHash: 'hash-novo',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await usersService.update(1, 1, { password: 'nova-senha-456' });

    expect(passwordHasher.hash).toHaveBeenCalledWith('nova-senha-456');
    expect(usersRepository.update).toHaveBeenCalledWith(1, { passwordHash: 'hash-novo' });
  });
});

describe('UsersService · exclusão (remove)', () => {
  let usersRepository;
  let passwordHasher;
  let usersService;

  beforeEach(() => {
    usersRepository = createUsersRepositoryStub();
    passwordHasher = createPasswordHasherStub();
    usersService = createUsersService({ usersRepository, passwordHasher });
  });

  it('impede a exclusão da conta de outro usuário', async () => {
    await expect(usersService.remove(2, 1)).rejects.toThrow(ForbiddenError);
    expect(usersRepository.delete).not.toHaveBeenCalled();
  });

  it('responde 404 quando o repositório não encontra o usuário a remover', async () => {
    usersRepository.delete.mockResolvedValue(false);

    await expect(usersService.remove(1, 1)).rejects.toThrow(NotFoundError);
    expect(usersRepository.delete).toHaveBeenCalledWith(1);
  });
});

describe('UsersService · consultas e privacidade', () => {
  let usersRepository;
  let passwordHasher;
  let usersService;

  beforeEach(() => {
    usersRepository = createUsersRepositoryStub();
    passwordHasher = createPasswordHasherStub();
    usersService = createUsersService({ usersRepository, passwordHasher });
  });

  it('lista apenas perfis públicos, sem e-mail nem hash', async () => {
    usersRepository.list.mockResolvedValue([
      { id: 1, name: 'Ana', email: 'ana@exemplo.com', passwordHash: 'h1', createdAt: 'd1' },
      { id: 2, name: 'Bia', email: 'bia@exemplo.com', passwordHash: 'h2', createdAt: 'd2' },
    ]);

    const lista = await usersService.listPublicProfiles();

    expect(lista).toEqual([
      { id: 1, name: 'Ana', createdAt: 'd1' },
      { id: 2, name: 'Bia', createdAt: 'd2' },
    ]);
    lista.forEach((perfil) => {
      expect(perfil).not.toHaveProperty('email');
      expect(perfil).not.toHaveProperty('passwordHash');
    });
  });

  it('responde 404 ao consultar um usuário inexistente', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(usersService.getPublicProfile(99)).rejects.toThrow(NotFoundError);
    expect(usersRepository.findById).toHaveBeenCalledWith(99);
  });

  it('permite trocar o e-mail para um endereço que ainda não está em uso', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
      createdAt: 'd1',
    });
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.update.mockResolvedValue({
      id: 1,
      name: 'Ana',
      email: 'ana.nova@exemplo.com',
      passwordHash: 'hash',
      createdAt: 'd1',
    });

    const resultado = await usersService.update(1, 1, { email: 'Ana.Nova@Exemplo.com' });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('ana.nova@exemplo.com');
    expect(usersRepository.update).toHaveBeenCalledWith(1, { email: 'ana.nova@exemplo.com' });
    expect(resultado.email).toBe('ana.nova@exemplo.com');
  });
});
