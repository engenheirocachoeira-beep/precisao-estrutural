// =========================================================================
// MÓDULO: RELATÓRIOS
//
// Motor GENÉRICO (não uma lista fixa de relatórios): o usuário escolhe um
// NÍVEL (Sessão de Trabalho / Tarefa), aplica FILTROS, escolhe quais
// COLUNAS ver e, opcionalmente, AGRUPA por um campo. Combinações podem
// ser salvas como "Visões" (banco_relatorios_visoes, COMPARTILHADO entre
// todo mundo que acessa a tela — decisão explícita do usuário, não é por
// usuário). As "visões de fábrica" são os 7 relatórios pensados
// originalmente (ver prompt_gemini.md §11), pré-cadastrados nesse motor.
//
// Dois protótipos HTML foram testados com o usuário ANTES de escrever
// este arquivo (mockup_relatorios.html — versão com lista fixa de 7
// relatórios, descartada — e mockup_relatorios_v2_flexivel.html —
// versão com filtro/colunas/agrupar/visões salvas, aprovada). A segunda
// versão inspirada no conceito de "Visões" do sistema Artia (pesquisado
// a pedido do usuário).
//
// NÍVEL "Sessão de Trabalho": uma linha por sessão de trabalho
// (tarefa.sessoes_trabalho[i]) — pra relatórios de Custo/Horas por
// período, já que cada sessão é custeada pelo valor da hora VIGENTE
// NA DATA DELA (valorHoraVigente(), feriados.js) — uma tarefa que
// atravessa um reajuste salarial tem sessões com valores diferentes.
//
// NÍVEL "Tarefa": uma linha por tarefa inteira — pra Previsto×Realizado,
// Desvio, Atraso, Pontos. "Horas Previstas" usa a MESMA fórmula já usada
// na Calibração BI (ver arvore.js, verificação de is_outlier):
//   horas_previstas = base_h (catálogo) × qtd_fisica × peso_esforco
//                      (do pavimento) × f_esb × f_analista (do projeto)
// "Custo Real" da tarefa reaproveita calcularCustoRealTarefa()
// (apontamento.js), já existente (construída pro índice de produtividade,
// ainda não usada em nenhuma tela até este módulo).
//
// Filtro de período: nível Sessão usa a DATA DA SESSÃO; nível Tarefa usa
// a DATA DE INÍCIO REAL (primeira sessão) — pedido explícito do usuário:
// "relacionar as tarefas iniciadas" no intervalo, mesmo que continuem
// depois do "até" (não precisa ter terminado dentro do período).
// =========================================================================

// --- CAMADA DE DADOS ---
// Funções puras, testáveis sem DOM (ver
// /home/claude/testes/teste_relatorios_camada_dados.js).

function calcularHorasPrevistasTarefa(tarefa, pavimento, arv) {
    const tarefasLego = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
    const tCat = tarefasLego.find(t => t.nome === tarefa.nome);
    const baseH = tCat ? (parseFloat(tCat.base_h) || 2.0) : 2.0;
    const qtdFisica = parseFloat(tarefa.qtd_fisica) || 1;
    const pesoPav = parseFloat(pavimento.peso_esforco) || 1;
    const fEsb = parseFloat(arv.f_esb) || 1;
    const fAnalista = parseFloat(arv.f_analista) || 1;
    return baseH * qtdFisica * pesoPav * fEsb * fAnalista;
}

