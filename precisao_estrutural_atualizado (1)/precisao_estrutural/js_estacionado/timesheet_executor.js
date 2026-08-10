// =========================================================================
// ⏸️ ENGINE DE TIMESHEET/CRONÔMETRO — ESTACIONADA, NÃO CONECTADA AINDA
//
// Removida da tela de Árvore de Projeto por decisão de produto: o
// cronômetro é uma ferramenta do EXECUTOR (quem está fazendo a tarefa),
// não do analista que está montando a estrutura do projeto. Vai reaparecer
// numa futura "tela do executor" — ainda não construída.
//
// Este arquivo NÃO está incluído em nenhum <script src> do index.html.
// Está aqui só pra não perder o trabalho já feito. Pra reativar:
//   1. Adaptar os caminhos (path) de tarefa se a estrutura de dados mudar
//   2. Adicionar de volta o HTML do overlay de ping (ver git/histórico,
//      ou o arquivo arquivo_antigo/ se ainda estiver por lá)
//   3. Incluir este arquivo via <script src> na tela do executor
//   4. Restaurar as chamadas de fecharSessaoCronometroSilencioso() nos
//      pontos que fecham/trocam de contexto (ex: limparWorkspace,
//      fecharProjetoAtivoNaArvore) — hoje elas têm guarda defensiva
//      (typeof check) que simplesmente não faz nada na ausência deste
//      arquivo.
// =========================================================================

let tarefaAtivaCronometro = null;
let ponteiroIntervalId = null;
let tempoDecorridoSessao = 0;
let timestampInicioSessao = 0;
let pingIntervalId = null;
let pingCountdownIntervalId = null;

function controleDisparadorTimesheet(path, acaoStart) {
    fecharSessaoCronometroSilencioso();
    if(!acaoStart) {
        carregarArvoreProjetoAtual();
        visualizarNo('tarefa', path);
        return;
    }

    let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
    let p = path.split('-');
    let tar = todas[projetoSelecionadoAtivo].etapas[p[0]].setores[p[1]].pavimentos[p[2]].tarefas[p[3]];

    if(tar.status === "Finalizada" || tar.status === "Pendente de Validação") {
        alert("Esta tarefa está fechada ou em validação.");
        return;
    }

    tar.status = "Em Desenvolvimento";
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));

    tarefaAtivaCronometro = { path: path, projeto: projetoSelecionadoAtivo };
    timestampInicioSessao = Date.now();
    tempoDecorridoSessao = 0;

    document.getElementById('timer-global-widget').innerHTML = "🔴 TRABALHANDO: " + tar.nome;

    ponteiroIntervalId = setInterval(() => {
        tempoDecorridoSessao += 0.05;
        document.getElementById('timer-global-widget').innerHTML = "🔴 TRABALHANDO: " + tar.nome + " (" + tempoDecorridoSessao.toFixed(2) + "h)";

        if(tempoDecorridoSessao >= 6.0) {
            forçarParadaAbusivaTimesheet(path);
        }
    }, 1000);

    pingIntervalId = setInterval(() => {
        exibirPingAuditoriaTimesheet();
    }, 40000);

    carregarArvoreProjetoAtual();
    visualizarNo('tarefa', path);
}

function fecharSessaoCronometroSilencioso() {
    if(ponteiroIntervalId) { clearInterval(ponteiroIntervalId); ponteiroIntervalId = null; }
    if(pingIntervalId) { clearInterval(pingIntervalId); pingIntervalId = null; }
    if(pingCountdownIntervalId) { clearInterval(pingCountdownIntervalId); pingCountdownIntervalId = null; }

    if(tarefaAtivaCronometro) {
        let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
        let path = tarefaAtivaCronometro.path;
        let proj = tarefaAtivaCronometro.projeto;
        let p = path.split('-');

        if(todas[proj]) {
            let tar = todas[proj].etapas[p[0]].setores[p[1]].pavimentos[p[2]].tarefas[p[3]];
            tar.horas_reais = (parseFloat(tar.horas_reais || 0) + tempoDecorridoSessao).toFixed(2);
            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
        }
    }
    tarefaAtivaCronometro = null;
    tempoDecorridoSessao = 0;
    document.getElementById('timer-global-widget').innerHTML = "⏸️ Cronômetro Parado";
}

function forçarParadaAbusivaTimesheet(path) {
    fecharSessaoCronometroSilencioso();
    let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
    let p = path.split('-');
    let tar = todas[projetoSelecionadoAtivo].etapas[p[0]].setores[p[1]].pavimentos[p[2]].tarefas[p[3]];
    tar.status = "Pendente de Validação";
    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
    alert("🚨 Tempo limite excedido (6h). Retido para validação administrativa.");
    carregarArvoreProjetoAtual();
    visualizarNo('tarefa', path);
}

function exibirPingAuditoriaTimesheet() {
    document.getElementById('timesheet-ping-overlay').style.display = 'flex';
    let segsRestantes = 300;

    pingCountdownIntervalId = setInterval(() => {
        segsRestantes--;
        let m = Math.floor(segsRestantes / 60).toString().padStart(2,'0');
        let s = (segsRestantes % 60).toString().padStart(2,'0');
        document.getElementById('ping-countdown').innerText = m + ":" + s;

        if(segsRestantes <= 0) {
            responderPingTimesheet(false);
        }
    }, 1000);
}

function responderPingTimesheet(continuar) {
    document.getElementById('timesheet-ping-overlay').style.display = 'none';
    if(pingCountdownIntervalId) clearInterval(pingCountdownIntervalId);

    if(!continuar && tarefaAtivaCronometro) {
        let path = tarefaAtivaCronometro.path;
        fecharSessaoCronometroSilencioso();
        carregarArvoreProjetoAtual();
        visualizarNo('tarefa', path);
        alert("Sessão pausada. Tempo salvo.");
    }
}
