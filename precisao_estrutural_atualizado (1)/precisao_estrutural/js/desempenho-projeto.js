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
// Bug relatado pelo usuário: a soma da coluna Verba (e, pelo mesmo
// motivo, a de Custo) estava somando TODAS as etapas do projeto, não
// só Detalhamento — porque calcularLinhasFolhaComVerba() devolve as
// folhas do projeto INTEIRO (é usada também em telas de escopo maior),
// e esta era a ÚNICA das 5 chamadas dela neste arquivo que esquecia de
// filtrar `.pavimentoNome` (só folha de Pavimento, ou seja, dentro da
// Etapa Detalhamento, tem esse campo preenchido — as outras 4 chamadas,
// linhas ~313/432/521/829, já fazem esse filtro). Sem o filtro, "por
// Tarefa"/"por Executor" também vazavam tarefas de outras etapas pra
// dentro desta tela, que é (desde a reforma "DETALHAMENTO - ANÁLISE
// PRODUTIVIDADE") inteiramente sobre a Etapa Detalhamento.
function calcularTabelasDesempenho(nomeProjeto) {
    const linhas = calcularLinhasFolhaComVerba(nomeProjeto).filter(l => l.pavimentoNome);
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

    // Bloco 3 — "Verba de Fundos" (antes "Margem do Escritório"): Fundo
    // Garantidor + Fundo de Distribuição de Lucros, estruturalmente
    // retidos (nunca alocados a ninguém). Pedido do usuário: o Fundo
    // Garantidor passa a absorver o Desempenho do Pool de Detalhamento
    // (Custo Previsto − Custo Realizado) — sobrou verba (Desempenho
    // positivo)? soma ao Fundo Garantidor. Estourou (negativo)?
    // desconta dele. O Fundo de Distribuição de Lucros NÃO entra nessa
    // regra, fica como já era calculado.
    const fin = calcularResumoFinanceiroProjeto(nomeProjeto);
    const poolLucro = poolVerba - poolCusto;
    const valorFundoGarantidor = fin.valorFundoGarantidor + poolLucro;
    const valorFundoLucros = fin.valorFundoLucros;
    const margemEscritorio = valorFundoGarantidor + valorFundoLucros;

    const totalCusto = executores.reduce((s, e) => s + e.custo, 0);
    const totalBonificacao = executores.reduce((s, e) => s + e.bonificacao, 0);

    return {
        pctBonificacao: pctBonificacao,
        valorGlobalProducao: fin.valorAnalista,
        totalFixo: totalFixo,
        poolVerba: poolVerba, poolCusto: poolCusto, poolLucro: poolLucro,
        valorFundoGarantidor: valorFundoGarantidor, valorFundoLucros: valorFundoLucros,
        margemEscritorio: margemEscritorio,
        executores: executores.sort((a, b) => b.custo - a.custo),
        totalCusto: totalCusto, totalBonificacao: totalBonificacao
    };
}

// --- 8) DISTRIBUIÇÕES — 6ª orelha, pedido do usuário: "crie nova aba
// DISTRIBUIÇÕES com esse formato" (Artifact de referência, um
// relatório editorial de bonificação — masthead, tira de KPIs, barra
// segmentada dos 3 blocos da comissão, gráficos de barra divergente
// por técnico/pavimento/atividade, e nota de dados no rodapé). É o
// MESMO dado já calculado em calcularBonificacaoProjeto()/
// calcularTabelasDesempenho() — esta função só organiza pro layout
// novo, não recalcula nada.
function calcularMetaDistribuicoes(nomeProjeto) {
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto) || {};
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    const folhas = (arv && Array.isArray(arv.etapas)) ? coletarNosFolhaDaArvore(arv.etapas) : [];
    const datas = [];
    folhas.forEach(f => (f.no.sessoes_trabalho || []).forEach(s => { if (s.inicio) datas.push(s.inicio.slice(0, 10)); }));
    datas.sort();
    let periodo = '';
    if (datas.length > 0) {
        const inicio = datas[0], fim = datas[datas.length - 1];
        periodo = inicio.slice(0, 7).split('-').reverse().join('/') + (fim.slice(0, 4) !== inicio.slice(0, 4) ? '–' + fim.slice(0, 4) : '');
    }
    return { cliente: projeto.cliente || '', area: parseFloat(projeto.area) || 0, pavimentos: projeto.pavimentos || '', periodo: periodo };
}

function calcularDistribuicoesProjeto(nomeProjeto) {
    const meta = calcularMetaDistribuicoes(nomeProjeto);
    const bonif = calcularBonificacaoProjeto(nomeProjeto);
    const tab = calcularTabelasDesempenho(nomeProjeto);
    const pctConcluido = calcularConclusaoProjeto(nomeProjeto);
    const horasCusto = calcularHorasCustoProjeto(nomeProjeto);

    const poolExecutores = bonif.executores.filter(e => !e.fixo);
    const fixoExecutores = bonif.executores.filter(e => e.fixo);

    // Diagnóstico por atividade: se exatamente 1 executor do Pool
    // fechou negativo, foca só nas atividades DELE (mesmo espírito do
    // relatório de referência, "por que Daniel fechou negativo");
    // senão, agrega por atividade o Pool inteiro (mais de 1 negativo,
    // ou nenhum) — sempre pior primeiro.
    const negativos = poolExecutores.filter(e => e.lucro < 0);
    const diagExecutorNome = negativos.length === 1 ? negativos[0].nome : null;
    const linhasDetalhamento = calcularLinhasFolhaComVerba(nomeProjeto).filter(l => l.pavimentoNome && l.horas > 0);
    const linhasDiag = diagExecutorNome ? linhasDetalhamento.filter(l => l.executor === diagExecutorNome) : linhasDetalhamento;
    const diagPorAtividade = agruparLinhasDesempenho(linhasDiag, l => l.nome).sort((a, b) => a.lucro - b.lucro);

    const financeiro = calcularResumoFinanceiroProjeto(nomeProjeto);

    return { meta, bonif, tab, pctConcluido, horasCusto, poolExecutores, fixoExecutores, diagExecutorNome, diagPorAtividade, financeiro };
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
            const nomeEx = nomeExecutorExibicao(ex);
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
        obterPctBonificacao, salvarPctBonificacao, calcularBonificacaoProjeto,
        calcularMetaDistribuicoes, calcularDistribuicoesProjeto
    };
}

