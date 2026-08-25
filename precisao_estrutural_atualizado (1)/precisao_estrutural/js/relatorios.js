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

// Resolve Etapa/Setor/Pavimento de uma Tarefa-folha PELO NÍVEL REAL de
// cada ancestral (`no.nivel`), não pela posição no breadcrumb. Bug
// relatado pelo usuário ("por que aparece duas vezes o nome das
// tarefas"): `coletarNosFolhaDaArvore()` inclui o nome da própria
// folha como último pedaço do `localizacao` (ex: "Etapa › Pavimento ›
// NomeDaTarefa"), e o código antigo lia `partes[1]`/`partes[2]` como
// se fossem sempre Setor/Pavimento — certo quando os 3 níveis
// existem, mas errado quando um projeto pula o Setor (Árvore Genérica
// permite isso): `partes[1]` vira o Pavimento de verdade (rotulado
// como Setor por engano) e `partes[2]` vira o nome da PRÓPRIA TAREFA
// (rotulado como Pavimento por engano) — daí o nome duplicado
// aparecendo como se fosse um Pavimento com o mesmo nome da Tarefa
// dentro dele. Caminha pelos ancestrais de verdade via
// `resolverNoPorPath()` e usa o `.nivel` de cada um pra saber onde
// colocar o nome — funciona em qualquer profundidade/combinação de
// níveis pulados.
function resolverLocalizacaoPorNivel(arv, path) {
    const segs = String(path).split('-');
    const resultado = { etapa: '—', setor: '—', pavimento: '—' };

    // A Etapa (1º segmento) entra sempre — mesmo no caso "Etapa Única"
    // (path de 1 segmento só, onde a própria Etapa é a folha, sem
    // Setor/Pavimento/Tarefa abaixo dela). O objeto de Etapa não
    // carrega um `.nivel` próprio (mesma convenção de arvore.js, onde
    // `nivel === 'etapa'` chega como parâmetro externo, nunca lido de
    // `no.nivel`), por isso não dá pra usar `no.nivel` pra ela.
    const noEtapa = resolverNoPorPath(arv, segs[0]);
    if (noEtapa) resultado.etapa = noEtapa.nome;

    // Os segmentos do meio (se existirem) são ancestrais de verdade —
    // o ÚLTIMO segmento é sempre a própria folha (a Tarefa, ou a
    // Etapa/Pavimento agindo como folha), por isso fica de fora da
    // varredura.
    for (let i = 1; i < segs.length - 1; i++) {
        const prefixo = segs.slice(0, i + 1).join('-');
        const no = resolverNoPorPath(arv, prefixo);
        if (no && resultado.hasOwnProperty(no.nivel)) resultado[no.nivel] = no.nome;
    }
    return resultado;
}

// Classifica um executor num dos 5 "papéis" que o usuário pediu pra
// filtrar no Relatório de Custos — 3 vêm direto de `nivel`
// (administrador/supervisor/analista); `executor` não é um papel em
// si, então pra ele olha o `cargo` (mesmo padrão de prefixo que
// `funcionarioEhEstagiario()`, distribuicao-lucro.js, já usa) e separa
// entre 'detalhista'/'estagiario'. Sem `banco_funcionarios` batendo
// com o nome (funcionário desligado/renomeado) ou cargo fora dos 2
// prefixos conhecidos, devolve `null` — linha não bate com NENHUMA
// opção do filtro, mas também não quebra nada (só não aparece se um
// papel específico for escolhido).
function papelFuncionarioRelatorio(nomeExecutor) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const f = funcionarios.find(x => x.nome === nomeExecutor);
    if (!f) return null;
    if (f.nivel === 'administrador' || f.nivel === 'supervisor' || f.nivel === 'analista') return f.nivel;
    if (f.nivel === 'executor') {
        const cargo = (f.cargo || '').toLowerCase();
        if (cargo.indexOf('detalhista') === 0) return 'detalhista';
        if (cargo.indexOf('estagiário') === 0) return 'estagiario';
    }
    return null;
}

