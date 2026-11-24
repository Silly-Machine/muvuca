Estado: rascunho, aguardando aprovação (24/11/2026)

# Requisitos: publicação automática no npm

## Introdução

Hoje uma versão chega ao npm só quando alguém roda `npm publish` no próprio computador e confirma o código de dois fatores. A 1.0.1 saiu em Releases e não foi para o npm. Queremos que toda versão lançada (tag `v*`) chegue ao npm sozinha, e que mudança só de documentação não gere publicação.

## Fora do escopo

- Mudar o nome do pacote para `@silly-machine/muvuca` (depende de criar a organização no npm).
- Publicar a cada commit no `main`: o npm recebe versões, não commits.
- Assinar os instaladores.

## Requisitos

### Requisito 1: a tag publica no npm

**História:** Como mantenedor, quero que lançar uma versão já a publique no npm, para o `npx muvuca` nunca ficar atrás da página de Releases.

#### Critérios de aceite

1. QUANDO uma tag `v*` é enviada e os testes passam nos três sistemas, O SISTEMA DEVE publicar essa versão no npm.
2. SE a conferência da versão ou algum teste falhar, ENTÃO O SISTEMA DEVE não publicar.
3. QUANDO a versão tem sufixo (como `1.1.0-beta.1`), O SISTEMA DEVE publicá-la com a etiqueta `next`, sem virar a `latest`.
4. SE a versão já existe no npm (fluxo rodado de novo), ENTÃO O SISTEMA DEVE terminar sem erro e sem publicar outra vez.
5. QUANDO o fluxo é rodado à mão, sem tag, O SISTEMA DEVE não publicar.

### Requisito 2: nenhum segredo guardado

**História:** Como mantenedor, quero publicar sem token do npm guardado no GitHub, para não haver segredo que possa vazar.

#### Critérios de aceite

1. O SISTEMA DEVE autenticar no npm pela publicação confiável (OIDC), sem `NPM_TOKEN`.
2. O SISTEMA DEVE publicar com o selo de procedência, ligando o pacote ao commit e ao fluxo que o gerou.

### Requisito 3: só código gera versão

**História:** Como mantenedor, quero que mudança só de documentação não vá ao npm, para não gastar número de versão.

#### Critérios de aceite

1. O SISTEMA DEVE publicar apenas a partir de tags; envio ao `main` sem tag não publica.
2. O SISTEMA DEVE documentar em `docs/versoes.md` que mudança só de documentação não pede versão nova.

## Perguntas em aberto

- A publicação confiável precisa ser cadastrada uma vez em npmjs.com (pacote → Settings → Trusted Publisher → GitHub Actions: `Silly-Machine`, `muvuca`, `instaladores.yml`). Só o dono do pacote faz isso.
- Publicar no npm antes ou depois da página de Releases? Proposta: depois dos instaladores gerados, em paralelo com a release.
