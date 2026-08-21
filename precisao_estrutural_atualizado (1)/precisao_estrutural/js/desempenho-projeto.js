// =========================================================================
// MÓDULO: ORELHA "DESEMPENHO" DO PROJETO — 3ª orelha, ao lado de
// "Estrutura de Projeto" e "Custos" (pedido original do usuário: "uma
// nova orelha da aba projetos... horas previstas x horas realizadas,
// custo previsto x custo real, % de conclusão e Saldo da verba").
//
// Reforma de 2026-08-20: modelo de tabela trazido pelo usuário de outra
// conversa (prompt colado no chat + planilha de referência
// "HOME_GARDEN_SETOR_C_com_Desempenho.xlsx", aba "Desempenho") —
// 4 tabelas (Por Etapa/Pavimento/Tarefa/Executor), todas com as MESMAS
// 7 colunas: [Dimensão] | Horas Previsto | Horas Realizado | Índice
// (Real/Prev) | Desvio (h) | Verba (R$) | Custo Real (R$). Regras:
// linha sem hora realizada não aparece; na linha TOTAL, a célula
// "Horas Previsto" mostra o % de horas já consumidas (Realizado ÷
// Previsto) e a célula "Custo Real" mostra o % da verba já consumida
// (Custo ÷ Verba) — as demais células do TOTAL somam normalmente.
// Cores/bordas replicam a planilha de referência (cabeçalho
// #0A192F/branco, linha TOTAL com fundo cinza, moldura "medium" no
// contorno da tabela, "thin" entre células, desvio positivo em
// verde-azulado e negativo em vermelho-terracota).
//
// Convenção "Horas Previstas = Pontos" (mesma do Relatório de Custos,
// relatorios.js) — mantida; a planilha de referência usa uma fórmula
// diferente (área do pavimento × produtividade por atividade), mas o
// usuário pediu só pra copiar cores/apresentação, não a fonte do dado.
//
// Regra "custo = verba onde não há apontamento" (pedido anterior do
// usuário) agora vive dentro de calcularLinhasFolhaComVerba(): toda
// folha da árvore recebe uma fatia de Verba (ponderada pelos Pontos
// dela dentro do pai que tem Verba própria — Pavimento pra quem está
// na Etapa "Detalhamento", a própria Etapa pras demais), e uma
// folha sem hora nenhuma simplesmente não aparece em nenhuma das 4
// tabelas (filtro "sem horas, não lista"), então o caso "custo=verba"
// não precisa mais de tratamento especial — a linha só some.
// =========================================================================

// --- 1) HORAS / CUSTO REAL DO PROJETO INTEIRO (KPIs do topo) ---
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