// Uma linha por SESSÃO DE TRABALHO, de todos os projetos/executores.
// `caminho` no mesmo formato usado em todo o resto do projeto
// (`nomeProjeto|fIdx-eIdx-sIdx-tIdx`), útil pra rastrear de volta à
// tarefa de origem se algum dia precisar.
function coletarLinhasSessaoTrabalho() {
    // Item 5/6/7 (prompt_gemini.md §14, leva 4): usa a versão filtrada
    // (só projetos que ainda existem no Cadastro), não a bruta — sem
    // isso, sessões de trabalho de projetos já deletados/renomeados no
    // Cadastro continuavam aparecendo nos relatórios (mesma causa raiz
    // já corrigida no Kanban/Atribuição de Tarefas).
    const arvores = obterArvoresProjetosAtivas();
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    // Restrição por projeto (Rodada 3 do controle de acesso — ver
    // core.js::obterNomesProjetosPermitidos()): Analista só vê os
    // relatórios dos projetos onde é o responsável.
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;
    let linhas = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        if (projetosPermitidos && !projetosPermitidos.has(nomeProjeto)) return;
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        const projCadastro = projetos.find(p => p.nome === nomeProjeto);
        const cliente = projCadastro ? projCadastro.cliente : '';

        function empilharSessoes(tarefa, etapaNome, setorNome, pavimentoNome, caminho) {
            if (!tarefa.executor || !Array.isArray(tarefa.sessoes_trabalho)) return;
            tarefa.sessoes_trabalho.forEach(sessao => {
                const dataSessaoISO = (sessao.inicio || '').split('T')[0];
                const valorHora = valorHoraVigente(tarefa.executor, dataSessaoISO);
                const horas = parseFloat(sessao.duracao) || 0;
                linhas.push({
                    caminho: caminho,
                    projeto: nomeProjeto,
                    cliente: cliente,
                    etapa: etapaNome,
                    setor: setorNome,
                    pavimento: pavimentoNome,
                    tarefa: tarefa.nome,
                    executor: tarefa.executor,
                    data: dataSessaoISO,
                    horas: horas,
                    valorHora: valorHora,
                    custo: horas * valorHora,
                    manual: !!sessao.manual
                });
            });
        }

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            const partes = localizacao.split(' › ');
            empilharSessoes(tarefa, partes[0], partes[1] || '—', partes[2] || '—', nomeProjeto + '|' + path);
        });
    });

    return linhas;
}

// Uma linha por TAREFA inteira (com executor atribuído), de todos os
// projetos. Não inclui Data Prevista de Fim ainda — depende do motor de
// calendário POR EXECUTOR (calcularDatasInicioEFimExecutor, feriados.js),
// mais pesado; fica pra uma função de enriquecimento à parte quando essa
// coluna entrar em uso de verdade num relatório específico.
function coletarLinhasTarefa() {
    // Item 5/6/7 (prompt_gemini.md §14, leva 4): mesma correção da
    // função acima — usa a versão filtrada.
    const arvores = obterArvoresProjetosAtivas();
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;
    let linhas = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        if (projetosPermitidos && !projetosPermitidos.has(nomeProjeto)) return;
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        const projCadastro = projetos.find(p => p.nome === nomeProjeto);
        const cliente = projCadastro ? projCadastro.cliente : '';

        // Árvore Genérica Recursiva (prompt_gemini.md §12.31): só
        // Tarefa de verdade dentro de Pavimento container (path de 4
        // posições) tem Pavimento-pai com peso pra calcular "horas
        // previstas por área equivalente" — Etapa/Setor/Pavimento
        // agindo como folha (path de 1 a 3 posições) fica sem
        // baseline/outlier, mesmo espírito de exclusão que já existia
        // pra Etapa Única.
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            if (!tarefa.executor) return;
            const segs = path.split('-');
            const partes = localizacao.split(' › ');
            const horasRealizadas = parseFloat(tarefa.horas_reais) || 0;
            const custoReal = calcularCustoRealTarefa(tarefa, tarefa.executor);
            const dataInicioReal = obterDataInicioExecucaoReal(tarefa);

            let horasPrevistas = 0;
            let desvioPct = 0;
            let outlier = false;
            const pathPai = segs.length > 1 ? segs.slice(0, -1).join('-') : null;
            const noPai = pathPai ? resolverNoPorPath(arv, pathPai) : null;
            if (tarefa.nivel === 'tarefa' && noPai && noPai.nivel === 'pavimento') {
                horasPrevistas = calcularHorasPrevistasTarefa(tarefa, noPai, arv);
                desvioPct = horasPrevistas > 0 ? Math.abs((horasRealizadas - horasPrevistas) / horasPrevistas) * 100 : 0;
                outlier = desvioPct > 40; // mesmo critério da Calibração BI
            }

            linhas.push({
                caminho: nomeProjeto + '|' + path,
                projeto: nomeProjeto,
                cliente: cliente,
                etapa: partes[0],
                setor: partes[1] || '—',
                pavimento: partes[2] || '—',
                tarefa: tarefa.nome,
                executor: tarefa.executor,
                status: tarefa.status || 'Apontada',
                pontos: parseFloat(tarefa.pontos) || 0,
                horasPrevistas: horasPrevistas,
                horasRealizadas: horasRealizadas,
                desvioPct: desvioPct,
                outlier: outlier,
                custoReal: custoReal,
                dataInicioReal: dataInicioReal ? dataInicioReal.split('T')[0] : null
            });
        });
    });

    return linhas;
}

