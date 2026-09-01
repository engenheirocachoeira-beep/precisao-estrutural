# Changelog — Precisão Estrutural

Histórico cronológico de todas as sessões de desenvolvimento, uma
entrada "## Retomada em AAAA-MM-DD" por retomada de trabalho. Extraído
de `prompt_gemini.md` (que virou só a referência de arquitetura/regras
vigentes — separado deste changelog em 2026-08-31, ver a última
entrada abaixo).

**Se você é uma IA retomando este projeto**: leia `prompt_gemini.md`
primeiro (arquitetura, regras, "como proceder em tarefa nova", schema
de dados) — este arquivo aqui é só o histórico do que já foi feito,
útil pra entender o CONTEXTO de uma decisão passada (por que uma
função existe do jeito que existe), não pra saber como o sistema
funciona hoje.

Comentários no código que dizem "ver prompt_gemini.md §X.Y" apontam
pra seção correspondente em `prompt_gemini.md` (não neste arquivo).
Comentários que dizem "prompt_gemini.md, parte N" apontam pra uma
entrada aqui.

---

## Retomada em 2026-08-10

Seguindo a prioridade natural registrada acima, nesta sessão:

1. **Teste real no navegador** (lote de Cadastro + leva 4 inteira,
   incluindo a cascata de verba do item 10) — **validado pelo
   usuário**, sem regressão reportada.
2. **"OBRA A" e "OBRA C"** — confirmadas pelo usuário como **sem
   órfãs**. Só "OBRA B" (já corrigida antes) teve o problema; não foi
   preciso rodar recuperação em massa pra mais nenhum caso.
3. **Item 8** (pontos zerados na Atribuição) — usuário reconfirmou:
   **não reproduz mais**. Fechado sem mudança de código (provavelmente
   resolvido de tabela por alguma correção da leva 4, ou era falso
   alarme).
4. **Item 17, parte final (proteção de colisão de nome)** — decisão do
   usuário: **bloquear**, não fundir automaticamente nem manter só o
   aviso. Implementado em `js/cadastros.js`, função `salvarProjeto()`,
   nos dois pontos de colisão:
   - Criar projeto novo com nome que já tem árvore salva em
     `banco_arvores_projetos` → agora `return` antes de criar o
     projeto ou tocar na árvore, com `alert()` explicando o motivo
     (antes: reaproveitava a árvore existente em silêncio, só com
     aviso).
   - Renomear projeto pra um nome que já tem árvore de outro projeto →
     agora `return` antes de persistir `banco_projetos`, bloqueando a
     renomeação inteira (antes: salvava o nome novo mesmo assim e só
     pulava a migração da árvore, com aviso).
   Lógica validada com testes isolados equivalentes em Python (Node
   não está disponível neste ambiente de execução — sem `node --check`
   nesta sessão; rodar essa validação de sintaxe na máquina de quem
   for aplicar o `.zip`). Replicado no módulo isolado
   (`modulos_isolados/cadastros/js/cadastros.js` + campo oculto
   `proj-nome-original` que faltava no `index.html` do módulo,
   dependência da correção anterior do item 17 que nunca tinha sido
   sincronizada).

5. **Item 14 (drag-and-drop em Setor/Pavimento/Tarefa)** — decisão do
   usuário sobre o escopo: **todos os níveis** ganham arrastar-e-soltar
   (antes só Etapa), reordenando **apenas entre irmãos** (mesmo pai);
   mover um nó pra debaixo de um pai diferente (reparenting) ficou
   fora, de propósito. Implementado em `js/arvore.js`:
   `iniciarArrastoEtapa`/`soltarEtapa` (que só entendiam índice simples
   no array `arv.etapas`) viraram `iniciarArrastoNo`/`soltarNo`,
   genéricos por `path` (mesmo formato de `resolverNoPorPath()`,
   ex.: `"0-1-2"`) — comparam todos os segmentos do path menos o
   último pra confirmar que origem e destino têm o mesmo pai antes de
   reordenar; se os pais forem diferentes, o drop é ignorado em
   silêncio (não é erro, é o comportamento combinado). Toda linha da
   árvore agora é `draggable`, não só a de Etapa. Lógica de
   reordenação (splice+insert, mesma semântica que já valia pra Etapa)
   validada com 5 casos equivalentes em Python (Node segue
   indisponível neste ambiente).
   Replicado em `modulos_isolados/arvore/js/arvore.js` — mas **só a
   generalização do drag-and-drop**, decisão explícita do usuário: esse
   módulo já estava desatualizado antes desta rodada em outras frentes
   sem relação (itens 2, 10, 16 — inclusive faltando campos de HTML
   como `l-setor-area`/`l-setor-peso`), e sincronizar tudo isso ficou
   de fora de propósito, pra não misturar com a mudança de hoje.
   **Teste real** (além dos casos em Python): rodado no app de verdade
   via `http://localhost` (servidor Python, `npx serve`/Node
   indisponível neste ambiente), chamando `iniciarArrastoNo`/`soltarNo`
   direto sobre a árvore real do projeto "R" — reordenar tarefas dentro
   do mesmo Pavimento, reordenar Pavimentos dentro da mesma Etapa, e
   tentar mover entre pais diferentes (bloqueado corretamente) — os 3
   passaram, com a árvore re-renderizando certo. Simulação de arrasto
   por mouse (ponteiro) não deu pra confirmar com certeza nesta sessão
   (viewport do navegador automatizado mudou de tamanho entre prints,
   desalinhando as coordenadas do clique) — vale um arrasto manual
   rápido na sua máquina pra fechar essa ponta de UX.

**Ainda em aberto**: recuperação em massa de árvores órfãs (não
necessária agora, mas segue disponível se aparecer um caso novo);
débito de sincronização do módulo isolado de árvore com os itens
2/10/16 do arquivo principal (registrado no item 5 acima, não
resolvido de propósito).

## Retomada em 2026-08-13

Três ajustes de UI, sem mudança de dado/lógica de negócio, pedidos
pelo usuário:

1. **Coluna "Localização" (Atribuição de Tarefas) repetia o nome da
   Tarefa** — `t.localizacao` (de `coletarNosFolhaDaArvore()`, core.js)
   é o breadcrumb completo até a folha, INCLUINDO o nome dela própria;
   a coluna "Tarefa" ao lado já mostra esse mesmo nome. Corrigido só na
   exibição da célula (`js/atribuicao-tarefas.js`, dentro do
   `.map()` que monta as linhas): tira o último segmento do breadcrumb
   antes de renderizar (`'—'` quando não sobra nada, ex.: Etapa agindo
   como folha direto). **`t.localizacao` em si não foi tocado** —
   continua completo pra quem usa (filtro de Localização, cálculo de
   `partes[0/1/2]` pra Etapa/Setor/Pavimento logo acima no mesmo
   arquivo).
2. **Mesma duplicação no cartão do Kanban** — a linha cinza pequena
   acima do nome da tarefa mostrava "Projeto › caminho completo (com a
   tarefa)", e o nome já aparece de novo logo abaixo
   (`kb-cartao-tarefa`). Mesma correção, só na exibição
   (`js/kanban.js`, função que monta o HTML do cartão): tira o último
   segmento; quando não sobra nada, mostra só o nome do projeto (sem
   " › " solto).
3. **Renomeado o título da aba "Kanban" (modo padrão, sem filtro de
   Executor)** de "Sob sua responsabilidade" pra "Tarefas a
   supervisionar" (`js/kanban.js`, mesma função que define
   `page-context-title`).

As três, replicadas em `modulos_isolados/atribuicao-tarefas/js/atribuicao-tarefas.js`
e `modulos_isolados/kanban/js/kanban.js` (só as mudanças desta rodada —
os módulos isolados de Atribuição/Kanban já tinham um débito de
sincronização PRÉ-EXISTENTE e sem relação, itens 5/6/7 — filtro de
árvore órfã via `obterArvoresProjetosAtivas()`, ausente nos dois
módulos isolados —, não mexido de propósito, igual ao precedente já
registrado pro módulo de árvore).

Validado: `node --check` limpo nos 4 arquivos tocados. Testado no app
de verdade (servidor Python `http.server` local, login automático como
Administrador seed com dado real de projeto já existente no
`localStorage` do navegador usado) — confirmado visualmente na aba
Atribuição de Tarefas (ex.: linha `R | DETALHAMENTO › TERREO | ... |
Vigas-Detalhamento`, sem repetir "Vigas-Detalhamento" na coluna
Localização) e na aba Kanban (título "TAREFAS A SUPERVISIONAR"; cartão
"D" seguido de "ANÁLISE" uma vez só). Criado `.claude/launch.json` na
raiz do repositório Git (fora desta pasta do app) pra servir o app
localmente em sessões futuras — não existia antes.

**Nada ficou pendente desta rodada.**

## Retomada em 2026-08-14

Dois ajustes na tela de Atribuição de Tarefas, pedidos pelo usuário:

1. **Paginação removida** — "a rolagem das páginas devem ser feitas
   sempre a partir da barra de rolagem, sem clicar no botão 'próxima'".
   `AT_ITENS_POR_PAGINA`, `atPaginaAtual` e `mudarPaginaAtribuicao()`
   foram removidos por completo; `renderizarPainelAtribuicaoTarefas()`
   não recebe mais parâmetro (`manterPagina` não existe mais — nem a
   noção de "página" pra manter) e sempre renderiza a lista filtrada
   INTEIRA (`tbody.innerHTML = lista.map(...)`, sem slice). A navegação
   passa a ser só pela barra de rolagem do `.table-wrapper`
   (`overflow-y:auto`, já existia em `estilos.css`, não precisou mudar
   nada de CSS). `renderizarPaginacaoAtribuicao(totalItens)` ficou só
   como rótulo de contagem (`<span>N tarefa(s)</span>`), sem botão
   nenhum. Consequência: a limitação antiga de "arrasto só funciona
   dentro da página atual" deixou de existir — a lista inteira já fica
   visível de uma vez.

2. **Responsável parou de "seguir" o Executor indefinidamente** — bug
   relatado pelo usuário como "quando mudo o executor, a tarefa some"
   (investigado a fundo, incluindo teste direto em dado real de
   produção via Firebase REST — não era isso; era outro comportamento
   que o usuário notou ao testar: "quando mudo o executor, parece que
   muda também o responsável"). Comportamento ANTIGO (Melhoria #18,
   §12.6, ver também linha ~3030 acima): `aplicarAtribuicaoExecutorNaTarefa()`
   considerava o Responsável "ainda seguindo" o Executor sempre que os
   dois valores COINCIDISSEM (`!tarefa.responsavel ||
   tarefa.responsavel === tarefa.executor`) — então bastava os dois
   serem iguais (por pré-preenchimento OU coincidência manual) pra toda
   troca de Executor seguinte arrastar o Responsável junto, de novo.
   Usuário pediu explicitamente: "mude a lógica, mantenha o
   pré-preenchimento mas permita alterar manualmente um deles sem
   alterar o outro". Corrigido: a condição agora é só
   `!tarefa.responsavel` (Responsável genuinely vazio) — pré-preenche
   IGUAL a antes na primeira atribuição de Executor de uma tarefa nova,
   mas a partir do momento em que o Responsável tem QUALQUER valor
   (pré-preenchido ou escolhido à mão, tanto faz), os dois campos ficam
   independentes pra sempre: trocar o Executor de novo nunca mais mexe
   no Responsável. `atribuirResponsavelTarefa()` (grava só o
   Responsável) não precisou mudar — já era independente nesse sentido;
   só o "voltar a seguir" ao limpar o campo pra vazio continua igual
   (cai de novo no Executor atual, que é o pré-preenchimento esperado).
   Testado com função pura isolada (sem tocar em dado real): 3 casos —
   pré-preenchimento inicial, troca de Executor depois (Responsável não
   muda mais), e o caso exato do bug relatado (Responsável coincidia
   com o Executor antigo por acaso, trocar o Executor não arrasta mais).

Ambos replicados em
`modulos_isolados/atribuicao-tarefas/js/atribuicao-tarefas.js`.
`node --check` limpo nos dois arquivos.

**Nada ficou pendente desta rodada.**

## Retomada em 2026-08-15 (parte 2)

Dois ajustes visuais, pedidos pelo usuário — retomando algo já
combinado numa conversa anterior que tinha se perdido (o merge de
ícones/visual foi revertido nesta sessão, ver commit `48807b8`, e
esses dois itens específicos acabaram voltando junto com o revert):

1. **Removida a barra decorativa com "semáforo" (3 bolinhas
   vermelha/amarela/verde) e o texto "Precisão Estrutural - Sistema"**,
   que simulava a barra de título de uma janela de navegador/SO por
   cima do app de verdade. Era só cosmético, sem função real —
   confirmado pelo usuário como "inutilidade". Removido de
   `index.html` (a `<div class="browser-header">` inteira, dentro de
   `.browser-window`) e de `estilos.css` (`.browser-header`, `.circle`,
   `.red`/`.yellow`/`.green`, `.browser-tab` — todas as classes que só
   existiam pra essa barra). **`.browser-window` em si foi MANTIDA**
   (não é só decoração: é quem dá o layout flex/altura cheia — sem
   ela, `.app-header` + `.app-body` perdem a estrutura de container que
   os faz preencher a tela certinho). Validado via JS no navegador
   local: `.browser-window` continua com a altura cheia esperada,
   `.app-header` virou o primeiro filho direto dela, sem erro no
   console.
2. **Botão da sub-aba "🗂️ Kanban"** (dentro do módulo Kanban, ao lado
   de "🧍 Meu Kanban" — `#kb-aba-outros`) **renomeado pra "🗂️ Tarefas a
   supervisionar"**, pra bater com o texto que já aparecia dentro da
   tela (`page-context-title`, ver "Retomada em 2026-08-13" acima) —
   antes o botão dizia uma coisa ("Kanban") e o conteúdo mostrava
   outra ("Tarefas a supervisionar"), inconsistente. **O item do menu
   lateral `#nav-kanban` ("🗂️ Kanban") NÃO mudou** — é o nome do módulo
   inteiro (que contém as 3 sub-abas: Meu Kanban / Kanban / Ranking),
   só a sub-aba interna mudou.

3. **Árvore de Projeto: níveis dentro de cada Etapa começam recolhidos
   ao abrir um projeto** — pedido do usuário ("abrir a aba projetos
   com os sub-menus recolhidos"). Confirmado com ele especificamente
   QUAL nível: a lista de Etapas (nó raiz) continua aparecendo já
   expandida de cara; só o que fica DENTRO de cada Etapa (Setor/
   Pavimento/Tarefa, em qualquer profundidade) que agora começa
   fechado. `nosRecolhidosEstado` (core.js, objeto global `{}`) guarda
   só as exceções — chave ausente = valor padrão. Antes, ausente
   significava "expandido" pra QUALQUER chave (inclusive 'raiz');
   agora os dois têm padrões DIFERENTES: 'raiz' continua "ausente =
   expandida" (sem mudança), mas qualquer outra chave ('n-'+path)
   passou a ser "ausente = recolhida". Dois pontos tocados em
   `js/arvore.js`: `renderizarNoRecursivo()` (linha calcula
   `isRecolhido` checando `nKey in nosRecolhidosEstado` antes de usar
   o valor, em vez de ler direto — só assim dá pra diferenciar "nunca
   foi tocado" de "foi explicitamente reaberto") e
   `alternarRecolhimentoNo(pathKey)` (mesma lógica de tri-estado no
   toggle, senão o primeiro clique num nó nunca tocado não invertia
   certo). Testado clicando pra expandir/recolher um nó real (projeto
   "R", Etapa "DETALHAMENTO") — primeiro clique expande e revela os
   filhos (que também já nascem recolhidos, mesma regra, em qualquer
   profundidade), segundo clique recolhe de novo.

Itens 2 e 3 replicados em `modulos_isolados/kanban/index.html` e
`modulos_isolados/arvore/js/arvore.js` respectivamente (item 1 não se
aplica a nenhum módulo isolado — nunca tiveram a barra decorativa).
`node --check` limpo em `js/arvore.js` e no módulo isolado.

**Nada ficou pendente desta rodada.**

## Retomada em 2026-08-17 — Reforma da Distribuição de Custos

Pedido grande do usuário, planejado com plan mode + 4 perguntas de
esclarecimento antes de codar (decisões registradas abaixo). Objetivo:
simplificar a Distribuição de Custos eliminando a aba "Verba para
Detalhamento" (redundante) e mudando de onde vem a verba por Pavimento.

**Decisões confirmadas pelo usuário:**
1. **Fundo Garantidor** deixou de ser uma linha concorrendo pelos
   mesmos 100% que as Etapas (Aba 2) — agora é um % GLOBAL descontado
   de CADA Etapa: `verba_etapa = %etapa × Parcela Global × (1 −
   %FundoGarantidor)`. As Etapas devem somar 100% ENTRE SI (Fundo
   Garantidor não entra nessa soma).
2. A fórmula especial da Etapa "Detalhamento" (combina Analista +
   fatia de Escritório + fatia de Supervisor,
   `calcularVerbaDetalhamentoPuro`) foi MANTIDA — o desconto do Fundo
   Garantidor é aplicado por cima do resultado dela, igual às demais
   Etapas.
3. "Verba por Pavimento" (Aba 4) passou a ser alimentada SÓ pela linha
   "Detalhamento" da Aba 2 — não mais uma cascata genérica por todas
   as Etapas (na prática só Detalhamento tem Pavimento de verdade).
4. Novo campo "% Fundo Distribuição de Lucros" (pré-setado 5%) na Aba
   4 funciona como o antigo "% Distribuição Lucros" da aba removida:
   salvo por projeto, editável, botão Salvar próprio.

**Mudanças por arquivo:**

- **`js/arvore.js`** (`visualizarNo('raiz')`, Propriedades Contratuais
  do Projeto/Árvore): 2 campos novos somente-leitura — **Detalhista**
  e **Número de Pavimentos** (ambos lidos do Cadastro de Projetos,
  mesmo padrão de Analista/Supervisor já existentes).

- **`index.html`**:
  - Aba 1 (Orçamento Global): rótulos `Valor Supervisor`→**Parcela
    para Supervisão**, `Valor Escritório`→**Parcela para Escritório**,
    `Valor Analista`→**Parcela Global para Produção** (mesmo número,
    só nome — IDs (`dc-valor-*`) intactos).
  - Aba 2: renomeada de "Distribuição de Custos Analista" pra
    **"Parcela Global para Produção"** (título da aba + texto
    introdutório). ID (`aba-distribuicao-analista`) intacto.
  - Aba 3 "Verba para Detalhamento" **REMOVIDA por completo** (tab
    selector + conteúdo).
  - Aba 4 (Verba por Pavimento): novo campo "% Fundo Distribuição de
    Lucros" (input + botão Salvar), texto introdutório atualizado
    (não fala mais em "todas as Etapas").

- **`js/distribuicao-custos.js`** (motor de cálculo — maior parte da
  mudança):
  - `calcularVerbaPorEtapa()`/`calcularVerbaPorEtapaSalvo()`: fonte do
    desconto uniforme trocou de `banco_distribuicao_lucros` (Aba 3,
    removida) pro % do Fundo Garantidor já salvo em
    `banco_distribuicao_custos_analista[projeto].fundo_garantidor.pct`.
    Campo de retorno `valorLucros`→`valorFundoGarantidor`. Resto da
    fórmula (branch especial Detalhamento, branch simples pras
    demais) igual.
  - Aba 2 (`construirLinhaDistribuicaoAnalista`,
    `carregarAbaDistribuicaoAnalista`): a coluna "Verba" de cada Etapa
    agora mostra o valor JÁ LÍQUIDO do Fundo Garantidor (antes só
    pct×Parcela bruto). Nova função
    `recalcularTabelaDistribuicaoAnalista()` substitui
    `recalcularLinhaDistribuicaoAnalista()` — recalcula a TABELA
    INTEIRA a cada input (mudar o Fundo Garantidor afeta toda Etapa,
    não só uma linha). A linha do Fundo Garantidor mostra,
    informativamente, a SOMA do que foi descontado de todas as
    Etapas — não é mais fatia própria do bolo.
    `recalcularSomaPercentuaisAnalista()` agora exclui o input do
    Fundo Garantidor da soma-que-deve-fechar-100%.
  - **Aba 3 removida por completo do JS**: `carregarAbaVerbaDetalhamento`,
    `recalcularDistribuicaoLucros`, `salvarDistribuicaoLucros`,
    `vdVerbasPorEtapaAtual` apagados. `alternarAbaDistribuicao()` sem
    `'verba-detalhamento'`.
  - `listarPavimentosDoProjeto()`/`listarSetoresDoProjeto()`: agora
    acham só a Etapa "Detalhamento" (em vez de cascatear TODAS as
    Etapas), descontam o novo "% Fundo Distribuição de Lucros"
    (`obterPctFundoLucrosPavimento()`, nova função, novo storage
    `banco_fundo_lucros_pavimento`) e cascateiam só esse valor.
    Assinatura ganhou um 3º parâmetro opcional
    (`pctFundoLucrosOverride`) pra permitir preview ao vivo sem
    precisar salvar primeiro. Cada Pavimento retornado ganhou o campo
    `valorFundoLucros` (fatia do fundo que coube a ele).
  - `calcularListaPavimentosComVerba(Salva)`: `verbaLiquida` agora é a
    soma da Verba de todos os Pavimentos (antes era soma de TODAS as
    Etapas) — mesma assinatura/retorno de resto, não quebra quem
    consome (`atribuicao-tarefas.js`, `painel-progresso.js`).
  - `carregarAbaVerbaPavimento()` + nova `renderizarTabelasVerbaPavimento()`:
    o carregamento inicial lê o % salvo pro input; a função nova
    recalcula só as TABELAS (nunca o próprio input, senão perderia o
    que a pessoa está digitando) — chamada tanto no `oninput` do novo
    campo quanto depois de editar Área/Peso de Setor/Pavimento (essas
    duas últimas trocaram de `carregarAbaVerbaPavimento()` pra
    `renderizarTabelasVerbaPavimento()` por esse motivo). Nova
    `salvarFundoLucrosPavimento()`.
  - **Aba 5 (Verba por Tarefa)**: fórmula já estava certa (não mudou),
    mas achei um **bug pré-existente** validando: `recalcularGrupoVerbaPorTarefa()`
    achava o grupo (Pavimento) fatiando `dataset.caminho` em 3
    segmentos fixos (`.split('-').slice(0,3)`), supondo Pavimento
    sempre a 3 níveis de profundidade (Etapa>Setor>Pavimento) — quebra
    quando Pavimento está direto sob a Etapa (2 níveis, como o
    projeto piloto "AP PRAIA", sem Setor), porque o "grupo" calculado
    não batia com o `data-grupo` real gravado no `<tr>`, deixando
    Valor/Horas Máximas/Subtotal em branco silenciosamente. Corrigido
    lendo `inputOrigem.closest('tr').dataset.grupo` direto (já
    existia gravado ali) em vez de re-derivar por slicing — funciona
    em qualquer profundidade agora.

- **`js/distribuicao-lucro.js`** (Distribuição de Lucro/Estagiários —
  dependência descoberta durante a investigação, não fazia parte do
  pedido original): `calcularValorLucroPorTarefaDoProjeto()` usava o
  antigo `valorLucros` por Etapa (Aba 3, removida) como "bolo" pra
  ratear entre Estagiários — redirecionado pra usar
  `p.valorFundoLucros` (novo campo por Pavimento, Aba 4) direto,
  eliminando a necessidade de recascatear uma lista fake de
  "verbasLucrosPorEtapa".

**IMPORTANTE — dado já configurado precisa ser revisado**: o projeto
piloto "AP PRAIA (SAVOIA) - SETOR B" (e qualquer outro projeto já
configurado antes desta reforma) tinha as % das Etapas somando 100%
JUNTO com o Fundo Garantidor (regra antiga). Com a regra nova, as
Etapas sozinhas devem somar 100% — no piloto, hoje somam 85% (15% que
"sobravam" pro Fundo Garantidor). Isso não quebra nada tecnicamente
(o sistema só mostra o aviso de "não fecha 100%"), mas os NÚMEROS
mudaram de verdade pra qualquer projeto já configurado — vale revisar
com o usuário se os percentuais salvos continuam representando a
intenção original, ou se precisam ser reajustados pra somar 100%
sob a regra nova.

**Módulos isolados**: `modulos_isolados/distribuicao-custos/js/distribuicao-custos.js`
e `modulos_isolados/atribuicao-tarefas/js/distribuicao-custos.js` NÃO
foram tocados — já tinham drift pré-existente (910/905 linhas vs 1149
do arquivo principal antes desta rodada, não eram cópias exatas),
alto risco de aplicar esse diff grande numa base já diferente. Ficam
pendentes, mesmo precedente já registrado nesta sessão pra drift
pré-existente de módulos isolados.

Testado no navegador local com o projeto piloto "AP PRAIA (SAVOIA) -
SETOR B": Aba 2 mostra Verba por Etapa já líquida (conferido o cálculo
manual da Etapa Detalhamento — bateu exato), Aba 3 sumiu do menu
(4 abas agora, não mais 5), Aba 4 mostra os 21 Pavimentos da Etapa
Detalhamento com o novo campo 5%, conferência ✅ bate exato, Aba 5
com o bug corrigido mostra Valor/Horas Máximas/Subtotal corretos e
conferência ✅ bate com a aba anterior, Propriedades Contratuais
mostra Detalhista e Número de Pavimentos corretos, e Atribuição de
Tarefas (Pontos Máximo) continua calculando certo pra tarefas dentro
de Detalhamento. `node --check` limpo nos 3 arquivos JS tocados.

## Retomada em 2026-08-17 (parte 2) — Item 4 "Coparticipações no Detalhamento"

Pedido do usuário, também planejado com simulação numérica ANTES de
codar (pediu explicitamente 2 vezes — a primeira fórmula que ele
descreveu dava um resultado sem sentido dimensional, um % em vez de
R$; ele mesmo percebeu e reformulou). Motivação: em alguns projetos
Escritório/Supervisor coparticipam de uma parcela do custo do
Detalhamento, em outros não — precisa ser configurável POR PROJETO,
não mais uma % fixa que valia igual pra todos (como era antes, via
`%Supervisor`/`%Escritório` do item 3, usados na fórmula especial de
`calcularVerbaDetalhamentoPuro`).

**Fórmula final confirmada** (2ª tentativa, a 1ª tinha um passo
faltando): `Valor Coparticipação = (Verba Bruta da Etapa Detalhamento
× % Coparticipação) ÷ % Analista (item 3)`. Simulação de validação
(AP Praia, 60% Escritório / 10% Supervisão, batida à mão antes de
implementar): Verba Detalhamento bruta R$ 29.791,89 (35% × Parcela
Global R$ 85.119,68) → Coparticipação Escritório R$ 44.687,83,
Coparticipação Supervisão R$ 7.447,97 → Verba Total do Detalhamento
R$ 81.927,69 → líquida do Fundo Garantidor (15%) R$ 69.638,54.
Conferido depois no navegador que a implementação bate exatamente com
essa simulação.

**Regra de trava confirmada pelo usuário**: os 2 campos novos NÃO
herdam do `%Supervisor`/`%Escritório` do item 3 (são independentes) —
mas ficam DESABILITADOS (forçados a 0%) sempre que o % geral
correspondente do item 3 for 0%, já que "necessariamente não haverá
coparticipação" nesse caso. Mesma regra pros dois (Escritório e
Supervisão), simétrica.

**Mudanças:**
- **`index.html`**: novo "4. Coparticipações no Detalhamento" na aba
  Orçamento Global, mesma grade de 3 colunas do item 3 (coluna do
  Analista fica vazia — ele não coparticipa, é a base do cálculo).
  Mostrado ao usuário como mockup HTML antes de implementar (mesmo
  padrão desta sessão: simular/mostrar antes de codar mudança
  financeira).
- **`estilos.css`**: espaçamento mais compacto só dentro de
  `#conteudo-orcamento-global` (`.form-section`/`.form-grid`, via
  seletor com ID — não mexe no `.form-section` genérico usado em
  outras telas), pedido do usuário pra os 4 itens caberem melhor numa
  tela só. Reduz a altura útil em ~60px medido no navegador; não
  elimina rolagem em qualquer tamanho de janela (o painel já tinha
  `overflow-y:auto` como respaldo antes disso, continua tendo).
- **`js/distribuicao-custos.js`**:
  - `carregarProjetoDistribuicao()`: carrega os 2 novos %'s (default
    '0', NUNCA herda do item 3, mesmo quando o projeto não tem nada
    salvo ainda).
  - `recalcularDistribuicaoCustos()`: trava/destrava os 2 campos ao
    vivo conforme `%Supervisor`/`%Escritório` mudam (força valor '0'
    ao travar — defesa em profundidade, testado forçando valor via JS
    com o campo travado, confirmado que volta pra 0). Novo cálculo do
    "Valor Coparticipação" (preview, cross-referencia a % salva da
    Etapa Detalhamento na aba 2 via nova `obterPctEtapaDetalhamentoSalvo()`
    — mostra R$ 0,00 se o projeto ainda não tem essa % salva, não é
    erro).
  - `salvarDistribuicaoCustos()`: persiste os 2 novos campos em
    `banco_distribuicao_custos[projeto]` (`pct_coparticipacao_supervisor`/
    `pct_coparticipacao_escritorio`).
  - `calcularVerbaDetalhamentoPuro()`: assinatura simplificada — não
    recebe mais `valorContrato`/`pctImpostos`/`pctLucros`/`avisoDetalhamento`
    (vestigiais, sempre chamados com valores fixos/0 há tempos); troca
    `pctSupervisor`/`pctEscritorio` (item 3) pelos 2 novos
    `pctCoparticipacaoSupervisor`/`pctCoparticipacaoEscritorio` (item
    4) — resto da fórmula (proporção contra `%Analista`) igual.
  - `calcularVerbaPorEtapa()` (ao vivo, lê da Aba 1)/
    `calcularVerbaPorEtapaSalvo()` (lê de `banco_distribuicao_custos`
    salvo) e `recalcularTabelaDistribuicaoAnalista()` (Aba 2, também ao
    vivo): as 3 chamadas pra `calcularVerbaDetalhamentoPuro()`
    atualizadas pra nova assinatura/fonte dos %'s.

Testado no navegador local (AP Praia): campo de Supervisão trava
corretamente quando `%Supervisor`=0% (valor salvo real do projeto) e
destrava ao mudar pra um valor não-zero, sem herdar; valores
calculados batem exatamente com a simulação prévia em toda a cadeia
(item 4 → Aba 2 "Detalhamento" → , por consequência, Aba 4/5 que já
dependiam da mesma verba). `node --check` limpo.

**Mesmo aviso da rodada anterior**: qualquer projeto que já tinha
coparticipação configurada pela fórmula ANTIGA (via `%Supervisor`/
`%Escritório` do item 3) precisa ter os 2 novos campos preenchidos de
propósito — não migra sozinho, os valores do item 3 nunca alimentaram
os novos campos automaticamente.

## Correção em 2026-08-17 (parte 3) — Coparticipação NÃO soma na Verba da Etapa

O usuário corrigiu o próprio pedido da parte 2 (acima) logo depois de
ver o resultado: a linha "Detalhamento" na Aba 2 ("Parcela Global para
Produção") estava somando a Coparticipação de Escritório/Supervisor
na Verba da Etapa (via `calcularVerbaDetalhamentoPuro`, que ainda
tinha o `ehDetalhamento` como caso especial) — ele disse que isso está
ERRADO: a Verba da Etapa "Detalhamento" deve ser **sempre** `%etapa ×
Parcela Global`, igual a qualquer outra Etapa, **sem** somar
coparticipação "neste ponto".

**Corrigido**: removido o `if (ehDetalhamento) {...}` de
`calcularVerbaPorEtapa()`, `calcularVerbaPorEtapaSalvo()` e
`recalcularTabelaDistribuicaoAnalista()` — as 3 agora tratam
Detalhamento igual a qualquer Etapa (`verbaBruta = pctEtapa/100 ×
valorAnalistaTotal`, sem exceção). `calcularVerbaDetalhamentoPuro()`
ficou sem uso NESSAS 3 funções (continua existindo — é só a fórmula
pura, não faz mal ficar parada) — o cálculo de "Valor Coparticipação"
que aparece no Item 4 (preview) é feito por conta própria, direto em
`recalcularDistribuicaoCustos()`, sem passar por essa função
compartilhada.

Consequência importante: **Aba 4 (Verba por Pavimento) e Aba 5 (Verba
por Tarefa) voltam a receber a verba SIMPLES do Detalhamento** (sem
coparticipação somada) — diferente do que a parte 2 registrou acima
("Aba 4/5 que já dependiam da mesma verba [com coparticipação]").

**EM ABERTO — perguntei e o usuário disse "vamos decidir isso
depois"**: a Coparticipação (Item 4) hoje é só um valor
INFORMATIVO/preview na Aba 1 — não entra em NENHUM outro cálculo
(não cascateia pra Pavimento, não afeta Atribuição de Tarefas, nada).
Se um dia ela precisar efetivamente compor a verba de algum lugar
(ex.: somada na Verba por Pavimento, Aba 4, parecido com o novo %
Fundo Distribuição de Lucros), isso ainda não foi implementado —
`calcularVerbaDetalhamentoPuro()` já existe pronta pra ser reutilizada
nesse momento, se fizer sentido.

Testado no navegador (AP Praia, 60% coparticipação Escritório): Aba 2
"Detalhamento" volta a mostrar R$ 25.323,10 (35% × Parcela Global,
líquido do Fundo Garantidor — sem coparticipação), e o Item 4 continua
mostrando R$ 44.687,83 de Coparticipação Escritório em paralelo, sem
afetar a Aba 2. `node --check` limpo.

## Retomada em 2026-08-17 (parte 4) — Aba 2 discretizada em 3 colunas

Pedido do usuário logo em seguida: a coluna única "Verba" da Aba 2
(que já mostrava direto a Verba LÍQUIDA, pós-desconto) virou 3
colunas: **Verba** (bruta, antes do desconto), **Parcela para o
Fundo** (o que foi descontado) e **Verba Líquida** (depois do
desconto) — pra deixar o cálculo transparente, não só o resultado
final.

- **`index.html`**: cabeçalho da tabela (`#conteudo-distribuicao-analista`)
  ganhou as 2 colunas novas; texto introdutório reescrito (não fala
  mais em "Verba já sai descontada", agora descreve as 3 colunas).
- **`js/distribuicao-custos.js`**:
  - `construirLinhaDistribuicaoAnalista()`: cada `<tr>` de Etapa agora
    tem 3 `<td>` com classes `.dca-verba-bruta`/`.dca-verba-fundo`/
    `.dca-verba-liquida` (era só `.dca-verba`, removida). Na linha do
    **Fundo Garantidor** especificamente, só `.dca-verba-fundo` é
    preenchida (mostra a SOMA descontada de todas as Etapas, igual já
    fazia) — as outras duas mostram "—", já que "Verba bruta"/"líquida"
    não fazem sentido conceitual pra essa linha (ela não é uma Etapa).
  - `recalcularTabelaDistribuicaoAnalista()`: preenche as 3 células de
    cada Etapa (`verbaBruta`, `valorFundo`, `verbaLiquida` — já
    calculados antes, só que agora escritos em 3 lugares em vez de 1).

Testado no navegador (AP Praia): linha "Detalhamento" mostra Verba
R$ 29.791,89 / Parcela para o Fundo R$ 4.468,78 / Verba Líquida
R$ 25.323,10 (bate: 29.791,89 − 4.468,78 = 25.323,11, arredondamento);
linha "Fundo Garantidor" mostra "—" / R$ 10.852,76 (soma de todas as
Etapas) / "—". `node --check` limpo.

## Retomada em 2026-08-17 (parte 5) — Linha de totalização + linhas mais compactas

Pedido do usuário logo em seguida: uma linha de totalização abaixo
das colunas da Aba 2 (Parcela Global para Produção), e diminuir o
espaçamento entre linhas das Etapas pra caber tudo numa tela.

- **`index.html`**: `<table>` da Aba 2 ganhou a classe `.tabela-compacta`
  (já existia, usada em Aba 4/5 — padding 2px 8px, `line-height:1.1`,
  em vez do padding padrão bem maior) — reduz a altura de cada linha
  de Etapa sem precisar de CSS novo. Novo `<tfoot>` com uma linha
  "Total": soma de %, Verba, Parcela para o Fundo e Verba Líquida
  (célula de Responsável fica vazia — não faz sentido somar nomes).
- **`js/distribuicao-custos.js`**: `recalcularTabelaDistribuicaoAnalista()`
  acumula os 4 totais durante o mesmo loop que já calculava cada
  linha (sem duplicar trabalho) — soma só as ETAPAS (Fundo Garantidor
  não é uma Etapa, não entra na soma de %; o total de "Parcela para o
  Fundo" acaba batendo com o valor já mostrado na própria linha do
  Fundo Garantidor, mostrado de novo aqui só por completude da
  coluna).

Testado no navegador (AP Praia, 5 Etapas): Total % = 85,00% (soma
10+15+24,5+0,5+35), Total Verba = R$ 72.351,73 (85% × Parcela
Global), Total Parcela para o Fundo = R$ 10.852,76 (bate com a linha
do Fundo Garantidor), Total Verba Líquida = R$ 61.498,97 (diferença
das duas). `node --check` limpo.

## Retomada em 2026-08-17 (parte 6) — Fundo Garantidor volta a ser fatia do bolo (reversão)

O usuário reconsiderou a decisão #1 da reforma original (parte 2,
acima — "Fundo Garantidor: desconto global sobre cada etapa"),
chamando explicitamente de "falha minha": **Fundo Garantidor volta a
ser uma fatia do MESMO bolo de 100% que as Etapas** (como era ANTES
de toda essa rodada de mudanças), só que agora o % dele não é mais
digitado à mão — é **automático**: `100% − soma das % das Etapas`.
Consequência direta: a discretização em 3 colunas da parte 4/5
(Verba/Parcela para o Fundo/Verba Líquida) deixou de fazer sentido —
não existe mais desconto nenhum aplicado em cima da Verba de cada
Etapa, então voltou a ser 1 coluna só. Pedido complementar: a linha
de totalização (parte 5) soma só as Etapas, não o Fundo Garantidor.

