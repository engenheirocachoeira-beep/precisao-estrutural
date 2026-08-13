// =========================================================================
// MÓDULO: ATRIBUIÇÃO DE TAREFAS
//
// Fila única de trabalho com tarefas de TODOS os projetos (não fica preso
// a um projeto selecionado, ao contrário da Distribuição de Custos).
//
// FILTROS ESTILO EXCEL: cada coluna filtrável (Projeto, Executor, Status)
// tem uma setinha "▾" no cabeçalho. Clicar abre um painel flutuante com
// checkbox por valor único daquela coluna (calculado a partir de TODAS as
// tarefas, não só as já filtradas por outras colunas — mais simples de
// entender do que o "cross-filter" do Excel de verdade). Desmarcar um
// valor tira ele da lista; "Selecionar tudo" / "Limpar" no topo do painel.
// Não existem mais os botões horizontais de filtro (pills) nem os
// dropdowns de Projeto/Funcionário no topo da tela — tudo migrou pros
// cabeçalhos de coluna.
//
// Estado de filtro: atFiltroSelecionado[campo] é `null` quando TUDO está
// selecionado (sem restrição), ou um Set com os valores marcados. Setinha
// fica laranja (.ativo) quando o filtro daquela coluna não é "tudo".
//
// O padrão ao abrir a tela é: Status com tudo marcado EXCETO "Finalizada"
// (mesmo comportamento de antes); Projeto e Executor com tudo marcado.
//
// Atribuir um executor SALVA NA HORA (sem botão de salvar separado). Se a
// tarefa deixar de bater com o filtro de Status ativo, ela some da lista
// — comportamento esperado de fila de triagem, não bug.
//
// Pontos também é editável direto na lista, e salva sozinho ao sair do
// campo — mas não dispara re-renderização da tabela inteira (Pontos não é
// critério de filtro), só recalcula Pontos Máximo do pavimento inteiro.
//
// A tabela é compacta (linhas mais baixas, classe .tabela-compacta) e
// paginada (20 por página).
//
// Sem storage próprio — lê/escreve direto em 'banco_arvores_projetos'
// (mesmo campo tarefa.executor / tarefa.pontos / tarefa.status que a
// Árvore de Projeto usa).
// =========================================================================

const AT_ITENS_POR_PAGINA = 20;
let atPaginaAtual = 1;

const AT_STATUS_POSSIVEIS = ['Apontada', 'Sem Executor', 'Em Desenvolvimento', 'Aguardando Verificação', 'Para revisão', 'Finalizada'];

// null = "tudo selecionado" (sem restrição). Set = só os valores marcados.
let atFiltroSelecionado = {
    status: null,
    projeto: null,
    executor: null,
    responsavel: null,
    localizacao: null,
    tarefa: null
};

// Filtro de período por Data de Início (barra acima do cabeçalho da
// tabela) — strings "AAAA-MM-DD" ou '' (vazio = sem restrição naquela
// ponta). Diferente dos filtros de coluna acima (que são por Set de
// valores exatos), esse é um intervalo contínuo.
let atFiltroPeriodoDe = '';
let atFiltroPeriodoAte = '';

function carregarPainelAtribuicaoTarefas() {
    // Padrão: todos os status marcados, exceto Finalizada (mesmo
    // comportamento default de antes dos filtros virarem estilo Excel).
    atFiltroSelecionado = {
        status: new Set(AT_STATUS_POSSIVEIS.filter(s => s !== 'Finalizada')),
        projeto: null,
        executor: null,
        responsavel: null,
        localizacao: null,
        tarefa: null
    };

    ['status', 'projeto', 'executor', 'responsavel', 'localizacao', 'tarefa'].forEach(atualizarSetaFiltro);

    atFiltroPeriodoDe = '';
    atFiltroPeriodoAte = '';
    const inputDe = document.getElementById('at-filtro-periodo-de');
    const inputAte = document.getElementById('at-filtro-periodo-ate');
    if (inputDe) inputDe.value = '';
    if (inputAte) inputAte.value = '';

    ajustarLarguraColunaProjeto();
    ajustarLarguraColunaTarefa();
    // ajustarLarguraColunaExecutor() removida do fluxo (pedido do
    // usuário): recalculava a largura da coluna Executor por conteúdo
    // (em "ch"), sobrescrevendo o width fixo do HTML — como a coluna
    // Responsável nunca passava por esse recálculo, as duas ficavam
    // com larguras diferentes na tela mesmo declarando o mesmo valor
    // no HTML. Agora as duas ficam sempre com a largura fixa definida
    // no <th> (ver index.html), sem recálculo nenhum.
    fecharFiltroFlutuante();

    atPaginaAtual = 1;
    renderizarPainelAtribuicaoTarefas();
}

// Largura de coluna calculada a partir do maior valor real já cadastrado
// (não um chute fixo em px) — usa unidade "ch" (largura aproximada de um
// caractere), estimativa razoável mesmo em fonte não-monoespaçada.
function ajustarLarguraColuna(idTh, valores, minimoCh) {
    const maiorValor = valores.reduce((maior, v) => Math.max(maior, (v || '').length), 0);
    const larguraCh = Math.max(maiorValor + 2, minimoCh); // +2 de folga
    document.getElementById(idTh).style.width = larguraCh + 'ch';
}

function ajustarLarguraColunaTarefa() {
    const tarefasCatalogo = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
    ajustarLarguraColuna('at-th-tarefa', tarefasCatalogo.map(t => t.nome), 10);
}

function ajustarLarguraColunaProjeto() {
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    ajustarLarguraColuna('at-th-projeto', projetos.map(p => p.nome), 10);
}

// ajustarLarguraColunaExecutor() removida (pedido do usuário) — era o
// que causava a coluna Executor ficar com largura diferente da coluna
// Responsável, mesmo as duas declarando o mesmo width no HTML. Ver
// comentário em renderizarPainelAtribuicaoTarefas().

function mudarPaginaAtribuicao(delta) {
    atPaginaAtual += delta;
    renderizarPainelAtribuicaoTarefas(true); // mantém a página calculada
}

// Varre TODAS as árvores de TODOS os projetos e monta uma lista plana de
// tarefas, cada uma carregando o "caminho" completo (projeto + índices)
// necessário pra escrever de volta no lugar certo depois.
//
// Também calcula "Pontos Máximo" = Valor da Verba da tarefa ÷ Custo Hora
// do executor atribuído. A Verba é calculada com
// calcularListaPavimentosComVerbaSalva() (de distribuicao-custos.js) —
// versão que lê tudo do localStorage já salvo, sem depender da tela de
// Distribuição de Custos estar aberta num projeto específico, já que aqui
// estamos olhando VÁRIOS projetos ao mesmo tempo. Enquanto a tarefa não
// tiver executor (ou o executor não tiver Valor/Hora cadastrado), Pontos
// Máximo fica 0.
// Pedido do usuário: dado antigo pode referenciar um nome que não
// existe mais no Cadastro de Funcionários (renomeado ou excluído) — um
// `tarefa.executor`/`tarefa.responsavel` "órfão" desses não deve ser
// tratado como preenchido de verdade, senão o dropdown fica sem opção
// correspondente pra selecionar (mostra em branco/errado, mesmo o dado
// existindo). Trata como se estivesse vazio, cai no próximo fallback.
function valorSeFuncionarioValido(nome, funcionarios) {
    return (nome && funcionarios.some(f => f.nome === nome)) ? nome : '';
}