// =========================================================================
// RENDERIZAÇÃO (DOM) — só roda no navegador
// =========================================================================

// Estado da tabela única com filtro (pedido do usuário) — guarda o
// último `tab`/`pctBonificacao` calculados pra trocarDimensaoDesempenho()
// só re-renderizar a tabela na troca de filtro, sem recalcular tudo
// de novo nem perder o resto da tela.
let desempCacheFiltro = null;
const DESEMP_DIMENSOES = {
    porEtapa: { titulo: 'Por Etapa', tag: null },
    porPavimento: { titulo: 'Por Pavimento', tag: 'só Detalhamento tem essa granularidade' },
    porTarefa: { titulo: 'Por Tarefa', tag: 'atividade do Cadastro, somada em todos os pavimentos' },
    porExecutor: { titulo: 'Por Executor', tag: null }
};

function trocarDimensaoDesempenho() {
    const sel = document.getElementById('desemp-filtro-dimensao');
    const area = document.getElementById('desemp-tabela-filtravel');
    if (!sel || !area || !desempCacheFiltro) return;
    const dim = sel.value;
    const info = DESEMP_DIMENSOES[dim];
    area.innerHTML = tabelaDesempenho(info.titulo, dim, desempCacheFiltro.tab[dim], desempCacheFiltro.tab.totais, info.tag);
}

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
    html += kpiCard('BLOCO ANÁLISE', formatarMoeda(b.totalFixo), 'fases sem apontamento de horas', 'good', 'sem risco');
    html += kpiCardMultiplo('VERBA DETALHAMENTO', [
        { label: 'Custo Previsto', valor: formatarMoeda(b.poolVerba) },
        { label: 'Custo Realizado', valor: formatarMoeda(b.poolCusto) },
        { label: 'Desempenho', valor: (b.poolLucro >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(b.poolLucro)), cor: b.poolLucro >= 0 ? 'bom' : 'ruim' }
    ]);
    html += kpiCardMultiplo('Verba de Fundos', [
        { label: 'Fundo Garantidor', valor: formatarMoeda(b.valorFundoGarantidor) },
        { label: 'Fundo para Distribuição', valor: formatarMoeda(b.valorFundoLucros) }
    ]);
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
        const nomeExibicao = nomeExecutorExibicao(e.nome);
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

// =========================================================================
// 6ª ORELHA "DISTRIBUIÇÕES" — relatório editorial (ver calcularDistribuicoesProjeto)
// =========================================================================

function carregarPainelDistribuicoes(nomeProjeto) {
    const area = document.getElementById('distribuicoes-conteudo');
    if (!area) return;
    if (!nomeProjeto) { area.innerHTML = ''; return; }

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas) || arv.etapas.length === 0) {
        area.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:60px 20px;">Este projeto ainda não tem Etapas cadastradas na Árvore — sem estrutura, não há distribuição pra mostrar.</div>';
        return;
    }

    const dados = calcularDistribuicoesProjeto(nomeProjeto);
    area.innerHTML = renderizarDistribuicoesProjeto(nomeProjeto, dados);
}

// Barra divergente genérica: `linhas` = [{label, valor, meta?, emph?}].
// Larguras escaladas pelo maior |valor| do grupo (mesma régua pra
// todas as linhas do MESMO gráfico) — barra do maior vira 50% (toca a
// extremidade), as outras proporcionais. Cada linha pode ter uma
// `meta` (texto pequeno embaixo do rótulo, ex: "6 lançamentos · 166h").
// `formatarValor`, se informado, troca o formato do rótulo numérico
// (padrão: formatarMoeda, pra manter as 3 chamadas de Financeira
// intactas) — usado pelos gráficos de horas de Produtividade
// (retomada 2026-08-25, parte 42), que passam um formatador de horas
// em vez de R$. O resto do desenho (barra divergente, cor pos/neg) é
// igual pros dois casos — só a UNIDADE do número muda.
function distDivChart(linhas, formatarValor) {
    formatarValor = formatarValor || formatarMoeda;
    const maxAbs = Math.max.apply(null, linhas.map(l => Math.abs(l.valor)).concat([0.01]));
    let html = '<div class="dist-divchart">';
    linhas.forEach(l => {
        const pct = Math.min(50, Math.abs(l.valor) / maxAbs * 50);
        const pos = l.valor >= 0;
        html += '<div class="dist-divrow' + (l.emph ? ' emph' : '') + '">' +
            '<div class="dist-label">' + escapeHtml(l.label) + '</div>' +
            '<div class="dist-track"><div class="zero"></div><div class="bar ' + (pos ? 'pos' : 'neg') + '" style="width:' + pct.toFixed(2) + '%;"></div></div>' +
            '<div class="dist-value ' + (pos ? 'pos' : 'neg') + ' dist-num">' + (pos ? '+ ' : '&minus; ') + formatarValor(Math.abs(l.valor)) + '</div>' +
            '</div>';
        if (l.meta) html += '<div class="dist-divrow"><div class="dist-subrow-meta">' + l.meta + '</div><div></div><div></div></div>';
    });
    html += '</div>';
    return html;
}