**Mudanças:**
- **`index.html`**: tabela da Aba 2 voltou a 4 colunas (Etapas / % /
  Verba / Responsável — igual à ORIGINAL, antes de toda a parte 4).
  `<tfoot>` simplificado: só "Total (Etapas)" com % e Verba.
- **`js/distribuicao-custos.js`**:
  - `construirLinhaDistribuicaoAnalista()`: a linha do Fundo
    Garantidor não tem mais `<input>` de % — vira um `<span
    id="dca-pct-fundo-garantidor">` só-leitura, preenchido pelo
    recalc. Etapas continuam com `<input>` normal.
  - `recalcularTabelaDistribuicaoAnalista()`: reescrita — soma as %
    das Etapas ao vivo, `pctFundoGarantidor = 100 − totalPct` (pode
    ficar NEGATIVO se as Etapas passarem de 100% sozinhas — tratado
    como alerta visível, não erro silencioso), Verba de cada Etapa
    volta a ser simples (`%etapa × Parcela Global`, sem desconto).
    Alerta muda de "não fecha 100%" pra sempre informativo (mostra o
    % que sobrou pro Fundo) exceto quando Etapas > 100%.
  - `calcularVerbaPorEtapa()`/`calcularVerbaPorEtapaSalvo()`: removido
    o desconto de Fundo Garantidor por completo — `verbaBruta` e
    `verbaLiquida` agora são sempre o MESMO valor (campo duplicado
    mantido só por compatibilidade com quem lê `.verbaLiquida`,
    principalmente a cascata da Aba 4/Detalhamento).
  - `salvarDistribuicaoAnalista()`: só salva as Etapas agora — não
    tem mais `<input>` de Fundo Garantidor pra ler, e o % dele nunca
    precisa ser persistido (sempre recalculado a partir das Etapas
    salvas, em qualquer lugar que precise).

Testado no navegador (AP Praia): Etapas somam 85% → Fundo Garantidor
automático mostra 15,00% / R$ 12.767,95 de Verba; alerta verde "✅
Etapas somam 85,00% — Fundo Garantidor fica com 15,00%."; Total
(Etapas) = 85,00% / R$ 72.351,73. Testado também o caso de alerta:
forçando Etapas pra somar 140,5% → Fundo Garantidor mostra -40,50% e
alerta amarelo pedindo pra ajustar. `node --check` limpo.

**Nota**: o storage `banco_distribuicao_custos_analista[projeto].fundo_garantidor`
(usado nas reformas anteriores desta sessão) fica órfão pra projetos
que já tinham algo salvo ali — inofensivo, simplesmente não é mais
lido em lugar nenhum (o % agora é sempre recalculado a partir das
Etapas).

## Retomada em 2026-08-17 (parte 7) — Cores da tabela, linha "Total Geral" e trava dos 100%

Pedido do usuário: usar o mesmo formato de célula das Etapas pras
linhas do Fundo Garantidor (fundo verde) e Total (Etapas) (fundo
azul), acrescentar uma linha "Total Geral" (soma de Total Etapas +
Fundo Garantidor) e não permitir que a soma das Etapas ultrapasse
100% (bloqueio de verdade, não só aviso).

**Mudanças:**
- **`index.html`** (Aba 2, `#conteudo-distribuicao-analista`):
  - `<tfoot>` "Total (Etapas)" trocou de fundo (era verde,
    `#f0fdf4`) pra azul (`#eff6ff`, texto `#1e40af`) — reserva o
    verde só pro Fundo Garantidor.
  - Nova segunda linha no `<tfoot>`, "Total Geral"
    (`#dca-total-geral-pct`/`#dca-total-geral-verba`), fundo cinza
    (`#e2e8f0`).
  - Botão "Salvar Distribuição por Etapa" ganhou `id="dca-btn-salvar"`
    pra poder ser desabilitado via JS.
- **`js/distribuicao-custos.js`**:
  - `construirLinhaDistribuicaoAnalista()`: linha do Fundo Garantidor
    trocou de amarelo (`#fffbeb`) pra verde (`#f0fdf4`) — mesma
    estrutura de célula das Etapas, só muda o preenchimento.
  - `recalcularTabelaDistribuicaoAnalista()`: agora também calcula
    Total Geral (`totalPct + pctFundoGarantidor` / `totalVerba +
    verbaFundoGarantidor` — por construção sempre fecha em 100% /
    Parcela Global inteira, é uma conferência visual) e
    habilita/desabilita `#dca-btn-salvar` conforme `totalPct > 100%`.
    Alerta de "Etapas > 100%" mudou de aviso amarelo pra bloqueio
    vermelho ("🚫 ... não é permitido ultrapassar 100%").
  - `salvarDistribuicaoAnalista()`: trava real adicionada — recalcula
    a soma das % das Etapas e recusa salvar (alert + return) se
    passar de 100%, mesmo se alguém chamar a função ignorando o botão
    desabilitado.

Testado no navegador (AP Praia): caso normal (Etapas somando 85%) —
Fundo Garantidor verde mostrando 15,00%/R$ 12.767,95, Total (Etapas)
azul 85,00%/R$ 72.351,73, Total Geral cinza 100,00%/R$ 85.119,68,
botão Salvar habilitado. Forçando uma Etapa pra somar 110% no total —
botão Salvar desabilitado, alerta vermelho de bloqueio, e chamando
`salvarDistribuicaoAnalista()` diretamente (bypassando o botão) o
`alert()` de bloqueio dispara e nada é salvo. Voltando a 85% o estado
normal retorna. `node --check` limpo.

## Retomada em 2026-08-17 (parte 8) — Altura das linhas, % com 2 casas nos campos editáveis, bordas nos campos só-leitura

Pedido do usuário: usar sempre a mesma altura de linha na Distribuição
de Custos; formatar também os campos PERCENTUAIS EDITÁVEIS com 2 casas
decimais (não só os já-calculados); e colocar borda nos campos
não-editáveis do Fundo Garantidor e das linhas de Total (pra parecerem
"campo" como os demais, mesmo sem poder digitar).

**Mudanças:**
- **`estilos.css`**:
  - Inputs numéricos dentro de `#panel-distribuicao-custos
    .tabela-compacta` ganharam padding compacto (2px 6px, antes usavam
    o padding global de 8px 12px, bem maior que o das células de
    texto — causa raiz da diferença de altura entre a linha de uma
    Etapa, com `<input>`, e a do Fundo Garantidor/Totais, só texto).
  - Nova classe `.campo-percentual` (+ `.sufixo-pct`): envolve o
    `<input>` percentual com um "%" decorativo posicionado à direita
    (o valor do input continua um número puro).
  - Nova classe `.campo-somente-leitura-borda`: borda cinza + cantos
    arredondados, usada nas células não-editáveis do Fundo Garantidor
    e das linhas de Total.
  - Pra fechar de vez a diferença de altura (o "chrome" próprio de um
    `<input>` — padding + borda dele mesmo — ainda deixava a linha da
    Etapa ~6px mais alta mesmo com o padding do input reduzido): altura
    fixa de 28px em toda `<tr>`/`<td>` da tabela da Aba 2 (`#conteudo-distribuicao-analista
    table.tabela-compacta`), com `vertical-align:middle`.
- **`js/distribuicao-custos.js`**:
  - Novo helper `formatarCampoPercentual(el)` — `el.value =
    (parseFloat(el.value)||0).toFixed(2)` — chamado no `onblur` de
    TODOS os campos percentuais editáveis da Distribuição de Custos
    (Aba 1: Impostos/Analista/Supervisor/Escritório/Coparticipação
    Supervisão/Escritório; Aba 2: % de cada Etapa; Aba 4: % Fundo
    Distribuição de Lucros) e também logo ao CARREGAR o projeto (não
    só depois de um blur manual), inclusive quando o campo de
    coparticipação é travado em '0' (trava de Item 4 — antes ficava
    "0" cru, agora "0.00").
  - `construirLinhaDistribuicaoAnalista()`: removida a nota
    "(automático: 100% − soma das Etapas)" do rótulo da linha do Fundo
    Garantidor — já explicada no aviso azul acima da tabela, e o texto
    extra quebrava em 2 linhas na coluna estreita, sendo a causa real
    (junto com o padding do input) da diferença de altura da linha.
  - Célula `#dca-pct-fundo-garantidor` e a Verba do Fundo Garantidor
    ganharam `campo-somente-leitura-borda`; mesma classe nas 4 células
    de valor das linhas Total (Etapas) e Total Geral.

Testado no navegador (AP Praia): as 6 linhas do corpo da tabela
(5 Etapas + Fundo Garantidor) e as 2 do rodapé (Total Etapas/Total
Geral) medem exatamente 28,0px cada, via `getBoundingClientRect()`.
Campos percentuais mostrando 2 casas decimais em todos os pontos
verificados (Aba 1, Aba 2, Aba 4, inclusive campo de coparticipação
travado em "0.00"). Digitando um valor tosco ("99.999") e saindo do
campo (blur) arredonda pra "100.00" corretamente. Bordas visíveis
(`1px solid rgb(203, 213, 225)`, `border-radius:4px`) confirmadas via
`getComputedStyle()` no Fundo Garantidor e nos 4 campos de Total.
`node --check` limpo.

**Nota**: a diferença de altura tinha DUAS causas somadas — o padding
grande do `<input>` global e uma nota de texto que quebrava linha só
na linha do Fundo Garantidor. Resolver só uma das duas não bastava;
por isso a solução final usa altura fixa de linha (mais robusta a
qualquer causa futura de descompasso) em vez de só ajustar paddings.

## Retomada em 2026-08-17 (parte 9) — Borda só nos campos de %, igual ao input das Etapas

Pedido do usuário: a borda dos campos não-editáveis (Fundo Garantidor
e Totais) deve usar o MESMO tipo/tamanho de borda que o `<input>` de %
das Etapas — e os campos de VALOR (Verba) desta aba não devem ter
borda nenhuma (só os de %).

**Mudanças:**
- **`estilos.css`**: `.campo-somente-leitura-borda` ajustada de
  `border-radius:4px` pra `3px`, igual ao raio que o `<input>` das
  Etapas já usa (regra logo acima, adicionada na parte anterior).
- **`index.html`**: removida a classe `campo-somente-leitura-borda`
  de `#dca-total-verba` e `#dca-total-geral-verba` (ficam sem borda
  agora — só os `#dca-total-pct`/`#dca-total-geral-pct` mantêm).
- **`js/distribuicao-custos.js`**: `construirLinhaDistribuicaoAnalista()`
  — removida a borda da Verba do Fundo Garantidor (`.dca-verba` volta
  a ser só essa classe, sem a variante com borda); a % do Fundo
  Garantidor (`#dca-pct-fundo-garantidor`) continua com borda.

Testado no navegador (AP Praia, via `getComputedStyle()`): borda do
`<input>` de % de uma Etapa = `1px solid rgb(203,213,225)` / raio 3px;
mesma borda exata nos 3 campos de % (Fundo Garantidor, Total Etapas,
Total Geral); os 3 campos de Verba correspondentes (Fundo Garantidor,
Total Etapas, Total Geral) sem nenhuma borda. Alturas de linha
continuam uniformes (28px em todas as 6 linhas do corpo da tabela).
`node --check` limpo.

## Retomada em 2026-08-17 (parte 10) — Coparticipação do Detalhamento visível na Aba 2

Pedido do usuário: na Aba "Parcela Global para Produção", a Etapa
Detalhamento precisa mostrar também a coparticipação de Escritório/
Supervisão (Item 4, Aba 1) — não só ficar escondida lá. Renomear a
linha da Etapa pra "Verba Detalhamento - Analista" e acrescentar 2
linhas logo abaixo: "Coparticipação Supervisor" e "Coparticipação
Escritório", com os mesmos critérios (fórmula) já estabelecidos e
testados no Item 4.

**Mudanças (`js/distribuicao-custos.js`):**
- `construirLinhaDistribuicaoAnalista()`: rótulo da linha da Etapa
  Detalhamento passa a ser "Verba Detalhamento - Analista" (só o texto
  exibido — `data-etapa` continua com o nome real da Etapa, usado pra
  salvar).
- Nova `construirLinhasCoparticipacaoDetalhamento()`: gera as 2 linhas
  só-leitura ("↳ Coparticipação Supervisor"/"↳ Coparticipação
  Escritório"), mesmo padrão visual de borda só no % (igual à parte
  anterior) — fundo levemente acinzentado (`#f8fafc`) pra sinalizar
  que são um detalhe da linha de cima.
- `carregarAbaDistribuicaoAnalista()`: ao montar as linhas das Etapas,
  insere as 2 novas logo depois da Etapa Detalhamento (não no fim da
  tabela) — funciona não importa a posição dela na lista.
- `recalcularTabelaDistribuicaoAnalista()`: recalcula as 2 linhas
  sempre que roda, usando `calcularVerbaDetalhamentoPuro()` (a mesma
  fórmula do Item 4) com o % de Detalhamento AO VIVO desta própria
  tabela (não o salvo) — editar o % da Etapa Detalhamento atualiza a
  coparticipação em tempo real. As 2 linhas NUNCA entram em
  `totalPct`/`totalVerba` (Total Etapas/Total Geral) — o dinheiro
  delas vem de um bolo diferente (Escritório/Supervisor), não do
  Analista.

Testado no navegador (AP Praia, com 10% coparticipação Supervisão e
60% Escritório, mesmo exemplo já validado antes na Aba 1): linha
renomeada corretamente; as 2 novas linhas aparecem logo após ela, na
ordem certa; valores batem exatamente com o preview da Aba 1 (R$
7.447,97 Supervisão, R$ 44.687,83 Escritório); editando o % da Etapa
Detalhamento de 35% pra 50% ao vivo, os valores das 2 linhas escalam
proporcionalmente (R$ 10.639,96/R$ 63.839,76) — Total (Etapas) sobe
de 85% pra 100% normalmente (o % da própria Etapa Detalhamento conta
no total, só as 2 linhas de coparticipação é que ficam de fora dessa
soma); voltando o % pra 35% tudo volta ao normal. Alturas de linha
continuam uniformes (28px, agora em 8 linhas); bordas seguem o mesmo
padrão (só no %). `node --check` limpo.

## Retomada em 2026-08-17 (parte 11) — Verba por Tarefa em cartões lado a lado, submenus recolhidos

Pedido do usuário: na Aba "Verba por Tarefa", (1) apresentar os
Pavimentos com as Tarefas recolhidas por padrão, e (2) redividir a
tela em 2 ou 3 Pavimentos lado a lado, redistribuindo o espaço
igualmente entre eles — em vez de uma única tabela empilhada com um
Pavimento embaixo do outro. Pedido à parte, na Aba "Verba por
Pavimento": conferir que o "% Fundo Distribuição de Lucros" mostra 2
casas decimais — já estava correto desde a parte 9
(`formatarCampoPercentual`, chamado tanto no `onblur` quanto ao
carregar o projeto); só confirmado de novo agora, nenhuma mudança
necessária.

**Mudanças:**
- **`index.html`**: `#conteudo-verba-por-tarefa` trocou a única
  `<table>` por um `<div id="vt-grid-pavimentos" class="vt-grid">`
  (grade responsiva) dentro de um wrapper com scroll vertical
  (`max-height:600px`).
- **`estilos.css`**: novas classes `.vt-grid` (CSS Grid,
  `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))` — 2
  ou 3 colunas conforme a largura disponível, espaço sempre
  redistribuído igualmente via `1fr`) e `.vt-card` (cada Pavimento
  vira um cartão com borda própria e cabeçalho clicável
  `.vt-card-header`).
- **`js/distribuicao-custos.js`**:
  - `carregarAbaVerbaPorTarefa()`: reescrita — cada Pavimento agora
    gera seu próprio `<div class="vt-card">` com uma mini-tabela
    própria (thead + tbody com as Tarefas, subtotal e conferência),
    em vez de linhas dentro de uma tabela única. Cabeçalho do
    Pavimento saiu de dentro da tabela (era uma `<tr>` colspan) pra
    virar o cabeçalho do cartão (`.vt-card-header`, fora da tabela).
  - `vtGruposRecolhidos`: convenção invertida — `undefined` (Pavimento
    nunca clicado) agora conta como RECOLHIDO (padrão pedido pelo
    usuário); só um clique explícito grava `false` (expandido).
    `alternarGrupoVerbaPorTarefa()` ajustada pra alternar
    corretamente nessa nova convenção.
  - `recalcularGrupoVerbaPorTarefa()`: seletores trocados de
    `#vt-tabela-body` pra `#vt-grid-pavimentos` (novo container) —
    resto da lógica (cálculo de Valor/Horas Máximas/Subtotal/
    conferência) inalterado.
  - Subtotal continua SEMPRE visível mesmo com o cartão recolhido
    (mesmo comportamento de antes) — só as linhas de Tarefa e a linha
    de conferência somem.

Testado no navegador (AP Praia, recarregando a página do zero pra
garantir estado limpo, sem nenhum resquício de teste manual anterior):
os 21 Pavimentos com Tarefa carregam TODOS recolhidos (►) por padrão;
clicar no cabeçalho expande (▼) mostrando a mini-tabela de Tarefas,
Subtotal e conferência; em 1500px de largura a grade mostra 3 colunas
lado a lado (`grid-template-columns` com 3 valores), redistribuindo o
espaço igualmente. `node --check` limpo.

**Nota**: durante o teste apareceu uma falsa pendência — reaproveitar
o mesmo estado de `vtGruposRecolhidos` entre vários comandos manuais
de teste (clicar, resetar, reclicar) no console do navegador confundiu
a leitura por um tempo; um recarregamento limpo da página confirmou
que o comportamento padrão real (o que o usuário realmente vê ao abrir
a aba) sempre foi o correto — não houve bug no código, só ruído do
processo de teste manual.

## Retomada em 2026-08-17 (parte 12) — Reconsideração: Tarefas expandidas por padrão + cartões com cara de Kanban

Pedido do usuário, depois de ver a parte 11 funcionando: gostou da
grade de 3 colunas, mas não quer mais as Tarefas recolhidas por
padrão — prefere já aparecerem abertas. Pediu também bordas nos
cartões de Pavimento "como se fossem cartões do Kanban", pra melhorar
a leitura visual.

**Mudanças (`js/distribuicao-custos.js`):**
- `carregarAbaVerbaPorTarefa()`: convenção de `vtGruposRecolhidos`
  invertida de novo — agora `undefined` (nunca clicado) = EXPANDIDO
  (padrão); só um `true` explícito (clique pra fechar) conta como
  recolhido.
- `alternarGrupoVerbaPorTarefa()`: ajustada pra alternar corretamente
  nessa convenção (espelho exato da parte 11, só invertida).

**Mudanças (`estilos.css`):**
- `.vt-card`: raio de borda ajustado de 8px pra 6px e adicionado
  `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` — mesmos valores exatos de
  `.kb-cartao` (cartão de tarefa do Kanban), pra ficar visualmente
  igual, como pedido.

Testado no navegador (AP Praia, recarregando do zero): os 21
Pavimentos carregam todos expandidos (▼) por padrão, mostrando a
mini-tabela de Tarefas de cada um direto; cartões com borda + sombra
suave idêntica à do Kanban (`border: 1px solid #e2e8f0`, `box-shadow:
0 1px 3px rgba(0,0,0,0.08)`, `border-radius: 6px`, confirmado via
`getComputedStyle()`). Grade de 3 colunas mantida. `node --check`
limpo.

## Retomada em 2026-08-17 (parte 13) — Renomear aba, larguras de coluna, valor do Fundo de Lucros, alinhamentos

Lote de ajustes visuais pedido pelo usuário: renomear a aba "Parcela
Global para Produção", estreitar a coluna "Etapas" (mantendo as
demais do mesmo tamanho), estreitar a coluna "Pavimento" na Aba
"Verba por Pavimento" (idem), mostrar o valor em R$ do Fundo de
Lucros ao lado do %, com borda igual à do campo de %, centralizar
"Peso de Esforço" e alinhar "Área Equivalente"/"Valor da Verba" pelo
final do número.

**Mudanças (`index.html`):**
- 3 ocorrências visíveis de "Parcela Global para Produção" → "Verba
  Global para Produção" (nome da aba, rótulo do campo na Aba 1, texto
  do aviso azul na Aba 2). IDs internos (`aba-distribuicao-analista`,
  `dca-valor-analista-ref` etc.) e comentários no JS continuam com o
  nome antigo de propósito — são só referência interna, não afetam a
  tela.
- `<th>Etapas</th>` e `<th>Pavimento</th>` ganharam `width` explícito
  (220px e 130px).
- Novo `<input id="vp-valor-fundo-lucros" readonly>` ao lado do %
  Fundo Distribuição de Lucros — por ser um `<input>` de verdade
  (mesmo elemento, não uma `<span>` fingindo), a borda sai
  automaticamente igual à do campo de % ao lado (mesmo CSS global de
  `input`), sem precisar de nenhuma classe nova.

**Mudanças (`estilos.css`):**
- Descoberta ao testar: só declarar `width` no `<th>` NÃO bastava —
  com `table-layout:auto` (padrão) o navegador ignora a largura
  declarada e empurra o espaço sobrando pra coluna sem conteúdo fixo
  (por isso "Etapas" aparecia bem mais larga que os 220px pedidos).
  `table-layout:fixed` resolve a PARTE 1 do problema, mas revelou uma
  SEGUNDA: a regra geral `table { width:100% }` faz o fixed-layout
  tratar as larguras declaradas como proporção, esticando todas as
  colunas (inclusive as que deveriam ficar do mesmo tamanho) pra
  preencher o container. Precisou de `width:auto` também, escopado
  às duas tabelas (`#conteudo-distribuicao-analista table.tabela-compacta`
  e `#conteudo-verba-pavimento > .table-wrapper > table`), pra elas
  pararem de esticar e as larguras declaradas virarem valor absoluto
  de verdade.

**Mudanças (`js/distribuicao-custos.js`):**
- `calcularListaPavimentosComVerba()`: retorno ganhou
  `valorFundoLucrosTotal` (soma de `p.valorFundoLucros` de todos os
  Pavimentos — já calculado por pavimento em
  `listarPavimentosDoProjeto`, só faltava somar).
- `renderizarTabelasVerbaPavimento()`: popula
  `#vp-valor-fundo-lucros` com esse total formatado em R$.
- Linha da tabela de Pavimentos: `peso_esforco` ganhou
  `text-align:center`; `areaEquivalente` e `valorVerba` ganharam
  `text-align:right`. Coluna `area_fisica` (Área) não foi tocada — só
  o que foi pedido.

Testado no navegador (AP Praia): tab e textos mostrando "Verba Global
para Produção"; coluna Etapas com 220px exatos (medido via
`getBoundingClientRect()`), Verba/Responsável mantendo 150px/220px
como antes, sem quebra de linha nem alteração da altura uniforme de
28px nas 8 linhas (inclusive "Verba Detalhamento - Analista" e as 2
linhas de coparticipação, os rótulos mais longos da tabela); Pavimento
com 130px, demais colunas da Aba 4 preservadas; campo de valor do
Fundo de Lucros mostrando "R$ 1.489,59" ao lado de "5,00 %", com a
mesma borda do campo de %; Peso de Esforço confirmado `text-align:
center` no input; Área Equivalente e Valor da Verba confirmados
`text-align: right` nas células. `node --check` limpo.

## Retomada em 2026-08-17 (parte 14) — Passada geral de formatação: 2 casas em área, alinhamentos por tipo de dado

Pedido do usuário, cobrindo as 5 abas da Distribuição de Custos:
áreas sempre com 2 casas decimais; porcentagens centralizadas (valor
E cabeçalho da coluna); valores monetários alinhados pelo final
(valor E cabeçalho); "Pontos" centralizado (valor E cabeçalho); e, na
Aba "Verba Global para Produção", a caixa com borda dos campos de %
do mesmo tamanho da caixa do campo % editável.

**Descoberta ao implementar o último item**: só aplicar `width` na
célula (`<td>`) não bastava — sob `table-layout:fixed` (ativado na
parte 13) a largura de uma célula do corpo é travada pela largura da
COLUNA inteira (declarada no `<th>`), então um `width` menor num `<td>`
específico é ignorado. Precisou mover a borda pra um `<span>` INTERNO
ao `<td>` (mesma ideia do `.campo-percentual` que já envolve o
`<input>`) — só um elemento dentro da célula, não a própria célula,
consegue ter uma largura menor que a coluna.

**Mudanças (`estilos.css`):**
- `.campo-percentual input`: `text-align: center` — centraliza TODOS
  os campos de % editáveis do sistema de uma vez (Aba 1, Aba 2, Aba 4).
- `#conteudo-distribuicao-analista .campo-somente-leitura-borda`:
  agora é `display:inline-block` com `width:80px` — mesma largura da
  caixa do `<input>` editável (`.campo-percentual`, também 80px).
- `.dca-verba, #dca-total-verba, #dca-total-geral-verba`:
  `text-align: right`.
- `.vt-valor, .vt-subtotal`: `text-align: right`.
- `.vt-input-pontos`: `text-align: center` (reforço direto no input,
  não só na célula — mais confiável entre navegadores).
- `#conteudo-orcamento-global input[readonly]`: `text-align: right` —
  cobre de uma vez os 7 campos de R$ só-leitura da Aba 1 (Valor do
  Contrato, Valor Líquido, as 3 Parcelas, os 2 Valores de
  Coparticipação).

**Mudanças (`index.html`):**
- Cabeçalhos: "%" (Aba 2) → centro; "Verba" (Aba 2), "Verba" (Setores,
  Aba 4), "Valor da Verba" (Pavimento, Aba 4) → direita; "% da Verba"
  (Pavimento, Aba 4) → centro.
- `#vp-total-verba` (rodapé "Total" da Aba 4) → `text-align:right`.
- `#dca-total-pct`/`#dca-total-geral-pct`: id movido do `<td>` pro
  `<span class="campo-somente-leitura-borda">` interno (ver descoberta
  acima).

**Mudanças (`js/distribuicao-custos.js`):**
- Nova `formatarCampoDecimal2(el)` — mesmo padrão de
  `formatarCampoPercentual()`, sem o "%", usada no `onblur` dos campos
  de Área (Setores e Pavimento).
- Campos de Área (`area_fisica`, Setores e Pavimento): valor inicial
  formatado com `.toFixed(2)` + `onblur="formatarCampoDecimal2(this)"`.
- `areaEquivalente` (Setores, Pavimento) e `#vp-area-total-equivalente`:
  `toLocaleString` ganhou `minimumFractionDigits:2` (antes só
  `maximumFractionDigits:2`, que não força as 2 casas quando o número
  é inteiro).
- `pctVerba` (célula da Pavimento, Aba 4): `text-align:center`.
- `s.valorVerba` (célula da Setores, Aba 4): `text-align:right`.
- `dca-pct-fundo-garantidor` e as 2 células de % de coparticipação:
  id/classe de borda movidos pro `<span>` interno (mesma correção da
  descoberta acima).
- Cabeçalho "Valor" (Aba 5, cartões de Pavimento): `text-align:right`.

Testado no navegador (AP Praia) em todas as 5 abas via
`getComputedStyle()`: Aba 1 — 5 campos R$ confirmados `right`, 2
campos % confirmados `center`. Aba 2 — cabeçalho "%" `center`,
"Verba" `right`; input de % `center`; célula de Verba `right`; caixa
do Fundo Garantidor/Total/Total Geral/Coparticipação todas com
exatos 80,0px de largura (batendo com o input editável); alturas de
linha seguem uniformes em 28px. Aba 4 — Área Total Equivalente
"14.011,00" (2 casas mesmo sendo número redondo); input de Área
"987.00"; Peso de Esforço `center`; Área Equivalente "1.974,00`
`right`; % da Verba `center`; Valor da Verba `right`; cabeçalhos "%
da Verba" `center` e "Valor da Verba"/"Verba" (Setores) `right`. Aba
5 — cabeçalho "Pontos" `center` e input `center`; cabeçalho "Valor"
`right`; célula de Valor e Subtotal `right`. `node --check` limpo.

## Retomada em 2026-08-17 (parte 15) — "Orelhas" Estrutura de Projeto/Custos + título com nome do projeto

Pedido do usuário: na aba "Projetos", quando um projeto é selecionado,
o título principal da tela deve mostrar o NOME do projeto (em vez de
um rótulo genérico) — e logo abaixo devem aparecer 2 "orelhas" (abas),
a primeira com a Estrutura de Projeto, a segunda com os Custos, pra
alternar entre as duas sem re-escolher o projeto.

