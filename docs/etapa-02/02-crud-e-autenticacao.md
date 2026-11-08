# 02 · CRUD de Usuários e Autenticação JWT

> **Etapa 2 — Microsserviço de Usuários (ms-users)**
>
> Este documento percorre cada endpoint do serviço, explica o caminho que uma requisição faz pelas camadas e mostra as decisões de segurança. A infraestrutura que sustenta tudo isso está em [01-infraestrutura-ms-users.md](./01-infraestrutura-ms-users.md). Os testes unitários estão em [03-testes-unitarios.md](./03-testes-unitarios.md).

---

## 1. Visão geral dos endpoints

| Método | Rota | Autenticação | Descrição | Respostas |
|---|---|---|---|---|
| `GET` | `/health` | Não | Verifica se o serviço está no ar | `200` |
| `POST` | `/users` | Não | Cadastra um usuário | `201` · `400` · `409` |
| `GET` | `/users` | Não | Lista os perfis públicos | `200` |
| `GET` | `/users/:id` | Não | Retorna o perfil público de um usuário | `200` · `400` · `404` |
| `PATCH` | `/users/:id` | Sim (dono) | Atualiza a própria conta | `200` · `400` · `401` · `403` · `404` · `409` |
| `DELETE` | `/users/:id` | Sim (dono) | Remove a própria conta | `204` · `400` · `401` · `403` · `404` |
| `POST` | `/auth/login` | Não | Troca e-mail e senha por um token | `200` · `400` · `401` |
| `GET` | `/auth/me` | Sim | Retorna o próprio perfil completo | `200` · `401` · `404` |

Duas classes de dados aparecem nesta tabela:

- **Perfil público** (`GET /users`, `GET /users/:id`): `id`, `name` e `createdAt`. O e-mail **não** aparece.
- **Perfil próprio** (`POST /users`, `PATCH`, `GET /auth/me`): `id`, `name`, `email` e `createdAt`. O hash da senha **nunca** aparece em nenhuma resposta.

A separação existe porque o nome de um autor é público, enquanto o e-mail é um dado pessoal. O ms-blog, na próxima etapa, vai precisar apenas do perfil público.

---

## 2. O caminho de uma requisição

Toda requisição atravessa as mesmas camadas. Saber essa ordem ajuda a localizar onde um problema acontece.

```text
HTTP
 │
 ▼
app.js ─ express.json()          ← converte o corpo JSON (ou responde 400)
 │
 ▼
routes/  ─ método + caminho      ← escolhe o controller (ou responde 404)
 │
 ▼
middlewares/authenticate.js      ← só nas rotas protegidas (ou responde 401)
 │
 ▼
controllers/  ─ lê req, chama o service
 │
 ▼
services/  ─ validação, regras de negócio, autorização
 │
 ▼
repositories/  ─ SQL
 │
 ▼
SQLite
```

Quando algo falha em qualquer camada, o erro sobe pelo Express até o `error-handler.js`, que gera a resposta padronizada. O controller não precisa de `try/catch`: no Express 5, uma função `async` que lança um erro já encaminha esse erro ao middleware de erro.

---

## 3. Cadastro: `POST /users`

### 3.1 Passo a passo

```text
1. controller.register      → recebe req.body
2. validateNewUser          → valida nome, e-mail e senha; normaliza o e-mail
3. usersRepository.findByEmail → existe alguém com este e-mail?
      sim → ConflictError (409). Nada é gravado e nenhum hash é gerado.
4. passwordHasher.hash      → gera o hash scrypt da senha
5. usersRepository.create   → grava o usuário
6. toOwnProfile             → devolve o perfil, sem o hash
```

### 3.2 O service

```js
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
}
```

### 3.3 Por que a ordem importa

A checagem de duplicidade acontece **antes** do hash. O hash é a operação mais cara do fluxo, pois o scrypt é deliberadamente lento. Se o e-mail já existe, não faz sentido gastar esse custo.

### 3.4 Duas barreiras contra duplicatas

| Barreira | Onde | O que protege |
|---|---|---|
| Checagem prévia | `usersService.register` | Caso comum: o usuário tenta cadastrar um e-mail já usado |
| Restrição `UNIQUE` | Banco de dados | Caso de concorrência: duas requisições com o mesmo e-mail chegam ao mesmo tempo e ambas passam pela checagem |