// `rotulo`/`sub2` são textos fixos (com entidades HTML tipo &ccedil;
// já embutidas) escritos por nós, nunca dado do usuário — por isso
// NÃO passam por escapeHtml() aqui (escapar transformaria "&ccedil;"
// em "&amp;ccedil;", que o navegador mostra como texto literal em vez
// de "ç"). Dado dinâmico (nome de projeto/executor/atividade) é
// escapado no ponto onde é interpolado, antes de chegar aqui.
function distKpi(rotulo, valor, sub2, critical) {
    return '<div class="dist-kpi"><div class="dist-eyebrow">' + rotulo + '</div>' +
        '<div class="dist-val dist-num' + (critical ? ' critical' : '') + '">' + valor + '</div>' +
        '<div class="dist-sub2">' + sub2 + '</div></div>';
}

// Linha de "funil financeiro" (rótulo à esquerda, valor à direita) —
// substitui a antiga finLinha() (removida, ficou sem nenhum uso depois
// que "Resumo financeiro" saiu de Produtividade nesta mesma retomada),
// com a paleta .dist-* própria de Financeira em vez da antiga
// .desemp-linha-fin.
function distFinLinha(rotulo, valor, classe) {
    return '<div class="dist-finha' + (classe ? ' ' + classe : '') + '"><span>' + rotulo + '</span><span class="dist-num">' + valor + '</span></div>';
}

