# 02 · CRUD de Posts: regras, fluxos e falhas

> **Etapa 3 — Microsserviço do Blog (ms-blog)**
>
> Este documento descreve o que cada operação do CRUD faz, em que ordem as regras são aplicadas e como o serviço reage quando algo dá errado. A infraestrutura e a comunicação com o ms-users estão em [01-infraestrutura-e-comunicacao.md](./01-infraestrutura-e-comunicacao.md). A estratégia de testes está em [03-testes-unitarios.md](./03-testes-unitarios.md).

---

## 1. Visão geral das operações

| Operação | Rota | Autenticação | Quem pode | Respostas possíveis |
|---|---|---|---|---|
| **Create** | `POST /posts` | Sim | Qualquer usuário autenticado | `201` · `400` · `401` · `422` · `503` |
| **Read (lista)** | `GET /posts` | Não | Qualquer pessoa | `200` |
| **Read (um)** | `GET /posts/:id` | Não | Qualquer pessoa | `200` · `404` · `503` |
| **Update** | `PATCH /posts/:id` | Sim | Só o autor | `200` · `400` · `401` · `403` · `404` |
| **Delete** | `DELETE /posts/:id` | Sim | Só o autor | `204` · `401` · `403` · `404` |

Repare em duas linhas. A leitura é pública, porque um blog precisa ser lido por qualquer pessoa. A escrita exige login, e a alteração ou remoção exige ser o autor.

---

## 2. As regras de negócio

Cada regra tem um lugar onde é aplicada e um teste que a protege.

| # | Regra | Onde é aplicada | Resposta se violada |
|---|---|---|---|
| R1 | O título é obrigatório e não pode ser só espaços | `validation/posts.validation.js` | `400` |
| R2 | O título tem entre 3 e 120 caracteres, sem contar espaços das pontas | `validation/posts.validation.js` | `400` |
| R3 | O conteúdo tem entre 10 e 10 000 caracteres | `validation/posts.validation.js` | `400` |
| R4 | Todo post tem um autor associado | `services/posts.service.js` | `400` |
| R5 | O autor precisa existir no ms-users | `services/posts.service.js` (via cliente) | `422` |
| R6 | Só o autor altera ou remove o próprio post | `services/posts.service.js` | `403` |
| R7 | A lista de posts não consulta o ms-users | `services/posts.service.js` | — (comportamento) |
| R8 | O autor de um post vem do token, nunca do corpo | `controllers/posts.controller.js` | — (comportamento) |

As regras R1 a R3 são **de formato**. Elas não dependem de nada externo, e por isso são aplicadas primeiro e sem rede. As regras R4 a R6 são **de negócio**. Elas dependem de quem está logado ou de dados de outro serviço.

### Por que R4 existe se o autor sempre vem do token?

Com autenticação obrigatória, o `authorId` nunca chega vazio na rota HTTP. A regra R4 existe mesmo assim, dentro do service. Quem usa o service é o controller hoje, mas amanhã pode ser uma importação em lote ou um job administrativo. A regra protege o service para qualquer chamador, e não só para a rota atual. Esse é o princípio de **defesa em profundidade**: cada camada verifica o que é essencial para ela.

Há um teste unitário que chama o service diretamente com `undefined`, `null`, `0`, `-4`, `'1'` e `1.5`, e espera `400` para todos. Ele não depende da rota.

---

## 3. Criar um post: `POST /posts`

### 3.1 A ordem das verificações

```js
async create(authorId, input) {
  // 1. R4: há um autor associado?
  if (!isValidAuthorId(authorId)) {
    throw new ValidationError('Post precisa de um autor associado', {
      authorId: 'Autor é obrigatório',
    });
  }

  // 2. R1 a R3: formato de título e conteúdo (sem rede)
  const data = validateNewPost(input);

  // 3. R5: o autor existe no ms-users? (chamada HTTP)
  const author = await usersClient.findUserById(authorId);
  if (!author) {
    throw new UnprocessableEntityError('Autor não encontrado no serviço de usuários');
  }

  // 4. Só agora o banco é tocado
  const created = await postsRepository.create({
    title: data.title,
    content: data.content,
    authorId,
  });

  return toPostResource(created);
}
```

Essa ordem é uma decisão deliberada, e o critério é o **custo**:

| Etapa | Custo | Por que está nessa posição |
|---|---|---|
| R4 | Nenhum | É uma comparação de número |
| R1 a R3 | Nenhum | São funções em memória |
| R5 | Uma chamada HTTP, com até 3 s de espera | Só vale a pena se a entrada já estiver correta |
| Gravação | Escrita em disco | Só acontece quando tudo passou |

Um título vazio nunca gera uma chamada ao ms-users. Uma entrada inválida não consome rede nem banco. Isso importa quando alguém envia dados errados em loop: o custo do erro fica perto de zero.