// --- MOTOR DE FILTRO ---
// Genérico — funciona em cima de QUALQUER lista de linhas (Sessão ou
// Tarefa), desde que os campos existam nelas. `filtros.campoData` diz
// qual campo da linha representa "a data" pro filtro de período (nível
// Sessão usa 'data'; nível Tarefa usa 'dataInicioReal' — pedido
// explícito do usuário: filtra pela tarefa ter INICIADO no período,
// mesmo que continue depois). Linha sem valor no campo de data é
// excluída quando o filtro de período está ativo (não dá pra saber se
// ela cai dentro do intervalo ou não). Função pura, testável sem DOM
// (ver /home/claude/testes/teste_relatorios_filtro_agrupamento.js).
function aplicarFiltrosRelatorio(linhas, filtros) {
    filtros = filtros || {};
    return linhas.filter(l => {
        if (filtros.projeto && l.projeto !== filtros.projeto) return false;
        if (filtros.etapa && l.etapa !== filtros.etapa) return false;
        if (filtros.cliente && l.cliente !== filtros.cliente) return false;
        if (filtros.executor && l.executor !== filtros.executor) return false;
        if (filtros.campoData && (filtros.dataDe || filtros.dataAte)) {
            const dataLinha = l[filtros.campoData];
            if (!dataLinha) return false;
            if (filtros.dataDe && dataLinha < filtros.dataDe) return false;
            if (filtros.dataAte && dataLinha > filtros.dataAte) return false;
        }
        return true;
    });
}

// --- MOTOR DE AGRUPAMENTO ---
// Agrupa por um campo (ex: 'projeto', 'executor') e soma os campos
// numéricos listados em `camposSoma` — os outros campos da linha
// original se perdem no agrupamento (só faz sentido ver o campo que
// virou o agrupador + os totais). Sem campo de agrupar, devolve a lista
// original sem alterar (linha a linha). `_quantidade` = quantas linhas
// originais formaram aquele grupo, útil pra dar contexto no relatório
// (ex: "12 sessões" por trás do total). Função pura, testável sem DOM.
function agruparLinhasRelatorio(linhas, campoAgrupar, camposSoma) {
    if (!campoAgrupar) return linhas;
    const grupos = {};
    const ordem = []; // preserva a ordem de primeira aparição, não ordena por nome
    linhas.forEach(l => {
        const chave = l[campoAgrupar];
        if (!grupos[chave]) {
            grupos[chave] = { [campoAgrupar]: chave, _quantidade: 0 };
            camposSoma.forEach(c => grupos[chave][c] = 0);
            ordem.push(chave);
        }
        camposSoma.forEach(c => grupos[chave][c] += (parseFloat(l[c]) || 0));
        grupos[chave]._quantidade++;
    });
    return ordem.map(chave => grupos[chave]);
}

