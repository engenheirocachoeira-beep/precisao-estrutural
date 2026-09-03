// =========================================================================
// MÓDULO: APONTAMENTO DE HORAS (sessões de trabalho play/pause)
//
// Guarda um HISTÓRICO de sessões por tarefa (tarefa.sessoes_trabalho),
// não só um total acumulado — é o que permite detectar "essa sessão
// específica ficou 24h aberta", em vez de só perceber que o total geral
// parece grande.
//
// tarefa.sessao_ativa_inicio = timestamp ISO de quando a sessão atual
// começou, ou ausente/undefined se não tem nenhuma rodando. GRAVADO NO
// LOCALSTORAGE (não em variável JS em memória) de propósito — sobrevive a
// fechar a aba/navegador, o que é essencial pra detectar "esqueceu de
// pausar" mesmo depois de horas ou dias.
//
// tarefa.sessoes_trabalho = array de sessões já FECHADAS:
//   { inicio: ISO, fim: ISO, duracao: horasDecimais, quem, manual: bool }
// "manual: true" marca uma sessão que o administrador criou/editou à mão
// (não veio de um play/pause de verdade) — só pra rastreabilidade.
//
// tarefa.horas_reais continua existindo (mesmo campo que BI/Controladoria
// já usam) — mas agora é DERIVADO, sempre igual à soma das durações de
// tarefa.sessoes_trabalho. Nunca edite horas_reais direto; edite as
// sessões e deixe recalcularHorasReais() atualizar o total.
//
// =========================================================================
// MELHORIA #18 (prompt_gemini.md §12.6) — SEGUNDA TRILHA, DE REVISÃO
// =========================================================================
// Além da trilha de Execução acima (Executor, campos originais,
// intocados por compatibilidade — muita coisa em atribuicao-tarefas.js e
// kanban.js já lia `sessao_ativa_inicio` direto), existe agora uma
// trilha PARALELA de Revisão/Conferência (Responsável):
//   tarefa.sessao_ativa_quem = nome de quem está a sessão de EXECUÇÃO
//     ativa agora (campo novo, aditivo — sessao_ativa_inicio continua
//     valendo pra "tem sessão ativa?", esse aqui só diz DE QUEM).
//   tarefa.sessao_ativa_revisao = { inicio, quem } | undefined — sessão
//     de CONFERÊNCIA ativa agora, trilha inteiramente nova.
//   tarefa.sessoes_revisao = array de sessões de conferência já
//     FECHADAS, mesmo formato de tarefa.sessoes_trabalho.
//   tarefa.horas_revisao = derivado, soma de tarefa.sessoes_revisao
//     (recalcularHorasRevisao(), espelha recalcularHorasReais()).
//
// REGRA (decisão do usuário): "uma sessão ativa por vez" agora vale POR
// PESSOA, não mais pro sistema inteiro — Executor e Responsável podem
// ter cada um sua sessão rodando ao mesmo tempo (em tarefas diferentes,
// ou até na mesma tarefa). Só a MESMA pessoa iniciando em outro lugar
// pausa automaticamente a sessão anterior DELA.
//
// Quem pode rodar a trilha de Revisão: `tarefa.responsavel` atribuído OU
// autoridade hierárquica de revisar (podeRevisarTarefa(), kanban.js —
// as duas convivem, não uma substitui a outra) — e só com a tarefa
// especificamente em "Aguardando Verificação".
//
// Custo da trilha de Revisão depende de `funcionario.forma_pagamento`
// de quem fez a sessão: 'hora' -> gera custo real; 'comissionado' ->
// horas contam pro total, custo fica zero (ver calcularCustoRevisaoTarefa).
//
// AINDA NÃO FEITO nesta rodada (fica pra depois, registrado no
// prompt_gemini.md): correção manual (adicionarSessaoManual/editarSessao/
// removerSessao/forcarPausaSessaoAtiva) continua só pra trilha de
// Execução — sem equivalente pra Revisão ainda. E os 5 arquivos que já
// não reconheciam Tarefa de Etapa Única (pendência antiga, ver §12.2)
// continuam sem reconhecer — este módulo também.
// =========================================================================


const APONTAMENTO_MARGEM_HORAS_ALERTA = 2; // horas além do calendário do dia pra virar alerta

