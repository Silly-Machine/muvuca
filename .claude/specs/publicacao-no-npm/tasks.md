# Tarefas: publicação automática no npm

Aprovada em 24/11/2026. Suspensa no mesmo dia, a pedido, para voltar depois.

## Pendência (24/11/2026)

O primeiro lançamento pelo fluxo (v1.0.3) gerou os instaladores e a Release, mas o trabalho "Publicar no npm" falhou com `E404 Not Found - PUT https://registry.npmjs.org/muvuca`: o npm não aceitou a identidade do fluxo. Ambiente: Node 24.22.3, npm 11.19.1. O npm continua na 1.0.0.

Retomada em 24/11/2026. Diagnóstico pelo log: não há nenhuma linha de procedência ("Signed provenance"), então a troca de identidade com o npm nem aconteceu; o npm caiu no token de enfeite do `setup-node` (`NODE_AUTH_TOKEN: XXXXX-...`) e recebeu o 404. Decidido manter o nome `muvuca`. O fluxo perdeu o `registry-url`, para a próxima falha aparecer como falta de autenticação.

Para retomar, nesta ordem:

1. Conferir o cadastro em npmjs.com (pacote `muvuca` → Settings → Trusted Publisher): `Silly-Machine`, `muvuca`, `instaladores.yml`, ambiente vazio, e se foi salvo.
2. Reexecutar só o trabalho que falhou na execução da tag v1.0.3 (`gh run rerun <id> --failed`).
3. Se falhar de novo com o cadastro certo: suspeita seguinte é o `NODE_AUTH_TOKEN` de enfeite que o `setup-node` põe no ambiente quando recebe `registry-url`. Tirar o `registry-url` (ou limpar a variável) e provar na versão seguinte.
4. Alternativa imediata: `npm publish` à mão, pelo dono do pacote.

- [x] 1. Acrescentar o trabalho `npm` ao fluxo de instaladores
  - conforme o desenho; conferir a sintaxe do arquivo
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1_

- [x] 2. Documentar
  - `docs/versoes.md` (passo do npm e nota sobre documentação), roteiro do `README.md`, linha em "Em andamento" no `CHANGELOG.md`
  - _Requisitos: 3.2_

- [ ] 3. Cadastro da publicação confiável em npmjs.com
  - feito pelo dono do pacote, logo antes do primeiro lançamento
  - _Requisitos: 2.1_

- [ ] 4. Primeiro lançamento pelo fluxo
  - lançar a próxima versão; conferir `npm view muvuca version` e o selo de procedência
  - _Requisitos: 1.1, 2.2_

- [ ] 5. Rodar o fluxo de novo para a mesma tag
  - o trabalho `npm` termina sem erro e sem publicar
  - _Requisitos: 1.4_