// --- CATÁLOGO DE NÍVEIS E COLUNAS ---
// A "fonte de verdade" de tudo que a tela oferece — cada coluna sabe seu
// rótulo, se aparece marcada por padrão, se pode ser somada num
// agrupamento (`somavel`) e como formatar o valor (`tipo`, usado por
// formatarValorColuna). `campoData` diz qual campo alimenta o filtro de
// período nesse nível (ver comentário no topo do arquivo).
const NIVEIS_RELATORIO = {
    sessao: {
        rotulo: 'Sessão de Trabalho',
        descricao: 'Horas e Custo, com precisão por dia (valor da hora vigente na data de cada sessão)',
        coletor: coletarLinhasSessaoTrabalho,
        campoData: 'data',
        colunas: [
            { id: 'projeto', rotulo: 'Projeto', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'cliente', rotulo: 'Cliente', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'etapa', rotulo: 'Etapa', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'setor', rotulo: 'Setor', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'pavimento', rotulo: 'Pavimento', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'tarefa', rotulo: 'Tarefa', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'executor', rotulo: 'Executor', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'data', rotulo: 'Data da Sessão', padrao: true, somavel: false, tipo: 'data' },
            { id: 'horas', rotulo: 'Horas', padrao: true, somavel: true, tipo: 'horas' },
            { id: 'valorHora', rotulo: 'Valor da Hora', padrao: false, somavel: false, tipo: 'moeda' },
            { id: 'custo', rotulo: 'Custo', padrao: true, somavel: true, tipo: 'moeda' },
        ],
        camposAgrupar: ['projeto', 'etapa', 'cliente', 'executor']
    },
    tarefa: {
        rotulo: 'Tarefa',
        descricao: 'Previsto × Realizado, Atraso, Pontos, Status',
        coletor: coletarLinhasTarefa,
        campoData: 'dataInicioReal',
        colunas: [
            { id: 'projeto', rotulo: 'Projeto', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'cliente', rotulo: 'Cliente', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'etapa', rotulo: 'Etapa', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'tarefa', rotulo: 'Tarefa', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'executor', rotulo: 'Executor', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'status', rotulo: 'Status', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'pontos', rotulo: 'Pontos', padrao: false, somavel: true, tipo: 'numero' },
            { id: 'horasPrevistas', rotulo: 'Horas Previstas', padrao: true, somavel: true, tipo: 'horas' },
            { id: 'horasRealizadas', rotulo: 'Horas Realizadas', padrao: true, somavel: true, tipo: 'horas' },
            { id: 'desvioPct', rotulo: 'Desvio %', padrao: true, somavel: false, tipo: 'percentual' },
            { id: 'custoReal', rotulo: 'Custo Real', padrao: false, somavel: true, tipo: 'moeda' },
            { id: 'dataInicioReal', rotulo: 'Data de Início Real', padrao: false, somavel: false, tipo: 'data' },
        ],
        camposAgrupar: ['projeto', 'etapa', 'cliente', 'executor', 'status']
    }
};

// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_relatorios_catalogo_composicao.js).
function formatarValorColuna(tipo, valor) {
    if (valor === undefined || valor === null || valor === '') return '—';
    if (tipo === 'horas') return parseFloat(valor).toFixed(1) + 'h';
    if (tipo === 'moeda') return 'R$ ' + parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (tipo === 'percentual') return parseFloat(valor).toFixed(0) + '%';
    if (tipo === 'data') return valor.split('-').reverse().join('/');
    return valor;
}

// Junta filtro + agrupamento + seleção de colunas — o que a UI chama pra
// saber exatamente o que desenhar na tabela. Recebe as linhas JÁ
// coletadas (não chama coletarLinhas* sozinha), então fica fácil de
// testar e reaproveitável fora da tela também (ex: um export futuro).
// Função pura, testável sem DOM.
function montarResultadoRelatorio(nivel, linhasBase, filtros, colunasAtivasIds, campoAgrupar) {
    const def = NIVEIS_RELATORIO[nivel];
    const filtrosComData = Object.assign({}, filtros, { campoData: def.campoData });
    const linhasFiltradas = aplicarFiltrosRelatorio(linhasBase, filtrosComData);

    const colunas = def.colunas.filter(c => colunasAtivasIds.has(c.id));
    const camposSoma = colunas.filter(c => c.somavel).map(c => c.id);
    const linhasFinal = agruparLinhasRelatorio(linhasFiltradas, campoAgrupar, camposSoma);

    // Linha de "Total Geral" no rodapé — soma os campos somáveis
    // independente de estar agrupado ou não (agrupar ou não dá na mesma
    // soma total, só muda como as linhas do meio são exibidas). É o que
    // faz "Custo Total" existir como visão simples: nível Sessão, coluna
    // Custo, sem precisar agrupar por nada — o rodapé já mostra o total.
    const totais = {};
    camposSoma.forEach(c => { totais[c] = linhasFinal.reduce((s, l) => s + (parseFloat(l[c]) || 0), 0); });

    return { colunas: colunas, linhas: linhasFinal, agrupado: !!campoAgrupar, totalLinhasBase: linhasFiltradas.length, totais: totais };
}

// --- VISÕES SALVAS (compartilhadas — decisão explícita do usuário, não
// é por usuário) ---
// `banco_relatorios_visoes` = array de
//   { id, nome, fabrica (bool), nivel, filtros, colunas (array de ids),
//     agrupar }

