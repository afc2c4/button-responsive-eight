// src/controllers/users.controller.js
// -----------------------------------------------------------------------------
// Camada HTTP do CRUD de usuários.
//
// O controller faz apenas três coisas: ler a requisição, chamar o service e
// escolher o status HTTP da resposta. Nenhuma regra de negócio mora aqui.
// Erros lançados aqui ou no service são repassados ao middleware de erro
// (o Express 5 faz isso automaticamente para funções async).
// -----------------------------------------------------------------------------

import { ValidationError } from '../errors/app-error.js';

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Identificador inválido');
  }
  return id;
}

export function createUsersController({ usersService }) {
  return {
    async register(req, res) {
      const user = await usersService.register(req.body);
      res.status(201).json(user);
    },

    async list(req, res) {
      const users = await usersService.listPublicProfiles();
      res.json(users);
    },

    async getById(req, res) {
      const user = await usersService.getPublicProfile(parseId(req.params.id));
      res.json(user);
    },

    async update(req, res) {
      const user = await usersService.update(req.user.id, parseId(req.params.id), req.body);
      res.json(user);
    },

    async remove(req, res) {
      await usersService.remove(req.user.id, parseId(req.params.id));
      res.status(204).end();
    },
  };
}