function coletarTodasTarefasDeTodosProjetos() {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const todosProjetosCadastro = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    let lista = [];

    // Restrição por projeto (Rodada 3 do controle de acesso — ver
    // core.js::obterNomesProjetosPermitidos()): Analista só vê tarefas
    // dos projetos onde é o responsável. null = sem restrição.
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;

    Object.keys(arvores).forEach(nomeProjeto => {
        // Item 7 (prompt_gemini.md §14, leva 4): projeto deletado/
        // renomeado no Cadastro deixava a árvore órfã aparecendo aqui
        // mesmo assim — `todosProjetosCadastro` já era carregado
        // acima mas nunca chegava a ser usado pra filtrar.
        if (!todosProjetosCadastro.some(p => p.nome === nomeProjeto)) return;
        if (projetosPermitidos && !projetosPermitidos.has(nomeProjeto)) return;

        // Item 3 da Rodada de Comentários da Gerência (ver
        // prompt_gemini.md §12): projeto "Em Análise" não mostra
        // tarefas aqui — só depois de liberado pra Detalhamento. Não
        // afeta a Árvore de Projeto, só esta tela.
        if (typeof projetoEstaLiberadoParaDetalhamento === 'function' && !projetoEstaLiberadoParaDetalhamento(nomeProjeto)) return;

        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        // Verba por pavimento desse projeto, calculada uma vez só (não
        // por tarefa) a partir do que já está salvo pra esse projeto.
        const { pavimentos: pavimentosComVerba } = calcularListaPavimentosComVerbaSalva(nomeProjeto);
        const valorVerbaPorCaminhoPavimento = {};
        pavimentosComVerba.forEach(p => { valorVerbaPorCaminhoPavimento[p.caminho] = p.valorVerba; });

        // Melhoria #26 (prompt_gemini.md §12.12): fallback do Responsável
        // quando a Tarefa não tem um customizado — precisa do Analista
        // do projeto (Cadastro de Projetos), calculado uma vez por
        // projeto (não por tarefa).
        const projetoCadastro = todosProjetosCadastro.find(p => p.nome === nomeProjeto);
        const analistaDoProjeto = (projetoCadastro && projetoCadastro.analista) ? projetoCadastro.analista : '';
        const detalhistaDoProjeto = (projetoCadastro && projetoCadastro.detalhista) ? projetoCadastro.detalhista : '';

        // Árvore Genérica Recursiva (prompt_gemini.md §12.31): não há
        // mais `etapa.tipo` — coletarNosFolhaDaArvore() (core.js) acha
        // as tarefas em qualquer profundidade. "Verba por Área
        // Equivalente" só se aplica onde já existe Pavimento físico de
        // verdade (path de 3 posições = Pavimento agindo como folha,
        // ou 4 posições = Tarefa dentro de Pavimento container) — nos
        // outros casos (Etapa/Setor agindo como folha, sem Pavimento
        // nenhum por trás), `pontosMaximo` fica 0: o teto real dessas
        // é o `custo_max` fixo do próprio nó, mostrado noutro lugar.
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path, localizacao }) => {
            const segs = path.split('-');
            const partes = localizacao.split(' › ');
            const executorValido = valorSeFuncionarioValido(tarefa.executor, funcionarios);
            const funcionario = funcionarios.find(f => f.nome === tarefa.executor);
            const dataInicioExecucaoReal = obterDataInicioExecucaoReal(tarefa);
            const dataReferenciaCustoHora = dataInicioExecucaoReal
                ? dataInicioExecucaoReal.split('T')[0]
                : formatarDataISO(new Date());
            const custoHora = (funcionario && tarefa.executor) ? valorHoraVigente(tarefa.executor, dataReferenciaCustoHora) : 0;
            const horasReais = parseFloat(tarefa.horas_reais) || 0;
            const alerta = tarefa.executor ? verificarAlertaApontamento(tarefa, tarefa.executor) : { temAlerta: false, motivo: '' };

            let pontosMaximo = 0;
            let valorVerbaPav = 0;
            let grupoPav = nomeProjeto + '|' + path + '-folha'; // isolado — não interfere no recálculo de Pontos Máximo de nenhum Pavimento de verdade
            let responsavelFallbackPai = '';

            // Árvore Genérica Recursiva v2 (§12.31, níveis puláveis):
            // o comprimento do path não garante mais nada sozinho —
            // agora olha o `nivel` do próprio nó e do pai imediato de
            // verdade (via resolverNoPorPath) pra saber se cabe conta
            // de Área Equivalente/Pontos.
            const pathPai = segs.length > 1 ? segs.slice(0, -1).join('-') : null;
            const noPai = pathPai ? resolverNoPorPath(arv, pathPai) : null;

            if (tarefa.nivel === 'tarefa' && noPai && noPai.nivel === 'pavimento') {
                // Tarefa de verdade dentro de Pavimento container —
                // mesma conta de sempre (Verba do Pavimento por Área,
                // dividida entre as Tarefas por Pontos).
                valorVerbaPav = valorVerbaPorCaminhoPavimento[pathPai] || 0;
                const totalPontosPav = (noPai.filhos || []).filter(f => f.nivel === 'tarefa').reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
                const pontos = parseFloat(tarefa.pontos) || 0;
                const valorVerbaTarefa = totalPontosPav > 0 ? (pontos / totalPontosPav) * valorVerbaPav : 0;
                pontosMaximo = (tarefa.executor && custoHora > 0) ? (valorVerbaTarefa / custoHora) : 0;
                grupoPav = nomeProjeto + '|' + pathPai;
                const etapaPai = arv.etapas[parseInt(segs[0], 10)];
                responsavelFallbackPai = etapaPai ? etapaPai.responsavel : '';
            } else if (tarefa.nivel === 'pavimento') {
                // Pavimento agindo como folha — ainda compete por Área
                // Equivalente entre Pavimentos irmãos (regra de
                // sempre), só que ele mesmo é a tarefa, sem rateio
                // adicional por Pontos dentro dele.
                valorVerbaPav = valorVerbaPorCaminhoPavimento[path] || 0;
                pontosMaximo = (tarefa.executor && custoHora > 0) ? (valorVerbaPav / custoHora) : 0;
            }
            // Etapa-folha ou Setor-folha: fica 0 mesmo — sem Pavimento
            // físico envolvido, teto real é o custo_max fixo do nó.

            lista.push({
                projeto: nomeProjeto,
                etapa: partes[0],
                setor: partes[1] || '—',
                pavimento: partes[2] || '—',
                localizacao: localizacao,
                tarefa: tarefa.nome,
                status: tarefa.status || 'Apontada',
                // Pedido do usuário: até que seja apontado outro,
                // Executor cai no Detalhista do Cadastro de Projetos;
                // Responsável cai no Analista.
                executor: executorValido || detalhistaDoProjeto || '',
                responsavel: valorSeFuncionarioValido(tarefa.responsavel, funcionarios) || valorSeFuncionarioValido(responsavelFallbackPai, funcionarios) || analistaDoProjeto || '',
                ordemFila: tarefa.ordem_fila !== undefined ? tarefa.ordem_fila : 999999,
                dataInicioManual: tarefa.data_inicio_manual || '',
                dataLimite: tarefa.data_limite || '',
                pontos: tarefa.pontos || '',
                pontosMaximo: pontosMaximo,
                custoHora: custoHora,
                horasReais: horasReais,
                sessaoAtiva: !!tarefa.sessao_ativa_inicio,
                temAlerta: alerta.temAlerta,
                motivoAlerta: alerta.motivo,
                grupoPav: grupoPav,
                valorVerbaPav: valorVerbaPav,
                caminho: nomeProjeto + '|' + path
            });
        });
    });

    return lista;
}

