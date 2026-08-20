// =========================================================================
// MÓDULO: ORELHA "DESEMPENHO" DO PROJETO — 3ª orelha, ao lado de
// "Estrutura de Projeto" e "Custos" (pedido do usuário: "uma nova
// orelha da aba projetos... horas previstas x horas realizadas, custo
// previsto x custo real, % de conclusão e Saldo da verba"). Desenho
// validado com o usuário em várias rodadas de protótipo (Artifact)
// antes desta implementação — ver prompt_gemini.md pela changelog.
//
// Convenção "Horas Previstas = Pontos" (mesma do Relatório de Custos,
// relatorios.js): a soma dos Pontos do Cadastro de Tarefas nas tarefas
// de um Pavimento/Projeto É o valor de "horas previstas" — não existe
// campo de estimativa de horas separado.
//
// Regra do usuário pro "Saldo por Tarefa" (verba − custo real): "Nas
// tarefas onde as horas não estão apontadas considere que o custo seja
// igual à verba" — sem apontamento, saldo = 0 (não presume lucro nem
// prejuízo). Só a Etapa "Detalhamento" tem granularidade de
// Pavimento/Tarefa com verba própria calculada (listarPavimentosDoProjeto,
// distribuicao-custos.js — regra de negócio já existente: só ela
// alimenta Pavimento); as demais Etapas entram como um bloco só (verba
// da própria Etapa vs soma do custo real de todas as tarefas-folha
// dentro dela — se nenhuma hora foi apontada em toda a Etapa,
// custo = verba).
// =========================================================================

// --- 1) HORAS / CUSTO REAL DO PROJETO INTEIRO ---
function calcularHorasCustoProjeto(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas)) return { horasPrevistas: 0, horasRealizadas: 0, custoRealTotal: 0 };

    const folhas = coletarNosFolhaDaArvore(arv.etapas);
    let horasPrevistas = 0, horasRealizadas = 0, custoRealTotal = 0;
    folhas.forEach(f => {
        horasPrevistas += parseFloat(f.no.pontos) || 0;
        const sessoes = Array.isArray(f.no.sessoes_trabalho) ? f.no.sessoes_trabalho : [];
        horasRealizadas += sessoes.reduce((soma, s) => soma + (parseFloat(s.duracao) || 0), 0);
        custoRealTotal += (typeof calcularCustoRealTarefa === 'function') ? calcularCustoRealTarefa(f.no, f.no.executor) : 0;
    });
    return { horasPrevistas, horasRealizadas, custoRealTotal };
}

// --- 2) % CONCLUÍDO DO PROJETO INTEIRO ---
// Pondera a % de conclusão de cada Etapa (calcularProgressoSubarvore,
// já existe em painel-progresso.js) pelo peso FINANCEIRO real dela
// (verbaLiquida de calcularVerbaPorEtapaSalvo) — não pelo campo manual
// `.verba` do nó (que fica "0" em Etapas Única criadas sem preencher
// esse campo à mão, o que zeraria o peso delas na média sem motivo).
function calcularConclusaoProjeto(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas) || arv.etapas.length === 0) return 0;

    const pavimentosComVerba = (typeof calcularListaPavimentosComVerbaSalva === 'function')
        ? calcularListaPavimentosComVerbaSalva(nomeProjeto).pavimentos : [];
    const verbaPorCaminhoPavimento = {};
    pavimentosComVerba.forEach(p => { verbaPorCaminhoPavimento[p.caminho] = p.valorVerba; });

    const verbasPorEtapa = (typeof calcularVerbaPorEtapaSalvo === 'function') ? calcularVerbaPorEtapaSalvo(nomeProjeto) : [];

    let pesoTotal = 0, pesoConcluido = 0;
    arv.etapas.forEach((etapa, fIdx) => {
        const infoVerba = verbasPorEtapa.find(v => v.nome === etapa.nome);
        const pesoEtapa = infoVerba ? infoVerba.verbaLiquida : 0;
        if (pesoEtapa <= 0) return; // sem peso financeiro, não entra na média (evita divisão por lixo)

        let pctEtapa;
        if (ehNoFolha(etapa)) {
            pctEtapa = etapa.status === 'Finalizada' ? 100 : 0;
        } else {
            const r = calcularProgressoSubarvore(etapa, '' + fIdx, 'etapa', verbaPorCaminhoPavimento);
            pctEtapa = r.verbaTotal > 0 ? (r.verbaFinalizada / r.verbaTotal) * 100 : 0;
        }
        pesoTotal += pesoEtapa;
        pesoConcluido += pesoEtapa * (pctEtapa / 100);
    });
    return pesoTotal > 0 ? (pesoConcluido / pesoTotal) * 100 : 0;
}

