// =========================================================================
// MÓDULO: DISTRIBUIÇÃO DE CUSTOS
//
// Aba 1 "Orçamento Global": pega o valor do contrato do projeto cadastrado,
// aplica um percentual de impostos pra achar o valor líquido, e distribui
// esse líquido entre Analista/Supervisor/Escritório por percentual editável.
//
// Aba 2 "Distribuição de Custos Analista": tabela com uma linha por Etapa
// da árvore do projeto + uma linha fixa "Fundo Garantidor" no final. Só
// pode ser aberta com um projeto já selecionado na aba 1 (bloqueado em
// alternarAbaDistribuicao). Responsável não é editável — sempre reproduz
// o Analista designado no cadastro do projeto.
//
// Aba 3 "Verba para Detalhamento": estrutura pronta, conteúdo ainda não
// definido (aguardando decisão).
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
    // `#dc-projeto` (dropdown usado DENTRO da aba Orçamento Global)
    // continua como select — fora do escopo dessa melhoria. Pedido do
    // usuário (mais recente): depois que o projeto já foi escolhido
    // (pelo portal ou pela orelha), esse campo fica desabilitado — só
    // mostra qual projeto está ativo, não dá mais pra trocar por ele
    // (ver escolherProjetoDistribuicaoInicial()). Trocar de projeto de
    // verdade é só pelo botão "🔁 Trocar Projeto".
    dcPortalProjetosCache = projetos;
    renderizarPortalProjetosDistribuicao(projetos);
    document.getElementById('dc-portal-busca-projeto').value = '';

    const opcoesHtml = '<option value="">-- Selecione um Projeto --</option>' +
        projetos.map(p => '<option value="' + escapeHtml(p.nome) + '">' + escapeHtml(p.nome) + '</option>').join('');
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
        tbody.innerHTML += '<tr class="clickable-row" onclick="escolherProjetoDistribuicaoInicial(\'' + nomeJs + '\')"><td># <strong>' + escapeHtml(proj.prefixo || "PRJ") + '</strong></td><td>' + escapeHtml(proj.nome) + '</td></tr>';
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
    document.getElementById('dc-projeto').disabled = false; // reabilita pro próximo projeto escolhido pelo portal
    // Sem projeto escolhido, some a barra de orelhas e o título volta a
    // ser o genérico da tela.
    document.getElementById('page-context-title').innerText = "Distribuição de Custos";
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo('', null);
}

// Chamada ao clicar numa linha da lista do portal — escolher um projeto
// ali libera as abas (que já vêm com o mesmo projeto pré-selecionado no
// #dc-projeto de dentro do "Orçamento Global", sem precisar escolher de
// novo).
function escolherProjetoDistribuicaoInicial(nomeProjeto) {
    if (!nomeProjeto) return;
    document.getElementById('dc-projeto').value = nomeProjeto;
    // Pedido do usuário: uma vez que o projeto já foi escolhido (pelo
    // portal, ou direto pela orelha "Custos" vindo da Árvore), o campo
    // Projeto vira só uma exibição — não faz sentido trocar de projeto
    // por ele no meio da tela. Trocar de projeto de verdade é só pelo
    // botão "🔁 Trocar Projeto" (volta pro portal via
    // voltarParaPortalSelecaoProjeto(), que reabilita este campo).
    document.getElementById('dc-projeto').disabled = true;
    document.getElementById('dc-portal-selecao-projeto').style.display = 'none';
    document.getElementById('dc-conteudo-principal').style.display = 'block';
    // Pedido do usuário: título principal + orelhas (Estrutura de
    // Projeto/Custos) — cobre também quem escolhe o projeto DIRETO por
    // aqui (portal desta aba), sem passar pela Árvore antes.
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nomeProjeto, 'custos');
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