// Árvore Genérica Recursiva (prompt_gemini.md §12.31): path pode ter
// 1 posição (Etapa agindo como folha), 2 (Setor agindo como folha —
// mesmo papel que Sub-etapa tinha antes, §12.29), 3 (Pavimento agindo
// como folha) ou 4 (Tarefa de verdade dentro de Pavimento container) —
// o comprimento do path já diz sozinho em qual nível parar.
// Árvore Genérica Recursiva v2 (prompt_gemini.md §12.31, revisão de
// agosto/2026 — níveis puláveis): o comprimento do path não diz mais
// sozinho "que nível" é (2 posições podia ser Setor OU já uma Tarefa
// direto da Etapa, dependendo do que foi pulado) — agora só
// `resolverNoPorPath()` (core.js), que anda pelo `.filhos` de
// verdade, sabe resolver certo.
function localizarTarefaPorCaminho(todasArvores, caminho) {
    const [nomeProjeto, resto] = caminho.split('|');
    const arv = todasArvores[nomeProjeto];
    if (!arv) return null;
    try {
        return resolverNoPorPath(arv, resto);
    } catch (e) {
        return null;
    }
}

function recalcularHorasReais(tarefa) {
    const sessoes = tarefa.sessoes_trabalho || [];
    const total = sessoes.reduce((soma, s) => soma + (parseFloat(s.duracao) || 0), 0);
    tarefa.horas_reais = total.toFixed(2);
}

// Espelha recalcularHorasReais() acima, pra trilha de Revisão (#18).
function recalcularHorasRevisao(tarefa) {
    // Aprovação separada das horas de Revisão (prompt_gemini.md §12.13,
    // design confirmado pelo usuário): só sessão com status 'aprovada'
    // entra no total oficial — 'pendente' ainda não conta (aparece na
    // fila de aprovação, aprovacoes-calendario.js).
    const sessoes = tarefa.sessoes_revisao || [];
    const total = sessoes.filter(s => s.status === 'aprovada').reduce((soma, s) => soma + (parseFloat(s.duracao) || 0), 0);
    tarefa.horas_revisao = total.toFixed(2);
}

// Acha a sessão ativa (Execução OU Revisão) de uma pessoa ESPECÍFICA, em
// QUALQUER lugar do sistema — retorna { caminho, trilha } ou null.
// Substitui acharCaminhoSessaoAtivaGlobal() (que achava "a" sessão ativa
// do sistema inteiro, sem saber de quem era) — melhoria #18/#10
// (prompt_gemini.md §12.6): regra virou "uma sessão ativa por PESSOA".
function localizarSessaoAtivaDaPessoa(todasArvores, nomePessoa) {
    let encontrado = null;

    // Função auxiliar comum às duas formas de Etapa (Única e
    // Subdividida) — evita duplicar a checagem duas vezes.
    function checarTarefa(tarefa, caminho) {
        if (encontrado) return;
        if (tarefa.sessao_ativa_inicio && tarefa.sessao_ativa_quem === nomePessoa) {
            encontrado = { caminho: caminho, trilha: 'execucao' };
        } else if (tarefa.sessao_ativa_revisao && tarefa.sessao_ativa_revisao.quem === nomePessoa) {
            encontrado = { caminho: caminho, trilha: 'revisao' };
        }
    }

    Object.keys(todasArvores).forEach(nomeProjeto => {
        const arv = todasArvores[nomeProjeto];
        if (!Array.isArray(arv.etapas) || encontrado) return;
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            checarTarefa(tarefa, nomeProjeto + '|' + path);
        });
    });
    return encontrado;
}

