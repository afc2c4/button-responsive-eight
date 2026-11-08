# 03 · Testes Unitários do ms-blog

> **Etapa 3 — Microsserviço do Blog (ms-blog)**
>
> Este documento explica a estratégia de testes unitários do blog: o que é isolado com mocks e stubs, por que cada fronteira é isolada, como cada regra é testada e como rodar a suíte. A infraestrutura está em [01-infraestrutura-e-comunicacao.md](./01-infraestrutura-e-comunicacao.md) e as regras de negócio estão em [02-crud-de-posts.md](./02-crud-de-posts.md).

---

## 1. A estratégia em uma frase

**Cada teste unitário do blog substitui exatamente as dependências que cruzam uma fronteira: o banco e a rede. Todo o resto é código real.**

Duas fronteiras existem no ms-blog, e cada uma tem um dublê:

| Fronteira | O que está do outro lado | Dublê usado | Por quê |
|---|---|---|---|
| Banco de dados | SQLite | `createPostsRepositoryStub()` | Teste rápido, sem arquivo, sem estado compartilhado |
| Rede | ms-users (HTTP) | `createUsersClientStub()` e `fetchImpl` injetado | O ms-users pode estar fora do ar, lento ou devolver qualquer coisa |

O que **não** é substituído: as regras de validação, o service, o mapeamento de erros e o próprio cliente HTTP (exceto a camada de `fetch`). Esses são código real, e é neles que o teste procura defeitos.

---

## 2. Por que isolar cada fronteira

Imagine que o teste de criação de post usasse o SQLite de verdade. Quatro problemas apareceriam:

1. **Lentidão.** Cada teste abriria, gravaria e leria um arquivo.
2. **Estado compartilhado.** Um teste que grava um post pode afetar o resultado do próximo.
3. **Dependência de ambiente.** O teste passaria na sua máquina e falharia no CI se o caminho do arquivo fosse diferente.
4. **Diagnóstico confuso.** Quando o teste falha, não se sabe se o erro está na regra ou no banco.

Com o stub, o teste fica determinístico: a resposta do repositório é a que o próprio teste escreveu, e a falha só pode estar no service.

O mesmo raciocínio vale para o ms-users. O teste de criação de post não precisa que o ms-users esteja no ar. Basta controlar a resposta dele.

---

## 3. Stubs e mocks: a diferença que importa

Os dublês deste projeto são `vi.fn()`. A mesma função pode ser usada de dois jeitos, e cada jeito responde a uma pergunta diferente:

```js
// STUB: controla o que a dependência DEVOLVE
usersClient.findUserById.mockResolvedValue(AUTOR);

// MOCK: verifica como a dependência FOI USADA
expect(usersClient.findUserById).toHaveBeenCalledWith(1);
expect(postsRepository.create).not.toHaveBeenCalled();
```

| Pergunta | Ferramenta | Exemplo |
|---|---|---|
| Quando o autor existe, o service cria o post? | Stub (`mockResolvedValue`) | `findUserById` devolve o autor |
| O service consultou o autor certo? | Mock (`toHaveBeenCalledWith`) | `findUserById` foi chamado com `1` |
| Quando o título é inválido, o service evita o banco? | Mock (`not.toHaveBeenCalled`) | `create` não foi chamado |

Os testes do blog usam os dois, geralmente na mesma função. O stub prepara o cenário, e o mock prova o efeito colateral.

### 3.1 A verificação de ausência

Em muitos testes, a assertion mais importante é de ausência:

```js
it('rejeita título vazio sem consultar o autor nem gravar', async () => {
  // ...
  expect(usersClient.findUserById).not.toHaveBeenCalled();
  expect(postsRepository.create).not.toHaveBeenCalled();
});
```

Um código que validasse o título **depois** de consultar o autor passaria em um teste que só verifica o erro. Esse teste pegaria a regressão, porque a chamada de rede aconteceria e seria registrada.

---

## 4. Os dublês: `tests/unit/doubles/index.js`

```js
export function createPostsRepositoryStub() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

export function createUsersClientStub() {
  return {
    findUserById: vi.fn(),
  };
}
```

Os objetos têm **a mesma forma** das dependências reais. O service não percebe a diferença, e é isso que torna o isolamento válido.

### Por que os dublês são criados em `beforeEach`