// Os 5 relatórios originais que encaixam de verdade no motor genérico
// (ver prompt_gemini.md §11) — os outros 2 ("Tarefas em atraso" e
// "Orçado vs. Realizado por Projeto") ficaram de fora de propósito, por
// decisão do usuário: precisam de colunas que o catálogo ainda não tem
// (Data Prevista de Fim por tarefa, verba orçada por projeto) — fica
// pra quando/se o catálogo for estendido.
function visoesDeFabrica() {
    return [
        { id: 'fabrica_custo_funcionario', nome: 'Custo por Funcionário e Período', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['executor', 'horas', 'custo'], agrupar: 'executor' },
        { id: 'fabrica_custo_projeto', nome: 'Custo por Projeto', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'horas', 'custo'], agrupar: 'projeto' },
        { id: 'fabrica_custo_total', nome: 'Custo Total', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'executor', 'horas', 'custo'], agrupar: '' },
        { id: 'fabrica_horas_funcionario', nome: 'Horas Trabalhadas por Funcionário e Período', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['executor', 'horas'], agrupar: 'executor' },
        { id: 'fabrica_previsto_realizado', nome: 'Horas Previstas vs. Realizadas', fabrica: true, nivel: 'tarefa', filtros: {}, colunas: ['tarefa', 'executor', 'horasPrevistas', 'horasRealizadas', 'desvioPct'], agrupar: '' }
    ];
}

// Semeia as 5 de fábrica na PRIMEIRA vez que a tela é aberta
// (`banco_relatorios_visoes` inexistente ou vazio) — depois disso o
// array salvo é sempre a fonte de verdade, nunca semeia de novo por
// cima do que já existe.
function carregarVisoesRelatorio() {
    let visoes = JSON.parse(localStorage.getItem('banco_relatorios_visoes'));
    if (!Array.isArray(visoes) || visoes.length === 0) {
        visoes = visoesDeFabrica();
        localStorage.setItem('banco_relatorios_visoes', JSON.stringify(visoes));
    }
    return visoes;
}

function salvarNovaVisaoRelatorio(nome, nivel, filtros, colunasIds, agrupar) {
    if (!nome || !nome.trim()) return { ok: false, erro: 'Informe um nome pra visão.' };
    const visoes = carregarVisoesRelatorio();
    const id = 'visao_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    visoes.push({ id: id, nome: nome.trim(), fabrica: false, nivel: nivel, filtros: filtros || {}, colunas: Array.from(colunasIds), agrupar: agrupar || '' });
    localStorage.setItem('banco_relatorios_visoes', JSON.stringify(visoes));
    return { ok: true, id: id };
}

// Trava real: visão de fábrica nunca pode ser apagada, mesmo que o
// botão de apagar de alguma forma fique habilitado por engano na UI.
function apagarVisaoRelatorio(id) {
    const visoes = carregarVisoesRelatorio();
    const alvo = visoes.find(v => v.id === id);
    if (!alvo) return { ok: false, erro: 'Visão não encontrada.' };
    if (alvo.fabrica) return { ok: false, erro: 'Visões de fábrica não podem ser apagadas.' };
    const restantes = visoes.filter(v => v.id !== id);
    localStorage.setItem('banco_relatorios_visoes', JSON.stringify(restantes));
    return { ok: true };
}

// =========================================================================
// UI — liga o motor genérico acima na tela (mesmo desenho do
// mockup_relatorios_v2_flexivel.html, aprovado pelo usuário antes de
// escrever este código).
// =========================================================================

let relNivelAtivo = 'sessao';
let relColunasAtivas = new Set();

function carregarPainelRelatorios() {
    carregarVisoesRelatorio(); // garante que as 5 de fábrica existem
    renderizarSeletorVisoesRelatorio();
    document.getElementById('rel-seletor-visao').value = '';
    document.getElementById('rel-btn-apagar-visao').style.display = 'none';
    mudarNivelRelatorio('sessao');
}

function renderizarSeletorVisoesRelatorio() {
    const visoes = carregarVisoesRelatorio();
    const sel = document.getElementById('rel-seletor-visao');
    const valorAtual = sel.value;
    sel.innerHTML = '<option value="">-- Nova consulta (sem visão salva) --</option>' +
        visoes.map(v => '<option value="' + v.id + '">' + (v.fabrica ? '⭐ ' : '') + v.nome + '</option>').join('');
    sel.value = valorAtual;
}