// Pausa a sessão ativa de uma pessoa ESPECÍFICA (se houver, em qualquer
// tarefa/trilha) e devolve os dados já salvos em localStorage. Usada
// tanto por "iniciar outra sessão" (que precisa pausar a sessão anterior
// DESSA MESMA PESSOA primeiro) quanto isoladamente.
function pausarSessaoAtivaDaPessoa(nomePessoa) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const achado = localizarSessaoAtivaDaPessoa(todas, nomePessoa);
    if (!achado) return todas;

    const tarefa = localizarTarefaPorCaminho(todas, achado.caminho);
    if (tarefa) {
        const fim = new Date().toISOString();
        if (achado.trilha === 'execucao' && tarefa.sessao_ativa_inicio) {
            const inicio = tarefa.sessao_ativa_inicio;
            const duracao = (new Date(fim) - new Date(inicio)) / 3600000;
            if (!Array.isArray(tarefa.sessoes_trabalho)) tarefa.sessoes_trabalho = [];
            tarefa.sessoes_trabalho.push({ inicio: inicio, fim: fim, duracao: duracao, quem: nomePessoa, manual: false });
            delete tarefa.sessao_ativa_inicio;
            delete tarefa.sessao_ativa_quem;
            recalcularHorasReais(tarefa);
        } else if (achado.trilha === 'revisao' && tarefa.sessao_ativa_revisao) {
            const inicio = tarefa.sessao_ativa_revisao.inicio;
            const duracao = (new Date(fim) - new Date(inicio)) / 3600000;
            if (!Array.isArray(tarefa.sessoes_revisao)) tarefa.sessoes_revisao = [];
            tarefa.sessoes_revisao.push({ inicio: inicio, fim: fim, duracao: duracao, quem: nomePessoa, manual: false, status: 'pendente' });
            delete tarefa.sessao_ativa_revisao;
            recalcularHorasRevisao(tarefa);
        }
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return todas;
}

// Item 2 da "Frente Kanban avançado" (ver prompt_gemini.md §11) —
// revisado 2026-09-03 (pedido do usuário: "permitir apontamento de
// horas e acionamento de cronômetro para as tarefas que estão
// apontadas ou em desenvolvimento daquele executor"): a contagem de
// tempo é bloqueada em "Aguardando Verificação" (já foi entregue pelo
// executor pra revisão — não faz sentido continuar rodando cronômetro
// numa tarefa que já saiu das mãos de quem executa) e em "Finalizada"
// (já entregue de vez). "Apontada" deixou de bloquear — o Executor
// agora pode iniciar o cronômetro direto de "Apontada" (decisão
// revertida: antes exigia mover a tarefa pra "Em Desenvolvimento"
// primeiro).
const APONTAMENTO_STATUS_SEM_CRONOMETRO = ['Aguardando Verificação', 'Finalizada'];

// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_status_bloqueia_cronometro.js).
function statusBloqueiaCronometro(status) {
    return APONTAMENTO_STATUS_SEM_CRONOMETRO.includes(status);
}