// --- 3) LINHAS-FOLHA COM VERBA/CUSTO — base única das 4 tabelas ---
// Cada folha da árvore vira 1 registro {nome, executor, pontos, horas,
// verba, custo, etapaNome, pavimentoNome}. Verba de cada folha é a
// fatia dela (ponderada por Pontos) dentro do "pai com verba própria":
// Pavimento, pra quem está dentro da Etapa "Detalhamento" (mesma
// cascata que listarPavimentosDoProjeto/distribuicao-custos.js já usa
// pra Distribuição de Custos e Distribuição de Lucro — só ela tem essa
// granularidade, regra de negócio já existente); a própria Etapa, pras
// demais (generalização do mesmo princípio — ponderação por Pontos
// entre as folhas de uma Etapa sem Pavimento).
//
// Regra do usuário (pedido anterior): "nas tarefas onde as horas não
// estão apontadas considere que o custo seja igual à verba" — sem
// horas, `custo` já sai igual a `verba` aqui na origem (não só na
// tabela renderizada), pra que TOTAIS somados a partir de `linhas`
// (ex: Resultado do Projeto) não fiquem inconsistentes contando a
// verba de uma folha sem contar o "custo presumido" dela.
function calcularLinhasFolhaComVerba(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas)) return [];

    const verbasPorEtapa = (typeof calcularVerbaPorEtapaSalvo === 'function') ? calcularVerbaPorEtapaSalvo(nomeProjeto) : [];
    const etapaDetalhamento = arv.etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));
    const linhas = [];

    if (etapaDetalhamento && typeof calcularListaPavimentosComVerbaSalva === 'function') {
        const pavimentos = calcularListaPavimentosComVerbaSalva(nomeProjeto).pavimentos;
        pavimentos.forEach(p => {
            const totalPontosPav = (p.tarefas || []).reduce((s, t) => s + (parseFloat(t.pontos) || 0), 0);
            (p.tarefas || []).forEach(t => {
                const pontos = parseFloat(t.pontos) || 0;
                const verba = totalPontosPav > 0 ? (pontos / totalPontosPav) * p.valorVerba : 0;
                const sessoes = Array.isArray(t.sessoes_trabalho) ? t.sessoes_trabalho : [];
                const horas = sessoes.reduce((s2, s) => s2 + (parseFloat(s.duracao) || 0), 0);
                const custo = horas > 0 ? ((typeof calcularCustoRealTarefa === 'function') ? calcularCustoRealTarefa(t, t.executor) : 0) : verba;
                linhas.push({ nome: t.nome, executor: t.executor, pontos: pontos, horas: horas, verba: verba, custo: custo, etapaNome: etapaDetalhamento.nome, pavimentoNome: p.nome });
            });
        });
    }

    arv.etapas.forEach(etapa => {
        if (etapa === etapaDetalhamento) return;
        const infoVerba = verbasPorEtapa.find(v => v.nome === etapa.nome);
        const verbaEtapa = infoVerba ? infoVerba.verbaLiquida : 0;
        const folhas = coletarNosFolhaDaArvore([etapa]);
        const totalPontosEtapa = folhas.reduce((s, f) => s + (parseFloat(f.no.pontos) || 0), 0);
        folhas.forEach(f => {
            const pontos = parseFloat(f.no.pontos) || 0;
            const verba = totalPontosEtapa > 0 ? (pontos / totalPontosEtapa) * verbaEtapa : (folhas.length === 1 ? verbaEtapa : 0);
            const sessoes = Array.isArray(f.no.sessoes_trabalho) ? f.no.sessoes_trabalho : [];
            const horas = sessoes.reduce((s2, s) => s2 + (parseFloat(s.duracao) || 0), 0);
            const custo = horas > 0 ? ((typeof calcularCustoRealTarefa === 'function') ? calcularCustoRealTarefa(f.no, f.no.executor) : 0) : verba;
            linhas.push({ nome: f.no.nome, executor: f.no.executor, pontos: pontos, horas: horas, verba: verba, custo: custo, etapaNome: etapa.nome, pavimentoNome: null });
        });
    });

    return linhas;
}

// Agrupa as linhas-folha por uma chave (nome da Etapa/Pavimento/Tarefa/
// Executor), soma Previsto/Realizado/Verba/Custo, e tira quem não tem
// nenhuma hora realizada (pedido do usuário: "não listar" essas).
function agruparLinhasDesempenho(linhas, chaveFn) {
    const grupos = {};
    const ordem = [];
    linhas.forEach(l => {
        const chave = chaveFn(l);
        if (!chave) return;
        if (!grupos[chave]) { grupos[chave] = { nome: chave, previsto: 0, realizado: 0, verba: 0, custo: 0 }; ordem.push(chave); }
        grupos[chave].previsto += l.pontos;
        grupos[chave].realizado += l.horas;
        grupos[chave].verba += l.verba;
        grupos[chave].custo += l.custo;
    });
    return ordem.map(c => grupos[c]).filter(g => g.realizado > 0).map(g => Object.assign(g, { lucro: g.verba - g.custo }));
}

// --- 4) MONTAGEM DAS 4 TABELAS + TOTAL (mesmo pro todas as 4 — é o
// mesmo conjunto de folhas, só agrupado diferente) ---
function calcularTabelasDesempenho(nomeProjeto) {
    const linhas = calcularLinhasFolhaComVerba(nomeProjeto);
    const totais = linhas.reduce((t, l) => ({
        previsto: t.previsto + l.pontos, realizado: t.realizado + l.horas,
        verba: t.verba + l.verba, custo: t.custo + l.custo
    }), { previsto: 0, realizado: 0, verba: 0, custo: 0 });

    return {
        porEtapa: agruparLinhasDesempenho(linhas, l => l.etapaNome),
        porPavimento: agruparLinhasDesempenho(linhas, l => l.pavimentoNome),
        porTarefa: agruparLinhasDesempenho(linhas, l => l.nome).sort((a, b) => {
            const ia = a.previsto > 0 ? a.realizado / a.previsto : 0, ib = b.previsto > 0 ? b.realizado / b.previsto : 0;
            return ib - ia;
        }),
        porExecutor: agruparLinhasDesempenho(linhas, l => l.executor),
        totais: totais
    };
}

// --- 5) DESEMPENHO POR EXECUTOR (produtividade — Pontos/Horas/Ponto,
// tabela separada da de cima; pedido em rodada anterior, mantida) ---
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