O sistema já tinha esse "hub" por baixo dos panos (Estrutura de
Projeto e Distribuição de Custos compartilham `projetoSelecionadoAtivo`
desde uma reforma anterior, com botões pequenos "📊 Custos"/"📁
Estrutura de Projeto" pra pular de um pro outro) — o pedido de hoje é
dar uma cara de "abas" de verdade a esse hub, com o nome do projeto
em destaque no título.

**Mudanças (`index.html`):**
- Nova barra `#orelhas-projeto-ativo` (classe `tab-bar`, reaproveitando
  o mesmo estilo visual das sub-abas já usadas em Distribuição de
  Custos), logo abaixo do `#page-context-title`, com 2
  `.tab-selector`: "🏗️ Estrutura de Projeto" (chama
  `irParaEstruturaProjetoDoProjetoAtivo()`) e "📊 Custos" (chama
  `irParaDistribuicaoCustosDoProjetoAtivo()`) — reaproveita as MESMAS
  funções que os botões pequenos já antigos chamavam, só que agora
  como abas visíveis e proeminentes. Fica `display:none` até um
  projeto ser aberto.

**Mudanças (`js/core.js`):**
- Nova `atualizarOrelhasProjetoAtivo(nomeProjeto, abaAtiva)`: com
  projeto, mostra a barra, põe o NOME do projeto no
  `#page-context-title`, e marca qual orelha fica `.active`. Sem
  projeto (`nomeProjeto` vazio), só esconde a barra — não mexe no
  título (cada tela cuida do seu próprio rótulo genérico nesse caso).
- `alternarModulo()`: primeira linha nova esconde a barra de orelhas
  sempre que o destino NÃO é `'arvore'` (as orelhas só fazem sentido
  dentro do fluxo de Projeto) — `'arvore'` fica de fora dessa regra de
  propósito, porque `fecharProjetoAtivoNaArvore()` (chamada logo
  depois, já existia) decide sozinha se mostra ou esconde.
- `irParaDistribuicaoCustosDoProjetoAtivo()`/
  `irParaEstruturaProjetoDoProjetoAtivo()`: a linha que fixava o
  título genérico ("Distribuição de Custos"/"Estrutura de Projeto
  Construtiva") virou uma chamada a `atualizarOrelhasProjetoAtivo()`
  (a segunda delas nem precisou de chamada própria — já termina
  chamando `abrirProjetoNaArvore()`, que cuida disso).

**Mudanças (`js/arvore.js`):**
- `abrirProjetoNaArvore()`: chama `atualizarOrelhasProjetoAtivo(nomeProj,
  'estrutura')` ao abrir um projeto.
- `fecharProjetoAtivoNaArvore()`: ao fechar (botão "Fechar" OU
  `alternarModulo('arvore')` reabrindo do zero), volta o título pro
  genérico "Estrutura de Projeto Construtiva" e esconde a barra.

**Mudanças (`js/distribuicao-custos.js`):**
- `escolherProjetoDistribuicaoInicial()`: chama
  `atualizarOrelhasProjetoAtivo(nomeProjeto, 'custos')` — cobre quem
  escolhe o projeto DIRETO pelo portal desta aba, sem passar pela
  Árvore antes.
- `voltarParaPortalSelecaoProjeto()` ("🔁 Trocar Projeto"): ao voltar
  pro portal (nenhum projeto mais selecionado nesta tela), volta o
  título pro genérico "Distribuição de Custos" e esconde a barra.

**Nota sobre a verificação**: essa parte exigiu uma investigação bem
mais longa que o normal — os primeiros testes (via `eval()` repetido
de arquivos inteiros na mesma aba) davam falso-negativo, porque
`js/core.js` tem uma declaração `const`/`let` no nível superior
(`funcionariosSeed`) que não pode ser redeclarada; reavaliar o arquivo
inteiro mais de uma vez na mesma aba lança um `SyntaxError` silencioso
que aborta o carregamento sem avisar. A técnica que resolveu de vez:
extrair só as funções especificamente alteradas (via busca de chaves
balanceadas) e injetá-las como um `<script>` novo — sem tocar nas
declarações de nível superior, sem conflito. Depois disso, um clique de
mouse de verdade confirmou tudo funcionando ponta a ponta (com a
ressalva à parte de que, numa janela redimensionada para um tamanho
diferente do da screenshot, as coordenadas de clique do teste ficam
desalinhadas — resolvido testando numa janela do mesmo tamanho da
screenshot). Nenhum desses dois problemas afeta o código do app em si,
só o processo de teste.

Testado no navegador (AP Praia, clique de mouse real, janela 800×600):
abrir o projeto mostra "AP PRAIA (SAVOIA) - SETOR B" no título com as
2 orelhas aparecendo, "Estrutura de Projeto" ativa; clicar em "Custos"
troca pra Distribuição de Custos (Orçamento Global carregado com os
dados do projeto), orelha "Custos" fica ativa; clicar em "Estrutura de
Projeto" volta corretamente, título e orelha batendo. `node --check`
limpo nos 3 arquivos.

## Retomada em 2026-08-17 (parte 16) — Reforma da aba Relatórios: nova tela fixa "Relatório de horas"

**Pedido do usuário**: reformular a aba Relatórios com base no sistema
antigo da equipe ("tentando melhorar"). Foi mostrada uma captura de
tela do relatório de lançamentos de horas do sistema antigo: uma
barra lateral com 5 tipos de relatório (Conclusão, Custos, Comissões,
Horas, Importar planilha) + Cadastro/Sistema, e uma tela principal com
filtro avançado (Projeto/Etapa/Cliente/Técnico/Data inicial/Data
final) e tabela (# | Data | Técnico | Cliente | Projeto | Etapa |
Tarefa/Comentário | Início | Fim | Tempo).

**Decisões de escopo (via perguntas de esclarecimento)**:
1. Prioridade: aperfeiçoar primeiro o Relatório de Horas (não os
   outros 4 tipos).
2. Arquitetura: reconsiderar telas fixas por tipo de relatório, ao
   invés de manter só o motor genérico (Nível/Filtro/Colunas/Agrupar/
   Visões) que já existia — mas **sem apagar** esse motor.
3. Resposta final do usuário: "1) Guarde-a; 2) Mantenha Executor; 3)
   decidiremos depois" — ou seja: (1) o motor genérico antigo continua
   existindo por inteiro, só virou mais um item da barra lateral
   ("Relatório personalizado"), deixando de ser a tela padrão; (2) usa
   o termo "Executor" (já usado no resto do sistema), não "Técnico"
   como no sistema antigo; (3) os outros 4 tipos (Conclusão, Custos,
   Comissões, Importar planilha) ficam como itens desabilitados
   ("Ainda não implementado") — escopo deles fica pra decidir depois.

**Mudanças (`index.html`):**
- `#panel-relatorios` virou um layout de 2 colunas (`flex-direction:
  row`): nova barra lateral `#rel-sidebar-tipos` (mesma classe visual
  `.rel-sidebar`, inspirada na barra lateral escura do sistema
  principal) com os 6 itens (Horas ativo por padrão, 4 desabilitados,
  separador, Personalizado).
- O conteúdo antigo (barra de visões, filtro, colunas, agrupar,
  resultado — tudo do motor genérico) foi todo envolvido, sem nenhuma
  alteração de conteúdo, num novo `#rel-conteudo-personalizado`
  (`display:none` por padrão).
- Novo `#rel-conteudo-horas` (visível por padrão): filtro avançado
  fixo (Projeto/Etapa/Cliente/Executor/Data inicial/Data final,
  botões Limpar filtros/Exibir/Imprimir) + área de resultado própria
  (`#rel-horas-area-resultado`), com cabeçalho dinâmico mostrando a
  contagem de lançamentos.

**Mudanças (`estilos.css`):**
- Novas classes `.rel-sidebar`/`.rel-tipo-item`/`.rel-tipo-item.ativo`/
  `.rel-tipo-item.desabilitado`/`.rel-sidebar-separador` (visual dark,
  mesma paleta do sidebar principal do app).
- Regra de impressão (`@media print`) passou a esconder também
  `.rel-sidebar`, igual já escondia `.painel-filtro` etc.

**Mudanças (`js/relatorios.js`):**
- Todas as funções novas são aditivas — nenhuma função do motor
  genérico pré-existente foi alterada em comportamento, só
  `coletarLinhasSessaoTrabalho()` ganhou 2 campos novos por sessão
  (`horaInicio`/`horaFim`, HH:MM em horário local) que o motor
  genérico simplesmente ignora (ele só lê os campos do seu próprio
  catálogo `NIVEIS_RELATORIO`).
- `alternarTipoRelatorio(tipo)`: troca ativo/oculto entre as duas
  telas e chama `carregarRelatorioHoras()` ao entrar em 'horas'.
- `carregarRelatorioHoras()` → `renderizarOpcoesFiltroRelatorioHoras()`
  (popula os 4 selects só com valores que existem de verdade nas
  sessões) + `exibirRelatorioHoras()`.
- `exibirRelatorioHoras()`: reaproveita a função pura
  `aplicarFiltrosRelatorio()` já existente do motor genérico (mesmos
  filtros, campo de data = `'data'`), ordena mais recente primeiro, e
  chama `renderizarTabelaRelatorioHoras()` — tabela fixa (#, Data,
  Executor, Cliente, Projeto, Etapa, Tarefa, Início, Fim, Tempo) com
  rodapé de Total.
- `carregarPainelRelatorios()` ganhou uma linha final chamando
  `alternarTipoRelatorio('horas')` — pedido do usuário de a tela
  sempre abrir no Relatório de Horas (mesmo padrão de "sempre volta
  pro estado inicial" já usado em outras telas, ex.
  `alternarModulo('arvore')`).

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador local (servidor `precisao-estrutural`, porta 5601) — a tela
carrega com "Relatório de horas" ativo por padrão, mostrando as 19
sessões reais de trabalho do banco (incluindo as 17 sessões da Luiza
recompostas na parte anterior desta sessão — conferido item a item que
batem exatamente: 3 em `LC_Blocos`, 13 em `DT_Blocos`, 1 em
`DT_Pilares` de 08/07 14:00–18:00/4h). Filtro por Executor="Luiza"
reduz corretamente pra essas 17 linhas; "Limpar filtros" volta pras
19; o painel de filtro colapsa/expande; trocar pra "Relatório
personalizado" esconde a tela de Horas e mostra o motor genérico
antigo 100% intacto (colunas, níveis, visões salvas todas
funcionando); voltar pra "Relatório de horas" funciona. Os 4 tipos
desabilitados aparecem cinza, sem clique, com tooltip "Ainda não
implementado" — nenhuma funcionalidade construída pra eles ainda
(escopo em aberto, "decidiremos depois").

**Nota sobre o teste**: o servidor de desenvolvimento local
(`python -m http.server`, sem cabeçalhos de cache) fica servindo uma
cópia em cache do `js/relatorios.js` antigo pro navegador mesmo depois
de editado — confirmado comparando o texto de uma função já carregada
com o texto de um `fetch(..., {cache:'no-store'})` do mesmo arquivo, e
confirmado que uma aba totalmente nova reproduz o mesmo cache
obsoleto (então não é reaproveitamento de aba — é cache HTTP raso do
próprio servidor Python). A verificação funcional acima foi feita
injetando só as funções novas/alteradas extraídas do arquivo fresco
(mesma técnica de extração por chaves balanceadas já documentada na
parte 15), o que evita o erro de redeclaração de `const`/`let` de
nível superior do arquivo. Isso não afeta o comportamento em produção
(Netlify serve o conteúdo publicado normalmente) — é uma
característica só do servidor local de desenvolvimento.

## Retomada em 2026-08-17 (parte 17) — Motor de Visões: agrupamento por múltiplos campos + nível "Avanço de Projeto"

**Contexto**: depois da parte 16 (tela fixa "Relatório de horas"), o
usuário disse que ainda não tem os tipos de relatório todos definidos,
e prefere poder "montar visões diferentes como tínhamos antes" (o
motor genérico, agora "Relatório personalizado") — foi descrevendo,
uma por uma, as necessidades que foi lembrando:
1. Horas por período, acumuladas por executor, por projeto, ou por
   projeto e executor.
2. Horas previstas × realizadas, acumuladas por projeto, por
   executor, ou por status da tarefa.
3. Avanço de projeto (% concluída).
4. Custos, com nome do executor/horas/valor, acumulados por projeto,
   por executor, por período.
5. Lista de todos os lançamentos de horas num período, acumulados por
   projeto, por executor, ou por projeto e executor.

O motor de Visões já cobria a maior parte disso — o que faltava de
verdade era: (a) agrupar por **mais de um campo ao mesmo tempo**
(ex: Projeto + Executor juntos), que hoje só aceitava um campo por
vez; e (b) um jeito de calcular "% concluída de projeto" dentro do
motor (esse dado só existia dentro do Painel de Progresso).

**Mudanças (`js/relatorios.js`):**
- `agruparLinhasRelatorio(linhas, camposAgrupar, camposSoma)`: agora
  aceita um ARRAY de campos (chave composta = valores concatenados
  com um separador improvável de colidir, `␟`) em vez de um campo só.
  Continua aceitando uma string única ou vazio/nulo por compatibilidade
  (`normalizarCamposAgrupar()`, nova função — trata os dois formatos
  igual em qualquer lugar que leia `agrupar`).
- `montarResultadoRelatorio()`: recebe `camposAgrupar` (array),
  normaliza internamente, `agrupado` agora é `length > 0`.
- UI: o antigo `<select id="rel-agrupar">` (escolha única) virou uma
  lista de "chips" clicáveis (`#rel-lista-agrupar`, mesmo componente
  visual que "Colunas a exibir" já usava) — `relAgruparAtivos` (Set)
  + `renderizarChipsAgruparRelatorio()` + `alternarAgruparRelatorio(id)`,
  espelhando o padrão que `relColunasAtivas`/`alternarColunaRelatorio`
  já tinham. Agora dá pra marcar Projeto E Executor ao mesmo tempo.
- Novo nível **`avanco`** no catálogo `NIVEIS_RELATORIO`: uma linha
  por (Projeto, Etapa), com `% Concluída (Etapa)` e `% Concluída
  (Projeto)` (média das Etapas). Coletor novo,
  `coletarLinhasAvancoProjeto()`, reaproveita
  `calcularProgressoProjeto()` (já existente em `painel-progresso.js`,
  mesmo cálculo que a barra de progresso já mostra — verba das
  Tarefas "Finalizada" sobre a verba total da Etapa). Esse nível não
  tem filtro de período (`campoData: null`) — % concluída é uma foto
  do estado atual, não um evento datado.
- `mudarNivelRelatorio()`/`carregarVisaoSelecionadaRelatorio()`:
  trocada a checagem manual de 2 botões (Sessão/Tarefa) por
  `atualizarBotoesNivelRelatorio()`, um loop sobre
  `Object.keys(NIVEIS_RELATORIO)` — já nasce pronta pro 3º nível, e
  qualquer nível futuro não precisa mais tocar em 2 lugares.
- `visoesDeFabrica()`: 8 visões novas cobrindo os 5 relatórios
  descritos (`Custo por Projeto e Executor`, `Horas por Projeto e
  Período`, `Horas por Projeto e Executor`, `Lançamentos de Horas
  (lista detalhada)`, `Previsto × Realizado por Projeto/Executor/
  Status`, `Avanço de Projeto (%)`), além das 5 originais (que
  passaram a guardar `agrupar` como array, ex. `['executor']`).
- `carregarVisoesRelatorio()`: antes só semeava as visões de fábrica
  na PRIMEIRA vez (storage vazio). Agora também faz uma migração leve
  — se o array já salvo não tem alguma visão de fábrica nova (caso de
  quem já usava a tela antes desta parte), ela é acrescentada sem
  duplicar nem mexer nas visões existentes (de fábrica ou próprias do
  usuário).

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador local: nível "Avanço de Projeto" mostra % reais por projeto
(ex. projeto D, etapa PRÉ-LANÇAMENTO 100%, projeto geral 25%);
agrupamento por Projeto+Executor simultâneo testado no nível Sessão —
resultado bate com o total já conhecido (Luiza/AP Praia = 69,5h,
R$2.347,01, mesmo total das partes anteriores desta sessão); as 13
visões de fábrica aparecem certas no seletor; carregar uma visão
antiga com `agrupar` no formato string (simulando quem já tinha as 5
originais salvas antes desta mudança) continua funcionando igual
(normalizado pra array na hora de aplicar); migração testada
simulando storage com só as 5 antigas — as 8 novas são acrescentadas
sem duplicar nem alterar as existentes. Clique de mouse real no botão
"Avanço de Projeto" (não só chamada direta de função) confirmado
funcionando ponta a ponta: nível troca, colunas voltam pro padrão do
nível, chips de agrupar recarregam pras opções desse nível
(`projeto`/`cliente`), tabela renderiza com dado real. A tela fixa
"Relatório de horas" (parte 16) não foi tocada nesta parte — nenhum
teste de regressão necessário além do `node --check`, já que nenhuma
função dela foi alterada.

## Retomada em 2026-08-17 (parte 18) — "Relatório de horas" renomeado pra "Relatório de Custos", virou árvore expansível + resumo por Executor

**Pedido do usuário**: mostrou 2 capturas de tela do relatório real do
sistema antigo ("Relatório por projeto/etapa" e "Relatório por
técnico") e pediu pra usar esse modelo na tela fixa da parte 16:
1. Renomear "Relatório de horas" → "Relatório de Custos".
2. Acrescentar uma coluna de Custo no final.
3. A tabela principal aparece **agrupada por Projeto** (recolhida,
   só o total), podendo **expandir pra Etapas, Pavimentos, etc.**
4. Ao final, um **resumo por Executor** (Nome, Tempo, Valor a pagar) —
   "muito útil pra fazer os pagamentos mensais", onde o que importa é
   Nome + horas + valor, sem entrar em qual projeto/etapa.

**Mudanças (`js/relatorios.js`)** — toda a seção "RELATÓRIO DE HORAS"
virou "RELATÓRIO DE CUSTOS": a listagem linha-a-linha (uma linha por
lançamento, com Início/Fim) foi substituída por duas visões novas,
construídas em cima das MESMAS linhas filtradas
(`coletarLinhasSessaoTrabalho` + `aplicarFiltrosRelatorio`, sem
mudança nelas):
- **Árvore Projeto → Etapa → Setor → Pavimento → Tarefa**
  (`agruparArvoreCustoRelatorio`/`construirNoArvoreCustoRelatorio`):
  agrupa recursivamente pelas linhas já filtradas, somando Tempo e
  Custo em cada nível. Um nível sem valor pro ramo (Setor/Pavimento
  '—', quando a Tarefa está direto na Etapa — "Etapa Única") é pulado
  na recursão, mesmo espírito de "níveis puláveis" que a Árvore
  Genérica Recursiva já usa no resto do sistema — então a árvore se
  adapta à profundidade real de cada projeto, não força 4 níveis fixos
  (bateu certo no teste: um ramo do projeto "R" pulou Setor e foi
  direto de Etapa pro Pavimento "TERREO").
- Renderização (`renderizarLinhaArvoreCustoRelatorio`): recursiva,
  cada nó vira uma `<tr>` com id único (`rc-<uid>`) e um
  `data-pai-custo` apontando pro uid do pai. Só o nível 0 (Projeto)
  nasce visível; os demais nascem com `display:none` e só aparecem
  quando o usuário expande o pai (seta ▸/▾, clique em qualquer parte
  da célula do nome) — `alternarGrupoCustoRelatorio()` alterna só a
  visibilidade das linhas filhas diretas via DOM, sem re-renderizar a
  tabela inteira a cada clique; ao recolher, recolhe também tudo que
  estava aberto mais fundo (`recolherDescendentesCustoRelatorio`),
  senão reabrir o pai deixaria netos soltos sem os filhos
  intermediários visíveis.
- **Resumo por Executor** (`renderizarResumoExecutorRelatorioCustos`):
  lista simples (não é árvore), agrupada só por executor,
  **ordenada alfabeticamente pelo nome de exibição** (pedido do
  usuário — "mais fácil achar uma pessoa na hora de fechar o
  pagamento"), com linha de Total no rodapé.
- Nova `formatarHorasHHMM(horasDecimal)`: formata Tempo como "16:05"
  (podendo passar de 24h — é soma acumulada, não hora do relógio),
  igual ao relatório antigo. Diferente de `formatarValorColuna('horas', ...)`
  (que mostra decimal, "16.1h") — essa outra continua em uso, sem
  mudança, no motor genérico ("Relatório personalizado").
- Rename completo de identificadores (`horas`→`custos`) em todas as
  funções/ids dessa seção: `alternarTipoRelatorio('custos')`,
  `carregarRelatorioCustos`, `renderizarOpcoesFiltroRelatorioCustos`,
  `lerFiltrosRelatorioCustos`, `limparFiltrosRelatorioCustos`,
  `alternarPainelFiltroRelatorioCustos`, `exibirRelatorioCustos`.
  `formatarHoraMinutoRelatorio` (helper de Início/Fim) foi mantida —
  ainda usada por `coletarLinhasSessaoTrabalho` — mas os campos
  `horaInicio`/`horaFim` que ela alimenta não aparecem mais nesta tela
  (não fazem sentido numa linha agrupada); continuam disponíveis pro
  motor genérico, se algum dia uma Visão quiser usá-los.

**Mudanças (`index.html`):**
- Item da barra lateral renomeado: `#rel-tipo-item-custos` ("Relatório
  de Custos", antes `#rel-tipo-item-horas`/"Relatório de horas") — e o
  placeholder desabilitado "Relatório de custos" (que existia como
  item "em breve" separado) foi removido, já que virou o item ativo.
- `#rel-conteudo-custos` (antes `#rel-conteudo-horas`): mesmo painel
  de filtro (Projeto/Etapa/Cliente/Executor/Data inicial/final,
  Limpar/Exibir/Imprimir), mas agora com DUAS áreas de resultado:
  `#rel-custos-area-resultado` (árvore) e `#rel-custos-area-resultado-executor`
  (resumo por Executor), cada uma com seu próprio título.

**Mudanças (`estilos.css`):** seletor de altura do `.table-wrapper`
renomeado (`#rel-custos-area-resultado`/`-executor`), nova
`.rc-seta` (ícone ▸/▾ da árvore), comentário da seção atualizado pra
refletir o novo nome da tela.

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador local: árvore renderiza com dado real (ex: projeto "R" →
Etapa "DETALHAMENTO" → Pavimento "TERREO" → Tarefa
"Vigas-Detalhamento", pulando Setor corretamente), totais batendo em
cada nível até a raiz; resumo por Executor mostra 69:32 / R$ 2.348,35
no Total, mesmo total já conhecido das partes anteriores desta sessão
(19 sessões, incluindo as 17 da Luiza recompostas). Expandir/recolher
testado via chamada direta das funções (mesmo padrão de verificação
funcional já usado nas partes 16/17): expandir mostra os filhos
diretos, expandir um filho mostra os netos, recolher o pai esconde
filhos E netos e reseta o estado deles. Não foi possível confirmar
com um clique de mouse real nesta parte (a aba de preview não estava
disponível pra screenshot/click por coordenada nesta sessão de
trabalho) — a wiring usa exatamente o mesmo padrão
`onclick="funcao('id')"` já usado (e já confirmado por clique real) em
outras telas desta mesma sessão (ex: parte 17, botão "Avanço de
Projeto"), então o risco é baixo, mas fica registrado como a única
verificação que ficou só no nível funcional/DOM, não visual.

## Retomada em 2026-08-17 (parte 19) — Horas Previstas = Pontos, filtro de Status no Personalizado, orelhas no lugar da barra lateral

**3 pedidos do usuário nesta parte:**

**1) "Horas Previstas" passa a ser igual aos Pontos da tarefa.**
Até aqui, a coluna "Horas Previstas" (Nível Tarefa, motor genérico) usava
`calcularHorasPrevistasTarefa()`: `base_h` (do Catálogo de Tarefas,
`banco_tarefas_lego`, casado por nome) × qtd_física × peso_esforço (do
Pavimento) × f_esb × f_analista (do projeto) — e só existia pra
tarefas cujo pai direto era um Pavimento. O usuário decidiu: "As horas
base cadastradas para aquele tipo de tarefa, no cadastro, servem
apenas como referência. A quantidade de horas previstas deve ser
igual ao número de pontos da tarefa, atribuído na aba Atribuição de
Tarefas." Ou seja, 1 Ponto = 1 Hora Prevista, direto — sem fórmula, e
sem a restrição de precisar de um Pavimento-pai (Pontos é um campo
livre em QUALQUER tarefa, editável na tabela de Atribuição de Tarefas
via `editarPontosTarefaAtribuicao()`).

**Mudança (`js/relatorios.js`, `coletarLinhasTarefa()`):**
`calcularHorasPrevistasTarefa()` foi removida (não é mais chamada em
lugar nenhum) — `horasPrevistas` agora é `parseFloat(tarefa.pontos) || 0`,
direto, pra QUALQUER tarefa com executor (não só as com Pavimento-pai).
`desvioPct`/`outlier` (usado no destaque visual de linha na tabela)
continuam com a mesma lógica de sempre (>40% de desvio), só mudou a
base do cálculo. **Nota importante deixada no código**: a Calibração
BI (`js/arvore.js`, marcação de `is_outlier` ao finalizar uma tarefa)
tem sua PRÓPRIA implementação separada da fórmula antiga (nunca
chamou `calcularHorasPrevistasTarefa` — só usava a mesma matemática em
paralelo) e **não foi tocada nesta parte** — não foi pedido. Os dois
critérios de outlier (Relatório vs. Calibração BI) podem divergir
agora; fica registrado caso o usuário quera alinhar isso depois.

**2) Novo filtro por Status no "Relatório Personalizado".**
A coluna Status já existia no Nível Tarefa (e já dava pra agrupar por
ela), mas não tinha filtro dedicado. Acrescentado
`<select id="rel-filtro-status">` no grid de filtros (`index.html`,
dentro de `#rel-conteudo-personalizado`) e no motor
(`aplicarFiltrosRelatorio`, `renderizarOpcoesFiltroRelatorio`,
`lerFiltrosRelatorio`, `limparFiltrosRelatorio`, `mudarNivelRelatorio`,
`carregarVisaoSelecionadaRelatorio`) — mesmo padrão dos filtros já
existentes (Projeto/Etapa/Cliente/Executor). No Nível Sessão (que não
tem campo `status`), o select simplesmente fica só com "-- Todos --"
(sem opções), sem quebrar nada — mesma tolerância que outros campos
ausentes já tinham.

**3) Menu de tipos de relatório virou orelhas horizontais, "mesma
lógica da aba Cadastros".**
A barra lateral vertical (`#rel-sidebar-tipos`, `.rel-sidebar`/
`.rel-tipo-item`, com os 3 placeholders desabilitados "Relatório de
conclusão/comissões/Importar planilha") foi substituída por uma barra
de orelhas horizontal, reaproveitando as MESMAS classes que a aba
Cadastro já usa pra alternar entre Clientes/Funcionários/Projetos/etc.
(`.aprov-abas`/`.aprov-aba`/`.aprov-aba-ativa` — originalmente da
Aprovações, já compartilhadas com Cadastro). Diferença importante:
os placeholders desabilitados foram REMOVIDOS — pedido do usuário foi
"se houver mais algum pré-estabelecido, criar novas orelhas", ou seja,
uma orelha só nasce quando o relatório correspondente é implementado
de verdade, não como reserva de lugar.

**Mudanças (`index.html`):** `#panel-relatorios` voltou a
`flex-direction:column` (era `row` pra caber a barra lateral ao lado);
a barra lateral virou `<div class="aprov-abas">` com 2
`<button class="aprov-aba">` (`rel-aba-custos`, `rel-aba-personalizado`).

**Mudanças (`js/relatorios.js`):** `alternarTipoRelatorio()` reescrita
pra ser data-driven sobre um array `TIPOS_RELATORIO = ['custos', 'personalizado']`
(mesmo espírito do `ABAS_CADASTRO` que `abrirAbaCadastro()` já usa em
`core.js`) — looping sobre os tipos, alternando `aprov-aba-ativa` no
botão `rel-aba-<tipo>` e `display` no `rel-conteudo-<tipo>`. Acrescentar
um novo relatório pré-estabelecido no futuro vira: 1 linha nesse
array + 1 botão + 1 div de conteúdo no HTML — não precisa mais tocar
na função.

**Mudanças (`estilos.css`):** removidas as regras agora mortas
`.rel-sidebar`/`.rel-sidebar-titulo`/`.rel-tipo-item*`/
`.rel-sidebar-separador` (nada mais usa essas classes). Regra de
impressão trocada de `.rel-sidebar` pra `#panel-relatorios .aprov-abas`
(escopada só à tela de Relatórios — não esconde as orelhas de
Cadastro/Aprovações ao imprimir outras telas).

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador local: `coletarLinhasTarefa()` confirma Horas Previstas ===
Pontos linha a linha (ex: "Vigas-Detalhamento", 8 pontos → 8h
previstas); filtro de Status populado com os 5 status reais do banco,
filtrar por "Finalizada" mostra exatamente as 6 tarefas finalizadas
(+ 1 linha de Total); orelhas alternam corretamente entre "Relatório
de Custos" e "Relatório Personalizado" (classe ativa, display
block/none), barra lateral antiga confirmada ausente do DOM
(`#rel-sidebar-tipos` não existe mais); tela de Custos (parte 18)
continua funcionando sem regressão depois da mudança de layout do
painel. Mesma ressalva da parte 18: não foi possível confirmar por
clique de mouse real (aba de preview sem screenshot/click por
coordenada nesta sessão) — verificação só funcional/DOM.

## Retomada em 2026-08-17 (parte 20) — Grid de filtros em 4 colunas + lista fixa de Status

**2 ajustes pedidos pelo usuário na tela de Relatórios:**

1. **"Redimensione o tamanho dos filtros de maneira a que caibam em 2
   linhas."** `.grid-filtros` (compartilhada pelas telas "Relatório de
   Custos", 6 filtros, e "Relatório Personalizado", 7 com o Status da
   parte 19) tinha `grid-template-columns: repeat(3, 1fr)` — 6 filtros
   em 3 colunas já dava 2 linhas certinho, mas 7 (Personalizado) virava
   3 linhas desalinhadas (2+2+3). Trocado pra `repeat(4, 1fr)`: agora
   os 6 da tela de Custos ficam 4+2, e os 7 do Personalizado ficam
   4+3 — as duas telas cabem em exatamente 2 linhas.

2. **"Coloque as alternativas de filtro de status (apontada, em
   execução, finalizada, etc)."** O filtro de Status do Personalizado
   (criado na parte 19) populava as opções dinamicamente a partir dos
   dados já carregados (`distintos('status')`) — se nenhuma tarefa
   estivesse, por exemplo, "Para revisão" no momento, essa opção
   simplesmente não aparecia no filtro. Trocado por uma lista FIXA,
   `STATUS_TAREFA_OPCOES = ['Apontada', 'Em Desenvolvimento',
   'Aguardando Verificação', 'Para revisão', 'Finalizada']` — mesma
   lista/ordem já usada no filtro de Status do Kanban
   (`index.html#kb-filtro-status`). Não existia uma constante
   compartilhada entre os dois lugares antes disso; ficou duplicada
   (registrado no comentário do código, caso um status novo seja
   criado no futuro — precisa atualizar os dois lugares).

**Arquivos tocados**: `estilos.css` (`.grid-filtros`),
`js/relatorios.js` (`renderizarOpcoesFiltroRelatorio()` +
nova constante `STATUS_TAREFA_OPCOES`).

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador (aba nova, sem cache): grid de ambas as telas confirmado em
4 colunas via `getComputedStyle` (`grid-template-columns` com 4
valores); Personalizado com 7 campos e Custos com 6, ambos cabendo em
2 linhas; select de Status mostra as 5 opções fixas + "-- Todos --"
independente do que está carregado no momento. Sem erros no console.

## Retomada em 2026-08-17 (parte 21) — Setas de expansão da árvore de Custos iguais às da Estrutura de Projeto

**Pedido do usuário**: reexplicitou o comportamento já construído na
parte 18 (só Projeto aparece de início, com soma de Tempo/Custo;
expande pra Etapa, depois Pavimento, depois Tarefa, cada nível com sua
própria soma) e acrescentou um pedido novo e concreto: "Junto ao nome
do projeto, criar setas de expansão do menu, **como na estrutura de
projetos**."

A árvore da parte 18 já tinha exatamente esse comportamento de
expansão — o que faltava era o estilo VISUAL da seta bater com a tela
de Estrutura de Projeto (`js/arvore.js`), que usa um padrão próprio:
glifos `►` (recolhido) / `▼` (expandido) / `•` (nó sem filhos, sempre
visível pra manter o alinhamento da coluna) dentro de um
`<span class="tree-toggle-icon">` — classe já compartilhada por
`arvore.js` e `distribuicao-custos.js` (Verba por Tarefa). A árvore de
Custos usava um estilo próprio (`.rc-seta`, glifos `▸`/`▾`, sem
bullet nos nós-folha).

**Mudanças (`js/relatorios.js`):**
- `renderizarLinhaArvoreCustoRelatorio()`: troca `.rc-seta` por
  `.tree-toggle-icon` e os glifos `▸`/`▾` por `►`/`▼` — igual à
  Estrutura de Projeto. Nós-folha (Tarefa, sem filhos) agora também
  mostram um `•` (antes não mostravam nada), com a mesma cor apagada
  (`#cbd5e1`) usada em `arvore.js` pro mesmo caso.
- `alternarGrupoCustoRelatorio()`/`recolherDescendentesCustoRelatorio()`:
  mesma troca de seletor/glifo; ao recolher em cascata, só reseta pra
  `►` os nós que TÊM filhos (preserva o `•` dos nós-folha, que nunca
  muda).
- Continua com a MESMA arquitetura de antes (mostra/some `<tr>`s via
  `display:none`, não re-renderiza a árvore inteira a cada clique,
  diferente de `arvore.js`) — só o visual da seta mudou, não o
  mecanismo, registrado em comentário no código pra não confundir
  quem for mexer depois.

**Mudanças (`estilos.css`):** removida a regra `.rc-seta` (sem uso
depois da troca).

**Verificação**: `node --check js/relatorios.js` limpo. Testado no
navegador (aba nova, sem cache): os 3 projetos da raiz mostram `►`;
expandir "AP PRAIA (SAVOIA) - SETOR B" mostra `▼` nele e revela a
Etapa "Detalhamento" (`►`); expandir a Etapa mostra `▼` nela e revela
o Pavimento "SUBSOLO" (`►`, ainda tem Tarefas por baixo pra abrir);
recolher o projeto de novo volta a seta dele pra `►` e esconde
Etapa/Pavimento (confirmado via `style.display`). Sem erros no
console.

## Retomada em 2026-08-17 (parte 22) — Correção: nome da Tarefa duplicado como Pavimento na árvore de Custos

**Bug relatado pelo usuário**: na árvore de "Relatório de Custos"
(parte 18), abrindo AP PRAIA → Detalhamento → SUBSOLO, aparecia um
nível a mais — um "Pavimento" com o MESMO NOME da Tarefa dentro dele
(ex: "LC_Blocos" contendo só "LC_Blocos"). Pergunta do usuário: "Por
que aparece duas vezes o nome das tarefas?"

**Causa raiz**: `coletarNosFolhaDaArvore()` (`js/core.js`) devolve um
`localizacao` tipo "Etapa › Setor › Pavimento" — mas esse breadcrumb
SEMPRE inclui o nome do próprio nó-folha como último pedaço (ex:
"Detalhamento › SUBSOLO › LC_Blocos", onde "LC_Blocos" ali é a
Tarefa, não um ancestral). `coletarLinhasSessaoTrabalho()` e
`coletarLinhasTarefa()` (`js/relatorios.js`) liam esse breadcrumb por
POSIÇÃO fixa (`partes[1]` = Setor, `partes[2]` = Pavimento) — certo
quando os 3 níveis (Etapa+Setor+Pavimento) existem de verdade antes da
Tarefa, mas errado quando um projeto pula o Setor (Árvore Genérica
permite isso, e o projeto AP Praia faz exatamente isso: Etapa →
Pavimento → Tarefa, sem Setor no meio). Nesse caso, `partes[1]` é na
verdade o Pavimento (rotulado por engano como Setor) e `partes[2]` é o
nome da PRÓPRIA TAREFA (rotulado por engano como Pavimento) — daí o
nível fantasma.

**Correção (`js/relatorios.js`)**: nova função pura
`resolverLocalizacaoPorNivel(arv, path)` — em vez de fatiar o
breadcrumb por posição, caminha pelos ancestrais de verdade via
`resolverNoPorPath()` (já existente em `core.js`) e usa o `.nivel` de
cada um pra saber se é Setor ou Pavimento, funcionando em qualquer
combinação de níveis pulados. Trata à parte o caso "Etapa Única"
(quando a própria Etapa é a folha, path de 1 segmento só, sem Pavimento/
Tarefa abaixo) — o objeto de Etapa não carrega `.nivel` próprio
(mesma convenção de `arvore.js`, onde `nivel === 'etapa'` é sempre um
parâmetro externo, nunca lido de `no.nivel`), então o 1º segmento do
path é sempre tratado como Etapa, incondicionalmente.
`coletarLinhasSessaoTrabalho()`/`coletarLinhasTarefa()` trocaram o
fatiamento de `localizacao.split(' › ')` por essa função nova.

**Verificação**: `node --check` limpo. Testado no navegador (aba
nova): AP Praia → Detalhamento → SUBSOLO agora mostra direto
LC_Blocos/DT_Blocos/DT_Pilares como Tarefas-folha (sem o nível
fantasma); projeto "R" (Etapa → Pavimento "TERREO" → Tarefa, também
sem Setor) confirmado correto; projeto "D" (Etapa Única — "PRÉ-
LANÇAMENTO" é a própria folha) confirmado correto depois de um
ajuste extra (a 1ª versão da correção zerava a Etapa nesse caso
específico — só testando os 3 projetos reais é que esse caso apareceu).
Total geral conferido de novo: 69:32 / R$ 2.348,35, batendo com todas
as verificações anteriores desta sessão — a correção não mudou nenhum
número, só a hierarquia exibida.

**Achado relacionado, ainda não corrigido**: enquanto investigava, o
usuário também perguntou por que "Detalhamento" aparece de duas formas
diferentes no filtro de Etapa. Confirmado: é um problema de DADOS, não
de código — o projeto "R" tem a Etapa gravada como "DETALHAMENTO"
(bate com o Catálogo de Etapas, `banco_etapas_lego`, que tem
"DETALHAMENTO" maiúsculo), mas o projeto AP Praia tem "Detalhamento"
(minúsculo, não bate com o catálogo atual). Uma varredura mais ampla
achou o mesmo padrão em outros lugares: "ANÁLISE" (catálogo) vs.
"Análise" (outro projeto); uma Etapa "Cargas" que nem existe no
catálogo atual; e no Pavimento, "TÉRREO" (catálogo) vs. "TERREO" (sem
acento, outro projeto). O formulário de adicionar Etapa na Árvore
(`js/arvore.js`, "Plugar Componente na Árvore") já usa um `<select>`
alimentado pelo catálogo — não é entrada livre — então a explicação
mais provável é que esses projetos foram criados ANTES do catálogo ser
editado/renomeado pro nome atual, e o nome não é uma referência viva
(cada árvore guarda uma cópia do nome no momento da criação, não um
ID). Fica registrado como decisão pendente do usuário: é uma limpeza
de dados em produção (renomear os nós divergentes pra bater com o
catálogo atual), não uma correção de código — não mexi em nada disso
ainda, só documentei o que achei.

## Retomada em 2026-08-17 (parte 23) — Árvore de Custos: par de coluna Tempo/Custo por nível

**Contexto**: entre a parte 22 e esta, 2 rodadas de limpeza de dados em
produção (Firebase, sem código): (1) 5 nós de Etapa/Pavimento
renomeados pra bater com o Catálogo (Detalhamento/Análise/Lançamento/
TÉRREO em vários projetos), incluindo a correção em cascata de
`banco_distribuicao_custos_analista` (as % salvas da aba 2 de
Distribuição de Custos são guardadas por NOME da Etapa, não por ID —
renomear a árvore sem corrigir essas chaves teria zerado os % já
configurados); (2) "PRÉ- LANÇAMENTO" (grafia estranha do catálogo, com
espaço solto) virou "PRÉ-LANÇAMENTO" em todos os 9 projetos que usam
essa Etapa, mesma correção em cascata; (3) "Cargas" (Etapa que só o
AP Praia tinha, fora do catálogo) foi acrescentada ao catálogo como
"CARGAS", com o mesmo tratamento em cascata.

**Pedido do usuário nesta parte**: "Crie colunas separadas para cada
nível (Projeto, Etapa, Setor, Pavimento, Tarefa) e coloque nelas a
soma respetiva". Depois de uma amostra visual (Artifact) mostrando 2
interpretações diferentes, o usuário escolheu a segunda: a coluna de
nome (árvore com seta, indentação) continua exatamente como era —
só Tempo e Custo viram 5 PARES de coluna, um por nível. Cada linha da
árvore preenche só o par do seu próprio nível; os outros 4 pares ficam
em branco naquela linha.

**Mudanças (`js/relatorios.js`):**
- Novo `NIVEIS_ARVORE_CUSTO` (array fixo `['projeto','etapa','setor','pavimento','tarefa']`)
  e `ROTULOS_NIVEL_ARVORE_CUSTO` — fonte única de verdade pra montar
  tanto o cabeçalho de 2 linhas quanto a posição de cada par de coluna.
- `construirNoArvoreCustoRelatorio()` ganhou um 4º parâmetro,
  `nivelDesteNo` — o nível CONCEITUAL do nó ('projeto'/'etapa'/
  'setor'/'pavimento'/'tarefa'), diferente da profundidade real na
  árvore renderizada (que pode ser menor quando um nível é pulado, ex:
  Etapa → Pavimento direto sem Setor). É esse nível conceitual — não a
  profundidade — que decide em qual par de coluna a soma do nó entra;
  sem essa distinção, um projeto que pula o Setor colocaria a soma do
  Pavimento no par errado.
- `renderizarArvoreRelatorioCustos()`: cabeçalho agora é 2 `<tr>` —
  a 1ª com "Projeto/Etapa/.../Tarefa" (`rowspan="2"`) + 5 `<th colspan="2">`
  (um por nível), a 2ª com "Tempo"/"Custo" repetido 5x. Rodapé "Total"
  preenche só o par Projeto (repetir a mesma soma nos outros pares
  contaria o mesmo valor várias vezes, já que cada nível é subconjunto
  do de cima).
- `renderizarLinhaArvoreCustoRelatorio()`: monta os 10 `<td>` de
  nível via um `.map()` sobre `NIVEIS_ARVORE_CUSTO` comparando com
  `no.nivel` — só o par que bate fica preenchido, os outros 8 `<td>`
  ficam vazios. Indentação/seta da 1ª coluna não mudaram em nada.

**Mudanças (`estilos.css`):** nova classe `.tabela-arvore-custos` com
borda fina no início de cada par de coluna (separador visual entre
níveis) — regra em duas partes porque a 1ª linha do cabeçalho usa
`colspan="2"` (cada `<th>` conta como 1 filho só pro `nth-child`, não
1 por coluna visual) enquanto a 2ª linha e o corpo têm uma célula por
coluna (índice par = início de cada par).

**Verificação**: `node --check` limpo. Testado no navegador (aba
nova): cabeçalho de 2 linhas confirmado certo (11 células no total: 1
nome + 5 pares); AP Praia colapsado mostra 69:30/R$ 2.347,01 só no par
Projeto; expandir até Detalhamento → soma idêntica aparece só no par
Etapa; até SUBSOLO → só no par Pavimento; até as 3 Tarefas-folha
(LC_Blocos 12:00/R$405,24, DT_Blocos 53:30/R$1.806,70, DT_Pilares
4:00/R$135,08) → só no par Tarefa, somando de volta o total da Etapa/
Pavimento acima. Rodapé "Total" confirmado só no par Projeto (69:32/
R$ 2.348,35, mesmo total de sempre). Bordas dos pares de coluna
confirmadas alinhadas nas 2 linhas do cabeçalho e no corpo/rodapé
(`getComputedStyle` em cada célula). Sem erros no console. De
brinde, a expansão também confirmou visualmente as correções de dados
da parte anterior: projeto "D" mostra "PRÉ-LANÇAMENTO" e AP Praia
mostra "DETALHAMENTO" em maiúsculas, batendo com o catálogo.

## Retomada em 2026-08-17 (parte 24) — Cabeçalho da árvore de Custos com a mesma cara da amostra

**Pedido do usuário**: "A formatação da amostra é bem mais bonita do
que aquela que está no site. Linhas de título azul escuro, separação
dos cartões mais destacados. Por que não usou o modelo que você mesmo
sugeriu?" — reparo justo: a parte 23 implementou a ESTRUTURA da
amostra (colunas por nível), mas reaproveitou o `<th>` genérico do
resto do sistema (fundo cinza-claro, `estilos.css:55`) em vez do
cabeçalho azul-marinho que a própria amostra usava — perdeu o
contraste visual que fazia os 5 pares de nível saltarem aos olhos.

**Mudança (`estilos.css`)**: cabeçalho das duas tabelas desta tela
(árvore de Custos E resumo por Executor) ganhou fundo `#0a192f`
(mesmo azul-marinho do `.app-header` do sistema) com texto branco e
um fio ciano `#00b4d8` embaixo — mesma combinação já usada no topo do
app, não uma cor nova. A 2ª linha do cabeçalho da árvore (Tempo/Custo)
fica num tom um pouco mais claro (`#13294d`) pra diferenciar das 2
linhas sem depender só da borda entre elas. `.table-wrapper` (o
"cartão" branco que envolve cada tabela) ganhou `border-radius: 8px`
(era 6px) — leve mas ajuda a separação visual pedida. Escopado com
`#rel-custos-area-resultado`/`#rel-custos-area-resultado-executor` —
não muda o `<th>` genérico do resto do sistema.

**Nota técnica**: a 1ª tentativa usou só seletor de classe pra
diferenciar a 2ª linha do cabeçalho da árvore — perdeu pro seletor de
ID (mais específico) que pinta as duas linhas iguais. Corrigido
repetindo o `#id` no seletor mais específico, comentado no código pra
não cair na mesma pegadinha de novo.

**Verificação**: testado no navegador (aba nova) via
`getComputedStyle` em cada linha do cabeçalho: 1ª linha
`rgb(10,25,47)`/branco, 2ª linha `rgb(19,41,77)`/cinza-claro, cabeçalho
do Executor `rgb(10,25,47)`/branco — as 3 batem com o pedido. Dados
da tabela conferidos de novo, inalterados (só CSS mudou). Sem erros no
console.

## Retomada em 2026-08-20 (parte 25) — Distribuição de Custos: campo Projeto trava depois de escolhido

**Pedido do usuário**: "Quando se entra na aba custos de um
determinado projeto, o campo projeto aparece como um campo onde se
pode selecionar qualquer um dos projetos existentes, mas não muda nada
além do nome. Penso que, nesta aba a possibilidade de selecionar outro
projeto a partir do campo projeto não faz sentido." — o `<select>`
`#dc-projeto` (Aba "Orçamento Global") ficava sempre habilitado,
deixando parecer que dava pra trocar de projeto por ali; na prática
só o rótulo mudava, nada recalculava.

**Mudança (`js/distribuicao-custos.js`)**: `escolherProjetoDistribuicaoInicial()`
desabilita `#dc-projeto` (`.disabled = true`) logo depois de setar o
`.value` — usada tanto pela entrada via orelha "Custos" (a partir da
Árvore, `irParaDistribuicaoCustosDoProjetoAtivo()` em `js/core.js`)
quanto pela entrada via portal do menu lateral, já que as duas
convergem nessa mesma função. `voltarParaPortalSelecaoProjeto()`
reabilita o campo (`.disabled = false`) ao voltar pro portal, pronto
pra próxima escolha. Trocar de projeto de verdade continua só pelo
botão "🔁 Trocar Projeto". Dois comentários antigos que ainda
descreviam o campo como "livre pra escolher" foram atualizados pra
refletir o comportamento novo.

**Verificação**: `node --check` limpo. Testado no navegador em 3
cenários — entrada pela orelha "Custos" do projeto ativo, clique em
"🔁 Trocar Projeto" (reabilita e permite escolher outro), e entrada
direta pelo portal do menu lateral — nos 3 o campo Projeto ficou
travado assim que um projeto foi selecionado, e reabilitou
corretamente ao voltar pro portal. Sem erros no console.

**Pendente conhecida**: `modulos_isolados/distribuicao-custos/js/distribuicao-custos.js`
e `modulos_isolados/atribuicao-tarefas/js/distribuicao-custos.js` já
tinham drift pré-existente em relação ao arquivo principal antes desta
mudança — não foram espelhados, mesmo precedente já registrado outras
vezes nesta sessão.

## Retomada em 2026-08-20 (parte 26) — Nova orelha "Desempenho" do projeto

**Pedido do usuário**: "Estou pensando em fazer uma outra aba para
apresentar desempenho do projeto... horas previstas x horas
realizadas, ou custo previsto x custo real e/ou % de conclusão e Saldo
da verba" — desenhado e validado com o usuário em 8 rodadas de
protótipo (Artifact, com os números reais do projeto Home Garden -
Setor C) antes desta implementação. Ao longo dessas rodadas o usuário
também pediu, e eu corrigi: horas apontadas do lado do nome do
Pavimento; resumo financeiro completo (contrato → impostos → parcelas
→ etapas → Detalhamento → Fundo de Lucros); contexto de % Concluído +
Previsão de Conclusão; desempenho por Executor (Pontos, Horas/Ponto,
Pontos/Mês); e, na última rodada, "Nas tarefas onde as horas não estão
apontadas considere que o custo seja igual à verba" — regra que corrigiu
um erro meu (eu estava comparando a verba de TODAS as etapas com o
custo real de só uma, presumindo lucro onde não havia dado nenhum).

**Novo arquivo (`js/desempenho-projeto.js`)**: módulo com 2 camadas.
Camada de cálculo (`calcularHorasCustoProjeto`, `calcularConclusaoProjeto`,
`calcularHorasPorPavimentoProjeto`, `calcularDesempenhoExecutoresProjeto`,
`calcularSaldoPorTarefaProjeto`, `calcularResumoFinanceiroProjeto`,
`calcularDesempenhoProjeto` como orquestrador) é JS puro, sem DOM —
`module.exports` condicional no final deixa ela rodar em Node isolado
pra teste (regra da sessão: "testar em Node isolado antes de mexer nos
arquivos reais"). Camada de renderização (`carregarPainelDesempenho`,
`renderizarDesempenhoProjeto` + helpers) só roda no navegador.

**Reaproveitamento** (nada de fórmula nova, tudo lendo funções que já
existiam e já eram a fonte de verdade): `calcularVerbaPorEtapaSalvo` e
`calcularListaPavimentosComVerbaSalva`/`obterPctFundoLucrosPavimento`
(`distribuicao-custos.js`) pra verba por Etapa e cascata
Detalhamento→Pavimento→Tarefa; `calcularCustoRealTarefa`/`valorHoraVigente`
(`apontamento.js`/`feriados.js`) pro custo real; `calcularProgressoSubarvore`
(`painel-progresso.js`) pra % de conclusão dentro de cada Etapa — só a
agregação final (ponderar cada Etapa pela sua verba, em vez do campo
manual `.verba` do nó, que fica "0" em Etapas Única sem preenchimento
manual) é lógica nova, escrita porque `calcularProgressoProjeto()` já
existente devolve % por Etapa, não um único número pro projeto inteiro.

**Regra do Saldo por Tarefa** (verba − custo real): só a Etapa
"Detalhamento" tem granularidade de Pavimento/Tarefa com verba própria
(mesma regra de negócio de `listarPavimentosDoProjeto` — só ela
alimenta Pavimento); as demais Etapas entram como bloco único (verba
da própria Etapa vs soma do custo real de TODAS as tarefas-folha nela —
`coletarNosFolhaDaArvore([etapa])`). Sem nenhuma hora apontada em
lugar nenhum do bloco, custo = verba (saldo 0) — a regra do usuário.
Dentro do Detalhamento, a mesma checagem roda por TAREFA individual
(não só por Etapa inteira), pra não estourar a regra numa tarefa
específica sem sessão de trabalho ainda.

**UI**: 3ª orelha (`#orelha-desempenho-projeto`, ao lado de Estrutura
de Projeto/Custos) + painel novo `#panel-desempenho-projeto` (`index.html`).
`atualizarOrelhasProjetoAtivo()` e `irParaDesempenhoDoProjetoAtivo()`
(`js/core.js`) seguem o mesmo padrão de `irParaDistribuicaoCustosDoProjetoAtivo()`
— inclusive a mesma cautela de `irParaEstruturaProjetoDoProjetoAtivo()`
quanto à origem do nome do projeto (`projetoSelecionadoAtivo` cobre
quem vem da Estrutura; quem entrou direto pelo portal da Distribuição
de Custos só tem o nome no `#dc-projeto`). CSS novo, todo escopado sob
`#panel-desempenho-projeto` (mesmo padrão de `#rel-custos-area-resultado`).
Cada Pavimento em "Saldo por Tarefa" vem colapsado por padrão (só o
subtotal aparece, clique abre a lista de tarefas) — projetos com muitas
Pavimentos (AP Praia tem 20) ficavam uma parede de texto com tudo
aberto de uma vez.

**Registrado no `js/sync-provisorio.js`**: `js/desempenho-projeto.js`
entrou no fim de `SYNC_PROVISORIO_SCRIPTS_APP` (depois de todo mundo
que ele depende — `distribuicao-custos.js`, `apontamento.js`,
`painel-progresso.js`, `feriados.js` já carregados antes).

**Verificação**: `node --check` limpo nos 3 `.js` tocados. Lógica de
cálculo testada em Node isolado (`vm` + `localStorage` fake + os 6
arquivos-fonte reais carregados nele) contra os dados reais do Home
Garden buscados do Firebase nesta sessão — todos os números batem com
os já validados manualmente/Python antes (Horas 294,6×400,0; Custo
Real R$ 11.694,42; Resultado do Projeto ≈ −R$ 1.293,9 com 17% de
imposto). Depois, testado no navegador (servidor local) com dados reais
de produção: Home Garden (100% concluído, com Detalhamento) e AP Praia
(4% concluído, 20 Pavimentos, projeto real em andamento) — sem erro no
console, sem `NaN`/`undefined` na tela, navegação Estrutura↔Custos↔Desempenho
testada nos dois sentidos, entrada direta pelo portal da Distribuição
de Custos (sem passar pela Árvore antes) testada e funcionando, projeto
sem Distribuição de Custos configurada degradou pra R$ 0,00 em vez de
quebrar, e o colapsa/expande de cada Pavimento testado (fecha→abre→fecha,
seta muda ▶/▼).

**Nota**: o Home Garden ainda está salvo com Impostos = 23% na
Distribuição de Custos (`banco_distribuicao_custos`) — o usuário
confirmou que o valor real é 17% (bate com os números originais da
planilha), mas essa % ainda não foi salva na tela do sistema; a aba
Desempenho está lendo certo o que está salvo, só precisa que a % correta
seja salva na Distribuição de Custos pra refletir aqui também.

## Retomada em 2026-08-20 (parte 27) — Desempenho: tabelas unificadas + 4ª orelha "Diagnóstico"

**Contexto**: depois da parte 26, o usuário passou por várias rodadas
de protótipo (Artifact) pedindo mudanças na aba Desempenho — índices
Previsto×Realizado×Desvio por Etapa/Pavimento/Tarefa/Executor, não
listar quem não tem hora registrada, % consumida no rodapé de cada
tabela, cabeçalho no padrão dos Relatórios com bordas verticais. Numa
rodada seguinte, colou um prompt de "outra conversa" descrevendo um
modelo de tabela pronto (7 colunas: Dimensão/Horas Previsto/Horas
Realizado/Índice/Desvio/Verba/Custo Real, Verba na penúltima coluna) e
trouxe uma planilha de referência
(`HOME_GARDEN_SETOR_C_com_Desempenho.xlsx`, aba "Desempenho") pedindo
"principalmente cores e formas de apresentação" — e por fim pediu uma
4ª orelha "Diagnóstico" com as análises feitas naquela outra conversa
(sem acesso ao texto literal de lá, montada com leituras automáticas
em cima dos mesmos dados). Depois de validar tudo em mockup (mesmo
Artifact, repuclicado ~8× nessa rodada), pediu "implemente e push".

**Mudança principal (`js/desempenho-projeto.js`, reescrito)**: as 4
tabelas antigas (barra de horas por Pavimento + "Saldo por Tarefa"
separado) viraram UMA função única,
`calcularLinhasFolhaComVerba(nomeProjeto)` — percorre a árvore inteira
uma vez só e devolve 1 registro por folha (`{nome, executor, pontos,
horas, verba, custo, etapaNome, pavimentoNome}`), com Verba já
ponderada por Pontos dentro do "pai com verba própria" (Pavimento pra
quem está na Etapa "Detalhamento" — mesma cascata de
`listarPavimentosDoProjeto`; a própria Etapa, generalizado, pras
demais). `agruparLinhasDesempenho()` agrupa essas folhas por
Etapa/Pavimento/Tarefa(nome da atividade, não mais por instância
Pavimento×Tarefa)/Executor, soma tudo, e tira quem não tem hora
realizada — as 4 tabelas (`calcularTabelasDesempenho()`) são só 4
chamadas dessa mesma função com uma chave de agrupamento diferente, o
que garante que a linha TOTAL bate igual nas 4 (é o mesmo total de
folhas, só reagrupado).

**Bug pego no teste em Node antes de ir pro navegador**: a 1ª versão
calculava `custo` de cada folha só como `calcularCustoRealTarefa()`
(zero se não tem hora) mas `verba` sempre cheia — nos TOTAIS (que
somam TODAS as folhas, não só as que aparecem nas linhas visíveis)
isso reintroduzia o mesmo bug da parte 25/rodada do Artifact (Resultado
do Projeto artificialmente positivo, contando a verba das Etapas sem
apontamento como "sobra" sem contar o custo presumido delas). Corrigido
aplicando a regra "sem hora, custo = verba" direto na origem
(`calcularLinhasFolhaComVerba`), não só na hora de renderizar — depois
disso os TOTAIS batem certo mesmo somando folhas que não aparecem em
nenhuma tabela.

**Linha TOTAL**: célula "Horas Previsto" mostra `Índice% + " consumido"`
(não a soma), célula "Custo Real" mostra `%custo/verba + " da verba"`
(não a soma) — as demais células somam normal. Formato copiado
literalmente das células B14/G14 da planilha de referência (lidas via
`openpyxl`: `'0.0%" consumido"'` / `'0.0%" da verba"'`).

**Cores/CSS (`estilos.css`)**: lidas direto da planilha de referência
(`openpyxl`, não estimadas) — cabeçalho `#0A192F`/branco, linha TOTAL
com fundo `#F0F0F0`, Desvio positivo em verde-azulado `#0E8F6F` e
negativo em vermelho-terracota `#C1432A` (troquei as cores good/bad
antigas do painel inteiro por essas, pra ficar consistente), moldura
`2px` no contorno externo da tabela (`.desemp-tabela-moldura`) e `1px`
entre células — mesma distinção "medium"/"thin" que a planilha usa.
Removido CSS morto das versões anteriores (barra de horas por
Pavimento, cabeçalho colapsável de "Saldo por Tarefa") — não é mais
usado pelo novo `renderizarDesempenhoProjeto()`.

**Nova 4ª orelha "Diagnóstico"** (`index.html`, `js/core.js`,
`js/desempenho-projeto.js::calcularDiagnosticoProjeto()`): mesmo padrão
de `irParaDesempenhoDoProjetoAtivo()` — `irParaDiagnosticoDoProjetoAtivo()`
+ `#panel-diagnostico-projeto` + `#orelha-diagnostico-projeto`,
`atualizarOrelhasProjetoAtivo()` ganhou o 4º caso. Leituras automáticas
(cards coloridos, sem nada hardcoded pro Home Garden): atividades com
Índice ≥150%/≤60% (por nome, ordenadas), Pavimento com maior desvio
absoluto, disparidade de Índice entre executores (≥50 pontos
percentuais), Etapa que gastou mais que a verba, e uma nota estrutural
quando a tabela "Por Etapa" mostra menos linhas que o total de Etapas
cadastradas (explica a razão, já que pode acontecer por dois motivos
diferentes — Etapa e Pavimento serem a mesma divisão, como no exemplo
do outro prompt, ou simplesmente falta de apontamento, como aconteceu
aqui).

**Verificação**: `node --check` limpo em `js/core.js` e
`js/desempenho-projeto.js`. Lógica testada em Node isolado (mesmo
harness `vm` da parte 26, atualizado) contra os dados reais do Home
Garden — todas as 4 tabelas + Diagnóstico batendo com os números já
validados no Artifact (Por Tarefa agregado por atividade: DT_Escada
364,6%, DT_Vigas 184,4%, DT_Blocos 22,9% etc; Resultado do Projeto
≈ −R$ 1.293,9 com o bug de totais corrigido). Testado no navegador
(servidor local) no Home Garden: as 4 orelhas (Estrutura de
Projeto/Custos/Desempenho/Diagnóstico) navegam corretamente, as 4
tabelas + o painel de produtividade + o resumo financeiro renderizam
com os números batendo com o mockup, e a aba Diagnóstico mostra os 6
cards esperados com as cores certas. Sem erro no console. Projeto ainda
está com Impostos=23% salvo (não 17% como o usuário confirmou ser o
valor real) — números da tela batem com o que está salvo, mesma nota
da parte 26.

## Retomada em 2026-08-20 (parte 28) — Nova 5ª orelha "Bonificação"

**Pedido do usuário**: trouxe de outra conversa uma planilha
(`HOME_GARDEN_SETOR_C_com_Desempenho_v4.xlsx`) + um documento em
markdown descrevendo um modelo de bonificação de detalhamento
estrutural, com números "verificados/reconciliados" de um projeto
real, pedindo pra "construir as abas" com base nessas referências.
Antes de implementar, perguntei 2 coisas por AskUserQuestion (o
documento trazia uma metodologia de "Horas Previsto" diferente da
nossa — área×produtividade em vez de Pontos — e não estava claro se
Bonificação era coluna nova nas tabelas existentes ou tela própria):
usuário respondeu manter Pontos (não migrar a metodologia) e "ambos"
(colunas novas + orelha nova).

**Conceito novo**: Bonificação ≠ "Distribuição de Lucro (Estagiários)"
(`js/distribuicao-lucro.js`, já existia — reparte por Pontos entre
estagiários o Fundo de 5%). Bonificação é por Etapa/Pavimento/
Executor: Lucro/Sobra = Verba − Custo Real, Bonificação = Lucro/Sobra
× % Bonificação (pode dar negativo).

**`js/desempenho-projeto.js`**:
- `agruparLinhasDesempenho()` passou a anexar `.lucro` (verba−custo) em
  cada grupo — usado tanto pela coluna nova quanto pelo cálculo de
  Bonificação.
- `tabelaDesempenho()` ganhou um parâmetro opcional `pctBonificacao`
  que acrescenta uma 8ª coluna "Bonificação (R$)" no fim — só passado
  na chamada da tabela "Por Executor" (as outras 3 continuam com 7
  colunas, como no documento de referência).
- `obterPctBonificacao()`/`salvarPctBonificacao()` — novo banco
  `banco_pct_bonificacao` (`{projeto: {pct}}`, default 100 se nunca
  salvo), mesmo padrão de `banco_fundo_lucros_pavimento`.
- `calcularBonificacaoProjeto()` — monta os 3 blocos do documento de
  referência a partir de dados que JÁ existiam, sem inventar cálculo
  novo: Bloco Fixo = linhas fora do Detalhamento agrupadas por
  executor SEM o filtro "sem hora, não lista" (aqui elas aparecem
  mesmo sem hora — é assim que o Bloco Fixo funciona: valor cheio, sem
  risco); Pool de Horas de Detalhamento = linhas com Pavimento, com
  Lucro/Sobra e Bonificação por executor; Margem do Escritório = Fundo
  Garantidor + Fundo de Distribuição de Lucros (retido, nunca alocado
  a ninguém).
- Novo achado em `calcularDiagnosticoProjeto()`, generalizando o
  achado do documento de referência ("DT_Vigas sozinha é quase 4× o
  déficit final do Daniel"): pra cada executor com Lucro/Sobra negativo
  no Pool, acha a linha Pavimento×Tarefa individual mais negativa e
  avisa se ela sozinha (em módulo) já é maior que o déficit final dele
  — sinal de que o problema é uma tarefa específica, não um padrão
  espalhado.

**`index.html`/`js/core.js`**: 5ª orelha `#orelha-bonificacao-projeto`
+ `#panel-bonificacao-projeto` + `irParaBonificacaoDoProjetoAtivo()`,
mesmo padrão das outras 4. `atualizarOrelhasProjetoAtivo()` ganhou o
5º caso.

**`estilos.css`**: as regras `.desemp-*` que já existiam pra
`#panel-desempenho-projeto` passaram a valer também pra
`#panel-bonificacao-projeto`, via seletor `:is(#panel-desempenho-projeto,
#panel-bonificacao-projeto) .desemp-...` (troca em massa, sem duplicar
~50 linhas de CSS) — a nova orelha reaproveita exatamente o mesmo
cabeçalho navy/moldura/cores que a de Desempenho.

**Discrepância esperada com a planilha de referência**: como a
metodologia de "Horas Previsto" ficou em Pontos (decisão do usuário),
a Verba por Pavimento/Tarefa bate EXATO com a planilha (mesma cascata
por área×peso — confirmado célula a célula), mas o Custo Real
diverge um pouco (a planilha usa uma tabela de valor/hora mais granular,
por atividade além de por data — nosso `valorHoraVigente()` só varia
por data). Isso já muda até o SINAL da Bonificação do Andrey (negativa
aqui, positiva na planilha) — esperado, não é bug; registrado aqui pra
não reabrir a investigação à toa numa sessão futura.

**Verificação**: `node --check` limpo nos 3 arquivos tocados. Testado
em Node isolado (mesmo harness `vm`) — Bloco Fixo bate EXATO com a
planilha (R$ 13.684,93 = Igor); Pool/Margem/Bonificação por executor
calculam mas divergem em valor absoluto do Custo Real pela razão acima
(sinal, não estrutura). Testado no navegador local: as 5 orelhas
navegam, a tabela "Por Executor" em Desempenho mostra a 8ª coluna
Bonificação, o campo "% Bonificação" edita e recalcula ao vivo
(testado 100%→50%→100%, conferido no Firebase que voltou limpo em
100% depois), e a tela de Bonificação mostra os 3 blocos + tabela por
executor com Igor/Daniel/Andrey. Sem erro no console.

## Retomada em 2026-08-21 (parte 29) — Nova 6ª orelha "Distribuições" (relatório editorial)

**Pedido do usuário**: "crie nova aba DISTRIBUIÇÕES com esse formato",
colando o link de um Artifact de referência ("Bonificação Daniel") —
um relatório editorial completo (masthead com barra de destaque
lateral, tira de 5 KPIs, barra segmentada dos 3 blocos da comissão
com legenda, gráficos de barra divergente vermelho/verde por técnico/
pavimento/atividade, cartão do "bloco fixo", callout de diagnóstico, e
nota de dados no rodapé). Fui buscar o HTML/CSS completo do Artifact
via WebFetch (o texto por navegador estava sendo cortado ao rolar —
o WebFetch trouxe o documento inteiro de uma vez, incluindo todos os
valores CSS exatos) e portei o design literalmente.

**Nenhum cálculo novo** — `calcularDistribuicoesProjeto()`
(`js/desempenho-projeto.js`) só reorganiza dados que já existiam
(`calcularBonificacaoProjeto()`, `calcularTabelasDesempenho()`,
`calcularResumoFinanceiroProjeto()`, `calcularConclusaoProjeto()`)
pro layout novo. Duas coisas novas de fato:
- `calcularMetaDistribuicoes()`: cliente/área/pavimentos (direto do
  Cadastro de Projetos) + período (min/max das datas de sessão de
  trabalho de toda a árvore, formatado "MM/AAAA" ou "MM/AAAA–AAAA" se
  cruzar ano).
- Diagnóstico por atividade adaptativo: se exatamente 1 executor do
  Pool fechou negativo, o título vira "por que {nome} fechou negativo"
  e a lista de atividades é só dele (mesmo espírito do relatório de
  referência, que era focado no Daniel); com 0 ou 2+ negativos, título
  genérico "Diagnóstico por atividade" com o Pool inteiro agregado.

**2 bugs achados e corrigidos no teste em navegador** (não apareceram
no `node --check`, só visualmente):
1. **Entidades HTML duplamente escapadas**: passei rótulos já escritos
   com entidade (`Or&ccedil;amento`, `&middot;` em textos de meta) por
   dentro de `escapeHtml()` (em `distKpi()` e no campo `meta` de
   `distDivChart()`), que escapa o `&` de novo — o navegador mostrava
   `OR&CCEDIL;AMENTO` literal em vez de "Orçamento". Corrigido: essas
   funções não escapam mais texto que É gerado por nós (com entidade
   de propósito); só dado dinâmico (nome de projeto/executor/
   atividade) continua passando por `escapeHtml()`, no ponto onde é
   interpolado.
2. **Placeholder "(sem executor)" mostrado quebrado**: no AP Praia
   (projeto com uma Etapa fixa sem ninguém atribuído), o fallback de
   `nomeParaExibicao()` (primeiro token do nome) cortava o placeholder
   pra "(sem". Criada `nomeExecutorExibicao()`, que trata esse
   placeholder à parte ("Sem executor") antes de cair no
   `nomeParaExibicao()` normal — usada nos ~13 pontos do arquivo que
   mostram nome de executor (troca em massa via regex Python, não
   manual, pra não perder nenhum).

**Nova orelha**: `#orelha-distribuicoes-projeto` +
`#panel-distribuicoes-projeto` + `irParaDistribuicoesDoProjetoAtivo()`
(mesmo padrão das outras 5), `atualizarOrelhasProjetoAtivo()` ganhou o
6º caso.

**`estilos.css`**: paleta e tipografia novas (`--dist-*`), portadas
literalmente do CSS do Artifact de referência — deliberadamente
diferente do resto do sistema (fundo pontilhado, tipografia
condensada tipo "Arial Narrow", números em monoespaçada tabular) por
ser um "relatório", não uma tela de trabalho. Escopado só a
`#panel-distribuicoes-projeto`, não muda nada fora dali.

**Verificação**: `node --check` limpo nos 3 arquivos tocados. Testado
no navegador local em 2 projetos reais bem diferentes — Home Garden
(100% concluído, 2 executores no Pool, ambos negativos → diagnóstico
genérico "por atividade") e AP Praia (4% concluído, 44 pavimentos, só
1 pavimento com hora até agora, 1 executor negativo → diagnóstico
focado "por que Luiza fechou negativo", e o caso do executor
sem-nome no Bloco Fixo). As 6 orelhas navegam nos dois projetos, sem
erro no console em nenhum dos dois, depois dos 2 bugs acima
corrigidos.

## Retomada em 2026-08-21 (parte 30) — Renomeações + reenquadramento pra "Etapa Detalhamento" + tabela única com filtro

**Pedido do usuário**: pediu explicitamente pra descrever TODAS as
mudanças antes de eu mexer no código ("Aguarde eu descrever todas as
mudanças requeridas para somente depois mexer na programação") — lista
acumulada em várias mensagens, só implementada no final quando disse
"implemente os pedidos". Mudanças:

1. Orelha "Desempenho" → **"DETALHAMENTO - ANÁLISE PRODUTIVIDADE"**;
   orelha "Distribuições" → **"DETALHAMENTO - ANÁLISE FINANCEIRA"**
   (`index.html`, mais o texto de apoio do painel Diagnóstico e o
   eyebrow do masthead do relatório, que citavam os nomes antigos).
2. Na aba Desempenho, os 4 cartões de KPI do topo foram **reenquadrados
   pra falar da Etapa Detalhamento especificamente**, não do projeto
   inteiro (antes já dava quase na mesma, por coincidência dos dados —
   agora é explícito e correto mesmo se outra Etapa um dia tiver
   hora): "Horas" → "Horas Consumidas"; "Custo Real" → "CUSTO DO
   DETALHAMENTO", comparando contra `fin.verbaDetalhamentoBruta` (a
   verba designada à Etapa) em vez da soma das 5 etapas; "Conclusão" →
   "% CONCLUÍDA"; "Resultado do Projeto" → "Resultado da Etapa",
   virou um cartão com 2 valores (Saldo de Horas = Previsto −
   Realizado, Saldo de Verba = Verba − Custo — mesmo sentido dos dois,
   positivo = sobrou = bom).
3. **As 4 tabelas fixas (Por Etapa/Pavimento/Tarefa/Executor) viraram
   1 tabela só com um `<select>` "Agrupar por"** — pedido do usuário:
   "planilhas de desempenho... com filtros suficientes... de acordo
   com a vontade de quem estiver manipulando". `trocarDimensaoDesempenho()`
   troca só o conteúdo de `#desemp-tabela-filtravel` reaproveitando
   `tabelaDesempenho()` que já existia — nenhum cálculo novo, só
   reduz de 4 chamadas fixas pra 1 dinâmica. Cache simples
   (`desempCacheFiltro`, variável de módulo) guarda o `tab`/
   `pctBonificacao` já calculados pra trocar de dimensão sem
   recalcular a árvore inteira de novo. Default: "Tarefa" (já vinha
   ordenada por maior desvio, mais acionável como primeira vista).
4. Na aba Bonificação: "Bloco Fixo" → **"BLOCO ANÁLISE"**; "Pool de
   Horas de Detalhamento" → **"VERBA DETALHAMENTO"**, virou cartão de
   3 valores (Custo Previsto = `poolVerba`, Custo Realizado =
   `poolCusto`, "Desempenho" = a diferença); "Margem do Escritório" →
   **"Verba de Fundos"**, virou cartão de 2 valores (Fundo Garantidor,
   Fundo para Distribuição) em vez de 1 número combinado. Nova função
   `kpiCardMultiplo(rotulo, itens)` — cartão de KPI com N valores
   empilhados em vez de 1 número + comparativo, reaproveita as classes
   `desemp-desvio-bom/ruim` já existentes pra colorir cada item.
5. **Regra de cálculo nova**: o Fundo Garantidor passa a absorver o
   "Desempenho" da Verba Detalhamento (Custo Previsto − Custo
   Realizado) — sobrou verba? soma ao Fundo Garantidor; estourou?
   desconta dele. Implementado em `calcularBonificacaoProjeto()`:
   `valorFundoGarantidor = fin.valorFundoGarantidor + poolLucro`
   (`poolLucro` = `poolVerba − poolCusto`, já existia). O Fundo de
   Distribuição de Lucros NÃO entra nessa regra. Como
   `calcularDistribuicoesProjeto()` já reaproveita `bonif.margemEscritorio`
   pra legenda da barra segmentada, o valor ajustado se propaga
   automaticamente pra lá também — não precisou tocar em
   `renderizarDistribuicoesProjeto()`.
   (Pedido intermediário de listar Fundo Garantidor/Fundo para
   Distribuição dentro do painel "% Bonificação" foi cancelado pelo
   próprio usuário antes de eu implementar — não confundir com o item
   4 acima, que é em outro cartão.)

**Verificação**: `node --check` limpo. Testado em Node isolado
(mesmo harness `vm`) especificamente a fórmula nova — Fundo Garantidor
original (R$ 2.736,99, com 17% de imposto) + poolLucro (−R$ 1.293,87)
= R$ 1.443,12, bateu exato com o valor calculado pela função. Testado
no navegador local: as 6 orelhas com os nomes novos, os 4 cartões de
Desempenho mostrando os valores da Etapa Detalhamento (Saldo de Horas
e Saldo de Verba corretos e com a cor certa), o filtro "Agrupar por"
testado nas 4 dimensões via `dispatchEvent('change')` — cada uma
renderizou as colunas certas, só "Executor" com a 8ª coluna
Bonificação — e a aba Bonificação com os 3 cartões novos (BLOCO
ANÁLISE, VERBA DETALHAMENTO com os 3 valores, Verba de Fundos com os
2 valores, Fundo Garantidor batendo com a conta manual). Sem erro no
console, testado também no AP Praia (projeto bem diferente) sem
quebrar. Durante o teste, percebido que o projeto Home Garden já
estava salvo com Impostos=17% (não mais 23%) — o usuário aparentemente
já corrigiu isso por fora, testando localmente como sugerido — a nota
das partes 26/27 sobre esse valor estar desatualizado não vale mais.

## Retomada em 2026-08-24 (parte 31) — Tela inicial por papel + ano no histórico de valor-hora

Dois pedidos pequenos e independentes, sem relação com a reforma
Desempenho/Bonificação da parte 30.

1. **Tela inicial pós-login por papel** (`js/core.js`,
   `abrirTelaInicialPorNivel()`): Analista e Administrador agora abrem
   direto na tela de seleção de projetos (a mesma do item "📁 Projetos"
   do menu, `alternarModulo('arvore')` →
   `renderizerProjetosParaSelecaoArvore()`), em vez do Kanban.
   Detalhista, Estagiário (ambos `nivel='executor'`) e Supervisor
   continuam abrindo direto no Kanban, como já era desde a reversão
   registrada em partes anteriores. Reaproveitou 100% de infraestrutura
   já existente — essa tela de seleção já filtrava certo por
   `obterNomesProjetosPermitidos()` (Analista vê só os projetos onde é
   `projeto.analista`; Administrador não tem filtro nenhum, então vê a
   lista completa — não existe conceito de "projeto designado" pra
   Administrador no modelo de dados, então "a relação de projetos aos
   quais está designado" foi interpretada, pra esse papel, como a lista
   toda). Nenhuma outra função precisou mudar.

2. **Ano no histórico de valor-hora** (`js/cadastros.js`,
   `renderizarTabelaHistoricoValorHora()`): a coluna "Vigente desde" da
   tabela de histórico de valor-hora no Cadastro de Funcionário estava
   usando `formatarDataPrevistaExibicao()` (js/feriados.js), que
   propositalmente omite o ano (formato `DD/MM`, pensado pra outro
   contexto). Trocado por uma formatação própria, só nessa função, que
   quebra o ISO (`AAAA-MM-DD`, vindo do `<input type="date">`) em
   `DD/MM/AAAA` — sem tocar em `formatarDataPrevistaExibicao()`, que
   continua igual pros outros usos dela. O dado em si (com ano) já era
   salvo certo desde antes; só a exibição estava cortando o ano.

**Verificação**: `node --check` limpo nos dois arquivos. Testado no
navegador local via `javascript_tool` (evitando `read_page`, que nesse
app retorna elementos de painéis ocultos também — ver nota de método
já registrada nesta sessão): simulado login como Administrador,
Analista, Executor (Detalhista) e Supervisor via `usuarioLogado` +
`abrirTelaInicialPorNivel()` — Administrador e Analista abriram
`panel-arvore-projetos` (Administrador com os 10 projetos completos,
Analista com só 4, filtro batendo), Executor e Supervisor abriram
`panel-kanban`, como esperado. Histórico de valor-hora testado com
duas entradas (`2026-08-24` e `2025-01-05`) — renderizou
"24/08/2026" e "05/01/2025", ordenado por mais recente primeiro. Sem
erro no console em nenhum dos dois testes.

## Retomada em 2026-08-24 (parte 32) — Relatórios: agrupar por Tarefa/Data/Pavimento + ordenar colunas

Dois pedidos no motor genérico de Relatórios (`js/relatorios.js`,
tela "Relatórios" → tipo "Genéricos", não a tela fixa "Relatório de
Custos", que não foi tocada).

1. **Novos campos de agrupar**: `NIVEIS_RELATORIO.sessao.camposAgrupar`
   ganhou `'pavimento'`, `'tarefa'` e `'data'` (antes só tinha
   projeto/etapa/cliente/executor); `NIVEIS_RELATORIO.tarefa.camposAgrupar`
   ganhou `'tarefa'` e `'dataInicioReal'` (além de já ter status). Só
   acrescentou entradas no catálogo — os 3 campos novos já existiam
   como COLUNA em cada nível (só não apareciam como opção de
   agrupamento); a UI (`renderizarChipsAgruparRelatorio()`) já lê o
   rótulo certo automaticamente de `def.colunas`, sem precisar de
   nenhuma outra mudança. "Avanço de Projeto" não ganhou nada (não tem
   coluna de Tarefa nem Data nesse nível).

2. **Ordenar por coluna** (pedido: "classificar cada coluna por ordem
   de apresentação"): cabeçalho da tabela do motor genérico agora é
   clicável — 1º clique ordena ascendente, 2º clique na MESMA coluna
   inverte pra descendente, clicar noutra coluna troca e volta a
   ascendente (padrão de planilha), com seta ▲/▼ no rótulo e destaque
   visual (fundo azul-claro + borda inferior ciano) na coluna ativa.
   Nova função pura `ordenarLinhasRelatorio(linhas, coluna, direcao)`
   (compara como número pra tipo numero/horas/moeda/percentual,
   `localeCompare('pt-BR')` pro resto — inclusive `tipo:'data'`, que
   compara como texto mas funciona certo porque ISO AAAA-MM-DD já
   ordena igual lexicograficamente e numericamente) — aplicada em
   `renderizarTabelaRelatorio()` sobre as linhas JÁ filtradas/agrupadas,
   ANTES de desenhar a tabela. Estado (`relOrdenacao`) não entra em
   Visão salva de propósito (é uma releitura rápida da mesma consulta,
   não uma configuração persistente) — reseta ao trocar de Nível ou
   carregar uma Visão, igual já acontecia com filtros/colunas/agrupar.

**Verificação**: `node --check` limpo. Testado em Node isolado (script
novo `teste_relatorios_ordenar_agrupar.js`) as funções puras
`ordenarLinhasRelatorio` (asc/desc, texto/número, não muta o array
original, sem coluna = passa direto) e `agruparLinhasRelatorio` com
`'tarefa'`/`'data'` como chave, batendo exato com a soma esperada à
mão. Testado no navegador local com dados reais (AP Praia): grupos por
Tarefa (13 linhas, nomes reais tipo DT_Blocos/LC_Blocos), por
Pavimento (TÉRREO/SUBSOLO/G1 com Horas/Custo somados) e por Data (80
linhas) no nível Sessão; por Tarefa no nível Tarefa também (23 linhas).
Ordenação testada na coluna Horas (asc: 0.0h→166.0h, desc: invertido) e
na coluna Tarefa (asc alfabética, ex: DT_Blocos antes de LC_Blocos),
com a seta e a classe `.ativo` mudando junto. Sem erro no console.
(Nota de método: o navegador de preview local desta sessão ficou com
cache agressivo pra `js/relatorios.js`/`estilos.css` — `curl` direto no
servidor sempre trouxe o arquivo certo, então não é um bug do app; só
precisou buscar o conteúdo fresco via `fetch(..., {cache:'no-store'})`
e rodar num escopo isolado (`new Function`) / injetar como `<style>`
novo pra testar de verdade, em vez de confiar no `<script src>`/`<link>`
normal da página durante os testes.)

## Retomada em 2026-08-24 (parte 33) — Bug: "Valor da Hora" sumia quando o Relatório Personalizado estava agrupado

Reportado pelo usuário: "mesmo selecionando o valor da hora no filtro
colunas a exibir, o valor da hora considerado para cada tarefa não
aparece". Reproduzido: sem agrupamento a coluna "Valor da Hora"
aparecia certa (ex: R$ 20,00); ligando qualquer agrupamento (ex:
"Agrupar por: Tarefa") ela virava "—" em toda linha. Causa raiz: essa
coluna nunca foi `somavel` (somar taxas não faz sentido) nem é campo
de agrupamento — `agruparLinhasRelatorio()` só carrega no grupo os
campos que são chave OU estão em `camposSoma`, então qualquer outro
campo simplesmente não sobrevive ao agrupamento.

Correção em `js/relatorios.js`: a coluna `valorHora` do catálogo
(`NIVEIS_RELATORIO.sessao.colunas`) ganhou `derivarDoGrupo: (g) =>
(g.horas > 0 ? g.custo / g.horas : null)` — não é a média ingênua das
taxas dentro do grupo (que poderia distorcer se um executor tiver mais
sessões que outro), é a MÉDIA PONDERADA de verdade: Custo do grupo
inteiro ÷ Horas do grupo inteiro, que dá exatamente "quanto custou por
hora, em média, esse grupo" — usa os mesmos `custo`/`horas` que já
foram somados pelo agrupamento (por isso só funciona se as colunas
Custo e Horas também estiverem marcadas; sem elas, sem dado pra
calcular, mostra "—" mesmo, que é o correto). `montarResultadoRelatorio()`
roda essa fórmula em cada coluna do catálogo que tiver
`derivarDoGrupo`, só QUANDO há agrupamento ativo e só pra colunas que
não são elas mesmas a chave do agrupamento (linha sem agrupar já tem o
valor exato da sessão original — não precisa, e não deve, recalcular:
uma sessão de 0h recalculada por essa fórmula viraria "—" por engano,
em vez de mostrar o valor real que ela tinha). Padrão genérico —
qualquer outra coluna futura que precise de um "resumo" ao agrupar (em
vez de suma ou "—") pode usar o mesmo mecanismo, só declarando
`derivarDoGrupo` no catálogo.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_relatorios_valorhora_derivado.js`): grupo com 2 sessões (3h a
R$20 + 2h a R$25) deu Valor da Hora = R$22,00 (bate a conta manual:
(60+50)/5); grupo de 1 sessão só manteve o valor original (R$30);
sem agrupamento nenhuma linha foi recalculada (mantiveram 20/25/30);
grupo com Horas=0 deu `null` (não `NaN`/`Infinity`) — todos batendo
exato com o esperado. Testado no navegador local (AP Praia) agrupando
por Tarefa: "DT_Vigas" mostrou R$ 31,85 (média ponderada real,
diferente de qualquer taxa nominal única, porque a tarefa atravessou
sessões com valor-hora diferente) em vez de "—". Sem erro no console.

## Retomada em 2026-08-24 (parte 34) — Valor da Hora vira valores REAIS (não média) + bug grave: Horas Realizadas zeradas no nível Tarefa

Duas correções em `js/relatorios.js`, a 2ª (Horas Realizadas) bem mais
séria que a 1ª — achado durante o teste da parte 33.

1. **Valor da Hora: parou de inventar média, agora mostra os valores
   REAIS**. O usuário corrigiu a solução da parte 33 (que mostrava uma
   média ponderada Custo÷Horas do grupo): "Você deve mostrar o valor
   da hora de cada apontamento. Esse valor da hora deve ser aquele
   cadastrado no cadastro de funcionários" — ou seja, nunca um número
   sintético, sempre uma taxa que REALMENTE foi usada em algum
   apontamento. `agruparLinhasRelatorio()` (motor genérico) ganhou
   `_linhas` em cada grupo — as linhas originais que caíram ali, não só
   a soma — permanecendo genérica (não sabe nome de nenhum campo
   específico). `derivarDoGrupo` da coluna `valorHora` agora olha os
   valores REAIS de `g._linhas`: grupo com 1 taxa só → mostra ela igual
   antes (é "aquele cadastrado", só que 1 grupo = 1 taxa); grupo com
   taxas diferentes (reajuste no meio da tarefa, ou mais de 1 executor)
   → lista TODAS as taxas reais separadas por "/" (ex: "R$ 31,25 / R$
   33,77"), nunca inventa uma média. `formatarValorColuna()` ganhou um
   "escape" (`{__texto: '...'}`) pra esse caso — sem ele, o
   `parseFloat()` da formatação normal de moeda cortaria pro primeiro
   número e perderia o resto do texto.

2. **BUG achado ao testar: "Horas Realizadas" sempre 0h no nível
   Tarefa, mesmo com sessões reais registradas.** Reportado pelo
   usuário com print de tela (Home Garden, agrupado por Tarefa — Horas
   Previstas aparecia certo, Horas Realizadas sempre "0.0h"). Causa
   raiz: `coletarLinhasTarefa()` lia `tarefa.horas_reais` — um campo
   CACHEADO/derivado (ver `apontamento.js:20-23`,
   `recalcularHorasReais()`) que deveria sempre espelhar a soma de
   `tarefa.sessoes_trabalho`, mas foi encontrado **dessincronizado em
   dados reais**: nas 36 tarefas do Home Garden que têm sessão, as 36
   estavam com `horas_reais` errado (a maioria zerada mesmo tendo
   dezenas de horas reais de sessão — ex: DT_Vigas com 6
   sub-tarefas somando 166h de sessões reais, todas com
   `horas_reais: "0.0"`); no AP Praia, 3 tarefas divergentes, inclusive
   uma com `horas_reais` MAIOR que a soma das sessões (16,68 vs 4,00) —
   não é só "sempre zero", é uma dessincronia genuína, provavelmente
   resíduo de antes da reforma que tornou o campo "sempre recalculado".
   **Correção só no relatório**: `coletarLinhasTarefa()` parou de
   confiar em `tarefa.horas_reais` e passou a somar
   `tarefa.sessoes_trabalho` direto, a mesma fonte robusta que
   `calcularCustoRealTarefa()` (por isso "Custo Real" nunca teve esse
   bug) e `coletarLinhasSessaoTrabalho()` (nível Sessão) já usam — imune
   a qualquer futura dessincronia do campo cacheado.
   **NÃO CORRIGIDO** (fora do escopo pedido, avisado ao usuário): o
   campo `tarefa.horas_reais` em si continua desatualizado nos dados de
   produção — isso pode afetar outras telas que leem esse campo direto
   (Kanban — total de horas por executor, BI/Calibração, "Total: Xh" em
   Atribuição de Tarefas, aprovações de calendário). Fica pendente uma
   decisão do usuário sobre investigar a causa (por que
   `recalcularHorasReais()` não pegou essas sessões?) e/ou rodar uma
   correção nos dados existentes.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_relatorios_fix2.js`): grupo com MESMA taxa (2 sessões a R$20)
manteve 20 (valor real, não recalculado); grupo com taxas DIFERENTES
(R$20 + R$25) devolveu `{__texto:"R$ 20,00 / R$ 25,00"}`, formatado
igual; sem agrupar manteve os valores originais (20, 25) — tudo batendo
exato. Testado no navegador local com dados reais: nível Tarefa,
agrupado por Tarefa, "DT_Vigas" passou a mostrar 166.0h de Horas
Realizadas (batendo EXATO com o mesmo total já visto no nível Sessão
agrupado por Tarefa, parte 33) em vez de 0.0h; nível Sessão, mesma
tarefa, "Valor da Hora" passou a mostrar "R$ 31,25 / R$ 33,77" (2
taxas reais distintas) em vez da média inventada R$ 31,85 da parte 33.
Sem erro no console nos dois testes.

## Retomada em 2026-08-24 (parte 35) — Investigação e correção de dados: `horas_reais` dessincronizado (produção, Firebase)

Pedido do usuário: investigar a causa da dessincronia achada na parte
34. Não mexeu em nenhum arquivo do repositório — é 100% correção de
DADOS, feita direto no Firebase de produção
(`precisao-estrutural-default-rtdb`) via a própria sincronização já
embutida no app (qualquer `localStorage.setItem` é interceptado e
propagado, ver `sync-provisorio.js` §5/§6).

**Causa raiz confirmada**: o código atual (`js/apontamento.js`) está
correto — as 5 únicas funções que tocam `sessoes_trabalho`
(play/pause, sessão manual, editar, remover, forçar pausa) chamam
`recalcularHorasReais()` logo em seguida, sempre; usando o app pela
interface é impossível gerar essa dessincronia. A causa é EXTERNA:
dados escritos direto no banco, fora do app. Evidência forte no Home
Garden: as 36 tarefas divergentes tinham 100% das sessões com
`manual: true` e `horas_reais` travado em `"0.0"`, datas de set/2025 a
jul/2026 — padrão clássico de um script de importação que escreveu
`sessoes_trabalho` direto (reproduzindo até a flag `manual`) mas nunca
recalculou o campo cacheado; o projeto tem um arquivo
`DANIEL_HOME_GARDEN_SETOR_C_reorganizado.xlsx` na pasta (Daniel é o
executor de todas as sessões afetadas) — provável origem. No AP Praia,
só 3 tarefas com padrão mais heterogêneo (uma com `horas_reais` MAIOR
que a soma das sessões) — indício de edições pontuais direto no banco,
não uma reimportação completa. Descartado `js_estacionado/timesheet_executor.js`
(a versão antiga que escrevia `horas_reais` direto sem depender de
sessão) como causa atual — confirmado que não está em
`SYNC_PROVISORIO_SCRIPTS_APP`, ou seja, não é carregado pelo app.

**Correção aplicada** (confirmada pelo usuário antes de rodar): script
rodado no console do navegador, conectado ao Firebase real, que
percorre TODAS as tarefas-folha de TODOS os projetos e chama
`recalcularHorasReais(tarefa)` (a mesma função oficial usada em toda
edição de sessão pela interface — não uma reimplementação) em cada uma
que tem `sessoes_trabalho`; só depois disso grava e força o envio
imediato (`_syncEnviarAgora()`, sem esperar o debounce de 3s). Não
mexeu em nenhuma sessão, só no campo cacheado. Fora do escopo desta
correção, de propósito: `horas_revisao`/`sessoes_revisao` (trilha
paralela de Revisão/Conferência) não foi verificada nem tocada — o
usuário só reportou o problema na trilha de Execução.

**Verificação**: dry-run primeiro (só leitura, sem gravar) — achou 39
tarefas divergentes em 2 projetos (Home Garden 36, AP Praia 3), soma
total de Horas Realizadas cacheadas = 49,18h contra o valor real de
469,51h. Rodou a correção → 39 tarefas corrigidas. Confirmado
DIRETO NO SERVIDOR (`_syncFirebaseRef.once('value')`, não só no
localStorage local) que a gravação chegou: DT_Vigas (Home Garden)
mostrando `horas_reais: "42.17"` no Firebase. Reconferência completa
pós-correção, lendo de novo direto do servidor: **zero tarefas
divergentes restantes** em todos os projetos. Sem erro no console.

## Retomada em 2026-08-24 (parte 36) — Relatório de Custos: árvore ganha nível Executor dentro da Tarefa

Pedido do usuário: "permitir ampliar o menu em cascata da tarefa,
colocando também cada executor(es), tempo e custo" — a árvore
Projeto→Etapa→Setor→Pavimento→Tarefa do Relatório de Custos (tela
fixa, `exibirRelatorioCustos()`) não expandia além de Tarefa.

`js/relatorios.js`: `NIVEIS_ARVORE_CUSTO` ganhou `'executor'` como 6º
nível (era `['projeto','etapa','setor','pavimento','tarefa']`, virou
`[...,'tarefa','executor']`), e `agruparArvoreCustoRelatorio()` passa
esse nível a mais pra `construirNoArvoreCustoRelatorio()`. Como o
motor da árvore inteiro (cabeçalho de 2 linhas com um par Tempo/Custo
por nível, recursão de agrupamento, indentação, seta de expandir) já
era genérico em cima dessa lista, não precisou tocar em mais nada da
lógica — só cresceu de 5 pra 6 pares de coluna sozinho. `executor`
nunca cai no caso "nível pulado" (sessão sem executor não existe,
`coletarLinhasSessaoTrabalho()` já garante isso), então toda Tarefa
com sessão sempre expande em pelo menos 1 Executor (1 executor só =
não é bug, só menos interessante de abrir). Nome do executor exibido
com `nomeParaExibicao()` (mesmo codinome que o resto do sistema usa) —
mas o AGRUPAMENTO continua pela string bruta, pra não juntar por
engano duas pessoas com o mesmo apelido.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_arvore_custo_executor.js`): árvore de 3 sessões (2 executores
numa tarefa, 1 na outra) bateu exato — Tarefa 1 somou 5h/R$140 e virou
pai de 2 executores (3h/R$90 e 2h/R$50), Tarefa 2 virou pai de 1 só.
Testado no navegador com TODOS os dados reais (sem filtro): cabeçalho
já nasce com 6 pares Tempo/Custo incluindo "Executor"; expandiu em
cascata até um executor de verdade (Home Garden) e bateu com o
esperado; validação automática rodou nas 41 tarefas reais que têm
sessão no banco inteiro — em 100% delas a soma dos executores-filhos
bate exato com o total da Tarefa-mãe (0 inconsistências) e nenhum
executor apareceu com neto (sempre folha, como esperado). Sem erro no
console.

## Retomada em 2026-08-24 (parte 37) — Relatório de Custos ganha filtros por Setor/Pavimento/Tarefa e por Papel do executor

Dois pedidos em sequência do usuário, ambos na tela fixa "Relatório de
Custos".

1. **"Acrescente neste relatório também um filtro cada um dos níveis
   da estrutura de projeto"** — a árvore (parte 36) já tinha os 6
   níveis (Projeto/Etapa/Setor/Pavimento/Tarefa/Executor), mas o painel
   de filtro só tinha Projeto/Etapa/Cliente/Executor — Setor,
   Pavimento e Tarefa não davam pra filtrar direto. Acrescentados os 3
   `<select>` que faltavam (`index.html`, mesmo padrão visual dos
   existentes) + `renderizarOpcoesFiltroRelatorioCustos()` populando os
   3 com valores distintos reais + `lerFiltrosRelatorioCustos()` /
   `limparFiltrosRelatorioCustos()` lendo/limpando os 3. Como
   `coletarLinhasSessaoTrabalho()` já carregava `setor`/`pavimento`/
   `tarefa` em cada linha (usados só pra montar a árvore até agora), só
   precisou ensinar o motor de filtro **genérico e compartilhado**
   `aplicarFiltrosRelatorio()` a reconhecer esses 3 campos — automático
   e sem risco pro "Relatório Personalizado" (que usa a mesma função,
   simplesmente não passa esses filtros se não tiver os campos na
   tela).

2. **"Filtros também por administrador, supervisor, analista,
   detalhista, estagiário"** — pedido logo em seguida, no meio da
   implementação do item 1. Novo filtro "Papel" com essas 5 opções
   FIXAS (lista `PAPEIS_FUNCIONARIO_OPCOES`, mesmo espírito do
   `STATUS_TAREFA_OPCOES` do motor genérico — sempre aparecem todas,
   mesmo sem dado atual de alguma). Como "papel" não é um campo que já
   existe na sessão, nova função `papelFuncionarioRelatorio(nome)`
   busca o funcionário em `banco_funcionarios` e classifica: `nivel`
   'administrador'/'supervisor'/'analista' viram o próprio papel
   direto; `nivel` 'executor' olha o `cargo` (mesmo prefixo que
   `funcionarioEhEstagiario()`, distribuicao-lucro.js, já usa) pra
   separar 'detalhista' de 'estagiario'. Funcionário não encontrado ou
   com cargo fora desses 2 prefixos devolve `null` (não quebra nada, só
   não aparece se um papel específico for escolhido no filtro). Esse
   papel é calculado e gravado (`l.papel`) em cada linha já dentro de
   `coletarLinhasSessaoTrabalho()`, e o motor genérico ganhou mais um
   `if (filtros.papel ...)`.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_filtros_custos_papel.js`) com um `banco_funcionarios` fake de 6
pessoas (1 de cada papel + 1 sem cargo reconhecido) — os 5 papéis
classificados certo, os 2 casos sem-match deram `null` como esperado;
filtro por papel/setor/pavimento/tarefa isolando exatamente a linha
certa em todos os 4 testes. Testado no navegador com dados reais (via
`fetch({cache:'no-store'})` + `new Function`, contornando o cache
agressivo do navegador de preview local desta sessão — os 4 selects
novos foram injetados manualmente no DOM só pro teste, já que o
`index.html` também estava servindo versão cacheada): os 4 filtros
novos populam certo (Papel com as 5 opções fixas; Pavimento/Tarefa com
valores reais; Setor só com "—", porque os projetos reais não usam
esse nível — não é bug); filtro por Tarefa="DT_Vigas" isolou
exatamente essa tarefa (54 linhas); filtro por Papel="detalhista"
isolou 126 linhas, todas de executores que a função classificou
corretamente como detalhista (Luiza Crestani, Daniel de Carvalho
Araujo); filtro por Papel="estagiario" corretamente deu 0 linhas (não
tem estagiário nos dados atuais). Um erro solto apareceu no console
durante o teste, rastreado até um item de menu completamente não
relacionado ("Distribuição de Lucro (Estagiários)", `index.html`
linha 48) — confirmado como resquício de sessão anterior, não algo
causado por este código (os testes limpos, rodados depois, não geraram
nenhum erro novo).

## Retomada em 2026-08-24 (parte 38) — Filtro de Papel revertido + "Salvar Visão" no Relatório de Custos

Retorno do usuário logo depois da parte 37, com 3 pontos:

1. **"O filtro por papel não é necessário. Quando escrevi Estagiário,
   queria dizer executor."** — revertido por completo: apagados
   `papelFuncionarioRelatorio()`, `PAPEIS_FUNCIONARIO_OPCOES`, o campo
   `l.papel` em cada linha de `coletarLinhasSessaoTrabalho()`, o
   `if (filtros.papel...)` no motor genérico, o `<select>` no
   `index.html` e toda referência em
   ler/limpar/renderizar-filtros-de-Custos. Confirmado com `grep` que
   não sobrou nenhuma menção a "papel" no código. Os filtros de
   Setor/Pavimento/Tarefa da parte 37 (que continuam fazendo sentido)
   não foram tocados.

2. **Observação do usuário**: "com todos os filtros aplicados nesta
   aba, fica sem sentido uma aba específica pra relatórios
   personalizados" — poderia ser substituído por "Salvar Visão" dentro
   de Custos. Como isso implicaria PERDER capacidades que só existem
   no motor genérico (nível "Avanço de Projeto", nível "Tarefa" com
   Previsto×Realizado/Desvio%, agrupamento livre por múltiplos campos —
   nada disso existe em nenhum outro lugar do sistema), perguntei antes
   de mexer. Usuário decidiu: **manter as duas abas por enquanto**,
   decisão de remover Personalizado fica pra outra hora, com mais
   análise.

3. **"Salvar Visão" implementado só dentro de Custos** (sem tocar em
   Personalizado): nova barra `.barra-visoes` (mesmo componente visual
   que Personalizado já usa) no topo de `#rel-conteudo-custos`, com
   seletor de visão salva + botão "💾 Salvar visão atual" + botão
   "🗑️ Apagar visão". Banco **dedicado**
   `banco_relatorios_custos_visoes` (não o mesmo
   `banco_relatorios_visoes` do motor genérico) — decisão deliberada:
   uma "visão" de Custos só precisa guardar os filtros (Projeto/Etapa/
   Setor/Pavimento/Tarefa/Cliente/Executor/datas), sem Nível/Colunas/
   Agrupar, formato mais simples e sem misturar visões pensadas pra
   telas diferentes. Novas funções (espelhando 1:1 o padrão que
   `salvarNovaVisaoRelatorio`/`apagarVisaoRelatorio`/
   `carregarVisaoSelecionadaRelatorio` já usam no motor genérico, só
   que mais simples): `carregarVisoesRelatorioCustos()`,
   `salvarNovaVisaoRelatorioCustos(nome, filtros)`,
   `apagarVisaoRelatorioCustos(id)`,
   `renderizarSeletorVisoesRelatorioCustos()`,
   `carregarVisaoSelecionadaRelatorioCustos()`,
   `salvarVisaoAtualRelatorioCustos()`,
   `apagarVisaoSelecionadaRelatorioCustos()`. Sem visão de fábrica
   pré-cadastrada (diferente do motor genérico) — lista nasce vazia,
   só o que o usuário salvar.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_visoes_custos.js`): banco vazio no início, salvar sem nome
falha com mensagem certa, salvar com nome guarda os filtros exatos,
apagar id inexistente falha, apagar id válido remove — todos batendo.
Testado no navegador (via `fetch({cache:'no-store'})` + `new Function`
+ injeção manual dos elementos novos no DOM, mesmo contorno de cache já
registrado nesta sessão): salvou uma visão com Projeto="HOME GARDEN -
SETOR C" + Tarefa="DT_Vigas" (nome via `prompt()` mockado) → apareceu
certo no menu, botão apagar ficou visível, filtros gravados batendo
exato; limpou os campos manualmente, reselecionou a visão salva →
Projeto e Tarefa voltaram certos e o relatório recarregou (1 projeto
encontrado, consistente); apagou a visão (`confirm()` mockado) → menu
voltou a "-- Nova consulta --", botão apagar sumiu, banco zerado. Sem
erro novo no console.

## Retomada em 2026-08-24 (parte 39) — Sincroniza modulos_isolados/relatorios/ (drift de ~9 partes, desde 13/08)

Achado ao concluir a parte 38 e revisar a regra estabelecida no
próprio `prompt_gemini.md`/memória: "toda mudança nos arquivos
principais deve ser replicada em `modulos_isolados/<módulo>/`" não
vinha sendo seguida pra `relatorios.js` desde a reforma da parte 30 —
9 partes de mudança acumuladas sem sincronizar. Avisado ao usuário, que
pediu pra sincronizar agora.

**O que estava desatualizado, além do JS**: o `index.html` isolado era
de ANTES da própria existência da tela "Relatório de Custos" (parte
16/18) — só tinha a UI do motor genérico ("Personalizado"), com um
`<select>` único de Agrupar (não os chips multi-campo da parte 32/33),
2 níveis só (faltava "Avanço de Projeto", parte 18) e nenhuma orelha
Custos/Personalizado. Não dava pra só copiar o `.js` por cima — o HTML
também precisava virar uma cópia fiel do bloco `#panel-relatorios`
atual do `index.html` principal (as 2 orelhas completas, com todos os
filtros/chips/árvore de custos/visões de cada uma).

**Sincronizado**: `index.html` isolado reescrito com o bloco
`#panel-relatorios` real, inteiro (mesmo harness de sempre por fora —
título, header de teste, `alternarModulo`); `relatorios.js` e
`estilos.css` copiados por completo. Verificando as dependências que
`relatorios.js` chama fora dele mesmo, achado que `core.js`,
`feriados.js` e `apontamento.js` isolados TAMBÉM estavam desatualizados
(faltavam `obterArvoresProjetosAtivas()`, entre outras) — sincronizados
os 3 também, mesmo padrão de cópia completa. `escapeHtml`/
`calcularProgressoProjeto` (usada só na "Avanço de Projeto", com
`typeof` guard) continuam fora do módulo isolado — vivem em
`desempenho-projeto.js`/`painel-progresso.js`, não carregados aqui;
sem risco de quebrar nada porque o código já lida com a ausência sem
crashar.

**Verificação**: `node --check` limpo nos 4 `.js` sincronizados.
Testado servindo o módulo isolado de verdade (`python -m http.server`
numa porta separada, não o `data:`/snapshot estático que a ferramenta
de preview usa pra arquivo local fora do projeto servido) — carregou,
`alternarModulo('relatorios')` abriu a orelha Custos ativa com todos
os filtros novos presentes (Setor/Pavimento/Tarefa/Visão); salvar,
listar e apagar Visão testados de ponta a ponta dentro do harness
isolado, todos batendo. Achado (e investigado) um erro de boot NÃO
relacionado — `core.js`'s `window.onload` chama `iniciarAppPosLogin()`
pra módulos isolados (comportamento já documentado no próprio
código-fonte, "não faz sentido exigir login numa página de teste de UM
módulo"), que tenta inicializar Cadastros
(`renderizarTabelaClientes`), tela que este harness nunca carregou —
confirmado como limitação estrutural PRÉ-EXISTENTE de todo módulo
isolado (não causada por esta sincronização), sem efeito na
funcionalidade real de Relatórios testada logo em seguida.

## Retomada em 2026-08-25 (parte 40) — Reforma das orelhas implementada (ícones reais, Detalhamento unificado, botão neutro)

Implementação do plano validado ao longo de várias rodadas de mockup
(ver memória do projeto `project_precisao_estrutural_orelhas_redesign`,
não repetida aqui em detalhe) — pedido original: "os contornos poderiam
ser mais destacados, os ícones maiores e com algum desenho/imagem
representando-o além da descrição".

**index.html**:
1. `#orelhas-projeto-ativo` trocou a classe `.tab-bar` por `.orelhas-bar`
   própria (o sublinhado de baixo não fazia sentido pra um grid de
   botões) — os 6 antigos `.tab-selector` (emoji + texto) viraram 5
   `.orelha-btn` (imagem real de 42px + legenda pequena embaixo):
   Estrutura, **Orçamento** (renomeado de "Custos"), **Detalhamento**
   (unificação de "DETALHAMENTO - ANÁLISE PRODUTIVIDADE" +
   "DETALHAMENTO - ANÁLISE FINANCEIRA", que eram 2 orelhas de topo
   separadas), Diagnóstico, Bonificação. Ícones vêm de
   `assets/icones-orelhas/*.png` (arquivos reais do Flaticon, já
   salvos no repo numa rodada anterior de mockup desta mesma sessão —
   só precisou apontar o `<img>` pra eles).
2. `#panel-desempenho-projeto` e `#panel-distribuicoes-projeto`
   (Produtividade/Financeira) ganharam, cada um, um `.subaba-breadcrumb`
   (ícone de Detalhamento + nome) e um `.subaba-pill-track` com 2
   pílulas (Produtividade/Financeira) — clicar na pílula chama as
   MESMAS funções de navegação que já existiam
   (`irParaDesempenhoDoProjetoAtivo()`/`irParaDistribuicoesDoProjetoAtivo()`),
   sem precisar mexer em `desempenho-projeto.js` — os 2 painéis
   continuam existindo separados por baixo, só ganharam uma cascinha
   de navegação em comum por cima. Cada painel já nasce com a pílula
   certa marcada `active` (estático no HTML — não precisa de JS extra
   pra isso).
3. Rodapé de créditos (`Ícones: Flaticon.com`, linkado) acrescentado
   como último item dentro do 2º grupo de `<aside class="sidebar">`
   (depois de "Configurações") — colocar como filho desse grupo, e não
   como um 3º `<div>` irmão solto, foi necessário porque `.sidebar` usa
   `justify-content:space-between` nos 2 grupos existentes; um 3º
   irmão ia ficar espremido no meio, não no rodapé de verdade.

**js/core.js**: `atualizarOrelhasProjetoAtivo()` — as 2 antigas
constantes `orelhaDesempenho`/`orelhaDistribuicoes` viraram uma só
`orelhaDetalhamento` (`#orelha-detalhamento-projeto`), que fica `active`
tanto pra `abaAtiva === 'desempenho'` quanto `'distribuicoes'` (as 2
funções de navegação que setam esses valores não mudaram nada). Qual
pílula interna fica marcada ativa é decidido estaticamente no HTML de
cada painel, não aqui.

**estilos.css**: novo bloco de estilos — `.orelhas-bar`/`.orelha-btn`/
`.orelha-btn-legenda` (botão neutro: fundo branco, contorno cinza
2px em repouso, navy 3px + auréola ciano quando `.active` — o MESMO
par de cor que `.tab-selector.active` já usa em outro lugar do
sistema, não uma paleta nova por orelha — essa ideia foi testada em
mockup e descartada, competia com a cor que cada ícone real já trazia
sozinho); `.subaba-breadcrumb`/`.subaba-pill-track`/`.subaba-pill`
(sub-abas de Detalhamento, mesmo espírito neutro, um degrau abaixo);
`.sidebar-creditos`. Classes novas de propósito, não reaproveitando
`.tab-selector` — aquela classe continua servindo Distribuição de
Custos e Relatório Personalizado, que ficaram FORA do escopo desta
rodada (a reforma do sub-menu de Distribuição de Custos pro mesmo
estilo pílula+breadcrumb foi desenhada no mockup mas não pedida
explicitamente pra implementar agora — fica de fora até o usuário
confirmar que quer).

**Verificação**: `node --check` limpo em `js/core.js`. `grep` confirmou
zero referência sobrando aos ids antigos
(`orelha-desempenho-projeto`/`orelha-distribuicoes-projeto`) em
`js/`/`index.html`/`estilos.css`, e zero módulo isolado referencia essa
barra (não precisou sincronizar `modulos_isolados/` desta vez). Testado
no navegador com dados reais (Home Garden), servido num PORTO NOVO
(5603, não o 5601 de sempre) especificamente pra contornar o cache
agressivo já registrado nesta sessão pro navegador de preview local —
as 5 imagens reais carregaram (`naturalWidth: 512` cada, nenhuma
quebrada); clicar em "Detalhamento" abriu Produtividade por padrão com
a orelha e a pílula certas marcadas `active`; clicar na pílula
"Financeira" trocou pro painel de Distribuições mantendo a orelha
"Detalhamento" ativa (conteúdo renderizado de verdade, não vazio);
Orçamento/Diagnóstico/Bonificação testadas também, todas abrindo o
painel certo com a orelha certa acesa; rodapé de créditos presente com
o link certo. Screenshot confirma visualmente: 5 botões com ícone
colorido de verdade, contorno reforçado na ativa, pílulas de sub-aba,
crédito no rodapé da barra lateral. Sem erro no console.

**Fora do escopo desta rodada** (fica pra outra hora, se o usuário
quiser): restilizar o sub-menu de 4 abas da Distribuição de Custos
("Orçamento Global"/"Verba Global para Produção"/"Verba por
Pavimento"/"Verba por Tarefa") pro mesmo padrão pílula+breadcrumb que
Detalhamento ganhou — desenhado no mockup ("Opção 7 revisada") mas
não pedido explicitamente ainda.

## Retomada em 2026-08-25 (parte 41) — Corrige soma da coluna Verba somando etapas erradas na aba Detalhamento

Reportado pelo usuário: "a soma da coluna Verba deve ser somente a
soma das etapa[s] detalhamento. O número que está aparecendo é a soma
da verba de todas as etapas (descontada do Fundo Garantidor)".

Causa raiz em `js/desempenho-projeto.js`: `calcularLinhasFolhaComVerba()`
devolve as folhas do PROJETO INTEIRO (é uma função de escopo mais
amplo, reaproveitada por 5 lugares diferentes no arquivo). As outras
4 chamadas (linhas ~313/432/521/829 — Diagnóstico, Bonificação,
Distribuições) já filtram `.filter(l => l.pavimentoNome)` antes de
usar (só folha dentro de um Pavimento tem esse campo preenchido, e só
a Etapa Detalhamento tem Pavimento como nível — é o filtro "de fato"
que restringe a Detalhamento). `calcularTabelasDesempenho()` — a
função por trás da tabela única com filtro "Agrupar por" desta aba —
era a ÚNICA das 5 que esquecia esse filtro, então `totais.verba` (e
`totais.custo`) somavam as folhas de TODAS as etapas do projeto
(Pré-Lançamento, Lançamento, Análise, Cargas, Detalhamento), não só
Detalhamento — e "Agrupar por: Etapa"/"Executor" também vazavam
tarefas/pessoas de outras etapas pra dentro de uma aba que, desde a
reforma "DETALHAMENTO - ANÁLISE PRODUTIVIDADE", é inteiramente sobre a
Etapa Detalhamento.

**Correção**: uma linha — `calcularLinhasFolhaComVerba(nomeProjeto)`
virou `calcularLinhasFolhaComVerba(nomeProjeto).filter(l =>
l.pavimentoNome)` em `calcularTabelasDesempenho()`, igualando ao
padrão que as outras 4 chamadas já seguiam.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_verba_detalhamento_fix.js`, mesmo harness `vm` de sempre, dados
reais do Home Garden): `porEtapa` passou a mostrar SÓ 1 linha
("DETALHAMENTO", verba R$10.400,55) em vez de 5. A diferença restante
entre esse total e `fin.verbaDetalhamentoBruta` (R$10.947,95, o valor
BRUTO da etapa, mostrado no cartão "CUSTO DO DETALHAMENTO" no topo da
tela) não é um erro — é exatamente os 5% do Fundo de Distribuição de
Lucros já descontado na cascata pra Pavimentos (R$547,40 = 5% de
R$10.947,95, bate exato); a tabela sempre operou com a verba LÍQUIDA
por tarefa/pavimento, então a soma dela nunca deveria bater com a
verba BRUTA da etapa — são dois números diferentes e igualmente
corretos no mesmo funil financeiro, não uma inconsistência a mais pra
resolver. Confirmado o mesmo padrão (só 1 etapa, mesma proporção de
diferença ~5%) também no AP Praia, um segundo projeto real com números
totalmente diferentes. Testado no navegador local via
`fetch({cache:'no-store'})` + `new Function` (contornando o cache do
navegador de preview já registrado nesta sessão) nos dois projetos —
resultados idênticos aos do teste Node. Sem erro novo no console (o
único erro presente é o de sempre, não relacionado, já rastreado ao
item de menu "Distribuição de Lucro").

## Retomada em 2026-08-25 (parte 42) — Separa Produtividade/Financeiro nas sub-abas de Detalhamento + gráficos de horas

Pedido do usuário, decidido em detalhe por 3 perguntas (AskUserQuestion)
antes de implementar — ver
[[project_precisao_estrutural_detalhamento_separar_produtividade_financeiro]]
na memória do projeto pras 3 decisões completas. Resumo: "as
informações sobre produtividade e desempenho estão misturadas nas
orelhas [Produtividade/Financeira]... coloque desempenho medido por
horas/índices na aba Produtividade e os valores [dinheiro] todos na
Financeira. Use gráficos considerando as horas na Produtividade
usando como referência os gráficos que estão na Financeira. O resumo
financeiro deve estar na aba Financeiro."

**`js/desempenho-projeto.js`**:
1. `tabelaDesempenho()` (tabela única com filtro "Agrupar por" —
   Etapa/Pavimento/Tarefa/Executor) perdeu as colunas Verba/Custo/
   Bonificação — ficou só Previsto/Realizado/Índice/Desvio (horas).
   Parâmetro `pctBonificacao` removido (só existia pra alimentar a
   coluna de Bonificação que saiu); `trocarDimensaoDesempenho()` e
   `renderizarDesempenhoProjeto()` pararam de calcular/passar isso.
2. `renderizarDesempenhoProjeto()` (Produtividade): cartão "CUSTO DO
   DETALHAMENTO" removido; "Resultado da Etapa" (que tinha Saldo de
   Horas + Saldo de Verba) virou um cartão simples "SALDO DE HORAS"
   (só horas); bloco inteiro "Resumo financeiro" removido daqui
   (foi pra Financeira, item 4). **3 gráficos novos** de barra
   divergente (`distDivChart()`, mesmo componente que Financeira já
   usa pra lucro/resultado): "Desvio de horas por Executor/Pavimento/
   Tarefa", alimentados com Saldo de Horas (Previsto − Realizado,
   mesma convenção positivo=bom/negativo=ruim já usada no KPI) em vez
   de lucro, pior estouro primeiro (mesmo critério que "Diagnóstico
   por atividade" de Financeira já usa).
3. `distDivChart(linhas, formatarValor)` ganhou um 2º parâmetro
   opcional (formatador do número — padrão `formatarMoeda`, pra não
   quebrar as 3 chamadas antigas de Financeira) — os 3 gráficos novos
   passam um formatador de horas (`v => formatarNumero(v) + ' h'`) em
   vez de deixar formatar em R$ (a função tinha `formatarMoeda(...)`
   fixo no meio do código antes, precisou generalizar).
4. `renderizarDistribuicoesProjeto()` (Financeira): ganhou a seção
   "Resumo financeiro" (Valor do Contrato → Impostos → parcelas →
   Verba líquida por Etapa → Fundo Garantidor → cascata pra
   Pavimentos — mesmos dados de antes, `fin.*`), reescrita com a
   paleta `.dist-*` própria dessa página (não a antiga
   `.desemp-linha-fin`, que é de outra tela) — nova função auxiliar
   `distFinLinha()`, mesmo papel que a antiga `finLinha()` tinha.
   `finLinha()` ficou sem NENHUM uso em lugar nenhum do sistema depois
   dessa mudança (confirmado por busca no repo inteiro) — removida
   por completo, junto com as classes CSS que só ela usava
   (`.desemp-grid-financeiro`, `.desemp-linha-fin` e variantes,
   `.desemp-bloco-titulo`, `.desemp-tabela tr.desemp-destaque`).

**`estilos.css`**: as variáveis `--dist-*` e as classes de "seção com
painel" (`.dist-section`/`.dist-panel`) e "gráfico de barra divergente"
(`.dist-divchart`/`.dist-divrow`/`.dist-track`/...) — que antes só
valiam dentro de `#panel-distribuicoes-projeto` — passaram a valer
também em `#panel-desempenho-projeto` (`:is(...)`, mesmo padrão já
usado noutros pontos do arquivo pra estilo compartilhado entre 2
painéis) — é o MESMO CSS, não uma cópia, pra garantir que os gráficos
novos ficam visualmente idênticos aos de referência, sem risco de
divergir depois. Só as classes específicas do "relatório editorial"
(masthead, KPIs, barra segmentada, tech-row, callout) continuam
exclusivas de Financeira — não fazem sentido em Produtividade e não
foram estendidas (decisão já tomada: sem versão em horas da barra
segmentada). Novo bloco `.dist-fingrid`/`.dist-finha` (+ variantes
`.deducao`/`.subtotal`/`.emph`) pro "Resumo financeiro" que migrou pra
Financeira, escopado só a `#panel-distribuicoes-projeto`.

**Verificação**: `node --check` limpo. Node isolado (novo
`teste_separar_produtividade_financeiro.js`, dados reais do Home
Garden): confirmado que o HTML de Produtividade NÃO contém mais
"CUSTO DO DETALHAMENTO", "Saldo de Verba", "Resumo financeiro" nem
"Verba (R$)"; contém "SALDO DE HORAS" e as 3 seções de gráfico novas;
o HTML de Financeira contém "Resumo financeiro" e "Valor do Contrato"
certos. Conferido o trecho renderizado de um dos gráficos novos: valor
formatado em horas ("&minus; 69,75 h", não R$), meta batendo a conta
manual (previsto 37,50h, realizado 107,25h, diferença 69,75h). Testado
no navegador local (porta nova, 5604, pra fugir do cache de preview já
registrado nesta sessão) em 2 projetos reais (Home Garden e AP Praia):
KPIs de Produtividade batendo (Horas Consumidas/% Concluída/Saldo de
Horas, sem nada de dinheiro), os 3 gráficos aparecendo com o MESMO
visual das seções de referência de Financeira (fundo pontilhado,
barras vermelho/verde, tipografia condensada — confirmado por
screenshot), "Resumo financeiro" aparecendo dentro de Financeira com o
novo estilo `.dist-finha` (Detalhamento em negrito/destaque). Sem erro
no console nos dois projetos.

## Retomada em 2026-08-25 (parte 43) — Verba por Tarefa: grade em 3 colunas + pavimentos recolhidos por padrão com totalização no título

Pedido do usuário: "Na Aba Orçamento - Verba por Tarefa, Distribua as
tarefas em 3 coluna ao invés de 4 e, quando abrir a aba, mostrar os
pavimentos recolhidos por default e com a totalização de Pontos e
valor na Linha do título do pavimento."

**`estilos.css`**: `.vt-grid` deixou de usar
`repeat(auto-fit, minmax(360px, 1fr))` (que em telas largas abria 4+
colunas) e passou a `repeat(3, minmax(0, 1fr))` fixo, com 2 media
queries novas (`max-width:1100px` → 2 colunas, `max-width:700px` → 1
coluna) pra manter o comportamento responsivo que já existia antes,
só com o teto em 3. `.vt-card-header` virou `display:flex;
justify-content:space-between` pra acomodar a nova totalização
alinhada à direita; nova classe `.vt-card-header-totais` (peso normal,
cinza, 11px).

**`js/distribuicao-custos.js`** (`carregarAbaVerbaPorTarefa()`):
1. Convenção de recolhimento invertida — antes `undefined` (nunca
   clicado) contava como EXPANDIDO e só `true` explícito recolhia;
   agora `undefined` conta como RECOLHIDO (padrão ao abrir a aba) e só
   `false` explícito (usuário clicou pra abrir) expande.
   `alternarGrupoVerbaPorTarefa()` ajustada pro mesmo critério
   (`!== false` em vez de `=== true`).
2. Cabeçalho do cartão de cada pavimento ganhou um `<span>` à direita
   com `total de Pontos das tarefas daquele pavimento` + `pav.valorVerba`
   (o mesmo Valor da Verba que a aba anterior calculou pro pavimento —
   não recalculado, é a mesma fonte que o Subtotal de dentro do cartão
   já confere contra) — fica visível mesmo com o cartão fechado.

**Módulos isolados**: `modulos_isolados/distribuicao-custos/js/` e
`modulos_isolados/atribuicao-tarefas/js/distribuicao-custos.js` têm
essa mesma aba implementada de um jeito bem mais antigo (uma tabela
única empilhada com linha de cabeçalho por pavimento, não o grid de
cartões — drift pré-existente já registrado antes nesta sessão). Não
tinha grid pra limitar a 3 colunas, então essa parte não se aplica lá;
mas a mudança de comportamento (recolhido por padrão + totalização no
cabeçalho) foi replicada nos dois arquivos, adaptada pro layout de
tabela deles (span inline no `<td>` do cabeçalho em vez da classe CSS
nova).

**Verificação**: `node --check` limpo nos 3 arquivos JS tocados.
Testado no navegador local (porta nova 5701) no projeto piloto "AP
PRAIA (SAVOIA) - SETOR B": aba abre com todos os pavimentos fechados
(►) mostrando "83,0 pts · R$ 3.987,49" etc. no título; clicar um
cabeçalho expande só aquele cartão (▼) mostrando as tarefas; em
1900px de largura confirmado visualmente exatamente 3 cartões por
linha (antes abriria 4+).

## Retomada em 2026-08-25 (parte 44) — Verba por Tarefa: borda dos cartões mais escura/grossa + fundo do título mais escuro

Dois ajustes visuais rápidos pedidos pelo usuário depois de ver a
grade em 3 colunas (parte 43): "os limites estão difíceis de
visualizar" (`.vt-card`: borda `1px solid #e2e8f0` quase sem contraste
com o fundo da página → `2px solid #94a3b8` + sombra um pouco mais
forte) e, na sequência, "escureça um pouco a cor do fundo dos títulos
dos pavimentos" (`.vt-card-header`: `background: #e2e8f0` →
`#cbd5e1`). Só `estilos.css`, sem tocar JS. Testado visualmente em
1300px (3 cartões por linha) — bordas e títulos bem mais legíveis.

## Retomada em 2026-08-25 (parte 45) — Produtividade: gráficos de desvio de horas em 2 colunas + previsto/realizado em 2 linhas alinhadas

Pedido do usuário: "divida as informações em 2 colunas, adequando os
espaços da informações... Organize também as informações de
previsto/realizado, colocando em duas linhas, alinhando o número de
horas na coluna" — referindo-se aos 3 gráficos de "Desvio de horas"
(Executor/Pavimento/Tarefa, adicionados na parte 42) da orelha
Detalhamento → Produtividade, que ficavam empilhados em largura cheia
desperdiçando espaço em telas largas.

**`js/desempenho-projeto.js`** (`renderizarDesempenhoProjeto()`):
1. Os 3 `graficoDesvioHoras(...)` (Executor/Pavimento/Tarefa) passaram
   a ficar dentro de um `<div class="desemp-graficos-2col">` — grid de
   2 colunas. O de Tarefa (lista normalmente mais longa) ganhou um 4º
   parâmetro (`classeExtra = 'desemp-grafico-full'`) que faz ele
   ocupar a linha inteira (`grid-column: 1 / -1`) em vez de dividir
   espaço com um vizinho.
2. O `meta` de cada barra (antes uma linha só: "previsto Xh ·
   realizado Yh", apertada demais numa coluna mais estreita) virou um
   mini-grid de 2 linhas × 2 colunas (`.dist-metaduo`: rótulo à
   esquerda, valor à direita) — como os 2 `<span>` de valor caem na
   MESMA coluna do grid CSS nas 2 linhas, "758,00 h" (previsto) e
   "69,50 h" (realizado) ficam alinhados um embaixo do outro mesmo com
   rótulos de tamanho diferente ("previsto" vs "realizado").

**`estilos.css`**: `.desemp-graficos-2col` (grid 2 colunas, gap só
horizontal — o espaçamento vertical entre linhas continua vindo do
`margin-top:28px` que `.dist-section` já tinha, mesmo padrão usado em
outros pontos do arquivo) + `.desemp-grafico-full` (`grid-column: 1 /
-1`) + media query (`max-width:900px` → 1 coluna, mesmo breakpoint já
usado pra `.dist-kpis`), todas escopadas só a `#panel-desempenho-projeto`
(não afetam os 3 gráficos equivalentes de Financeira, que continuam
full-width). `.dist-panel` ganhou um padding levemente reduzido
dentro desse grid (`16px 18px` em vez de `20px 22px`) pra "adequar o
espaço" à coluna mais estreita. Nova classe `.dist-metaduo` (+
seletores `:nth-child(odd)`/`:nth-child(even)`) escopada no mesmo
`:is(#panel-distribuicoes-projeto, #panel-desempenho-projeto)` das
outras classes `.dist-*` compartilhadas — mas só É USADA pelos
gráficos de horas de Produtividade; os metas de Financeira (`custo
R$X`, `N lançamentos · Xh`) continuam texto simples de 1 linha,
intocados.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5705) no projeto piloto "AP PRAIA (SAVOIA) - SETOR B":
confirmado visualmente "Desvio de horas por Executor" e "...por
Pavimento" lado a lado, "...por Tarefa" ocupando a linha inteira
abaixo; `.dist-metaduo` inspecionado via DOM (`previsto`/`758,00 h` /
`realizado`/`69,50 h`) e visualmente confirmado que os valores em
horas ficam alinhados numa coluna comum entre as 2 linhas. Sem erro
no console. Nenhum módulo isolado tem cópia de
`js/desempenho-projeto.js` nem do painel `#panel-desempenho-projeto`
— nada pra sincronizar.

## Retomada em 2026-08-25 (parte 46) — Produtividade: layout geral em 2 colunas (KPIs à esquerda, tabelas + gráficos à direita)

Pedido do usuário, reformulando a parte 45 de novo: "colocar os campos
horas consumidas, % concluída e saldo de horas em uma coluna que ocupe
metade da página. Modifique a largura das tabelas desempenho para que
caibam em uma só coluna, a direita, ocupando metade da página. Coloque
os desvios de horas (todas) em uma coluna a direita, com largura que
ocupe apenas metade da página." Interpretado como: a orelha inteira
vira 2 colunas de 50/50 — esquerda só com os 3 cartões de KPI
(empilhados verticalmente, não mais em linha); direita com as 2
tabelas de Desempenho + os 3 gráficos de "Desvio de horas", TODOS
empilhados numa coluna só (a própria coluna já é meia página — dividir
de novo em 2 sub-colunas, como a parte 45 tinha feito pros gráficos,
deixaria cada um estreito demais e contradiz o pedido de "uma coluna
[só]").

**`js/desempenho-projeto.js`** (`renderizarDesempenhoProjeto()`):
envolveu tudo num novo `<div class="desemp-layout-2col">` com 2 filhos
diretos — `<div class="desemp-col-kpis">` (só o `.desemp-grid-kpi` com
os 3 cartões) e `<div class="desemp-col-conteudo">` (as 2
`.desemp-painel` + os 3 `graficoDesvioHoras(...)`). Reverteu a parte
45: `.desemp-graficos-2col` (grid 2 colunas pros gráficos) e o
parâmetro `classeExtra`/`.desemp-grafico-full` de `graficoDesvioHoras()`
saíram — os 3 gráficos voltam a ser só `<div class="dist-section">`
simples, empilhados na ordem natural dentro de `.desemp-col-conteudo`.
`.dist-metaduo` (previsto/realizado em 2 linhas alinhadas, da parte
45) foi MANTIDO — continua fazendo sentido com a coluna de meia
página.

**`estilos.css`**: `.desemp-graficos-2col`/`.desemp-grafico-full`
removidas (ficaram sem nenhum uso, confirmado por busca no arquivo
inteiro antes de apagar). Novas: `.desemp-layout-2col` (`display:grid;
grid-template-columns: 1fr 1fr`, só gap horizontal — o espaçamento
vertical dentro de cada coluna continua vindo das margens que
`.desemp-painel`/`.dist-section` já tinham, sem duplicar);
`.desemp-col-kpis .desemp-grid-kpi { grid-template-columns: 1fr; }`
— sobrescreve só AQUI DENTRO a régua de 4 colunas que
`.desemp-grid-kpi` normalmente tem (a versão usada em Bonificação,
fora de `.desemp-col-kpis`, não foi tocada e continua em linha, já que
o seletor original `:is(#panel-desempenho-projeto,
#panel-bonificacao-projeto) .desemp-grid-kpi` não foi alterado — só
adicionei uma regra mais específica por cima, restrita a
`#panel-desempenho-projeto .desemp-col-kpis`). `.desemp-col-conteudo
.dist-panel` manteve o padding reduzido (`16px 18px`) que a parte 45
já tinha adicionado pra coluna mais estreita. Media query
`max-width:900px` → 1 coluna (empilha KPIs acima do conteúdo), mesmo
breakpoint já usado noutros pontos do arquivo. As tabelas
(`.desemp-tabela`) não precisaram de nenhuma mudança própria — já
eram `width:100%` fluido, então se encaixam sozinhas na coluna de
meia página.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5706) no projeto piloto "AP PRAIA (SAVOIA) - SETOR B":
confirmado visualmente os 3 KPIs empilhados na coluna esquerda, a
tabela "Desempenho" começando no topo da coluna direita; rolando mais
pra baixo, "Desempenho por Executor" e os 3 gráficos de desvio (agora
empilhados, não mais 2 por linha) também na coluna direita, com a
esquerda vazia abaixo dos KPIs (esperado). Confirmado via
`getBoundingClientRect()` que `.desemp-col-kpis` e `.desemp-col-conteudo`
têm exatamente a mesma largura (459px cada, split 50/50 real). Sem
erro no console.

## Retomada em 2026-08-25 (parte 47) — Produtividade: os 3 gráficos de desvio de horas voltam pra coluna esquerda, abaixo dos KPIs

Pedido do usuário, ajustando a parte 46: "os quadros com os desvios de
hora devem ficar todos na coluna da esquerda, abaixo dos campos horas
consumidas, % concluída e saldo de horas." Simples troca de lado: os 3
`graficoDesvioHoras(...)` (Executor/Pavimento/Tarefa) saíram de dentro
de `.desemp-col-conteudo` (direita) e entraram em `.desemp-col-kpis`
(esquerda), logo depois do `.desemp-grid-kpi` dos 3 cartões — mesma
ordem visual, só trocou de coluna. A coluna direita (`.desemp-col-
conteudo`) agora tem só as 2 tabelas ("Desempenho" filtrável +
"Desempenho por Executor").

**`js/desempenho-projeto.js`**: reordenou o bloco de código (a função
`graficoDesvioHoras` e as 3 chamadas) pra antes do `html +=
'</div><div class="desemp-col-conteudo">'` — sem mudança de lógica de
cálculo, só de onde o HTML gerado é inserido. **`estilos.css`**:
`.desemp-col-conteudo .dist-panel { padding: 16px 18px; }` virou
`.desemp-col-kpis .dist-panel { ... }` (o padding reduzido segue os
gráficos pra onde eles foram); comentário do bloco atualizado.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5707) no projeto piloto "AP PRAIA (SAVOIA) - SETOR B":
confirmado visualmente os 3 gráficos de desvio aparecendo na coluna
esquerda, abaixo dos KPIs (rolando a coluna); coluna direita mostrando
só a tabela "Desempenho por Executor" nesse ponto de rolagem. Sem erro
no console.

## Retomada em 2026-08-25 (parte 48) — Corrige "&minus;" aparecendo cru (texto, não sinal de menos) no cartão SALDO DE HORAS

Usuário reportou com print (projeto HOME GARDEN - SETOR C): o texto
comparativo do cartão "SALDO DE HORAS" mostrava literalmente "previsto
294,60h &minus; realizado 400,00h" na tela, em vez do sinal de menos.

**Causa**: `kpiCard(rotulo, numero, comparativo, cor, selo)`
(`js/desempenho-projeto.js`) passa `comparativo` por `escapeHtml()`
antes de inserir no HTML — correto/esperado pra texto livre, mas a
chamada de "SALDO DE HORAS" (linha ~955, adicionada na parte 42)
embutia a entidade HTML `&minus;` DENTRO desse texto. `escapeHtml()`
escapa `&` → `&amp;` primeiro, transformando `&minus;` em
`&amp;minus;`, que o navegador não decodifica de volta — mostra o
texto cru "&minus;". O 2º argumento (`numero`) usa a MESMA entidade e
não quebra, porque `kpiCard()` insere `numero` sem escapar (por isso
"− 105,40h" no número grande sempre apareceu certo, só o texto pequeno
embaixo é que quebrava).

**Fix**: trocada a entidade `&minus;` pelo caractere Unicode "−"
(U+2212) direto na string do `comparativo` — sobrevive ao
`escapeHtml()` sem problema, porque não é feito de `&` + texto.
Nenhuma outra chamada de `kpiCard()`/`kpiCardMultiplo()` no arquivo
tinha esse padrão (confirmado por busca de todas as ocorrências de
`&minus;` no arquivo) — bug isolado a essa única linha.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5708) no projeto real do usuário "HOME GARDEN - SETOR C"
(mesmo projeto do print): `.desemp-kpi-comparativo` do cartão SALDO DE
HORAS inspecionado via DOM, mostrando agora "previsto 294,60h −
realizado 400,00h" com o sinal de menos de verdade, batendo com os
números do print original (previsto 294,6h, realizado 400,00h).