// Lista FIXA (não "valores distintos que aparecem nos dados", mesmo
// padrão de STATUS_TAREFA_OPCOES mais abaixo) — pedido do usuário:
// "filtros também por administrador, supervisor, analista, detalhista,
// estagiário", as 5 opções ficam sempre disponíveis no filtro mesmo
// que, no momento, não exista nenhuma sessão de alguma delas.
const PAPEIS_FUNCIONARIO_OPCOES = [
    { valor: 'administrador', rotulo: 'Administrador' },
    { valor: 'supervisor', rotulo: 'Supervisor' },
    { valor: 'analista', rotulo: 'Analista' },
    { valor: 'detalhista', rotulo: 'Detalhista' },
    { valor: 'estagiario', rotulo: 'Estagiário' }
];

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
                    papel: papelFuncionarioRelatorio(tarefa.executor),
                    data: dataSessaoISO,
                    horas: horas,
                    valorHora: valorHora,
                    custo: horas * valorHora,
                    manual: !!sessao.manual,
                    // Pedido do usuário (Relatório de Horas, baseado no
                    // sistema antigo): mostrar Início/Fim como horário
                    // exato, não só a duração — campos NOVOS, aditivos,
                    // não usados pelo motor genérico (Nível/Colunas)
                    // acima, que ignora qualquer propriedade que não
                    // esteja no seu próprio catálogo.
                    horaInicio: formatarHoraMinutoRelatorio(sessao.inicio),
                    horaFim: formatarHoraMinutoRelatorio(sessao.fim)
                });
            });
        }

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            const loc = resolverLocalizacaoPorNivel(arv, path);
            empilharSessoes(tarefa, loc.etapa, loc.setor, loc.pavimento, nomeProjeto + '|' + path);
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

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            if (!tarefa.executor) return;
            const loc = resolverLocalizacaoPorNivel(arv, path);
            // NÃO lê tarefa.horas_reais direto (bug relatado pelo
            // usuário: "não aparecem as horas realizadas" — esse campo
            // é DERIVADO/cacheado e encontrado DESSINCRONIZADO das
            // sessões de verdade em várias tarefas reais, tanto pra
            // menos quanto pra mais — provavelmente resquício de dados
            // de antes da reforma que tornou horas_reais "sempre
            // recalculado" (ver apontamento.js:20-23). Soma direto
            // tarefa.sessoes_trabalho, a mesma fonte robusta que
            // calcularCustoRealTarefa() já usa logo abaixo e que
            // coletarLinhasSessaoTrabalho() (nível Sessão) também usa —
            // impossível ficar desatualizado, e não depende de nenhum
            // outro código ter lembrado de recalcular o campo cacheado.
            const horasRealizadas = (Array.isArray(tarefa.sessoes_trabalho) ? tarefa.sessoes_trabalho : [])
                .reduce((s, sessao) => s + (parseFloat(sessao.duracao) || 0), 0);
            const custoReal = calcularCustoRealTarefa(tarefa, tarefa.executor);
            const dataInicioReal = obterDataInicioExecucaoReal(tarefa);

            // Horas Previstas = Pontos da tarefa (pedido do usuário,
            // parte 19): o campo "Pontos", atribuído na aba Atribuição
            // de Tarefas, passou a ser a própria estimativa de horas —
            // 1 ponto = 1 hora prevista. A fórmula antiga (base_h do
            // Catálogo de Tarefas × qtd_física × peso_esforço ×
            // f_esb × f_analista) foi abandonada aqui: o usuário disse
            // que a hora-base cadastrada no catálogo "serve apenas
            // como referência", não deve mais alimentar o previsto.
            // Nota: a Calibração BI (arvore.js, marcação de
            // is_outlier) ainda usa a fórmula antiga em separado — não
            // foi pedido mexer nela nesta parte, então os dois
            // critérios de outlier podem divergir por enquanto.
            const horasPrevistas = parseFloat(tarefa.pontos) || 0;
            const desvioPct = horasPrevistas > 0 ? Math.abs((horasRealizadas - horasPrevistas) / horasPrevistas) * 100 : 0;
            const outlier = desvioPct > 40; // mesmo critério de sempre (>40% de desvio)

            linhas.push({
                caminho: nomeProjeto + '|' + path,
                projeto: nomeProjeto,
                cliente: cliente,
                etapa: loc.etapa,
                setor: loc.setor,
                pavimento: loc.pavimento,
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

// Uma linha por (Projeto, Etapa) — % concluída, mesmo cálculo já usado
// no Painel de Progresso (`calcularProgressoProjeto()`, painel-progresso.js:
// verba das Tarefas "Finalizada" sobre a verba total da Etapa). Junto
// com a % de cada Etapa, cada linha também carrega `pctProjeto` — a
// média das Etapas daquele projeto — pra dar um número único de
// "avanço geral" sem precisar agrupar (pedido do usuário: "Relatório
// de avanço de projeto (% concluída)"). Projeto sem nenhuma Etapa
// cadastrada não entra (não tem % pra mostrar).
function coletarLinhasAvancoProjeto() {
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;
    let linhas = [];

    projetos.forEach(proj => {
        if (projetosPermitidos && !projetosPermitidos.has(proj.nome)) return;
        const etapas = typeof calcularProgressoProjeto === 'function' ? calcularProgressoProjeto(proj.nome) : [];
        if (etapas.length === 0) return;
        const pctProjeto = etapas.reduce((s, e) => s + e.percentual, 0) / etapas.length;

        etapas.forEach(e => {
            linhas.push({
                projeto: proj.nome,
                cliente: proj.cliente || '',
                etapa: e.etapa,
                pctEtapa: e.percentual,
                pctProjeto: pctProjeto,
                localizacaoAtual: e.localizacaoAtual || '—'
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
        if (filtros.setor && l.setor !== filtros.setor) return false;
        if (filtros.pavimento && l.pavimento !== filtros.pavimento) return false;
        if (filtros.tarefa && l.tarefa !== filtros.tarefa) return false;
        if (filtros.cliente && l.cliente !== filtros.cliente) return false;
        if (filtros.executor && l.executor !== filtros.executor) return false;
        if (filtros.papel && l.papel !== filtros.papel) return false;
        if (filtros.status && l.status !== filtros.status) return false;
        if (filtros.campoData && (filtros.dataDe || filtros.dataAte)) {
            const dataLinha = l[filtros.campoData];
            if (!dataLinha) return false;
            if (filtros.dataDe && dataLinha < filtros.dataDe) return false;
            if (filtros.dataAte && dataLinha > filtros.dataAte) return false;
        }
        return true;
    });
}

// Aceita tanto um array de campos (['projeto','executor']) quanto,
// por compatibilidade com Visões salvas antes desta versão, uma
// string única ('executor') ou vazio/nulo — sempre devolve array
// (sem campo nenhum = []).
function normalizarCamposAgrupar(agrupar) {
    if (Array.isArray(agrupar)) return agrupar.filter(Boolean);
    return agrupar ? [agrupar] : [];
}

// --- MOTOR DE AGRUPAMENTO ---
// Agrupa por UM OU MAIS campos (ex: só 'executor', ou 'projeto' +
// 'executor' juntos — pedido do usuário: "acumulado por projeto, por
// executor, ou projeto e executor") e soma os campos numéricos
// listados em `camposSoma` — os outros campos da linha original se
// perdem no agrupamento (só faz sentido ver os campos que viraram
// agrupador + os totais). Sem nenhum campo de agrupar, devolve a lista
// original sem alterar (linha a linha). `_quantidade` = quantas linhas
// originais formaram aquele grupo, útil pra dar contexto no relatório
// (ex: "12 sessões" por trás do total). `_linhas` = as linhas originais
// que caíram nesse grupo (não só um resumo) — usado por colunas com
// `derivarDoGrupo` no catálogo (ver montarResultadoRelatorio()) que
// precisam olhar o dado individual de cada uma, não só a soma; função
// continua genérica, não sabe o nome de nenhum campo específico. Função
// pura, testável sem DOM.
function agruparLinhasRelatorio(linhas, camposAgrupar, camposSoma) {
    const campos = normalizarCamposAgrupar(camposAgrupar);
    if (campos.length === 0) return linhas;
    const grupos = {};
    const ordem = []; // preserva a ordem de primeira aparição, não ordena por nome
    linhas.forEach(l => {
        const chave = campos.map(c => l[c]).join('␟'); // separador improvável de colidir com dado real
        if (!grupos[chave]) {
            grupos[chave] = { _quantidade: 0, _linhas: [] };
            campos.forEach(c => grupos[chave][c] = l[c]);
            camposSoma.forEach(c => grupos[chave][c] = 0);
            ordem.push(chave);
        }
        camposSoma.forEach(c => grupos[chave][c] += (parseFloat(l[c]) || 0));
        grupos[chave]._quantidade++;
        grupos[chave]._linhas.push(l);
    });
    return ordem.map(chave => grupos[chave]);
}

// Ordena as linhas já filtradas/agrupadas por UMA coluna, clicável no
// cabeçalho da tabela (pedido do usuário: "classificar cada coluna por
// ordem de apresentação"). Números/horas/moeda/percentual comparam como
// número; data compara como string ISO (ordena certo sem precisar
// converter, AAAA-MM-DD já é ordenável lexicograficamente); texto usa
// localeCompare pt-BR (acentuação correta). `coluna` é o objeto do
// catálogo (precisa do `.tipo`), não só o id — função pura, testável
// sem DOM.
function ordenarLinhasRelatorio(linhas, coluna, direcao) {
    if (!coluna) return linhas;
    const numerico = coluna.tipo === 'numero' || coluna.tipo === 'horas' || coluna.tipo === 'moeda' || coluna.tipo === 'percentual';
    const mult = direcao === 'desc' ? -1 : 1;
    return linhas.slice().sort((a, b) => {
        const va = a[coluna.id], vb = b[coluna.id];
        if (numerico) return ((parseFloat(va) || 0) - (parseFloat(vb) || 0)) * mult;
        return String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb), 'pt-BR') * mult;
    });
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
            // Não é `somavel` (somar taxas não faz sentido) nem faz parte
            // de nenhum agrupamento — sem `derivarDoGrupo`, sumia (virava
            // "—") toda vez que a tabela estava agrupada por qualquer
            // campo (bug relatado pelo usuário: "selecionei a coluna
            // Valor da Hora mas ela não aparece"). Pedido explícito do
            // usuário sobre COMO mostrar: "deve ser aquele cadastrado no
            // cadastro de funcionários" — ou seja, o valor REAL de cada
            // apontamento (já é o que `coletarLinhasSessaoTrabalho()`
            // grava em cada sessão via `valorHoraVigente()`), nunca uma
            // média/conta inventada. `derivarDoGrupo` olha os valores
            // reais de TODOS os apontamentos que caíram no grupo
            // (`g._linhas`): se todos usaram a mesma taxa, mostra ela
            // (ainda é "aquele cadastrado", só que 1 grupo = 1 taxa); se
            // o grupo juntou apontamentos com taxas diferentes (ex:
            // executor teve reajuste no meio, ou mais de um executor),
            // lista os valores distintos de verdade, cada um vindo do
            // cadastro — nunca inventa um número que não corresponde a
            // nenhum apontamento real.
            {
                id: 'valorHora', rotulo: 'Valor da Hora', padrao: false, somavel: false, tipo: 'moeda',
                derivarDoGrupo: (g) => {
                    const distintos = Array.from(new Set((g._linhas || []).map(l => l.valorHora).filter(v => v !== undefined && v !== null)));
                    if (distintos.length === 0) return null;
                    if (distintos.length === 1) return distintos[0];
                    const texto = distintos.sort((a, b) => a - b)
                        .map(v => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                        .join(' / ');
                    return { __texto: texto };
                }
            },
            { id: 'custo', rotulo: 'Custo', padrao: true, somavel: true, tipo: 'moeda' },
        ],
        camposAgrupar: ['projeto', 'etapa', 'pavimento', 'cliente', 'executor', 'tarefa', 'data']
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
        camposAgrupar: ['projeto', 'etapa', 'cliente', 'executor', 'status', 'tarefa', 'dataInicioReal']
    },
    avanco: {
        rotulo: 'Avanço de Projeto',
        descricao: '% concluída por Etapa e no Projeto (mesmo cálculo do Painel de Progresso)',
        coletor: coletarLinhasAvancoProjeto,
        campoData: null, // "foto" do estado atual — não tem "quando", então não filtra por período
        colunas: [
            { id: 'projeto', rotulo: 'Projeto', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'cliente', rotulo: 'Cliente', padrao: false, somavel: false, tipo: 'texto' },
            { id: 'etapa', rotulo: 'Etapa', padrao: true, somavel: false, tipo: 'texto' },
            { id: 'pctEtapa', rotulo: '% Concluída (Etapa)', padrao: true, somavel: false, tipo: 'percentual' },
            { id: 'pctProjeto', rotulo: '% Concluída (Projeto)', padrao: true, somavel: false, tipo: 'percentual' },
            { id: 'localizacaoAtual', rotulo: 'Localização Atual', padrao: false, somavel: false, tipo: 'texto' },
        ],
        camposAgrupar: ['projeto', 'cliente']
    }
};

// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_relatorios_catalogo_composicao.js).
function formatarValorColuna(tipo, valor) {
    if (valor === undefined || valor === null || valor === '') return '—';
    // Saída de escape pra colunas com `derivarDoGrupo` que precisam
    // mostrar texto JÁ FORMATADO (ex: "R$ 20,00 / R$ 25,00" quando um
    // grupo juntou apontamentos com taxas diferentes) — sem isso,
    // `parseFloat()` abaixo cortaria pro primeiro número e perderia o
    // resto do texto.
    if (typeof valor === 'object' && valor !== null && '__texto' in valor) return valor.__texto;
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
function montarResultadoRelatorio(nivel, linhasBase, filtros, colunasAtivasIds, camposAgrupar) {
    const def = NIVEIS_RELATORIO[nivel];
    const filtrosComData = Object.assign({}, filtros, { campoData: def.campoData });
    const linhasFiltradas = aplicarFiltrosRelatorio(linhasBase, filtrosComData);

    const colunas = def.colunas.filter(c => colunasAtivasIds.has(c.id));
    const camposSoma = colunas.filter(c => c.somavel).map(c => c.id);
    const camposAgruparNorm = normalizarCamposAgrupar(camposAgrupar);
    const linhasFinal = agruparLinhasRelatorio(linhasFiltradas, camposAgruparNorm, camposSoma);

    // Colunas "derivadas de grupo" (`derivarDoGrupo` no catálogo, ex:
    // Valor da Hora) só fazem sentido recalcular QUANDO agrupado — sem
    // agrupamento a linha já é a sessão/tarefa original, com o valor
    // exato dela (recalcular aqui poderia até zerar por engano uma
    // linha com 0h). Roda depois do agrupamento pra usar os campos JÁ
    // somados (ex: Custo/Horas do grupo), e só pra colunas que não
    // viraram elas mesmas a chave do agrupamento (aí já têm o valor
    // real, não precisam de fórmula).
    if (camposAgruparNorm.length > 0) {
        colunas.forEach(c => {
            if (typeof c.derivarDoGrupo === 'function' && camposAgruparNorm.indexOf(c.id) === -1) {
                linhasFinal.forEach(l => { l[c.id] = c.derivarDoGrupo(l); });
            }
        });
    }

    // Linha de "Total Geral" no rodapé — soma os campos somáveis
    // independente de estar agrupado ou não (agrupar ou não dá na mesma
    // soma total, só muda como as linhas do meio são exibidas). É o que
    // faz "Custo Total" existir como visão simples: nível Sessão, coluna
    // Custo, sem precisar agrupar por nada — o rodapé já mostra o total.
    const totais = {};
    camposSoma.forEach(c => { totais[c] = linhasFinal.reduce((s, l) => s + (parseFloat(l[c]) || 0), 0); });

    return { colunas: colunas, linhas: linhasFinal, agrupado: camposAgruparNorm.length > 0, totalLinhasBase: linhasFiltradas.length, totais: totais };
}

// --- VISÕES SALVAS (compartilhadas — decisão explícita do usuário, não
// é por usuário) ---
// `banco_relatorios_visoes` = array de
//   { id, nome, fabrica (bool), nivel, filtros, colunas (array de ids),
//     agrupar }

// Os 5 relatórios originais que encaixam de verdade no motor genérico
// (ver prompt_gemini.md §11), mais os que o usuário foi descrevendo na
// rodada de reformulação da aba (prompt_gemini.md, parte 17): "número
// de horas por período, acumulado por executor/projeto/projeto e
// executor" (2 novas), "custos com nome do executor/horas/valor,
// acumulado por projeto e executor" (1 nova), "lista de lançamentos de
// horas no período" (1 nova — o motor genérico serve de complemento à
// tela fixa "Relatório de horas", pra quem quiser combinar com outros
// filtros/colunas/agrupamentos), "previsto × realizado, acumulado por
// projeto/executor/status" (3 novas) e "avanço de projeto, % concluída"
// (1 nova, usa o novo nível `avanco`). Os 2 que ficaram de fora de
// propósito ("Tarefas em atraso" e um detalhamento por Etapa que
// precisaria de Data Prevista de Fim por tarefa) seguem pendentes —
// fica pra quando/se o catálogo for estendido com essa coluna.
function visoesDeFabrica() {
    return [
        { id: 'fabrica_custo_funcionario', nome: 'Custo por Funcionário e Período', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['executor', 'horas', 'custo'], agrupar: ['executor'] },
        { id: 'fabrica_custo_projeto', nome: 'Custo por Projeto', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'horas', 'custo'], agrupar: ['projeto'] },
        { id: 'fabrica_custo_projeto_executor', nome: 'Custo por Projeto e Executor', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'executor', 'horas', 'custo'], agrupar: ['projeto', 'executor'] },
        { id: 'fabrica_custo_total', nome: 'Custo Total', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'executor', 'horas', 'custo'], agrupar: [] },
        { id: 'fabrica_horas_funcionario', nome: 'Horas por Executor e Período', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['executor', 'horas'], agrupar: ['executor'] },
        { id: 'fabrica_horas_projeto', nome: 'Horas por Projeto e Período', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'horas'], agrupar: ['projeto'] },
        { id: 'fabrica_horas_projeto_executor', nome: 'Horas por Projeto e Executor', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'executor', 'horas'], agrupar: ['projeto', 'executor'] },
        { id: 'fabrica_lancamentos_periodo', nome: 'Lançamentos de Horas (lista detalhada)', fabrica: true, nivel: 'sessao', filtros: {}, colunas: ['projeto', 'executor', 'tarefa', 'data', 'horas'], agrupar: [] },
        { id: 'fabrica_previsto_realizado', nome: 'Horas Previstas vs. Realizadas', fabrica: true, nivel: 'tarefa', filtros: {}, colunas: ['tarefa', 'executor', 'horasPrevistas', 'horasRealizadas', 'desvioPct'], agrupar: [] },
        { id: 'fabrica_previsto_realizado_projeto', nome: 'Previsto × Realizado por Projeto', fabrica: true, nivel: 'tarefa', filtros: {}, colunas: ['projeto', 'horasPrevistas', 'horasRealizadas', 'desvioPct'], agrupar: ['projeto'] },
        { id: 'fabrica_previsto_realizado_executor', nome: 'Previsto × Realizado por Executor', fabrica: true, nivel: 'tarefa', filtros: {}, colunas: ['executor', 'horasPrevistas', 'horasRealizadas', 'desvioPct'], agrupar: ['executor'] },
        { id: 'fabrica_previsto_realizado_status', nome: 'Previsto × Realizado por Status', fabrica: true, nivel: 'tarefa', filtros: {}, colunas: ['status', 'horasPrevistas', 'horasRealizadas', 'desvioPct'], agrupar: ['status'] },
        { id: 'fabrica_avanco_projeto', nome: 'Avanço de Projeto (%)', fabrica: true, nivel: 'avanco', filtros: {}, colunas: ['projeto', 'etapa', 'pctEtapa', 'pctProjeto'], agrupar: [] }
    ];
}