// --- PRIORIZAÇÃO POR ARRASTAR-E-SOLTAR (ordem_fila) ---
//
// A tabela é agrupada em blocos contíguos por Executor (ordenados
// alfabeticamente entre si), e dentro de cada bloco ordenada pela Data
// de Início EFETIVA (âncora manual se existir, senão a calculada
// automaticamente pelo motor de fila) — pedido da diretoria: antes era
// ordenada por ordem_fila, o que nem sempre batia com a ordem
// cronológica real (uma âncora manual pode ter "furado" a fila natural).
// O ARRASTO CONTINUA REESCREVENDO ordem_fila exatamente como antes —
// só o CRITÉRIO DE EXIBIÇÃO da tabela mudou pra data; ordem_fila
// continua sendo o que decide a ordem "de verdade" pro motor de
// sequenciamento (ver feriados.js). Tarefas "Sem Executor" não têm data
// calculável (não são arrastáveis) e ficam sempre no bloco final,
// ordenadas alfabeticamente por nome da tarefa.
//
// `mapaDatasInicioPorExecutor` precisa ser calculado ANTES de chamar
// essa função (ver renderizarPainelAtribuicaoTarefas) — é o mesmo mapa
// usado depois pra render da célula e pro filtro de período, calculado
// uma vez só.
function dataEfetivaOrdenacaoAtribuicao(t, mapaDatasInicioPorExecutor) {
    if (t.dataInicioManual) return t.dataInicioManual;
    const mapa = mapaDatasInicioPorExecutor[t.executor];
    return (mapa && mapa[t.caminho]) || '9999-99-99'; // sem data calculável (ex: Finalizada): vai pro final do bloco
}

function ordenarListaPorExecutorEData(lista, mapaDatasInicioPorExecutor) {
    const executoresOrdenados = Array.from(new Set(lista.map(t => t.executor).filter(e => e)))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const blocos = executoresOrdenados.map(exec =>
        lista.filter(t => t.executor === exec).sort((a, b) => {
            const dataA = dataEfetivaOrdenacaoAtribuicao(a, mapaDatasInicioPorExecutor);
            const dataB = dataEfetivaOrdenacaoAtribuicao(b, mapaDatasInicioPorExecutor);
            return dataA.localeCompare(dataB);
        })
    );

    const semExecutor = lista.filter(t => !t.executor)
        .sort((a, b) => a.tarefa.localeCompare(b.tarefa, 'pt-BR'));

    return [].concat.apply([], blocos).concat(semExecutor);
}

// Função pura: recebe a fila JÁ ORDENADA (por ordem_fila) de UM executor,
// remove a tarefa arrastada e insere imediatamente antes da tarefa-alvo
// (mesma convenção de "soltar sobre X insere antes de X" usada em
// Etapas/Setores na Árvore de Projeto). Renumera todos sequencialmente a
// partir de `proximoNumero`. Retorna null se não há nada a fazer (arrasto
// sobre si mesmo, ou caminho arrastado/alvo não existe mais na fila —
// pode acontecer se a árvore mudou entre o render e o drop).
function reordenarFilaExecutor(filaOrdenada, caminhoArrastado, caminhoAlvo, proximoNumero) {
    if (caminhoArrastado === caminhoAlvo) return null;

    const lista = filaOrdenada.slice();
    const idxArrastado = lista.findIndex(t => t.caminho === caminhoArrastado);
    if (idxArrastado === -1) return null;
    const arrastado = lista.splice(idxArrastado, 1)[0];

    const idxAlvo = lista.findIndex(t => t.caminho === caminhoAlvo);
    if (idxAlvo === -1) return null;
    lista.splice(idxAlvo, 0, arrastado);

    let contador = proximoNumero;
    return lista.map(t => ({ caminho: t.caminho, ordem_fila: contador++ }));
}

let atArrastandoCaminho = null;
let atArrastandoExecutor = null;

function atDragStart(event, caminho, executor) {
    atArrastandoCaminho = caminho;
    atArrastandoExecutor = executor;
    event.dataTransfer.effectAllowed = 'move';
}

// Só aceita o drop se a linha sobrevoada é do MESMO executor que está
// sendo arrastado — preventDefault() é o que sinaliza ao navegador que
// esse alvo aceita o drop (senão o evento 'drop' nem dispara).
function atDragOver(event, executorLinha) {
    if (executorLinha !== atArrastandoExecutor) return;
    event.preventDefault();
}

function atDrop(event, caminhoAlvo, executorAlvo) {
    event.preventDefault();
    if (executorAlvo !== atArrastandoExecutor) return; // guarda dupla, além do dragover

    reordenarFilaExecutorNaArvore(atArrastandoExecutor, atArrastandoCaminho, caminhoAlvo);
    atArrastandoCaminho = null;
    atArrastandoExecutor = null;
}

// Item 14 (Dead Line/Data Limite) — combinado numa conversa anterior
// (ver §12, item "Priorização por arrastar-e-soltar") e reforçado pela
// Rodada de Comentários da Gerência. Função pura, testável sem DOM (ver
// /home/claude/testes/teste_item14_data_limite.js): olha uma fila JÁ
// CALCULADA (com Data de Fim por tarefa) e retorna a primeira tarefa
// que tem Data Limite definida e terminaria DEPOIS do prazo — ou null
// se está tudo dentro do prazo. Terminar EXATAMENTE no dia do prazo não
// é violação.
function encontrarViolacaoDataLimite(filaComDatas, todasArvores) {
    for (const item of filaComDatas) {
        const tarefa = localizarTarefaPorCaminho(todasArvores, item.caminho);
        if (tarefa && tarefa.data_limite && item.dataFim > tarefa.data_limite) {
            return { caminho: item.caminho, nome: tarefa.nome, dataFim: item.dataFim, dataLimite: tarefa.data_limite };
        }
    }
    return null;
}

// Aplica o reordenamento na fila COMPLETA daquele executor (todas as
// tarefas dele em TODOS os projetos, não só as visíveis na página/filtro
// atual) — necessário porque o motor de Data Prevista (feriados.js) usa a
// fila inteira, não só o que está na tela no momento.
function reordenarFilaExecutorNaArvore(nomeExecutor, caminhoArrastado, caminhoAlvo) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};

    let filaCompleta = [];
    Object.keys(todas).forEach(nomeProjeto => {
        const arv = todas[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            if (tarefa.executor !== nomeExecutor) return;
            filaCompleta.push({
                caminho: nomeProjeto + '|' + path,
                ordem_fila: tarefa.ordem_fila !== undefined ? tarefa.ordem_fila : 999999
            });
        });
    });
    filaCompleta.sort((a, b) => a.ordem_fila - b.ordem_fila);

    const contadorInicial = parseInt(localStorage.getItem('banco_proximo_ordem_fila') || '1', 10);
    const resultado = reordenarFilaExecutor(filaCompleta, caminhoArrastado, caminhoAlvo, contadorInicial);
    if (!resultado) return; // no-op (arrasto sobre si mesmo, ou caminho sumiu)

    // Item 14: simula a nova ordem numa CÓPIA da árvore, sem gravar
    // nada ainda — se isso jogar alguma tarefa com Data Limite pra
    // depois do prazo, BLOQUEIA de verdade (sem opção de forçar,
    // combinado com o usuário). Só destrava editando/removendo a Data
    // Limite daquela tarefa.
    const todasSimuladas = JSON.parse(JSON.stringify(todas));
    resultado.forEach(item => {
        const tarefa = localizarTarefaPorCaminho(todasSimuladas, item.caminho);
        if (tarefa) tarefa.ordem_fila = item.ordem_fila;
    });
    const filaSimuladaComDatas = calcularFilaComDatasExecutor(nomeExecutor, todasSimuladas);
    const violacao = encontrarViolacaoDataLimite(filaSimuladaComDatas, todasSimuladas);
    if (violacao) {
        alert('Não é possível reordenar: a tarefa "' + violacao.nome + '" passaria da Data Limite dela (' +
            formatarDataPrevistaExibicao(violacao.dataLimite) + '), terminando em ' + formatarDataPrevistaExibicao(violacao.dataFim) +
            '.\n\nPra liberar, edite ou remova a Data Limite dessa tarefa primeiro.');
        return;
    }

    resultado.forEach(item => {
        const tarefa = localizarTarefaPorCaminho(todas, item.caminho);
        if (tarefa) tarefa.ordem_fila = item.ordem_fila;
    });
    localStorage.setItem('banco_proximo_ordem_fila', String(contadorInicial + resultado.length));
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));

    renderizarPainelAtribuicaoTarefas(true); // mantém a página atual
}

