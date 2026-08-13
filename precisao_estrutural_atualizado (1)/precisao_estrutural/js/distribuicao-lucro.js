// =========================================================================
// MÓDULO: DISTRIBUIÇÃO DE LUCRO ENTRE ESTAGIÁRIOS
// (prompt_gemini.md §12.28, Nota de escopo 1 — pedido da diretoria,
// agosto/2026). Tela só-Administrador (ver MENU_POR_NIVEL, core.js).
//
// Duas contas independentes, cruzadas só no fim:
//  1) TAMANHO DO BOLO (R$): rateia a Verba de Distribuição de Lucros
//     (já calculada por projeto na aba 3 da Distribuição de Custos —
//     distribuicao-custos.js) entre Pavimento/Tarefa, MESMA fórmula das
//     abas 4/5 daquele módulo (reaproveitada, não duplicada) — e soma o
//     "valor de lucro" de toda tarefa FINALIZADA dentro do período
//     escolhido, de QUALQUER projeto, independente de quem executou.
//     Só tarefas de Etapa Subdividida entram aqui (Etapa Única/
//     Sub-etapas não têm Pavimento, não contribuem pro bolo — mesma
//     regra que já vale pras abas 4/5, nada novo).
//  2) REPARTIÇÃO ENTRE PESSOAS: só Estagiário participa (Cargo começa
//     com "estagiário"), Comissionado nunca participa. Cada Estagiário
//     acumula Pontos de TODAS as tarefas que finalizou no período
//     (qualquer tipo de Etapa — Detalhamento, Única, Sub-etapas — mesmo
//     critério do Ranking de Produtividade, kanban.js). O bolo se
//     divide em 2 fatias: Igualitária (entre todos os Estagiários
//     ATIVOS — sem desligamento — independente de terem trabalhado no
//     período) e Proporcional (pontos do Estagiário ÷ soma de pontos de
//     todos os Estagiários no período). % de cada fatia é digitado pelo
//     Administrador a cada apuração — não fixo no sistema.
//
// Assunções registradas em prompt_gemini.md §12.28 (não 100% confirmadas
// pelo usuário antes de codar, "implemente agora" pediu pra seguir com a
// saída mais simples e reversível): "verba total do período" = soma de
// TODA tarefa finalizada no período, de qualquer executor, não só de
// Estagiário; fatia igualitária divide entre Estagiários ATIVOS
// (cadastrados, sem `dt_desligamento`), não só os que trabalharam no
// período; "período" é só um filtro de data sobre `finalizada_em` — não
// existe conceito de "fechar" um período nem zerar pontos, é sempre uma
// consulta, repetível, não destrutiva.
// =========================================================================

// --- CONTA 1: TAMANHO DO BOLO ---

// Rateia a Verba de Distribuição de Lucros de UM projeto entre
// Pavimento (Área Equivalente) e Tarefa (Pontos). Item 10
// (prompt_gemini.md §14, leva 4): reaproveita a cascata por Etapa
// (distribuirVerbaRecursiva/listarPavimentosDoProjeto, de
// distribuicao-custos.js, já carregadas na mesma página) — antes essa
// conta usava um bolo único pra todo o projeto
// (aplicarVerbaProporcionalAosPavimentos, removida nesta mudança), sem
// respeitar de qual Etapa cada Pavimento era. Agora o bolo de lucros de
// CADA Etapa (calcularVerbaPorEtapaSalvo().valorLucros) cascateia só
// dentro da própria Etapa, mesmo critério de proporção (Área
// Equivalente/Pontos) que a verba normal já usa. Retorna
// [{ tarefa, valorLucroTarefa }].
function calcularValorLucroPorTarefaDoProjeto(nomeProjeto) {
    const verbasPorEtapa = calcularVerbaPorEtapaSalvo(nomeProjeto);
    const verbasLucrosPorEtapa = verbasPorEtapa.map(v => ({ nome: v.nome, verbaLiquida: v.valorLucros }));
    const pavimentos = listarPavimentosDoProjeto(nomeProjeto, verbasLucrosPorEtapa);

    const resultado = [];
    pavimentos.forEach(p => {
        const totalPontosPav = (p.tarefas || []).reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
        (p.tarefas || []).forEach(t => {
            const valorLucroTarefa = totalPontosPav > 0 ? ((parseFloat(t.pontos) || 0) / totalPontosPav) * p.valorVerba : 0;
            resultado.push({ tarefa: t, valorLucroTarefa: valorLucroTarefa });
        });
    });
    return resultado;
}