## Retomada em 2026-08-25 (parte 49) — Financeira: layout em 2 colunas (orçamento à esquerda, valores realizados à direita)

Pedido do usuário: "Na aba detalhamento financeiro coloque na coluna à
esquerda todo o orçamento. Valor do contrato, impostos, valor líquido,
valor destinado para cada etapa, fundos, distribuição. Na coluna à
direita os valores efetivamente realizados." Mesmo padrão de 2 colunas
já aplicado em Produtividade (partes 46/47), agora em
`renderizarDistribuicoesProjeto()` (orelha Detalhamento → Financeira).

**Mapeamento**: a lista do usuário ("Valor do contrato, impostos,
valor líquido, valor destinado para cada etapa, fundos, distribuição")
bate quase item a item com as linhas que "Resumo financeiro" já
mostrava (Valor do Contrato → Impostos → Valor Líquido → Verba de cada
Etapa → Fundo Garantidor → Fundo Distribuição de Lucros → Verba
líquida p/ Pavimentos) — então essa seção inteira foi pra coluna
esquerda. "Como a Verba Global é dividida" (barra segmentada Bloco
Fixo/Detalhamento/Margem) também é só planejamento/orçamento — nenhum
valor realizado envolvido — então entrou na esquerda também, embora
não citada literalmente na lista do usuário. Coluna direita = os 3
blocos que de fato comparam com o realizado: "Resultado por técnico",
"Resultado por pavimento", "Diagnóstico por atividade" (todos
`lucro`/`custo` calculados a partir de horas REALMENTE apontadas).
Masthead + "Números do contrato" (KPIs, que misturam valores
orçados e realizados numa mesma linha de cartões) e "Nota de dados"
ficaram de fora da divisão — continuam largura cheia, como
intro/resumo e rodapé.

**`js/desempenho-projeto.js`**: envolveu o miolo da função num novo
`<div class="dist-layout-2col"><div class="dist-col-orcamento">` logo
depois de "Números do contrato"; dentro dela ficaram "Como a Verba
Global é dividida" e — MOVIDO pra cá (antes ficava por último, antes
da Nota de dados) — o bloco inteiro "Resumo financeiro" (sem nenhuma
mudança de cálculo, só de posição no HTML). Depois vem `</div><div
class="dist-col-realizado">`, e nessa segunda div ficaram "Resultado
por técnico/pavimento" e "Diagnóstico por atividade" (também sem
mudança de lógica). Fecha as duas divs + o wrapper logo antes da Nota
de dados.