// --- ABA 2: DISTRIBUIÇÃO DE CUSTOS ANALISTA (tabela por Etapa) ---
// Usa o mesmo projeto selecionado na aba 1, e o "Valor Analista" já
// calculado lá (% Analista sobre o Valor Líquido) como base pra rateio
// entre as Etapas da árvore desse projeto. A coluna Responsável não é mais
// editável por linha: ela sempre reproduz o Analista designado no cadastro
// do projeto (campo "analista" de banco_projetos), já que é a mesma pessoa
// em todas as etapas do mesmo projeto.
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

    document.getElementById('dca-valor-analista-ref').value = formatarMoeda(dcaValorAnalistaAtual);

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
    const rotulo = ehFundoGarantidor ? '💰 <i>Fundo Garantidor</i>' : (ehDetalhamento ? 'Verba Detalhamento - Analista' : escapeHtml(nomeLinha));

    let celulaPct;
    if (ehFundoGarantidor) {
        // Pedido do usuário: caixa com borda do MESMO tamanho da caixa
        // do campo % editável (.campo-percentual, 80px) — precisa ser
        // um <span> interno, não a borda direto no <td>: sob
        // table-layout:fixed a largura do <td> é travada pela largura
        // da COLUNA (declarada no <th>), um `width` direto no <td> não
        // tem efeito nenhum.
        celulaPct = '<td class="col-centralizada"><span id="dca-pct-fundo-garantidor" class="campo-somente-leitura-borda" style="font-weight:bold;">0.00%</span></td>';
    } else {
        const pct = dadosSalvos.pct !== undefined ? dadosSalvos.pct : (pctSugerido !== undefined ? pctSugerido : '');
        const pctFormatado = pct === '' ? '' : (parseFloat(pct) || 0).toFixed(2);
        celulaPct = '<td><div class="campo-percentual" style="width:80px;"><input type="number" step="0.01" class="dca-input-pct" data-etapa="' + escapeHtml(nomeLinha) + '" value="' + pctFormatado + '" oninput="recalcularTabelaDistribuicaoAnalista()" onblur="formatarCampoPercentual(this)"><span class="sufixo-pct">%</span></div></td>';
    }

    const marcadorLinha = ehFundoGarantidor ? ' data-fundo-garantidor-linha="1"' : '';
    return '<tr' + estiloLinha + marcadorLinha + '>' +
        '<td>' + rotulo + '</td>' +
        celulaPct +
        '<td class="dca-verba" style="font-weight:bold; color:#166534;">' + formatarMoeda(0) + '</td>' +
        '<td style="color:#334155;">' + escapeHtml(nomeParaExibicao(nomeAnalista)) + '</td>' +
        '</tr>';
}

// Melhoria #15 (prompt_gemini.md §12): mesma checagem/estilo de soma
// 100% que a aba Orçamento Global já tem (recalcularDistribuicaoCustos)
// — soma de TODAS as linhas visíveis (Etapas + Fundo Garantidor), já
// que juntas elas dividem 100% do Valor destinado ao Analista.
function recalcularSomaPercentuaisAnalista() {
    const alerta = document.getElementById('dca-alerta-soma');
    if (!alerta) return;

    let soma = 0;
    document.querySelectorAll('#dca-tabela-body .dca-input-pct').forEach(inp => {
        soma += parseFloat(inp.value) || 0;
    });

    if (soma === 0) {
        alerta.innerHTML = '';
    } else if (Math.abs(soma - 100) < 0.01) {
        alerta.style.background = '#f0fdf4'; alerta.style.color = '#166534';
        alerta.innerHTML = '✅ Percentuais somam 100%.';
    } else {
        alerta.style.background = '#fef9c3'; alerta.style.color = '#854d0e';
        alerta.innerHTML = '⚠️ Percentuais somam ' + soma.toFixed(2) + '% (não fecham 100%). Isso não impede salvar, mas confira se é intencional.';
    }
}

