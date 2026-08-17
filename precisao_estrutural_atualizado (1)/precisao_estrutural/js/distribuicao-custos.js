// =========================================================================
// MÓDULO: DISTRIBUIÇÃO DE CUSTOS
//
// Aba 1 "Orçamento Global": pega o valor do contrato do projeto cadastrado,
// aplica um percentual de impostos pra achar o valor líquido, e distribui
// esse líquido entre Analista/Supervisor/Escritório por percentual editável.
//
// Aba 2 "Parcela Global para Produção" (nome até 2026-08-15: "Distribuição
// de Custos Analista"): tabela com uma linha por Etapa da árvore do
// projeto + uma linha fixa "Fundo Garantidor" no final. A Verba de cada
// Etapa já sai líquida do % de Fundo Garantidor (desconto GLOBAL aplicado
// em cada Etapa — Etapas somam 100% ENTRE SI, Fundo Garantidor não entra
// nessa soma). Só pode ser aberta com um projeto já selecionado na aba 1
// (bloqueado em alternarAbaDistribuicao). Responsável não é editável —
// sempre reproduz o Analista designado no cadastro do projeto.
//
// (A antiga Aba 3 "Verba para Detalhamento" foi REMOVIDA em 2026-08-15 —
// ficou redundante depois que a Aba 2 passou a mostrar a Verba líquida
// direto. O antigo "% Distribuição de Lucros" dela virou um % novo na
// Aba 4/Verba por Pavimento, aplicado na cascata por Pavimento.)
//
// Armazenamento: 'banco_distribuicao_custos' (objeto, chave = nome do
// projeto) guarda os percentuais escolhidos pra cada projeto, pra não
// precisar redigitar toda vez que voltar na tela. 'banco_ultimo_percentual_impostos'
// guarda o último percentual de imposto usado, como valor sugerido pra
// projetos que ainda não têm distribuição salva.
// =========================================================================

// Pedido explícito do usuário (ver prompt_gemini.md §11, substituindo o
// Kanban do Analista removido): Analista e Supervisor só VISUALIZAM
// Distribuição de Custos, não editam — só Administrador edita. Sem
// nível conhecido (sem login / módulo isolado) não restringe, mesmo
// padrão de fallback aberto já usado no resto do projeto (esta tela já
// é protegida por trás do controle de acesso de menu — isso aqui é uma
// restrição a mais, dentro dela). Função pura, testável sem DOM (ver
// /home/claude/testes/teste_distribuicao_custos_somente_leitura.js).
function nivelSomenteLeituraDistribuicaoCustos(nivel) {
    return nivel === 'analista' || nivel === 'supervisor';
}

function distribuicaoCustosSomenteLeitura() {
    const nivel = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    return nivelSomenteLeituraDistribuicaoCustos(nivel);
}

// Desabilita TODO input/select do painel (exceto o seletor de projeto
// #dc-projeto, que continua livre pra escolher o que visualizar) e os
// botões que gravam dado (salvar/recalcular/aplicar). Chamada no final
// de alternarAbaDistribuicao() — que é o gargalo por onde passa tanto a
// carga inicial (aba "Orçamento Global") quanto toda troca de aba
// (cada aba reconstrói seu HTML via innerHTML, então `disabled` precisa
// ser reaplicado toda vez, não dá pra fazer só uma vez no início).
// Cosmético/UX — a trava REAL fica dentro de cada função salvar*()
// (defesa em profundidade, mesmo padrão já usado em outras telas).
function aplicarSomenteLeituraDistribuicaoCustos() {
    if (!distribuicaoCustosSomenteLeitura()) return;
    // Item 7+10 (ver prompt_gemini.md §12): Supervisor é somente-leitura
    // no RESTO da tela, mas pode atribuir executor por aqui — só
    // Analista fica travado nesse campo específico também.
    const podeAtribuirExecutor = typeof podeAtribuirExecutorDistribuicaoCustos === 'function' ? podeAtribuirExecutorDistribuicaoCustos() : false;
    document.querySelectorAll('#panel-distribuicao-custos input, #panel-distribuicao-custos select').forEach(el => {
        if (el.id === 'dc-projeto') return;
        if (podeAtribuirExecutor && el.classList.contains('vt-select-executor')) return;
        el.disabled = true;
    });
    document.querySelectorAll('#panel-distribuicao-custos button').forEach(el => {
        const acao = el.getAttribute('onclick') || '';
        if (/salvar|recalcular|aplicarVerbaProporcional/i.test(acao)) el.disabled = true;
    });
}

function carregarPainelDistribuicaoCustos() {
    let projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    // Restrição por projeto (Rodada 3 do controle de acesso — ver
    // core.js::obterNomesProjetosPermitidos()): Analista só vê os
    // projetos onde é o responsável.
    if (typeof obterNomesProjetosPermitidos === 'function') {
        const permitidos = obterNomesProjetosPermitidos();
        if (permitidos) projetos = projetos.filter(p => permitidos.has(p.nome));
    }

    // Item 6 (prompt_gemini.md §14): lista de projetos em ordem
    // alfabética pelo Nome da Obra — vale pro portal e pro dropdown
    // #dc-projeto juntos, já que os dois usam a mesma lista `projetos`.
    projetos.sort((a, b) => a.nome.localeCompare(b.nome));

    // Melhoria #12 (prompt_gemini.md §12): portal de seleção inicial
    // virou lista clicável com busca (mesmo padrão da tela "Escolha o
    // Projeto" da Árvore, `renderizerProjetosParaSelecaoArvore`), no
    // lugar do dropdown antigo (`dc-portal-projeto-select`, removido).
    // `#dc-projeto` (dropdown usado DENTRO da aba Orçamento Global, pra
    // trocar de projeto sem sair da tela) continua como select — fora
    // do escopo dessa melhoria.
    dcPortalProjetosCache = projetos;
    renderizarPortalProjetosDistribuicao(projetos);
    document.getElementById('dc-portal-busca-projeto').value = '';

    const opcoesHtml = '<option value="">-- Selecione um Projeto --</option>' +
        projetos.map(p => '<option value="' + p.nome + '">' + p.nome + '</option>').join('');
    document.getElementById('dc-projeto').innerHTML = opcoesHtml;

    document.getElementById('dc-valor-contrato').value = '';
    document.getElementById('dc-valor-liquido').value = '';
    document.getElementById('dc-pct-impostos').value = '';
    document.getElementById('dc-pct-analista').value = '';
    document.getElementById('dc-pct-supervisor').value = '';
    document.getElementById('dc-pct-escritorio').value = '';
    document.getElementById('dc-valor-analista').value = '';
    document.getElementById('dc-valor-supervisor').value = '';
    document.getElementById('dc-valor-escritorio').value = '';
    document.getElementById('dc-alerta-soma').innerHTML = '';

    alternarAbaDistribuicao('orcamento-global');
    document.getElementById('dca-sem-projeto').style.display = 'block';
    document.getElementById('dca-conteudo').style.display = 'none';

    // Pedido explícito do usuário: ao clicar em Distribuição de Custos,
    // "escolha o projeto" deve ser a primeira e OBRIGATÓRIA opção —
    // antes disso, as abas (Orçamento Global, Verba por Tarefa, etc)
    // nem aparecem, só o portal de seleção.
    voltarParaPortalSelecaoProjeto();
}

// Cache em memória da lista completa de projetos permitidos (já
// filtrada por obterNomesProjetosPermitidos), pra filtrarTabelaProjetosDistribuicao()
// não precisar reler/refiltrar o localStorage a cada tecla digitada.
let dcPortalProjetosCache = [];

function renderizarPortalProjetosDistribuicao(projetos) {
    const tbody = document.getElementById('dc-portal-tabela-projetos-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    projetos.forEach(proj => {
        const nomeJs = proj.nome.replace(/'/g, "\\'");
        tbody.innerHTML += '<tr class="clickable-row" onclick="escolherProjetoDistribuicaoInicial(\'' + nomeJs + '\')"><td># <strong>' + (proj.prefixo || "PRJ") + '</strong></td><td>' + proj.nome + '</td></tr>';
    });
}

function filtrarTabelaProjetosDistribuicao() {
    const filtro = document.getElementById('dc-portal-busca-projeto').value.toLowerCase();
    const linhas = document.getElementById('dc-portal-tabela-projetos-body').getElementsByTagName('tr');
    for (let i = 0; i < linhas.length; i++) {
        linhas[i].style.display = linhas[i].innerText.toLowerCase().indexOf(filtro) > -1 ? "" : "none";
    }
}