**`estilos.css`**: nova `#panel-distribuicoes-projeto .dist-layout-2col`
(grid 2 colunas, só gap horizontal — mesmo padrão de
`.desemp-layout-2col` da Produtividade) + padding reduzido do
`.dist-panel` dentro das colunas (`16px 18px`) + media query
`max-width:900px` → 1 coluna. `.dist-tech-row` (usado dentro de
"Resultado por técnico", grid interno 1.4fr/1fr) não precisou de
ajuste — continua legível mesmo dentro da coluna de meia página.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5709) no projeto piloto "AP PRAIA (SAVOIA) - SETOR B", via
`getBoundingClientRect()` + inspeção dos `<h2>` de cada coluna:
confirmado `.dist-col-orcamento` = ["Como a Verba Global é dividida",
"Resumo financeiro"] e `.dist-col-realizado` = ["Resultado por
técnico", "Resultado por pavimento", "Diagnóstico por atividade"],
larguras praticamente iguais (437px/480px, split ~50/50 com gap).
Confirmado visualmente por screenshot que as duas colunas renderizam
lado a lado corretamente. Sem erro no console.

## Retomada em 2026-08-25 (parte 50) — Resumo financeiro reformulado em tabela Previsto×Realizado×Diferença + novo bloco Índices Globais

Usuário mandou um print de planilha Excel (blocos "VALOR GLOBAL" /
"DIVISÃO GLOBAL" / "DIVISÃO PRODUÇÃO-ETAPAS", cada um com colunas
Previsto/Realizado/Diferença e uma linha "Valor Líquido" em destaque)
pedindo algo assim pro Resumo Financeiro, mantendo o layout de 2
colunas da parte 49 (orçamento à esquerda, resultado por pavimento/
técnico/diagnóstico à direita), e um novo bloco "Índices Globais"
logo abaixo do Resumo Financeiro, mesma largura de coluna:
- Pre&ccedil;o por m&sup2; Global = Valor do Contrato &divide; &aacute;rea do projeto.
- Pre&ccedil;o por m&sup2; Detalh&aacute;vel = Verba do Detalhamento &divide; soma das &aacute;reas dos pavimentos detalh&aacute;veis.

Antes de implementar, 2 perguntas via AskUserQuestion (decisão
financeira real, sem chute):
1. **O que "Realizado" significa** nas linhas do orçamento, já que o
   sistema só rastreia HORAS realmente apontadas (não há valor
   financeiro "pago de fato" separado do orçado para Impostos,
   Parcelas, Verba de Etapa, etc)? Usuário escolheu: **"Recalcular com
   base nas horas reais"**.
2. **Qual área usar** no denominador de "Preço/m² Detalhável"? Usuário
   escolheu a Área Equivalente já existente na aba Verba por Pavimento
   (mesma régua que o sistema já usa pra ratear a Verba entre
   pavimentos).

**Lógica implementada** (única fonte de "horas reais" no sistema é a
Etapa Detalhamento — as demais etapas, "Bloco Fixo", já recebem o
valor cheio da própria Verba independente de hora, mesmo modelo que
`calcularBonificacaoProjeto()` já usa):
- `pctExecucaoDet = Horas Realizado da Etapa Detalhamento ÷ Horas
  Previsto` (1 se não houver Horas Previsto, evita divisão por zero).
- `verbaDetalhamentoRealizada = fin.verbaDetalhamentoBruta ×
  pctExecucaoDet` — SÓ a linha "Detalhamento" (e tudo que deriva dela:
  Verba Detalhamento, Fundo Distribuição de Lucros, Verba líquida p/
  Pavimentos, Preço/m² Detalhável) usa esse valor recalculado; todas
  as outras linhas (Valor do Contrato, Impostos, Parcelas, as 4 outras
  Etapas, Fundo Garantidor) têm Realizado = Previsto (Diferença "—"),
  porque não dependem de hora nenhuma no modelo atual do sistema.
- Fundo Garantidor **não** deriva das etapas individuais no código (é
  uma fatia % calculada de cima, sobre a Verba Global p/ Produção) —
  por isso fica igual em Previsto/Realizado, mesmo a etapa Detalhamento
  tendo mudado (decisão explícita, documentada no código pra não
  parecer esquecimento).

**`js/desempenho-projeto.js`**:
1. `calcularResumoFinanceiroProjeto()` ganhou `areaTotalEquivalente`
   no retorno (vem de `calcularListaPavimentosComVerbaSalva()`, que já
   era chamada ali mesmo — só passou a expor o campo).
2. `distFinLinha()`/`.dist-fingrid`/`.dist-finha` **removidas**
   (ficaram sem nenhum uso) — substituídas por `distOrcLinha()` +
   `tabelaOrcamentoBloco(titulo, linhas, subtotal)`, que desenham uma
   `<table class="dist-orctab">` de verdade (título do bloco + cabeçalho
   Previsto/Realizado/Diferença + linhas + subtotal em destaque),
   calculando Diferença = Realizado − Previsto (mostra "—" quando
   ~zero, igual à planilha de referência).
3. `renderizarDistribuicoesProjeto()`: "Resumo financeiro" agora monta
   4 `tabelaOrcamentoBloco()` — "Valor Global" (Contrato/Impostos/
   Líquido), "Divisão Global" (Parcelas Produção/Supervisão/
   Escritório), "Divisão Produção — Etapas" (as 5 Etapas + Fundo
   Garantidor + subtotal "Valor Líquido" que bate com a Parcela
   Produção quando Realizado=Previsto em tudo), e "Distribuição p/
   Pavimentos" (Verba Detalhamento/Fundo Distribuição de Lucros/Verba
   líquida p/ Pavimentos). Novo bloco "Índices Globais" logo depois,
   ainda dentro de `.dist-col-orcamento`, com 1 `tabelaOrcamentoBloco()`
   "Preço por m²" (Global e Detalhável).