// --- 7) BONIFICAÇÃO — 5ª orelha, pedido do usuário: "documento de
// referência" trazido de outra conversa (planilha "...com_Desempenho_v4.xlsx"
// + resumo em markdown), com o modelo de bonificação do detalhamento
// estrutural. Conceito novo, não confundir com "Distribuição de Lucro
// (Estagiários)" (js/distribuicao-lucro.js) — aquela reparte por
// Pontos entre estagiários o Fundo de 5%; esta calcula, por Etapa/
// Pavimento/Executor, o Lucro/Sobra (Verba − Custo Real) e uma
// Bonificação = Lucro/Sobra × % Bonificação (pode dar negativo).
//
// "Horas Previsto" continua Pontos (decisão do usuário — não migrar
// pra área×produtividade só por causa deste documento).
//
// Comissão do escritório (Verba Global p/ Produção, calcularResumoFinanceiroProjeto)
// se divide em 3 blocos, conforme o documento de referência:
// 1. Bloco Fixo — Etapas fora do Detalhamento (Pré-Lançamento/
//    Lançamento/Análise/Cargas, tipicamente): recebem o valor cheio da
//    própria Verba, sem comparação Previsto×Realizado (mesma regra
//    "sem hora, custo=verba" já usada em calcularLinhasFolhaComVerba —
//    aqui aparecem mesmo sem hora nenhuma, ao contrário das 4 tabelas
//    de Desempenho).
// 2. Pool de Horas de Detalhamento — Verba líquida que cascateia pra
//    Pavimento/Tarefa (calcularListaPavimentosComVerbaSalva) — é onde
//    a Bonificação por desempenho realmente acontece.
// 3. Margem do Escritório — Fundo Garantidor + Fundo de Distribuição
//    de Lucros: fatias estruturalmente retidas, nunca alocadas a
//    ninguém (nem ao Bloco Fixo, nem ao Pool).
function obterPctBonificacao(nomeProjeto) {
    const salvos = JSON.parse(localStorage.getItem('banco_pct_bonificacao')) || {};
    const salvo = salvos[nomeProjeto];
    return (salvo && salvo.pct !== undefined && salvo.pct !== '') ? (parseFloat(salvo.pct) || 0) : 100;
}

function salvarPctBonificacao(nomeProjeto, pct) {
    const salvos = JSON.parse(localStorage.getItem('banco_pct_bonificacao')) || {};
    salvos[nomeProjeto] = { pct: String(pct) };
    localStorage.setItem('banco_pct_bonificacao', JSON.stringify(salvos));
}

function calcularBonificacaoProjeto(nomeProjeto) {
    const pctBonificacao = obterPctBonificacao(nomeProjeto);
    const linhas = calcularLinhasFolhaComVerba(nomeProjeto);

    // Bloco 1 — Fixo: linhas fora do Detalhamento (pavimentoNome nulo),
    // agrupadas por executor, SEM o filtro "sem hora, não lista" (aqui
    // elas aparecem mesmo sem hora nenhuma — é assim que recebem).
    const fixoPorExecutor = {};
    const ordemFixo = [];
    linhas.filter(l => !l.pavimentoNome).forEach(l => {
        const ex = l.executor || '(sem executor)';
        if (!fixoPorExecutor[ex]) { fixoPorExecutor[ex] = 0; ordemFixo.push(ex); }
        fixoPorExecutor[ex] += l.verba; // verba === custo aqui (regra "sem hora, custo=verba")
    });
    const totalFixo = ordemFixo.reduce((s, ex) => s + fixoPorExecutor[ex], 0);

    // Bloco 2 — Pool de Horas de Detalhamento: linhas com Pavimento.
    const linhasDetalhamento = linhas.filter(l => l.pavimentoNome);
    const poolVerba = linhasDetalhamento.reduce((s, l) => s + l.verba, 0);
    const poolCusto = linhasDetalhamento.reduce((s, l) => s + l.custo, 0);

    const detalhamentoPorExecutor = {};
    const ordemDetalhamento = [];
    linhasDetalhamento.forEach(l => {
        const ex = l.executor || '(sem executor)';
        if (!detalhamentoPorExecutor[ex]) { detalhamentoPorExecutor[ex] = { verba: 0, custo: 0 }; ordemDetalhamento.push(ex); }
        detalhamentoPorExecutor[ex].verba += l.verba;
        detalhamentoPorExecutor[ex].custo += l.custo;
    });

    const executores = [];
    ordemDetalhamento.forEach(ex => {
        const d = detalhamentoPorExecutor[ex];
        const lucro = d.verba - d.custo;
        executores.push({ nome: ex, fixo: false, verba: d.verba, custo: d.custo, lucro: lucro, bonificacao: lucro * pctBonificacao / 100 });
    });
    ordemFixo.forEach(ex => {
        // Alguém que já aparece no Bloco 2 (pool) e também tem uma
        // parte fixa entraria 2x — não é o caso hoje (Igor só tem
        // Bloco Fixo, Daniel/Andrey só têm Pool), mas soma junto se
        // acontecer no futuro em vez de duplicar a linha.
        const existente = executores.find(e => e.nome === ex);
        if (existente) {
            existente.verba += fixoPorExecutor[ex]; existente.custo += fixoPorExecutor[ex]; existente.fixo = true;
            existente.bonificacao += fixoPorExecutor[ex];
        } else {
            executores.push({ nome: ex, fixo: true, verba: fixoPorExecutor[ex], custo: fixoPorExecutor[ex], lucro: 0, bonificacao: fixoPorExecutor[ex] });
        }
    });

    // Bloco 3 — Margem do Escritório: retido, nunca alocado a ninguém.
    const fin = calcularResumoFinanceiroProjeto(nomeProjeto);
    const margemEscritorio = fin.valorFundoGarantidor + fin.valorFundoLucros;

    const totalCusto = executores.reduce((s, e) => s + e.custo, 0);
    const totalBonificacao = executores.reduce((s, e) => s + e.bonificacao, 0);

    return {
        pctBonificacao: pctBonificacao,
        valorGlobalProducao: fin.valorAnalista,
        totalFixo: totalFixo,
        poolVerba: poolVerba, poolCusto: poolCusto, poolLucro: poolVerba - poolCusto,
        margemEscritorio: margemEscritorio,
        executores: executores.sort((a, b) => b.custo - a.custo),
        totalCusto: totalCusto, totalBonificacao: totalBonificacao
    };
}

