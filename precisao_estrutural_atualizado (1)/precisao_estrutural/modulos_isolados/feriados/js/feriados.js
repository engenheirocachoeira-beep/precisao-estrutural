// =========================================================================
// MÓDULO: FERIADOS + MOTOR DE DATA PREVISTA
//
// Duas responsabilidades neste arquivo, deliberadamente juntas porque uma
// depende da outra:
//
// 1. Cadastro de Feriados: feriados nacionais FIXOS (embutidos no código,
//    não editáveis — se repetem todo ano, então não faz sentido recadastrar)
//    + feriados CUSTOMIZADOS que o administrador cadastra manualmente
//    (móveis como Carnaval/Sexta-feira Santa, ou municipais/pontos
//    facultativos). Feriados móveis não são calculados automaticamente
//    (calcular a Páscoa exigiria mais lógica) — ficam por conta do
//    administrador cadastrar ano a ano.
//
// 2. Motor de "Data Prevista": calcula, pra cada tarefa não-finalizada de
//    um executor, em que dia ela deve COMEÇAR e TERMINAR — caminhando dia
//    a dia a partir de hoje, pulando sábado/domingo/feriado, consumindo
//    as horas disponíveis daquele dia da semana (Calendário do
//    Colaborador, no Cadastro de Funcionários) contra os Pontos (=horas
//    previstas) de cada tarefa, em ordem de fila.
//
// ORDEM DE FILA: tarefa.ordem_fila, carimbado em
// atribuicao-tarefas.js::atribuirExecutorTarefa() toda vez que um
// executor novo é escolhido, e REESCRITO pela priorização por
// arrastar-e-soltar a linha na Atribuição de Tarefas (ver seção 6 do
// prompt_gemini.md) — arrastar uma tarefa dentro da fila do mesmo
// executor renumera a fila inteira dele.
//
// DATA DE INÍCIO MANUAL: tarefa.data_inicio_manual ("AAAA-MM-DD",
// opcional), editável na coluna "Data de Início" da Atribuição de
// Tarefas. Funciona como uma ÂNCORA no meio da fila — quando o
// caminhamento chega numa tarefa com essa data fixada, o cursor pula pra
// ela (pra frente ou pra trás), e todas as tarefas seguintes da fila
// (sem âncora própria) se reajustam sozinhas a partir dali. Podem
// coexistir várias âncoras na mesma fila. Ver calcularFilaComDatasExecutor()
// pra detalhes.
//
// PENDENTE (próximo passo do roadmap — ver seção 11 do
// prompt_gemini.md): campo Dead Line por tarefa, bloqueando de verdade
// (sem forçar) qualquer arrasto que jogue o cumprimento dele pra depois
// da Data Prevista calculada.
// =========================================================================

const FERIADOS_FIXOS_NACIONAIS = [
    { mesDia: '01-01', nome: 'Confraternização Universal' },
    { mesDia: '04-21', nome: 'Tiradentes' },
    { mesDia: '05-01', nome: 'Dia do Trabalho' },
    { mesDia: '09-07', nome: 'Independência do Brasil' },
    { mesDia: '10-12', nome: 'Nossa Senhora Aparecida' },
    { mesDia: '11-02', nome: 'Finados' },
    { mesDia: '11-15', nome: 'Proclamação da República' },
    { mesDia: '11-20', nome: 'Consciência Negra' },
    { mesDia: '12-25', nome: 'Natal' }
];

// --- TELA DE CADASTRO ---

function carregarPainelFeriados() {
    const tbodyFixos = document.getElementById('fer-tabela-fixos-body');
    tbodyFixos.innerHTML = FERIADOS_FIXOS_NACIONAIS.map(f => {
        const [mes, dia] = f.mesDia.split('-');
        return '<tr><td>' + dia + '/' + mes + '</td><td>' + f.nome + '</td></tr>';
    }).join('');

    renderizarTabelaFeriadosCustomizados();
}