Na Etapa 2, verificamos um comportamento do Vitest que se aplica aqui também: `clearMocks` limpa o **histórico** de chamadas entre os testes, mas não apaga a **implementação** configurada com `mockResolvedValue`. Um valor definido em um teste vazaria para o seguinte.

Por isso, todos os `describe` deste projeto criam os dublês dentro de `beforeEach`:

```js
beforeEach(() => {
  postsRepository = createPostsRepositoryStub();
  usersClient = createUsersClientStub();
  postsService = createPostsService({ postsRepository, usersClient });
});
```

Cada teste começa com dublês novos, sem configuração herdada.

---

## 5. Onde cada regra é testada

O mapa abaixo liga cada regra da seção 2 do documento 02 ao teste que a protege.

| Regra | Arquivo | Teste (resumo) |
|---|---|---|
| R1: título obrigatório, sem só espaços | `posts.validation.test.js` | `rejeita título vazio...`, `rejeita título formado só por espaços...` |
| R2: título de 3 a 120 caracteres | `posts.validation.test.js` | `rejeita título curto demais, com menos de 3 caracteres` e `rejeita título com mais de 120 caracteres` |
| R3: conteúdo de 10 a 10 000 caracteres | `posts.validation.test.js` | `rejeita conteúdo curto demais` |
| R4: post com autor associado | `posts.service.test.js` | `rejeita post sem autor associado...` e `it.each` com 5 valores inválidos |
| R5: autor existe no ms-users | `posts.service.test.js` | `rejeita autor que não existe no ms-users...` |
| R6: só o autor altera ou remove | `posts.service.test.js` | `bloqueia a alteração...` e `bloqueia a remoção...` |
| R7: lista sem consultar o ms-users | `posts.service.test.js` | `lista os posts sem consultar o ms-users...` |
| Autor removido → `author: null` | `posts.service.test.js` | `mantém o post e devolve author null...` |
| ms-users fora → `503` propagado | `posts.service.test.js` | `propaga 503 quando o ms-users está fora do ar` |
| Corrida na remoção → `404` | `posts.service.test.js` | `responde 404 quando o post some...` |
| Cliente: `404` vira `null` | `users.client.test.js` | `devolve null quando o ms-users responde 404` |
| Cliente: falhas viram `503` | `users.client.test.js` | `500`, conexão recusada, JSON inválido, timeout |
| Token válido, inválido ou ausente | `authenticate.middleware.test.js` | três cenários |
| URL e segredo validados | `config.test.js` | cinco cenários |

---

## 6. Passo a passo: o service de criação

### 6.1 O caso feliz

```js
it('cria o post quando título, conteúdo e autor são válidos', async () => {
  usersClient.findUserById.mockResolvedValue(AUTOR);
  postsRepository.create.mockResolvedValue({ /* post gravado */ });

  const post = await postsService.create(1, ENTRADA_VALIDA);

  expect(usersClient.findUserById).toHaveBeenCalledWith(1);
  expect(postsRepository.create).toHaveBeenCalledWith({
    title: 'Meu primeiro post',
    content: 'Um conteúdo com texto suficiente.',
    authorId: 1,
  });
  expect(post).toEqual({ /* ... */ });
});
```

Repare que `ENTRADA_VALIDA` tem espaços nas pontas, e a chamada ao repositório recebe os valores **já limpos**. Assim, o teste verifica a normalização sem precisar de um teste separado para ela.

### 6.2 Os casos de rejeição

Cada caso de rejeição segue o mesmo padrão: uma entrada inválida, uma verificação do erro e uma verificação de ausência.

```js
it('rejeita título vazio sem consultar o autor nem gravar', async () => {
  const erro = await postsService
    .create(1, { title: '', content: 'Um conteúdo com texto suficiente.' })
    .catch((e) => e);

  expect(erro).toBeInstanceOf(ValidationError);
  expect(erro.details).toHaveProperty('title');
  expect(usersClient.findUserById).not.toHaveBeenCalled();
  expect(postsRepository.create).not.toHaveBeenCalled();
});
```

O `.catch((e) => e)` é um padrão útil quando se quer inspecionar o erro, e não só saber que ele foi lançado. Assim o teste verifica o tipo **e** o campo `details`.

### 6.3 Testes parametrizados

