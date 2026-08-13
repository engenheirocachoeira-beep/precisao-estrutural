// =========================================================================
// MÓDULO: APROVAÇÕES (Calendário + Apontamento de Horas)
//
// Tela SEPARADA (pedido explícito do usuário — não dentro do Cadastro de
// Funcionários) onde administrador/analista/supervisor vê TODAS as
// pendências de aprovação num lugar só, organizadas em DUAS ABAS:
//
// - "🗓️ Calendário": exceções de calendário nascidas no Kanban ("⚙️ Meu
//   Calendário", ver kanban.js) — só depois de aprovada aqui é que
//   passam a valer pro motor de Data Prevista (ver obterExcecaoAprovada()
//   em feriados.js).
// - "🕐 Apontamento de Horas": anotações manuais de horas nascidas no
//   Kanban ("📝 Apontar horas", ver kanban.js e item 4 da "Frente Kanban
//   avançado" em prompt_gemini.md §11) — só depois de aprovada aqui é
//   que entram em tarefa.horas_reais (ver aprovarApontamentoManual() em
//   apontamento.js).
//
// As duas abas ficaram juntas na MESMA tela por pedido explícito do
// usuário (item 4 — antes era pra ser tela nova separada, ele preferiu
// juntar). O id do módulo/menu continua 'aprovacoes_calendario' por
// baixo dos panos (não precisou mudar controle de acesso nem
// alternarModulo em core.js pra isso), só o texto visível e o conteúdo
// mudaram pra refletir que agora cobre as duas coisas.
//
// Sem login ainda pros níveis Administrador/Analista/Supervisor
// diferenciarem AÇÕES entre si nesta tela — os três já têm acesso ao
// menu (ver MENU_PERMISSOES_POR_NIVEL em core.js), e qualquer um deles
// pode aprovar ou recusar qualquer pendência de qualquer funcionário.
// =========================================================================

function listarTodasExcecoesCalendario() {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    let lista = [];
    funcionarios.forEach(f => {
        (f.excecoes_calendario || []).forEach(ex => {
            lista.push({
                nomeExecutor: f.nome,
                id: ex.id,
                data_inicio: ex.data_inicio,
                data_fim: ex.data_fim,
                horas_por_dia: ex.horas_por_dia,
                motivo: ex.motivo,
                status: ex.status
            });
        });
    });
    return lista;
}

function contarExcecoesPendentes() {
    return listarTodasExcecoesCalendario().filter(e => e.status === 'pendente').length;
}

// --- ABA "Sessões de Revisão" (prompt_gemini.md §12.13) ---
// Toda sessão de conferência (trilha Revisão, ver apontamento.js) nasce
// 'pendente' quando fechada via play/pause normal — só conta no total
// oficial (`tarefa.horas_revisao`, `calcularCustoRevisaoTarefa()`)
// depois de aprovada aqui. Correção manual (adicionarSessaoManualRevisao
// e companhia) já nasce 'aprovada' — não passa por essa fila.
function listarSessoesRevisaoPendentes() {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    let lista = [];

    function empilharSessoesPendentes(tarefa, caminho, nomeProjeto) {
        (tarefa.sessoes_revisao || []).forEach((sessao, idx) => {
            if (sessao.status !== 'pendente') return;
            lista.push({
                caminho: caminho,
                idxSessao: idx,
                projeto: nomeProjeto,
                tarefaNome: tarefa.nome,
                quem: sessao.quem || '—',
                inicio: sessao.inicio,
                fim: sessao.fim,
                horas: parseFloat(sessao.duracao) || 0
            });
        });
    }

    Object.keys(arvores).forEach(nomeProjeto => {
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            empilharSessoesPendentes(tarefa, nomeProjeto + '|' + path, nomeProjeto);
        });
    });

    return lista;
}

function contarSessoesRevisaoPendentes() {
    return listarSessoesRevisaoPendentes().length;
}

function aprovarSessaoRevisao(caminho, idxSessao) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_revisao) || !tarefa.sessoes_revisao[idxSessao]) return false;
    if (tarefa.sessoes_revisao[idxSessao].status !== 'pendente') return false;

    tarefa.sessoes_revisao[idxSessao].status = 'aprovada';
    if (typeof recalcularHorasRevisao === 'function') recalcularHorasRevisao(tarefa);
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