// Retorna true se a sessão foi iniciada, false se foi bloqueada (ou a
// tarefa não existe mais). Melhoria #18/#10 (prompt_gemini.md §12.6):
// agora decide em qual TRILHA gravar (Execução ou Revisão) de acordo com
// quem está clicando (usuarioLogado, global de core.js):
// - É o Executor da tarefa -> trilha Execução, mesma trava de sempre
//   (bloqueado em "Aguardando Verificação"/"Finalizada").
// - Não é o Executor, mas tem autoridade de revisar (Responsável
//   atribuído OU hierarquia, podeRevisarTarefa() em kanban.js) -> trilha
//   Revisão, só com a tarefa especificamente em "Aguardando Verificação".
// - Nenhum dos dois -> bloqueado.
// Sem usuarioLogado (módulo isolado sem login) -> bloqueado, por não dar
// pra saber em qual trilha gravar (falha FECHADA, mesmo espírito de
// obterNomesProjetosPermitidos() em core.js).
function iniciarSessaoTrabalho(caminho) {
    const verificacao = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefaAlvo = localizarTarefaPorCaminho(verificacao, caminho);
    if (!tarefaAlvo) return false;

    const quemEstaClicando = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    if (!quemEstaClicando) return false;

    const nomeProjeto = caminho.split('|')[0];
    const souOExecutor = quemEstaClicando.nome === tarefaAlvo.executor;
    let trilha;

    if (souOExecutor) {
        if (statusBloqueiaCronometro(tarefaAlvo.status)) return false;
        trilha = 'execucao';
    } else {
        if (tarefaAlvo.status !== 'Aguardando Verificação') return false;
        const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
        const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
        const temAutoridade = typeof podeRevisarTarefa === 'function' && podeRevisarTarefa(tarefaAlvo, nomeProjeto, quemEstaClicando, funcionarios, projetos);
        if (!temAutoridade) return false;
        trilha = 'revisao';
    }

    // "Uma sessão ativa por PESSOA" (decisão do usuário): pausa qualquer
    // outra sessão ativa dessa MESMA pessoa antes de iniciar a nova —
    // não mexe em sessão ativa de outra pessoa em outro lugar.
    let todas = pausarSessaoAtivaDaPessoa(quemEstaClicando.nome);

    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return false;

    if (trilha === 'execucao') {
        tarefa.sessao_ativa_inicio = new Date().toISOString();
        tarefa.sessao_ativa_quem = quemEstaClicando.nome;
    } else {
        tarefa.sessao_ativa_revisao = { inicio: new Date().toISOString(), quem: quemEstaClicando.nome };
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// Pausa a sessão ativa (Execução OU Revisão, o que estiver rodando) de
// quem está logado, nessa tarefa. Sem usuarioLogado (módulo isolado),
// pausa qualquer sessão ativa dessa tarefa em qualquer trilha (fallback
// aberto, já que não dá pra filtrar por pessoa).
function pausarSessaoTrabalho(caminho) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return;

    const quemEstaClicando = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nome : null;
    const fim = new Date().toISOString();

    if (tarefa.sessao_ativa_inicio && (!quemEstaClicando || !tarefa.sessao_ativa_quem || tarefa.sessao_ativa_quem === quemEstaClicando)) {
        const inicio = tarefa.sessao_ativa_inicio;
        const duracao = (new Date(fim) - new Date(inicio)) / 3600000;
        if (!Array.isArray(tarefa.sessoes_trabalho)) tarefa.sessoes_trabalho = [];
        tarefa.sessoes_trabalho.push({ inicio: inicio, fim: fim, duracao: duracao, quem: tarefa.sessao_ativa_quem || quemEstaClicando || null, manual: false });
        delete tarefa.sessao_ativa_inicio;
        delete tarefa.sessao_ativa_quem;
        recalcularHorasReais(tarefa);
    } else if (tarefa.sessao_ativa_revisao && (!quemEstaClicando || tarefa.sessao_ativa_revisao.quem === quemEstaClicando)) {
        const inicio = tarefa.sessao_ativa_revisao.inicio;
        const duracao = (new Date(fim) - new Date(inicio)) / 3600000;
        if (!Array.isArray(tarefa.sessoes_revisao)) tarefa.sessoes_revisao = [];
        tarefa.sessoes_revisao.push({ inicio: inicio, fim: fim, duracao: duracao, quem: tarefa.sessao_ativa_revisao.quem, manual: false, status: 'pendente' });
        delete tarefa.sessao_ativa_revisao;
        recalcularHorasRevisao(tarefa);
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
}

// --- CORREÇÃO MANUAL (administrador) ---

function adicionarSessaoManual(caminho, inicioISO, fimISO) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return false;

    const duracao = (new Date(fimISO) - new Date(inicioISO)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    if (!Array.isArray(tarefa.sessoes_trabalho)) tarefa.sessoes_trabalho = [];
    tarefa.sessoes_trabalho.push({ inicio: inicioISO, fim: fimISO, duracao: duracao, manual: true });
    recalcularHorasReais(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

function editarSessao(caminho, idxSessao, inicioISO, fimISO) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_trabalho) || !tarefa.sessoes_trabalho[idxSessao]) return false;

    const duracao = (new Date(fimISO) - new Date(inicioISO)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    tarefa.sessoes_trabalho[idxSessao] = { inicio: inicioISO, fim: fimISO, duracao: duracao, manual: true };
    recalcularHorasReais(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

function removerSessao(caminho, idxSessao) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_trabalho)) return;

    tarefa.sessoes_trabalho.splice(idxSessao, 1);
    recalcularHorasReais(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
}

// Força o encerramento de uma sessão travada (ex: executor esqueceu de
// pausar por dias) — o administrador escolhe o horário de término real,
// já que o sistema não tem como adivinhar quando a pessoa realmente parou.
function forcarPausaSessaoAtiva(caminho, fimISO) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !tarefa.sessao_ativa_inicio) return false;

    const inicio = tarefa.sessao_ativa_inicio;
    const duracao = (new Date(fimISO) - new Date(inicio)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    if (!Array.isArray(tarefa.sessoes_trabalho)) tarefa.sessoes_trabalho = [];
    tarefa.sessoes_trabalho.push({ inicio: inicio, fim: fimISO, duracao: duracao, manual: true });
    delete tarefa.sessao_ativa_inicio;
    recalcularHorasReais(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// =========================================================================
// CORREÇÃO MANUAL — TRILHA DE REVISÃO (prompt_gemini.md §12.13)
// Espelham as 4 funções acima (Execução), mesmo formato — só que essas
// 4 aqui gravam `quem` explicitamente (parâmetro, não vem de
// usuarioLogado — quem corrige manualmente pode estar ajustando o
// lançamento de OUTRA pessoa) e nascem já com `status: 'aprovada'`:
// correção manual é um lançamento já autoritativo de quem tem acesso a
// essa ferramenta (mesmo espírito de adicionarSessaoManual() acima, que
// também não passa por aprovação de novo).
// =========================================================================

// Autoatendimento — pedido do usuário (mesmo botão "📝 Apontar horas"
// do Kanban, agora também na trilha de Revisão): quem tem autoridade
// de revisar aponta a própria hora direto pelo cartão, sem precisar de
// um Administrador corrigindo depois. Diferente de
// adicionarSessaoManualRevisao() (ferramenta de CORREÇÃO, já nasce
// aprovada) — esta aqui nasce 'pendente', mesmo espírito de
// criarApontamentoManual() (trilha Execução): precisa passar pela
// aprovação (aba "Sessões de Revisão", que já lista qualquer sessão
// pendente em sessoes_revisao, `manual` ou não — não precisou de
// aba/aprovação nova).
function criarApontamentoManualRevisao(caminho, data, horas, motivo) {
    const horasNum = parseFloat(horas);
    if (!data || isNaN(horasNum) || horasNum <= 0) {
        return { ok: false, erro: 'Informe uma data e uma quantidade de horas válida (maior que zero).' };
    }

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return { ok: false, erro: 'Tarefa não encontrada.' };
    if (tarefa.status !== 'Aguardando Verificação') {
        return { ok: false, erro: 'Só é possível apontar horas de revisão com a tarefa em "Aguardando Verificação".' };
    }

    const usuarioAtual = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    if (!usuarioAtual) return { ok: false, erro: 'Sem identidade — não é possível apontar.' };

    const nomeProjeto = caminho.split('|')[0];
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const temAutoridade = typeof podeRevisarTarefa === 'function' && podeRevisarTarefa(tarefa, nomeProjeto, usuarioAtual, funcionarios, projetos);
    if (!temAutoridade) return { ok: false, erro: 'Você não tem autoridade de revisar esta tarefa.' };

    // Sintetiza início/fim a partir da data + duração informada (o
    // formulário só pede "data" e "quantas horas", igual ao
    // apontamento manual da trilha Execução — não pede hora exata).
    const inicio = data + 'T12:00:00.000Z';
    const fim = new Date(new Date(inicio).getTime() + horasNum * 3600000).toISOString();

    if (!Array.isArray(tarefa.sessoes_revisao)) tarefa.sessoes_revisao = [];
    tarefa.sessoes_revisao.push({ inicio: inicio, fim: fim, duracao: horasNum, quem: usuarioAtual.nome, manual: true, status: 'pendente', motivo: motivo || '' });

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return { ok: true };
}

function adicionarSessaoManualRevisao(caminho, inicioISO, fimISO, nomeQuem) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !nomeQuem) return false;

    const duracao = (new Date(fimISO) - new Date(inicioISO)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    if (!Array.isArray(tarefa.sessoes_revisao)) tarefa.sessoes_revisao = [];
    tarefa.sessoes_revisao.push({ inicio: inicioISO, fim: fimISO, duracao: duracao, quem: nomeQuem, manual: true, status: 'aprovada' });
    recalcularHorasRevisao(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

function editarSessaoRevisao(caminho, idxSessao, inicioISO, fimISO) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_revisao) || !tarefa.sessoes_revisao[idxSessao]) return false;

    const duracao = (new Date(fimISO) - new Date(inicioISO)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    const anterior = tarefa.sessoes_revisao[idxSessao];
    // Edição manual também "autoriza" — vira aprovada, mesmo se estava
    // pendente antes (quem tem acesso a essa tela já tem autoridade).
    tarefa.sessoes_revisao[idxSessao] = { inicio: inicioISO, fim: fimISO, duracao: duracao, quem: anterior.quem, manual: true, status: 'aprovada' };
    recalcularHorasRevisao(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

function removerSessaoRevisao(caminho, idxSessao) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !Array.isArray(tarefa.sessoes_revisao)) return;

    tarefa.sessoes_revisao.splice(idxSessao, 1);
    recalcularHorasRevisao(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
}

// Força o encerramento de uma sessão de REVISÃO travada — mesmo
// espírito de forcarPausaSessaoAtiva() (Execução) acima.
function forcarPausaSessaoAtivaRevisao(caminho, fimISO) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa || !tarefa.sessao_ativa_revisao) return false;

    const inicio = tarefa.sessao_ativa_revisao.inicio;
    const quem = tarefa.sessao_ativa_revisao.quem;
    const duracao = (new Date(fimISO) - new Date(inicio)) / 3600000;
    if (isNaN(duracao) || duracao <= 0) return false;

    if (!Array.isArray(tarefa.sessoes_revisao)) tarefa.sessoes_revisao = [];
    tarefa.sessoes_revisao.push({ inicio: inicio, fim: fimISO, duracao: duracao, quem: quem, manual: true, status: 'aprovada' });
    delete tarefa.sessao_ativa_revisao;
    recalcularHorasRevisao(tarefa);

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// --- ANOTAÇÃO MANUAL DO EXECUTOR + APROVAÇÃO (item 4 da "Frente Kanban
// avançado", ver prompt_gemini.md §11) ---
//
// Diferente da correção manual acima (feita pelo Administrador direto,
// sem aprovação, via adicionarSessaoManual/editarSessao/removerSessao):
// aqui é o próprio EXECUTOR quem anota (dia + número de horas, no
// Kanban), mas fica PENDENTE — só entra em horas_reais depois que
// alguém aprova. Mesmo padrão já usado nas Exceções de Calendário
// (§7.1): pendente → tela de aprovação → só depois passa a valer.
// Aprovação é feita por Administrador/Analista/Supervisor (mesmo
// acesso que já existe pra Aprovações de Calendário).
//
// tarefa.apontamentos_manuais = array de
//   { id, data (YYYY-MM-DD), horas, motivo, status: pendente/aprovado/
//     recusado, criado_em }

function gerarIdApontamentoManual() {
    return 'apo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Função pura, testável sem DOM (ver
// /home/claude/testes/teste_apontamento_manual.js).
function validarNovoApontamentoManual(data, horas) {
    if (!data) return 'Informe a data.';
    if (horas === '' || horas === null || horas === undefined || isNaN(horas)) return 'Informe as horas trabalhadas.';
    if (parseFloat(horas) <= 0) return 'Horas devem ser maior que zero.';
    return null;
}

// Bloqueio REAL de status (não só cosmético no botão do Kanban) — só
// libera com a tarefa em "Em Desenvolvimento", mesmo se chamada por
// fora do botão (defesa em profundidade, mesmo padrão dos itens 1 e 2
// da mesma frente). Fica pendente: NÃO mexe em sessoes_trabalho nem em
// horas_reais ainda — só aprovarApontamentoManual() faz isso.
function criarApontamentoManual(caminho, data, horas, motivo) {
    const erroValidacao = validarNovoApontamentoManual(data, horas);
    if (erroValidacao) return { ok: false, erro: erroValidacao };

    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return { ok: false, erro: 'Tarefa não encontrada.' };
    // "Para revisão" liberado junto com "Em Desenvolvimento" — mesmo
    // status em que o cronômetro já roda pro Executor corrigindo
    // (ciclo Executor↔Revisor, prompt_gemini.md §12.8/§12.13).
    // "Apontada" liberado em 2026-09-03 (pedido do usuário) — mesma
    // régua de statusBloqueiaCronometro(), o apontamento manual segue o
    // cronômetro (se dá pra ligar o cronômetro nesse status, dá pra
    // apontar manualmente também).
    if (tarefa.status !== 'Apontada' && tarefa.status !== 'Em Desenvolvimento' && tarefa.status !== 'Para revisão') {
        return { ok: false, erro: 'Só é possível anotar horas manualmente com a tarefa em "Apontada", "Em Desenvolvimento" ou "Para revisão".' };
    }

    // Trava real (a que vale de verdade — o botão no Kanban já só
    // aparece pro Executor de verdade, isto aqui é defesa em
    // profundidade, não confia só na UI): pedido explícito do usuário,
    // ninguém além de quem executa a tarefa pode apontar hora nela,
    // nem em "Para revisão".
    const usuarioAtualParaApontamento = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    if (usuarioAtualParaApontamento && usuarioAtualParaApontamento.nome !== tarefa.executor) {
        return { ok: false, erro: 'Só o Executor desta tarefa pode apontar horas nela.' };
    }

    if (!Array.isArray(tarefa.apontamentos_manuais)) tarefa.apontamentos_manuais = [];
    tarefa.apontamentos_manuais.push({
        id: gerarIdApontamentoManual(),
        data: data,
        horas: parseFloat(horas),
        motivo: motivo || '',
        status: 'pendente',
        criado_em: new Date().toISOString()
    });

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return { ok: true };
}

function localizarApontamentoManual(tarefa, id) {
    if (!Array.isArray(tarefa.apontamentos_manuais)) return null;
    return tarefa.apontamentos_manuais.find(a => a.id === id) || null;
}

// Varre TODAS as árvores/tarefas atrás de apontamentos_manuais — usada
// pela tela de Aprovações (aba "Apontamento de Horas") pra listar todos
// de todo mundo num lugar só, igual listarTodasExcecoesCalendario() já
// faz pro calendário.
function listarTodosApontamentosManuais() {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    let lista = [];

    function empilharApontamentos(tarefa, caminho, nomeProjeto) {
        (tarefa.apontamentos_manuais || []).forEach(ap => {
            lista.push({
                caminho: caminho,
                projeto: nomeProjeto,
                tarefaNome: tarefa.nome,
                executor: tarefa.executor || '—',
                id: ap.id,
                data: ap.data,
                horas: ap.horas,
                motivo: ap.motivo,
                status: ap.status,
                criado_em: ap.criado_em
            });
        });
    }

    Object.keys(todas).forEach(nomeProjeto => {
        const arv = todas[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            empilharApontamentos(tarefa, nomeProjeto + '|' + path, nomeProjeto);
        });
    });
    return lista;
}

function contarApontamentosManuaisPendentes() {
    return listarTodosApontamentosManuais().filter(a => a.status === 'pendente').length;
}

// Aprova a anotação pendente — SÓ AÍ ela entra em horas_reais. Cria uma
// sessão de verdade em sessoes_trabalho (manual:true), reaproveitando
// adicionarSessaoManual() já existente acima (não duplica a lógica de
// recalcularHorasReais). Horário fixo 08:00 do dia informado só pra ter
// um inicio/fim consistente — a fonte de verdade da duração continua
// sendo 'horas', não a diferença entre os timestamps.
function aprovarApontamentoManual(caminho, id) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return false;
    const apontamento = localizarApontamentoManual(tarefa, id);
    if (!apontamento || apontamento.status !== 'pendente') return false;

    apontamento.status = 'aprovado';
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));

    const inicioISO = apontamento.data + 'T08:00:00.000Z';
    const fimISO = new Date(new Date(inicioISO).getTime() + apontamento.horas * 3600000).toISOString();
    adicionarSessaoManual(caminho, inicioISO, fimISO);
    return true;
}