// Some com as abas, mostra só o portal de seleção — chamada tanto na
// entrada da tela quanto pelo botão "🔁 Trocar Projeto".
function voltarParaPortalSelecaoProjeto() {
    document.getElementById('dc-portal-selecao-projeto').style.display = 'block';
    document.getElementById('dc-conteudo-principal').style.display = 'none';
    document.getElementById('dc-portal-busca-projeto').value = '';
    filtrarTabelaProjetosDistribuicao();
    document.getElementById('dc-projeto').value = '';
}

// Chamada ao clicar numa linha da lista do portal — escolher um projeto
// ali libera as abas (que já vêm com o mesmo projeto pré-selecionado no
// #dc-projeto de dentro do "Orçamento Global", sem precisar escolher de
// novo).
function escolherProjetoDistribuicaoInicial(nomeProjeto) {
    if (!nomeProjeto) return;
    document.getElementById('dc-projeto').value = nomeProjeto;
    document.getElementById('dc-portal-selecao-projeto').style.display = 'none';
    document.getElementById('dc-conteudo-principal').style.display = 'block';
    carregarProjetoDistribuicao();
}

function alternarAbaDistribuicao(aba) {
    const precisaDeProjeto = (aba === 'distribuicao-analista' || aba === 'verba-pavimento' || aba === 'verba-por-tarefa');
    if (precisaDeProjeto && !document.getElementById('dc-projeto').value) {
        alert('Selecione um projeto na aba "Orçamento Global" antes de abrir esta aba.');
        return;
    }

    document.querySelectorAll('#panel-distribuicao-custos .tab-selector').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#panel-distribuicao-custos .tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('aba-' + aba).classList.add('active');
    document.getElementById('conteudo-' + aba).style.display = 'block';

    if (aba === 'distribuicao-analista') {
        carregarAbaDistribuicaoAnalista();
    } else if (aba === 'verba-pavimento') {
        carregarAbaVerbaPavimento();
    } else if (aba === 'verba-por-tarefa') {
        carregarAbaVerbaPorTarefa();
    }

    aplicarSomenteLeituraDistribuicaoCustos();
}

// --- ABA 2: "PARCELA GLOBAL PARA PRODUÇÃO" (tabela por Etapa) ---
// Usa o mesmo projeto selecionado na aba 1, e a "Parcela Global para
// Produção" já calculada lá (% Analista sobre o Valor Líquido) como base
// pra rateio entre as Etapas da árvore desse projeto. A coluna Responsável
// não é editável por linha: ela sempre reproduz o Analista designado no
// cadastro do projeto (campo "analista" de banco_projetos), já que é a
// mesma pessoa em todas as etapas do mesmo projeto.
//
// Pedido do usuário (reforma de 2026-08-15): a Verba de cada Etapa
// mostrada aqui já sai LÍQUIDA do Fundo Garantidor — antes essa linha só
// mostrava pct×ParcelaGlobal bruto, e o desconto só aparecia na aba
// "Verba para Detalhamento" (removida nesta mudança, ver
// calcularVerbaPorEtapa()/calcularVerbaPorEtapaSalvo() logo abaixo, que
// concentram essa fórmula — usada tanto aqui quanto em qualquer outro
// módulo que precise da verba líquida de uma Etapa). Fundo Garantidor
// deixou de ser uma linha concorrendo pelos mesmos 100% que as Etapas —
// agora é um % GLOBAL descontado de CADA Etapa (as Etapas devem somar
// 100% ENTRE SI; ver recalcularSomaPercentuaisAnalista()).
let dcaValorAnalistaAtual = 0;

function carregarAbaDistribuicaoAnalista() {
    const nomeProjeto = document.getElementById('dc-projeto').value;

    if (!nomeProjeto) {
        document.getElementById('dca-sem-projeto').style.display = 'block';
        document.getElementById('dca-conteudo').style.display = 'none';
        return;
    }
    document.getElementById('dca-sem-projeto').style.display = 'none';
    document.getElementById('dca-conteudo').style.display = 'block';
    document.getElementById('dca-projeto-ref').innerText = nomeProjeto;

    // Recalcula o Valor Analista a partir dos campos atuais da aba 1
    // (mesma fórmula de recalcularDistribuicaoCustos, pra não depender
    // de o usuário já ter clicado em "Salvar Distribuição" na aba 1).
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;
    const nomeAnalista = projeto ? (projeto.analista || '—') : '—';
    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    dcaValorAnalistaAtual = pctAnalista / 100 * valorLiquido;

    document.getElementById('dca-valor-analista-ref').innerText = formatarMoeda(dcaValorAnalistaAtual);

    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    // Compatibilidade: dados salvos antes desta mudança guardavam as etapas
    // direto na raiz do objeto do projeto, e o Fundo Garantidor se chamava
    // "sobras".
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
    const salvoFundoGarantidor = salvoProjeto.fundo_garantidor || salvoProjeto.sobras || {};

    // Melhoria #14 (prompt_gemini.md §12): % sugerido por Etapa, vindo
    // do Cadastro de Etapas (catálogo) — usado como fallback SÓ quando a
    // Etapa ainda não tem nada salvo pra este projeto especificamente
    // (nunca sobrescreve um valor já confirmado/salvo).
    const etapasCatalogo = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
    const buscarPctSugerido = (nomeEtapa) => {
        const etapaCat = etapasCatalogo.find(e => e.nome === nomeEtapa);
        return (etapaCat && etapaCat.pct_sugerido !== undefined && etapaCat.pct_sugerido !== '') ? etapaCat.pct_sugerido : undefined;
    };

    const tbody = document.getElementById('dca-tabela-body');

    if (etapas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma etapa cadastrada neste projeto ainda. Monte a árvore primeiro.</td></tr>' +
            // Pedido do usuário (prompt_gemini.md §14, item 3): Fundo
            // Garantidor vem com valor default de 10%, editável — antes
            // vinha em branco até alguém digitar algo.
            construirLinhaDistribuicaoAnalista('Fundo Garantidor', salvoFundoGarantidor, true, nomeAnalista, '10');
        recalcularTabelaDistribuicaoAnalista();
        return;
    }

    tbody.innerHTML = etapas.map(etapa => construirLinhaDistribuicaoAnalista(etapa.nome, salvoEtapas[etapa.nome] || {}, false, nomeAnalista, buscarPctSugerido(etapa.nome))).join('') +
        construirLinhaDistribuicaoAnalista('Fundo Garantidor', salvoFundoGarantidor, true, nomeAnalista, '10');
    recalcularTabelaDistribuicaoAnalista();
}

function construirLinhaDistribuicaoAnalista(nomeLinha, dadosSalvos, ehFundoGarantidor, nomeAnalista, pctSugerido) {
    const pct = dadosSalvos.pct !== undefined ? dadosSalvos.pct : (pctSugerido !== undefined ? pctSugerido : '');
    const marcador = ehFundoGarantidor ? 'data-fundo-garantidor="1"' : 'data-etapa="' + nomeLinha + '"';
    const estiloLinha = ehFundoGarantidor ? ' style="background:#fffbeb;"' : '';
    const rotulo = ehFundoGarantidor ? '💰 <i>Fundo Garantidor</i> <small style="color:#94a3b8;">(% descontado de CADA etapa abaixo — não conta na soma de 100%)</small>' : nomeLinha;

    // Verba desta linha é preenchida por recalcularTabelaDistribuicaoAnalista()
    // logo depois de inserir o HTML — precisa ver TODAS as linhas juntas
    // (o % do Fundo Garantidor afeta a verba de toda Etapa), não dá pra
    // calcular uma linha isolada aqui.
    return '<tr' + estiloLinha + '>' +
        '<td>' + rotulo + '</td>' +
        '<td><input type="number" step="0.01" class="dca-input-pct" ' + marcador + ' value="' + pct + '" style="width:80px;" oninput="recalcularTabelaDistribuicaoAnalista()"></td>' +
        '<td class="dca-verba" style="font-weight:bold; color:#166534;">' + formatarMoeda(0) + '</td>' +
        '<td style="color:#334155;">' + nomeParaExibicao(nomeAnalista) + '</td>' +
        '</tr>';
}