function recusarSessaoRevisao(caminho, idxSessao) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_revisao) || !tarefa.sessoes_revisao[idxSessao]) return false;
    if (tarefa.sessoes_revisao[idxSessao].status !== 'pendente') return false;

    tarefa.sessoes_revisao[idxSessao].status = 'recusada';
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// --- ABA "Finalizações" (prompt_gemini.md §12.9) ---
// Diferente das duas abas acima (dado vive em funcionário), aqui o dado
// vive na árvore do projeto — mesmo padrão de travessia
// etapas→setores→pavimentos→tarefas que arvore.js/kanban.js já usam.
// Autoridade de aprovar (usuarioTemAutoridadeDeAprovarNoProjeto/
// podeAprovarFinalizacao) vive em kanban.js, carregado ANTES deste
// arquivo (ver ordem dos <script> no index.html).
function listarFinalizacoesPendentes() {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    let lista = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        // Só lista projetos onde a pessoa TEM alguma autoridade de
        // aprovar (Administrador vê tudo; Analista/Supervisor só o(s)
        // próprio(s) projeto(s)) — não polui a tela com pendências que
        // ela nem pode agir.
        if (usuarioAtual && typeof usuarioTemAutoridadeDeAprovarNoProjeto === 'function' && !usuarioTemAutoridadeDeAprovarNoProjeto(usuarioAtual, nomeProjeto, projetos)) return;

        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            if (tarefa.status !== 'Finalizada' || tarefa.aprovacao_finalizacao !== 'pendente') return;
            const caminho = nomeProjeto + '|' + path;
            lista.push({
                projeto: nomeProjeto,
                localizacao: localizacao,
                tarefa: tarefa.nome,
                executor: tarefa.executor || '—',
                responsavel: tarefa.responsavel || '—',
                finalizadaPor: tarefa.finalizada_por || '—',
                horasReais: parseFloat(tarefa.horas_reais) || 0,
                caminho: caminho,
                podeAprovar: usuarioAtual ? podeAprovarFinalizacao(tarefa, nomeProjeto, usuarioAtual, projetos) : true
            });
        });
    });

    return lista;
}

function contarFinalizacoesPendentes() {
    return listarFinalizacoesPendentes().length;
}

