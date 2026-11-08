# Material didático · Blog em Microsserviços

Documentação do projeto [`blog-microservices`](../blog-microservices/), construído passo a passo para estudar **testes de software** com **Vitest** (testes unitários) e **Supertest** (testes de integração), usando **Node.js** e um banco **SQL**.

---

## Índice por etapa

| Etapa | Conteúdo | Documentos | Status |
|---|---|---|---|
| **1** | Desenho da arquitetura e setup inicial | [01 · Arquitetura](./etapa-01/01-arquitetura-microsservicos.md) · [02 · Estrutura de pastas](./etapa-01/02-estrutura-de-pastas.md) · [03 · Configuração inicial](./etapa-01/03-configuracao-inicial.md) | Concluída |
| **2** | *(a definir)* | — | Aguardando |

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
└── etapa-01/
    ├── 01-arquitetura-microsservicos.md   ← teoria: divisão dos serviços e comunicação
    ├── 02-estrutura-de-pastas.md          ← árvore completa do projeto e convenções
    └── 03-configuracao-inicial.md         ← explicação de cada arquivo de configuração
```

A pasta `docs/` fica **fora** de `blog-microservices/`, para que a documentação não seja misturada ao código executável do projeto.