Quando o banco recusa a segunda inserção, o repositório traduz o erro:

```js
function translateDatabaseError(error) {
  if (error.code === UNIQUE_VIOLATION_CODE) {
    return new ConflictError('E-mail já cadastrado');
  }
  return error;
}
```

Assim, o cliente recebe o mesmo `409` nos dois casos. Ele não precisa saber se o conflito foi detectado pelo service ou pelo banco.

### 3.5 Normalização do e-mail

```js
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
```

Sem essa regra, `Ana@Exemplo.com` e `ana@exemplo.com` seriam dois usuários diferentes para o banco, que compara texto de forma literal. Na prática, seria a mesma pessoa com duas contas. A normalização acontece **antes** de qualquer consulta, então a comparação sempre usa a forma canônica.

---

## 4. Login: `POST /auth/login`

### 4.1 Diagrama

```mermaid
sequenceDiagram
    participant C as Cliente
    participant A as auth.service
    participant R as usersRepository
    participant H as passwordHasher
    participant T as tokenIssuer

    C->>A: login({email, password})
    A->>A: validateCredentials (normaliza e-mail)
    A->>R: findByEmail(email)
    R-->>A: usuário ou null
    A->>H: verify(password, hashGuardado ou hashDeReferencia)
    H-->>A: true ou false
    alt usuário existe E senha confere
        A->>T: sign({sub, email})
        T-->>A: token JWT
        A-->>C: 200 {accessToken, tokenType, expiresIn}
    else qualquer outro caso
        A-->>C: 401 "Credenciais inválidas"
    end
```

### 4.2 O código

```js
async login(input) {
  const { email, password } = validateCredentials(input);
  const user = await usersRepository.findByEmail(email);

  const hashToCompare = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await passwordHasher.verify(password, hashToCompare);

  if (!user || !passwordMatches) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  const accessToken = tokenIssuer.sign({
    sub: String(user.id),
    email: user.email,
  });

  return { accessToken, tokenType: 'Bearer', expiresIn: tokenExpiresInSeconds };
}
```

### 4.3 Por que a verificação roda mesmo quando o usuário não existe

Imagine uma versão ingênua:

```js
if (!user) throw new UnauthorizedError('Credenciais inválidas');   // resposta imediata
```

Ela tem dois problemas:

1. **Enumeração por tempo de resposta.** Se o e-mail não existe, a resposta chega em milissegundos. Se existe, a verificação do scrypt leva dezenas de milissegundos. Um atacante mede o tempo e descobre quais e-mails estão cadastrados.
2. **Enumeração por mensagem.** Se a mensagem fosse "e-mail não encontrado" em um caso e "senha incorreta" no outro, a diferença revelaria a existência da conta.

A solução usa dois mecanismos:

- **Mensagem idêntica:** os dois casos devolvem `Credenciais inválidas`.
- **Hash de referência:** quando o usuário não existe, a senha é comparada com `DUMMY_PASSWORD_HASH`, um hash válido que não corresponde a nenhuma senha real. Assim, o custo computacional é o mesmo nos dois casos.

O teste `executa a verificação de senha mesmo quando o e-mail não existe` (documento 03) protege essa propriedade.

---

## 5. Senhas: `src/security/password.js`

### 5.1 O formato armazenado

```text
scrypt:<salt em hex>:<hash derivado em hex>
scrypt:47f6a7b79a3992c618741a30c19535d1:308403d0ee6f37...
```

| Parte | Tamanho | Função |
|---|---|---|
| `scrypt` | — | Identifica o algoritmo. Permite trocar o algoritmo no futuro sem perder a compatibilidade |
| `salt` | 16 bytes (32 caracteres hex) | Valor aleatório, diferente a cada cadastro |
| `hash` | 64 bytes (128 caracteres hex) | Resultado do scrypt sobre a senha e o salt |

### 5.2 Geração e verificação

