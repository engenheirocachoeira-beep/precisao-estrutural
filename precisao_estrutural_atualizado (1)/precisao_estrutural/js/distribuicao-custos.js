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
// Fundo Garantidor (linha própria desta tabela) é uma fatia do MESMO
// bolo de 100% que as Etapas — % dele é AUTOMÁTICO, calculado como
// `100% − soma das % das Etapas` (não tem `<input>` próprio; ver
// construirLinhaDistribuicaoAnalista()/recalcularTabelaDistribuicaoAnalista()
// abaixo). Cada Etapa mostra sua Verba simples (%etapa × Parcela
// Global) — não tem mais desconto nenhum aplicado em cima (histórico:
// já existiram DUAS versões anteriores dessa regra nesta mesma sessão
// — um desconto multiplicativo por Etapa, e antes disso a aba "Verba
// para Detalhamento" separada — ambas substituídas por esta, mais
// simples, a pedido do próprio usuário).
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
    // direto na raiz do objeto do projeto.
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;

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
            construirLinhaDistribuicaoAnalista('Fundo Garantidor', {}, true, nomeAnalista);
        recalcularTabelaDistribuicaoAnalista();
        return;
    }

    tbody.innerHTML = etapas.map(etapa => {
        const linhaEtapa = construirLinhaDistribuicaoAnalista(etapa.nome, salvoEtapas[etapa.nome] || {}, false, nomeAnalista, buscarPctSugerido(etapa.nome));
        // Pedido do usuário: logo abaixo da Etapa "Detalhamento", 2
        // linhas informativas com a coparticipação de Escritório/
        // Supervisão (Item 4 da Aba 1) — mesma fórmula já usada lá,
        // ver calcularVerbaDetalhamentoPuro().
        return etapa.nome.toLowerCase().includes('detalhamento') ? linhaEtapa + construirLinhasCoparticipacaoDetalhamento() : linhaEtapa;
    }).join('') +
        construirLinhaDistribuicaoAnalista('Fundo Garantidor', {}, true, nomeAnalista);
    recalcularTabelaDistribuicaoAnalista();
}

// Pedido do usuário: 2 linhas só-leitura logo abaixo da Etapa
// "Detalhamento", mostrando quanto Supervisão/Escritório coparticipam
// dela (Item 4 da Aba 1 "Orçamento Global") — nunca somadas ao Total
// (Etapas)/Total Geral, porque vêm de um bolo diferente (Escritório/
// Supervisor, não o do Analista). Valores recalculados ao vivo em
// recalcularTabelaDistribuicaoAnalista().
function construirLinhasCoparticipacaoDetalhamento() {
    const linha = (idBase, rotulo) =>
        '<tr style="background:#f8fafc;">' +
        '<td style="padding-left:22px; color:#64748b;">↳ ' + rotulo + '</td>' +
        '<td id="' + idBase + '-pct" class="col-centralizada campo-somente-leitura-borda">0.00%</td>' +
        '<td id="' + idBase + '-verba" class="dca-verba" style="font-weight:bold; color:#166534;">' + formatarMoeda(0) + '</td>' +
        '<td></td>' +
        '</tr>';
    return linha('dca-copart-supervisor', 'Coparticipação Supervisor') + linha('dca-copart-escritorio', 'Coparticipação Escritório');
}