// Soma só as % das ETAPAS (Fundo Garantidor não entra mais nessa conta —
// ele agora é um desconto global aplicado em CIMA de cada Etapa, não uma
// fatia própria do mesmo bolo de 100%).
function recalcularSomaPercentuaisAnalista() {
    const alerta = document.getElementById('dca-alerta-soma');
    if (!alerta) return;

    let soma = 0;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inp => {
        if (inp.dataset.fundoGarantidor) return;
        soma += parseFloat(inp.value) || 0;
    });

    if (soma === 0) {
        alerta.innerHTML = '';
    } else if (Math.abs(soma - 100) < 0.01) {
        alerta.style.background = '#f0fdf4'; alerta.style.color = '#166534';
        alerta.innerHTML = '✅ Percentuais das Etapas somam 100%.';
    } else {
        alerta.style.background = '#fef9c3'; alerta.style.color = '#854d0e';
        alerta.innerHTML = '⚠️ Percentuais das Etapas somam ' + soma.toFixed(2) + '% (não fecham 100%). Isso não impede salvar, mas confira se é intencional.';
    }
}

// Recalcula a Verba de TODAS as Etapas de uma vez — necessário porque
// mudar o % do Fundo Garantidor (linha própria da tabela) afeta a verba
// de TODA Etapa, não só da linha editada; e mudar o % de uma Etapa não
// afeta as demais, mas é mais simples/robusto sempre recalcular tudo do
// que rastrear qual caso é qual. Mesma fórmula de calcularVerbaPorEtapa()
// (abaixo), só que lendo os %'s AO VIVO desta própria tabela (ainda não
// salvos) em vez dos já salvos em banco_distribuicao_custos_analista.
function recalcularTabelaDistribuicaoAnalista() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    const pctSupervisor = parseFloat(document.getElementById('dc-pct-supervisor').value) || 0;
    const pctEscritorio = parseFloat(document.getElementById('dc-pct-escritorio').value) || 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    let inputFundoGarantidor = null;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inp => {
        if (inp.dataset.fundoGarantidor) inputFundoGarantidor = inp;
    });
    const pctFundoGarantidor = inputFundoGarantidor ? (parseFloat(inputFundoGarantidor.value) || 0) : 0;

    let somaFundoGarantidor = 0;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inputPct => {
        if (inputPct.dataset.fundoGarantidor) return; // linha do próprio Fundo Garantidor, preenchida no final
        const pctEtapa = parseFloat(inputPct.value) || 0;
        const nomeEtapa = inputPct.dataset.etapa || '';
        const ehDetalhamento = nomeEtapa.toLowerCase().includes('detalhamento');

        let verbaBruta;
        if (ehDetalhamento) {
            const r = calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctEtapa, 0, '');
            verbaBruta = r.verbaTotal;
        } else {
            verbaBruta = pctEtapa / 100 * valorAnalistaTotal;
        }

        const valorFundo = pctFundoGarantidor / 100 * verbaBruta;
        const verbaLiquida = verbaBruta - valorFundo;
        somaFundoGarantidor += valorFundo;

        const linha = inputPct.closest('tr');
        const celulaVerba = linha ? linha.querySelector('.dca-verba') : null;
        if (celulaVerba) celulaVerba.innerText = formatarMoeda(verbaLiquida);
    });

    // Linha do Fundo Garantidor mostra a SOMA do que foi descontado de
    // todas as Etapas — informativo, não é mais fatia própria do bolo.
    if (inputFundoGarantidor) {
        const linhaFundo = inputFundoGarantidor.closest('tr');
        const celulaVerbaFundo = linhaFundo ? linhaFundo.querySelector('.dca-verba') : null;
        if (celulaVerbaFundo) celulaVerbaFundo.innerText = formatarMoeda(somaFundoGarantidor);
    }

    recalcularSomaPercentuaisAnalista();
}

function salvarDistribuicaoAnalista() {
    // Trava real (não só o botão desabilitado) — mesmo padrão de defesa
    // em profundidade já usado em outras telas.
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto na aba "Orçamento Global" primeiro.');

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const dadosEtapas = {};
    let dadosFundoGarantidor = {};

    document.querySelectorAll('#dca-tabela-body tr').forEach(linha => {
        const inputPct = linha.querySelector('.dca-input-pct');
        if (!inputPct) return; // linha de "nenhuma etapa cadastrada", sem inputs

        const registro = { pct: inputPct.value };

        if (inputPct.dataset.fundoGarantidor) {
            dadosFundoGarantidor = registro;
        } else {
            dadosEtapas[inputPct.dataset.etapa] = registro;
        }
    });

    salvos[nomeProjeto] = { etapas: dadosEtapas, fundo_garantidor: dadosFundoGarantidor };
    localStorage.setItem('banco_distribuicao_custos_analista', JSON.stringify(salvos));
    alert('Distribuição por etapa (e Fundo Garantidor) salva para "' + nomeProjeto + '".');
}

// --- CÁLCULO COMPARTILHADO: FÓRMULA ESPECIAL DA ETAPA "DETALHAMENTO" ---
// Item 10 (prompt_gemini.md §14, leva 4): esta fórmula pura
// (calcularVerbaDetalhamentoPuro) não depende de DOM nem de
// localStorage, só dos números que recebe — continua em uso, agora
// chamada de dentro de calcularVerbaPorEtapa/calcularVerbaPorEtapaSalvo
// (abaixo), só para a Etapa cujo nome contém "Detalhamento" (regra de
// negócio: essa Etapa tem custo compartilhado com Escritório e
// Supervisor, as demais Etapas usam só a fatia do Analista). As duas
// funções que existiam aqui antes desta mudança —
// calcularVerbaDetalhamento(nomeProjeto) e
// calcularVerbaDetalhamentoSalvo(nomeProjeto) — calculavam um bolo
// ÚNICO pro projeto inteiro a partir só dessa etapa, ignorando as
// demais; foram REMOVIDAS nesta leva, substituídas por
// calcularVerbaPorEtapa/calcularVerbaPorEtapaSalvo, que calculam a
// verba de CADA Etapa (usando esta fórmula só pra "Detalhamento").
// buscarPctDetalhamentoEAviso() também foi removida — só existia pra
// alimentar as duas funções acima.
function calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctDetalhamento, pctLucros, avisoDetalhamento) {
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;
    const verbaAnalista = pctDetalhamento / 100 * valorAnalistaTotal;

    const verbaEscritorio = pctAnalista > 0 ? verbaAnalista * (pctEscritorio / pctAnalista) : 0;
    const verbaSupervisor = pctAnalista > 0 ? verbaAnalista * (pctSupervisor / pctAnalista) : 0;
    const verbaTotal = verbaAnalista + verbaEscritorio + verbaSupervisor;

    const valorLucros = pctLucros / 100 * verbaTotal;
    const verbaLiquida = verbaTotal - valorLucros;

    return { verbaAnalista, verbaEscritorio, verbaSupervisor, verbaTotal, pctLucros, valorLucros, verbaLiquida, avisoDetalhamento: avisoDetalhamento || '' };
}

// --- ITEM 10 (prompt_gemini.md §14, leva 4): CASCATA DE VERBA POR ETAPA ---
// Motor genérico que substitui a distribuição antiga (que ratava a
// Verba Líquida do projeto INTEIRO direto entre todos os Pavimentos,
// ignorando de qual Etapa cada um era). Agora: cada Etapa recebe sua
// própria verba (calcularVerbaPorEtapa, abaixo) e essa verba cascateia
// recursivamente pelos filhos dela — Setor ou Pavimento usam Área
// Equivalente (área×peso) entre si, Tarefa usa Pontos — nunca os dois
// juntos no mesmo nível, porque a regra de negócio (confirmada pelo
// usuário) já garante que os filhos de um mesmo nó nunca são de tipos
// misturados. Escreve o resultado em `no._verbaCalc`, EM MEMÓRIA
// apenas (no objeto já carregado via JSON.parse, que é descartado
// depois de usado) — não persiste em localStorage, mesmo padrão
// "tudo calculado, sem storage próprio" que as Abas 4/5 já seguiam
// antes desta mudança. Não mexe no campo `no.verba` (esse é outro
// campo, editável manualmente na Árvore, usado pelo Painel de
// Progresso como peso — propositalmente fora do escopo do item 10).
function distribuirVerbaRecursiva(no, verba) {
    no._verbaCalc = verba;
    const filhos = no.filhos || [];
    if (filhos.length === 0) return; // folha (Tarefa, ou qualquer nível agindo como folha) — já recebeu tudo acima

    const filhosSaoTarefa = filhos[0].nivel === 'tarefa';
    if (filhosSaoTarefa) {
        const totalPontos = filhos.reduce((soma, f) => soma + (parseFloat(f.pontos) || 0), 0);
        filhos.forEach(f => {
            const pontos = parseFloat(f.pontos) || 0;
            const parte = totalPontos > 0 ? (pontos / totalPontos) * verba : 0;
            distribuirVerbaRecursiva(f, parte);
        });
    } else {
        // Filhos são Setor ou Pavimento — competem por Área Equivalente
        // (área_fisica × peso_esforco, mesmo campo em ambos os níveis).
        const totalAreaEq = filhos.reduce((soma, f) => soma + (parseFloat(f.area_fisica) || 0) * (parseFloat(f.peso_esforco) || 0), 0);
        filhos.forEach(f => {
            const areaEq = (parseFloat(f.area_fisica) || 0) * (parseFloat(f.peso_esforco) || 0);
            const parte = totalAreaEq > 0 ? (areaEq / totalAreaEq) * verba : 0;
            distribuirVerbaRecursiva(f, parte);
        });
    }
}

