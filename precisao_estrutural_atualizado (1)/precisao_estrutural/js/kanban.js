// =========================================================================
// MÓDULO: KANBAN DO EXECUTOR
//
// Tela pensada pro executor: mostra só a Tarefa e os Pontos, organizadas
// em colunas por Status. Arrastar um cartão pra outra coluna muda o
// status da tarefa na hora — é a forma do próprio executor ir atualizando
// o andamento do trabalho, sem precisar passar pela tela de Atribuição de
// Tarefas (que é do Analista/Administrador).
//
// AINDA NÃO TEM LOGIN — por decisão explícita (login fica pra depois,
// último passo do controle de acesso). Por enquanto, quem está testando
// escolhe manualmente o Executor num dropdown no topo da tela. Quando o
// login existir, essa escolha deve ser substituída por "usuário logado" e
// o dropdown pode sumir (ou virar só uma confirmação visual de quem é).
//
// Colunas = os mesmos 5 status "de trabalho real" já usados em todo o
// sistema (Apontada, Em Desenvolvimento, Aguardando Verificação, Pendente
// de Validação, Finalizada). "Sem Executor" não aparece aqui — não faz
// sentido nessa tela, já que só mostramos tarefas DE UM executor
// específico (que, por definição, já está atribuído).
//
// Sem storage próprio — lê/escreve direto em 'banco_arvores_projetos'
// (mesmo campo tarefa.status que a Árvore de Projeto e a Atribuição de
// Tarefas usam).
// =========================================================================

const KB_COLUNAS = [
    { status: 'Apontada', cor: '#94a3b8' },
    { status: 'Em Desenvolvimento', cor: '#3b82f6' },
    { status: 'Aguardando Verificação', cor: '#f59e0b' },
    { status: 'Para revisão', cor: '#ef4444' },
    { status: 'Finalizada', cor: '#10b981' }
];

// Item 5 da "rodada de pedidos da diretoria" (ver prompt_gemini.md §11):
// o Executor só pode arrastar cartão pras 3 primeiras colunas (Apontada,
// Em Desenvolvimento, Aguardando Verificação). "Para revisão" e
// "Finalizada" são destino de quem VERIFICA (Analista/Supervisor/
// Administrador — o Kanban do Analista chegou a existir como tela
// própria e foi removido depois, ver §7.2/§11; quem verifica usa a
// Atribuição de Tarefas, com destaque próprio). Só nível 'executor' é
// restrito; os demais continuam livres em qualquer coluna.
const KB_STATUS_RESTRITOS_EXECUTOR = ['Para revisão', 'Finalizada'];

// =========================================================================
// HIERARQUIA DE REVISÃO DO KANBAN — combinada em várias rodadas de
// conversa com o usuário (ver prompt_gemini.md §7 pro resumo completo).
// Resumo: quem pode mover uma tarefa de "Aguardando Verificação" pra
// "Para revisão"/"Finalizada" depende do NÍVEL de quem é o EXECUTOR da
// tarefa (não do nível de quem está tentando mover):
//   executor comum        -> revisa o Analista responsável do projeto
//   analista (executando)  -> revisa o Supervisor responsável do projeto
//   supervisor/administrador (executando) -> autoaprovação
// Um Analista/Supervisor/Administrador PODE ser o executor de uma
// tarefa — a checagem é sempre por NOME (`tarefa.executor`), nunca por
// nível de quem está logado.
// =========================================================================

// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_kanban_hierarquia_revisao.js).
function nivelExigidoParaRevisar(nivelDoExecutorDaTarefa) {
    if (nivelDoExecutorDaTarefa === 'analista') return 'supervisor';
    if (nivelDoExecutorDaTarefa === 'supervisor' || nivelDoExecutorDaTarefa === 'administrador') return 'auto';
    return 'analista';
}

// Verifica se `usuarioLogado` tem autoridade de revisar `tarefa` (do
// projeto `nomeProjeto`) — já considerando o escopo de projeto certo
// pra cada nível (Analista/Supervisor só nos próprios projetos,
// Administrador em qualquer um). Função pura.
//
// Melhoria #18 (prompt_gemini.md §12.6): `tarefa.responsavel` (atribuído
// em Atribuição de Tarefas, junto com o Executor) é um caminho de
// autoridade A MAIS — não substitui a hierarquia abaixo, as duas
// convivem (decisão explícita do usuário: útil se o Responsável
// designado estiver ausente, por exemplo).
function podeRevisarTarefa(tarefa, nomeProjeto, usuarioLogado, todosFuncionarios, todosProjetos) {
    if (!usuarioLogado) return true; // sem login (módulo isolado) — fallback aberto

    if (tarefa.responsavel && usuarioLogado.nome === tarefa.responsavel) return true;

    const funcionarioExecutor = todosFuncionarios.find(f => f.nome === tarefa.executor);
    const nivelDoExecutor = funcionarioExecutor ? funcionarioExecutor.nivel : 'executor';
    const exigido = nivelExigidoParaRevisar(nivelDoExecutor);

    if (exigido === 'auto') return usuarioLogado.nome === tarefa.executor;

    if (usuarioLogado.nivel === 'administrador') return true;
    if (usuarioLogado.nivel !== exigido) return false;

    const projeto = todosProjetos.find(p => p.nome === nomeProjeto);
    if (!projeto) return false;
    if (exigido === 'analista') return projeto.analista === usuarioLogado.nome;
    if (exigido === 'supervisor') return projeto.supervisor === usuarioLogado.nome;
    return false;
}

// =========================================================================
// APROVAÇÃO DE FINALIZAÇÃO (prompt_gemini.md §12.9) — toda Tarefa
// marcada "Finalizada" nasce PENDENTE de aprovação (ver
// moverTarefaParaStatus abaixo). Só passa a valer de vez depois que
// alguém com autoridade aprova, na aba "Finalizações" da tela
// Aprovações (aprovacoes-calendario.js).
// =========================================================================

// Autoridade de aprovar QUALQUER finalização de um projeto (antes de
// checar se é a própria tarefa da pessoa) — mesmo escopo por nível que
// a hierarquia de revisão já usa: Administrador em qualquer projeto,
// Analista/Supervisor só no(s) projeto(s) onde são designados.
function usuarioTemAutoridadeDeAprovarNoProjeto(usuarioLogado, nomeProjeto, todosProjetos) {
    if (!usuarioLogado) return true; // sem login (módulo isolado) — fallback aberto
    if (usuarioLogado.nivel === 'administrador') return true;
    if (usuarioLogado.nivel !== 'analista' && usuarioLogado.nivel !== 'supervisor') return false;

    const projeto = todosProjetos.find(p => p.nome === nomeProjeto);
    if (!projeto) return false;
    if (usuarioLogado.nivel === 'analista') return projeto.analista === usuarioLogado.nome;
    return projeto.supervisor === usuarioLogado.nome;
}

// Verifica se `usuarioLogado` pode aprovar a finalização de `tarefa`
// especificamente. Regra do usuário: Responsável ou Executor da PRÓPRIA
// tarefa não aprovam, mesmo tendo autoridade de nível — EXCETO se
// também forem o Analista designado do projeto (separação de funções,
// com uma única saída deliberada).
function podeAprovarFinalizacao(tarefa, nomeProjeto, usuarioLogado, todosProjetos) {
    if (!usuarioLogado) return true;
    if (!usuarioTemAutoridadeDeAprovarNoProjeto(usuarioLogado, nomeProjeto, todosProjetos)) return false;

    const ehExecutorOuResponsavel = usuarioLogado.nome === tarefa.executor || usuarioLogado.nome === tarefa.responsavel;
    if (ehExecutorOuResponsavel) {
        const projeto = todosProjetos.find(p => p.nome === nomeProjeto);
        const ehAnalistaDesignado = projeto && projeto.analista === usuarioLogado.nome;
        if (!ehAnalistaDesignado) return false;
    }
    return true;
}


// 1) é a MINHA tarefa (`tarefa.executor` sou eu, não importa meu
//    nível) -> só mexo nas colunas iniciais, EXCETO se eu for
//    Supervisor/Administrador (autoaprovação, vou até o fim sozinho);
// 2) é tarefa de OUTRA pessoa -> só posso mover ela de "Aguardando
//    Verificação" pra "Para revisão"/"Finalizada" (a revisão em si), e
//    só se eu tiver autoridade (podeRevisarTarefa acima). Função pura.
function podeMoverCartaoKanban(tarefa, nomeProjeto, statusOrigem, statusDestino, usuarioLogado, todosFuncionarios, todosProjetos) {
    if (!usuarioLogado) return true;

    const souOExecutor = usuarioLogado.nome === tarefa.executor;

    if (souOExecutor) {
        const nivelExigido = nivelExigidoParaRevisar(usuarioLogado.nivel);
        if (nivelExigido === 'auto') return true;

        // Pedido explícito do usuário: com a tarefa em "Para revisão"
        // (voltou reprovada), o Executor só tem UM destino possível —
        // "Aguardando Verificação" (terminou de corrigir, manda de
        // volta pro revisor). Não pode "recuar" pra "Em Desenvolvimento"
        // nem pra "Apontada" a partir daí.
        if (statusOrigem === 'Para revisão') return statusDestino === 'Aguardando Verificação';

        return !KB_STATUS_RESTRITOS_EXECUTOR.includes(statusDestino);
    }

    if (statusOrigem !== 'Aguardando Verificação') return false;
    if (!KB_STATUS_RESTRITOS_EXECUTOR.includes(statusDestino)) return false;
    return podeRevisarTarefa(tarefa, nomeProjeto, usuarioLogado, todosFuncionarios, todosProjetos);
}

let kbCartaoArrastado = null; // caminho da tarefa sendo arrastada no momento
let kbApoCaminhoAtual = null; // caminho da tarefa aberta no modal de "Apontar horas" (item 4)
let kbApoTrilhaAtual = 'execucao'; // 'execucao' ou 'revisao' — pedido do usuário, mesmo modal atende as duas