function renderizarDistribuicoesProjeto(nomeProjeto, d) {
    const meta = d.meta, bonif = d.bonif, fin = d.financeiro;
    const paletaCores = ['var(--dist-cat-1)', 'var(--dist-cat-2)', 'var(--dist-cat-3)'];

    const poolLucroTotal = bonif.poolLucro;
    const pctDesvioPool = bonif.poolVerba > 0 ? (bonif.poolCusto / bonif.poolVerba * 100 - 100) : 0;
    const foraTolerancia = Math.abs(pctDesvioPool) > 0.5;

    let html = '<div class="dist-page">';

    // --- Masthead ---
    html += '<div class="dist-masthead"><div class="dist-masthead-top"><div>';
    html += '<div class="dist-eyebrow">Relat&oacute;rio &middot; Detalhamento - An&aacute;lise Financeira</div>';
    html += '<h1>' + escapeHtml(nomeProjeto) + '</h1>';
    html += '<div class="dist-sub">' + (meta.cliente ? 'Cliente <b>' + escapeHtml(meta.cliente) + '</b> &middot; ' : '') +
        (meta.pavimentos ? escapeHtml(meta.pavimentos) + ' pavimentos, ' : '') + (meta.area ? formatarNumero(meta.area) + ' m&sup2;' : '') +
        ' &middot; Vers&atilde;o de fechamento <b>' + d.pctConcluido.toFixed(0) + '%</b></div>';
    html += '</div><div class="dist-meta-block">';
    html += '<div class="dist-meta-row"><span class="k">Horas apuradas</span><span class="v dist-num">' + formatarNumero(d.horasCusto.horasRealizadas) + ' h</span></div>';
    html += '<div class="dist-meta-row"><span class="k">Per&iacute;odo</span><span class="v dist-num">' + (meta.periodo ? escapeHtml(meta.periodo) : '&mdash;') + '</span></div>';
    html += '<div class="dist-meta-row"><span class="k">Detalhistas</span><span class="v">' + d.poolExecutores.map(e => escapeHtml(nomeExecutorExibicao(e.nome))).join(' &middot; ') + '</span></div>';
    html += '</div></div>';
    html += '<div class="dist-headline"><div class="dist-figure ' + (poolLucroTotal >= 0 ? 'good' : 'critical') + ' dist-num">' + (poolLucroTotal >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(poolLucroTotal)) + '</div>';
    html += '<div class="dist-caption">O custo real das ' + formatarNumero(d.horasCusto.horasRealizadas) + 'h de detalhamento (<b class="dist-num">' + formatarMoeda(bonif.poolCusto) + '</b>) ficou <b>' + Math.abs(pctDesvioPool).toFixed(1).replace('.', ',') + '% ' + (pctDesvioPool >= 0 ? 'acima' : 'abaixo') + '</b> do or&ccedil;amento (<b class="dist-num">' + formatarMoeda(bonif.poolVerba) + '</b>).</div></div>';
    html += '</div>';

    // --- Números do contrato ---
    html += '<div class="dist-section"><div class="dist-section-head"><h2>N&uacute;meros do contrato</h2></div>';
    html += '<div class="dist-kpis">';
    html += distKpi('Valor contratado (bruto)', formatarMoeda(fin.valorContrato), (meta.area ? formatarNumero(fin.valorContrato / meta.area) + ' /m&sup2;' : ''));
    html += distKpi('Verba Global p/ Produ&ccedil;&atilde;o', formatarMoeda(bonif.valorGlobalProducao), fin.pctAnalista.toFixed(0) + '% do valor l&iacute;quido');
    html += distKpi('Or&ccedil;amento Detalhamento', formatarMoeda(bonif.poolVerba), 'pool de horas de ' + d.poolExecutores.map(e => (nomeExecutorExibicao(e.nome)).split(' ')[0]).join(' + '));
    html += distKpi('Custo Real do Detalhamento', formatarMoeda(bonif.poolCusto), formatarNumero(d.horasCusto.horasRealizadas) + ' h executadas');
    html += distKpi('Desvio contra o or&ccedil;ado', (poolLucroTotal >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(poolLucroTotal)), (pctDesvioPool >= 0 ? 'estouro' : 'sobra') + ' de ' + Math.abs(pctDesvioPool).toFixed(1).replace('.', ',') + '%', poolLucroTotal < 0);
    html += '</div></div>';

    // --- Layout em 2 colunas (pedido do usuário, 2026-08-25: "na
    // coluna à esquerda todo o orçamento... na coluna à direita os
    // valores efetivamente realizados") — esquerda com o que é
    // planejamento/orçado (divisão da Verba Global + Resumo
    // financeiro); direita com os resultados de fato apurados
    // (Resultado por técnico/pavimento, Diagnóstico por atividade). ---
    html += '<div class="dist-layout-2col"><div class="dist-col-orcamento">';

    // --- Como a comissão é dividida ---
    const pctFixo = bonif.valorGlobalProducao > 0 ? bonif.totalFixo / bonif.valorGlobalProducao * 100 : 0;
    const pctPool = bonif.valorGlobalProducao > 0 ? bonif.poolVerba / bonif.valorGlobalProducao * 100 : 0;
    const pctMargem = bonif.valorGlobalProducao > 0 ? bonif.margemEscritorio / bonif.valorGlobalProducao * 100 : 0;
    html += '<div class="dist-section"><div class="dist-section-head"><h2>Como a Verba Global &eacute; dividida</h2><div class="dist-note">' + formatarMoeda(bonif.valorGlobalProducao) + ' em tr&ecirc;s blocos</div></div>';
    html += '<div class="dist-panel"><div class="dist-segbar">' +
        '<div class="dist-seg" style="width:' + pctFixo.toFixed(1) + '%; background:var(--dist-cat-1);"><span>Bloco Fixo &middot; ' + pctFixo.toFixed(0) + '%</span></div>' +
        '<div class="dist-seg" style="width:' + pctPool.toFixed(1) + '%; background:var(--dist-accent);"><span>Detalhamento &middot; ' + pctPool.toFixed(0) + '%</span></div>' +
        '<div class="dist-seg dist-seg-margem" style="width:' + pctMargem.toFixed(1) + '%;"><span>Margem &middot; ' + pctMargem.toFixed(0) + '%</span></div>' +
        '</div>';
    html += '<div class="dist-seg-legend">' +
        '<div class="item"><span class="swatch" style="background:var(--dist-cat-1);"></span>' + d.fixoExecutores.map(e => (nomeExecutorExibicao(e.nome))).join(', ') + ' (fases sem apontamento) &mdash; <span class="dist-num">' + formatarMoeda(bonif.totalFixo) + '</span> fixo</div>' +
        '<div class="item"><span class="swatch" style="background:var(--dist-accent);"></span>Pool de horas de ' + d.poolExecutores.map(e => (nomeExecutorExibicao(e.nome))).join(' + ') + ' &mdash; or&ccedil;ado <span class="dist-num">' + formatarMoeda(bonif.poolVerba) + '</span></div>' +
        '<div class="item"><span class="swatch" style="background:var(--dist-surface-2); border:1px solid var(--dist-border-strong);"></span>Margem do escrit&oacute;rio &mdash; <span class="dist-num">' + formatarMoeda(bonif.margemEscritorio) + '</span></div>' +
        '</div>';
    html += '<div class="dist-tolerance"><span class="tag' + (foraTolerancia ? '' : ' ok') + '">' + (foraTolerancia ? 'Fora da toler&acirc;ncia' : 'Dentro da toler&acirc;ncia') + '</span> o pool de detalhamento foi executado por <b class="dist-num">' + formatarMoeda(bonif.poolCusto) + '</b> &mdash; ' + formatarMoeda(Math.abs(poolLucroTotal)) + (poolLucroTotal >= 0 ? ' abaixo' : ' acima') + ' do que este bloco or&ccedil;ava.</div>';
    html += '</div></div>';

    // --- Resumo financeiro (retomada 2026-08-25, parte 42: movido de
    // Produtividade pra cá; parte 49: reposicionado aqui, na coluna
    // "orçamento" à esquerda — pedido do usuário: "na coluna à
    // esquerda todo o orçamento. Valor do contrato, impostos, valor
    // líquido, valor destinado para cada etapa, fundos, distribuição") ---
    html += '<div class="dist-section"><div class="dist-section-head"><h2>Resumo financeiro</h2><div class="dist-note">Do Valor do Contrato at&eacute; a Verba de cada Etapa</div></div>';
    html += '<div class="dist-panel"><div class="dist-fingrid"><div>';
    html += distFinLinha('Valor do Contrato', formatarMoeda(fin.valorContrato));
    html += distFinLinha('Impostos (' + fin.pctImpostos.toFixed(0) + '%)', '&minus; ' + formatarMoeda(fin.valorImpostos), 'deducao');
    html += distFinLinha('Valor L&iacute;quido', formatarMoeda(fin.valorLiquido), 'subtotal');
    html += distFinLinha('Verba Global p/ Produ&ccedil;&atilde;o (' + fin.pctAnalista.toFixed(0) + '%)', formatarMoeda(fin.valorAnalista));
    html += distFinLinha('Parcela para Supervis&atilde;o (' + fin.pctSupervisor.toFixed(0) + '%)', formatarMoeda(fin.valorSupervisor));
    html += distFinLinha('Parcela para Escrit&oacute;rio (' + fin.pctEscritorio.toFixed(0) + '%)', formatarMoeda(fin.valorEscritorio));
    html += '</div><div>';
    fin.etapas.forEach(e => {
        html += distFinLinha(escapeHtml(e.nome) + ' (' + e.pctEtapa.toFixed(1).replace('.0', '') + '%)', formatarMoeda(e.verbaLiquida), e.ehDetalhamento ? 'emph' : '');
    });
    html += distFinLinha('Total', formatarMoeda(fin.totalVerbaEtapas), 'subtotal');
    html += distFinLinha('Fundo Garantidor (' + fin.pctFundoGarantidor.toFixed(0) + '%, fatia retida)', formatarMoeda(fin.valorFundoGarantidor));
    html += '</div></div>';
    if (fin.temEtapaDetalhamento) {
        html += '<div class="dist-fingrid" style="margin-top:14px;"><div>';
        html += distFinLinha('Verba Detalhamento', formatarMoeda(fin.verbaDetalhamentoBruta));
        html += distFinLinha('Fundo Distribui&ccedil;&atilde;o de Lucros (' + fin.pctFundoLucros.toFixed(0) + '%)', '&minus; ' + formatarMoeda(fin.valorFundoLucros), 'deducao');
        html += distFinLinha('Verba l&iacute;quida p/ Pavimentos', formatarMoeda(fin.verbaLiquidaPavimentos), 'subtotal');
        html += '</div><div></div></div>';
    }
    html += '</div></div>';

    html += '</div><div class="dist-col-realizado">';

    // --- Resultado por técnico ---
    html += '<div class="dist-section"><div class="dist-section-head"><h2>Resultado por t&eacute;cnico</h2><div class="dist-note">custo executado &times; resultado (lucro/sobra)</div></div>';
    html += '<div class="dist-tech-row"><div class="dist-panel">';
    html += distDivChart(d.poolExecutores.map(e => ({
        label: nomeExecutorExibicao(e.nome),
        valor: e.lucro, emph: true,
        meta: 'custo ' + formatarMoeda(e.custo)
    })));
    html += '</div><div>';
    d.fixoExecutores.forEach((e, i) => {
        const nomeExibicao = nomeExecutorExibicao(e.nome);
        html += '<div class="dist-fixo-card"><div class="dist-name"><span class="dist-swatch-dot" style="background:' + paletaCores[i % paletaCores.length] + ';"></span>' + escapeHtml(nomeExibicao) + '</div>' +
            '<div class="dist-amount dist-num">' + formatarMoeda(e.custo) + '</div>' +
            '<div class="dist-desc">N&atilde;o entra nesta compara&ccedil;&atilde;o &mdash; recebe integralmente o valor das fases sem apontamento de horas, sem exposi&ccedil;&atilde;o a estouro ou sobra.</div></div>';
    });
    html += '</div></div>';
    if (d.poolExecutores.length > 1) {
        const pior = d.poolExecutores.slice().sort((a, b) => a.lucro - b.lucro)[0];
        html += '<div class="dist-callout' + (poolLucroTotal >= 0 ? ' good' : '') + '"><div class="dist-mark">&Delta;</div><p>Juntos, ' + d.poolExecutores.map(e => nomeExecutorExibicao(e.nome)).join(' e ') + ' fecham em <b>' + (poolLucroTotal >= 0 ? '+ ' : '&minus; ') + formatarMoeda(Math.abs(poolLucroTotal)) + '</b> &mdash; exatamente o ' + (poolLucroTotal >= 0 ? 'saldo' : 'estouro') + ' do pool de detalhamento.' +
            (pior.lucro < 0 ? ' A maior parte da perda do per&iacute;odo est&aacute; concentrada em ' + (nomeExecutorExibicao(pior.nome)) + '.' : '') + '</p></div>';
    }
    html += '</div>';

    // --- Resultado por pavimento ---
    if (d.tab.porPavimento.length > 0) {
        html += '<div class="dist-section"><div class="dist-section-head"><h2>Resultado por pavimento</h2><div class="dist-note">' + d.poolExecutores.map(e => nomeExecutorExibicao(e.nome)).join(' + ') + ' combinados</div></div>';
        html += '<div class="dist-panel">' + distDivChart(d.tab.porPavimento.map(p => ({ label: p.nome, valor: p.lucro }))) + '</div></div>';
    }

    // --- Diagnóstico por atividade ---
    if (d.diagPorAtividade.length > 0) {
        const nomeDiagExibicao = d.diagExecutorNome ? (nomeExecutorExibicao(d.diagExecutorNome)) : null;
        html += '<div class="dist-section"><div class="dist-section-head"><h2>Diagn&oacute;stico' + (nomeDiagExibicao ? ' &mdash; por que ' + escapeHtml(nomeDiagExibicao) + ' fechou negativo' : ' por atividade') + '</h2><div class="dist-note">resultado por atividade' + (nomeDiagExibicao ? '' : ', todos os pavimentos') + '</div></div>';
        html += '<div class="dist-panel">';
        const linhasFolha = calcularLinhasFolhaComVerba(nomeProjeto).filter(l => l.pavimentoNome && l.horas > 0 && (!d.diagExecutorNome || l.executor === d.diagExecutorNome));
        html += distDivChart(d.diagPorAtividade.map(a => {
            const instancias = linhasFolha.filter(l => l.nome === a.nome);
            const totalHoras = instancias.reduce((s, l) => s + l.horas, 0);
            const emph = a === d.diagPorAtividade[0] || a === d.diagPorAtividade[d.diagPorAtividade.length - 1];
            return { label: a.nome, valor: a.lucro, emph: emph, meta: instancias.length + ' lan&ccedil;amento' + (instancias.length === 1 ? '' : 's') + ' &middot; ' + formatarNumero(totalHoras) + ' h' };
        }));
        const pior = d.diagPorAtividade[0];
        if (pior && pior.lucro < 0) {
            const somaNegativos = d.diagPorAtividade.filter(a => a.lucro < 0).reduce((s, a) => s + a.lucro, 0);
            const dominante = somaNegativos < 0 && Math.abs(pior.lucro) >= Math.abs(somaNegativos) * 0.6;
            html += '<div class="dist-callout"><div class="dist-mark">!</div><p><b>' + escapeHtml(pior.nome) + ' sozinho (' + formatarMoeda(pior.lucro) + ')</b>' + (dominante ? ' concentra a maior parte do resultado negativo' + (nomeDiagExibicao ? ' de ' + escapeHtml(nomeDiagExibicao) : '') + '.' : ' &eacute; a atividade com o pior resultado' + (nomeDiagExibicao ? ' de ' + escapeHtml(nomeDiagExibicao) : '') + '.') +
                ' Vale revisar se os Pontos dessa atividade est&atilde;o bem dimensionados no Cadastro de Tarefas, ou se o ritmo de execu&ccedil;&atilde;o nela est&aacute; abaixo da meta.</p></div>';
        }
        html += '</div></div>';
    }

    html += '</div></div>'; // fecha .dist-col-realizado e .dist-layout-2col

    // --- Nota de dados ---
    html += '<div class="dist-datanote"><span class="tag">Nota de dados</span><div>' +
        '<p>Todos os valores acima vêm dos mesmos c&aacute;lculos j&aacute; usados nas orelhas Desempenho e Bonifica&ccedil;&atilde;o deste projeto &mdash; "Horas Previsto" segue a conven&ccedil;&atilde;o de Pontos do Cadastro de Tarefas (n&atilde;o &aacute;rea &times; produtividade).</p>' +
        '</div></div>';

    html += '</div>';
    return html;
}