// Verba de CADA Etapa do projeto (versão "AO VIVO", lê os %'s direto do
// DOM da Aba 1/Aba 2 — usada quando essas abas estão abertas na tela;
// calcularVerbaPorEtapaSalvo(), abaixo, é a mesma conta mas 100% a
// partir do que já está salvo, pra outras telas). Regra fechada pelo
// usuário: Etapa "Detalhamento" tem fórmula especial (Analista + parcela
// de Escritório + parcela de Supervisor, mesma fórmula que já existia em
// calcularVerbaDetalhamentoPuro); as demais Etapas usam só a fatia do
// Analista já calculada por linha na Aba 2 (% daquela Etapa × Parcela
// Global). Reforma de 2026-08-15: o desconto uniforme aplicado sobre a
// verba BRUTA de CADA etapa deixou de ser "% Distribuição de Lucros"
// (aba "Verba para Detalhamento", removida) e passou a ser o % do
// **Fundo Garantidor**, já salvo como linha própria na Aba 2
// (banco_distribuicao_custos_analista[projeto].fundo_garantidor.pct) —
// mesmo raciocínio de antes (desconto uniforme em toda Etapa), só
// trocou a fonte do percentual.
function calcularVerbaPorEtapa(nomeProjeto) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    const pctSupervisor = parseFloat(document.getElementById('dc-pct-supervisor').value) || 0;
    const pctEscritorio = parseFloat(document.getElementById('dc-pct-escritorio').value) || 0;

    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
    const pctFundoGarantidor = parseFloat((salvoProjeto.fundo_garantidor || {}).pct) || 0;

    return etapas.map(etapa => {
        const dadosEtapa = salvoEtapas[etapa.nome];
        const pctEtapa = (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
        const ehDetalhamento = etapa.nome.toLowerCase().includes('detalhamento');

        let verbaBruta;
        if (ehDetalhamento) {
            const r = calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctEtapa, 0, '');
            verbaBruta = r.verbaTotal;
        } else {
            verbaBruta = pctEtapa / 100 * valorAnalistaTotal;
        }

        const valorFundoGarantidor = pctFundoGarantidor / 100 * verbaBruta;
        const verbaLiquida = verbaBruta - valorFundoGarantidor;

        return { nome: etapa.nome, no: etapa, ehDetalhamento, pctEtapa, verbaBruta, pctFundoGarantidor, valorFundoGarantidor, verbaLiquida };
    });
}


// Reforma de 2026-08-15: a antiga aba "Verba para Detalhamento" (que
// vivia aqui — carregarAbaVerbaDetalhamento/recalcularDistribuicaoLucros/
// salvarDistribuicaoLucros, mais a variável vdVerbasPorEtapaAtual) foi
// REMOVIDA por ficar redundante — a Aba 2 ("Parcela Global para
// Produção") agora já mostra a Verba de cada Etapa líquida do Fundo
// Garantidor direto (ver calcularVerbaPorEtapa()/
// recalcularTabelaDistribuicaoAnalista(), acima). O antigo "%
// Distribuição de Lucros" (banco_distribuicao_lucros, descontado da
// Etapa inteira) também saiu — o conceito de "fundo de lucros" migrou
// pra Aba 4 (Verba por Pavimento), como um % novo aplicado na cascata
// por Pavimento (ver carregarAbaVerbaPavimento(), abaixo), não mais na
// Etapa inteira.

// Mesma coisa que calcularVerbaPorEtapa, mas lendo os percentuais JÁ
// SALVOS em 'banco_distribuicao_custos' em vez do DOM ao vivo — usada
// por telas fora da Distribuição de Custos (Atribuição de Tarefas,
// Painel de Progresso), que precisam calcular a verba de vários
// projetos ao mesmo tempo, nenhum necessariamente "aberto" na tela.
// Mesmo padrão de calcularVerbaDetalhamento/calcularVerbaDetalhamentoSalvo.
function calcularVerbaPorEtapaSalvo(nomeProjeto) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const orcamentosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    const orcamento = orcamentosSalvos[nomeProjeto] || {};
    const pctImpostos = parseFloat(orcamento.pct_impostos) || 0;
    const pctAnalista = parseFloat(orcamento.pct_analista) || 0;
    const pctSupervisor = parseFloat(orcamento.pct_supervisor) || 0;
    const pctEscritorio = parseFloat(orcamento.pct_escritorio) || 0;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
    const pctFundoGarantidor = parseFloat((salvoProjeto.fundo_garantidor || {}).pct) || 0;

    return etapas.map(etapa => {
        const dadosEtapa = salvoEtapas[etapa.nome];
        const pctEtapa = (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
        const ehDetalhamento = etapa.nome.toLowerCase().includes('detalhamento');

        let verbaBruta;
        if (ehDetalhamento) {
            const r = calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctEtapa, 0, '');
            verbaBruta = r.verbaTotal;
        } else {
            verbaBruta = pctEtapa / 100 * valorAnalistaTotal;
        }

        const valorFundoGarantidor = pctFundoGarantidor / 100 * verbaBruta;
        const verbaLiquida = verbaBruta - valorFundoGarantidor;

        return { nome: etapa.nome, no: etapa, ehDetalhamento, pctEtapa, verbaBruta, pctFundoGarantidor, valorFundoGarantidor, verbaLiquida };
    });
}

// --- ABA 4: VERBA POR PAVIMENTO ---
// Reforma de 2026-08-15: só a Etapa "Detalhamento" alimenta Pavimentos
// (confirmado pelo usuário — na prática é a única que tem essa
// granularidade de execução; as demais Etapas como Lançamento/Análise
// não têm Pavimento por trás). Antes cascateava TODAS as Etapas
// independentemente; agora usa só a Verba líquida (já sem Fundo
// Garantidor) da Etapa "Detalhamento", MENOS um novo "% Fundo
// Distribuição de Lucros" (pré-setado 5%, editável e salvo por projeto
// em banco_fundo_lucros_pavimento — sucessor do antigo "% Distribuição
// Lucros" da aba removida, só que aplicado aqui, na cascata por
// Pavimento em vez de na Etapa inteira). O valor desse fundo também é
// rateado por Pavimento (proporcional à Área Equivalente, junto com a
// verba) e exposto em `valorFundoLucros` — é o que
// js/distribuicao-lucro.js usa como "bolo" pra ratear entre Estagiários.
function obterPctFundoLucrosPavimento(nomeProjeto) {
    const salvos = JSON.parse(localStorage.getItem('banco_fundo_lucros_pavimento')) || {};
    const salvo = salvos[nomeProjeto];
    return (salvo && salvo.pct !== undefined && salvo.pct !== '') ? (parseFloat(salvo.pct) || 0) : 5;
}