// --- ORQUESTRADOR ---
function calcularDesempenhoProjeto(nomeProjeto) {
    return {
        nomeProjeto: nomeProjeto,
        horasCusto: calcularHorasCustoProjeto(nomeProjeto),
        pctConcluido: calcularConclusaoProjeto(nomeProjeto),
        tabelas: calcularTabelasDesempenho(nomeProjeto),
        executores: calcularDesempenhoExecutoresProjeto(nomeProjeto),
        financeiro: calcularResumoFinanceiroProjeto(nomeProjeto)
    };
}

// --- 7) DIAGNÓSTICO — leituras automáticas em cima das mesmas 4
// tabelas (4ª orelha, painel próprio). Limiares (150%/60%/etc.) são só
// pontos de corte pra destacar o que já está calculado acima — não
// inventam nenhum dado novo.
function calcularDiagnosticoProjeto(nomeProjeto) {
    const t = calcularTabelasDesempenho(nomeProjeto);
    const achados = [];

    const comIndice = arr => arr.map(g => Object.assign({}, g, { indice: g.previsto > 0 ? g.realizado / g.previsto * 100 : 0 }));
    const tarefas = comIndice(t.porTarefa);
    const pavimentos = comIndice(t.porPavimento);
    const executores = comIndice(t.porExecutor);
    const etapas = comIndice(t.porEtapa);

    const subestimadas = tarefas.filter(x => x.indice >= 150).sort((a, b) => b.indice - a.indice);
    if (subestimadas.length > 0) {
        achados.push({ severidade: 'ruim', icone: '🔴', texto: 'Atividades sistematicamente subestimadas (Índice ≥ 150%): ' +
            subestimadas.slice(0, 5).map(x => x.nome + ' (' + x.indice.toFixed(1).replace('.', ',') + '%)').join(', ') +
            '. Vale revisar os Pontos dessas atividades no Cadastro de Tarefas.' });
    }

    const superestimadas = tarefas.filter(x => x.indice > 0 && x.indice <= 60).sort((a, b) => a.indice - b.indice);
    if (superestimadas.length > 0) {
        achados.push({ severidade: 'bom', icone: '🟢', texto: 'Atividades superestimadas (Índice ≤ 60%): ' +
            superestimadas.slice(0, 5).map(x => x.nome + ' (' + x.indice.toFixed(1).replace('.', ',') + '%)').join(', ') +
            '. Os Pontos cadastrados pra elas estão bem acima do que a execução real vem consumindo.' });
    }

    if (pavimentos.length > 0) {
        const piorPav = pavimentos.slice().sort((a, b) => Math.abs(b.realizado - b.previsto) - Math.abs(a.realizado - a.previsto))[0];
        if (Math.abs(piorPav.realizado - piorPav.previsto) > 0) {
            const desvio = piorPav.realizado - piorPav.previsto;
            achados.push({ severidade: desvio >= 0 ? 'ruim' : 'bom', icone: desvio >= 0 ? '🔴' : '🟢',
                texto: piorPav.nome + ' é o Pavimento com o maior desvio absoluto (' + (desvio >= 0 ? '+' : '') + desvio.toFixed(2).replace('.', ',') + 'h, Índice de ' + piorPav.indice.toFixed(1).replace('.', ',') + '%).' });
        }
    }

    if (executores.length >= 2) {
        const ordenados = executores.slice().sort((a, b) => b.indice - a.indice);
        const maior = ordenados[0], menor = ordenados[ordenados.length - 1];
        if (maior.indice - menor.indice >= 50) {
            achados.push({ severidade: 'info', icone: '🔵', texto: 'Grande disparidade de aderência ao previsto entre os executores: ' +
                maior.nome + ' tem Índice de ' + maior.indice.toFixed(1).replace('.', ',') + '% contra ' + menor.indice.toFixed(1).replace('.', ',') + '% de ' + menor.nome + '.' });
        }
    }

    etapas.filter(e => e.verba > 0 && e.custo / e.verba > 1).forEach(e => {
        const pct = e.custo / e.verba * 100;
        achados.push({ severidade: 'ruim', icone: '🔴', texto: 'A Etapa ' + e.nome + ' já gastou ' + pct.toFixed(1).replace('.', ',') + '% da verba disponível (Custo Real ' +
            formatarMoeda(e.custo) + ' contra Verba ' + formatarMoeda(e.verba) + ') — ' + formatarMoeda(e.custo - e.verba) + ' de estouro.' });
    });

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    const totalEtapasArvore = (arv && Array.isArray(arv.etapas)) ? arv.etapas.length : 0;
    if (totalEtapasArvore > 0 && t.porEtapa.length > 0 && t.porEtapa.length < totalEtapasArvore) {
        achados.push({ severidade: 'info', icone: '🔵', texto: 'A tabela "Por Etapa" mostra ' + t.porEtapa.length + ' de ' + totalEtapasArvore +
            ' Etapas cadastradas — as demais nunca tiveram hora apontada, então somem pela regra "sem hora, não lista".' });
    }

    // Achado do documento de referência de Bonificação (2026-08-20):
    // "a atividade DT_Vigas sozinha é o maior fator do resultado
    // negativo do Daniel — quase 4× o déficit final". Generalizado:
    // pra cada executor com Lucro/Sobra negativo no Pool de
    // Detalhamento, acha a linha (Pavimento×Tarefa) individual mais
    // negativa dele e avisa se ela sozinha já é maior (em módulo) que
    // o déficit final do executor — indica que UMA tarefa concentra o
    // prejuízo, não um padrão espalhado.
    const linhasDetalhamento = calcularLinhasFolhaComVerba(nomeProjeto).filter(l => l.pavimentoNome && l.horas > 0);
    const porExecutorLinhas = {};
    linhasDetalhamento.forEach(l => {
        const ex = l.executor || '(sem executor)';
        if (!porExecutorLinhas[ex]) porExecutorLinhas[ex] = [];
        porExecutorLinhas[ex].push(l);
    });
    Object.keys(porExecutorLinhas).forEach(ex => {
        const linhasEx = porExecutorLinhas[ex];
        const lucroTotalEx = linhasEx.reduce((s, l) => s + (l.verba - l.custo), 0);
        if (lucroTotalEx >= 0) return; // só interessa quando o executor fechou no vermelho
        const pior = linhasEx.slice().sort((a, b) => (a.verba - a.custo) - (b.verba - b.custo))[0];
        const lucroPior = pior.verba - pior.custo;
        if (lucroPior < 0 && Math.abs(lucroPior) >= Math.abs(lucroTotalEx)) {
            const nomeEx = typeof nomeParaExibicao === 'function' ? nomeParaExibicao(ex) : ex;
            achados.push({ severidade: 'ruim', icone: '🔴', texto: pior.pavimentoNome + ' · ' + pior.nome + ' (' + nomeEx + ') concentra sozinha o déficit de ' + nomeEx +
                ': ' + formatarMoeda(Math.abs(lucroPior)) + ' de prejuízo nessa única tarefa, contra ' + formatarMoeda(Math.abs(lucroTotalEx)) + ' de déficit total dele — não é um padrão espalhado, é essa tarefa específica.' });
        }
    });

    return achados;
}