// Item 3 (prompt_gemini.md §14): campos de Data/Nome agora são
// editáveis DIRETO na própria linha (mesmo padrão já usado em outras
// telas — Etapas do Cadastro de Projeto, Distribuição de Custos
// Analista) — antes só dava pra inserir e apagar, não editar.
function renderizarTabelaFeriadosCustomizados() {
    const lista = JSON.parse(localStorage.getItem('banco_feriados_customizados')) || [];
    const tbody = document.getElementById('fer-tabela-custom-body');

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#64748b; padding:16px;">Nenhum feriado adicional cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((f, idx) => {
        return '<tr>' +
            '<td><input type="date" value="' + f.data + '" style="border:1px solid #cbd5e1; border-radius:4px; padding:4px; font-size:12px;" onchange="editarFeriadoCustomizado(' + idx + ', \'data\', this.value)"></td>' +
            '<td><input type="text" value="' + f.nome.replace(/"/g, '&quot;') + '" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px; font-size:12px;" onchange="editarFeriadoCustomizado(' + idx + ', \'nome\', this.value)"></td>' +
            '<td style="text-align:center;"><button class="btn-delete" title="Excluir feriado" aria-label="Excluir feriado" onclick="deletarFeriadoCustomizado(' + idx + ')"><svg class="icon"><use href="#icon-trash"></use></svg></button></td></tr>';
    }).join('');
}

// Salva a edição de um campo (data ou nome) de um feriado já
// cadastrado. Editar a data reordena a lista de novo (mesma regra de
// sempre — lista sempre cronológica); editar pra uma data que já
// existe em outra linha é bloqueado, igual já acontece ao cadastrar
// um novo.
function editarFeriadoCustomizado(idx, campo, novoValor) {
    let lista = JSON.parse(localStorage.getItem('banco_feriados_customizados')) || [];
    if (!lista[idx]) return;

    if (campo === 'data') {
        if (!novoValor) { renderizarTabelaFeriadosCustomizados(); return; }
        if (lista.some((f, i) => i !== idx && f.data === novoValor)) {
            alert('Já existe um feriado cadastrado nessa data.');
            renderizarTabelaFeriadosCustomizados();
            return;
        }
        lista[idx].data = novoValor;
        lista.sort((a, b) => a.data.localeCompare(b.data));
    } else if (campo === 'nome') {
        const nomeLimpo = (novoValor || '').trim();
        if (!nomeLimpo) { renderizarTabelaFeriadosCustomizados(); return; }
        lista[idx].nome = nomeLimpo;
    }

    localStorage.setItem('banco_feriados_customizados', JSON.stringify(lista));
    renderizarTabelaFeriadosCustomizados();
}

function adicionarFeriadoCustomizado() {
    const data = document.getElementById('fer-data').value; // formato AAAA-MM-DD (nativo do <input type="date">)
    const nome = document.getElementById('fer-nome').value.trim();
    if (!data || !nome) return alert('Preencha a data e o nome do feriado.');

    let lista = JSON.parse(localStorage.getItem('banco_feriados_customizados')) || [];
    if (lista.some(f => f.data === data)) return alert('Já existe um feriado cadastrado nessa data.');

    lista.push({ data: data, nome: nome });
    lista.sort((a, b) => a.data.localeCompare(b.data));
    localStorage.setItem('banco_feriados_customizados', JSON.stringify(lista));

    document.getElementById('fer-data').value = '';
    document.getElementById('fer-nome').value = '';
    renderizarTabelaFeriadosCustomizados();
}

function deletarFeriadoCustomizado(idx) {
    if (!confirm('Remover este feriado?')) return;
    let lista = JSON.parse(localStorage.getItem('banco_feriados_customizados')) || [];
    lista.splice(idx, 1);
    localStorage.setItem('banco_feriados_customizados', JSON.stringify(lista));
    renderizarTabelaFeriadosCustomizados();
}

// --- MOTOR DE CALENDÁRIO / DIA ÚTIL ---

function formatarDataISO(data) {
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
}