// Soma o "valor de lucro" (função acima) de toda tarefa Finalizada
// dentro do período [dataInicio, dataFim] (strings "YYYY-MM-DD"), em
// TODOS os projetos cadastrados (`nomesProjetos` injetado — mesmo
// motivo de todosFuncionarios ser injetado em
// calcularApuracaoDistribuicaoLucro() abaixo: função testável isolada).
function calcularBoloTotalDoPeriodo(dataInicio, dataFim, nomesProjetos) {
    const fimComHora = dataFim + 'T23:59:59.999Z';
    let bolo = 0;
    nomesProjetos.forEach(nomeProjeto => {
        const itens = calcularValorLucroPorTarefaDoProjeto(nomeProjeto);
        itens.forEach(item => {
            const t = item.tarefa;
            if (t.status === 'Finalizada' && t.finalizada_em && t.finalizada_em >= dataInicio && t.finalizada_em <= fimComHora) {
                bolo += item.valorLucroTarefa;
            }
        });
    });
    return bolo;
}

// --- CONTA 2: PONTOS ACUMULADOS POR ESTAGIÁRIO NO PERÍODO ---

function funcionarioEhEstagiario(func) {
    return !!(func && func.cargo && func.cargo.toLowerCase().indexOf('estagiário') === 0) && func.forma_pagamento !== 'comissionado';
}

function funcionarioEstaAtivo(func) {
    return !func.dt_desligamento || func.dt_desligamento.trim() === '';
}

// Mesma travessia genérica já usada no Ranking de Produtividade
// (kanban.js::calcularRankingProdutividadeExecutores), Atribuição de
// Tarefas, BI etc. — Etapa Única/Sub-etapas tarefas direto em
// etapa.tarefas, Etapa Subdividida em Setor>Pavimento>Tarefa. Aqui não
// importa que tipo de etapa é — Pontos contam igual, diferente da
// Conta 1 acima (que só considera Subdividida, porque só ela tem
// Pavimento pra ratear R$).
function calcularPontosPorEstagiarioNoPeriodo(dataInicio, dataFim, arvoresProjetos) {
    const fimComHora = dataFim + 'T23:59:59.999Z';
    const pontosPorNome = {};

    function contabilizar(tarefa) {
        if (!tarefa || tarefa.status !== 'Finalizada' || !tarefa.executor) return;
        if (!tarefa.finalizada_em || tarefa.finalizada_em < dataInicio || tarefa.finalizada_em > fimComHora) return;
        pontosPorNome[tarefa.executor] = (pontosPorNome[tarefa.executor] || 0) + (parseFloat(tarefa.pontos) || 0);
    }

    Object.keys(arvoresProjetos).forEach(nomeProjeto => {
        const arv = arvoresProjetos[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        // Árvore Genérica Recursiva (prompt_gemini.md §12.31): não há
        // mais `etapa.tipo` — coletarNosFolhaDaArvore() (core.js) acha
        // as tarefas em qualquer profundidade, igual antes contava
        // Etapa Única/Sub-etapas + Subdividida juntas.
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no }) => contabilizar(no));
    });

    return pontosPorNome;
}

// --- APURAÇÃO COMPLETA ---