// Semeia as de fábrica na PRIMEIRA vez que a tela é aberta
// (`banco_relatorios_visoes` inexistente ou vazio). Depois disso, o
// array salvo é sempre a fonte de verdade — mas se uma versão nova
// deste arquivo acrescentou uma visão de fábrica que ainda não existe
// no array já salvo (ex: alguém que já usava a tela antes desta
// reformulação), ela é adicionada por cima, sem duplicar nem mexer nas
// visões que a pessoa já tem ou já editou.
function carregarVisoesRelatorio() {
    let visoes = JSON.parse(localStorage.getItem('banco_relatorios_visoes'));
    if (!Array.isArray(visoes) || visoes.length === 0) {
        visoes = visoesDeFabrica();
        localStorage.setItem('banco_relatorios_visoes', JSON.stringify(visoes));
        return visoes;
    }
    const idsExistentes = new Set(visoes.map(v => v.id));
    const faltando = visoesDeFabrica().filter(v => !idsExistentes.has(v.id));
    if (faltando.length > 0) {
        visoes = visoes.concat(faltando);
        localStorage.setItem('banco_relatorios_visoes', JSON.stringify(visoes));
    }
    return visoes;
}

function salvarNovaVisaoRelatorio(nome, nivel, filtros, colunasIds, agrupar) {
    if (!nome || !nome.trim()) return { ok: false, erro: 'Informe um nome pra visão.' };
    const visoes = carregarVisoesRelatorio();
    const id = 'visao_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    visoes.push({ id: id, nome: nome.trim(), fabrica: false, nivel: nivel, filtros: filtros || {}, colunas: Array.from(colunasIds), agrupar: normalizarCamposAgrupar(agrupar) });
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
let relAgruparAtivos = new Set();
// Ordenação por coluna (clique no cabeçalho) — não faz parte de Visão
// salva de propósito (é um jeito rápido de reler a MESMA consulta já
// montada, não uma configuração que precise sobreviver entre sessões).
let relOrdenacao = { campo: null, direcao: 'asc' };

// Loop sobre os níveis do catálogo em vez de listar cada botão à mão —
// assim o 3º nível (Avanço de Projeto) não precisou duplicar essa
// lógica num segundo lugar (mudarNivelRelatorio E
// carregarVisaoSelecionadaRelatorio já tinham essa duplicação com só 2
// níveis; ia piorar com 3).
function atualizarBotoesNivelRelatorio(nivel) {
    Object.keys(NIVEIS_RELATORIO).forEach(id => {
        const el = document.getElementById('rel-nivel-' + id);
        if (el) el.classList.toggle('ativo', id === nivel);
    });
}

function carregarPainelRelatorios() {
    carregarVisoesRelatorio(); // garante que as 5 de fábrica existem
    renderizarSeletorVisoesRelatorio();
    document.getElementById('rel-seletor-visao').value = '';
    document.getElementById('rel-btn-apagar-visao').style.display = 'none';
    mudarNivelRelatorio('sessao');
    // Pedido do usuário: a tela sempre abre no "Relatório de Custos"
    // (tela dedicada, baseada no sistema antigo) — mesma lógica de
    // "sempre volta pro estado inicial" que outras telas já usam
    // (ex: alternarModulo('arvore')).
    alternarTipoRelatorio('custos');
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
    atualizarBotoesNivelRelatorio(nivel);
    relColunasAtivas = new Set(NIVEIS_RELATORIO[nivel].colunas.filter(c => c.padrao).map(c => c.id));
    relAgruparAtivos = new Set();
    relOrdenacao = { campo: null, direcao: 'asc' };

    ['projeto', 'etapa', 'cliente', 'executor', 'status'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = '';
    });
    document.getElementById('rel-filtro-data-de').value = '';
    document.getElementById('rel-filtro-data-ate').value = '';

    renderizarOpcoesFiltroRelatorio();
    renderizarChipsColunasRelatorio();
    renderizarChipsAgruparRelatorio();
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

// Chips (não mais um <select> de opção única) — pedido do usuário:
// poder acumular por MAIS de um campo ao mesmo tempo (ex: Projeto +
// Executor juntos numa mesma linha do relatório).
function renderizarChipsAgruparRelatorio() {
    const lista = document.getElementById('rel-lista-agrupar');
    const def = NIVEIS_RELATORIO[relNivelAtivo];
    const rotulos = {};
    def.colunas.forEach(c => { rotulos[c.id] = c.rotulo; });
    lista.innerHTML = def.camposAgrupar.map(id =>
        '<div class="coluna-chip ' + (relAgruparAtivos.has(id) ? 'ativo' : '') + '" onclick="alternarAgruparRelatorio(\'' + id + '\')">' + rotulos[id] + '</div>'
    ).join('');
}

function alternarAgruparRelatorio(id) {
    if (relAgruparAtivos.has(id)) relAgruparAtivos.delete(id); else relAgruparAtivos.add(id);
    renderizarChipsAgruparRelatorio();
    renderizarTabelaRelatorio();
}

// Mesma lista/ordem já usada no filtro de Status do Kanban
// (index.html, #kb-filtro-status) — repetida aqui porque não existia
// uma constante compartilhada; se um status novo for criado no
// sistema, precisa atualizar os dois lugares.
const STATUS_TAREFA_OPCOES = ['Apontada', 'Em Desenvolvimento', 'Aguardando Verificação', 'Para revisão', 'Finalizada'];

// Popula Projeto/Etapa/Cliente/Executor com os valores DISTINTOS que
// aparecem de verdade nos dados do nível atual — não lista o cadastro
// inteiro, só o que tem dado nesse nível, pra não oferecer uma opção
// que sempre daria uma tabela vazia. Status é diferente: usa a lista
// FIXA de todos os status possíveis (pedido do usuário — "coloque as
// alternativas de status apontada, em execução, finalizada, etc"), não
// só os que aparecem nos dados já carregados — senão um status raro
// (ex: nenhuma tarefa "Para revisão" no momento) simplesmente some do
// filtro.
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

    const selStatus = document.getElementById('rel-filtro-status');
    if (selStatus) {
        const valorAtual = selStatus.value;
        selStatus.innerHTML = '<option value="">-- Todos --</option>' + STATUS_TAREFA_OPCOES.map(v => '<option value="' + v + '">' + v + '</option>').join('');
        selStatus.value = valorAtual;
    }
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
        status: document.getElementById('rel-filtro-status').value || null,
        dataDe: document.getElementById('rel-filtro-data-de').value || null,
        dataAte: document.getElementById('rel-filtro-data-ate').value || null
    };
}