// --- CÁLCULO COMPARTILHADO: LISTA DE PAVIMENTOS COM VERBA ---
// Acha a Etapa "Detalhamento", desconta o % de Fundo Distribuição de
// Lucros da verba líquida dela, e cascateia só esse valor
// (distribuirVerbaRecursiva) pelos Setor/Pavimento dentro dela — não
// mais por TODAS as Etapas. Precisa ser a MESMA árvore carregada em
// memória pra cascata (rodada no nó de Etapa) e a coleta de Pavimentos
// (que lê `_verbaCalc` desses mesmos nós) baterem.
function listarPavimentosDoProjeto(nomeProjeto, verbasPorEtapa, pctFundoLucrosOverride) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const etapaDetalhamento = etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));
    if (!etapaDetalhamento) return [];

    const fIdxDetalhamento = etapas.indexOf(etapaDetalhamento);
    const verbaEtapa = (verbasPorEtapa || []).find(v => v.nome === etapaDetalhamento.nome);
    const verbaLiquidaEtapa = verbaEtapa ? verbaEtapa.verbaLiquida : 0;
    const pctFundoLucros = (pctFundoLucrosOverride !== undefined && pctFundoLucrosOverride !== null) ? pctFundoLucrosOverride : obterPctFundoLucrosPavimento(nomeProjeto);
    const valorFundoLucrosTotal = pctFundoLucros / 100 * verbaLiquidaEtapa;
    const verbaParaCascata = verbaLiquidaEtapa - valorFundoLucrosTotal;

    distribuirVerbaRecursiva(etapaDetalhamento, verbaParaCascata);

    // Árvore Genérica Recursiva v2 (prompt_gemini.md §12.31): Pavimento
    // pode estar em QUALQUER profundidade agora (Etapa>Pavimento direto,
    // Etapa>Setor>Pavimento, etc.) — acha qualquer nó com
    // `nivel === 'pavimento'`, sem assumir posição fixa. Não precisa
    // descer além do Pavimento encontrado: pela ordem obrigatória, o
    // único filho que ele pode ter é Tarefa.
    const pavimentos = [];
    function caminhar(no, path) {
        if (no.nivel === 'pavimento') {
            const area = parseFloat(no.area_fisica) || 0;
            const peso = parseFloat(no.peso_esforco) || 0;
            const tarefasFilhas = (no.filhos || []).filter(f => f.nivel === 'tarefa');
            const pctDoTotal = verbaParaCascata > 0 ? ((no._verbaCalc || 0) / verbaParaCascata) : 0;
            pavimentos.push({
                nome: no.nome, area: area, peso: peso, areaEquivalente: area * peso,
                tarefas: tarefasFilhas, caminho: path, etapa: etapaDetalhamento.nome,
                valorVerba: no._verbaCalc || 0,
                pctVerba: pctDoTotal * 100,
                valorFundoLucros: pctDoTotal * valorFundoLucrosTotal
            });
            return;
        }
        (no.filhos || []).forEach((filho, idx) => caminhar(filho, path + '-' + idx));
    }
    caminhar(etapaDetalhamento, '' + fIdxDetalhamento);
    return pavimentos;
}

// Mesma ideia de listarPavimentosDoProjeto, mas coleta nós
// nivel==='setor' dentro da Etapa "Detalhamento" — usa a MESMA
// árvore/cascata (reexecuta distribuirVerbaRecursiva, idempotente — os
// nós já tinham `_verbaCalc` de uma chamada anterior na mesma função
// que a chama, mas rodar de novo aqui não muda o resultado, só garante
// que funciona mesmo se chamada isoladamente). `nomePai` é só pra
// exibição (saber de qual Etapa/Setor o Setor listado depende).
function listarSetoresDoProjeto(nomeProjeto, verbasPorEtapa, pctFundoLucrosOverride) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const etapaDetalhamento = etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));
    if (!etapaDetalhamento) return [];

    const fIdxDetalhamento = etapas.indexOf(etapaDetalhamento);
    const verbaEtapa = (verbasPorEtapa || []).find(v => v.nome === etapaDetalhamento.nome);
    const verbaLiquidaEtapa = verbaEtapa ? verbaEtapa.verbaLiquida : 0;
    const pctFundoLucros = (pctFundoLucrosOverride !== undefined && pctFundoLucrosOverride !== null) ? pctFundoLucrosOverride : obterPctFundoLucrosPavimento(nomeProjeto);
    const verbaParaCascata = verbaLiquidaEtapa - (pctFundoLucros / 100 * verbaLiquidaEtapa);

    distribuirVerbaRecursiva(etapaDetalhamento, verbaParaCascata);

    const setores = [];
    function caminhar(no, path, nomePai, verbaDoPai) {
        if (no.nivel === 'setor') {
            const area = parseFloat(no.area_fisica) || 0;
            const peso = parseFloat(no.peso_esforco) || 0;
            setores.push({
                nome: no.nome, nomePai: nomePai, area: area, peso: peso, areaEquivalente: area * peso,
                caminho: path, valorVerba: no._verbaCalc || 0,
                pctVerba: verbaDoPai > 0 ? ((no._verbaCalc || 0) / verbaDoPai * 100) : 0
            });
            (no.filhos || []).forEach((filho, idx) => caminhar(filho, path + '-' + idx, no.nome, no._verbaCalc || 0));
            return;
        }
        (no.filhos || []).forEach((filho, idx) => caminhar(filho, path + '-' + idx, nomePai, verbaDoPai));
    }
    caminhar(etapaDetalhamento, '' + fIdxDetalhamento, etapaDetalhamento.nome, verbaParaCascata);
    return setores;
}

// Item 10 (prompt_gemini.md §14, leva 4): Área Física e Peso do
// Esforço do Setor editáveis direto na Aba 4 — mesmo padrão de
// editarAreaPesoVerbaPavimento (item 13).
function editarAreaPesoVerbaSetor(inputEl) {
    if (distribuicaoCustosSomenteLeitura()) return;
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return;

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    const setor = resolverNoPorPath(arv, inputEl.dataset.caminho);
    if (!setor) return; // caminho não existe mais (árvore mudou entre carregar e editar) — ignora
    setor[inputEl.dataset.campo] = inputEl.value;

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarTabelasVerbaPavimento(); // não usa carregarAbaVerbaPavimento() aqui — não pode resetar o % Fundo Distribuição de Lucros se a pessoa estiver digitando nele
}

// `verbaLiquida` aqui é a soma da Verba de todos os Pavimentos (=
// verba da Etapa "Detalhamento" já líquida de Fundo Garantidor E de
// Fundo Distribuição de Lucros — ver listarPavimentosDoProjeto) — não
// mais a soma de TODAS as Etapas, já que só Detalhamento alimenta
// Pavimento agora.
function calcularListaPavimentosComVerba(nomeProjeto, pctFundoLucrosOverride) {
    const verbasPorEtapa = calcularVerbaPorEtapa(nomeProjeto);
    const pavimentos = listarPavimentosDoProjeto(nomeProjeto, verbasPorEtapa, pctFundoLucrosOverride);
    const verbaLiquida = pavimentos.reduce((soma, p) => soma + p.valorVerba, 0);
    const areaTotalEquivalente = pavimentos.reduce((soma, p) => soma + p.areaEquivalente, 0);
    return { pavimentos: pavimentos, areaTotalEquivalente: areaTotalEquivalente, verbaLiquida: verbaLiquida, verbasPorEtapa: verbasPorEtapa };
}


function calcularListaPavimentosComVerbaSalva(nomeProjeto) {
    const verbasPorEtapa = calcularVerbaPorEtapaSalvo(nomeProjeto);
    const pavimentos = listarPavimentosDoProjeto(nomeProjeto, verbasPorEtapa);
    const verbaLiquida = pavimentos.reduce((soma, p) => soma + p.valorVerba, 0);
    const areaTotalEquivalente = pavimentos.reduce((soma, p) => soma + p.areaEquivalente, 0);
    return { pavimentos: pavimentos, areaTotalEquivalente: areaTotalEquivalente, verbaLiquida: verbaLiquida, verbasPorEtapa: verbasPorEtapa };
}

function carregarAbaVerbaPavimento() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    document.getElementById('vp-projeto-ref').innerText = nomeProjeto;
    const inputFundoLucros = document.getElementById('vp-pct-fundo-lucros');
    if (inputFundoLucros) inputFundoLucros.value = obterPctFundoLucrosPavimento(nomeProjeto);
    renderizarTabelasVerbaPavimento();
}