// Exporta pra Node (teste isolado, sem DOM) sem afetar o navegador —
// mesmo padrão usado em outros módulos deste app que têm lógica pura
// testável (ver prompt_gemini.md, regra "testar em Node isolado antes
// de mexer nos arquivos reais").
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularHorasCustoProjeto, calcularConclusaoProjeto, calcularLinhasFolhaComVerba,
        agruparLinhasDesempenho, calcularTabelasDesempenho, calcularDesempenhoExecutoresProjeto,
        calcularResumoFinanceiroProjeto, calcularDesempenhoProjeto, calcularDiagnosticoProjeto,
        obterPctBonificacao, salvarPctBonificacao, calcularBonificacaoProjeto
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

function carregarPainelDiagnostico(nomeProjeto) {
    const area = document.getElementById('diagnostico-conteudo');
    if (!area) return;
    if (!nomeProjeto) { area.innerHTML = ''; return; }

    const achados = calcularDiagnosticoProjeto(nomeProjeto);
    if (achados.length === 0) {
        area.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:60px 20px;">Nenhum ponto fora do esperado encontrado ainda — ou o projeto não tem hora apontada o suficiente pra gerar leituras.</div>';
        return;
    }
    area.innerHTML = achados.map(a => diagnosticoCard(a)).join('');
}

