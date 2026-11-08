# 03 · Configuração Inicial do Projeto

> **Etapa 1 — Desenho da arquitetura e setup inicial**
>
> Este documento explica cada arquivo de configuração da raiz do projeto, linha por linha quando necessário, e traz o passo a passo para preparar o ambiente. A arquitetura está em [01-arquitetura-microsservicos.md](./01-arquitetura-microsservicos.md) e a organização das pastas em [02-estrutura-de-pastas.md](./02-estrutura-de-pastas.md).

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como verificar |
|---|---|---|
| Node.js | 22 (a versão do `.nvmrc`) | `node -v` |
| npm | 10 ou superior | `npm -v` |
| nvm *(opcional)* | qualquer | `nvm -v` |

Se você usa o **nvm**, ele lê o arquivo `.nvmrc` e troca para a versão certa do Node.js com um único comando.

---

## 2. Passo a passo de setup

Execute os comandos abaixo a partir da raiz do repositório:

```bash
cd blog-microservices
nvm use
npm install
cp .env.example .env
npm test
```

O que cada comando faz:

| Comando | Efeito |
|---|---|
| `cd blog-microservices` | Entra na pasta do projeto, onde estão `package.json` e `vitest.config.js` |
| `nvm use` | Usa a versão do Node.js indicada em `.nvmrc` |
| `npm install` | Instala as dependências e cria `node_modules/` e o `package-lock.json` |
| `cp .env.example .env` | Cria seu arquivo `.env` local a partir do modelo |
| `npm test` | Executa todos os testes. Nesta etapa, ainda não há testes, então o comando termina com sucesso |

> O arquivo `.env` é **pessoal** e **nunca** deve ser commitado. Ele já está no `.gitignore`.

---

## 3. `package.json` (raiz)

```json
{
  "name": "blog-microservices",
  "version": "1.0.0",
  "description": "Blog em microsserviços (ms-users e ms-blog) para aulas de testes de software com Vitest e Supertest",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "workspaces": [
    "services/*"
  ],
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:unit": "vitest run --project unit --passWithNoTests",
    "test:integration": "vitest run --project integration --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "4.0.18",
    "supertest": "^7.3.2",
    "vitest": "4.0.18"
  }
}
```

### Campo por campo

| Campo | O que faz | Por que está aqui |
|---|---|---|
| `name` | Nome do pacote raiz | Identifica o monorepo |
| `private: true` | Impede a publicação acidental no npm | O projeto é didático, não uma biblioteca |
| `type: "module"` | Faz os arquivos `.js` serem tratados como **módulos ES** (`import`/`export`) | Padrão moderno do JavaScript; permite escrever `import` no `vitest.config.js` e nos arquivos de código |
| `engines` | Declara a versão mínima do Node.js | O npm avisa se a versão instalada for incompatível |
| `workspaces` | Declara que cada pasta em `services/` é um pacote do monorepo | Um único `npm install` instala tudo; os serviços compartilham o `node_modules` da raiz |
| `scripts` | Atalhos para os comandos de teste | Ver a seção 4 |
| `devDependencies` | Ferramentas usadas só durante o desenvolvimento | Ver a seção 5 |

### Por que `vitest` e `@vitest/coverage-v8` estão com versão exata (`4.0.18`)?

Esses dois pacotes têm **versão fixada, sem o caractere `^`**, de propósito.

Durante a preparação desta etapa, verificamos que o **`vitest@4.1.12` quebra a instalação** com npm 10.9.9 (Node.js 22.23.4), com este erro:

```text
npm error Cannot read properties of null (reading 'edgesOut')
```

O `vitest@4.0.18` instala sem problemas nesse mesmo ambiente, e `vitest@3.2.7` também. Por isso:

- a versão está **fixada** em `4.0.18`;
- `@vitest/coverage-v8` recebe a **mesma versão** do Vitest, porque os dois precisam estar alinhados;
- o `^` não é usado, porque ele aceitaria `4.1.x` e reintroduziria o problema.

