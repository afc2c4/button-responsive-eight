// src/services/users.service.js
// -----------------------------------------------------------------------------
// Regras de negócio do CRUD de usuários.
//
// Este módulo NÃO importa o SQLite nem o Express. Ele recebe as dependências
// por parâmetro (injeção de dependências):
//   - usersRepository: quem lê e grava dados;
//   - passwordHasher:  quem gera e confere hashes de senha.
//
// Essa separação permite testar as regras com stubs, sem banco e sem rede.
// -----------------------------------------------------------------------------

import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { validateNewUser, validateUserUpdate } from '../validation/users.validation.js';

// Visão completa: usada pelo próprio usuário (ele vê o próprio e-mail).
export function toOwnProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

// Visão pública: usada por qualquer pessoa. Não expõe o e-mail.
export function toPublicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function createUsersService({ usersRepository, passwordHasher }) {
  async function requireUser(id) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }
    return user;
  }

  // Regra de dono: só a própria conta pode ser alterada ou removida.
  function assertOwner(actorId, targetId) {
    if (actorId !== targetId) {
      throw new ForbiddenError('Você só pode alterar a própria conta');
    }
  }

  return {
    async register(input) {
      const data = validateNewUser(input);

      // Regra: não pode existir dois usuários com o mesmo e-mail.
      const existing = await usersRepository.findByEmail(data.email);
      if (existing) {
        throw new ConflictError('E-mail já cadastrado');
      }

      const passwordHash = await passwordHasher.hash(data.password);
      const created = await usersRepository.create({
        name: data.name,
        email: data.email,
        passwordHash,
      });

      return toOwnProfile(created);
    },

    async listPublicProfiles() {
      const users = await usersRepository.list();
      return users.map(toPublicProfile);
    },

    async getPublicProfile(id) {
      return toPublicProfile(await requireUser(id));
    },

    async getOwnProfile(id) {
      return toOwnProfile(await requireUser(id));
    },

    async update(actorId, targetId, input) {
      assertOwner(actorId, targetId);

      const changes = validateUserUpdate(input);
      const current = await requireUser(targetId);

      const patch = {};

      if (changes.name !== undefined) {
        patch.name = changes.name;
      }

      // Só checa duplicidade quando o e-mail realmente muda.
      if (changes.email !== undefined && changes.email !== current.email) {
        const holder = await usersRepository.findByEmail(changes.email);
        if (holder && holder.id !== targetId) {
          throw new ConflictError('E-mail já cadastrado');
        }
        patch.email = changes.email;
      }

      if (changes.password !== undefined) {
        patch.passwordHash = await passwordHasher.hash(changes.password);
      }

      const updated = await usersRepository.update(targetId, patch);
      return toOwnProfile(updated);
    },

    async remove(actorId, targetId) {
      assertOwner(actorId, targetId);

      const removed = await usersRepository.delete(targetId);
      if (!removed) {
        throw new NotFoundError('Usuário não encontrado');
      }
    },
  };
}
