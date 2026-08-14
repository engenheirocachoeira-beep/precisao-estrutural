# Contexto do Projeto — Precisão Estrutural (leia antes de qualquer alteração)

Este é um protótipo de controle de fluxo de trabalho para projetos de
estruturas, feito em HTML/CSS/JS puro, sem framework, com persistência em
`localStorage` do navegador. Antes de sugerir ou escrever qualquer código,
leia esta seção inteira.

## 1. Estrutura de arquivos (fonte única de verdade)

```
precisao_estrutural/
├── index.html              → estrutura da página (HTML) e <script src> na ordem certa
├── estilos.css              → todo o CSS
├── js/
│   ├── core.js               → seeds iniciais, estado global, navegação (alternarModulo), migrações
│   ├── cadastros.js           → CRUD de Clientes, Funcionários, Projetos
│   ├── importexport.js        → importar/exportar planilha (.xls) de Clientes/Funcionários/Projetos
│   ├── catalogo-lego.js       → catálogo de Etapas/Setores/Pavimentos/Tarefas
│   ├── arvore.js              → montagem estrutural do projeto (árvore: Etapa→Setor→Pavimento→Tarefa)
│   ├── bi.js                  → calibração de catálogo (BI) e fechamento/controladoria
│   ├── distribuicao-custos.js → as 5 abas da tela de Distribuição de Custos
│   ├── atribuicao-tarefas.js  → fila de tarefas sem executor/não finalizadas, de todos os projetos (depende de distribuicao-custos.js — precisa carregar depois)
│   ├── kanban.js              → Kanban do Executor (tarefa + pontos, arrastar entre status, "Meu Calendário")
│   ├── aprovacoes-calendario.js → tela separada de aprovação de exceções de calendário criadas no Kanban (depende de nada específico, mas carrega depois de kanban.js por clareza)
│   ├── feriados.js            → Cadastro de Feriados + motor de cálculo de Data Prevista (depende de nada, mas atribuicao-tarefas.js e kanban.js dependem DELE — carrega antes dos dois)
│   └── apontamento.js         → sessões de trabalho (play/pause), correção manual e alerta de anomalia (depende de feriados.js — carrega depois dele, antes de atribuicao-tarefas.js e kanban.js)
└── js_estacionado/
    └── timesheet_executor.js → engine de cronômetro/timesheet, NÃO conectada (ver seção 3)
```

**Regra fixa: cada arquivo JS tem um domínio único.** Antes de adicionar uma
função nova, identifique a qual domínio ela pertence e coloque-a no arquivo
correspondente. Não crie um novo arquivo solto sem antes verificar se o
código já cabe em um dos existentes.

**Ordem de carregamento dos scripts no `index.html` importa** — `core.js`
define `alternarModulo()` e o estado global que os outros arquivos usam, por
isso ele carrega primeiro. Se adicionar um `<script src>` novo, ele deve vir
depois de `core.js`.

**Layout quase tela cheia, com margem de 2,5cm ao redor**
(`body { padding: 2.5cm; }`, `.browser-window { width:100%; height:calc(100vh - 5cm); }`
— usa unidade `cm` do CSS direto, sem converter pra px). Tem `border-radius`
e sombra leve de volta (fazem sentido agora que existe margem — sem
margem nenhuma, cantos retos ficavam melhor; com margem, um cartão
flutuante sutil fica mais natural). Menu lateral (`.sidebar`) em 270px
(era 240px). Se adicionar uma tela nova, não reintroduza `max-width` fixo
no container principal sem pedir confirmação.

**Ordem do menu lateral** (pedido da diretoria, não é a ordem "óbvia" —
não reordene sem confirmar): Dashboard, Cadastros (submenu recolhível),
Estrutura de projeto — depois, separados por uma linha, Distribuição de
Custos, Atribuição de Tarefas, Kanban do Executor, Feriados, **Fundo
Global Fechamento** (penúltimo) e **Painel de Calibração BI** (último) —
Configurações fecha a lista.

**Submenu Cadastros recolhe sozinho depois de escolher uma opção**
(`escolherOpcaoCadastro(modulo)`, em `core.js`) — pedido da diretoria,
pra não ficar poluindo a tela com a lista aberta. Os 7 itens dentro do
submenu (Clientes, Funcionários, Projetos, Etapas, Setores, Pavimentos,
Tarefas) chamam essa função em vez de `alternarModulo()` direto; ela
chama `alternarModulo()` normalmente e depois recolhe
`#arvore-cadastro` e reseta a seta (`#seta-cadastro`) pra `▸`. O botão
"📝 Cadastros" continua abrindo/fechando manualmente via
`toggleArvoreCadastro()` (agora também atualiza a seta: `▾` aberto, `▸`
fechado — antes ficava sempre fixa em `▸`, corrigido de passagem).

## 2. O que NÃO fazer (motivo: já causou bugs reais nesta base)

- **Não crie HTML injetado via `innerHTML` num container que precisa ser
  procurado por `getElementById`** (padrão `document.getElementById('x').innerHTML = ...`
  para montar telas inteiras). Isso já causou dois arquivos órfãos que
  quebravam silenciosamente porque o elemento-alvo não existia mais no
  `index.html`. HTML de tela vai direto no `index.html`.
- **Não redefina uma função já existente sobrescrevendo `window.nomeDaFuncao`**
  (padrão de monkey-patch tipo `const original = window.x; window.x = function(){...}`).
  Isso cria dependência de ordem de carregamento e gera comportamento
  ambíguo. Se precisa mudar o comportamento de uma função existente, edite
  a função no arquivo onde ela já está.
- **Não deixe a pasta `arquivo_antigo/` fazer parte do contexto de edição.**
  Ela contém versões anteriores e arquivos órfãos mantidos só como
  histórico. Nada ali é carregado pelo `index.html` e nada ali deve ser
  copiado de volta.
- **Não escreva uma função sem antes checar (com grep/busca) se ela já
  existe em outro arquivo.** Duplicação de nome de função entre arquivos foi
  a causa raiz da maior parte dos bugs anteriores.
- **Ao editar este arquivo de documentação, sempre reveja o parágrafo
  inteiro antes e depois da edição.** Substituições parciais de linha já
  quebraram parágrafos no meio várias vezes nesta base.
- **Cuidado com `overflow:hidden` num elemento que é filho direto de um
  container `display:flex` (principalmente `flex-direction:column`,
  como `.content-panel`/`#panel-relatorios`).** O `min-height:auto`
  automático do flexbox, que normalmente impede um item de encolher
  abaixo do próprio conteúdo, só funciona quando `overflow` é `visible`
  — com `overflow:hidden`, essa proteção desaparece, e o navegador pode
  espremer o elemento bem menor que o conteúdo dele quando o espaço
  vertical fica apertado (o conteúdo continua lá no DOM, só fica
  cortado/invisível). Causou um bug real em §8 (Relatórios,
  `.painel-filtro`) que só aparecia indo pelo fluxo completo do app
  (login → navegar pelo menu), não em telas de teste isoladas — corrigido
  com `flex-shrink:0` no elemento. Se um painel/seção sumir "sem erro
  nenhum" numa tela nova, checar isso antes de qualquer outra coisa.

## 3. Nomenclatura e hierarquia da Árvore de Projeto

Hierarquia atual: **Projeto → Etapas → Setores → Pavimentos → Tarefas**.
Nomes antigos (não usar mais): Fase = Etapa; Etapa = Setor; Sub-etapa =
Pavimento. Uma migração automática em `core.js` (`migrarNomenclaturaAntiga`)
converte dados salvos com os nomes antigos na primeira vez que o sistema
carrega.

**Campos físicos do Pavimento:** `tipo_pavimento` (mestre/repetido),
`area_fisica`, `peso_esforco` vivem no nível **Pavimento**, não no Setor.
Setor é só um agrupador (nome + lista de pavimentos). Se voltar a ver esses
campos anexados ao Setor, é regressão.

**Setores e Etapas são reordenáveis por arrastar-e-soltar.** Etapas
reordenam livremente entre si (são todas irmãs na raiz do projeto). Setores
só reordenam dentro da mesma Etapa. Convenção: soltar um item sobre outro
insere o arrastado imediatamente antes do alvo.

**Timesheet/cronômetro removido da tela de Árvore.** Essa engine (Play/
Pause, ping de auditoria, horas acumuladas) foi tirada da tela de tarefa
porque é ferramenta do executor, não do analista que monta a árvore. O
código não foi apagado — está em `js_estacionado/timesheet_executor.js`,
que **não é carregado** por nenhum `<script src>` hoje. Não reative isso na
tela de Árvore; ele volta quando a "tela do executor" for construída.
`fecharSessaoCronometroSilencioso()` é chamada com guarda defensiva
(`typeof` check) em `core.js` e `arvore.js`, então nada quebra na ausência
desse arquivo.

**"Copiar tarefas do pavimento anterior":** ao clicar "+ Tar" num pavimento
vazio, se o pavimento anterior do mesmo setor já tem tarefas, oferece
copiar (molde: nome/executor/custo/índice/quantidade/pontos; zera:
status/horas/outlier).

**Calendário Semanal (Cadastro de Funcionários):** seção nova no formulário
(`cadastros.js`), 5 campos — Segunda a Sexta, em horas disponíveis por
dia (`funcionario.calendario = { seg, ter, qua, qui, sex }`). Sábado e
domingo não têm campo — não são dia útil pra ninguém, sempre, sem
exceção. Um dia da semana com `0` significa que a pessoa não trabalha
naquele dia (ex: estudante que prioriza faculdade certos dias). Usado
pelo motor de Data Prevista (ver seção 9).

**Histórico de Valor da Hora (Cadastro de Funcionários) — pedido da
diretoria:** substituiu o campo único antigo `funcionario.hora` (um
valor só, pra sempre). Salário muda com o tempo (reajuste, promoção), e
o custo de uma tarefa precisa refletir o valor vigente na ÉPOCA em que
o trabalho foi feito, não o valor de hoje. Agora é
`funcionario.historico_valor_hora`, array de `{valor, data_vigencia}` —
cada linha vale a partir da sua data até a próxima linha do histórico
(só precisa de data de INÍCIO por linha).

Na tela: uma mini-tabela (`#func-tabela-historico-hora-body`, mais
recente primeiro) + formulário de nova linha (Valor, Data de Vigência,
botão "+ Adicionar"). Fica em memória num array temporário
(`funcTempHistoricoValorHora`, em `cadastros.js`) enquanto o formulário
está aberto — só vira `funcionario.historico_valor_hora` de verdade
quando `salvarFuncionario()` roda, mesmo padrão do resto do formulário.
`adicionarValorHoraFuncionario()` valida (valor > 0, data preenchida, e
BLOQUEIA duas entradas com a MESMA data de vigência — ambíguo, qual
valeria?). `removerValorHoraFuncionario(indice)` usa o índice REAL no
array, não a posição exibida (a tabela mostra mais recente primeiro, mas
o array em si não está ordenado).

**`valorHoraVigente(nomeExecutor, dataISO)`** (feriados.js) é o lookup:
acha a entrada do histórico com a MAIOR `data_vigencia` que ainda seja
`<= dataISO`. Pra data ANTERIOR a qualquer vigência conhecida, retorna
`0` — NÃO "adivinha" o valor mais antigo (um 0 aparece visivelmente
errado na tela, o que é preferível a uma conta silenciosamente baseada
numa suposição; isso já foi testado e corrigido uma vez — a primeira
versão retornava o valor mais antigo por engano).

**Onde isso já é usado:** o Pontos Máximo em `atribuicao-tarefas.js`
(antes lia `funcionario.hora` direto) agora usa
`valorHoraVigente(executor, dataReferencia)`, onde `dataReferencia` é:
HOJE se a tarefa ainda não tem nenhuma sessão de trabalho
(`obterDataInicioExecucaoReal()`, em `apontamento.js`, retorna `null`);
ou a data da PRIMEIRA sessão real (não `sessoes_trabalho[0]` — a menor
data entre TODAS as sessões, incluindo a ativa, porque uma sessão manual
retroativa pode ter sido adicionada depois das outras) se a tarefa já
começou — nesse caso o Pontos Máximo CONGELA naquele valor, não
"flutua" a cada reajuste salarial futuro.

**`calcularCustoRealTarefa(tarefa, nomeExecutor)`** (apontamento.js):
soma, sessão por sessão, `duração × valor vigente NO DIA daquela
sessão específica` — não um valor único pra tarefa inteira. Ainda não
tem tela própria mostrando isso (fica pronta pra alimentar o índice de
produtividade/distribuição de lucro combinado com o usuário, fora de
escopo por enquanto), mas está testada e pronta pra uso.

**Migração de dados antigos** (`core.js::migrarValorHoraParaHistorico()`,
roda no boot junto da migração de status): funcionário com o campo
antigo `hora` preenchido mas sem `historico_valor_hora` ainda ganha uma
entrada única, com `data_vigencia` = `dt_inicio` do funcionário
(convertido de "DD/MM/AAAA", formato do campo com máscara, pro ISO —
`converterDataSlashesParaISO()`) ou uma sentinela bem antiga
(`2000-01-01`) se não tiver `dt_inicio`. Idempotente — funcionário que
já tem histórico não é tocado.

**Importar/Exportar planilha (`importexport.js`)**: a coluna
"Valor Hora (atual)" (renomeada — antes só "Valor Hora") na exportação
mostra o valor MAIS RECENTE do histórico (planilha é um snapshot plano,
sem noção de histórico completo) — não mexe no dado real, só na cópia
usada pra montar a planilha. A importação continua escrevendo no campo
antigo `hora` (é assim que a coluna sempre funcionou) — e agora chama
`migrarValorHoraParaHistorico()` logo depois de importar, pra não
precisar de reload da página pra o funcionário importado já ter um
valor de hora utilizável na mesma sessão.

## 3.1. Login e Sessão

**⚠️ MODO TESTE SEM LOGIN ATIVO (julho/2026) — `MODO_TESTE_SEM_LOGIN =
true` no topo de `core.js`.** Pedido explícito do usuário: chato digitar
login/senha a cada teste e ter que lembrar nome de analista/executor
pra testar restrição de acesso. Enquanto o flag estiver `true`:
- A tela de login (`#tela-login`) nunca aparece — o sistema entra
  direto com a última identidade escolhida
  (`localStorage['banco_identidade_teste_atual']`), ou o primeiro
  Administrador cadastrado se ainda não houver escolha salva (sem
  nenhum funcionário cadastrado ainda, cai de volta pra tela de login
  normal — instalação nova continua funcionando, inclusive restaurar
  backup).
- O nome no canto superior direito (`#cabecalho-usuario-logado`) virou
  um `<select>` com TODOS os funcionários cadastrados
  (`renderizarCabecalhoIdentidadeTeste()`) — trocar a seleção
  (`trocarIdentidadeTeste(nome)`) troca `usuarioLogado` de verdade
  (aplicando as restrições normais por nível/projeto) e recarrega a
  página, **sem pedir senha nenhuma**. "Sair" virou "↺ Resetar" — limpa
  a identidade escolhida, volta pro Administrador padrão.
- **Isso contradiz de propósito** a decisão original documentada logo
  abaixo ("o sistema SEMPRE pede login de novo a cada abertura da
  página") — por isso um flag único, fácil de reverter (`false`) quando
  o teste acabar, sem precisar desfazer nada manualmente no resto do
  código (`tentarLogin()`/`autenticarFuncionario()` continuam intactas,
  só ficam sem uso enquanto o flag está ligado).
- **NUNCA implantar em produção/multiusuário com esse flag em `true`**
  — qualquer pessoa com acesso ao navegador vira qualquer funcionário
  instantaneamente. Lembrar de reverter antes de qualquer avanço na
  conversa de migração pra Supabase (ver §12.1 — não, essa não é a
  seção certa, ver a conversa de arquitetura multiusuário registrada
  antes da Rodada de Comentários da Gerência).
- Testado: 5 casos isolados (lógica de escolha de identidade — usa a
  salva, cai pro Administrador se não houver, cai pro primeiro da lista
  se não houver Administrador, `null` se não houver funcionário
  nenhum) + confirmado com Playwright (login nunca aparece, `<select>`
  troca identidade de verdade, sem erro no console). Sincronizado em
  `core.js` de **todos** os módulos isolados.

**Rodada 1 de 4 do controle de acesso (roadmap, seção 12, item 5) —
só a mecânica de entrar/sair, AINDA SEM restringir tela nenhuma por
nível.** Rodadas 2-4 (esconder telas por nível, restringir por projeto,
ajustes no Kanban) ainda não implementadas.

**Descoberta importante ao começar essa rodada:** os campos
`funcionario.nivel` (administrador/supervisor/analista/executor) e
`funcionario.senha` **já existiam** no formulário de Cadastro de
Funcionários antes dessa rodada (não fazem parte do trabalho feito
aqui) — só nunca tinham sido usados pra nada. `nivel` já é totalmente
separado de `cargo` (Detalhista/Estagiário/etc — o estágio de
desenvolvimento da pessoa, não muda nenhuma tela).

**`#tela-login`** (`index.html`, logo depois do `<body>`, classe
`.modal-overlay`/`.modal-caixa`, `z-index:5000` — cobre a tela inteira,
inclusive por cima da sidebar/conteúdo) aparece sempre que a página
carrega, ANTES de qualquer outra coisa rodar. Campo único de texto
(aceita CPF **ou** nome, com ou sem formatação, case-insensitive) +
senha. Enter em qualquer um dos dois campos já tenta logar
(`onkeydown`).

**`autenticarFuncionario(funcionarios, identificador, senha)`**
(`core.js`) é a função pura por trás — testável isolada, sem DOM.
Confere:
- `identificador` bate com `funcionario.cpf` (normalizando os dois lados
  — `normalizarCPF()` tira tudo que não é dígito, então "111.444.777-35"
  e "11144477735" batem igual) **OU** com `funcionario.nome`
  (case-insensitive, `trim()`).
- Funcionário **desligado** (`dt_desligamento` preenchida) nunca
  consegue entrar, mesmo com credenciais certas.
- `senha` bate exatamente com `funcionario.senha`.

**`tentarLogin()`** chama a função pura acima, e se der certo: esconde
`#tela-login`, limpa o campo de senha da tela (não deixa sobrando à
toa), preenche `#cabecalho-usuario-logado` (nome + nível + botão Sair,
no `<header>` do app) e chama `iniciarAppPosLogin()` — que é tudo que
antes rodava direto no `window.onload` (as duas migrações, `limparWorkspace()`,
etc.). **O app só começa a existir de verdade depois do login.**

**Sem "lembrar login"** (decisão explícita do usuário): `usuarioLogado`
é só uma variável `let` em memória, NUNCA gravada em
`localStorage`/`sessionStorage` — cada abertura da página pede login de
novo. `sair()` só faz `location.reload()`: como não existe nada
persistido pra limpar, recarregar a página já basta (a tela de login
volta a aparecer, é o estado inicial padrão).

**Sem servidor por trás, então sem segurança de verdade** — a senha
fica em texto puro no `localStorage` (dentro de `banco_funcionarios`) e
a comparação também é feita no navegador, então qualquer um com acesso
ao DevTools consegue ler ou contornar. Isso é uma trava de
conveniência/organização, não proteção real — decisão consciente do
usuário, consistente com o resto do sistema (nada tinha proteção
nenhuma antes disso).

**Módulos isolados (`modulos_isolados/*`) NÃO têm tela de login** — só o
`index.html` principal tem. `window.onload` é defensivo: se
`#login-identificador` não existe na página (é o caso de todo módulo
isolado), pula direto pra `iniciarAppPosLogin()` sem exigir
autenticação nenhuma — replicar a tela de login em cada módulo isolado
não faria sentido pra páginas feitas só pra testar uma peça isolada.
**Se algum dia um módulo isolado precisar simular login pra testar
alguma restrição de nível, replicar a tela de login lá é a forma
certa — não remover essa checagem defensiva do `core.js`.**

**Rodada 2 (esconder telas por nível) — feita.** Chamada uma vez, logo
depois de `iniciarAppPosLogin()` em `tentarLogin()` — o menu não muda
mais durante a sessão, não precisa recalcular a cada navegação.

`MENU_POR_NIVEL` é o mapa fechado nível → array de ids de itens de menu
liberados. `determinarMenuVisivel(nivel)` é a função pura (devolve um
`Set`, testável isolada sem DOM) por trás de `aplicarPermissoesMenu()`,
que só esconde/mostra (`style.display`) os itens de
`TODOS_ITENS_MENU_CONTROLADOS`. **Nível desconhecido/vazio cai no
fallback `|| []` — falha FECHADA (esconde tudo), não aberta.**
Dashboard e Configurações ficam DE FORA do controle de acesso, de
propósito — são acessíveis pra qualquer nível, sempre.

**Fundo Global Fechamento e Painel de Calibração BI não tinham `id` no
HTML antes dessa rodada** (só tinham `onclick`) — precisaram ganhar
(`nav-fundo-global`, `nav-bi-calibracao`) pra poder ser
escondidos/mostrados por JS.

**Rodada 3 (restringir por projeto) — feita.**
`obterNomesProjetosPermitidos()` (`core.js`) é a função central: retorna
`null` quando não há restrição (Administrador, Supervisor, ou sem
login — módulo isolado), ou um `Set` de nomes de projeto (pode ser
VAZIO, se o Analista ainda não tiver nenhum projeto atribuído) quando
`usuarioLogado.nivel === 'analista'`. Compara `projeto.analista` (campo
já existente no Cadastro de Projetos) com `usuarioLogado.nome`,
`trim()` dos dois lados.

Três telas consultam essa função, cada uma no ponto onde já lista
projetos (não precisou de refatoração grande, só um filtro a mais):
- `renderizerProjetosParaSelecaoArvore()` (arvore.js) — filtra o array
  antes de montar a tabela de seleção de projeto.
- `carregarPainelDistribuicaoCustos()` (distribuicao-custos.js) —
  filtra antes de montar o `<option>` do dropdown `#dc-projeto`.
- `coletarTodasTarefasDeTodosProjetos()` (atribuicao-tarefas.js) —
  filtra `Object.keys(arvores)` antes de iterar, então nem chega a
  processar tarefas de projeto não-permitido.

Todas as três usam `typeof obterNomesProjetosPermitidos === 'function'`
como guarda defensiva (mesmo padrão de outras dependências opcionais
entre módulos do projeto) — então continuam funcionando normalmente em
qualquer teste/contexto que carregue esses arquivos sem `core.js`
(ex: os testes isolados das rodadas anteriores, que não tinham
motivo pra saber de login).

**AINDA NÃO tem nenhuma trava por baixo do pano** — é só filtrar o que
aparece nas listas; `abrirProjetoNaArvore(nomeProjeto)` (e o resto do
motor por trás) continuam aceitando qualquer nome de projeto se
alguém chamar direto pelo console do navegador, por exemplo. Coerente
com a postura já registrada (seção 3.1): sem servidor, não existe
segurança real possível aqui de qualquer forma — filtrar as listas é
suficiente pro uso normal pretendido.

**Rodada 4 (ajustes no Kanban) — feita. Controle de acesso completo
(as 4 rodadas) fechado.**

Em `carregarPainelKanban()` (kanban.js): quando
`usuarioLogado.nivel === 'executor'`, o `<select id="kb-executor">`
recebe uma ÚNICA `<option>` (o próprio nome), fica com
`sel.value` já travado nela, e o próprio `<select>` fica
`display:none` — visualmente não existe escolha nenhuma. No lugar dele
aparece `<span id="kb-executor-nome-fixo">` (`👤 [nome]`), só texto,
sem interação. Pra qualquer outro nível (ou sem login — módulo
isolado), o `<select>` volta a mostrar todos os funcionários, igual
sempre foi. **O `<select>` continua existindo no DOM em ambos os
casos** (só escondido pro Executor) — decisão deliberada, pra não
precisar reescrever os outros pontos do arquivo que já liam
`document.getElementById('kb-executor').value` diretamente; eles
continuam funcionando sem nenhuma mudança, porque o valor travado já
está lá.

`carregarKanbanExecutor()` ganhou a lógica do rótulo do botão: se o
executor sendo visto é o PRÓPRIO usuário logado (ou não tem usuário
logado — módulo isolado), o botão diz "⚙️ Meu Calendário"; se
Administrador/Analista/Supervisor está vendo o Kanban de outra pessoa
(pelo dropdown), vira "⚙️ Calendário de [nome]" — deixa claro de quem
é o calendário que está sendo editado, já que agora não é
necessariamente o do próprio usuário.

**Bug encontrado e corrigido durante essa rodada:** a primeira versão
do cálculo de "é o próprio usuário?" tinha a condição invertida — sem
`usuarioLogado` (contexto sem login), o código assumia por padrão que
QUALQUER executor selecionado era "o próprio", mostrando sempre "Meu
Calendário" mesmo pra um nome qualquer. O teste isolado (escrito e
validado ANTES de aplicar no arquivo real) já cobria esse caso
especificamente e pegou o erro assim que a versão real foi testada
contra ele.

## 3.2. Backup e Restauração Completa

**Motivação real, não hipotética:** o usuário esqueceu a senha de
administrador (senha guardada em texto puro no `localStorage`, sem
"esqueci minha senha" — não faz sentido nesse sistema sem servidor/
e-mail) e recuperou rodando um script no Console do navegador
(`localStorage.getItem('banco_funcionarios')` etc.). Isso funcionou
porque o dado ainda estava lá — mas deixou claro que, se o
`localStorage` fosse perdido de verdade (limpeza de cache, troca de
navegador/máquina), não existiria NENHUMA forma de recuperar, porque eu
(Claude) nunca tenho acesso aos dados reais do usuário — só ao código.
Esse recurso existe pra cobrir esse risco.

**Tela "🔒 Configurações"** (menu lateral) deixou de só chamar
`limparWorkspace()` direto e virou um módulo de verdade
(`alternarModulo('configuracoes')`, `panel-configuracoes`) com duas
seções: Backup e Restaurar.

**`montarPayloadBackup(chavesLocalStorage, getItem)`** (função pura,
testável isolada): varre TODA chave que começa com `banco_` — não
existe lista fixa de chaves aqui de propósito, então qualquer chave
nova que um módulo futuro criar (seguindo a mesma convenção de prefixo,
que hoje é universal no projeto) já entra automaticamente no backup,
sem precisar lembrar de atualizar nada. Gera
`{ versao: 1, dataExportacao, dados: {...} }`. `baixarBackupCompleto()`
baixa isso como `backup_precisao_estrutural_AAAA-MM-DD.json`.

**`aplicarRestauracao(payload, chavesAtuais, setItem, removeItem)`**
(também função pura): a restauração é um "ponto no tempo", não uma
mesclagem — **apaga TODA chave `banco_*` que já existe** antes de
gravar o que veio do arquivo, então uma chave criada DEPOIS do backup
não sobra bagunçando o estado restaurado. `restaurarBackupCompleto()`
lê o arquivo escolhido (mesmo padrão de `FileReader` já usado em
`importexport.js`), valida a estrutura
(`validarPayloadBackup()` — confere que é JSON válido e tem a chave
`dados` não-vazia), confirma com `confirm()` (é destrutivo e
irreversível) e recarrega a página no final.

**Restrito a Administrador** — `restaurarBackupCompleto()` verifica
`usuarioLogado.nivel` e recusa qualquer outro nível. Backup (baixar)
continua aberto pra qualquer nível — é só leitura, não destrutivo.
Diferente do resto do controle de acesso (que só filtra o que aparece
na tela), essa é uma trava de verdade dentro da própria função — porque
é uma ação destrutiva de sistema inteiro, vale o cuidado extra mesmo
sem segurança real por trás.

**Bug real encontrado pelo usuário: restaurar exigia estar logado como
Administrador, mas instalar numa máquina NOVA (mandar o `.zip` pra um
colaborador, por exemplo) deixa o `localStorage` sem nenhum funcionário
de verdade — só os dados de DEMONSTRAÇÃO que `core.js` semeia
automaticamente na primeira vez (`funcionariosSeed`, não é um bug, é
comportamento antigo do projeto). Sem credencial real cadastrada, não
tem como logar — e sem logar, não tem como chegar na tela de
Configurações pra restaurar. Um "ovo e galinha" que eu não tinha
pensado ao desenhar o recurso.**

Corrigido extraindo a lógica de ler/validar/confirmar o arquivo pra
`processarArquivoDeBackup(arquivo, aoConfirmar)` (compartilhada pelos
dois caminhos) e criando um SEGUNDO ponto de entrada,
`restaurarBackupDoLogin(inputEl)` — um link "📁 Restaurar de um arquivo
de backup" na própria `#tela-login`, ANTES do login. Esse caminho não
tem checagem de nível (não tem ninguém logado ainda, por definição —
não faz sentido checar `usuarioLogado.nivel` contra `null`). Depois de
restaurar, a página recarrega e a pessoa loga normalmente com as
credenciais que vieram no backup.

## 4. Catálogo de Tarefas (Etapas/Setores/Pavimentos não têm esses campos)

- **Pontos** (chamado "Peso" antes de uma renomeação): sugestão inicial de
  horas razoáveis pra concluir a tarefa. Serve de ponto de partida quando o
  analista define os Pontos reais de uma instância na árvore, e é a base do
  ranking de produtividade dos executores (ganham os Pontos da tarefa ao
  concluir, independente das horas reais gastas).
- **Unidade Física**: unidade de medição (m², kg, m³, un — texto livre),
  fixada uma vez no catálogo. Ao plugar a tarefa na árvore, aparece readonly
  ao lado de "Quantidade Física" — tanto no formulário de criação quanto na
  tela de detalhes, sempre via `buscarUnidadeFisicaDoCatalogo(nomeTarefa)`,
  que consulta o catálogo **atual**, não um valor congelado. Isso é
  proposital: se o catálogo for corrigido depois, a correção aparece em
  todas as tarefas já plugadas com esse nome, sem precisar editar uma por
  uma. A instância da tarefa ainda grava `tarefa.unidade_fisica` no momento
  da criação (registro histórico), mas a exibição não lê esse campo.
- **Edição inline (Nome/Pontos/Unidade Física)** direto na tabela, com
  botão 💾 por linha. **Editar o Nome propaga automaticamente**
  (`propagarRenomeTarefaNaArvore()`) pra todas as tarefas já plugadas em
  qualquer árvore de projeto com o nome antigo — necessário porque a árvore
  guarda uma cópia do nome (não uma referência viva), e a calibração de BI
  casa tarefas por nome exato (`t.nome === lego.nome`).
- **Lista de Tarefas ordenada alfabeticamente** na exibição
  (`localeCompare` com locale `pt-BR`). O índice real de armazenamento
  usado por editar/excluir continua sendo o índice no array original, não a
  posição na lista ordenada.
- **Migração v4** (`banco_tarefas_lego_migrado_v4_peso_para_pontos`):
  converte tarefas salvas com o campo antigo `peso` pro campo novo `pontos`
  (mesmo valor), e adiciona `unidade_fisica: ''` em quem não tinha.

## 5. Distribuição de Custos (5 abas)

**Portal de seleção obrigatória de projeto (julho/2026)** — pedido
explícito do usuário: ao clicar em "Distribuição de Custos" no menu,
"escolha o projeto" deve ser a primeira e ÚNICA coisa visível, antes de
qualquer aba aparecer (antes disso, as 5 abas já apareciam de cara,
mesmo sem projeto escolhido — só o CONTEÚDO de cada uma bloqueava com
"selecione um projeto"). `carregarPainelDistribuicaoCustos()` agora
termina chamando `voltarParaPortalSelecaoProjeto()`, que esconde
`#dc-conteudo-principal` (o `.tab-bar` + as 5 `.tab-content` inteiras,
agora dentro desse wrapper novo) e mostra só
`#dc-portal-selecao-projeto` (um cartão centralizado com um `<select>`
de projeto sozinho). Escolher um projeto ali
(`escolherProjetoDistribuicaoInicial()`) pré-preenche o `#dc-projeto`
de dentro do "Orçamento Global" com o mesmo valor, esconde o portal e
mostra o conteúdo normal — sem precisar escolher o projeto de novo.
Botão novo "🔁 Trocar Projeto" na `.tab-bar` volta pro portal a
qualquer momento; trocar de projeto pelo `#dc-projeto` de dentro das
abas (sem passar pelo botão) continua funcionando direto, sem forçar
passar pelo portal de novo — o portal é só o "gate" de ENTRADA na tela,
não uma trava permanente a cada troca. Testado: 8 casos isolados
(mostrar/esconder portal e conteúdo) + confirmado com Playwright de
ponta a ponta (portal aparece na entrada, some ao escolher, conteúdo já
vem com o valor certo carregado, botão de trocar projeto funciona).
Sincronizado em `modulos_isolados/distribuicao-custos/` (JS + HTML,
incluindo o cabeçalho da tabela de Verba por Tarefa que também estava
desatualizado com o ajuste de layout anterior).

**Bug encontrado logo depois de testar, corrigido:** o portal acima
ficava, sem querer, TOTALMENTE INACESSÍVEL pro Analista (e Supervisor)
— não dava nem pra escolher um projeto, mesmo num projeto onde o
Analista É o responsável. Causa: `aplicarSomenteLeituraDistribuicaoCustos()`
desabilita todo `input`/`select` de `#panel-distribuicao-custos`,
exceto por id explícito (`#dc-projeto`) — o `#dc-portal-projeto-select`
novo tinha um id DIFERENTE, então caía na regra geral de "desabilita
tudo" pra quem é somente-leitura (Analista/Supervisor), travando o
próprio ato de escolher o projeto. Corrigido eximindo também
`#dc-portal-projeto-select` da mesma forma que `#dc-projeto` já era.
Reconfirmado com Playwright (select do portal não fica mais
`disabled` pro Analista) e com teste de integração (PONTO 1 do arquivo
`teste_4_correcoes_acesso_analista.js`).

Todas as abas 2-5 mostram "Projeto: X" no topo (preenchido a partir do
projeto selecionado na aba 1) e **são bloqueadas se nenhum projeto estiver
selecionado** (tentar abrir sem projeto mostra alerta e não troca de aba —
bloqueio central em `alternarAbaDistribuicao()`).

1. **Orçamento Global**: seleciona o Projeto, puxa Valor do Contrato
   cadastrado. Percentual de Impostos (editável, sugere o último usado) →
   Valor Líquido. % Analista/Supervisor/Escritório (editáveis) → Valor de
   cada um.
2. **Distribuição de Custos Analista**: tabela com uma linha por Etapa da
   árvore + linha fixa "Fundo Garantidor" (antes chamada "Sobras") no
   final, vinculada ao projeto e salva separada das etapas reais (chave
   `fundo_garantidor`; dados antigos salvos como `sobras` continuam sendo
   lidos). Responsável não é editável: sempre reproduz o `analista` do
   projeto cadastrado.
3. **Verba para Detalhamento**: tudo calculado ao vivo (função pura
   `calcularVerbaDetalhamento(nomeProjeto)`, reaproveitada pela aba 4).
   `Verba Analista = %Detalhamento(aba 2) × Valor Analista(aba 1)`; `Verba
   Escritório = Verba Analista × (%Escritório ÷ %Analista)`; `Verba
   Supervisor = Verba Analista × (%Supervisor ÷ %Analista)`; `Verba
   Detalhamento (total) = soma das três`. Etapa "Detalhamento" buscada por
   substring case-insensitive; se não achar, ou se não tem % salvo na aba
   2, mostra aviso e usa R$ 0,00. **Distribuição de Lucros** (único campo
   editável): percentual descontado do total, formando fundo de lucro/
   compensação de prejuízo. `Verba Detalhamento Líquida = total − (% ×
   total)`, salvo em `banco_distribuicao_lucros`.
4. **Verba por Pavimento**: lista pavimentos de toda a árvore com Área e
   Peso de Esforço (já preenchidos na Estrutura de Projeto). `Área
   Equivalente = Área × Peso`. A Verba Detalhamento Líquida é distribuída
   proporcionalmente à Área Equivalente de cada pavimento. Linha de Total
   no rodapé + selo ✅/⚠️ (`exibirSeloConferencia()`) comparando a soma com
   a Verba Detalhamento Líquida. Cálculo compartilhado em
   `calcularListaPavimentosComVerba(nomeProjeto)`, reaproveitado pela aba 5.
5. **Verba por Tarefa**: rateia o `Valor da Verba` de cada pavimento (aba
   4) entre suas tarefas, proporcional aos **Pontos** de cada uma. Colunas:
   Pavimento | Tarefa | Pontos | Valor. **Pontos é editável** — mudar o
   valor de uma tarefa recalcula ao vivo TODAS as tarefas do mesmo
   pavimento (`recalcularGrupoVerbaPorTarefa()`, a proporção do grupo
   inteiro muda). Botão "Salvar Pontos" grava de volta no mesmo campo
   `tarefa.pontos` usado pela Árvore de Projeto. Cada pavimento tem uma
   linha de Subtotal + selo de conferência contra seu `valorVerba` (aba 4).
   Borda mais grossa separa visualmente cada bloco de pavimento. Pavimentos
   sem tarefas não aparecem na lista.

**Selos de conferência (✅/⚠️)** não são decoração: se um pavimento tem
tarefas mas nenhuma tem Pontos preenchido, ou se nenhum pavimento tem
Área/Peso definidos, a soma dá 0 e diverge do total esperado — o selo pega
esse caso de "dinheiro sem destino" de verdade.

### Schema de dados da Distribuição de Custos

| Chave | Conteúdo |
|---|---|
| `banco_distribuicao_custos` | objeto, chave = projeto → `{ pct_impostos, pct_analista, pct_supervisor, pct_escritorio }` |
| `banco_distribuicao_custos_analista` | objeto, chave = projeto → `{ etapas: { [nomeEtapa]: {pct} }, fundo_garantidor: {pct} }` |
| `banco_distribuicao_lucros` | objeto, chave = projeto → `{ pct }` |
| `banco_ultimo_percentual_impostos` | string numérica, sugestão pra projetos novos |

## 6. Atribuição de Tarefas

Módulo próprio (`js/atribuicao-tarefas.js`), diferente da Distribuição de
Custos: **não fica preso a um projeto selecionado** — é uma fila única com
tarefas de TODOS os projetos ao mesmo tempo
(`coletarTodasTarefasDeTodosProjetos()`).

**Depende de `js/distribuicao-custos.js`** — precisa vir carregado DEPOIS
dele no `<script src>` (index.html já respeita essa ordem; se criar um
harness isolado novo pra esse módulo, inclua os dois scripts). Usa as
variantes "Salvas" de lá (`calcularVerbaDetalhamentoSalvo`,
`calcularListaPavimentosComVerbaSalva`) — leem tudo do localStorage já
salvo, sem depender da tela de Distribuição de Custos estar aberta num
projeto específico, já que aqui vários projetos são calculados ao mesmo
tempo. Essas variantes (e as originais, usadas pelas próprias abas 3/4/5 de
Distribuição de Custos) compartilham a mesma fórmula pura
(`calcularVerbaDetalhamentoPuro`) — só diferem em onde buscam os
percentuais de entrada (DOM ao vivo vs. localStorage salvo).

**Filtros estilo Excel** (não são mais botões/dropdowns no topo da tela —
essa versão anterior foi inteiramente substituída): as colunas **Projeto**,
**Localização**, **Tarefa**, **Executor** e **Status** têm uma setinha "▾"
no próprio cabeçalho. Clicar abre um painel flutuante
(`#at-filtro-flutuante`, `position:fixed`, posicionado via
`getBoundingClientRect()` da seta clicada, sempre alinhado pela borda
esquerda dela (`painel.style.left = rect.left`, sem clamp pra caber na
tela — uma versão anterior deslocava o painel pra trás quando a seta
ficava perto da borda direita da tela, tipicamente nas colunas Executor/
Status, o que abria o menu "pra trás" em vez de alinhado; corrigido). Fica
FORA do `.table-wrapper`
rolável de propósito, senão o `overflow-y:auto` do wrapper cortaria o
painel) com um checkbox por valor único daquela coluna
(`valoresUnicosColuna()`, calculado a partir de TODAS as tarefas — não é
cross-filter como o Excel de verdade, mais simples de raciocinar). Tem
"Selecionar tudo" / "Limpar" no topo do painel. Cor da seta é laranja
`#f97316` (a mesma do título "Atribuição de Tarefas" no menu) quando o
filtro daquela coluna está ativo (classe `.ativo`). Cada `label` (checkbox
+ texto) usa `display:grid; grid-template-columns: 16px 1fr;` — não
`flex` — pra garantir que todos os checkboxes fiquem **exatamente
alinhados um embaixo do outro**, na mesma coluna de 16px, independente do
tamanho do texto de cada opção; `text-align:left` e `direction:ltr`
explícitos também, pra não sobrar dúvida de alinhamento.

**Localização filtra pela string completa "Etapa › Setor › Pavimento"**
(campo `localizacao`, montado uma vez em `coletarTodasTarefasDeTodosProjetos()`
e reaproveitado tanto no filtro quanto na célula da tabela — não
remonta a string duas vezes). **Tarefa filtra pelo nome exato da tarefa**
— útil pra ver, por exemplo, todas as instâncias de "Detalhamento de
vigas" plugadas em qualquer pavimento/projeto de uma vez.

**Estado do filtro** (`atFiltroSelecionado`, objeto com `status` /
`projeto` / `executor` / `localizacao` / `tarefa`): cada campo é `null`
quando **tudo** está marcado (sem restrição), ou um `Set` com só os
valores marcados. Desmarcar um valor a partir de "tudo" (`null`) converte
automaticamente pra um `Set` com todos os valores exceto o desmarcado.
"Limpar" define um `Set` vazio (nada marcado = nenhuma linha aparece pra
aquela coluna). Padrão ao abrir a tela: `status` = todos os 6 valores
exceto "Finalizada"; as outras quatro colunas = `null` (tudo). O executor
vazio ("Sem Executor") aparece no filtro de Executor como "(Sem
executor)".

**Filtro de período** (barra acima do cabeçalho das colunas, pedido da
diretoria) — dois `<input type="date">` ("De" / "Até") mais um botão
"Limpar", INDEPENDENTE dos filtros estilo Excel de cima (é um intervalo
contínuo, não um `Set` de valores exatos). Estado em `atFiltroPeriodoDe`
/ `atFiltroPeriodoAte` (strings "AAAA-MM-DD" ou `''` = sem restrição
naquela ponta). Filtra pela **Data de Início** de cada tarefa — a mesma
data efetiva que a célula da coluna mostra (`tarefa.data_inicio_manual`
se existir, senão a calculada automaticamente por
`calcularDatasInicioExecutor()`). Tarefa sem data calculável ("Sem
Executor" ou "Finalizada") **some da lista** quando o filtro de período
está ativo (De ou Até preenchido) — não tem como compará-la a um
intervalo. `aplicarFiltroPeriodoAtribuicao()` lê os dois campos e
re-renderiza (volta pra página 1, mesma convenção dos outros filtros);
`limparFiltroPeriodoAtribuicao()` zera os dois. Reseta junto com o resto
dos filtros toda vez que a tela é aberta do zero
(`carregarPainelAtribuicaoTarefas()`).

Detalhe de implementação que importa se for mexer: como o filtro de
período precisa comparar a data calculada de TODA a lista filtrada (não
só da página atual), o cálculo de `mapaDatasInicioPorExecutor` teve que
subir pra ANTES da paginação em `renderizarPainelAtribuicaoTarefas()` —
rodando uma vez por executor único presente na lista inteira já
filtrada pelos outros critérios, não mais só nos executores da página
visível. A renderização da célula (mais abaixo na função) reaproveita
esse mesmo mapa, sem recalcular de novo.

**Não existem mais** os botões pill horizontais nem os dropdowns de
Projeto/Funcionário que ficavam no topo da tela — tudo migrou pros
cabeçalhos de coluna. O dropdown de Executor por linha (dentro da tabela,
diferente do filtro) continua incluindo **funcionários de qualquer
cargo** (não só Detalhista/Estagiário) — decisão explícita, porque
Analistas e Supervisores também podem executar ou validar tarefas
eventualmente.

**Colunas da tabela, nessa ordem:** Projeto | Localização (280px, fixo) |
Tarefa | Pontos | Pontos Máximo | Executor | Status (última coluna).
**Projeto, Tarefa e Executor têm largura calculada dinamicamente**
(`ajustarLarguraColuna()`, função genérica reaproveitada pelas três —
`ajustarLarguraColunaProjeto()`, `ajustarLarguraColunaTarefa()`,
`ajustarLarguraColunaExecutor()`), a partir do maior nome já cadastrado
(`banco_projetos`, `banco_tarefas_lego`, `banco_funcionarios`
respectivamente) — não são mais chutes fixos em px. Usa unidade `ch`
(~1 caractere), com mínimo de 10ch (Projeto/Tarefa) ou 12ch (Executor)
pra não ficar espremido com poucos dados cadastrados.

**Pontos Máximo** = Valor da Verba da tarefa ÷ Custo Hora do executor
atribuído. **Enquanto a tarefa não tiver executor (ou o executor não tiver
Valor/Hora cadastrado), o valor fica 0** — regra explícita, não é só um
fallback de segurança contra divisão por zero. O "Valor da Verba da
tarefa" é o mesmo rateio por Pontos dentro do pavimento já usado na aba
"Verba por Tarefa" da Distribuição de Custos.

**Atribuir salva na hora** (`atribuirExecutorTarefa()`, disparada pelo
`onchange` do dropdown de Executor) — não tem botão de salvar separado.
Grava direto em `banco_arvores_projetos`, o MESMO dado que a Árvore de
Projeto lê e exibe — não existe "replicar" porque não são cópias
separadas, é o mesmo campo visto de duas telas. Dispara uma
re-renderização completa da tabela (mantendo a página atual), então se a
tarefa deixar de bater com o filtro de Status ativo, ela some da lista —
comportamento esperado de fila de triagem, não bug.

**O dropdown de Executor tem opção "Sem executor"** (`value=""`, primeira
opção) em vez de um placeholder tipo "-- Atribuir --". Selecioná-la
retira o executor da tarefa.

**Status muda sozinho em duas transições específicas, pra nunca contradizer
o Executor:**
- Selecionar "Sem executor" → status vira **"Sem Executor"** (status
  novo, criado especificamente pra esse caso; também está disponível como
  opção no dropdown "Status Operacional" da tela de detalhes da tarefa, na
  Árvore de Projeto — `edit-t-status` em `arvore.js`).
- Escolher um funcionário numa tarefa que estava com status "Sem Executor"
  → status volta pra **"Apontada"** (senão a tarefa ficaria com executor
  atribuído mas o status ainda dizendo "sem executor" — contraditório).

Trocar de um executor pra outro (nenhum dos dois vazio), ou atribuir um
executor numa tarefa que já tinha outro status (ex: "Em Desenvolvimento"),
**não** mexe no status — só essas duas transições específicas.

**Largura da coluna Tarefa é calculada dinamicamente**
(`ajustarLarguraColunaTarefa()`, chamada em `carregarPainelAtribuicaoTarefas()`),
a partir do nome mais comprido já cadastrado no Catálogo de Tarefas
(`banco_tarefas_lego`) — não do que está sendo exibido no momento, que
pode ter tarefas mais curtas. Usa unidade `ch` (aprox. 1 caractere),
mínimo de 10ch se o catálogo estiver vazio.

**Pontos também é editável direto na lista** (`editarPontosTarefaAtribuicao()`,
mesmo campo `tarefa.pontos` usado pela Árvore e pela aba "Verba por Tarefa").
Salva sozinho ao sair do campo, e **não re-renderiza a tabela inteira**
(perderia o foco do campo) — mas **recalcula ao vivo o Pontos Máximo de
todas as tarefas do mesmo pavimento** (`recalcularGrupoPontosMaximoAtribuicao()`),
já que mudar os Pontos de uma tarefa muda a proporção de Verba — e portanto
o Pontos Máximo — de todas as outras do mesmo pavimento, não só da editada.

Sem storage próprio — lê/escreve direto em `banco_arvores_projetos`
(campos `tarefa.executor` e `tarefa.pontos`, os mesmos que a Árvore de
Projeto usa e exibe).

**Tabela compacta e paginada:** classe `.tabela-compacta` reduz o padding
das células (2px 8px vertical, `line-height:1.1`, borda de 0.5px) só nessa
tela (não afeta as outras tabelas do sistema). Colunas Pontos e Pontos
Máximo são centralizadas (classe `.col-centralizada`). Coluna Executor é
mais larga (320px) e mostra só o nome do funcionário, sem o cargo (cargo
saiu de `construirOpcoesExecutor()` — o `value` do `<option>` sempre foi só
o nome, então isso não quebrou `atribuirExecutorTarefa()`). Coluna Status,
por ser a última, tem um `padding-left` extra pra ficar visualmente mais
afastada da coluna Executor. **Sem paginação** (removida a pedido do
usuário — "a rolagem das páginas devem ser feitas sempre a partir da
barra de rolagem, sem clicar no botão 'próxima'"): `renderizarPainelAtribuicaoTarefas()`
não recebe mais parâmetro nenhum e sempre renderiza a lista `lista`
INTEIRA (`tbody.innerHTML = lista.map(...)`, sem slice); a navegação é
só pela barra de rolagem do `.table-wrapper` (`overflow-y:auto`, já
existia em `estilos.css`). `AT_ITENS_POR_PAGINA`, `atPaginaAtual` e
`mudarPaginaAtribuicao()` foram removidos por completo (não existem
mais em lugar nenhum do código). `renderizarPaginacaoAtribuicao(totalItens)`
ficou só como um rótulo de contagem (`<span>N tarefa(s)</span>`) no
`#at-paginacao`, sem nenhum botão.

**Priorização por arrastar-e-soltar (regrava `ordem_fila`), exibida em
ordem CRONOLÓGICA (pedido da diretoria, mudou nessa rodada):** a tabela
é agrupada em blocos contíguos por Executor
(`ordenarListaPorExecutorEData()`, alfabético `pt-BR` entre executores),
e dentro de cada bloco ordenada pela **Data de Início EFETIVA**
(`dataEfetivaOrdenacaoAtribuicao()`: âncora manual se existir, senão a
calculada automaticamente) — **não mais por `ordem_fila` cru**. O motivo
da mudança: `ordem_fila` nem sempre bate com a ordem cronológica real
(uma âncora manual pode "furar a fila" pra uma data bem anterior à de
uma tarefa com `ordem_fila` menor — ver seção 6, "Empurrão em cascata
quando a âncora conflita", que é exatamente esse cenário). Tarefas
"Sem Executor" não têm data calculável — ficam sempre no bloco final,
ordenadas alfabeticamente por nome da Tarefa, e **não são arrastáveis**
(sem `draggable`). Tarefa com status incluído no filtro mas sem data
calculável (ex: "Finalizada", que o motor não processa) vai pro final
do PRÓPRIO bloco do executor, não pro final da tabela inteira.

**O ARRASTO EM SI NÃO MUDOU** — `reordenarFilaExecutorNaArvore()`
continua fazendo exatamente o que sempre fez: regrava `ordem_fila` da
fila inteira daquele executor, na posição visual onde a linha foi
solta. Só o CRITÉRIO DE EXIBIÇÃO da tabela mudou pra data; `ordem_fila`
continua sendo o campo que o motor de sequenciamento (`feriados.js`)
usa de verdade pra decidir a ordem de processamento da fila — a tabela
só passou a MOSTRAR essa fila numa ordem diferente (cronológica) da que
ela é PROCESSADA (por `ordem_fila`). Consequência que vale ter em mente:
como a exibição agora é por data, arrastar uma linha pra uma posição
visual específica com âncoras no meio da fila pode não corresponder de
forma óbvia a "essa tarefa vai processar antes/depois de tal outra" —
é uma tensão inerente de misturar os dois mecanismos (fila por
prioridade E âncoras por data), não um bug.

Cada linha com executor tem `draggable="true"` e os handlers
`atDragStart` / `atDragOver` / `atDrop`. `atDragOver` só chama
`preventDefault()` (aceitando o drop) se a linha sobrevoada é do MESMO
executor que está sendo arrastado — arrastar sobre a linha de outro
executor simplesmente não faz nada (o navegador nunca dispara o evento
`drop`). Soltar a linha A sobre a linha B insere A imediatamente antes de
B (mesma convenção já usada em Etapas/Setores na Árvore de Projeto).

`reordenarFilaExecutorNaArvore()` é quem grava de verdade: monta a fila
**completa** daquele executor (todas as tarefas dele, em TODOS os
projetos — não só o que está visível na página/filtro atual, porque o
motor de Data Prevista em `feriados.js` usa a fila inteira), remove a
tarefa arrastada, insere antes da tarefa-alvo, e renumera TODOS os itens
da fila sequencialmente a partir do valor atual de
`banco_proximo_ordem_fila` (lido/gravado direto, sem chamar
`proximoNumeroOrdemFila()` item a item, só pra evitar a dança de off-by-
one de chamar a função repetidas vezes). A função pura que faz o
recorte/inserção (`reordenarFilaExecutor()`) é testável isolada (sem
DOM/localStorage) e trata os casos de borda: soltar sobre si mesmo é
no-op, e caminho arrastado ou alvo que sumiu da árvore entre o render e o
drop (ex: outra aba mudou a atribuição) também é no-op, sem quebrar nem
duplicar tarefa.

~~**Arrasto funciona só dentro da página atual**~~ — **NÃO SE APLICA
MAIS**: como a paginação foi removida (ver acima), a lista inteira
filtrada já fica visível de uma vez (rolando pelo `.table-wrapper`), então
não existe mais o cenário de tarefas do mesmo executor "presas" em
páginas diferentes.

~~**Dead Line ainda não existe**~~ — **IMPLEMENTADO** (item 14 da
Rodada de Comentários da Gerência, ver §12) — bloqueia de verdade
(impede o drop, sem opção de forçar) qualquer arrasto que jogue o
cumprimento do dead line de uma tarefa pra depois da Data Prevista
calculada.

**Coluna "Data de Início"** (entre Localização e Tarefa): `<input
type="date">` editável pra cada tarefa com executor atribuído e não
finalizada (`Sem Executor` e `Finalizada` mostram "—", sem input — não dá
pra calcular fila pra elas). O valor mostrado é `tarefa.data_inicio_manual`
se existir (âncora manual gravada pelo analista/administrador — controle
de acesso em si ainda não existe, ver item 5 do roadmap na seção 12, então
por ora qualquer um que acesse a tela edita), senão o valor calculado
automaticamente por `calcularDatasInicioExecutor()` (novo, em
`feriados.js`). `editarDataInicioTarefa()` grava/apaga
`data_inicio_manual` e re-renderiza o painel inteiro
(`renderizarPainelAtribuicaoTarefas()`, sem parâmetro — ver nota sobre
remoção da paginação acima) — não dá pra atualizar só a célula, porque
tarefas seguintes da mesma fila podem ter se reajustado. Quando há âncora manual, aparece um botão ↺ do
lado do input (`limparDataInicioManual()`) pra voltar ao cálculo
automático.

O motor em si (`calcularFilaComDatasExecutor()`, núcleo compartilhado por
`calcularDatasPrevistasExecutor()` — usado pelo Kanban — e
`calcularDatasInicioExecutor()` — usado aqui) caminha a fila do executor
em ordem de `ordem_fila`; ao chegar numa tarefa com
`data_inicio_manual`, o cursor PULA pra essa data antes de consumir as
horas dela, e as tarefas seguintes (sem âncora própria) continuam
naturalmente a partir daí — é assim que "as tarefas sequenciais se
ajustam automaticamente" quando o analista edita uma Data de Início no
meio da fila. Podem coexistir várias âncoras na mesma fila (cada uma só
afeta o trecho a partir dela). Data digitada em fim de semana/feriado/dia
zerado do calendário do funcionário é aceita como está (não bloqueia) —
o cálculo já resolve pro próximo dia útil a partir dali.

**Empurrão em cascata quando a âncora conflita** (`fixarAncoraComEmpurrao()`,
em `feriados.js`) — bug real encontrado pelo usuário (duas tarefas de
projetos diferentes com o mesmo Início, somando mais horas do que o dia
do funcionário comporta), e a solução que ele pediu pra substituir a
primeira tentativa (que só avisava com `confirm()` — essa versão foi
descartada). Agora, em vez de perguntar, `editarDataInicioTarefa()`
resolve sozinho: se a nova âncora colide com o período de outra tarefa
do mesmo executor, EMPURRA a outra automaticamente pra começar no dia
seguinte ao fim de quem "venceu" — de forma **permanente** (grava um
`tarefa.data_inicio_manual` novo na tarefa empurrada, exatamente como se
alguém tivesse digitado aquela data nela também). Encadeia: se esse
empurrão criar um novo conflito com uma terceira tarefa, empurra essa
também, e assim por diante, até a fila inteira do executor ficar sem
nenhuma sobreposição.

Regra de quem vence, combinada com o usuário:
- A tarefa que está sendo editada agora **nunca é empurrada** — ganha
  sempre, mesmo atropelando uma tarefa de prioridade mais alta
  (`ordem_fila` menor, que veio antes na fila por arrasto). É uma
  inversão deliberada da prioridade normal, só pra essa operação — foi
  exatamente o que aconteceu no caso real que o usuário reportou
  ("Pilares-Detalhamento", prioridade mais alta, foi empurrado quando
  alguém ancorou "Forma-Desenho" em cima dele).
- Num conflito secundário (nenhuma das duas tarefas é a que está sendo
  editada agora, encontrado durante o encadeamento), vence quem tem
  `ordem_fila` menor — aí a prioridade normal da fila volta a valer.

Implementação: a cada rodada, recalcula a fila inteira
(`calcularFilaComDatasExecutor(nomeExecutor, todas)`, na cópia em
memória — nada é gravado no `localStorage` até o fim) e procura
QUALQUER par de tarefas com período sobreposto (`periodosSeSobrepoem()`)
— não só quem conflitou com a última tarefa empurrada. Isso importa
porque duas tarefas empurradas em rodadas diferentes podem acabar caindo
no mesmo dia seguinte de uma terceira (cada âncora assume o dia inteiro
livre, sem saber da outra) — um bug que apareceu escrevendo o teste e
foi corrigido antes de ir pro código real. Trava de segurança de 1000
iterações (nunca deveria chegar perto disso numa fila real). Depois de
tudo resolvido, `editarDataInicioTarefa()` mostra um `alert()`
informativo listando o que foi empurrado — não bloqueia nada, só avisa.

## 7. Kanban do Executor

**Hierarquia de Revisão do Kanban (julho/2026) — substitui o modelo
anterior de "quem verifica" por completo.** Fechada em várias rodadas
de conversa com o usuário (vale reler o histórico se for mexer aqui de
novo, porque a primeira leitura minha de cada rodada estava errada em
pelo menos um detalhe — a lógica final só ficou clara depois de 4
idas-e-vindas). Motivação original do usuário: hoje qualquer
Administrador/Analista podia arrastar cartão de QUALQUER executor pra
QUALQUER coluna, sem regra nenhuma sobre quem deveria estar fazendo
essa revisão.

**A ideia central: a permissão depende de quem É O EXECUTOR da tarefa
(`tarefa.executor`, por NOME), não do nível de quem está tentando
arrastar.** Um Analista, Supervisor ou Administrador pode perfeitamente
ser o executor designado de uma tarefa específica — a checagem nunca é
"que nível tem a pessoa logada", é sempre "essa tarefa é minha (bati o
nome) ou é de outra pessoa".

*Regra 1 — é a MINHA tarefa (`tarefa.executor === usuarioLogado.nome`):*
- Posso arrastar entre Apontada ↔ Em Desenvolvimento ↔ Aguardando
  Verificação (mesmo comportamento de sempre pro "executor comum" —
  ver `KB_STATUS_RESTRITOS_EXECUTOR`).
- **Exceto** se eu for Supervisor ou Administrador: aí tenho
  autoaprovação — vou até "Para revisão"/"Finalizada" sozinho, sem
  precisar de mais ninguém (não faz sentido exigir revisor pra quem já
  está no topo da hierarquia).

*Regra 2 — é tarefa de OUTRA pessoa:*
- NÃO posso arrastar nas colunas iniciais (isso é território de quem
  está fazendo o trabalho, não de quem supervisiona).
- SÓ posso mover ela de "Aguardando Verificação" pra "Para
  revisão"/"Finalizada" (a revisão em si), e só se eu tiver autoridade
  — hierarquia de ESCALONAMENTO baseada no nível de quem é o
  EXECUTOR da tarefa (`kanban.js::nivelExigidoParaRevisar()`):
  - executor nível comum → revisa o **Analista responsável pelo
    projeto** (`projeto.analista`).
  - executor é um Analista (a Analista está executando a tarefa) →
    revisa o **Supervisor responsável pelo projeto** (`projeto.supervisor`)
    — escala um nível acima, já que um Analista não revisa outro
    Analista.
  - executor é Supervisor ou Administrador → autoaprovação (ninguém
    revisa, mesma regra da Regra 1).
  - Administrador sempre pode revisar qualquer coisa, de qualquer
    projeto (`kanban.js::podeRevisarTarefa()`) — Analista/Supervisor só
    nos projetos onde são os responsáveis.

**Visibilidade — pedido explícito do usuário, sem criar tela nova:**
quando um executor move a própria tarefa pra "Aguardando Verificação",
ela deve "aparecer no Kanban do responsável pela verificação, como uma
tarefa para ele executar". Isso **não é** a "Kanban do Analista"
revertida antes (tela separada, agregando tudo) — é o MESMO Kanban de
sempre: quando o revisor certo abre o PRÓPRIO Kanban (se seleciona no
dropdown), `coletarTarefasDoExecutor()` mescla, além das tarefas que
ele mesmo executa, a lista de `coletarTarefasParaRevisar()` — tudo que
está "Aguardando Verificação" e ele tem autoridade de revisar, em
QUALQUER projeto permitido. O cartão mostra "👤 {executor}" quando é
uma tarefa de outra pessoa (`construirCartaoKanbanHtml()`, terceiro
parâmetro novo `nomeExecutorVisualizado`), pra não confundir de quem é
o trabalho. **Só mescla quando estou vendo o PRÓPRIO nome** — escolher
outro executor no dropdown mostra só as tarefas dele, sem misturar
minha fila de revisão (ficaria confuso ter duas identidades na mesma
tela).

**Contador de retrabalho:** `tarefa.vezes_em_revisao` incrementa toda
vez que a tarefa volta de "Aguardando Verificação" pra "Para revisão"
(reprovada, precisa de correção) — aprovar (ir pra "Finalizada") NÃO
incrementa. Vai alimentar o índice de produtividade futuro (ver
§12.1 — item já estava previsto lá como "próximo passo mais simples",
esse contador é exatamente esse próximo passo).

**Efeito colateral na UI, aceito conscientemente:** como a permissão
agora depende do CARTÃO específico sendo arrastado (não dá mais pra
saber de antemão, só pelo nível de quem está vendo a tela, se uma
COLUNA inteira deve aceitar ou recusar um drop), `montarColunasKanban()`
não bloqueia mais nenhuma coluna visualmente de propósito — todas
aceitam o drop, e a recusa (com `alert()` explicando o motivo) acontece
em `moverTarefaParaStatus()`, a fonte de verdade de sempre. Perdeu um
pouco de polimento (cursor "não permitido" antes de soltar), ganhou
muito em corretude — decisão deliberada de simplicidade dado o tamanho
da mudança.

**Testes:** 26 casos isolados (hierarquia completa —
`teste_kanban_hierarquia_revisao.js`) + 6 isolados de
`moverTarefaParaStatus()`/contador
(`teste_kanban_mover_status_e_contador.js`) + 10 isolados de
visibilidade (`teste_kanban_visibilidade_revisao.js`) + 7 de integração
completa extraída dos arquivos reais
(`teste_kanban_revisao_integracao_real.js`). **2 testes antigos ficaram
obsoletos** (testavam a função removida `nivelPodeMoverParaStatusKanban`)
e foram movidos pra `_historico_kanban_analista_removido/`
(`teste_nivel_pode_mover.js`, `teste_mover_tarefa_status.js`) — não
apagados, só tirados da suíte ativa, mesmo padrão já usado quando a
"Kanban do Analista" foi revertida. Sincronizado em
`modulos_isolados/kanban/` (JS + CSS do badge novo).


do usuário: "o Analista poderá ter acesso ao kanban do executor apenas
dos projetos onde ele está vinculado". Antes disso, o Kanban não tinha
NENHUMA restrição por projeto (só a restrição de TELA inteira, Rodada 2
— Executor nem chega aqui pra escolher outro executor; mas
Administrador/Analista/Supervisor viam TODAS as tarefas de QUALQUER
executor escolhido no dropdown, mesmo de projetos sem relação com o
Analista logado). Corrigido em
`kanban.js::coletarTarefasDoExecutor()`, mesmo padrão já usado em
`atribuicao-tarefas.js`/`distribuicao-custos.js`/`relatorios.js`
(`obterNomesProjetosPermitidos()`, core.js) — se o executor escolhido
trabalha em vários projetos, só aparecem as tarefas dos projetos onde o
Analista logado é o responsável; os outros ficam invisíveis, como se
não existissem. Testado: 3 casos isolados + 1 reconfirmado no arquivo
real (executor com tarefas em 2 projetos, Analista vinculado só a um
deles vê só a tarefa desse). Sincronizado em `modulos_isolados/kanban/`.

**Dois adendos pedidos logo em seguida, depois de testar o item acima:**
1. **Dropdown de executor também filtrado** — a restrição acima só
   filtrava as TAREFAS visíveis; o dropdown pra ESCOLHER o executor
   continuava mostrando todo mundo, mesmo gente que só trabalha em
   projetos sem relação com o Analista (escolher um desses mostrava o
   Kanban vazio, sem pista de por quê). Corrigido com
   `kanban.js::obterExecutoresVinculadosAosProjetos(arvores, projetosPermitidos)`
   — varre as árvores dos projetos PERMITIDOS atrás de quem tem alguma
   tarefa lá, e `carregarPainelKanban()` filtra a lista de funcionários
   do dropdown por esse conjunto antes de montar as `<option>`. `null`
   (sem restrição — Administrador/Supervisor) mantém o dropdown
   completo, como sempre foi. Testado: 6 casos isolados + confirmado no
   PONTO 2 do teste de integração combinado (ver mais abaixo).
2. **Analista não pode mais alterar o calendário do colaborador** —
   "Ele não pode ter atribuição de alterar o calendário do executor."
   O botão "⚙️ Meu Calendário"/"Calendário de X" continua abrindo o
   modal normalmente pro Analista (pode VER as exceções já existentes),
   mas o formulário de criar uma exceção nova vem com os 4 campos +
   botão "+ Enviar pra aprovação" desabilitados
   (`kanban.js::abrirModalCalendarioKanban()`, usando
   `podeAlterarCalendarioColaborador()` — Administrador/Supervisor
   sempre podem; Executor pode mexer no PRÓPRIO calendário, já que o
   Kanban trava o dropdown nele mesmo nesse nível). Trava REAL também
   dentro de `criarExcecaoCalendarioKanban()` (defesa em profundidade,
   mesmo padrão de sempre). Precisou de um `id` novo no botão "+ Enviar
   pra aprovação" (`kb-cal-btn-enviar`) — não tinha nenhum antes.
   Testado: 5 casos isolados + confirmado no PONTO 3 do teste de
   integração combinado, incluindo o contraste "Supervisor consegue
   normalmente".

Módulo próprio (`js/kanban.js`). Pensado pra ser a tela do EXECUTOR — só
mostra Tarefa e Pontos, nada de custo/verba/prazo. 5 colunas fixas, os
mesmos status "de trabalho real" usados em todo o sistema (`KB_COLUNAS`:
Apontada, Em Desenvolvimento, Aguardando Verificação, **Para revisão**,
Finalizada — renomeado de "Pendente de Validação"; ver nota de migração
na seção 12). **"Sem Executor" não aparece aqui** — não faz sentido nessa
tela, já que só mostra tarefas de UM executor específico (por definição,
já atribuídas).

**Ainda não tem login.** Por decisão explícita do usuário (login fica
por último no controle de acesso, depois de Calendário/Feriados e do
motor de sequenciamento), por enquanto quem está testando escolhe
manualmente o Executor num dropdown no topo (`#kb-executor`,
`carregarKanbanExecutor()`). **Quando o login for implementado, essa
escolha manual deve ser substituída pelo usuário logado** — não é
comportamento definitivo, é só um substituto temporário pra poder testar.

**Arrastar um cartão pra outra coluna muda o status na hora**
(`soltarCartaoKanban()`) — grava direto em `banco_arvores_projetos`
(mesmo campo `tarefa.status` que a Árvore de Projeto e a Atribuição de
Tarefas usam e exibem; não existe "replicar", é o mesmo dado). Não tem
confirmação nem desfazer — arrastou, já mudou. `coletarTarefasDoExecutor()`
é uma função própria desse arquivo (não reaproveita a de
`atribuicao-tarefas.js`, que é mais pesada por calcular Verba/Pontos
Máximo — o Kanban não precisa de nada disso, só tarefa/pontos/status).

**Cards de cada coluna em ordem cronológica de Data de Início** —
pedido explícito do usuário. Ordena por `datasExecutor[caminho].inicio`
(string ISO "AAAA-MM-DD", comparável direto por `localeCompare`).
Tarefas sem data calculável (a coluna "Finalizada" não entra no mapa do
motor — ver seção 9) vão pro final da coluna, sem quebrar a ordenação
das demais.

**Cada cartão mostra o caminho completo** (`Projeto › Etapa › Setor ›
Pavimento`, em cinza pequeno, acima do nome da Tarefa) — necessário
porque o Kanban mistura tarefas de TODOS os projetos do executor na
mesma coluna (`coletarTarefasDoExecutor()` não filtra por projeto), então
sem isso duas tarefas homônimas em projetos/locais diferentes ficariam
indistinguíveis no cartão.

**Cada cartão mostra Início e Fim previstos** (`🏁 DD/MM → DD/MM`),
calculados AO VIVO toda vez que o painel renderiza
(`calcularDatasInicioEFimExecutor()`, de `feriados.js` — ver seção 9),
nunca um valor salvo/desatualizado. Tarefas "Finalizada" não aparecem no
mapa de datas (não precisam mais de projeção), então ficam sem essa
linha no cartão.

**Contagem (play) bloqueada em tarefas "Apontada" e "Aguardando
Verificação"** — pedido explícito do usuário, pra não deixar apontar
hora numa tarefa que nem começou de verdade, nem numa que já foi
entregue pro Analista revisar (item 2 da "Frente Kanban avançado", ver
§12). O cartão mostra "🔒 Mova pra iniciar" (em "Apontada") ou "🔒 Em
revisão" (em "Aguardando Verificação") no lugar do botão ▶ Iniciar; só
libera de novo em "Em Desenvolvimento" (arrastando o cartão, ou mudando
o status na Atribuição de Tarefas/Árvore). Bloqueio de verdade em
`apontamento.js::statusBloqueiaCronometro(status)` — usada tanto por
`iniciarSessaoTrabalho()` (retorna `false` sem criar
`sessao_ativa_inicio` nem mexer em nenhuma sessão ativa em outro lugar)
quanto pela renderização do cartão em `kanban.js`, mesma fonte de
verdade nos dois lugares — não só cosmético no botão, então mesmo que
algo tente chamar a função por fora do botão, continua bloqueado. Os
demais status ("Em Desenvolvimento", "Para revisão", "Finalizada")
continuam livres pra retomar o cronômetro.

**"⚙️ Meu Calendário"** (botão ao lado do dropdown de executor, desabilitado
até escolher um) — pedido da diretoria: o próprio executor consegue
registrar ausência (0h) ou hora extra (>0h num dia que normalmente não
teria) sem depender do administrador editar o Calendário Semanal fixo
dele no Cadastro de Funcionários. Abre um modal (`#kb-modal-calendario`,
classe `.modal-overlay`/`.modal-caixa` — padrão novo de modal centralizado,
não existia antes; os formulários de Cadastros usam painel lateral, que
não servia aqui porque o Kanban precisa continuar visível atrás) com um
formulário de nova exceção e a lista das exceções já registradas daquele
executor, com status colorido.

**Sem login ainda**: qualquer um que escolher o executor no dropdown do
Kanban consegue editar o calendário DELE — mesmo nível de confiança que
o resto do sistema hoje. Decisão explícita do usuário, não é descuido.

`criarExcecaoCalendarioKanban()` valida (as duas datas preenchidas, "De"
não pode ser depois de "Até", horas ≥ 0 — `validarNovaExcecaoCalendario()`,
testável isolada) e grava em `funcionario.excecoes_calendario` (array de
`{id, data_inicio, data_fim, horas_por_dia, motivo, status}`) com
`status: 'pendente'` — **NÃO afeta nenhum cálculo ainda**. Só depois que
for aprovada na aba "Calendário" da tela de Aprovações (ver abaixo) é
que
`obterExcecaoAprovada()` (feriados.js) passa a enxergá-la. O padrão
semanal do funcionário nunca é tocado por uma exceção — ela só sobrescreve
o período específico dela.

## 7.1. Aprovações (Calendário + Apontamento de Horas)

Tela **separada** (`js/aprovacoes-calendario.js` — nome do arquivo NÃO
foi atualizado, ver nota abaixo —, `panel-aprovacoes_calendario`) —
pedido explícito do usuário, não quis a lista de aprovação dentro do
Cadastro de Funcionários. Desde o item 4 da "Frente Kanban avançado"
(§12), a tela ganhou uma SEGUNDA ABA e virou genérica: "🗓️ Calendário"
(conteúdo original desta seção, inalterado) e "🕐 Apontamento de Horas"
(anotação manual do Executor no Kanban + aprovação — desenho completo
descrito no item 4, não repetido aqui). `alternarAbaAprovacoes(aba)`
troca a aba visível; `renderizarPainelAprovacoes()` é o orquestrador
chamado por `alternarModulo()` (core.js), renderiza as duas tabelas e
mostra a aba que estava ativa.

**Aba Calendário:** mostra TODAS as exceções de calendário de TODOS os
funcionários numa tabela só (`listarTodasExcecoesCalendario()`),
pendentes primeiro, com botões Aprovar/Recusar em cada linha (só
aparecem se `status === 'pendente'`; já decidida mostra só o status).
`aprovarExcecaoCalendario()`/`recusarExcecaoCalendario()` localizam a
exceção pelo par (nome do funcionário, id da exceção — não por índice de
array, que mudaria se alguém excluísse uma no meio) e trocam o `status`.

**Nome do arquivo mantido por conveniência:** `aprovacoes-calendario.js`
continua se chamando assim apesar de cobrir as duas abas agora — evita
mexer no `<script src>` do `index.html` só por causa do nome. O
cabeçalho do arquivo documenta isso explicitamente.

**Badge de pendências no menu** (`#badge-pendencias-aprovacoes`, span
vermelho dentro do item "🗓️ Aprovações" — nome genérico, sem "de
Calendário", desde o item 4) — `atualizarBadgePendenciasAprovacoes()`
(RENOMEADA de `atualizarBadgePendenciasCalendario()` no item 4; todos os
call sites atualizados) agora soma as pendências das DUAS abas
(`contarExcecoesPendentes() + contarApontamentosManuaisPendentes()`).
Chamada no boot (`window.onload`, core.js), toda vez que uma exceção OU
apontamento novo é criado no Kanban, e toda vez que qualquer um dos dois
é aprovado/recusado aqui. Escondido (`display:none`) quando a contagem
total é zero, não só com texto "0".

Sem dependência de carregamento rígida com `kanban.js` — as chamadas de
`atualizarBadgePendenciasAprovacoes()` de dentro de
`criarExcecaoCalendarioKanban()`/`criarApontamentoManualKanban()` são
protegidas por `typeof === 'function'` (mesmo padrão usado em outros
lugares do projeto pra dependências opcionais entre módulos), então a
ordem dos `<script>` no `index.html` não importa pra isso funcionar —
mas por clareza, `aprovacoes-calendario.js` carrega logo depois de
`kanban.js`. Já a direção contrária (`aprovacoes-calendario.js` chamando
funções de `apontamento.js` — `listarTodosApontamentosManuais()`,
`contarApontamentosManuaisPendentes()`, `aprovarApontamentoManual()`,
`recusarApontamentoManual()`) é uma dependência DIRETA, sem guarda —
`apontamento.js` carrega antes no `index.html`, mesmo padrão que
`kanban.js` já usa com `apontamento.js`.

## 7.2. Destaque de Verificação (Atribuição de Tarefas) + Distribuição de Custos somente-leitura

**Histórico importante pra quem for mexer aqui:** o item 5 da "Frente
Kanban avançado" (§12) originalmente virou uma tela nova, "Kanban do
Analista" (`js/kanban-analista.js`, sem seletor, mesmas 5 colunas do
Kanban do Executor). Depois de testar, **o usuário achou a tela
confusa e desnecessária** e pediu pra REMOVER — o arquivo
`kanban-analista.js` foi apagado, junto com o item de menu
(`nav-kanban_analista`), o painel (`panel-kanban_analista`) e as
entradas em `MENU_POR_NIVEL`/`alternarModulo()` (core.js). Se você
encontrar qualquer referência a "Kanban do Analista" em código ou nos
módulos isolados, é resquício — não deveria existir mais (checagem
`grep -rl "kanban-analista\|kanban_analista"` deve voltar vazia).

Duas partes de `kanban.js` sobreviveram à remoção, porque continuam
valendo só pro Kanban do Executor e não foram criticadas: a extração
`construirCartaoKanbanHtml(t, hojeISO)` (simplificada depois, perdeu o
parâmetro `opcoes.mostrarExecutor` que só existia pro Analista) e
`corBordaCartaoKanban(status, dataFimPrevista, hojeISO)` — a cor de
destaque na borda do cartão (🔴 vencida / 🟡 "Para revisão" / 🟢 normal)
continua funcionando no Kanban do Executor.

**O que substituiu a tela**, combinado com o usuário depois da remoção:

1. **Destaque de "Aguardando Verificação" na Atribuição de Tarefas**
   (`js/atribuicao-tarefas.js`) — só pro nível **Analista** (não
   Administrador/Supervisor, que não têm o mesmo conceito de "projeto
   responsável"). Dois efeitos, os dois juntos (pedido explícito):
   - **Aviso/contador no topo** (`#at-aviso-verificacao`,
     `atualizarAvisoAguardandoVerificacao()`): "🕐 N tarefa(s) do(s) seu(s)
     projeto(s) aguardando sua verificação." Calculado sobre a lista
     ANTES dos filtros de coluna da tabela (`atFiltroSelecionado`), pra
     não sumir só porque o Analista filtrou a tabela por outro status
     no momento.
   - **Realce na linha da tabela** (fundo `#fffbeb` + borda esquerda
     `#f59e0b`, mesmo amarelo usado no Kanban) quando
     `deveDestacarLinhaAguardandoVerificacao(status, nivel)` é
     verdadeiro.
   - A restrição por projeto **já existia** antes disso
     (`obterNomesProjetosPermitidos()`, Rodada 3 do controle de acesso)
     — não precisou de filtro novo, só reaproveitar o que a tela já
     fazia.
   - Funções puras, testáveis sem DOM (ver
     `/home/claude/testes/teste_destaque_aviso_analista.js`).

2. **Distribuição de Custos somente-leitura pra Analista E Supervisor**
   (`js/distribuicao-custos.js`) — achado paralelo do usuário durante o
   teste (bug de controle de acesso, não estava relacionado ao Kanban do
   Analista): a tela nunca teve nenhuma lógica de somente-leitura, então
   qualquer nível com acesso ao menu conseguia editar. Agora:
   - `nivelSomenteLeituraDistribuicaoCustos(nivel)` — função pura,
     `true` pra `'analista'` e `'supervisor'`, `false` pro resto
     (inclusive sem nível — módulo isolado/sem login, mesmo fallback
     aberto do resto do projeto, já que a tela já é protegida por trás
     do controle de acesso de menu).
   - `aplicarSomenteLeituraDistribuicaoCustos()` — desabilita TODO
     `input`/`select` do painel (exceto `#dc-projeto`, que continua
     livre pra poder escolher o que visualizar) e todo `button` cujo
     `onclick` contenha `salvar`/`recalcular`/`aplicarVerbaProporcional`.
     Chamada no final de `alternarAbaDistribuicao()` — gargalo único por
     onde passa tanto a carga inicial quanto toda troca de aba (cada aba
     reconstrói seu HTML via `innerHTML`, então precisa reaplicar toda
     vez).
   - **Trava real** (defesa em profundidade, não só os campos
     desabilitados): as 4 funções que gravam
     (`salvarDistribuicaoAnalista`, `salvarDistribuicaoLucros`,
     `salvarPontosVerbaPorTarefa`, `salvarDistribuicaoCustos`) checam
     `distribuicaoCustosSomenteLeitura()` na primeira linha e recusam
     com `alert()` antes de tocar em qualquer coisa.

**Testes:** 10 casos isolados (destaque + aviso) + 6 de integração
completa extraída do `atribuicao-tarefas.js` real (com `apontamento.js`
e `feriados.js` reais também carregados, não stubados — os stubs
davam erro de dependência faltando, então preferi carregar os arquivos
de verdade) + 6 isolados (regra de somente-leitura) + 12 de integração
das 4 funções `salvar*` reais confirmando bloqueio de
Analista/Supervisor sem tocar `localStorage`, e passagem livre do
Administrador. Testes do Kanban do Analista removido foram movidos pra
`/home/claude/testes/_historico_kanban_analista_removido/` (não
apagados, só tirados da suíte ativa, já que testam código que não
existe mais).

## 8. Relatórios

Tela nova (`js/relatorios.js`, `panel-relatorios`, `nav-relatorios`) —
acesso Administrador/Analista/Supervisor (com restrição por projeto pro
Analista, `obterNomesProjetosPermitidos()`), Executor não vê.

**Histórico de design — vale ler antes de mexer aqui:** o pedido
original era uma lista fixa de 7 relatórios (Custo por Funcionário e
Período, Custo por Projeto, Custo Total, Horas Trabalhadas, Tarefas em
Atraso, Orçado vs. Realizado, Horas Previstas vs. Realizadas). Antes de
escrever qualquer código, foram feitos **2 protótipos HTML** navegáveis
(`mockup_relatorios.html` — lista fixa, testado e rejeitado; e
`mockup_relatorios_v2_flexivel.html` — motor genérico com filtro +
colunas + agrupar + visões salvas, aprovado) mostrados ao usuário. A
mudança de rumo veio depois que o usuário mandou um print de outro
sistema comercial (mostrando um painel de "Filtro avançado" com campos
como Projeto/Etapa/Cliente/Técnico/Data) e pediu pra pesquisar o
sistema **Artia**, que usa o conceito de **"Visões"** (filtro + colunas
+ agrupamento salvos e nomeados, reutilizáveis, disponíveis em várias
telas) — pesquisado via `web_search` a pedido explícito do usuário antes
de desenhar a arquitetura final.

**O motor NÃO é uma lista fixa de relatórios** — é genérico: o usuário
escolhe um **Nível**, aplica **Filtros**, escolhe **Colunas**, e
opcionalmente **Agrupa por** um campo. Os 7 relatórios originais viram
**"visões de fábrica"** pré-cadastradas em cima desse motor (só 5 deles
encaixam no catálogo atual — ver "Visões" mais abaixo). Visões salvas
são **compartilhadas** entre todo mundo que acessa a tela — decisão
explícita do usuário, não é por usuário.

### Os dois Níveis (granularidades de dado)

Os dados de custo/horas vivem em duas granularidades diferentes, que
NÃO se misturam num relatório só — o primeiro campo do filtro avançado
é justamente escolher qual delas usar:

- **Sessão de Trabalho** (`coletarLinhasSessaoTrabalho()`): uma linha
  por `sessoes_trabalho[i]` de cada tarefa. Cada sessão é custeada pelo
  valor da hora **vigente na DATA daquela sessão específica**
  (`valorHoraVigente()`, feriados.js) — uma tarefa que atravessa um
  reajuste salarial tem sessões custeadas em valores diferentes, cada
  uma correta pra época dela. Filtro de período usa a data da sessão.
  Colunas: Projeto, Cliente, Etapa, Setor, Pavimento, Tarefa, Executor,
  Data da Sessão, Horas, Valor da Hora, Custo.
- **Tarefa** (`coletarLinhasTarefa()`): uma linha por tarefa inteira
  (só as que já têm executor atribuído). "Horas Previstas" usa a MESMA
  fórmula já usada na Calibração BI (`arvore.js`, verificação de
  `is_outlier`): `base_h` (catálogo) × `qtd_fisica` × `peso_esforco`
  (do pavimento) × `f_esb` × `f_analista` (**esses dois últimos vivem
  na ÁRVORE do projeto, `banco_arvores_projetos[nome].f_esb/f_analista`
  — NÃO em `banco_projetos`**, confirmado lendo `arvore.js` antes de
  escrever o código). "Custo Real" reaproveita `calcularCustoRealTarefa()`
  (já existia em `apontamento.js`, construída pro índice de
  produtividade §12.1, nunca usada em tela nenhuma até este módulo).
  "Desvio %" e `outlier` (>40%, mesmo critério da Calibração BI) também
  calculados aqui. Filtro de período usa a **Data de Início Real**
  (primeira sessão da tarefa, `obterDataInicioExecucaoReal()`) — pedido
  explícito do usuário: "relacionar as tarefas iniciadas" no intervalo,
  mesmo que a tarefa continue depois do "até". Colunas: Projeto,
  Cliente, Etapa, Tarefa, Executor, Status, Pontos, Horas Previstas,
  Horas Realizadas, Desvio %, Custo Real, Data de Início Real.

**Duas colunas ficaram de fora de propósito** (decisão explícita do
usuário — "monta a tela com os 5 [relatórios] que já encaixam"): Data
Prevista de Fim por tarefa (precisa do motor de calendário POR
EXECUTOR, mais pesado) e verba orçada por projeto (precisa de
`banco_distribuicao_custos`). Sem essas duas colunas, 2 dos 7
relatórios originais ("Tarefas em Atraso" e "Orçado vs. Realizado")
não têm como virar visão de fábrica ainda — ficam pra uma extensão
futura do catálogo, se/quando pedido.

### O motor (funções puras, cada uma testável sem DOM)

- `aplicarFiltrosRelatorio(linhas, filtros)` — genérica, funciona nos
  dois níveis. `filtros.campoData` diz qual campo da linha representa
  "a data" pro filtro de período (cada nível usa um campo diferente,
  ver acima). Linha sem valor no campo de data é excluída quando o
  filtro de período está ativo.
- `agruparLinhasRelatorio(linhas, campoAgrupar, camposSoma)` — agrupa
  por um campo e soma os campos numéricos listados; sem campo de
  agrupar, devolve a lista original (linha a linha).
- `NIVEIS_RELATORIO` — o catálogo: cada coluna sabe seu rótulo, se
  aparece marcada por padrão (`padrao`), se pode ser somada num
  agrupamento (`somavel`) e como formatar (`tipo`, usado por
  `formatarValorColuna()`).
- `montarResultadoRelatorio(nivel, linhasBase, filtros, colunasAtivasIds, campoAgrupar)`
  — junta tudo: filtro → seleção de colunas → agrupamento → **totais
  gerais** (`resultado.totais`, soma os campos somáveis independente de
  estar agrupado ou não — é o que faz "Custo Total" existir como visão
  simples: nível Sessão, coluna Custo, sem precisar agrupar por nada,
  o rodapé da tabela já mostra o total geral).

### Visões (`banco_relatorios_visoes`, COMPARTILHADO)

Array de `{ id, nome, fabrica (bool), nivel, filtros, colunas (array de
ids), agrupar }`. `carregarVisoesRelatorio()` semeia as 5 visões de
fábrica (`visoesDeFabrica()`) na primeira vez que a tela é aberta
(array inexistente ou vazio) — depois disso nunca semeia de novo por
cima do que já existe. `salvarNovaVisaoRelatorio()` grava uma visão
nova do usuário (`fabrica: false`). `apagarVisaoRelatorio()` tem
**trava real**: visão de fábrica nunca pode ser apagada, mesmo que o
botão de apagar da UI de alguma forma fique habilitado por engano —
mesma filosofia de defesa em profundidade usada em outras telas do
projeto.

As 5 visões de fábrica: Custo por Funcionário e Período (nível Sessão,
agrupado por Executor), Custo por Projeto (nível Sessão, agrupado por
Projeto), Custo Total (nível Sessão, sem agrupar — usa o Total Geral),
Horas Trabalhadas por Funcionário e Período (nível Sessão, agrupado por
Executor), Horas Previstas vs. Realizadas (nível Tarefa, sem agrupar).

### UI (`carregarPainelRelatorios()` — orquestrador chamado por `alternarModulo()`)

Barra de Visões (seletor + "💾 Salvar visão atual" + "🗑️ Apagar visão",
só visível com uma visão selecionada) → Painel de Filtro Avançado
recolhível (`alternarPainelFiltroRelatorio()`) com Nível (2 botões
grandes, `mudarNivelRelatorio()`), Filtros (Projeto/Etapa/Cliente/
Executor — dropdowns populados só com valores que EXISTEM de verdade
nos dados do nível atual, `renderizarOpcoesFiltroRelatorio()` — não
lista o cadastro inteiro; Data inicial/final), Colunas (chips
clicáveis, `alternarColunaRelatorio()`), Agrupar por (dropdown,
opções variam por nível) → tabela de resultado
(`renderizarTabelaRelatorio()`, com linha de Total Geral no rodapé e
destaque vermelho de outlier — só linha a linha, sem agrupamento, já
que o campo `outlier` não sobrevive a uma soma). Trocar de nível reseta
colunas pro padrão do nível novo e limpa os filtros preenchidos (as
opções de dropdown mudam, um valor do nível anterior pode nem existir
no novo). Zero colunas selecionadas → aviso laranja "Selecione ao menos
1 coluna", mesmo padrão do print que o usuário mandou como referência.

**Impressão:** botão que chama `window.print()` direto — sem
biblioteca nova, decisão explícita do usuário. CSS `@media print`
(estilos.css) esconde `.app-header`, `.sidebar`, `.barra-visoes`,
`.painel-filtro`, deixando só a tabela na hora de imprimir. Essas
regras de print são GLOBAIS (não escopadas só a `#panel-relatorios`) —
inofensivo hoje porque nenhuma outra tela chama `window.print()`, mas
vale lembrar se algum dia outra tela ganhar um botão de imprimir
próprio, pode precisar ajustar o seletor.

**Testes:** 71 casos no total, 0 falhas — 15 (camada de dados) + 13
(filtro/agrupamento) + 8 (reconfirmados no arquivo real, incluindo
restrição por projeto nos dois sentidos) + 13 (catálogo/composição,
incluindo totais gerais) + 6 (reconfirmados no arquivo real) + 14
(CRUD de visões, incluindo proteção de visão de fábrica) + 5
(reconfirmados no arquivo real) + 13 (integração completa da UI:
mudar nível → colunas → agrupar → tabela → salvar visão → carregar
visão de fábrica → apagar bloqueado de verdade). Sincronizado em
`modulos_isolados/relatorios/` (pasta nova, mesmo padrão dos outros
módulos isolados — `core.js`, `feriados.js`, `apontamento.js`,
`relatorios.js`, `estilos.css`, harness `index.html` com o painel
completo).

**Teste manual do usuário — TESTADO E CONFIRMADO** ("parece que ficou
perfeito"): feito num artifact HTML autocontido (não no projeto real
direto) — os 3 arquivos reais (`relatorios.js`, `apontamento.js`,
`feriados.js`) colados dentro de `<script>`, com um substituto de
`localStorage` EM MEMÓRIA (mesma interface `getItem`/`setItem` —
artifacts não podem usar `localStorage` de verdade) carregado com dados
de exemplo desenhados de propósito pra exercitar os pontos mais
delicados: um funcionário com reajuste de valor de hora NO MEIO do
período de uma tarefa (pra conferir o custo por sessão, cada uma no
valor vigente certo) e uma tarefa com desvio grande o bastante pra
aparecer como outlier (borda vermelha). Útil como referência se precisar
montar um teste rápido parecido pra outra tela no futuro — é mais rápido
que gerar o zip inteiro quando o objetivo é só validar uma tela isolada
com dado de mentira.

**Bug encontrado DEPOIS da confirmação, achado com o app real (não o
artifact isolado) — corrigido:** o usuário testou o projeto de verdade
(baixou o `.zip`, abriu no navegador, fez login, clicou em Relatórios no
menu) e o painel de Filtro Avançado inteiro sumiu — só o cabeçalho
"🔽 Filtro avançado" aparecia, sem Nível/Filtros/Colunas/Agrupar embaixo.
Isso NÃO acontecia no artifact isolado de teste (só a tela de
Relatórios, sem o resto do app) nem numa primeira tentativa de recriar o
app inteiro num artifact chamando `alternarModulo('relatorios')`
diretamente — só reproduziu de verdade indo pelo fluxo real (login →
clicar no menu). Diagnóstico completo, sem adivinhar:
1. Comparei os 3 arquivos JS (`relatorios.js`, `apontamento.js`,
   `feriados.js`) que o usuário mandou como referência contra os do
   projeto — **idênticos, byte a byte** (só diferença de quebra de
   linha em branco no final). Confirmou que não era bug de lógica.
2. Usei Playwright (disponível no ambiente) pra abrir o artifact de
   verdade num Chromium automatizado e reproduzir o fluxo exato do
   usuário (login → clicar em "Relatórios") — sem isso, não teria
   achado a causa, porque só aparecia nesse caminho específico.
3. Inspecionei o DOM renderizado: `.painel-filtro` tinha
   `offsetHeight: 49` (só a altura do cabeçalho) enquanto seu filho
   `#rel-corpo-filtro` tinha `offsetHeight: 485` (conteúdo inteiro
   presente, só que cortado) — clássico gotcha de CSS flexbox:
   `overflow:hidden` num item DENTRO de um contêiner flex
   (`#panel-relatorios` é `display:flex; flex-direction:column;`)
   permite o navegador encolher esse item abaixo do tamanho do próprio
   conteúdo quando o espaço vertical fica apertado (a regra de
   `min-height:auto` do flexbox só protege contra isso quando
   `overflow` é `visible` — com `overflow:hidden`, essa proteção some).

**Correção:** `flex-shrink:0` adicionado em `.painel-filtro` e
`.barra-visoes` (estilos.css) — impede os dois de encolher abaixo do
conteúdo próprio dentro do contêiner flex. Reconfirmado com o MESMO
teste automatizado (login → clicar em Relatórios): `.painel-filtro`
passou de 49px pra 530px de altura, conteúdo completo visível.
Sincronizado em **todos** os `modulos_isolados/*/estilos.css` (achei
vários desatualizados de rodadas anteriores enquanto corrigia este,
sincronizei todos de uma vez).

**Efeito colateral do fix acima, corrigido na sequência:** com
`.painel-filtro` protegido por `flex-shrink:0` (altura sempre cheia,
nunca espremida), sobrou pouco espaço vertical pra área de resultado em
telas mais baixas — o relatório era gerado (sem erro, dado certo), só
que ficava sem altura nenhuma pra aparecer, sem barra de rolagem
alcançável (`#panel-relatorios` herdava `overflow:hidden` do
`.content-panel` global). Corrigido com `#panel-relatorios {
overflow-y: auto; }` — o painel inteiro (filtro + tabela juntos) rola
quando o conteúdo não cabe, em vez de tentar um scroll aninhado só na
tabela (mais simples, sem precisar calcular altura sobrando via flexbox
— decisão deliberada de simplicidade em vez de otimizar por um scroll
"mais bonito" com filtro fixo). `.table-wrapper` dentro de Relatórios
teve o `max-height:480px` do CSS global sobrescrito pra `none` (Relatórios
pode legitimamente ter relatórios mais longos que as 480px padrão de
outras telas). Reconfirmado com Playwright: num viewport de 900px de
altura, o painel precisava rolar (1211px de conteúdo em 534px visíveis)
e, depois de rolar até o fim, a última linha da tabela ficava
completamente visível — testado de verdade, não só inferido pelo CSS.

## 9. Feriados + Motor de Data Prevista

Módulo próprio (`js/feriados.js`), com duas responsabilidades que andam
juntas por dependerem uma da outra: o Cadastro de Feriados, e o motor que
calcula em que dia cada tarefa de um executor deve terminar.

**Feriados nacionais fixos são uma constante no código**
(`FERIADOS_FIXOS_NACIONAIS`, por `mesDia` tipo `"12-25"` — não editável,
não faz sentido recadastrar todo ano). **Feriados móveis (Carnaval,
Sexta-feira Santa, Corpus Christi) NÃO são calculados automaticamente** —
por decisão explícita (calcular a data da Páscoa é lógica extra que não
foi pedida), ficam por conta do administrador cadastrar manualmente, ano a
ano, junto com qualquer feriado municipal ou ponto facultativo, na tabela
de **Feriados Customizados** (`banco_feriados_customizados`, array de
`{ data: "AAAA-MM-DD", nome }`, editável/removível pela tela).

**Sábado e domingo nunca são dia útil, pra ninguém, sempre** — checado
direto em `ehDiaUtil()` por dia da semana, sem precisar cadastrar nada.

**`horasDisponiveisNoDia(calendario, data, nomeExecutor)`** — terceiro
parâmetro (`nomeExecutor`) é opcional, adicionado pra suportar as
Exceções de Calendário (ver seção 7): se informado, chama
`obterExcecaoAprovada(nomeExecutor, dataISO)` primeiro — se existir uma
exceção APROVADA cobrindo esse dia, o valor dela (`horas_por_dia`) vence
TUDO (padrão semanal, fim de semana, feriado), sem passar por
`ehDiaUtil()` nem pelo Calendário Semanal fixo. Só cai no comportamento
normal (padrão semanal + `ehDiaUtil()`) se não houver exceção aprovada
pra aquele dia — exceção pendente ou recusada é como se não existisse.
Chamado sem o terceiro parâmetro (nenhum código antigo precisou mudar),
o comportamento é idêntico ao de antes das exceções existirem.

**`calcularDatasPrevistasExecutor(nomeExecutor)`** é o motor de
sequenciamento original: pega todas as tarefas NÃO finalizadas desse
executor (em qualquer projeto), ordena por `tarefa.ordem_fila` (ver
abaixo), e caminha dia a dia — a partir de HOJE, OU a partir de uma
âncora manual quando a tarefa da vez tiver uma (ver
`data_inicio_manual`, mais abaixo) — pulando dias não-úteis (fim de
semana + feriado) e dias onde o Calendário Semanal do funcionário está
zerado, consumindo as horas disponíveis daquele dia contra os Pontos de
cada tarefa em sequência. Se sobra hora no dia depois de fechar uma
tarefa, a próxima já entra nele — sem sobra, avança pro próximo dia
útil. Retorna um mapa `{ caminho: "AAAA-MM-DD" }` (só a data de FIM). É
recalculado do zero toda vez que é chamado — não salva nada, sempre
reflete o estado atual (pontos, status, calendário, feriados, exceções
de calendário aprovadas e âncoras manuais de agora).

Por baixo, é só uma casca fina sobre **`calcularFilaComDatasExecutor(nomeExecutor, arvoresPreCarregadas)`**
— o núcleo de verdade, que devolve `{ caminho, dataInicio, dataFim }` de
cada tarefa da fila. O segundo parâmetro é opcional: se informado, usa
essa árvore em memória em vez de ler do `localStorage` — existe pra
permitir simular mudanças (recalcular a fila inteira) sem gravar nada de
verdade até decidir persistir (ver `fixarAncoraComEmpurrao()`, abaixo);
os chamadores normais (Kanban, Atribuição de Tarefas) nunca passam esse
segundo argumento. Há mais duas cascas sobre esse mesmo núcleo:
`calcularDatasInicioExecutor(nomeExecutor)`, só com as datas de INÍCIO
(usada pela coluna "Data de Início" na Atribuição de Tarefas — ver seção
6), e `calcularDatasInicioEFimExecutor(nomeExecutor)`, com as duas juntas
num só mapa `{ caminho: { inicio, fim } }` — é essa que o **Kanban** usa
hoje pra mostrar as duas datas no cartão (ver seção 7), rodando o núcleo
uma única vez em vez de duas.

**`fixarAncoraComEmpurrao(nomeExecutor, caminhoAlvo, novaData, todas)`**:
fixa a âncora e resolve qualquer conflito resultante empurrando (em
cascata, de forma permanente) as tarefas que estavam no caminho — ver a
explicação completa e a regra de quem vence na seção 6. Usa
`periodosSeSobrepoem()` (compara dois intervalos início-fim) e
`diaSeguinteISO()` (soma um dia calendário a uma data "AAAA-MM-DD", pra
achar onde a tarefa empurrada deve recomeçar) como auxiliares. Grava
direto na árvore `todas` recebida por parâmetro — quem chama decide
quando persistir no `localStorage` (assim dá pra empacotar a âncora
original + todos os empurrões numa única gravação).

**`tarefa.data_inicio_manual`** ("AAAA-MM-DD", opcional): âncora manual
editável na coluna "Data de Início" da Atribuição de Tarefas. Quando o
caminhamento da fila chega numa tarefa com essa data fixada, o cursor
PULA pra ela (pra frente ou pra trás, sem restrição alguma) antes de
consumir as horas dessa tarefa — e todas as tarefas seguintes da mesma
fila que NÃO tenham âncora própria simplesmente continuam a partir daí,
naturalmente. É assim que "as tarefas sequenciais se ajustam
automaticamente" quando alguém edita uma Data de Início no meio da fila.
Podem existir várias âncoras na mesma fila ao mesmo tempo — cada uma só
afeta o trecho dela em diante, não anula as outras. Data digitada num
fim de semana/feriado/dia zerado do calendário é aceita como está (o
campo não bloqueia a edição) — só na hora de CALCULAR que o motor já
resolve pro próximo dia útil a partir dali. Não interfere em
`ordem_fila`/no arrasto — são mecanismos independentes que só se
encontram dentro do mesmo caminhamento da fila.

**`tarefa.ordem_fila`** (número): carimbado em `atribuicao-tarefas.js::atribuirExecutorTarefa()`
toda vez que um executor não-vazio é escolhido, via `proximoNumeroOrdemFila()`
(contador global crescente em `banco_proximo_ordem_fila` — funciona bem
mesmo sendo global, porque só comparamos ordem DENTRO do subconjunto de
tarefas de um mesmo executor). **Também é reescrito por arrastar-e-soltar
a linha na Atribuição de Tarefas** (ver seção 6) — o arrasto renumera
TODA a fila daquele executor (todos os projetos, não só a página/filtro
visível no momento) usando o mesmo contador global, mantendo a convenção
"soltar sobre X insere antes de X". A lógica de cálculo de data em si
(`calcularFilaComDatasExecutor`) não mudou por causa do arrasto —
continua só lendo `ordem_fila` e ordenando por ele, sem saber se o valor
veio da atribuição de executor ou de um arrasto manual.

## 10. Apontamento de Horas (sessões de trabalho play/pause)

Módulo próprio (`js/apontamento.js`). Guarda um **histórico de sessões**
por tarefa (`tarefa.sessoes_trabalho`, array de `{ inicio, fim, duracao,
manual }`, timestamps ISO), não só um total acumulado — é o que permite
detectar uma sessão ESPECÍFICA fora do padrão (ex: 24h seguidas), em vez
de só perceber que o total geral parece grande.

**`tarefa.sessao_ativa_inicio`** (timestamp ISO ou ausente): marca uma
sessão em andamento. **Gravado no localStorage, não em variável JS em
memória** — de propósito, diferente do cronômetro antigo (estacionado em
`js_estacionado/timesheet_executor.js`) que perdia tudo ao recarregar a
página. Esse é o motivo de existirem dois cronômetros no histórico deste
projeto: o antigo era "ao vivo" mas frágil (fechar a aba perdia a
contagem); este é "persistente" (sobrevive a fechar o navegador, o que é
essencial pra detectar "esqueceu de pausar" horas ou dias depois).

**`tarefa.horas_reais` é DERIVADO** — sempre igual à soma das durações de
`sessoes_trabalho` (`recalcularHorasReais()`). Nunca escreva nesse campo
diretamente; edite as sessões (funções abaixo) e deixe o recálculo
atualizar o total. BI/Controladoria continuam lendo `horas_reais`
normalmente — não precisaram mudar nada.

**Regra: só uma sessão ativa por vez, no sistema inteiro.**
`iniciarSessaoTrabalho(caminho)` chama `pausarSessaoAtivaGlobal()`
primeiro — varre TODAS as árvores atrás de qualquer
`sessao_ativa_inicio`, fecha ela (grava a sessão, limpa o campo), só
depois inicia a nova. Funções principais: `iniciarSessaoTrabalho`,
`pausarSessaoTrabalho`, `adicionarSessaoManual` (correção do
administrador — ex: executor esqueceu de apertar Iniciar e trabalhou sem
cronômetro), `editarSessao`, `removerSessao`, `forcarPausaSessaoAtiva`
(encerra uma sessão travada; o administrador escolhe o horário real de
término, já que o sistema não tem como adivinhar).

**Alerta de anomalia** (`verificarAlertaApontamento()`): o limite de
horas seguidas antes de virar alerta é **o calendário da pessoa naquele
dia da semana + `APONTAMENTO_MARGEM_HORAS_ALERTA` (2h, constante no
topo do arquivo, ajustável)** — não é um número fixo igual pra todo
mundo. Verifica tanto a sessão ativa (se já rodou mais que o limite)
quanto o histórico de sessões fechadas (se alguma delas passou do limite
na época).

**Onde aparece:**
- **Kanban** (`kanban.js`): cada cartão tem Play/Pause
  (`iniciarSessaoKanban` / `pausarSessaoKanban`) e um relógio que atualiza
  sozinho a cada segundo enquanto a sessão está ativa
  (`iniciarRelogioVivoKanban()`, lê `data-inicio` do DOM — não recria a
  tabela inteira a cada tick, só atualiza o texto).
- **Atribuição de Tarefas** (`atribuicao-tarefas.js`): coluna "Horas
  Apontadas" no final da tabela — mostra o total, 🔴 se tem sessão ativa,
  ⚠️ com fundo vermelho se tem alerta. Clicar abre
  `#at-sessoes-flutuante` (mesmo padrão `position:fixed` do painel de
  filtros — os dois se fecham um ao outro se abertos ao mesmo tempo), o
  editor completo: força pausa de sessão travada, edita/remove sessões
  fechadas, adiciona sessão manual.

## 11. Schema de dados geral

| Chave | Conteúdo |
|---|---|
| `banco_clientes` | array — `nome, cnpj, logradouro, cidade, contato, whatsapp, email` |
| `banco_funcionarios` | array — `nome, cpf, nivel, cargo, hora, dt_inicio, dt_desligamento, dt_nascimento, endereco, telefone, email, senha, excecoes_calendario: [{id, data_inicio, data_fim, horas_por_dia, motivo, status}]` |
| `banco_projetos` | array — `nome, prefixo, cliente, endereco, area, pavimentos, altura, esbeltez, dificuldade, valor, pagamento, dt_inicio, analista, supervisor, detalhista, emails_responsaveis (array de {email, cargo}), status_liberacao ('em_analise'/'liberado', ausente = liberado — ver §12)` |
| `banco_etapas_lego` / `banco_setores_lego` / `banco_pavimentos_lego` | array — `nome` |
| `banco_tarefas_lego` | array — `nome, base_h, pontos, unidade_fisica` |
| `banco_arvores_projetos` | objeto, chave = projeto → `{ nome, f_esb, f_analista, etapas: [{ nome, verba_pct, setores: [{ nome, pavimentos: [{ nome, tipo_pavimento, area_fisica, peso_esforco, tarefas: [{ nome, executor, status, horas_reais (derivado), custo_max, qtd_fisica, unidade_fisica, pontos, ordem_fila, data_inicio_manual (âncora manual da fila, opcional), data_limite (Dead Line, opcional — ver §12), vezes_em_revisao (contador de retrabalho, incrementa a cada volta de "Aguardando Verificação" pra "Para revisão" — ver §7), sessao_ativa_inicio, sessoes_trabalho: [{inicio, fim, duracao, manual}], apontamentos_manuais: [{id, data, horas, motivo, status, criado_em}], ... }] }] }] }] }` |
| `banco_relatorios_visoes` | array, COMPARTILHADO (não é por usuário) — `{id, nome, fabrica (bool), nivel ('sessao'/'tarefa'), filtros, colunas (array de ids), agrupar}` (ver §8) |
| `banco_feriados_customizados` | array — `{ data: "AAAA-MM-DD", nome }` |
| `banco_proximo_ordem_fila` | número (string), contador global crescente |
| `banco_fator_coparticipacao` | string numérica |

Antes de ler ou gravar um campo novo, procure se esse campo já é usado em
outro lugar do código com nome ligeiramente diferente (ex: `cidade` vs
`city`) — já houve um bug exatamente desse tipo aqui.

## 12. Estado atual conhecido

- **⚠️ MODO TESTE SEM LOGIN ATIVO** (`MODO_TESTE_SEM_LOGIN = true` em
  `core.js`) — ver §3.1 pro detalhe completo. Lembrar de reverter antes
  de qualquer uso real/multiusuário.
- **"Rodada de Comentários da Gerência" (julho/2026) — CONCLUÍDA, exceto
  1 item grande.** 20 itens discutidos, ver bloco dedicado mais abaixo
  nesta seção (logo antes de §12.1). Implementados e testados: os 3
  bugs (1, 5, 9), os itens pequenos (4 + refinamento, 11, 20), e os
  fechados em conversa (3, 6, 7+10, 8 — sem código novo necessário, 13,
  14). **Falta só**: o Assistente de Criação Automática de Árvore
  (itens 2, 12, 15-19 fundidos), grande demais pra essa rodada,
  aguardando sessão própria antes de implementar.
- CRUD completo (incluir, editar, excluir, buscar) funcionando para:
  Clientes, Funcionários (+ Calendário Semanal), Projetos, catálogo de
  Etapas/Setores/Pavimentos/Tarefas, Árvore de Projeto, Calibração BI,
  Controladoria/Fechamento, Distribuição de Custos (5 abas completas),
  Atribuição de Tarefas, Kanban do Executor, Feriados.
- Importar/Exportar planilha (.xls) implementado pra Clientes/Funcionários/
  Projetos.
- Data Prevista calculada e exibida no Kanban (ver seção 9), com Calendário
  do Colaborador e Feriados já valendo pra valer.
- **Relatórios (tela nova, ver §8) — TESTADO E CONFIRMADO PELO USUÁRIO**
  ("parece que ficou perfeito", incluindo o cenário de reajuste salarial
  no meio de uma tarefa, o ponto mais delicado do custo por sessão) —
  motor genérico de filtro/colunas/agrupamento/visões salvas, não uma
  lista fixa. Teste feito num artifact HTML autocontido (dados de
  exemplo em memória, mesmo código real dos 3 arquivos), não direto no
  projeto — ver §8 pra esse detalhe. 5 das 7 visões de fábrica
  originalmente pensadas foram implementadas; "Tarefas em Atraso" e
  "Orçado vs. Realizado por Projeto" ficaram de fora por decisão
  explícita do usuário (precisam de colunas que o catálogo ainda não
  tem — Data Prevista de Fim por tarefa via motor de calendário, e
  verba orçada via `banco_distribuicao_custos`). Acesso Administrador/
  Analista/Supervisor, com restrição por projeto pro Analista.
- Apontamento de horas por sessão (play/pause), com correção manual e
  alerta de anomalia (ver seção 10) — funcionando no Kanban (play/pause) e
  na Atribuição de Tarefas (correção/histórico/alerta).
- **Estrutura de Projeto sempre volta pra tela "Escolha o projeto
  estrutural" ao reabrir o menu** (pedido da diretoria) —
  `alternarModulo('arvore')` agora chama `fecharProjetoAtivoNaArvore()`
  antes de `renderizerProjetosParaSelecaoArvore()`. Antes, reabrir o menu
  mantinha o último projeto aberto na tela.
- **Filtro de período (Data de Início) na Atribuição de Tarefas** (ver
  seção 6) — barra acima do cabeçalho das colunas, independente dos
  filtros estilo Excel.
- **Exceções de Calendário** (pedido da diretoria) — o executor registra
  ausência/hora extra pelo "⚙️ Meu Calendário" no Kanban (ver seção 7);
  fica pendente até ser aprovada numa tela separada, "Aprovações de
  Calendário" (nova, seção 7.1), com badge de contagem no menu. Só
  depois de aprovada o motor de Data Prevista passa a respeitá-la (ver
  seção 9, `horasDisponiveisNoDia()`).
- Priorização por arrastar-e-soltar a linha na Atribuição de Tarefas
  (ver seção 6), reescrevendo `ordem_fila`. **Exibição da tabela mudou
  nessa rodada pra ordem CRONOLÓGICA** (Data de Início efetiva, não mais
  `ordem_fila` cru) — pedido da diretoria; o arrasto em si não mudou,
  continua reescrevendo `ordem_fila` normalmente.
- **Histórico de Valor da Hora por funcionário** (pedido da diretoria,
  ver seção 4) — substituiu o campo único `funcionario.hora`. Pontos
  Máximo (Atribuição de Tarefas) e o novo `calcularCustoRealTarefa()`
  (ainda sem tela própria) usam o valor vigente na época certa, não o
  atual. Migração automática no boot pra dados antigos, e
  importar/exportar planilha ajustados (exportação mostra o valor mais
  recente; importação já migra na hora, sem esperar reload).
- **Login e Sessão** (Rodada 1 de 4 do controle de acesso — ver seção
  3.1): tela de login (CPF/nome + senha), bloqueia funcionário
  desligado, sem "lembrar" (sempre pede login de novo), botão Sair.
- **Menu por nível de acesso** (Rodada 2 de 4 — ver seção 3.1):
  Administrador vê tudo; Analista/Supervisor sem Cadastros/Feriados/BI/
  Fundo Global; Executor só Kanban.
- **Restrição por projeto** (Rodada 3 de 4 — ver seção 3.1):
  Árvore de Projeto, Distribuição de Custos e Atribuição de Tarefas só
  mostram os projetos do Analista onde ele é responsável
  (`projeto.analista`); Supervisor continua vendo todos.
- **Ajustes no Kanban** (Rodada 4 de 4, ÚLTIMA — ver seção 3.1):
  Executor logado trava no próprio nome no Kanban (sem dropdown, só um
  rótulo fixo); Admin/Analista/Supervisor mantêm o dropdown de qualquer
  executor, e o botão "Meu Calendário" vira "Calendário de [nome]"
  quando estão vendo outra pessoa. **Controle de acesso completo — as
  4 rodadas fechadas.**
- **Backup e Restauração Completa** (ver seção 3.2) — tela
  "🔒 Configurações" ganhou conteúdo de verdade (antes só chamava
  `limparWorkspace()`). Baixa/restaura TODA chave `banco_*` do
  `localStorage` de uma vez. Restauração é "ponto no tempo" (apaga o
  que não estava no backup) e restrita a Administrador — **mas também
  restaurável direto pela tela de LOGIN** (`restaurarBackupDoLogin()`),
  sem exigir login prévio, pra resolver o "ovo e galinha" de instalar
  numa máquina nova sem nenhum funcionário cadastrado ainda.
- Coluna "Data de Início" editável na Atribuição de Tarefas (ver seções 6
  e 8) — âncora manual (`tarefa.data_inicio_manual`) que reajusta
  automaticamente as tarefas seguintes da mesma fila. Pedido do usuário
  fora da sequência numerada do roadmap abaixo (não tinha sido
  combinado antes); ficou registrado aqui porque também depende do
  motor de Data Prevista.
- Contagem de horas (play) bloqueada em tarefas "Apontada" e "Aguardando
  Verificação" — só libera em "Em Desenvolvimento" em diante (ver seção 7
  e "Frente Kanban avançado", item 2, na seção 12).
- Kanban mostra Início e Fim previstos no cartão, não só o Fim (ver
  seção 7, `calcularDatasInicioEFimExecutor()`).
- Kanban mostra o caminho completo (Projeto › Localização) em cada
  cartão, e os cartões de cada coluna ficam em ordem cronológica de
  Data de Início (ver seção 7).
- **Bug real encontrado pelo usuário, corrigido:** âncora manual de Data
  de Início podia sobrepor o período de outra tarefa do mesmo executor
  (duas tarefas de projetos diferentes "roubando" hora do mesmo dia).
  Primeira solução (avisar com `confirm()`) foi descartada pelo próprio
  usuário; a versão final é `fixarAncoraComEmpurrao()` (ver seção 9):
  empurra automaticamente, em cascata, de forma permanente, qualquer
  tarefa que ficou no caminho da nova âncora — sem pedir confirmação, só
  avisa depois o que mudou.
- Status **"Pendente de Validação" renomeado pra "Para revisão"** em
  todo o código (`KB_COLUNAS`, `AT_STATUS_POSSIVEIS`, dropdown de status
  na Árvore, badge). **Migração automática no boot**
  (`core.js::migrarStatusPendenteValidacao()`, chamada no início de
  `window.onload`): qualquer tarefa já salva em `localStorage` de uma
  sessão anterior com o valor antigo é reescrita pro novo, senão ficaria
  "órfã" (sem bater com nenhuma coluna/filtro). Idempotente, só grava de
  volta se encontrar algo pra migrar. **Ainda não é uma mudança de
  fluxo** — continua sendo uma coluna livre, qualquer um que acesse o
  Kanban arrasta pra ela; o significado real ("usar quando o verificador
  identificar correções") só passa a valer de verdade quando existir um
  papel de Verificador de verdade (ver item 5 do roadmap, abaixo).
- **Executor bloqueado de mover cartão do Kanban pra "Para revisão"/
  "Finalizada"** (ver "Frente Kanban avançado", item 1, logo abaixo) —
  só quem verifica (administrador/analista/supervisor) move pra essas
  duas colunas. **A Frente Kanban avançado (5 itens) está fechada** —
  itens 1-4 testados e confirmados pelo usuário no navegador; item 5
  teve uma primeira versão (Kanban do Analista, tela própria) testada
  pelo usuário e REVERTIDA por feedback dele, substituída por um
  destaque na Atribuição de Tarefas — ver §7.2 pro histórico completo e
  item 5 em §12 pro resumo. Essa segunda versão ainda não teve
  confirmação final do usuário.
- **Distribuição de Custos agora é somente-leitura pra Analista E
  Supervisor** (achado do usuário durante o teste do item 5, não
  relacionado ao Kanban do Analista em si — ver §7.2) — só
  Administrador edita.
- **PENDÊNCIA COMBINADA COM O USUÁRIO, retomar quando o usuário pedir:**
  cronômetro só pausa automaticamente ao mudar status pelo Kanban (item
  3 da frente); `arvore.js` e `atribuicao-tarefas.js` também escrevem
  `tarefa.status` em outros lugares e não pausam. Decisão explícita: não
  mexer sem pedido novo.
- Todos os arquivos `.js` validados com `node --check` (sintaxe OK) e sem
  funções duplicadas entre si.
- ~~Bug pré-existente conhecido, não corrigido: o botão "Atualizar Diretrizes
  do Projeto" (tela de detalhes do projeto raiz na Árvore) chama
  `salvarDadosMacroProjetoRaiz()`, que nunca foi implementada em nenhum
  arquivo.~~ **CORRIGIDO** — junto do item 6 da Rodada de Comentários da
  Gerência (ver §12, bloco dedicado mais abaixo), quando o usuário
  reportou a divergência de Analista/Supervisor na mesma tela.
- **Cargo vs Nível de Acesso** (Cadastro de Funcionários): já são dois
  campos separados — `cargo` (Detalhista/Estagiário/etc, estágio de
  desenvolvimento, não muda tela nenhuma) e `nivel`
  (administrador/analista/executor/supervisor, controla o que cada um
  vê/edita). Achávamos que precisaria criar o campo `nivel` do zero
  quando isso foi combinado (ver texto antigo abaixo, mantido só por
  registro histórico) — na prática, ao começar a Rodada 1 de login
  (seção 3.1), descobrimos que ele já existia no formulário, só nunca
  tinha sido usado pra nada. Controle de acesso de verdade (restringir
  telas/dados por `nivel`) ainda não implementado — ver item 5 do
  roadmap abaixo.

**Roadmap combinado com o usuário (controle de acesso + planejamento),
nessa ordem:**
1. ~~Kanban do Executor~~ (feito — ver seção 7)
2. ~~Cadastro de Calendário do Colaborador + Cadastro de Feriados +
   cálculo de Data Prevista~~ (feito — ver seção 9). **Pendência dentro
   dessa entrega:** a ordem usada hoje pro cálculo (`tarefa.ordem_fila`)
   é "quem foi atribuído primeiro" — um substituto temporário até o item
   3 existir de verdade. O usuário comentou que o próprio Calendário do
   Colaborador pode precisar melhorar no futuro, mas não sabe ainda
   como — ficou como está por enquanto, sem pedido concreto de mudança.
3. ~~Apontamento de horas por sessão (play/pause), correção manual e
   alerta de anomalia~~ (feito — ver seção 10).
4. ~~Priorização por arrastar-e-soltar a linha na Atribuição de
   Tarefas~~ (feito — ver seção 6: fila por executor, cruza projetos,
   REESCREVE `tarefa.ordem_fila` conforme o usuário reordena, sem campo
   novo). ~~**PRÓXIMO PASSO:** campo "Dead Line" (opcional, por tarefa) —
   **bloqueia de verdade** (não deixa soltar o arrasto) qualquer
   reordenação que jogue o cumprimento dela pra depois da Data Prevista
   calculada; administrador só destrava editando/removendo o dead line
   daquela tarefa. Combinado com o usuário: sem opção de "forçar mesmo
   assim" — o bloqueio é real, não um aviso.~~ **IMPLEMENTADO** (item 14
   da Rodada de Comentários da Gerência, ver §12) — mesmo desenho
   combinado aqui, só que qualquer um com acesso à tela pode
   editar/remover o campo (não só administrador).
5. ~~Login e controle de acesso~~ (feito — todas as 4 rodadas, ver
   seção 3.1: login/sessão, esconder telas por nível, restringir por
   projeto, ajustes no Kanban).
   **Correção importante:** o campo `funcionario.nivel`
   (administrador/supervisor/analista/executor), separado de `cargo`,
   **já existia no formulário antes dessa rodada** — não era um
   pré-requisito faltando, como esse item dizia antes (erro corrigido
   aqui). Mapa de acesso completo, já fechado com o usuário:
   - **Administrador**: tudo, sem restrição.
   - **Analista**: sem acesso a Cadastros (Clientes/Funcionários/
     Projetos/Catálogo); Árvore de Projeto, Distribuição de Custos e
     Atribuição de Tarefas só nos projetos onde é o analista responsável
     (campo `projeto.analista`); Kanban com dropdown de qualquer
     executor (supervisiona); Aprovações (Calendário + Apontamento de
     Horas, mesmo item de menu, duas abas) sim; sem acesso a
     Feriados/Painel de Calibração BI/Fundo Global Fechamento.
   - **Supervisor**: igual Analista, mas SEM a restrição por projeto —
     vê todos os projetos.
   - **Executor**: só Kanban, travado no próprio nome (sem dropdown de
     escolher outro executor) — todo o resto some do menu.
   - Item de menu sem permissão simplesmente SOME (não aparece
     bloqueado com aviso).
   - Quando Admin/Analista/Supervisor olha o Kanban de outra pessoa
     (pelo dropdown), "Meu Calendário" deve virar "Calendário de
     [nome]" — ainda não construído.

**Rodada de pedidos da diretoria (julho/2026)** — lista separada do
roadmap de controle de acesso acima; o usuário mandou os 6 itens em
sequência, pedindo pra esperar ele mandar todos antes de começar a
implementar. Design de cada um já foi discutido e fechado em conversa
(registrado aqui pra não se perder entre sessões):

1. ~~Estrutura de Projeto sempre volta pra tela inicial ao reabrir o
   menu~~ (feito — ver seção 12 acima, bullet "Estrutura de Projeto
   sempre volta...").
2. ~~Filtro de período (Data de Início) na Atribuição de Tarefas~~
   (feito — ver seção 6).
3. ~~Calendário de disponibilidade no Kanban do funcionário~~ (feito —
   ver seções 7 e 7.1). Confirmado com o usuário: a lista de aprovação
   NÃO ficou dentro do Cadastro de Funcionários como eu tinha assumido
   antes — virou uma tela própria separada (Aprovações de Calendário).
4. ~~Reordenar a Atribuição de Tarefas por Data de Início, mantendo o
   arrasto~~ (feito — ver seção 6, "Priorização por arrastar-e-soltar...
   exibida em ordem CRONOLÓGICA").
5. ~~Kanban: bloquear o executor de mover cards pras 2 últimas colunas~~
   ("Para revisão" / "Finalizada") — **feito, ver "Frente Kanban
   avançado — item 1" logo abaixo.** Acabou sendo retomado numa rodada
   nova, maior, combinada com o usuário em julho/2026 (não isolado como
   o texto antigo abaixo dizia — mantido só por registro histórico).
6. ~~Histórico de valor da hora por funcionário~~ (feito — ver seção 4,
   "Histórico de Valor da Hora"). `obterDataInicioExecucaoReal()`
   acabou usando a MENOR data entre todas as sessões (não
   `sessoes_trabalho[0]`), por proteção contra sessão manual retroativa
   — pequeno ajuste em relação ao design original aqui embaixo, mas a
   ideia central se manteve igual.

**Frente "Kanban avançado" (julho/2026)** — combinada em conversa com o
usuário, 5 itens elencados de uma vez antes de começar a implementar
(mesmo padrão da rodada de diretoria acima). Ordem de implementação
definida por dependência técnica (1, 2 e 4 mexem nos mesmos pontos de
`kanban.js`/`apontamento.js`; 3 e 5 são maiores e vêm depois).
**Itens 1-4: testados manualmente pelo usuário no navegador (não só nos
testes automáticos em Node) e CONFIRMADOS — "deu tudo certo".** Item 5
foi implementado na sequência (design de cores fechado e reconfirmado
antes de começar — ver detalhe no próprio item 5, abaixo), mas **ainda
sem teste manual do usuário** — a frente inteira só pode ser
considerada fechada de verdade depois desse teste:

1. ~~Executor só pode arrastar cartão pra Apontada / Em Desenvolvimento /
   Aguardando Verificação~~ (feito). `KB_STATUS_RESTRITOS_EXECUTOR =
   ['Para revisão', 'Finalizada']` e a função pura
   `nivelPodeMoverParaStatusKanban(nivel, statusDestino)` (`kanban.js`)
   — sem nível conhecido (sem login/módulo isolado) não restringe, só
   nível `'executor'` é restrito, os demais (administrador/analista/
   supervisor) continuam livres em qualquer coluna. Bloqueio em duas
   camadas: `montarColunasKanban()` omite `ondragover`/`ondrop` da
   coluna pro Executor (o navegador já recusa o drop nativamente, sem
   sugerir uma ação que ia ser recusada) e aplica a classe CSS
   `.kb-coluna-bloqueada` (opacidade reduzida + `cursor:not-allowed`);
   `soltarCartaoKanban()` faz a checagem de verdade de novo antes de
   gravar (defesa em profundidade, mesmo padrão já usado na Restauração
   de Backup — ver §3.2). Testado isolado em Node antes de aplicar
   (14 casos, todos os níveis × todos os status restritos/livres).
2. ~~Cronômetro (contagem de tempo) também bloqueado em "Aguardando
   Verificação"~~ (feito). `APONTAMENTO_STATUS_SEM_CRONOMETRO =
   ['Apontada', 'Aguardando Verificação']` e a função pura
   `statusBloqueiaCronometro(status)` (`apontamento.js`, domínio dono da
   regra) — usada tanto pela trava real em `iniciarSessaoTrabalho()`
   quanto pela renderização do cartão em `kanban.js` (mesma fonte de
   verdade nos dois lugares; `kanban.js` já dependia direto de
   `apontamento.js` sem guarda defensiva antes disso, então não
   precisou de `typeof` extra). Mensagem no cartão diferencia os dois
   motivos ("mova pra Em Desenvolvimento" vs. "em revisão"). Testado
   isolado em Node antes de aplicar (7 casos) e reconfirmado extraído
   direto do arquivo real depois (6 casos). Sincronizado nas 3 cópias de
   `apontamento.js` (`js/`, `modulos_isolados/kanban/js/`,
   `modulos_isolados/atribuicao-tarefas/js/`) e na cópia de `kanban.js`
   em `modulos_isolados/kanban/js/`.
3. ~~Ao mudar o status da tarefa (arrastar pra outra coluna), qualquer
   cronômetro ativo dessa tarefa deve pausar automaticamente~~ (feito,
   só no Kanban por enquanto). `soltarCartaoKanban()` (`kanban.js`)
   reaproveita `pausarSessaoTrabalho(caminho)` (já existente em
   `apontamento.js`, não precisou de função nova) — como essa função
   trabalha "por caminho" (uma tarefa específica), não afeta sessão
   ativa de nenhuma OUTRA tarefa (diferente de `pausarSessaoAtivaGlobal`,
   que pausaria qualquer sessão do sistema). Só dispara se o status
   realmente mudou (soltar de volta na mesma coluna não conta). Chamada
   DEPOIS de gravar o novo status no `localStorage` — `pausarSessaoTrabalho`
   relê os dados sozinha, então precisa ver o status novo já salvo antes
   de agir. Testado isolado em Node (6 casos, só `pausarSessaoTrabalho`)
   e depois com teste de integração completo extraído dos dois arquivos
   reais juntos, simulando arrasto de verdade via
   `iniciarArrastoCartaoKanban()` (7 casos: pausa a própria tarefa,
   no-op sem sessão, não afeta sessão de outra tarefa, e convive sem
   conflito com o bloqueio do item 1). **Decisão do usuário (deixar como
   está por enquanto):** `tarefa.status` também é escrito manualmente em
   `arvore.js` (edição de componente na Árvore de Projeto) e em
   `atribuicao-tarefas.js` (ao trocar o executor de uma tarefa) —
   nenhum dos dois pausa cronômetro hoje. Caso raro (teria que ter
   sessão ativa E alguém editar o status por fora do Kanban ao mesmo
   tempo). Combinado explicitamente: **não mexer agora** — retomar
   depois que a Frente Kanban avançado inteira estiver validada com o
   usuário.
4. ~~Campo de anotação manual de horas (dia + número de horas)
   preenchível pelo próprio Executor no Kanban~~ (feito). Diferente do
   editor manual que já existe em `atribuicao-tarefas.js` (linha ~721,
   feito pelo Administrador direto, sem aprovação) — essa anotação do
   Executor fica **pendente** até alguém aprovar; só depois entra em
   `tarefa.horas_reais`. Decisões de design fechadas com o usuário antes
   de implementar (3 perguntas, ver histórico da conversa):
   - **Quem aprova:** Administrador + Analista + Supervisor — mesmo
     acesso que já existe pra `nav-aprovacoes_calendario` (não precisou
     mudar `MENU_PERMISSOES_POR_NIVEL` em `core.js`).
   - **Tela:** NÃO virou tela nova separada — o usuário preferiu juntar
     na mesma tela de "Aprovações de Calendário", agora em DUAS ABAS
     ("🗓️ Calendário" / "🕐 Apontamento de Horas"). O `id` do módulo/menu
     continua `aprovacoes_calendario` por baixo dos panos; só o texto
     visível do menu virou genérico ("🗓️ Aprovações").
   - **Restrição de status:** só é possível criar a anotação com a
     tarefa em "Em Desenvolvimento" — bloqueio REAL (não só cosmético no
     botão), mesma filosofia dos itens 1 e 2.

   **Schema novo:** `tarefa.apontamentos_manuais` = array de
   `{ id, data (YYYY-MM-DD), horas, motivo, status: pendente/aprovado/
   recusado, criado_em }`. Aprovar NÃO edita esse registro pra virar uma
   sessão — cria uma sessão nova de verdade em `sessoes_trabalho`
   (`manual: true`) via `adicionarSessaoManual()` já existente (não
   duplicou a lógica de recálculo), com horário fixo 08:00 do dia
   informado só pra ter um `inicio`/`fim` consistente (a fonte de
   verdade da duração continua sendo o campo `horas`, não a diferença
   de timestamps). Recusar só marca `status: 'recusado'` — nunca cria
   sessão, nunca entra em `horas_reais`.

   **Onde vive cada parte:**
   - `apontamento.js` (domínio): `validarNovoApontamentoManual()`,
     `criarApontamentoManual()` (bloqueio real de status),
     `listarTodosApontamentosManuais()`, `contarApontamentosManuaisPendentes()`,
     `aprovarApontamentoManual()`, `recusarApontamentoManual()`.
   - `kanban.js` (UI do cartão + modal "📝 Apontar horas", só aparece
     com a tarefa em "Em Desenvolvimento"; contador "⏳ N" no cartão
     mesmo fora desse status, pra não perder de vista uma anotação
     ainda não aprovada): `abrirModalApontamentoManualKanban()`,
     `fecharModalApontamentoManualKanban()`,
     `renderizarTabelaApontamentosManuaisKanban()`,
     `criarApontamentoManualKanban()`.
   - `aprovacoes-calendario.js` (UI da tela de aprovação — arquivo NÃO
     foi renomeado apesar de agora cobrir as duas abas, pra não
     precisar mexer no `<script src>` do `index.html`; cabeçalho do
     arquivo documenta isso): `renderizarPainelAprovacoes()`
     (orquestrador chamado por `alternarModulo()`),
     `alternarAbaAprovacoes()`, `renderizarPainelAprovacoesApontamento()`,
     `aprovarApontamentoManualNaTela()`, `recusarApontamentoManualNaTela()`.

   **Badge do menu combinado:** `atualizarBadgePendenciasCalendario()`
   foi RENOMEADA pra `atualizarBadgePendenciasAprovacoes()` — agora soma
   as duas pendências (Calendário + Apontamento) num badge só (`id`
   também renomeado, de `badge-pendencias-calendario` pra
   `badge-pendencias-aprovacoes`). Todos os pontos que chamavam a versão
   antiga foram atualizados: boot em `core.js::iniciarAppPosLogin()`,
   criação de exceção/apontamento em `kanban.js`, aprovar/recusar em
   `aprovacoes-calendario.js` (as duas abas).

   **Testes:** 17 casos isolados em Node antes de aplicar (validação,
   bloqueio real de status, pendente não conta em horas_reais, aprovação
   converte em sessão, recusa nunca conta, não deixa aprovar/recusar
   duas vezes) + 5 casos reconfirmados extraídos do arquivo real depois
   + 10 casos de integração completa (os 3 arquivos reais juntos, com
   DOM mínimo simulado por objeto em memória: abrir modal → criar →
   aprovar → badge → bloqueio real de status numa tarefa em "Aguardando
   Verificação"). `node --check` OK em todos os `.js` (real + módulos
   isolados), sem função duplicada, `<div>` balanceadas no `index.html`
   real (264/264) e no harness do módulo isolado (30/30), todos os IDs
   novos referenciados existem no HTML. Sincronizado em
   `modulos_isolados/kanban/` (`apontamento.js`, `kanban.js`,
   `aprovacoes-calendario.js`, `core.js`, `estilos.css`, `index.html` —
   modal novo adicionado ao harness) e
   `modulos_isolados/atribuicao-tarefas/js/apontamento.js`.
5. ~~Kanban do Analista~~ **TENTADO, TESTADO PELO USUÁRIO, E REVERTIDO —
   ver detalhe técnico completo em §7.2.** Primeira versão: tela nova
   separada, sem seletor, 5 colunas iguais ao Kanban do Executor, mesmas
   ações no cartão. Implementada e documentada (inclusive com toda a
   arquitetura de extração de `kanban.js` pra evitar duplicação — ver
   §7.2, essa parte da refatoração continua valendo). **O usuário testou
   e achou a tela confusa/desnecessária**: "acho que a culpa foi minha"
   (não foi — é normal a primeira versão de uma tela nova não bater com
   a expectativa até ver funcionando). Pediu pra substituir por algo bem
   mais simples:
   - **Destaque de "Aguardando Verificação" direto na Atribuição de
     Tarefas** (tela que o Analista já usa, já filtrada pelos projetos
     dele) — aviso/contador no topo + realce amarelo na linha da
     tabela, só pro Analista. Ver §7.2 pro detalhe técnico completo.
   - Durante o teste, o usuário também encontrou um bug de controle de
     acesso **não relacionado** ao Kanban do Analista: Distribuição de
     Custos nunca teve nenhuma restrição de somente-leitura — corrigido
     junto (Analista E Supervisor passam a só visualizar). Ver §7.2.

   `js/kanban-analista.js` foi APAGADO, junto com o item de menu
   (`nav-kanban_analista`), o painel (`panel-kanban_analista`), e as
   entradas em `MENU_POR_NIVEL`/`alternarModulo()` (core.js). Comentários
   órfãos em `kanban.js` que citavam "Kanban do Analista" como razão de
   existir foram corrigidos pra não confundir sessões futuras. Testes do
   Kanban do Analista movidos pra
   `/home/claude/testes/_historico_kanban_analista_removido/` (não
   apagados — só tirados da suíte ativa).

   **Isso fecha a "Frente Kanban avançado" (5/5 itens) — itens 1-4
   testados e confirmados pelo usuário; item 5 testado, e a versão
   inicial dele foi substituída pelo desenho descrito acima, que ainda
   não teve confirmação final do usuário depois da segunda rodada.**


**Rodada de Comentários da Gerência (julho/2026)** — usuário colou um
rascunho sem estrutura com 20 comentários vindos de revisão da
gerência, pra discutir item por item antes de implementar (mesmo
padrão da "rodada de pedidos da diretoria" e da "Frente Kanban
avançado" acima). Numeração abaixo segue a ORDEM ORIGINAL do rascunho
colado pelo usuário, não a ordem de execução.

*Bugs — investigados e CORRIGIDOS:*
1. ~~Cadastros (Funcionários/Clientes/Projetos): clicar num nome da
   lista abre outro registro na tela de edição, não o clicado.~~
   **CORRIGIDO.** Causa raiz confirmada: `renderizarTabelaFuncionarios/
   Clientes/Projetos()` (`cadastros.js`) ORDENA a lista alfabeticamente
   só pra exibição (`.sort(...)`), mas o `onclick` de cada linha passava
   o **índice na lista já ordenada** pra
   `carregarXParaEdicao(idx)`/`deletarX(idx)` — que, por sua vez, releem
   o array **sem ordenar** direto do `localStorage` e usam esse índice
   errado pra indexar num array em ordem diferente. Quanto mais a ordem
   alfabética divergisse da ordem de inserção, mais visivelmente errado
   ficava. **Bug irmão achado de bônus, não reportado pelo usuário**: o
   botão de excluir (🗑️) tinha exatamente o mesmo defeito — podia
   apagar o registro errado. Correção: os dois passam a identificar o
   registro pelo **nome** (mesma chave que o resto do projeto inteiro já
   usa implicitamente pra funcionário/projeto/cliente — `tarefa.executor`,
   `banco_arvores_projetos[nomeProjeto]`, etc.), não mais por posição.
   `carregarXParaEdicao(nome)` e `deletarX(nome)` relêem o array fresco e
   fazem `findIndex(item => item.nome === nome)` pra achar o índice REAL
   de gravação. Testado isolado (9 casos, reproduzindo o bug de
   propósito com ordem de inserção não-alfabética) + reconfirmado
   extraído do arquivo real (7 casos, cobrindo os 3 cadastros).
   Sincronizado em `modulos_isolados/cadastros/`.
5. ~~Cadastro de Projetos: sempre abre o primeiro projeto criado~~ —
   **era o MESMO bug do item 1**, confirmado e corrigido junto (mesma
   correção, um commit só).
9. ~~Distribuição de Custos não salva as alterações nos Pontos da
   tarefa — e o mesmo problema acontece na Atribuição de Tarefas.~~
   **CORRIGIDO — mas não era bug de código, era um problema de UX que
   enganava o usuário.** Investigação longa: testado com Playwright
   (editar+salvar, editar+navegar+voltar, editar+F5) sem conseguir
   reproduzir falha de gravação nenhuma — inclusive um falso positivo no
   meio do caminho (o próprio harness de teste re-semeava dados a cada
   F5, mascarado de "bug"; corrigido no teste, não era o app real).
   Usuário então deu o detalhe que resolveu: "quando altero o número de
   pontos na aba Atribuição de Tarefas, a mudança se reflete na
   Distribuição de Custos. Mas quando edito na Verba por Tarefa, ao sair
   e retornar, a mudança não se efetivou." **Causa raiz real**: as duas
   telas tinham comportamentos DIFERENTES pro "mesmo" campo — Atribuição
   de Tarefas salva automaticamente ao sair do campo (`onchange`, sem
   botão); "Verba por Tarefa" (Distribuição de Custos) só recalculava os
   valores exibidos ao digitar (`oninput`), e exigia um clique separado
   no botão "Salvar Pontos" — que o usuário nem sempre percebia que
   precisava clicar, porque o recálculo visual já dava a impressão de
   que tinha salvado. Usuário também reportou não achar o botão, o que
   revelou um SEGUNDO problema real (não a causa original, mas
   estruturalmente idêntico ao bug de scroll já corrigido em Relatórios
   — ver §8): `#panel-distribuicao-custos` também usa `overflow:hidden`
   sem nenhuma rota de rolagem, então o botão podia ficar inalcançável
   em telas menores/mais dados. **Correção aplicada nos dois fronts**:
   - `editarPontosVerbaPorTarefa(inputEl)` (nova, `distribuicao-custos.js`)
     substitui `salvarPontosVerbaPorTarefa()` (REMOVIDA, junto com o
     botão "Salvar Pontos" no HTML) — salva direto ao `onchange`, mesmo
     padrão de `atribuicao-tarefas.js::editarPontosTarefaAtribuicao()`.
     O `oninput="recalcularGrupoVerbaPorTarefa(this)"` continua existindo
     em paralelo, só pro recálculo visual instantâneo enquanto digita.
     Trava real de somente-leitura mantida (defesa em profundidade).
   - `#panel-distribuicao-custos { overflow-y: auto; }` (estilos.css) —
     mesma proteção do Relatórios, aplicada por precaução na tela
     inteira (todas as 5 abas têm o mesmo risco estrutural, não só
     "Verba por Tarefa").
   Testado isolado (5 casos) + reconfirmado com Playwright de ponta a
   ponta (editar sem clicar em nada, navegar pra outra tela, voltar —
   valor se mantém, botão confirmado ausente). Teste antigo
   (`teste_distribuicao_custos_trava_real.js`) que testava a função
   removida foi atualizado, não apagado. Sincronizado em
   `modulos_isolados/distribuicao-custos/` e
   `modulos_isolados/atribuicao-tarefas/` (tinha uma cópia de
   `distribuicao-custos.js` como dependência).

*Implementados:*
4. ~~Campos digitáveis pra múltiplos e-mails no Cadastro de Projetos~~
   **IMPLEMENTADO — com refinamento pedido pelo usuário logo depois.**
   `projeto.emails_responsaveis` = array de `{email, cargo}` (são os
   e-mails dos responsáveis do lado do CLIENTE, não de funcionário —
   `cargo` é a atribuição da pessoa no cliente, ex: "Engenheiro
   Responsável", **opcional**). Formato inicial era só array de strings;
   usuário pediu pra melhorar a distribuição de espaço da linha de
   inserção e incluir o campo de cargo — mudou o formato do dado antes
   de qualquer uso real em produção, sem custo de migração. Layout da
   linha: E-mail (col-5) + Cargo/Atribuição (col-5) + botão "+
   Adicionar" (col-2). Tabela: E-mail | Cargo/Atribuição | Ação.
   `renderizarTabelaEmailsResponsaveisProjeto()` é retrocompatível com o
   formato antigo (string simples) só por precaução, tratando como
   `{email: string, cargo: ''}` se encontrar. Nova seção "3. E-mails dos
   Responsáveis (lado do Cliente)" no formulário de Projetos. Mesmo
   padrão do histórico de valor da hora (Cadastro de Funcionários) —
   fica numa lista TEMPORÁRIA em memória (`projTempEmailsResponsaveis`)
   enquanto o formulário está aberto, só vira dado de verdade quando
   `salvarProjeto()` roda. Validação simples de formato (`validarEmailSimples()`, regex
   `[^\s@]+@[^\s@]+\.[^\s@]+`) e bloqueio de e-mail duplicado.
11. ~~Novo campo "Detalhista responsável" no Cadastro de Projetos.~~
    **IMPLEMENTADO.** `proj-detalhista`, mesmo padrão de dropdown que
    Analista/Supervisor (lista de `banco_funcionarios`), salvo em
    `projeto.detalhista`.
20. ~~Mover Cadastro de Feriados pro submenu Cadastros~~ **IMPLEMENTADO.**
    `nav-feriados` saiu do nível superior do menu e entrou dentro do
    submenu `#arvore-cadastro` (`escolherOpcaoCadastro('feriados')` em
    vez de `alternarModulo('feriados')` direto — mesmo padrão dos outros
    7 itens do submenu, que já recolhe o submenu depois de escolher).
    Continua Administrador-only (não mudou controle de acesso, só
    posição no menu — `nav-feriados` já só existia na lista de
    `administrador` em `MENU_POR_NIVEL`, e o próprio
    `btn-cadastro-toggle` também já era admin-only, então não há
    conflito).

   **Testes dos 3 itens juntos:** 11 casos isolados (validação de
   e-mail + adicionar/remover da lista temporária) + 12 de integração
   completa extraída do `cadastros.js` real (abrir novo projeto, dropdown
   de Detalhista populado, adicionar 2 e-mails, rejeitar e-mail
   inválido, salvar, reabrir pra edição confirmando que Detalhista e
   e-mails recarregam certinho, remover um e-mail). Sincronizado em
   `modulos_isolados/cadastros/` (JS + HTML do formulário de Projetos).

*Fechados nesta conversa (precisaram de 1+ rodada de perguntas antes de
fechar o desenho):*

6. ~~Analista/Supervisor Geral na Árvore viram só-leitura, puxando do
   Cadastro de Projetos.~~ **IMPLEMENTADO.** Causa raiz encontrada:
   existiam dois campos separados guardando a mesma informação —
   `banco_projetos[i].analista/.supervisor` (Cadastro de Projetos) E
   `banco_arvores_projetos[nome].analista/.supervisor` (mostrado na
   Árvore como "Analista Líder"/"Supervisor Geral", em
   `arvore.js::visualizarNo('projeto_raiz')`). Quando o Cadastro de
   Projetos mudava, a cópia da árvore não acompanhava — daí a
   divergência que o usuário reportou. **Correção**: os dois campos
   viraram `<input readonly>` na Árvore, lendo direto de
   `banco_projetos` a cada renderização (`projetosCadastro.find(x =>
   x.nome === projetoSelecionadoAtivo)`) — não existe mais cópia
   nenhuma pra divergir, é sempre o mesmo dado visto de dois lugares.
   As variáveis `fSup`/`fAna` (que montavam as `<option>` dos dropdowns
   removidos) também saíram, mortas. **Também corrigido junto**: o
   botão "Atualizar Diretrizes do Projeto" chamava
   `salvarDadosMacroProjetoRaiz()`, que **nunca tinha sido
   implementada** (bug pré-existente já registrado antes nesta seção) —
   agora salva de verdade os 4 campos restantes do painel (Área
   Comercial, Valor Contratado, Fator de Esbeltez, Sensibilidade
   Analista) em `banco_arvores_projetos[projeto]`, com `alert()` de
   confirmação e recarregando o painel com `visualizarNo('projeto_raiz', '')`
   pra mostrar os valores já salvos. Testado isolado (9 casos) +
   reconfirmado extraído do `arvore.js` real (9 casos, incluindo o
   cenário completo: painel mostra dado do Cadastro de Projetos → muda
   o Cadastro de Projetos → reabre a Árvore → reflete na hora, sem
   precisar salvar nada na Árvore). Sincronizado em
   `modulos_isolados/arvore/`.

3. ~~Novo status no Projeto: "Em Análise" → "Liberado pra
   Detalhamento".~~ **IMPLEMENTADO.** Motivação do usuário: "o projeto
   somente começa a ser detalhado depois que a análise é concluída" —
   tarefas de um projeto ainda em análise não aparecem na Atribuição de
   Tarefas.
   - `projeto.status_liberacao`: `'em_analise'` | `'liberado'`.
     **Ausência do campo é tratada como LIBERADO** (`core.js::projetoEstaLiberadoParaDetalhamento()`,
     `(p.status_liberacao || 'liberado') !== 'em_analise'`) — decisão
     deliberada pra não fazer projetos ANTIGOS (de antes desse recurso
     existir) sumirem da Atribuição de Tarefas do dia pra noite. Só
     projetos NOVOS nascem `'em_analise'` (`cadastros.js::salvarProjeto()`,
     só quando `i === ""`).
   - **Onde vive o controle**: não é no Cadastro de Projetos (Analista
     não tem acesso lá) — é na **Árvore de Projeto**
     (`arvore.js::alternarStatusLiberacaoProjeto()`), no painel
     "Propriedades Contratuais Macro do Projeto" (mesmo painel do item
     6) — indicador de status + botão que alterna, com `confirm()`
     antes de trocar. Analista, Supervisor e Administrador têm acesso
     lá (Executor nem chega nessa tela) — Analista já é restrito aos
     próprios projetos por `obterNomesProjetosPermitidos()`, não
     precisou de checagem extra.
   - **Editar o projeto no Cadastro de Projetos preserva o status já
     salvo** (`salvarProjeto()` copia `l[i].status_liberacao` pro
     objeto novo antes de sobrescrever) — sem isso, qualquer edição
     re-liberaria silenciosamente um projeto que alguém tinha voltado
     pra análise de propósito, já que o formulário de Cadastro não tem
     campo nenhum pra esse status.
   - **Efeito**: só ESCONDE as tarefas daquele projeto da Atribuição de
     Tarefas (`atribuicao-tarefas.js::coletarTodasTarefasDeTodosProjetos()`,
     filtro logo depois da restrição por projeto do Analista) enquanto
     "Em Análise" — a Árvore continua 100% editável livremente o tempo
     todo, sem bloqueio nenhum.

   **Testes:** 7 casos isolados (função de leitura + alternância) + 9 de
   integração completa extraída de `core.js` + `cadastros.js` +
   `arvore.js` + `atribuicao-tarefas.js` reais juntos (criar projeto →
   nasce em análise → tarefa não aparece → liberar pela Árvore → tarefa
   aparece → editar no Cadastro preserva o status → voltar pra análise
   esconde de novo → projeto ANTIGO sem o campo continua aparecendo).
   Sincronizado em `modulos_isolados/arvore/`, `.../cadastros/`,
   `.../atribuicao-tarefas/` e em todos os módulos isolados que têm
   cópia de `core.js`.

7. ~~+ 10 (os dois viraram o mesmo item durante a conversa — item 10
   acabou expandindo o item 7)~~: **IMPLEMENTADO.** Atribuição de
   executor deixou de ser função do Analista.
   - **Analista perde o acesso** de trocar/atribuir executor — dropdown
     vem `disabled` na renderização
     (`atribuicao-tarefas.js::renderizarPainelAtribuicaoTarefas()`,
     reaproveitando a variável `nivelAtualLinha` já calculada ali pro
     destaque de §7.2) + **trava real** dentro de
     `atribuirExecutorTarefa()` (retorna cedo se
     `usuarioLogado.nivel === 'analista'`, mesmo se a função for chamada
     por fora do dropdown desabilitado). Continua podendo VER a
     Atribuição de Tarefas normalmente.
   - **Supervisor e Administrador continuam podendo atribuir na
     Atribuição de Tarefas** — dropdown não saiu de lá.
   - **Novo, na aba "Verba por Tarefa" da Distribuição de Custos**: duas
     colunas — **Executor** (`<select class="vt-select-executor">`,
     editável só por Administrador/Supervisor — `podeAtribuirExecutorDistribuicaoCustos()`,
     **diferente** de `distribuicaoCustosSomenteLeitura()`: aquela
     bloqueia Analista E Supervisor pro resto da tela, esta libera o
     Supervisor especificamente pra esse campo) e **Horas Máximas**
     (calculada, não editável — `calcularHorasMaximasVerbaPorTarefa()`,
     fórmula confirmada: Verba da tarefa `÷` `valorHoraVigente()` do
     executor escolhido na data de hoje; sem executor ou sem valor de
     hora cadastrado, mostra "—" em vez de dividir por zero). Horas
     Máximas recalcula junto toda vez que os Pontos mudam
     (`recalcularGrupoVerbaPorTarefa()`, já que o Valor da tarefa muda a
     proporção).
   - **Lógica de atribuição COMPARTILHADA entre as duas telas**: extraí
     `aplicarAtribuicaoExecutorNaTarefa(tarefa, novoExecutor)`
     (atribuicao-tarefas.js) — muda `executor`, alterna status
     Sem Executor↔Apontada, carimba `ordem_fila` no final da fila do
     executor novo. `atribuicao-tarefas.js::atribuirExecutorTarefa()` e
     `distribuicao-custos.js::atribuirExecutorVerbaPorTarefa()` chamam a
     MESMA função — garante que o comportamento é sempre idêntico nos
     dois lugares, sem duplicar a lógica. Chamada com `typeof ===
     'function'` (guarda pro módulo isolado de Distribuição de Custos,
     que não carrega `atribuicao-tarefas.js` — nesse caso cai num
     fallback mínimo, só grava o executor sem fila/status).
   - **Pendência que ficou aberta é resolvida**: usuário confirmado que
     o comportamento é **IDÊNTICO** ao que já existia (opção B das 3
     apresentadas) — sem mudança nenhuma de fila/status ao atribuir pela
     Distribuição de Custos.

   **Testes:** 12 casos isolados (função compartilhada de atribuição +
   controle de acesso) + 5 de Horas Máximas + 13 de integração completa
   extraída de `core.js` + `feriados.js` + `apontamento.js` +
   `distribuicao-custos.js` + `atribuicao-tarefas.js` reais juntos
   (Analista bloqueado nas duas telas, Supervisor/Administrador liberados
   nas duas, comportamento de fila/status idêntico confirmado, fórmula
   de Horas Máximas confirmada). Sincronizado em
   `modulos_isolados/atribuicao-tarefas/` (JS dos dois arquivos) e
   `modulos_isolados/distribuicao-custos/` (JS + cabeçalho da tabela no
   HTML).

   **Adendo (julho/2026) — ajuste de layout pedido depois de testar:**
   a coluna Executor da "Verba por Tarefa" cortava nomes completos
   (largura fixa de 160px, com Pavimento/Tarefa também competindo por
   espaço fixo). Causa raiz: `table { width:100% }` (regra global,
   `estilos.css`) força QUALQUER tabela a caber exatamente no espaço do
   `.table-wrapper`, então aumentar uma coluna só espremia as outras —
   nunca resolvia de verdade quando o nome era muito longo. Corrigido
   com uma regra CSS específica só pra essa tabela
   (`#conteudo-verba-por-tarefa table { width:auto; min-width:100%; }`)
   — agora ela usa a largura que precisa de verdade (rolando
   horizontalmente via `.table-wrapper { overflow-x:auto }`, adicionado
   globalmente, inofensivo quando não precisa) em vez de forçar tudo a
   caber num espaço fixo. Removido também o `width:100%` do próprio
   `<select class="vt-select-executor">` (virou `min-width:160px`) —
   com `width:100%`, o navegador não conseguia usar o tamanho natural
   do texto da opção selecionada pra calcular a largura da coluna,
   travando num círculo (coluna dependia do select, select dependia da
   coluna). Cabeçalhos de Pavimento/Tarefa voltaram a ser automáticos
   (larguras fixas de 140px/220px, que eu tinha colocado numa tentativa
   anterior que não resolveu o problema, saíram). Confirmado com
   Playwright: nome de 38 caracteres ("Fernanda Cristina de Albuquerque
   Lima") agora cabe com folga (328px disponíveis pra 230px
   necessários), sem cortar.

8. ~~Data de Início sugerida ao escolher o executor.~~ **JÁ SATISFEITO
   PELO COMPORTAMENTO EXISTENTE — sem código novo necessário.**
   Investigação confirmou (5 casos de teste, extraídos dos arquivos
   reais) que o comportamento pedido já acontecia naturalmente: uma
   tarefa recém-atribuída entra no FINAL da fila do executor
   (`ordem_fila`), a Data de Início calculada pelo motor já é, por
   construção, a primeira data livre depois de tudo que já está na fila
   dele (não "hoje" ingenuamente — testado com uma tarefa já ocupando os
   próximos dias, confirmando que a nova entra DEPOIS), NÃO grava
   `data_inicio_manual` (fica dinâmica, como pedido), e a tela já
   re-renderiza com o valor calculado imediatamente após atribuir
   (`atribuirExecutorTarefa()` já chama
   `renderizarPainelAtribuicaoTarefas(true)` no final, que recalcula
   `mapaDatasInicioPorExecutor` do zero a cada render). Confirmado que
   vale nos DOIS caminhos de atribuição agora existentes (Atribuição de
   Tarefas e Distribuição de Custos, item 7+10) — testado atribuindo
   pelos dois lugares.

13. ~~Semáforo de prioridade ao lado da Data de Início.~~
    **IMPLEMENTADO, com uma 4ª cor adicionada logo depois.** Aparece
    nos DOIS lugares: Atribuição de Tarefas (coluna Data de Início) e
    Kanban (cartão, que também mostra a Data de Início). Faixas
    confirmadas: ⚫ **preto = Data de Início já VENCIDA** (a tarefa devia
    ter começado e ainda não começou — extensão pedida pelo usuário
    numa mensagem separada, depois de testar a versão original; ele
    tinha notado "precisaremos escolher um sinal pras tarefas com a data
    vencida" e sugeriu preto); 🔴 vermelho = ≤2 dias até a Data de
    Início; 🟡 amarelo = 3 a 7 dias; 🟢 verde = 8+ dias. **Esse "preto"
    é DIFERENTE do indicador de atraso já existente** (borda vermelha
    do cartão do Kanban, `corBordaCartaoKanban`/§7.2, que olha a Data de
    FIM vencida) — um é sobre a tarefa ainda não ter COMEÇADO no prazo,
    o outro é sobre não ter TERMINADO no prazo; os dois podem estar
    ativos ao mesmo tempo numa mesma tarefa (não são mutuamente
    exclusivos, são indicadores independentes olhando datas diferentes).
    - `feriados.js::corSemaforoPrioridade(dataInicioISO, hojeISO)` —
      função pura, devolve `'preto'/'vermelho'/'amarelo'/'verde'/null`
      (`null` = sem data calculável, único caso fora de escopo agora).
      Colocada em `feriados.js` por ser dependência JÁ EXISTENTE dos
      dois módulos isolados que precisavam dela (Kanban e Atribuição de
      Tarefas) — não precisou adicionar nenhum arquivo novo como
      dependência.
    - `feriados.js::renderizarBolinhaSemaforoPrioridade()` — monta o
      HTML da bolinha colorida (`#000000` pro preto; as outras 3 já
      reaproveitavam cores usadas em outros pontos do sistema —
      vermelho de atraso, amarelo de "Em Análise", verde de
      "Liberado"). `null` não desenha nada.
    - `atribuicao-tarefas.js`: `hojeISO` calculado uma vez por
      renderização, bolinha inserida antes do `<input type="date">` da
      célula.
    - `kanban.js`: precisou de um campo novo, `t.dataInicioPrevista`
      (data ISO CRUA — já existia `t.dataInicioExibicao`, mas só a
      versão já formatada "DD/MM", que não dá pra comparar contra
      `hojeISO`). Bolinha inserida antes do "🏁" na linha de data do
      cartão.
    - **Testes:** 12 casos isolados (função de cor, incluindo a faixa
      preta nova) + 3 reconfirmados no arquivo real + 5 de integração
      completa extraída de `feriados.js` + `atribuicao-tarefas.js` +
      `kanban.js` reais juntos (bolinha aparece nos dois lugares, cor
      correta, tarefa sem
      executor não mostra nada). Sincronizado em `modulos_isolados/kanban/`
      e `.../atribuicao-tarefas/` (ambos já tinham `feriados.js` como
      dependência).

14. ~~Coluna com Data Limite da tarefa (quando existir), bloqueando
    postergação sem que o Analista a altere~~ — **IMPLEMENTADO, com
    correção de acesso logo depois.** Já estava registrado como próximo
    passo pendente antes desta rodada (ver histórico mais abaixo nesta
    mesma seção 12); a gerência só reforçou o mesmo pedido, sem mudança
    de desenho na parte do bloqueio de arrasto.
    - Novo campo `tarefa.data_limite` (ISO, opcional) — nova coluna
      "Data Limite" na Atribuição de Tarefas, logo depois de "Data de
      Início".
    - **CORREÇÃO (julho/2026): editável só por Supervisor ou
      Administrador — Analista NÃO edita mais.** Na implementação
      original, tinha ficado editável por qualquer um com acesso à tela
      (inclusive Analista), interpretando a frase "sem que o Analista a
      altere" como "o Analista PODE alterar". O próprio usuário corrigiu
      isso depois, de forma explícita: "A data limite só pode ser
      editada pelo supervisor ou administrador". `atribuicao-tarefas.js::podeEditarDataLimite()`
      (nova) — Administrador/Supervisor sim, Analista não, sem login
      (módulo isolado) fica aberto. Usada em dois lugares: trava REAL
      dentro de `editarDataLimiteTarefa()` (retorna cedo se não tiver
      permissão) e o `<input>` da célula vem com `disabled` pra quem não
      pode, na renderização.
    - `atribuicao-tarefas.js::encontrarViolacaoDataLimite(filaComDatas, todasArvores)`
      — função pura: olha uma fila já calculada (com Data de Fim por
      tarefa) e retorna a primeira tarefa com Data Limite que terminaria
      DEPOIS do prazo, ou `null`. Terminar EXATAMENTE no dia do prazo
      não é violação.
    - `reordenarFilaExecutorNaArvore()` agora SIMULA a nova ordem numa
      CÓPIA da árvore (`JSON.parse(JSON.stringify(todas))`) antes de
      gravar de verdade — chama `calcularFilaComDatasExecutor()`
      (feriados.js) na cópia simulada, checa violação, e só grava a
      reordenação de verdade (no array `todas` real) se não houver
      nenhuma. **Bloqueio real, sem opção de "forçar mesmo assim"** —
      combinado com o usuário — `alert()` explica qual tarefa violaria
      e qual é o prazo dela.
    - **Testes:** 6 casos isolados (função de detecção de violação,
      incluindo o caso-limite de terminar exatamente no prazo) + 4
      isolados da trava de acesso (`teste_data_limite_trava_supervisor_admin.js`)
      + 6 de integração completa extraída dos arquivos reais (reordenação que
      estoura o prazo é bloqueada de verdade, sem gravar nada; remover o
      prazo depois do bloqueio funciona; a mesma reordenação sem prazo
      passa a ser aplicada normalmente; definir prazo novo funciona).
      Sincronizado em `modulos_isolados/atribuicao-tarefas/` (JS +
      cabeçalho da tabela no HTML).

**Lista de Projetos (Cadastros) — 3 ajustes pontuais, implementados.**
Pedido do usuário, tela `panel-projetos-lista`: (1) título da aba
(`#page-context-title`, setado em `core.js::alternarModulo()`) trocado
de "Gestão de Projetos" pra **"LISTA DE PROJETOS"**; (2) a tabela ganhou
2 colunas novas, **Analista** e **Supervisor** (`proj.analista` /
`proj.supervisor`, campos que já existiam no schema do Projeto, só não
apareciam na listagem — só exibição, nada novo sendo gravado); (3) a
coluna **Valor Contrato** foi retirada da mesma tabela (o campo
`proj.valor` continua existindo no schema/formulário normalmente, é
usado em outras telas como Distribuição de Custos — só saiu da
visualização desta lista). Mudança em `js/core.js`
(`alternarModulo`), `index.html` (cabeçalho da tabela) e
`js/cadastros.js` (`renderizarTabelaProjetos()`), sincronizado em
`modulos_isolados/cadastros/` (os mesmos 3 arquivos lá dentro).
Validado com `node --check` em todos os `.js` do projeto (sem
regressão) e contagem de colunas cabeçalho×linha (6×6) nos dois
lugares (app principal e módulo isolado).

*Registrado, aguardando sessão própria — grande demais pra essa rodada,
NÃO IMPLEMENTAR sem retomar a conversa primeiro (itens 2, 12, 15, 16,
17, 18 e 19 do rascunho original, todos fundidos num só recurso depois
de descobrir que descreviam a mesma coisa por ângulos diferentes):*

**Assistente de Criação Automática de Árvore.** Motivação: a maioria
dos projetos repete a mesma Etapa/Setor/Pavimentos/Tarefas — montar a
árvore do zero toda vez é trabalho repetitivo. Fluxo descrito pelo
usuário, na Estrutura de Projeto, ao criar uma árvore nova:
1. Setor pré-preenchido como **"Único"**, editável (pode trocar por
   outro do catálogo).
2. Lista de TODOS os pavimentos cadastrados no catálogo, com caixas de
   seleção — usuário descreveu como "estilo filtro do Excel" (um
   componente de lista com checkbox por item, permitindo marcar vários
   de uma vez — não é um select HTML comum). Botão "Continuar".
3. Nova aba mostra só os pavimentos marcados, cada um com 2 campos
   novos: **Área** e **Repetições** (repetições = quantas vezes esse
   pavimento se repete, tipo "10 andares idênticos" — esse mesmo campo
   novo também precisa aparecer na Árvore depois como "(x10)" ao lado
   do nome do pavimento, item 12 do rascunho original, confirmado que é
   parte do mesmo recurso, não item isolado). Botão "Concluir".
4. Sistema monta a árvore inteira sozinho a partir dessas escolhas.

Separadamente, mas alimentando o mesmo fluxo: **no Cadastro de
Pavimentos** (catálogo, não a árvore de um projeto específico), ao
criar/editar um TIPO de pavimento, o administrador também define uma
lista de **tarefas padrão** pra esse tipo — quando esse pavimento for
escolhido no assistente acima, essas tarefas já entram automaticamente
na árvore nova, mas continuam 100% editáveis depois (tirar, adicionar,
mudar sem restrição).

Usuário validou esse resumo consolidado como fiel ao que a gerência
pediu, mas disse explicitamente "talvez tenhamos que conversar mais
sobre estes detalhes depois" — ou seja, o desenho de ALTO NÍVEL está
fechado, mas faltam decisões de detalhe (ex: nome exato do componente
de seleção múltipla, o que acontece se o usuário editar/apagar uma
tarefa padrão depois de já ter sido copiada pra uma árvore — isso
edita só aquela instância ou o padrão do catálogo também?, etc.) antes
de poder implementar com confiança.


## 12.1. Produtividade e Distribuição de Lucro (design fechado, NÃO implementado)

Conversa longa e detalhada com o usuário sobre como medir produtividade
de forma justa e usar isso pra distribuir lucro no fim do ano. **Nada
disso foi implementado em código ainda** — é só o desenho, mas já
bastante amadurecido e fechado. Registrado aqui com fidelidade porque a
conversa foi rica em nuances que se perderiam num resumo mais curto.

**1. Como calibrar os Pontos de uma tarefa** — o "tempo razoável"
esperado pra executar. Sempre uma **sugestão**, nunca automático: o
Analista/quem estiver cadastrando a tarefa vê a sugestão calculada e
decide se usa ou não.
- Baseado em **mediana/percentil dos casos bem-sucedidos** (não média
  simples — média deixa outliers tipo "cliente mudou o projeto no
  meio" puxar o número pra cima; percentil mais baixo, tipo 25º-30º,
  das execuções que passaram sem retrabalho, reflete "o tempo que os
  bons desempenhos historicamente levaram", não a média de todo mundo).
- Recalibração periódica (ex: trimestral), não um número fixo pra
  sempre — conforme mais dados reais entram no sistema.
- **Fator de ajuste por Cargo**: em vez de manter distribuições de dados
  totalmente separadas por Cargo (exigiria massa de dados grande demais
  pra cada combinação tarefa×cargo), usa um **multiplicador único por
  Cargo**, calibrado sobre o conjunto AMPLO de tarefas — não tarefa por
  tarefa. O multiplicador é a **razão entre a média do valor da hora**
  dos cargos (ex: Detalhista custa 2× o Estagiário → o Estagiário
  "recebe" o dobro do tempo esperado). Efeito colateral elegante,
  identificado na conversa: como o fator de ajuste é a mesma razão do
  custo/hora, **o custo de uma tarefa pra empresa fica igual não importa
  quem a execute** (supondo cada um no ritmo esperado do próprio
  cargo) — o índice de produtividade fica limpo, sem misturar "diferença
  de custo entre cargos" com "desvio da pessoa em relação à própria
  expectativa".
- Multiplicadores são **N fatores relativos a uma referência** (não
  pares avulsos) — se entrar um cargo novo (Sênior, Coordenador etc.),
  ele ganha seu próprio fator relativo ao mesmo cargo de referência
  (provavelmente Detalhista), não um par isolado por combinação.
- Ressalva registrada: o fator assume que diferença salarial reflete
  fielmente diferença de velocidade — na prática salário também carrega
  antiguidade, poder de negociação, responsabilidades além da execução
  pura. Não é motivo pra não usar (é o melhor proxy disponível, o dado
  já existe no sistema), só vale reavaliar esse fator junto da
  recalibração periódica dos pontos, não travar como constante.
- Bônus identificado: com massa de dados suficiente, dá pra comparar o
  multiplicador "previsto pelo salário" contra o "observado na
  prática" — se um Estagiário está executando quase tão rápido quanto
  um Detalhista, é sinal gerencial valioso (reconhecimento? recalibração
  salarial?), não só um número de produtividade.

**2. Índice de produtividade** (usado pra um RANKING de competição
saudável entre colaboradores) — **taxa, não soma**: `pontos / horas
trabalhadas`, comparado contra a expectativa do PRÓPRIO Cargo da pessoa
(não uma régua única pra todo mundo). É neutro a quem trabalha mais ou
menos horas por semana (agenda própria de cada um) — o ponto central da
conversa foi justamente que **qualquer coisa somada ao longo do tempo
favorece quem trabalha mais horas**, mesmo com eficiência igual; só uma
razão/taxa fica neutra a volume. Ressalvas registradas: (a) amostra
pequena pode distorcer o ranking (quem fez só 2 tarefas e acertou por
sorte aparece artificialmente no topo) — vale um volume mínimo de
tarefas/horas no período pra entrar no ranking; (b) ranking de
eficiência pura pode incentivar "só pegar tarefa fácil" — uma saída é
ter rankings separados (eficiência E volume/contribuição), ou pesar
volume como critério de desempate.

**3. Índice de retrabalho** — também uma **taxa**: soma de
`tarefa.vezes_em_revisao` (contador NOVO, ainda não existe no schema)
de todas as tarefas finalizadas do colaborador, dividido pelo total de
tarefas finalizadas por ele. **Por que contador e não binário
(sim/não)**: um colaborador que erra a MESMA tarefa 4 vezes deveria
pesar mais que um que erra 4 tarefas diferentes uma vez cada — um
binário "passou por revisão alguma vez" não diferencia esses dois
casos, a soma do contador sim. Regra de incremento: `vezes_em_revisao`
só sobe quando a tarefa ENTRA em "Para revisão" **vindo de outro
status** — arrastar o cartão dentro da mesma coluna (ou qualquer
manipulação que não seja uma transição de verdade) não conta. Nunca
"reseta", mesmo depois de corrigida e finalizada — fica gravado pra
sempre naquela tarefa. **Já implementado, e relevante aqui**: "Para
revisão" no Kanban (ver seção 6) já é, por construção, SEMPRE erro do
executor — correção a pedido do cliente vira uma tarefa NOVA na árvore
do projeto, nunca reabre a existente. Isso significa que o contador de
retrabalho, quando for implementado, não vai ter ruído de motivo alheio
misturado — o status já filtra isso na origem.

**4. Saldo de contribuição** (o que efetivamente vira dinheiro na
distribuição de lucro — DIFERENTE do índice de produtividade do
ranking, que é só competição saudável): por tarefa finalizada,
`saldo = (pontos − horas_reais) × valor_hora_da_pessoa` (usar
`valorHoraVigente()`, já existe — ver seção 4). Soma ao longo do
período/ano, **positivo e negativo livres, sem piso em zero por
tarefa** — decisão explícita do usuário: um saldo negativo é
diagnóstico tanto quanto premiação, mostra quem não está cobrindo o
próprio custo E pode apontar deficiência no fluxo de trabalho (má
distribuição de tarefas, não necessariamente culpa da pessoa). Saldo
negativo consistente deve ser **destacado visualmente** pro
Analista/Administrador (um alerta, não só um número que alguém precisa
ir procurar) — ainda não decidido ONDE exatamente esse destaque
aparece.

**5. Distribuição final** — combina uma fatia **igualitária** (todos os
executores participam, mesmo quem teve saldo negativo no período) com
uma fatia **proporcional** ao saldo de cada um. A proporção entre as
duas fatias **não é fixa** — decidida pela administração a cada
apuração/distribuição, caso a caso.

**Nada disso tem estrutura de dados ainda** — nem `vezes_em_revisao` no
schema de tarefa (seção 11), nem telas, nem cálculos. Se for retomar,
o ponto de partida mais simples e isolado é o contador
`vezes_em_revisao` (é só um campo novo + um incremento no lugar certo
do fluxo do Kanban), os índices/saldo vêm depois, já com dado real pra
calibrar em cima.

## 12.2. Etapa "única" (Etapa sem Setor/Pavimento) — PARCIALMENTE implementado

Motivação do usuário: algumas Etapas não têm Setor nem Pavimento de
verdade — ex: "Análise" não é feita por pavimento, a Etapa inteira é,
na prática, uma única Tarefa. Forçar o cadastro de Setor/Pavimento só
pra existir um "lugar" pra pendurar a Tarefa é artificial. Terminologia
final (trocada de "física/direta" por decisão do usuário):
**`subdividida`** (era "física") e **`unica`** (era "direta").

**Implementado nesta rodada (Cadastro de Etapas + Árvore):**
- `catalogo-lego.js` / Cadastro de Etapas: campo novo `etapa.tipo`
  (`'subdividida'` padrão ou `'unica'`), escolhido ao cadastrar e
  editável depois (`salvarEdicaoEtapaCatalogo`, só o tipo — nome
  continua sem edição, mesma regra de sempre). Etapa sem `tipo` salvo
  (dado antigo) é tratada como `'subdividida'` — sem necessidade de
  migração.
- `arvore.js::abrirFormEncaixe('etapa', ...)`: o formulário de encaixe
  lê o tipo da Etapa selecionada no catálogo (`atualizarFormularioEncaixeEtapa()`)
  e mostra os campos certos: `subdividida` pede só Responsável (como
  sempre); `unica` pede Executor + Custo Máximo + Pontos da Tarefa
  única, que é criada **junto**, no mesmo passo.
- `arvore.js::salvarPecaNaArvore()`: Etapa `unica` vira
  `{ nome, tipo:'unica', tarefas:[{...}] }` — sem `setores`. Etapa
  `subdividida` continua `{ nome, tipo:'subdividida', responsavel, setores:[] }`.
- `arvore.js::carregarArvoreProjetoAtual()`: Etapa `unica` renderiza
  sua Tarefa direto embaixo dela (mesmo visual de card das Tarefas de
  Pavimento), sem botão "+ Set" (mostra só a marcação "(única)" do
  lado do nome). Path da Tarefa nesse caso tem 2 posições
  (`fIdx-tIdx`, ex: `"0-0"`) em vez das 4 de sempre (`fIdx-eIdx-sIdx-tIdx`)
  — `visualizarNo`, `salvarAlteracoesNo` e `removerNo` checam
  `path.split('-').length` pra saber qual formato usar.
- **`%` decorativo removido de vez, das duas** (`etapa.verba_pct`,
  campo "Peso Orçamentário da Etapa (%)" no encaixe e o `(10%)` que
  aparecia do lado do nome na árvore) — nunca alimentou cálculo real,
  só confundia.
- **Cálculo de outlier na finalização de Tarefa** (`k_real_calculado`/
  `is_outlier` em `salvarAlteracoesNo`) depende de `peso_esforco` do
  Pavimento — **não roda** pra Tarefa de Etapa `unica` (não existe
  Pavimento pra calibrar contra). Fica sem outlier detection por ora.
- **Desencaixar bloqueado** pra Tarefa de Etapa `unica` (regra: sempre
  exatamente 1 Tarefa) — pra remover, precisa desencaixar a Etapa
  inteira.
- Sincronizado em `modulos_isolados/catalogo/` e `modulos_isolados/arvore/`.
  Validado: `node --check` em todos os `.js`, balanceamento de tags do
  `index.html`, e checagem automática de que toda função chamada em
  `onclick`/`onchange` existe em algum arquivo.

**AINDA NÃO implementado — pendência real, não é só detalhe:**
Kanban do Executor, Atribuição de Tarefas, Apontamento de Horas, BI
(calibração) e Relatórios **ainda não sabem procurar Tarefa direto
numa Etapa** — todos percorrem `etapa.setores→pavimentos→tarefas`
sem checar `etapa.tipo === 'unica'`. Na prática, hoje, uma Tarefa de
Etapa `unica` **existe e é editável só dentro da Árvore** — não
aparece pra ninguém apontar horas, não entra na fila de atribuição,
não aparece no Kanban do executor designado, não entra na calibração
de BI nem nos Relatórios. Cada uma dessas 5 telas precisa de uma
rodada própria (arquivo por vez) pra reconhecer esse tipo de nó antes
de a feature ficar utilizável de ponta a ponta. Lista de arquivos que
precisam da mesma checagem, em ordem sugerida de prioridade (Kanban e
Atribuição de Tarefas primeiro — são os que tornam a Tarefa "trabalhável"
de verdade):
`atribuicao-tarefas.js` (linhas ~159, ~344), `kanban.js` (linhas
~151, ~262, ~307), `apontamento.js` (linhas ~59, ~296), `bi.js`
(linhas ~17-23, ~79-85), `relatorios.js` (linhas ~75, ~127) — todas
fazem `etapa.setores.forEach(...).pavimentos.forEach(...).tarefas.forEach(...)`
sem branch pra `etapa.tipo === 'unica'`.

Também não generalizado ainda: `buscarPctDetalhamentoEAviso()`
(`distribuicao-custos.js`) continua achando a Etapa "Detalhamento"
pelo nome literal (`.includes('detalhamento')`), não por
`etapa.tipo`. Não quebra nada (Etapa `unica` simplesmente não
participa dessa busca), mas o mecanismo de verba por `%` pra Etapa
`unica` (usar a mesma aba Distribuição de Custos → Analista) ainda
não foi conectado a nada de fato — a aba já mostra o `%` por Etapa
(não é novidade), só falta decidir se/como isso vira um teto visível
na Tarefa da Etapa `unica`, quando as telas acima forem adaptadas.

**Cadastro de Funcionários — bug corrigido: coluna "Valor/Hora" mostrava
Nível.** `renderizarTabelaFuncionarios()` (`cadastros.js`) montava a
célula da coluna "Valor/Hora" com `func.nivel` — resíduo de quando essa
coluna se chamava "Nível" e foi renomeada sem atualizar a linha (mesmo
padrão de bug do §2). Corrigido: a coluna agora mostra o valor vigente
HOJE (`valorHoraVigente()`, feriados.js — lookup no histórico, mesmo
dado usado em Pontos Máximo e custo real de tarefa em todo o resto do
sistema). Coluna **Nível** nova, de verdade, adicionada ao lado (antes
não existia visualmente, só o dado incorreto ocupando o lugar errado).
Sincronizado em `modulos_isolados/cadastros/` (com guarda defensiva
`typeof valorHoraVigente === 'function'`, já que esse módulo isolado
não carrega `feriados.js` — mostra R$ 0,00 nesse contexto, fallback
visível de propósito). Validado: `node --check`, colunas cabeçalho×linha
(6×6), toda função chamada em onclick/onchange existe.

**Melhorias #5 a #12 — REGISTRADAS, aguardando implementação em bloco
(pedido explícito do usuário: "vai guardando a informação para
implantarmos mais tarde").** Nenhuma das oito foi implementada ainda.

- **#5 — Tarefa de Etapa Única, executor padrão.** Ao criar a Tarefa
  automática de uma Etapa `unica` (ver §12.2), o executor não é mais
  escolha livre no formulário de encaixe — vem por padrão como o
  **Analista do projeto** (`projeto.analista`). Pode ser alterado
  depois, mas só pelo **Administrador** (`usuarioLogado.nivel ===
  'administrador'`, mesmo padrão de `podeAtribuirExecutorDistribuicaoCustos()`),
  em 2 lugares: Cadastro de Projetos (campo novo a definir onde) e
  Estrutura de Projeto/Árvore (`edit-t-exec` em `visualizarNo`, hoje
  livre pra qualquer nível). Fora desses 2 lugares (ex: aba Verba por
  Tarefa), o executor dessa Tarefa fica só-leitura pra todo mundo.
- **#6 — Distribuição de Custos, aba Verba por Tarefa: recolher/expandir
  grupos.** `carregarAbaVerbaPorTarefa()` agrupa Tarefas por Pavimento
  (borda + subtotal) mas sempre tudo expandido — adicionar controle de
  recolher/expandir por grupo, mesmo padrão visual (▼/►) já usado na
  Árvore (`alternarRecolhimentoNo`).
- **#7 — Kanban: pré-seleção do executor.** Pra nível `executor`, já
  funciona (trava no próprio nome). Falta pra Administrador/Analista/
  Supervisor: `carregarPainelKanban()` deveria pré-selecionar o próprio
  nome do usuário logado no dropdown (`kb-executor`) ao abrir a tela,
  continuando editável/trocável.
- **#8 — Login: Executor vai direto pro próprio Kanban.** Em
  `tentarLogin()` (e o boot do `MODO_TESTE_SEM_LOGIN`), se
  `usuarioLogado.nivel === 'executor'`, chamar `alternarModulo('kanban')`
  automaticamente em vez de cair na tela em branco.
- **#9 — Kanban: mover cartão sem permissão não mostra aviso.**
  `moverTarefaParaStatus()` retorna `{alertar:true, erro:'...'}` quando
  é falta de permissão, e `soltarCartaoKanban()` hoje mostra esse
  `alert()`. Deve ficar silencioso (cartão só não se move). O outro
  `alert()` do arquivo, em `iniciarSessaoKanban()` (status incompatível
  com cronômetro, não é permissão), continua como está — não foi pedido
  pra tirar esse.
- **#10 — Kanban: tarefa "Aguardando Verificação" aparece como
  "Apontada" pro Revisor** (reformulado pelo usuário — versão final).
  Quando o Executor move a tarefa pra "Aguardando Verificação", ela já
  aparece no Kanban de quem revisa (`coletarTarefasParaRevisar()`, já
  implementado) — mas em vez de cair na coluna "Aguardando Verificação"
  como hoje, deve aparecer na coluna **"Apontada"** pro revisor, pra ele
  poder "Iniciar" o cronômetro e as horas de revisão somarem no MESMO
  `tarefa.horas_reais` da execução (um total só). O status real
  (`tarefa.status`) continua `"Aguardando Verificação"` até o revisor
  decidir — só a coluna de exibição pro revisor muda. Duas travas a
  ajustar na implementação: `statusBloqueiaCronometro()` bloqueia
  cronômetro em "Aguardando Verificação" (precisa abrir exceção pro
  revisor) e `podeMoverCartaoKanban()` não deixa quem não é o executor
  "iniciar" a tarefa (precisa de exceção equivalente). Além disso: **a
  coluna "Para revisão" não aparece no Kanban de nível `executor`**
  (`montarColunasKanban()` hoje é igual pra todos — `KB_COLUNAS` teria
  que ser filtrado por nível); uma tarefa com status `"Para revisão"`
  vista pelo próprio Executor dela cai visualmente na coluna "Apontada"
  (`carregarKanbanExecutor()` hoje faz match 1:1 `t.status === col.status`,
  precisa de regra especial pra esse caso).
- **#11 — Landing pós-login/troca de usuário: lista de projetos**
  (estilo Árvore). Em vez da tela em branco "Aguardando Ação"
  (`panel-blank-state`), `tentarLogin()` (e a troca de identidade do
  `MODO_TESTE_SEM_LOGIN`) chamam `alternarModulo('arvore')` — que já
  mostra a lista de projetos permitidos ao usuário
  (`renderizerProjetosParaSelecaoArvore()`). Só pra quem não é nível
  `executor` (esse já vai direto pro Kanban, item #8).
- **#12 — Distribuição de Custos: portal de seleção vira lista, não
  dropdown.** Hoje `dc-portal-selecao-projeto` usa um `<select
  id="dc-portal-projeto-select">`. Trocar pelo mesmo padrão da tela
  "Escolha o projeto" da Árvore: tabela clicável com busca
  (`tabela-projetos-arvore-body` + `filtrarTabelaProjetosArvore()` como
  referência), reaproveitando a lista de projetos já filtrada por
  permissão que `carregarPainelDistribuicaoCustos()` já calcula.

## 12.3. Melhorias #6 a #16 — IMPLEMENTADAS nesta rodada

Implementadas em blocos (A: `core.js`+`kanban.js`; B e C e D:
`distribuicao-custos.js`+`catalogo-lego.js`+`index.html`), cada uma
sincronizada em TODOS os módulos isolados relevantes. Validado:
`node --check` em todo `.js` do projeto (principal + isolados),
balanceamento de tags, e toda função chamada em
onclick/onchange/oninput existe.

- **#7 e #8 e #11** — `core.js::abrirTelaInicialPorNivel()` (função
  nova), chamada em `tentarLogin()` e no boot do
  `MODO_TESTE_SEM_LOGIN`: nível `executor` vai direto pro Kanban
  (`alternarModulo('kanban')`); qualquer outro nível vai direto pra
  Árvore de Projeto (`alternarModulo('arvore')`, já mostra a lista de
  projetos permitidos), em vez da tela em branco "Aguardando Ação".
  `kanban.js::carregarPainelKanban()` também passou a pré-selecionar o
  próprio nome do usuário logado no dropdown de executor, pra quem não
  é nível `executor` (que já tinha isso, travado no próprio nome).
  **Corrigida de passagem uma lacuna anterior**: o `core.js` isolado só
  tinha sido sincronizado em `modulos_isolados/cadastros/` (melhoria
  #1) — agora está igual nos 9 módulos isolados que têm cópia dele.
- **#9** — `kanban.js::soltarCartaoKanban()`: bloqueio de permissão
  (`resultado.alertar === true`) não mostra mais `alert()` — só impede
  a movimentação, silencioso. O `alert()` de status incompatível com
  cronômetro (`iniciarSessaoKanban`) continua como estava, por não ter
  sido pedido pra tirar.
- **#13** — `distribuicao-custos.js::carregarProjetoDistribuicao()`:
  Orçamento Global nasce com Impostos 21% (fallback, depois de tentar
  o "último valor usado"), Analista 30%, Supervisor 10%, Escritório
  60%, só quando o projeto ainda não tem nada salvo.
- **#16** — `distribuicao-custos.js::carregarAbaVerbaDetalhamento()`:
  % Distribuição de Lucros nasce em 10%, mesma regra (só sem valor
  salvo ainda).
- **#14** — `catalogo-lego.js`: Cadastro de Etapas ganhou coluna
  "% Sugerido" (editável, junto com Tipo, mesmo botão 💾 de salvar —
  `salvarEdicaoEtapaCatalogo` agora grava os dois). `distribuicao-custos.js::carregarAbaDistribuicaoAnalista()`
  usa esse valor (`etapa.pct_sugerido` do catálogo) como fallback do
  `%` de cada linha, só quando a Etapa ainda não tem nada salvo pra
  aquele projeto especificamente (nunca sobrescreve confirmado).
- **#15** — `distribuicao-custos.js::recalcularSomaPercentuaisAnalista()`
  (função nova, chamada ao carregar a aba e a cada edição de `%`):
  mesmo alerta visual (✅/⚠️) e mesma regra de cor que a aba Orçamento
  Global já tinha, agora também na aba Distribuição de Custos Analista
  — soma de TODAS as linhas (Etapas + Fundo Garantidor). `index.html`
  ganhou `#dca-alerta-soma`.
- **#6** — `distribuicao-custos.js::carregarAbaVerbaPorTarefa()`: cada
  grupo (Pavimento) da aba Verba por Tarefa ganhou uma linha de
  cabeçalho própria com seta ▼/► clicável
  (`alternarGrupoVerbaPorTarefa()`, estado em `vtGruposRecolhidos`,
  em memória) — recolhe as linhas de Tarefa e a linha de conferência;
  o Subtotal fica sempre visível, mesmo recolhido.
- **#12** — portal de seleção de projeto da Distribuição de Custos
  trocou de `<select>` (`dc-portal-projeto-select`, removido) pra uma
  lista clicável com busca (`dc-portal-tabela-projetos-body` +
  `filtrarTabelaProjetosDistribuicao()`), mesmo padrão da tela
  "Escolha o Projeto" da Árvore. O `<select id="dc-projeto">` de
  DENTRO da aba Orçamento Global (trocar projeto sem sair da tela)
  não mudou — só o portal inicial.

## 12.4. Melhorias #5, #10 e #17 — AINDA NÃO implementadas (adiadas)

Deliberadamente deixadas de fora da rodada acima — cada uma precisa de
atenção própria:

- **#5** (Tarefa de Etapa Única: executor padrão = Analista, editável
  só por Administrador) — tem uma decisão de design ainda em aberto
  (onde exatamente no Cadastro de Projetos fica esse controle), então
  não dá pra implementar sem voltar a essa decisão primeiro.
- **#10** (Kanban: tarefa "Aguardando Verificação" aparece como
  "Apontada" pro Revisor) — mexe em regras de permissão sensíveis já
  testadas e afinadas em várias rodadas anteriores
  (`statusBloqueiaCronometro`, `podeMoverCartaoKanban`) — merece
  atenção isolada, sem misturar com outras mudanças.
- **#17** (Codinome = primeiro nome do funcionário, substituindo nome
  completo em várias telas) — a mudança de maior alcance registrada,
  toca Kanban, Atribuição de Tarefas, Árvore, Distribuição de Custos,
  Apontamento, Aprovações, Relatórios e Lista de Projetos. Precisa de
  uma função central de exibição reaproveitada em todo lugar, feita
  com calma, tela por tela.

## 12.5. Melhoria #5 — IMPLEMENTADA (Executor de Tarefa de Etapa Única)

- **Criação**: `arvore.js::abrirFormEncaixe('etapa', ...)`, bloco
  `box-etapa-unica` — não pede mais Executor num `<select>` livre.
  Mostra (somente leitura) o nome do Analista cadastrado pro projeto
  (`banco_projetos`), que é quem vira `tarefa.executor` em
  `salvarPecaNaArvore()`. Projeto sem Analista definido mostra aviso
  no lugar do nome, mas não impede o encaixe (fica com executor vazio,
  igual sempre foi possível pro resto do sistema).
- **Edição posterior**: `visualizarNo`/`salvarAlteracoesNo`, campo
  Executor Técnico da Tarefa (`edit-t-exec`) — trava dupla, só pra
  Tarefa de Etapa Única (`ehTarefaUnica`): trava 1 visual (`disabled`
  no `<select>` pra quem não é `usuarioLogado.nivel === 'administrador'`)
  + trava 2 real (`salvarAlteracoesNo` só grava a troca de executor se
  for Administrador — ignora silenciosamente o valor do campo pra
  qualquer outro nível, mesmo que a trava 1 seja burlada).
- **Migração retroativa**: `core.js`, migração v5
  (`banco_arvores_projetos_migrado_v5_executor_etapa_unica`, mesmo
  padrão de marcador único das migrações v2/v3/v4) — Tarefas de Etapa
  Única já existentes recebem o Analista do projeto correspondente,
  uma vez só (não roda de novo, não desfaz trocas legítimas feitas por
  Administrador depois).
- Sincronizado em todos os módulos isolados relevantes (`arvore/`,
  `core.js` nos 9 módulos). Validado: `node --check`, sem resíduo do
  campo removido, funções onclick/onchange existem.

## 12.6. Melhorias #10, #17, #18 — DESENHO FECHADO, ainda NÃO implementadas

**#18 (nova) — Tarefa com Responsável + Executor, e Forma de Pagamento
no Funcionário.** Nasceu de uma reunião do usuário com a equipe,
resolvendo o que faltava fechar na #10 original.

- `funcionario.forma_pagamento`: campo novo e **independente** do
  Nível, editável no Cadastro de Funcionários — `'hora'` ou
  `'comissionado'`. Não é deduzido automaticamente do Nível (decisão
  explícita do usuário — cobre exceção, tipo alguém nível Analista que
  na prática recebe por hora).
- `tarefa.responsavel`: campo novo em TODA Tarefa, além do `executor`
  que já existe. Atribuído no **mesmo lugar/momento** que o Executor —
  tela Atribuição de Tarefas. Ao escolher o Executor, o Responsável já
  vem preenchido com a MESMA pessoa por padrão, mas é editável pra
  outra (ex: Detalhista revisando o trabalho de um Estagiário).
- Horas do Responsável (conferência/revisão) ficam num **fluxo
  isolado**, separadas das horas do Executor (execução) — dois totais,
  não um campo só. Também entram num fluxo de **aprovação separado**
  do fluxo de aprovação de horas do Executor (§7.1).
- **Custo dessas horas depende da `forma_pagamento` do Responsável**:
  `'hora'` → gera custo real (valor/hora × horas de conferência);
  `'comissionado'` → horas ficam registradas (rastreio/produtividade)
  mas com custo zero.
- Enquanto a Tarefa está em posse do Responsável pra revisão, o
  **Executor original fica travado** (só-leitura) nela — só volta a
  poder mexer quando o Responsável libera (move pra "Para revisão" ou
  "Finalizada").

**#10 (revisado, mesclado com a #18) — Kanban: fluxo Executor ↔
Responsável.**

- Quando o Executor move a Tarefa pra "Aguardando Verificação", ela
  aparece no Kanban de quem pode revisar **na MESMA coluna**
  ("Aguardando Verificação") — **não** mais na coluna "Apontada" (uma
  versão anterior desta melhoria tinha decidido mover pra "Apontada",
  revertido pelo usuário). Isso já funciona hoje
  (`coletarTarefasParaRevisar()`), sem mudança nessa parte.
- Quem pode revisar: o `tarefa.responsavel` atribuído **E** — continua
  valendo como plano B — qualquer um com autoridade hierárquica de
  revisar (ex: o Responsável designado está de férias). As duas coisas
  convivem, não uma substitui a outra.
- `iniciarSessaoKanban()` passa a aceitar rodar o cronômetro com status
  real `"Aguardando Verificação"` (hoje só aceita "Em Desenvolvimento"),
  desde que quem clicou tenha autoridade de revisar aquela Tarefa
  (Responsável atribuído ou autoridade hierárquica). Não precisa mudar
  de coluna pra isso — a exceção fica só na trava do cronômetro.
- `podeMoverCartaoKanban()` precisa de exceção equivalente pra permitir
  essa ação de "iniciar" por quem não é o Executor da Tarefa.

**#17 (revisado) — Codinome = primeiro nome, uso RADICAL.**

- Substitui o nome completo em **todo lugar** sem exceção (não só
  onde falta espaço — inclusive telas de detalhe completo).
- **Bloqueio de duplicidade**: `cadastros.js::salvarFuncionario()`
  passa a checar, antes de gravar, se o primeiro nome de quem está
  sendo salvo já existe em outro funcionário (excluindo ele mesmo, na
  edição) — bloqueia com `alert()` e não salva, mesmo padrão de
  bloqueio que a função já usa hoje pra CPF/Nome inválido. **Hoje não
  existe nenhuma checagem de duplicidade nessa tela** (nem CPF é
  checado contra repetição, só formato) — essa é a primeira desse tipo,
  sem padrão pronto pra copiar 1:1, mas seguindo o mesmo espírito.
- Função central de exibição (`nomeParaExibicao(nome)` ou equivalente)
  reaproveitada em todas as telas — Kanban, Atribuição de Tarefas,
  Árvore, Distribuição de Custos, Apontamento, Aprovações, Relatórios,
  Lista de Projetos. Antes de codar, primeiro passo é um levantamento
  (grep) completo de todo lugar que imprime `.nome` de funcionário —
  a lista de telas registrada é um mapeamento por memória, não uma
  auditoria exaustiva.

**Ordem de implementação combinada com o usuário**: #18+#10 juntas
(são a mesma mudança, na prática) primeiro — precisa de um
levantamento de como `apontamento.js` grava sessões de horas hoje,
ainda não feito, antes de tocar em código. #17 por último (mecânica,
mas evita competir por atenção nos mesmos arquivos do Kanban que a
#18/#10 vão mexer).

## 12.7. Melhorias #10 (revisado) e #18 — IMPLEMENTADAS

Antes de tocar no app real, a lógica nova (sessões por pessoa, trilha
Execução/Revisão, custo condicionado à forma de pagamento) foi
validada num **sandbox isolado**
(`/home/claude/testes/sandbox_sessoes_v2/` — fora do projeto entregue,
é scratch de desenvolvimento): `logica_sessoes_v2.js` reimplementa a
lógica de forma pura, `rodar_testes.js` roda 9 cenários (executor
normal, bloqueio por status, revisor com `responsavel` atribuído,
revisor por hierarquia sem `responsavel`, pessoa sem autoridade
bloqueada, duas pessoas com sessão ativa simultânea sem se
atrapalharem, mesma pessoa migrando de tarefa pausa só a sessão dela,
custo comissionado vs por hora, horas de revisão em campo separado) —
todos passaram antes de qualquer código real ser tocado.

**Transplante pro app real — ACHADO IMPORTANTE que mudou o desenho do
sandbox**: `tarefa.sessao_ativa_inicio` (trilha Execução) é lido em
MUITOS lugares fora de `apontamento.js`
(`atribuicao-tarefas.js` — indicador de sessão ativa na tabela e no
editor de sessões; `kanban.js` — cartão do Kanban). Renomear esse
campo (como o sandbox fazia) quebraria tudo isso silenciosamente. O
transplante real foi **aditivo em vez de renomear**:
- `tarefa.sessao_ativa_inicio` continua EXATAMENTE como antes (trilha
  Execução) — nenhum dos lugares que já liam esse campo precisou
  mudar.
- `tarefa.sessao_ativa_quem` — campo novo, só o nome de quem está na
  sessão de Execução ativa agora.
- `tarefa.sessao_ativa_revisao` = `{inicio, quem}` — trilha inteiramente
  nova, sem conflito.
- `tarefa.sessoes_trabalho[]` (Execução, fechadas) ganhou o campo
  `quem` em cada entrada nova (entradas antigas não têm, tudo bem —
  ninguém lê isso ainda de um jeito que dependa disso).
- `tarefa.sessoes_revisao[]` — nova, mesmo formato + `quem`.
- `tarefa.horas_revisao` — novo, derivado (espelha `tarefa.horas_reais`).

**Arquivos tocados:**
- `js/cadastros.js` + `index.html`: `funcionario.forma_pagamento`
  (`'hora'` | `'comissionado'`) — campo novo no formulário + coluna
  nova na tabela de Funcionários.
- `js/atribuicao-tarefas.js` + `index.html`: `tarefa.responsavel` —
  coluna nova "Responsável (conferência)", ao lado de Executor. Por
  padrão "segue" o Executor (`aplicarAtribuicaoExecutorNaTarefa`
  sincroniza os dois enquanto não foi customizado); função nova
  `atribuirResponsavelTarefa()` grava só o Responsável, independente,
  mesma trava de nível que já existe pro Executor (Analista não
  atribui).
- `js/apontamento.js`: `iniciarSessaoTrabalho()`/`pausarSessaoTrabalho()`
  reescritas — agora leem `usuarioLogado` (global) pra decidir a
  trilha certa (Execução se for o Executor da tarefa, Revisão se tiver
  autoridade de revisar — `podeRevisarTarefa()`, kanban.js — e a
  tarefa estiver especificamente em "Aguardando Verificação"). Regra
  "uma sessão ativa" virou POR PESSOA
  (`localizarSessaoAtivaDaPessoa`/`pausarSessaoAtivaDaPessoa`,
  substituem as antigas `acharCaminhoSessaoAtivaGlobal`/
  `pausarSessaoAtivaGlobal`, que eram globais pro sistema inteiro).
  Nova `calcularCustoRevisaoTarefa()` (espelha
  `calcularCustoRealTarefa()`): custo = 0 quando quem revisou é
  `'comissionado'`, horas contam igual.
- `js/kanban.js`: `podeRevisarTarefa()` ganhou o caminho de autoridade
  do `tarefa.responsavel` (convive com a hierarquia já existente, não
  substitui). Mensagem de erro do botão "Iniciar" generalizada (cobre
  tanto Executor quanto Revisor sem autoridade).
- **Migrações retroativas** (`core.js`, mesmo padrão de marcador único
  de sempre): v6 (`forma_pagamento` deduzido do Nível pra funcionários
  já cadastrados), v7 (`tarefa.responsavel` = `tarefa.executor` pra
  tarefas já existentes), v8 (`sessao_ativa_quem` = executor, pra
  sessão de execução que já estava rodando antes dessa mudança
  existir).
- Sincronizado em todos os módulos isolados relevantes
  (`cadastros/`, `atribuicao-tarefas/`, `kanban/`, `relatorios/`, e
  `core.js` nos 9 módulos). Validado: `node --check` em tudo,
  balanceamento de tags, funções onclick/onchange/oninput existem,
  sem resíduo funcional das funções antigas renomeadas.

**Registrado como NÃO feito ainda nesta rodada** (decisão explícita de
manter o escopo controlado):
- Correção manual de sessão (`adicionarSessaoManual`/`editarSessao`/
  `removerSessao`/`forcarPausaSessaoAtiva`) continua só pra trilha de
  Execução — sem equivalente pra Revisão ainda.
- Nenhuma tela nova mostra `horas_revisao`/`calcularCustoRevisaoTarefa()`
  ainda — as funções estão prontas e testadas, mas não há relatório/
  card exibindo esse número (mesma situação que `calcularCustoRealTarefa()`
  já vivia antes desta rodada — pronta, sem tela própria).
- Fluxo de **aprovação separada** das horas de Revisão (item 3 da
  decisão original da #18) não foi implementado — as sessões de
  Revisão fecham direto (mesmo comportamento de sempre do play/pause),
  sem depender de aprovação.
- **Trava do Executor original enquanto a tarefa está com o
  Responsável revisando** (item 4 da decisão original) — não
  implementada ainda; o Executor não fica fisicamente impedido de
  editar a tarefa nesse meio-tempo.
- A pendência antiga de Tarefa de Etapa Única não reconhecida por
  `apontamento.js`/`kanban.js`/etc. (ver §12.2) continua igual — este
  módulo, com a mudança de hoje, também não passou a reconhecer.

## 12.8. Ciclo Executor ↔ Revisor no Kanban — IMPLEMENTADO (refinamento)

Pedido do usuário pra deixar explícito o fluxo completo de correção —
conferindo o código, boa parte já estava certa (contador de retrabalho
já existia, cronômetro já liberava em "Para revisão"); achei e corrigi
2 lacunas reais:

- **Bug corrigido**: "Finalizada" não bloqueava o cronômetro
  (`APONTAMENTO_STATUS_SEM_CRONOMETRO` só tinha "Apontada" e
  "Aguardando Verificação") — permitia apontar hora numa tarefa já
  encerrada. Adicionado "Finalizada" à lista de status bloqueados.
  Mensagem do cartão do Kanban atualizada pra ter um texto próprio
  pra esse caso (antes só distinguia "Apontada" vs "resto").
- **Implementado agora** (decisão já registrada antes, nunca
  construída): Kanban de nível `executor` não mostra mais a coluna
  "Para revisão" como coluna própria — `montarColunasKanban()` passou
  a aceitar uma lista de colunas (guardada em `kbColunasAtuais`, usada
  também por `soltarCartaoKanban()` pra saber o status real de cada
  índice visual); `carregarKanbanExecutor()` decide o conjunto de
  colunas pelo **nível de quem é o DONO do quadro** (`nomeExecutor`
  selecionado, não de quem está olhando — um Administrador vendo o
  quadro de um Executor também não vê essa coluna). Cartões com status
  real `"Para revisão"` aparecem MESCLADOS dentro do balde visual de
  "Apontada" (mesmo cartão, status real intacto — só onde ele é
  desenhado na tela que muda).

**Fluxo completo, do jeito que já funciona (nada mais precisou mudar)**:
Executor move Apontada→Em Desenvolvimento→Aguardando Verificação
(aponta hora só em Em Desenvolvimento) → aparece no Kanban de quem
revisa, na mesma coluna "Aguardando Verificação" (`coletarTarefasParaRevisar`,
já existia) → Revisor manda "Para revisão" (`vezes_em_revisao` já
incrementa aqui, `moverTarefaParaStatus`) ou "Finalizada" → se "Para
revisão", volta pro Kanban do Executor (dentro do balde "Apontada",
com a mudança de hoje), ele aponta as horas de correção (cronômetro já
liberado nesse status) e move de novo pra "Aguardando Verificação",
repetindo o ciclo até "Finalizada".

Sincronizado em `modulos_isolados/kanban/`,
`modulos_isolados/atribuicao-tarefas/`,
`modulos_isolados/relatorios/`. Validado: `node --check`, funções
onclick/onchange/oninput existem, checagem manual (via node) da lógica
de filtro/mesclagem de colunas.

**Restrição adicional** (pedido de refinamento logo em seguida): com a
tarefa em `"Para revisão"`, o Executor comum (não auto-aprovação) só
tem UM destino possível — `"Aguardando Verificação"`. Não pode
"recuar" pra `"Em Desenvolvimento"` nem pra `"Apontada"` a partir daí
— `podeMoverCartaoKanban()` ganhou essa checagem extra, específica pra
`statusOrigem === 'Para revisão'`. Não se aplica a Supervisor/
Administrador executando a própria tarefa (auto-aprovação já tem
liberdade total de sempre, sem restrição nenhuma nas colunas).

## 12.9. Kanban — reverts + Aprovação de Finalização — IMPLEMENTADO

Rodada de ajustes acumulados sobre o Kanban antes de implementar em
bloco (pedido explícito do usuário: "espere acumularmos demandas").

**Reverts** (desfazem decisões de rodadas anteriores):
- **"Para revisão" volta a ser coluna própria, pra TODOS os níveis** —
  desfaz a mesclagem/ocultação implementada em §12.8 (que escondia
  essa coluna e mesclava os cartões dentro de "Apontada" só pro nível
  `executor`). `montarColunasKanban()` continua aceitando uma lista de
  colunas (mecanismo mantido, só não é mais usado pra filtrar — sempre
  chamado com `KB_COLUNAS` completo, as 5).
- **Login/troca de usuário: TODOS os níveis abrem direto no próprio
  Kanban** — `core.js::abrirTelaInicialPorNivel()` não distingue mais
  por nível (antes: Executor→Kanban, resto→Árvore). Substitui de vez o
  comportamento das melhorias #8/#11 antigas.

**Novo — Aprovação de Finalização de Tarefa:**
- Toda Tarefa marcada `"Finalizada"` nasce com
  `tarefa.aprovacao_finalizacao = 'pendente'` e
  `tarefa.finalizada_por = <nome de quem moveu>` (gravado em
  `moverTarefaParaStatus()`, kanban.js). Só passa a valer de vez depois
  de aprovada.
- **Quem pode aprovar** (`kanban.js::podeAprovarFinalizacao()` +
  `usuarioTemAutoridadeDeAprovarNoProjeto()`): Analista do projeto,
  Supervisor do projeto, ou Administrador (qualquer projeto) — mesmo
  padrão de escopo por projeto que `podeRevisarTarefa()` já usa.
  **Exceção que bloqueia**: o próprio Executor ou Responsável da tarefa
  NÃO pode aprovar a própria finalização, mesmo tendo autoridade de
  nível — a ÚNICA saída é se essa mesma pessoa também for o Analista
  designado do projeto (separação de funções, com uma exceção
  deliberada). Validado com teste isolado via Node (6 cenários,
  incluindo o caso de exceção) antes de fechar.
- **Tela Aprovações ganhou uma 3ª aba**, "✅ Finalizações"
  (`aprov-sub-finalizacoes`, ao lado de Calendário e Apontamento de
  Horas) — lista todas as pendências que a pessoa logada tem
  autoridade de ver, com botão "Aprovar" só quando ela também tem
  autoridade especificamente PRA AQUELA tarefa (senão mostra "Aguardando
  outro aprovador"). Badge do menu (`badge-pendencias-aprovacoes`) soma
  as 3 categorias agora.
- **Aviso no próprio Kanban** (`kb-aviso-finalizacoes-pendentes`,
  banner clicável que leva pra tela Aprovações): aparece só quando a
  pessoa está olhando o PRÓPRIO quadro (não o de outra pessoa pelo
  dropdown) e tem finalizações pendentes que pode aprovar.
- **Visual do cartão**: enquanto `aprovacao_finalizacao === 'pendente'`,
  o cartão "Finalizada" fica com `opacity:0.55` (cores atenuadas) + selo
  "⏳ Aguardando aprovação"; depois de aprovada, selo "✅ Aprovada"
  (cor verde), opacidade normal.

Sincronizado em `modulos_isolados/kanban/` (único módulo isolado com
`aprovacoes-calendario.js`) e `core.js` nos 9 módulos. Validado:
`node --check` em tudo, balanceamento de tags, funções onclick/
onchange/oninput existem, teste isolado via Node da regra de
aprovação.

**Registrado como NÃO feito ainda nesta rodada** (fica pra próxima,
junto com o resto do acumulado):
- Coluna "Para revisão" mostrando indicador de quantas vezes o ciclo
  já se repetiu (`tarefa.vezes_em_revisao`, já gravado, mas não exibido
  em lugar nenhum ainda).
- Item "detalhista/responsável vê e revisa suas tarefas" (pendente
  registrada antes desta rodada) — a Tarefa de Etapa Única e o
  `tarefa.responsavel` já existem (melhoria #18), mas ainda não há uma
  tela específica listando "minhas tarefas como Responsável" separada
  do que já aparece mesclado no Kanban (`coletarTarefasParaRevisar`).

## 12.10. Rodada de implementação: #21, Etapa Única generalizada, vezes_em_revisao visível, #19 — IMPLEMENTADO

**#21 — Renomear "Kanban do Executor" → "Kanban".** `index.html` (menu)
e `core.js::alternarModulo()` (título da tela) — os dois lugares
visíveis na UI real. Sincronizado no módulo isolado `kanban/`.
Comentários internos que ainda dizem "Kanban do Executor" (documentação,
não afeta funcionamento) foram deixados como estão.

**Etapa Única generalizada nos 5 arquivos que faltavam** (pendência
registrada desde §12.2, resolvida — desenho validado antes em sandbox,
`/home/claude/testes/sandbox_backlog/travessia_etapa_unica.js`, 8
cenários, todos passaram):
- **`apontamento.js`**: `localizarTarefaPorCaminho()` (função
  compartilhada, usada por vários outros arquivos),
  `localizarSessaoAtivaDaPessoa()` e `listarTodosApontamentosManuais()`
  — todas aceitam path curto (Etapa Única) e longo (Setor/Pavimento).
- **`kanban.js`**: `obterExecutoresVinculadosAosProjetos()`,
  `coletarTarefasParaRevisar()`, `coletarTarefasDoExecutor()` e
  `moverTarefaParaStatus()` — mesma generalização.
- **`atribuicao-tarefas.js`** (o mais denso — 43 ocorrências antes):
  `coletarTodasTarefasDeTodosProjetos()` agora inclui Tarefa de Etapa
  Única, com `pontosMaximo = 0` (não existe Verba por Área Equivalente
  pra ela — só Etapa Subdividida tem) e `grupoPav` isolado (não
  interfere no recálculo de Pontos Máximo de nenhum Pavimento de
  verdade). **Achado importante**: apliquei ali a MESMA trava da
  melhoria #5 (só Administrador troca o Executor de Tarefa de Etapa
  Única) — sem isso, essa tela virava uma brecha nova pra contornar a
  trava que já existia só na Árvore, já que essas Tarefas nunca tinham
  aparecido aqui antes. `reordenarFilaExecutorNaArvore()` e os 4
  lookups diretos (`editarDataLimiteTarefa`, `atribuirExecutorTarefa`,
  `atribuirResponsavelTarefa`, `editarPontosTarefaAtribuicao`) também
  generalizados.
- **`bi.js`**: **decisão deliberada de EXCLUIR** Etapa Única da
  Calibração de Catálogo (`renderizarPainelCalibracaoBI`) — não existe
  `k_real_calculado` pra ela (depende de `peso_esforco` do Pavimento,
  que ela não tem), incluir corromperia a média com falsos "pontos de
  dado válido" valendo 0. Já o Fechamento Global/Controladoria
  (`renderizarControladoriaGlobalFechamento`) **passou a incluir** —
  ali o custo real (`horas_reais × valor/hora`) é dado válido mesmo sem
  Pavimento.
- **`relatorios.js`**: `coletarLinhasSessaoTrabalho()` e
  `coletarLinhasTarefa()` — Etapa Única entra nas duas, com
  `horasPrevistas = 0` e `outlier = false` (sem base de área
  equivalente pra comparar, mesmo raciocínio do bi.js).
- **`distribuicao-custos.js`**: **conferido e decidido não mexer** — as
  duas travessias ali (`listarPavimentosDoProjeto()`, aba Verba por
  Tarefa) são estruturalmente sobre Pavimento, que Etapa Única nunca
  tem — já excluem ela corretamente por construção, sem ajuste
  necessário (bate com a decisão de design já fechada: Etapa Única não
  participa da distribuição por Pavimento).

**`vezes_em_revisao` visível.** Campo já existia e incrementava
certinho (§12.8) — só não aparecia em lugar nenhum. Agora
`coletarTarefasDoExecutor()`/`coletarTarefasParaRevisar()` incluem
`vezesEmRevisao`, e o cartão do Kanban mostra "🔁 Já voltou Nx pra
correção" quando > 0.

**#19 — Distribuição de Custos: lista de projetos na posição da
Árvore.** `index.html` — `#dc-portal-selecao-projeto` trocou de cartão
centralizado (`max-width:480px; margin:60px auto`) pra painel lateral
esquerdo fixo (380px, cabeçalho escuro "📁 Escolha o Projeto"), mesmo
padrão visual/estrutural de `#subpanel-lista-projetos-arvore` na
Árvore. `#panel-distribuicao-custos` (container pai) ganhou
`flex-direction: row` e `#dc-conteudo-principal` ganhou `flex: 1` pra
ocupar o espaço ao lado. Só a POSIÇÃO/visual mudou — o comportamento de
mostrar/esconder entre portal e conteúdo continua o mesmo de antes
(diferente da Árvore, que mantém a lista sempre visível mesmo com um
projeto aberto — isso não foi pedido, não foi feito).

Sincronizado em todos os módulos isolados relevantes (`kanban/`,
`atribuicao-tarefas/`, `relatorios/`, `bi/`, `distribuicao-custos/`).
Validado: `node --check` em todo o projeto, balanceamento de tags,
funções onclick/onchange/oninput existem, sem resíduo funcional de
"Kanban do Executor".

**Ainda pendentes desta leva de 11 itens acumulados** (não
implementados nesta rodada, tamanho/risco pedem rodada própria): #17
Codinome (100+ pontos no código, validado em sandbox mas não
aplicado), #20 Relatórios em A4 paisagem, #22 Kanban com abas "Meu
Kanban"/"Kanban" + filtros, correção manual de sessão de Revisão,
aprovação separada das horas de Revisão (desenho confirmado pelo
usuário), trava do Executor só na tarefa específica em revisão
(também confirmado).

## 12.11. Melhoria #22 — Kanban com 2 abas + filtros — IMPLEMENTADO

Reestruturação grande da tela Kanban — trocou o dropdown único
"Selecione o Executor" (`kb-executor`, removido) por 2 abas + barra de
filtros, reaproveitando o padrão visual de abas que a tela Aprovações
já usava (classe `.aprov-aba`/`.aprov-abas`).

**Duas abas** (`kbAbaAtiva`, global em `kanban.js`):
- **"🧍 Meu Kanban"**: sempre e só as tarefas onde o usuário logado é
  Executor (`coletarTarefasDoExecutor(usuarioLogado.nome)`) — sem
  seleção nenhuma, pra todo mundo, todos os níveis.
- **"🗂️ Kanban"**: por padrão, tarefas sob responsabilidade do usuário
  logado (papel de Responsável/conferência —
  `coletarTarefasParaRevisar()`, já excluía tarefas onde a pessoa é a
  própria Executora, então não duplica com a aba de cima).

**Filtros** (`kb-filtro-projeto`, `kb-filtro-executor`, `kb-filtro-status`,
`kb-filtro-data-inicio`/`kb-filtro-data-fim`) — Projeto/Status/Data
valem nas duas abas; Executor só aparece na aba "Kanban" (escondido em
"Meu Kanban", que já é sempre 1 pessoa só). O filtro de Executor tem
**dois comportamentos diferentes por nível**, decisão explícita do
usuário:
- **Administrador/Supervisor**: escolher um Executor troca a fonte de
  dados inteira pro **quadro pessoal completo** dessa pessoa (mesmo
  uso administrativo que o dropdown único já permitia antes —
  "abrir o quadro de qualquer funcionário").
- **Qualquer outro nível** (Analista, Executor/Detalhista agindo como
  Responsável): o mesmo filtro só **restringe** a lista "sob minha
  responsabilidade" àquele Executor específico — não troca de fonte.

**Datas previstas por múltiplas pessoas**: o motor de fila
(`calcularDatasInicioEFimExecutor`) é POR PESSOA — como "sob minha
responsabilidade" pode ter tarefas de várias pessoas diferentes ao
mesmo tempo, `renderizarQuadroKanban()` calcula o mapa de datas pra
cada Executor distinto que aparecer na lista já filtrada, e junta tudo
num mapa só antes de aplicar o filtro de período.

**Botão "Meu Calendário"**: só fica disponível quando dá pra apontar
pra UMA pessoa específica (aba "Meu Kanban", ou uso administrativo na
aba "Kanban" com filtro de Executor) — "sob minha responsabilidade"
mistura gente, sem calendário único. Novo helper
`obterNomeSujeitoCalendarioKanban()` substitui a leitura direta do
dropdown removido, usado também por `abrirModalCalendarioKanban()` e
`criarExcecaoCalendarioKanban()`.

**Arquivos tocados**: `index.html` (painel Kanban reescrito),
`js/kanban.js` (`carregarPainelKanban()`, `renderizarQuadroKanban()`
substitui `carregarKanbanExecutor()`, `coletarTarefasDoExecutor()`
perdeu o merge automático de revisão — agora é 100% separado por aba,
`alternarAbaKanban()`/`limparFiltrosKanban()` novas). Sincronizado no
módulo isolado `kanban/`. Validado: `node --check` em tudo,
balanceamento de tags, funções onclick/onchange/oninput existem, sem
resíduo do dropdown/função antigos, e teste isolado via Node da lógica
de decisão de fonte de dados (6 cenários — aba, nível, com/sem filtro).

**Ainda pendentes desta leva de 11 itens acumulados**: #17 Codinome,
#20 Relatórios em A4 paisagem, correção manual de sessão de Revisão,
aprovação separada das horas de Revisão, trava do Executor só na
tarefa específica em revisão.

## 12.12. Melhorias #23 a #28 — IMPLEMENTADO

**#24 — Bug real corrigido: fonte de dados da aba "Kanban".** Achado ao
investigar "sem filtro, Administrador não vê nada": `coletarTarefasParaRevisar()`
(reaproveitada como base da aba inteira na #22) só olhava status
`"Aguardando Verificação"` — nunca teve a intenção de listar "toda
tarefa sob responsabilidade, qualquer status". As outras 4 colunas
ficavam sempre vazias, pra todo mundo, não só pro Administrador. Nova
função `coletarTarefasSobResponsabilidade()` (kanban.js) resolve:
Administrador vê tudo, Supervisor/Analista só os projetos onde são
designados, qualquer nível pode ver uma tarefa específica onde é
`tarefa.responsavel` mesmo fora da própria autoridade de projeto.
Nunca inclui tarefa onde a pessoa é a própria Executora (já está em
"Meu Kanban"). Testado isoladamente via Node (4 cenários) antes de
plugar em `renderizarQuadroKanban()`. `coletarTarefasParaRevisar()`
ficou sem chamador (não removida, só não é mais usada).

**#23 e #25 — Filtros do Kanban em colunas, com rótulos de data.**
`index.html`: barra de filtros virou grid (`repeat(auto-fit,
minmax(150px, 1fr))`), cada filtro numa coluna com rótulo visível
acima (Projeto, Executor, Status, **Data Inicial**, **Data Final**) —
os dois campos de data ganharam rótulo de verdade (antes só tinham
`title`, tooltip). Filtro de Executor ficou num wrapper próprio
(`kb-filtro-executor-coluna`) pra esconder a COLUNA inteira quando não
se aplica (aba "Meu Kanban"), não só o campo — senão sobrava buraco
vazio no grid.

**#26 — Fallback correto na coluna Responsável (Atribuição de
Tarefas).** Causa raiz: o fallback antigo espelhava o Executor
(`tarefa.responsavel || tarefa.executor`), que também ficava vazio
quando a Tarefa ainda não tinha Executor atribuído — daí aparecer o
placeholder "Sem executor" (rótulo reaproveitado sem pensar direito
nesse contexto). Nova cadeia de prioridade: 1) `tarefa.responsavel`
(customizado) → 2) `etapa.responsavel` (Responsável da Etapa,
Subdividida, já definido na Árvore) → 3) `projeto.analista` (Cadastro
de Projetos) → só aí vazio. Etapa Única não tem `etapa.responsavel`
(não existe esse campo pra ela), então pula direto pro Analista do
projeto. `construirOpcoesExecutor()` ganhou parâmetro de rótulo de
placeholder customizável — a coluna Responsável agora mostra
"-- Selecione --" em vez de "Sem executor" (esse continua certo só na
coluna Executor).

**#27 — Larguras mínimas na tabela de Atribuição de Tarefas.** Reduzido
o `width` de várias colunas que tinham folga (Localização 280→220px,
Data de Início/Limite 130→100px cada, Pontos Máximo 90→80px,
Responsável/Status 170→150px, Horas Apontadas 130→100px) e adicionado
largura fixa em Projeto (120px) e Executor (150px), que antes eram
auto. **Sem teste visual real** — pode precisar de ajuste fino depois
que o usuário conferir no navegador.

**#28 — Campo Pontos sem setas de incremento.** CSS puro
(`estilos.css`), classe `.at-input-pontos`
(`-webkit-appearance:none` nos spin buttons + `-moz-appearance:textfield`)
— sem mudança de HTML/JS, o campo já era `<input type="number">` com
essa classe.

Sincronizado em `modulos_isolados/kanban/` e
`modulos_isolados/atribuicao-tarefas/` (JS, HTML e `estilos.css` —
conferido que os CSS isolados eram cópia idêntica do principal antes
de sobrescrever). Validado: `node --check` em tudo, balanceamento de
tags, funções onclick/onchange/oninput existem, teste isolado via Node
da nova função de dados da #24.

**Ainda pendentes**: #17 Codinome, #20 Relatórios A4, correção manual
de sessão de Revisão, aprovação separada das horas de Revisão, trava
do Executor só na tarefa específica em revisão.

## 12.13. Redistribuição de colunas + Trava do Executor + Aprovação de Revisão — IMPLEMENTADO

**Redistribuição de larguras (Atribuição de Tarefas), 2ª rodada.**
Projeto 120→60px, Localização 220→110px, Data de Início 100→50px
(reduzidos pela metade, a pedido explícito); Status 150→120px, Horas
Apontadas 100→70px (reduzidos "um pouco"); Executor 150→220px,
Responsável 150→220px (espaço redistribuído pra essas duas colunas,
que têm nomes de gente e precisam de mais espaço). **Sem teste visual
real** — o próprio usuário mediu a proporção que queria, mas vale
conferir no navegador.

**Trava do Executor durante a revisão** (pendência da #18, item 4 —
fechada como "trava só a tarefa específica, não o funcionário todo").
`arvore.js::visualizarNo()`: quando a Tarefa está `"Aguardando
Verificação"` e quem está vendo é o próprio Executor dela **sem**
autoridade de revisar (`podeRevisarTarefa()`, kanban.js — não é
Responsável nem tem hierarquia), o formulário inteiro fica
`disabled` com um aviso "🔒 Esta tarefa está em revisão". Trava 2 (a
que vale de verdade) em `salvarAlteracoesNo()`: mesma checagem,
ignora silenciosamente qualquer alteração enviada (mesmo espírito da
melhoria #9 — bloqueio de permissão fica silencioso, sem alert).

**Aprovação separada das horas de Revisão** (pendência da #18, item
5 — design confirmado pelo usuário). Sessão de revisão fechada via
play/pause normal (`iniciarSessaoTrabalho`/`pausarSessaoTrabalho`/
`pausarSessaoAtivaDaPessoa`, apontamento.js) nasce
`status: 'pendente'` — `recalcularHorasRevisao()` e
`calcularCustoRevisaoTarefa()` agora só contam sessão `'aprovada'`
(mudança de comportamento explícita: antes contava na hora). 4 novas
funções de correção manual, espelhando as de Execução
(`adicionarSessaoManualRevisao`, `editarSessaoRevisao`,
`removerSessaoRevisao`, `forcarPausaSessaoAtivaRevisao`) — essas
nascem/ficam `'aprovada'` direto (lançamento manual já é autoritativo,
mesmo espírito das funções de Execução que também não passam por
aprovação de novo). **Tela Aprovações ganhou uma 4ª aba**, "🔁 Sessões
de Revisão" (`aprov-sub-revisao`) — lista pendências
(`listarSessoesRevisaoPendentes()`, percorre árvores inteiras,
Subdividida e Única), botões Aprovar/Recusar
(`aprovarSessaoRevisaoNaTela`/`recusarSessaoRevisaoNaTela` — recusa
mantém a sessão com `status:'recusada'`, não apaga, mesmo padrão do
Apontamento Manual). Badge do menu agora soma as 4 categorias.

Sincronizado em `modulos_isolados/arvore/`,
`modulos_isolados/atribuicao-tarefas/`, `modulos_isolados/relatorios/`,
`modulos_isolados/kanban/`. Validado: `node --check` em tudo,
balanceamento de tags, funções onclick/onchange/oninput existem.

**Ainda pendentes**: #17 Codinome (muito grande, 100+ pontos —
tratamento à parte), #20 Relatórios em A4 paisagem (próxima desta
mesma rodada).

## 12.14. Melhoria #20 — Relatórios em formato planilha, A4 paisagem — IMPLEMENTADO

O botão "🖨️ Imprimir" (`window.print()`) **já existia** na tela de
Relatórios, junto com um `@media print` básico (só escondia menu/
filtros) — faltava o CSS de impressão de verdade. `estilos.css`:

- `@page { size: A4 landscape; margin: 12mm; }` — força paisagem.
- Bordas em toda célula (`th`/`td` dentro de `#panel-relatorios`,
  escopado só a essa tela pra não afetar impressão de outras partes do
  sistema), fonte reduzida (10px) e padding compacto — cabe mais linha
  por página.
- Cabeçalho de coluna com fundo cinza, `position:static` (sticky não
  faz sentido impresso) e `display:table-header-group` — repete em
  cada página nova quando a tabela quebra.
- `page-break-inside:avoid` nas linhas — evita cortar uma linha ao
  meio entre duas páginas.
- Destaques de tela que não fazem sentido em P&B impresso (linha
  outlier em vermelho claro) neutralizados; linha de total continua
  com leve destaque.

Não paginava antes (relatorios.js não usa paginação, diferente de
Atribuição de Tarefas) — confirmado que a impressão sai com a tabela
inteira filtrada, não só uma "página" da tela.

Sincronizado `estilos.css` em **todos os 10 módulos isolados**
(confirmado que todos tinham cópia idêntica do bloco antigo antes de
sobrescrever). Validado: `node --check` em tudo, balanceamento de
chaves do CSS em todas as cópias, balanceamento de tags do
`index.html`, funções onclick/onchange/oninput existem.

**Sem teste visual/impressão real** — não tenho como confirmar o
resultado final numa folha de verdade; vale imprimir (ou "Salvar como
PDF") um relatório de teste antes de considerar fechado.

**Só falta a #17 (Codinome)** das pendências desta leva — grande
demais pra essa rodada, tratamento à parte na próxima.

## 12.15. Melhoria #17 — Codinome de Funcionário — IMPLEMENTADO

Codinome = primeiro nome, **derivado automaticamente** de
`funcionario.nome` (`nomeParaExibicao()`, `core.js` — não é campo
digitado, não existe `funcionario.codinome` salvo em lugar nenhum).
`nome` continua sendo o identificador interno único em TODO dado
gravado (`tarefa.executor`, `tarefa.responsavel`, `projeto.analista`/
`supervisor`, chaves de comparação) — nada disso mudou. Só a
EXIBIÇÃO em tela trocou.

**Uso radical, com 1 exceção deliberada**: substitui o nome completo
em praticamente toda tela — texto estático (cartões, colunas de
tabela, badges) e o rótulo visível de `<option>` em dropdowns de
escolha de pessoa (o `value` do `<option>` continua sendo o nome
completo, pra não quebrar nenhuma lógica de comparação/atribuição). A
**única exceção**: a lista da tela **Cadastro de Funcionários**
continua mostrando o nome completo — é o registro-fonte, e como o
primeiro nome já é garantido único (ver abaixo), não há motivo prático
pra resumir logo ali onde o nome é cadastrado.

**Bloqueio de duplicidade**: `cadastros.js::salvarFuncionario()` passa
a rejeitar (com `alert`) salvar um funcionário cujo primeiro nome
colida com o de outro já cadastrado — comparação case-insensitive,
edição não colide consigo mesma (usa o índice real do registro sendo
editado). Não havia NENHUMA checagem de duplicidade nessa tela antes
(nem CPF).

**Arquivos tocados** (8, cada um com pelo menos 1 ponto de exibição —
2 arquivos, `feriados.js` e `bi.js`, foram checados e não precisavam
de nada, já que os `.nome` neles são de feriado/tarefa/projeto/
catálogo, não de pessoa; `apontamento.js` também checado — é módulo
só de dados/lógica, sem HTML):
- **`core.js`**: `nomeParaExibicao()` (função central); cabeçalho "quem
  está logado"; dropdown de troca de identidade
  (`MODO_TESTE_SEM_LOGIN`).
- **`cadastros.js`**: bloqueio de duplicidade; colunas Analista/
  Supervisor na Lista de Projetos; dropdowns Analista/Supervisor/
  Detalhista no formulário de Projeto.
- **`kanban.js`**: cartão (badge "👤"), dropdown de filtro Executor,
  botão "Meu Calendário", título do modal de calendário.
- **`atribuicao-tarefas.js`**: `construirOpcoesExecutor()` (função
  COMPARTILHADA — resolve também os dropdowns de
  `distribuicao-custos.js` de graça), filtro estilo Excel
  (`valorParaExibicao`), tooltip de arrastar fila,
  `ajustarLarguraColunaExecutor()` (cálculo de largura da coluna
  passou a medir o codinome, não o nome completo — senão a coluna
  ficaria larga demais pro conteúdo real exibido).
- **`arvore.js`**: cards de Tarefa (Única e Subdividida), dropdown
  "Responsável da Etapa", campo readonly do Analista (encaixe de
  Etapa Única), dropdown "Executor Técnico", painel de detalhes do
  Projeto (Analista/Supervisor).
- **`distribuicao-custos.js`**: coluna Responsável (aba Analista).
- **`relatorios.js`**: dropdown de filtro Executor, célula da coluna
  Executor (funciona tanto agrupado quanto não-agrupado, já que o
  agrupamento guarda o valor bruto na mesma chave).
- **`aprovacoes-calendario.js`**: as 4 abas — Calendário (nome na
  tabela de exceções), Apontamento (executor), Finalizações (executor/
  responsável/finalizada por), Sessões de Revisão (quem revisou).

Sincronizado em **todos os módulos isolados** que têm cópia de cada um
desses 8 arquivos. Validado: `node --check` em tudo, balanceamento de
tags, funções onclick/onchange/oninput existem, e um teste rápido via
Node confirmando que `nomeParaExibicao()` no `core.js` real se
comporta igual ao testado no sandbox antes (nome composto, vazio,
undefined, símbolo isolado, nome de uma palavra só).

**Cuidado a ter na hora de testar**: dados de demonstração/seed já
existentes no `localStorage` de quem já estava usando o sistema podem
ter dois funcionários com o mesmo primeiro nome (a checagem de
duplicidade só vale daqui pra frente, pra quem SALVAR — não existe
migração retroativa corrigindo colisões já existentes). Se isso
acontecer, os dois vão aparecer com o mesmo codinome em tela — vale
conferir e renomear manualmente se for o caso.

## 12.16. Dados órfãos + padronização de rótulos + Responsável na Árvore — IMPLEMENTADO

**Causa raiz encontrada** (exemplo do usuário: "Duo Praia Brava" ainda
mostrando "Carlos", "Eliomar" como executor, nomes que não existem
mais no Cadastro de Funcionários): o dropdown de Executor/Responsável
só reconhece um valor como "preenchido" se existir um
`<option>` correspondente — e essa opção só é gerada pra funcionários
que EXISTEM HOJE em `banco_funcionarios`. Um `tarefa.executor`
apontando pra alguém renomeado/excluído fica "órfão": o dado ainda
está lá, mas nenhum `<option>` bate com ele, e a tela mostra em
branco/errado.

**Correção**: `atribuicao-tarefas.js::valorSeFuncionarioValido(nome,
funcionarios)` — nova função, trata nome órfão como se estivesse
vazio, caindo no próximo fallback da cadeia. Aplicada nos dois pontos
de coleta (Etapa Única e Subdividida):
- **Executor**: `tarefa.executor` (se válido) → **Detalhista do
  projeto** (`projeto.detalhista`, Cadastro de Projetos) → vazio.
  Fallback novo — antes o Executor não tinha fallback nenhum.
- **Responsável**: `tarefa.responsavel` (se válido) → `etapa.responsavel`
  (se válido, só Subdividida) → **Analista do projeto**
  (`projeto.analista`) → vazio. Já existia desde a #26, só ganhou a
  checagem de nome órfão.
- Testado isoladamente via Node antes de aplicar (nome válido mantém,
  nome órfão cai no fallback, vazio/undefined cai no fallback).

**Padronização de rótulos** (mesmo conceito, nomes diferentes em
telas diferentes — decisão fechada com o usuário via 2 rodadas de
pergunta, dado o tamanho do impacto):
- **Cadastro de Projetos**: "Detalhista Responsável" → **"Detalhista"**.
- **Atribuição de Tarefas**: "Responsável (conferência)" →
  **"Responsável"**.
- **Árvore de Projeto → Detalhes-Componente Tarefa**: "Executor
  Técnico" → **"Executor"**.
- **Campo novo na Árvore**: o detalhe da Tarefa na Árvore não tinha
  campo de Responsável nenhum (só existia em Atribuição de Tarefas) —
  agora tem, ao lado do Executor, dropdown editável
  (`edit-t-responsavel`), gravado em `salvarAlteracoesNo()`. Sujeito
  à mesma trava de "tarefa em revisão" que os outros campos (§12.13).

Sincronizado em `modulos_isolados/arvore/`,
`modulos_isolados/atribuicao-tarefas/`, `modulos_isolados/cadastros/`.
Validado: `node --check`, balanceamento de tags, funções onclick/
onchange/oninput existem, teste isolado via Node da lógica de
fallback com nome órfão (reproduzindo o cenário exato do "Duo Praia
Brava").

**Sobrescrição definitiva (migração v9)**, a pedido do usuário depois
da correção acima — não é só fallback de leitura, o dado GRAVADO
também é corrigido: `core.js`, migração
`banco_arvores_projetos_migrado_v9_nomes_orfaos`, mesmo padrão de
marcador único de sempre. Corrige, uma vez só:
`tarefa.executor` órfão → Detalhista do projeto (ou vazio);
`tarefa.responsavel` órfão → Responsável da Etapa (se válido) ou
Analista do projeto (ou vazio); `etapa.responsavel` órfão → vazio
direto (sem fallback pra ele mesmo). Testado isoladamente via Node
com um cenário reproduzindo o "Duo Praia Brava" (executor órfão
"Carlos", responsável órfão "Eliomar", e uma tarefa com dado já válido
que precisa ficar intocada) — bateu certo nos 3 casos.

## 12.17. Ajustes de layout: Executor/Responsável iguais + menu lateral -20%

**Causa real da diferença de largura Executor × Responsável**:
`ajustarLarguraColunaExecutor()` recalculava a largura da coluna
Executor dinamicamente (`ch`, baseado no maior codinome cadastrado),
sobrescrevendo o `width` fixo do `<th>` — a coluna Responsável nunca
passava por recálculo nenhum, então as duas divergiam na tela mesmo
declarando o mesmo valor no HTML. Removida a chamada e a função (dead
code) — as duas colunas agora usam só o `width` fixo do HTML, sempre
iguais. Aumentadas de 220px pra **260px** cada (pedido do usuário —
"menores do que precisam ser").

**Menu lateral (`.sidebar`) reduzido em 20%**: 270px → **216px**, pra
sobrar espaço pras colunas de Atribuição de Tarefas e outras telas.
Sem teste visual real — rótulos mais longos do menu ("Fundo Global
Fechamento", "Painel de Calibração BI") podem quebrar em 2 linhas
nesse espaço menor (`.menu-item` não tem `white-space:nowrap`, então
não corta/estoura, só quebra a linha) — vale conferir se ficou
aceitável.

Sincronizado `atribuicao-tarefas.js`, `index.html` e `estilos.css` em
`modulos_isolados/atribuicao-tarefas/` e em todos os módulos isolados
(CSS). Validado: `node --check`, balanceamento de tags/CSS, funções
onclick/onchange/oninput existem.

## 12.18. Botão "Exibir" removido da tela Relatórios

Pedido do usuário — o botão era redundante (todos os filtros já
disparam `renderizarTabelaRelatorio()` sozinhos via `onchange`), então
clicar em "Exibir" sem mudar nada não fazia diferença visível nenhuma,
parecendo quebrado. Removido de `index.html` e do módulo isolado
`relatorios/` — sobra só o "🖨️ Imprimir" no rodapé do filtro. A função
`renderizarTabelaRelatorio()` continua existindo normalmente (ainda é
chamada pelos filtros, seletor de visão, etc.), só não tem mais botão
próprio chamando ela direto.

## 12.19. Bug corrigido: seed de Funcionários sem `nivel` travava o login automático

Encontrado pelo usuário ao investigar "meus dados sumiram" — na
verdade dois problemas empilhados: (1) armazenamento `file://` do
navegador não é confiável (fora do controle do código, ver conversa),
o que fez `banco_funcionarios` aparecer vazio numa abertura; (2) **bug
real, pré-existente desde a base original do projeto** (antes de
qualquer trabalho nesta sessão): os 3 funcionários de exemplo (seed —
Carlos Eduardo, Fernanda Almeida, Julia Santos) nunca tiveram campo
`nivel`. Como `MODO_TESTE_SEM_LOGIN = true` (login automático, sem
tela de login) procura primeiro um Administrador e cai no primeiro da
lista se não achar, a pessoa ficava logada como alguém **sem nível
reconhecido** — menu trava no mais restrito (Executor), sem acesso a
Cadastros/Configurações, e como a tela de Login também é pulada nesse
modo, **sem nenhum caminho pela interface** pra se recuperar sozinho
(nem "Restaurar Backup", que fica atrás dessas duas telas).

**Corrigido em 3 frentes**, `core.js`:
1. `funcionariosSeed` ganhou `nivel` pra cada um dos 3 (Carlos →
   administrador, Fernanda → supervisor, Julia → executor) — só vale
   pra instalação nova/vazia.
2. **Migração v10** (`banco_funcionarios_migrado_v10_seed_sem_nivel`):
   corrige o que já estava salvo, identificando os 3 nomes exatos do
   seed (não mexe em funcionário real cadastrado pelo usuário que
   porventura esteja sem nível por outro motivo).
3. **Login automático reforçado**: a ordem de fallback passou de
   "salva → Administrador → primeiro da lista (mesmo sem nível)" pra
   "salva → Administrador → **qualquer um com nível reconhecido** →
   primeiro da lista". Proteção geral contra esse tipo de trava
   acontecer de novo por qualquer outro motivo, não só esse bug
   específico.

Testado isoladamente via Node reproduzindo os dados exatos do usuário
(3 funcionários sem nível) — confirma que Carlos vira Administrador
automaticamente na migração, e a auto-seleção de identidade encontra
ele certo depois. Sincronizado `core.js` em todos os módulos isolados.

**Sem workaround mais necessário** — o truque do Console (setar
`nivel` manualmente) que passei antes não é mais preciso; a próxima
vez que o `index.html` carregar já corrige sozinho.

## 12.20. As 5 melhorias acumuladas durante a pausa — IMPLEMENTADO

**1) Codinome volta a ser campo digitado** (revertendo a versão
automática da melhoria #17). `funcionario.codinome`, obrigatório e
único (mesma validação de antes, agora comparando o campo digitado em
vez do primeiro nome calculado). Campo novo no formulário + coluna na
lista, `cadastros.js`. **Migração v11** (`core.js`,
`banco_funcionarios_migrado_v11_codinome_retroativo`): funcionário já
cadastrado sem `codinome` recebe o primeiro nome atual como valor
inicial, uma vez só (editável depois) — não resolve sozinha uma
eventual colisão entre dois migrados com primeiro nome igual, precisa
de ajuste manual nesse caso raro. `core.js::nomeParaExibicao()` agora
lê `funcionario.codinome` primeiro, com fallback pro cálculo antigo
(primeiro nome) só quando não há cadastro correspondente — como o
**assinatura da função não mudou**, nenhum dos ~8 arquivos que já
chamavam `nomeParaExibicao(nome)` precisou ser tocado. Seed
(`funcionariosSeed`) também ganhou `codinome` de cada um. Testado
isoladamente via Node (fallback com/sem codinome cadastrado, nome sem
cadastro correspondente; e a validação de duplicidade com os 4
cenários de sempre).

**2) Filtro estilo Excel na coluna Responsável** (Atribuição de
Tarefas) — mesmo padrão que Executor já tinha:
`atFiltroSelecionado.responsavel` (novo), aplicado no filtro da
listagem, `valorParaExibicao()` estendida pros dois campos juntos
(`executor`/`responsavel`), ícone `▾` adicionado ao `<th>`. Mecanismo
já era genérico (`abrirFiltroColuna`/`valoresUnicosColuna` leem
`linha[campo]` dinamicamente) — só precisou registrar o campo novo,
sem lógica adicional.

**3) Zebra striping** na tabela de Atribuição de Tarefas —
`#at-tabela-body tr:nth-child(even) { background: #f8fafc; }`,
`estilos.css`. Não briga com o destaque já existente de "Aguardando
Verificação" (`estiloLinha`, inline no `<tr>`) porque `style` inline
sempre vence sobre regra de seletor CSS.

**4) Título do Kanban dinâmico** — `renderizarQuadroKanban()`
(kanban.js) atualiza `#page-context-title` a cada render: mostra o
codinome de quem é o quadro (aba "Meu Kanban", ou aba "Kanban" com o
filtro de Executor em uso administrativo). **Decisão tomada sem
confirmação prévia do usuário** (pergunta que tinha ficado em aberto):
na aba "Kanban" padrão, sem filtro (mistura gente de vários
projetos), o título mostra **"Sob sua responsabilidade"** — texto
genérico, revisar com o usuário se não for o que ele tinha em mente.

**5) Bug de impressão de Relatórios corrigido** — causa real:
`.content-panel` tem `overflow:hidden` fixo (pensado pra uma tela
única, não pra documento fluindo em várias páginas), cortando o
conteúdo capturado na hora de imprimir mesmo com o `.table-wrapper` já
liberado (fix anterior, §12.14, não bastou sozinho). Adicionado
`.content-panel { overflow:visible !important; height:auto !important; }`
e `.main-content { overflow:visible !important; }` dentro do
`@media print` já existente.

Sincronizado em todos os módulos isolados relevantes (`cadastros/`,
`atribuicao-tarefas/`, `kanban/`, e `estilos.css` em todos os 10).
Validado: `node --check` em tudo, balanceamento de tags/CSS, funções
onclick/onchange/oninput existem, 2 testes isolados via Node
(fallback de codinome + validação de duplicidade).

**Sem teste visual real de nenhuma delas** — o item 5 (impressão)
principalmente merece atenção, é o mais difícil de validar sem
imprimir de verdade.

## 12.21. Cadastro virou tela em abas — IMPLEMENTADO (reestruturação grande)

Substitui o menu em cascata (`#arvore-cadastro`, 7 itens sempre
visíveis na barra lateral quando expandido) por **1 item só** no menu
principal ("📝 Cadastro"), que abre uma tela com 7 abas internas —
mesmo padrão visual (`.aprov-aba`/`.aprov-abas`) já usado em
Aprovações (§12.9), sem CSS novo. **Feriados foi promovido** pra item
próprio no menu principal (não é mais um dos 7 — ele já tinha painel e
branch de `alternarModulo()` totalmente independentes, só morava
visualmente dentro da cascata por acaso).

**Estrutura nova**: `#panel-cadastro` (único `content-panel` de
verdade) contém a barra de abas + os 10 sub-painéis que já existiam
(Clientes/Funcionários/Projetos, cada um com par "-lista"/"-form", +
Etapas/Setores/Pavimentos/Tarefas só "-lista") — esses 10 perderam a
classe `content-panel` (virou `.sub-panel-cadastro`, CSS novo,
idêntico em comportamento) de propósito: se continuassem
`content-panel`, a varredura genérica "esconde tudo"
(`document.querySelectorAll('.content-panel')`) do topo de
`alternarModulo()` mexeria neles toda vez que QUALQUER outro módulo do
sistema fosse aberto, sem necessidade.

**JS (`core.js`)**: nova função `abrirAbaCadastro(modulo)` — esconde
os 10 sub-painéis, mostra só a "-lista" da aba escolhida, marca a aba
ativa, ajusta o título, chama a função de renderização certa. Lembra a
última aba usada (`cadAbaAtiva`, mesmo padrão de `aprovAbaAtiva`).
`alternarModulo()`: os branches antigos de `'clientes'`/`'funcionarios'`/
`'projetos'` e o `else` genérico (que atendia `etapas`/`setores`/
`pavimentos`/`tarefas`) viraram um branch só, checando
`ABAS_CADASTRO.includes(modulo)` — cada aba (e o botão "📝 Cadastro" do
menu, e `fecharFormulario()` ao voltar de editar) chama
`alternarModulo(modulo)` normalmente, sem precisar saber que existe
uma tela de abas por trás. **`toggleArvoreCadastro()` e
`escolherOpcaoCadastro()` removidas** (só serviam pra cascata antiga).
`MENU_POR_NIVEL`/`TODOS_ITENS_MENU_CONTROLADOS`: `'btn-cadastro-toggle'`
virou `'nav-cadastro'` — mesma trava de sempre (só Administrador vê),
agora num único item de menu em vez de um botão-toggle.

`abrirAbaCadastro()` ficou defensiva (`if (painelCadastro) ...`) — os
módulos isolados (`modulos_isolados/cadastros/`, etc.) não têm o
wrapper `#panel-cadastro` (são páginas de teste mais simples, não
restruturadas com abas) — sem essa defesa, chamar `alternarModulo('clientes')`
lá dentro quebraria com erro. Isolados continuam funcionando (os
painéis de lá ainda têm classe `content-panel`, então a varredura
genérica antiga de `alternarModulo()` ainda os esconde/mostra
corretamente por conta própria) — só não ganharam a UI de abas nova,
decisão consciente pra não ampliar demais o escopo desta rodada.

Sincronizado `core.js` e `estilos.css` em todos os 10 módulos
isolados. Validado: `node --check` em todo o projeto, balanceamento de
tags/CSS em tudo (principal + isolados), funções onclick/onchange/
oninput existem, conferência 1-a-1 de que todos os ids referenciados
no JS novo (`cad-aba-*`, `panel-*-lista`) existem no HTML na
quantidade certa.

**Sem teste visual real** — essa é uma reestruturação grande de
navegação, vale testar com cuidado: abrir cada uma das 7 abas, criar/
editar/voltar em Clientes e Funcionários (fluxo "-lista"↔"-form"), e
conferir que o item "📝 Cadastro" continua escondido pra quem não é
Administrador.

## 12.22. Rodada grande: zebra escuro, botão discreto, apontamento manual em 2 trilhas, Painel de Progresso — IMPLEMENTADO

**Zebra ainda mais escuro** (2ª rodada) — `#f8fafc` → `#e2e8f0`.

**Botão "Liberado pra Detalhamento" discreto**, na mesma linha do campo
"Nome Oficial da Obra" (`arvore.js`) — trocou o bloco grande com fundo
colorido e borda por um badge de texto (● + rótulo) e um botão-texto
sublinhado, os dois dentro do mesmo `<div style="display:flex">` do
input do nome.

**Apontamento manual — 2 lacunas reais corrigidas** (pedido do
usuário, "em todo local com relógio"):
- **Kanban, "Para revisão"**: `criarApontamentoManual()` (apontamento.js)
  passou a aceitar esse status além de "Em Desenvolvimento". Botão
  "📝 Apontar horas" no cartão agora também aparece nesse status —
  **e ganhou uma trava que não existia antes**: só aparece pra quem é
  DE VERDADE o Executor da tarefa (`usuarioLogado.nome === t.executor`),
  não só quem está vendo o cartão (um cartão pode aparecer no Kanban de
  outra pessoa também, ex: aba "Kanban" de quem tem a tarefa sob
  responsabilidade). Trava dupla: `criarApontamentoManual()` também
  rejeita quem não é o Executor, mesmo se a UI for burlada.
- **Trilha de Revisão**: nova função `criarApontamentoManualRevisao()`
  (apontamento.js) — autoatendimento pra quem tem autoridade de
  revisar (Responsável atribuído ou hierarquia), com a tarefa em
  "Aguardando Verificação". Nasce `status:'pendente'`, gravada direto
  em `tarefa.sessoes_revisao` (reaproveitando o array e a aba de
  aprovação "Sessões de Revisão", §12.13 — sem precisar de aba/array
  novo). Modal do Kanban (`abrirModalApontamentoManualKanban`)
  generalizado com um parâmetro de trilha (`kbApoTrilhaAtual`) — mesmo
  modal atende as duas trilhas agora, tabela e mensagens ajustam
  sozinhas. Botão "📝 Apontar horas de revisão" no cartão só aparece
  quando `podeRevisarTarefa()` (consultando o dado bruto via
  `localizarTarefaPorCaminho`, já que o objeto resumido do cartão não
  carrega `tarefa.responsavel`) confirma autoridade de verdade.
- **Adiado** (registrado, não feito): conferir/estender
  `abrirEditorSessoes()` (Atribuição de Tarefas) pra também mostrar/
  editar sessões de Revisão — é ferramenta de correção administrativa,
  não o autoatendimento que foi o foco desta rodada.

**Painel de Progresso dos Projetos** — módulo novo, `js/painel-progresso.js`.
Ocupa o espaço do antigo botão "📊 Dashboard" (antes só levava pra tela
em branco sem conteúdo — decisão tomada e avisada ao usuário, não
silenciosa). Uma linha por Projeto (só os que o usuário logado já tem
acesso, mesma regra de sempre), cada linha dividida em segmentos, um
por Etapa:
- **`calcularProgressoProjeto(nomeProjeto)`**: % de cada Etapa = soma
  da verba das Tarefas "Finalizada" ÷ verba total, agregando TODOS os
  Pavimentos da Etapa. Verba de cada Tarefa dentro de um Pavimento =
  fatia proporcional aos Pontos dela sobre o total de Pontos do
  Pavimento — mesma fórmula que `distribuicao-custos.js::recalcularGrupoVerbaPorTarefa()`
  já usa na aba "Verba por Tarefa", reimplementada aqui como função
  pura (sem DOM), pra rodar pra todos os projetos de uma vez. Testada
  isoladamente via Node (3 cenários: 1 pavimento, 2 pavimentos com
  pesos diferentes, projeto vazio).
- **Etapa "única"**: binário — 100% se a Tarefa dela está Finalizada,
  senão 0% (não tem Pavimento, não tem verba por área).
- **% dentro da barra** (não embaixo) — texto branco ou escuro
  dependendo do preenchimento, pra continuar legível.
- **Tooltip ao passar o mouse**: mostra o Pavimento com uma Tarefa "Em
  Desenvolvimento" agora (prioridade) ou, se não houver, o Pavimento da
  Tarefa Finalizada mais recentemente — usa **campo novo
  `tarefa.finalizada_em`** (timestamp), gravado em `arvore.js::salvarAlteracoesNo()`
  e `kanban.js::moverTarefaParaStatus()`, os dois lugares onde uma
  Tarefa passa a ser Finalizada. **Tarefas já finalizadas antes desta
  mudança não têm esse campo** — não aparecem na comparação de "mais
  recente", mas continuam contando normalmente pro cálculo da %.
- **Cor**: sempre verde por enquanto, como o usuário pediu — lógica de
  amarelo (risco)/vermelho (atraso) fica pendente, registrada à parte.
- **Largura dos segmentos**: igual entre todas as Etapas (não
  proporcional a nada) — não foi contestado no mockup mostrado antes.
- **Sem interatividade** (clicar num segmento não faz nada ainda) —
  não foi pedido, mantido simples por ora.

Sincronizado `core.js`, `kanban.js`, `arvore.js` em todos os módulos
isolados (`js/painel-progresso.js` é arquivo novo, sem módulo isolado
próprio — guardas defensivas em `core.js` evitam erro caso
`alternarModulo('progresso')` seja chamado num contexto sem esse
arquivo carregado). Validado: `node --check` em tudo, balanceamento de
tags, funções onclick/onchange/oninput existem, 2 testes isolados via
Node (fórmula de verba do painel + a mesma checagem de sempre).

**Ainda pendente, registrado à parte, NÃO implementado**: tela estilo
Gráfico de Gantt (o próprio usuário disse que precisa amadurecer a
ideia antes) — cor amarelo/vermelho do Painel de Progresso (mesmo
motivo, aguardando o usuário testar o verde primeiro).

## 12.23. Sincronização provisória multi-usuário (localStorage → Firebase) — IMPLEMENTADO, aguardando configuração e teste da equipe

Pedido do usuário: a equipe (cada um em rede/local diferente) precisa
testar o sistema e inserir dados usando o MESMO banco, não um
`localStorage` isolado por navegador/dispositivo como sempre foi até
aqui. Solução **deliberadamente provisória**, não a definitiva.

**Escopo medido antes de decidir a abordagem**: 292 chamadas diretas a
`localStorage.getItem/setItem`, espalhadas em 14 arquivos JS. Reescrever
cada uma pra virar chamada de rede assíncrona foi descartado (grande
demais, arriscado, impossível de testar num navegador de verdade nesta
sessão). Abordagem escolhida: um arquivo novo só
(`js/sync-provisorio.js`), que replica o `localStorage` inteiro pra um
Firebase Realtime Database compartilhado por trás — nenhuma das 292
chamadas existentes muda.

**Como funciona:**
- No boot, busca o banco inteiro no Firebase, sobrescreve o
  `localStorage` local, e dá **um único `location.reload()`** (controlado
  por `sessionStorage`, sem loop) pra garantir que os seeds/migrações de
  `core.js` já rodem em cima dos dados certos.
- Toda escrita (`Storage.prototype.setItem/removeItem/clear`,
  interceptado — ver exceção deliberada documentada no cabeçalho do
  arquivo à regra geral de não fazer monkey-patch) agenda um envio do
  `localStorage` inteiro pro Firebase, com debounce de 3s + reforço
  periódico de 30s + tentativa no `beforeunload`.
- Mudança feita por OUTRA pessoa enquanto a aba está aberta **não
  sobrescreve nada sozinho** (evita apagar edição em andamento) — só
  mostra um banner convidando a recarregar.
- `banco_identidade_teste_atual` (identidade de login automático,
  `MODO_TESTE_SEM_LOGIN`) fica de fora do que é sincronizado — é
  preferência de dispositivo, não dado de projeto.
- Interruptor único (`SYNC_PROVISORIO_ATIVO = false`) desliga tudo sem
  afetar mais nada do sistema.

**Configuração pendente do lado do usuário** (documentado em
`LEIA-ME_SYNC_PROVISORIO.md`, criado nesta rodada): precisa criar um
projeto Firebase gratuito (Realtime Database, modo de teste) e colar
`apiKey`/`databaseURL`/`projectId` no topo de `js/sync-provisorio.js`.
Enquanto não preenchido, o script detecta sozinho e roda 100% local, sem
quebrar nada.

**Arquivos tocados:** `js/sync-provisorio.js` (novo),
`index.html` (3 `<script src>` novos, SDK do Firebase + o arquivo acima,
carregando ANTES de `core.js`), `LEIA-ME_SYNC_PROVISORIO.md` (novo, passo
a passo de configuração).

**Deliberadamente NÃO sincronizado em `modulos_isolados/`** — são páginas
de teste isoladas de desenvolvimento, não a ferramenta que a equipe vai
usar pra inserir dados reais.

**Validado:** `node --check` em todos os `.js` reais, balanceamento de
`<div>` no `index.html` (317/317, sem mudança), sem colisão de nome de
função/constante com o resto do projeto, ordem de `<script>` conferida
(sync antes de `core.js`).

**Sem teste real ainda — nem no navegador, nem multi-usuário de
verdade.** Faltam, nesta ordem: (1) usuário criar o projeto Firebase e
preencher a config, (2) abrir num navegador pra confirmar que o boot
normal continua funcionando com o sync ativo, (3) testar de fato com
duas pessoas em redes diferentes editando ao mesmo tempo, pra validar o
comportamento de "último a salvar vence" e o banner de aviso na prática.

**Limitação a reavaliar mais pra frente** (registrado, não é bug):
sincroniza o banco inteiro a cada mudança, não por campo — funciona bem
pro volume de dados de teste, mas não escala pra uso real da equipe em
paralelo por muito tempo sem risco maior de conflito. Regras do Firebase
em "modo de teste" ficam abertas sem senha por 30 dias — aviso já
deixado no `LEIA-ME_SYNC_PROVISORIO.md`, não adequado pra dado real de
produção como está.

## 12.24. Correção pós-teste real: chave interna do Firebase quebrava o envio

Primeiro teste real do usuário (`file:///.../index.html`) travou o envio
pro Firebase com erro `set failed: value argument contains an invalid
key (firebase:host:...)`. Causa: `_syncColetarSnapshotLocal()` juntava
TODO o `localStorage`, inclusive chaves internas que o próprio SDK do
Firebase grava lá sozinho (ex: `firebase:host:...`), que contêm "."
(proibido como nome de nó no Realtime Database). Corrigido filtrando por
`SYNC_PROVISORIO_REGEX_CHAVE_INVALIDA = /[.#$\[\]]/` antes de montar o
snapshot — mesmo arquivo, `js/sync-provisorio.js`, nenhum outro tocado.

Ainda não confirmado se resolveu de fato (usuário vai testar de novo) —
próximo passo é ele recarregar e conferir se `precisao_estrutural_dados`
aparece preenchido no Firebase.

## 12.25. Correção da corrida de boot (login aparecendo em dispositivo/aba nova)

Segundo teste real (aba anônima, simulando "outra pessoa"): a tela de
login normal aparecia direto, em vez do MODO_TESTE_SEM_LOGIN pular pra
dentro. Causa raiz: `window.onload` (definido em `core.js`) podia disparar
ANTES da busca assíncrona no Firebase terminar — nesse caso o boot via
`localStorage` vazio, concluía "sem funcionário cadastrado" e caía na
tela de login de verdade. O reload automático (da v12.23) corrigia na
maioria dos casos, mas não garantia a tempo.

**Correção estrutural, não paliativa**: os 14 `<script src>` fixos de
`core.js` até `relatorios.js` saíram do `index.html`. Quem carrega esses
14 arquivos agora é o próprio `sync-provisorio.js`, em código, na MESMA
ordem de antes, um de cada vez (só carrega o próximo depois que o
anterior terminou) — mas só COMEÇA a carregá-los depois de já ter
buscado e aplicado os dados do Firebase (ou imediatamente, se a
sincronização estiver desligada/não configurada). Como isso acontece
depois do evento `load` da página já ter passado, `window.onload` nunca
dispararia sozinho — por isso, depois de carregar o último arquivo, o
script CHAMA `window.onload()` manualmente (é só uma função guardada
numa propriedade). O hack de `location.reload()` único (v12.23) foi
removido — não é mais necessário, a corrida foi eliminada na raiz.

**Efeito colateral consciente**: reescrever o arquivo do zero apagou a
configuração do Firebase que o usuário já tinha preenchido (2ª vez que
isso acontece — ver nota no fim desta seção). Já deixei `databaseURL` e
`projectId` pré-preenchidos (conhecidos pelas mensagens anteriores do
usuário), só falta ele colar o `apiKey` de novo.

**Arquivos tocados:** `js/sync-provisorio.js` (reescrito),
`index.html` (removidos os 14 `<script src>` estáticos do app; sobram só
os 2 do SDK do Firebase + o próprio sync-provisorio.js).

**Validado:** `node --check` em `sync-provisorio.js` e nos 14 arquivos
do app (sintaxe inalterada, não foram tocados), ordem da lista de
carregamento conferida contra a ordem original, balanceamento de `<div>`
no `index.html` (317/317, sem mudança de HTML de corpo).

**Ainda sem teste real** — usuário precisa colar o `apiKey` de novo e
repetir o teste da aba anônima.

**Nota de processo para próximas rodadas neste arquivo**: `create_file`
falha se o arquivo já existe, e reescrever via heredoc/bash (como feito
aqui e na v12.24) recria o arquivo do zero, sempre com os `"COLE_AQUI"`
originais — **da próxima vez que `sync-provisorio.js` precisar de
mudança estrutural grande, usar `str_replace` em vez de reescrever o
arquivo inteiro**, justamente pra não apagar a configuração já
preenchida pelo usuário de novo.

**Atualização**: `apiKey` preenchido pelo usuário, config completa. Teste
real em aba anônima **passou** — entrou direto, sem pedir login, corrida
de boot confirmada resolvida. Sincronização multi-usuário provisória
está funcional de ponta a ponta (envio confirmado no Console do Firebase
com dados reais do usuário; recebimento confirmado na aba anônima).
Próximo passo do usuário: distribuir o zip pra equipe testar em paralelo
de verdade (múltiplas pessoas, redes diferentes, ao mesmo tempo).

## 12.26. Config do Firebase separada em arquivo próprio + guia de hospedagem

Dois pedidos do usuário, resolvidos juntos: (1) parar de correr risco de
apagar a config do Firebase toda vez que `sync-provisorio.js` precisar
de reescrita grande (já aconteceu 2x — v12.24 e v12.25); (2) sair da
distribuição manual por zip, indo pra um link hospedado único.

**1) Separação de config**: `SYNC_PROVISORIO_ATIVO`,
`SYNC_PROVISORIO_CONFIG_FIREBASE`, `SYNC_PROVISORIO_CAMINHO`,
`SYNC_PROVISORIO_CHAVES_LOCAIS`, `SYNC_PROVISORIO_DEBOUNCE_MS` e
`SYNC_PROVISORIO_INTERVALO_MS` saíram de `js/sync-provisorio.js` e foram
pra um arquivo novo, `js/sync-provisorio-config.js` — carregado no
`index.html` ANTES de `sync-provisorio.js`. A ideia: daqui pra frente,
qualquer mudança na LÓGICA de sincronização mexe só em
`sync-provisorio.js`, nunca precisa tocar no arquivo de config — então
o `apiKey` já preenchido do usuário nunca mais corre risco de ser
sobrescrito por engano. Extração feita com `str_replace` pontual (não
reescrita do arquivo inteiro), preservando o `apiKey` real que o usuário
já tinha colado. `_syncInicializar()` ajustado pra também detectar
graciosamente o caso do arquivo de config não ter sido carregado (`typeof
SYNC_PROVISORIO_ATIVO === 'undefined'`), em vez de quebrar.

**2) Guia de hospedagem**: `LEIA-ME_HOSPEDAGEM.md` (novo) — passo a
passo pra publicar a pasta inteira no Netlify (opção rápida sem conta,
via Netlify Drop, e opção com conta pra link fixo), incluindo como
atualizar depois de cada zip novo que eu entregar. Isso é só
documentação/orientação — não fiz o deploy de fato (preciso de conta do
usuário, que não posso criar por ele).

**Arquivos tocados:** `js/sync-provisorio-config.js` (novo),
`js/sync-provisorio.js` (bloco de config removido via `str_replace`,
checagem de config ausente ajustada), `index.html` (1 `<script src>`
novo, antes de `sync-provisorio.js`), `LEIA-ME_SYNC_PROVISORIO.md`
(passos 3 e 5 atualizados pro novo arquivo), `LEIA-ME_HOSPEDAGEM.md`
(novo).

**Validado:** `node --check` nos dois arquivos JS, nenhuma constante
duplicada entre `sync-provisorio-config.js` e `sync-provisorio.js`,
todas as 6 constantes de config ainda referenciadas em
`sync-provisorio.js`, ordem de `<script>` conferida, `apiKey` real
preservado (não voltou a `"COLE_AQUI"`).

**Ainda não testado no navegador** com essa nova separação de arquivo —
mesmo sendo uma mudança mecânica (só mover código de um arquivo pro
outro, sem alterar lógica), o usuário precisa confirmar que o boot
continua funcionando igual antes de eu considerar isso fechado.

## 12.27. Hospedagem no Netlify confirmada — link definitivo da equipe

Usuário publicou a pasta no Netlify (deploy manual, "Netlify Drop").
Link de produção, testado e funcionando (aba anônima, sem pedir login,
dados reais carregando):

**https://gleaming-scone-2511ce.netlify.app**

Site estava marcado "Private" por padrão — usuário clicou em "Make
public" pra equipe conseguir acessar sem conta Netlify.

**Fluxo de atualização daqui pra frente**: sempre que eu entregar um zip
novo, o usuário extrai a pasta e arrasta ela de novo na área "Production
deploys" do painel do projeto no Netlify (`Drag and drop your project
folder here to deploy new changes`) — a equipe não precisa fazer nada,
só abrir o mesmo link de novo.

Com isso, a sincronização multi-usuário provisória (v12.23 a v12.27)
está fechada e operacional: dados no Firebase, código hospedado num link
único, config isolada num arquivo próprio. Segue valendo tudo que foi
registrado como limitação nas seções anteriores (last-write-wins,
regras do Firebase em modo de teste por 30 dias, não é solução
definitiva).

## 12.28. Ranking de Produtividade dos Executores — IMPLEMENTADO, sem teste real no navegador ainda

Pedido do usuário (agosto/2026): uma tela de ranking dos executores,
baseada em 2 variáveis — **Produtividade** (pontos das tarefas
finalizadas ÷ horas gastas pra finalizá-las) e **Pontos** (soma dos
pontos de todas as tarefas finalizadas pelo executor).

**Versão simples, combinada explicitamente com o usuário nesta
rodada**: sem o ajuste por Cargo e sem piso de volume mínimo de
tarefas que o desenho mais completo da §12.1 previa pro "Índice de
produtividade" — pode ser adicionado depois em cima desta base, se o
usuário quiser.

**Onde mora**: 3ª aba do Kanban do Executor (`🏆 Ranking`, ao lado de
"Meu Kanban"/"Kanban"), **não** em Relatórios nem em Atribuição de
Tarefas — decisão puxada pelo próprio controle de acesso já fechado
(§3.1): o Executor só tem o Kanban no menu, e o usuário confirmou que
o ranking de produtividade deve ser visível **pra todos os níveis**
(diferente da contribuição pro fundo de distribuição de lucro, que
ele já adiantou que será só pro Administrador — ver nota no fim desta
seção).

**`js/kanban.js`**:
- `calcularRankingProdutividadeExecutores()` — função pura (só lê
  `localStorage`, sem tocar DOM, testável isolada): percorre
  `banco_arvores_projetos` inteiro (todos os projetos, sem restrição
  de Analista — é uma métrica pessoal do executor, não algo
  específico de projeto), somando `pontos` e `horas_reais` de toda
  tarefa com `status === "Finalizada"`, por `executor`. Trata Etapa
  Única (`etapa.tipo === 'unica'`, §12.2) separado, igual o resto do
  projeto já faz. Retorna só quem tem soma de horas > 0 (produtividade
  não é uma taxa calculável dividindo por zero); nome de executor
  órfão (desligado/renomeado, sem correspondência em
  `banco_funcionarios`) ainda entra na soma, só fica sinalizado
  (`existe: false`) — decisão consciente, pra não "sumir" com o
  histórico de produtividade de alguém que já foi desligado.
- `renderizarRankingProdutividadeExecutores()` — ordena pelo critério
  ativo (`kbRankingOrdenarPor`, padrão `'produtividade'`, alternável
  por `alternarOrdemRanking('produtividade'|'pontos')`) e monta a
  tabela (`#kb-ranking-body`), com medalha 🥇🥈🥉 pros 3 primeiros.
- `alternarAbaKanban()` ganhou um 3º valor pra `kbAbaAtiva`
  (`'ranking'`), que esconde a área do quadro (`#kb-area-quadro`,
  wrapper novo em volta dos filtros + `#kb-quadro`, criado só pra
  poder escondê-los juntos) e mostra `#kb-ranking-area`; define o
  título da página direto (`'🏆 Ranking de Produtividade'`) em vez de
  chamar `renderizarQuadroKanban()` (que sobrescreveria o título com o
  texto errado — ver a lógica de título em `renderizarQuadroKanban()`,
  comentada perto da linha 790 do arquivo).

**`index.html`**: 3º botão de aba (`kb-aba-ranking`) dentro de
`.aprov-abas` (mesmo padrão visual já usado em Cadastro/Aprovações,
nenhum CSS novo), e a nova `#kb-ranking-area` (tabela com colunas Pos./
Executor/Pontos/Horas/Produtividade) depois do `#kb-area-quadro`.

**Testes:** 4 casos isolados via Node
(`calcularRankingProdutividadeExecutores()` extraída, sem DOM) — soma
correta pontos/horas de 2 executores misturando Etapa normal e Etapa
Única, tarefa não-finalizada não entra na conta, executor órfão ainda
soma mas fica sinalizado, executor com soma de horas = 0 não aparece
no ranking (evita divisão por zero), banco vazio não quebra. `node
--check` em todos os `.js` reais, balanceamento de `<div>` no
`index.html` (321/321, sem mudança), nenhuma duplicação de nome de
função/constante nova, todos os IDs novos referenciados no JS
conferidos contra o `index.html` (1 ocorrência cada). Sincronizado em
`modulos_isolados/kanban/` (`index.html` + `kanban.js`, mesma
validação repetida lá).

**Sem teste visual real no navegador ainda** — só validação estática
e o teste isolado da função de cálculo. Falta o usuário abrir a aba
"🏆 Ranking" de verdade (com dados reais ou de demonstração) e conferir
que a tabela aparece certa nos 3 níveis de acesso (inclusive Executor,
que é o caso que mais importa aqui).

**Nota de escopo 2 — Índice de custo no Ranking (Pontos por Real
gasto), EM MATURAÇÃO com a diretoria, NÃO IMPLEMENTAR ainda.** Conversa
adicional (agosto/2026): a Produtividade atual (pontos/hora) não
diferencia executores por custo — dois executores com a mesma taxa
pontos/hora impactam o caixa de forma diferente se um custa mais caro
por hora que o outro. Candidatos discutidos e descartados/aceitos:

- **Pontos ÷ Real gasto** (`custo_real = horas × valor_hora_vigente`)
  — candidato MELHOR AVALIADO pelo usuário. Vantagem sobre os outros
  dois: não depende de verba nem do valor de contrato do projeto, só
  de horas e valor/hora do próprio executor — não sofre a distorção de
  "projeto mais lucrativo → índice mais bonito, sem mérito do
  executor" que os outros dois candidatos têm.
- **% de aproveitamento da verba** (`custo_real ÷ verba_da_tarefa`) —
  descartado: verba/lucratividade varia por projeto/contrato, então o
  índice pode ficar bom só porque o projeto era mais gordo, não porque
  o executor foi mais eficiente. Também tem cobertura incompleta (só
  tarefas com verba definida na aba "Verba por Tarefa").
- **Reaproveitar o Saldo de contribuição** (nota de escopo 1, acima)
  como índice de Ranking — descartado pelo mesmo motivo: também
  distorce por projeto mais/menos lucrativo.

**Achado técnico importante, ainda sem solução fechada**: Produtividade
(`pontos/horas`) e Pontos-por-Real (`pontos/(horas×valor_hora)`), se
exibidos JUNTOS pra mesma pessoa, permitem calcular o `valor_hora`
exato dela por divisão simples
(`Produtividade ÷ Pontos-por-Real = valor_hora`) — vaza informação
salarial por dedução, mesmo sem nenhum valor em R$ aparecer na tela.
Duas saídas levantadas (nenhuma decidida): (a) Pontos-por-Real vira
Admin-only, Produtividade continua pra todos; (b) os dois viram
Admin-only. **Usuário decidiu amadurecer essa ideia com a diretoria
antes de fechar formato e visibilidade — não implementar nada disso
sem retomar a conversa.**

**Nota de escopo 1 — Distribuição de Lucro (fundo), DESENHO FINAL
fechado com o usuário (agosto/2026), IMPLEMENTADO (agosto/2026), sem
teste real no navegador ainda.** Substitui por completo a versão
anterior deste desenho (que usava `saldo = verba − custo_real` por
tarefa) — o usuário reconsiderou depois de falar com a diretoria. A
verba a distribuir **não** vem de "sobras" de produtividade
(diferença entre verba e custo real); vem de uma verba já definida e
calculada no sistema, só que ainda não usada pra nada depois de
calculada:

**Origem do dinheiro (já existe, não precisa criar):** aba 3 "Verba
para Detalhamento" da Distribuição de Custos já calcula
`valorLucros = pctLucros / 100 × verbaTotal` por projeto
(`js/distribuicao-custos.js::calcularVerbaDetalhamentoPuro()`,
`% Distribuição Lucros` é o único campo editável dessa aba). Hoje esse
valor só é usado pra ser DESCONTADO da verba que sobra pros pavimentos/
tarefas (`verbaLiquida = verbaTotal − valorLucros`, abas 4 e 5) — o
valor em si nunca é usado como origem de distribuição pra ninguém.
É isso que vai mudar.

**Etapa 1 — "quanto cada tarefa vale em lucro" (define o TAMANHO do
bolo, tarefa por tarefa):** `valorLucros` do projeto é rateado entre
os Pavimentos por Área Equivalente — **mesma fórmula da aba 4** (Verba
por Pavimento) — e dentro de cada Pavimento, entre as Tarefas por
Pontos — **mesma fórmula da aba 5** (Verba por Tarefa). Ou seja: um 6º
cálculo paralelo ao das abas 4/5 já existentes, só trocando o valor de
entrada (`valorLucros` no lugar de `verbaLiquida`) — a fórmula de
rateio (`aplicarVerbaProporcionalAosPavimentos`, e o equivalente por
Pontos na aba 5) é reaproveitável sem alteração, só chamada de novo
com outro número de entrada. Esse "valor de lucro da tarefa" não é o
que o estagiário recebe direto — ele só entra no bolo do período **no
momento em que a tarefa é finalizada** (tarefa não-finalizada não
contribui ainda).

**Etapa 2 — "quanto cada estagiário recebe do bolo" (distribuição
entre pessoas, no fim do período):**
- **Verba total do período** = soma do "valor de lucro" (Etapa 1) de
  toda tarefa finalizada dentro do período, de QUALQUER projeto —
  independente de quem executou a tarefa (mesmo uma tarefa feita por
  um Detalhista Sênior contribui dinheiro pro bolo; só a distribuição
  final é que é restrita a Estagiário — ver abaixo). **Assunção minha,
  não confirmada explicitamente pelo usuário — vale confirmar antes de
  implementar.**
- Cada Estagiário acumula **Pontos** ao finalizar tarefas — mesmo
  campo que já alimenta o Ranking de Produtividade (§12.28), nada
  novo aqui, só mais um uso do mesmo dado.
- A verba total do período se divide em 2 fatias, com o **% de cada
  fatia definido pelo Administrador a cada apuração de período**
  (confirmado pelo usuário — não é fixo no sistema):
  - **Fatia igualitária**: dividida em partes iguais entre todos os
    Estagiários.
  - **Fatia proporcional**: cada Estagiário recebe
    `(pontos do estagiário ÷ soma de pontos de TODOS os estagiários) × valor da fatia proporcional`
    — índice de proporcionalidade cru, baseado só em pontos
    acumulados; **não** pesado pelo "valor de lucro" (R$) específico
    das tarefas que aquele estagiário em particular executou (ver
    Etapa 1 — aquele valor só define o tamanho do bolo, não quem leva
    mais fatia).

**Quem participa:**
- Só **Estagiário** (Cargo começa com "estagiário" — cobre
  `estagiário pleno/senior/júnior`, já existem como opções fixas em
  `func-cargo`) acumula pontos pra Etapa 2 e recebe fatia da
  distribuição.
- **Funcionário comissionado** (`funcionario.forma_pagamento === 'comissionado'`,
  campo já existente no Cadastro) **não participa** — nem acumula
  pontos pra esse fim, nem recebe fatia. (Um comissionado ainda pode
  executar tarefas normalmente e ainda aparece no Ranking de
  Produtividade — essa exclusão vale só pra esta tela de distribuição
  de lucro.)

**Pontos que ficaram em aberto, resolvidos por ASSUNÇÃO na hora de
implementar** (usuário mandou "implemente, quero testar" sem voltar
pra fechar esses 2 — segui a saída mais simples e reversível em cada
um, igual já tinha avisado que faria):
- **"Verba total do período"**: confirmado como assumido — soma do
  "valor de lucro" (Etapa 1) de toda tarefa finalizada no período, de
  QUALQUER executor (não só Estagiário) e QUALQUER projeto. Só a
  distribuição final é restrita a Estagiário.
- **Definição de "período"**: virou só um FILTRO DE DATA sobre
  `tarefa.finalizada_em` (Data Início/Data Fim escolhidas pelo
  Administrador na tela, toda vez que apurar) — **não existe** conceito
  de "fechar" um período nem zerar Pontos depois. É uma consulta
  repetível, não-destrutiva: o Administrador pode apurar o mesmo mês
  várias vezes, ou meses diferentes, sem afetar nada. Se no futuro
  precisar de um controle de "período já pago, não conta de novo",
  isso ainda não existe — cada apuração é independente.
- Só pro Administrador ver essa tela — confirmado, sem mudança.

**IMPLEMENTADO (agosto/2026).** Arquivo novo `js/distribuicao-lucro.js`
(15º arquivo do app, adicionado à lista de carregamento dinâmico de
`js/sync-provisorio.js` — que não é o mesmo arquivo que
`sync-provisorio-config.js`, editado pontualmente aqui igual sempre,
não reescrito). Funções puras (testáveis sem DOM):
- `calcularValorLucroPorTarefaDoProjeto(nomeProjeto)` — Etapa 1,
  reaproveita `aplicarVerbaProporcionalAosPavimentos()`,
  `listarPavimentosDoProjeto()` e `calcularVerbaDetalhamentoSalvo()` de
  `distribuicao-custos.js` (mesma página, sem duplicar fórmula nenhuma)
  — só troca `verbaLiquida` por `valorLucros` como entrada.
- `calcularBoloTotalDoPeriodo()` — soma o valor de lucro de toda
  tarefa Finalizada com `finalizada_em` dentro do período, em todos os
  projetos.
- `calcularPontosPorEstagiarioNoPeriodo()` — mesma travessia genérica
  do Ranking de Produtividade (Etapa Única/Sub-etapas direto em
  `etapa.tarefas`, Subdividida em Setor›Pavimento›Tarefa), filtrada por
  data e contando qualquer executor (o filtro por Estagiário acontece
  depois, na apuração final).
- `calcularApuracaoDistribuicaoLucro()` — função central, junta as duas
  contas: filtra Estagiários ativos (Cargo começa com "estagiário",
  não-comissionado, sem `dt_desligamento`), calcula fatia igualitária
  (bolo × %Admin ÷ nº de Estagiários ativos) e fatia proporcional
  (resto do bolo × pontos-da-pessoa/soma-de-pontos), soma os dois por
  pessoa, ordena por total decrescente.

**Tela**: novo item de menu "🎓 Distribuição de Lucro (Estagiários)",
só-Administrador (`MENU_POR_NIVEL`, `js/core.js`), ao lado do já
existente "💰 Fundo Global Fechamento" (que é uma feature DIFERENTE,
pré-existente — consolidação de sobras/prejuízo por projeto entre
todos os projetos, não relacionada a Estagiários por Pontos — não
mexida). Campos: Data Início/Fim, % Fatia Igualitária (resto vai pra
Proporcional), botão "Apurar", 4 cards-resumo (bolo total, fatia
igualitária total, fatia proporcional total, soma de pontos), tabela
por Estagiário (Pontos no período, Fatia Igualitária, Fatia
Proporcional, Total).

**Testes**: 15 casos isolados via Node — rateio por Pavimento/Tarefa
bate matematicamente (25%/75% de Área Equivalente, depois 25%/75% de
Pontos dentro do Pavimento, soma final = valorLucros de entrada),
filtro de período exclui tarefa finalizada fora do range, Pontos somam
certo atravessando Subdividida+Sub-etapas+Única no mesmo período,
apuração final exclui corretamente desligado/comissionado/não-
estagiário, fatia igualitária igual pra todos, fatia proporcional bate
com a conta manual, soma dos totais individuais fecha com o bolo
inteiro, bolo zero/sem estagiário não quebra. `node --check` em todos
os `.js` reais, balanceamento de `<div>` em todos os `.html`, todos os
IDs novos conferidos (1 ocorrência cada).

**Não sincronizado em `modulos_isolados/`** — essa é uma peça nova
demais pra caber em algum módulo isolado já existente (não é uma
extensão de Kanban/Árvore/Cadastro/Catálogo/Atribuição/Relatórios, é
um domínio próprio) e criar um módulo isolado do zero pra ela ficou
fora do escopo desta rodada; os testes isolados via Node cobrem a
lógica de cálculo (a parte que mais importa validar), mas a tela em si
só foi validada estaticamente (IDs, balanceamento), não teve
`modulos_isolados` dedicado.

**Sem teste real no navegador ainda** — falta o usuário: ter ao menos
1 projeto com % Distribuição de Lucros preenchido na aba 3, Pavimentos/
Tarefas com Pontos, pelo menos 1 tarefa Finalizada dentro de um
período recente, e pelo menos 1 Funcionário com Cargo "estagiário..."
sem desligamento — aí abrir "🎓 Distribuição de Lucro", escolher o
período, e conferir se o bolo e a tabela batem com o esperado.

**Nota lateral, ainda válida:** a verba por tarefa individual (usada
na Etapa 1 dos cálculos de aba 4/5 hoje) **já existe**, calculada ao
vivo por `distribuicao-custos.js::recalcularGrupoVerbaPorTarefa()` na
aba "Verba por Tarefa" (coluna "Valor", `.vt-valor`), com a fórmula
`valorTarefa = (pontos_da_tarefa / totalPontos_do_pavimento) × valorVerba_do_pavimento`.
Não é persistido como campo na tarefa — recalculado sempre a partir de
`pontos` e do `valorVerba` do Pavimento. O mesmo padrão de rateio serve
de modelo direto pra Etapa 1 acima, só trocando `verbaLiquida` por
`valorLucros` como entrada.

**Só pra visibilidade — continua igual:** o índice de custo do
Ranking (Pontos ÷ Real gasto), tratado na Nota de escopo 2 acima,
continua sendo uma ideia SEPARADA desta, ainda em maturação com a
diretoria.


## 12.29. Sub-etapas — pedido da diretoria (agosto/2026), IMPLEMENTADO, sem teste real no navegador ainda

Nova categoria opcional dentro de uma Etapa: uma Etapa pode ter zero,
uma ou várias Sub-etapas vinculadas a ela. Fechado com o usuário até
aqui:

- **Cadastro**: 5ª categoria do Catálogo Lego (`js/catalogo-lego.js`),
  mesmo padrão de Etapas/Setores/Pavimentos/Tarefas — nomes
  reaproveitáveis entre projetos, cadastrados uma vez, plugados depois
  na árvore de cada projeto.
- **Sub-etapa É uma Tarefa** (confirmado pelo usuário) — reaproveita
  o mesmo modelo de dados e comportamento que Tarefa já tem hoje:
  `status` (Apontada → Em Desenvolvimento → ... → Finalizada),
  apontamento de horas (`horas_reais`, sessões, cronômetro), `pontos`,
  `executor`, aparece no Kanban normalmente. **Normalmente não precisa
  de mais subdivisão** — ela já é o "fim da linha" (não tem Setor/
  Pavimento por baixo dela, na maioria dos casos).
- **Verba**: cada Sub-etapa recebe uma fatia da verba da **Etapa**
  (não do Pavimento — Sub-etapa não depende de área/peso de esforço
  nenhum). Atribuição é **manual**: a pessoa digita o valor de cada
  Sub-etapa na hora de criá-la no projeto, e o sistema confere se a
  soma de todas as Sub-etapas bate com a verba total da Etapa (mesmo
  padrão de "selo de conferência" ✅/⚠️ que já existe em
  `distribuicao-custos.js::exibirSeloConferencia()`, usado hoje entre
  Pavimentos e a Verba Detalhamento Líquida — reaproveitável aqui sem
  reinventar).
- **Exemplo do usuário**: Etapa "Análise" com Sub-etapas "Reunião
  inicial de projeto", "Elaboração de pré-lançamento",
  "Compatibilização de fachadas" — desenvolvidas pelo Analista do
  projeto, que aponta horas em cada uma separadamente.

**Em aberto, precisa decidir antes de implementar:**
- **Relação com os tipos de Etapa que já existem** (`tipo: 'unica'` —
  1 única tarefa automática, verba = `custo_max` manual direto, sem
  passar pela verba da Etapa; `tipo: 'subdividida'` — Setor › Pavimento
  › Tarefa, verba rateada por Área Equivalente). Sub-etapas parece ser
  um **3º modo**, mais parecido com uma evolução do `'unica'` (que hoje
  só permite EXATAMENTE 1 tarefa) pra permitir **N** tarefas linkadas
  direto na Etapa, cada uma com verba própria manual — mas isso não
  foi confirmado explicitamente. Precisa decidir: é um novo valor de
  `etapa.tipo` (ex.: `'com_subetapas'`), ou o `'unica'` vira capaz de
  ter N tarefas em vez de força 1 só?
- Onde entra no formulário de "encaixar peça na árvore"
  (`js/arvore.js::atualizarFormularioEncaixeEtapa()` hoje só alterna
  entre 2 blocos de campos, `box-etapa-subdividida` e
  `box-etapa-unica` — precisaria de um 3º bloco, ou um botão "+
  Adicionar Sub-etapa" dentro do bloco da Etapa já criada).
- Como a "Verba da Etapa" (que a Sub-etapa divide) é calculada, já que
  hoje só existe cálculo de verba a partir da aba 3 (`valorLucros`/
  `verbaLiquida`) por PROJETO, não por Etapa individual — precisa
  achar/confirmar de onde vem "a verba desta Etapa especificamente".

**Nota relacionada, registrada à parte (mesma conversa) — bug relatado
pelo usuário, NÃO investigado em navegador ainda:** tarefas de Etapa
Única (`tipo: 'unica'`) sob responsabilidade do Analista não aparecem
no Kanban dele ("como tarefa a ser desenvolvida"). Inspeção do código
(sem teste no navegador) não achou bug estrutural óbvio —
`coletarTarefasDoExecutor()` já percorre Etapa Única e já casa por
`tarefa.executor`, que É preenchido com o nome do Analista do projeto
no momento em que a Etapa é criada
(`js/arvore.js::salvarPecaNaArvore()`). **Hipótese levantada**: esse
`executor` é uma cópia congelada do nome do Analista no momento da
criação da Etapa — se o projeto trocou de Analista depois, a tarefa
antiga fica "órfã" do Analista atual, e nunca aparece pra ele.
Aguardando o usuário confirmar se é esse o cenário, antes de
diagnosticar mais. Relacionado a Sub-etapas porque, se Sub-etapa vira
mesmo uma evolução do `'unica'`, os dois problemas podem acabar sendo
resolvidos juntos.

**IMPLEMENTADO (agosto/2026), decisões assumidas (não estavam 100%
fechadas antes de codar — usuário pediu "implemente agora" sem
resolver os 2 pontos em aberto acima; assumi a saída mais simples e
reversível em cada um):**
- **3º valor de `etapa.tipo`: `'subetapas'`** (não uma evolução do
  `'unica'` — ficou como um tipo à parte, pra não arriscar quebrar o
  comportamento de `'unica'` já em produção). Estrutura:
  `{ nome, tipo: 'subetapas', verba_total: "R$", tarefas: [...] }` —
  cada item de `tarefas` é uma Tarefa normal (mesmos campos de sempre:
  status/executor/pontos/horas_reais/apontamento) **mais** um campo
  `verba` (string numérica, manual).
- **Catálogo**: 5ª categoria (`banco_subetapas_lego`) — aba "Sub-etapas"
  no Cadastro, reaproveitando o padrão genérico já existente pra
  Setores/Pavimentos (só nome, sem campos extra no catálogo — Executor/
  Pontos/Verba são preenchidos por instância, na árvore).
- **Verba**: manual, digitada por Sub-etapa; selo ✅/⚠️ (soma das
  Sub-etapas vs. `verba_total` da Etapa) aparece direto no cabeçalho da
  Etapa na árvore — reaproveita o mesmo padrão visual de
  `exibirSeloConferencia()` (aba 4 da Distribuição de Custos), só que
  calculado inline em vez de chamar a função (contexto diferente, sem
  DOM de tabela).
- **Onde mexeu**: `index.html` (aba Cadastro nova, opção no dropdown de
  tipo de Etapa), `js/core.js` (`ABAS_CADASTRO`, título da aba),
  `js/catalogo-lego.js` (dropdown de edição de tipo), `js/arvore.js`
  (form de encaixe com a 3ª caixa "Verba Total da Etapa", tipo novo
  `'subetapa'` no form de peça — Executor/Verba/Pontos — renderização
  na árvore com botão "+ Sub" e selo, detalhe/edição/remoção
  individual de cada Sub-etapa — **corrigido pra não herdar as travas
  de Etapa Única** que compartilhavam o mesmo formato de path de 2
  posições: Sub-etapa TEM Executor livremente editável e PODE ser
  removida individualmente, diferente de Etapa Única). Travessia
  estendida (`etapa.tipo === 'unica' || etapa.tipo === 'subetapas'`) em
  `js/apontamento.js`, `js/aprovacoes-calendario.js`,
  `js/atribuicao-tarefas.js`, `js/kanban.js` (inclusive o Ranking de
  Produtividade, §12.28 — Sub-etapa finalizada já soma Pontos pro
  executor dela) e `js/relatorios.js`. `js/painel-progresso.js` ganhou
  cálculo próprio de % (peso pela Verba de cada Sub-etapa, não por
  Pontos — mesmo espírito do bloco "subdividida", só num nível só).
  `js/bi.js` e `js/distribuicao-custos.js` (abas 4/5) já ignoravam
  Etapa Única sem precisar de código novo — Sub-etapas herda esse
  mesmo comportamento de graça (nenhuma das duas tem `.setores`).
  **NÃO mexeu** nas 4 migrações de dados antigos em `js/core.js`
  (`marcadorV5`/`marcadorV9` etc.) — são scripts de correção histórica
  de dados de ANTES dessa feature existir, não fazem sentido pra dado
  novo.
- **Testes**: 7 casos isolados via Node (travessia genérica encontra
  as 3 Sub-etapas de exemplo junto com Única/Subdividida, path de 2
  posições correto, selo de conferência de verba bate, % de progresso
  pesado por verba, Ranking soma Pontos de Sub-etapa finalizada).
  `node --check` em todos os `.js` reais (só falhou um arquivo em
  `arquivo_antigo/`, órfão, pré-existente, fora do sistema ativo).
  Balanceamento de `<div>` em todos os `.html` do projeto. Sem
  duplicação de ID novo. Sincronizado em `modulos_isolados/arvore/`,
  `/atribuicao-tarefas/`, `/cadastros/`, `/catalogo/`, `/kanban/`,
  `/relatorios/` (todos os módulos isolados que usam algum dos
  arquivos tocados).

**Sem teste visual real no navegador ainda** — só validação estática e
os testes isolados da lógica pura. Falta o usuário: cadastrar uma
Sub-etapa no Catálogo, criar uma Etapa tipo "Sub-etapas" numa árvore de
projeto de verdade, adicionar 2-3 Sub-etapas, conferir o selo de
verba, apontar horas numa delas pelo Kanban, finalizar, e conferir que
ela aparece no Ranking de Produtividade.

**CORRIGIDO (agosto/2026)**: a aba "🧩 Sub-etapas" do Cadastro estava
na última posição da barra (depois de Tarefas) — reordenada pra ficar
**ao lado da aba Etapas** (ordem atual: Clientes, Funcionários,
Projetos, Etapas, **Sub-etapas**, Setores, Pavimentos, Tarefas).
Mudança feita em `index.html` (posição do botão `#cad-aba-subetapas`)
e no array `ABAS_CADASTRO` de `js/core.js`, mantendo a ordem de
navegação por Tab/Enter consistente com a visual. Sincronizado em
`modulos_isolados/catalogo/`.

## 12.30. Etapas Default no Cadastro de Projeto — pedido da diretoria (agosto/2026), v2 IMPLEMENTADA, sem teste real no navegador ainda

**Histórico**: a primeira versão (abaixo, "v1") foi implementada e
depois o usuário corrigiu o desenho ("v2") — a v1 ficou **obsoleta**,
vai precisar ser desfeita/reescrita quando for autorizado a mexer de
novo. Não mexer em nada até o usuário autorizar explicitamente (regra
geral do projeto, §13 item 5).

### v2 — desenho corrigido (agosto/2026), É ESTE que vale, AINDA NÃO IMPLEMENTADO

- **Gravação no banco acontece no instante do Cadastro do Projeto**
  (ao clicar "Salvar" em `cadastros.js::salvarProjeto()`), não mais na
  primeira vez que alguém abre a Árvore de Projeto (isso era a v1,
  agora obsoleto).
- **O formulário de Cadastro de Projetos ganha campos novos**: uma
  mini lista de Etapas — inserir, editar, deletar — dentro da própria
  tela de Cadastro, na fase de criar/editar o projeto. Pré-populada com
  as 4 Etapas Default (Pré-Lançamento, Lançamento, Análise,
  Detalhamento), mas o usuário pode mexer nela ali mesmo, antes de
  salvar (tirar uma, adicionar outra, etc.) — mesmo espírito de "ponto
  de partida editável" de antes, só que a edição acontece um passo
  antes (no Cadastro, não na Árvore).
- **Ao salvar o projeto, essa lista de Etapas é "replicada" pra
  árvore** — grava direto em `banco_arvores_projetos[nomeProjeto].etapas`,
  no mesmo formato que `criarEtapaDefaultAPartirDoCatalogo()` (v1) já
  sabe montar por tipo (reaproveitável — só muda O QUANDO ela é
  chamada e DE ONDE vem a lista de nomes, que antes era fixa
  `ETAPAS_DEFAULT_NOMES` e agora vem do que o usuário escolheu no mini
  editor do Cadastro).

**Decidido pelo usuário (agosto/2026)**: a lista de Etapas do mini-editor
do Cadastro **nunca se aplica em edição** — vale só no instante de
CRIAÇÃO do projeto (branch `i === ""` de `salvarProjeto()`). Editar um
projeto já existente não mexe na árvore dele por essa via, mesmo que o
usuário altere a lista de Etapas no formulário — sem risco de
sobrescrever trabalho real já feito (Setores/Pavimentos/Tarefas/horas
apontadas).

**Decidido pelo usuário (agosto/2026)**: o mini-editor de Etapas dentro
do Cadastro de Projetos pede, por linha, só **Nome** (dropdown do
Catálogo de Etapas, igual a Árvore já faz) + **Tipo** (herdado do
Catálogo, só-leitura ali — não editável no mini-editor). Nenhum campo
extra.

**v2 IMPLEMENTADA (agosto/2026)**, exatamente como desenhado —
`js/cadastros.js` ganhou: `ETAPAS_DEFAULT_NOMES` (as 4, movida de
`arvore.js` pra cá — é aqui que ela é usada agora), `projTempEtapasDefault`
(lista temporária em memória, mesmo padrão de `projTempEmailsResponsaveis`
já usado pros e-mails do projeto), e 4 funções novas:
`popularDropdownEtapaNomeProjeto()`, `atualizarTipoEtapaSelecionadaProjeto()`,
`renderizarTabelaEtapasProjeto()`, `adicionarEtapaProjeto()`,
`removerEtapaProjeto()`. `abrirFormulario('projetos', true)` pré-popula
`projTempEtapasDefault` com as 4 (só as que ainda existem no Catálogo)
e mostra a seção nova do formulário (`#proj-secao-etapas`); em edição
(`isNovo === false`) essa seção fica escondida. `salvarProjeto()`, só
no branch de criação (`i === ""`), grava a árvore direto em
`banco_arvores_projetos[nome]` reaproveitando
`criarEtapaDefaultAPartirDoCatalogo()` (que continua em `arvore.js`,
chamada daqui já que os dois arquivos compartilham a mesma página) —
usando o Analista/Supervisor REAIS escolhidos no formulário, não mais
nomes fixos como o placeholder antigo de `abrirProjetoNaArvore()`
usava. `arvore.js::abrirProjetoNaArvore()` voltou a ser só o lazy-init
simples de sempre (`etapas: []`), sem checar flag nenhum — a v1
(`usar_etapas_default`, `popularEtapasDefault()`) foi removida por
completo do código, não só desativada.

Testado com 8 casos isolados via Node (lista default de 4 grava certo,
Analista real usado em vez de nome fixo, Etapa Única já nasce com esse
mesmo Analista como executor, lista customizada pelo usuário — tirando
uma, adicionando outra fora das 4 — grava exatamente o que foi pedido,
lista vazia não quebra). `node --check` em todos os `.js` reais,
balanceamento de `<div>` em todos os `.html`, IDs novos conferidos.
Sincronizado em `modulos_isolados/cadastros/` e `/arvore/` (inclusive
o HTML do mini-editor replicado no módulo isolado de Cadastro). **Sem
teste real no navegador ainda** — falta o usuário abrir "+ Incluir
Novo Projeto", ver as 4 Etapas já na lista, mexer nela (tirar/
adicionar), salvar, e conferir na Estrutura de Projeto que a árvore já
nasceu com exatamente o que ficou na lista.

### v1 — IMPLEMENTADO, agora obsoleto e REMOVIDO do código (mantido aqui só de registro histórico)

`nv.usar_etapas_default = true` gravado em `cadastros.js::salvarProjeto()`
só na criação (branch `i === ""`), e
`arvore.js::abrirProjetoNaArvore()` lê esse flag do `banco_projetos`
(por nome do projeto) antes de inicializar `etapas: []` — se `true`,
chama `popularEtapasDefault()` (função pura, sem DOM), que por sua vez
chama `criarEtapaDefaultAPartirDoCatalogo()` pra cada uma das 4,
replicando a mesma lógica de criação por tipo que `salvarPecaNaArvore()`
já usa (incluindo o tipo `'subetapas'` da §12.29). Fallback: pula
silenciosamente qualquer uma das 4 que não exista mais no Catálogo.
Testado com 4 casos isolados via Node. Sincronizado em
`modulos_isolados/arvore/` e `/cadastros/`. **Continua no código hoje,
funcionando** — só vai ser substituído quando a v2 for autorizada e
implementada.

### Correção pós-implantação (agosto/2026) — bug de comparação exata + layout + edição in-place

Usuário testou a v2 e relatou que as 4 Etapas Default pareciam não vir
prontas ("preciso inseri-las manualmente"), e que os campos do
mini-editor ficaram mal distribuídos na tela. Auditoria confirmou que
a lógica de pré-popular automaticamente **já estava correta desde o
início** (roda sozinha ao abrir "+ Incluir Novo Projeto", sem precisar
de nenhuma ação do usuário) — mas achei uma causa raiz plausível pro
sintoma relatado: a comparação `ETAPAS_DEFAULT_NOMES` × Catálogo era
por **igualdade EXATA de string** (`e.nome === nome`) — qualquer
diferença mínima de espaço, maiúscula/minúscula entre o que foi
digitado no Catálogo de Etapas e a lista fixa fazia aquela etapa sumir
SILENCIOSAMENTE da lista automática, sem aviso nenhum, dando a
impressão de que "não veio pronta".

**Corrigido**: nova função `normalizarNomeEtapa()` (trim + lowercase)
usada só na hora de CASAR os nomes; o valor efetivamente guardado em
`projTempEtapasDefault` continua sendo o nome EXATO como está gravado
no Catálogo (não o literal fixo), então tudo que vem depois (tabela,
`salvarProjeto()`) continua funcionando com comparação exata, sem
risco de duplicar a fragilidade. Testado com 5 casos isolados via Node
reproduzindo o cenário exato do bug (espaço extra, maiúsculas, etapa
genuinamente ausente continua sendo pulada — só o "quase igual" que
era o problema).

**Layout**: reordenado — antes a linha de "adicionar" (dropdown + Tipo
+ botão) vinha ANTES da tabela, dando a impressão de que era preciso
preencher aquilo primeiro; agora a tabela (já pré-preenchida com as 4)
vem primeiro, com uma frase deixando claro que já vem pronto, e a
linha de "adicionar outra Etapa" fica depois, como ação opcional
secundária. Título da seção encurtado (tirei a explicação sobre
edição, que já é redundante já que a seção inteira some ao editar).
Proporção das colunas revisada (6/4/2 em vez de 7/3/2). Sincronizado
em `modulos_isolados/cadastros/`.

**Edição in-place adicionada (mesma rodada)**: usuário pediu
explicitamente pra dar pra "inserir novas, excluir as pré-selecionadas,
editá-las" — inserir e excluir já funcionavam, mas editar uma linha só
dava pra fazer excluindo e recriando. Redesenhado no mesmo espírito da
aba "Distribuição de Custos Analista" (`distribuicao-custos.js`,
citada pelo próprio usuário como referência) — um campo editável DIRETO
em cada linha da tabela, sem formulário separado: cada linha agora tem
seu próprio `<select>` já com a Etapa atual marcada
(`alterarEtapaNaLinhaProjeto()`), trocar o valor ali edita a linha na
hora. O dropdown+campo Tipo+botão que ficavam separados da tabela
foram removidos — agora é só a tabela e um botão "+ Adicionar Linha"
(pega a primeira Etapa do Catálogo ainda não usada; se todas já
estiverem na lista, avisa em vez de duplicar). Proteção contra
duplicar a mesma Etapa em 2 linhas (editar uma linha pra uma Etapa que
já está em outra é bloqueado, com aviso). Confirmado: ao salvar, a
lista final (depois de qualquer inserção/edição/exclusão feita nessa
tela) é o que vai pra `banco_arvores_projetos` — comportamento de
`salvarProjeto()` não mudou nessa rodada, só a interface de montar a
lista antes de salvar. Testado com 8 casos isolados via Node (edição
sem conflito, edição bloqueada por duplicata, adicionar linha pega a
certa, todas em uso não duplica, catálogo vazio não quebra).
Sincronizado em `modulos_isolados/cadastros/`.

**Layout compacto em grid (mesma rodada)**: usuário pediu pra ver
todas as Etapas numa tela só, sem rolar, com linhas mais baixas,
dividido em mais colunas, e Tipo próximo da Ação. Trocado o `<table>`
vertical por um grid CSS responsivo
(`display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))`)
— quantas colunas cabem depende da largura da tela, ajusta sozinho.
Cada Etapa virou um bloco curto e compacto:
`[seletor de Etapa — cresce] [Tipo — texto pequeno] [🗑️]`, os 3
lado a lado, bem juntos (Tipo logo antes do botão de Ação, sem nada no
meio). `id="proj-tabela-etapas-body"` continua o mesmo, só trocou de
`<tbody>` pra `<div>` com grid — `renderizarTabelaEtapasProjeto()`
reescrita pra gerar blocos `<div>` em vez de `<tr>`. Testado com 10
casos isolados via Node (HTML balanceado, 1 seletor + 1 rótulo de Tipo
+ 1 botão por item, os 3 tipos de Etapa aparecem certos, Tipo
realmente fica imediatamente antes do botão dentro do mesmo bloco,
lista vazia não quebra). Sincronizado em `modulos_isolados/cadastros/`.

### Bug corrigido (agosto/2026) — só vieram 3 das 4 Etapas Default; faltava "Pré-Lançamento"

Usuário testou no navegador e reportou (com print da tela real): ao
inserir um projeto novo, só 3 das 4 Etapas Default vieram
pré-marcadas — faltava especificamente **"Pré-Lançamento"**
(Lançamento, Análise e Detalhamento vinham certas). Isso confirmou a
hipótese técnica já registrada: `normalizarNomeEtapa()` (§12.30) só
resolvia diferença de espaço/maiúscula, não de acento nem de hífen —
"Pré-Lançamento" é a única das 4 com os dois ao mesmo tempo.

**Corrigido**: `normalizarNomeEtapa()` ganhou remoção de acentos
(`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`, técnica padrão
em JS pra remover diacríticos) e passou a tratar hífen como espaço
(`.replace(/-/g, ' ')`, com colapso de espaços múltiplos depois).
Continua guardando o nome EXATO do Catálogo depois de casar — só a
comparação ficou mais tolerante, nada mudou em como o nome é exibido
ou salvo. Testado com 5 casos isolados via Node (reproduz o bug real —
"Pré Lançamento" sem hífen no Catálogo —, cobre variações sem acento
nenhum, confirma que o que já funcionava antes — espaço/maiúscula —
não regrediu, e confirma que uma etapa GENUINAMENTE diferente continua
sendo ignorada — a correção não ficou permissiva demais). Sincronizado
em `modulos_isolados/cadastros/`.

**Sem teste real no navegador ainda** — falta o usuário criar outro
projeto novo e conferir se as 4 Etapas vêm certas agora.

## 12.31. Árvore Genérica Recursiva — pedido do usuário (agosto/2026), ETAPA 1 e ETAPA 2 IMPLEMENTADAS — maior reestruturação já cogitada pro sistema

Ideia do usuário: generalizar a regra que hoje só existe pra Etapa
(`'unica'`/`'subetapas'`/`'subdividida'`) pra **qualquer nível** da
árvore, recursivamente:

> Projeto → Etapas (opcional). Etapa → Sub-etapas OU Setores
> (qualquer um dos dois, opcional). Setor → Pavimentos (opcional).
> Pavimento → Tarefas (opcional). **Se um nível não tem filho do
> nível de baixo, ele PRÓPRIO vira a tarefa final** — carrega os
> mesmos campos que Tarefa já tem hoje (status, executor, pontos,
> apontamento de horas, `finalizada_em`, etc.), em vez de ficar sendo
> um container vazio.

**As 3 decisões que o usuário já fechou:**
1. Nó que vira tarefa final ganha os **mesmos campos que Tarefa já
   tem hoje** — nenhum campo a mais/a menos por nível.
2. A verba de um nó-tarefa vem da **distribuição de custos** — não é
   manual (diferente de como ficou Sub-etapas, que usa verba manual
   por item — ver §12.29; esse desenho novo, se implementado,
   provavelmente SUBSTITUI aquele mecanismo manual).
3. **Substitui por completo** os 3 tipos de Etapa que acabaram de ser
   implementados (`'unica'`, `'subetapas'`, `'subdividida'`) — eles
   viram casos particulares da regra geral: "Única" = Etapa sem Setor,
   1 tarefa; "Sub-etapas" = Etapa sem Setor, N tarefas; "Subdividida"
   = Etapa com Setor.
4. **Critério de disputa por verba entre irmãos, quando um nó vira
   tarefa pulando um nível**: ver "Regra final" logo abaixo — não é
   tão simples quanto uma resposta única, envolve 2 papéis diferentes
   pra Pontos.

**REGRA FINAL (agosto/2026) — passou por 2 correções até fechar, essa
é a versão que vale:**

- **Pontos tem 2 papéis, ao mesmo tempo, sem conflito:**
  1. **Toda folha (nível de execução — o nó virou tarefa) TEM Pontos**
     — sempre, universal, seja ela Etapa-folha, Sub-etapa, Setor-folha
     ou Pavimento-folha. É a estimativa de horas razoáveis pra
     executar aquilo, igual já é hoje pra Tarefa.
  2. **Todo container TEM Pontos = soma dos Pontos dos filhos**,
     recursivamente, subindo a árvore até o Projeto. Puramente
     informativo/estimativa (não decide dinheiro nenhum) — ex.:
     Pontos do Pavimento = soma dos Pontos das Tarefas vinculadas a
     ele (exatamente como o usuário confirmou).
- **A disputa por VERBA entre irmãos não segue sempre Pontos** — só
  segue Pontos onde **não existe dado físico de Área/Peso**. Onde
  existe (hoje, só em Pavimento), a disputa continua por **Área
  Equivalente**, mesmo o Pavimento tendo Pontos também (os dois
  convivem — Pontos ali é só a estimativa de hora, não decide a
  fatia de dinheiro). Resumindo por nível:
  - **Pavimento** (quando existe, com Setor/Pavimento de verdade):
    disputa por Área Equivalente entre si — **regra já existente,
    sem mudar nada** (abas 4/5 da Distribuição de Custos).
  - **Tarefa dentro de Pavimento**: disputa a verba DO Pavimento por
    Pontos — **regra já existente, sem mudar nada** (aba 5).
  - **Qualquer outro nó que vire folha SEM ter passado por um
    Pavimento** (Etapa-folha, Sub-etapa, Setor-folha): disputa por
    **Pontos**, porque não tem Área/Peso — é o caso genuinamente
    NOVO que esse desenho introduz.

**De onde vem a verba que cada Etapa distribui pra baixo — CONFIRMADO
contra o código, não é nada novo, já existe:**
- **Aba 1 (Orçamento Global)**: Administrador define % Analista / %
  Supervisor / % Escritório sobre o Valor Líquido do contrato
  (`js/distribuicao-custos.js`, `calcularVerbaDetalhamento()`).
- **Aba 2 (Distribuição de Custos Analista,
  `banco_distribuicao_custos_analista`)**: a fatia do Analista é
  dividida por %, **uma linha por Etapa da árvore do projeto** + uma
  linha fixa **"Fundo Garantidor"**, tudo a critério do Administrador
  (`construirLinhaDistribuicaoAnalista()`). **Todo projeto deve ter
  ao menos 1 Etapa** (senão a distribuição não tem pra onde ir — regra
  de negócio, não só técnica).
- **Aba 3 (Verba para Detalhamento)**: **só quando existe uma Etapa
  com "Detalhamento" no nome** (`buscarPctDetalhamentoEAviso()`,
  procura por nome, não por posição) — a fatia dela (vinda da aba 2)
  ganha um reforço proporcional de Escritório e Supervisor
  (`verbaEscritorio = verbaAnalista × (%Escritório/%Analista)`, mesma
  fórmula pro Supervisor — `calcularVerbaDetalhamentoPuro()`),
  formando a "Verba Detalhamento". Uma % dela vira "Verba de
  Distribuição de Lucros" (§12.28). **Esse reforço é exclusivo da
  Etapa Detalhamento — confirmado, não generaliza pras outras
  Etapas.** As demais Etapas (Análise, Lançamento, Pré-Lançamento,
  etc.) trabalham só com a fatia crua que já vêm da aba 2, sem
  reforço de Escritório/Supervisor.

**O que a Árvore Genérica Recursiva (esta seção) efetivamente
ACRESCENTA em cima disso, então**: hoje, só a Etapa Detalhamento tem
seu dinheiro (Verba Líquida, depois de tirar os Lucros) desdobrado pra
baixo (Pavimento por Área, Tarefa por Pontos — abas 4/5). **As outras
Etapas ficam com a fatia da aba 2 "presa" nelas, sem se espalhar pro
resto da árvore.** Esse desenho generaliza esse desdobramento pra
QUALQUER Etapa — usando a mesma fatia que a aba 2 já calcula pra ela,
ratejada pra baixo pela regra acima (Área onde tem Pavimento de
verdade, Pontos nos demais casos), até chegar nas folhas.

Essa correção elimina as ambiguidades levantadas nas 2 rodadas
anteriores — o critério não é "sempre Pontos" nem "sempre Área", é
"Área onde já existe o dado físico (Pavimento), Pontos em todo o
resto"; e a origem do dinheiro por Etapa não precisa ser inventada,
**já existe** na aba 2, só falta o desdobramento pra baixo virar
genérico em vez de exclusivo do Detalhamento.

**Por que isso é uma reestruturação grande, não um ajuste incremental:**
praticamente todo arquivo do sistema hoje assume a FORMA FIXA da
árvore (`etapa.tipo === 'unica'`, `etapa.setores`, `setor.pavimentos`,
`pavimento.tarefas`) em vez de perguntar recursivamente "este nó tem
filho do próximo tipo?". Viraria travessia genérica em: `arvore.js`
(criação, renderização, formulário de encaixe — reescrita quase
completa), `distribuicao-custos.js` (abas 4/5 — hoje hard-coded em
Pavimento→Tarefa, precisaria virar recursiva, achando o nó-folha em
qualquer profundidade, e o desdobramento da aba 3 precisaria valer
pra qualquer Etapa, não só Detalhamento), `kanban.js` (as 2 funções de
coleta + o Ranking de Produtividade), `atribuicao-tarefas.js`,
`bi.js`, `painel-progresso.js`, `relatorios.js`, `apontamento.js`,
`aprovacoes-calendario.js`, `distribuicao-lucro.js` (Etapa 1 do
cálculo do bolo). Não sobra praticamente nenhum arquivo de fora.

**Compatibilidade com dados já salvos**: em princípio, o modelo novo é
uma GENERALIZAÇÃO estrita do atual — uma Etapa `'subdividida'` de hoje
já é "Etapa com Setor" no modelo novo; uma Etapa `'unica'`/`'subetapas'`
já é "Etapa sem Setor, com Tarefa(s) direto". Ou seja, dados
existentes deveriam continuar cabendo no modelo novo sem precisar de
migração — mas isso só fica confirmado de verdade na hora de
implementar, testando com árvores reais já salvas.

**Recomendação, não uma decisão** (fica registrada, o usuário decide):
dado o tamanho do impacto, faz sentido tratar isso como uma fase de
implementação própria e isolada — não misturar com outras mudanças
incrementais na mesma rodada, e considerar migrar módulo por módulo
(começando por `arvore.js`, testando isolado, só depois estender pros
outros) em vez de tentar tudo de uma vez.

### Mecanismo de criação — "tipo" deixa de existir como campo declarado

Discussão adicional (agosto/2026): o próprio usuário percebeu que,
nesse modelo, "tipo" (`etapa.tipo` hoje, e o que seria
"setor.tipo"/"pavimento.tipo" se a generalização seguisse o padrão
antigo) **deixa de fazer sentido como campo gravado** — vira uma coisa
**observada na hora** ("esse nó tem filho? Não? Então é tarefa."), não
decidida com antecedência por ninguém. Isso levantou uma pergunta
prática (minha, não do usuário): sem "tipo", como o sistema sabe, num
nó recém-criado sem filho nenhum, se a pessoa pretende preenchê-lo
como tarefa ou adicionar um filho nele depois?

**Mecanismo fechado pelo usuário, resolve a pergunta:**
- **Todo nó nasce como tarefa** — já vem com os campos de Tarefa
  disponíveis pra preencher (status, executor, pontos, horas_reais,
  etc.), sem precisar decidir nada antes. **Não existe mais criação
  automática de uma Tarefa separada dentro da Etapa** (como a Etapa
  Única faz hoje, criando um objeto-filho com o mesmo nome da Etapa) —
  a própria Etapa/Setor/Pavimento *é* a tarefa, direto, sem
  duplicação.
- Ao lado de todo nó, um **"+"**. Clicar cria um filho vinculado a
  ele.
- **No momento em que o 1º filho é criado, o filho assume o papel de
  tarefa (nível de execução), e o pai deixa de ser tarefa — vira
  container.** O pai NÃO perde os dados que já tinha preenchido como
  tarefa (status/pontos/executor/etc.) — ficam **adormecidos** (não
  usados/não exibidos) enquanto ele for container, não apagados. Se
  todos os filhos forem removidos depois, o pai volta a ser tarefa,
  com os dados de antes ainda lá — não precisa preencher de novo.
- Clicar em "+" de novo, já com 1+ filho, adiciona **outro** filho do
  mesmo tipo — mesmo padrão visual que "+ Set"/"+ Sub" já usam hoje
  (§12.29).
- Consequência direta: o Catálogo (`banco_etapas_lego` e o que seria
  equivalente pra Setor/Pavimento, se algum dia precisar) também **não
  precisa mais guardar `tipo`** — vira só uma lista de nomes
  reaproveitáveis, sem nenhuma "pré-configuração" de comportamento.
  Isso também simplifica o mini-editor de Etapas do Cadastro de
  Projeto (§12.30) — o campo "Tipo" (hoje mostrado, só-leitura, herdado
  do Catálogo) deixaria de existir ali também, já que não há mais
  tipo pra herdar.

**IMPLEMENTADO (agosto/2026) — ETAPA 1 (arvore.js), autorizado
explicitamente pelo usuário.** `js/arvore.js` foi reescrito por
completo pro modelo genérico:
- **Sem campo `tipo` em lugar nenhum** — nem gravado na árvore
  (Etapa/Setor/Pavimento), nem no Catálogo de Etapas (removido de
  `js/catalogo-lego.js` e do HTML — dropdown/coluna "Tipo" some das
  telas de Cadastro e do mini-editor do Cadastro de Projeto).
- **Mecanismo de criação**: `criarNoVazio(nome, chaveFilhos, executor)`
  — todo nó nasce com os campos de Tarefa (status/executor/
  responsável/custo_max/qtd_fisica/pontos/horas_reais/verba/
  is_outlier) MAIS um array de filhos vazio (`setores`/`pavimentos`/
  `tarefas`, conforme o nível). `ehNoFolha(no, chaveFilhos)` — só
  verifica se esse array está vazio, calculado toda vez, nunca
  gravado.
- **Renderização** (`carregarArvoreProjetoAtual()`): pros 3 níveis
  (Etapa/Setor/Pavimento), se o nó é folha mostra o card de tarefa
  (`renderizarCardNoFolha()`, reaproveitado pros 4 casos — Etapa/
  Setor/Pavimento-folha e Tarefa de verdade); se não é folha, mostra o
  container normal com botão "+" pra adicionar mais um filho (mesmo
  botão sempre disponível, adicionar o 1º filho já promove
  automaticamente o nó de folha pra container no próximo render).
- **Formulário de encaixe** (`abrirFormEncaixe()`): Etapa e Setor
  simplificados pra só pedir o Nome (do Catálogo) — nada de
  Responsável/Executor/Custo/Pontos/Verba na hora de criar, tudo isso
  vira editável depois, clicando no card. Pavimento mantém Tipo
  (mestre/repetido) + Área + Peso na criação (é sobre o dado físico,
  não faz parte dessa generalização). Removido o tipo `'subetapa'`
  inteiro (Setor sem Pavimento já cobre exatamente o mesmo papel).
- **`visualizarNo()`/`salvarAlteracoesNo()`**: unificados — quando o
  tipo é 'etapa'/'setor'/'pavimento' E o nó é folha (ou é 'tarefa',
  que é sempre folha), mostra/salva o MESMO formulário de edição de
  tarefa, usando o nó diretamente (sem procurar um filho separado).
  Cálculo de outlier (k_real) continua restrito a Tarefa de verdade
  dentro de Pavimento container (é o único caso que tem um Pavimento-
  pai com peso pra calcular contra). **Bug pré-existente corrigido de
  brinde**: `salvarAlteracoesNo()` referenciava a variável `funcs` sem
  nunca declará-la localmente (só existia dentro de `visualizarNo()`)
  — lançava erro sempre que a trava de revisão rodava; corrigido
  carregando `funcs` no topo da função também.
- **`removerNo()`**: simplificado — sem mais o caso especial de
  "Etapa Única não pode remover a Tarefa individualmente", porque esse
  conceito não existe mais (todo nó pode ser desencaixado igual).

**Consolidação importante**: a categoria "Sub-etapas" (§12.29,
catálogo próprio, aba de Cadastro própria, botão "+ Sub") foi
**retirada por completo** — Setor sem Pavimento já cobre exatamente o
mesmo papel (nasce como tarefa, com Verba própria, sem precisar de
conceito à parte). Aba "🧩 Sub-etapas" removida do Cadastro
(`index.html`, `js/core.js::ABAS_CADASTRO`).

**Testes**: 13 casos isolados via Node (nó nasce sem `tipo`, nasce
folha, ganha filho e vira container, dados adormecidos preservados e
recuperados ao remover o filho, Setor-folha cobre o papel de
Sub-etapa, Pavimento-folha mantém os 2 conjuntos de campos ao mesmo
tempo — físico e de tarefa —, projeto sem nenhuma Etapa é válido) +
4 casos do mini-editor sem a coluna Tipo. `node --check` em todos os
`.js` reais, balanceamento de `<div>` em todos os `.html`, sem IDs
órfãos (`cad-aba-subetapas`/`panel-subetapas-lista`/`add-etapas-tipo`
— 0 ocorrências, confirmado). Sincronizado em
`modulos_isolados/arvore/`, `/atribuicao-tarefas/`, `/cadastros/`,
`/catalogo/`, `/kanban/`, `/relatorios/`.

**ETAPA 2 — IMPLEMENTADA (agosto/2026)**: os 9 arquivos que ainda
esperavam o formato antigo (`etapa.tipo === 'unica'`/`'subetapas'`)
foram migrados pro modelo genérico:

- **Nova função compartilhada** `coletarNosFolhaDaArvore(etapas)`
  (`js/core.js`, carregado antes de todos os outros) — devolve uma
  lista achatada de todos os nós-folha (Etapa/Setor/Pavimento agindo
  como tarefa, ou Tarefa de verdade dentro de Pavimento), cada item
  com `{ no, path, localizacao }` — `path` no mesmo formato que
  `arvore.js` usa (1 a 4 posições, dependendo da profundidade),
  `localizacao` é o breadcrumb legível ("Etapa › Setor › Pavimento").
  Praticamente todo arquivo consumidor trocou seu laço manual
  (`etapa.tipo === 'unica' ... senão percorre setores/pavimentos`) por
  uma chamada só a essa função.
- **`kanban.js`** (5 usos): Ranking de Produtividade, "Meu Kanban",
  Kanban "sob responsabilidade", fila de revisão, dropdown de
  executores vinculados.
- **`atribuicao-tarefas.js`** (2 usos, o mais elaborado): a lista
  principal agora distingue, pelo comprimento do `path`, se é uma
  Tarefa de verdade dentro de Pavimento (path de 4 — continua
  calculando Pontos Máximo por Área Equivalente/Pontos, regra de
  sempre) ou um Pavimento-folha (path de 3 — Pontos Máximo pela Área
  Equivalente do próprio Pavimento, sem rateio adicional) ou Etapa/
  Setor-folha (path de 1 ou 2 — sem Pavimento físico por trás, Pontos
  Máximo fica 0, teto real é o `custo_max` fixo do próprio nó).
  Fallback de Responsável ajustado (`tarefa.responsavel` → responsável
  da Etapa-pai, só quando existe uma — → Analista do projeto).
- **`apontamento.js`** (2 usos) + a função crítica
  `localizarTarefaPorCaminho()` — generalizada pra resolver os 4
  comprimentos de path possíveis (1/2/3/4 posições) de volta pro
  objeto certo. Usada por praticamente todo o sistema pra abrir/
  atualizar uma tarefa a partir de um "caminho" salvo.
- **`aprovacoes-calendario.js`** (1 uso) — fila de sessões de revisão
  pendentes.
- **`relatorios.js`** (2 usos) — sessões de trabalho e linha-por-
  tarefa; o cálculo de "horas previstas"/desvio/outlier continua
  restrito a Tarefa de verdade dentro de Pavimento (só ela tem
  Pavimento-pai com peso pra calcular contra) — Etapa/Setor/Pavimento-
  folha ficam sem baseline, mesmo espírito de exclusão que já existia.
- **`distribuicao-lucro.js`** (1 uso) — acumulação de Pontos por
  Estagiário no período (Conta 2 da apuração, §12.28) agora conta
  qualquer nível-folha, não só Etapa Única/Sub-etapas.
- **`bi.js`** (1 uso, "Fundo Global Fechamento") — antes só incluía
  Etapa Única no balanço financeiro; agora inclui QUALQUER nível-folha
  (extensão correta e esperada da generalização).
- **`painel-progresso.js`** — não era travessia simples, tinha lógica
  própria por Etapa (3 ramos antigos: Única/Sub-etapas/Subdividida).
  Reescrito em 3 casos genéricos por profundidade: Etapa-folha
  (binário 100%/0%, como Única sempre foi), Setor-folha (pesado pela
  própria Verba dele, como Sub-etapas fazia), Pavimento-folha (pesado
  por Área Equivalente, sem rateio de Pontos dentro). Tarefa real
  dentro de Pavimento continua exatamente como sempre.
- **`distribuicao-custos.js`** — **não precisou de nenhuma mudança**:
  `listarPavimentosDoProjeto()` e as funções de rateio já usam
  `|| []` em toda travessia (`etapa.setores || []`, `pav.tarefas || []`),
  então Etapa/Setor-folha (sem `.setores`/`.pavimentos`) já eram
  ignoradas com segurança, e Pavimento-folha (sem `.tarefas`) já
  participa do rateio por Área Equivalente normalmente — só não
  aparece como linha na aba 5 "Verba por Tarefa" (que lista Tarefas
  dentro de Pavimento, não o Pavimento agindo como tarefa) — gap
  cosmético pequeno, não um bug, registrado como nota pra uma rodada
  futura se incomodar na prática.

**Testes**: 17 casos isolados via Node nesta rodada (travessia
genérica encontra os 4 tipos de folha com o path/breadcrumb certos,
`localizarTarefaPorCaminho()` resolve os 4 formatos de volta pro
objeto certo, Painel de Progresso calcula corretamente os 4 casos —
inclusive confirmando que o caso clássico, Tarefa dentro de Pavimento,
continua bit-a-bit igual a antes). Mais os 13 da Etapa 1 e outros já
acumulados nesta seção — total geral bem coberto. `node --check` em
todos os `.js` reais (só o órfão pré-existente em `arquivo_antigo/`
continua falhando, como sempre), balanceamento de `<div>` em todos os
`.html`. Sincronizado em `modulos_isolados/arvore/`,
`/atribuicao-tarefas/`, `/cadastros/`, `/catalogo/`, `/kanban/`,
`/relatorios/`, `/bi/`.

**Sem teste real no navegador ainda** — só validação estática e os
testes isolados da lógica pura. A migração inteira (Etapa 1 + Etapa 2)
está pronta pro usuário testar de ponta a ponta: criar um projeto
novo, montar uma árvore usando Etapa/Setor/Pavimento como folha em
qualquer combinação, e conferir que aparece certo em Kanban, Ranking,
Atribuição de Tarefas, Distribuição de Custos/Lucro, BI, Painel de
Progresso e Relatórios.

## 12.32. Bug corrigido — "Exec:" aparecia sem nome nenhum no card da Tarefa, na Árvore de Projeto

Usuário relatou (agosto/2026): no card de cada Tarefa (Árvore de
Projeto), abaixo do nome aparecia "👤 Exec: " sem nada depois, mesmo
quando "deveria" ter um executor. Auditoria não achou bug de lógica —
`nomeParaExibicao(tar.executor)` está correto — mas achou uma causa
raiz plausível: **quando o projeto não tem Analista atribuído**
(campo em branco no Cadastro), qualquer Tarefa auto-criada de Etapa
Única (`salvarPecaNaArvore()`, e também `criarEtapaDefaultAPartirDoCatalogo()`
da §12.30) nasce com `executor: ''` (string vazia) — não é erro, é o
dado mesmo vindo vazio, porque não tinha de onde puxar o Analista.

**Corrigido**: os 2 pontos em `js/arvore.js` que renderizam
"👤 Exec: " (linha ~252, cards de Etapa Única/Sub-etapas; linha ~310,
cards de Tarefa dentro de Pavimento) agora mostram
**"⚠️ sem executor"** explicitamente quando o campo está vazio, em vez
de deixar em branco — mais fácil de perceber e diagnosticar
(inclusive esse próprio cenário: projeto sem Analista). **Não mexi**
no comportamento de criação em si (não decidi se deveria bloquear
criação sem Analista, ou avisar em outro lugar — só corrigi o
sintoma relatado, a exibição). Testado com 4 casos isolados via Node
(com executor válido continua mostrando o codinome, sem regressão;
vazio/undefined/campo ausente caem todos no aviso). Sincronizado em
`modulos_isolados/arvore/`.

## 12.33. Bug corrigido — linha duplicada na Árvore quando Etapa/Setor/Pavimento agia como folha

Usuário mandou print da tela real (agosto/2026): um projeto novo com
Etapas Default mostrava, pra cada Etapa-folha (ex.: "Lançamento"), DOIS
elementos empilhados — o cabeçalho da Etapa (📁 estilo pasta, com botão
"+ Set") **E**, logo abaixo, um card SEPARADO com o mesmo nome (⚙️,
Exec/Status). Isso não era o combinado em §12.31 ("nó nasce como
tarefa" — a PRÓPRIA linha deveria virar a exibição da tarefa, não
gerar um filho fantasma duplicado).

**Causa**: `carregarArvoreProjetoAtual()` sempre desenhava o cabeçalho
padrão (ícone de pasta + nome + botão) e, quando o nó era folha,
ADICIONAVA embaixo um card via `renderizarCardNoFolha()` — dois
elementos pro mesmo nó, em vez de um só.

**Corrigido**: a própria linha do nó agora muda de aparência conforme
é folha ou não — ícone vira ⚙️ (em vez de 📁/📐/🧮), e Executor/Status
aparecem colados no nome, na MESMA linha (`infoInlineNoFolha()`, nova
função). Quando é folha, nada é desenhado abaixo — sem card duplicado,
sem seta de recolher (vira um "•" neutro, já que não tem nada pra
expandir). O botão "+ Set"/"+ Pav"/"+ Tar" continua sempre disponível,
folha ou não — é assim que se adiciona um filho quando quiser
detalhar mais. `renderizarCardNoFolha()` (o card antigo) continua
existindo, mas só é usado mais pra Tarefa de verdade dentro de
Pavimento (que sempre foi renderizada como card avulso, sem essa
duplicação).

Testado com 7 casos isolados via Node (nome do nó aparece só 1 vez no
HTML gerado, status/executor aparecem na própria linha quando é folha,
ícone muda pra ⚙️, botão de adicionar continua disponível, nó
container não mostra status/executor nenhum — isso fica só nos
filhos). Sincronizado em `modulos_isolados/arvore/`.

**Sem teste real no navegador ainda** — o usuário reportou o bug a
partir de um teste real, mas a correção em si só foi validada
estaticamente e via Node; precisa conferir de novo no navegador.

## 12.34. Dois bugs corrigidos a partir de teste real (print da tela) — dropdown de Executor com valor errado + layout compactado

Usuário testou no navegador e mandou print real da Árvore de Projeto
(agosto/2026), com 2 problemas concretos:

**1) Bug corrigido — dropdown de Executor/Responsável mostrava um nome
mesmo sem nada salvo.** No print, o Pavimento "G1" aparecia "sem
executor" no card da árvore (correto — o dado realmente estava vazio),
mas o painel de detalhes à direita mostrava "DETALHISTA" pré-marcado
nos campos Executor e Responsável — só ficava certo depois de clicar
em "Atualizar Componente" (que aí sim GRAVAVA aquele nome, então virava
verdade só depois do clique). **Causa**: o `<select>` de Executor/
Responsável não tinha nenhuma opção em branco — quando
`item.executor` está vazio, nenhuma `<option>` bate com
`selected`, e o navegador, por padrão, mostra a PRIMEIRA opção da
lista como se estivesse escolhida (sem realmente estar). **Corrigido**:
adicionada uma opção "-- Selecione --" no topo do dropdown, marcada
como `selected` sempre que o campo estiver vazio — agora o dropdown
não mente mais sobre o que está salvo. Corrigido nos dois lugares:
painel de edição (`visualizarNo()`) e formulário de criação de Tarefa
(`abrirFormEncaixe()`, que tinha o mesmo problema em potencial, mesmo
não sendo o caso relatado). Testado com 4 casos isolados via Node.

**2) Layout compactado** — pedido do usuário: "o ideal é que esta aba
fosse distribuída em apenas 1 página, sem necessidade de rolagem".
Reduzido o espaçamento vertical entre os campos (10px → 6px em quase
tudo), e Pontos/Verba/Status (que ocupavam 2 linhas cheias) agora
cabem numa linha só (3+3+6 = 12 colunas). O quadro de Área Equivalente/
Fração de Verba (Pavimento) ficou mais compacto e numa linha só, em
vez de duas empilhadas com `<br>`. Não é uma garantia matemática de
"sempre cabe sem rolar" (depende da altura da tela de quem estiver
usando), mas reduz bastante a altura total.

Sincronizado em `modulos_isolados/arvore/`. **Sem teste real no
navegador ainda** — falta o usuário conferir se o dropdown agora
mostra "-- Selecione --" corretamente quando não há executor, e se o
layout ficou mais compacto na prática.

## 12.35. Árvore Genérica Recursiva v2 — "níveis puláveis, ordem obrigatória" (agosto/2026), IMPLEMENTADA

Segunda revisão do modelo (a primeira foi §12.31/§12.32/§12.33). O
usuário percebeu, testando no navegador, que o "+" de cada nó só
sabia adicionar o nível imediatamente seguinte (Etapa → só Setor;
Setor → só Pavimento) — pediu pra poder escolher, ao lado de qualquer
nó, **qual nível adicionar** (Setor, Pavimento, ou Tarefa direto),
sem forçar passar pelos intermediários. Fechado com o usuário: **a
ordem relativa continua obrigatória** (Setor sempre antes de
Pavimento, que sempre antes de Tarefa — nunca invertido), mas
**qualquer um pode ser pulado**, e vários filhos de níveis diferentes
podem conviver como irmãos do mesmo pai.

**Mudança de modelo de dados**: não existem mais campos fixos por
nível (`etapa.setores`/`setor.pavimentos`/`pavimento.tarefas`). Todo
nó (Etapa e qualquer filho) guarda seus filhos num **único array
`filhos`**, e cada filho carrega um campo **`nivel`**
(`'setor'|'pavimento'|'tarefa'`). Etapa continua vivendo em
`arv.etapas` (sem `nivel` — é sempre implícito).

**Novo em `js/core.js` (compartilhado por quase todo o sistema):**
- `resolverNoPorPath(arv, path)` — anda pelo path ("0", "0-1", "0-2-1"
  etc.) resolvendo o nó de verdade, em qualquer profundidade.
- `ehNoFolha(no)` — só checa se `.filhos` está vazio/ausente.
- `coletarNosFolhaDaArvore(etapas)` — reescrita pra recursão de
  verdade (antes tinha 4 blocos fixos, um por nível; agora é uma
  função recursiva só, que funciona pra qualquer profundidade).

**`js/arvore.js`**: reescrito de novo por completo —
`criarNoVazio(nome, nivel, executor)` (genérico), renderização
recursiva (`renderizarNoRecursivo()`, substitui os 3 blocos quase-
duplicados de antes), botões "+" dinâmicos por nível
(`niveisFilhoDisponiveis()` — Etapa mostra +Set/+Pav/+Tar, Setor
mostra +Pav/+Tar, Pavimento só +Tar, Tarefa nenhum),
`abrirFormEncaixe(nivel, pai)`/`salvarPecaNaArvore()`/`visualizarNo(path)`/
`salvarAlteracoesNo(path)`/`removerNo(path)` — todos generalizados
(assinatura simplificada: só `path`, sem mais precisar de um `tipo`
separado, já que `resolverNoPorPath()` + `no.nivel` bastam pra saber
tudo). **Simplificações deliberadas nesta rodada** (registradas, não
esquecidas): arrastar-e-soltar pra reordenar ficou só em Etapa (Setor
não tem mais, dado que agora convive com irmãos de níveis diferentes,
complicaria a lógica); a conveniência de "copiar tarefas do pavimento
anterior" foi removida (nice-to-have, não essencial).

**9 arquivos periféricos corrigidos** (tinham acesso direto ao
caminho fixo, sem passar pela travessia genérica — alguns desses eu
tinha deixado passar na migração anterior, §12.31/§12.32):
- `apontamento.js` — `localizarTarefaPorCaminho()` (função crítica,
  usada por quase tudo) agora só chama `resolverNoPorPath()`.
- `aprovacoes-calendario.js` — 2 pontos corrigidos, incluindo
  `listarFinalizacoesPendentes()`, que tinha passado batido na rodada
  anterior (função diferente da que eu tinha corrigido antes).
- `atribuicao-tarefas.js` — o cálculo de Pontos Máximo (o mais
  elaborado do sistema) agora decide por Área Equivalente/Pontos
  olhando o `nivel` real do nó e do pai imediato (via
  `resolverNoPorPath`), não mais o comprimento do path. Removida
  também uma trava obsoleta ("Executor de Tarefa Única só
  Administrador troca") que não existe mais desde que o conceito de
  Etapa Única foi substituído.
- `bi.js` (Calibração) — filtra por `nivel === 'tarefa'` e
  `k_real_calculado !== undefined` (só é gravado quando o pai é um
  Pavimento de verdade) em vez de andar 2 níveis fixos.
- `catalogo-lego.js` — `propagarRenomeTarefaNaArvore()` generalizada.
- `distribuicao-custos.js` — `listarPavimentosDoProjeto()` (a função
  mais importante daqui, alimenta o rateio de verba inteiro) agora
  acha Pavimento em QUALQUER profundidade, não só 2 níveis fixos; mais
  2 pontos de atribuição/edição direta corrigidos.
- `feriados.js` — motor de "Data Prevista" (`calcularFilaComDatasExecutor`).
- `kanban.js` — `moverTarefaParaStatus()` (arrastar card entre
  colunas).
- `relatorios.js` — cálculo de horas previstas/outlier, mesma correção
  de "olhar o nivel real do pai" que `atribuicao-tarefas.js` recebeu.
- `painel-progresso.js` — reescrito com recursão de verdade
  (`calcularProgressoSubarvore()`) — antes tinha 3 casos fixos
  (Etapa/Setor/Pavimento-folha tratados separadamente); agora é uma
  função recursiva só, que soma corretamente uma Etapa com filhos de
  níveis MISTOS (ex.: um Setor com Pavimento dentro, uma Tarefa direta,
  e um Pavimento direto, todos irmãos) — testado especificamente esse
  cenário.

**Testes**: 15 casos isolados via Node nesta rodada (13 do modelo
central — Etapa ganhando Pavimento ou Tarefa direto pulando níveis,
filhos de níveis diferentes convivendo como irmãos, remoção ajustando
índices corretamente — e 2 do Painel de Progresso, incluindo o cenário
misto completo). `node --check` limpo em todos os `.js` reais.
Sincronizado em `modulos_isolados/arvore/`, `/atribuicao-tarefas/`,
`/cadastros/`, `/catalogo/`, `/kanban/`, `/relatorios/`, `/bi/`,
`/distribuicao-custos/`.

**Sem teste real no navegador ainda** — só validação estática e os
testes isolados da lógica pura. Falta o usuário: criar uma Etapa, usar
o "+" pra adicionar diretamente um Pavimento ou uma Tarefa (pulando
Setor), conferir que aparece certo na árvore, e que o Painel de
Progresso/Kanban/Atribuição de Tarefas/Distribuição de Custos
reconhecem esse nó normalmente.

## 13. Como proceder em qualquer tarefa nova

1. Diga primeiro, em texto, qual arquivo(s) você vai tocar e por quê, antes
   de escrever código.
2. Faça mudanças em **um domínio por vez** (um arquivo JS, ou o `index.html`
   mais o JS correspondente). Não peça para revisar "o sistema todo" de
   uma vez.
3. Ao terminar uma função, cite explicitamente quais IDs de HTML ela espera
   encontrar (`document.getElementById(...)`) para conferir se existem no
   `index.html`.
4. Nunca declare uma tarefa concluída sem confirmar que testou no
   navegador. Erros de `localStorage` e de DOM não aparecem em ferramentas
   de análise estática — só rodando.
5. **Regra explícita do usuário (agosto/2026): acumular, não implementar
   por conta própria.** Quando o usuário descrever um desenho novo, uma
   correção de critério, ou qualquer pendência nova durante a conversa,
   **registrar no documento (§12.x e/ou §14), mas NÃO escrever código**
   pra isso a menos que ele dê uma ordem explícita de implementação
   naquele momento. Vale mesmo que o desenho pareça pronto/fechado o
   suficiente pra codar. Ao final de qualquer resposta que só registrou
   algo (sem implementar), deixar claro que ficou só registrado,
   aguardando ordem.
6. **Regra explícita do usuário (agosto/2026): nenhum dado pode ficar
   "desatualizado" numa tela por ter sido editado em outra.** Motivada
   por um caso real (§14, item 5 — Pontos editado na Atribuição de
   Tarefas não refletia no Kanban). Toda tela que MOSTRA um campo que
   também é editável em outro lugar do sistema (Pontos, Status,
   Executor, Verba, etc.) precisa **ler o valor fresco de
   `banco_arvores_projetos` na hora de renderizar** — nunca guardar
   uma cópia/cache do valor que sobrevive além de um único render.
   Toda função que EDITA um desses campos precisa gravar direto no
   objeto real da árvore (via `resolverNoPorPath()`, `core.js` —
   nunca reconstruir o caminho na mão) e usar
   `localStorage.setItem('banco_arvores_projetos', ...)` imediatamente
   — nunca deixar a alteração só no `<input>` da tela sem persistir.
   Ao implementar qualquer tela nova (ou mexer numa existente) que
   edite ou mostre um campo compartilhado, verificar essa consistência
   como parte do trabalho, não só depois que alguém reportar.
   **Reforçado explicitamente pelo usuário (ago/2026, leva 4)**: essa
   regra vale pra QUALQUER valor mostrado em mais de um lugar do
   sistema, não só os que já foram pegos em bug — Área, Valor de
   Contrato, Verba calculada, Percentuais, etc. Ao implementar a
   correção de um campo específico (ex.: item 2, Valor Contratado
   Líquido), sempre checar se aquele MESMO valor aparece em outras
   telas além da que está sendo corrigida (Cadastro, Árvore,
   Distribuição de Custos, Atribuição de Tarefas, Kanban, Painel de
   Progresso, Relatórios) e atualizar todas — não só a tela
   explicitamente mencionada no pedido do usuário.

## 14. PENDÊNCIAS ATIVAS — ler primeiro ao retomar em nova conversa

Bloco consolidado pra não precisar garimpar cada §12.x atrás do que
ainda falta. Atualizar este bloco (não só as seções 12.x individuais)
toda vez que uma pendência daqui for resolvida ou uma nova surgir.

**⚠️ ANTES DE INVESTIGAR QUALQUER "BUG" QUE O USUÁRIO RELATAR**: confirme
primeiro se ele está testando via `http://localhost` ou abrindo o
`index.html` direto do disco (`file:///...`). Testar via `file://`
já causou pelo menos 1 falso-bug confirmado (ver item na seção
"Sincronização multi-usuário" abaixo — Etapas Default "sumindo" por
causa do Firebase, não por bug de código nenhum). Perguntar isso
**antes** de investigar código evita gastar tempo atrás de bugs que
não existem.

### Implementado (agosto/2026) — leva 1: Feriados na aba Cadastro, hub Projetos v1, Fundo Garantidor 10%, Aprovações no Kanban

Usuário mandou "implemente o que temos pendente" — os 4 primeiros
itens da leva acumulada abaixo foram implementados nesta rodada; o
item 5 (bug) segue como estava, aguardando reconfirmação no navegador,
não é uma implementação nova.

1. **"📅 Feriados" virou aba do Cadastro — IMPLEMENTADO.**
   `nav-feriados` removido do menu principal e das listas de acesso
   (`MENU_POR_NIVEL`/`TODOS_ITENS_MENU_CONTROLADOS`); nova aba
   `cad-aba-feriados` dentro de Cadastro; `'feriados'` entrou em
   `ABAS_CADASTRO`; painel renomeado de `panel-feriados` pra
   `panel-feriados-lista` (classe trocada de `content-panel` pra
   `sub-panel-cadastro`, CSS idêntico entre as duas — troca segura);
   `alternarModulo()` ganhou um branch específico pra "feriados"
   dentro do dispatch de `abrirAbaCadastro()` (não é o padrão genérico
   de catálogo — chama `carregarPainelFeriados()`); branch standalone
   antigo removido.
2. **Hub "📁 Projetos" — IMPLEMENTADO, com uma simplificação de
   engenharia que vale registrar.** Em vez de criar um painel novo do
   zero, reaproveitei uma coincidência favorável: tanto "Estrutura de
   Projeto" quanto "Distribuição de Custos" **já tinham**, cada uma,
   sua própria tela de "escolher o projeto" (`subpanel-lista-projetos-arvore`
   e `dc-portal-selecao-projeto`, ambas com o mesmo padrão de lista
   clicável com busca). Por isso, o item de menu "📁 Projetos" **é o
   mesmo `nav-arvore`/`alternarModulo('arvore')` de sempre** — só o
   rótulo visível mudou (de "🌳 Estrutura de projeto" pra "📁 Projetos"),
   sem precisar de painel novo nenhum. `nav-distribuicao_custos` foi
   removido do menu (e das listas de acesso). Pra alternar entre as
   duas telas SEM re-escolher o projeto, adicionei um botão de atalho
   em cada uma: "📊 Custos" no cabeçalho de `subpanel-arvore-visual`
   (chama `irParaDistribuicaoCustosDoProjetoAtivo()`, novo em
   `core.js`) e "📁 Estrutura de Projeto" na barra de abas de
   Distribuição de Custos (chama `irParaEstruturaProjetoDoProjetoAtivo()`).
   As duas funções novas leem o nome do projeto de uma tela e
   inicializam a outra com ele (`projetoSelecionadoAtivo` pra Árvore,
   `document.getElementById('dc-projeto').value` pra Custos) — nenhuma
   variável de estado nova precisou ser criada, só a ponte entre as
   duas que já existiam. **"Cadastro de Projetos"** saiu das abas do
   Cadastro (`cad-aba-projetos` removido) e virou item próprio
   "🏗️ Cadastro de Projetos" (`nav-cadastro-projetos`, só-Administrador,
   mesmo acesso que já tinha antes por estar dentro do Cadastro
   Admin-only) — `panel-projetos-lista`/`panel-projetos-form` trocaram
   de `sub-panel-cadastro` pra `content-panel` (mesmo CSS, troca
   segura), `'projetos'` saiu de `ABAS_CADASTRO`, ganhou branch próprio
   em `alternarModulo()`.
3. **Fundo Garantidor default 10% — IMPLEMENTADO.** As duas chamadas
   de `construirLinhaDistribuicaoAnalista('Fundo Garantidor', ...)`
   (`js/distribuicao-custos.js`) agora passam `'10'` como
   `pctSugerido`. "% Distribuição Lucros" já tinha esse default, não
   precisou de nada.
4. **Aprovações ligadas a tarefa dentro do Kanban — IMPLEMENTADO**
   (escopo confirmado antes: só finalização pendente + sessão de
   revisão, não as 2 administrativas). O card do Kanban ganhou: um
   botão "✅ Aprovar" direto no selo "⏳ Aguardando aprovação"
   (finalização pendente), visível só pra quem tem autoridade real
   (reaproveita `podeAprovarFinalizacao()`, já existia) — chama a nova
   `aprovarFinalizacaoCartaoKanban()`, que só embrulha a função de
   sempre (`aprovarFinalizacaoTarefa()`) e re-renderiza o quadro;
   Recusar continua só na tela "Aprovações" de propósito (ação mais
   delicada, com mais contexto lá). E um botão
   "⏳ N sessão(ões) de revisão aguardando aprovação", visível só pra
   quem tem autoridade de revisar aquela tarefa (`podeRevisarTarefa()`),
   que abre um modal novo e leve (`kb-modal-sessoes-revisao`) listando
   as sessões pendentes daquela tarefa específica, com Aprovar/Recusar
   por sessão (reaproveita `aprovarSessaoRevisao()`/`recusarSessaoRevisao()`
   de `aprovacoes-calendario.js`, sem duplicar lógica nenhuma).

**Testes desta rodada**: 11 casos isolados via Node (fluxo de
navegação do hub — projeto se propaga nos dois sentidos sem precisar
re-escolher, tentar pular sem projeto ativo não quebra; filtro de
sessões de revisão pendentes; autoridade de aprovar finalização em 4
cenários). `node --check` limpo em todos os `.js`, balanceamento de
`<div>` em `index.html` (346/346), sincronizado nos módulos isolados
relevantes. **Sem teste real no navegador ainda** — falta o usuário
conferir os 4 itens na prática, especialmente o fluxo de ida-e-volta
do hub "Projetos" e os botões novos no card do Kanban.

5. **Bug relatado: Pontos editados na Atribuição de Tarefas não
   refletiam no Kanban** — investigação (sem browser) não achou causa
   viva no código atual: `editarPontosTarefaAtribuicao()`
   (`js/atribuicao-tarefas.js`) já usa `resolverNoPorPath()` e grava em
   `banco_arvores_projetos`; o card do Kanban (`kb-cartao-pontos`,
   `js/kanban.js` linha ~743) já lê `t.pontos` fresco a cada
   renderização, sem cache. **Hipótese**: o usuário provavelmente
   testou isso ANTES da migração "Árvore Genérica Recursiva v2 —
   níveis puláveis" (§12.35) — antes dela, esse mesmo trecho usava um
   formato de caminho que podia ficar desalinhado depois de qualquer
   mudança na árvore, fazendo o salvamento falhar silenciosamente (erro
   engolido por um `catch` vazio, sem avisar nada — o campo continuava
   mostrando o número digitado, mas nada era gravado de verdade).
   Corrigido como efeito colateral daquela migração, sem ter sido feito
   de propósito pra esse bug específico. **Precisa ser reconfirmado no
   navegador** — se persistir mesmo depois da v2, é outra causa, não
   essa.

### Implementado (agosto/2026) — leva 2: reversão do Cadastro de Projetos + largura da árvore

1. **Coluna da árvore em "📁 Projetos" alargada — IMPLEMENTADO.**
   `subpanel-arvore-visual` foi de `width: 360px` pra `width: 480px`.
   `painel-propriedades-lego` (painel de detalhes à direita) ganhou um
   `min-width: 320px` de segurança, pra não espremer demais o grid de
   campos (Executor/Responsável/Custo/etc.) em telas menores — fora
   isso, continua `flex:1`, se ajustando sozinho. Valor de 480px foi
   uma estimativa razoável, não veio de medição pixel-a-pixel — pode
   precisar de ajuste fino depois de ver renderizado de verdade.
2. **Relocação do "Cadastro de Projetos" DESFEITA — IMPLEMENTADO.**
   Usuário achou que ter tirado do Cadastro (rodada anterior) foi má
   ideia — voltou tudo exatamente pro estado de antes dessa mudança
   específica:
   - `panel-projetos-lista`/`panel-projetos-form`: classe voltou de
     `content-panel` pra `sub-panel-cadastro`.
   - `cad-aba-projetos` voltou como botão na barra de abas do Cadastro
     (entre Funcionários e Etapas, posição original).
   - `'projetos'` voltou pra `ABAS_CADASTRO`, com `titulosPorAba` e o
     dispatch `renderizarTabelaProjetos()` restaurados dentro de
     `abrirAbaCadastro()`.
   - `nav-cadastro-projetos` saiu do menu principal e das listas de
     acesso (`MENU_POR_NIVEL`/`TODOS_ITENS_MENU_CONTROLADOS`).
   - Branch standalone `else if (modulo === 'projetos') {...}` que
     tinha sido criado em `alternarModulo()` foi removido — `'projetos'`
     volta a cair no branch genérico `ABAS_CADASTRO.includes(modulo)`.
   - Todas as demais partes daquela rodada anterior **continuam
     valendo, não fazem parte desse desfazer**: hub "📁 Projetos"
     reaproveitando `nav-arvore`, botões de atalho "📊 Custos"/
     "📁 Estrutura de Projeto", Feriados na aba Cadastro, Fundo
     Garantidor 10%, Aprovações no Kanban.
   - **Nota lateral, não uma correção**: agora existem 2 coisas
     rotuladas "📁 Projetos" no sistema — o item do menu principal
     (`nav-arvore`, hub pra TRABALHAR num projeto já existente) e a
     aba dentro do Cadastro (`cad-aba-projetos`, formulário de CRIAR/
     EDITAR o registro do projeto) — mesmo rótulo, propósitos
     diferentes. É o rótulo original de antes de qualquer mudança
     desta série, mantido por pedido explícito ("mantenha as
     utilidades que havia antes"); só fica registrado aqui como um
     possível ponto de confusão pro usuário perceber, não uma decisão
     que eu tomei sozinho.
   - Confirmado: nenhuma "utilidade" (e-mails de responsáveis,
     mini-editor de Etapas Default v2) precisou de ajuste — dependiam
     só do `modulo === 'projetos'`, nunca foram tocadas.

`node --check` limpo em todos os `.js`, balanceamento de `<div>` em
`index.html` (345/345), sincronizado nos módulos isolados (o módulo
isolado de `cadastros` já usava um padrão de navegação próprio, mais
simples, desde antes de qualquer uma dessas mudanças — não precisou de
ajuste). **Sem teste real no navegador ainda** pros dois itens.

### Implementado (agosto/2026) — leva 3, A MAIS RECENTE: lote de 14 melhorias em Cadastros

Usuário mandou "implemente" — todos os 14 itens da leva anterior
(CADASTROS/DADOS ESTRUTURAIS/GERENCIAMENTO/ABA PROJETOS) foram
implementados nesta rodada.

**CADASTROS (geral)**
1. **Compactação de layout — IMPLEMENTADO, via CSS global.** Em vez de
   editar campo por campo, comprimi as classes compartilhadas por
   TODAS as telas de Cadastro (`estilos.css`): `.form-panel` (padding
   24px→16px, gap 20px→12px), `.form-section` (padding-bottom
   16px→10px, margin-bottom 10px→6px), `.form-section-title`
   (margin-bottom 8px→5px), `.form-grid` (gap 16px→10px, gap interno
   label/campo 6px→4px). Reduz a altura total de qualquer formulário
   de Cadastro de uma vez só. Não é garantia matemática de "sempre cabe
   sem rolar" (depende da altura de tela de quem usa), mas reduz bem.
2. **Validação real de data — IMPLEMENTADO.** Nova função
   `validarDataBR()` (`js/cadastros.js`) — confere dia/mês/ano de
   verdade (bissexto incluso, via truque `new Date(ano, mes, 0)`), não
   só o formato. Aplicada em TODO campo `.input-data-mask` do sistema
   (Funcionários: Início/Desligamento/Nascimento; Projeto: Início) —
   borda vermelha + aviso ao sair do campo (`onblur`) se inválida, e
   **bloqueia o Salvar** (`validarTodasDatasDaTela()`, chamada em
   `salvarFuncionario()`/`salvarProjeto()`) se alguma data preenchida
   estiver errada. Testado com 13 casos isolados (bissexto, meses
   com dias diferentes, mês/dia fora do range, formato incompleto).
3. **Cadastro de Feriados — edição in-place — IMPLEMENTADO.**
   `renderizarTabelaFeriadosCustomizados()` reescrita: Data e Nome
   agora são campos editáveis DIRETO na linha (mesmo padrão de outras
   telas — Etapas do Cadastro de Projeto, Distribuição de Custos
   Analista), com `onchange` salvando na hora
   (`editarFeriadoCustomizado()`, nova). Editar a data reordena a
   lista de novo; editar pra uma data já usada em outra linha é
   bloqueado, mesma regra de cadastrar um novo. Testado com 7 casos
   isolados.
4. **Bug corrigido — Feriados continuava aparecendo ao trocar de
   tela.** Causa raiz confirmada e corrigida: `panel-feriados-lista`
   estava fisicamente FORA de `panel-cadastro` no HTML (irmão, não
   filho) — como `alternarModulo()` só esconde `.content-panel`
   (e os painéis de Cadastro ficam escondidos por herança do pai), um
   painel fora dessa hierarquia nunca era escondido. Movido
   fisicamente pra dentro de `panel-cadastro` (confirmado
   programaticamente com script Python que conta divs abertos/
   fechados até esse ponto do arquivo).

**DADOS ESTRUTURAIS (Cadastro de Projeto)**
5. **Cursor/visão no canto superior esquerdo, foco em Nome Obra —
   IMPLEMENTADO.** `abrirFormulario('projetos', true)` agora zera o
   scroll do painel (`scrollTop = 0`) e foca `proj-nome` via
   `setTimeout(..., 0)` (garante que o campo já está visível/habilitado
   antes de focar).
6. **Listas de projeto em ordem alfabética — IMPLEMENTADO.** Cadastro
   de Projetos já ordenava; corrigidas as 2 que não ordenavam — hub
   "📁 Projetos" (`arvore.js::renderizerProjetosParaSelecaoArvore()`) e
   o portal de Distribuição de Custos
   (`distribuicao-custos.js::carregarPainelDistribuicaoCustos()`,
   ordena antes de alimentar tanto o portal quanto o dropdown
   `#dc-projeto`).
7. **Redimensionar tela de novo projeto — IMPLEMENTADO**, além da
   compactação geral do item 1: `margin-top` interno do formulário de
   Projeto reduzido de 10px pra 6px; Analista/Supervisor/Detalhista
   reorganizados de 2+1 linhas pra 1 linha só (3 colunas); tabela de
   e-mails reduzida de 160px pra 110px de altura máxima.
8. **Campo Endereço vira 5 campos (Rua, Nº, Bairro, Cidade, UF) — em
   TODOS os 3 lugares — IMPLEMENTADO.** Clientes (tinha
   `cli-logradouro`+`cli-cidade` parcial), Funcionários e Projetos
   (tinham `endereco`/`func-endereco`/`proj-endereco` como campo
   único) — os 3 padronizados com os mesmos 5 campos
   (`-rua`/`-numero`/`-bairro`/`-cidade`/`-uf`). **Compatibilidade com
   dados já salvos**: ao editar um registro ANTIGO (só com o campo
   único), o valor antigo cai inteiro em "Rua" (nada se perde,
   `c.rua || c.logradouro || ''`) — registro novo usa os 5 campos
   direto. `js/importexport.js` também atualizado (os 3 mapeamentos de
   CSV). Testado com 5 casos isolados (registro antigo, novo, e o caso
   intermediário).
9. **Área com 2 casas decimais + separador de milhar — IMPLEMENTADO,
   com cuidado extra.** Nova máscara de digitação
   (`formatarNumeroBRDigitando()`) — só na EXIBIÇÃO. O valor salvo
   continua um número puro ("1234.56"), não o texto formatado
   ("1.234,56") — ver item 11 pro motivo (mesmo mecanismo,
   compartilhado).
10. **Dificuldade vira seleção 1 a 5 — IMPLEMENTADO.** Trocado de
    `<input type="text">` pra `<select>` com as 5 opções numéricas;
    default mudou de `"Baixo"` (texto, não bate mais com nada) pra
    `"3"`.

**GERENCIAMENTO**
11. **Valor formatado como moeda R$ — IMPLEMENTADO, com verificação
    prévia importante.** Antes de mascarar, conferi onde
    `projeto.valor` é consumido no resto do sistema — achei
    `parseFloat(projeto.valor)` em **5 lugares dentro de
    `distribuicao-custos.js`** (linhas 215/399/419/829/862, toda a
    cadeia de cálculo da Verba Contratada). Se eu salvasse a string
    formatada ("R$ 1.234,56"), `parseFloat()` quebraria esses cálculos
    silenciosamente. Solução: máscara só na digitação/exibição
    (`formatarNumeroBRDigitando()`/`formatarNumeroBRParaExibicao()`),
    valor salvo sempre convertido de volta pra número puro
    (`desformatarNumeroBR()`) antes de gravar em `banco_projetos`, e
    reconvertido pra exibição bonita ao reabrir pra editar. Testado
    com 11 casos isolados cobrindo a cadeia inteira (digitar → salvar
    → reabrir → editar de novo), incluindo confirmar que
    `parseFloat()` do valor salvo continua funcionando certo.
12. **Analista/Supervisor/Detalhista com o usuário logado como default
    — IMPLEMENTADO.** `abrirFormulario('projetos', true)` agora
    preenche os 3 com `usuarioLogado.nome`, continuam editáveis
    normalmente (trocando na própria seleção).

**ABA PROJETOS**
13. **Rótulo "Início" → "INÍCIO (DD/MM/AAAA)" — IMPLEMENTADO.**
14. **Validar a data — IMPLEMENTADO** — mesmo mecanismo do item 2,
    já cobre esse campo (`proj-dt-inicio`) especificamente.

**Testes desta rodada**: 41 casos isolados via Node no total (13 +
7 + 5 + 11 + os já mencionados por item acima). `node --check` limpo
em todos os `.js`, balanceamento de `<div>` em `index.html`
(356/356), sincronizado nos módulos isolados relevantes (incluindo
`estilos.css` nos módulos que têm cópia própria). **Sem teste real no
navegador ainda** — recomendação forte, já registrada antes: testar
via `http://localhost`, nunca abrindo o arquivo direto do disco (ver
item 7 da seção "Sincronização multi-usuário").

### Implementado nesta rodada (agosto/2026, leva 4 — parte 1)
Usuário deu ordem explícita pra implementar ("Siga com a implantação
dos itens que estão pendentes"). Implementados **9 dos 14 itens da
leva 4** — os que já tinham desenho fechado e menor risco. Ficaram de
fora, de propósito: **item 8** (aguardando o usuário reconfirmar se o
bug ainda ocorre), **item 10** (verba em cascata — o maior, fica pra
uma rodada dedicada em separado, não dá pra misturar com o resto sem
testar isolado) e **item 14** (escopo do "reativar arrastar-e-soltar"
ainda não fechado). Trabalho feito em 3 domínios, um de cada vez
(§13.2), cada um testado isoladamente antes de ir pro próximo:

**Domínio 1 — `js/arvore.js` (itens 2+3+4, Propriedades Contratuais
Macro)**: Área Total Comercial e Valor Contratado Líquido viraram
read-only, espelhando `projeto.area`/`projeto.valor` do Cadastro (a
função de salvar, `salvarDadosMacroProjetoRaiz()`, parou de ler os
campos removidos `edit-p-areacom`/`edit-p-valor`). Rótulos "Supervisor
Geral"→"Supervisor" e "Analista Líder"→"Analista". Status do projeto
(Em Análise/Liberado) virou um banner de largura total, reaproveitando
o padrão de cores de selo já usado no sistema (`#fef9c3`/`#854d0e`
alerta, `#f0fdf4`/`#166534` sucesso). Testado: `node --check` limpo,
mais um teste isolado (Node) conferindo por grep que os campos antigos
sumiram, os rótulos novos apareceram e o banner usa a cor condicional
certa — todos passaram.

**Domínio 2 — bug de dados órfãos (itens 5+6+7): `js/cadastros.js`,
`js/kanban.js`, `js/atribuicao-tarefas.js`, `js/core.js`**. Causa
raiz corrigida na fonte: `deletarProjeto()` agora também apaga a
árvore correspondente em `banco_arvores_projetos` (antes só limpava
`banco_projetos`); `salvarProjeto()`, ao detectar que o nome mudou
numa edição, migra a chave da árvore pro nome novo em vez de deixá-la
órfã sob o nome antigo. Além disso, criada `obterArvoresProjetosAtivas()`
(`js/core.js`) — filtro defensivo que cruza `banco_arvores_projetos`
contra `banco_projetos` — usada agora em
`calcularRankingProdutividadeExecutores()` e `coletarTarefasDoExecutor()`
(`js/kanban.js`). `coletarTarefasSobResponsabilidade()` (`js/kanban.js`)
ganhou um `if (!projeto) return;` logo no início do loop — essa era a
causa EXATA do "aparece no Kanban do Administrador": pra Administrador
a autoridade era `true` sem checar se o projeto ainda existia.
`coletarTodasTarefasDeTodosProjetos()` (`js/atribuicao-tarefas.js`) já
carregava `todosProjetosCadastro` mas nunca usava pra filtrar — agora
usa. Esse filtro defensivo também resolve órfãos que já existiam no
localStorage de ANTES desta correção (não só previne órfãos novos).
Testado: `node --check` limpo nos 4 arquivos, mais 4 testes isolados
(Node, simulando `localStorage`) cobrindo especificamente o cenário
relatado — projeto renomeado com árvore órfã sob o nome antigo,
projeto deletado com árvore ainda no storage, `deletarProjeto()`
limpando de verdade, e rename migrando a chave preservando as Etapas —
todos passaram.

**Domínio 3 — `js/distribuicao-custos.js` + `index.html` (itens
1+12+13)**: Percentual de Impostos default 21%→23% (único lugar no
código, conferido por grep). Área Física e Peso do Esforço do
Pavimento viraram editáveis direto na Aba 4 "Verba por Pavimento"
(`editarAreaPesoVerbaPavimento()`, nova função, grava no nó Pavimento
via `resolverNoPorPath()` — mesmo padrão de `editarPontosVerbaPorTarefa`
— e recarrega a aba pra recalcular toda a cascata: Área Equivalente, %
Verba, Valor da Verba, refletindo também na Aba 5). Aba 5 "Verba por
Tarefa" reformatada: `class="tabela-compacta"` (mesma classe CSS já
usada na Atribuição de Tarefas — linha mais baixa, fonte menor), coluna
"Pavimento" removida da tabela (era sempre vazia por linha — a
informação já aparece na linha de cabeçalho de grupo, que continua
como estava, com fundo destacado `#e2e8f0`) — colspans ajustados de 6
para 5 em todos os lugares (linha de grupo, linha "nenhuma tarefa",
linha de conferência, linha de subtotal). Subtotalização por
pavimento mantida como estava (a lógica de `recalcularGrupoVerbaPorTarefa()`
usa seletores de classe, não posição de coluna — não precisou mudar).
Testado: `node --check` limpo, balanceamento de `<table>`/`<tr>`/`<td>`/
`<th>`/`<thead>`/`<tbody>` no `index.html` inteiro (todos batendo),
mais checagem manual dos colspans (3+1+1=5 na linha de subtotal, 5 em
todos os outros lugares).

**Validação final do projeto inteiro nesta rodada**: `node --check`
limpo em todos os `.js`; `<div>` balanceado no `index.html` (356/356);
`<table>`, `<tr>`, `<td>`, `<th>`, `<thead>`, `<tbody>` todos
balanceados. **Ainda SEM teste real no navegador** — nem este lote
novo, nem o lote de Cadastro de antes (continua pendente, por escolha
do usuário).

### Implementado nesta rodada (agosto/2026, leva 4 — parte 2: item 10, verba em cascata)
Usuário deu ordem explícita ("Parta para o item 10"). Maior e mais
complexo item da leva — implementado por completo, em
`js/distribuicao-custos.js` (motor de cálculo + Abas 3/4), `js/arvore.js`
(campos novos em Setor) e `index.html` (HTML das Abas 3/4). Testado com
**23 testes isolados via Node** (mais que qualquer item anterior, dado
o risco), todos passando, incluindo simulação completa de
localStorage+DOM fake pra testar o ciclo edição→gravação→recarregamento.

**Motor de cálculo (o núcleo do item 10)**:
- `distribuirVerbaRecursiva(no, verba)` — função genérica nova que
  cascateia uma verba por QUALQUER nível da árvore: se os filhos são
  Tarefa, divide por Pontos; se são Setor ou Pavimento, divide por Área
  Equivalente (área×peso); se não tem filhos (folha genérica), recebe
  tudo. Escreve o resultado em `no._verbaCalc`, só em memória (não
  persiste, não mexe no campo `no.verba` já existente — que é outro
  campo, editável manualmente, usado pelo Painel de Progresso como
  peso; ficou fora do escopo de propósito). Testada com 13 casos
  isolados cobrindo cadeia completa (Etapa→Setor→Pavimento→Tarefa),
  níveis pulados, folha genérica e divisão por zero sem gerar NaN — a
  invariante "soma das filhas = verba da mãe" foi verificada
  explicitamente e bateu em todos os casos.
- `calcularVerbaPorEtapa(nomeProjeto)` / `calcularVerbaPorEtapaSalvo(nomeProjeto)`
  — verba de CADA Etapa (mesmo padrão dual "ao vivo do DOM" vs "já
  salvo em localStorage" que o resto do módulo já usava). Etapa
  "Detalhamento" usa a fórmula especial (Analista + parcela de
  Escritório + parcela de Supervisor, reaproveitando
  `calcularVerbaDetalhamentoPuro`, que continua existindo — só ficou
  órfã a camada por cima dela). Demais Etapas usam só a fatia do
  Analista (% da linha na Aba 2 × Valor Analista). **Assunção
  registrada, não confirmada explicitamente pelo usuário**: %
  Distribuição de Lucros passou a descontar da verba bruta de TODA
  Etapa igualmente (antes só existia sobre o bolo único de
  Detalhamento) — fazia mais sentido dado que agora toda Etapa gera
  verba, mas se o usuário quis dizer algo diferente, avisar.
- Limpeza: 3 funções ficaram órfãs e foram removidas —
  `calcularVerbaDetalhamento()`, `calcularVerbaDetalhamentoSalvo()`,
  `buscarPctDetalhamentoEAviso()` (só calculavam o bolo único de antes,
  substituídas pelas duas acima). `calcularVerbaDetalhamentoPuro()`
  continua existindo, só mudou quem a chama.

**Setor ganhou campos próprios** (`js/arvore.js`): Área Física e Peso
do Esforço, no formulário de criação e no painel de edição — mesmo
padrão que Pavimento já tinha, incluindo o mesmo mini-resumo visual
"Área Eq./Fração de Verba", mas comparando contra os Setores IRMÃOS
(mesmo pai), não contra o projeto inteiro.

**Aba 3 "Verba para Detalhamento" virou "Verba por Etapa"**: antes
mostrava 1 total único pro projeto; agora lista TODAS as Etapas, uma
linha cada, com %/Verba Bruta/Valor Lucros/Verba Líquida — "Detalhamento"
aparece com uma anotação visual indicando a fórmula especial. % Distribuição
de Lucros continua sendo o único campo editável, agora aplicado a cada
linha.

**Aba 4 "Verba por Pavimento" ganhou uma seção nova, condicional**: uma
tabela "Verba por Setor" aparece ACIMA da tabela de Pavimentos, só
quando o projeto realmente tem algum Setor cadastrado (função nova
`listarSetoresDoProjeto`) — Área/Peso editáveis ali (`editarAreaPesoVerbaSetor`,
mesmo padrão do item 13), mostrando de qual Etapa/Setor pai cada um
depende. A tabela de Pavimentos em si não mudou de forma, só a fonte
do cálculo — "% da Verba" agora é relativo à própria Etapa do
pavimento, não mais ao projeto inteiro (fazia mais sentido dado que
cada Etapa agora tem seu próprio bolo).

**Efeito colateral corrigido (não pedido, mas necessário)**:
`js/distribuicao-lucro.js` (Distribuição de Lucros dos Estagiários)
chamava `aplicarVerbaProporcionalAosPavimentos()` direto — função
removida nesta mudança. Corrigido reaproveitando a MESMA cascata por
Etapa, só que alimentada com o `valorLucros` de cada Etapa em vez da
`verbaLiquida` — como bônus, a distribuição de lucros pros Estagiários
também passou a respeitar fronteira de Etapa (antes ignorava, mesmo
bug estrutural dos itens 5/6/7 mas na conta de lucros). Testado
isoladamente, funciona sem quebrar.

**Validação final**: `node --check` limpo em todos os `.js` do projeto;
`<div>`/`<table>`/`<tr>`/`<td>`/`<th>`/`<thead>`/`<tbody>`/`<select>`/`<form>`
todos balanceados no `index.html`; conferido que não sobrou nenhuma
chamada às funções removidas em lugar nenhum do projeto. **Ainda SEM
teste real no navegador.**

**Pendências que ficam pro usuário decidir/confirmar depois do teste
no navegador**: (1) a assunção sobre Lucros aplicado a toda Etapa
(acima); (2) o comportamento visual da nova tabela "Verba por Setor"
na prática — só testei a lógica isoladamente, não vi renderizado de
verdade; (3) itens 8 e 14, que continuam de fora desta leva.

### Implementado nesta rodada (agosto/2026, leva 4 — parte 3: itens 2-correção, 15, 16, 17-parcial, e checagem de Relatórios/BI)
Usuário deu ordem explícita ("implemente tudo o que discutimos e ainda
está pendente"). Implementado tudo que já tinha desenho fechado;
ficaram de fora, de propósito: item 8 (aguardando reconfirmação do
usuário), item 14 (escopo não fechado), e as partes do item 17 que
dependiam de decisão do usuário (fusão automática/recuperação em massa
dos dados já órfãos — usuário recebeu um comando de recuperação manual
via Console pra rodar por conta própria, se quiser).

**Domínio 1 — `js/cadastros.js` + `index.html` (correções do item
17)**: `.trim()` no nome de Projeto/Cliente/Funcionário antes de
salvar (evita o "espaço fantasma" que causou o caso real "OBRA B"→"
B"). Busca por NOME em vez de índice de array em `salvarProjeto()` —
novo campo oculto `proj-nome-original` guarda o nome de quando o
formulário abriu, eliminando o risco de salvar por cima do projeto
errado se `banco_projetos` mudar de ordem/tamanho enquanto o
formulário estava aberto (ex: sincronização em segundo plano). Quando
uma colisão de nome faz a migração de árvore ser pulada (proteção já
existente, item 5/6), agora o usuário recebe um `alert()` explicando o
que aconteceu — antes acontecia em silêncio, e foi exatamente essa
falta de aviso que levou à investigação manual via Console que
descobriu o caso real. Testado: 5 testes isolados (Node, simulando
localStorage+DOM), incluindo reprodução exata do cenário "OBRA B" (a
árvore com a etapa real não é mais tocada quando há colisão).

**Domínio 2 — `js/arvore.js` (itens 2-correção, 15, 16)**:
- Item 2: "Valor Contratado Líquido" na aba Propriedades Contratuais
  Macro agora é valor bruto menos impostos (lendo `pct_impostos` já
  salvo em `banco_distribuicao_custos` daquele projeto — decisão do
  usuário: sem fallback especial, sempre assume que vai ter algo
  salvo). Testado isoladamente.
- Item 16: Executor E Responsável de toda Etapa nova (tanto as Etapas
  Default criadas automaticamente quanto as criadas manualmente pelo
  formulário "Plugar Componente na Árvore") agora nascem preenchidos
  com o Analista do Cadastro de Projetos — antes só Executor vinha
  preenchido, e só no caminho automático. `criarNoVazio()` ganhou um
  4º parâmetro (`responsavelInicial`). Testado isoladamente.
- Item 15: "Custo Máx Teto" virou read-only, calculado AO VIVO
  (opção "b" escolhida pelo usuário) a partir da cascata de verba do
  item 10 (`distribuirVerbaRecursiva` + `calcularVerbaPorEtapaSalvo`,
  rodados direto em cima da árvore já carregada nesta mesma função —
  evita o problema de comparar objetos de duas leituras separadas do
  localStorage, que nunca bateriam por referência). "Horas Limite"
  continua sendo essa verba dividida pelo valor-hora do Executor
  (confirmado pelo usuário) — só que agora usa `valorHoraVigente()`,
  a mesma função que a Aba 5 de Distribuição de Custos já usa (o
  código antigo lia um campo `funcionario.hora` que não existe de
  verdade no Cadastro — sempre caía num fallback fixo de 50, sem
  relação com o valor real). Testado isoladamente (6 casos, incluindo
  proporção por Pontos e tarefa sem executor).

**Domínio 3 — checagem pendente de Relatórios/BI (mencionada desde a
leva 4 original, nunca feita até agora)**: confirmado o MESMO padrão
de bug dos itens 5/6/7 em `js/bi.js` (2 funções — calibração do
Catálogo Global e fechamento financeiro da Controladoria) e
`js/relatorios.js` (2 funções — sessões de trabalho e tarefas) — todas
liam `banco_arvores_projetos` cru, sem cruzar com `banco_projetos`,
então projetos deletados/renomeados continuavam entrando nos
relatórios e no fechamento financeiro global. `js/painel-progresso.js`
foi conferido e **já estava correto** (usa `banco_projetos` como fonte
da lista, nunca teve esse bug). Corrigido nos 4 pontos usando o mesmo
`obterArvoresProjetosAtivas()` já criado no item 5/6/7. Testado
isoladamente.

**Validação final**: `node --check` limpo em todos os `.js` do
projeto; HTML balanceado; TODOS os testes isolados acumulados nesta
conversa inteira foram re-executados juntos (cascata do item 10, Setor
na Aba 4, órfãos do item 5/6/7, item 17, item 15, bi/relatórios) — sem
nenhuma regressão. **Ainda SEM teste real no navegador.**

### Registradas, ainda pendentes de implementação (leva 4 — itens que ficaram de fora desta rodada)
1. **Item 8** — pontos zerados na Atribuição de Tarefas. Investigação
   anterior não achou bug estrutural (ver histórico completo abaixo,
   item 8 original). Usuário vai reconfirmar num teste futuro antes de
   qualquer nova investigação.
2. **Item 14** — reativar arrastar-e-soltar em Setor/Pavimento/Tarefa.
   Registrado, mas sem fechar ainda o escopo exato (todos os níveis ou
   só algum específico).
3. **Item 17, partes que ainda dependem de decisão do usuário** —
   melhorar a proteção de colisão de nome pra além do simples aviso
   (fusão automática? bloqueio do rename?); recuperação EM MASSA dos
   dados já órfãos no localStorage do usuário (ele recebeu um comando
   pra rodar manualmente no Console, pra "OBRA B" — mas "OBRA A" e
   "OBRA C" também apareceram na lista dele e provavelmente têm o
   mesmo problema, ainda não confirmado nem resolvido).


### Histórico completo da leva 4 (desenho e investigação de TODOS os 14 itens, incluindo os já implementados acima)
Usuário trouxe 12 pendências numa lista só (Propriedades Contratuais
Macro, bugs de dado órfão no Kanban/Atribuição, e a aba "Verba por
Tarefa"/"Verba por Pavimento" de Distribuição de Custos). Pela regra
§13.5 (acumular, não implementar sem ordem explícita) e §13.2 (um
domínio por vez — isso aqui cobre uns 4 domínios diferentes), **nada
foi implementado ainda** — só registrado, com pistas de código onde já
investiguei sem navegador. Usuário confirmou que os bugs abaixo
acontecem tanto via `http://localhost` quanto via `file://` — não é o
falso-bug já catalogado, é problema de dado/lógica real.

1. **✅ IMPLEMENTADO (ver seção acima). Percentual de Impostos — pré-preencher com 23%.** Simples: hoje o
   default é 21% (`js/distribuicao-custos.js`, dois lugares — linha
   ~847, fallback quando não há `banco_ultimo_percentual_impostos` nem
   valor salvo pro projeto; e o HTML do campo, se tiver um `value`
   fixo também). Trocar '21' por '23' nesses pontos.
2. **Propriedades Contratuais Macro (painel de detalhes da Árvore, nó
   raiz do projeto) — dados não se correlacionam com o Cadastro de
   Projetos.** Confirmado no código (`js/arvore.js::visualizarNo()`,
   bloco `path === 'raiz'`, linhas ~440-441): "Área Total Comercial" e
   "Valor Contratado Líquido" leem `pObj.area_comercial`/
   `pObj.valor_contrato`, que são campos **próprios de
   `banco_arvores_projetos`** (default hardcoded "5000"/"250000" na
   criação do projeto, editáveis só ali via "Atualizar Diretrizes do
   Projeto") — **campos totalmente separados** de `projeto.area`/
   `projeto.valor` do Cadastro (`banco_projetos`), que é o que a
   Distribuição de Custos usa de verdade
   (`carregarProjetoDistribuicao()`, linha ~828, lê
   `projetos.find(...).valor`). São dois números diferentes hoje, sem
   nenhuma sincronização — exatamente o sintoma relatado. **Precisa de
   decisão de desenho**: Área/Valor nesta aba devem (a) virar
   read-only espelhando o Cadastro (como já é Analista/Supervisor
   nessa mesma tela), ou (b) sumir os campos duplicados
   `area_comercial`/`valor_contrato` da árvore e usar
   `projeto.area`/`projeto.valor` direto em todo cálculo que hoje lê
   os primeiros (Fator de Esbeltez/Sensibilidade Analista continuam
   sendo específicos da árvore, esses dois não têm equivalente no
   Cadastro)? **DECIDIDO pelo usuário: opção (a) — os dois campos
   viram read-only nesta aba, espelhando `projeto.area`/`projeto.valor`
   do Cadastro, mesmo padrão visual já usado em Analista/Supervisor
   (fundo cinza, `readonly`, texto "editável no Cadastro de
   Projetos").** ✅ Área Total Comercial: IMPLEMENTADO e correto, já
   espelha `projCadastro.area`. ✅ **Valor Contratado Líquido: CORRIGIDO
   (ver seção "Implementado nesta rodada — parte 3"). Era um bug de
   implementação encontrado agora, numa conversa posterior — hoje
   mostra o valor BRUTO do contrato (`projCadastro.valor` direto, via
   `formatarMoeda()`), não o líquido.** Usuário esclareceu: "Valor
   Contratado Líquido" deve ser **valor do contrato menos impostos**
   (mesmo conceito de `valorLiquido` que já existe em
   `js/distribuicao-custos.js`: `valorContrato - pctImpostos/100 *
   valorContrato`). **DECIDIDO pelo usuário**: buscar sempre de
   `banco_distribuicao_custos` (percentual JÁ SALVO pra aquele
   projeto) — usuário lembrou que o default de 23% (item 1, já
   implementado) garante que sempre vai ter algo salvo. **Nota técnica
   pra quando for implementar**: vale conferir isso na prática — 23%
   é hoje só um valor PRÉ-PREENCHIDO no campo `#dc-pct-impostos`
   quando a aba "Orçamento Global" é aberta pela primeira vez; só é
   gravado em `banco_distribuicao_custos` de fato quando alguém clica
   em "Salvar Distribuição" naquela aba. Ou seja, um projeto recém-
   criado no Cadastro, que ainda NUNCA teve a tela de Distribuição de
   Custos aberta+salva, não vai ter nada em `banco_distribuicao_custos`
   ainda — nesse caso específico (raro, mas possível), o valor viria
   como R$ 0,00 (não como o contrato bruto). Não é pra construir
   nenhum fallback especial pra esse caso — só registrar que pode
   aparecer R$ 0,00 num projeto novíssimo até alguém abrir/salvar a
   Distribuição de Custos dele pela primeira vez, conforme decisão do
   usuário. Ainda não implementado — falta decidir se
   `area_comercial`/`valor_contrato` continuam existindo em
   `banco_arvores_projetos` só como campo morto (não usado em cálculo
   nenhum) ou se são removidos/migrados; e checar se algum cálculo do
   sistema (Fator de Esbeltez, Área Equivalente, etc.) hoje usa
   `pObj.area_comercial`/`pObj.valor_contrato` em vez do valor do
   Cadastro — se usar, precisa trocar a fonte pra não quebrar nada.
3. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Renomear rótulos nesta mesma aba: "Supervisor Geral" → "Supervisor",
   "Analista Líder" → "Analista".** Troca simples de texto
   (`js/arvore.js`, mesmas linhas ~444-445). O **conteúdo** desses dois
   já é lido do Cadastro (`analistaAtual`/`supervisorAtual`, via
   `nomeParaExibicao(projCadastro.analista/.supervisor)`) — já batem
   com o Cadastro hoje, só os rótulos estão diferentes.
4. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Mais destaque para o status do projeto (Em Análise/Liberado pra
   Detalhamento) nesta aba — DESENHO PROPOSTO, aguardando aprovação
   do usuário antes de codar.** Hoje é um texto pequeno
   (`font-size:11px`) ao lado do nome da obra
   (`js/arvore.js::visualizarNo()`, linha ~437). Proposta: tirar o
   status de dentro da linha "Nome Oficial da Obra" e criar um
   **banner de largura total**, logo abaixo do título da seção
   ("🏢 Propriedades Contratuais Macro do Projeto") e antes do campo
   Nome — reaproveitando o MESMO padrão visual de selo já usado em
   `exibirSeloConferencia()` (`js/distribuicao-custos.js`) e nos
   avisos existentes desta própria tela (ex.: linha 496, aviso de
   "em revisão"): fundo `#fef9c3`/texto `#854d0e` quando "Em Análise"
   (mesma cor de alerta já usada no sistema), fundo `#f0fdf4`/texto
   `#166534` quando "Liberado" (mesma cor de sucesso já usada),
   `font-size` maior (14px, contra 11px hoje), `font-weight:bold`,
   padding generoso (8-10px), com o ícone/rótulo atual
   (🔬 Em Análise / ✅ Liberado pra Detalhamento) e o botão de
   alternar (`alternarStatusLiberacaoProjeto()`) dentro do mesmo
   banner, alinhado à direita. Reaproveita cores e padrão já
   existentes no sistema — não introduz estilo novo. **Pronto pra
   implementar, junto com os itens 2+3 (mesmo bloco de código),
   assim que o usuário aprovar.**
5. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). BUG CONFIRMADO — dados órfãos no Kanban após deletar/renomear
   projeto.** Causa raiz encontrada em `js/cadastros.js::deletarProjeto()`
   (linha 567-573): remove o projeto só de `banco_projetos` (lista do
   Cadastro) — **nunca apaga a entrada correspondente em
   `banco_arvores_projetos`** (onde vivem as Etapas/Tarefas de
   verdade). Mesma causa pra renomear: `salvarProjeto()` (linha 515)
   atualiza o `nome` dentro de `banco_projetos`, mas
   `banco_arvores_projetos` é um objeto **indexado pela chave = nome
   do projeto** — renomear não migra essa chave, então a árvore antiga
   fica órfã sob o nome antigo ("Obra A"), e o projeto renomeado ("A")
   não enxerga essa árvore quando abre a Estrutura de Projeto (por
   isso "não aparece na estrutura", mas "aparece no Kanban" — o
   Kanban, ver próximo item, não filtra por isso). Confirma
   exatamente os sintomas relatados (Obra A sumida da Árvore mas viva
   no Kanban; Obra B trocada de nome com o mesmo problema; obras
   apagadas continuando no Kanban do responsável).
6. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Causa complementar do item 5 — Kanban/Atribuição de Tarefas
   iteram `banco_arvores_projetos` inteiro, sem filtrar contra a lista
   atual de `banco_projetos`.** Confirmado em
   `js/kanban.js::calcularRankingProdutividadeExecutores()` (linha
   280+, `Object.keys(arvores).forEach(...)` sem checar se o nome
   ainda existe em `banco_projetos`) — o mesmo padrão provavelmente se
   repete nas outras funções do Kanban que listam tarefas (linhas 541,
   704, 735, 762, 769, 841 usam `banco_arvores_projetos` sem cruzar
   com `banco_projetos` visivelmente; preciso revisar cada uma na hora
   de implementar). **Correção provável em duas frentes**: (a)
   `deletarProjeto()` também apagar `todasArvores[nome]` de
   `banco_arvores_projetos`; (b) `salvarProjeto()`, ao detectar que o
   nome mudou (edição, nome antigo ≠ novo), migrar a chave em
   `banco_arvores_projetos` (`todasArvores[novoNome] =
   todasArvores[nomeAntigo]; delete todasArvores[nomeAntigo];`) em vez
   de deixar órfã. Isso resolve a causa raiz pros dois problemas (Obra
   A/B) de uma vez. Ainda preciso confirmar se há mais algum lugar do
   sistema (Relatórios, BI, Painel de Progresso) com o mesmo padrão de
   iterar sem filtrar, antes de fechar o escopo da correção.
7. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Atribuição de Tarefas mostra tarefas de obras deletadas** — mesma
   causa raiz do item 5/6 (`js/atribuicao-tarefas.js` também lê
   `banco_arvores_projetos` cruzando com `banco_projetos` em alguns
   pontos — linha 113/152 — mas preciso confirmar se o cruzamento
   cobre todos os caminhos de listagem antes de garantir que a mesma
   correção resolve os dois itens juntos).
8. **Pontos de tarefa vêm zerados na Atribuição de Tarefas, mas a
   MESMA tarefa mostra o valor certo na Estrutura de Projeto (Árvore)
   — confirmado pelo usuário.** Pedido adicional: os dois lugares
   devem ficar editáveis, e editar num lugar deve refletir
   imediatamente no outro. Investigação mais funda (sem navegador,
   ainda sem causa raiz encontrada): os dois lugares **já** operam
   sobre o mesmo objeto vivo hoje —
   `coletarNosFolhaDaArvore()` (`js/core.js`) devolve a referência
   real do nó (não uma cópia), então `tarefa.pontos` lido em
   `coletarTodasTarefasDeTodosProjetos()`
   (`js/atribuicao-tarefas.js`, linha 260, `pontos: tarefa.pontos || ''`)
   é o mesmo campo que a Árvore edita
   (`js/arvore.js::salvarAlteracoesNo()`, linha 592,
   `no.pontos = ...`) e que a própria Atribuição de Tarefas já
   permite editar (`editarPontosTarefaAtribuicao()`,
   `js/atribuicao-tarefas.js` linha 895 — já usa
   `resolverNoPorPath()` e grava em `banco_arvores_projetos`
   corretamente, mesmo padrão de sempre). Ou seja, **o pedido de
   "os dois editáveis e sincronizados" parece já estar implementado
   estruturalmente** — não achei um caminho de código onde os dois
   lugares leem fontes diferentes. **Preciso do cenário exato pra
   achar a causa real**: qual projeto/tarefa especificamente mostrou
   0 na Atribuição enquanto a Árvore mostrava outro valor? (Pode ser
   um caso específico de Sub-etapa — §12.29, ainda sem teste real no
   navegador — ou confusão com o `pontos` do Catálogo, que é só um
   valor de referência pra quando cria uma tarefa nova, campo
   diferente do `pontos` do nó já criado na árvore.) Perguntar ao
   usuário o nome do projeto/tarefa quando for reproduzir, ou pedir
   pra reproduzir com o Console do navegador aberto (F12) pra
   inspecionar `banco_arvores_projetos` direto. **Usuário concordou
   que pode ser confusão/já resolvido — vai reconfirmar num teste
   futuro antes de eu investigar mais.**
9. **Verba por tarefa proporcional aos Pontos × Verba do Pavimento —
   JÁ IMPLEMENTADO, aparentemente já é o comportamento atual.**
   `js/distribuicao-custos.js::recalcularGrupoVerbaPorTarefa()` (linha
   753+) já rateia o `valorVerba` do pavimento entre as tarefas
   proporcionalmente aos Pontos de cada uma, recalculando ao editar
   qualquer Ponto do grupo. Se o usuário está vendo algo diferente
   disso na aba "Verba por Tarefa" (aba 5 de Distribuição de Custos),
   pode ser: (a) confusão com a aba errada, (b) os Pontos de origem já
   virem zerados (ver item 8, mesma causa se propagando), ou (c) bug
   ainda não identificado — perguntar se o usuário já viu essa aba
   funcionando certo, ou se o problema é justamente ali.
10. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada — parte 2" acima). Verba em cascata por Etapa (e daí pra baixo) — desenho FECHADO
    pelo usuário depois de 3 rodadas de perguntas, NÃO implementado
    ainda.** Achado importante: o mecanismo já existe parcialmente no
    código, só não é usado do jeito que o usuário quer.
    - **Regra geral (qualquer Etapa, exceto "Detalhamento")**: a verba
      de cada Etapa é o valor que a própria Aba 2 "Distribuição de
      Custos Analista" já calcula por linha (`% daquela Etapa × Valor
      Analista` — `construirLinhaDistribuicaoAnalista()`,
      `js/distribuicao-custos.js` linha 263). **Hoje esse valor por
      Etapa não alimenta nada além da própria Aba 2** — a Aba 4
      (Verba por Pavimento) ignora de qual Etapa cada Pavimento é, e
      reparte um bolo único do projeto inteiro (via
      `calcularVerbaDetalhamento()`, que só usa a % de UMA linha
      específica, a de nome "Detalhamento" — ver abaixo). É essa
      ligação que falta: usar a verba de CADA linha da Aba 2 como
      ponto de partida da cascata daquela Etapa especificamente,
      dividida entre Setor/Pavimento/Tarefa pelos critérios já
      existentes (Área Equivalente pra Pavimento, Pontos pra Tarefa).
    - **Exceção confirmada pelo usuário — Etapa "Detalhamento"**: essa
      etapa em particular tem regra diferente porque o Escritório e o
      Supervisor também participam do custo dela. Verba dessa etapa =
      fatia do Analista (mesmo % da linha dela na Aba 2) **+**
      parcela do Escritório **+** parcela do Supervisor. **Isso já
      existe implementado hoje** — é exatamente o que
      `calcularVerbaDetalhamentoPuro()` (`js/distribuicao-custos.js`
      linha 351) já faz, só que hoje é tratado como se fosse o ÚNICO
      bolo de detalhamento do projeto inteiro (todas as etapas
      teriam sua verba igual a zero, exceto essa). Com a
      generalização, essa continua sendo a fórmula especial só da
      etapa "Detalhamento" — as outras usam a regra geral (só
      Analista) acima.
    - **Cascata dentro da Etapa**: Setor, Pavimento ou Tarefa,
      dependendo de onde a árvore pula (níveis puláveis, §12.35) — nos
      moldes já explicados: Área Equivalente pra nós com Pavimento
      físico, Pontos pra Tarefas. **Setor precisa ganhar campos
      próprios de Área Física e Peso do Esforço** (pedido novo do
      usuário) pra poder competir por Área Equivalente entre Setores
      irmãos, do mesmo jeito que Pavimento já compete hoje — hoje
      Setor é só um agrupador sem campos físicos (ver §3 do
      documento, "Setor é só um agrupador"); **essa regra do §3
      precisa ser revista/ampliada** como parte desta implementação.
    - **Regra de negócio fechada pelo usuário, resolve a mistura no
      nível da Etapa**: se uma Etapa tem um ou mais Setores, ela NÃO
      pode ter nenhuma Tarefa subordinada direto a ela — Pavimentos e
      Tarefas nesse caso têm que estar vinculados ao Setor, não à
      Etapa. Ou seja, os filhos de uma MESMA Etapa são sempre do
      mesmo "tipo de uso": ou só Setor(es), ou só Pavimento(s)/Tarefa(s)
      direto — nunca misturado. **Resolve a pendência da Etapa.**
      Fica uma dúvida do mesmo tipo, um nível abaixo, ainda não
      perguntada: um Setor pode ter Pavimento E Tarefa direto como
      filhos ao mesmo tempo (misturados entre si), ou essa mesma regra
      de "não misturar" também vale dentro do Setor? **Confirmado pelo
      usuário: a mesma regra vale — nunca misturado dentro do Setor
      também.** Regra geral de "não misturar tipo de filho num mesmo
      nó" fecha em todos os níveis. **Desenho do item 10 fica
      totalmente fechado agora**, pronto pra implementar quando o
      usuário der a ordem.
    - **Escopo da implementação, quando for pra frente**: toca Aba 2
      (nenhuma mudança nela mesma, só passa a ser CONSUMIDA por
      Etapa), Aba 3 (deixa de calcular 1 bolo único do projeto,
      passa a calcular 1 bolo por Etapa — ou é substituída/generalizada),
      Aba 4 (deixa de ratear Pavimentos do projeto inteiro contra 1
      bolo, passa a ratear dentro do escopo de cada Etapa/Setor), Aba
      5 (mesma lógica de Pontos que já tem, sem mudança de fórmula, só
      de onde vem o "Valor da Verba" do Pavimento pai) — mudança grande,
      não é ajuste pontual.
11. **Horas Máximas = Verba da Tarefa ÷ Valor da Hora do executor —
    JÁ IMPLEMENTADO na Aba 5.** `calcularHorasMaximasVerbaPorTarefa()`
    (`js/distribuicao-custos.js`, linha 710) já faz exatamente essa
    conta, usando `valorHoraVigente()` (mesma fonte usada no resto do
    sistema). Já é recalculado junto com o Valor da tarefa
    (`recalcularGrupoVerbaPorTarefa()`). Mesma dúvida do item 9: se o
    usuário está vendo campo vazio/errado, pode ser efeito colateral
    do item 8 (Pontos zerados na origem) ou algo específico — perguntar
    o cenário exato visto.
12. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Reformatar a Aba "Verba por Tarefa" em tabela compacta, estilo
    Atribuição de Tarefas (linha de pouca altura), com linha
    destacada separando pavimentos e mantendo a subtotalização —
    NÃO implementado, é puramente visual/layout.** A lógica de cálculo
    já existe (itens 9 e 11); isso é reformatar CSS/HTML da tabela
    pra bater com o padrão visual já usado em
    `js/atribuicao-tarefas.js`. Pode ser feito independente dos
    outros itens desta leva.
13. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada" acima). Editar Área e Peso do Esforço direto na Aba "Verba por
    Pavimento", propagando a mudança pros demais campos —
    NÃO implementado.** Hoje `carregarAbaVerbaPavimento()` mostra
    `p.area`/`p.peso` como texto fixo na tabela (linhas 572-577) — o
    valor real vem do campo `area_fisica`/`peso_esforco` do nó
    Pavimento na árvore (só editável hoje na tela de Árvore/Estrutura
    de Projeto). Pedido: tornar essas 2 colunas editáveis aqui também,
    gravando direto no nó Pavimento (mesmo padrão de
    `editarPontosVerbaPorTarefa` — grava, sem botão Salvar) e
    recalculando toda a cascata que depende disso (Área Equivalente,
    % Verba, Valor da Verba do pavimento, e por consequência as Abas
    5/Verba por Tarefa também, já que dependem do valor do pavimento).
14. **Reativar arrastar-e-soltar em Setor/Pavimento/Tarefa — NÃO
    implementado, pergunta do usuário durante esta rodada.** Hoje
    (confirmado no código, `js/arvore.js::renderizarNoRecursivo()`,
    linhas 205-222) o `draggable`/`ondragstart`/`ondrop` só existe
    quando `isEtapa` é verdadeiro — reordenar Etapas entre si na raiz
    do projeto continua funcionando. Setor, Pavimento e Tarefa **não
    têm mecanismo de reordenar hoje** (nem arrastar, nem outro jeito)
    — não é regressão, foi simplificação deliberada registrada em
    §12.35 (Árvore Genérica Recursiva v2: "arrastar-e-soltar só em
    Etapa (não mais em Setor)"). Usuário pediu pra registrar como
    pendência, sem fechar ainda se quer reativar em todos os níveis ou
    só em algum específico — perguntar ao usuário o escopo exato
    quando for priorizar este item.
15. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada — parte 3" acima). Estrutura de Projeto → Detalhes do nó → componente Tarefa: "Custo
    Máx Teto" e "Horas Limite" devem vir do cálculo de verba, não mais
    de um valor digitado à parte — desenho FECHADO, NÃO implementado
    ainda.** Usuário reportou que já tinha pedido isso antes e não foi
    feito corretamente — vale conferir com atenção quando for
    implementar. Comportamento hoje (`js/arvore.js`, painel de edição
    de nó, linhas 526/541-542/632): "Custo Máx Teto" é um campo
    numérico **digitado manualmente** pelo usuário (`no.custo_max`,
    editável em `#edit-t-customax`); "Horas Limite" é só leitura,
    calculada como `custo_max ÷ valor-hora do Executor designado no nó`
    (variável local `vHora`, vem de `funcionario.hora`).

    **Desenho fechado pelo usuário**:
    - "Custo Máx Teto" passa a ser **read-only**, mostrando o
      resultado do cálculo de verba (o `_verbaCalc` que o motor do
      item 10 já produz — `distribuirVerbaRecursiva`, em
      `js/distribuicao-custos.js`) apontado pra aquela Tarefa
      especificamente — deixa de ser um campo editável/digitado à mão
      (mesmo espírito do que já foi feito nos itens 2/3, Propriedades
      Contratuais Macro: campo calculado em outro lugar do sistema
      vira só-leitura aqui, pra nunca ficar dessincronizado).
    - "Horas Limite" continua sendo essa verba (agora calculada, não
      mais digitada) dividida pelo valor-hora do **Executor** —
      confirmado pelo usuário, mesmo campo que a fórmula de Horas
      Máximas da Aba 5 de Distribuição de Custos já usa. Consistente
      com o resto do sistema.
    - **Fonte do valor: opção (b), calculado AO VIVO** — confirmado
      pelo usuário. Toda vez que o painel de edição de uma Tarefa for
      aberto em `js/arvore.js`, o valor vem fresco (sem persistir nada
      na árvore, sem depender de alguém ter salvo a Distribuição de
      Custos antes) — evita o problema de "Árvore mostrando número
      desatardo até alguém mexer em outra tela".

    **Nota técnica pra quando for implementar** (ainda não é código,
    só o caminho já mapeado): como a tela de Árvore não tem os campos
    da Aba 1 de Distribuição de Custos no DOM (%Impostos/Analista/etc,
    só existem na tela de Distribuição de Custos), só a variante
    "Salva" serve aqui —
    `calcularListaPavimentosComVerbaSalva(projetoSelecionadoAtivo)`
    (que já roda a cascata inteira e devolve pavimentos com `.tarefas`,
    cada uma já com `_verbaCalc` preenchido). O painel de edição
    precisa achar, dentro do array de pavimentos retornado, o
    Pavimento cujo `caminho` é prefixo do `path` da Tarefa aberta, e
    dentro dele a Tarefa certa (por nome+índice, já que `_verbaCalc` é
    uma propriedade em memória no objeto retornado, não algo buscável
    por path direto na árvore salva). Se o projeto ainda não tiver
    nenhuma Distribuição de Custos salva (`banco_distribuicao_custos`
    vazio pra esse projeto), o valor sai zerado — vale considerar um
    aviso visual nesse caso, em vez de só mostrar R$ 0,00 sem
    explicação.
16. **✅ IMPLEMENTADO (ver seção "Implementado nesta rodada — parte 3" acima). Default de Executor e Responsável nas Etapas: sempre o Analista
    do Cadastro de Projetos — NÃO implementado (parcialmente já
    existe).** Confirmado no código, duas lacunas diferentes:
    - **Etapas Default (criadas automaticamente ao criar um projeto
      novo, a partir do Catálogo — §12.30)**: `js/arvore.js::criarEtapaDefaultAPartirDoCatalogo()`
      (linha 84, chamada por `js/cadastros.js::salvarProjeto()` linha
      544) **já** preenche o Executor com o Analista do projeto
      (`nv.analista`) — mas o campo **Responsável** não é preenchido
      (fica `''`, vazio, mesmo default de `criarNoVazio()`). Falta só
      completar esse caminho.
    - **Etapas criadas manualmente** (formulário "Plugar Componente na
      Árvore", nível Etapa): `js/arvore.js::salvarPecaNaArvore()`
      (linha 371, `arv.etapas.push(criarNoVazio(nome, null, ''))`) não
      preenche Executor nem Responsável — os dois nascem vazios. Esse
      caminho nem pede Executor/Responsável no formulário de criação
      hoje (Etapa e Setor "não pedem nada além do Nome", comentário já
      existente no código) — o valor só seria preenchido se alguém
      abrir o painel de edição do nó depois de criado e escolher
      manualmente.
    **Pedido do usuário**: os dois casos devem, por padrão, vir
    preenchidos com o Analista do Cadastro de Projetos daquele
    projeto (`projCadastro.analista`) — tanto Executor quanto
    Responsável. Não impede edição posterior (é só o valor inicial).
    Escopo parece simples (2 pontos de código, ambos já mapeados) —
    ainda assim, registrar só, sem implementar, até ordem explícita.
17. **✅ CAUSA RAIZ CORRIGIDA (ver seção "Implementado nesta rodada — parte 3" acima; partes que dependiam de decisão do usuário ficaram de fora, ver lista de pendências). BUG REAL E CAUSA RAIZ CONFIRMADA (com dado real do usuário) —
    dados não foram perdidos, mas ficaram órfãos e inacessíveis pela
    tela normal. NENHUMA correção implementada ainda.**

    **O que aconteceu, passo a passo, confirmado via Console (F12)
    pelo usuário**:
    1. O projeto "OBRA B" tinha etapas de verdade (trabalho real).
    2. Em algum momento, o usuário renomeou "OBRA B" pra "B" (ou " B",
       com espaço — ver bug secundário abaixo) no Cadastro de
       Projetos.
    3. A migração de árvore que criei nesta mesma leva (item 5/6,
       `js/cadastros.js::salvarProjeto()`, branch de edição) tem uma
       proteção: só migra a árvore do nome antigo pro novo **se o
       nome novo ainda não tiver árvore própria**
       (`if (todasArvores[nomeAntigo] && !todasArvores[n])`) — pensada
       pra não sobrescrever um projeto DIFERENTE que já existisse com
       aquele nome.
    4. **Só que, nesse caso, o nome novo (`" B"`) JÁ tinha uma árvore
       — vazia, de algum projeto criado antes com esse mesmo nome**
       (não outro trabalho real, só uma árvore vazia/esquecida). A
       proteção viu que já existia algo lá e **pulou a migração de
       propósito** — exatamente como deveria fazer nesse cenário
       (não sobrescrever), só que o resultado prático foi ruim: os
       dados reais ficaram presos sob o nome antigo "OBRA B"
       (confirmado: `banco_arvores_projetos["OBRA B"].etapas` ainda
       tem as etapas de verdade), enquanto o projeto ATIVO "B"/" B"
       aponta pra uma árvore vazia (`etapas: []`) — dando a impressão
       de que as etapas "sumiram", quando na verdade nunca chegaram a
       ser migradas.

    **Confirmado com dado real do usuário** (não é mais só hipótese):
    `banco_arvores_projetos[" B"].etapas` → `[]` (vazio);
    `banco_arvores_projetos["OBRA B"].etapas.map(e => e.nome)` →
    etapas de verdade, com nome. **Os dados existem, só estão no
    lugar errado.**

    **Bug secundário confirmado nesse mesmo caso (espaço fantasma no
    nome)**: a chave real é `" B"`, com um espaço ANTES do B, não
    `"B"`. Causa: `js/cadastros.js::salvarProjeto()` (linha 516) valida
    o campo Nome só com `n.trim()` (checa se não fica vazio depois de
    aparar espaço) mas **grava o valor ORIGINAL sem aparar**
    (`nome: n`, deveria ser `nome: n.trim()`) — usado tanto no
    Cadastro quanto como CHAVE em `banco_arvores_projetos`. Esse
    espaço a mais provavelmente é o motivo de ter existido uma árvore
    "vazia" já sob esse nome antes da migração ser tentada (alguém
    criou um projeto novo sem perceber o espaço, ou o espaço entrou
    na hora de copiar/colar o nome).

    **Pista adicional, ainda sem confirmação**: usuário mencionou
    antes que "etapas deletadas voltaram" — na investigação, ficou
    claro que essa observação era sobre os NOMES DE PROJETO
    (`Object.keys(banco_arvores_projetos)`, que ainda lista órfãos
    como "OBRA A/B/C" mesmo depois de deletados/renomeados no
    Cadastro), não sobre etapas voltando de verdade dentro de uma
    árvore. Ou seja: **não há evidência real de deleção de etapa
    "voltando"** — era o mesmo fenômeno de árvore órfã, só mal
    interpretado na hora de descrever. Descartar essa hipótese
    secundária (Firebase desfazendo deleções) por enquanto — a
    explicação simples (órfãos de rename) já cobre tudo que foi visto.

    **Correções necessárias, nenhuma implementada ainda**:
    1. `nome: n.trim()` em `salvarProjeto()` (e provavelmente Cliente/
       Funcionário também — checar) — resolve o espaço fantasma pra
       frente.
    2. A proteção "não migra se já existe árvore no nome novo" (item
       5/6) precisa de um comportamento melhor pro caso de colisão —
       hoje falha SILENCIOSAMENTE (sem avisar ninguém que ficou uma
       árvore órfã pra trás). Pelo menos um AVISO visível pro usuário
       nesse momento ("Já existe uma árvore sob esse nome — a árvore
       anterior ficou salva como órfã, contate o suporte" ou
       similar) — precisa decidir com o usuário se quer aviso, fusão
       automática (juntar etapas dos dois?), bloqueio do rename, ou
       outra solução, antes de implementar.
    3. **Recuperação dos dados JÁ afetados** (não é código, é dado) —
       existem hoje pelo menos "OBRA B" órfã com etapas reais presas.
       Provavelmente também "OBRA A" e "OBRA C" (mesmo padrão, viram
       na lista de chaves). O usuário pode recuperar manualmente pelo
       Console AGORA (comando de recuperação oferecido no chat, fora
       deste documento) ou aguardar uma tela/rotina de recuperação
       futura — decidir com o usuário qual caminho.
    4. Revisitar a fragilidade de buscar por índice (`proj-index`) em
       vez de nome em `salvarProjeto()`, como blindagem geral — não
       foi a causa confirmada desta vez, mas é um ponto frágil real
       que vale corrigir de qualquer forma.

**9 dos 14 itens foram implementados nesta rodada — ver seção
"Implementado nesta rodada (leva 4 — parte 1)" no topo desta mesma
seção §14.** Ficaram de fora, de propósito: item 8 (aguardando
reconfirmação do usuário), item 10 (verba em cascata — maior item,
rodada dedicada em separado) e item 14 (escopo do arrastar-e-soltar
ainda não fechado). Itens 5/6/7 (dados órfãos), mesmo implementados,
ainda têm uma verificação pendente antes de considerar o escopo
totalmente fechado: checar se Relatórios/BI/Painel de Progresso têm o
mesmo padrão de iterar `banco_arvores_projetos` sem cruzar com
`banco_projetos` (só os pontos identificados em Kanban/Atribuição
foram corrigidos até agora).

### Registradas, aguardando decisão/maturação do usuário (não é falta de tempo — é decisão consciente de esperar)
1. **Tela estilo Gráfico de Gantt** — ideia ainda não fechada, o próprio
   usuário pediu pra amadurecer antes de qualquer código (ver §12.22).
2. **Cor amarelo (risco) / vermelho (atraso) no Painel de Progresso dos
   Projetos** — hoje o painel (`js/painel-progresso.js`) só mostra
   verde. Combinado esperar o usuário testar o verde na prática antes de
   definir a régua de quando vira amarelo/vermelho (ver §12.22).
9. **Índice de custo no Ranking de Produtividade (Pontos ÷ Real
   gasto)** — candidato melhor avaliado até aqui pelo próprio usuário,
   mas ele decidiu amadurecer com a diretoria antes de fechar formato e
   visibilidade (ver nota de escopo 2 na §12.28, inclusive o achado
   técnico de que Produtividade + esse índice juntos vazam o valor/hora
   exato do executor por dedução).
10. **Sub-etapas (§12.29) — IMPLEMENTADO, falta teste real no
    navegador.** Decisões que estavam em aberto foram assumidas na hora
    de implementar (3º valor de `etapa.tipo`, não evolução do
    `'unica'`; verba manual por Sub-etapa, conferida contra
    `verba_total` da Etapa — ver detalhes na §12.29).
11. **Bug relatado: tarefas de Etapa Única sob responsabilidade do
    Analista não aparecem no Kanban dele** — inspeção do código não
    achou causa estrutural óbvia (ver hipótese na §12.29); aguardando o
    usuário confirmar o cenário exato antes de diagnosticar mais.
12. **Etapas Default no Cadastro de Projeto (§12.30) — v2 IMPLEMENTADA,
    falta teste real no navegador.** Formulário de Cadastro de Projeto
    ganhou mini-editor de Etapas (Nome + Tipo por linha); ao salvar um
    projeto NOVO, a árvore já nasce gravada com a lista escolhida. Nunca
    se aplica em edição de projeto existente. v1 (populava na 1ª
    abertura da Árvore) foi removida do código por completo.
13. **Distribuição de Lucro (fundo) — IMPLEMENTADO (§12.28, Nota de
    escopo 1), falta teste real no navegador.** Tela nova
    "🎓 Distribuição de Lucro (Estagiários)", só-Administrador, com
    período por data e apuração das 2 fatias. Falta o usuário testar
    com dados reais (projeto com % Lucros preenchido, tarefas
    finalizadas, Estagiários cadastrados).
14. **Árvore Genérica Recursiva (§12.31) — ETAPA 1 e ETAPA 2 da v1
    IMPLEMENTADAS, mas SUPERADAS pela v2 (§12.35, item 16 abaixo).**
    Generalizou a regra de Etapa Única/Sub-etapas pra qualquer nível,
    mas ainda com estrutura fixa por nível
    (`.setores`/`.pavimentos`/`.tarefas`). Substituída pelo modelo de
    `filhos`+`nivel` (v2) logo depois, na mesma leva de trabalho —
    ver item 16.
15. **Bug corrigido: só 3 das 4 Etapas Default vieram pré-marcadas ao
    criar projeto novo** (faltava "Pré-Lançamento") — confirmado pelo
    usuário com print da tela real, corrigido em `normalizarNomeEtapa()`
    (§12.30, agora tolera acento e hífen também, não só espaço/
    maiúscula). Falta só o usuário confirmar no navegador que as 4
    aparecem certas agora.
16. **Árvore Genérica Recursiva v2 — "níveis puláveis, ordem
    obrigatória" (§12.35) — IMPLEMENTADA, falta teste real no
    navegador.** Segunda revisão do modelo: agora qualquer nó pode
    ganhar um filho de QUALQUER nível seguinte (não só o imediato) —
    Etapa pode ganhar Setor, Pavimento ou Tarefa direto; Setor pode
    ganhar Pavimento ou Tarefa direto — a ordem relativa continua
    obrigatória, só os níveis intermediários viram opcionais. Modelo de
    dados trocado de campos fixos por nível pra um único array
    `filhos` com `nivel` marcado em cada item. Motor da árvore
    reescrito de novo, mais 9 arquivos periféricos corrigidos
    (alguns tinham passado batido na v1). Simplificações registradas:
    arrastar-e-soltar só em Etapa (não mais em Setor), conveniência de
    "copiar tarefas do pavimento anterior" removida.

### Adiado por escopo (registrado, não esquecido)
3. **Estender `abrirEditorSessoes()` (tela Atribuição de Tarefas) pra
   também cobrir a trilha de Revisão** — hoje só mostra/edita sessões de
   Execução. É ferramenta administrativa de correção manual; ficou de
   fora da rodada que implementou o autoatendimento via Kanban
   (`abrirModalApontamentoManualKanban`, que já cobre as duas trilhas)
   (ver §12.22).
7. **Ranking de Produtividade dos Executores (§12.28) — falta teste
   real no navegador.** Implementado e validado estaticamente (Node +
   balanceamento + IDs), mas ninguém abriu a aba "🏆 Ranking" de
   verdade ainda, nos 3 níveis de acesso.
8. **Distribuição de Lucro (fundo) — DESENHO FINAL fechado na §12.28
   (Nota de escopo 1), ainda SEM estrutura de dados nem tela.** Origem
   do dinheiro (`valorLucros`, aba 3 da Distribuição de Custos) já
   existe; falta: (1) ratear `valorLucros` por Pavimento/Tarefa mesma
   fórmula das abas 4/5, (2) somar isso pras tarefas finalizadas no
   período = bolo total, (3) repartir o bolo entre Estagiários — parte
   igual, parte proporcional a Pontos acumulados, % de cada parte
   definido pelo Administrador a cada apuração. Falta ainda decidir a
   definição de "período" (ver pontos em aberto na §12.28). Só pro
   Administrador, diferente do Ranking acima.

### Sincronização multi-usuário (Firebase) — funcional, mas com testes e riscos em aberto
4. **Teste real com a equipe em paralelo** (múltiplas pessoas, redes
   diferentes, editando ao mesmo tempo) — ainda não foi feito. O que já
   foi validado: envio (localStorage → Firebase) e recebimento em
   dispositivo/aba nova (Firebase → localStorage), individualmente, pelo
   próprio usuário. Falta o cenário de verdade, com conflito potencial.
5. **Regras do Firebase em "modo de teste"** — banco fica acessível sem
   senha por 30 dias a partir da criação (feita em ~03/08/2026). Não
   adequado pra dado real de produção como está. Quando o sistema sair
   da fase de teste, precisa de regras de autenticação de verdade — não
   implementado, é trabalho à parte (ver `LEIA-ME_SYNC_PROVISORIO.md`).
6. **Escalabilidade do modelo de sync** — sincroniza o `localStorage`
   inteiro a cada mudança (debounce 3s + reforço 30s), não por campo.
   "Último que salva vence" no nível do banco todo. Funciona bem pro
   volume de dados de teste; reavaliar se o uso real da equipe crescer
   muito em paralelo (ver §12.23).
7. **ACHADO IMPORTANTE (agosto/2026) — testar abrindo o `index.html`
   direto do disco (`file:///...`) dá comportamento ERRADO/
   inconsistente, por causa do Firebase.** Usuário reportou um bug
   (Etapas Default não vinham pré-preenchidas ao criar projeto) que
   investiguei a fundo e não achei causa nenhuma no código — testei a
   lógica isoladamente com os dados exatos do Catálogo dele e bateu
   certinho. O usuário estava abrindo o `index.html` direto do disco
   (`file:///D:/...`), e o Console mostrava
   `Unsafe attempt to load URL ... from frame with URL ...`. Esse erro
   é do SDK do Firebase (usado na sincronização provisória) tentando
   uma operação interna de iframe, bloqueada pelo navegador porque
   `file://` trata cada arquivo como uma origem de segurança única.
   **Confirmado**: rodando o mesmo sistema via servidor local
   (`python -m http.server`, acessando por `http://localhost:8000/`
   em vez de `file:///`), o bug relatado sumiu — as 4 Etapas vieram
   certinho. **Conclusão prática: qualquer teste feito abrindo o
   arquivo direto do disco, daqui pra frente, não é confiável** — o
   Firebase (mesmo só rodando em segundo plano, sem o usuário mexer
   na sincronização diretamente) parece atrapalhar outras partes da
   página sob `file://`, não só o iframe em si. **Recomendação pra
   qualquer teste futuro, do usuário ou nas minhas próprias
   instruções**: sempre testar via `http://localhost` (servidor local
   simples tipo `python -m http.server`), nunca abrindo o arquivo
   direto. Vale considerar desligar a sincronização
   temporariamente (`SYNC_PROVISORIO_ATIVO = false` em
   `sync-provisorio-config.js`) pra testes locais que não precisam de
   sincronização, evitando esse tipo de interferência de vez.

### Infraestrutura em uso (pra não esquecer o estado atual)
- **Link de produção**: https://gleaming-scone-2511ce.netlify.app
  (deploy manual — pra atualizar, extrair o zip novo e arrastar a pasta
  de novo no painel do Netlify, aba do projeto → área "Production
  deploys"; ver `LEIA-ME_HOSPEDAGEM.md`).
- **Banco de dados**: Firebase Realtime Database, projeto
  `precisao-estrutural`, nó `precisao_estrutural_dados`. Config isolada
  em `js/sync-provisorio-config.js` (não mexer nesse arquivo sem motivo
  — nunca reescrever do zero, só `str_replace` pontual, pra não repetir
  o incidente de apagar a config já preenchida, ocorrido 2x nas rodadas
  anteriores).

### Ao abrir a próxima conversa
Ler este documento inteiro, com atenção especial neste bloco (§14) e na
§13 (processo). Depois, perguntar ao usuário qual dessas pendências (ou
algo novo) é a prioridade — não presumir.

**Onde paramos (agosto/2026, fim desta conversa)**: o lote grande de
14 melhorias nas telas de Cadastro (compactação de layout, validação
de data, edição in-place de Feriados, etc.) segue implementado e
**ainda sem teste real no navegador** — usuário disse explicitamente
que vai deixar esse teste pro final, depois de mexer em outras coisas
primeiro (não é esquecimento, é ordem escolhida por ele).

**Nesta conversa**, o usuário trouxe uma leva de pendências que cresceu
pra **17 itens no total**, todas registradas e desenhadas primeiro
(ver "Histórico completo da leva 4" acima, dentro da seção §14), e
foram implementadas em TRÊS rodadas, cada uma sob ordem explícita do
usuário. **14 dos 17 itens foram implementados**:

**Parte 1** (itens 1, 2+3+4, 5+6+7, 12+13): Percentual de Impostos
23%; Propriedades Contratuais Macro virou read-only espelhando o
Cadastro + rótulos renomeados + banner de status em destaque
(`js/arvore.js`); bug real de dados órfãos no Kanban/Atribuição de
Tarefas corrigido na causa raiz (`js/cadastros.js`+`js/kanban.js`+
`js/atribuicao-tarefas.js`+`js/core.js`, novo helper
`obterArvoresProjetosAtivas()`); Aba "Verba por Tarefa" reformatada em
tabela compacta, Área/Peso do Esforço editáveis na Aba "Verba por
Pavimento" (`js/distribuicao-custos.js`+`index.html`).

**Parte 2** (item 10, sozinho — o maior e mais complexo): motor de
cascata de verba por Etapa (`distribuirVerbaRecursiva`,
`calcularVerbaPorEtapa`/`Salvo`) — Etapa "Detalhamento" com fórmula
especial, demais Etapas com a fatia do Analista, cascateando por
Setor/Pavimento/Tarefa. Setor ganhou campos de Área/Peso. Aba 3 virou
"Verba por Etapa". Aba 4 ganhou seção "Verba por Setor". Efeito
colateral corrigido em `js/distribuicao-lucro.js`. **Assunção não
confirmada pelo usuário**: % Distribuição de Lucros descontando da
verba bruta de TODA Etapa igualmente.

**Parte 3** (correção do item 2, itens 15+16, e parte do item 17 —
esta rodada): usuário testou o sistema de verdade pela primeira vez
nesta conversa (fora do navegador ainda não tinha acontecido antes) e
achou, através de um bug real reportado (etapas "sumindo"), uma causa
raiz séria: renomear um projeto pra um nome que já tinha uma árvore
vazia fazia a proteção contra sobrescrita (item 5/6) pular a migração
SILENCIOSAMENTE — os dados reais ficavam órfãos, inacessíveis, mas
NÃO perdidos (confirmado com dado real do usuário via Console: "OBRA
B" ainda tinha as etapas, o projeto ativo "B"/" B" estava vazio).
Corrigido (`js/cadastros.js`+`index.html`): `.trim()` no nome de
Projeto/Cliente/Funcionário (causa do "espaço fantasma" — chave salva
como `" B"` em vez de `"B"`); busca por NOME em vez de índice de array
em `salvarProjeto()` (novo campo oculto `proj-nome-original`,
elimina risco de salvar por cima do projeto errado); aviso visível
(`alert()`) quando a colisão acontece, em vez de silêncio. Também
corrigido, junto: item 2 (Valor Contratado Líquido agora é líquido de
impostos de verdade, não bruto); item 15 (Custo Máx Teto virou
read-only, calculado ao vivo pela cascata do item 10; Horas Limite
passou a usar `valorHoraVigente()` em vez de um campo que não existia
de verdade no Cadastro); item 16 (Executor E Responsável de toda Etapa
nova, automática ou manual, nascem com o Analista do Cadastro). E a
checagem que ficava pendente desde a parte 1 — Relatórios/BI/Painel de
Progresso — finalmente feita: `js/bi.js` (2 funções) e
`js/relatorios.js` (2 funções) tinham o MESMO bug dos itens 5/6/7,
corrigidas com o mesmo `obterArvoresProjetosAtivas()`;
`js/painel-progresso.js` já estava correto, não precisou de correção.

Tudo testado isoladamente (Node, simulando localStorage+DOM fake onde
fazia sentido) e validado estaticamente no fim de CADA parte
(`node --check` limpo em todos os `.js`; HTML balanceado). Ao fim da
parte 3, **todos os testes isolados acumulados na conversa inteira
foram re-executados juntos, sem nenhuma regressão**. **Ainda SEM teste
real no navegador** — nem esta leva (nenhuma das 3 partes), nem o lote
de Cadastro de antes.

**Ficaram de fora, de propósito, em todas as 3 partes**:
- **Item 8** (pontos zerados na Atribuição) — investigação anterior
  não achou bug estrutural, usuário vai reconfirmar num teste futuro.
- **Item 14** (reativar arrastar-e-soltar em Setor/Pavimento/Tarefa) —
  escopo não fechado (todos os níveis ou só algum específico).
- **Partes do item 17** que dependiam de decisão do usuário: melhorar
  a proteção de colisão pra além do simples aviso (fusão automática?
  bloqueio?); recuperação EM MASSA dos dados já órfãos — usuário
  recebeu um comando pra rodar manualmente no Console pra "OBRA B",
  mas "OBRA A" e "OBRA C" (que também apareceram órfãs na lista dele)
  ainda não foram confirmadas nem resolvidas.

**Prioridade natural pra retomar**: (1) teste real no navegador de
TUDO que já foi implementado — o lote de Cadastro (14 itens) e a leva
4 inteira (14 dos 17 itens, incluindo a mudança grande do item 10 e a
correção crítica do item 17); (2) confirmar/resolver "OBRA A" e "OBRA
C" (mesmo padrão de órfã que "OBRA B", só que ainda não confirmado);
(3) itens 8, 14, e o resto do item 17, quando for a vez deles.

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