> **Lição para a aula:** versões de ferramentas de teste precisam estar alinhadas, e uma atualização "automática" pode quebrar o ambiente. Quando quiser atualizar, teste em um branch antes de fixar a nova versão.

### Por que `supertest` usa `^7.3.2`?

O Supertest não tem o mesmo problema de resolução de dependências, então podemos aceitar atualizações de patch e de minor dentro da versão 7 (`>=7.3.2 <8.0.0`).

### Por que o `test` tem `--passWithNoTests`?

Nesta etapa, **ainda não existe nenhum arquivo de teste**. Sem esse flag, o Vitest encerra com erro (código `1`) porque não encontrou nada para executar. Com o flag, o comando termina com sucesso e informa que nenhum arquivo foi encontrado.

Esse flag é uma **medida temporária**: ele será retirado quando os primeiros testes forem escritos, para que um projeto sem testes não passe despercebido.

---

## 4. Scripts de teste

| Script | Comando executado | Quando usar |
|---|---|---|
| `npm test` | `vitest run` (todos os projetos) | Verificação completa, antes de um commit |
| `npm run test:unit` | `vitest run --project unit` | Feedback rápido enquanto você escreve regras de negócio |
| `npm run test:integration` | `vitest run --project integration` | Quando alterar rotas, controllers ou repositórios |
| `npm run test:coverage` | `vitest run --coverage` | Para ver quais linhas do código estão cobertas por testes |
| `npm run test:watch` | `vitest` (modo interativo) | Durante o desenvolvimento: reexecuta os testes a cada alteração |

A diferença entre `vitest run` e `vitest` é importante: `run` executa uma vez e encerra, o que é necessário em scripts e em CI. `vitest` sem `run` fica em modo *watch*, observando as alterações.

---

## 5. Dependências: o que entra na raiz e o que fica no serviço

| Dependência | Onde fica | Motivo |
|---|---|---|
| `vitest` | Raiz (`devDependencies`) | Executa os testes dos dois serviços |
| `@vitest/coverage-v8` | Raiz (`devDependencies`) | Gera o relatório de cobertura |
| `supertest` | Raiz (`devDependencies`) | Faz requisições HTTP aos apps nos testes de integração |
| `express` | Serviço (próximas etapas) | Só o serviço que expõe a API precisa dele em tempo de execução |
| driver do SQLite | Serviço (próximas etapas) | Cada serviço acessa o próprio banco |

---

## 6. `.nvmrc`

```text
22
```

O arquivo contém apenas o número da versão principal do Node.js. Ferramentas como `nvm`, `fnm` e `volta` leem esse arquivo e usam a versão correta automaticamente.

---

## 7. `.gitignore`

O `.gitignore` define o que **não** entra no repositório. Os grupos são:

| Grupo | Padrões | Motivo |
|---|---|---|
| Dependências | `node_modules/` | Pode ser recriado com `npm install`; é grande e específico de cada máquina |
| Variáveis de ambiente | `.env`, `.env.*`, e a exceção `!.env.example` | O `.env` pode conter segredos. O `.env.example` é o modelo público e precisa ser versionado |
| Bancos locais | `data/`, `*.sqlite*` | Os bancos são locais. Os arquivos auxiliares do SQLite (`-wal`, `-shm`) também são cobertos |
| Cobertura | `coverage/` | Relatório gerado pelo `npm run test:coverage` |
| Logs | `*.log`, `npm-debug.log*` | Arquivos temporários |
| Sistema e editores | `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/` | Configurações pessoais de cada máquina |

> O `package-lock.json` **não** está no `.gitignore`. Ele deve ser versionado, porque garante que todos instalem exatamente as mesmas versões.

---

## 8. `.env.example`

```dotenv
NODE_ENV=development

USERS_SERVICE_PORT=3001
USERS_DB_PATH=./data/ms-users.sqlite

BLOG_SERVICE_PORT=3002
BLOG_DB_PATH=./data/ms-blog.sqlite

USERS_SERVICE_URL=http://localhost:3001
USERS_SERVICE_TIMEOUT_MS=3000
```