```js
export async function hashPassword(plainPassword) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = await scrypt(plainPassword, salt, KEY_LENGTH);
  return `${ALGORITHM}:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  const [algorithm, salt, hashHex] = String(storedHash).split(':');
  const expected = Buffer.from(hashHex ?? '', 'hex');

  if (algorithm !== ALGORITHM || !salt || expected.length === 0) {
    return false;
  }

  const derived = await scrypt(plainPassword, salt, expected.length);
  return timingSafeEqual(expected, derived);
}
```

### 5.3 Pontos de atenção

**Por que scrypt e não SHA-256?** Algoritmos rápidos como SHA-256 permitem testar bilhões de senhas por segundo com uma GPU. O scrypt é **intencionalmente caro em memória e em CPU**, o que torna a força bruta muito mais lenta. Os parâmetros padrão do Node.js (N=16384, r=8, p=1) já oferecem essa proteção.

**Por que `timingSafeEqual`?** A comparação com `===` para no primeiro byte diferente, e o tempo gasto revela quantos bytes iniciais coincidiram. `timingSafeEqual` sempre compara todos os bytes, em tempo constante.

**Por que `verifyPassword` nunca lança erro com hash malformado?** Um hash corrompido no banco não deve derrubar o login. Ele simplesmente não confere, e a resposta continua sendo `401`.

**Por que a senha não é trimada?** Espaços no início ou no fim fazem parte da senha. Remover esses espaços silenciosamente faria uma senha com espaço no final parar de funcionar.

---

## 6. Token JWT: `src/security/token.js`

### 6.1 Estrutura de um token

Um JWT tem três partes separadas por ponto: `cabeçalho.payload.assinatura`. Cada parte é codificada em base64url. Veja um token gerado pelo código do serviço, com um segredo fictício usado só para este exemplo:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhbmFAZXhlbXBsby5jb20iLCJpYXQiOjE3OTQxNjMyODEsImV4cCI6MTc5NDE2Njg4MX0.OaTCCK0WfYzK916-yW0SPodsRdMQy8QLZTwxs6FszNg
```

Decodificando as duas primeiras partes:

```json
// cabeçalho (primeira parte)
{ "alg": "HS256", "typ": "JWT" }

// payload (segunda parte)
{
  "sub": "1",
  "email": "ana@exemplo.com",
  "iat": 1794163281,
  "exp": 1794166881
}
```

A terceira parte é a assinatura. Os valores de `iat` e `exp` mudam a cada emissão. A diferença entre eles é sempre `3600`, que é o `JWT_EXPIRES_IN` padrão.

| Claim | Significado |
|---|---|
| `sub` | *Subject*: o identificador do usuário. Usamos string, como manda a especificação |
| `email` | Informação de conveniência. A fonte da verdade continua sendo o banco |
| `iat` | *Issued at*: momento da emissão, em segundos desde 1970 |
| `exp` | *Expiration*: momento em que o token deixa de valer |

**Atenção:** o payload é apenas codificado, **não é criptografado**. Qualquer pessoa que tenha o token consegue ler `sub` e `email`. Por isso, nunca coloque senha, hash ou dado sensível no payload. A assinatura garante a **integridade** (ninguém altera o conteúdo), e não o **sigilo**.

### 6.2 Emissão e verificação

```js
export function createTokenIssuer({ secret, expiresInSeconds }) {
  return Object.freeze({
    sign(payload) {
      return jwt.sign(payload, secret, {
        algorithm: ALGORITHM,
        expiresIn: expiresInSeconds,
      });
    },

    verify(token) {
      return jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    },
  });
}
```

### 6.3 A lista de algoritmos permitidos

O argumento `algorithms: ['HS256']` na verificação é essencial. Sem ele, um atacante poderia criar um token com `"alg": "none"`, que não tem assinatura, e o servidor aceitaria. O teste `rejeita token com algoritmo "none" (ataque clássico)` garante que essa defesa existe.

---

## 7. Autenticação nas rotas: `middlewares/authenticate.js`

O middleware transforma o cabeçalho `Authorization` em `req.user`:

```text
Authorization: Bearer eyJhbGciOi...
                ▲      ▲
                │      └── token
                └── esquema (precisa ser "Bearer")
```

Fluxo:

1. Sem cabeçalho, ou com esquema diferente de `Bearer` → `401`.
2. Token com assinatura inválida, adulterado ou expirado → `401`.
3. `sub` que não é um número inteiro → `401`.
4. Token válido → `req.user = { id, email }` e `next()`.

### Por que `next()` fica fora do `try`