// --- 3) HORAS PREVISTO x REALIZADO POR PAVIMENTO (só Detalhamento tem
// essa granularidade — mesma regra de negócio de listarPavimentosDoProjeto) ---
function calcularHorasPorPavimentoProjeto(nomeProjeto) {
    if (typeof calcularListaPavimentosComVerbaSalva !== 'function') return [];
    const pavimentos = calcularListaPavimentosComVerbaSalva(nomeProjeto).pavimentos;
    return pavimentos.map(p => {
        const previsto = (p.tarefas || []).reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
        const realizado = (p.tarefas || []).reduce((soma, t) => {
            const sessoes = Array.isArray(t.sessoes_trabalho) ? t.sessoes_trabalho : [];
            return soma + sessoes.reduce((s2, s) => s2 + (parseFloat(s.duracao) || 0), 0);
        }, 0);
        return { nome: p.nome, previsto: previsto, realizado: realizado };
    });
}

// --- 4) DESEMPENHO POR EXECUTOR (só quem tem alguma hora apontada) ---
function calcularDesempenhoExecutoresProjeto(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas)) return [];

    const folhas = coletarNosFolhaDaArvore(arv.etapas);
    const porExecutor = {};
    folhas.forEach(f => {
        const sessoes = Array.isArray(f.no.sessoes_trabalho) ? f.no.sessoes_trabalho : [];
        if (sessoes.length === 0) return;
        const ex = f.no.executor;
        if (!ex) return;
        if (!porExecutor[ex]) porExecutor[ex] = { pontos: 0, horas: 0, datas: [] };
        porExecutor[ex].pontos += parseFloat(f.no.pontos) || 0;
        sessoes.forEach(s => {
            porExecutor[ex].horas += parseFloat(s.duracao) || 0;
            if (s.inicio) porExecutor[ex].datas.push(s.inicio.slice(0, 10));
        });
    });

    return Object.keys(porExecutor).map(nome => {
        const d = porExecutor[nome];
        d.datas.sort();
        const primeira = d.datas[0], ultima = d.datas[d.datas.length - 1];
        const meses = primeira && ultima ? Math.max((new Date(ultima) - new Date(primeira)) / (1000 * 60 * 60 * 24 * 30.44), 1 / 30.44) : 0;
        return {
            nome: nome,
            pontos: d.pontos,
            horas: d.horas,
            horasPorPonto: d.pontos > 0 ? d.horas / d.pontos : 0,
            pontosPorMes: meses > 0 ? d.pontos / meses : d.pontos
        };
    }).sort((a, b) => b.horas - a.horas);
}