// Reforma de 2026-08-17 (parte 6 — o usuário reconsiderou a parte 1):
// Fundo Garantidor voltou a ser uma fatia do MESMO bolo de 100% que as
// Etapas (não mais um desconto multiplicativo aplicado em cima de cada
// Etapa) — só que agora, em vez de ser digitado à mão, o % dele é
// CALCULADO automaticamente: `100% − soma das % das Etapas`. Por isso
// a linha do Fundo Garantidor não tem mais `<input>` de %, só um texto
// (atualizado por recalcularTabelaDistribuicaoAnalista()) — e a coluna
// "Verba" voltou a ser uma só (não tem mais desconto pra discretizar
// em 3 colunas).
function construirLinhaDistribuicaoAnalista(nomeLinha, dadosSalvos, ehFundoGarantidor, nomeAnalista, pctSugerido) {
    // Pedido do usuário: linha do Fundo Garantidor usa o MESMO formato
    // de célula das Etapas (só muda o preenchimento — fundo verde,
    // ver estiloLinha abaixo).
    const estiloLinha = ehFundoGarantidor ? ' style="background:#f0fdf4;"' : '';
    // Nota "(automático: 100% − soma das Etapas)" removida daqui — já
    // explicada no aviso azul acima da tabela, e o texto extra quebrava
    // em 2 linhas nesta coluna estreita, deixando esta linha mais alta
    // que as demais (pedido do usuário: mesma altura sempre).
    // Pedido do usuário: a Etapa "Detalhamento" mostra o rótulo "Verba
    // Detalhamento - Analista" aqui (deixa claro que é só a fatia do
    // Analista — as 2 linhas de coparticipação logo abaixo, ver
    // construirLinhasCoparticipacaoDetalhamento(), completam o
    // quadro). `data-etapa` continua com o nome real da Etapa (usado
    // pra salvar) — só o texto exibido muda.
    const ehDetalhamento = !ehFundoGarantidor && nomeLinha.toLowerCase().includes('detalhamento');
    const rotulo = ehFundoGarantidor ? '💰 <i>Fundo Garantidor</i>' : (ehDetalhamento ? 'Verba Detalhamento - Analista' : nomeLinha);

    let celulaPct;
    if (ehFundoGarantidor) {
        celulaPct = '<td id="dca-pct-fundo-garantidor" class="col-centralizada campo-somente-leitura-borda" style="font-weight:bold;">0.00%</td>';
    } else {
        const pct = dadosSalvos.pct !== undefined ? dadosSalvos.pct : (pctSugerido !== undefined ? pctSugerido : '');
        const pctFormatado = pct === '' ? '' : (parseFloat(pct) || 0).toFixed(2);
        celulaPct = '<td><div class="campo-percentual" style="width:80px;"><input type="number" step="0.01" class="dca-input-pct" data-etapa="' + nomeLinha + '" value="' + pctFormatado + '" oninput="recalcularTabelaDistribuicaoAnalista()" onblur="formatarCampoPercentual(this)"><span class="sufixo-pct">%</span></div></td>';
    }

    const marcadorLinha = ehFundoGarantidor ? ' data-fundo-garantidor-linha="1"' : '';
    return '<tr' + estiloLinha + marcadorLinha + '>' +
        '<td>' + rotulo + '</td>' +
        celulaPct +
        '<td class="dca-verba" style="font-weight:bold; color:#166534;">' + formatarMoeda(0) + '</td>' +
        '<td style="color:#334155;">' + nomeParaExibicao(nomeAnalista) + '</td>' +
        '</tr>';
}