// Item 5 da "Frente Kanban avançado": cor de destaque na BORDA do
// cartão do Kanban do Executor — combinado explicitamente com o
// usuário, reconfirmado sem alterações depois dos itens 1-4 validados.
// (Chegou a valer também num Kanban do Analista, tela removida depois
// por feedback do usuário — ver prompt_gemini.md §11 — mas a regra em
// si continua igual, só que com um chamador a menos.) Vermelho SEMPRE
// tem prioridade sobre as outras cores. "Vencida" = a Data Prevista de
// Fim já passou (comparação de string YYYY-MM-DD funciona direto, sem
// precisar de objeto Date). Tarefas sem data calculável (ex:
// "Finalizada", que não entra no mapa do motor de Data Prevista) nunca
// ficam vermelhas por essa regra. Função pura, testável sem DOM (ver
// /home/claude/testes/teste_cor_borda_cartao.js).
function corBordaCartaoKanban(status, dataFimPrevista, hojeISO) {
    if (dataFimPrevista && dataFimPrevista < hojeISO) return '#ef4444'; // vermelho: vencida
    if (status === 'Para revisão') return '#f59e0b'; // amarelo
    return '#10b981'; // verde: normal
}

// Item pedido depois de testar a restrição por projeto no Kanban: além
// de filtrar as TAREFAS visíveis (coletarTarefasDoExecutor), o
// dropdown de escolher executor também precisa mostrar só quem tem
// alguma tarefa num projeto onde o Analista logado é o responsável —
// senão o Analista via o nome de um executor que só trabalha em
// projetos sem relação com ele, escolhia, e via a coluna vazia (sem
// pista de por quê). `null` = sem restrição (Administrador/Supervisor),
// dropdown mostra todo mundo, igual sempre foi. Função pura, testável
// sem DOM (ver
// /home/claude/testes/teste_kanban_dropdown_executores_vinculados.js).
function obterExecutoresVinculadosAosProjetos(arvores, projetosPermitidos) {
    if (!projetosPermitidos) return null;
    const nomes = new Set();
    Object.keys(arvores).forEach(nomeProjeto => {
        if (!projetosPermitidos.has(nomeProjeto)) return;
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no }) => {
            if (no.executor) nomes.add(no.executor);
        });
    });
    return nomes;
}

// Melhoria #22 (prompt_gemini.md §12.11): Kanban agora tem 2 abas.
// "Meu Kanban" = só tarefas onde o usuário logado é Executor, sempre —
// sem seleção nenhuma, é sempre a própria pessoa. "Kanban" = tarefas
// sob responsabilidade do usuário logado (papel de Responsável/
// conferência), com filtros (Data, Projeto, Executor, Status). O
// filtro de Executor nessa aba, pra Administrador/Supervisor, tem um
// papel especial: escolher alguém troca a fonte de dados pro quadro
// PESSOAL COMPLETO dessa pessoa como Executor (uso administrativo que
// já existia antes via dropdown único — incorporado aqui dentro do
// filtro). Pra qualquer outro nível, o mesmo filtro só restringe a
// lista "sob minha responsabilidade" àquele Executor específico.
let kbAbaAtiva = 'meu'; // 'meu' ou 'outros'

function alternarAbaKanban(aba) {
    kbAbaAtiva = aba;
    document.getElementById('kb-aba-meu').classList.toggle('aprov-aba-ativa', aba === 'meu');
    document.getElementById('kb-aba-outros').classList.toggle('aprov-aba-ativa', aba === 'outros');
    document.getElementById('kb-aba-ranking').classList.toggle('aprov-aba-ativa', aba === 'ranking');

    // #23 (prompt_gemini.md §12.12): filtros em colunas — esconde a
    // COLUNA inteira (rótulo + campo), não só o <select>, senão sobra
    // um espaço vazio no grid.
    const colunaExecutor = document.getElementById('kb-filtro-executor-coluna');
    if (colunaExecutor) colunaExecutor.style.display = (aba === 'outros') ? '' : 'none';

    // Ranking de Produtividade (prompt_gemini.md, pedido julho/2026):
    // 3ª aba, área própria (não é mais um quadro de colunas) — esconde
    // o quadro do Kanban por trás e mostra a tabela, e vice-versa.
    // Continua chamando renderizarQuadroKanban() nas outras duas abas
    // igual sempre foi; só não chama nela (ela mexeria no título da
    // página com o texto errado, ver renderizarQuadroKanban()).
    const areaQuadro = document.getElementById('kb-area-quadro');
    const areaRanking = document.getElementById('kb-ranking-area');
    if (areaQuadro) areaQuadro.style.display = (aba === 'ranking') ? 'none' : '';
    if (areaRanking) areaRanking.style.display = (aba === 'ranking') ? '' : 'none';

    if (aba === 'ranking') {
        const elTitulo = document.getElementById('page-context-title');
        if (elTitulo) elTitulo.innerText = '🏆 Ranking de Produtividade';
        renderizarRankingProdutividadeExecutores();
    } else {
        renderizarQuadroKanban();
    }
}

// -------------------------------------------------------------------
// RANKING DE PRODUTIVIDADE DOS EXECUTORES (prompt_gemini.md, pedido do
// usuário — julho/2026). Mora aqui dentro do Kanban (não em Relatórios
// ou Atribuição de Tarefas) porque precisa ser visível a TODOS os
// níveis de acesso, inclusive Executor — que, pelo controle de acesso
// já fechado (§3.1), só tem o Kanban no menu.
//
// Versão SIMPLES combinada com o usuário nesta rodada: sem ajuste por
// Cargo e sem piso de volume mínimo de tarefas (o desenho mais
// completo, com essas duas camadas, já está registrado em
// prompt_gemini.md §12.1 — "Produtividade e Distribuição de Lucro" —
// pra uma rodada futura). Considera só tarefas com status
// "Finalizada", mesmo critério já usado por
// bi.js::renderizarPainelCalibracaoBI().
//
// Retorna [{executor, existe, pontos, horas, produtividade}], só com
// quem tem pelo menos 1 tarefa finalizada com horas > 0 (produtividade
// não é uma taxa calculável sem isso — dividiria por zero).
function calcularRankingProdutividadeExecutores() {
    // Item 5/6/7 (prompt_gemini.md §14, leva 4): usa a versão filtrada
    // (só projetos que ainda existem no Cadastro), não a bruta.
    const arvores = obterArvoresProjetosAtivas();
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const porExecutor = {}; // nome -> {pontos, horas}

    function contabilizar(tarefa) {
        if (!tarefa || tarefa.status !== 'Finalizada' || !tarefa.executor) return;
        const nome = tarefa.executor;
        if (!porExecutor[nome]) porExecutor[nome] = { pontos: 0, horas: 0 };
        porExecutor[nome].pontos += parseFloat(tarefa.pontos) || 0;
        porExecutor[nome].horas += parseFloat(tarefa.horas_reais) || 0;
    }

    Object.keys(arvores).forEach(nomeProjeto => {
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        // Árvore Genérica Recursiva (prompt_gemini.md §12.31): não há
        // mais `etapa.tipo` — coletarNosFolhaDaArvore() (core.js) já
        // acha as tarefas em qualquer profundidade (Etapa/Setor/
        // Pavimento agindo como tarefa, ou Tarefa de verdade).
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no }) => contabilizar(no));
    });

    return Object.keys(porExecutor)
        .filter(nome => porExecutor[nome].horas > 0)
        .map(nome => {
            const d = porExecutor[nome];
            return {
                executor: nome,
                existe: !!funcionarios.find(f => f.nome === nome), // nome órfão (desligado) ainda entra na conta, só fica sinalizado
                pontos: d.pontos,
                horas: d.horas,
                produtividade: d.pontos / d.horas
            };
        });
}

let kbRankingOrdenarPor = 'produtividade'; // 'produtividade' ou 'pontos'

function alternarOrdemRanking(criterio) {
    kbRankingOrdenarPor = criterio;
    renderizarRankingProdutividadeExecutores();
}

function renderizarRankingProdutividadeExecutores() {
    const tbody = document.getElementById('kb-ranking-body');
    if (!tbody) return;

    const btnProdutividade = document.getElementById('kb-ranking-ordenar-produtividade');
    const btnPontos = document.getElementById('kb-ranking-ordenar-pontos');
    if (btnProdutividade) btnProdutividade.classList.toggle('aprov-aba-ativa', kbRankingOrdenarPor === 'produtividade');
    if (btnPontos) btnPontos.classList.toggle('aprov-aba-ativa', kbRankingOrdenarPor === 'pontos');

    let lista = calcularRankingProdutividadeExecutores();
    lista.sort((a, b) => b[kbRankingOrdenarPor] - a[kbRankingOrdenarPor]);

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">Nenhum executor com tarefas finalizadas ainda.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((item, idx) => {
        const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + 'º';
        const nomeExibicao = typeof nomeParaExibicao === 'function' ? nomeParaExibicao(item.executor) : item.executor;
        return '<tr>' +
            '<td style="text-align:center; font-weight:bold;">' + medalha + '</td>' +
            '<td>' + nomeExibicao + (item.existe ? '' : ' <small style="color:#94a3b8;">(desligado)</small>') + '</td>' +
            '<td style="text-align:center;">' + item.pontos.toFixed(1) + '</td>' +
            '<td style="text-align:center;">' + item.horas.toFixed(1) + 'h</td>' +
            '<td style="text-align:center; font-weight:bold;">' + item.produtividade.toFixed(2) + '</td>' +
            '</tr>';
    }).join('');
}