function recalcularLinhaDistribuicaoAnalista(inputEl) {
    const pct = parseFloat(inputEl.value) || 0;
    const verba = pct / 100 * dcaValorAnalistaAtual;
    const linha = inputEl.closest('tr');
    linha.querySelector('.dca-verba').innerText = formatarMoeda(verba);
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

// --- CÁLCULO COMPARTILHADO: VERBA PARA DETALHAMENTO ---
// A fórmula em si é pura (calcularVerbaDetalhamentoPuro) — não depende de
// DOM nem de localStorage, só dos números que recebe. Duas funções por
// cima dela buscam esses números de lugares diferentes:
// - calcularVerbaDetalhamento(nomeProjeto): lê os percentuais da aba 1 AO
//   VIVO do DOM (preview em tempo real antes de salvar). Usada pelas
//   próprias abas 3/4/5 da Distribuição de Custos.
// - calcularVerbaDetalhamentoSalvo(nomeProjeto): lê os percentuais JÁ
//   SALVOS em 'banco_distribuicao_custos' (sem tocar no DOM). Usada por
//   telas fora da Distribuição de Custos, como a Atribuição de Tarefas,
//   que precisa calcular a verba de tarefas de VÁRIOS projetos ao mesmo
//   tempo — nenhum deles necessariamente "aberto" na tela.
function calcularVerbaDetalhamentoPuro(pctAnalista, pctCoparticipacaoSupervisor, pctCoparticipacaoEscritorio, valorAnalistaTotal, pctDetalhamento) {
    const verbaAnalista = pctDetalhamento / 100 * valorAnalistaTotal;

    const verbaEscritorio = pctAnalista > 0 ? verbaAnalista * (pctCoparticipacaoEscritorio / pctAnalista) : 0;
    const verbaSupervisor = pctAnalista > 0 ? verbaAnalista * (pctCoparticipacaoSupervisor / pctAnalista) : 0;
    const verbaTotal = verbaAnalista + verbaEscritorio + verbaSupervisor;

    return { verbaAnalista, verbaEscritorio, verbaSupervisor, verbaTotal };
}

// Busca o % Detalhamento salvo (aba 2) e monta o aviso, se faltar algo —
// usado pelas duas variantes abaixo, que só diferem em ONDE buscam os
// percentuais de impostos/analista/supervisor/escritório (aba 1).
function buscarPctDetalhamentoEAviso(nomeProjeto) {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = arvores[nomeProjeto];
    const etapas = (arv && Array.isArray(arv.etapas)) ? arv.etapas : [];
    const etapaDetalhamento = etapas.find(e => e.nome.toLowerCase().includes('detalhamento'));

    if (!etapaDetalhamento) {
        return { pctDetalhamento: 0, aviso: '⚠️ Nenhuma etapa com "Detalhamento" no nome foi encontrada na árvore deste projeto. Verba Analista considerada R$ 0,00.' };
    }

    const salvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
    const salvoProjeto = salvos[nomeProjeto] || {};
    const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
    const dadosDetalhamento = salvoEtapas[etapaDetalhamento.nome];

    if (!dadosDetalhamento || dadosDetalhamento.pct === undefined || dadosDetalhamento.pct === '') {
        return { pctDetalhamento: 0, aviso: '⚠️ A etapa "' + etapaDetalhamento.nome + '" ainda não tem percentual salvo na aba "Distribuição de Custos Analista". Preencha e salve lá primeiro. Verba Analista considerada R$ 0,00 por enquanto.' };
    }

    return { pctDetalhamento: parseFloat(dadosDetalhamento.pct) || 0, aviso: '' };
}

function calcularVerbaDetalhamento(nomeProjeto) {
    const pctAnalista = parseFloat(document.getElementById('dc-pct-analista').value) || 0;
    const pctSupervisor = parseFloat(document.getElementById('dc-pct-supervisor').value) || 0;
    const pctEscritorio = parseFloat(document.getElementById('dc-pct-escritorio').value) || 0;
    const pctImpostos = parseFloat(document.getElementById('dc-pct-impostos').value) || 0;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const { pctDetalhamento, aviso } = buscarPctDetalhamentoEAviso(nomeProjeto);

    const lucrosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_lucros')) || {};
    const pctLucros = (lucrosSalvos[nomeProjeto] && parseFloat(lucrosSalvos[nomeProjeto].pct)) || 0;

    return calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctDetalhamento, pctLucros, aviso);
}

function calcularVerbaDetalhamentoSalvo(nomeProjeto) {
    const orcamentosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
    const orcamento = orcamentosSalvos[nomeProjeto] || {};
    const pctImpostos = parseFloat(orcamento.pct_impostos) || 0;
    const pctAnalista = parseFloat(orcamento.pct_analista) || 0;
    const pctSupervisor = parseFloat(orcamento.pct_supervisor) || 0;
    const pctEscritorio = parseFloat(orcamento.pct_escritorio) || 0;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projeto = projetos.find(p => p.nome === nomeProjeto);
    const valorContrato = projeto ? (parseFloat(projeto.valor) || 0) : 0;

    const { pctDetalhamento, aviso } = buscarPctDetalhamentoEAviso(nomeProjeto);

    const lucrosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_lucros')) || {};
    const pctLucros = (lucrosSalvos[nomeProjeto] && parseFloat(lucrosSalvos[nomeProjeto].pct)) || 0;

    return calcularVerbaDetalhamentoPuro(valorContrato, pctImpostos, pctAnalista, pctSupervisor, pctEscritorio, pctDetalhamento, pctLucros, aviso);
}