function recusarApontamentoManual(caminho, id) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const tarefa = localizarTarefaPorCaminho(todas, caminho);
    if (!tarefa) return false;
    const apontamento = localizarApontamentoManual(tarefa, id);
    if (!apontamento || apontamento.status !== 'pendente') return false;

    apontamento.status = 'recusado';
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    return true;
}

// --- DETECÇÃO DE ANOMALIA (alerta pro administrador) ---

// Limite de horas seguidas antes de virar alerta: horas do calendário da
// pessoa NAQUELE dia da semana + uma margem fixa. Cai num fim de semana
// (não deveria acontecer, mas por segurança) usa 8h de base.
function calcularLimiteHorasAlerta(nomeExecutor, dataInicioISO) {
    const calendario = obterCalendarioFuncionario(nomeExecutor);
    const diaSemana = new Date(dataInicioISO).getDay();
    const mapa = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
    const chave = mapa[diaSemana];
    const horasDoDia = chave ? (parseFloat(calendario[chave]) || 8) : 8;
    return horasDoDia + APONTAMENTO_MARGEM_HORAS_ALERTA;
}

// Retorna { temAlerta, motivo } pra uma tarefa — olha tanto a sessão ativa
// (se estiver rodando há mais tempo que o limite) quanto o histórico de
// sessões já fechadas (se alguma delas passou do limite na época).
function verificarAlertaApontamento(tarefa, nomeExecutor) {
    if (tarefa.sessao_ativa_inicio) {
        const horasDecorridas = (Date.now() - new Date(tarefa.sessao_ativa_inicio).getTime()) / 3600000;
        const limite = calcularLimiteHorasAlerta(nomeExecutor, tarefa.sessao_ativa_inicio);
        if (horasDecorridas > limite) {
            return { temAlerta: true, motivo: 'Sessão ativa rodando há ' + horasDecorridas.toFixed(1) + 'h sem pausar (limite: ' + limite.toFixed(1) + 'h).' };
        }
    }

    const sessoes = tarefa.sessoes_trabalho || [];
    for (let i = 0; i < sessoes.length; i++) {
        const s = sessoes[i];
        const limite = calcularLimiteHorasAlerta(nomeExecutor, s.inicio);
        if ((parseFloat(s.duracao) || 0) > limite) {
            return { temAlerta: true, motivo: 'Sessão de ' + s.duracao.toFixed(1) + 'h em ' + formatarDataPrevistaExibicao(s.inicio.substring(0, 10)) + ' passou do limite (' + limite.toFixed(1) + 'h).' };
        }
    }

    return { temAlerta: false, motivo: '' };
}