function limparFiltrosKanban() {
    ['kb-filtro-projeto', 'kb-filtro-executor', 'kb-filtro-status', 'kb-filtro-data-inicio', 'kb-filtro-data-fim'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderizarQuadroKanban();
}

function carregarPainelKanban() {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];

    // Restrição por projeto (Rodada 3 do controle de acesso): Analista
    // só vê os próprios projetos/executores vinculados. null = sem
    // restrição (Administrador/Supervisor/Executor).
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;
    const projetosParaMostrar = projetosPermitidos ? projetos.filter(p => projetosPermitidos.has(p.nome)) : projetos;

    const selProjeto = document.getElementById('kb-filtro-projeto');
    if (selProjeto) {
        const valorAnteriorProjeto = selProjeto.value;
        selProjeto.innerHTML = '<option value="">-- Todos os Projetos --</option>' +
            projetosParaMostrar.map(p => '<option value="' + p.nome + '">' + p.nome + '</option>').join('');
        selProjeto.value = valorAnteriorProjeto;
    }

    const executoresVinculados = projetosPermitidos
        ? obterExecutoresVinculadosAosProjetos(JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {}, projetosPermitidos)
        : null;
    const funcionariosParaMostrar = executoresVinculados
        ? funcionarios.filter(f => executoresVinculados.has(f.nome))
        : funcionarios;

    const selExecutor = document.getElementById('kb-filtro-executor');
    if (selExecutor) {
        const valorAnteriorExecutor = selExecutor.value;
        selExecutor.innerHTML = '<option value="">-- Todos os Executores --</option>' +
            funcionariosParaMostrar.map(f => '<option value="' + f.nome + '">' + nomeParaExibicao(f.nome) + '</option>').join('');
        selExecutor.value = valorAnteriorExecutor;
    }
    const colunaExecutor = document.getElementById('kb-filtro-executor-coluna');
    if (colunaExecutor) colunaExecutor.style.display = (kbAbaAtiva === 'outros') ? '' : 'none';

    renderizarQuadroKanban();
    iniciarRelogioVivoKanban();
}

// Monta a estrutura das 5 colunas uma vez só (os cartões dentro são
// preenchidos/atualizados separadamente por renderizarQuadroKanban).
//
// Todas as colunas aceitam soltar visualmente — a permissão real agora
// depende do CARTÃO específico sendo arrastado (de quem é a tarefa, o
// status de origem dela, quem está logado — ver
// podeMoverCartaoKanban() acima), não só do nível de quem está vendo a
// tela. Não dá mais pra decidir "essa coluna inteira está bloqueada"
// de antemão sem saber qual cartão está sendo arrastado; a trava real
// (com alerta explicando o motivo) acontece em soltarCartaoKanban() /
// moverTarefaParaStatus(), como sempre foi a fonte de verdade.
// Colunas realmente renderizadas na tela AGORA (pode ser um subconjunto
// de KB_COLUNAS — ver montarColunasKanban) — soltarCartaoKanban() usa
// essa lista pra saber o status real de destino de cada índice visual.
let kbColunasAtuais = KB_COLUNAS;

function montarColunasKanban(colunas) {
    kbColunasAtuais = colunas || KB_COLUNAS;
    const quadro = document.getElementById('kb-quadro');

    quadro.innerHTML = kbColunasAtuais.map((col, idx) => {
        const atributosDrag =
            'ondragover="event.preventDefault(); this.classList.add(\'kb-arrastando-sobre\');" ' +
            'ondragleave="this.classList.remove(\'kb-arrastando-sobre\');" ' +
            'ondrop="soltarCartaoKanban(event, ' + idx + ')"';

        return '<div class="kb-coluna" id="kb-coluna-' + idx + '" ' + atributosDrag + '>' +
            '<div class="kb-coluna-titulo" style="border-color:' + col.cor + ';">' +
            '<span>' + col.status + '</span><span id="kb-contador-' + idx + '"></span>' +
            '</div>' +
            '<div class="kb-cartoes" id="kb-cartoes-' + idx + '"></div>' +
            '</div>';
    }).join('');
}

// Varre TODOS os projetos (respeitando a restrição por projeto do
// Analista) atrás de tarefas "Aguardando Verificação" que
// `usuarioLogado` tem autoridade de revisar (ver podeRevisarTarefa()
// acima) — são as tarefas que vão aparecer no PRÓPRIO Kanban dele,
// junto com as que ele mesmo executa, como pedido explícito do
// usuário: "esta tarefa deve passar a aparecer no Kanban do
// responsável pela verificação, como uma tarefa para ele executar."
// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_kanban_visibilidade_revisao.js).
// Melhoria #24 (prompt_gemini.md §12.12): substitui
// coletarTarefasParaRevisar() como fonte da aba "Kanban" — aquela
// função só olhava status "Aguardando Verificação" (era o "aviso de
// revisão pendente" original), o que deixava as outras 4 colunas
// sempre vazias quando virou a base da aba inteira na melhoria #22.
// Esta aqui pega TODA tarefa onde a pessoa tem responsabilidade,
// QUALQUER status:
// - Administrador: autoridade em qualquer projeto — vê tudo.
// - Supervisor/Analista: autoridade só nos projetos onde são
//   designados (`projeto.supervisor`/`projeto.analista`).
// - Qualquer nível (inclusive Executor/Detalhista agindo como
//   Responsável): tarefa específica onde `tarefa.responsavel` é essa
//   pessoa, mesmo fora do(s) projeto(s) onde ela tem autoridade geral.
// Nunca inclui tarefa onde a pessoa é a própria Executora (já aparece
// em "Meu Kanban", não duplica).
function coletarTarefasSobResponsabilidade(arvores, usuarioLogado, todosProjetos) {
    if (!usuarioLogado) return [];
    let lista = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        const projeto = todosProjetos.find(p => p.nome === nomeProjeto);
        // Item 5/6/7 (prompt_gemini.md §14, leva 4): se o projeto não
        // existe mais no Cadastro (deletado/renomeado), a árvore é
        // órfã — pula. Sem isso, Administrador tinha autoridade
        // "true" por padrão mesmo em projeto órfão (ver abaixo), e é
        // exatamente por isso que etapas de obras já deletadas/
        // renomeadas continuavam aparecendo no Kanban do Administrador.
        if (!projeto) return;
        let temAutoridadeNoProjetoInteiro = false;
        if (usuarioLogado.nivel === 'administrador') temAutoridadeNoProjetoInteiro = true;
        else if (usuarioLogado.nivel === 'supervisor') temAutoridadeNoProjetoInteiro = !!(projeto && projeto.supervisor === usuarioLogado.nome);
        else if (usuarioLogado.nivel === 'analista') temAutoridadeNoProjetoInteiro = !!(projeto && projeto.analista === usuarioLogado.nome);

        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        function considerarTarefa(tarefa, localizacao, caminho) {
            if (tarefa.executor === usuarioLogado.nome) return; // já aparece em "Meu Kanban", não duplica
            const responsavelDaTarefa = tarefa.responsavel || tarefa.executor || '';
            const souResponsavelDireto = responsavelDaTarefa === usuarioLogado.nome;
            if (!temAutoridadeNoProjetoInteiro && !souResponsavelDireto) return;

            lista.push({
                tarefa: tarefa.nome,
                pontos: tarefa.pontos || '',
                status: tarefa.status || 'Apontada',
                projeto: nomeProjeto,
                localizacao: localizacao,
                horasReais: parseFloat(tarefa.horas_reais) || 0,
                sessaoAtivaInicio: null, // não é dono da tarefa, cronômetro não se aplica aqui
                apontamentosPendentes: 0,
                aprovacaoFinalizacao: tarefa.aprovacao_finalizacao || null,
                vezesEmRevisao: tarefa.vezes_em_revisao || 0,
                executor: tarefa.executor, // diferente do nome visualizado — o cartão mostra de quem é
                caminho: caminho
            });
        }

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            considerarTarefa(tarefa, localizacao, nomeProjeto + '|' + path);
        });
    });

    return lista;
}

function coletarTarefasParaRevisar(arvores, usuarioLogado, todosFuncionarios, todosProjetos, projetosPermitidos) {
    if (!usuarioLogado) return [];
    let lista = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        if (projetosPermitidos && !projetosPermitidos.has(nomeProjeto)) return;
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        function considerarTarefa(tarefa, localizacao, caminho) {
            if (tarefa.status !== 'Aguardando Verificação') return;
            if (tarefa.executor === usuarioLogado.nome) return; // já aparece como tarefa própria, não duplica
            if (!podeRevisarTarefa(tarefa, nomeProjeto, usuarioLogado, todosFuncionarios, todosProjetos)) return;
            lista.push({
                tarefa: tarefa.nome,
                pontos: tarefa.pontos || '',
                status: tarefa.status,
                projeto: nomeProjeto,
                localizacao: localizacao,
                horasReais: parseFloat(tarefa.horas_reais) || 0,
                sessaoAtivaInicio: null, // não é dono da tarefa, cronômetro não se aplica aqui
                apontamentosPendentes: 0,
                aprovacaoFinalizacao: null, // nunca é 'Finalizada' aqui (só Aguardando Verificação)
                vezesEmRevisao: tarefa.vezes_em_revisao || 0,
                executor: tarefa.executor, // diferente do nome selecionado — o cartão mostra de quem é
                caminho: caminho
            });
        }

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            considerarTarefa(tarefa, localizacao, nomeProjeto + '|' + path);
        });
    });

    return lista;
}