// --- ABA 3: VERBA PARA DETALHAMENTO ---
// Tudo aqui é calculado, sem campo editável (exceto % Distribuição
// Lucros) — não guarda nada em localStorage próprio além disso, sempre
// deriva ao vivo da aba 1 (percentuais) e da aba 2 (percentual salvo na
// etapa cujo nome contém "Detalhamento").
let vdVerbaTotalAtual = 0;

function carregarAbaVerbaDetalhamento() {
    const nomeProjeto = document.getElementById('dc-projeto').value;
    document.getElementById('vd-projeto-ref').innerText = nomeProjeto;
    const aviso = document.getElementById('vd-aviso');

    const r = calcularVerbaDetalhamento(nomeProjeto);

    if (r.avisoDetalhamento) {
        aviso.style.display = 'block';
        aviso.innerHTML = r.avisoDetalhamento;
    } else {
        aviso.style.display = 'none';
        aviso.innerHTML = '';
    }

    document.getElementById('vd-verba-analista').innerText = formatarMoeda(r.verbaAnalista);
    document.getElementById('vd-verba-escritorio').innerText = formatarMoeda(r.verbaEscritorio);
    document.getElementById('vd-verba-supervisor').innerText = formatarMoeda(r.verbaSupervisor);
    document.getElementById('vd-verba-total').innerText = formatarMoeda(r.verbaTotal);

    vdVerbaTotalAtual = r.verbaTotal;

    const lucrosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_lucros')) || {};
    // Melhoria #16 (prompt_gemini.md §12): padrão 10% (editável) quando
    // o projeto ainda não tem nada salvo pra esse percentual.
    const pctLucrosSalvo = (lucrosSalvos[nomeProjeto] && lucrosSalvos[nomeProjeto].pct !== undefined) ? lucrosSalvos[nomeProjeto].pct : '10';
    document.getElementById('vd-pct-lucros').value = pctLucrosSalvo;

    recalcularDistribuicaoLucros();
}

// --- DISTRIBUIÇÃO DE LUCROS ---
// Fundo de distribuição de lucros (ou compensação de prejuízos), formado
// por um percentual — definido pelo analista/administrador — descontado
// da Verba Detalhamento (total). Único campo editável da aba 3, por isso
// é o único que precisa de "Salvar".
function recalcularDistribuicaoLucros() {
    const pctLucros = parseFloat(document.getElementById('vd-pct-lucros').value) || 0;
    const valorLucros = pctLucros / 100 * vdVerbaTotalAtual;
    const verbaLiquida = vdVerbaTotalAtual - valorLucros;

    document.getElementById('vd-valor-lucros').innerText = formatarMoeda(valorLucros);
    document.getElementById('vd-verba-liquida').innerText = formatarMoeda(verbaLiquida);
}

function salvarDistribuicaoLucros() {
    if (distribuicaoCustosSomenteLeitura()) return alert('Você só tem acesso de visualização à Distribuição de Custos.');
    const nomeProjeto = document.getElementById('dc-projeto').value;
    if (!nomeProjeto) return alert('Selecione um projeto na aba "Orçamento Global" primeiro.');

    const lucrosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_lucros')) || {};
    lucrosSalvos[nomeProjeto] = { pct: document.getElementById('vd-pct-lucros').value };
    localStorage.setItem('banco_distribuicao_lucros', JSON.stringify(lucrosSalvos));
    alert('% Distribuição Lucros salvo para "' + nomeProjeto + '".');
}