// Função pura central: dado o período e o % da fatia igualitária
// (0-100, o resto vai pra proporcional), monta a lista final de
// pagamento por Estagiário. `nomesProjetos`/`arvoresProjetos`/
// `todosFuncionarios` são injetados (não lidos direto do localStorage
// aqui dentro) pra a função ficar 100% testável isolada, sem precisar
// simular localStorage — quem chama de verdade (carregarPainelDistribuicaoLucro,
// abaixo) é que lê o localStorage e injeta.
function calcularApuracaoDistribuicaoLucro(dataInicio, dataFim, pctIgualitaria, nomesProjetos, arvoresProjetos, todosFuncionarios) {
    const bolo = calcularBoloTotalDoPeriodo(dataInicio, dataFim, nomesProjetos);
    const pontosPorNome = calcularPontosPorEstagiarioNoPeriodo(dataInicio, dataFim, arvoresProjetos);

    const estagiariosAtivos = todosFuncionarios.filter(f => funcionarioEhEstagiario(f) && funcionarioEstaAtivo(f));
    const somaPontosEstagiarios = estagiariosAtivos.reduce((soma, f) => soma + (pontosPorNome[f.nome] || 0), 0);

    const fatiaIgualitariaTotal = bolo * (pctIgualitaria / 100);
    const fatiaProporcionalTotal = bolo - fatiaIgualitariaTotal;
    const valorIgualitarioPorPessoa = estagiariosAtivos.length > 0 ? fatiaIgualitariaTotal / estagiariosAtivos.length : 0;

    const linhas = estagiariosAtivos.map(f => {
        const pontos = pontosPorNome[f.nome] || 0;
        const valorProporcional = somaPontosEstagiarios > 0 ? (pontos / somaPontosEstagiarios) * fatiaProporcionalTotal : 0;
        return {
            nome: f.nome,
            pontos: pontos,
            valorIgualitario: valorIgualitarioPorPessoa,
            valorProporcional: valorProporcional,
            total: valorIgualitarioPorPessoa + valorProporcional
        };
    }).sort((a, b) => b.total - a.total);

    return { bolo: bolo, fatiaIgualitariaTotal: fatiaIgualitariaTotal, fatiaProporcionalTotal: fatiaProporcionalTotal, somaPontosEstagiarios: somaPontosEstagiarios, linhas: linhas };
}

// --- CAMADA DE TELA (DOM) ---

function carregarPainelDistribuicaoLucro() {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const hojeISO = hoje.toISOString().slice(0, 10);
    const campoInicio = document.getElementById('dl-data-inicio');
    const campoFim = document.getElementById('dl-data-fim');
    if (campoInicio && !campoInicio.value) campoInicio.value = primeiroDiaMes;
    if (campoFim && !campoFim.value) campoFim.value = hojeISO;
    apurarDistribuicaoLucro();
}

function apurarDistribuicaoLucro() {
    const dataInicio = document.getElementById('dl-data-inicio').value;
    const dataFim = document.getElementById('dl-data-fim').value;
    const pctIgualitaria = parseFloat(document.getElementById('dl-pct-igualitaria').value) || 0;
    const tbody = document.getElementById('dl-tabela-body');
    if (!dataInicio || !dataFim) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">Escolha o período (Data Início e Data Fim).</td></tr>';
        return;
    }
    if (dataInicio > dataFim) return alert('Data Início não pode ser depois de Data Fim.');

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const nomesProjetos = projetos.map(p => p.nome);
    const arvoresProjetos = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const todosFuncionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];

    const r = calcularApuracaoDistribuicaoLucro(dataInicio, dataFim, pctIgualitaria, nomesProjetos, arvoresProjetos, todosFuncionarios);

    document.getElementById('dl-bolo-total').innerText = formatarMoeda(r.bolo);
    document.getElementById('dl-fatia-igualitaria-total').innerText = formatarMoeda(r.fatiaIgualitariaTotal);
    document.getElementById('dl-fatia-proporcional-total').innerText = formatarMoeda(r.fatiaProporcionalTotal);
    document.getElementById('dl-soma-pontos').innerText = r.somaPontosEstagiarios.toFixed(1);

    if (r.linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">Nenhum Estagiário ativo cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = r.linhas.map(l => {
        const nomeExibicao = typeof nomeParaExibicao === 'function' ? nomeParaExibicao(l.nome) : l.nome;
        return '<tr>' +
            '<td>' + nomeExibicao + '</td>' +
            '<td style="text-align:center;">' + l.pontos.toFixed(1) + '</td>' +
            '<td style="text-align:center;">' + formatarMoeda(l.valorIgualitario) + '</td>' +
            '<td style="text-align:center;">' + formatarMoeda(l.valorProporcional) + '</td>' +
            '<td style="text-align:center; font-weight:bold; color:#166534;">' + formatarMoeda(l.total) + '</td>' +
            '</tr>';
    }).join('');
}