function coletarTarefasDoExecutor(nomeExecutor) {
    // Item 5/6/7 (prompt_gemini.md §14, leva 4): usa a versão filtrada
    // (só projetos que ainda existem no Cadastro), não a bruta.
    const arvores = obterArvoresProjetosAtivas();
    let lista = [];

    // Restrição por projeto (Rodada 3 do controle de acesso — ver
    // core.js::obterNomesProjetosPermitidos()): Analista só vê, no
    // Kanban do Executor, tarefas dos projetos onde é o responsável —
    // mesmo se o executor selecionado também trabalhar em OUTROS
    // projetos sem relação com esse Analista. Pedido explícito do
    // usuário. null = sem restrição (Administrador/Supervisor).
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;

    Object.keys(arvores).forEach(nomeProjeto => {
        if (projetosPermitidos && !projetosPermitidos.has(nomeProjeto)) return;
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        function empilharSeForDoExecutor(tarefa, localizacao, caminho) {
            if (tarefa.executor !== nomeExecutor) return;
            lista.push({
                tarefa: tarefa.nome,
                pontos: tarefa.pontos || '',
                status: tarefa.status || 'Apontada',
                projeto: nomeProjeto,
                localizacao: localizacao,
                horasReais: parseFloat(tarefa.horas_reais) || 0,
                sessaoAtivaInicio: tarefa.sessao_ativa_inicio || null,
                // Item 4 da "Frente Kanban avançado": quantas anotações
                // manuais desta tarefa ainda estão esperando aprovação —
                // mostrado no cartão como lembrete visual pro executor.
                apontamentosPendentes: (tarefa.apontamentos_manuais || []).filter(a => a.status === 'pendente').length,
                // Aprovação de Finalização (prompt_gemini.md §12.9).
                aprovacaoFinalizacao: tarefa.aprovacao_finalizacao || null,
                // Contador de retrabalho (ciclo Executor↔Revisor) — já
                // era gravado desde a hierarquia de revisão, só não
                // aparecia em lugar nenhum ainda.
                vezesEmRevisao: tarefa.vezes_em_revisao || 0,
                executor: tarefa.executor,
                caminho: caminho
            });
        }

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            empilharSeForDoExecutor(tarefa, localizacao, nomeProjeto + '|' + path);
        });
    });

    // Melhoria #22 (prompt_gemini.md §12.11): esse merge automático de
    // "minhas tarefas de revisão" existia antes pra quem selecionava a
    // si mesmo. Agora as duas coisas são ABAS SEPARADAS ("Meu Kanban" =
    // só Executor; "Kanban" = sob responsabilidade) — essa função volta
    // a ser só "tarefas onde a pessoa é Executor", sem mesclar nada.
    return lista;
}