function limparFiltrosRelatorio() {
    ['projeto', 'etapa', 'cliente', 'executor', 'status'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = '';
    });
    document.getElementById('rel-filtro-data-de').value = '';
    document.getElementById('rel-filtro-data-ate').value = '';
    renderizarTabelaRelatorio();
}

// Alterna a ordenação da coluna clicada no cabeçalho: 1º clique
// ascendente, 2º clique na mesma coluna inverte pra descendente,
// clicar noutra coluna troca e volta a ascendente (mesmo padrão de
// planilha). Se a coluna clicada sumir da tabela (ex: usuário
// desmarcou ela logo depois), `ordenarLinhasRelatorio()` já ignora o
// pedido de ordenação (`coluna` não encontrada = sem-op), sem precisar
// resetar aqui.
function ordenarColunaRelatorio(campoId) {
    if (relOrdenacao.campo === campoId) {
        relOrdenacao.direcao = relOrdenacao.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        relOrdenacao.campo = campoId;
        relOrdenacao.direcao = 'asc';
    }
    renderizarTabelaRelatorio();
}

function renderizarTabelaRelatorio() {
    const linhasBase = NIVEIS_RELATORIO[relNivelAtivo].coletor();
    const resultado = montarResultadoRelatorio(relNivelAtivo, linhasBase, lerFiltrosRelatorio(), relColunasAtivas, Array.from(relAgruparAtivos));

    const area = document.getElementById('rel-area-resultado');
    if (resultado.colunas.length === 0) {
        area.innerHTML = '<div class="aviso-selecione">Selecione ao menos 1 coluna pra exibir o relatório.</div>';
        return;
    }

    const colunaOrdenacao = resultado.colunas.find(c => c.id === relOrdenacao.campo);
    const linhasOrdenadas = ordenarLinhasRelatorio(resultado.linhas, colunaOrdenacao, relOrdenacao.direcao);

    const corpo = linhasOrdenadas.map(linha => {
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

    const cabecalho = resultado.colunas.map(c => {
        const ativa = relOrdenacao.campo === c.id;
        const seta = ativa ? (relOrdenacao.direcao === 'asc' ? ' ▲' : ' ▼') : '';
        return '<th class="rel-th-ordenavel' + (ativa ? ' ativo' : '') + '" onclick="ordenarColunaRelatorio(\'' + c.id + '\')" title="Ordenar por ' + c.rotulo + '">' + c.rotulo + seta + '</th>';
    }).join('');

    area.innerHTML =
        '<div class="table-wrapper"><table>' +
        '<thead><tr>' + cabecalho + '</tr></thead>' +
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
    atualizarBotoesNivelRelatorio(visao.nivel);
    renderizarOpcoesFiltroRelatorio();

    ['projeto', 'etapa', 'cliente', 'executor', 'status'].forEach(c => {
        const el = document.getElementById('rel-filtro-' + c);
        if (el) el.value = (visao.filtros && visao.filtros[c]) || '';
    });
    document.getElementById('rel-filtro-data-de').value = (visao.filtros && visao.filtros.dataDe) || '';
    document.getElementById('rel-filtro-data-ate').value = (visao.filtros && visao.filtros.dataAte) || '';

    relColunasAtivas = new Set(visao.colunas);
    renderizarChipsColunasRelatorio();
    relAgruparAtivos = new Set(normalizarCamposAgrupar(visao.agrupar));
    renderizarChipsAgruparRelatorio();
    relOrdenacao = { campo: null, direcao: 'asc' };

    renderizarTabelaRelatorio();
}

function salvarVisaoAtualRelatorio() {
    const nome = prompt('Nome da visão (fica disponível pra todo mundo que acessa Relatórios):');
    if (!nome) return;
    const resultado = salvarNovaVisaoRelatorio(nome, relNivelAtivo, lerFiltrosRelatorio(), relColunasAtivas, Array.from(relAgruparAtivos));
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

// =========================================================================
// "RELATÓRIO DE CUSTOS" — tela dedicada (reforma de 2026-08-17, pedido
// do usuário: reformular a aba Relatórios com base no sistema antigo
// da equipe). Renomeado de "Relatório de horas" (parte 16) pra
// "Relatório de Custos" (parte 18) — pedido do usuário, com base no
// modelo real do sistema antigo que ele mostrou: uma árvore
// Projeto → Etapa → Setor → Pavimento → Tarefa, recolhida por padrão
// (só Projeto visível, com Tempo/Custo já somados), que expande nível
// por nível; e um resumo separado por Executor (nome, Tempo, Custo),
// pra fechar pagamento mensal. Ao contrário do motor genérico acima
// (Nível/Filtro/Colunas/Agrupar/Visões), esta é uma tela FIXA — mais
// parecida com o relatório antigo que a equipe já conhecia. Reaproveita
// as funções PURAS de dados já existentes (coletarLinhasSessaoTrabalho,
// aplicarFiltrosRelatorio, nomeParaExibicao, formatarValorColuna) — só
// a camada de tela é nova. O motor genérico continua 100% intacto
// (virou "Relatório personalizado", mais uma orelha ao lado) — nada
// foi apagado, só deixou de ser a tela padrão. A partir da parte 19 a
// troca de tipo usa orelhas horizontais (ver TIPOS_RELATORIO logo
// abaixo), não mais a barra lateral original desta parte 16.
// =========================================================================

// Orelhas horizontais (parte 19, pedido do usuário: "mesma lógica da
// aba Cadastros" — reaproveita as classes .aprov-abas/.aprov-aba já
// usadas lá e em Aprovações, em vez da antiga barra lateral
// .rel-sidebar). Um item por relatório REALMENTE implementado — sem
// placeholders "em breve": quando um novo tipo pré-estabelecido for
// construído de verdade, basta acrescentar aqui + a orelha/conteúdo
// correspondente no index.html (id `rel-aba-<tipo>` / `rel-conteudo-<tipo>`).
const TIPOS_RELATORIO = ['custos', 'personalizado'];

function alternarTipoRelatorio(tipo) {
    TIPOS_RELATORIO.forEach(t => {
        const aba = document.getElementById('rel-aba-' + t);
        if (aba) aba.classList.toggle('aprov-aba-ativa', t === tipo);
        const conteudo = document.getElementById('rel-conteudo-' + t);
        if (conteudo) conteudo.style.display = t === tipo ? 'block' : 'none';
    });
    if (tipo === 'custos') carregarRelatorioCustos();
}

function carregarRelatorioCustos() {
    renderizarOpcoesFiltroRelatorioCustos();
    exibirRelatorioCustos();
}

// Popula Projeto/Etapa/Cliente/Executor só com os valores que aparecem
// de verdade nas sessões de trabalho existentes — mesmo padrão de
// renderizarOpcoesFiltroRelatorio() (motor genérico), só que fixo no
// nível Sessão (é a única fonte de dado que faz sentido pra um
// relatório de CUSTOS).
function renderizarOpcoesFiltroRelatorioCustos() {
    const linhas = coletarLinhasSessaoTrabalho();
    const distintos = (campo) => Array.from(new Set(linhas.map(l => l[campo]).filter(Boolean))).sort();

    ['projeto', 'etapa', 'setor', 'pavimento', 'tarefa', 'cliente', 'executor'].forEach(campo => {
        const sel = document.getElementById('rel-custos-filtro-' + campo);
        if (!sel) return;
        const valorAtual = sel.value;
        const rotulo = (v) => campo === 'executor' ? nomeParaExibicao(v) : v;
        sel.innerHTML = '<option value="">-- Todos --</option>' + distintos(campo).map(v => '<option value="' + v + '">' + rotulo(v) + '</option>').join('');
        sel.value = valorAtual;
    });

    // Papel é lista FIXA (PAPEIS_FUNCIONARIO_OPCOES), não "valores que
    // aparecem nos dados" — mesmo espírito do filtro de Status no
    // motor genérico (renderizarOpcoesFiltroRelatorio()).
    const selPapel = document.getElementById('rel-custos-filtro-papel');
    if (selPapel) {
        const valorAtual = selPapel.value;
        selPapel.innerHTML = '<option value="">-- Todos --</option>' + PAPEIS_FUNCIONARIO_OPCOES.map(p => '<option value="' + p.valor + '">' + p.rotulo + '</option>').join('');
        selPapel.value = valorAtual;
    }
}

function lerFiltrosRelatorioCustos() {
    return {
        projeto: document.getElementById('rel-custos-filtro-projeto').value || null,
        etapa: document.getElementById('rel-custos-filtro-etapa').value || null,
        setor: document.getElementById('rel-custos-filtro-setor').value || null,
        pavimento: document.getElementById('rel-custos-filtro-pavimento').value || null,
        tarefa: document.getElementById('rel-custos-filtro-tarefa').value || null,
        cliente: document.getElementById('rel-custos-filtro-cliente').value || null,
        executor: document.getElementById('rel-custos-filtro-executor').value || null,
        papel: document.getElementById('rel-custos-filtro-papel').value || null,
        dataDe: document.getElementById('rel-custos-filtro-data-de').value || null,
        dataAte: document.getElementById('rel-custos-filtro-data-ate').value || null,
        campoData: 'data'
    };
}

function limparFiltrosRelatorioCustos() {
    ['projeto', 'etapa', 'setor', 'pavimento', 'tarefa', 'cliente', 'executor', 'papel'].forEach(c => {
        const el = document.getElementById('rel-custos-filtro-' + c);
        if (el) el.value = '';
    });
    document.getElementById('rel-custos-filtro-data-de').value = '';
    document.getElementById('rel-custos-filtro-data-ate').value = '';
    exibirRelatorioCustos();
}

function alternarPainelFiltroRelatorioCustos() {
    document.getElementById('rel-custos-corpo-filtro').classList.toggle('aberto');
    document.getElementById('rel-custos-seta-filtro').classList.toggle('aberto');
}

// Botão "Exibir" (pedido do usuário, igual ao sistema antigo — a
// tabela só atualiza quando a pessoa manda, não a cada tecla digitada
// no filtro). Alimenta as DUAS áreas de resultado (árvore Projeto/
// Etapa/... e resumo por Executor) com o MESMO conjunto de linhas já
// filtradas, pra garantir que os totais das duas batem entre si.
function exibirRelatorioCustos() {
    const linhas = coletarLinhasSessaoTrabalho();
    const filtradas = aplicarFiltrosRelatorio(linhas, lerFiltrosRelatorioCustos());
    renderizarArvoreRelatorioCustos(filtradas);
    renderizarResumoExecutorRelatorioCustos(filtradas);
}

// Formata como HH:MM (ex: "16:05"), podendo passar de 24h — é soma
// acumulada de horas trabalhadas, não hora do relógio. Modelo pedido
// pelo usuário (relatório antigo). Diferente de
// formatarValorColuna('horas', ...), que mostra decimal ("16.1h") —
// essa outra função continua em uso no motor genérico ("Relatório
// personalizado"), que não teve seu formato alterado.
function formatarHorasHHMM(horasDecimal) {
    const totalMin = Math.round((parseFloat(horasDecimal) || 0) * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h + ':' + String(m).padStart(2, '0');
}

// --- Árvore Projeto → Etapa → Setor → Pavimento → Tarefa ---
// Constrói a árvore a partir das linhas JÁ FILTRADAS (não lê o banco
// de árvores direto) — assim os totais de cada nível respeitam
// exatamente o filtro/período escolhido, sem precisar recalcular nada
// separado. Um nível sem valor real pro ramo (Setor ou Pavimento
// '—', quando a Tarefa está direto na Etapa, ex: Etapa Única) é
// pulado — mesmo espírito de "níveis puláveis" que a Árvore Genérica
// Recursiva já usa no resto do sistema (ver arvore.js).
// Ordem fixa dos 6 níveis — usada tanto pra montar a árvore quanto
// pra desenhar o cabeçalho de 2 linhas e decidir em qual par de
// coluna (Tempo/Custo) cada linha da tabela cai. `executor` (pedido do
// usuário: "ampliar o menu em cascata da tarefa, colocando também
// cada executor(es), tempo e custo") é o último nível — sempre tem
// valor (coletarLinhasSessaoTrabalho() só gera sessão com
// `tarefa.executor` preenchido), então nunca cai no caso "nível
// pulado"; uma Tarefa com um só executor mostra 1 filho só (correto,
// não é bug — é só menos interessante de expandir).
const NIVEIS_ARVORE_CUSTO = ['projeto', 'etapa', 'setor', 'pavimento', 'tarefa', 'executor'];
const ROTULOS_NIVEL_ARVORE_CUSTO = { projeto: 'Projeto', etapa: 'Etapa', setor: 'Setor', pavimento: 'Pavimento', tarefa: 'Tarefa', executor: 'Executor' };

function agruparArvoreCustoRelatorio(linhas) {
    const porProjeto = {};
    const ordemProjetos = [];
    linhas.forEach(l => {
        if (!porProjeto[l.projeto]) { porProjeto[l.projeto] = []; ordemProjetos.push(l.projeto); }
        porProjeto[l.projeto].push(l);
    });
    return ordemProjetos.map(nomeProjeto => construirNoArvoreCustoRelatorio(nomeProjeto, porProjeto[nomeProjeto], ['etapa', 'setor', 'pavimento', 'tarefa', 'executor'], 'projeto'));
}

// `nivelDesteNo` é o nível CONCEITUAL do nó ('projeto'/'etapa'/
// 'setor'/'pavimento'/'tarefa') — não confundir com a profundidade
// real na árvore renderizada, que pode ser menor quando um nível é
// pulado (ex: Etapa → Pavimento direto, sem Setor). É esse nível
// conceitual que diz em qual PAR DE COLUNA (Tempo/Custo) a soma deste
// nó deve entrar (pedido do usuário: colunas de Tempo/Custo separadas
// por nível, mantendo a coluna de nome como já era).
function construirNoArvoreCustoRelatorio(nome, linhasDoNo, niveisRestantes, nivelDesteNo) {
    const horas = linhasDoNo.reduce((s, l) => s + (parseFloat(l.horas) || 0), 0);
    const custo = linhasDoNo.reduce((s, l) => s + (parseFloat(l.custo) || 0), 0);
    let filhos = [];

    if (niveisRestantes.length > 0) {
        const [campo, ...resto] = niveisRestantes;
        const grupos = {};
        const ordem = [];
        linhasDoNo.forEach(l => {
            const valor = l[campo];
            if (!valor || valor === '—') return; // nível pulado, tratado abaixo
            if (!grupos[valor]) { grupos[valor] = []; ordem.push(valor); }
            grupos[valor].push(l);
        });
        filhos = ordem.map(valor => construirNoArvoreCustoRelatorio(valor, grupos[valor], resto, campo));

        // Linhas que pularam ESTE nível (sem valor) continuam a
        // recursão direto pro próximo nível, sem virar um filho aqui —
        // os netos delas "sobem" e viram filhos deste mesmo nó.
        const linhasPuladas = linhasDoNo.filter(l => !l[campo] || l[campo] === '—');
        if (linhasPuladas.length > 0 && resto.length > 0) {
            filhos = filhos.concat(construirNoArvoreCustoRelatorio(nome, linhasPuladas, resto, nivelDesteNo).filhos);
        }
    }

    return { nome: nome, horas: horas, custo: custo, filhos: filhos, nivel: nivelDesteNo };
}

let relCustoUidContador = 0;

function renderizarArvoreRelatorioCustos(linhasFiltradas) {
    relCustoUidContador = 0;
    const arvore = agruparArvoreCustoRelatorio(linhasFiltradas);
    const area = document.getElementById('rel-custos-area-resultado');
    document.getElementById('rel-custos-cabecalho-resultado').innerText = 'Relatório por Projeto / Etapa (' + arvore.length + ' projeto' + (arvore.length === 1 ? '' : 's') + ')';

    if (arvore.length === 0) {
        area.innerHTML = '<div class="aviso-selecione">Nenhum lançamento de horas encontrado com esses filtros.</div>';
        return;
    }

    const totalHoras = arvore.reduce((s, n) => s + n.horas, 0);
    const totalCusto = arvore.reduce((s, n) => s + n.custo, 0);
    const corpo = arvore.map(no => renderizarLinhaArvoreCustoRelatorio(no, 0, null)).join('');

    // Cabeçalho de 2 linhas: nível (colspan 2) em cima, Tempo/Custo
    // embaixo — um par de coluna por nível (pedido do usuário).
    const cabecalhoNiveis = NIVEIS_ARVORE_CUSTO.map(n => '<th colspan="2">' + ROTULOS_NIVEL_ARVORE_CUSTO[n] + '</th>').join('');
    const cabecalhoSub = NIVEIS_ARVORE_CUSTO.map(() => '<th class="col-centralizada">Tempo</th><th style="text-align:right;">Custo</th>').join('');

    // Rodapé "Total": só o par do nível mais alto (Projeto) é
    // preenchido — repetir a mesma soma nos pares de Etapa/Pavimento/
    // Tarefa contaria o mesmo valor várias vezes (cada nível é
    // subconjunto do de cima).
    const totalCelulas = NIVEIS_ARVORE_CUSTO.map(nivel =>
        nivel === 'projeto'
            ? '<td class="col-centralizada">' + formatarHorasHHMM(totalHoras) + '</td><td style="text-align:right;">' + formatarValorColuna('moeda', totalCusto) + '</td>'
            : '<td></td><td></td>'
    ).join('');

    area.innerHTML =
        '<div class="table-wrapper"><table class="tabela-compacta tabela-arvore-custos">' +
        '<thead><tr><th rowspan="2">Projeto / Etapa / Setor / Pavimento / Tarefa</th>' + cabecalhoNiveis + '</tr>' +
        '<tr>' + cabecalhoSub + '</tr></thead>' +
        '<tbody>' + corpo + '</tbody>' +
        '<tfoot><tr class="linha-total"><td>Total</td>' + totalCelulas + '</tr></tfoot>' +
        '</table></div>';
}

// Linha recursiva — cada nó vira uma <tr> com um id único (`rc-<uid>`)
// e um `data-pai-custo` apontando pro uid do pai (raiz não tem). Só o
// nível 0 (Projeto) começa visível; os demais nascem com
// `display:none` e só aparecem quando o pai é expandido
// (alternarGrupoCustoRelatorio) — sem re-renderizar a tabela inteira a
// cada clique, só alterna a visibilidade das linhas filhas diretas
// (diferente da Estrutura de Projeto, que re-renderiza a árvore
// inteira a cada clique — aqui não, por ter potencialmente muito mais
// linhas de sessões somadas).
// Seta igual à Estrutura de Projeto (pedido do usuário: "criar setas
// de expansão do menu, como na estrutura de projetos") — reaproveita
// a MESMA classe `.tree-toggle-icon` e os MESMOS glifos (► recolhido,
// ▼ expandido, • sem filhos) que `js/arvore.js` já usa, em vez de um
// estilo próprio.
function renderizarLinhaArvoreCustoRelatorio(no, nivelIndent, uidPai) {
    const uid = 'n' + (relCustoUidContador++);
    const temFilhos = no.filhos && no.filhos.length > 0;
    const indent = 10 + nivelIndent * 20;
    const seta = temFilhos ? '►' : '•';
    // Nível Executor guarda o nome bruto (pra não juntar por engano
    // duas pessoas que só coincidem no apelido) — só na exibição troca
    // pro nome amigável (codinome, se tiver), mesma função que o resto
    // do sistema já usa pra mostrar executor.
    const nomeExibicao = no.nivel === 'executor' ? nomeParaExibicao(no.nome) : no.nome;

    // Tempo/Custo só aparecem no par de coluna do nível DESTE nó
    // (`no.nivel`, conceitual — não confundir com `nivelIndent`, que
    // é só profundidade visual/indentação); os outros 4 pares ficam
    // em branco nesta linha (pedido do usuário).
    const celulasNiveis = NIVEIS_ARVORE_CUSTO.map(nivel =>
        nivel === no.nivel
            ? '<td class="col-centralizada">' + formatarHorasHHMM(no.horas) + '</td><td style="text-align:right;">' + formatarValorColuna('moeda', no.custo) + '</td>'
            : '<td class="col-centralizada"></td><td></td>'
    ).join('');

    let html = '<tr id="rc-' + uid + '"' + (uidPai ? ' data-pai-custo="' + uidPai + '"' : '') +
        (nivelIndent === 0 ? '' : ' style="display:none;"') + '>' +
        '<td style="padding-left:' + indent + 'px;' + (temFilhos ? ' cursor:pointer;' : '') + '"' + (temFilhos ? ' onclick="alternarGrupoCustoRelatorio(\'' + uid + '\')"' : '') + '>' +
        '<span class="tree-toggle-icon"' + (temFilhos ? '' : ' style="color:#cbd5e1;"') + '>' + seta + '</span> ' + nomeExibicao +
        '</td>' + celulasNiveis +
        '</tr>';

    if (temFilhos) {
        html += no.filhos.map(filho => renderizarLinhaArvoreCustoRelatorio(filho, nivelIndent + 1, uid)).join('');
    }
    return html;
}

function alternarGrupoCustoRelatorio(uid) {
    const linha = document.getElementById('rc-' + uid);
    const abrindo = !linha.classList.contains('aberto');
    linha.classList.toggle('aberto', abrindo);
    const seta = linha.querySelector('.tree-toggle-icon');
    if (seta) seta.textContent = abrindo ? '▼' : '►';

    document.querySelectorAll('[data-pai-custo="' + uid + '"]').forEach(tr => { tr.style.display = abrindo ? '' : 'none'; });

    // Ao recolher, recolhe também tudo que estava aberto mais fundo —
    // senão reabrir o pai mostraria netos soltos sem os filhos
    // intermediários visíveis.
    if (!abrindo) recolherDescendentesCustoRelatorio(uid);
}

function recolherDescendentesCustoRelatorio(uidPai) {
    document.querySelectorAll('[data-pai-custo="' + uidPai + '"]').forEach(tr => {
        tr.style.display = 'none';
        tr.classList.remove('aberto');
        const seta = tr.querySelector('.tree-toggle-icon');
        if (seta && seta.textContent !== '•') seta.textContent = '►';
        recolherDescendentesCustoRelatorio(tr.id.replace('rc-', ''));
    });
}

// --- Resumo por Executor --- (pedido do usuário: "muito útil pra
// fazer os pagamentos mensais", onde o que mais importa é o Nome, o
// número de horas e o valor a pagar). Achata TODOS os projetos/etapas
// — não é uma árvore, é uma lista simples ordenada por nome.
function renderizarResumoExecutorRelatorioCustos(linhasFiltradas) {
    const area = document.getElementById('rel-custos-area-resultado-executor');
    const porExecutor = {};
    const ordem = [];
    linhasFiltradas.forEach(l => {
        if (!porExecutor[l.executor]) { porExecutor[l.executor] = { horas: 0, custo: 0 }; ordem.push(l.executor); }
        porExecutor[l.executor].horas += parseFloat(l.horas) || 0;
        porExecutor[l.executor].custo += parseFloat(l.custo) || 0;
    });

    if (ordem.length === 0) {
        area.innerHTML = '<div class="aviso-selecione">Nenhum lançamento de horas encontrado com esses filtros.</div>';
        return;
    }

    // Ordem alfabética pelo nome de exibição — fica mais fácil achar
    // uma pessoa na hora de fechar o pagamento do mês.
    ordem.sort((a, b) => nomeParaExibicao(a).localeCompare(nomeParaExibicao(b), 'pt-BR'));

    let totalHoras = 0, totalCusto = 0;
    const corpo = ordem.map(executor => {
        const dados = porExecutor[executor];
        totalHoras += dados.horas;
        totalCusto += dados.custo;
        return '<tr>' +
            '<td>' + nomeParaExibicao(executor) + '</td>' +
            '<td class="col-centralizada">' + formatarHorasHHMM(dados.horas) + '</td>' +
            '<td style="text-align:right;">' + formatarValorColuna('moeda', dados.custo) + '</td>' +
            '</tr>';
    }).join('');

    area.innerHTML =
        '<div class="table-wrapper"><table class="tabela-compacta">' +
        '<thead><tr><th>Executor</th><th class="col-centralizada">Tempo</th><th style="text-align:right;">Custo</th></tr></thead>' +
        '<tbody>' + corpo + '</tbody>' +
        '<tfoot><tr class="linha-total"><td>Total</td><td class="col-centralizada">' + formatarHorasHHMM(totalHoras) + '</td><td style="text-align:right;">' + formatarValorColuna('moeda', totalCusto) + '</td></tr></tfoot>' +
        '</table></div>';
}

// Extrai HH:MM de um ISO de sessão (sessao.inicio/fim), em horário
// LOCAL — mesmo padrão já usado em outras telas do sistema
// (atribuicao-tarefas.js, via Date.getHours()/getMinutes()), não a
// hora crua do ISO (que está em UTC).
function formatarHoraMinutoRelatorio(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