// Recalcula e redesenha só as tabelas (Setores/Pavimentos/totais) — NÃO
// mexe no campo de % Fundo Distribuição de Lucros, pra não perder o que
// a pessoa está digitando (mesmo padrão que a antiga aba "Verba para
// Detalhamento" já usava pro % Distribuição de Lucros dela). Lê o %
// AO VIVO do próprio input (ainda não precisa estar salvo) — só quando
// salva de verdade (salvarFundoLucrosPavimento) é que vale pras outras
// telas (Atribuição de Tarefas, Painel de Progresso, Distribuição de
// Lucro), que sempre leem o % já salvo.
function renderizarTabelasVerbaPavimento() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    const inputFundoLucros = document.getElementById('vp-pct-fundo-lucros');
    const pctFundoLucrosAoVivo = inputFundoLucros ? (parseFloat(inputFundoLucros.value) || 0) : undefined;
    const { pavimentos, areaTotalEquivalente, verbaLiquida, verbasPorEtapa } = calcularListaPavimentosComVerba(nomeProjeto, pctFundoLucrosAoVivo);

    document.getElementById('vp-area-total-equivalente').innerText = areaTotalEquivalente.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    document.getElementById('vp-verba-liquida-ref').innerText = formatarMoeda(verbaLiquida);

    // Item 10 (prompt_gemini.md §14, leva 4): tabela de Setores, só
    // aparece se o projeto realmente tiver algum Setor cadastrado —
    // reaproveita a mesma cascata já rodada acima (calcularListaPavimentosComVerba
    // já executou distribuirVerbaRecursiva em toda a árvore; aqui só
    // colhe os nós nivel==='setor', que já ficaram com `_verbaCalc`
    // preenchido).
    const setoresWrapper = document.getElementById('vp-setores-wrapper');
    const setores = listarSetoresDoProjeto(nomeProjeto, verbasPorEtapa, pctFundoLucrosAoVivo);
    if (setores.length === 0) {
        setoresWrapper.style.display = 'none';
    } else {
        setoresWrapper.style.display = 'block';
        document.getElementById('vp-setores-tabela-body').innerHTML = setores.map(s => {
            return '<tr>' +
                '<td>' + s.nome + '</td>' +
                '<td style="color:#64748b; font-size:11px;">' + s.nomePai + '</td>' +
                '<td class="col-centralizada"><input type="number" step="0.01" value="' + s.area + '" data-caminho="' + s.caminho + '" data-campo="area_fisica" onchange="editarAreaPesoVerbaSetor(this)" style="width:80px;" ' + (distribuicaoCustosSomenteLeitura() ? 'readonly' : '') + '></td>' +
                '<td class="col-centralizada"><input type="number" step="0.01" value="' + s.peso + '" data-caminho="' + s.caminho + '" data-campo="peso_esforco" onchange="editarAreaPesoVerbaSetor(this)" style="width:70px;" ' + (distribuicaoCustosSomenteLeitura() ? 'readonly' : '') + '></td>' +
                '<td class="col-centralizada">' + s.areaEquivalente.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '</td>' +
                '<td class="col-centralizada">' + s.pctVerba.toFixed(2) + '%</td>' +
                '<td style="font-weight:bold; color:#166534;">' + formatarMoeda(s.valorVerba) + '</td>' +
                '</tr>';
        }).join('');
    }

    const tbody = document.getElementById('vp-tabela-body');
    const conferencia = document.getElementById('vp-conferencia');

    if (pavimentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Nenhum pavimento cadastrado neste projeto ainda. Monte a árvore primeiro.</td></tr>';
        document.getElementById('vp-total-verba').innerText = formatarMoeda(0);
        conferencia.innerHTML = '';
        return;
    }

    tbody.innerHTML = pavimentos.map(p => {
        return '<tr>' +
            '<td>' + p.nome + '</td>' +
            '<td><input type="number" step="0.01" value="' + p.area + '" data-caminho="' + p.caminho + '" data-campo="area_fisica" onchange="editarAreaPesoVerbaPavimento(this)" style="width:90px;" ' + (distribuicaoCustosSomenteLeitura() ? 'readonly' : '') + '></td>' +
            '<td><input type="number" step="0.01" value="' + p.peso + '" data-caminho="' + p.caminho + '" data-campo="peso_esforco" onchange="editarAreaPesoVerbaPavimento(this)" style="width:70px;" ' + (distribuicaoCustosSomenteLeitura() ? 'readonly' : '') + '></td>' +
            '<td>' + p.areaEquivalente.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '</td>' +
            '<td>' + p.pctVerba.toFixed(2) + '%</td>' +
            '<td style="font-weight:bold; color:#166534;">' + formatarMoeda(p.valorVerba) + '</td>' +
            '</tr>';
    }).join('');

    const totalVerba = pavimentos.reduce((soma, p) => soma + p.valorVerba, 0);
    document.getElementById('vp-total-verba').innerText = formatarMoeda(totalVerba);

    exibirSeloConferencia(conferencia, totalVerba, verbaLiquida, 'Soma das Verbas por Pavimento', 'Verba Detalhamento Líquida');
}

// Salva o % Fundo Distribuição de Lucros (banco_fundo_lucros_pavimento,
// chave nova — sucessor do antigo "% Distribuição Lucros" da aba
// removida, ver obterPctFundoLucrosPavimento acima). Único campo
// editável desta aba além de Área/Peso por linha (que já se auto-salvam
// sem botão), por isso precisa de "Salvar" próprio.
function salvarFundoLucrosPavimento() {
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto na aba "Orçamento Global" primeiro.');

    const salvos = JSON.parse(localStorage.getItem('banco_fundo_lucros_pavimento')) || {};
    salvos[nomeProjeto] = { pct: document.getElementById('vp-pct-fundo-lucros').value };
    localStorage.setItem('banco_fundo_lucros_pavimento', JSON.stringify(salvos));
    alert('% Fundo Distribuição de Lucros salvo para "' + nomeProjeto + '".');
}

// Item 13 (prompt_gemini.md §14, leva 4): Área Física e Peso do
// Esforço do Pavimento passam a ser editáveis direto nesta aba (antes
// só na Árvore/Estrutura de Projeto). Grava no próprio nó Pavimento
// (mesmo padrão de editarPontosVerbaPorTarefa — sem botão Salvar) e
// recarrega a aba inteira, recalculando toda a cascata que depende
// disso: Área Equivalente, % Verba, Valor da Verba de cada pavimento
// (e, por consequência, a Aba 5/Verba por Tarefa também, já que parte
// do Valor da Verba do pavimento pai).
function editarAreaPesoVerbaPavimento(inputEl) {
    if (distribuicaoCustosSomenteLeitura()) return;
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return;

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    const pavimento = resolverNoPorPath(arv, inputEl.dataset.caminho);
    if (!pavimento) return; // caminho não existe mais (árvore mudou entre carregar e editar) — ignora
    pavimento[inputEl.dataset.campo] = inputEl.value;

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarTabelasVerbaPavimento(); // não usa carregarAbaVerbaPavimento() aqui — não pode resetar o % Fundo Distribuição de Lucros se a pessoa estiver digitando nele
}

// Compara um total calculado (soma de partes) com o valor total esperado
// no contexto da aba, e mostra ✅/⚠️. Usa uma tolerância pequena porque
// somas de percentuais em ponto flutuante raramente batem 100,00000%
// exato.
function exibirSeloConferencia(elemento, valorCalculado, valorEsperado, rotuloCalculado, rotuloEsperado) {
    const diferenca = Math.abs(valorCalculado - valorEsperado);
    if (diferenca < 0.01) {
        elemento.style.background = '#f0fdf4'; elemento.style.color = '#166534';
        elemento.innerHTML = '✅ ' + rotuloCalculado + ' (' + formatarMoeda(valorCalculado) + ') bate com ' + rotuloEsperado + '.';
    } else {
        elemento.style.background = '#fef9c3'; elemento.style.color = '#854d0e';
        elemento.innerHTML = '⚠️ ' + rotuloCalculado + ' (' + formatarMoeda(valorCalculado) + ') não bate com ' + rotuloEsperado + ' (' + formatarMoeda(valorEsperado) + '). Diferença: ' + formatarMoeda(diferenca) + '.';
    }
}