function renderizarDesempenhoProjeto(d) {
    const hc = d.horasCusto;
    const fin = d.financeiro;
    const tab = d.tabelas;

    // Pedido do usuário: os 4 cartões do topo passaram a falar
    // especificamente da Etapa Detalhamento (não do projeto inteiro) —
    // acha a linha dela em "Por Etapa" (já filtrada/agrupada) pra
    // Horas Consumidas e Saldo de Horas; Verba/Custo do Detalhamento
    // usam fin.verbaDetalhamentoBruta (a verba designada à Etapa,
    // mesma fonte da tabela "Verba líquida por Etapa" mais abaixo).
    const etapaDet = tab.porEtapa.find(e => e.nome.toLowerCase().includes('detalhamento'));
    const horasPrevistoDet = etapaDet ? etapaDet.previsto : hc.horasPrevistas;
    const horasRealizadoDet = etapaDet ? etapaDet.realizado : hc.horasRealizadas;
    const custoDetalhamento = etapaDet ? etapaDet.custo : hc.custoRealTotal;
    const verbaDetalhamento = fin.verbaDetalhamentoBruta;
    const pctHoras = horasPrevistoDet > 0 ? (horasRealizadoDet / horasPrevistoDet * 100) : 0;
    const pctCustoVsVerbaDet = verbaDetalhamento > 0 ? ((custoDetalhamento - verbaDetalhamento) / verbaDetalhamento * 100) : 0;
    // "Saldo" = o que sobra do orçado (mesmo sentido de Saldo de
    // Verba = Verba − Custo): Previsto − Realizado, positivo = horas
    // sobrando (bom), negativo = estourou o previsto (ruim).
    const saldoHorasDet = horasPrevistoDet - horasRealizadoDet;
    const saldoVerbaDet = verbaDetalhamento - custoDetalhamento;

    let html = '';

    // --- Layout em 2 colunas (pedido do usuário, 2026-08-25, revisado
    // de novo: "os quadros com os desvios de hora devem ficar todos na
    // coluna da esquerda, abaixo dos campos horas consumidas, %
    // concluída e saldo de horas") — coluna esquerda com os 3 KPIs +
    // os 3 gráficos de "Desvio de horas", todos empilhados; coluna
    // direita só com as 2 tabelas de Desempenho. ---
    html += '<div class="desemp-layout-2col"><div class="desemp-col-kpis">';

    // --- KPIs (retomada 2026-08-25, parte 42: separar Produtividade/
    // Financeiro — pedido do usuário: "informações sobre desempenho
    // medido por horas, índices de produtividade, etc" ficam aqui;
    // dinheiro (CUSTO DO DETALHAMENTO, Saldo de Verba) foi pra
    // Financeira, ver renderizarDistribuicoesProjeto()) ---
    html += '<div class="desemp-grid-kpi">';
    html += kpiCard('Horas Consumidas', horasRealizadoDet.toFixed(1) + 'h', 'previsto: ' + horasPrevistoDet.toFixed(1) + 'h', pctHoras <= 110 ? 'good' : (pctHoras <= 200 ? 'warn' : 'bad'), (pctHoras >= 100 ? '+' : '') + (pctHoras - 100).toFixed(0) + '% do previsto');
    html += kpiCard('% CONCLUÍDA', d.pctConcluido.toFixed(0) + '%', 'ponderado pela verba de cada Etapa', d.pctConcluido >= 99.5 ? 'good' : 'warn', d.pctConcluido >= 99.5 ? 'concluído' : 'em andamento');
    // Nota: o 3º argumento (comparativo) passa por escapeHtml() dentro
    // de kpiCard() — usar a entidade HTML "&minus;" aqui quebraria (o
    // "&" viraria "&amp;", mostrando o texto cru "&minus;" na tela, em
    // vez do sinal de menos). Caractere Unicode "−" direto sobrevive à
    // escapagem sem problema.
    html += kpiCard('SALDO DE HORAS', (saldoHorasDet >= 0 ? '+' : '&minus;') + ' ' + formatarNumero(Math.abs(saldoHorasDet)) + 'h', 'previsto ' + formatarNumero(horasPrevistoDet) + 'h − realizado ' + formatarNumero(horasRealizadoDet) + 'h', saldoHorasDet >= 0 ? 'good' : 'bad', saldoHorasDet >= 0 ? 'sobrando' : 'estourado');
    html += '</div>';

    // --- Gráficos de desvio de horas (pedido do usuário: "use
    // gráficos considerando as horas... usando como referência os
    // gráficos que estão na orelha Financeira") — mesmo componente
    // `distDivChart()` que Financeira usa pra lucro/resultado em R$
    // (Resultado por técnico/pavimento/atividade), só que alimentado
    // com Saldo de Horas (Previsto − Realizado, positivo = sobrando/
    // bom, negativo = estourado/ruim — mesma convenção de "Saldo" já
    // usada no KPI acima) em vez de lucro, e formatado em horas em vez
    // de R$ (`formatarValor` novo parâmetro de distDivChart()). Pior
    // caso (maior estouro) primeiro, como o "Diagnóstico por
    // atividade" de Financeira já faz. Ficam na coluna esquerda,
    // abaixo dos KPIs (pedido do usuário). ---
    const formatarHorasChart = v => formatarNumero(v) + ' h';
    function graficoDesvioHoras(titulo, nota, linhas) {
        if (linhas.length === 0) return '';
        const ordenadas = linhas.slice().sort((a, b) => (a.previsto - a.realizado) - (b.previsto - b.realizado));
        const itens = ordenadas.map((l, i) => ({
            label: (l.chave === 'porExecutor') ? nomeExecutorExibicao(l.nome) : l.nome,
            valor: l.previsto - l.realizado,
            emph: i === 0 || i === ordenadas.length - 1,
            // Pedido do usuário: previsto/realizado em 2 linhas, com o
            // número de horas alinhado numa coluna (ver .dist-metaduo
            // no CSS) — 1 linha só ("previsto Xh · realizado Yh") ficava
            // apertada demais na coluna de meia página.
            meta: '<div class="dist-metaduo"><span>previsto</span><span>' + formatarNumero(l.previsto) + ' h</span><span>realizado</span><span>' + formatarNumero(l.realizado) + ' h</span></div>'
        }));
        return '<div class="dist-section"><div class="dist-section-head"><h2>' + titulo + '</h2><div class="dist-note">' + nota + '</div></div>' +
            '<div class="dist-panel">' + distDivChart(itens, formatarHorasChart) + '</div></div>';
    }
    html += graficoDesvioHoras('Desvio de horas por Executor', 'previsto &minus; realizado, por pessoa', tab.porExecutor.map(l => Object.assign({ chave: 'porExecutor' }, l)));
    html += graficoDesvioHoras('Desvio de horas por Pavimento', 'previsto &minus; realizado, por pavimento', tab.porPavimento);
    html += graficoDesvioHoras('Desvio de horas por Tarefa', 'previsto &minus; realizado, por atividade do Cadastro', tab.porTarefa);

    html += '</div><div class="desemp-col-conteudo">';

    // --- Tabela única com filtro de dimensão (pedido do usuário: 1
    // tabela só, com filtro suficiente pra ver os dados agrupados como
    // quem estiver manipulando quiser, em vez de 4 tabelas fixas) ---
    desempCacheFiltro = { tab: tab };
    html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Desempenho <span class="desemp-tag">previsto &times; realizado &times; índice &times; desvio</span></p>';
    html += '<p class="desemp-painel-legenda">Previsto = soma dos Pontos do Cadastro de Tarefas. Índice = Realizado &divide; Previsto. Linhas sem nenhuma hora realizada não entram na lista. Na linha TOTAL, "Horas Previsto" mostra o % de horas já consumidas.</p>';
    html += '<div class="desemp-filtro-linha"><label for="desemp-filtro-dimensao">Agrupar por:</label>' +
        '<select id="desemp-filtro-dimensao" onchange="trocarDimensaoDesempenho()">' +
        '<option value="porEtapa">Etapa</option>' +
        '<option value="porPavimento">Pavimento</option>' +
        '<option value="porTarefa" selected>Tarefa</option>' +
        '<option value="porExecutor">Executor</option>' +
        '</select></div>';
    html += '<div id="desemp-tabela-filtravel">' + tabelaDesempenho('Por Tarefa', 'porTarefa', tab.porTarefa, tab.totais, DESEMP_DIMENSOES.porTarefa.tag) + '</div>';
    html += '</div>';

    // --- Desempenho por Executor (produtividade) ---
    if (d.executores.length > 0) {
        html += '<div class="desemp-painel"><p class="desemp-painel-titulo">Desempenho por Executor <span class="desemp-tag">produtividade</span></p>';
        html += '<p class="desemp-painel-legenda">Pontos = soma do Cadastro de Tarefas nas tarefas que cada um executou. Horas/Ponto mais baixo = mais eficiente; Pontos/Mês = ritmo de produção, do primeiro ao último lançamento de cada um.</p>';
        html += '<table class="desemp-tabela"><thead><tr><th>Executor</th><th>Pontos</th><th>Horas</th><th>Horas / Ponto</th><th>Pontos / Mês</th></tr></thead><tbody>';
        d.executores.forEach(e => {
            html += '<tr><td>' + escapeHtml(nomeExecutorExibicao(e.nome)) + '</td>' +
                '<td class="num">' + formatarNumero(e.pontos) + '</td>' +
                '<td class="num">' + formatarNumero(e.horas) + 'h</td>' +
                '<td class="num">' + e.horasPorPonto.toFixed(2) + '</td>' +
                '<td class="num">' + e.pontosPorMes.toFixed(2) + '</td></tr>';
        });
        html += '</tbody></table></div>';
    }

    html += '</div></div>'; // fecha .desemp-col-conteudo e .desemp-layout-2col

    return html;
}

