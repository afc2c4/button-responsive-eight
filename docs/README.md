# Material didático · Blog em Microsserviços

Documentação do projeto [`blog-microservices`](../blog-microservices/), construído passo a passo para estudar **testes de software** com **Vitest** (testes unitários) e **Supertest** (testes de integração), usando **Node.js** e um banco **SQL**.

---

## Índice por etapa

| Etapa | Conteúdo | Documentos | Status |
|---|---|---|---|
| **1** | Desenho da arquitetura e setup inicial | [01 · Arquitetura](./etapa-01/01-arquitetura-microsservicos.md) · [02 · Estrutura de pastas](./etapa-01/02-estrutura-de-pastas.md) · [03 · Configuração inicial](./etapa-01/03-configuracao-inicial.md) | Concluída |
| **2** | Microsserviço de Usuários (ms-users): infraestrutura, CRUD, autenticação JWT e testes unitários | [01 · Infraestrutura](./etapa-02/01-infraestrutura-ms-users.md) · [02 · CRUD e autenticação](./etapa-02/02-crud-e-autenticacao.md) · [03 · Testes unitários](./etapa-02/03-testes-unitarios.md) | Concluída |
| **3** | Microsserviço do Blog (ms-blog): CRUD de posts, autenticação por JWT, comunicação com o ms-users e testes unitários | [01 · Infraestrutura e comunicação](./etapa-03/01-infraestrutura-e-comunicacao.md) · [02 · CRUD de posts](./etapa-03/02-crud-de-posts.md) · [03 · Testes unitários](./etapa-03/03-testes-unitarios.md) | Concluída |
| **4** | Testes de integração e comunicação de ponta a ponta | — | Pendente |

---

## Como ler esta documentação

1. Comece pelo **documento 01** para entender por que o sistema está dividido em dois serviços e como eles se comunicam.
2. Leia o **documento 02** para localizar cada arquivo na árvore do projeto.
3. Siga o **documento 03** para preparar o ambiente e executar a verificação.

---

## Estrutura desta pasta

```text
docs/
├── README.md                              ← este índice
├── etapa-01/
│   ├── 01-arquitetura-microsservicos.md   ← teoria: divisão dos serviços e comunicação
│   ├── 02-estrutura-de-pastas.md          ← árvore completa do projeto e convenções
│   └── 03-configuracao-inicial.md         ← explicação de cada arquivo de configuração
├── etapa-02/
│   ├── 01-infraestrutura-ms-users.md      ← package.json, configuração, banco, composição e servidor
│   ├── 02-crud-e-autenticacao.md          ← endpoints, fluxos de cadastro e login, JWT e exemplos
│   └── 03-testes-unitarios.md             ← isolamento com stubs, mutação e como rodar os testes
└── etapa-03/
    ├── 01-infraestrutura-e-comunicacao.md ← setup do ms-blog, banco, cliente HTTP do ms-users e fluxos
    ├── 02-crud-de-posts.md                ← regras, ordem das verificações, falhas e exemplos
    └── 03-testes-unitarios.md             ← mocks e stubs, mutação, cobertura e como rodar
```

A pasta `docs/` fica **fora** de `blog-microservices/`, para que a documentação não seja misturada ao código executável do projeto.