// Mudar de nível reseta colunas (pro padrão do nível novo) e filtros
// (as opções de Projeto/Etapa/Cliente/Executor são recalculadas em cima
// dos dados do nível novo, então um valor escolhido no nível anterior
// pode nem existir mais na lista).
function mudarNivelRelatorio(nivel) {
    relNivelAtivo = nivel;
    document.getElementById('rel-nivel-sessao').classList.toggle('ativo', nivel === 'sessao');
    document.getElementById('rel-nivel-tarefa').classList.toggle('ativo', nivel === 'tarefa');
    relColunasAtivas = new Set(NIVEIS_RELATORIO[nivel].colunas.filter(c => c.padrao).map(c => c.id));

    ['projeto', 'etapa', 'cliente', 'executor'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = '';
    });
    document.getElementById('rel-filtro-data-de').value = '';
    document.getElementById('rel-filtro-data-ate').value = '';

    renderizarOpcoesFiltroRelatorio();
    renderizarChipsColunasRelatorio();
    renderizarOpcoesAgruparRelatorio();
    renderizarTabelaRelatorio();
}

function renderizarChipsColunasRelatorio() {
    const lista = document.getElementById('rel-lista-colunas');
    lista.innerHTML = NIVEIS_RELATORIO[relNivelAtivo].colunas.map(c =>
        '<div class="coluna-chip ' + (relColunasAtivas.has(c.id) ? 'ativo' : '') + '" onclick="alternarColunaRelatorio(\'' + c.id + '\')">' + c.rotulo + '</div>'
    ).join('');
}

function alternarColunaRelatorio(id) {
    if (relColunasAtivas.has(id)) relColunasAtivas.delete(id); else relColunasAtivas.add(id);
    renderizarChipsColunasRelatorio();
    renderizarTabelaRelatorio();
}

function renderizarOpcoesAgruparRelatorio() {
    const sel = document.getElementById('rel-agrupar');
    const def = NIVEIS_RELATORIO[relNivelAtivo];
    const rotulos = {};
    def.colunas.forEach(c => { rotulos[c.id] = c.rotulo; });
    sel.innerHTML = '<option value="">-- Sem agrupamento (linha a linha) --</option>' +
        def.camposAgrupar.map(id => '<option value="' + id + '">' + rotulos[id] + '</option>').join('');
}

// Popula Projeto/Etapa/Cliente/Executor com os valores DISTINTOS que
// aparecem de verdade nos dados do nível atual — não lista o cadastro
// inteiro, só o que tem dado nesse nível, pra não oferecer uma opção
// que sempre daria uma tabela vazia.
function renderizarOpcoesFiltroRelatorio() {
    const linhas = NIVEIS_RELATORIO[relNivelAtivo].coletor();
    const distintos = (campo) => Array.from(new Set(linhas.map(l => l[campo]).filter(Boolean))).sort();

    ['projeto', 'etapa', 'cliente', 'executor'].forEach(campo => {
        const sel = document.getElementById('rel-filtro-' + campo);
        if (!sel) return;
        const valorAtual = sel.value;
        const rotulo = (v) => campo === 'executor' ? nomeParaExibicao(v) : v;
        sel.innerHTML = '<option value="">-- Todos --</option>' + distintos(campo).map(v => '<option value="' + v + '">' + rotulo(v) + '</option>').join('');
        sel.value = valorAtual;
    });
}

function alternarPainelFiltroRelatorio() {
    document.getElementById('rel-corpo-filtro').classList.toggle('aberto');
    document.getElementById('rel-seta-filtro').classList.toggle('aberto');
}

function lerFiltrosRelatorio() {
    return {
        projeto: document.getElementById('rel-filtro-projeto').value || null,
        etapa: document.getElementById('rel-filtro-etapa').value || null,
        cliente: document.getElementById('rel-filtro-cliente').value || null,
        executor: document.getElementById('rel-filtro-executor').value || null,
        dataDe: document.getElementById('rel-filtro-data-de').value || null,
        dataAte: document.getElementById('rel-filtro-data-ate').value || null
    };
}

function limparFiltrosRelatorio() {
    ['projeto', 'etapa', 'cliente', 'executor'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = '';
    });
    document.getElementById('rel-filtro-data-de').value = '';
    document.getElementById('rel-filtro-data-ate').value = '';
    renderizarTabelaRelatorio();
}