// true = dia útil (não é sábado/domingo/feriado). Não olha o calendário
// individual do funcionário aqui — só a parte que vale pra TODO MUNDO.
function ehDiaUtil(data) {
    const diaSemana = data.getDay(); // 0=domingo ... 6=sábado
    if (diaSemana === 0 || diaSemana === 6) return false;

    const mesDia = String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
    if (FERIADOS_FIXOS_NACIONAIS.some(f => f.mesDia === mesDia)) return false;

    const dataISO = formatarDataISO(data);
    const customizados = JSON.parse(localStorage.getItem('banco_feriados_customizados')) || [];
    if (customizados.some(f => f.data === dataISO)) return false;

    return true;
}

function obterCalendarioFuncionario(nomeExecutor) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const f = funcionarios.find(x => x.nome === nomeExecutor);
    return (f && f.calendario) ? f.calendario : { seg: '8', ter: '8', qua: '8', qui: '8', sex: '8' };
}

// HISTÓRICO DE VALOR DA HORA (funcionario.historico_valor_hora, array de
// {valor, data_vigencia}) — salário muda com o tempo (reajuste,
// promoção), e o custo de uma tarefa deve refletir o valor vigente na
// ÉPOCA em que o trabalho foi feito, não o valor atual. Cada linha vale
// A PARTIR da sua data até a próxima linha do histórico (só precisa de
// data de INÍCIO por linha, sem data de fim explícita). Migração de
// dados antigos (campo único `funcionario.hora`) em
// core.js::migrarValorHoraParaHistorico().
function valorHoraVigente(nomeExecutor, dataISO) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const f = funcionarios.find(x => x.nome === nomeExecutor);
    if (!f || !Array.isArray(f.historico_valor_hora) || f.historico_valor_hora.length === 0) return 0;

    const ordenado = f.historico_valor_hora.slice().sort((a, b) => a.data_vigencia.localeCompare(b.data_vigencia));
    // Antes de QUALQUER valor conhecido: retorna 0 em vez de "adivinhar"
    // o valor mais antigo — um 0 aparece visivelmente errado na tela
    // (Pontos Máximo zerado, custo zerado), o que é preferível a uma
    // conta silenciosamente baseada numa suposição.
    if (dataISO < ordenado[0].data_vigencia) return 0;

    let vigente = ordenado[0];
    for (const entrada of ordenado) {
        if (entrada.data_vigencia <= dataISO) vigente = entrada;
        else break;
    }
    return parseFloat(vigente.valor) || 0;
}

// EXCEÇÕES DE CALENDÁRIO (funcionario.excecoes_calendario, array de
// {id, data_inicio, data_fim, horas_por_dia, motivo, status}) — o
// executor cria pelo botão "⚙️ Meu Calendário" no Kanban, pra marcar
// ausência (0h) ou hora extra (>0h num dia que normalmente não teria)
// num período específico, sem precisar do administrador mexer no
// Calendário Semanal fixo. Nasce com status 'pendente' e SÓ passa a
// valer pro motor depois que um administrador/analista aprova na tela
// de Aprovações de Calendário (`aprovacoes-calendario.js`) — enquanto
// pendente ou se for recusada, o padrão semanal normal continua valendo
// como se a exceção não existisse.
function obterExcecaoAprovada(nomeExecutor, dataISO) {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const f = funcionarios.find(x => x.nome === nomeExecutor);
    if (!f || !Array.isArray(f.excecoes_calendario)) return null;
    return f.excecoes_calendario.find(ex =>
        ex.status === 'aprovado' && dataISO >= ex.data_inicio && dataISO <= ex.data_fim
    ) || null;
}