// --- HISTÓRICO DE VALOR DA HORA: pontos de referência da tarefa ---
// Ver feriados.js::valorHoraVigente() pro lookup do valor em si.

// Data/hora (ISO completo, com timestamp) da PRIMEIRA sessão de
// trabalho real dessa tarefa — sessões fechadas (`sessoes_trabalho`) OU
// a sessão ativa agora, o que for mais cedo. NÃO é `sessoes_trabalho[0]`
// (primeiro item do array): uma sessão MANUAL pode ter sido adicionada
// depois, retroativa a uma data anterior às demais — por isso pega a
// MENOR data entre todas, não a primeira inserida. Retorna `null` se a
// tarefa nunca teve nenhuma sessão (ainda não começou de verdade).
function obterDataInicioExecucaoReal(tarefa) {
    const datas = [];
    if (Array.isArray(tarefa.sessoes_trabalho)) {
        tarefa.sessoes_trabalho.forEach(s => { if (s.inicio) datas.push(s.inicio); });
    }
    if (tarefa.sessao_ativa_inicio) datas.push(tarefa.sessao_ativa_inicio);
    if (datas.length === 0) return null;
    datas.sort();
    return datas[0];
}

// CUSTO REAL da tarefa: soma, sessão por sessão, de duração × valor da
// hora vigente NO DIA daquela sessão específica — não um valor único
// pra tarefa inteira. Duas sessões da mesma tarefa em épocas diferentes
// (ex: um reajuste salarial caiu no meio da execução) são custeadas
// cada uma pelo seu próprio valor. Ainda não tem tela própria mostrando
// isso — construído pra alimentar o índice de produtividade/distribuição
// de lucro combinado (fora de escopo por enquanto), mas testável e
// pronto pra uso.
function calcularCustoRealTarefa(tarefa, nomeExecutor) {
    if (!nomeExecutor || !Array.isArray(tarefa.sessoes_trabalho)) return 0;
    return tarefa.sessoes_trabalho.reduce((soma, s) => {
        const dataSessao = (s.inicio || '').split('T')[0];
        const valor = valorHoraVigente(nomeExecutor, dataSessao);
        return soma + (parseFloat(s.duracao) || 0) * valor;
    }, 0);
}