function diagnosticoCard(a) {
    return '<div class="diag-card diag-' + a.severidade + '"><span>' + a.icone + '</span><div>' + escapeHtml(a.texto) + '</div></div>';
}

function carregarPainelBonificacao(nomeProjeto) {
    const area = document.getElementById('bonificacao-conteudo');
    if (!area) return;
    if (!nomeProjeto) { area.innerHTML = ''; return; }

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas) || arv.etapas.length === 0) {
        area.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:60px 20px;">Este projeto ainda não tem Etapas cadastradas na Árvore — sem estrutura, não há bonificação pra calcular.</div>';
        return;
    }

    const dados = calcularBonificacaoProjeto(nomeProjeto);
    area.innerHTML = renderizarBonificacaoProjeto(dados);
}

function salvarPctBonificacaoTela() {
    const nome = projetoSelecionadoAtivo || (document.getElementById('dc-projeto') ? document.getElementById('dc-projeto').value : '');
    if (!nome) return;
    const input = document.getElementById('bonif-pct-input');
    salvarPctBonificacao(nome, input.value);
    carregarPainelBonificacao(nome);
}

function renderizarBonificacaoProjeto(b) {
    let html = '';

    html += '<div class="desemp-grid-kpi">';
    html += kpiCard('Bloco Fixo', formatarMoeda(b.totalFixo), 'fases sem apontamento de horas', 'good', 'sem risco');
    html += kpiCard('Pool de Horas de Detalhamento', formatarMoeda(b.poolVerba), 'custo real: ' + formatarMoeda(b.poolCusto), b.poolLucro >= 0 ? 'good' : 'bad', b.poolLucro >= 0 ? '+' : '−');
    html += kpiCard('Margem do Escritório', formatarMoeda(b.margemEscritorio), 'Fundo Garantidor + Fundo de Lucros, retido', 'good', 'não alocado');
    html += kpiCard('Bonificação Total', (b.totalBonificacao >= 0 ? '+' : '−') + ' ' + formatarMoeda(Math.abs(b.totalBonificacao)), obterFormatoPct(b.pctBonificacao) + '% do Lucro/Sobra', b.totalBonificacao >= 0 ? 'good' : 'bad', b.totalBonificacao >= 0 ? 'positiva' : 'negativa');
    html += '</div>';

    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">% Bonificação sobre o Lucro/Sobra</p>';
    html += '<p class="desemp-painel-legenda">Bonificação = (Verba − Custo Real) × esta %. Pode dar negativo quando o custo real supera a verba disponível.</p>';
    html += '<div style="display:flex; align-items:center; gap:10px;">' +
        '<input type="number" id="bonif-pct-input" value="' + obterFormatoPct(b.pctBonificacao) + '" style="width:100px; padding:8px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px;"> %' +
        '<button type="button" onclick="salvarPctBonificacaoTela()" style="background:#00b4d8; color:white; border:none; padding:8px 16px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">Salvar</button>' +
        '</div></div>';

    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Bonificação por Executor <span class="desemp-tag">Bloco Fixo + Pool de Detalhamento</span></p>';
    html += '<p class="desemp-painel-legenda">Quem só tem Bloco Fixo (fases sem apontamento) recebe o valor cheio, sem risco. Quem trabalha no Pool de Detalhamento tem Bonificação = Lucro/Sobra × % acima — pode ficar negativa.</p>';
    html += '<table class="desemp-tabela desemp-tabela-moldura"><thead><tr><th>Executor</th><th>Origem</th><th>Custo Real (R$)</th><th>Lucro/Sobra (R$)</th><th>Bonificação (R$)</th></tr></thead><tbody>';
    b.executores.forEach(e => {
        const nomeExibicao = typeof nomeParaExibicao === 'function' ? nomeParaExibicao(e.nome) : e.nome;
        html += '<tr><td>' + escapeHtml(nomeExibicao) + '</td>' +
            '<td>' + (e.fixo ? 'Bloco Fixo' : 'Pool de Detalhamento') + '</td>' +
            '<td class="num">' + formatarMoeda(e.custo) + '</td>' +
            '<td class="num ' + (e.fixo ? '' : (e.lucro >= 0 ? 'desemp-desvio-bom' : 'desemp-desvio-ruim')) + '">' + (e.fixo ? '&mdash;' : ((e.lucro >= 0 ? '+' : '&minus;') + formatarMoeda(Math.abs(e.lucro)))) + '</td>' +
            '<td class="num ' + (e.bonificacao >= 0 ? 'desemp-desvio-bom' : 'desemp-desvio-ruim') + '">' + (e.bonificacao >= 0 ? '+' : '&minus;') + formatarMoeda(Math.abs(e.bonificacao)) + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td>TOTAL</td><td></td><td class="num">' + formatarMoeda(b.totalCusto) + '</td><td></td>' +
        '<td class="num">' + (b.totalBonificacao >= 0 ? '+' : '&minus;') + formatarMoeda(Math.abs(b.totalBonificacao)) + '</td></tr></tfoot>';
    html += '</table></div>';

    return html;
}

function obterFormatoPct(v) {
    return (v || 0).toFixed(v % 1 === 0 ? 0 : 1).replace('.', ',');
}

function renderizarDesempenhoProjeto(d) {
    const hc = d.horasCusto;
    const pctHoras = hc.horasPrevistas > 0 ? (hc.horasRealizadas / hc.horasPrevistas * 100) : 0;

    const fin = d.financeiro;
    const pctCustoVsVerba = fin.totalVerbaEtapas > 0 ? ((hc.custoRealTotal - fin.totalVerbaEtapas) / fin.totalVerbaEtapas * 100) : 0;

    const tab = d.tabelas;
    const saldoProjeto = tab.totais.verba - tab.totais.custo;
    const corSaldo = saldoProjeto >= 0 ? 'good' : 'bad';

    let html = '';

    // --- KPIs ---
    html += '<div class="desemp-grid-kpi">';
    html += kpiCard('Horas', hc.horasRealizadas.toFixed(1) + 'h', 'previsto: ' + hc.horasPrevistas.toFixed(1) + 'h', pctHoras <= 110 ? 'good' : (pctHoras <= 200 ? 'warn' : 'bad'), (pctHoras >= 100 ? '+' : '') + (pctHoras - 100).toFixed(0) + '% do previsto');
    html += kpiCard('Custo Real', formatarMoeda(hc.custoRealTotal), 'verba das etapas: ' + formatarMoeda(fin.totalVerbaEtapas), pctCustoVsVerba <= 0 ? 'good' : 'bad', (pctCustoVsVerba >= 0 ? '+' : '') + pctCustoVsVerba.toFixed(0) + '% vs verba');
    html += kpiCard('Conclusão', d.pctConcluido.toFixed(0) + '%', 'ponderado pela verba de cada Etapa', d.pctConcluido >= 99.5 ? 'good' : 'warn', d.pctConcluido >= 99.5 ? 'concluído' : 'em andamento');
    html += kpiCard('Resultado do Projeto', (saldoProjeto >= 0 ? '+' : '−') + ' ' + formatarMoeda(Math.abs(saldoProjeto)), 'verba − custo real, tarefa a tarefa', corSaldo, saldoProjeto >= 0 ? 'positivo' : 'negativo');
    html += '</div>';

    // --- Tabelas unificadas Por Etapa / Pavimento / Tarefa / Executor ---
    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Desempenho <span class="desemp-tag">previsto &times; realizado &times; índice &times; desvio &times; verba &times; custo real</span></p>';
    html += '<p class="desemp-painel-legenda">Previsto = soma dos Pontos do Cadastro de Tarefas. Índice = Realizado &divide; Previsto. Linhas sem nenhuma hora realizada não entram na lista. Na linha TOTAL, "Horas Previsto" mostra o % de horas já consumidas e "Custo Real" mostra o % da verba já consumida.</p>';
    const pctBonificacao = obterPctBonificacao(d.nomeProjeto);
    html += tabelaDesempenho('Por Etapa', 'porEtapa', tab.porEtapa, tab.totais);
    html += tabelaDesempenho('Por Pavimento', 'porPavimento', tab.porPavimento, tab.totais, 'só Detalhamento tem essa granularidade');
    html += tabelaDesempenho('Por Tarefa', 'porTarefa', tab.porTarefa, tab.totais, 'atividade do Cadastro, somada em todos os pavimentos');
    html += tabelaDesempenho('Por Executor', 'porExecutor', tab.porExecutor, tab.totais, null, pctBonificacao);
    html += '</div>';

    // --- Desempenho por Executor (produtividade) ---
    if (d.executores.length > 0) {
        html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Desempenho por Executor <span class="desemp-tag">produtividade</span></p>';
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

// Uma das 4 tabelas (Por Etapa/Pavimento/Tarefa/Executor) — mesmo
// formato pras 4, só muda o rótulo da 1ª coluna e as linhas.
// `pctBonificacao`, se informado, acrescenta uma 8ª coluna "Bonificação
// (R$)" no fim (só usada na tabela "Por Executor" — documento de
// referência de Bonificação, 2026-08-20).
function tabelaDesempenho(titulo, chave, linhas, totais, tag, pctBonificacao) {
    if (linhas.length === 0) return '';
    const indiceTotal = totais.previsto > 0 ? (totais.realizado / totais.previsto * 100) : 0;
    const pctVerbaTotal = totais.verba > 0 ? (totais.custo / totais.verba * 100) : 0;
    const desvioTotal = totais.realizado - totais.previsto;
    const comBonificacao = pctBonificacao !== undefined && pctBonificacao !== null;

    let html = '<p class="desemp-subtitulo-bloco">' + escapeHtml(titulo) + (tag ? ' <span class="desemp-tag">' + escapeHtml(tag) + '</span>' : '') + '</p>';
    html += '<table class="desemp-tabela desemp-tabela-moldura"><thead><tr><th>' + escapeHtml(titulo.replace('Por ', '')) + '</th><th>Horas Previsto</th><th>Horas Realizado</th><th>Índice</th><th>Desvio (h)</th><th>Verba (R$)</th><th>Custo Real (R$)</th>' + (comBonificacao ? '<th>Bonificação (R$)</th>' : '') + '</tr></thead><tbody>';
    linhas.forEach(l => {
        const indice = l.previsto > 0 ? (l.realizado / l.previsto * 100) : 0;
        const desvio = l.realizado - l.previsto;
        const nomeExibicao = (chave === 'porExecutor' && typeof nomeParaExibicao === 'function') ? nomeParaExibicao(l.nome) : l.nome;
        const bonificacao = comBonificacao ? l.lucro * pctBonificacao / 100 : 0;
        html += '<tr><td>' + escapeHtml(nomeExibicao) + '</td>' +
            '<td class="num">' + formatarNumero(l.previsto) + ' h</td>' +
            '<td class="num">' + formatarNumero(l.realizado) + ' h</td>' +
            '<td class="num">' + indice.toFixed(1).replace('.', ',') + '%</td>' +
            '<td class="num ' + (desvio >= 0 ? 'desemp-desvio-ruim' : 'desemp-desvio-bom') + '">' + (desvio >= 0 ? '+' : '&minus;') + formatarNumero(Math.abs(desvio)) + ' h</td>' +
            '<td class="num">' + formatarMoeda(l.verba) + '</td>' +
            '<td class="num">' + formatarMoeda(l.custo) + '</td>' +
            (comBonificacao ? '<td class="num ' + (bonificacao >= 0 ? 'desemp-desvio-bom' : 'desemp-desvio-ruim') + '">' + (bonificacao >= 0 ? '+' : '&minus;') + formatarMoeda(Math.abs(bonificacao)) + '</td>' : '') +
            '</tr>';
    });
    const bonificacaoTotal = comBonificacao ? linhas.reduce((s, l) => s + l.lucro, 0) * pctBonificacao / 100 : 0;
    html += '</tbody><tfoot><tr><td>TOTAL</td>' +
        '<td class="num">' + indiceTotal.toFixed(1).replace('.', ',') + '% consumido</td>' +
        '<td class="num">' + formatarNumero(totais.realizado) + ' h</td>' +
        '<td class="num">' + indiceTotal.toFixed(1).replace('.', ',') + '%</td>' +
        '<td class="num">' + (desvioTotal >= 0 ? '+' : '&minus;') + formatarNumero(Math.abs(desvioTotal)) + ' h</td>' +
        '<td class="num">' + formatarMoeda(totais.verba) + '</td>' +
        '<td class="num">' + pctVerbaTotal.toFixed(1).replace('.', ',') + '% da verba</td>' +
        (comBonificacao ? '<td class="num">' + (bonificacaoTotal >= 0 ? '+' : '&minus;') + formatarMoeda(Math.abs(bonificacaoTotal)) + '</td>' : '') +
        '</tr></tfoot>';
    html += '</table>';
    return html;
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

function formatarNumero(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