// Horas disponíveis desse funcionário NAQUELE dia específico — já
// considerando feriado/fim de semana (0) e o calendário individual dele
// (que pode ter um dia da semana zerado por causa da faculdade, etc).
//
// `nomeExecutor` é opcional (compatibilidade com qualquer chamador
// antigo que só passava calendario+data): se informado, uma exceção
// APROVADA que cubra esse dia vale mais que TUDO — mais que o padrão
// semanal, mais que fim de semana/feriado. É assim que o executor
// consegue registrar "vou trabalhar sábado que vem" (hora extra) ou
// "estarei fora de 20 a 25/07" (ausência), sem precisar que o
// administrador mexa no Calendário Semanal fixo dele.
function horasDisponiveisNoDia(calendario, data, nomeExecutor) {
    if (nomeExecutor) {
        const excecao = obterExcecaoAprovada(nomeExecutor, formatarDataISO(data));
        if (excecao) return parseFloat(excecao.horas_por_dia) || 0;
    }
    if (!ehDiaUtil(data)) return 0;
    const mapaDiaSemana = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
    const chave = mapaDiaSemana[data.getDay()];
    return chave ? (parseFloat(calendario[chave]) || 0) : 0;
}

// --- MOTOR DE DATA PREVISTA ---

function proximoNumeroOrdemFila() {
    let n = parseInt(localStorage.getItem('banco_proximo_ordem_fila') || '1', 10);
    localStorage.setItem('banco_proximo_ordem_fila', String(n + 1));
    return n;
}

// Núcleo do motor: monta a fila (ordem_fila) de UM executor e caminha
// dia a dia, retornando { caminho, dataInicio, dataFim } de cada tarefa.
// dataFim é o que o Kanban sempre usou (calcularDatasPrevistasExecutor,
// abaixo, é só um wrapper fino sobre isso). dataInicio é novo — existe
// pra alimentar a coluna "Data de Início" na Atribuição de Tarefas.
//
// ÂNCORA MANUAL (tarefa.data_inicio_manual, "AAAA-MM-DD"): o
// administrador/analista pode fixar a Data de Início de qualquer tarefa
// da fila diretamente na Atribuição de Tarefas. Quando o caminhamento
// chega numa tarefa com âncora, o cursor PULA pra essa data (pra frente
// ou pra trás, sem restrição) antes de consumir as horas dela — e todas
// as tarefas seguintes da fila (sem âncora própria) se ajustam sozinhas
// a partir daí, porque o cursor simplesmente continua de onde a tarefa
// ancorada parou. Várias âncoras podem coexistir na mesma fila; cada uma
// só afeta o trecho a partir dela. Se a data digitada cair num fim de
// semana/feriado/dia zerado do calendário, ela é aceita como está (não
// bloqueia) e o cálculo já resolve pro próximo dia útil a partir dali.
// arvoresPreCarregadas (opcional): se informado, usa essa árvore em vez
// de ler do localStorage — permite simular "e se essa data fosse salva?"
// (verificação de conflito de âncora, ver atribuicao-tarefas.js) sem
// gravar nada de verdade. Todos os chamadores existentes (Kanban,
// Atribuição de Tarefas) continuam sem passar esse parâmetro, lendo do
// localStorage normalmente.
function calcularFilaComDatasExecutor(nomeExecutor, arvoresPreCarregadas) {
    const arvores = arvoresPreCarregadas || JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    let tarefas = [];

    Object.keys(arvores).forEach(nomeProjeto => {
        const arv = arvores[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;

        coletarNosFolhaDaArvore(arv.etapas).forEach(({ no: tarefa, path }) => {
            if (tarefa.executor !== nomeExecutor) return;
            if (tarefa.status === 'Finalizada') return;

            tarefas.push({
                pontos: parseFloat(tarefa.pontos) || 0,
                ordem: tarefa.ordem_fila !== undefined ? tarefa.ordem_fila : 999999,
                caminho: nomeProjeto + '|' + path,
                dataInicioManual: tarefa.data_inicio_manual || null
            });
        });
    });

    tarefas.sort((a, b) => a.ordem - b.ordem);

    const calendario = obterCalendarioFuncionario(nomeExecutor);
    let dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);
    let horasRestantesNoDia = horasDisponiveisNoDia(calendario, dataAtual, nomeExecutor);

    function avancarParaProximoDiaComHoras() {
        let tentativas = 0;
        do {
            dataAtual.setDate(dataAtual.getDate() + 1);
            horasRestantesNoDia = horasDisponiveisNoDia(calendario, dataAtual, nomeExecutor);
            tentativas++;
        } while (horasRestantesNoDia <= 0 && tentativas < 3650); // trava de segurança: 10 anos, evita loop infinito se o calendário inteiro estiver zerado
    }

    if (horasRestantesNoDia <= 0) avancarParaProximoDiaComHoras();

    return tarefas.map(t => {
        if (t.dataInicioManual) {
            const [ano, mes, dia] = t.dataInicioManual.split('-').map(Number);
            dataAtual = new Date(ano, mes - 1, dia);
            dataAtual.setHours(0, 0, 0, 0);
            horasRestantesNoDia = horasDisponiveisNoDia(calendario, dataAtual, nomeExecutor);
            if (horasRestantesNoDia <= 0) avancarParaProximoDiaComHoras();
        } else if (horasRestantesNoDia <= 0) {
            // O dia atual já não tem mais horas sobrando (a tarefa
            // anterior da fila consumiu tudo) — avança ANTES de ler a
            // data de início desta, senão ela mostraria o dia que já
            // esgotou, não o próximo dia útil de verdade.
            avancarParaProximoDiaComHoras();
        }

        const dataInicio = formatarDataISO(dataAtual);
        let horasFaltando = t.pontos;

        if (horasFaltando <= 0) {
            return { caminho: t.caminho, dataInicio: dataInicio, dataFim: dataInicio };
        }

        while (horasFaltando > 0) {
            if (horasRestantesNoDia <= 0) avancarParaProximoDiaComHoras();
            const consumido = Math.min(horasFaltando, horasRestantesNoDia);
            horasFaltando -= consumido;
            horasRestantesNoDia -= consumido;
        }

        return { caminho: t.caminho, dataInicio: dataInicio, dataFim: formatarDataISO(dataAtual) };
    });
}

