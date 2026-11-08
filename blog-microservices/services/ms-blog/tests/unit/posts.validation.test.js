// tests/unit/posts.validation.test.js
// -----------------------------------------------------------------------------
// Testes das regras de FORMATO de um post: título, conteúdo e atualização parcial.
//
// Estas funções são puras. Não há dublê aqui, porque não há dependência externa:
// o teste chama a função e verifica o resultado. Por serem baratas, são a
// primeira linha de defesa, e os testes de service confiam nelas.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors/app-error.js';
import {
  CONTENT_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  validateNewPost,
  validatePostUpdate,
} from '../../src/validation/posts.validation.js';

describe('validação de criação de post (validateNewPost)', () => {
  it('aceita título e conteúdo válidos e remove espaços nas pontas', () => {
    const dados = validateNewPost({
      title: '   Meu primeiro post   ',
      content: '  Um conteúdo com texto suficiente.  ',
    });

    expect(dados).toEqual({
      title: 'Meu primeiro post',
      content: 'Um conteúdo com texto suficiente.',
    });
  });

  it('rejeita título vazio com detalhe no campo title', () => {
    const erro = captureError(() =>
      validateNewPost({ title: '', content: 'Conteúdo com texto suficiente.' }),
    );

    expect(erro).toBeInstanceOf(ValidationError);
    expect(erro.details).toEqual({ title: 'Título é obrigatório' });
  });

  it('rejeita título formado só por espaços, que não é um título', () => {
    const erro = captureError(() =>
      validateNewPost({ title: '      ', content: 'Conteúdo com texto suficiente.' }),
    );

    expect(erro.details).toHaveProperty('title');
  });

  it('rejeita título ausente ou que não é texto', () => {
    expect(() =>
      validateNewPost({ content: 'Conteúdo com texto suficiente.' }),
    ).toThrow(ValidationError);

    expect(() =>
      validateNewPost({ title: 42, content: 'Conteúdo com texto suficiente.' }),
    ).toThrow(ValidationError);
  });

  it('rejeita título com mais de 120 caracteres', () => {
    const erro = captureError(() =>
      validateNewPost({
        title: 'a'.repeat(TITLE_MAX_LENGTH + 1),
        content: 'Conteúdo com texto suficiente.',
      }),
    );

    expect(erro.details.title).toMatch(/entre 3 e 120/);
  });

  it('rejeita título curto demais, com menos de 3 caracteres', () => {
    const erro = captureError(() =>
      validateNewPost({ title: 'Oi', content: 'Conteúdo com texto suficiente.' }),
    );

    expect(erro.details.title).toMatch(/entre 3 e 120/);
  });

  it('rejeita conteúdo curto demais', () => {
    const erro = captureError(() =>
      validateNewPost({
        title: 'Título válido',
        content: 'a'.repeat(CONTENT_MIN_LENGTH - 1),
      }),
    );

    expect(erro.details).toHaveProperty('content');
  });

  it('informa os erros de todos os campos de uma vez', () => {
    const erro = captureError(() => validateNewPost({ title: '', content: '' }));

    expect(Object.keys(erro.details).sort()).toEqual(['content', 'title']);
  });

  it('rejeita um corpo que não é um objeto JSON', () => {
    expect(() => validateNewPost(undefined)).toThrow(ValidationError);
    expect(() => validateNewPost(['título'])).toThrow(ValidationError);
  });
});

describe('validação de atualização de post (validatePostUpdate)', () => {
  it('aceita a alteração de só um campo', () => {
    expect(validatePostUpdate({ title: 'Novo título' })).toEqual({ title: 'Novo título' });
  });

  it('rejeita uma atualização sem nenhum campo', () => {
    expect(() => validatePostUpdate({})).toThrow('Informe ao menos um campo para atualizar');
  });

  it('valida o campo enviado mesmo na atualização parcial', () => {
    const erro = captureError(() => validatePostUpdate({ title: '   ' }));

    expect(erro.details).toHaveProperty('title');
  });
});

// Helper: captura a exceção sem deixar o teste quebrar, para inspecionar seus campos.
function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Esperava que a função lançasse um erro');
}