// Recalcula a Verba de TODAS as Etapas de uma vez, e o % automático do
// Fundo Garantidor (= 100% − soma das % das Etapas) — necessário
// porque mudar o % de UMA Etapa muda o % do Fundo Garantidor (afeta a
// Verba dele) e o total da coluna, não só a própria linha editada.
// Mesma fórmula de calcularVerbaPorEtapa() (abaixo), só que lendo os
// %'s AO VIVO desta própria tabela (ainda não salvos) em vez dos já
// salvos em banco_distribuicao_custos_analista.
function recalcularTabelaDistribuicaoAnalista() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    // Pedido do usuário (soma na base da coluna) — só das Etapas, o
    // Fundo Garantidor não entra (ele É o que sobra dessa soma).
    let totalPct = 0;
    let totalVerba = 0;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inputPct => {
        const pctEtapa = parseFloat(inputPct.value) || 0;
        const verba = pctEtapa / 100 * valorAnalistaTotal;
        totalPct += pctEtapa;
        totalVerba += verba;

        const linha = inputPct.closest('tr');
        const celulaVerba = linha ? linha.querySelector('.dca-verba') : null;
        if (celulaVerba) celulaVerba.innerText = formatarMoeda(verba);
    });

    // Fundo Garantidor: % automático (100% − soma das Etapas) — pode
    // ficar NEGATIVO se as Etapas sozinhas já passarem de 100%, o que
    // é um alerta pro usuário corrigir, não um erro silencioso.
    const pctFundoGarantidor = 100 - totalPct;
    const verbaFundoGarantidor = pctFundoGarantidor / 100 * valorAnalistaTotal;
    const linhaFundo = document.querySelector('#dca-tabela-body tr[data-fundo-garantidor-linha]');
    if (linhaFundo) {
        const celulaPctFundo = document.getElementById('dca-pct-fundo-garantidor');
        const celulaVerbaFundo = linhaFundo.querySelector('.dca-verba');
        if (celulaPctFundo) celulaPctFundo.innerText = pctFundoGarantidor.toFixed(2) + '%';
        if (celulaVerbaFundo) celulaVerbaFundo.innerText = formatarMoeda(verbaFundoGarantidor);
    }

    // Coparticipação de Escritório/Supervisão no Detalhamento (Item 4
    // da Aba 1) — mesma fórmula de calcularVerbaDetalhamentoPuro(),
    // usando o % de Detalhamento AO VIVO desta tabela (não o salvo),
    // pra atualizar em tempo real enquanto o usuário digita. Nunca
    // entra em totalPct/totalVerba — vem de um bolo diferente
    // (Escritório/Supervisor, não o do Analista).
    const pctCoparticipacaoSupervisor = parseFloat(document.getElementById('dc-pct-coparticipacao-supervisor').value) || 0;
    const pctCoparticipacaoEscritorio = parseFloat(document.getElementById('dc-pct-coparticipacao-escritorio').value) || 0;
    const inputDetalhamento = Array.from(document.querySelectorAll('#dca-tabela-body .dca-input-pct')).find(el => el.dataset.etapa.toLowerCase().includes('detalhamento'));
    const pctDetalhamentoAoVivo = inputDetalhamento ? (parseFloat(inputDetalhamento.value) || 0) : 0;
    const { verbaEscritorio, verbaSupervisor } = calcularVerbaDetalhamentoPuro(pctAnalista, pctCoparticipacaoSupervisor, pctCoparticipacaoEscritorio, valorAnalistaTotal, pctDetalhamentoAoVivo);

    const elCopSupPct = document.getElementById('dca-copart-supervisor-pct');
    const elCopSupVerba = document.getElementById('dca-copart-supervisor-verba');
    if (elCopSupPct) elCopSupPct.innerText = pctCoparticipacaoSupervisor.toFixed(2) + '%';
    if (elCopSupVerba) elCopSupVerba.innerText = formatarMoeda(verbaSupervisor);

    const elCopEscPct = document.getElementById('dca-copart-escritorio-pct');
    const elCopEscVerba = document.getElementById('dca-copart-escritorio-verba');
    if (elCopEscPct) elCopEscPct.innerText = pctCoparticipacaoEscritorio.toFixed(2) + '%';
    if (elCopEscVerba) elCopEscVerba.innerText = formatarMoeda(verbaEscritorio);

    // Linha de totalização (pedido do usuário) — só a soma das Etapas.
    const elTotalPct = document.getElementById('dca-total-pct');
    const elTotalVerba = document.getElementById('dca-total-verba');
    if (elTotalPct) elTotalPct.innerText = totalPct.toFixed(2) + '%';
    if (elTotalVerba) elTotalVerba.innerText = formatarMoeda(totalVerba);

    // Total Geral = Etapas + Fundo Garantidor — por construção sempre
    // fecha em 100% / Parcela Global inteira (é só uma conferência
    // visual pro usuário, os dois lados do "bolo").
    const elTotalGeralPct = document.getElementById('dca-total-geral-pct');
    const elTotalGeralVerba = document.getElementById('dca-total-geral-verba');
    if (elTotalGeralPct) elTotalGeralPct.innerText = (totalPct + pctFundoGarantidor).toFixed(2) + '%';
    if (elTotalGeralVerba) elTotalGeralVerba.innerText = formatarMoeda(totalVerba + verbaFundoGarantidor);

    // Pedido do usuário: não permitir que a soma das Etapas ultrapasse
    // 100% — trava o botão aqui (feedback imediato); a trava real
    // (que impede salvar mesmo burlando o botão) está em
    // salvarDistribuicaoAnalista().
    const btnSalvar = document.getElementById('dca-btn-salvar');
    if (btnSalvar) btnSalvar.disabled = totalPct > 100.01;

    const alerta = document.getElementById('dca-alerta-soma');
    if (alerta) {
        if (totalPct > 100.01) {
            alerta.style.background = '#fef2f2'; alerta.style.color = '#991b1b';
            alerta.innerHTML = '🚫 As Etapas somam ' + totalPct.toFixed(2) + '% — não é permitido ultrapassar 100%. Ajuste os percentuais das Etapas para salvar.';
        } else if (totalPct === 0) {
            alerta.innerHTML = '';
        } else {
            alerta.style.background = '#f0fdf4'; alerta.style.color = '#166534';
            alerta.innerHTML = '✅ Etapas somam ' + totalPct.toFixed(2) + '% — Fundo Garantidor fica com ' + pctFundoGarantidor.toFixed(2) + '%.';
        }
    }
}