// Retorna um mapa { caminho: "AAAA-MM-DD" } com a data prevista de término
// de cada tarefa NÃO FINALIZADA desse executor, em ordem de fila,
// caminhando a partir de hoje e consumindo o calendário dele. Usado pelo
// Kanban — contrato preservado (mapa simples caminho->dataFim), mesmo
// depois de o núcleo passar a calcular início+fim.
function calcularDatasPrevistasExecutor(nomeExecutor) {
    const resultado = {};
    calcularFilaComDatasExecutor(nomeExecutor).forEach(t => { resultado[t.caminho] = t.dataFim; });
    return resultado;
}

// Igual ao de cima, mas com a data de INÍCIO — usado na coluna "Data de
// Início" da Atribuição de Tarefas (feriados.js é carregado antes de
// atribuicao-tarefas.js no index.html, então essa função já está
// disponível quando o painel renderiza).
function calcularDatasInicioExecutor(nomeExecutor) {
    const resultado = {};
    calcularFilaComDatasExecutor(nomeExecutor).forEach(t => { resultado[t.caminho] = t.dataInicio; });
    return resultado;
}

// Igual aos dois de cima, mas devolve início E fim juntos — usado pelo
// Kanban, que agora mostra as duas datas no cartão. Roda o núcleo uma
// única vez (as duas funções de cima, se chamadas separadas, rodariam
// duas vezes à toa).
function calcularDatasInicioEFimExecutor(nomeExecutor) {
    const resultado = {};
    calcularFilaComDatasExecutor(nomeExecutor).forEach(t => {
        resultado[t.caminho] = { inicio: t.dataInicio, fim: t.dataFim };
    });
    return resultado;
}

// Compara dois períodos ("AAAA-MM-DD" cada ponta) e diz se eles se
// sobrepõem em algum dia, inclusive as pontas.
function periodosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
    return !(fimA < inicioB || fimB < inicioA);
}

// Soma um dia (calendário, não útil) a uma data "AAAA-MM-DD" — o ponto
// de partida do empurrão é sempre "o dia seguinte ao fim de quem venceu
// o conflito"; se esse dia seguinte cair num fim de semana/feriado, o
// próprio motor resolve isso na hora de calcular de verdade (mesma regra
// de sempre pra âncoras).
function diaSeguinteISO(dataISO) {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    d.setDate(d.getDate() + 1);
    return formatarDataISO(d);
}