// Extração de dentro de renderizarQuadroKanban — construção do HTML de
// UM cartão, incluindo a cor de destaque na borda (item 5 da "Frente
// Kanban avançado", ver §11). Chegou a existir um segundo chamador
// (Kanban do Analista, tela removida depois por feedback do usuário —
// ver §11), mas a extração em si continua valendo: mais fácil de testar
// isolada, e `opcoes.mostrarExecutor` fica pronta se um dia aparecer
// outro lugar precisando do mesmo cartão. `t` é o objeto de tarefa já
// enriquecido com `dataInicioExibicao`/`dataFimExibicao` (strings
// formatadas pra exibir) e `dataFimPrevista` (string YYYY-MM-DD, crua,
// só pra corBordaCartaoKanban comparar).
function construirCartaoKanbanHtml(t, hojeISO, nomeExecutorVisualizado) {
    // Item 13 (ver feriados.js::corSemaforoPrioridade): não se aplica
    // se já passou da Data de Início sem começar (isso é "atraso",
    // indicador diferente — a borda vermelha do cartão já cobre isso
    // via corBordaCartaoKanban, olhando a Data de FIM).
    const bolinhaSemaforo = typeof renderizarBolinhaSemaforoPrioridade === 'function' ? renderizarBolinhaSemaforoPrioridade(t.dataInicioPrevista, hojeISO) : '';
    const linhaData = (t.dataInicioExibicao && t.dataFimExibicao)
        ? '<div class="kb-cartao-data">' + bolinhaSemaforo + '🏁 ' + t.dataInicioExibicao + ' → ' + t.dataFimExibicao + '</div>'
        : '';
    const caminhoJs = t.caminho.replace(/'/g, "\\'");

    // Hierarquia de revisão: quando estou no MEU PRÓPRIO Kanban e essa
    // tarefa é de OUTRA pessoa (apareceu aqui pra eu revisar — ver
    // coletarTarefasParaRevisar()), mostra de quem é, senão ficaria sem
    // contexto nenhum de quem fez o trabalho.
    const linhaExecutorRevisao = (t.executor && nomeExecutorVisualizado && t.executor !== nomeExecutorVisualizado)
        ? '<div class="kb-cartao-executor-revisao">👤 ' + nomeParaExibicao(t.executor) + '</div>'
        : '';

    // Contador de retrabalho (ciclo Executor↔Revisor) — só aparece
    // quando já houve pelo menos 1 rodada de "Para revisão".
    const linhaVezesEmRevisao = (t.vezesEmRevisao > 0)
        ? '<div class="kb-cartao-vezes-revisao" style="font-size:10px; color:#b91c1c; margin-top:2px;">🔁 Já voltou ' + t.vezesEmRevisao + 'x pra correção</div>'
        : '';

    let linhaCronometro;
    if (t.sessaoAtivaInicio) {
        linhaCronometro =
            '<div class="kb-cartao-cronometro kb-cartao-cronometro-ativo">' +
            '<span class="kb-cronometro-tempo" data-inicio="' + t.sessaoAtivaInicio + '">🔴 —</span>' +
            '<button class="kb-btn-cronometro" onclick="event.stopPropagation(); pausarSessaoKanban(\'' + caminhoJs + '\')">⏸ Pausar</button>' +
            '</div>';
    } else if (statusBloqueiaCronometro(t.status)) {
        // Bloqueado por pedido explícito do usuário: "Apontada" (tarefa
        // nem começou), "Aguardando Verificação" (já foi entregue pra
        // revisão) e "Finalizada" (já terminou de vez) não contam
        // tempo. Mensagem muda conforme o motivo.
        let dica, rotulo;
        if (t.status === 'Apontada') {
            dica = 'Mova esta tarefa pra \'Em Desenvolvimento\' pra poder iniciar a contagem';
            rotulo = '🔒 Mova pra iniciar';
        } else if (t.status === 'Finalizada') {
            dica = 'Tarefa já finalizada — não conta mais tempo';
            rotulo = '✅ Finalizada';
        } else {
            dica = 'Tarefa em revisão — contagem fica bloqueada até voltar pra \'Em Desenvolvimento\' ou \'Para revisão\'';
            rotulo = '🔒 Em revisão';
        }
        linhaCronometro =
            '<div class="kb-cartao-cronometro" title="' + dica + '">' +
            '<span class="kb-cronometro-tempo" style="color:#94a3b8;">' + rotulo + '</span>' +
            '</div>';
    } else {
        linhaCronometro =
            '<div class="kb-cartao-cronometro">' +
            '<span class="kb-cronometro-tempo">Total: ' + t.horasReais.toFixed(2) + 'h</span>' +
            '<button class="kb-btn-cronometro" onclick="event.stopPropagation(); iniciarSessaoKanban(\'' + caminhoJs + '\')">▶ Iniciar</button>' +
            '</div>';
    }

    // Item 4 da "Frente Kanban avançado": só mostra o botão de anotar
    // horas manualmente pra quem é DE VERDADE o Executor da tarefa
    // (não só quem está vendo o cartão — um cartão pode aparecer no
    // Kanban de outra pessoa também, ex: na aba "Kanban" de quem tem
    // essa tarefa sob responsabilidade). Sem isso, o botão apareceria
    // pra gente que não pode usar ele, e a trava real em
    // criarApontamentoManual() ia recusar de qualquer jeito — mesma
    // filosofia do bloqueio de coluna do item 1.
    //
    // Status permitido: "Em Desenvolvimento" (sempre foi) + "Para
    // revisão" (ciclo Executor↔Revisor, prompt_gemini.md §12.8/§12.13
    // — o cronômetro já roda nesse status pro Executor corrigindo,
    // faltava o apontamento manual acompanhar).
    const usuarioAtualParaBotaoManual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    const souOExecutorDesteCartao = usuarioAtualParaBotaoManual && t.executor && usuarioAtualParaBotaoManual.nome === t.executor;
    let linhaApontamentoManual = '';
    if (souOExecutorDesteCartao && (t.status === 'Em Desenvolvimento' || t.status === 'Para revisão')) {
        linhaApontamentoManual =
            '<div class="kb-cartao-apontamento-manual">' +
            '<button class="kb-btn-apontamento-manual" onclick="event.stopPropagation(); abrirModalApontamentoManualKanban(\'' + caminhoJs + '\')">📝 Apontar horas</button>' +
            (t.apontamentosPendentes > 0 ? '<span class="kb-badge-apontamento-pendente">⏳ ' + t.apontamentosPendentes + '</span>' : '') +
            '</div>';
    } else if (t.apontamentosPendentes > 0) {
        linhaApontamentoManual =
            '<div class="kb-cartao-apontamento-manual">' +
            '<span class="kb-badge-apontamento-pendente">⏳ ' + t.apontamentosPendentes + ' apontamento(s) aguardando aprovação</span>' +
            '</div>';
    }

    // Apontamento manual — trilha de REVISÃO (pedido do usuário, mesmo
    // botão do item 4 acima, agora também nessa trilha). Só aparece
    // pra quem TEM DE VERDADE autoridade de revisar essa tarefa
    // específica (Responsável atribuído ou hierarquia — mesma checagem
    // de podeRevisarTarefa() usada em todo o resto do sistema), com a
    // tarefa especificamente em "Aguardando Verificação". Consulta o
    // dado bruto (localizarTarefaPorCaminho) porque o objeto resumido
    // `t` usado pra montar o cartão não carrega `tarefa.responsavel`.
    let linhaApontamentoManualRevisao = '';
    if (!souOExecutorDesteCartao && t.status === 'Aguardando Verificação' && usuarioAtualParaBotaoManual) {
        const todasParaRevisao = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
        const tarefaRealParaRevisao = typeof localizarTarefaPorCaminho === 'function' ? localizarTarefaPorCaminho(todasParaRevisao, t.caminho) : null;
        const nomeProjetoDoCartao = t.caminho.split('|')[0];
        const funcionariosParaRevisao = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
        const projetosParaRevisao = JSON.parse(localStorage.getItem('banco_projetos')) || [];
        const temAutoridadeDeRevisar = tarefaRealParaRevisao && typeof podeRevisarTarefa === 'function'
            && podeRevisarTarefa(tarefaRealParaRevisao, nomeProjetoDoCartao, usuarioAtualParaBotaoManual, funcionariosParaRevisao, projetosParaRevisao);
        if (temAutoridadeDeRevisar) {
            linhaApontamentoManualRevisao =
                '<div class="kb-cartao-apontamento-manual">' +
                '<button class="kb-btn-apontamento-manual" onclick="event.stopPropagation(); abrirModalApontamentoManualKanban(\'' + caminhoJs + '\', \'revisao\')">📝 Apontar horas de revisão</button>' +
                '</div>';
        }
    }

    // Item 5: cor de destaque na borda esquerda do cartão.
    const cor = corBordaCartaoKanban(t.status, t.dataFimPrevista, hojeISO);

    // Aprovação de Finalização (prompt_gemini.md §12.9): cartão
    // "Finalizada" fica com cores atenuadas (opacity) enquanto
    // pendente de aprovação, e ganha um selo — ⏳ enquanto pendente,
    // ✅ verde assim que aprovada. Pedido do usuário (§14, item 4):
    // Aprovar/Recusar agora ficam DIRETO no card, pra quem tem
    // autoridade — sem precisar ir pra tela separada "🗓️ Aprovações".
    let estiloOpacidade = '';
    let linhaSeloAprovacao = '';
    if (t.status === 'Finalizada') {
        if (t.aprovacaoFinalizacao === 'pendente') {
            estiloOpacidade = ' opacity:0.55;';
            let botoesAprovacaoFinalizacao = '';
            if (usuarioAtualParaBotaoManual) {
                const todasParaAprovacao = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
                const tarefaRealParaAprovacao = typeof localizarTarefaPorCaminho === 'function' ? localizarTarefaPorCaminho(todasParaAprovacao, t.caminho) : null;
                const nomeProjetoDoCartaoAprov = t.caminho.split('|')[0];
                const projetosParaAprovacao = JSON.parse(localStorage.getItem('banco_projetos')) || [];
                const temAutoridadeDeAprovar = tarefaRealParaAprovacao && typeof podeAprovarFinalizacao === 'function'
                    && podeAprovarFinalizacao(tarefaRealParaAprovacao, nomeProjetoDoCartaoAprov, usuarioAtualParaBotaoManual, projetosParaAprovacao);
                if (temAutoridadeDeAprovar) {
                    botoesAprovacaoFinalizacao =
                        '<div class="kb-cartao-botoes-aprovacao" style="display:flex; gap:4px; margin-top:4px;">' +
                        '<button class="kb-btn-aprovar" style="flex:1; background:#166534; color:white; border:none; font-size:10px; padding:3px 6px; border-radius:3px; cursor:pointer;" onclick="event.stopPropagation(); aprovarFinalizacaoCartaoKanban(\'' + caminhoJs + '\')">✅ Aprovar</button>' +
                        '</div>';
                }
            }
            linhaSeloAprovacao = '<div class="kb-cartao-selo-aprovacao" style="font-size:10px; font-weight:bold; color:#b45309; margin-top:4px;">⏳ Aguardando aprovação</div>' + botoesAprovacaoFinalizacao;
        } else if (t.aprovacaoFinalizacao === 'aprovada') {
            linhaSeloAprovacao = '<div class="kb-cartao-selo-aprovacao" style="font-size:10px; font-weight:bold; color:#166534; margin-top:4px;">✅ Aprovada</div>';
        }
    }

    // Sessões de revisão pendentes (aprovacoes-calendario.js) — mesmo
    // espírito do apontamento manual acima: pra quem tem autoridade de
    // revisar essa tarefa, mostra quantas sessões estão esperando
    // aprovação e um botão pra abrir a lista direto (sem ir pra
    // "Aprovações").
    let linhaSessoesRevisaoPendentes = '';
    const sessoesRevisaoDaTarefaPendentes = (() => {
        if (!usuarioAtualParaBotaoManual) return 0;
        const todasParaRevisaoSessoes = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
        const tarefaRealParaSessoes = typeof localizarTarefaPorCaminho === 'function' ? localizarTarefaPorCaminho(todasParaRevisaoSessoes, t.caminho) : null;
        if (!tarefaRealParaSessoes || !Array.isArray(tarefaRealParaSessoes.sessoes_revisao)) return 0;
        return tarefaRealParaSessoes.sessoes_revisao.filter(s => s.status === 'pendente').length;
    })();
    if (sessoesRevisaoDaTarefaPendentes > 0) {
        const nomeProjetoDoCartaoSessoes = t.caminho.split('|')[0];
        const todasParaSessoesAutoridade = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
        const tarefaRealParaSessoesAutoridade = typeof localizarTarefaPorCaminho === 'function' ? localizarTarefaPorCaminho(todasParaSessoesAutoridade, t.caminho) : null;
        const funcionariosParaSessoes = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
        const projetosParaSessoes = JSON.parse(localStorage.getItem('banco_projetos')) || [];
        const temAutoridadeDeRevisarSessoes = tarefaRealParaSessoesAutoridade && typeof podeRevisarTarefa === 'function'
            && podeRevisarTarefa(tarefaRealParaSessoesAutoridade, nomeProjetoDoCartaoSessoes, usuarioAtualParaBotaoManual, funcionariosParaSessoes, projetosParaSessoes);
        if (temAutoridadeDeRevisarSessoes) {
            linhaSessoesRevisaoPendentes =
                '<div class="kb-cartao-apontamento-manual">' +
                '<button class="kb-btn-apontamento-manual" style="background:#fef3c7; color:#92400e;" onclick="event.stopPropagation(); abrirModalSessoesRevisaoPendentesKanban(\'' + caminhoJs + '\')">⏳ ' + sessoesRevisaoDaTarefaPendentes + ' sessão(ões) de revisão aguardando aprovação</button>' +
                '</div>';
        }
    }

    return '<div class="kb-cartao" draggable="true" style="border-left:4px solid ' + cor + ';' + estiloOpacidade + '" ' +
        'ondragstart="iniciarArrastoCartaoKanban(event, \'' + t.caminho + '\')">' +
        '<div class="kb-cartao-caminho" style="font-size:10px; color:#94a3b8; margin-bottom:2px;">' + t.projeto + ' › ' + t.localizacao + '</div>' +
        '<div class="kb-cartao-tarefa">' + t.tarefa + '</div>' +
        linhaExecutorRevisao +
        linhaVezesEmRevisao +
        '<div class="kb-cartao-pontos">Pontos: ' + (t.pontos || '—') + '</div>' +
        linhaData +
        linhaCronometro +
        linhaApontamentoManual +
        linhaApontamentoManualRevisao +
        linhaSessoesRevisaoPendentes +
        linhaSeloAprovacao +
        '</div>';
}

function renderizarQuadroKanban() {
    // Revertido a pedido do usuário (prompt_gemini.md §12.8/§12.9): a
    // coluna "Para revisão" É uma coluna própria de verdade, pra TODOS
    // os níveis. Sempre as 5 colunas de KB_COLUNAS, sem filtro.
    montarColunasKanban(KB_COLUNAS);

    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;

    const elProjeto = document.getElementById('kb-filtro-projeto');
    const elExecutor = document.getElementById('kb-filtro-executor');
    const elStatus = document.getElementById('kb-filtro-status');
    const elDataDe = document.getElementById('kb-filtro-data-inicio');
    const elDataAte = document.getElementById('kb-filtro-data-fim');
    const filtroProjeto = elProjeto ? elProjeto.value : '';
    const filtroExecutor = elExecutor ? elExecutor.value : '';
    const filtroStatus = elStatus ? elStatus.value : '';
    const filtroDataDe = elDataDe ? elDataDe.value : '';
    const filtroDataAte = elDataAte ? elDataAte.value : '';

    let tarefas = [];
    let nomeParaCalendario = null; // null = sem calendário próprio pra mostrar (lista mistura várias pessoas)

    if (!usuarioAtual) {
        tarefas = []; // módulo isolado sem login — sem identidade, sem quadro (falha fechada)
    } else if (kbAbaAtiva === 'meu') {
        // "Meu Kanban": sempre a própria pessoa como Executor, sem
        // seleção nenhuma.
        tarefas = coletarTarefasDoExecutor(usuarioAtual.nome);
        nomeParaCalendario = usuarioAtual.nome;
    } else {
        // "Kanban": por padrão, tarefas sob responsabilidade (papel de
        // Responsável/conferência) do usuário logado. O filtro de
        // Executor, pra Administrador/Supervisor, troca a fonte de
        // dados pro quadro pessoal COMPLETO da pessoa escolhida (uso
        // administrativo — "abrir o quadro de qualquer funcionário",
        // que já existia antes via dropdown único). Pra qualquer outro
        // nível, o mesmo filtro só restringe a lista de responsabilidade.
        const podeAbrirQuadroDeQualquerUm = usuarioAtual.nivel === 'administrador' || usuarioAtual.nivel === 'supervisor';
        if (filtroExecutor && podeAbrirQuadroDeQualquerUm) {
            tarefas = coletarTarefasDoExecutor(filtroExecutor);
            nomeParaCalendario = filtroExecutor;
        } else {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
            tarefas = coletarTarefasSobResponsabilidade(arvores, usuarioAtual, projetos);
            if (filtroExecutor) tarefas = tarefas.filter(t => t.executor === filtroExecutor);
        }
    }

    // Filtros comuns às duas abas.
    if (filtroProjeto) tarefas = tarefas.filter(t => t.projeto === filtroProjeto);
    if (filtroStatus) tarefas = tarefas.filter(t => t.status === filtroStatus);

    // Datas previstas vêm do motor de fila, que é POR PESSOA
    // (calcularDatasInicioEFimExecutor). "Meu Kanban" e o uso
    // administrativo acima são sempre 1 pessoa só, mas "sob minha
    // responsabilidade" pode ter várias — calcula pra cada uma que
    // aparecer na lista filtrada e junta os mapas num só.
    const nomesExecutoresEnvolvidos = Array.from(new Set(tarefas.map(t => t.executor).filter(Boolean)));
    const datasCombinadas = {};
    nomesExecutoresEnvolvidos.forEach(nome => {
        Object.assign(datasCombinadas, calcularDatasInicioEFimExecutor(nome));
    });

    if (filtroDataDe || filtroDataAte) {
        tarefas = tarefas.filter(t => {
            const datas = datasCombinadas[t.caminho];
            if (!datas || !datas.inicio) return false; // sem data calculável, filtro de período exclui
            if (filtroDataDe && datas.inicio < filtroDataDe) return false;
            if (filtroDataAte && datas.inicio > filtroDataAte) return false;
            return true;
        });
    }

    // Botão "Meu Calendário" — só fica disponível quando dá pra apontar
    // pra UMA pessoa específica (Meu Kanban, ou uso administrativo na
    // outra aba); "sob minha responsabilidade" mistura gente, sem
    // calendário único pra mostrar.
    const btnCalendario = document.getElementById('kb-btn-meu-calendario');
    if (btnCalendario) {
        btnCalendario.disabled = !nomeParaCalendario;
        const ehOProprio = usuarioAtual && nomeParaCalendario === usuarioAtual.nome;
        btnCalendario.innerText = (ehOProprio || !nomeParaCalendario) ? '⚙️ Meu Calendário' : ('⚙️ Calendário de ' + nomeParaExibicao(nomeParaCalendario));
    }

    // Aprovação de Finalização (prompt_gemini.md §12.9): avisa no
    // próprio Kanban quando `usuarioLogado` tem finalizações esperando
    // aprovação — só faz sentido na aba "Meu Kanban" (é sempre sobre a
    // própria pessoa).
    const avisoFinalizacoes = document.getElementById('kb-aviso-finalizacoes-pendentes');
    if (avisoFinalizacoes) {
        const n = (kbAbaAtiva === 'meu' && typeof contarFinalizacoesPendentes === 'function') ? contarFinalizacoesPendentes() : 0;
        if (n > 0) {
            avisoFinalizacoes.innerText = '⏳ ' + n + ' finalização(ões) aguardando sua aprovação — clique pra ver na tela Aprovações';
            avisoFinalizacoes.style.display = 'block';
        } else {
            avisoFinalizacoes.style.display = 'none';
        }
    }

    const hojeISO = new Date().toISOString().slice(0, 10); // item 5: cor da borda por atraso
    const nomeParaBadgeCartao = nomeParaCalendario || (usuarioAtual ? usuarioAtual.nome : '');

    // Pedido do usuário: título no canto superior esquerdo mostra de
    // quem é o quadro, não a palavra fixa "Kanban". "Meu Kanban" e o
    // uso administrativo (filtro de Executor) sempre têm 1 pessoa —
    // mostra o codinome dela. Aba "Kanban" no padrão (sob
    // responsabilidade, sem filtro) mistura gente de vários projetos —
    // sem "um nome" pra mostrar, cai num texto genérico.
    const elTitulo = document.getElementById('page-context-title');
    if (elTitulo) {
        if (nomeParaCalendario) {
            elTitulo.innerText = nomeParaExibicao(nomeParaCalendario);
        } else {
            elTitulo.innerText = 'Sob sua responsabilidade';
        }
    }

    kbColunasAtuais.forEach((col, idx) => {
        // Ordem cronológica por Data de Início — pedido explícito do
        // usuário. Tarefas sem data calculável (ex: "Finalizada", que não
        // entra no mapa do motor) vão pro final, mantidas mas sem
        // prioridade de ordenação.
        const tarefasDaColuna = tarefas
            .filter(t => t.status === col.status)
            .sort((a, b) => {
                const dataA = (datasCombinadas[a.caminho] || {}).inicio || '9999-99-99';
                const dataB = (datasCombinadas[b.caminho] || {}).inicio || '9999-99-99';
                return dataA.localeCompare(dataB);
            });
        document.getElementById('kb-contador-' + idx).innerText = tarefasDaColuna.length;

        document.getElementById('kb-cartoes-' + idx).innerHTML = tarefasDaColuna.map(t => {
            const datas = datasCombinadas[t.caminho];
            t.dataInicioExibicao = datas ? formatarDataPrevistaExibicao(datas.inicio) : null;
            t.dataInicioPrevista = datas ? datas.inicio : null; // ISO cru — item 13, semáforo de prioridade precisa comparar datas, não a string já formatada
            t.dataFimExibicao = datas ? formatarDataPrevistaExibicao(datas.fim) : null;
            t.dataFimPrevista = datas ? datas.fim : null;
            return construirCartaoKanbanHtml(t, hojeISO, nomeParaBadgeCartao);
        }).join('');
    });
}

function iniciarArrastoCartaoKanban(event, caminho) {
    kbCartaoArrastado = caminho;
    event.dataTransfer.effectAllowed = 'move';
}

// Extraída de dentro de soltarCartaoKanban() — a lógica de "mover
// status" isolada da manipulação de DOM em volta, testável sem
// depender do navegador. Chegou a ter um segundo chamador (Kanban do
// Analista, removido depois por feedback do usuário — ver
// prompt_gemini.md §11), mas a extração continua valendo por si só.
// Não mexe em DOM nenhum (testável isolada — ver
// /home/claude/testes/teste_mover_tarefa_status.js).
//
// Retorna { ok: true } ou { ok: false, alertar: bool, erro? }:
// - alertar:true = bloqueio de permissão de verdade. Campo mantido por
//   clareza/depuração (`erro` ainda descreve o motivo), mas desde a
//   melhoria #9 (prompt_gemini.md §12) o chamador (soltarCartaoKanban)
//   NÃO mostra mais alert() nesse caso — bloqueio fica silencioso, só
//   impede a movimentação.
// - alertar:false = falha silenciosa (ex: caminho não existe mais,
//   árvore mudou entre carregar e soltar) — mesmo comportamento de
//   sempre, sem alert.
function moverTarefaParaStatus(caminho, novoStatus) {
    const [nomeProjeto, caminhoResto] = caminho.split('|');

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return { ok: false, alertar: false };

    const tarefaAlvo = resolverNoPorPath(arv, caminhoResto);
    if (!tarefaAlvo) return { ok: false, alertar: false }; // caminho não existe mais (árvore mudou entre carregar e soltar) — ignora

    // Trava real, não só visual — a permissão agora depende de quem é o
    // EXECUTOR da tarefa (não só do nível de quem está tentando mover),
    // por isso a tarefa precisa ser encontrada ANTES de checar (ver
    // podeMoverCartaoKanban() e a hierarquia de revisão logo acima).
    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    if (!podeMoverCartaoKanban(tarefaAlvo, nomeProjeto, tarefaAlvo.status, novoStatus, usuarioAtual, funcionarios, projetos)) {
        return { ok: false, alertar: true, erro: 'Você não tem permissão pra mover essa tarefa pra "' + novoStatus + '".' };
    }

    const statusAnterior = tarefaAlvo.status;
    const statusMudou = statusAnterior !== novoStatus;
    tarefaAlvo.status = novoStatus;

    // Contador de retrabalho — pedido junto com a hierarquia de revisão:
    // conta quantas vezes a tarefa volta de "Aguardando Verificação" pra
    // "Para revisão" (reprovada, precisa de correção). Vai alimentar o
    // índice de produtividade futuro (ver prompt_gemini.md §12.1).
    // Aprovar (mover pra "Finalizada") NÃO conta.
    if (statusAnterior === 'Aguardando Verificação' && novoStatus === 'Para revisão') {
        tarefaAlvo.vezes_em_revisao = (tarefaAlvo.vezes_em_revisao || 0) + 1;
    }

    // Aprovação de Finalização (prompt_gemini.md §12.9): TODA tarefa
    // marcada "Finalizada" nasce pendente — só passa a valer de vez
    // depois que alguém com autoridade aprova na tela Aprovações
    // (aba "Finalizações"). Guarda quem finalizou (`finalizada_por`),
    // usado por podeAprovarFinalizacao() pra bloquear autoaprovação.
    if (statusMudou && novoStatus === 'Finalizada') {
        tarefaAlvo.aprovacao_finalizacao = 'pendente';
        tarefaAlvo.finalizada_por = usuarioAtual ? usuarioAtual.nome : null;
        // Painel de Progresso (novo): mesma gravação de arvore.js —
        // precisa saber QUANDO virou Finalizada.
        tarefaAlvo.finalizada_em = new Date().toISOString();
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));

    // Item 3 da "Frente Kanban avançado": mudar de coluna pausa o
    // cronômetro automaticamente, se essa tarefa (e só ela) tiver uma
    // sessão ativa — pausarSessaoTrabalho() já é "por caminho", não
    // afeta sessão ativa de nenhuma OUTRA tarefa. Só dispara se o status
    // realmente mudou (soltar de volta na mesma coluna não conta).
    // Chamada DEPOIS do save acima: pausarSessaoTrabalho() relê o
    // localStorage sozinha, então precisa ver o status novo já gravado
    // antes de agir.
    if (statusMudou) pausarSessaoTrabalho(caminho);

    return { ok: true };
}