// Uma das 4 tabelas (Por Etapa/Pavimento/Tarefa/Executor) — mesmo
// formato pras 4, só muda o rótulo da 1ª coluna e as linhas.
// Retomada 2026-08-25 (parte 42, separar Produtividade/Financeiro):
// esta tabela só existe dentro da orelha Produtividade — perdeu as
// colunas Verba/Custo/Bonificação (dinheiro), que não fazem mais
// sentido aqui (pedido do usuário: "Previsto/Realizado/Índice/Desvio,
// com relação às horas e não aos custos/verbas"). Antes tinha um
// parâmetro `pctBonificacao` opcional pra uma 8ª coluna só na tabela
// "Por Executor" — removido junto (só existia pra alimentar a coluna
// de dinheiro que saiu).
function tabelaDesempenho(titulo, chave, linhas, totais, tag) {
    if (linhas.length === 0) return '';
    const indiceTotal = totais.previsto > 0 ? (totais.realizado / totais.previsto * 100) : 0;
    const desvioTotal = totais.realizado - totais.previsto;

    let html = '<p class="desemp-subtitulo-bloco">' + escapeHtml(titulo) + (tag ? ' <span class="desemp-tag">' + escapeHtml(tag) + '</span>' : '') + '</p>';
    html += '<table class="desemp-tabela desemp-tabela-moldura"><thead><tr><th>' + escapeHtml(titulo.replace('Por ', '')) + '</th><th>Horas Previsto</th><th>Horas Realizado</th><th>Índice</th><th>Desvio (h)</th></tr></thead><tbody>';
    linhas.forEach(l => {
        const indice = l.previsto > 0 ? (l.realizado / l.previsto * 100) : 0;
        const desvio = l.realizado - l.previsto;
        const nomeExibicao = (chave === 'porExecutor' && typeof nomeParaExibicao === 'function') ? nomeParaExibicao(l.nome) : l.nome;
        html += '<tr><td>' + escapeHtml(nomeExibicao) + '</td>' +
            '<td class="num">' + formatarNumero(l.previsto) + ' h</td>' +
            '<td class="num">' + formatarNumero(l.realizado) + ' h</td>' +
            '<td class="num">' + indice.toFixed(1).replace('.', ',') + '%</td>' +
            '<td class="num ' + (desvio >= 0 ? 'desemp-desvio-ruim' : 'desemp-desvio-bom') + '">' + (desvio >= 0 ? '+' : '&minus;') + formatarNumero(Math.abs(desvio)) + ' h</td>' +
            '</tr>';
    });
    html += '</tbody><tfoot><tr><td>TOTAL</td>' +
        '<td class="num">' + indiceTotal.toFixed(1).replace('.', ',') + '% consumido</td>' +
        '<td class="num">' + formatarNumero(totais.realizado) + ' h</td>' +
        '<td class="num">' + indiceTotal.toFixed(1).replace('.', ',') + '%</td>' +
        '<td class="num">' + (desvioTotal >= 0 ? '+' : '&minus;') + formatarNumero(Math.abs(desvioTotal)) + ' h</td>' +
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

// Cartão de KPI com vários valores empilhados (rótulo + valor cada) em
// vez de um número só + comparativo — usado onde um cartão precisa
// mostrar 2-3 grandezas relacionadas (ex: "Resultado da Etapa" =
// Saldo de Horas + Saldo de Verba; "VERBA DETALHAMENTO" = Custo
// Previsto + Custo Realizado + Desempenho). `itens` = [{label, valor,
// cor?}], `cor` é 'bom'/'ruim' (reaproveita as classes
// desemp-desvio-bom/ruim já existentes) ou omitido pra cor neutra.
function kpiCardMultiplo(rotulo, itens) {
    let html = '<div class="desemp-kpi"><div class="desemp-kpi-rotulo">' + escapeHtml(rotulo) + '</div>';
    itens.forEach(it => {
        html += '<div class="desemp-kpi-item"><span class="desemp-kpi-item-label">' + escapeHtml(it.label) + '</span>' +
            '<span class="desemp-kpi-item-valor' + (it.cor ? ' desemp-desvio-' + it.cor : '') + '">' + it.valor + '</span></div>';
    });
    html += '</div>';
    return html;
}

function formatarNumero(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mesma ideia de nomeParaExibicao() (core.js), mas blindada contra o
// placeholder "(sem executor)" que calcularBonificacaoProjeto() usa
// pra folhas fora do Detalhamento sem ninguém atribuído — passar esse
// placeholder pro fallback de nomeParaExibicao (primeiro token do
// nome, separado por espaço) cortava ele pra "(sem", que é confuso.
function nomeExecutorExibicao(nome) {
    if (!nome || nome === '(sem executor)') return 'Sem executor';
    return typeof nomeParaExibicao === 'function' ? nomeParaExibicao(nome) : nome;
}

function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