// EMPURRÃO EM CASCATA: fixa uma âncora manual numa tarefa e, se isso
// colidir com o período de outra tarefa do mesmo executor, EMPURRA a
// outra pra começar logo depois do fim de quem "venceu" — de forma
// PERMANENTE (grava um novo tarefa.data_inicio_manual na tarefa
// empurrada, exatamente como se alguém tivesse digitado aquela data nela
// também). Encadeia: se esse empurrão criar um novo conflito com uma
// terceira tarefa, empurra essa também, e assim por diante, até não
// sobrar sobreposição nenhuma na fila inteira do executor.
//
// REGRA DE QUEM VENCE (combinada com o usuário):
// - A tarefa que está sendo editada agora (`caminhoAlvo`) NUNCA é
//   empurrada — a âncora que o analista acabou de digitar sempre vence,
//   mesmo empurrando uma tarefa de PRIORIDADE MAIS ALTA (ordem_fila
//   menor, veio antes na fila por arrasto). É uma inversão deliberada da
//   prioridade normal, só pra essa operação.
// - Entre duas tarefas que NÃO são a âncora original (conflito
//   secundário, encontrado durante o encadeamento), vence quem tem
//   `ordem_fila` menor (prioridade mais alta da fila normal) — só nesse
//   caso a prioridade de arrasto continua valendo.
//
// Por que reverificar TODOS os pares a cada rodada, e não só "quem
// conflitou com a âncora": porque duas tarefas empurradas EM RODADAS
// DIFERENTES podem acabar as duas caindo no mesmo dia seguinte de uma
// terceira tarefa (cada âncora assume o dia inteiro livre, sem saber da
// outra) — só demos com esse caso testando e corrigimos aqui.
//
// Grava direto na árvore `todas` recebida por parâmetro — quem chama
// decide quando persistir no localStorage (permite empacotar tudo numa
// única gravação). Retorna a lista de tarefas que acabaram sendo
// empurradas (nome, projeto, data final), pra quem chamou poder avisar
// o usuário do que mudou.
function fixarAncoraComEmpurrao(nomeExecutor, caminhoAlvo, novaData, todas) {
    const tarefaAlvo = localizarTarefaPorCaminho(todas, caminhoAlvo);
    if (!tarefaAlvo) return [];

    tarefaAlvo.data_inicio_manual = novaData;

    const empurradas = new Set();
    let iteracoes = 0;
    const LIMITE = 1000; // trava de segurança; uma fila real nunca chega perto disso

    while (iteracoes++ < LIMITE) {
        const fila = calcularFilaComDatasExecutor(nomeExecutor, todas);

        let par = null;
        for (let i = 0; i < fila.length && !par; i++) {
            for (let j = i + 1; j < fila.length; j++) {
                if (periodosSeSobrepoem(fila[i].dataInicio, fila[i].dataFim, fila[j].dataInicio, fila[j].dataFim)) {
                    par = [fila[i], fila[j]];
                    break;
                }
            }
        }
        if (!par) break; // nenhuma sobreposição restante, terminou

        const [t1, t2] = par;
        let vencedor, perdedor;
        if (t1.caminho === caminhoAlvo) {
            vencedor = t1; perdedor = t2;
        } else if (t2.caminho === caminhoAlvo) {
            vencedor = t2; perdedor = t1;
        } else {
            const tarefa1 = localizarTarefaPorCaminho(todas, t1.caminho);
            const tarefa2 = localizarTarefaPorCaminho(todas, t2.caminho);
            const ordem1 = tarefa1 && tarefa1.ordem_fila !== undefined ? tarefa1.ordem_fila : 999999;
            const ordem2 = tarefa2 && tarefa2.ordem_fila !== undefined ? tarefa2.ordem_fila : 999999;
            if (ordem1 <= ordem2) { vencedor = t1; perdedor = t2; } else { vencedor = t2; perdedor = t1; }
        }

        const tarefaPerdedora = localizarTarefaPorCaminho(todas, perdedor.caminho);
        if (!tarefaPerdedora) break; // segurança, não deveria acontecer

        tarefaPerdedora.data_inicio_manual = diaSeguinteISO(vencedor.dataFim);
        empurradas.add(perdedor.caminho);
    }

    if (empurradas.size === 0) return [];

    // Recalcula uma última vez pra reportar a data FINAL de cada
    // empurrada (pode ter mudado de novo em rodadas posteriores do
    // encadeamento).
    const filaFinal = calcularFilaComDatasExecutor(nomeExecutor, todas);
    return Array.from(empurradas).map(caminho => {
        const t = filaFinal.find(f => f.caminho === caminho);
        const tarefa = localizarTarefaPorCaminho(todas, caminho);
        return {
            caminho: caminho,
            nome: tarefa ? tarefa.nome : caminho,
            projeto: caminho.split('|')[0],
            dataInicio: t ? t.dataInicio : null
        };
    });
}

