// src/services/posts.service.js
// -----------------------------------------------------------------------------
// Regras de negócio do CRUD de posts.
//
// As dependências chegam por parâmetro:
//   - postsRepository: lê e grava posts (banco SQLite);
//   - usersClient:     confirma que um autor existe e busca o nome dele (ms-users).
//
// Nenhum import de SQL, de HTTP ou de variável de ambiente aparece aqui.
// Por isso, os testes unitários substituem as duas dependências por stubs.
// -----------------------------------------------------------------------------

import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../errors/app-error.js';
import { validateNewPost, validatePostUpdate } from '../validation/posts.validation.js';

// Formato público de um post. Expõe o authorId, e não o autor completo.
// Os dados do autor só entram no GET /posts/:id, que consulta o ms-users.
export function toPostResource(post) {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    authorId: post.authorId,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function isValidAuthorId(authorId) {
  return Number.isInteger(authorId) && authorId > 0;
}

export function createPostsService({ postsRepository, usersClient }) {
  async function requirePost(id) {
    const post = await postsRepository.findById(id);
    if (!post) {
      throw new NotFoundError('Post não encontrado');
    }
    return post;
  }

  // Regra de dono: só o autor do post pode alterá-lo ou removê-lo.
  function assertAuthor(actorId, post) {
    if (post.authorId !== actorId) {
      throw new ForbiddenError('Apenas o autor pode alterar ou remover este post');
    }
  }

  return {
    /**
     * Cria um post para um autor.
     *
     * Ordem das verificações, da mais barata para a mais cara:
     *   1. o post tem autor associado? (sem isso, nem há o que validar)
     *   2. título e conteúdo são válidos? (não envolve rede)
     *   3. o autor existe no ms-users? (chamada HTTP)
     *   4. gravar no banco.
     *
     * A ordem importa: uma entrada inválida nunca gera uma chamada de rede.
     */
    async create(authorId, input) {
      if (!isValidAuthorId(authorId)) {
        throw new ValidationError('Post precisa de um autor associado', {
          authorId: 'Autor é obrigatório',
        });
      }

      const data = validateNewPost(input);

      const author = await usersClient.findUserById(authorId);
      if (!author) {
        throw new UnprocessableEntityError('Autor não encontrado no serviço de usuários');
      }

      const created = await postsRepository.create({
        title: data.title,
        content: data.content,
        authorId,
      });

      return toPostResource(created);
    },

    /**
     * Lista os posts. Não consulta o ms-users: fazer isso para cada post
     * geraria uma chamada HTTP por item (o problema conhecido como N+1).
     */
    async list() {
      const posts = await postsRepository.list();
      return posts.map(toPostResource);
    },

    /**
     * Busca um post com os dados do autor.
     *
     * Dois casos diferentes, com respostas diferentes:
     *   - o autor foi removido do ms-users → author: null (o post continua existindo);
     *   - o ms-users está fora do ar → ServiceUnavailableError (503), propagado.
     */
    async getById(id) {
      const post = await requirePost(id);
      const author = await usersClient.findUserById(post.authorId);

      return {
        ...toPostResource(post),
        author: author ?? null,
      };
    },

    async update(actorId, postId, input) {
      const post = await requirePost(postId);
      assertAuthor(actorId, post);

      const changes = validatePostUpdate(input);
      const updated = await postsRepository.update(postId, changes);

      return toPostResource(updated);
    },

    async remove(actorId, postId) {
      const post = await requirePost(postId);
      assertAuthor(actorId, post);

      const removed = await postsRepository.delete(post.id);
      if (!removed) {
        throw new NotFoundError('Post não encontrado');
      }
    },
  };
}