// --- ABA 5: VERBA POR TAREFA ---
// Pega a Verba (Valor da Verba) que cada pavimento já recebeu na aba 4, e
// rateia esse valor entre as tarefas plugadas naquele pavimento,
// proporcionalmente aos Pontos de cada tarefa (campo já existente nas
// tarefas da árvore, "Pontos Gerados"). Tudo calculado, sem storage
// próprio. Bordas mais grossas separam visualmente o bloco de cada
// pavimento na planilha.
// Item 7+10 da Rodada de Comentários da Gerência (ver
// prompt_gemini.md §12): só Administrador e Supervisor podem atribuir
// executor por aqui (Analista nunca pôde, e agora nem pela Atribuição
// de Tarefas — ver atribuicao-tarefas.js). Diferente de
// `distribuicaoCustosSomenteLeitura()` (que bloqueia Analista E
// Supervisor pro resto da tela) — aqui o Supervisor É liberado,
// especificamente pra esse campo.
function podeAtribuirExecutorDistribuicaoCustos() {
    const nivel = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    if (!nivel) return true; // sem login/módulo isolado — fallback aberto
    return nivel === 'administrador' || nivel === 'supervisor';
}

function carregarAbaVerbaPorTarefa() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    document.getElementById('vt-projeto-ref').innerText = nomeProjeto;
    const { pavimentos } = calcularListaPavimentosComVerba(nomeProjeto);
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const podeAtribuir = podeAtribuirExecutorDistribuicaoCustos();

    const tbody = document.getElementById('vt-tabela-body');
    const pavimentosComTarefas = pavimentos.filter(p => p.tarefas.length > 0);

    if (pavimentosComTarefas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma tarefa plugada em nenhum pavimento deste projeto ainda.</td></tr>';
        return;
    }

    let html = '';
    pavimentosComTarefas.forEach(pav => {
        // Melhoria #6 (prompt_gemini.md §12): cabeçalho de grupo próprio
        // (antes o nome do Pavimento ficava embutido na primeira célula
        // da primeira linha de Tarefa) — permite recolher/expandir,
        // mesmo padrão visual (▼/►) já usado na Árvore
        // (alternarRecolhimentoNo/nosRecolhidosEstado), só que com
        // estado próprio desta aba (vtGruposRecolhidos).
        const recolhido = !!vtGruposRecolhidos[pav.caminho];
        const seta = recolhido ? '►' : '▼';
        const estiloOcultoSeRecolhido = recolhido ? ' style="display:none;"' : '';

        html += '<tr style="background:#e2e8f0; cursor:pointer;" onclick="alternarGrupoVerbaPorTarefa(\'' + pav.caminho + '\')">' +
                '<td colspan="5" style="font-weight:bold; color:#0f223f;"><span class="tree-toggle-icon">' + seta + '</span> ' + pav.nome + '</td>' +
                '</tr>';

        pav.tarefas.forEach((tarefa, idxTarefa) => {
            const pontos = parseFloat(tarefa.pontos) || 0;
            const caminhoJs = (pav.caminho + '-' + idxTarefa);
            // `vt-select-executor` (classe) é usada por
            // aplicarSomenteLeituraDistribuicaoCustos() pra saber que
            // ESTE campo específico não deve ser desabilitado pro
            // Supervisor, mesmo com o resto da tela travada pra ele.
            const opcoesExecutor = typeof construirOpcoesExecutor === 'function' ? construirOpcoesExecutor(funcionarios, tarefa.executor) : '';

            html += '<tr class="vt-linha-tarefa" data-grupo="' + pav.caminho + '" data-valor-verba="' + pav.valorVerba + '"' + estiloOcultoSeRecolhido + '>' +
                '<td>' + tarefa.nome + '</td>' +
                '<td><select class="vt-select-executor" data-caminho="' + caminhoJs + '" style="min-width:160px;" onchange="atribuirExecutorVerbaPorTarefa(this)"' + (podeAtribuir ? '' : ' disabled title="Só Administrador ou Supervisor podem atribuir executor por aqui"') + '>' + opcoesExecutor + '</select></td>' +
                '<td class="vt-horas-maximas col-centralizada">—</td>' +
                '<td class="col-centralizada"><input type="number" step="0.1" class="vt-input-pontos" data-caminho="' + caminhoJs + '" value="' + pontos + '" style="width:60px; border:1px solid #cbd5e1; border-radius:4px; padding:2px;" oninput="recalcularGrupoVerbaPorTarefa(this)" onchange="editarPontosVerbaPorTarefa(this)"></td>' +
                '<td class="vt-valor" style="font-weight:bold; color:#166534;"></td>' +
                '</tr>';
        });

        // Subtotal fica SEMPRE visível (mesmo com o grupo recolhido) —
        // é o resumo útil que justifica nem precisar expandir. Só a
        // linha de conferência (texto auxiliar) some junto com as
        // Tarefas, por ser detalhe, não resumo.
        html += '<tr style="background:#f8fafc;" data-subtotal-grupo="' + pav.caminho + '">' +
                '<td colspan="3"></td>' +
                '<td style="text-align:right; font-weight:bold; white-space:nowrap;">Subtotal:</td>' +
                '<td class="vt-subtotal" style="font-weight:bold; color:#0a192f;"></td>' +
                '</tr>' +
                '<tr class="vt-linha-tarefa" data-conferencia-grupo="' + pav.caminho + '"' + estiloOcultoSeRecolhido + '><td colspan="5" class="vt-conferencia" style="font-size:11px; padding:4px 8px;"></td></tr>';
    });

    tbody.innerHTML = html;
    // Preenche a coluna Valor, Horas Máximas, o subtotal e a conferência de
    // todos os grupos — roda em TODAS as linhas de Tarefa, mesmo as
    // ocultas por recolhimento (display:none não impede o cálculo, só a
    // exibição; reabrir o grupo já mostra os valores certos na hora).
    document.querySelectorAll('#vt-tabela-body .vt-input-pontos').forEach(recalcularGrupoVerbaPorTarefa);
}

// Estado de recolhimento por grupo (Pavimento) desta aba — em memória,
// reseta ao trocar de projeto/aba (não precisa persistir).
let vtGruposRecolhidos = {};

function alternarGrupoVerbaPorTarefa(caminhoGrupo) {
    vtGruposRecolhidos[caminhoGrupo] = !vtGruposRecolhidos[caminhoGrupo];
    carregarAbaVerbaPorTarefa();
}

// Item 10: Horas Máximas = valor da tarefa (calculado nesta mesma aba)
// ÷ valor da hora VIGENTE do executor escolhido — mesma fonte de dado
// (`valorHoraVigente`, feriados.js) que todo o resto do sistema usa pra
// custo. Sem executor escolhido, ou sem valor de hora cadastrado pra
// ele na data de hoje, mostra "—" em vez de dividir por zero. Função
// pura, testável sem DOM (ver
// /home/claude/testes/teste_item10_horas_maximas.js).
function calcularHorasMaximasVerbaPorTarefa(valorTarefa, executor, hojeISO) {
    if (!executor) return 0;
    const valorHora = valorHoraVigente(executor, hojeISO);
    return valorHora > 0 ? (valorTarefa / valorHora) : 0;
}