**`estilos.css`**: `.dist-fingrid`/`.dist-finha` removidas; novo
`.dist-orc-panel` (empilha os `.dist-orctab` de um painel, cada
tabela já 100% da largura da coluna) + `.dist-orctab`/`.dist-orc-titulo`
(barra escura com o nome do bloco)/`.dist-orc-cab` (cabeçalho
Previsto/Realizado/Diferença)/`.dist-orc-emph` (linha Detalhamento em
destaque, cor de acento)/`.dist-orc-subtotal` (linha "Valor Líquido",
borda grossa + fundo levemente diferente) — linguagem visual própria
de tabela, dentro da paleta `--dist-*` já existente (não copiou o azul
do Excel da planilha de referência, adaptou pro estilo "relatório
editorial" que esta página já tem).

**Verificação**: `node --check` limpo, `estilos.css` com chaves
balanceadas (352 aberturas/352 fechamentos). Testado no navegador
local (porta nova 5711) no projeto piloto "AP PRAIA (SAVOIA) - SETOR
B" via inspeção direta do DOM (`querySelectorAll('table.dist-orctab')`)
— confirmados os 5 blocos com os valores certos e a matemática batendo:
Detalhamento previsto R$29.791,89 → realizado R$2.731,58 (raz&atilde;o
9,17%, que bate com Horas Realizado/Previsto reais do projeto:
69,50h/758,00h); "Valor Líquido" do bloco Etapas realizado
R$58.059,37 = soma das 4 etapas fixas (inalteradas) + Detalhamento
realizado + Fundo Garantidor (também confirmado por soma manual);
Fundo Distribuição de Lucros realizado R$136,58 = 5% × R$2.731,58
exato; Preço/m² Detalhável caiu de R$2,13 (previsto) pra R$0,19
(realizado), mesma proporção. Coluna direita (Resultado por técnico/
pavimento, Diagnóstico) confirmada intacta. Sem erro no console. Não
foi possível tirar screenshot nesta rodada (Browser pane fora de
exibição no ambiente de teste) — verificação feita 100% via inspeção
do DOM renderizado, não apenas cálculo isolado.

## Retomada em 2026-08-25 (parte 51) — Aba Orçamento: remove comentário do campo "Verba Global para Produção" e usa o mesmo padrão de campo nas outras abas

Pedido do usuário: "Retire o comentário do campo em azul (Verba Global
para produção (calculada.....) e, depois de retirar, use o layout
como modelo para as outras abas em termos de largura da coluna,
espaçamento entre linhas, etc. Mantenha o contexto e as atribuições
existentes em cada aba."

**Antes**: 2 caixas azuis (`background:#eff6ff`) com um parágrafo de
texto explicativo misturado com o valor calculado em negrito — uma na
aba "Verba Global para Produção" (`Verba Global para Produção
(calculada na aba Orçamento Global), a ser dividida entre as
etapas — o Fundo Garantidor (última linha) fica automaticamente com o
que sobra dos 100%: R$ X`) e outra igual na aba "Verba por Pavimento"
(`Área Total Equivalente: X | Verba da Etapa "Detalhamento" (aba
anterior), já líquida do Fundo Distribuição de Lucros abaixo,
cascateada até os Pavimentos: R$ Y`) — nenhuma das duas usava o
`.form-grid`/`.form-group` que a aba "Orçamento Global" já usa pros
seus próprios campos calculados (ex.: "Verba Global para Produção" da
Aba 1, linha ~440).

**Depois**: as 2 caixas viraram campos `.form-group` de verdade — MESMO
padrão visual da Aba 1 (`<label>` uppercase 11px + `<input readonly>`
fundo `#eff6ff`, negrito, azul), dentro de `.form-grid` (grid de 12
colunas, gap 10px — a mesma classe global, não uma cópia), com largura
de coluna proporcional ao conteúdo (`col-4` pra 1 campo sozinho na aba
"Verba Global para Produção", `col-6` + `col-6` pra 2 campos lado a
lado na aba "Verba por Pavimento" — mesma convenção de largura que a
Aba 1 já usa pros seus próprios pares de campos). O texto explicativo
foi cortado (só o rótulo do campo ficou, com a fonte entre parênteses
quando fazia sentido: "(aba Orçamento Global)") — a tabela logo abaixo
de cada campo já deixa claro o que é o quê, sem precisar do parágrafo.

**`index.html`**: as 2 divs viraram `.form-grid` > `.form-group` >
`label` + `input readonly`, com os MESMOS `id`s de antes
(`dca-valor-analista-ref`, `vp-area-total-equivalente`,
`vp-verba-liquida-ref`) — só a tag mudou (`<b>` → `<input>`).
**`js/distribuicao-custos.js`**: as 3 linhas que escreviam
`.innerText = ...` nesses elementos viraram `.value = ...` (elemento
agora é `<input>`, não `<b>`) — só essas 3 linhas, nenhuma lógica de
cálculo mudou.

**Fora de escopo, decidido conscientemente**: a caixa azul de
"Coparticipações no Detalhamento" (Aba 1, item 4) não foi tocada — o
usuário só nomeou a de "Verba Global para Produção" e aquela outra
caixa tem instrução de uso genuína (não é só um valor duplicado), não
um comentário redundante. A linha "% Fundo Distribuição de Lucros"
(logo abaixo dos 2 novos campos, na aba Verba por Pavimento) também
não foi tocada — é uma linha de CONTROLE (input editável + botão
Salvar), não um par label/valor como as que foram convertidas.
`modulos_isolados/distribuicao-custos/index.html` tem os mesmos 2
comentários, mas esse módulo isolado já está com drift estrutural bem
maior (ainda tem a aba "Verba para Detalhamento" que foi REMOVIDA do
app principal numa reforma anterior desta sessão) — não tentei
sincronizar essa mudança pequena lá, mesmo precedente já registrado
antes pra esse módulo específico.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5712) no projeto piloto "AP PRAIA (SAVOIA) - SETOR B" via
inspeção do DOM: `dca-valor-analista-ref.value` = "R$ 85.119,68",
`vp-area-total-equivalente.value` = "14.011,00",
`vp-verba-liquida-ref.value` = "R$ 28.302,29" — todos os 3 campos
populados corretamente como `<input readonly>` dentro de
`.form-group col-4`/`.form-group col-6`. Sem erro no console.

## Retomada em 2026-08-25 (parte 52) — Orçamento: sub-abas viram cartões empilhados numa coluna estreita (≤50% da tela)

Pedido do usuário: "Quero que mostre as abas secundárias da aba
Orçamento em formato de cartão. Todas as abas devem ter a mesma
largura e serem distribuídas em apenas 1 coluna de largura menor,
ocupando, no máximo 50% da tela. Use altura das linhas com espaço
igual a que usou na aba Verba Global para produção."

As 4 sub-abas (Orçamento Global/Verba Global para Produção/Verba por
Pavimento/Verba por Tarefa), antes uma barra horizontal de "tabs"
sublinhadas (`.tab-bar`/`.tab-selector`, mesmo padrão usado em
Relatório Personalizado), viraram uma coluna vertical de cartões
(borda + sombra leve + barra de destaque à esquerda quando ativo),
com o conteúdo da aba selecionada ao lado, à direita — mesmo padrão
coluna-estreita-esquerda + conteúdo-à-direita já usado em
Detalhamento/Produtividade (parte 47) e Detalhamento/Financeira
(parte 49/50).

**`index.html`**: os 2 botões que ficavam dentro da antiga `.tab-bar`
("📁 Estrutura de Projeto"/"🔁 Trocar Projeto") saíram pra uma
`.dc-toolbar` própria acima (não fazem sentido virando "cartão" junto
com as abas). Novo wrapper `.dc-abas-layout` (flex) com 2 filhos: a
`.tab-bar` (agora só com os 4 `.tab-selector`, virou a coluna de
cartões) e `.dc-abas-conteudo` (os 4 `.tab-content` de sempre, sem
nenhuma mudança de conteúdo/atribuições). IDs e `onclick`s de cada aba
ficaram exatamente iguais — só mudou o que envolve os elementos.

**`estilos.css`**: nova regra escopada a `#dc-conteudo-principal
.dc-abas-layout .tab-selector` (não mexe no `.tab-selector` genérico —
esse continua servindo Relatório Personalizado, como já documentado
no CSS desde a reforma das orelhas). `.tab-bar` vira
`flex-direction:column` com `flex: 0 1 320px; max-width: 50%` (nunca
passa de metade do espaço disponível, mesmo em telas estreitas —
confirmado a 900px de largura, onde o limite de 50% realmente entra em
ação). `gap: 10px` entre os cartões — o MESMO valor de `.form-grid`
(pedido explícito do usuário: "espaço igual a que usou na aba Verba
Global para Produção"); padding do cartão `12px 16px`, peso visual
parecido ao bloco label+input daquela aba. Cartão ativo:
`background:#eff6ff` + `border-left: 3px solid #00b4d8` (mesmo par
navy+ciano usado em todo canto do sistema pra "selecionado"). Media
query em 760px empilha a coluna de cartões ACIMA do conteúdo (em vez
de do lado) pra não espremer demais em telas bem estreitas.

**Verificação**: `node --check` limpo, `estilos.css` com chaves
balanceadas (362/362), `index.html` com `<div>` balanceados (423/423).
Testado no navegador local (porta nova 5714) no projeto piloto "AP
PRAIA (SAVOIA) - SETOR B": confirmado visualmente os 4 cartões
empilhados à esquerda, "Orçamento Global" ativo por padrão; clicar
"Verba Global para Produção" troca a classe `.active` corretamente
(confirmado via `classList`) e o card ganha
`background-color:rgb(239,246,255)` + `border-left-color:rgb(0,180,216)`
(computado, não só CSS declarado). Largura da coluna de cartões
medida via `getBoundingClientRect()`: 320px fixos em tela larga
(1400px, ~29,6% do espaço disponível) e exatamente 50% quando o espaço
aperta (900px) — nunca ultrapassa o teto pedido. Sem erro no console.
Não sincronizado em `modulos_isolados/distribuicao-custos/index.html`
(único módulo isolado com esse tab-bar) — já tem drift estrutural
maior e pré-existente (ainda tem a aba "Verba para Detalhamento",
removida do app principal numa reforma anterior desta sessão), mesmo
precedente já registrado antes.

## Retomada em 2026-08-25 (parte 53) — Correção da parte 52: abas voltam pro topo, o CONTEÚDO é que vira cartão de meia página

Usuário corrigiu a parte 52: "Não era essa minha intenção. Mantenha as
sub-abas no topo como antes. O conteúdo das sub-abas é que devem estar
em uma coluna que ocupe metade da tela e apareçam em forma de cartões.
Na sub-aba verba por tarefa Retorne ao status de antes da última
alteração (estava boa). As demais sub-abas devem ter suas linhas
redimensionadas quanto às alturas, tomando como base as altura das
linhas da sub-aba verba global para produção."

Eu tinha entendido errado: virei as PRÓPRIAS abas (Orçamento Global/
Verba Global para Produção/Verba por Pavimento/Verba por Tarefa) numa
coluna de cartões à esquerda. O pedido real era o oposto — abas
continuam uma barra horizontal normal no topo (como sempre foram); é
o CONTEÚDO de cada aba que vira um cartão de largura travada em 50%.

**`index.html`**: revertido o split de `.tab-bar` — os 2 botões
("Estrutura de Projeto"/"Trocar Projeto") voltaram pra dentro da
`.tab-bar`, junto dos 4 `.tab-selector`, exatamente como era antes da
parte 52. Removidos os wrappers `.dc-toolbar`/`.dc-abas-layout`/
`.dc-abas-conteudo` (não existem mais). Tabela principal de "Verba por
Pavimento" (`#vp-tabela-body`) ganhou a classe `tabela-compacta` (só
tinha antes na tabela de Setores) — precisa dela pra herdar a régua de
altura de linha (ver CSS abaixo).

**`estilos.css`**:
1. Nova regra `#dc-conteudo-principal .tab-content` (aplica a QUALQUER
   `.tab-content` dentro da tela de Orçamento): cartão de verdade
   (borda + sombra leve + padding 16px) com `max-width: 50%`.
   `#conteudo-verba-por-tarefa` é explicitamente EXCLUÍDO logo depois
   (fundo/borda/sombra/padding/max-width todos voltam a `none` /
   normal) — essa aba já tem sua própria grade `.vt-grid` de 3 colunas
   que precisa da largura cheia, exatamente o "estava boa, retorne"
   que o usuário pediu.