### Tabela das variáveis

| Variável | Valor de exemplo | Usada por | Descrição |
|---|---|---|---|
| `NODE_ENV` | `development` | Ambos | Ambiente de execução: `development`, `test` ou `production` |
| `USERS_SERVICE_PORT` | `3001` | ms-users | Porta HTTP em que o ms-users escuta |
| `USERS_DB_PATH` | `./data/ms-users.sqlite` | ms-users | Arquivo do banco do ms-users |
| `BLOG_SERVICE_PORT` | `3002` | ms-blog | Porta HTTP em que o ms-blog escuta |
| `BLOG_DB_PATH` | `./data/ms-blog.sqlite` | ms-blog | Arquivo do banco do ms-blog |
| `USERS_SERVICE_URL` | `http://localhost:3001` | ms-blog | Endereço que o ms-blog usa para chamar o ms-users |
| `USERS_SERVICE_TIMEOUT_MS` | `3000` | ms-blog | Tempo máximo de espera pela resposta do ms-users, em milissegundos |

### Regras do arquivo

- **Caminhos relativos:** `./data/...` é resolvido a partir da pasta de onde o processo é iniciado. Quando o serviço é executado pelo npm, essa pasta é a do próprio serviço, o que faz cada banco ficar dentro do seu serviço.
- **Sem comentários na mesma linha:** os comentários ficam em linhas próprias, para evitar que um parser interprete o texto do comentário como valor da variável.
- **Os testes de integração não usam estes valores:** o `vitest.config.js` define variáveis próprias para os testes (ver a seção 9).

### Como o `.env` é lido

O Node.js 22 consegue carregar o arquivo sem bibliotecas extras:

```bash
node --env-file=.env -e "console.log(process.env.USERS_SERVICE_PORT)"
```

Nas próximas etapas, cada serviço usará esse mecanismo na inicialização.

---

## 9. `vitest.config.js`

A configuração global fica na raiz e vale para todo o monorepo. Ela está organizada em três blocos: opções gerais, cobertura e projetos.

### 9.1 Opções gerais (`test`)

| Opção | Valor | Significado |
|---|---|---|
| `globals` | `false` | `describe`, `it`, `expect` e `vi` precisam ser importados. O arquivo deixa explícito de onde vem cada função |
| `environment` | `'node'` | Os testes rodam no Node.js. Não há DOM nem navegador neste projeto |
| `clearMocks` | `true` | Limpa o histórico de chamadas dos mocks antes de cada teste |
| `restoreMocks` | `true` | Restaura a implementação original dos espiões criados com `vi.spyOn`, antes de cada teste |

`clearMocks` e `restoreMocks` evitam que um teste "vaze" estado para o próximo. Um erro comum em aulas é um teste passar sozinho e falhar quando executado junto com outros.

### 9.2 Cobertura (`coverage`)

| Opção | Valor | Significado |
|---|---|---|
| `provider` | `'v8'` | Usa o coletor de cobertura nativo do V8, o mesmo motor do Node.js |
| `reporter` | `['text', 'html', 'lcov']` | Mostra o resumo no terminal, gera uma página HTML e um arquivo `lcov` para ferramentas de CI |
| `reportsDirectory` | `'./coverage'` | Pasta dos relatórios (ignorada pelo Git) |
| `include` | `['services/*/src/**/*.js']` | Mede apenas o código de aplicação. Testes e configurações ficam fora da medição |

As metas mínimas de cobertura (*thresholds*) serão definidas nas próximas etapas, quando houver código para medir.

### 9.3 Projetos (`projects`)

O Vitest permite dividir os testes em **projetos**. Cada projeto tem um nome, um conjunto de arquivos e suas próprias opções. Aqui temos dois:

