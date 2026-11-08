// src/controllers/posts.controller.js
// -----------------------------------------------------------------------------
// Camada HTTP do CRUD de posts.
//
// O controller lê a requisição, chama o service e escolhe o status da resposta.
// Não há regra de negócio aqui.
//
// Repare que o autor de um post NUNCA vem do corpo da requisição. Ele vem do
// token (req.user.id). Assim ninguém consegue publicar em nome de outra pessoa.
// -----------------------------------------------------------------------------

import { ValidationError } from '../errors/app-error.js';

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Identificador inválido');
  }
  return id;
}

export function createPostsController({ postsService }) {
  return {
    async list(req, res) {
      const posts = await postsService.list();
      res.json(posts);
    },

    async getById(req, res) {
      const post = await postsService.getById(parseId(req.params.id));
      res.json(post);
    },

    async create(req, res) {
      const post = await postsService.create(req.user.id, req.body);
      res.status(201).json(post);
    },

    async update(req, res) {
      const post = await postsService.update(req.user.id, parseId(req.params.id), req.body);
      res.json(post);
    },

    async remove(req, res) {
      await postsService.remove(req.user.id, parseId(req.params.id));
      res.status(204).end();
    },
  };
}