// Grava o novo status direto na árvore do projeto — mesmo dado que a
// Árvore de Projeto e a Atribuição de Tarefas usam, então não existe
// "replicar": mudar aqui já é mudar lá.
function soltarCartaoKanban(event, idxColunaDestino) {
    event.preventDefault();
    event.currentTarget.classList.remove('kb-arrastando-sobre');
    if (!kbCartaoArrastado) return;

    const novoStatus = kbColunasAtuais[idxColunaDestino].status;
    const resultado = moverTarefaParaStatus(kbCartaoArrastado, novoStatus);
    kbCartaoArrastado = null;

    if (!resultado.ok) {
        // Melhoria #9 (prompt_gemini.md §12): bloqueio por FALTA DE
        // PERMISSÃO fica silencioso — o cartão só não se move, sem
        // alert() explicando o motivo. `alertar:false` (caminho que não
        // existe mais na árvore, ex: mudou entre carregar e soltar)
        // continua silencioso como sempre foi — nunca teve alert aqui.
        return;
    }

    renderizarQuadroKanban();
}

// --- CRONÔMETRO (play/pause) ---
// A lógica de sessão em si (pausar a anterior, calcular duração, gravar
// histórico) vive em apontamento.js — aqui só chamamos e re-renderizamos.

function iniciarSessaoKanban(caminho) {
    const iniciou = iniciarSessaoTrabalho(caminho);
    if (!iniciou) {
        // Defesa extra: o botão "Iniciar" já não aparece nos casos óbvios
        // (ver renderização acima), mas o status/permissão pode mudar
        // entre o render e o clique (outra aba, por exemplo). Mensagem
        // genérica desde a melhoria #18/#10 (prompt_gemini.md §12.6):
        // cobre tanto o Executor (status incompatível) quanto o Revisor
        // (sem autoridade, ou tarefa não está em "Aguardando Verificação").
        alert('Não é possível iniciar a contagem agora — confira o status da tarefa e se você tem permissão pra isso.');
    }
    renderizarQuadroKanban();
}