function salvarDistribuicaoAnalista() {
    // Trava real (não só o botão desabilitado) — mesmo padrão de defesa
    // em profundidade já usado em outras telas.
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto na aba "Orçamento Global" primeiro.');

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const dadosEtapas = {};

    // Trava real (não só o botão desabilitado) — pedido do usuário:
    // "não permita que a soma das etapas supere 100%".
    let totalPct = 0;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inputPct => {
        totalPct += parseFloat(inputPct.value) || 0;
    });
    if (totalPct > 100.01) return alert('As Etapas somam ' + totalPct.toFixed(2) + '% — não é permitido ultrapassar 100%. Ajuste os percentuais antes de salvar.');

    // Só as Etapas têm `<input>` de % agora — a linha do Fundo
    // Garantidor não tem mais (o % dela é automático, `100% − soma das
    // Etapas`, recalculado sempre que precisa, nunca salvo à parte).
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inputPct => {
        dadosEtapas[inputPct.dataset.etapa] = { pct: inputPct.value };
    });

    salvos[nomeProjeto] = { etapas: dadosEtapas };
    localStorage.setItem('banco_distribuicao_custos_analista', JSON.stringify(salvos));
    alert('Distribuição por etapa salva para "' + nomeProjeto + '".');
}

// --- CÁLCULO COMPARTILHADO: FÓRMULA ESPECIAL DA ETAPA "DETALHAMENTO" ---
// Fórmula pura (não depende de DOM nem localStorage, só dos números que
// recebe) — chamada de dentro de calcularVerbaPorEtapa/calcularVerbaPorEtapaSalvo
// (abaixo), só para a Etapa cujo nome contém "Detalhamento" (regra de
// negócio: essa Etapa pode ter custo compartilhado com Escritório e
// Supervisor via COPARTICIPAÇÃO; as demais Etapas usam só a fatia do
// Analista).
//
// Reforma de 2026-08-17 (Item 4, "Coparticipações no Detalhamento" —
// Aba 1/Orçamento Global): ANTES, Escritório/Supervisor participavam do
// Detalhamento pela MESMA % geral deles no projeto inteiro (`%Escritório`/
// `%Supervisor` do item 3, fixa, valia igual pra todo projeto). Pedido
// explícito do usuário: em alguns projetos existe coparticipação, em
// outros não — precisa ser configurável POR PROJETO, independente do %
// geral. Agora usa 2 campos NOVOS e SEPARADOS
// (`pctCoparticipacaoSupervisor`/`pctCoparticipacaoEscritorio`, Item 4),
// que NÃO herdam do % geral — só ficam disponíveis pra editar quando o
// % geral correspondente (item 3) não é 0% (trava aplicada em
// recalcularDistribuicaoCustos(), não aqui — esta função só calcula).
function calcularVerbaDetalhamentoPuro(pctAnalista, pctCoparticipacaoSupervisor, pctCoparticipacaoEscritorio, valorAnalistaTotal, pctDetalhamento) {
    const verbaAnalista = pctDetalhamento / 100 * valorAnalistaTotal;

    const verbaEscritorio = pctAnalista > 0 ? verbaAnalista * (pctCoparticipacaoEscritorio / pctAnalista) : 0;
    const verbaSupervisor = pctAnalista > 0 ? verbaAnalista * (pctCoparticipacaoSupervisor / pctAnalista) : 0;
    const verbaTotal = verbaAnalista + verbaEscritorio + verbaSupervisor;

    return { verbaAnalista, verbaEscritorio, verbaSupervisor, verbaTotal };
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
// partir do que já está salvo, pra outras telas). Verba de TODA Etapa
// (Detalhamento incluída) é sempre %etapa × Parcela Global — SEM
// desconto nenhum (Fundo Garantidor não desconta mais de cada Etapa,
// voltou a ser uma fatia própria do mesmo bolo de 100% — ver
// recalcularTabelaDistribuicaoAnalista(), acima) e SEM Coparticipação
// de Escritório/Supervisor somada (isso é um valor à parte, só
// preview na Aba 1 — ver recalcularDistribuicaoCustos()).
function calcularVerbaPorEtapa(nomeProjeto) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;

    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;

    return etapas.map(etapa => {
        const dadosEtapa = salvoEtapas[etapa.nome];
        const pctEtapa = (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
        const ehDetalhamento = etapa.nome.toLowerCase().includes('detalhamento');

        const verba = pctEtapa / 100 * valorAnalistaTotal;

        return { nome: etapa.nome, no: etapa, ehDetalhamento, pctEtapa, verbaBruta: verba, verbaLiquida: verba };
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

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;
    const valorLiquido = valorContrato - (pctImpostos / 100 * valorContrato);
    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;

    return etapas.map(etapa => {
        const dadosEtapa = salvoEtapas[etapa.nome];
        const pctEtapa = (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
        const ehDetalhamento = etapa.nome.toLowerCase().includes('detalhamento');

        // Verba da Etapa é SEMPRE %etapa × Parcela Global — sem desconto
        // de Fundo Garantidor (voltou a ser fatia própria do mesmo
        // bolo, não desconta mais de cada Etapa) nem Coparticipação
        // (valor à parte, só preview na Aba 1).
        const verba = pctEtapa / 100 * valorAnalistaTotal;

        return { nome: etapa.nome, no: etapa, ehDetalhamento, pctEtapa, verbaBruta: verba, verbaLiquida: verba };
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
    if (inputFundoLucros) {
        inputFundoLucros.value = obterPctFundoLucrosPavimento(nomeProjeto);
        formatarCampoPercentual(inputFundoLucros);
    }
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

// Pedido do usuário: Pavimentos lado a lado (2 ou 3, conforme a
// largura da tela — ver .vt-grid no CSS) em vez de uma tabela única
// empilhada, cada um em seu próprio "cartão", com submenu de Tarefas
// RECOLHIDO por padrão (ver vtGruposRecolhidos abaixo).
function carregarAbaVerbaPorTarefa() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    document.getElementById('vt-projeto-ref').innerText = nomeProjeto;
    const { pavimentos } = calcularListaPavimentosComVerba(nomeProjeto);
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const podeAtribuir = podeAtribuirExecutorDistribuicaoCustos();

    const grid = document.getElementById('vt-grid-pavimentos');
    const pavimentosComTarefas = pavimentos.filter(p => p.tarefas.length > 0);

    if (pavimentosComTarefas.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma tarefa plugada em nenhum pavimento deste projeto ainda.</div>';
        return;
    }

    grid.innerHTML = pavimentosComTarefas.map(pav => {
        // Melhoria #6 (prompt_gemini.md §12): cabeçalho de grupo próprio
        // — permite recolher/expandir, mesmo padrão visual (▼/►) já
        // usado na Árvore, com estado próprio desta aba
        // (vtGruposRecolhidos). Reforma de 2026-08-17: RECOLHIDO é
        // agora o padrão (valor `undefined`, nunca tocado, conta como
        // recolhido) — só um clique explícito guarda `false` (expandido).
        const recolhido = vtGruposRecolhidos[pav.caminho] !== false;
        const seta = recolhido ? '►' : '▼';
        const estiloOcultoSeRecolhido = recolhido ? ' style="display:none;"' : '';

        let linhasTarefas = '';
        pav.tarefas.forEach((tarefa, idxTarefa) => {
            const pontos = parseFloat(tarefa.pontos) || 0;
            const caminhoJs = (pav.caminho + '-' + idxTarefa);
            // `vt-select-executor` (classe) é usada por
            // aplicarSomenteLeituraDistribuicaoCustos() pra saber que
            // ESTE campo específico não deve ser desabilitado pro
            // Supervisor, mesmo com o resto da tela travada pra ele.
            const opcoesExecutor = typeof construirOpcoesExecutor === 'function' ? construirOpcoesExecutor(funcionarios, tarefa.executor) : '';

            linhasTarefas += '<tr class="vt-linha-tarefa" data-grupo="' + pav.caminho + '" data-valor-verba="' + pav.valorVerba + '"' + estiloOcultoSeRecolhido + '>' +
                '<td>' + tarefa.nome + '</td>' +
                '<td><select class="vt-select-executor" data-caminho="' + caminhoJs + '" onchange="atribuirExecutorVerbaPorTarefa(this)"' + (podeAtribuir ? '' : ' disabled title="Só Administrador ou Supervisor podem atribuir executor por aqui"') + '>' + opcoesExecutor + '</select></td>' +
                '<td class="vt-horas-maximas col-centralizada">—</td>' +
                '<td class="col-centralizada"><input type="number" step="0.1" class="vt-input-pontos" data-caminho="' + caminhoJs + '" value="' + pontos + '" style="width:50px; border:1px solid #cbd5e1; border-radius:4px; padding:2px;" oninput="recalcularGrupoVerbaPorTarefa(this)" onchange="editarPontosVerbaPorTarefa(this)"></td>' +
                '<td class="vt-valor" style="font-weight:bold; color:#166534;"></td>' +
                '</tr>';
        });

        // Subtotal fica SEMPRE visível (mesmo com o grupo recolhido) —
        // é o resumo útil que justifica nem precisar expandir. Só a
        // linha de conferência (texto auxiliar) some junto com as
        // Tarefas, por ser detalhe, não resumo.
        return '<div class="vt-card">' +
            '<div class="vt-card-header" onclick="alternarGrupoVerbaPorTarefa(\'' + pav.caminho + '\')"><span class="tree-toggle-icon">' + seta + '</span> ' + pav.nome + '</div>' +
            '<div class="table-wrapper"><table class="tabela-compacta"><thead><tr>' +
                '<th>Tarefa</th><th style="width:120px;">Executor</th><th class="col-centralizada" style="width:55px;">H.Máx</th><th class="col-centralizada" style="width:55px;">Pontos</th><th style="width:100px;">Valor</th>' +
            '</tr></thead><tbody>' +
                linhasTarefas +
                '<tr style="background:#f8fafc;" data-subtotal-grupo="' + pav.caminho + '">' +
                    '<td colspan="3"></td>' +
                    '<td style="text-align:right; font-weight:bold; white-space:nowrap;">Subtotal:</td>' +
                    '<td class="vt-subtotal" style="font-weight:bold; color:#0a192f;"></td>' +
                '</tr>' +
                '<tr class="vt-linha-tarefa" data-conferencia-grupo="' + pav.caminho + '"' + estiloOcultoSeRecolhido + '><td colspan="5" class="vt-conferencia" style="font-size:11px; padding:4px 8px;"></td></tr>' +
            '</tbody></table></div>' +
            '</div>';
    }).join('');

    // Preenche a coluna Valor, Horas Máximas, o subtotal e a conferência de
    // todos os grupos — roda em TODAS as linhas de Tarefa, mesmo as
    // ocultas por recolhimento (display:none não impede o cálculo, só a
    // exibição; reabrir o grupo já mostra os valores certos na hora).
    document.querySelectorAll('#vt-grid-pavimentos .vt-input-pontos').forEach(recalcularGrupoVerbaPorTarefa);
}

// Estado de recolhimento por grupo (Pavimento) desta aba — em memória,
// reseta ao trocar de projeto/aba (não precisa persistir). Convenção:
// `undefined` (nunca clicado) = RECOLHIDO (padrão, pedido do
// usuário); só um `false` explícito (usuário clicou pra abrir) conta
// como expandido — ver `recolhido` em carregarAbaVerbaPorTarefa().
let vtGruposRecolhidos = {};

function alternarGrupoVerbaPorTarefa(caminhoGrupo) {
    const estaRecolhido = vtGruposRecolhidos[caminhoGrupo] !== false;
    vtGruposRecolhidos[caminhoGrupo] = estaRecolhido ? false : true;
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
    const linhasDoGrupo = Array.from(document.querySelectorAll('#vt-grid-pavimentos tr[data-grupo="' + grupo + '"]'));
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

    const linhaSubtotal = document.querySelector('#vt-grid-pavimentos tr[data-subtotal-grupo="' + grupo + '"] .vt-subtotal');
    if (linhaSubtotal) linhaSubtotal.innerText = formatarMoeda(subtotal);

    const linhaConferencia = document.querySelector('#vt-grid-pavimentos tr[data-conferencia-grupo="' + grupo + '"] .vt-conferencia');
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

// Pedido do usuário: campos percentuais editáveis da Distribuição de
// Custos sempre com 2 casas decimais (o "%" em si é só o <span
// class="sufixo-pct"> ao lado — ver .campo-percentual no CSS; o valor
// do <input> continua puro, parseFloat funciona igual).
function formatarCampoPercentual(el) {
    el.value = (parseFloat(el.value) || 0).toFixed(2);
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
        // Item 4 (reforma de 2026-08-17): coparticipação NÃO herda do %
        // geral do item 3 (pedido explícito do usuário) — sempre começa
        // do que já foi salvo pra ela mesma, ou '0' se nunca foi
        // preenchida (projeto sem coparticipação por padrão).
        document.getElementById('dc-pct-coparticipacao-supervisor').value = salvo.pct_coparticipacao_supervisor || '0';
        document.getElementById('dc-pct-coparticipacao-escritorio').value = salvo.pct_coparticipacao_escritorio || '0';
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
        document.getElementById('dc-pct-coparticipacao-supervisor').value = '0';
        document.getElementById('dc-pct-coparticipacao-escritorio').value = '0';
    }

    // Pedido do usuário: campos percentuais editáveis sempre com 2
    // casas decimais, já ao carregar o projeto (não só depois de um
    // blur manual do usuário).
    ['dc-pct-impostos', 'dc-pct-analista', 'dc-pct-supervisor', 'dc-pct-escritorio', 'dc-pct-coparticipacao-supervisor', 'dc-pct-coparticipacao-escritorio']
        .forEach(id => formatarCampoPercentual(document.getElementById(id)));

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

    const valorAnalistaTotal = pctAnalista / 100 * valorLiquido;
    document.getElementById('dc-valor-analista').value = formatarMoeda(valorAnalistaTotal);
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

    // Item 4 (reforma de 2026-08-17): trava o campo de coparticipação
    // quando o % geral (item 3) correspondente é 0% — pedido explícito
    // do usuário ("necessariamente não haverá coparticipação"). Força
    // o valor pra '0' ao travar, pra nunca deixar um valor escondido
    // não-zero atrás de um campo desabilitado influenciando o cálculo.
    const inputCoparticipacaoSupervisor = document.getElementById('dc-pct-coparticipacao-supervisor');
    const inputCoparticipacaoEscritorio = document.getElementById('dc-pct-coparticipacao-escritorio');
    inputCoparticipacaoSupervisor.disabled = (pctSupervisor === 0);
    if (inputCoparticipacaoSupervisor.disabled) { inputCoparticipacaoSupervisor.value = '0'; formatarCampoPercentual(inputCoparticipacaoSupervisor); }
    inputCoparticipacaoEscritorio.disabled = (pctEscritorio === 0);
    if (inputCoparticipacaoEscritorio.disabled) { inputCoparticipacaoEscritorio.value = '0'; formatarCampoPercentual(inputCoparticipacaoEscritorio); }

    // Valor Coparticipação (preview) — mesma fórmula de
    // calcularVerbaDetalhamentoPuro() (abaixo), só que pra pré-visualizar
    // aqui na aba 1 antes mesmo de ir na aba 2. Precisa buscar a %
    // salva da Etapa "Detalhamento" (aba 2/`banco_distribuicao_custos_analista`)
    // — se o projeto ainda não tem árvore ou essa % nunca foi salva,
    // mostra R$ 0,00 (comportamento normal, não é erro).
    const pctCoparticipacaoSupervisor = parseFloat(inputCoparticipacaoSupervisor.value) || 0;
    const pctCoparticipacaoEscritorio = parseFloat(inputCoparticipacaoEscritorio.value) || 0;
    const pctEtapaDetalhamento = obterPctEtapaDetalhamentoSalvo(nomeProjeto);
    const verbaAnalistaDetalhamento = pctEtapaDetalhamento / 100 * valorAnalistaTotal;

    const valorCoparticipacaoSupervisor = pctAnalista > 0 ? verbaAnalistaDetalhamento * (pctCoparticipacaoSupervisor / pctAnalista) : 0;
    const valorCoparticipacaoEscritorio = pctAnalista > 0 ? verbaAnalistaDetalhamento * (pctCoparticipacaoEscritorio / pctAnalista) : 0;
    document.getElementById('dc-valor-coparticipacao-supervisor').value = formatarMoeda(valorCoparticipacaoSupervisor);
    document.getElementById('dc-valor-coparticipacao-escritorio').value = formatarMoeda(valorCoparticipacaoEscritorio);
}

// Busca a % já salva da Etapa "Detalhamento" (aba 2 — banco_distribuicao_custos_analista),
// usada tanto pelo preview do item 4 (acima) quanto pela fórmula real
// de calcularVerbaDetalhamentoPuro() via calcularVerbaPorEtapa(Salvo)().
// Retorna 0 se o projeto não tem árvore, não tem Etapa "Detalhamento",
// ou essa % nunca foi salva — comportamento normal (ainda não configurado),
// não é erro.
function obterPctEtapaDetalhamentoSalvo(nomeProjeto) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];
    const etapaDetalhamento = etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));
    if (!etapaDetalhamento) return 0;

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
    const dadosEtapa = salvoEtapas[etapaDetalhamento.nome];
    return (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
}

function salvarDistribuicaoCustos() {
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto antes de salvar.');

    const pctImpostos = document.getElementById('dc-pct-impostos').value;
    const pctAnalista = document.getElementById('dc-pct-analista').value;
    const pctSupervisor = document.getElementById('dc-pct-supervisor').value;
    const pctEscritorio = document.getElementById('dc-pct-escritorio').value;
    const pctCoparticipacaoSupervisor = document.getElementById('dc-pct-coparticipacao-supervisor').value;
    const pctCoparticipacaoEscritorio = document.getElementById('dc-pct-coparticipacao-escritorio').value;

    const todasDistribuicoes = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    todasDistribuicoes[nomeProjeto] = {
        pct_impostos: pctImpostos,
        pct_analista: pctAnalista,
        pct_supervisor: pctSupervisor,
        pct_escritorio: pctEscritorio,
        pct_coparticipacao_supervisor: pctCoparticipacaoSupervisor,
        pct_coparticipacao_escritorio: pctCoparticipacaoEscritorio
    };
    localStorage.setItem('banco_distribuicao_custos', JSON.stringify(todasDistribuicoes));
    localStorage.setItem('banco_ultimo_percentual_impostos', pctImpostos);

    alert('Distribuição salva para "' + nomeProjeto + '".');
}
