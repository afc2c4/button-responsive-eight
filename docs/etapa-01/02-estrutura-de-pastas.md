# 02 · Estrutura de Pastas do Projeto

> **Etapa 1 — Desenho da arquitetura e setup inicial**
>
> Este documento apresenta a estrutura completa do projeto e explica o papel de cada pasta. Ele também indica em qual etapa cada arquivo é criado. Os conceitos de arquitetura estão em [01-arquitetura-microsservicos.md](./01-arquitetura-microsservicos.md).

---

## 1. Onde fica cada coisa

O repositório tem **duas pastas no nível principal**, separadas de propósito:

```text
button-responsive-eight/        ← repositório Git
├── blog-microservices/         ← o PROJETO (código, configuração e testes)
└── docs/                       ← a DOCUMENTAÇÃO (fora do projeto)
    └── etapa-01/
```

A separação tem um motivo prático: a documentação explica o projeto, mas não é parte da sua execução. Assim, o código pode ser copiado, instalado ou publicado sem arrastar os textos de apoio.

---

## 2. Árvore completa do projeto

Os comentários indicam **quando** cada item é criado:

- `← Etapa 1`: já existe nesta etapa.
- `← próximas etapas`: será criado depois, conforme o projeto avança.

```text
blog-microservices/
├── .env.example                        ← Etapa 1 · modelo das variáveis de ambiente
├── .gitignore                          ← Etapa 1 · arquivos que o Git deve ignorar
├── .nvmrc                              ← Etapa 1 · versão do Node.js (22)
├── package.json                        ← Etapa 1 · raiz do monorepo: workspaces, scripts e ferramentas de teste
├── package-lock.json                   ← Etapa 1 · versões exatas instaladas (gerado pelo npm)
├── vitest.config.js                    ← Etapa 1 · configuração global do Vitest
│
└── services/                           ← um diretório por microsserviço (workspaces do npm)
    │
    ├── ms-users/                       ← Microsserviço de Usuários · porta 3001
    │   ├── package.json                ← próximas etapas · dependências de runtime deste serviço
    │   ├── data/                       ← próximas etapas · arquivo SQLite (gerado; ignorado pelo Git)
    │   ├── src/
    │   │   ├── server.js               ← próximas etapas · ponto de entrada: abre a porta HTTP
    │   │   ├── app.js                  ← próximas etapas · monta a aplicação Express, sem abrir porta
    │   │   ├── config.js               ← próximas etapas · lê e valida as variáveis de ambiente
    │   │   ├── db/
    │   │   │   └── database.js         ← próximas etapas · abre o SQLite e cria a tabela
    │   │   ├── routes/
    │   │   │   └── users.routes.js     ← próximas etapas · mapeia método + URL para o controller
    │   │   ├── controllers/
    │   │   │   └── users.controller.js ← próximas etapas · lê a requisição e monta a resposta
    │   │   ├── services/
    │   │   │   └── users.service.js    ← próximas etapas · regras de negócio
    │   │   ├── repositories/
    │   │   │   └── users.repository.js ← próximas etapas · único lugar com SQL de usuários
    │   │   └── middlewares/
    │   │       └── error-handler.js    ← próximas etapas · converte erros em respostas HTTP
    │   └── tests/
    │       ├── unit/
    │       │   └── users.service.test.js        ← próximas etapas
    │       └── integration/
    │           └── users.routes.test.js        ← próximas etapas
    │
    └── ms-blog/                        ← Microsserviço de Blog · porta 3002
        ├── package.json                ← próximas etapas · dependências de runtime deste serviço
        ├── data/                       ← próximas etapas · arquivo SQLite (gerado; ignorado pelo Git)
        ├── src/
        │   ├── server.js               ← próximas etapas
        │   ├── app.js                  ← próximas etapas
        │   ├── config.js               ← próximas etapas
        │   ├── db/
        │   │   └── database.js         ← próximas etapas
        │   ├── clients/
        │   │   └── users.client.js     ← próximas etapas · cliente HTTP que chama o ms-users
        │   ├── routes/
        │   │   └── posts.routes.js     ← próximas etapas
        │   ├── controllers/
        │   │   └── posts.controller.js ← próximas etapas
        │   ├── services/
        │   │   └── posts.service.js    ← próximas etapas
        │   ├── repositories/
        │   │   └── posts.repository.js ← próximas etapas
        │   └── middlewares/
        │       └── error-handler.js    ← próximas etapas
        └── tests/
            ├── unit/
            │   └── posts.service.test.js           ← próximas etapas
            └── integration/
                └── posts.routes.test.js            ← próximas etapas
```

> `node_modules/` aparece após `npm install`. Ele é gerado pelo npm, fica na raiz do projeto e é ignorado pelo Git.

---

## 3. Explicando a raiz do projeto (Etapa 1)

| Arquivo | Para que serve | Quem lê |
|---|---|---|
| `package.json` | Declara o monorepo (`workspaces`), os scripts de teste e as ferramentas de desenvolvimento | npm, você e os alunos |
| `package-lock.json` | Registra a versão exata de cada pacote instalado, garantindo que todos instalem o mesmo conjunto | npm (commitado no Git) |
| `vitest.config.js` | Configura os projetos `unit` e `integration` e as opções globais de teste | Vitest |
| `.env.example` | Lista as variáveis de ambiente que o projeto usa, com valores de exemplo | Você e os alunos (copiado para `.env`) |
| `.gitignore` | Impede que dependências, segredos e bancos locais entrem no repositório | Git |
| `.nvmrc` | Indica a versão do Node.js do projeto (`22`) | `nvm` e outras ferramentas |