// CORREÇÃO (julho/2026): o usuário tinha dito antes "sem que o Analista
// a altere" (item 14), interpretado como "Analista PODE alterar,
// desde que ele mesmo seja quem faz isso". O próprio usuário corrigiu
// depois, de forma explícita: "A data limite só pode ser editada pelo
// supervisor ou administrador" — Analista NÃO edita mais. Função pura,
// testável sem DOM (ver
// /home/claude/testes/teste_data_limite_trava_supervisor_admin.js).
function podeEditarDataLimite() {
    const nivel = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    if (!nivel) return true; // sem login/módulo isolado — fallback aberto
    return nivel === 'administrador' || nivel === 'supervisor';
}

// Edita/remove a Data Limite de uma tarefa — é a própria "válvula de
// escape" do bloqueio de arrasto (ver encontrarViolacaoDataLimite()
// acima), mas só pra quem TEM permissão de mexer nesse campo (ver
// podeEditarDataLimite() logo acima — Analista NÃO tem mais).
function editarDataLimiteTarefa(inputEl) {
    if (!podeEditarDataLimite()) return;

    const [nomeProjeto, caminhoResto] = inputEl.dataset.caminho.split('|');
    const p = caminhoResto.split('-');

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    try {
        const tarefa = resolverNoPorPath(arv, caminhoResto);
        if (inputEl.value) tarefa.data_limite = inputEl.value;
        else delete tarefa.data_limite;
    } catch (e) {
        return;
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarPainelAtribuicaoTarefas(true);
}

function construirOpcoesExecutor(funcionarios, selecionado, rotuloPlaceholder) {
    let html = '<option value="">' + (rotuloPlaceholder || 'Sem executor') + '</option>';
    funcionarios.forEach(f => {
        html += '<option value="' + f.nome + '"' + (f.nome === selecionado ? ' selected' : '') + '>' + nomeParaExibicao(f.nome) + '</option>';
    });
    return html;
}

// --- FILTROS ESTILO EXCEL (setinha no cabeçalho da coluna) ---

function valorParaExibicao(campo, valor) {
    if ((campo === 'executor' || campo === 'responsavel') && !valor) return campo === 'executor' ? '(Sem executor)' : '(Sem responsável)';
    if (campo === 'executor' || campo === 'responsavel') return nomeParaExibicao(valor);
    return valor;
}

function valoresUnicosColuna(campo) {
    const lista = coletarTodasTarefasDeTodosProjetos();
    const valores = new Set(lista.map(t => t[campo]));
    return Array.from(valores).sort((a, b) => valorParaExibicao(campo, a).localeCompare(valorParaExibicao(campo, b), 'pt-BR'));
}

function abrirFiltroColuna(event, campo) {
    event.stopPropagation();
    const painel = document.getElementById('at-filtro-flutuante');

    const jaAbertoNessaColuna = painel.dataset.campoAtual === campo && painel.style.display !== 'none';
    if (jaAbertoNessaColuna) { fecharFiltroFlutuante(); return; }

    const valores = valoresUnicosColuna(campo);
    const selecionados = atFiltroSelecionado[campo]; // null = tudo marcado

    let html = '<div class="at-filtro-acoes-topo">' +
        '<a onclick="marcarTodosFiltroColuna(\'' + campo + '\')">Selecionar tudo</a>' +
        '<a onclick="desmarcarTodosFiltroColuna(\'' + campo + '\')">Limpar</a>' +
        '</div>';

    html += valores.map(v => {
        const marcado = selecionados === null || selecionados.has(v);
        return '<label><input type="checkbox" data-valor="' + encodeURIComponent(v) + '" ' + (marcado ? 'checked' : '') + ' onchange="alternarValorFiltroColuna(\'' + campo + '\', this)"> ' + valorParaExibicao(campo, v) + '</label>';
    }).join('');

    painel.innerHTML = html;
    painel.dataset.campoAtual = campo;

    const rect = event.target.getBoundingClientRect();
    painel.style.left = rect.left + 'px';
    painel.style.top = (rect.bottom + 4) + 'px';
    painel.style.display = 'block';
}

function fecharFiltroFlutuante() {
    const painel = document.getElementById('at-filtro-flutuante');
    painel.style.display = 'none';
    painel.dataset.campoAtual = '';
}

// --- FILTRO DE PERÍODO (Data de Início) ---
// Diferente dos filtros de coluna (Set de valores exatos), esse é um
// intervalo contínuo — lê os dois campos de data da barra acima da
// tabela e volta pra página 1 (mesma convenção dos outros filtros).
function aplicarFiltroPeriodoAtribuicao() {
    atFiltroPeriodoDe = document.getElementById('at-filtro-periodo-de').value;
    atFiltroPeriodoAte = document.getElementById('at-filtro-periodo-ate').value;
    renderizarPainelAtribuicaoTarefas();
}

function limparFiltroPeriodoAtribuicao() {
    atFiltroPeriodoDe = '';
    atFiltroPeriodoAte = '';
    document.getElementById('at-filtro-periodo-de').value = '';
    document.getElementById('at-filtro-periodo-ate').value = '';
    renderizarPainelAtribuicaoTarefas();
}

// Fecha o painel flutuante ao clicar fora dele (fora também das setinhas,
// senão clicar na seta pra abrir já fecharia de novo antes do onclick dela rodar).
document.addEventListener('click', function (event) {
    const painel = document.getElementById('at-filtro-flutuante');
    if (!painel) return;
    if (painel.style.display === 'none') return;
    if (painel.contains(event.target) || event.target.classList.contains('at-filtro-seta')) return;
    fecharFiltroFlutuante();
});

function alternarValorFiltroColuna(campo, checkboxEl) {
    const valor = decodeURIComponent(checkboxEl.dataset.valor);
    if (atFiltroSelecionado[campo] === null) {
        atFiltroSelecionado[campo] = new Set(valoresUnicosColuna(campo));
    }
    if (checkboxEl.checked) atFiltroSelecionado[campo].add(valor);
    else atFiltroSelecionado[campo].delete(valor);

    atualizarSetaFiltro(campo);
    renderizarPainelAtribuicaoTarefas();
}

function marcarTodosFiltroColuna(campo) {
    atFiltroSelecionado[campo] = null;
    atualizarSetaFiltro(campo);
    fecharFiltroFlutuante();
    renderizarPainelAtribuicaoTarefas();
}

function desmarcarTodosFiltroColuna(campo) {
    atFiltroSelecionado[campo] = new Set(); // nenhum valor marcado = lista fica vazia pra essa coluna
    atualizarSetaFiltro(campo);
    fecharFiltroFlutuante();
    renderizarPainelAtribuicaoTarefas();
}

// Marca a setinha de laranja quando aquela coluna tem filtro ativo (não é
// "tudo selecionado") — mesmo princípio do funil colorido do Excel.
function atualizarSetaFiltro(campo) {
    document.querySelectorAll('.at-filtro-seta').forEach(seta => {
        if (seta.getAttribute('onclick') && seta.getAttribute('onclick').includes("'" + campo + "'")) {
            seta.classList.toggle('ativo', atFiltroSelecionado[campo] !== null);
        }
    });
}

// Substitui o Kanban do Analista (tela removida por feedback do usuário
// — ver prompt_gemini.md §11): o Analista já usa esta tela, já filtrada
// pelos projetos dele (`obterNomesProjetosPermitidos()`), então em vez
// de uma tela nova só pra ver "Aguardando Verificação", a tarefa fica em
// destaque aqui mesmo — realce na linha + aviso/contador no topo. Só
// aparece pro Analista (Administrador/Supervisor não têm o conceito de
// "projeto responsável" da mesma forma, e não pediram esse destaque).
// Funções puras, testáveis sem DOM (ver
// /home/claude/testes/teste_destaque_aviso_analista.js).
function deveDestacarLinhaAguardandoVerificacao(status, nivel) {
    return nivel === 'analista' && status === 'Aguardando Verificação';
}

function contarAguardandoVerificacaoNaLista(listaCompleta, nivel) {
    if (nivel !== 'analista') return 0;
    return listaCompleta.filter(t => t.status === 'Aguardando Verificação').length;
}

function mensagemAvisoAguardandoVerificacao(quantidade) {
    if (quantidade === 0) return null;
    return '🕐 ' + quantidade + ' tarefa(s) do(s) seu(s) projeto(s) aguardando sua verificação.';
}

function atualizarAvisoAguardandoVerificacao(listaCompleta) {
    const aviso = document.getElementById('at-aviso-verificacao');
    if (!aviso) return;
    const nivelAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    const mensagem = mensagemAvisoAguardandoVerificacao(contarAguardandoVerificacaoNaLista(listaCompleta, nivelAtual));
    if (!mensagem) {
        aviso.style.display = 'none';
        return;
    }
    aviso.innerText = mensagem;
    aviso.style.display = 'block';
}

function renderizarPainelAtribuicaoTarefas(manterPagina) {
    if (!manterPagina) atPaginaAtual = 1;

    let lista = coletarTodasTarefasDeTodosProjetos();

    // Já filtrada por projeto do Analista (coletarTodasTarefasDeTodosProjetos
    // usa obterNomesProjetosPermitidos internamente) — usa a lista ANTES
    // dos filtros de coluna abaixo, pra o aviso não sumir só porque o
    // Analista filtrou a tabela por outro status/projeto no momento.
    atualizarAvisoAguardandoVerificacao(lista);

    lista = lista.filter(t => atFiltroSelecionado.status === null || atFiltroSelecionado.status.has(t.status));
    lista = lista.filter(t => atFiltroSelecionado.projeto === null || atFiltroSelecionado.projeto.has(t.projeto));
    lista = lista.filter(t => atFiltroSelecionado.executor === null || atFiltroSelecionado.executor.has(t.executor));
    lista = lista.filter(t => atFiltroSelecionado.responsavel === null || atFiltroSelecionado.responsavel.has(t.responsavel));
    lista = lista.filter(t => atFiltroSelecionado.localizacao === null || atFiltroSelecionado.localizacao.has(t.localizacao));
    lista = lista.filter(t => atFiltroSelecionado.tarefa === null || atFiltroSelecionado.tarefa.has(t.tarefa));

    // Datas de início automáticas (motor de fila), calculadas uma vez por
    // executor ÚNICO presente na lista FILTRADA INTEIRA (não só a página
    // atual) — precisa ser assim porque tanto a ORDENAÇÃO (logo abaixo)
    // quanto o filtro de período dependem da data calculada de toda
    // tarefa filtrada, não só das que cabem na página atual.
    const mapaDatasInicioPorExecutor = {};
    lista.forEach(t => {
        if (t.executor && t.status !== 'Finalizada' && !mapaDatasInicioPorExecutor[t.executor]) {
            mapaDatasInicioPorExecutor[t.executor] = calcularDatasInicioExecutor(t.executor);
        }
    });

    lista = ordenarListaPorExecutorEData(lista, mapaDatasInicioPorExecutor);

    // Filtro de período (barra acima do cabeçalho) — compara contra a
    // mesma data efetiva que a célula mostra (âncora manual se existir,
    // senão a calculada automaticamente). Tarefa sem data calculável
    // (Sem Executor / Finalizada) some da lista quando o filtro está
    // ativo, já que não tem como compará-la a um período.
    if (atFiltroPeriodoDe || atFiltroPeriodoAte) {
        lista = lista.filter(t => {
            const dataAuto = (mapaDatasInicioPorExecutor[t.executor] || {})[t.caminho] || '';
            const dataEfetiva = t.dataInicioManual || dataAuto;
            if (!dataEfetiva) return false;
            if (atFiltroPeriodoDe && dataEfetiva < atFiltroPeriodoDe) return false;
            if (atFiltroPeriodoAte && dataEfetiva > atFiltroPeriodoAte) return false;
            return true;
        });
    }

    const tbody = document.getElementById('at-tabela-body');

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma tarefa encontrada com os filtros atuais.</td></tr>';
        document.getElementById('at-paginacao').innerHTML = '';
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(lista.length / AT_ITENS_POR_PAGINA));
    if (atPaginaAtual > totalPaginas) atPaginaAtual = totalPaginas;
    if (atPaginaAtual < 1) atPaginaAtual = 1;

    const inicio = (atPaginaAtual - 1) * AT_ITENS_POR_PAGINA;
    const itensDaPagina = lista.slice(inicio, inicio + AT_ITENS_POR_PAGINA);

    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const hojeISO = new Date().toISOString().slice(0, 10); // item 13: semáforo de prioridade

    tbody.innerHTML = itensDaPagina.map(t => {
        const caminhoJs = t.caminho.replace(/'/g, "\\'");
        const executorJs = t.executor.replace(/'/g, "\\'");
        const indicadorSessao = t.sessaoAtiva ? '🔴 ' : '';
        const estiloAlerta = t.temAlerta ? ' style="background:#fef2f2; color:#b91c1c; font-weight:bold; cursor:pointer;"' : ' style="cursor:pointer;"';
        const tituloAlerta = t.temAlerta ? ' title="' + t.motivoAlerta.replace(/"/g, '&quot;') + '"' : ' title="Ver/editar sessões de trabalho"';
        const iconeAlerta = t.temAlerta ? '⚠️ ' : '';

        // Data de Início: editável só quando dá pra calcular fila (tem
        // executor e não está finalizada). O valor mostrado é a âncora
        // manual, se existir; senão, o valor calculado automaticamente
        // pelo motor de fila (feriados.js). Um ↺ some do lado quando há
        // âncora manual, pra voltar ao cálculo automático.
        let celulaDataInicio;
        if (t.executor && t.status !== 'Finalizada') {
            const dataAuto = (mapaDatasInicioPorExecutor[t.executor] || {})[t.caminho] || '';
            const valorInput = t.dataInicioManual || dataAuto;
            const tituloInput = t.dataInicioManual
                ? 'Data fixada manualmente — clique no ↺ pra voltar ao cálculo automático'
                : 'Calculada automaticamente pela fila do executor; edite pra fixar manualmente';
            const botaoLimpar = t.dataInicioManual
                ? ' <button type="button" onclick="limparDataInicioManual(\'' + caminhoJs + '\')" title="Voltar ao cálculo automático" style="border:none; background:none; cursor:pointer; font-size:13px;">↺</button>'
                : '';
            // Item 13: semáforo de prioridade ao lado da data (ver
            // feriados.js::corSemaforoPrioridade — faixas ≤2/3-7/8+
            // dias, não se aplica se já passou da data sem começar).
            const bolinhaSemaforo = typeof renderizarBolinhaSemaforoPrioridade === 'function' ? renderizarBolinhaSemaforoPrioridade(valorInput, hojeISO) : '';
            celulaDataInicio = '<td style="white-space:nowrap;">' + bolinhaSemaforo + '<input type="date" value="' + valorInput + '" data-caminho="' + caminhoJs + '" title="' + tituloInput + '" style="width:120px; border:1px solid #cbd5e1; border-radius:4px; padding:2px; font-size:11px;" onchange="editarDataInicioTarefa(this)">' + botaoLimpar + '</td>';
        } else {
            celulaDataInicio = '<td style="text-align:center; color:#94a3b8;">—</td>';
        }

        // Data Limite (item 14, "Dead Line") — editável só por
        // Supervisor/Administrador (correção do usuário: Analista NÃO
        // edita mais, ver podeEditarDataLimite() acima).
        const podeEditarDataLimiteAqui = typeof podeEditarDataLimite === 'function' ? podeEditarDataLimite() : true;
        const tituloDataLimite = podeEditarDataLimiteAqui
            ? 'Se preenchida, bloqueia qualquer reordenação por arrastar-e-soltar que jogue o término desta tarefa pra depois dessa data'
            : 'Só Supervisor ou Administrador podem editar a Data Limite';
        const celulaDataLimite = '<td style="white-space:nowrap;"><input type="date" value="' + (t.dataLimite || '') + '" data-caminho="' + caminhoJs + '" title="' + tituloDataLimite + '"' + (podeEditarDataLimiteAqui ? '' : ' disabled') + ' style="width:120px; border:1px solid #cbd5e1; border-radius:4px; padding:2px; font-size:11px;" onchange="editarDataLimiteTarefa(this)"></td>';

        // Só tarefas com executor atribuído são arrastáveis — "Sem
        // Executor" não tem ordem_fila de verdade pra reordenar.
        const arrastavel = t.executor
            ? ' draggable="true" ondragstart="atDragStart(event, \'' + caminhoJs + '\', \'' + executorJs + '\')" ondragover="atDragOver(event, \'' + executorJs + '\')" ondrop="atDrop(event, \'' + caminhoJs + '\', \'' + executorJs + '\')" title="Arraste pra reordenar a fila de ' + nomeParaExibicao(t.executor) + '"'
            : '';

        // Destaque de "Aguardando Verificação" pro Analista — substitui
        // o Kanban do Analista removido (ver prompt_gemini.md §11).
        const nivelAtualLinha = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
        const estiloPartes = [];
        if (deveDestacarLinhaAguardandoVerificacao(t.status, nivelAtualLinha)) {
            estiloPartes.push('background:#fffbeb', 'border-left:4px solid #f59e0b');
        }
        if (t.executor) estiloPartes.push('cursor:grab');
        const estiloLinha = estiloPartes.length ? ' style="' + estiloPartes.join(';') + ';"' : '';

        // Coluna Localização mostra só o caminho ATÉ a tarefa (Etapa ›
        // Setor › Pavimento), sem repetir o nome dela — a coluna
        // Tarefa logo ao lado já mostra isso. `t.localizacao` (usado
        // no filtro/agrupamento) continua com o caminho completo,
        // intacto; a redução é só na exibição desta célula.
        const partesLocalizacaoLinha = t.localizacao.split(' › ');
        const localizacaoSemTarefa = partesLocalizacaoLinha.length > 1 ? partesLocalizacaoLinha.slice(0, -1).join(' › ') : '—';

        return '<tr data-grupo-pav="' + t.grupoPav + '" data-valor-verba-pav="' + t.valorVerbaPav + '" data-custo-hora="' + t.custoHora + '"' + arrastavel + estiloLinha + '>' +
            '<td>' + t.projeto + '</td>' +
            '<td style="color:#64748b;">' + localizacaoSemTarefa + '</td>' +
            celulaDataInicio +
            celulaDataLimite +
            '<td>' + t.tarefa + '</td>' +
            '<td class="col-centralizada"><input type="number" step="0.1" value="' + t.pontos + '" class="at-input-pontos" data-caminho="' + t.caminho + '" style="width:55px; text-align:center; border:1px solid #cbd5e1; border-radius:4px; padding:2px;" onchange="editarPontosTarefaAtribuicao(this)"></td>' +
            '<td class="at-pontos-maximo col-centralizada">' + t.pontosMaximo.toFixed(1) + '</td>' +
            '<td><select data-caminho="' + t.caminho + '" style="width:100%;" onchange="atribuirExecutorTarefa(this)"' + (nivelAtualLinha === 'analista' ? ' disabled title="Analista não pode mais atribuir executor — peça pro Supervisor ou Administrador"' : '') + '>' + construirOpcoesExecutor(funcionarios, t.executor) + '</select></td>' +
            '<td><select data-caminho="' + t.caminho + '" style="width:100%;" onchange="atribuirResponsavelTarefa(this)"' + (nivelAtualLinha === 'analista' ? ' disabled title="Analista não pode mais atribuir responsável — peça pro Supervisor ou Administrador"' : '') + '>' + construirOpcoesExecutor(funcionarios, t.responsavel, '-- Selecione --') + '</select></td>' +
            '<td style="padding-left:24px;">' + t.status + '</td>' +
            '<td class="col-centralizada"' + estiloAlerta + tituloAlerta + ' onclick="abrirEditorSessoes(event, \'' + caminhoJs + '\')">' + iconeAlerta + indicadorSessao + t.horasReais.toFixed(2) + 'h</td>' +
            '</tr>';
    }).join('');

    renderizarPaginacaoAtribuicao(lista.length, totalPaginas);
}

function renderizarPaginacaoAtribuicao(totalItens, totalPaginas) {
    const el = document.getElementById('at-paginacao');
    if (totalPaginas <= 1) { el.innerHTML = '<span>' + totalItens + ' tarefa(s)</span>'; return; }

    el.innerHTML =
        '<button onclick="mudarPaginaAtribuicao(-1)"' + (atPaginaAtual <= 1 ? ' disabled' : '') + '>‹ Anterior</button>' +
        '<span>Página ' + atPaginaAtual + ' de ' + totalPaginas + ' (' + totalItens + ' tarefa(s))</span>' +
        '<button onclick="mudarPaginaAtribuicao(1)"' + (atPaginaAtual >= totalPaginas ? ' disabled' : '') + '>Próxima ›</button>';
}

// Grava o executor escolhido de volta na árvore do projeto certo — é o
// MESMO dado (banco_arvores_projetos) que a Árvore de Projeto lê e exibe,
// então não existe "replicar": mudar aqui já é mudar lá, não são cópias
// separadas.
//
// Status muda em dois casos, pra nunca ficar contradizendo o Executor:
// - Selecionar "Sem executor" (retirar) -> status vira "Sem Executor".
// - Escolher um funcionário numa tarefa que estava "Sem Executor" ->
//   status vira "Apontada" (senão a tarefa ficaria com executor mas
//   status ainda dizendo "Sem Executor").
// Trocar de um executor pra outro (nenhum dos dois vazio) não mexe no
// status — só essas duas transições específicas.
// Aplica a lógica de atribuir/trocar executor numa tarefa — extraída
// pra ser COMPARTILHADA entre esta tela e a Distribuição de Custos
// (item 7+10 da Rodada de Comentários da Gerência, ver
// prompt_gemini.md §12; usuário confirmou explicitamente que o
// comportamento é IDÊNTICO nos dois lugares: vai pro final da fila do
// executor, status alterna Sem Executor<->Apontada). Não mexe em
// localStorage — quem chama salva depois. Função pura, testável sem DOM
// (ver /home/claude/testes/teste_item7_10_atribuicao_compartilhada.js).
function aplicarAtribuicaoExecutorNaTarefa(tarefa, novoExecutor) {
    // Melhoria #18 (prompt_gemini.md §12.6): Responsável "segue" o
    // Executor por padrão — só para de seguir quando alguém customiza
    // o Responsável pra uma pessoa DIFERENTE do Executor (nesse ponto,
    // `tarefa.responsavel` passa a existir de verdade e divergir; até
    // lá, trocar o Executor também atualiza o Responsável junto).
    const responsavelAindaSeguindoExecutor = !tarefa.responsavel || tarefa.responsavel === tarefa.executor;
    tarefa.executor = novoExecutor;
    if (responsavelAindaSeguindoExecutor) tarefa.responsavel = novoExecutor;

    if (!novoExecutor) {
        tarefa.status = 'Sem Executor';
    } else if (tarefa.status === 'Sem Executor') {
        tarefa.status = 'Apontada';
    }

    // Carimba a posição na fila desse executor — usado pelo motor de
    // Data Prevista (feriados.js) até existir priorização por
    // arrastar-e-soltar de verdade. Todo executor novo escolhido vai
    // pro final da fila DELE (não reaproveita a ordem de quem estava
    // antes na tarefa, se ela já tinha executor).
    if (novoExecutor) {
        tarefa.ordem_fila = proximoNumeroOrdemFila();
    }
}

function atribuirExecutorTarefa(selectEl) {
    // Item 7 da Rodada de Comentários da Gerência (ver prompt_gemini.md
    // §12): Analista não atribui/troca executor mais — trava real, não
    // só o dropdown desabilitado na renderização acima. Supervisor e
    // Administrador continuam livres.
    const nivelAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    if (nivelAtual === 'analista') return;

    const [nomeProjeto, caminhoResto] = selectEl.dataset.caminho.split('|');

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    // Melhoria #5 (prompt_gemini.md §12.5) — trava de "Executor de
    // Tarefa Única só Administrador troca" foi removida junto com o
    // resto do conceito de Etapa Única (§12.31, Árvore Genérica
    // Recursiva) — todo nó agora tem Executor livremente editável por
    // quem tem acesso a esta tela, sem trava extra por nível/origem.
    const tarefa = resolverNoPorPath(arv, caminhoResto);
    if (!tarefa) return; // caminho não existe mais (árvore mudou entre carregar e atribuir) — ignora

    aplicarAtribuicaoExecutorNaTarefa(tarefa, selectEl.value);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarPainelAtribuicaoTarefas(true); // mantém a página atual
}

// Melhoria #18 (prompt_gemini.md §12.6): atribuir/trocar o Responsável
// (quem confere) SEM mexer no Executor — mesma trava de nível que
// atribuirExecutorTarefa (Analista não atribui). A partir daqui,
// `tarefa.responsavel` passa a valer sozinho, sem "seguir" o Executor
// automaticamente (só volta a seguir se alguém apagar/deixar em branco).
function atribuirResponsavelTarefa(selectEl) {
    const nivelAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nivel : null;
    if (nivelAtual === 'analista') return;

    const [nomeProjeto, caminhoResto] = selectEl.dataset.caminho.split('|');
    const p = caminhoResto.split('-'); // fIdx-eIdx-sIdx-tIdx

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    try {
        const tarefa = resolverNoPorPath(arv, caminhoResto);
        tarefa.responsavel = selectEl.value || tarefa.executor || '';
    } catch (e) {
        return; // caminho não existe mais (árvore mudou entre carregar e atribuir) — ignora
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarPainelAtribuicaoTarefas(true); // mantém a página atual
}

// Grava os Pontos editados de volta na árvore (mesmo campo que a Árvore de
// Projeto e a aba "Verba por Tarefa" usam). Não re-renderiza a tabela
// inteira (perderia o foco do campo), mas PRECISA recalcular Pontos
// Máximo de todo o pavimento — mudar os Pontos de uma tarefa muda a
// proporção de Verba de todas as outras do mesmo pavimento, então o
// Pontos Máximo delas também muda.
function editarPontosTarefaAtribuicao(inputEl) {
    const [nomeProjeto, caminhoResto] = inputEl.dataset.caminho.split('|');
    const p = caminhoResto.split('-'); // fIdx-eIdx-sIdx-tIdx

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv) return;

    try {
        const tarefa = resolverNoPorPath(arv, caminhoResto);
        tarefa.pontos = inputEl.value;
    } catch (e) {
        return;
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    recalcularGrupoPontosMaximoAtribuicao(inputEl);
}

// --- DATA DE INÍCIO (âncora manual da fila — ver feriados.js) ---
// Grava/remove tarefa.data_inicio_manual e re-renderiza — como a fila
// inteira do executor pode ter se reajustado (tarefas seguintes sem
// âncora própria, ou empurradas pelo conflito abaixo), não dá pra só
// atualizar a célula editada; o painel inteiro precisa recalcular.
//
// EMPURRÃO EM CASCATA (substituiu o confirm()/aviso da entrega
// anterior — decisão nova do usuário): fixar uma data manual pode
// "pousar" em cima do período que outra tarefa do MESMO executor já
// está ocupando. Em vez de só avisar, `fixarAncoraComEmpurrao()`
// (feriados.js) resolve sozinho — empurra automaticamente (de forma
// permanente, gravando uma nova âncora na tarefa empurrada) quem estava
// no caminho, encadeando se isso gerar novos conflitos. A tarefa que o
// analista está editando agora NUNCA é empurrada, mesmo que atropele uma
// tarefa de prioridade mais alta na fila. Como pode mexer em várias
// tarefas de uma vez, mostra um aviso informativo (não bloqueia, só
// avisa o que mudou) quando algo foi empurrado.
function editarDataInicioTarefa(inputEl) {
    const caminho = inputEl.dataset.caminho;
    const novaData = inputEl.value; // '' se o usuário apagou o campo

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return;

    if (novaData && tarefa.executor) {
        const empurradas = fixarAncoraComEmpurrao(tarefa.executor, caminho, novaData, todas);
        localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));

        if (empurradas.length > 0) {
            const detalhes = empurradas.map(e =>
                '• ' + e.nome + ' (' + e.projeto + '): passou a começar em ' + formatarDataPrevistaExibicao(e.dataInicio)
            ).join('\n');
            alert(
                'Data de Início fixada. Pra não conflitar, ' + empurradas.length +
                ' outra(s) tarefa(s) de ' + tarefa.executor + ' foram empurradas automaticamente:\n\n' +
                detalhes
            );
        }

        renderizarPainelAtribuicaoTarefas(true);
        return;
    }

    if (novaData) {
        tarefa.data_inicio_manual = novaData;
    } else {
        delete tarefa.data_inicio_manual;
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarPainelAtribuicaoTarefas(true); // mantém a página atual
}

function limparDataInicioManual(caminho) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return;

    delete tarefa.data_inicio_manual;
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    renderizarPainelAtribuicaoTarefas(true);
}

// --- EDITOR DE SESSÕES DE TRABALHO (correção manual pelo administrador) ---
// Painel flutuante próprio (#at-sessoes-flutuante), mesmo padrão de
// position:fixed do painel de filtros — fica fora da tabela rolável de
// propósito. Mostra a sessão ativa (se tiver, com opção de forçar pausa),
// o histórico de sessões fechadas (cada uma editável/removível), e um
// formulário pra adicionar uma sessão manual (caso o executor tenha
// esquecido de apertar Iniciar e trabalhado sem cronômetro nenhum).

function isoParaDatetimeLocal(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function datetimeLocalParaIso(valor) {
    return new Date(valor).toISOString();
}

function formatarDataHoraExibicao(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function abrirEditorSessoes(event, caminho) {
    event.stopPropagation();
    const painel = document.getElementById('at-sessoes-flutuante');

    const jaAbertoNessaTarefa = painel.dataset.caminhoAtual === caminho && painel.style.display !== 'none';
    if (jaAbertoNessaTarefa) { fecharEditorSessoes(); return; }

    fecharFiltroFlutuante(); // não deixa os dois painéis flutuantes abertos ao mesmo tempo
    renderizarEditorSessoes(caminho);

    const rect = event.currentTarget.getBoundingClientRect();
    painel.style.left = Math.max(10, rect.right - 350) + 'px'; // ancora pela direita, é a última coluna da tabela
    painel.style.top = (rect.bottom + 4) + 'px';
    painel.style.display = 'block';
}

function fecharEditorSessoes() {
    const painel = document.getElementById('at-sessoes-flutuante');
    painel.style.display = 'none';
    painel.dataset.caminhoAtual = '';
}

document.addEventListener('click', function (event) {
    const painel = document.getElementById('at-sessoes-flutuante');
    if (!painel || painel.style.display === 'none') return;
    if (painel.contains(event.target) || event.target.closest('[onclick*="abrirEditorSessoes"]')) return;
    fecharEditorSessoes();
});

function renderizarEditorSessoes(caminho) {
    const painel = document.getElementById('at-sessoes-flutuante');
    painel.dataset.caminhoAtual = caminho;

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) { fecharEditorSessoes(); return; }

    const caminhoJs = caminho.replace(/'/g, "\\'");
    let html = '<div style="font-weight:bold; font-size:12px; margin-bottom:8px; padding:0 4px;">Sessões de Trabalho — ' + tarefa.nome + '</div>';

    if (tarefa.sessao_ativa_inicio) {
        html += '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:8px; margin-bottom:8px; font-size:11px;">' +
            '<b>🔴 Sessão ativa</b> desde ' + formatarDataHoraExibicao(tarefa.sessao_ativa_inicio) +
            '<div style="display:flex; gap:4px; align-items:center; margin-top:6px;">' +
            '<input type="datetime-local" id="at-forcar-pausa-fim" value="' + isoParaDatetimeLocal(new Date().toISOString()) + '" style="font-size:10px; width:150px;">' +
            '<button class="btn-secondary" style="font-size:10px; padding:4px 8px;" onclick="forcarPausaComInput(\'' + caminhoJs + '\')">Forçar Pausa</button>' +
            '</div></div>';
    }

    const sessoes = tarefa.sessoes_trabalho || [];
    if (sessoes.length === 0 && !tarefa.sessao_ativa_inicio) {
        html += '<div style="font-size:11px; color:#94a3b8; padding:8px 4px;">Nenhuma sessão registrada ainda.</div>';
    }

    html += sessoes.map((s, idx) => {
        return '<div style="display:flex; align-items:center; gap:4px; padding:4px; border-bottom:1px solid #f1f5f9; font-size:10px;">' +
            '<input type="datetime-local" value="' + isoParaDatetimeLocal(s.inicio) + '" style="font-size:10px; width:135px;" onchange="editarSessaoComInputs(\'' + caminhoJs + '\', ' + idx + ')" id="at-sessao-inicio-' + idx + '">' +
            '<span>→</span>' +
            '<input type="datetime-local" value="' + isoParaDatetimeLocal(s.fim) + '" style="font-size:10px; width:135px;" onchange="editarSessaoComInputs(\'' + caminhoJs + '\', ' + idx + ')" id="at-sessao-fim-' + idx + '">' +
            '<span style="color:#64748b; white-space:nowrap;">' + s.duracao.toFixed(2) + 'h</span>' +
            (s.manual ? '<span title="Editado manualmente">✏️</span>' : '') +
            '<button class="btn-delete" style="padding:2px 6px; font-size:10px;" onclick="removerSessaoComConfirmacao(\'' + caminhoJs + '\', ' + idx + ')">🗑️</button>' +
            '</div>';
    }).join('');

    html += '<div style="margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0;">' +
        '<div style="font-size:10px; color:#64748b; margin-bottom:4px;">+ Adicionar sessão manual (ex: executor esqueceu de apertar Iniciar):</div>' +
        '<div style="display:flex; gap:4px; align-items:center;">' +
        '<input type="datetime-local" id="at-nova-sessao-inicio" style="font-size:10px; width:135px;">' +
        '<span>→</span>' +
        '<input type="datetime-local" id="at-nova-sessao-fim" style="font-size:10px; width:135px;">' +
        '<button class="btn-primary" style="font-size:10px; padding:4px 8px;" onclick="adicionarSessaoManualComInputs(\'' + caminhoJs + '\')">+ Add</button>' +
        '</div></div>';

    html += '<div style="margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0; text-align:right; font-size:11px; font-weight:bold;">Total: ' + (parseFloat(tarefa.horas_reais) || 0).toFixed(2) + 'h</div>';

    painel.innerHTML = html;
}

function editarSessaoComInputs(caminho, idx) {
    const inicio = datetimeLocalParaIso(document.getElementById('at-sessao-inicio-' + idx).value);
    const fim = datetimeLocalParaIso(document.getElementById('at-sessao-fim-' + idx).value);
    const ok = editarSessao(caminho, idx, inicio, fim);
    if (!ok) alert('Horário inválido — o fim precisa ser depois do início.');
    renderizarEditorSessoes(caminho);
    renderizarPainelAtribuicaoTarefas(true);
}

function removerSessaoComConfirmacao(caminho, idx) {
    if (!confirm('Remover essa sessão?')) return;
    removerSessao(caminho, idx);
    renderizarEditorSessoes(caminho);
    renderizarPainelAtribuicaoTarefas(true);
}

function adicionarSessaoManualComInputs(caminho) {
    const inicioEl = document.getElementById('at-nova-sessao-inicio');
    const fimEl = document.getElementById('at-nova-sessao-fim');
    if (!inicioEl.value || !fimEl.value) return alert('Preencha início e fim.');

    const ok = adicionarSessaoManual(caminho, datetimeLocalParaIso(inicioEl.value), datetimeLocalParaIso(fimEl.value));
    if (!ok) return alert('Horário inválido — o fim precisa ser depois do início.');

    renderizarEditorSessoes(caminho);
    renderizarPainelAtribuicaoTarefas(true);
}

function forcarPausaComInput(caminho) {
    const valor = document.getElementById('at-forcar-pausa-fim').value;
    if (!valor) return alert('Informe o horário de término.');

    const ok = forcarPausaSessaoAtiva(caminho, datetimeLocalParaIso(valor));
    if (!ok) return alert('Horário inválido — o término precisa ser depois do início da sessão.');

    renderizarEditorSessoes(caminho);
    renderizarPainelAtribuicaoTarefas(true);
}

// Recalcula Pontos Máximo de todas as tarefas do mesmo pavimento (mesmo
// "grupo"), lendo os Pontos ATUAIS de cada input na tela (não precisa
// reler do localStorage — o valor editado já está no próprio campo).
function recalcularGrupoPontosMaximoAtribuicao(inputOrigem) {
    const linhaOrigem = inputOrigem.closest('tr');
    const grupo = linhaOrigem.dataset.grupoPav;
    const linhasDoGrupo = Array.from(document.querySelectorAll('#at-tabela-body tr')).filter(tr => tr.dataset.grupoPav === grupo);
    if (linhasDoGrupo.length === 0) return;

    const valorVerbaPav = parseFloat(linhaOrigem.dataset.valorVerbaPav) || 0;
    const totalPontos = linhasDoGrupo.reduce((soma, tr) => soma + (parseFloat(tr.querySelector('.at-input-pontos').value) || 0), 0);

    linhasDoGrupo.forEach(tr => {
        const pontos = parseFloat(tr.querySelector('.at-input-pontos').value) || 0;
        const valorVerbaTarefa = totalPontos > 0 ? (pontos / totalPontos) * valorVerbaPav : 0;
        const custoHora = parseFloat(tr.dataset.custoHora) || 0;
        const pontosMaximo = custoHora > 0 ? (valorVerbaTarefa / custoHora) : 0;
        tr.querySelector('.at-pontos-maximo').innerText = pontosMaximo.toFixed(1);
    });
}