// --- 5) SALDO POR TAREFA (verba − custo real) ---
// Regra do usuário: sem apontamento de horas, custo = verba (saldo 0).
function calcularSaldoPorTarefaProjeto(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    const resultado = { etapasSemDetalhe: [], pavimentosDetalhamento: [], totalVerba: 0, totalCusto: 0, totalSaldo: 0 };
    if (!arv || !Array.isArray(arv.etapas)) return resultado;

    const verbasPorEtapa = (typeof calcularVerbaPorEtapaSalvo === 'function') ? calcularVerbaPorEtapaSalvo(nomeProjeto) : [];
    const etapaDetalhamento = arv.etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));

    // Etapa "Detalhamento" — granularidade Pavimento > Tarefa, via a
    // mesma cascata (verba por Pontos dentro do Pavimento) já usada
    // pela Distribuição de Custos e pela Distribuição de Lucro.
    if (etapaDetalhamento && typeof calcularListaPavimentosComVerbaSalva === 'function') {
        const pavimentos = calcularListaPavimentosComVerbaSalva(nomeProjeto).pavimentos;
        pavimentos.forEach(p => {
            const totalPontosPav = (p.tarefas || []).reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
            const tarefasCalc = (p.tarefas || []).map(t => {
                const pontos = parseFloat(t.pontos) || 0;
                const verbaTarefa = totalPontosPav > 0 ? (pontos / totalPontosPav) * p.valorVerba : 0;
                const sessoes = Array.isArray(t.sessoes_trabalho) ? t.sessoes_trabalho : [];
                const temHoras = sessoes.some(s => (parseFloat(s.duracao) || 0) > 0);
                const custoTarefa = temHoras ? calcularCustoRealTarefa(t, t.executor) : verbaTarefa;
                return { nome: t.nome, executor: t.executor, pontos: pontos,
                    horas: sessoes.reduce((s2, s) => s2 + (parseFloat(s.duracao) || 0), 0),
                    verba: verbaTarefa, custo: custoTarefa, saldo: verbaTarefa - custoTarefa };
            });
            const verbaPav = tarefasCalc.reduce((s, t) => s + t.verba, 0);
            const custoPav = tarefasCalc.reduce((s, t) => s + t.custo, 0);
            resultado.pavimentosDetalhamento.push({ nome: p.nome, verba: verbaPav, custo: custoPav, saldo: verbaPav - custoPav, tarefas: tarefasCalc });
            resultado.totalVerba += verbaPav;
            resultado.totalCusto += custoPav;
        });
    }

    // Demais Etapas — sem granularidade de Pavimento própria: entram
    // como um bloco só (verba da Etapa vs soma do custo real de TODAS
    // as tarefas-folha dentro dela; sem apontamento em lugar nenhum
    // dela, custo = verba).
    arv.etapas.forEach(etapa => {
        if (etapa === etapaDetalhamento) return;
        const infoVerba = verbasPorEtapa.find(v => v.nome === etapa.nome);
        const verbaEtapa = infoVerba ? infoVerba.verbaLiquida : 0;
        const folhas = coletarNosFolhaDaArvore([etapa]);
        let custoEtapa = 0;
        folhas.forEach(f => {
            custoEtapa += (typeof calcularCustoRealTarefa === 'function') ? calcularCustoRealTarefa(f.no, f.no.executor) : 0;
        });
        const custoFinal = custoEtapa > 0 ? custoEtapa : verbaEtapa;
        resultado.etapasSemDetalhe.push({ nome: etapa.nome, verba: verbaEtapa, custo: custoFinal, saldo: verbaEtapa - custoFinal });
        resultado.totalVerba += verbaEtapa;
        resultado.totalCusto += custoFinal;
    });

    resultado.totalSaldo = resultado.totalVerba - resultado.totalCusto;
    return resultado;
}

// --- 6) RESUMO FINANCEIRO (do Contrato até a Verba por Etapa) ---
function calcularResumoFinanceiroProjeto(nomeProjeto) {
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const orcamentosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    const orc = orcamentosSalvos[nomeProjeto] || {};
    const pctImpostos = parseFloat(orc.pct_impostos) || 0;
    const pctAnalista = parseFloat(orc.pct_analista) || 0;
    const pctSupervisor = parseFloat(orc.pct_supervisor) || 0;
    const pctEscritorio = parseFloat(orc.pct_escritorio) || 0;

    const valorImpostos = pctImpostos / 100 * valorContrato;
    const valorLiquido = valorContrato - valorImpostos;
    const valorAnalista = pctAnalista / 100 * valorLiquido;
    const valorSupervisor = pctSupervisor / 100 * valorLiquido;
    const valorEscritorio = pctEscritorio / 100 * valorLiquido;

    const etapas = (typeof calcularVerbaPorEtapaSalvo === 'function') ? calcularVerbaPorEtapaSalvo(nomeProjeto) : [];
    const totalVerbaEtapas = etapas.reduce((s, e) => s + e.verbaLiquida, 0);

    const salvosAnalista = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjetoAnalista = salvosAnalista[nomeProjeto] || {};
    const pctFundoGarantidor = parseFloat((salvoProjetoAnalista.fundo_garantidor || {}).pct) || 0;
    const valorFundoGarantidor = pctFundoGarantidor / 100 * valorAnalista;

    const dadosPavimentos = (typeof calcularListaPavimentosComVerbaSalva === 'function') ? calcularListaPavimentosComVerbaSalva(nomeProjeto) : null;
    const etapaDetalhamento = etapas.find(e => e.ehDetalhamento);

    return {
        valorContrato, pctImpostos, valorImpostos, valorLiquido,
        pctAnalista, valorAnalista, pctSupervisor, valorSupervisor, pctEscritorio, valorEscritorio,
        etapas, totalVerbaEtapas, pctFundoGarantidor, valorFundoGarantidor,
        verbaDetalhamentoBruta: etapaDetalhamento ? etapaDetalhamento.verbaLiquida : 0,
        pctFundoLucros: (typeof obterPctFundoLucrosPavimento === 'function') ? obterPctFundoLucrosPavimento(nomeProjeto) : 0,
        // calcularListaPavimentosComVerbaSalva() não devolve um total
        // pronto de Fundo de Lucros (só a variante "ao vivo" tem esse
        // campo) — soma a fatia por Pavimento (`.valorFundoLucros`,
        // essa sim sempre presente, calculada em listarPavimentosDoProjeto).
        valorFundoLucros: dadosPavimentos ? dadosPavimentos.pavimentos.reduce((s, p) => s + (p.valorFundoLucros || 0), 0) : 0,
        verbaLiquidaPavimentos: dadosPavimentos ? dadosPavimentos.verbaLiquida : 0,
        temEtapaDetalhamento: !!etapaDetalhamento
    };
}

