// =========================================================================
// MÓDULO: PAINEL DE PROGRESSO (pedido do usuário) — barras horizontais,
// uma linha por Projeto, cada linha dividida em segmentos (um por
// Etapa). Ocupa o espaço do antigo botão "Dashboard" (que antes só
// levava pra tela em branco, sem conteúdo nenhum).
//
// % concluída de cada Etapa = soma da verba das Tarefas "Finalizada"
// dividida pela verba total, agregando TODOS os Pavimentos daquela
// Etapa. A verba de cada Tarefa dentro de um Pavimento é a fatia
// proporcional aos Pontos dela sobre o total de Pontos do Pavimento —
// mesma fórmula que distribuicao-custos.js::recalcularGrupoVerbaPorTarefa()
// já usa na aba "Verba por Tarefa", só que aqui é uma versão pura (sem
// DOM), pra poder rodar pra todos os projetos de uma vez.
//
// Etapa "única" não tem Pavimento (não tem verba por área) — vira
// binário: 100% se a Tarefa dela está "Finalizada", senão 0%.
//
// Cor da barra: sempre verde por enquanto — o usuário quer testar
// visualmente antes de fechar a lógica de amarelo/vermelho (risco de
// atraso / atrasada). Fica registrado como pendente no
// prompt_gemini.md, não implementado ainda.
// =========================================================================

// Retorna um array, um item por Etapa do projeto:
// { etapa, percentual, localizacaoAtual }
// `localizacaoAtual` é o texto pro tooltip — o Pavimento com uma Tarefa
// "Em Desenvolvimento" agora (prioridade), ou, se não houver nenhuma,
// o Pavimento da Tarefa Finalizada mais recentemente (usa
// `tarefa.finalizada_em`, gravado desde esta melhoria — Tarefas
// finalizadas ANTES dela não têm esse campo, então não entram nessa
// comparação, mas continuam contando normalmente pro cálculo da %).
// Árvore Genérica Recursiva v2 (prompt_gemini.md §12.31, níveis
// puláveis): percorre a subárvore de um nó (Etapa ou qualquer filho)
// recursivamente, somando "verba total" e "verba finalizada" — o peso
// de cada folha depende do nível dela:
// - Tarefa (com Pavimento-pai de verdade): fatia proporcional aos
//   Pontos dela sobre o total de Pontos do Pavimento.
// - Pavimento agindo como folha: a Verba por Área Equivalente inteira
//   dele (sem rateio de Pontos, já que não tem Tarefa dentro).
// - Setor ou Etapa agindo como folha (dentro de uma árvore maior):
//   usa a própria Verba manual do nó (mesmo espírito que Sub-etapa
//   já tinha, §12.29).
// Container Pavimento é tratado à parte (usa a Verba por Área
// Equivalente como teto, dividida por Pontos entre os filhos Tarefa) —
// os outros containers (Etapa/Setor com filhos) apenas somam
// recursivamente o que os filhos valem.
function calcularProgressoSubarvore(no, path, nivel, verbaPorCaminhoPavimento) {
    if (ehNoFolha(no)) {
        let pesoFolha = parseFloat(no.verba) || 0;
        if (nivel === 'pavimento') pesoFolha = verbaPorCaminhoPavimento[path] || 0;

        const finalizada = no.status === 'Finalizada';
        const emDesenvolvimento = no.status === 'Em Desenvolvimento';
        return {
            verbaTotal: pesoFolha,
            verbaFinalizada: finalizada ? pesoFolha : 0,
            localizacaoEmDesenvolvimento: emDesenvolvimento ? no.nome : null,
            localizacaoUltimoFinalizado: finalizada ? no.nome : null,
            dataUltimaFinalizacao: finalizada ? (no.finalizada_em || null) : null
        };
    }

    if (nivel === 'pavimento') {
        const valorVerbaPav = verbaPorCaminhoPavimento[path] || 0;
        const filhosTarefa = no.filhos.filter(f => f.nivel === 'tarefa');
        const totalPontos = filhosTarefa.reduce((soma, t) => soma + (parseFloat(t.pontos) || 0), 0);
        let verbaFinalizada = 0, locDesenv = null, locFinal = null, dataFinal = null;
        filhosTarefa.forEach(t => {
            const pontos = parseFloat(t.pontos) || 0;
            const valorTarefa = totalPontos > 0 ? (pontos / totalPontos) * valorVerbaPav : 0;
            if (t.status === 'Finalizada') {
                verbaFinalizada += valorTarefa;
                if (t.finalizada_em && (!dataFinal || t.finalizada_em > dataFinal)) { dataFinal = t.finalizada_em; locFinal = t.nome; }
            }
            if (t.status === 'Em Desenvolvimento' && !locDesenv) locDesenv = t.nome;
        });
        return { verbaTotal: valorVerbaPav, verbaFinalizada: verbaFinalizada, localizacaoEmDesenvolvimento: locDesenv, localizacaoUltimoFinalizado: locFinal, dataUltimaFinalizacao: dataFinal };
    }

    let verbaTotal = 0, verbaFinalizada = 0, locDesenv = null, locFinal = null, dataFinal = null;
    no.filhos.forEach((filho, idx) => {
        const r = calcularProgressoSubarvore(filho, path + '-' + idx, filho.nivel, verbaPorCaminhoPavimento);
        verbaTotal += r.verbaTotal;
        verbaFinalizada += r.verbaFinalizada;
        if (r.localizacaoEmDesenvolvimento && !locDesenv) locDesenv = r.localizacaoEmDesenvolvimento;
        if (r.dataUltimaFinalizacao && (!dataFinal || r.dataUltimaFinalizacao > dataFinal)) { dataFinal = r.dataUltimaFinalizacao; locFinal = r.localizacaoUltimoFinalizado; }
    });
    return { verbaTotal: verbaTotal, verbaFinalizada: verbaFinalizada, localizacaoEmDesenvolvimento: locDesenv, localizacaoUltimoFinalizado: locFinal, dataUltimaFinalizacao: dataFinal };
}