2. Removida a compactação que só existia em `#conteudo-orcamento-global`
   (`.form-section`/`.form-grid` com padding/gap reduzidos, adicionada
   numa sessão anterior pra caber 4 itens sem rolar) — agora usa a
   MESMA régua padrão (`.form-grid` gap 10px) que "Verba Global para
   Produção" já usa no campo que foi limpo na parte 51. Isso by itself
   já iguala a altura das linhas entre as duas abas.
3. A regra de "altura de linha fixa em 28px" (`tbody tr`/`tfoot tr`/
   `td`), que já existia só pra `#conteudo-distribuicao-analista
   table.tabela-compacta`, ganhou os mesmos seletores pra
   `#conteudo-verba-pavimento table.tabela-compacta` — agora as 2
   tabelas de "Verba por Pavimento" (Setores e Pavimentos) têm linha de
   28px, igual à tabela de Etapas de "Verba Global para Produção".

**Verificação**: `node --check` limpo, `estilos.css` (chaves) e
`index.html` (`<div>`) com contagem balanceada. Testado no navegador
local (porta nova 5715) no projeto piloto "AP PRAIA (SAVOIA) - SETOR
B": confirmado visualmente a barra de abas de volta ao topo, horizontal,
com os 2 botões; "Orçamento Global" e "Verba por Pavimento" renderizando
como cartão com borda, `max-width:50%` computado; "Verba por Tarefa"
confirmado via `getBoundingClientRect()`/`getComputedStyle()` com
`maxWidth:"none"`, `border:"none"`, largura real 632px (cheia) — igual
a antes da parte 52; linha de tabela de "Verba por Pavimento" com
`height:"28px"` computado, batendo com "Verba Global para Produção".
Sem erro no console.

## Retomada em 2026-08-25 (parte 54) — Financeira: alinha a coluna esquerda com o título do relatório

Pedido do usuário: "Na aba Detalhamento-Financeira, aumente a largura
da primeira coluna até que o limite esquerdo dela fique alinhada com o
título da aba pela esquerda."

**Causa raiz** (medida via `getBoundingClientRect()` no navegador,
não só lida no CSS): a caixa do `.dist-masthead` e a caixa do
`.dist-panel` (dentro de `.dist-col-orcamento`) começam exatamente no
MESMO x (279,45px) — não há nenhum desalinhamento na posição das
CAIXAS. A diferença vem do `padding-left`: `.dist-masthead` usa 30px,
`.dist-panel` (dentro do layout de 2 colunas) usa só 18px — por isso o
título ("AP PRAIA...") aparecia ~12px mais à direita que o conteúdo
das tabelas/barra segmentada da coluna esquerda.

**`estilos.css`**: nova regra `#panel-distribuicoes-projeto
.dist-col-orcamento .dist-panel { padding-left: 30px; }` — só a
PRIMEIRA coluna (`.dist-col-orcamento`); a segunda
(`.dist-col-realizado`, com Resultado por técnico/pavimento/
Diagnóstico) continua com os 18px de sempre, sem pedido do usuário pra
mudar. Como `padding-left` afeta TODO o conteúdo do painel de uma vez
(tabelas `.dist-orctab` e a barra segmentada `.dist-segbar`), tudo na
coluna esquerda passou a alinhar com o título junto.

**Verificação**: `estilos.css` com chaves balanceadas. Testado no
navegador local (porta nova 5718, projeto piloto "AP PRAIA (SAVOIA) -
SETOR B") via `getBoundingClientRect()`: `h1` do masthead e a primeira
célula da tabela "Valor Global" (e a barra segmentada) agora ambos em
x=310,45px — alinhamento exato; painel da coluna direita continua em
x=279,45px, inalterado. Confirmado visualmente por screenshot. Sem
erro no console.

## Retomada em 2026-08-25 (parte 55) — Detalhamento Realizado vira Custo Real, com cascata de absorção de estouro (Fundo Garantidor → Parcela Produção)

Pedido do usuário (maiúsculas no original): "Na planilha Divisão
Produção Etapas da mesma aba - coluna Realizado linha Detalhamento, o
valor deve ser o Custo Real do Detalhamento. Eventual saldo negativo
deve ser diminuído da Verba do Fundo Garantidor até seu valor total.
Caso ainda permaneça negativo, o eventual saldo negativo deve ser
reduzido da parcela Realizado da Parcela de Produção."

Antes (parte 50): "Realizado" da linha Detalhamento era a Verba
PREVISTA escalada pelo % de execução em horas (Horas Realizado &divide;
Horas Previsto) — uma estimativa de earned-value. Agora: é literalmente
o CUSTO REAL apurado (`bonif.poolCusto`, o mesmo número já mostrado no
headline/KPI "Custo Real do Detalhamento" desta mesma página) — sem
nenhuma escala, é o valor de fato gasto.

**Cascata de absorção** (só entra em ação quando Custo Real > Verba
Previsto, ou seja, estouro):
1. `saldoDetalhamento = Verba Prevista do Detalhamento &minus; Custo Real`
   (mesma convenção "Saldo" de sempre no sistema: negativo = estouro).
2. Se negativo, o `deficit` (valor absoluto do estouro) é descontado
   PRIMEIRO do Fundo Garantidor — até no máximo o valor total dele
   (não fica negativo).
3. Se ainda sobrar deficit depois de zerar o Fundo Garantidor, o
   restante é descontado do Realizado da linha "Parcela Produção" (no
   bloco "Divisão Global", logo acima na mesma coluna).
Testado com 3 cenários sintéticos em Node (sem estouro / estouro
pequeno absorvido só pelo Fundo Garantidor / estouro grande que também
reduz a Parcela Produção) — os 3 se comportam exatamente como
descrito.

**`js/desempenho-projeto.js`** (`renderizarDistribuicoesProjeto()`):
novo bloco de cálculo (`custoRealDetalhamento`, `saldoDetalhamento`,
`deficitDetalhamento`, `absorcaoFundoGarantidor`,
`fundoGarantidorRealizado`, `deficitRestante`,
`parcelaProducaoRealizado`) logo antes da montagem das tabelas.
"Divisão Global": linha "Parcela Produção" usa
`realizado: parcelaProducaoRealizado` (`emph` só quando
`deficitRestante > 0`, pra destacar visualmente só quando ela é
realmente afetada); subtotal "Valor Líquido" ajustado. "Divisão
Produção — Etapas": linha Detalhamento usa
`realizado: custoRealDetalhamento` (sem escala); linha Fundo
Garantidor usa `realizado: fundoGarantidorRealizado` (`emph` só quando
`absorcaoFundoGarantidor > 0`); subtotal "Valor Líquido" ajustado.
**Fora de escopo, decisão consciente**: `verbaDetalhamentoRealizada`
(a variável com a escala por horas da parte 50) foi MANTIDA — ainda
alimenta "Distribuição p/ Pavimentos" e "Índices Globais", que o
usuário não pediu pra mudar desta vez; as duas variáveis (custo real
vs. verba escalada) agora coexistem, cada uma no bloco que faz sentido
pra ela.

**Verificação**: `node --check` limpo. Testado no navegador local
(porta nova 5719) em 2 projetos reais — "AP PRAIA (SAVOIA) - SETOR B"
(Custo Real R$27.718,74 &lt; Verba R$29.791,89 — sem estouro, linha
Detalhamento mostra Realizado = Custo Real, Diferença &minus;R$2.073,14,
Fundo Garantidor e Parcela Produção inalterados) e "HOME GARDEN -
SETOR C" (Custo Real R$10.756,57 &lt; Verba R$10.947,95 — também sem
estouro). Nenhum dos 2 projetos reais disponíveis tinha estouro de
custo pra testar a cascata ao vivo — validada isoladamente em Node com
3 cenários sintéticos (sem estouro / estouro só no Fundo Garantidor /
estouro que alcança a Parcela Produção), todos batendo com o
esperado. Sem erro no console.

## Retomada em 2026-08-25 (parte 56) — Resumo financeiro: alinha a coluna Diferença (e Previsto/Realizado) entre os 5 blocos

Pedido do usuário (maiúsculas no original): "Detalhamento-Financeiro-
coluna Diferença. Valores desalinhados, ajustar largura da coluna e
alinhar valores na horizontal."

**Causa raiz** (medida via `getBoundingClientRect()`, não só lida no
CSS): "Valor Global"/"Divisão Global"/"Divisão Produção — Etapas"/
"Distribuição p/ Pavimentos"/"Preço por m&sup2;" são 5 `<table>`
SEPARADAS (uma por `tabelaOrcamentoBloco()`), cada uma com
`table-layout: auto` (padrão) — cada tabela distribuía a largura das
suas 4 colunas sozinha, conforme o texto mais comprido da SUA PRÓPRIA
coluna de rótulo. Resultado: a borda esquerda da coluna "Diferença"
começava num X diferente em cada tabela (medido: de 625px a 656px,
30px de variação) — dava a impressão de valores "desalinhados" ao
rolar a página e comparar visualmente entre blocos.

**Fix**: `table-layout: fixed` em `.dist-orctab` + largura declarada
em % nas células do cabeçalho (`.dist-orc-cab th`) — mesma proporção
(rótulo 22%, Previsto/Realizado/Diferença 26% cada) em TODAS as 5
tabelas, então as 4 colunas agora caem exatamente no mesmo X em
qualquer bloco da seção.

**Efeito colateral encontrado e corrigido durante o teste**: fixar a
largura da coluna fez os valores em R$ (mais longos, ex.:
"&minus; R$ 27.060,31") quebrarem no MEIO do número pra 2 linhas — ilegível.
Causa: `.dist-num` (classe compartilhada com o resto do relatório) usa
fonte monoespaçada (`ui-monospace`/`SF Mono`/etc, mais larga por
caractere que a fonte padrão) — medir a largura necessária na fonte
errada (padrão, não monoespaçada) escondeu o problema numa primeira
tentativa. Corrigido medindo a largura real do texto mais longo NA
FONTE MONOESPAÇADA de verdade (via `span` temporário) — só coube sem
quebrar a partir de 9px; reduzido o padding horizontal das células
(6px&rarr;3px) e rebalanceada a proporção das colunas (rótulo 22%,
numéricas 26% cada) pra abrir mais espaço pros números. A coluna de
rótulo aceita quebrar em 2 linhas quando o texto é longo (texto quebra
bem, sem ficar ilegível) — só os valores monetários precisavam ficar
numa linha só.

**`estilos.css`**: `.dist-orctab { table-layout: fixed; }`;
`.dist-orc-cab th:first-child { width: 22% }`, demais `th { width: 26%
}`; padding geral `6px 3px` (rótulo mantém `padding-left: 8px`
próprio); `.dist-orctab td.dist-num`/`.dist-orc-cab th:not(:first-child)`
com `font-size: 9px`.

**Verificação**: `estilos.css` com chaves balanceadas. Testado no
navegador local (portas novas 5721→5724, iterando 3 vezes até
resolver o efeito colateral do wrap) no projeto piloto "AP PRAIA
(SAVOIA) - SETOR B": confirmado via `getBoundingClientRect()` que a
borda esquerda da coluna Diferença é EXATAMENTE a mesma (555,98px) nas
5 tabelas; confirmado via `Range.getClientRects().length` (mede
quebra de linha de verdade, não só overflow) que nenhuma das 57
células de valor monetário quebra mais em 2 linhas (chegou a ter 15
quebrando antes do ajuste de fonte/padding). Sem erro no console.

## Retomada em 2026-08-26 (parte 57) — Auditoria de segurança: escapa HTML em todo lugar que monta tela com texto de formulário

Pedido do usuário: análise crítica de arquitetura/banco de dados
(relatório publicado como Artifact, achados medidos direto no código —
XSS armazenado era o item mais crítico), seguido de "aplique" pra
corrigir o achado.

**Causa**: `escapeHtml()` existia desde a reforma de Financeira (parte
50), mas morava dentro de `desempenho-projeto.js` e só era chamada
pelas próprias 24 linhas daquele arquivo. Os outros 14 arquivos que
montam tela via `innerHTML +=` com nome de cliente/funcionário/tarefa/
projeto/etapa/pavimento/setor/catálogo — texto que o próprio usuário
digita em formulário — inseriam esse texto direto, sem escapar nada.
Um nome contendo `<script>` ou similar executaria pra qualquer pessoa
que abrisse a tela onde aquele nome aparece.

**Fix, arquivo por arquivo** (89 pontos ao todo, além dos 24 que já
existiam em `desempenho-projeto.js`):
1. `escapeHtml()` **movida pra `core.js`** (carrega primeiro) — ficou
   disponível globalmente antes de qualquer outro arquivo precisar
   dela.
2. `cadastros.js` (7), `kanban.js` (10), `distribuicao-custos.js` (9),
   `arvore.js` (15), `relatorios.js` (8), `aprovacoes-calendario.js`
   (13), `atribuicao-tarefas.js` (9), `feriados.js` (1),
   `distribuicao-lucro.js` (1), `bi.js` (2), `painel-progresso.js`
   (4), `catalogo-lego.js` (4): todo campo de texto livre (nome,
   motivo, cargo, cpf, cnpj, codinome, unidade física etc.) que ia
   direto pro `innerHTML`, dentro de `<td>`, `<option>`, atributo
   `value="..."` ou `title="..."`, passou a ser envolvido em
   `escapeHtml(...)`.
3. **Correções de alavancagem** (uma função só, usada em vários
   lugares): `construirOpcoesExecutor()` (`atribuicao-tarefas.js`,
   usada por `distribuicao-custos.js` também) e `formatarValorColuna()`
   (`relatorios.js`, o formatador central de TODA célula do motor de
   Relatórios — só o `return valor` do tipo "texto" precisava de
   escape, os outros `return` já eram número/data formatados) — corrigir
   essas 2 funções cobriu dezenas de pontos de uma vez só.
4. `sync-provisorio.js` (o único dos 15 arquivos com `innerHTML` que
   ficou de fora): auditado e confirmado seguro sem mudança nenhuma —
   só insere texto estático (overlay "Sincronizando...") e usa
   `.textContent` (não `innerHTML`) pro texto dinâmico.
5. Bug lateral corrigido de passagem: `js/arvore.js` (lista de
   projetos) não escapava nem a aspa simples no `onclick` — um nome de
   projeto com `'` já quebrava o atributo ANTES mesmo da questão de
   XSS. Corrigido junto (`nomeJs`, mesmo padrão usado nos outros
   arquivos).

**Verificação**: `node --check` limpo nos 14 arquivos tocados. Varredura
final por 2 padrões de grep no `js/` inteiro — nenhuma linha com
`innerHTML` restante que referencie `.nome`/`.executor`/`.motivo`/
`.cargo`/`.cpf`/`.cnpj`/`.codinome`/`.tarefa`/`.projeto`/`.cliente`
sem passar por `escapeHtml`. `escapeHtml(` agora aparece em 14 dos 19
arquivos principais (era 1 antes). Não testado no navegador linha por
linha (mudança mecânica e ampla demais pra clicar em cada tela) — a
verificação foi por grep sistemático + `node --check`, não por clique.

## Retomada em 2026-08-31 (parte 58) — Autenticação anônima no Firebase (2º achado crítico da auditoria)

Pedido do usuário: continuar a agenda de segurança do relatório de
auditoria (parte 57 tratou o XSS armazenado).

**Causa**: testei uma leitura `shallow=true` direto na URL do Realtime
Database (só nomes de chave, sem baixar dado nenhum) e confirmei que o
banco aceita leitura **sem autenticação nenhuma** — "modo de teste" do
Firebase, documentado como proposital no `LEIA-ME_SYNC_PROVISORIO.md`
(fase de testes da equipe), mas o banco já carrega CPF e dado
financeiro real, então ficou tempo demais aberto.

**Fix**: como o app não tem nenhuma tela de login que fale com o
Firebase (o dropdown ADMIN/Ana/etc. é só do próprio app, não
autentica em lugar nenhum), a saída sem adicionar fricção pro usuário
é autenticação **anônima** — o SDK se apresenta ao Firebase sozinho,
sem tela, sem senha, e guarda a credencial no próprio navegador (fica
persistida entre sessões).
1. `index.html`: novo `<script>` do SDK `firebase-auth-compat.js`
   (mesma versão 10.13.0 já usada pros outros 2 SDKs), carregado antes
   de `sync-provisorio-config.js`.
2. `js/sync-provisorio.js`, `_syncInicializar()`: o `firebase.database().ref(...)`
   + leitura inicial, que antes rodava direto após `initializeApp`,
   agora fica dentro do `.then()` de `firebase.auth().signInAnonymously()`
   — só tenta ler/escrever depois de autenticado. Falha de autenticação
   cai no mesmo fallback "seguir 100% local" que já existia pra falha
   de leitura, sem travar a tela (`console.warn` + segue carregando o
   app normalmente).
3. Comentário de `_syncColetarSnapshotLocal()` atualizado: a chave que
   o SDK de Auth grava no localStorage (`firebase:authUser:...`) já
   cai no mesmo filtro de regex que excluía `firebase:host:...` (chave
   com `.`, inválida como nó do Realtime Database) — nenhuma mudança
   de código necessária ali, só a explicação.
4. `LEIA-ME_SYNC_PROVISORIO.md`: nova seção "6. Fechar o acesso
   público" com o passo a passo manual no Console do Firebase — **em
   2 etapas na ordem certa**: (1) habilitar "Anônimo" em Authentication
   → Sign-in method, (2) só depois trocar as regras do Realtime
   Database pra `auth != null` (trocar a regra antes do passo 1
   derrubaria a sincronização de todo mundo).

**Verificação**: `node --check` limpo em `sync-provisorio.js`. Testado
no navegador (servidor HTTP local, projeto Firebase real): como o
login anônimo ainda não foi habilitado no Console (passo manual
pendente do lado do usuário), o `signInAnonymously()` falhou com
`auth/configuration-not-found` e o app caiu no fallback local
graciosamente — sem erro na tela, sem travar, exatamente o
comportamento esperado pro caminho de falha. O caminho de sucesso
(login anônimo habilitado + sincronização de verdade) só pode ser
testado depois que o usuário fizer o passo 1 manual no Console —
pendente.

## Retomada em 2026-08-31 (parte 59) — Incidente: banco de produção sobrescrito durante teste, restaurado, e bug de origem corrigido

**O que aconteceu**: testando o caminho de FALHA da autenticação
anônima (parte 58) antes do usuário ter habilitado "Anônimo" no
Console, abri o app numa origem nova (localStorage vazio). A
autenticação falhou (`auth/configuration-not-found`) e o app caiu no
fallback "modo local" — mas nesse fallback o app ainda semeia um
projeto de exemplo padrão já embutido no código (`"Residencial
Excellence"` / `PRJ-BC-01`), por ser primeira visita. O bug: mesmo no
fallback, `_syncFirebaseRef` (a referência de conexão com o Firebase,
criada ANTES da tentativa de autenticação) continuava válida, e o
envio periódico de segurança a cada 30s (`setInterval` no fim do
arquivo) seguia tentando enviar o localStorage pro servidor — como as
regras do banco ainda estavam abertas (usuário ainda não tinha
trocado pra `auth != null`), o envio teve sucesso e **substituiu o
banco de dados real da equipe (10 projetos, 62 clientes, etc.) pelo
projeto de exemplo vazio**.

**Recuperação**: uma aba de teste anterior, aberta mais cedo na mesma
sessão (antes do bug), ainda tinha os dados reais em cache no
localStorage do navegador (32 chaves) — não tinha sido recarregada
nem executado `sync-provisorio.js` de novo, então nunca puxou o dado
corrompido por cima. Confirmei com o usuário que ninguém da equipe
tinha aberto/recarregado o app real desde o incidente (então não
havia edição legítima mais recente que essa cópia). Com autorização
explícita do usuário, recuperei essa cópia via `javascript_tool`
(carregando o SDK do Firebase manualmente numa aba que nunca rodou
`sync-provisorio.js`, pra não arriscar puxar o dado ruim por cima) e
reenviei pro Firebase. Confirmado via leitura direta do banco:
`banco_projetos` voltou aos 10 projetos reais, `banco_clientes` com
62 registros.

**Fix da causa raiz** (`js/sync-provisorio.js`, `_syncInicializar()`):
os dois `catch` de falha (autenticação e leitura inicial) agora
zeram `_syncFirebaseRef = null` antes de cair no modo local —
`_syncEnviarAgora()` já checava `if (!_syncFirebaseRef) return;` no
topo, então zerar a referência desarma completamente qualquer envio
futuro (debounced ou periódico) pelo resto da vida daquela aba,
igual ao comportamento que o branch "configuração incompleta" já
tinha (nunca criava a referência). Sem isso, qualquer falha
transitória de autenticação ou leitura — não só a específica que
causou o incidente — deixava a porta aberta pro mesmo problema.

**Verificação**: `node --check` limpo. Testado de ponta a ponta numa
origem nova depois do fix: autentica silenciosamente, puxa os dados
reais (já restaurados) do servidor, aplica no localStorage, sem
nenhum envio de volta (branch de sucesso só envia se o servidor
estava vazio, que não é mais o caso) — comportamento correto
confirmado via `javascript_tool` (leitura de `localStorage` e da
variável `_syncFirebaseRef` na página real, não just código lido).
Não forcei de novo o caminho de falha (autenticação já está
habilitada agora, não dá pra reproduzir o mesmo erro) — a garantia
vem de revisão de código: os dois `catch` agora zeram a referência
antes de sair, e `_syncEnviarAgora()` sempre checa a referência
primeiro.

**Lição prática**: qualquer teste futuro de sincronização com o
Firebase deve, sempre que possível, testar contra um projeto Firebase
separado de teste — não direto contra o banco de produção da equipe —
mesmo em passos que "deveriam" só ler.

## Retomada em 2026-08-31 (parte 60) — Trava de sanidade contra envio de dado incompleto

Pedido do usuário: continuar a lista de sugestões da auditoria; escolhi
priorizar isto antes dos outros itens, dado o incidente da parte 59 —
é uma mudança pequena que fecha a porta pro MESMO tipo de acidente
acontecer de novo por qualquer outro motivo (duas pessoas editando
junto, aba com storage corrompido, etc.), não só o bug específico já
corrigido.

**O que faz** (`js/sync-provisorio.js`): antes de qualquer envio pro
Firebase, `_syncEnviarAgora()` agora compara o snapshot que vai
mandar contra o último estado conhecido do servidor
(`_syncUltimoSnapshotServidor`, uma variável nova, mantida atualizada
por `_syncEscutarMudancasRemotas()` — o listener que já existia pra
mostrar o banner de "equipe atualizou dados" — e também preenchida
direto na leitura inicial do boot). Se alguma lista que era "de
verdade" no servidor (5+ itens) encolher pela metade ou mais no envio,
o envio é BLOQUEADO (não vai pro Firebase) e aparece um banner
vermelho fixo no topo da tela convidando a recarregar — em vez de
sobrescrever silenciosamente o banco real. Sem baseline ainda
(primeira sincronização, servidor genuinamente vazio) a trava não
bloqueia nada, senão a configuração inicial da equipe nunca
conseguiria subir dado nenhum.

O limiar (50%) é deliberadamente frouxo: apagar 1 cliente de 62 (edição
normal) não dispara nada; sobrar só 2 de 62 (o que aconteceu no
incidente) dispara.

**Verificação**: `node --check` limpo. Testado ao vivo contra o banco de
produção de verdade (não um projeto Firebase separado — não tinha um
disponível; risco assumido conscientemente, com cuidado extra de só
alterar `banco_clientes`, o de menor risco entre os dados sensíveis):
1. Truncar `banco_clientes` local pra 2 itens e forçar `_syncEnviarAgora()`
   → banner de bloqueio apareceu, e uma leitura direta do servidor
   confirmou que os 62 clientes reais continuavam lá (envio realmente
   não saiu).
2. Remover só 1 cliente (61 de 62, edição "normal") → sem bloqueio,
   envio passou — como o teste realmente enviou pro servidor de
   produção, restaurei a lista completa de 62 em seguida (usando uma
   cópia em cache de uma aba anterior, mesmo processo de recuperação
   da parte 59) e conferi, com um diff completo de todas as 32 chaves
   entre a cópia boa e o servidor, que ficou tudo idêntico de novo
   (zero diferenças) antes de encerrar o teste.

**Lição repetida**: mesmo testando uma trava DE segurança, testar
direto contra produção quase causou um novo desalinhamento pequeno
(1 cliente a menos) — reforça o que já ficou anotado na parte 59: um
projeto Firebase separado só pra teste evitaria esse tipo de cuidado
manual toda vez.

## Retomada em 2026-08-31 (parte 61) — Escapa HTML também em modulos_isolados/ (+ 2 lacunas achadas no processo, uma delas no app principal)

Pedido do usuário: próximo item da lista da auditoria — a correção de
XSS (parte 57) nunca tinha sido replicada pra `modulos_isolados/` (9
pastas de páginas de teste isoladas, cada uma com cópia própria de
`core.js` e arquivos do módulo, com drift pré-existente e conhecido
em relação ao app principal — não são cópias exatas).

**Execução**: delegado a um agente em background (mesmo padrão da
parte 57 — achar `innerHTML +=`/`innerHTML =` com campo de texto
livre e envolver em `escapeHtml(...)`), instruído a: adicionar
`escapeHtml()` em cada um dos 9 `core.js`; varrer os outros 17
arquivos (`arvore.js`, `atribuicao-tarefas.js`, `distribuicao-custos.js`
×2, `feriados.js` ×4, `bi.js`, `cadastros.js`, `catalogo-lego.js`,
`aprovacoes-calendario.js`, `kanban.js`, `relatorios.js`,
`apontamento.js` ×3, `importexport.js`) usando os arquivos já
corrigidos do app principal como referência de critério, sem tentar
"consertar" o drift em si. Resultado: 22 arquivos tocados (9 `core.js`
+ 13 outros com wraps — os 4 restantes, 3 `apontamento.js` e
`importexport.js`, confirmados sem `innerHTML` nenhum, igual ao app
principal), `node --check` limpo em todos.

**Revisão** (antes de commitar, por trás do pedido explícito do
usuário de eu revisar o resultado do agente): achei 2 lacunas reais
que o próprio agente sinalizou honestamente como "vale conferir" ou
que apareceram numa varredura própria minha depois:

1. **Bug real no APP PRINCIPAL, não só nos isolados**: o agente
   reportou ter deixado o `<option>` do dropdown `#dc-projeto`
   (`js/distribuicao-custos.js`) sem escapar "pra bater com o app
   principal" — só que o app principal TAMBÉM tinha esse ponto sem
   escapar, um ponto que passou batido na varredura da parte 57
   (provavelmente porque o grep de então não cobria esse padrão
   específico de `<option>` fora de uma `<td>`). Corrigido nos 3
   lugares: `js/distribuicao-custos.js` (app principal) e as 2 cópias
   em `modulos_isolados/`.
2. **Lacuna minha, não do agente**: pedi ao agente pra inserir a
   função `escapeHtml()` em cada `core.js`, mas esqueci de pedir pra
   ele também varrer os USOS de `innerHTML` dentro do próprio
   `core.js` — que no app principal tinha 3 pontos corrigidos
   (cabeçalho do usuário logado + dropdown de "modo teste"). Como
   todos os 9 `core.js` isolados compartilham essa mesma seção
   idêntica (só a linha muda por causa do drift em outras partes do
   arquivo), corrigi os 9 de uma vez com um script Node fazendo a
   troca de string exata, replicando o padrão do app principal
   (`escapeHtml(nomeParaExibicao(usuarioLogado.nome))` no cabeçalho;
   `escapeHtml(f.nome)`/`escapeHtml(nomeParaExibicao(f.nome))`/
   `escapeHtml(f.nivel)` no dropdown de identidade de teste — e troquei
   o `f.nome.replace(/"/g, '&quot;')` parcial, que só escapava aspas,
   pelo `escapeHtml()` completo).

**Verificação**: `node --check` limpo nos 24 arquivos tocados ao todo
(22 do agente + `js/distribuicao-custos.js` do app principal + as 2
correções extras nos isolados). Varredura própria com os mesmos 2
padrões de grep da parte 57, agora cobrindo `modulos_isolados/` — nada
restante sem escapar. Testado no navegador: `modulos_isolados/cadastros/`
carrega e a tabela de Clientes renderiza corretamente (inclusive um
nome de cliente com "&" no meio, sem quebrar nada). Um erro de console
pré-existente (`renderizarListaLegoComum is not defined`) foi
confirmado, via `git diff`, como fora de qualquer linha tocada — não
relacionado a esta mudança.

## Retomada em 2026-08-31 (parte 62) — Script de verificação de sincronia modulos_isolados/ (sem eliminar a duplicação)

Pedido do usuário: próximo item da lista da auditoria era "eliminar
duplicação de modulos_isolados/" — mas isso contradiz uma regra já
registrada no projeto (a duplicação é PROPOSITAL, não mexer sem
perguntar — ver memória do projeto). Perguntei; usuário pediu pra eu
sugerir com base em boas práticas. Recomendação: não eliminar a
duplicação (arriscaria quebrar o propósito de isolamento das páginas
de teste), e sim automatizar a DETECÇÃO de quando ela fica
desatualizada — o problema real não é duplicação existir, é confiar na
memória humana pra replicar manualmente (já falhou antes, ver parte
39 sobre `relatorios.js`).

**O que foi criado**: `scripts/verificar-sync-modulos-isolados.js` —
script Node (sem dependência nova) que:
1. Pra cada `modulos_isolados/*/js/*.js`, acha o arquivo correspondente
   em `js/` (mesmo nome), extrai toda função nomeada
   (`function nome(...) {...}`) dos dois lados com um tokenizer simples
   (rastreia string/comentário pra não deixar uma chave `{`/`}` dentro
   de string bagunçar a contagem de profundidade), e compara o corpo
   (normalizado de espaço em branco) de cada função que existe nos
   DOIS lados. Função só de um lado não conta como problema (pode ser
   específica do harness ou do app completo) — só quando existe nos
   dois e o conteúdo diverge.
2. Compara `estilos.css` de cada pasta contra o `estilos.css`
   principal (convenção documentada: deveriam ser idênticos).
3. Não altera nada — só relatório, saída de erro (`process.exitCode = 1`)
   se achar algo, pra poder ser usado num futuro CI se um dia existir.

**Resultado da primeira rodada — achado maior do que o esperado**:
rodei contra o estado atual do repo (esperava só achar o resíduo do
fix de XSS, que já tinha sido replicado corretamente na parte 61) e
o script achou uma quantidade bem maior de drift genuíno acumulado ao
longo de várias sessões passadas, não só o caso já conhecido do
`relatorios.js`:
- `arvore.js`: 9 funções divergentes; `distribuicao-custos.js`: 17 (nas
  2 cópias); `core.js`: 4 funções divergentes em praticamente TODAS as
  9 cópias (inclui a mudança da "reforma das orelhas", parte do
  redesign 2026-08-25 — nunca propagada); `kanban.js`, `bi.js`,
  `feriados.js`, `cadastros.js`, `relatorios/core.js`: divergências
  menores, 1-3 funções cada.
- `estilos.css`: **todas as 9 cópias divergem** do principal — o
  principal tem 880 linhas hoje; 8 das 9 cópias têm só 285 (congeladas
  há muito tempo); a de `relatorios/` tem 671 (mais recente, mas ainda
  atrás).

Confirmei que não é falso-positivo do script: comparei manualmente o
corpo de `alternarModulo()` (principal vs. `modulos_isolados/arvore/`)
e a diferença é real — o principal tem o bloco novo da reforma das
orelhas que a cópia isolada nunca recebeu.

**Decisão pendente, não tomada nesta rodada**: o script cumpriu o que
foi pedido (detectar, não corrigir). Dado o tamanho real do drift
(muito maior do que "replicar umas funções"), decidir se/como corrigir
fica pro usuário — não fiz a correção em massa sem confirmar escopo
primeiro.

**Verificação**: `node --check` limpo no script. Rodado contra o repo
real (só leitura — não altera nenhum arquivo do app).

## Retomada em 2026-08-31 (parte 63) — Aplica a sincronia detectada na parte 62 + achado: uma categoria de drift mais funda que o script não cobre

Pedido do usuário: "corrigir tudo agora" (o drift que o script da parte
62 achou).

**Execução**: criado `scripts/aplicar-sync-modulos-isolados.js` — reusa
o mesmo extrator de função do script de verificação, mas em vez de só
reportar, substitui o corpo de cada função divergente pelo texto exato
do arquivo principal (reextrai os índices a cada troca, já que o
tamanho do corpo novo pode ser diferente do antigo). `estilos.css`:
cópia integral (convenção já documentada é serem idênticos).
Resultado: 84 funções substituídas em 17 arquivos `.js` + 9
`estilos.css` copiados. `node --check` limpo em tudo. Rodei o script
de verificação de novo: 0 divergências restantes.

**Achado durante a verificação em navegador** (testei Árvore e
Distribuição de Custos de verdade, não só sintaxe): sincronizar o
CORPO das funções que já existiam nos dois lados não é suficiente
quando o app principal, ao longo do tempo, criou uma função NOVA
(nome que nunca existiu na cópia isolada) e uma das funções já
sincronizadas passou a chamá-la. Dois casos reais, confirmados por
erro de verdade no console (não só grep):
1. `modulos_isolados/arvore/` — `visualizarNo()` (já sincronizada)
   chama `formatarMoeda()`, que só existe em `js/distribuicao-custos.js`
   — arquivo que esse harness nunca carregou (é um módulo só de
   Árvore, por design).
2. `modulos_isolados/distribuicao-custos/` (as 2 cópias) —
   `carregarAbaDistribuicaoAnalista()` (já sincronizada) chama
   `recalcularTabelaDistribuicaoAnalista()`, uma função que substituiu
   a antiga `recalcularLinhaDistribuicaoAnalista()` no app principal em
   algum momento passado — a cópia isolada só tem a versão antiga,
   nunca ganhou a nova.

Essa categoria (função nova inteira, não uma que já existia nos dois
lados) está FORA do que os scripts de sincronia cobrem — eles só
comparam nomes que já são comuns aos dois arquivos. Corrigir isso
exigiria rastrear toda a árvore de chamadas de cada função
sincronizada e trazer qualquer dependência nova junto (potencialmente
recursivo) — escopo bem maior do que "sincronizar o que já existia".
Não tentei resolver isso agora sem confirmar com o usuário — fica
como achado separado, reportado antes de decidir o próximo passo.

**Verificação**: `node --check` limpo em todos os 17 arquivos + 2
scripts novos. Testado no navegador (Árvore e Distribuição de Custos,
ambos os fluxos reais de tela, não só carregamento): confirmou os 2
gaps acima como erros de verdade, reprodutíveis, não falso-positivo
de análise estática (uma tentativa inicial de checagem estática por
regex teve MUITO falso-positivo — funções locais/aninhadas, builtins
do navegador como `Blob`/`FileReader`, e ramos de `alternarModulo()`
nunca alcançáveis pela UI daquele harness específico — descartada em
favor de testar de verdade no navegador).

## Retomada em 2026-08-31 (parte 64) — Corrige os 2 gaps confirmados da parte 63 + separa prompt_gemini.md em arquitetura/changelog

Pedido do usuário: (1) corrigir só os 2 pontos de drift "fundo"
confirmados na parte 63 (função nova que não existia em nenhum dos
lados), sem caçar mais nenhum; (2) depois, separar `prompt_gemini.md`
(documentação de arquitetura + changelog cronológico misturados,
>10.500 linhas) em dois arquivos.

**Parte 1 — os 2 gaps**:
1. `modulos_isolados/arvore/js/arvore.js`: adicionada uma cópia local
   de `formatarMoeda()` (normalmente vive em `distribuicao-custos.js`,
   que esse harness — só Árvore — nunca carrega), com comentário
   explicando a origem da dependência. Testado no navegador: painel de
   Propriedades Contratuais abre sem erro agora.