```js
it.each([null, 0, -4, '1', 1.5])(
  'rejeita autor com identificador inválido (%s)',
  async (autorInvalido) => {
    await expect(postsService.create(autorInvalido, ENTRADA_VALIDA)).rejects.toBeInstanceOf(ValidationError);
    expect(postsRepository.create).not.toHaveBeenCalled();
  },
);
```

Um único teste cobre cinco valores. Cada um aparece no nome do teste, então, se um falhar, o relatório mostra exatamente qual. `'1'` (uma string) é um caso que costuma passar despercebido: ele parece um número, mas não é, e o service precisa recusá-lo.

---

## 7. Passo a passo: a fronteira de rede

O cliente HTTP é testado de uma forma diferente. Em vez de um stub do cliente inteiro, injetamos um `fetch` falso no lugar do `fetch` global.

### 7.1 Respostas reais, dublê na rede

```js
it('devolve null quando o ms-users responde 404', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
  const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 1000, fetchImpl });

  await expect(client.findUserById(999)).resolves.toBeNull();
});
```

`new Response(...)` é um objeto real do Node.js, e não um mock. O teste cria a resposta exatamente como o `fetch` a criaria. Assim, a lógica do cliente é testada contra uma resposta de verdade, e só a rede é substituída.

### 7.2 O timeout com sinal real

```js
it('desiste após o tempo limite, sem deixar a requisição presa', async () => {
  const fetchImpl = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  const client = createUsersClient({ baseUrl: BASE_URL, timeoutMs: 20, fetchImpl });

  await expect(client.findUserById(1)).rejects.toBeInstanceOf(ServiceUnavailableError);
});
```

O `fetchImpl` simula um ms-users que nunca responde. A promessa só termina quando o `AbortSignal` dispara. O `signal` é o **real**, criado por `AbortSignal.timeout(20)`. É isso que o teste precisa verificar: que o cliente de fato configura o cancelamento. Um dublê também do sinal provaria pouca coisa.

Esse é um dos poucos casos em que o teste unitário usa um recurso do ambiente. Justifica-se porque o comportamento sob teste é justamente a interação com o cancelamento.

### 7.3 Verificando a URL

```js
expect(fetchImpl).toHaveBeenCalledWith(
  `${BASE_URL}/users/7`,
  expect.objectContaining({ signal: expect.any(AbortSignal) }),
);
```

Esse mock confere a URL e a presença do sinal de timeout. Ele também evita um defeito silencioso: um cliente sem timeout ainda passaria em todos os outros testes.

---

## 8. Os testes de validação

`posts.validation.test.js` não tem nenhum dublê. As funções são puras, então o teste só chama a função e verifica o resultado.

```js
it('rejeita título com mais de 120 caracteres', () => {
  const erro = captureError(() =>
    validateNewPost({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1), content: 'Conteúdo com texto suficiente.' }),
  );

  expect(erro.details.title).toMatch(/entre 3 e 120/);
});
```

Duas escolhas merecem atenção:

- O teste usa `TITLE_MAX_LENGTH + 1`, e não o número `121`. Se o limite mudar para 200, o teste continua verificando a fronteira, sem precisar de ajuste.
- O helper `captureError` devolve a exceção em vez de deixá-la estourar. Isso permite inspecionar `details`, o que um `toThrow` simples não faz.

---

## 9. Verificando que os testes protegem o código

Um teste que passa não garante nada. Como na Etapa 2, usamos **mutação**: introduzimos um defeito e confirmamos que a suíte falha.

### 9.1 Os três mutantes

Foram aplicados ao `posts.service.js`, com a suíte de 39 testes do blog nesse momento:

| Mutante | Defeito introduzido | Resultado |
|---|---|---|
| M1 | Remover a checagem de autor no ms-users | **1 teste falhou**: `rejeita autor que não existe no ms-users, sem gravar` |
| M2 | Remover a regra de dono no `update` | **1 teste falhou**: `bloqueia a alteração feita por quem não é o autor` |
| M3 | `create` ignora a validação de formato | **2 testes falharam**: `cria o post...` e `rejeita título vazio...` |

Depois de cada mutação, o arquivo original foi restaurado e confirmado com `diff`. A suíte voltou a passar.

### 9.2 Um defeito que só o cenário de corrida pega

O teste `responde 404 quando o post some entre a verificação e a remoção` foi acrescentado depois, ao revisar a cobertura. Antes dele, o `if (!removed)` do `remove` não tinha nenhum teste. Um defeito ali passaria despercebido.

