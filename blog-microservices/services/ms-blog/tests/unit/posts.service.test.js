// tests/unit/posts.service.test.js
// -----------------------------------------------------------------------------
// Testes unitários das regras de negócio do CRUD de posts.
//
// Isolamento: o postsService recebe um repositório STUB (sem SQLite) e um
// cliente do ms-users STUB (sem HTTP). Os testes verificam a lógica:
//   - quais regras são aplicadas e em que ordem;
//   - quando a gravação é (ou não é) tentada;
//   - quais chamadas ao ms-users acontecem.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import { createPostsService } from '../../src/services/posts.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  ValidationError,
} from '../../src/errors/app-error.js';
import { createPostsRepositoryStub, createUsersClientStub } from './doubles/index.js';

const AUTOR = Object.freeze({ id: 1, name: 'Ana Souza' });

const POST_EXISTENTE = Object.freeze({
  id: 10,
  title: 'Título original',
  content: 'Conteúdo original do post',
  authorId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const ENTRADA_VALIDA = Object.freeze({
  title: '  Meu primeiro post  ',
  content: '  Um conteúdo com texto suficiente.  ',
});

describe('PostsService · criação (create)', () => {
  let postsRepository;
  let usersClient;
  let postsService;

  beforeEach(() => {
    postsRepository = createPostsRepositoryStub();
    usersClient = createUsersClientStub();
    postsService = createPostsService({ postsRepository, usersClient });
  });

  it('cria o post quando título, conteúdo e autor são válidos', async () => {
    usersClient.findUserById.mockResolvedValue(AUTOR);
    postsRepository.create.mockResolvedValue({
      id: 10,
      title: 'Meu primeiro post',
      content: 'Um conteúdo com texto suficiente.',
      authorId: 1,
      createdAt: 'c',
      updatedAt: 'c',
    });

    const post = await postsService.create(1, ENTRADA_VALIDA);

    // Mock: o autor foi consultado no ms-users.
    expect(usersClient.findUserById).toHaveBeenCalledWith(1);
    // Mock: o banco recebeu os dados já limpos.
    expect(postsRepository.create).toHaveBeenCalledWith({
      title: 'Meu primeiro post',
      content: 'Um conteúdo com texto suficiente.',
      authorId: 1,
    });
    expect(post).toEqual({
      id: 10,
      title: 'Meu primeiro post',
      content: 'Um conteúdo com texto suficiente.',
      authorId: 1,
      createdAt: 'c',
      updatedAt: 'c',
    });
  });

  it('rejeita título vazio sem consultar o autor nem gravar', async () => {
    const erro = await postsService
      .create(1, { title: '', content: 'Um conteúdo com texto suficiente.' })
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ValidationError);
    expect(erro.details).toHaveProperty('title');
    // Entrada inválida nunca gera chamada de rede nem gravação.
    expect(usersClient.findUserById).not.toHaveBeenCalled();
    expect(postsRepository.create).not.toHaveBeenCalled();
  });

  it('rejeita post sem autor associado, sem consultar nada', async () => {
    await expect(postsService.create(undefined, ENTRADA_VALIDA)).rejects.toThrow(
      'Post precisa de um autor associado',
    );

    expect(usersClient.findUserById).not.toHaveBeenCalled();
    expect(postsRepository.create).not.toHaveBeenCalled();
  });

  it.each([null, 0, -4, '1', 1.5])(
    'rejeita autor com identificador inválido (%s)',
    async (autorInvalido) => {
      await expect(postsService.create(autorInvalido, ENTRADA_VALIDA)).rejects.toBeInstanceOf(
        ValidationError,
      );

      expect(postsRepository.create).not.toHaveBeenCalled();
    },
  );

  it('rejeita autor que não existe no ms-users, sem gravar', async () => {
    usersClient.findUserById.mockResolvedValue(null);

    await expect(postsService.create(999, ENTRADA_VALIDA)).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );

    expect(usersClient.findUserById).toHaveBeenCalledWith(999);
    expect(postsRepository.create).not.toHaveBeenCalled();
  });

  it('não grava o post quando o ms-users está indisponível', async () => {
    usersClient.findUserById.mockRejectedValue(
      new ServiceUnavailableError('Serviço de usuários indisponível'),
    );

    await expect(postsService.create(1, ENTRADA_VALIDA)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(postsRepository.create).not.toHaveBeenCalled();
  });
});

describe('PostsService · leitura (list e getById)', () => {
  let postsRepository;
  let usersClient;
  let postsService;

  beforeEach(() => {
    postsRepository = createPostsRepositoryStub();
    usersClient = createUsersClientStub();
    postsService = createPostsService({ postsRepository, usersClient });
  });

  it('lista os posts sem consultar o ms-users para cada item', async () => {
    postsRepository.list.mockResolvedValue([POST_EXISTENTE, { ...POST_EXISTENTE, id: 11 }]);

    const posts = await postsService.list();

    expect(posts).toHaveLength(2);
    // Evita o problema N+1: uma chamada HTTP por post seria desnecessária.
    expect(usersClient.findUserById).not.toHaveBeenCalled();
  });

  it('devolve o post com os dados do autor', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    usersClient.findUserById.mockResolvedValue(AUTOR);

    const post = await postsService.getById(10);

    expect(usersClient.findUserById).toHaveBeenCalledWith(1);
    expect(post).toMatchObject({
      id: 10,
      title: 'Título original',
      authorId: 1,
      author: { id: 1, name: 'Ana Souza' },
    });
  });

  it('responde 404 para um post inexistente, sem consultar o autor', async () => {
    postsRepository.findById.mockResolvedValue(null);

    await expect(postsService.getById(99)).rejects.toBeInstanceOf(NotFoundError);
    expect(usersClient.findUserById).not.toHaveBeenCalled();
  });

  it('mantém o post e devolve author null quando o autor foi removido do ms-users', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    usersClient.findUserById.mockResolvedValue(null);

    const post = await postsService.getById(10);

    // O post continua existindo. Só o autor fica ausente.
    expect(post.id).toBe(10);
    expect(post.author).toBeNull();
  });

  it('propaga 503 quando o ms-users está fora do ar', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    usersClient.findUserById.mockRejectedValue(
      new ServiceUnavailableError('Serviço de usuários indisponível'),
    );

    await expect(postsService.getById(10)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe('PostsService · atualização (update)', () => {
  let postsRepository;
  let usersClient;
  let postsService;

  beforeEach(() => {
    postsRepository = createPostsRepositoryStub();
    usersClient = createUsersClientStub();
    postsService = createPostsService({ postsRepository, usersClient });
  });

  it('o autor altera o título e recebe o post atualizado', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    postsRepository.update.mockResolvedValue({ ...POST_EXISTENTE, title: 'Novo título' });

    const post = await postsService.update(1, 10, { title: '  Novo título  ' });

    // Só o campo enviado chega ao banco, já limpo.
    expect(postsRepository.update).toHaveBeenCalledWith(10, { title: 'Novo título' });
    expect(post.title).toBe('Novo título');
  });

  it('bloqueia a alteração feita por quem não é o autor', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);

    await expect(postsService.update(2, 10, { title: 'Invasão' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(postsRepository.update).not.toHaveBeenCalled();
  });

  it('não grava quando o novo título é inválido', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);

    await expect(postsService.update(1, 10, { title: '   ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(postsRepository.update).not.toHaveBeenCalled();
  });

  it('responde 404 ao tentar alterar um post inexistente', async () => {
    postsRepository.findById.mockResolvedValue(null);

    await expect(postsService.update(1, 99, { title: 'Qualquer' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(postsRepository.update).not.toHaveBeenCalled();
  });
});

describe('PostsService · exclusão (remove)', () => {
  let postsRepository;
  let usersClient;
  let postsService;

  beforeEach(() => {
    postsRepository = createPostsRepositoryStub();
    usersClient = createUsersClientStub();
    postsService = createPostsService({ postsRepository, usersClient });
  });

  it('o autor remove o próprio post', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    postsRepository.delete.mockResolvedValue(true);

    await postsService.remove(1, 10);

    expect(postsRepository.delete).toHaveBeenCalledWith(10);
  });

  it('bloqueia a remoção feita por quem não é o autor', async () => {
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);

    await expect(postsService.remove(2, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(postsRepository.delete).not.toHaveBeenCalled();
  });

  it('responde 404 ao tentar remover um post inexistente', async () => {
    postsRepository.findById.mockResolvedValue(null);

    await expect(postsService.remove(1, 99)).rejects.toBeInstanceOf(NotFoundError);
    expect(postsRepository.delete).not.toHaveBeenCalled();
  });
});

describe('PostsService · corrida na exclusão', () => {
  it('responde 404 quando o post some entre a verificação e a remoção', async () => {
    const postsRepository = createPostsRepositoryStub();
    const usersClient = createUsersClientStub();
    const postsService = createPostsService({ postsRepository, usersClient });

    // O post existe na consulta inicial, mas outra requisição o apaga antes do delete.
    postsRepository.findById.mockResolvedValue(POST_EXISTENTE);
    postsRepository.delete.mockResolvedValue(false);

    await expect(postsService.remove(1, 10)).rejects.toBeInstanceOf(NotFoundError);
    expect(postsRepository.delete).toHaveBeenCalledWith(10);
  });
});