// --- ORQUESTRADOR: junta tudo pra renderizarDesempenhoProjeto() ---
function calcularDesempenhoProjeto(nomeProjeto) {
    return {
        nomeProjeto: nomeProjeto,
        horasCusto: calcularHorasCustoProjeto(nomeProjeto),
        pctConcluido: calcularConclusaoProjeto(nomeProjeto),
        pavimentos: calcularHorasPorPavimentoProjeto(nomeProjeto),
        executores: calcularDesempenhoExecutoresProjeto(nomeProjeto),
        saldoPorTarefa: calcularSaldoPorTarefaProjeto(nomeProjeto),
        financeiro: calcularResumoFinanceiroProjeto(nomeProjeto)
    };
}

// Exporta pra Node (teste isolado, sem DOM) sem afetar o navegador —
// mesmo padrão usado em outros módulos deste app que têm lógica pura
// testável (ver prompt_gemini.md, regra "testar em Node isolado antes
// de mexer nos arquivos reais").
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularHorasCustoProjeto, calcularConclusaoProjeto, calcularHorasPorPavimentoProjeto,
        calcularDesempenhoExecutoresProjeto, calcularSaldoPorTarefaProjeto, calcularResumoFinanceiroProjeto,
        calcularDesempenhoProjeto
    };
}

// =========================================================================
// RENDERIZAÇÃO (DOM) — só roda no navegador
// =========================================================================

function carregarPainelDesempenho(nomeProjeto) {
    const area = document.getElementById('desemp-conteudo');
    if (!area) return;
    if (!nomeProjeto) { area.innerHTML = ''; return; }

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas) || arv.etapas.length === 0) {
        area.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:60px 20px;">Este projeto ainda não tem Etapas cadastradas na Árvore — sem estrutura, não há desempenho pra calcular.</div>';
        return;
    }

    const dados = calcularDesempenhoProjeto(nomeProjeto);
    area.innerHTML = renderizarDesempenhoProjeto(dados);
}