Esse caso é didático: a cobertura de linhas mostrava 96%, e a linha que faltava era justamente a que trata a corrida. **Cobertura alta não significa comportamento verificado.** Ela só mostra o que foi executado, não o que foi conferido.

### 9.3 Verificação de ponta a ponta

Os testes unitários provam a lógica, mas não a comunicação entre processos. Por isso, os dois serviços também foram rodados de verdade, e o fluxo foi percorrido por HTTP. O detalhamento está no documento 01, seção 9. Essa verificação não substitui os testes unitários, e os testes unitários não substituem essa verificação. Cada uma pega defeitos que a outra não pega.

---

## 10. Como rodar

Todos os comandos são executados na pasta `blog-microservices/`.

| Comando | O que faz |
|---|---|
| `npm run test:unit` | Roda os testes unitários dos dois serviços |
| `npx vitest run --project unit services/ms-blog` | Roda só os testes do blog |
| `npx vitest run --project unit posts.service` | Roda um arquivo, pelo nome |
| `npx vitest run --project unit -t "autor"` | Roda os testes cujo nome contém o texto |
| `npm run test:watch` | Modo interativo: reexecuta ao salvar |
| `npm run test:coverage` | Roda e gera o relatório de cobertura em `coverage/` |

### Saída esperada para o blog

```text
 ✓  unit  services/ms-blog/tests/unit/posts.service.test.js (23 tests)
 ✓  unit  services/ms-blog/tests/unit/posts.validation.test.js (12 tests)
 ✓  unit  services/ms-blog/tests/unit/users.client.test.js (6 tests)
 ✓  unit  services/ms-blog/tests/unit/authenticate.middleware.test.js (3 tests)
 ✓  unit  services/ms-blog/tests/unit/config.test.js (5 tests)
```

São 49 testes do blog. Com os 40 do ms-users, a suíte unitária completa tem **89 testes**.

### Cobertura

| Arquivo | Linhas | Observação |
|---|---|---|
| `services/posts.service.js` | 100% | Todas as regras e o caso de corrida |
| `clients/users.client.js` | 100% | Todas as traduções de resposta e o timeout |
| `validation/posts.validation.js` | 97% | Um ramo de erro menos comum |
| `middlewares/authenticate.js` | 92% | Um ramo de token sem `sub` numérico |
| `config.js` | 81% | Ramos de erro de porta e de timeout |
| `app.js`, `container.js`, `server.js`, `db/`, `repositories/`, `routes/`, `controllers/`, `error-handler.js` | 0% | Dependem de banco e de HTTP reais |

Os 0% não são um descuido. Esses arquivos só fazem sentido quando o SQLite e o Express estão em funcionamento. A camada de integração (Etapa 4) é o lugar onde eles serão verificados.

> **Limite honesto:** a suíte unitária não mede se o SQL está correto. Uma coluna escrita errada no `INSERT` passaria em todos os testes desta etapa. O repositório é coberto pela verificação manual de ponta a ponta e pelos testes de integração que vêm a seguir.

---

## 11. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Teste passa sozinho e falha na suíte completa | Implementação de stub vazando de outro teste | Crie o dublê dentro de `beforeEach` |
| `expected ... to be undefined` em um dublê | Mesma causa acima | Idem |
| Teste de timeout demora ou trava | `timeoutMs` alto demais no teste | Use valores pequenos, como 20 ms |
| `Cannot find module` no teste | Caminho relativo errado | Os testes ficam em `tests/unit/`, então sobem dois níveis até `ms-blog/` |
| `toHaveBeenCalledWith` falha com argumento parecido | Normalização diferente da esperada | Imprima `mock.calls` para ver o que foi realmente passado |

---

## 12. Exercícios

1. Escreva um teste para `postsService.update` que verifique que trocar **só o conteúdo** não altera o título enviado ao repositório.
2. Faça a mutação M2 (remover a regra de dono no `update`) e confirme quais testes falham. Você esperava exatamente esses?
3. Crie um teste para o cliente HTTP em que o ms-users responde `200` com um corpo sem o campo `name`. O cliente deveria falhar? Escreva o teste antes de decidir.
4. Explique, com suas palavras, por que `expect(usersClient.findUserById).not.toHaveBeenCalled()` vem **antes** de qualquer chamada ao service em alguns testes, e por que isso protege contra regressões de ordem.