// Formata "AAAA-MM-DD" pra "DD/MM" (exibição compacta em cartão/tabela).
function formatarDataPrevistaExibicao(dataISO) {
    if (!dataISO) return '—';
    const [ano, mes, dia] = dataISO.split('-');
    return dia + '/' + mes;
}

// --- SEMÁFORO DE PRIORIDADE (item 13 da Rodada de Comentários da
// Gerência, ver prompt_gemini.md §12) ---
// Indica o quão perto está a Data de Início calculada de uma tarefa —
// pensado pra chamar atenção ANTES da tarefa precisar começar, não
// depois. Aparece em dois lugares: Atribuição de Tarefas (coluna Data
// de Início) e Kanban (cartão). Compartilhado aqui em feriados.js
// porque é dependência de ambos.
//
// Faixas confirmadas com o usuário: ⚫ preto = Data de Início já
// VENCIDA (a tarefa devia ter começado e ainda não começou — pedido
// numa mensagem separada, depois de testar o item 13 original, que
// deixava esse caso de propósito sem indicador nenhum); 🔴 vermelho =
// ≤2 dias; 🟡 amarelo = 3-7 dias; 🟢 verde = 8+ dias. Função pura,
// testável sem DOM (ver
// /home/claude/testes/teste_item13_semaforo_prioridade.js).
function corSemaforoPrioridade(dataInicioISO, hojeISO) {
    if (!dataInicioISO) return null; // sem data calculável (Sem Executor/Finalizada) — não mostra nada
    if (dataInicioISO < hojeISO) return 'preto'; // vencida — devia ter começado e ainda não começou

    const diffMs = new Date(dataInicioISO + 'T00:00:00') - new Date(hojeISO + 'T00:00:00');
    const diffDias = Math.round(diffMs / 86400000);
    if (diffDias <= 2) return 'vermelho';
    if (diffDias <= 7) return 'amarelo';
    return 'verde';
}

// Bolinha colorida (HTML pronto) — mesmas cores já usadas no resto do
// projeto (vermelho de atraso, amarelo de "Em Análise", verde de
// "Liberado"; preto é novo, só pra esse indicador). `null` (fora de
// escopo) não desenha nada.
function renderizarBolinhaSemaforoPrioridade(dataInicioISO, hojeISO) {
    const cor = corSemaforoPrioridade(dataInicioISO, hojeISO);
    if (!cor) return '';
    const hex = { preto: '#000000', vermelho: '#ef4444', amarelo: '#f59e0b', verde: '#10b981' }[cor];
    const titulo = { preto: 'Data de Início vencida — ainda não começou', vermelho: 'Começa em até 2 dias', amarelo: 'Começa em até 1 semana', verde: 'Começa em mais de 1 semana' }[cor];
    return '<span title="' + titulo + '" style="display:inline-block; width:9px; height:9px; border-radius:50%; background:' + hex + '; margin-right:5px; vertical-align:middle;"></span>';
}