function renderizarDesempenhoProjeto(d) {
    const hc = d.horasCusto;
    const pctHoras = hc.horasPrevistas > 0 ? (hc.horasRealizadas / hc.horasPrevistas * 100) : 0;
    const seloHoras = pctHoras <= 110 ? 'good' : (pctHoras <= 200 ? 'warn' : 'bad');

    const fin = d.financeiro;
    const pctCustoVsVerba = fin.totalVerbaEtapas > 0 ? ((hc.custoRealTotal - fin.totalVerbaEtapas) / fin.totalVerbaEtapas * 100) : 0;

    const saldoProjeto = d.saldoPorTarefa.totalSaldo;
    const corSaldo = saldoProjeto >= 0 ? 'good' : 'bad';

    let html = '';

    // --- KPIs ---
    html += '<div class="desemp-grid-kpi">';
    html += kpiCard('Horas', hc.horasRealizadas.toFixed(1) + 'h', 'previsto: ' + hc.horasPrevistas.toFixed(1) + 'h', pctHoras <= 110 ? 'good' : (pctHoras <= 200 ? 'warn' : 'bad'), (pctHoras >= 100 ? '+' : '') + (pctHoras - 100).toFixed(0) + '% do previsto');
    html += kpiCard('Custo Real', formatarMoeda(hc.custoRealTotal), 'verba das etapas: ' + formatarMoeda(fin.totalVerbaEtapas), pctCustoVsVerba <= 0 ? 'good' : 'bad', (pctCustoVsVerba >= 0 ? '+' : '') + pctCustoVsVerba.toFixed(0) + '% vs verba');
    html += kpiCard('Conclusão', d.pctConcluido.toFixed(0) + '%', 'ponderado pela verba de cada Etapa', d.pctConcluido >= 99.5 ? 'good' : 'warn', d.pctConcluido >= 99.5 ? 'concluído' : 'em andamento');
    html += kpiCard('Saldo (verba − custo)', (saldoProjeto >= 0 ? '+' : '−') + ' ' + formatarMoeda(Math.abs(saldoProjeto)), 'saldo tarefa a tarefa (ver painel abaixo)', corSaldo, saldoProjeto >= 0 ? 'positivo' : 'negativo');
    html += '</div>';

    // --- Horas previsto x realizado por Pavimento ---
    if (d.pavimentos.length > 0) {
        const maiorValor = Math.max.apply(null, d.pavimentos.map(p => Math.max(p.previsto, p.realizado)).concat([1])) * 1.05;
        html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Horas previstas × realizadas, por Pavimento</p>';
        html += '<p class="desemp-painel-legenda">A marca vertical é o previsto (soma dos Pontos do Cadastro de Tarefas); a barra colorida é o realizado.</p>';
        d.pavimentos.forEach(p => {
            const pct = p.previsto > 0 ? (p.realizado / p.previsto * 100) : 0;
            const cor = pct <= 110 ? 'var(--desemp-good)' : (pct <= 200 ? 'var(--desemp-warn)' : 'var(--desemp-bad)');
            const widthPrevisto = Math.min(100, p.previsto / maiorValor * 100);
            const widthRealizado = Math.min(100, p.realizado / maiorValor * 100);
            html += '<div class="desemp-linha-pav">' +
                '<div class="desemp-nome-pav">' + escapeHtml(p.nome) + ' <span class="desemp-horas-real">(' + formatarNumero(p.realizado) + 'h)</span></div>' +
                '<div class="desemp-barras"><div class="desemp-marca-previsto" style="left:' + widthPrevisto.toFixed(1) + '%;" data-label="' + formatarNumero(p.previsto) + 'h"></div><div class="desemp-barra-realizado" style="width:' + widthRealizado.toFixed(1) + '%; background:' + cor + ';"></div></div>' +
                '<div class="desemp-pct-pav" style="color:' + cor + ';">' + pct.toFixed(0) + '%</div>' +
                '</div>';
        });
        html += '</div>';
    }

    // --- Desempenho por Executor ---
    if (d.executores.length > 0) {
        html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Desempenho por Executor</p>';
        html += '<p class="desemp-painel-legenda">Pontos = soma do Cadastro de Tarefas nas tarefas que cada um executou. Horas/Ponto mais baixo = mais eficiente; Pontos/Mês = ritmo de produção, do primeiro ao último lançamento de cada um.</p>';
        html += '<table class="desemp-tabela"><thead><tr><th>Executor</th><th>Pontos</th><th>Horas</th><th>Horas / Ponto</th><th>Pontos / Mês</th></tr></thead><tbody>';
        d.executores.forEach(e => {
            html += '<tr><td>' + escapeHtml(typeof nomeParaExibicao === 'function' ? nomeParaExibicao(e.nome) : e.nome) + '</td>' +
                '<td class="num">' + formatarNumero(e.pontos) + '</td>' +
                '<td class="num">' + formatarNumero(e.horas) + 'h</td>' +
                '<td class="num">' + e.horasPorPonto.toFixed(2) + '</td>' +
                '<td class="num">' + e.pontosPorMes.toFixed(2) + '</td></tr>';
        });
        html += '</tbody></table></div>';
    }

    // --- Saldo por Tarefa ---
    const sp = d.saldoPorTarefa;
    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Saldo por Tarefa <span class="desemp-tag">verba − custo real</span></p>';
    html += '<p class="desemp-painel-legenda">Regra: onde não há horas apontadas, custo = verba (saldo = 0) — não presume lucro nem prejuízo sem dado real de execução.</p>';
    if (sp.etapasSemDetalhe.length > 0) {
        html += '<table class="desemp-tabela"><thead><tr><th>Etapa</th><th>Verba</th><th>Custo</th><th>Saldo</th></tr></thead><tbody>';
        sp.etapasSemDetalhe.forEach(e => {
            html += '<tr><td>' + escapeHtml(e.nome) + '</td><td class="num">' + formatarMoeda(e.verba) + '</td><td class="num">' + formatarMoeda(e.custo) + '</td>' + saldoCell(e.saldo) + '</tr>';
        });
        html += '</tbody></table>';
    }
    // Cada Pavimento vem colapsado por padrão (só o subtotal aparece) —
    // pedido implícito pela realidade de projetos grandes (ex: AP
    // Praia tem 20 Pavimentos): uma tabela de tarefa a tarefa por
    // Pavimento, todas abertas ao mesmo tempo, vira uma parede de texto
    // difícil de escanear. Clique no cabeçalho abre/fecha.
    sp.pavimentosDetalhamento.forEach((p, idx) => {
        const idBloco = 'desemp-pav-tarefas-' + idx;
        html += '<div class="desemp-linha-pav-saldo" onclick="alternarBlocoDesempenho(\'' + idBloco + '\')">' +
            '<span class="desemp-seta-toggle" id="' + idBloco + '-seta">&#9654;</span>' +
            '<span class="desemp-nome-pav-saldo">Detalhamento &middot; ' + escapeHtml(p.nome) + ' <span class="desemp-tag">(' + p.tarefas.length + ' tarefas)</span></span>' +
            '<span class="num" style="min-width:110px;">' + formatarMoeda(p.verba) + '</span>' +
            '<span class="num" style="min-width:110px;">' + formatarMoeda(p.custo) + '</span>' +
            '<span class="num ' + (p.saldo >= 0 ? 'desemp-saldo-good' : 'desemp-saldo-bad') + '" style="min-width:120px;">' + (p.saldo >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(p.saldo)) + '</span>' +
            '</div>';
        html += '<div id="' + idBloco + '" style="display:none;">';
        html += '<table class="desemp-tabela"><thead><tr><th>Tarefa</th><th>Executor</th><th>Pontos</th><th>Horas</th><th>Verba</th><th>Custo</th><th>Saldo</th></tr></thead><tbody>';
        p.tarefas.slice().sort((a, b) => a.saldo - b.saldo).forEach(t => {
            html += '<tr><td>' + escapeHtml(t.nome) + '</td><td>' + escapeHtml(typeof nomeParaExibicao === 'function' ? nomeParaExibicao(t.executor) : (t.executor || '')) + '</td>' +
                '<td class="num">' + formatarNumero(t.pontos) + '</td><td class="num">' + formatarNumero(t.horas) + 'h</td>' +
                '<td class="num">' + formatarMoeda(t.verba) + '</td><td class="num">' + formatarMoeda(t.custo) + '</td>' + saldoCell(t.saldo) + '</tr>';
        });
        html += '</tbody></table></div>';
    });
    html += '<div class="desemp-linha-resultado desemp-' + corSaldo + '"><span>Resultado do Projeto (soma do saldo de todas as etapas/tarefas)</span><span>' + (saldoProjeto >= 0 ? '+ ' : '− ') + formatarMoeda(Math.abs(saldoProjeto)) + '</span></div>';
    html += '</div>';

    // --- Resumo financeiro ---
    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Resumo financeiro</p>';
    html += '<p class="desemp-painel-legenda">Do Valor do Contrato até a Verba de cada Etapa — mesmo caminho que a Distribuição de Custos já calcula, reunido numa foto só.</p>';
    html += '<div class="desemp-grid-financeiro"><div>';
    html += '<p class="desemp-bloco-titulo">Do contrato às parcelas</p>';
    html += finLinha('Valor do Contrato', formatarMoeda(fin.valorContrato));
    html += finLinha('Impostos (' + fin.pctImpostos.toFixed(0) + '%)', '&minus; ' + formatarMoeda(fin.valorImpostos), 'deducao');
    html += finLinha('Valor Líquido', formatarMoeda(fin.valorLiquido), 'subtotal');
    html += finLinha('Verba Global p/ Produção (' + fin.pctAnalista.toFixed(0) + '%)', formatarMoeda(fin.valorAnalista));
    html += finLinha('Parcela para Supervisão (' + fin.pctSupervisor.toFixed(0) + '%)', formatarMoeda(fin.valorSupervisor));
    html += finLinha('Parcela para Escritório (' + fin.pctEscritorio.toFixed(0) + '%)', formatarMoeda(fin.valorEscritorio));
    html += '</div><div>';
    html += '<p class="desemp-bloco-titulo">Verba líquida por Etapa</p>';
    html += '<table class="desemp-tabela"><thead><tr><th>Etapa</th><th>%</th><th>Verba</th></tr></thead><tbody>';
    fin.etapas.forEach(e => {
        html += '<tr' + (e.ehDetalhamento ? ' class="desemp-destaque"' : '') + '><td>' + escapeHtml(e.nome) + '</td><td class="num">' + e.pctEtapa.toFixed(1).replace('.0', '') + '%</td><td class="num">' + formatarMoeda(e.verbaLiquida) + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td>Total</td><td></td><td class="num">' + formatarMoeda(fin.totalVerbaEtapas) + '</td></tr>';
    html += '<tr><td>Fundo Garantidor (' + fin.pctFundoGarantidor.toFixed(0) + '%, fatia retida)</td><td></td><td class="num">' + formatarMoeda(fin.valorFundoGarantidor) + '</td></tr></tfoot>';
    html += '</table></div></div>';
    if (fin.temEtapaDetalhamento) {
        html += '<p class="desemp-bloco-titulo" style="margin-top:16px;">Detalhamento &rarr; Pavimentos</p>';
        html += '<div class="desemp-grid-financeiro"><div>';
        html += finLinha('Verba Detalhamento', formatarMoeda(fin.verbaDetalhamentoBruta));
        html += finLinha('Fundo Distribuição de Lucros (' + fin.pctFundoLucros.toFixed(0) + '%)', '&minus; ' + formatarMoeda(fin.valorFundoLucros), 'deducao');
        html += finLinha('Verba líquida p/ Pavimentos', formatarMoeda(fin.verbaLiquidaPavimentos), 'subtotal');
        html += '</div><div></div></div>';
    }
    html += '</div>';

    return html;
}

function alternarBlocoDesempenho(idBloco) {
    const bloco = document.getElementById(idBloco);
    const seta = document.getElementById(idBloco + '-seta');
    if (!bloco) return;
    const abrindo = bloco.style.display === 'none';
    bloco.style.display = abrindo ? 'block' : 'none';
    if (seta) seta.innerHTML = abrindo ? '&#9660;' : '&#9654;';
}

function kpiCard(rotulo, numero, comparativo, cor, selo) {
    return '<div class="desemp-kpi"><div class="desemp-kpi-rotulo">' + escapeHtml(rotulo) + '</div>' +
        '<div class="desemp-kpi-numero">' + numero + '</div>' +
        '<div class="desemp-kpi-comparativo">' + escapeHtml(comparativo) + '</div>' +
        '<span class="desemp-selo desemp-selo-' + cor + '">' + escapeHtml(selo) + '</span></div>';
}

function finLinha(rotulo, valor, classe) {
    return '<div class="desemp-linha-fin' + (classe ? ' desemp-' + classe : '') + '"><span>' + rotulo + '</span><span>' + valor + '</span></div>';
}

function saldoCell(saldo) {
    const cor = saldo >= 0 ? 'good' : 'bad';
    return '<td class="num desemp-saldo-' + cor + '">' + (saldo >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(saldo)) + '</td>';
}

function formatarNumero(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