### 3.2 Exemplo de criação

```bash
curl -X POST http://localhost:3002/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Meu primeiro post","content":"Escrevendo sobre microsserviços pela primeira vez."}'
```

```json
{
  "id": 1,
  "title": "Meu primeiro post",
  "content": "Escrevendo sobre microsserviços pela primeira vez.",
  "authorId": 1,
  "createdAt": "2026-11-08T18:51:37.428Z",
  "updatedAt": "2026-11-08T18:51:37.428Z"
}
```

Repare que o corpo da requisição **não** tem `authorId`. Se o cliente enviar um, o campo é ignorado. O autor é sempre quem assinou o token.

### 3.3 Erros dessa operação

| Situação | Resposta | Por quê |
|---|---|---|
| Sem cabeçalho `Authorization` | `401 Token ausente ou mal formatado` | A rota exige login |
| Token adulterado ou expirado | `401 Token inválido ou expirado` | A assinatura não confere |
| Título `"   "` | `400` com `details.title` | R1 |
| Conteúdo de 5 caracteres | `400` com `details.content` | R3 |
| Token válido de um usuário que não existe no ms-users | `422 Autor não encontrado` | R5 |
| ms-users fora do ar | `503 Serviço de usuários indisponível` | Não foi possível confirmar o autor, então nada é gravado |

A linha do `422` merece atenção. Um token com assinatura válida, emitido para um usuário que foi removido depois, passa pela autenticação. Só a consulta ao ms-users revela que o autor não existe mais. Essa é a razão concreta de o blog continuar consultando o ms-users mesmo com o token válido.

---

## 4. Ler posts

### 4.1 A lista não consulta o ms-users

```js
async list() {
  const posts = await postsRepository.list();
  return posts.map(toPostResource);
}
```

A lista devolve `authorId`, e não o nome do autor. Buscar o nome para cada post faria uma chamada HTTP por item, o que é o problema conhecido como **N+1**. Com 100 posts, seriam 101 requisições para montar uma única página.

A alternativa, buscar só os autores distintos, reduziria as chamadas, mas acrescentaria complexidade. Para o escopo da aula, o trade-off escolhido é claro: a lista é rápida e não depende do ms-users, e o nome aparece no detalhe do post.

### 4.2 O detalhe compõe dados de dois serviços

```js
async getById(id) {
  const post = await requirePost(id);
  const author = await usersClient.findUserById(post.authorId);

  return {
    ...toPostResource(post),
    author: author ?? null,
  };
}
```

Esse é o momento em que o blog **compõe** uma resposta a partir de dois serviços. Os dois casos de falha têm tratamentos diferentes:

| Situação do autor | Resposta | Por quê |
|---|---|---|
| Autor existe | `200`, com `author: {id, name}` | Caso normal |
| Autor foi removido do ms-users | `200`, com `author: null` | O post é conteúdo do blog e continua existindo |
| ms-users fora do ar | `503` | Não foi possível confirmar o autor. Um `null` mentiria, sugerindo que o autor foi apagado |

Note que o `null` é o resultado de uma resposta **válida** do ms-users (`404`). O `503` é o resultado de **não ter resposta**. O cliente HTTP da Etapa 3 separa essas duas situações, e o service só precisa repassar cada uma.

---

## 5. Atualizar um post: `PATCH /posts/:id`

```js
async update(actorId, postId, input) {
  const post = await requirePost(postId);
  assertAuthor(actorId, post);

  const changes = validatePostUpdate(input);
  const updated = await postsRepository.update(postId, changes);

  return toPostResource(updated);
}
```

### 5.1 A ordem é: existência, dono, depois formato

1. `requirePost`: se o post não existe, `404`.
2. `assertAuthor`: se quem pede não é o dono, `403`. Isso acontece **antes** de validar o corpo, então alguém de fora não consegue nem descobrir se um campo é válido.
3. `validatePostUpdate`: formato dos campos enviados.

### 5.2 Atualização parcial

`PATCH` altera só os campos enviados. Se o corpo for `{"title": "Novo título"}`, o conteúdo fica como está. Isso é feito no banco com `COALESCE`:

```sql
UPDATE posts
   SET title      = COALESCE(@title, title),
       content    = COALESCE(@content, content),
       updated_at = @updatedAt
 WHERE id = @id
```

Quando o parâmetro é `NULL`, o valor atual da coluna é mantido. O `updated_at` é sempre atualizado, porque qualquer alteração conta como edição.

### 5.3 Não depende do ms-users

Editar um post não consulta o ms-users. O autor já foi validado na criação, e uma alteração de conteúdo não muda quem é o autor. Por isso, na verificação de ponta a ponta, a edição continuou funcionando com o ms-users fora do ar.

---

## 6. Remover um post: `DELETE /posts/:id`