```js
let payload;
try {
  payload = tokenIssuer.verify(token);
} catch {
  return next(new UnauthorizedError('Token inválido ou expirado'));
}

const id = Number(payload.sub);
// ...
req.user = { id, email: payload.email };
return next();
```

Se o `next()` estivesse dentro do `try`, um erro lançado por uma rota protegida seria capturado pelo `catch` e transformado, por engano, em "token inválido". O diagnóstico ficaria errado e o cliente pensaria que precisa fazer login de novo.

---

## 8. Atualização e exclusão

### 8.1 Regra de dono

Os métodos `update` e `remove` começam com a mesma verificação:

```js
function assertOwner(actorId, targetId) {
  if (actorId !== targetId) {
    throw new ForbiddenError('Você só pode alterar a própria conta');
  }
}
```

`actorId` vem do token (quem está fazendo a requisição) e `targetId` vem da URL (a conta que se quer alterar). A verificação acontece **antes** de qualquer leitura no banco. Assim, um usuário não consegue sequer descobrir se uma conta existe por meio desses métodos.

### 8.2 Atualização parcial (`PATCH`)

O `PATCH` altera apenas os campos enviados. O fluxo tem cinco passos:

```js
async update(actorId, targetId, input) {
  assertOwner(actorId, targetId);                       // 1. é a própria conta?
  const changes = validateUserUpdate(input);            // 2. campos válidos?
  const current = await requireUser(targetId);          // 3. a conta existe?

  const patch = {};
  if (changes.name !== undefined) {
    patch.name = changes.name;
  }
  if (changes.email !== undefined && changes.email !== current.email) {
    const holder = await usersRepository.findByEmail(changes.email);   // 4. e-mail livre?
    if (holder && holder.id !== targetId) {
      throw new ConflictError('E-mail já cadastrado');
    }
    patch.email = changes.email;
  }
  if (changes.password !== undefined) {
    patch.passwordHash = await passwordHasher.hash(changes.password);  // 5. novo hash
  }

  const updated = await usersRepository.update(targetId, patch);
  return toOwnProfile(updated);
}
```

**Repare no passo 4.** A checagem de e-mail só acontece quando o e-mail realmente muda. Se o usuário reenviar o mesmo e-mail, a regra não precisa rodar, e o campo nem entra no `patch`.

**No repositório**, o `COALESCE` faz o papel de "campo opcional":

```sql
UPDATE users
   SET name          = COALESCE(@name, name),
       email         = COALESCE(@email, email),
       password_hash = COALESCE(@passwordHash, password_hash)
 WHERE id = @id
```

Quando o parâmetro é `NULL`, o `COALESCE` mantém o valor atual da coluna. Assim, uma única instrução SQL atualiza apenas o que foi enviado.

### 8.3 Exclusão (`DELETE`)

```js
async remove(actorId, targetId) {
  assertOwner(actorId, targetId);

  const removed = await usersRepository.delete(targetId);
  if (!removed) {
    throw new NotFoundError('Usuário não encontrado');
  }
}
```

A resposta de sucesso é `204 No Content`, sem corpo. O repositório devolve `true` ou `false` conforme o número de linhas afetadas (`info.changes`).

---

## 9. Decisões de segurança: resumo

| Ameaça | Defesa | Onde |
|---|---|---|
| Vazamento do banco expõe senhas | Hash scrypt com salt aleatório | `security/password.js` |
| Descoberta de e-mails cadastrados | Mensagem idêntica e verificação de senha sempre executada | `services/auth.service.js` |
| Duas contas com o mesmo e-mail | Normalização + checagem + `UNIQUE` no banco | `validation/`, `services/`, `db/` |
| Token adulterado | Assinatura HMAC-SHA256 | `security/token.js` |
| Token com `alg: none` | Lista explícita de algoritmos na verificação | `security/token.js` |
| Alterar a conta de outra pessoa | Regra de dono antes de qualquer leitura | `services/users.service.js` |
| Vazar detalhes internos em erros | Erros inesperados viram `500` genérico | `middlewares/error-handler.js` |
| Corpo JSON enorme para consumir memória | Limite de `100kb` no `express.json` | `app.js` |
| Porta do Express revelando a tecnologia | `x-powered-by` desabilitado | `app.js` |