function calcularProgressoProjeto(nomeProjeto) {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const arv = todas[nomeProjeto];
    if (!arv || !Array.isArray(arv.etapas)) return [];

    const pavimentosComVerba = (typeof calcularListaPavimentosComVerbaSalva === 'function')
        ? calcularListaPavimentosComVerbaSalva(nomeProjeto).pavimentos
        : [];
    const verbaPorCaminhoPavimento = {};
    pavimentosComVerba.forEach(p => { verbaPorCaminhoPavimento[p.caminho] = p.valorVerba; });

    return arv.etapas.map((etapa, fIdx) => {
        // Caso mais simples: a própria Etapa é folha (sem filho nenhum)
        // — binário, mesmo espírito de sempre (era só Etapa Única
        // antes; agora vale pra qualquer Etapa sem filho).
        if (ehNoFolha(etapa)) {
            const finalizada = etapa.status === 'Finalizada';
            const emDesenvolvimento = etapa.status === 'Em Desenvolvimento';
            return {
                etapa: etapa.nome,
                percentual: finalizada ? 100 : 0,
                localizacaoAtual: (emDesenvolvimento || finalizada) ? etapa.nome : null
            };
        }

        const r = calcularProgressoSubarvore(etapa, '' + fIdx, 'etapa', verbaPorCaminhoPavimento);
        const percentual = r.verbaTotal > 0 ? (r.verbaFinalizada / r.verbaTotal) * 100 : 0;

        return {
            etapa: etapa.nome,
            percentual: percentual,
            localizacaoAtual: r.localizacaoEmDesenvolvimento || r.localizacaoUltimoFinalizado
        };
    });
}

function renderizarPainelProgresso() {
    const area = document.getElementById('painel-progresso-lista');
    if (!area) return;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    // Mesma regra de sempre: Analista só vê os próprios projetos;
    // Administrador/Supervisor/Executor sem restrição (obterNomesProjetosPermitidos
    // retorna null pra eles, sem filtrar nada).
    const projetosPermitidos = typeof obterNomesProjetosPermitidos === 'function' ? obterNomesProjetosPermitidos() : null;
    const projetosParaMostrar = projetosPermitidos ? projetos.filter(p => projetosPermitidos.has(p.nome)) : projetos;

    if (projetosParaMostrar.length === 0) {
        area.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum projeto disponível.</div>';
        return;
    }

    area.innerHTML = projetosParaMostrar.map(proj => {
        const etapas = calcularProgressoProjeto(proj.nome);

        if (etapas.length === 0) {
            return '<div style="margin-bottom:20px;">' +
                '<div style="font-weight:600; font-size:14px; margin-bottom:8px;">' + proj.nome + '</div>' +
                '<div style="font-size:11px; color:#94a3b8;">Sem etapas cadastradas ainda.</div>' +
                '</div>';
        }

        const segmentos = etapas.map(e => {
            const pctExibicao = Math.max(0, Math.min(100, Math.round(e.percentual)));
            const corTexto = pctExibicao > 50 ? '#ffffff' : '#0f223f';
            const tituloTooltip = (e.localizacaoAtual ? (e.etapa + ' — ' + e.localizacaoAtual) : e.etapa).replace(/"/g, '&quot;');
            return '<div style="flex:1; min-width:0;" title="' + tituloTooltip + '">' +
                '<div style="height:26px; background:#e2e8f0; border-radius:4px; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">' +
                '<div style="position:absolute; left:0; top:0; bottom:0; width:' + pctExibicao + '%; background:#10b981;"></div>' +
                '<span style="position:relative; font-size:11px; font-weight:bold; color:' + corTexto + ';">' + pctExibicao + '%</span>' +
                '</div>' +
                '<div style="font-size:11px; color:#64748b; margin-top:4px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + e.etapa.replace(/"/g, '&quot;') + '">' + e.etapa + '</div>' +
                '</div>';
        }).join('');

        return '<div style="margin-bottom:24px;">' +
            '<div style="font-weight:600; font-size:14px; margin-bottom:8px;">' + proj.nome + '</div>' +
            '<div style="display:flex; gap:4px;">' + segmentos + '</div>' +
            '</div>';
    }).join('');
}