function pausarSessaoKanban(caminho) {
    pausarSessaoTrabalho(caminho);
    renderizarQuadroKanban();
}

// Atualiza o texto de "tempo decorrido" de qualquer cartão com sessão
// ativa, sem precisar re-renderizar o quadro inteiro (evita perder a
// posição de rolagem/arrasto em andamento). Roda a cada segundo enquanto
// a tela do Kanban estiver aberta.
let kbIntervaloRelogio = null;

function iniciarRelogioVivoKanban() {
    if (kbIntervaloRelogio) clearInterval(kbIntervaloRelogio);
    kbIntervaloRelogio = setInterval(() => {
        document.querySelectorAll('.kb-cronometro-tempo[data-inicio]').forEach(el => {
            const inicio = new Date(el.dataset.inicio).getTime();
            const horas = (Date.now() - inicio) / 3600000;
            const h = Math.floor(horas);
            const m = Math.floor((horas - h) * 60);
            el.innerText = '🔴 ' + h + 'h' + String(m).padStart(2, '0') + 'min';
        });
    }, 1000);
}

// --- MEU CALENDÁRIO (exceções de calendário do executor) ---
// Ver feriados.js (obterExcecaoAprovada / horasDisponiveisNoDia) pro
// motor que CONSOME essas exceções, e aprovacoes-calendario.js pra tela
// onde o administrador aprova/recusa.

function gerarIdExcecaoCalendario() {
    return 'exc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Pedido explícito do usuário: "Ele [Analista] não pode ter atribuição
// de alterar o calendário do executor." Analista continua podendo ABRIR
// o modal e VER as exceções já existentes — só criar uma nova fica
// bloqueado. Executor pode mexer no PRÓPRIO calendário (é o uso
// original do recurso — Kanban do Executor trava o dropdown no próprio
// nome, então "alterar o calendário do executor" aqui sempre é o
// PRÓPRIO). Função pura, testável sem DOM (ver
// /home/claude/testes/teste_kanban_calendario_trava_analista.js).
function podeAlterarCalendarioColaborador() {
    const nivel = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    if (!nivel) return true;
    return nivel === 'administrador' || nivel === 'supervisor' || nivel === 'executor';
}

// Melhoria #22 (prompt_gemini.md §12.11): não existe mais um dropdown
// único definindo "de quem é o quadro" — cada aba decide isso sozinha
// (ver renderizarQuadroKanban). Essa função repete a MESMA lógica só
// pra descobrir o "sujeito" atual do botão Meu Calendário: "Meu
// Kanban" é sempre a própria pessoa; "Kanban" só tem um sujeito único
// quando o filtro de Executor está sendo usado no modo administrativo
// (Administrador/Supervisor escolheu alguém) — sem isso, retorna null
// (lista mistura várias pessoas, sem calendário único pra abrir).
function obterNomeSujeitoCalendarioKanban() {
    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    if (!usuarioAtual) return null;
    if (kbAbaAtiva === 'meu') return usuarioAtual.nome;

    const elExecutor = document.getElementById('kb-filtro-executor');
    const filtroExecutor = elExecutor ? elExecutor.value : '';
    const podeAbrirQuadroDeQualquerUm = usuarioAtual.nivel === 'administrador' || usuarioAtual.nivel === 'supervisor';
    return (filtroExecutor && podeAbrirQuadroDeQualquerUm) ? filtroExecutor : null;
}

function abrirModalCalendarioKanban() {
    const nomeExecutor = obterNomeSujeitoCalendarioKanban();
    if (!nomeExecutor) return; // botão já vem desabilitado nesse caso, defesa extra

    document.getElementById('kb-modal-cal-nome-executor').innerText = nomeParaExibicao(nomeExecutor);
    document.getElementById('kb-cal-nova-de').value = '';
    document.getElementById('kb-cal-nova-ate').value = '';
    document.getElementById('kb-cal-nova-horas').value = '';
    document.getElementById('kb-cal-nova-motivo').value = '';

    // Analista vê as exceções já existentes, mas não cria novas —
    // desabilita os campos do formulário de "nova exceção" (cosmético;
    // a trava real está em criarExcecaoCalendarioKanban()).
    const podeAlterar = podeAlterarCalendarioColaborador();
    ['kb-cal-nova-de', 'kb-cal-nova-ate', 'kb-cal-nova-horas', 'kb-cal-nova-motivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !podeAlterar;
    });
    const btnEnviar = document.getElementById('kb-cal-btn-enviar');
    if (btnEnviar) btnEnviar.disabled = !podeAlterar;

    renderizarTabelaExcecoesCalendarioKanban(nomeExecutor);
    document.getElementById('kb-modal-calendario').style.display = 'flex';
}

function fecharModalCalendarioKanban() {
    document.getElementById('kb-modal-calendario').style.display = 'none';
}

function renderizarTabelaExcecoesCalendarioKanban(nomeExecutor) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const func = funcionarios.find(f => f.nome === nomeExecutor);
    const excecoes = (func && Array.isArray(func.excecoes_calendario)) ? func.excecoes_calendario.slice() : [];

    const tbody = document.getElementById('kb-cal-tabela-excecoes-body');
    if (excecoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">Nenhuma exceção registrada ainda.</td></tr>';
        return;
    }

    // Mais recente primeiro (mesma ordem que foram criadas, invertida).
    excecoes.reverse();

    const corStatus = { pendente: '#f59e0b', aprovado: '#10b981', recusado: '#ef4444' };
    const rotuloStatus = { pendente: '⏳ Pendente', aprovado: '✅ Aprovado', recusado: '❌ Recusado' };

    tbody.innerHTML = excecoes.map(ex => {
        const periodo = ex.data_inicio === ex.data_fim
            ? formatarDataPrevistaExibicao(ex.data_inicio)
            : formatarDataPrevistaExibicao(ex.data_inicio) + ' – ' + formatarDataPrevistaExibicao(ex.data_fim);
        const cor = corStatus[ex.status] || '#64748b';
        const rotulo = rotuloStatus[ex.status] || ex.status;
        return '<tr>' +
            '<td>' + periodo + '</td>' +
            '<td class="col-centralizada">' + ex.horas_por_dia + 'h</td>' +
            '<td>' + (ex.motivo || '—') + '</td>' +
            '<td style="color:' + cor + '; font-weight:bold;">' + rotulo + '</td>' +
            '</tr>';
    }).join('');
}

// Validação isolada (testável sem DOM) — usada por
// criarExcecaoCalendarioKanban() antes de gravar.
function validarNovaExcecaoCalendario(de, ate, horas) {
    if (!de || !ate) return 'Preencha as duas datas (De e Até).';
    if (de > ate) return 'A data "De" não pode ser depois da data "Até".';
    if (horas === '' || horas === null || isNaN(horas)) return 'Informe as horas/dia (pode ser 0, pra ausência total).';
    if (parseFloat(horas) < 0) return 'Horas/dia não pode ser negativo.';
    return null; // válido
}

function criarExcecaoCalendarioKanban() {
    if (!podeAlterarCalendarioColaborador()) return;

    const nomeExecutor = obterNomeSujeitoCalendarioKanban();
    if (!nomeExecutor) return;

    const de = document.getElementById('kb-cal-nova-de').value;
    const ate = document.getElementById('kb-cal-nova-ate').value;
    const horas = document.getElementById('kb-cal-nova-horas').value;
    const motivo = document.getElementById('kb-cal-nova-motivo').value;

    const erro = validarNovaExcecaoCalendario(de, ate, horas);
    if (erro) { alert(erro); return; }

    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const func = funcionarios.find(f => f.nome === nomeExecutor);
    if (!func) return;

    if (!Array.isArray(func.excecoes_calendario)) func.excecoes_calendario = [];
    func.excecoes_calendario.push({
        id: gerarIdExcecaoCalendario(),
        data_inicio: de,
        data_fim: ate,
        horas_por_dia: parseFloat(horas) || 0,
        motivo: motivo || '',
        status: 'pendente'
    });

    localStorage.setItem('banco_funcionarios', JSON.stringify(funcionarios));

    document.getElementById('kb-cal-nova-de').value = '';
    document.getElementById('kb-cal-nova-ate').value = '';
    document.getElementById('kb-cal-nova-horas').value = '';
    document.getElementById('kb-cal-nova-motivo').value = '';

    renderizarTabelaExcecoesCalendarioKanban(nomeExecutor);

    // Atualiza o contador de pendências no menu, se a função existir
    // (vem de aprovacoes-calendario.js, carregado depois de kanban.js).
    if (typeof atualizarBadgePendenciasAprovacoes === 'function') atualizarBadgePendenciasAprovacoes();

    alert('Exceção enviada pra aprovação. Ela só passa a valer no cálculo de prazos depois que um administrador aprovar.');
}