---

## 10. Exemplo completo com `curl`

Os comandos abaixo foram executados contra o serviço real, com a saída reproduzida. Para repetir, suba o serviço com `npm run start -w @blog/ms-users`.

### 10.1 Cadastrar

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Souza","email":"Ana@Exemplo.com","password":"senha-forte-123"}'
```

```json
{"id":1,"name":"Ana Souza","email":"ana@exemplo.com","createdAt":"2026-11-08T18:37:24.240Z"}
```

Repare que o e-mail foi salvo em minúsculas, mesmo tendo sido enviado com maiúsculas.

### 10.2 Tentar cadastrar o mesmo e-mail

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Outra","email":"ANA@exemplo.com","password":"outra-senha-123"}'
```

```json
{"error":{"code":"CONFLICT","message":"E-mail já cadastrado"}}
```

### 10.3 Entrar

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","password":"senha-forte-123"}'
```

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIs...","tokenType":"Bearer","expiresIn":3600}
```

Guarde o valor de `accessToken` em uma variável para os próximos passos:

```bash
TOKEN="cole-aqui-o-accessToken"
```

### 10.4 Consultar a própria conta

```bash
curl http://localhost:3001/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{"id":1,"name":"Ana Souza","email":"ana@exemplo.com","createdAt":"2026-11-08T18:37:24.240Z"}
```

### 10.5 Erros que você deve conseguir reproduzir

| Comando | Resposta | Por quê |
|---|---|---|
| Login com senha errada | `401 Credenciais inválidas` | Senha não confere |
| Login com e-mail inexistente | `401 Credenciais inválidas` | Mesma mensagem, de propósito |
| `GET /auth/me` sem cabeçalho | `401 Token ausente ou mal formatado` | Falta o `Authorization` |
| `GET /auth/me` com token alterado | `401 Token inválido ou expirado` | Assinatura não confere |
| `PATCH /users/2` com o token da Ana | `403 Você só pode alterar a própria conta` | Ana não é dona da conta 2 |
| `POST /users` com JSON quebrado | `400 INVALID_JSON` | O corpo não é JSON válido |
| `GET /rota-que-nao-existe` | `404 NOT_FOUND` | Nenhuma rota corresponde |

---

## 11. Trade-offs assumidos

Um bom engenheiro não esconde as limitações. Esta etapa tem algumas, deliberadamente:

**Tokens não podem ser revogados antes do vencimento.** O JWT é *stateless*: o servidor não guarda a lista de tokens emitidos. Por isso, depois que a conta é excluída, o token ainda assinado continua válido até expirar. Na prática, o `GET /auth/me` responde `404 Usuário não encontrado`, porque a verificação de assinatura passa, mas a conta não existe mais. Revogação imediata exigiria uma lista de bloqueio no banco, o que anula parte da vantagem do JWT.

**Não há *refresh token*.** Quando o token expira, o usuário precisa fazer login de novo. É suficiente para a aula, mas aplicações reais costumam usar um token de curta duração com um refresh token de longa duração.

**Não há limite de tentativas de login.** Um atacante pode testar senhas indefinidamente. A defesa típica é um *rate limit* por IP e por e-mail, que pode ser adicionado como middleware em uma etapa futura.

**A troca de senha não pede a senha atual.** Em produção, a alteração de senha deveria exigir a senha atual, para que um token roubado não permita trocar a senha da vítima.

**A lista pública expõe todos os usuários.** `GET /users` não tem paginação. Com muitos registros, a resposta ficaria grande. Paginação com `limit` e `offset` é um bom exercício para a próxima etapa.

---

## 12. Exercícios sugeridos

1. Adicione paginação em `GET /users` com os parâmetros `limit` e `offset`. Escreva primeiro o teste unitário do service.
2. Altere o `ENTRADA_VALIDA` do teste de cadastro para um e-mail com espaços no meio e observe qual validação falha.
3. Remova o `DUMMY_PASSWORD_HASH` do fluxo de login e rode o teste `executa a verificação de senha mesmo quando o e-mail não existe`. Explique a falha com suas palavras.
4. Troque o `algorithms: [ALGORITHM]` por `algorithms: ['HS256', 'none']` e rode os testes de segurança. Qual teste deveria falhar?