// --- ABA 4: VERBA POR PAVIMENTO ---
// Lista todos os pavimentos de todas as Etapas/Setores do projeto, com a
// Área e o Peso de Esforço que o analista já preencheu na Estrutura de
// Projeto. Área Equivalente = Área × Peso de Esforço. A Verba Detalhamento
// Líquida (aba 3, depois de descontar a Distribuição de Lucros) é
// distribuída entre os pavimentos proporcionalmente à Área Equivalente de
// cada um. Tudo calculado, sem campo editável, sem storage próprio.
// --- CÁLCULO COMPARTILHADO: LISTA DE PAVIMENTOS COM VERBA ---
// listarPavimentosDoProjeto() é pura estrutura (área/peso/tarefas), sem
// verba nenhuma ainda. aplicarVerbaProporcionalAosPavimentos() distribui
// uma Verba Detalhamento Líquida já calculada entre eles. As duas funções
// por cima diferem só em de onde vem essa verba líquida — mesmo padrão de
// calcularVerbaDetalhamento / calcularVerbaDetalhamentoSalvo acima.
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

function aplicarVerbaProporcionalAosPavimentos(pavimentos, verbaLiquida) {
    const areaTotalEquivalente = pavimentos.reduce((soma, p) => soma + p.areaEquivalente, 0);
    pavimentos.forEach(p => {
        p.pctVerba = areaTotalEquivalente > 0 ? (p.areaEquivalente / areaTotalEquivalente * 100) : 0;
        p.valorVerba = p.pctVerba / 100 * verbaLiquida;
    });
    return areaTotalEquivalente;
}

function calcularListaPavimentosComVerba(nomeProjeto, pctFundoLucrosOverride) {
    const verbasPorEtapa = calcularVerbaPorEtapa(nomeProjeto);
    const pavimentos = listarPavimentosDoProjeto(nomeProjeto, verbasPorEtapa, pctFundoLucrosOverride);
    const verbaLiquida = pavimentos.reduce((soma, p) => soma + p.valorVerba, 0);
    const areaTotalEquivalente = pavimentos.reduce((soma, p) => soma + p.areaEquivalente, 0);
    // Pedido do usuário: mostrar o valor em R$ do Fundo de Lucros ao
    // lado do % — soma das fatias por Pavimento (`p.valorFundoLucros`,
    // já calculadas em listarPavimentosDoProjeto) dá o total sem
    // precisar recalcular nada.
    const valorFundoLucrosTotal = pavimentos.reduce((soma, p) => soma + p.valorFundoLucros, 0);
    return { pavimentos: pavimentos, areaTotalEquivalente: areaTotalEquivalente, verbaLiquida: verbaLiquida, verbasPorEtapa: verbasPorEtapa, valorFundoLucrosTotal: valorFundoLucrosTotal };
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
        // (vtGruposRecolhidos). Reforma de 2026-08-25 (parte 43 — o
        // usuário reconsiderou de novo): RECOLHIDO volta a ser o padrão
        // (valor `undefined`, nunca tocado, conta como recolhido) — só
        // um clique explícito guarda `false` (expandido). O cabeçalho
        // ganhou a totalização de Pontos e Valor do pavimento pra
        // continuar útil mesmo fechado.
        const recolhido = vtGruposRecolhidos[pav.caminho] !== false;
        const seta = recolhido ? '►' : '▼';
        const estiloOcultoSeRecolhido = recolhido ? ' style="display:none;"' : '';

        const totalPontosPav = pav.tarefas.reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
        const totalizacaoHeader = ' <span class="vt-card-header-totais">' + totalPontosPav.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' pts &middot; ' + formatarMoeda(pav.valorVerba) + '</span>';

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
                '<td>' + escapeHtml(tarefa.nome) + '</td>' +
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
            '<div class="vt-card-header" onclick="alternarGrupoVerbaPorTarefa(\'' + pav.caminho + '\')"><span><span class="tree-toggle-icon">' + seta + '</span> ' + escapeHtml(pav.nome) + '</span>' + totalizacaoHeader + '</div>' +
            '<div class="table-wrapper"><table class="tabela-compacta"><thead><tr>' +
                '<th>Tarefa</th><th style="width:120px;">Executor</th><th class="col-centralizada" style="width:55px;">H.Máx</th><th class="col-centralizada" style="width:55px;">Pontos</th><th style="width:100px; text-align:right;">Valor</th>' +
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
// reseta ao trocar de projeto/aba (não precisa persistir).
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