```js
projects: [
  {
    extends: true,
    test: {
      name: 'unit',
      include: ['services/*/tests/unit/**/*.test.js'],
      testTimeout: 5000,
      hookTimeout: 5000,
    },
  },
  {
    extends: true,
    test: {
      name: 'integration',
      include: ['services/*/tests/integration/**/*.test.js'],
      testTimeout: 15000,
      hookTimeout: 15000,
      fileParallelism: false,
      env: {
        NODE_ENV: 'test',
        USERS_DB_PATH: ':memory:',
        BLOG_DB_PATH: ':memory:',
      },
    },
  },
],
```

| Opção | Projeto | Significado |
|---|---|---|
| `extends: true` | ambos | Herda todas as opções gerais definidas acima. Sem isso, cada projeto começaria do zero |
| `name` | ambos | Nome usado pelo filtro `--project` e exibido no relatório |
| `include` | ambos | Padrão de arquivos que pertencem ao projeto. Unitários e de integração nunca se misturam |
| `testTimeout` | ambos | Tempo máximo, em ms, para um teste. Testes de integração recebem mais tempo, porque sobem rotas e banco |
| `hookTimeout` | ambos | Tempo máximo, em ms, para funções de preparação e limpeza (`beforeAll`, `afterEach`, etc.) |
| `fileParallelism` | integração | `false` executa um arquivo de teste por vez, evitando conflito de recursos compartilhados |
| `env` | integração | Define variáveis de ambiente exclusivas dos testes de integração |

**Por que `:memory:` nos testes de integração?** Um banco em memória é criado no início do teste e descartado no fim. Cada execução começa com um banco vazio, e os testes não deixam dados uns para os outros.

**Por que os testes unitários não recebem `env`?** Eles não devem tocar em banco nem em rede. Se um teste unitário depender de uma variável de ambiente, isso é sinal de que a regra de negócio está misturada com a infraestrutura.

---

## 10. Verificação da Etapa 1

Execute, na pasta `blog-microservices`, os comandos abaixo. Cada um deve terminar com o resultado indicado.

| Comando | Resultado esperado |
|---|---|
| `node -v` | `v22.x.x` |
| `npx vitest --version` | `vitest/4.0.18` |
| `npm ls --depth=0` | Lista `@vitest/coverage-v8@4.0.18`, `supertest@7.3.2` e `vitest@4.0.18`, sem erros |
| `npm test` | Termina com código `0` e informa que nenhum arquivo de teste foi encontrado |
| `npm run test:unit` | Termina com código `0` |
| `npm run test:integration` | Termina com código `0` |

Para conferir o código de saída de qualquer comando, use `echo $?` logo após a execução (Linux e macOS) ou `echo %errorlevel%` (Windows, no CMD).

---

## 11. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Cannot read properties of null (reading 'edgesOut')` durante o `npm install` | Versão do Vitest 4.1.x com o npm 10 | Confirme que o `package.json` está com `"vitest": "4.0.18"`. Apague `node_modules/` e `package-lock.json` e rode `npm install` de novo |
| `EBADENGINE` ou aviso sobre a versão do Node.js | Node.js anterior à versão 22 | Rode `nvm use` ou instale a versão indicada em `.nvmrc` |
| `npm test` falha com `No test files found` | Não é falha: significa que ainda não há testes | Não se aplica à Etapa 1. Nas próximas etapas, o script encontrará os arquivos normalmente |
| Mudanças no `.env` não aparecem | O processo ainda usa os valores antigos | Reinicie o processo. Variáveis de ambiente são lidas na inicialização |
| `git status` mostra `.env` como arquivo novo | O `.env` não está sendo ignorado | Confirme que o `.gitignore` está na pasta `blog-microservices/` e que a linha `.env` está presente |

---

## 12. O que vem a seguir

Com a Etapa 1 concluída, o projeto tem:

- o desenho da arquitetura (documento 01);
- a estrutura completa de pastas (documento 02);
- a configuração do monorepo, dos testes e do ambiente (este documento).

A próxima etapa implementa o primeiro microsserviço. Ela começa pela estrutura e pelas dependências do ms-users.