```js
async remove(actorId, postId) {
  const post = await requirePost(postId);
  assertAuthor(actorId, post);

  const removed = await postsRepository.delete(post.id);
  if (!removed) {
    throw new NotFoundError('Post não encontrado');
  }
}
```

A resposta de sucesso é `204 No Content`.

### 6.1 A checagem dupla

Há duas verificações de existência: `requirePost` no começo e o `if (!removed)` no fim. A primeira vem antes da regra de dono, porque é preciso saber quem é o autor. A segunda cobre a **corrida**: o post existe quando é lido, mas outra requisição o apaga antes do `DELETE` rodar. Sem a segunda verificação, o cliente receberia `204` para uma remoção que não aconteceu. Há um teste unitário específico para esse caso.

---

## 7. Matriz de falhas

Esta tabela resume como o serviço reage a cada tipo de falha. Ela é a referência para os testes.

| Falha | Create | Read (lista) | Read (um) | Update | Delete |
|---|---|---|---|---|---|
| Token ausente ou inválido | `401` | — | — | `401` | `401` |
| Dados de formato inválidos | `400` | — | — | `400` | — |
| Post não existe | — | — | `404` | `404` | `404` |
| Quem pede não é o autor | — | — | — | `403` | `403` |
| Autor não existe no ms-users | `422` | — | `author: null` | — | — |
| ms-users fora do ar | `503` | `200` (não depende) | `503` | `200` (não depende) | `204` (não depende) |

Duas células merecem leitura cuidadosa. A lista funciona mesmo com o ms-users fora, porque não o consulta. Já criar um post falha com `503`, porque o autor precisa ser confirmado. Essa diferença é o resultado de decisões tomadas por operação, e não de um comportamento acidental.

---

## 8. Verificação de ponta a ponta

Os passos abaixo foram executados contra os dois serviços rodando como processos reais. A saída reproduzida é da execução.

### 8.1 Criar, ler, editar e remover

```text
[3]  Ana cria post                       → 201
[6]  GET /posts/1 com autor              → 200, author: {id: 1, name: "Ana Souza"}
[11] Ana edita o próprio post            → 200
[12] Ana remove o segundo post           → 204
[13] post removido                       → 404
```

### 8.2 Falhas de autorização e validação

```text
[7]  token adulterado                    → 401 Token inválido ou expirado
[8]  sem token                           → 401 Token ausente ou mal formatado
[9]  título só com espaços               → 400 details.title: Título é obrigatório
[10] Bia tenta editar post da Ana        → 403 Apenas o autor pode alterar ou remover este post
[14] token de usuário inexistente        → 422 Autor não encontrado no serviço de usuários
```

### 8.3 Com o ms-users fora do ar

```text
[15a] GET /posts (lista)                 → 200
[15b] GET /posts/1                       → 503 Serviço de usuários indisponível
[15c] POST /posts                        → 503 Serviço de usuários indisponível
[15d] PATCH /posts/1 pelo autor          → 200
```

Esses resultados batem com a matriz da seção 7.

---

## 9. Trade-offs assumidos

**A lista não tem paginação.** Com muitos posts, a resposta cresce sem limite. A solução é `limit` e `offset`, da mesma forma que foi sugerido para `GET /users` na Etapa 2.

**Não há exclusão lógica.** Um post removido some do banco. Em um blog real, pode ser útil marcar o post como removido, para recuperação e auditoria.

**Não há cache do autor.** Cada `GET /posts/:id` consulta o ms-users. Um cache de curta duração reduziria a carga, mas introduziria o problema de dados desatualizados: se a pessoa mudar de nome, o blog continuaria mostrando o nome antigo até o cache expirar.

**Criar post depende do ms-users.** Se o ms-users estiver fora, ninguém consegue publicar. É o acoplamento temporal citado no documento 01 da Etapa 1. As alternativas, como fila de publicação ou validação assíncrona, aumentam a complexidade e ficam como evolução.

**Não há validação de conteúdo.** O texto é salvo como está. Sanitização de HTML e de scripts é uma preocupação real para um blog público e fica como próxima evolução.

---

## 10. Exercícios sugeridos

1. Adicione paginação em `GET /posts` com `limit` e `offset`. Escreva primeiro o teste unitário do service, com o repositório stub retornando uma lista grande.
2. Troque a regra R2 para aceitar títulos de até 200 caracteres. Rode os testes e identifique quais falham e por quê.
3. Remova a checagem `if (!removed)` de `remove` e rode os testes. Qual teste falha? Depois, apague o teste `responde 404 quando o post some entre a verificação e a remoção` e rode de novo. O que muda? Explique por que um defeito pode passar despercebido quando o cenário de corrida não é testado.
4. Altere `getById` para responder `503` também quando o autor não existe. Qual teste fica vermelho e qual regra da seção 4.2 foi violada?