// CUSTO da trilha de REVISÃO (melhoria #18, prompt_gemini.md §12.6):
// espelha calcularCustoRealTarefa() acima, com uma diferença central —
// cada sessão de revisão pode ter sido feita por uma pessoa DIFERENTE
// (`s.quem`, não um `nomeExecutor` fixo pra tarefa toda), e o custo dela
// só conta se `funcionario.forma_pagamento === 'hora'`. Sessão de quem é
// 'comissionado' entra na soma de HORAS (recalcularHorasRevisao) mas sai
// da soma de CUSTO — comissionado já é pago por %, não por hora.
function calcularCustoRevisaoTarefa(tarefa, todosFuncionarios) {
    if (!Array.isArray(tarefa.sessoes_revisao)) return 0;
    return tarefa.sessoes_revisao.filter(s => s.status === 'aprovada').reduce((soma, s) => {
        if (!s.quem) return soma;
        const funcionario = todosFuncionarios.find(f => f.nome === s.quem);
        const formaPagamento = funcionario ? funcionario.forma_pagamento : 'hora';
        if (formaPagamento === 'comissionado') return soma;
        const dataSessao = (s.inicio || '').split('T')[0];
        const valor = valorHoraVigente(s.quem, dataSessao);
        return soma + (parseFloat(s.duracao) || 0) * valor;
    }, 0);
}