### Por que a raiz tem as ferramentas de teste?

Vitest e Supertest são **ferramentas de desenvolvimento** compartilhadas pelos dois serviços. Por isso ficam em `devDependencies` na raiz. Com npm workspaces, eles são instalados uma única vez, em `node_modules/` na raiz, e ficam disponíveis para todos os serviços.

Cada serviço, por sua vez, declara apenas as **dependências de execução** que ele precisa (Express, driver do SQLite). Esse isolamento evita que o ms-users dependa de bibliotecas que só o ms-blog usa.

---

## 4. Explicando um microsserviço

Os dois serviços seguem **o mesmo padrão de camadas**. Essa consistência facilita a leitura e também ensina um padrão que se repete em projetos reais.

```text
requisição HTTP
      │
      ▼
routes ──────────► controllers ──────────► services ──────────► repositories ──────► banco SQL
(URL → função)     (lê e responde)        (regras de negócio)   (SQL e conversão)
```

| Camada | Pasta | Responsabilidade | O que NÃO deve fazer | Como é testada |
|---|---|---|---|---|
| **Rotas** | `routes/` | Associa método HTTP e URL a um controller | Conter lógica | Integração (Supertest) |
| **Controllers** | `controllers/` | Lê a requisição, chama o serviço e devolve a resposta HTTP | Conter regra de negócio ou SQL | Integração (Supertest) |
| **Services** | `services/` | Aplica as regras de negócio | Conhecer HTTP (`req`, `res`) ou SQL | **Unitário**, com o repositório substituído |
| **Repositories** | `repositories/` | Único lugar com SQL. Converte `snake_case` do banco para `camelCase` da aplicação | Decidir regras de negócio | Integração, com SQLite em memória |
| **Middlewares** | `middlewares/` | Tratamento transversal, como converter erros em respostas HTTP | Conter regra de negócio | Integração (Supertest) |
| **Clients** | `clients/` | Chamadas HTTP para outros microsserviços (somente no ms-blog) | Conter regra de negócio | **Unitário**, com o cliente substituído |

**Por que tantas camadas?** Cada camada muda por um motivo diferente. Se a regra de negócio mudar, mexemos só em `services/`. Se trocarmos o banco, mexemos só em `repositories/` e `db/`. Se mudarmos a URL de uma rota, mexemos só em `routes/`. Quando as responsabilidades estão separadas, cada teste pode focar em uma única camada.

---

## 5. Arquivos que merecem atenção especial

### `src/app.js` e `src/server.js` são separados

- **`app.js`** monta a aplicação Express (rotas, middlewares) e **exporta** o objeto `app`. Ele não abre nenhuma porta.
- **`server.js`** importa o `app` e chama `listen()` na porta configurada. É o único arquivo que "liga" o serviço.

**Motivo:** o Supertest recebe o `app` e cuida sozinho de subir um servidor temporário em uma porta livre durante o teste. Se `app.js` abrisse a porta por conta própria, os testes de integração brigariam por portas e não poderiam rodar em paralelo.

### `src/clients/users.client.js` (ms-blog)

É o **único ponto** em que o ms-blog conversa com o ms-users. Toda a comunicação entre os serviços passa por ele.

**Motivo:** a fronteira de rede é o lugar onde precisamos de um dublê nos testes. Com o cliente isolado, basta substituí-lo para simular respostas de sucesso, `404`, timeout e indisponibilidade, sem subir o ms-users de verdade.

### `tests/unit/` e `tests/integration/`

Cada serviço tem as duas pastas de teste. O `vitest.config.js` da raiz localiza os arquivos pelo padrão:

- `services/*/tests/unit/**/*.test.js` → projeto **`unit`**
- `services/*/tests/integration/**/*.test.js` → projeto **`integration`**

**Motivo:** os testes ficam ao lado do código que testam, e a separação por pasta define qual configuração cada teste recebe.

### `data/` (gerada em execução)

Cada serviço cria a própria pasta `data/` para o arquivo SQLite. Ela não é versionada, pois o conteúdo é local e pode ser recriado.

**Motivo:** reforça o princípio de **um banco por serviço**. O arquivo do ms-users nunca é usado pelo ms-blog.

---

## 6. Convenções de nomenclatura

| Tipo de arquivo | Padrão | Exemplo |
|---|---|---|
| Arquivo de código | `kebab-case` ou `nome.camada.js` | `users.routes.js`, `error-handler.js` |
| Teste | `nome.test.js`, na pasta do tipo de teste | `users.service.test.js` |
| Pasta | `kebab-case`, no plural quando agrupa itens | `services/`, `repositories/` |
| Serviço | prefixo `ms-` | `ms-users`, `ms-blog` |
| Variável de ambiente | `MAIÚSCULAS_COM_UNDERSCORE`, com prefixo do serviço | `USERS_SERVICE_PORT`, `BLOG_DB_PATH` |
| Campo JSON da API | `camelCase` | `authorId`, `createdAt` |
| Coluna do banco | `snake_case` | `author_id`, `created_at` |

---

## 7. Como conferir a estrutura

Depois de concluir a Etapa 1, a raiz do projeto deve conter exatamente estes itens:

```bash
cd blog-microservices
ls -la
```

Esperado (além de `node_modules/`, criado pelo `npm install`):

```text
.env.example
.gitignore
.nvmrc
package.json
package-lock.json
vitest.config.js
```

A pasta `services/` ainda **não existe** nesta etapa. Ela será criada quando o primeiro microsserviço for implementado.