// --- ANOTAÇÃO MANUAL DE HORAS PELO EXECUTOR (item 4 da "Frente Kanban
// avançado") ---
// A lógica de dados (validação, criação pendente, aprovação) vive em
// apontamento.js — aqui só a UI do modal, mesmo padrão do "Meu
// Calendário" acima.

function abrirModalApontamentoManualKanban(caminho, trilha) {
    kbApoCaminhoAtual = caminho;
    kbApoTrilhaAtual = trilha || 'execucao';

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    document.getElementById('kb-apo-modal-nome-tarefa').innerText = (tarefa ? tarefa.nome : '') + (kbApoTrilhaAtual === 'revisao' ? ' (horas de revisão)' : '');

    document.getElementById('kb-apo-nova-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('kb-apo-nova-horas').value = '';
    document.getElementById('kb-apo-nova-motivo').value = '';

    renderizarTabelaApontamentosManuaisKanban(caminho);
    document.getElementById('kb-modal-apontamento').style.display = 'flex';
}

function fecharModalApontamentoManualKanban() {
    document.getElementById('kb-modal-apontamento').style.display = 'none';
    kbApoCaminhoAtual = null;
    kbApoTrilhaAtual = 'execucao';
}

// Aprovar Finalização direto do card do Kanban (prompt_gemini.md §14,
// item 4) — mesma função de sempre (aprovacoes-calendario.js), só
// chamada de um lugar novo, sem precisar ir pra tela "🗓️ Aprovações".
// Recusar não tem botão aqui de propósito: recusar uma finalização é
// uma ação mais delicada (volta a tarefa pra trás) — continua só na
// tela de Aprovações, que tem mais contexto (motivo, histórico).
function aprovarFinalizacaoCartaoKanban(caminho) {
    if (typeof aprovarFinalizacaoTarefa !== 'function') return;
    const ok = aprovarFinalizacaoTarefa(caminho);
    if (ok) renderizarQuadroKanban();
}

// Sessões de Revisão pendentes direto do card do Kanban (mesmo pedido
// do item acima) — abre um modal leve listando as sessões daquela
// tarefa específica, com Aprovar/Recusar por sessão (reaproveita
// aprovarSessaoRevisao()/recusarSessaoRevisao() de
// aprovacoes-calendario.js, sem duplicar lógica).
let kbSessoesRevisaoCaminhoAtual = null;

function abrirModalSessoesRevisaoPendentesKanban(caminho) {
    kbSessoesRevisaoCaminhoAtual = caminho;
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    document.getElementById('kb-sessoes-revisao-modal-nome-tarefa').innerText = tarefa ? tarefa.nome : '';
    renderizarTabelaSessoesRevisaoPendentesKanban(caminho);
    document.getElementById('kb-modal-sessoes-revisao').style.display = 'flex';
}

function fecharModalSessoesRevisaoPendentesKanban() {
    document.getElementById('kb-modal-sessoes-revisao').style.display = 'none';
    kbSessoesRevisaoCaminhoAtual = null;
    renderizarQuadroKanban(); // reflete no card se algo foi aprovado/recusado
}

function renderizarTabelaSessoesRevisaoPendentesKanban(caminho) {
    const tbody = document.getElementById('kb-sessoes-revisao-tabela-body');
    if (!tbody) return;
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    const sessoes = (tarefa && Array.isArray(tarefa.sessoes_revisao)) ? tarefa.sessoes_revisao : [];
    const pendentes = sessoes
        .map((s, idx) => ({ sessao: s, idx: idx }))
        .filter(item => item.sessao.status === 'pendente');

    if (pendentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:15px;">Nenhuma sessão pendente.</td></tr>';
        return;
    }

    tbody.innerHTML = pendentes.map(item => {
        const s = item.sessao;
        return '<tr>' +
            '<td>' + (nomeParaExibicao(s.quem) || '—') + '</td>' +
            '<td>' + (s.inicio ? new Date(s.inicio).toLocaleString('pt-BR') : '—') + '</td>' +
            '<td>' + (parseFloat(s.duracao) || 0).toFixed(2) + 'h</td>' +
            '<td style="text-align:center; white-space:nowrap;">' +
            '<button class="kb-btn-aprovar" style="background:#166534; color:white; border:none; font-size:11px; padding:4px 8px; border-radius:3px; cursor:pointer; margin-right:4px;" onclick="aprovarSessaoRevisao(\'' + caminho + '\', ' + item.idx + '); renderizarTabelaSessoesRevisaoPendentesKanban(\'' + caminho + '\');">✅ Aprovar</button>' +
            '<button class="kb-btn-recusar" style="background:#991b1b; color:white; border:none; font-size:11px; padding:4px 8px; border-radius:3px; cursor:pointer;" onclick="recusarSessaoRevisao(\'' + caminho + '\', ' + item.idx + '); renderizarTabelaSessoesRevisaoPendentesKanban(\'' + caminho + '\');">✖ Recusar</button>' +
            '</td></tr>';
    }).join('');
}

function renderizarTabelaApontamentosManuaisKanban(caminho) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    const tbody = document.getElementById('kb-apo-tabela-body');

    if (kbApoTrilhaAtual === 'revisao') {
        // Trilha de Revisão: mostra só os apontamentos MANUAIS (não as
        // sessões que vieram de play/pause do cronômetro — essas não
        // têm "data"/"motivo" nesse sentido, são início/fim de sessão).
        const lista = (tarefa && Array.isArray(tarefa.sessoes_revisao)) ? tarefa.sessoes_revisao.filter(s => s.manual).slice() : [];
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">Nenhum apontamento manual de revisão registrado ainda.</td></tr>';
            return;
        }
        lista.reverse();
        const corStatusRevisao = { pendente: '#f59e0b', aprovada: '#10b981', recusada: '#ef4444' };
        const rotuloStatusRevisao = { pendente: '⏳ Pendente', aprovada: '✅ Aprovado', recusada: '❌ Recusado' };
        tbody.innerHTML = lista.map(s => {
            const cor = corStatusRevisao[s.status] || '#64748b';
            const rotulo = rotuloStatusRevisao[s.status] || s.status;
            return '<tr>' +
                '<td>' + formatarDataPrevistaExibicao((s.inicio || '').split('T')[0]) + '</td>' +
                '<td class="col-centralizada">' + parseFloat(s.duracao).toFixed(1) + 'h</td>' +
                '<td>' + (s.motivo || '—') + '</td>' +
                '<td style="color:' + cor + '; font-weight:bold;">' + rotulo + '</td>' +
                '</tr>';
        }).join('');
        return;
    }

    const lista = (tarefa && Array.isArray(tarefa.apontamentos_manuais)) ? tarefa.apontamentos_manuais.slice() : [];

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">Nenhum apontamento manual registrado ainda.</td></tr>';
        return;
    }

    // Mais recente primeiro.
    lista.reverse();

    const corStatus = { pendente: '#f59e0b', aprovado: '#10b981', recusado: '#ef4444' };
    const rotuloStatus = { pendente: '⏳ Pendente', aprovado: '✅ Aprovado', recusado: '❌ Recusado' };

    tbody.innerHTML = lista.map(ap => {
        const cor = corStatus[ap.status] || '#64748b';
        const rotulo = rotuloStatus[ap.status] || ap.status;
        return '<tr>' +
            '<td>' + formatarDataPrevistaExibicao(ap.data) + '</td>' +
            '<td class="col-centralizada">' + ap.horas + 'h</td>' +
            '<td>' + (ap.motivo || '—') + '</td>' +
            '<td style="color:' + cor + '; font-weight:bold;">' + rotulo + '</td>' +
            '</tr>';
    }).join('');
}

function criarApontamentoManualKanban() {
    if (!kbApoCaminhoAtual) return;

    const data = document.getElementById('kb-apo-nova-data').value;
    const horas = document.getElementById('kb-apo-nova-horas').value;
    const motivo = document.getElementById('kb-apo-nova-motivo').value;

    const resultado = (kbApoTrilhaAtual === 'revisao')
        ? criarApontamentoManualRevisao(kbApoCaminhoAtual, data, horas, motivo)
        : criarApontamentoManual(kbApoCaminhoAtual, data, horas, motivo);
    if (!resultado.ok) { alert(resultado.erro); return; }

    document.getElementById('kb-apo-nova-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('kb-apo-nova-horas').value = '';
    document.getElementById('kb-apo-nova-motivo').value = '';

    renderizarTabelaApontamentosManuaisKanban(kbApoCaminhoAtual);
    renderizarQuadroKanban(); // atualiza o contador ⏳ no cartão por trás do modal

    if (typeof atualizarBadgePendenciasAprovacoes === 'function') atualizarBadgePendenciasAprovacoes();

    if (kbApoTrilhaAtual === 'revisao') {
        alert('Apontamento de revisão enviado pra aprovação — aba "Sessões de Revisão", tela Aprovações.');
    } else {
        alert('Apontamento enviado pra aprovação. Só entra nas horas da tarefa depois que um administrador/analista/supervisor aprovar.');
    }
}