function aprovarFinalizacaoTarefa(caminho) {
    const [nomeProjeto, caminhoResto] = caminho.split('|');

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return false;

    const tarefa = resolverNoPorPath(arv, caminhoResto);
    if (!tarefa) return false; // caminho não existe mais — árvore mudou entre carregar e aprovar

    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    if (usuarioAtual && !podeAprovarFinalizacao(tarefa, nomeProjeto, usuarioAtual, projetos)) return false;

    tarefa.aprovacao_finalizacao = 'aprovada';
    tarefa.aprovada_por = usuarioAtual ? usuarioAtual.nome : null;
    tarefa.aprovada_em = new Date().toISOString();
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// Chamada no boot (core.js) e toda vez que uma exceção/apontamento é
// criado (kanban.js) ou aprovado/recusado (aqui embaixo) — mantém o
// número vermelho no menu sempre atualizado, mesmo sem estar na tela.
// Soma as DUAS pendências (Calendário + Apontamento) num badge só, já
// que agora é uma tela só com abas. `contarApontamentosManuaisPendentes`
// vem de apontamento.js, carregado antes deste arquivo (ver ordem dos
// <script> no index.html) — mesmo padrão de dependência direta sem
// guarda que kanban.js já usa com apontamento.js.
function atualizarBadgePendenciasAprovacoes() {
    const badge = document.getElementById('badge-pendencias-aprovacoes');
    if (!badge) return;
    const n = contarExcecoesPendentes() + contarApontamentosManuaisPendentes() + contarFinalizacoesPendentes() + contarSessoesRevisaoPendentes();
    if (n > 0) {
        badge.innerText = n;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

let aprovAbaAtiva = 'calendario'; // 'calendario', 'apontamento', 'finalizacoes' ou 'revisao'

// Orquestrador chamado por alternarModulo() (core.js) ao abrir a tela —
// renderiza as quatro tabelas (custa pouco, mantém sempre atualizadas por
// trás) e mostra a aba que estava ativa.
function renderizarPainelAprovacoes() {
    renderizarPainelAprovacoesCalendario();
    renderizarPainelAprovacoesApontamento();
    renderizarPainelAprovacoesFinalizacoes();
    renderizarPainelAprovacoesRevisao();
    alternarAbaAprovacoes(aprovAbaAtiva);
}

function alternarAbaAprovacoes(aba) {
    aprovAbaAtiva = aba;
    document.getElementById('aprov-sub-calendario').style.display = (aba === 'calendario') ? 'block' : 'none';
    document.getElementById('aprov-sub-apontamento').style.display = (aba === 'apontamento') ? 'block' : 'none';
    document.getElementById('aprov-sub-finalizacoes').style.display = (aba === 'finalizacoes') ? 'block' : 'none';
    document.getElementById('aprov-sub-revisao').style.display = (aba === 'revisao') ? 'block' : 'none';
    document.getElementById('aprov-aba-calendario').classList.toggle('aprov-aba-ativa', aba === 'calendario');
    document.getElementById('aprov-aba-apontamento').classList.toggle('aprov-aba-ativa', aba === 'apontamento');
    document.getElementById('aprov-aba-finalizacoes').classList.toggle('aprov-aba-ativa', aba === 'finalizacoes');
    document.getElementById('aprov-aba-revisao').classList.toggle('aprov-aba-ativa', aba === 'revisao');
}

function renderizarPainelAprovacoesCalendario() {
    const lista = listarTodasExcecoesCalendario().sort((a, b) => {
        // Pendentes primeiro (é o que precisa de ação); dentro de cada
        // grupo, mais recente primeiro.
        if (a.status === 'pendente' && b.status !== 'pendente') return -1;
        if (a.status !== 'pendente' && b.status === 'pendente') return 1;
        return b.data_inicio.localeCompare(a.data_inicio);
    });

    const tbody = document.getElementById('aprov-cal-tabela-body');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Nenhuma exceção de calendário registrada ainda.</td></tr>';
        return;
    }

    const corStatus = { pendente: '#f59e0b', aprovado: '#10b981', recusado: '#ef4444' };
    const rotuloStatus = { pendente: '<svg class="icon"><use href="#icon-hourglass"></use></svg> Pendente', aprovado: '<svg class="icon"><use href="#icon-check"></use></svg> Aprovado', recusado: '<svg class="icon"><use href="#icon-close"></use></svg> Recusado' };

    tbody.innerHTML = lista.map(ex => {
        const periodo = ex.data_inicio === ex.data_fim
            ? formatarDataPrevistaExibicao(ex.data_inicio)
            : formatarDataPrevistaExibicao(ex.data_inicio) + ' – ' + formatarDataPrevistaExibicao(ex.data_fim);
        const cor = corStatus[ex.status] || '#64748b';
        const rotulo = rotuloStatus[ex.status] || ex.status;
        const idJs = ex.id.replace(/'/g, "\\'");
        const nomeJs = ex.nomeExecutor.replace(/'/g, "\\'");
        const acoes = ex.status === 'pendente'
            ? '<button class="btn-primary" style="padding:4px 10px; font-size:12px;" onclick="aprovarExcecaoCalendario(\'' + nomeJs + '\', \'' + idJs + '\')">Aprovar</button> ' +
              '<button style="padding:4px 10px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:white; cursor:pointer;" onclick="recusarExcecaoCalendario(\'' + nomeJs + '\', \'' + idJs + '\')">Recusar</button>'
            : '—';

        return '<tr>' +
            '<td>' + nomeParaExibicao(ex.nomeExecutor) + '</td>' +
            '<td>' + periodo + '</td>' +
            '<td class="col-centralizada">' + ex.horas_por_dia + 'h</td>' +
            '<td>' + (ex.motivo || '—') + '</td>' +
            '<td style="color:' + cor + '; font-weight:bold;">' + rotulo + '</td>' +
            '<td class="col-centralizada">' + acoes + '</td>' +
            '</tr>';
    }).join('');
}

function localizarExcecaoDoFuncionario(nomeExecutor, idExcecao) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const func = funcionarios.find(f => f.nome === nomeExecutor);
    if (!func || !Array.isArray(func.excecoes_calendario)) return null;
    const excecao = func.excecoes_calendario.find(e => e.id === idExcecao);
    return excecao ? { funcionarios, excecao } : null;
}

function aprovarExcecaoCalendario(nomeExecutor, idExcecao) {
    const achado = localizarExcecaoDoFuncionario(nomeExecutor, idExcecao);
    if (!achado) return;
    achado.excecao.status = 'aprovado';
    localStorage.setItem('banco_funcionarios', JSON.stringify(achado.funcionarios));
    renderizarPainelAprovacoesCalendario();
    atualizarBadgePendenciasAprovacoes();
}

function recusarExcecaoCalendario(nomeExecutor, idExcecao) {
    const achado = localizarExcecaoDoFuncionario(nomeExecutor, idExcecao);
    if (!achado) return;
    achado.excecao.status = 'recusado';
    localStorage.setItem('banco_funcionarios', JSON.stringify(achado.funcionarios));
    renderizarPainelAprovacoesCalendario();
    atualizarBadgePendenciasAprovacoes();
}

// --- ABA "Apontamento de Horas" (item 4 da Frente Kanban avançado) ---
// Dados/aprovação de verdade vivem em apontamento.js
// (listarTodosApontamentosManuais, aprovarApontamentoManual,
// recusarApontamentoManual) — aqui só a UI desta tela, mesmo padrão da
// aba de Calendário acima.

function renderizarPainelAprovacoesApontamento() {
    const lista = listarTodosApontamentosManuais().sort((a, b) => {
        if (a.status === 'pendente' && b.status !== 'pendente') return -1;
        if (a.status !== 'pendente' && b.status === 'pendente') return 1;
        return (b.criado_em || '').localeCompare(a.criado_em || '');
    });

    const tbody = document.getElementById('aprov-apo-tabela-body');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:20px;">Nenhum apontamento manual registrado ainda.</td></tr>';
        return;
    }

    const corStatus = { pendente: '#f59e0b', aprovado: '#10b981', recusado: '#ef4444' };
    const rotuloStatus = { pendente: '<svg class="icon"><use href="#icon-hourglass"></use></svg> Pendente', aprovado: '<svg class="icon"><use href="#icon-check"></use></svg> Aprovado', recusado: '<svg class="icon"><use href="#icon-close"></use></svg> Recusado' };

    tbody.innerHTML = lista.map(ap => {
        const cor = corStatus[ap.status] || '#64748b';
        const rotulo = rotuloStatus[ap.status] || ap.status;
        const caminhoJs = ap.caminho.replace(/'/g, "\\'");
        const idJs = ap.id.replace(/'/g, "\\'");
        const acoes = ap.status === 'pendente'
            ? '<button class="btn-primary" style="padding:4px 10px; font-size:12px;" onclick="aprovarApontamentoManualNaTela(\'' + caminhoJs + '\', \'' + idJs + '\')">Aprovar</button> ' +
              '<button style="padding:4px 10px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:white; cursor:pointer;" onclick="recusarApontamentoManualNaTela(\'' + caminhoJs + '\', \'' + idJs + '\')">Recusar</button>'
            : '—';

        return '<tr>' +
            '<td>' + nomeParaExibicao(ap.executor) + '</td>' +
            '<td>' + ap.tarefaNome + ' <span style="color:#64748b; font-size:11px;">(' + ap.projeto + ')</span></td>' +
            '<td>' + formatarDataPrevistaExibicao(ap.data) + '</td>' +
            '<td class="col-centralizada">' + ap.horas + 'h</td>' +
            '<td>' + (ap.motivo || '—') + '</td>' +
            '<td style="color:' + cor + '; font-weight:bold;">' + rotulo + '</td>' +
            '<td class="col-centralizada">' + acoes + '</td>' +
            '</tr>';
    }).join('');
}

function aprovarApontamentoManualNaTela(caminho, id) {
    if (!aprovarApontamentoManual(caminho, id)) return;
    renderizarPainelAprovacoesApontamento();
    atualizarBadgePendenciasAprovacoes();
}

function recusarApontamentoManualNaTela(caminho, id) {
    if (!recusarApontamentoManual(caminho, id)) return;
    renderizarPainelAprovacoesApontamento();
    atualizarBadgePendenciasAprovacoes();
}

// --- ABA "Finalizações" (prompt_gemini.md §12.9) ---
// Dados/permissão de verdade vivem em kanban.js/aprovacoes-calendario.js
// (listarFinalizacoesPendentes, podeAprovarFinalizacao,
// aprovarFinalizacaoTarefa) — aqui só a UI desta tela, mesmo padrão das
// duas abas acima.
function renderizarPainelAprovacoesFinalizacoes() {
    const lista = listarFinalizacoesPendentes();
    const tbody = document.getElementById('aprov-fin-tabela-body');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:20px;">Nenhuma finalização pendente de aprovação.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(f => {
        const caminhoJs = f.caminho.replace(/'/g, "\\'");
        const acoes = f.podeAprovar
            ? '<button class="btn-primary" style="padding:4px 10px; font-size:12px;" onclick="aprovarFinalizacaoNaTela(\'' + caminhoJs + '\')"><svg class="icon"><use href="#icon-check"></use></svg> Aprovar</button>'
            : '<span style="color:#64748b; font-size:11px;">Aguardando outro aprovador</span>';

        return '<tr>' +
            '<td>' + f.projeto + '</td>' +
            '<td style="color:#64748b; font-size:12px;">' + f.localizacao + '</td>' +
            '<td>' + f.tarefa + '</td>' +
            '<td>' + nomeParaExibicao(f.executor) + (f.responsavel && f.responsavel !== f.executor ? ' <span style="color:#64748b; font-size:11px;">(resp: ' + nomeParaExibicao(f.responsavel) + ')</span>' : '') + '</td>' +
            '<td>' + nomeParaExibicao(f.finalizadaPor) + '</td>' +
            '<td class="col-centralizada">' + f.horasReais.toFixed(2) + 'h</td>' +
            '<td class="col-centralizada">' + acoes + '</td>' +
            '</tr>';
    }).join('');
}

function aprovarFinalizacaoNaTela(caminho) {
    if (!aprovarFinalizacaoTarefa(caminho)) return;
    renderizarPainelAprovacoesFinalizacoes();
    atualizarBadgePendenciasAprovacoes();
}

// --- ABA "Sessões de Revisão" (prompt_gemini.md §12.13) ---
function renderizarPainelAprovacoesRevisao() {
    const lista = listarSessoesRevisaoPendentes();
    const tbody = document.getElementById('aprov-rev-tabela-body');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Nenhuma sessão de revisão pendente de aprovação.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(s => {
        const caminhoJs = s.caminho.replace(/'/g, "\\'");
        return '<tr>' +
            '<td>' + s.projeto + '</td>' +
            '<td>' + s.tarefaNome + '</td>' +
            '<td>' + nomeParaExibicao(s.quem) + '</td>' +
            '<td style="font-size:11px; color:#64748b;">' + formatarDataHoraExibicao(s.inicio) + ' → ' + formatarDataHoraExibicao(s.fim) + '</td>' +
            '<td class="col-centralizada">' + s.horas.toFixed(2) + 'h</td>' +
            '<td class="col-centralizada" style="white-space:nowrap;">' +
            '<button class="btn-primary" style="padding:4px 10px; font-size:12px; margin-right:4px;" onclick="aprovarSessaoRevisaoNaTela(\'' + caminhoJs + '\', ' + s.idxSessao + ')"><svg class="icon"><use href="#icon-check"></use></svg> Aprovar</button>' +
            '<button class="btn-secondary" style="padding:4px 10px; font-size:12px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;" onclick="recusarSessaoRevisaoNaTela(\'' + caminhoJs + '\', ' + s.idxSessao + ')"><svg class="icon"><use href="#icon-close"></use></svg> Recusar</button>' +
            '</td>' +
            '</tr>';
    }).join('');
}

function aprovarSessaoRevisaoNaTela(caminho, idxSessao) {
    if (!aprovarSessaoRevisao(caminho, idxSessao)) return;
    renderizarPainelAprovacoesRevisao();
    atualizarBadgePendenciasAprovacoes();
}

function recusarSessaoRevisaoNaTela(caminho, idxSessao) {
    if (!recusarSessaoRevisao(caminho, idxSessao)) return;
    renderizarPainelAprovacoesRevisao();
    atualizarBadgePendenciasAprovacoes();
}