// Item 7+10: grava o executor escolhido na árvore, reaproveitando a
// MESMA lógica de atribuição que a Atribuição de Tarefas usa
// (`aplicarAtribuicaoExecutorNaTarefa`, atribuicao-tarefas.js) —
// comportamento confirmado como IDÊNTICO nos dois lugares pelo usuário
// (fim da fila do executor, status Sem Executor<->Apontada). Trava real
// de quem pode atribuir (defesa em profundidade — o campo já vem
// desabilitado pra quem não pode, ver carregarAbaVerbaPorTarefa acima).
function atribuirExecutorVerbaPorTarefa(selectEl) {
    if (!podeAtribuirExecutorDistribuicaoCustos()) return;
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return;

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    const tarefa = resolverNoPorPath(arv, selectEl.dataset.caminho);
    if (!tarefa) return; // caminho não existe mais (árvore mudou entre carregar e atribuir) — ignora
    if (typeof aplicarAtribuicaoExecutorNaTarefa === 'function') {
        aplicarAtribuicaoExecutorNaTarefa(tarefa, selectEl.value);
    } else {
        // Módulo isolado sem atribuicao-tarefas.js carregado —
        // fallback mínimo, só o campo executor (sem fila/status).
        tarefa.executor = selectEl.value;
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    carregarAbaVerbaPorTarefa(); // recarrega — Horas Máximas muda pro executor novo
}

// Recalcula a coluna Valor de TODAS as tarefas do mesmo pavimento (mesmo
// "grupo"), já que mudar os Pontos de uma tarefa muda a proporção de
// todas as outras do mesmo pavimento — não só da linha editada. Também
// atualiza Horas Máximas de cada linha (item 10 — muda junto porque
// depende do Valor recalculado), o Subtotal do pavimento e o selo de
// conferência contra o "Valor da Verba" que esse mesmo pavimento
// recebeu na aba anterior.
function recalcularGrupoVerbaPorTarefa(inputOrigem) {
    // Bug pré-existente encontrado ao validar a reforma de 2026-08-15:
    // pegar o grupo fatiando `dataset.caminho` (`.split('-').slice(0,3)`)
    // supunha Pavimento sempre a 3 níveis de profundidade (Etapa>Setor>
    // Pavimento) — quebra quando Pavimento está direto sob a Etapa (2
    // níveis, ex.: projeto piloto "AP PRAIA"), porque um caminho de
    // Tarefa de 3 segmentos vira o "grupo" inteiro por engano, sem bater
    // com o `data-grupo` de 2 segmentos gravado no <tr> (ver
    // carregarAbaVerbaPorTarefa() acima). Corrigido: lê o `data-grupo`
    // JÁ GRAVADO no <tr> mais próximo, em vez de tentar re-derivar por
    // slicing — funciona em qualquer profundidade.
    const grupo = inputOrigem.closest('tr').dataset.grupo;
    const linhasDoGrupo = Array.from(document.querySelectorAll('#vt-tabela-body tr[data-grupo="' + grupo + '"]'));
    if (linhasDoGrupo.length === 0) return;

    const valorVerba = parseFloat(linhasDoGrupo[0].dataset.valorVerba) || 0;
    const totalPontos = linhasDoGrupo.reduce((soma, tr) => soma + (parseFloat(tr.querySelector('.vt-input-pontos').value) || 0), 0);
    const hojeISO = new Date().toISOString().slice(0, 10);

    let subtotal = 0;
    linhasDoGrupo.forEach(tr => {
        const pontos = parseFloat(tr.querySelector('.vt-input-pontos').value) || 0;
        const valorTarefa = totalPontos > 0 ? (pontos / totalPontos) * valorVerba : 0;
        tr.querySelector('.vt-valor').innerText = formatarMoeda(valorTarefa);
        subtotal += valorTarefa;

        const selectExecutor = tr.querySelector('.vt-select-executor');
        const celulaHoras = tr.querySelector('.vt-horas-maximas');
        if (selectExecutor && celulaHoras) {
            const executor = selectExecutor.value;
            const horasMaximas = calcularHorasMaximasVerbaPorTarefa(valorTarefa, executor, hojeISO);
            celulaHoras.innerText = executor ? horasMaximas.toFixed(1) + 'h' : '—';
        }
    });

    const linhaSubtotal = document.querySelector('#vt-tabela-body tr[data-subtotal-grupo="' + grupo + '"] .vt-subtotal');
    if (linhaSubtotal) linhaSubtotal.innerText = formatarMoeda(subtotal);

    const linhaConferencia = document.querySelector('#vt-tabela-body tr[data-conferencia-grupo="' + grupo + '"] .vt-conferencia');
    if (linhaConferencia) exibirSeloConferencia(linhaConferencia, subtotal, valorVerba, 'Subtotal do pavimento', 'Valor da Verba (aba anterior)');
}

// Grava os Pontos direto na árvore do projeto (mesmo campo que a Árvore
// de Projeto usa e exibe) assim que o campo perde o foco depois de uma
// mudança — SEM precisar de um botão "Salvar" separado. Antes disso, a
// edição só recalculava os valores mostrados (`recalcularGrupoVerbaPorTarefa`,
// via oninput) e exigia um clique manual num botão "Salvar Pontos" pra
// persistir de verdade — usuário reportou (item 9 da Rodada de
// Comentários da Gerência, ver prompt_gemini.md §12) que editava, via o
// valor recalculado (dando a impressão de já ter salvo), saía da aba, e
// a edição se perdia silenciosamente porque nunca clicava no botão.
// Mesmo padrão de auto-salvar já usado em
// atribuicao-tarefas.js::editarPontosTarefaAtribuicao() — as duas telas
// agora se comportam de forma consistente. Trava real de somente-leitura
// (defesa em profundidade — o campo já vem desabilitado pra
// Analista/Supervisor via aplicarSomenteLeituraDistribuicaoCustos()).
function editarPontosVerbaPorTarefa(inputEl) {
    if (distribuicaoCustosSomenteLeitura()) return;
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return;

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    const tarefa = resolverNoPorPath(arv, inputEl.dataset.caminho);
    if (!tarefa) return; // caminho não existe mais (árvore mudou entre carregar e editar) — ignora
    tarefa.pontos = inputEl.value;

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
}

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarProjetoDistribuicao() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) {
        document.getElementById('dc-valor-contrato').value = '';
        document.getElementById('dc-valor-liquido').value = '';
        return;
    }

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;
    document.getElementById('dc-valor-contrato').value = formatarMoeda(valorContrato);

    const todasDistribuicoes = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    const salvo = todasDistribuicoes[nomeProjeto];

    if (salvo) {
        document.getElementById('dc-pct-impostos').value = salvo.pct_impostos;
        document.getElementById('dc-pct-analista').value = salvo.pct_analista;
        document.getElementById('dc-pct-supervisor').value = salvo.pct_supervisor;
        document.getElementById('dc-pct-escritorio').value = salvo.pct_escritorio;
    } else {
        // Melhoria #13 (prompt_gemini.md §12): percentuais padrão
        // pré-preenchidos (editáveis) quando o projeto ainda não tem
        // NADA salvo — Impostos 23% (item 1, leva 4 — antes 21%),
        // Analista 30%, Supervisor 10%, Escritório 60%. O campo de
        // Impostos mantém a prioridade pro "último valor usado"
        // (`banco_ultimo_percentual_impostos`, já existia) — o 23% é
        // só o fallback quando nem isso existe ainda.
        document.getElementById('dc-pct-impostos').value = localStorage.getItem('banco_ultimo_percentual_impostos') || '23';
        document.getElementById('dc-pct-analista').value = '30';
        document.getElementById('dc-pct-supervisor').value = '10';
        document.getElementById('dc-pct-escritorio').value = '60';
    }

    recalcularDistribuicaoCustos();
}

function recalcularDistribuicaoCustos() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    document.getElementById('dc-valor-liquido').value = formatarMoeda(valorLiquido);

    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    const pctSupervisor = parseFloat(document.getElementById('dc-pct-supervisor').value) || 0;
    const pctEscritorio = parseFloat(document.getElementById('dc-pct-escritorio').value) || 0;

    document.getElementById('dc-valor-analista').value = formatarMoeda(pctAnalista / 100 * valorLiquido);
    document.getElementById('dc-valor-supervisor').value = formatarMoeda(pctSupervisor / 100 * valorLiquido);
    document.getElementById('dc-valor-escritorio').value = formatarMoeda(pctEscritorio / 100 * valorLiquido);

    const somaPct = pctAnalista + pctSupervisor + pctEscritorio;
    const alerta = document.getElementById('dc-alerta-soma');
    if (somaPct === 0) {
        alerta.innerHTML = '';
    } else if (Math.abs(somaPct - 100) < 0.01) {
        alerta.style.background = '#f0fdf4'; alerta.style.color = '#166534';
        alerta.innerHTML = '✅ Percentuais somam 100%.';
    } else {
        alerta.style.background = '#fef9c3'; alerta.style.color = '#854d0e';
        alerta.innerHTML = '⚠️ Percentuais somam ' + somaPct.toFixed(2) + '% (não fecham 100%). Isso não impede salvar, mas confira se é intencional.';
    }
}

function salvarDistribuicaoCustos() {
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto antes de salvar.');

    const pctImpostos = document.getElementById('dc-pct-impostos').value;
    const pctAnalista = document.getElementById('dc-pct-analista').value;
    const pctSupervisor = document.getElementById('dc-pct-supervisor').value;
    const pctEscritorio = document.getElementById('dc-pct-escritorio').value;

    const todasDistribuicoes = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    todasDistribuicoes[nomeProjeto] = {
        pct_impostos: pctImpostos,
        pct_analista: pctAnalista,
        pct_supervisor: pctSupervisor,
        pct_escritorio: pctEscritorio
    };
    localStorage.setItem('banco_distribuicao_custos', JSON.stringify(todasDistribuicoes));
    localStorage.setItem('banco_ultimo_percentual_impostos', pctImpostos);

    alert('Distribuição salva para "' + nomeProjeto + '".');
}