2. `distribuicao-custos.js` (as 2 cópias isoladas):
   investigação revelou que o gap é maior do que uma função — o HTML
   isolado também não tem os campos `dc-pct-coparticipacao-supervisor`/
   `dc-pct-coparticipacao-escritorio` que `recalcularTabelaDistribuicaoAnalista()`
   lê sem guarda (`.value` direto, sem `if (el)`). Corrigir exigiria
   editar HTML também, não só JS — fora do escopo combinado ("só os 2
   pontos pontuais"). **Deixado como pendência, documentado, não
   corrigido.**

**Parte 2 — separação do arquivo**: `prompt_gemini.md` misturava duas
coisas: a arquitetura/regras vigentes (seções numeradas §1–§14) e o
histórico cronológico (66 entradas "## Retomada em AAAA-MM-DD",
linhas 6548–10556). Antes de decidir COMO separar, contei quantos
comentários no código referenciam o arquivo por padrão: 16+ citam "§X.Y"
(arquitetura) contra só 1 citando "parte N" (changelog) — a esmagadora
maioria das referências históricas espalhadas pelos `.js` aponta pra
conteúdo de ARQUITETURA, não changelog. Por isso a escolha foi:
- `prompt_gemini.md` **continua com o mesmo nome**, mas agora só com
  as seções §1–§14 (linhas 1–6547 do arquivo original) — preserva
  TODAS as referências "ver prompt_gemini.md §X.Y" espalhadas pelo
  código, sem precisar tocar em nenhum desses comentários.
- `CHANGELOG.md` (este arquivo): as 66 entradas cronológicas, com um
  cabeçalho novo explicando a separação e apontando de volta pra
  `prompt_gemini.md` pra arquitetura.
- Nota inserida logo no topo de `prompt_gemini.md` (depois do
  parágrafo de abertura) avisando da separação, pra quem abrir o
  arquivo direto sem ver este changelog primeiro.
- `COMO_CONTINUAR.md` (doc de bootstrap pra nova sessão, já bem
  desatualizado por sinal — fala de zip/Gemini, fluxo pré-git):
  corrigida só a linha que instruía "atualize o prompt_gemini.md a
  cada mudança" (ficaria errada agora) — não modernizei o resto do
  arquivo, fora do escopo desta tarefa.

**Verificação**: conferido que a soma das linhas dos 2 arquivos novos
bate exatamente com o original (6547 + 4009 = 10556), que nenhum dos
dois corta no meio de parágrafo (checado visualmente nas 2 bordas), e
que a contagem de `## ` (headings) nos dois arquivos novos soma o
esperado. `diff -w` confirmou que o conteúdo do trecho final é
idêntico ao original (só difere em quebra de linha CRLF vs. LF, que o
git já normaliza sozinho neste repo).

## Retomada em 2026-08-31 (parte 65) — Reforma Setor→Sub-etapa: cascata financeira genérica pra qualquer Etapa

Pedido do usuário: implementação do plano aprovado (impressão de que o
sistema estava "particularizado demais" — 11 pontos no código só
tratavam a etapa "Detalhamento" como especial). Plano completo em
`C:\Users\CACHOEIRA\.claude\plans\spicy-whistling-rossum.md` (aprovado
via ExitPlanMode) — aqui documento a execução e os 2 problemas reais
achados testando contra dados de produção antes de subir.

**O que mudou**:
1. **Setor → Sub-etapa** (rename mecânico): `nivel === 'setor'` →
   `'subetapa'` em toda a árvore; catálogo próprio
   (`banco_setores_lego` → `banco_subetapas_lego`); rótulos/ids em
   `index.html`, `arvore.js`, `core.js`, `relatorios.js` (que tem um
   `NIVEIS_ARVORE_CUSTO` independente do `NIVEIS_ORDEM` de `arvore.js`
   — precisou de ajuste separado). `recalcularDistribuicaoVerbaSetores`
   (nome já estava errado — na real soma Pavimento globalmente, não
   Setor) renomeado pra `recalcularAreaEquivalenteGlobalPavimentos`
   como parte da limpeza.
2. **Cascata genérica** (`distribuicao-custos.js`): novo helper
   `calcularVerbaCascataCompleta()` roda `distribuirVerbaRecursiva()`
   (motor que já existia e já era genérico) pra TODA Etapa de topo, não
   mais só a achada por `nome.includes('detalhamento')`.
   `listarPavimentosDoProjeto`/`listarSubEtapasDoProjeto` (renomeada de
   `listarSetoresDoProjeto`) reaproveitam esse helper, removendo 8 dos
   11 pontos de nome-match do arquivo. `calcularVerbaPorEtapa(Salvo)`:
   campo `ehDetalhamento` renomeado `temExecucaoGranular`, calculado
   estruturalmente (a subárvore tem algum nó Pavimento?), não por nome.
3. **Coparticipação opcional** (`no.tem_coparticipacao`, setável no
   painel de edição de nó na Árvore, Etapa ou Sub-etapa) — as "2 linhas
   extras" na Aba 2 agora aparecem embaixo de QUALQUER Etapa flagada
   (ids sufixados por índice, `dca-copart-supervisor-0` etc., pra
   suportar mais de uma flagada ao mesmo tempo), não só Detalhamento.
   Rótulo "Verba Detalhamento - Analista" virou "Verba `<Nome>` -
   Analista", genérico.
4. **Pontos Máximo/Painel de Progresso** (confirmado com o usuário):
   `atribuicao-tarefas.js`/`painel-progresso.js` ganharam um segundo
   mapa (`coletarNosFolhaDaArvore` + `_verbaCalc`, mesmo padrão do mapa
   de Pavimento que já existia) cobrindo QUALQUER folha — antes ficava
   sempre 0/manual pra Etapa/Sub-etapa sem Pavimento por trás.
5. **`desempenho-projeto.js`** (escopo maior do que os 2 pontos vistos
   inicialmente): `calcularLinhasFolhaComVerba` generalizada (junta o
   `pavimentoNome` de TODOS os pavimentos de TODAS as etapas, não só
   Detalhamento, via um `Set` de etapas-com-pavimento). Os 2 KPIs que
   ainda acham "a" etapa Detalhamento por nome (linhas ~896/~1023, pra
   preview de horas) foram **deliberadamente deixados como estão** —
   generalizar pra somar-múltiplas-etapas-granulares é maior (toca
   Bonificação/Distribuições inteiras) e fica pra uma rodada própria,
   seguindo a sequência de pouso que o próprio plano recomendou.
6. **Migração automática** (`core.js`, v12/v13, mesmo padrão das
   migrações v2-v11 já existentes): v12 retagga qualquer `nivel==='setor'`
   pra `'subetapa'` em qualquer projeto/profundidade; v13 empacota as 4
   etapas legadas achatadas (Pré-Lançamento/Lançamento/Análise/Cargas)
   dentro de uma nova Etapa "Análise Global" como Sub-etapas, com
   `area_fisica` = o % que cada uma já tinha salvo (e `peso_esforco="1"`
   em todas) — reproduz a proporção antiga EXATAMENTE via Área
   Equivalente. Marca a etapa "Detalhamento" com `tem_coparticipacao=true`
   (única exceção de nome-match no código novo, só na migração, pra
   preservar o comportamento de hoje sem o usuário precisar reconfigurar
   manualmente).

**2 problemas reais achados testando contra os dados de produção reais
antes de subir** (leitura via SDK do Firebase numa aba isolada, nunca
carregando `sync-provisorio.js` — zero risco de escrever de volta):

1. **Nomes reais estão em CAIXA ALTA** ("PRÉ-LANÇAMENTO"), não Title
   Case como o catálogo seed sugeria ("Pré-Lançamento") — a primeira
   versão da migração v13 usava comparação exata sensível a
   maiúsculas/minúsculas e não encontrou NENHUMA etapa legada no
   projeto piloto real. Corrigido pra comparação normalizada
   (`.toLowerCase()`) em ambos os lados, preservando o nome original do
   nó (só a detecção ignora caixa).
2. **Colisão de catálogo órfão**: já existia uma chave
   `banco_subetapas_lego` no banco real — resíduo de uma nomenclatura
   AINDA MAIS antiga (quando "Sub-etapa" era o nome do que hoje é
   Pavimento, migração já existente em `core.js` linhas ~169-172).
   Continha dado não-relacionado e órfão ("COMPATIBILIZAÇÃO/IFC/FACHADA").
   A v12 original só migrava o catálogo real de Setor
   (`banco_setores_lego`, com "SETOR A/B/C/Único" em uso de verdade) se
   a chave nova ainda não existisse — como já existia (com lixo),
   pulava, e o catálogo real ficaria perdido/inacessível. Corrigido pra
   sobrescrever sempre (confirmado que nada no código atual lê o dado
   órfão).
3. **Bug de cálculo achado só testando os NÚMEROS, não só a
   estrutura**: a primeira versão de `calcularVerbaCascataCompleta`
   descontava o % de Fundo Distribuição de Lucros de TODA Etapa
   incondicionalmente — numa Etapa só de Sub-etapas sem Pavimento
   nenhum (ex: "Análise Global"), esse dinheiro "descontado" não tinha
   pavimento nenhum pra recolher a fatia (`valorFundoLucros` só é
   populado ao colher nós Pavimento), então simplesmente desaparecia:
   a soma das Sub-etapas ficava 5% menor que a Verba líquida da própria
   Etapa (R$40.431,85 vs. R$42.559,84 no piloto real). Corrigido pra só
   descontar onde o fundo tem destino de verdade (`subarvoreTemPavimento`,
   já existia pra outro propósito, reaproveitada aqui).

**Verificação**:
- `node --check` limpo nos 8 arquivos tocados (`core.js`, `arvore.js`,
  `distribuicao-custos.js`, `desempenho-projeto.js`,
  `atribuicao-tarefas.js`, `painel-progresso.js`, `relatorios.js`,
  `index.html` — balanceamento de `<div>` conferido, 420/420).
- Lógica da migração testada isoladamente em Node puro (5 cenários:
  projeto real completo, casamento parcial, nenhuma etapa legada,
  projeto já com "Análise Global" — defensivo, idempotência) antes de
  qualquer teste no navegador — todos passaram.
- Testado ao vivo contra os 10 projetos reais de produção, **sempre
  leitura isolada** (SDK do Firebase direto numa aba que nunca carrega
  `sync-provisorio.js`, ou — quando precisei ver a UI renderizada de
  verdade — carregando `index.html` normalmente e desarmando
  `_syncFirebaseRef`/`_syncTimeoutEnvio` logo após o pull inicial
  completar, antes do debounce de 3s poder disparar um envio de volta).
  Confirmado: nenhum `nivel==='setor'` restante em nenhum projeto;
  "Análise Global" criada corretamente nos projetos com o padrão
  legado (parcial em alguns, todas as 4 em outros); projeto piloto "AP
  PRAIA (SAVOIA) - SETOR B" bate número por número com a auditoria
  feita mais cedo nesta mesma sessão (R$85.119,68 Verba Global,
  85%/15% Fundo Garantidor, R$12.767,95, 21 pavimentos) — a reforma não
  mudou nenhum valor existente, só generalizou o mecanismo. Telas
  consumidoras (Propriedades Contratuais, Atribuição de Tarefas,
  Painel de Progresso — este já mostrando 100% pra "Análise Global"
  totalmente finalizada, usando o valor calculado) sem erro no console.

**Pendências documentadas, não resolvidas nesta rodada** (consciente,
seguindo a sequência de pouso do plano):
- `desempenho-projeto.js`: os 2 KPIs de preview de horas ainda acham
  "a" etapa Detalhamento por nome (item 5 acima).
- `modulos_isolados/`: nenhuma cópia isolada foi tocada — mesmo
  precedente já registrado várias vezes nesta sessão. Precisam do
  mesmo tratamento depois: `arvore/`, `catalogo/`,
  `distribuicao-custos/` (2 cópias), `atribuicao-tarefas/` (cópia
  própria de `distribuicao-custos.js`), `bi/`, `kanban/`, `relatorios/`,
  `cadastros/`.
- Comentários (só prosa, zero código funcional) em `catalogo-lego.js`,
  `bi.js`, `distribuicao-lucro.js`, `aprovacoes-calendario.js`,
  `kanban.js`, `apontamento.js` ainda mencionam "Setor" — cosmético,
  confirmado sem nenhum `nivel==='setor'` funcional restante em
  nenhum desses arquivos.

## Retomada em 2026-08-31 (parte 66) — Coparticipação vira sub-menu expansível na "Verba por Etapa"

Pedido do usuário: as 2 linhas de Coparticipação Supervisor/Escritório
que aparecem abaixo de qualquer Etapa flagada com `tem_coparticipacao`
(item 4 da parte 65, acima) ficavam sempre visíveis, ocupando espaço na
tabela mesmo quando o usuário não quer olhar esse detalhe agora. Pedido:
"abrir em sub-menus expansíveis quando houver coparticipação em alguma
etapa".

- **`js/distribuicao-custos.js`**:
  - `construirLinhasCoparticipacao(fIdx)`: as 2 `<tr>` ganharam
    `data-copart-rows="fIdx"` e `display:none` por padrão (escondidas
    até o usuário clicar pra expandir).
  - `construirLinhaDistribuicaoAnalista()`: a linha da própria Etapa
    (quando `temCoparticipacao`) ganhou uma seta `►`/`▼`
    (`.tree-toggle-icon`, mesma classe/glifos já usados na Árvore de
    Projeto e na aba "Verba por Tarefa") antes do rótulo, com
    `onclick="alternarLinhasCoparticipacao(fIdx)"`.
  - Nova `alternarLinhasCoparticipacao(fIdx)`: mostra/esconde as 2
    linhas daquela Etapa e alterna o glifo da seta. Não usa variável de
    estado nem re-renderiza a tabela (só `style.display` direto no
    DOM) — evita perder o que o usuário estiver digitando em outros
    campos de % enquanto abre/fecha o sub-menu.

Testado ao vivo contra 2 projetos reais de produção ("AP PRAIA (SAVOIA)
- SETOR B" e "HOME GARDEN - SETOR C", ambos com a Etapa "DETALHAMENTO"
flagada `tem_coparticipacao=true` pela migração v13) usando a mesma
técnica de leitura segura desta sessão (`index.html` normal +
desarmar `_syncFirebaseRef`/`_syncTimeoutEnvio` logo após o pull
inicial, antes do debounce de 3s). Confirmado no HTML renderizado: seta
`►` presente só nas Etapas flagadas, as 2 linhas nascem com
`display:none`, `alternarLinhasCoparticipacao(1)` alterna
corretamente pra `table-row`/`none` e o glifo pra `▼`/`►`, e o
recálculo ao vivo (`recalcularTabelaDistribuicaoAnalista`, ao mudar os
%'s de coparticipação em "Orçamento Global") continua atualizando os
valores das linhas mesmo expandidas.

**Não tocado** (mesmo precedente já registrado várias vezes): as 2
cópias de `distribuicao-custos.js` em `modulos_isolados/` — já estavam
com o mesmo tipo de defasagem desde a parte 65 (Setor→Sub-etapa), essa
UI de sub-menu se soma à mesma pendência de sincronia.

## Retomada em 2026-09-01 (parte 67) — "Verba por Pavimento" vira "Verba por Sub-etapa": um quadro por Etapa, % Fundo de Lucros por Etapa

Lote de revisões acumuladas pelo usuário (pedido explícito: "vamos
acumular revisões, implemente apenas depois que eu disser") sobre a
antiga aba "Verba por Pavimento" (Aba 4 da Distribuição de Custos):

1. Aba renomeada "Verba por Pavimento" → "Verba por Sub-etapa".
2. Layout do "% Fundo Distribuição de Lucros" redistribuído (valor em
   R$ sempre visível, botão "Salvar %" menor) + limite 0–100%.
3. "Verba Líquida (Etapa Detalhamento)" → "Verba Líquida Total",
   passou a ser a Verba Global para Produção (antes de repartir por
   Etapa), não mais a soma do que tinha Pavimento cadastrado.
4. Total por Etapa (soma das Sub-etapas/Pavimentos dela) + Total Geral
   (soma de todas as Etapas).
5. A aba sempre abre com a rolagem no topo.
6. "% Fundo Distribuição de Lucro" deixou de ser um único valor do
   projeto e virou um campo por Etapa, calculado sobre a verba bruta
   DAQUELA Etapa — confirmado pelo usuário: "o Fundo de distribuição de
   Lucro deve ser calculado sobre a verba de cada etapa
   individualmente. O Fundo de distribuição de lucros total deve ser a
   soma do fundo individual de cada etapa".
7. Título "Pavimento" trocado por "Sub-etapa" nas tabelas desta aba.
8. Cada quadro (cartão) leva o nome da Etapa como título.

Antes de implementar, montei uma **prévia estática** (Artifact, sem
mexer no app) com o layout proposto, incluindo uma rodada usando dados
REAIS do projeto "HOME GARDEN - SETOR C" (lidos ao vivo do app com
sync desligado) pra validar os números com o usuário antes de escrever
código — só depois do "pode implementar" a mudança entrou no código de
verdade.

**`js/distribuicao-custos.js`** (motor de cálculo — maior parte da
mudança):
- `obterPctFundoLucrosPavimento(nomeProjeto, etapa)`: assinatura mudou
  de `(nomeProjeto)` pra `(nomeProjeto, etapa)` — o 2º argumento agora
  é o NÓ da Etapa (não mais nada), porque a decisão de qual % usar por
  padrão depende da estrutura dela. Armazenamento novo:
  `banco_fundo_lucros_pavimento[projeto].etapas[nomeEtapa].pct`
  (sucessor do antigo `banco_fundo_lucros_pavimento[projeto].pct`,
  único e global). Regra de compatibilidade decidida com cuidado pra
  NÃO mudar retroativamente os números de projetos já em produção: se a
  Etapa já tem seu próprio % salvo (formato novo), usa esse; senão, se
  a Etapa tem Pavimento na subárvore (`subarvoreTemPavimento` — a
  ÚNICA que tinha esse conceito até esta revisão), usa o % antigo
  salvo (ou 5% se nunca configurado — mesmo default de sempre); senão
  (Etapa só-de-Sub-etapa, ex: "Análise Global", que NUNCA teve esse
  conceito), começa do **zero**, não herda o "5% padrão" antigo — só
  passa a descontar fundo se o administrador ligar isso explicitamente
  pra ela. Validado ao vivo: "DETALHAMENTO" (que já tinha 5% salvo)
  continuou em 5% sem o usuário precisar refazer nada; "Análise Global"
  (nunca configurada) nasceu em 0%.
- `calcularVerbaCascataCompleta()`: 3º argumento virou um mapa
  `{ nomeEtapa: pct }` (era um número único). Removido o gate
  `subarvoreTemPavimento(etapa) ? ... : 0` que existia pra evitar
  "dinheiro sem destino" — não precisa mais, porque o default de 0%
  pra Etapas sem Pavimento (acima) já resolve isso sem gate especial.
  Guarda `_pctFundoLucros`/`_valorFundoLucros`/`_verbaBrutaEtapa` no
  próprio nó da Etapa (mesmo padrão de `_verbaCalc`) pra
  `listarPavimentosDoProjeto`/`listarSubEtapasDoProjeto` reaproveitarem
  sem recalcular.
- `listarSubEtapasDoProjeto()`: ganhou `valorFundoLucros` (rateio por
  Área Equivalente, mesmo mecanismo que `listarPavimentosDoProjeto` já
  usava) e `etapa` (nome da Etapa de topo) em cada item — antes só
  `listarPavimentosDoProjeto` tinha isso.
- `calcularListaPavimentosComVerba()` (versão "ao vivo"): agora também
  devolve `subetapas`, `fundoPorEtapa` (um item por Etapa: %, valor,
  verba bruta) e `verbaGlobalProducao` (a nova "Verba Líquida Total").
  `calcularListaPavimentosComVerbaSalva()` (usada por Atribuição de
  Tarefas/Painel de Progresso/Distribuição de Lucro) **não mudou** —
  continua só com `.pavimentos`, que era tudo que esses 3 consumidores
  já liam.
- `renderizarTabelasVerbaPavimento()`: reescrita — monta um
  `.vt-card` (mesma cara dos cartões de Pavimento da aba "Verba por
  Tarefa") por Etapa, com seu próprio campo de %, sua tabela de
  Sub-etapas/Pavimentos e seu "Total da Etapa". Os campos de % Fundo
  usam só `onblur` (não `oninput`) de propósito: eles agora vivem
  DENTRO da área que a função reconstrói a cada chamada — recalcular a
  cada tecla apagaria o próprio campo que a pessoa está digitando.
- `carregarAbaVerbaPavimento()`: limpa `#vp-etapas-wrapper` antes de
  renderizar (ver bug abaixo) e força `#dc-conteudo-principal.scrollTop
  = 0` (item 5).
- Novas: `construirLinhaVerbaSubEtapa(item, tipo)`,
  `limitarPctFundoLucros(inputEl)` (clampa 0–100%, item 2).
  `salvarFundoLucrosPavimento()` mudou de assinatura: recebe o
  `<button>` clicado (lê a Etapa de `data-etapa`) em vez de nada — evita
  embutir o nome da Etapa numa string de `onclick`.

**`index.html`**: aba renomeada; bloco estático da Aba 4 trocado por
`#vp-etapas-wrapper` (vazio, montado 100% via JS) + linhas de "Fundo de
Distribuição de Lucros Total" e "Total Geral".

**`estilos.css`**: seletor `#conteudo-verba-pavimento > .table-wrapper
> table` (exigia filho DIRETO) virou `#conteudo-verba-pavimento
.table-wrapper > table`, porque as tabelas agora vivem dentro de um
`.vt-card` por Etapa, não mais soltas direto na aba.

**Bug real encontrado e corrigido durante o teste ao vivo** (antes de
considerar pronto): `renderizarTabelasVerbaPavimento()` lê os %'s "ao
vivo" direto dos campos `.vp-input-pct-fundo` já presentes na tela
antes de reconstruir (pra não perder o que o usuário está digitando).
Isso vazava o % de uma Etapa do projeto ANTERIOR pra uma Etapa de MESMO
NOME no projeto novo ao trocar de projeto — reproduzido de verdade:
salvei 5% pra "Análise Global" do projeto "HOME GARDEN - SETOR C", troquei
pra "AP PRAIA (SAVOIA) - SETOR B" (que também tem uma Etapa "Análise
Global", mas nunca configurada) e ela nasceu com 5% em vez de 0%.
Corrigido limpando `#vp-etapas-wrapper` no início de
`carregarAbaVerbaPavimento()`, antes do primeiro `renderizarTabelasVerbaPavimento()`
de cada troca de projeto — reproduzi o cenário de novo depois da
correção e confirmei 0% correto.

Testado ao vivo contra os 2 projetos reais desta sessão ("HOME GARDEN -
SETOR C" e "AP PRAIA (SAVOIA) - SETOR B", mesma técnica de leitura seg
ura de sempre — sync desligado logo após o pull inicial). Conferido:
números batem com os calculados à mão antes de implementar (Verba
Líquida Total R$ 27.369,87 pra HOME GARDEN, quadros com % e Total da
Etapa corretos), edição de Área/Peso recalcula só o quadro da própria
Etapa, `limitarPctFundoLucros` clampa 150% pra 100%, botão "Salvar %"
grava em `banco_fundo_lucros_pavimento[projeto].etapas[nome]` mantendo
o `.pct` antigo (formato legado) intocado ao lado, troca de aba e volta
zera a rolagem, selo de conferência (Total Geral + Fundo de Lucros ==
Soma das Verbas Brutas das Etapas) fecha ✅, e as abas "Verba por
Etapa"/"Verba por Tarefa" continuam sem erro no console. `node --check`
passou nos 2 arquivos JS tocados.

**Não tocado**: comentários em `desempenho-projeto.js`/
`distribuicao-lucro.js` que ainda mencionam "Aba 4/Verba por Pavimento"
pelo nome antigo — só prosa, sem efeito funcional. As 2 cópias de
`distribuicao-custos.js` em `modulos_isolados/` (mesmo precedente de
sempre — já estavam defasadas desde a parte 65).

## Retomada em 2026-09-01 (parte 68) — Campo % sem seta, "Verba por Tarefa" vira árvore, catálogo de Etapas, "Pavimento"→"Local", Kanban em lista

Segundo lote de revisões acumuladas (mesmo pedido "acumular revisões,
implementar só depois" da parte 67) — 6 itens numerados, do 9 ao 14:

**Item 9 — campo "% Fundo Distrib. Lucros" cortava o número**:
`renderizarTabelasVerbaPavimento()` (`js/distribuicao-custos.js`)
alargou o campo de 72px pra 92px e ganhou a classe
`campo-percentual-sem-seta`; `estilos.css` ganhou a regra que remove as
setas de incremento do `type="number"` (Chrome/Safari via
`::-webkit-*-spin-button`, Firefox via `appearance:textfield`) — só
digitação manual agora.

**Itens 10-11 — aba "Verba por Tarefa" virou árvore expansível**: pedido
do usuário, refinado depois de uma prévia (Artifact) — "usar o critério
de expandir os quadros, colocando as Etapas (mãe) e expandindo os
quadros para os filhos até chegar ao nível das tarefas". Antes só
listava Pavimentos (lista achatada, vinda de
`calcularListaPavimentosComVerba().pavimentos`) — qualquer Etapa sem
Pavimento (ex: "Análise Global", só Sub-etapa) nunca aparecia.
Reescrito em `js/distribuicao-custos.js`:
- `carregarAbaVerbaPorTarefa()`: agora chama
  `calcularVerbaCascataCompleta()` direto (mesma cascata que "Verba por
  Sub-etapa" já roda) e percorre a árvore INTEIRA — todo nó já sai com
  `_verbaCalc` preenchido (inclusive Tarefa, já dividida por Pontos
  dentro do grupo, via `distribuirVerbaRecursiva`).
- Novas `construirQuadroEtapaVerbaPorTarefa()` (nível 1, um quadro por
  Etapa) → `construirNoVerbaPorTarefa()` (despacha cada filho) →
  `construirGrupoTarefaVerbaPorTarefa()` (nó cujos filhos são Tarefa —
  Pontos editáveis, rateio ao vivo, Horas Máximas, Subtotal,
  conferência: **comportamento 100% preservado**, só deixou de ser
  exclusivo de "Pavimento") ou `construirLinhaLeafMaeVerbaPorTarefa()`
  (item 11: nó SEM filhos vira, ele mesmo, a "tarefa" final, com a
  verba TOTAL que já coube a ele — sem campo de Pontos, editá-lo não
  mudaria nada nesse caso, já que não tem irmão de Tarefa pra dividir
  com; Executor e Horas Máximas continuam funcionando, usando os mesmos
  campos que o nó já tem).
- 3 níveis de recolhimento independentes, mesmo glifo ►/▼ de sempre:
  `vtEtapasRecolhidas` (Etapa, novo), `vtGruposRecolhidos` (Sub-etapa/
  Pavimento com Tarefa, já existia — reaproveitado sem mudança de
  comportamento).
- `#vt-grid-pavimentos` (`.vt-grid`, grade de até 3 colunas) virou
  `#vt-arvore-wrapper` (coluna única, `index.html`) — não faz mais
  sentido grade quando o conteúdo é uma árvore hierárquica.

**Item 12 — catálogo de Etapas só com "Detalhamento"/"Análise Global"**:
pedido do usuário, retomando o que tinha ficado em aberto no início da
sessão. Migração v14 nova em `js/core.js` (mesmo padrão v1-v13) —
**mas só a metade ADITIVA**: qualquer nome do catálogo de Etapa
(`banco_etapas_lego`) que não seja "Detalhamento" nem "Análise Global"
entra no catálogo de Sub-etapa (`banco_subetapas_lego`), se ainda não
estiver lá. **Não remove nada de `banco_etapas_lego` automaticamente**
— achado real testando contra o app antes de considerar pronto: a
trava de sanidade do sync (`_syncSnapshotPareceIncompleto`,
`sync-provisorio.js`, criada depois do incidente real de 2026-08-31)
bloqueia qualquer ENVIO que encolha uma lista "de verdade" (≥5 itens)
pra menos da metade. `banco_etapas_lego` tinha 8 itens reais em
produção; a lista final teria 2 (75% de encolhimento) — bloquearia o
envio pra QUALQUER cliente que tentasse migrar isso automaticamente, a
mudança nunca sincronizaria, e cada recarregamento traria os 8 itens
de volta via pull (loop sem saída sozinho — reproduzi isso de verdade,
não é hipotético: `[sync-provisorio] ENVIO BLOQUEADO — banco_etapas_lego:
8 → 2` no console). A remoção final dos 6 nomes de
`banco_etapas_lego` ficou como 1 clique manual no 🗑️ de cada linha
em Cadastro → Gestão de Etapas (UI que já existia) — bem abaixo do
limite de 50%, sincroniza normal.

**Item 13 — "Pavimento" virou "Local" nos rótulos visíveis** (pedido do
usuário: "achei um nome melhor... um pavimento é um local", inspirado
no Location-Based Management System / LBMS, que generaliza exatamente
esse nível pra "Location"). Escopo deliberadamente restrito a
RÓTULOS — o `nivel` interno continua `'pavimento'` em toda a aplicação
(funções, `NIVEIS_ORDEM`, `banco_pavimentos_lego`), evitando uma
reforma do tamanho da Setor→Sub-etapa só por causa de um nome:
- `js/arvore.js`: `ROTULO_BOTAO_POR_NIVEL.pavimento` ("+Pav"→"+Loc"),
  "Tipo de Pavimento:"→"Tipo de Local:", "Peso do Pavimento:"→"Peso do
  Local:".
- `js/relatorios.js`: coluna de filtro do construtor de relatórios
  ("Pavimento"→"Local"), `ROTULOS_NIVEL_ARVORE_CUSTO.pavimento`, título
  da árvore de custos.
- `js/core.js`: `titulosPorAba.pavimentos` ("Gestão de PAVIMENTOS"→
  "Gestão de LOCAIS").
- `index.html`: aba do Cadastro ("🧮 Pavimentos"→"🧮 Locais"), tabela do
  catálogo ("Nome da Pavimento"→"Nome do Local", "Nova Pavimento..."→
  "Novo Local..."), descrição da Distribuição de Lucro, filtro do
  Relatório de Custos.
- Deliberadamente NÃO tocado: "Número de Pavimentos"/"Pavimentos:" no
  Cadastro de Projetos — é a contagem FÍSICA de andares do prédio (um
  dado real do projeto), conceito diferente do nível genérico da
  árvore, mesmo que o nome coincida.

**Item 14 — Kanban ganhou visão Lista**: pedido do usuário —
"alternar a visão em cartão ou em lista, a critério do usuário".
`js/kanban.js`:
- `alternarVisualizacaoKanban(modo)`: troca `kbModoVisualizacao`
  ('cartao'/'lista'), persiste em `localStorage['kb_modo_visualizacao']`
  (preferência de tela, fora de qualquer `banco_*` sincronizado) — a
  escolha sobrevive entre sessões.
- `renderizarListaKanban()`: uma tabela por Status (mesma ordem de
  `KB_COLUNAS`), 1 linha por tarefa (bolinha de prioridade, Tarefa +
  breadcrumb, Executor, Pontos, Previsto) — reaproveita os MESMOS
  campos que já chegavam prontos pro Cartão, sem cálculo próprio.
  Escopo consciente: é só CONSULTA — arrastar-e-soltar, cronômetro e
  aprovação de finalização continuam exclusivos da visão Cartão (aviso
  fixo no topo da lista avisa isso).
- `renderizarQuadroKanban()`: o cálculo de datas previstas (que só
  rodava dentro do laço por coluna) saiu pra um passo único sobre TODAS
  as tarefas, já que as duas visões precisam do mesmo dado.
- `index.html`: 2 botões nível `.aprov-aba` (mesmo estilo das abas
  "Meu Kanban"/"Tarefas a supervisionar" já existentes) acima do
  quadro, `#kb-lista-wrapper` novo ao lado de `#kb-quadro`.

**Achado de metodologia de teste** (vale registrar — não é bug do
código): o servidor local (`python -m http.server`) reiniciado entre
rodadas de teste não é o suficiente pra garantir JS fresco no
navegador de teste — o navegador cacheia `<script src>` por URL,
sobrevive a reinício de servidor E a `navigate(..., force:true)` com
query-string nova na URL principal (cache-busting da página HTML não
alcança os `<script>` filhos). Confundiu bastante a investigação do
item 12 (cheguei a suspeitar de um bug real na migração v14). Solução
que funcionou: `fetch('/js/arquivo.js', {cache:'no-store'})` +
`(0, eval)(texto)` pra forçar o JS mais novo a substituir as funções
globais já carregadas, sem precisar reabrir a aba.

Testado ao vivo contra "HOME GARDEN - SETOR C" (mesma técnica de
leitura segura de sempre — sync desligado, `localStorage.clear()` +
recarregar pra simular pull limpo do Firebase antes de cada bateria de
teste). Confirmado: campo sem seta e mais largo (92px,
`appearance:textfield`); árvore "Verba por Tarefa" com "Análise
Global"/"DETALHAMENTO" recolhidas por padrão, PRÉ-LANÇAMENTO/
LANÇAMENTO/ANÁLISE/CARGAS abrindo como folha com verba própria e
Executor "Igor" pré-preenchido (dado real), TÉRREO abrindo em 5 Tarefas
com rateio por Pontos batendo com o valor calculado à mão antes de
implementar, selo de conferência ✅; catálogo de Sub-etapas com os 10
itens (4 originais + 6 migrados), catálogo de Etapas intocado (8
itens, prontos pra exclusão manual); Cadastro → Locais com os rótulos
novos; Kanban alternando Cartão↔Lista, escolha persistindo em
`localStorage`, abas "Meu Kanban"/"Ranking" sem regressão. `node
--check` passou em todos os 5 arquivos JS tocados (`core.js`,
`distribuicao-custos.js`, `arvore.js`, `relatorios.js`, `kanban.js`).
Zero erro novo no console em nenhuma das rodadas.

**Não tocado**: as cópias em `modulos_isolados/` (mesmo precedente de
sempre) — `arvore/`, `catalogo/`, `distribuicao-custos/` (2 cópias),
`atribuicao-tarefas/` (cópia própria de `distribuicao-custos.js`),
`kanban/`, `relatorios/`, `cadastros/`.

## Retomada em 2026-09-01 (parte 69) — 3 correções: tela em branco na "Verba por Tarefa", grade de 3 colunas de volta, bug do "% Concluída", varredura final "Pavimento"→"Local"

Feedback real do usuário depois da parte 68 subir pra produção — 4
correções nesta rodada:

**1. Tela em branco em "Verba por Tarefa"** — usuário reportou e mandou
o console: `Uncaught TypeError: Cannot set properties of null (setting
'innerHTML') at carregarAbaVerbaPorTarefa (distribuicao-custos.js:1227)`.
Causa: o `id` do container mudou de `vt-grid-pavimentos` pra
`vt-arvore-wrapper` na parte 68 (index.html + distribuicao-custos.js no
mesmo commit) — um navegador com o HTML antigo em cache (sem o `id`
novo) rodando o JS novo (que já procura o `id` novo) quebra igual.
**Sem mudança de código** — era mesmo cache do navegador do usuário (o
deploy em si estava correto, os 2 arquivos foram commitados juntos).
Resolvido só com recarregamento forçado (Ctrl+Shift+R).

**2. Cartões voltaram a empilhar 1 por linha, não mais 3 colunas lado
a lado** — regressão real da parte 68: ao reescrever "Verba por Tarefa"
como árvore, o container dos cartões-filho de cada Etapa
(`construirQuadroEtapaVerbaPorTarefa`/`construirNoVerbaPorTarefa`, em
`js/distribuicao-custos.js`) parou de usar a classe `.vt-grid` (grade
de 3 colunas, responsiva pra 2/1 em telas menores — a mesma classe que
"Verba por Tarefa" já usava ANTES da parte 68, só que aplicada na `div`
errada durante a reescrita). Corrigido: `class="vt-grid"` de volta nos
2 containers de filhos (nível Etapa e o nível intermediário genérico,
raramente usado hoje). A classe em si não mudou (`estilos.css`
intocado).

**3. Bug real do usuário: "% Concluída" mostrava 44% com TODAS as
tarefas Finalizada** — ver diagnóstico já registrado como item 15 da
lista de revisões acumuladas. Causa confirmada: `desempenho-projeto.js
::calcularConclusaoProjeto()` chamava `calcularProgressoSubarvore()`
com só 4 argumentos — faltava o 5º (`verbaPorCaminhoQualquerFolha`),
que `painel-progresso.js::calcularProgressoProjeto()` já constrói
desde uma reforma anterior (Setor→Sub-etapa) mas nunca foi replicado
pro gêmeo de Detalhamento→Produtividade. Sem esse mapa,
`calcularProgressoSubarvore` cai no fallback do campo manual
`no.verba` pra qualquer folha fora de Pavimento — campo que nunca foi
preenchido pras Sub-etapas/Tarefas de "Análise Global" (etapa sem
Pavimento), então o peso delas na média zerava mesmo com status
"Finalizada". Corrigido replicando o mesmo bloco (`calcularVerbaCascataCompleta`
+ `calcularVerbaPorEtapaSalvo` + `coletarNosFolhaDaArvore`) em
`calcularConclusaoProjeto()`, passando o mapa como 5º argumento — igual
`painel-progresso.js` já fazia. Testado contra "HOME GARDEN - SETOR C"
(projeto real do bug relatado): **100%** agora, batendo com o status
real de todas as tarefas.

**4. Varredura final "Pavimento"→"Local"** (item 16 da lista — a parte
68 só cobriu um recorte inicial). Achados em `js/desempenho-projeto.js`
(dashboard de Desempenho/Financeira do projeto — telas que a varredura
anterior não tinha alcançado): rótulo "é o Pavimento com o maior
desvio absoluto" (achado automático de Bonificação) → "é o Local...";
título de bloco `porPavimento.titulo` ("Por Pavimento"→"Por Local");
`porTarefa.tag` ("...somada em todos os pavimentos"→"...em todos os
locais"); títulos da tabela Financeira ("Distribuição p/
Pavimentos"/"Verba líquida p/ Pavimentos"→"...p/ Locais"); título e
subtítulo do gráfico de desvio de horas ("Desvio de horas por
Pavimento"/"por pavimento"→"por Local"/"por local"); opção do filtro
"Agrupar por" ("Pavimento"→"Local"). Deliberadamente NÃO tocado (mesmo
critério da parte 68): nomes de nível internos (`nivel==='pavimento'`,
`pavimentoNome`, `etapasComPavimento` etc.) e comentários — só prosa,
sem efeito visível.

Testado ao vivo contra "HOME GARDEN - SETOR C" (sync desligado,
`localStorage.clear()` + recarregar pra simular pull limpo). Confirmado
via DOM: `#vt-arvore-wrapper .vt-grid` com `display:grid` e 3 colunas
em ambas as Etapas; `calcularConclusaoProjeto('HOME GARDEN - SETOR C')`
retorna exatamente `100`; painel Detalhamento→Produtividade mostra "%
CONCLUÍDA 100% ... concluído"; "Desvio de horas por Local" e "Agrupar
por: ... Local" na tela; aba Financeira com "Distribuição p/ Locais" e
"Verba líquida p/ Locais" confirmados via `<th>`/texto renderizado.
`node --check` limpo em `distribuicao-custos.js` e
`desempenho-projeto.js`. Zero erro novo no console.

**Não tocado**: `modulos_isolados/` (mesmo precedente de sempre).