function renderizarTabelaRelatorio() {
    const linhasBase = NIVEIS_RELATORIO[relNivelAtivo].coletor();
    const resultado = montarResultadoRelatorio(relNivelAtivo, linhasBase, lerFiltrosRelatorio(), relColunasAtivas, document.getElementById('rel-agrupar').value);

    const area = document.getElementById('rel-area-resultado');
    if (resultado.colunas.length === 0) {
        area.innerHTML = '<div class="aviso-selecione">Selecione ao menos 1 coluna pra exibir o relatório.</div>';
        return;
    }

    const corpo = resultado.linhas.map(linha => {
        // Destaque de outlier (item 5 da Frente Kanban avançado,
        // mesmo critério de 40% da Calibração BI) — só faz sentido
        // linha a linha, sem agrupamento (agrupar mistura várias
        // tarefas, o campo `outlier` não sobrevive à soma).
        const outlier = !resultado.agrupado && relNivelAtivo === 'tarefa' && linha.outlier;
        const celulas = resultado.colunas.map(c => {
            const valor = (c.id === 'executor') ? nomeParaExibicao(linha[c.id]) : linha[c.id];
            return '<td>' + formatarValorColuna(c.tipo, valor) + '</td>';
        }).join('');
        return '<tr class="' + (outlier ? 'linha-outlier' : '') + '">' + celulas + '</tr>';
    }).join('');

    const temTotais = Object.keys(resultado.totais).length > 0;
    const linhaTotal = temTotais
        ? '<tr class="linha-total">' + resultado.colunas.map(c =>
            '<td>' + (c.id in resultado.totais ? 'Total: ' + formatarValorColuna(c.tipo, resultado.totais[c.id]) : '') + '</td>'
          ).join('') + '</tr>'
        : '';

    area.innerHTML =
        '<div class="table-wrapper"><table>' +
        '<thead><tr>' + resultado.colunas.map(c => '<th>' + c.rotulo + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + corpo + linhaTotal + '</tbody>' +
        '</table></div>';
}

// --- Visões (UI) ---

function carregarVisaoSelecionadaRelatorio() {
    const id = document.getElementById('rel-seletor-visao').value;
    document.getElementById('rel-btn-apagar-visao').style.display = id ? 'inline-block' : 'none';
    if (!id) return;

    const visao = carregarVisoesRelatorio().find(v => v.id === id);
    if (!visao) return;

    relNivelAtivo = visao.nivel;
    document.getElementById('rel-nivel-sessao').classList.toggle('ativo', visao.nivel === 'sessao');
    document.getElementById('rel-nivel-tarefa').classList.toggle('ativo', visao.nivel === 'tarefa');
    renderizarOpcoesFiltroRelatorio();

    ['projeto', 'etapa', 'cliente', 'executor'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = (visao.filtros && visao.filtros[c]) || '';
    });
    document.getElementById('rel-filtro-data-de').value = (visao.filtros && visao.filtros.dataDe) || '';
    document.getElementById('rel-filtro-data-ate').value = (visao.filtros && visao.filtros.dataAte) || '';

    relColunasAtivas = new Set(visao.colunas);
    renderizarChipsColunasRelatorio();
    renderizarOpcoesAgruparRelatorio();
    document.getElementById('rel-agrupar').value = visao.agrupar || '';

    renderizarTabelaRelatorio();
}

function salvarVisaoAtualRelatorio() {
    const nome = prompt('Nome da visão (fica disponível pra todo mundo que acessa Relatórios):');
    if (!nome) return;
    const resultado = salvarNovaVisaoRelatorio(nome, relNivelAtivo, lerFiltrosRelatorio(), relColunasAtivas, document.getElementById('rel-agrupar').value);
    if (!resultado.ok) { alert(resultado.erro); return; }

    renderizarSeletorVisoesRelatorio();
    document.getElementById('rel-seletor-visao').value = resultado.id;
    document.getElementById('rel-btn-apagar-visao').style.display = 'inline-block';
}

function apagarVisaoSelecionadaRelatorio() {
    const id = document.getElementById('rel-seletor-visao').value;
    if (!id) return;
    if (!confirm('Apagar esta visão? Não afeta nenhum dado do sistema, só o atalho salvo.')) return;

    const resultado = apagarVisaoRelatorio(id);
    if (!resultado.ok) { alert(resultado.erro); return; }

    renderizarSeletorVisoesRelatorio();
    document.getElementById('rel-seletor-visao').value = '';
    document.getElementById('rel-btn-apagar-visao').style.display = 'none';
}
