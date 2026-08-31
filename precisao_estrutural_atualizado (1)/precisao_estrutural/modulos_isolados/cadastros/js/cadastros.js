// =========================================================================
// MÓDULO: CADASTROS (Clientes, Funcionários, Projetos)
//
// RECUPERADO de modulo_fabrica_legos.js, que estava órfão (injetava HTML
// num elemento 'container-paineis-dinamicos' que não existe mais no
// index.html atual) e nunca chegou a ser mesclado com a versão mais
// recente do sistema.
//
// Correção feita nesta reorganização (não é lógica nova, é bug de
// nomenclatura): salvarCliente() gravava o campo de cidade como "city",
// mas carregarClienteParaEdicao() e a tabela liam "cidade". Padronizado
// para "cidade" nos dois lados.
//
// Também foram escritas aqui, do zero, três funções utilitárias que
// eram CHAMADAS pelo código original mas nunca tinham sido definidas em
// nenhum arquivo (validarCPF, formatarNumeroTelefone, formatarDataSlashes).
// Sem elas, salvarFuncionario() quebrava com ReferenceError.
// =========================================================================

// --- UTILITÁRIOS (não existiam em nenhum arquivo — implementação nova) ---
function validarCPF(cpf) {
    cpf = (cpf || '').replace(/\D/g, '');
    return cpf.length === 11;
}

function formatarNumeroTelefone(valor) {
    let v = (valor || '').replace(/\D/g, '').substring(0, 11);
    if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (v.length > 5) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    return v;
}

function formatarDataSlashes(valor) {
    let v = (valor || '').replace(/\D/g, '').substring(0, 8);
    if (v.length > 4) return v.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
    if (v.length > 2) return v.replace(/(\d{2})(\d{0,2})/, '$1/$2');
    return v;
}

// Itens 2 e 14 (prompt_gemini.md §14): antes só FORMATAVA (dd/mm/aaaa)
// sem checar se a data digitada existe de verdade (ex.: 31/02/2026
// passava batido). Confere dia/mês/ano de verdade, incluindo meses
// com menos de 31 dias e anos bissextos (via truque do
// `new Date(ano, mes, 0)`, que devolve o último dia do mês ANTERIOR
// ao informado — funciona porque o dia 0 "estoura" pro mês de trás).
// Campo vazio não conta como inválido — só quando preenchido errado.
function validarDataBR(dataStr) {
    if (!dataStr) return true;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataStr);
    if (!m) return false;
    const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10), ano = parseInt(m[3], 10);
    if (mes < 1 || mes > 12) return false;
    if (ano < 1900 || ano > 2100) return false;
    const diasNoMes = new Date(ano, mes, 0).getDate();
    return dia >= 1 && dia <= diasNoMes;
}

// Confere TODOS os campos de data preenchidos numa tela — usado antes
// de salvar (Funcionário, Projeto), bloqueia com aviso se algum
// estiver com data inválida.
function validarTodasDatasDaTela() {
    const campos = document.querySelectorAll('.input-data-mask');
    for (const campo of campos) {
        if (campo.offsetParent === null) continue; // ignora campo escondido/de outra aba
        if (!validarDataBR(campo.value)) {
            campo.focus();
            alert('Data inválida: "' + campo.value + '". Confira o formato dd/mm/aaaa e se a data existe de verdade.');
            return false;
        }
    }
    return true;
}

// Itens 9 e 11 (prompt_gemini.md §14): Valor formatado como moeda R$,
// Área com 2 casas decimais e separador de milhar. IMPORTANTE: só a
// EXIBIÇÃO é mascarada — o valor salvo continua um número puro
// ("1234.56"), porque `distribuicao-custos.js` lê `projeto.valor` com
// `parseFloat()` em 5 lugares (linhas 215/399/419/829/862) — salvar a
// string formatada quebraria esses cálculos silenciosamente.

// Pra digitação (oninput) — trata os dígitos crus digitados como
// centavos, sempre fecha com 2 casas decimais.
function formatarNumeroBRDigitando(valorBruto) {
    let v = (valorBruto || '').replace(/\D/g, '');
    if (v === '') return '';
    v = (parseInt(v, 10) / 100).toFixed(2);
    let partes = v.split('.');
    let inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return inteiro + ',' + partes[1];
}

// Pra exibir um número já salvo (ex.: ao abrir pra editar) — parte de
// um float de verdade, não de dígitos crus.
function formatarNumeroBRParaExibicao(numero) {
    const n = parseFloat(numero) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Desfaz a formatação BR (milhar com ponto, decimal com vírgula) pra
// número puro salvável — usado na hora de gravar no banco_projetos.
function desformatarNumeroBR(valorFormatado) {
    if (!valorFormatado) return '';
    return String(valorFormatado).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
}

function aplicarMascarasLocais() {
    const cpfInput = document.getElementById('func-cpf');
    if (cpfInput) {
        cpfInput.oninput = function (e) {
            let v = e.target.value.replace(/\D/g, ""); if (v.length > 11) v = v.substring(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        };
    }
    const telInput = document.getElementById('func-telefone');
    if (telInput) telInput.oninput = function (e) { e.target.value = formatarNumeroTelefone(e.target.value); };
    document.querySelectorAll('.input-data-mask').forEach(i => {
        i.oninput = function (e) { e.target.value = formatarDataSlashes(e.target.value); };
        i.onblur = function (e) {
            const valido = validarDataBR(e.target.value);
            e.target.style.borderColor = valido ? '' : '#dc2626';
            e.target.title = valido ? '' : 'Data inválida — use o formato dd/mm/aaaa';
        };
    });

    const valorInput = document.getElementById('proj-valor');
    if (valorInput) valorInput.oninput = function (e) { e.target.value = formatarNumeroBRDigitando(e.target.value); };
    const areaInput = document.getElementById('proj-area');
    if (areaInput) areaInput.oninput = function (e) { e.target.value = formatarNumeroBRDigitando(e.target.value); };
}

// --- CONTROLE DE FORMULÁRIO GENÉRICO (recuperado do módulo órfão) ---
function abrirFormulario(modulo, isNovo = false) {
    document.getElementById(`panel-${modulo}-lista`).style.display = 'none';
    document.getElementById(`panel-${modulo}-form`).style.display = 'flex';
    if (isNovo) {
        document.getElementById('page-context-title').innerText = `Inserir Novo Registro`;
        if (modulo === 'clientes') { document.getElementById('cli-index').value = ""; document.getElementById('cli-nome').value = ""; document.getElementById('cli-cnpj').value = ""; document.getElementById('cli-rua').value = ""; document.getElementById('cli-numero').value = ""; document.getElementById('cli-bairro').value = ""; document.getElementById('cli-cidade').value = ""; document.getElementById('cli-uf').value = ""; document.getElementById('cli-contato').value = ""; document.getElementById('cli-whatsapp').value = ""; document.getElementById('cli-email').value = ""; }
        if (modulo === 'funcionarios') { document.getElementById('func-index').value = ""; document.getElementById('func-nome').value = ""; document.getElementById('func-cpf').value = ""; document.getElementById('func-nivel').value = "administrador"; document.getElementById('func-cargo').value = "analista pleno"; document.getElementById('func-dt-inicio').value = ""; document.getElementById('func-dt-desligamento').value = ""; document.getElementById('func-dt-nascimento').value = ""; document.getElementById('func-rua').value = ""; document.getElementById('func-numero').value = ""; document.getElementById('func-bairro').value = ""; document.getElementById('func-cidade').value = ""; document.getElementById('func-uf').value = ""; document.getElementById('func-telefone').value = ""; document.getElementById('func-email').value = ""; document.getElementById('func-senha').value = ""; document.getElementById('func-cal-seg').value = "8"; document.getElementById('func-cal-ter').value = "8"; document.getElementById('func-cal-qua').value = "8"; document.getElementById('func-cal-qui').value = "8"; document.getElementById('func-cal-sex').value = "8"; funcTempHistoricoValorHora = []; renderizarTabelaHistoricoValorHora(); }
        if (modulo === 'projetos') { alimentarDropdownsProjeto(); document.getElementById('proj-index').value = ""; document.getElementById('proj-nome-original').value = ""; document.getElementById('proj-nome').value = ""; document.getElementById('proj-prefixo').value = ""; document.getElementById('proj-cliente').value = ""; document.getElementById('proj-rua').value = ""; document.getElementById('proj-numero').value = ""; document.getElementById('proj-bairro').value = ""; document.getElementById('proj-cidade').value = ""; document.getElementById('proj-uf').value = ""; document.getElementById('proj-area').value = ""; document.getElementById('proj-pavimentos').value = ""; document.getElementById('proj-altura').value = ""; document.getElementById('proj-esbeltez').value = ""; document.getElementById('proj-dificuldade').value = "3"; document.getElementById('proj-valor').value = ""; document.getElementById('proj-pagamento').value = "Por entrega"; document.getElementById('proj-dt-inicio').value = "";
            // Item 12 (prompt_gemini.md §14): Analista/Supervisor/
            // Detalhista já vêm com o nome do usuário logado como
            // default (ainda editável, trocando na própria seleção) —
            // antes ficavam sempre em branco.
            const nomeUsuarioLogadoAgora = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado.nome : "";
            document.getElementById('proj-analista').value = nomeUsuarioLogadoAgora;
            document.getElementById('proj-supervisor').value = nomeUsuarioLogadoAgora;
            document.getElementById('proj-detalhista').value = nomeUsuarioLogadoAgora;
            document.getElementById('proj-novo-email').value = ""; document.getElementById('proj-novo-email-cargo').value = ""; projTempEmailsResponsaveis = []; renderizarTabelaEmailsResponsaveisProjeto();
            // Item 5 (prompt_gemini.md §14): ao abrir a tela de novo
            // projeto, visão e cursor começam do canto superior
            // esquerdo, já com foco no campo Nome Obra.
            const painelFormProjeto = document.getElementById('panel-projetos-form');
            if (painelFormProjeto) painelFormProjeto.scrollTop = 0;
            setTimeout(() => { const campoNome = document.getElementById('proj-nome'); if (campoNome) campoNome.focus(); }, 0);
            // Etapas Default v2 (prompt_gemini.md §12.30, pedido da
            // diretoria): projeto NOVO já chega com a lista pré-populada
            // pelas 4 Etapas Default — 100% editável ali mesmo, antes de
            // salvar (não precisa aceitar as 4, pode tirar/trocar/
            // adicionar outras do Catálogo). Só existe na CRIAÇÃO — na
            // edição, essa seção some (ver abrirFormulario abaixo) e
            // salvarProjeto() nem olha pra esse array.
            const etapasLegoAgora = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
            projTempEtapasDefault = ETAPAS_DEFAULT_NOMES
                .map(nomeDefault => {
                    // Compara normalizado (tolera espaço extra/maiúscula),
                    // mas guarda o nome EXATO como está no Catálogo — daí
                    // pra frente (tabela, salvarProjeto) a comparação
                    // continua exata sem risco de discrepância.
                    const encontrada = etapasLegoAgora.find(e => normalizarNomeEtapa(e.nome) === normalizarNomeEtapa(nomeDefault));
                    return encontrada ? encontrada.nome : null;
                })
                .filter(nome => nome !== null);
            renderizarTabelaEtapasProjeto();
            document.getElementById('proj-secao-etapas').style.display = 'block';
        }
    }
    // Seção "Etapas do Projeto" só faz sentido na criação (decisão do
    // usuário: nunca se aplica em edição) — escondida ao editar, pra
    // não sugerir que mexer nela ali afeta a árvore já existente.
    if (modulo === 'projetos' && !isNovo) {
        const secaoEtapas = document.getElementById('proj-secao-etapas');
        if (secaoEtapas) secaoEtapas.style.display = 'none';
    }
    aplicarMascarasLocais();
}

function fecharFormulario(modulo) {
    document.getElementById(`panel-${modulo}-form`).style.display = 'none';
    document.getElementById(`panel-${modulo}-lista`).style.display = 'flex';
    alternarModulo(modulo);
}

// --- LÓGICA DE NEGÓCIO DE CLIENTES (recuperada do módulo órfão) ---
function renderizarTabelaClientes() {
    let c = JSON.parse(localStorage.getItem('banco_clientes')) || []; c.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-clientes-body'); if (!t) return; t.innerHTML = '';
    // Identifica pelo NOME, não pela posição na lista já ordenada pra
    // exibição — usar a posição (idx) aqui e reler sem ordenar depois
    // (como era antes) abria/apagava o registro errado, porque a ordem
    // exibida diverge da ordem crua salva no localStorage assim que a
    // ordenação alfabética não bate com a ordem de inserção. Mesma
    // chave (`nome`) que o resto do projeto já usa como identificador
    // implícito de cliente/funcionário/projeto em todo lugar. Testado
    // isolado antes de aplicar — ver
    // /home/claude/testes/teste_cadastros_indice_correto.js.
    c.forEach((cli, idx) => { const nomeJs = cli.nome.replace(/'/g, "\\'"); t.innerHTML += `<tr class="clickable-row" onclick="carregarClienteParaEdicao('${nomeJs}')"><td>C-${String(idx + 1).padStart(3, '0')}</td><td><strong>${escapeHtml(cli.nome)}</strong></td><td>${escapeHtml(cli.cnpj || '')}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarCliente('${nomeJs}')">🗑️</button></td></tr>`; });
}
function salvarCliente() {
    // Item 17 (prompt_gemini.md §14, leva 4): mesmo .trim() aplicado em
    // Projeto — evita nome salvo com espaço a mais no início/fim.
    const i = document.getElementById('cli-index').value; const n = document.getElementById('cli-nome').value.trim(); if (!n) return alert("Obrigatório");
    const nv = { nome: n, cnpj: document.getElementById('cli-cnpj').value, rua: document.getElementById('cli-rua').value, numero: document.getElementById('cli-numero').value, bairro: document.getElementById('cli-bairro').value, cidade: document.getElementById('cli-cidade').value, uf: document.getElementById('cli-uf').value, contato: document.getElementById('cli-contato').value, whatsapp: document.getElementById('cli-whatsapp').value, email: document.getElementById('cli-email').value };
    let l = JSON.parse(localStorage.getItem('banco_clientes')) || []; if (i === "") l.push(nv); else l[i] = nv;
    localStorage.setItem('banco_clientes', JSON.stringify(l)); fecharFormulario('clientes');
}
function carregarClienteParaEdicao(nome) {
    const l = JSON.parse(localStorage.getItem('banco_clientes')) || [];
    const indexReal = l.findIndex(x => x.nome === nome);
    if (indexReal === -1) return;
    const c = l[indexReal]; abrirFormulario('clientes', false);
    document.getElementById('cli-index').value = indexReal; document.getElementById('cli-nome').value = c.nome; document.getElementById('cli-cnpj').value = c.cnpj || ''; document.getElementById('cli-rua').value = c.rua || c.logradouro || ''; document.getElementById('cli-numero').value = c.numero || ''; document.getElementById('cli-bairro').value = c.bairro || ''; document.getElementById('cli-cidade').value = c.cidade || ''; document.getElementById('cli-uf').value = c.uf || ''; document.getElementById('cli-contato').value = c.contato || ''; document.getElementById('cli-whatsapp').value = c.whatsapp || ''; document.getElementById('cli-email').value = c.email || '';
}
function deletarCliente(nome) {
    if (!confirm("Remover " + nome + "?")) return;
    let l = JSON.parse(localStorage.getItem('banco_clientes')) || [];
    const indexReal = l.findIndex(x => x.nome === nome);
    if (indexReal === -1) return;
    l.splice(indexReal, 1); localStorage.setItem('banco_clientes', JSON.stringify(l)); renderizarTabelaClientes();
}

// --- LÓGICA DE NEGÓCIO DE FUNCIONÁRIOS (recuperada do módulo órfão) ---
function renderizarTabelaFuncionarios() {
    let f = JSON.parse(localStorage.getItem('banco_funcionarios')) || []; f.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-funcionarios-body'); if (!t) return; t.innerHTML = '';
    const hojeISO = new Date().toISOString().slice(0, 10);
    // Identifica pelo NOME, não pela posição na lista ordenada — ver
    // nota completa em renderizarTabelaClientes() acima, mesmo bug,
    // mesma correção.
    f.forEach((func) => {
        const nomeJs = func.nome.replace(/'/g, "\\'");
        // Bug corrigido: esta coluna mostrava `func.nivel` no lugar do
        // valor da hora (coluna "Valor/Hora" renomeada sem atualizar a
        // linha, ver prompt_gemini.md §2). Valor vigente HOJE, do
        // histórico (`valorHoraVigente`, feriados.js) — mesmo dado usado
        // no resto do sistema (Pontos Máximo, custo real de tarefa).
        const valorHoraAtual = typeof valorHoraVigente === 'function' ? valorHoraVigente(func.nome, hojeISO) : 0;
        const valorHoraExibicao = 'R$ ' + valorHoraAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const formaPagamentoExibicao = func.forma_pagamento === 'comissionado' ? 'Comissionado' : 'Por Hora';
        t.innerHTML += `<tr class="clickable-row" onclick="carregarFuncionarioParaEdicao('${nomeJs}')"><td>${escapeHtml(func.cpf)}</td><td><strong>${escapeHtml(func.nome)}</strong></td><td>${escapeHtml(func.codinome || '—')}</td><td>${escapeHtml(func.cargo)}</td><td>${escapeHtml(func.nivel)}</td><td>${formaPagamentoExibicao}</td><td>${valorHoraExibicao}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarFuncionario('${nomeJs}')">🗑️</button></td></tr>`;
    });
}
function salvarFuncionario() {
    // Item 17 (prompt_gemini.md §14, leva 4): mesmo .trim() aplicado em
    // Projeto/Cliente.
    const i = document.getElementById('func-index').value; const n = document.getElementById('func-nome').value.trim(); const c = document.getElementById('func-cpf').value; const cod = document.getElementById('func-codinome').value.trim();
    if (!n || !c.trim() || !validarCPF(c)) return alert("CPF ou Nome inválido!");
    if (!cod) return alert("Codinome é obrigatório!");
    // Itens 2/14 (prompt_gemini.md §14): bloqueia salvar se alguma data
    // (Início, Desligamento, Nascimento) estiver preenchida errado.
    if (!validarTodasDatasDaTela()) return;

    // Codinome voltou a ser campo digitado (não mais calculado
    // automático do primeiro nome) — continua obrigatório e único
    // entre funcionários, mesmo motivo de antes: é o que aparece em
    // toda tela do sistema, uma colisão criaria confusão visual real.
    // `i === ""` = cadastro novo (indexAtual = -1, não exclui ninguém
    // da checagem); edição exclui o próprio registro.
    const listaAtual = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const indexAtual = (i === "") ? -1 : parseInt(i, 10);
    const colisao = listaAtual.find((f, idx) => idx !== indexAtual && (f.codinome || '').toLowerCase() === cod.toLowerCase());
    if (colisao) return alert('Já existe um funcionário com o codinome "' + cod + '" (' + colisao.nome + '). O codinome precisa ser único no sistema.');

    const nv = { nome: n, codinome: cod, cpf: c, nivel: document.getElementById('func-nivel').value, cargo: document.getElementById('func-cargo').value, forma_pagamento: document.getElementById('func-forma-pagamento').value, historico_valor_hora: funcTempHistoricoValorHora.slice(), dt_inicio: document.getElementById('func-dt-inicio').value, dt_desligamento: document.getElementById('func-dt-desligamento').value, dt_nascimento: document.getElementById('func-dt-nascimento').value, rua: document.getElementById('func-rua').value, numero: document.getElementById('func-numero').value, bairro: document.getElementById('func-bairro').value, cidade: document.getElementById('func-cidade').value, uf: document.getElementById('func-uf').value, telefone: document.getElementById('func-telefone').value, email: document.getElementById('func-email').value, senha: document.getElementById('func-senha').value,
        calendario: {
            seg: document.getElementById('func-cal-seg').value || "0",
            ter: document.getElementById('func-cal-ter').value || "0",
            qua: document.getElementById('func-cal-qua').value || "0",
            qui: document.getElementById('func-cal-qui').value || "0",
            sex: document.getElementById('func-cal-sex').value || "0"
        }
    };
    let l = JSON.parse(localStorage.getItem('banco_funcionarios')) || []; if (i === "") l.push(nv); else l[i] = nv;
    localStorage.setItem('banco_funcionarios', JSON.stringify(l)); fecharFormulario('funcionarios');
}
function carregarFuncionarioParaEdicao(nome) {
    const lista = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const index = lista.findIndex(x => x.nome === nome);
    if (index === -1) return;
    const f = lista[index]; abrirFormulario('funcionarios', false);
    document.getElementById('func-index').value = index; document.getElementById('func-nome').value = f.nome; document.getElementById('func-codinome').value = f.codinome || ''; document.getElementById('func-cpf').value = f.cpf; document.getElementById('func-nivel').value = f.nivel; document.getElementById('func-cargo').value = f.cargo; document.getElementById('func-forma-pagamento').value = f.forma_pagamento || 'hora'; document.getElementById('func-dt-inicio').value = f.dt_inicio; document.getElementById('func-dt-desligamento').value = f.dt_desligamento; document.getElementById('func-dt-nascimento').value = f.dt_nascimento; document.getElementById('func-rua').value = f.rua || f.endereco || ''; document.getElementById('func-numero').value = f.numero || ''; document.getElementById('func-bairro').value = f.bairro || ''; document.getElementById('func-cidade').value = f.cidade || ''; document.getElementById('func-uf').value = f.uf || ''; document.getElementById('func-telefone').value = formatarNumeroTelefone(f.telefone); document.getElementById('func-email').value = f.email; document.getElementById('func-senha').value = f.senha;
    funcTempHistoricoValorHora = Array.isArray(f.historico_valor_hora) ? f.historico_valor_hora.map(e => ({ valor: e.valor, data_vigencia: e.data_vigencia })) : [];
    renderizarTabelaHistoricoValorHora();
    const cal = f.calendario || {};
    document.getElementById('func-cal-seg').value = cal.seg !== undefined ? cal.seg : "8";
    document.getElementById('func-cal-ter').value = cal.ter !== undefined ? cal.ter : "8";
    document.getElementById('func-cal-qua').value = cal.qua !== undefined ? cal.qua : "8";
    document.getElementById('func-cal-qui').value = cal.qui !== undefined ? cal.qui : "8";
    document.getElementById('func-cal-sex').value = cal.sex !== undefined ? cal.sex : "8";
}
function deletarFuncionario(nome) {
    if (!confirm("Remover " + nome + "?")) return;
    let l = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const index = l.findIndex(x => x.nome === nome);
    if (index === -1) return;
    l.splice(index, 1); localStorage.setItem('banco_funcionarios', JSON.stringify(l)); renderizarTabelaFuncionarios();
}

// --- HISTÓRICO DE VALOR DA HORA (dentro do formulário de Funcionários) ---
// Substituiu o campo único antigo `func-hora`. Guarda em memória
// (`funcTempHistoricoValorHora`) enquanto o formulário está aberto — só
// vira `funcionario.historico_valor_hora` de verdade quando
// salvarFuncionario() roda (mesmo padrão do resto do formulário: nada é
// gravado no localStorage até clicar Salvar). Ver
// feriados.js::valorHoraVigente() pra como esse histórico é consultado
// na hora de calcular custo/Pontos Máximo.
let funcTempHistoricoValorHora = [];

function renderizarTabelaHistoricoValorHora() {
    const tbody = document.getElementById('func-tabela-historico-hora-body');
    if (!tbody) return;

    if (funcTempHistoricoValorHora.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding:10px;">Nenhum valor cadastrado ainda.</td></tr>';
        return;
    }

    // Mostra mais recente primeiro, mas o índice usado no botão excluir
    // é o índice REAL no array (não a posição na lista ordenada) —
    // senão excluiria a linha errada.
    const ordenado = funcTempHistoricoValorHora
        .map((entrada, indiceReal) => ({ entrada, indiceReal }))
        .sort((a, b) => b.entrada.data_vigencia.localeCompare(a.entrada.data_vigencia));

    tbody.innerHTML = ordenado.map(({ entrada, indiceReal }) => {
        const dataExibicao = typeof formatarDataPrevistaExibicao === 'function'
            ? formatarDataPrevistaExibicao(entrada.data_vigencia)
            : entrada.data_vigencia;
        return '<tr><td>R$ ' + parseFloat(entrada.valor).toFixed(2) + '</td>' +
            '<td>' + dataExibicao + '</td>' +
            '<td style="text-align:center;"><button class="btn-delete" onclick="removerValorHoraFuncionario(' + indiceReal + ')">🗑️</button></td></tr>';
    }).join('');
}

function adicionarValorHoraFuncionario() {
    const valor = document.getElementById('func-novo-valor-hora').value;
    const data = document.getElementById('func-nova-data-vigencia').value;

    if (!valor || parseFloat(valor) <= 0) return alert('Informe um valor de hora válido.');
    if (!data) return alert('Informe a data de vigência.');
    if (funcTempHistoricoValorHora.some(e => e.data_vigencia === data)) {
        return alert('Já existe um valor cadastrado com essa mesma data de vigência. Exclua o antigo primeiro se quiser corrigir.');
    }

    funcTempHistoricoValorHora.push({ valor: parseFloat(valor), data_vigencia: data });
    document.getElementById('func-novo-valor-hora').value = '';
    document.getElementById('func-nova-data-vigencia').value = '';
    renderizarTabelaHistoricoValorHora();
}

function removerValorHoraFuncionario(indice) {
    funcTempHistoricoValorHora.splice(indice, 1);
    renderizarTabelaHistoricoValorHora();
}

// --- LÓGICA DE NEGÓCIO DE PROJETOS (recuperada do módulo órfão) ---
function renderizarTabelaProjetos() {
    let p = JSON.parse(localStorage.getItem('banco_projetos')) || []; p.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-projetos-body'); if (!t) return; t.innerHTML = '';
    // Identifica pelo NOME, não pela posição na lista ordenada — ver
    // nota completa em renderizarTabelaClientes() (cadastros.js), mesmo
    // bug (item 1/5 da Rodada de Comentários da Gerência, ver
    // prompt_gemini.md §12), mesma correção.
    p.forEach((proj) => { const nomeJs = proj.nome.replace(/'/g, "\\'"); t.innerHTML += `<tr class="clickable-row" onclick="carregarProjetoParaEdicao('${nomeJs}')"><td><strong>${escapeHtml(proj.prefixo || '---')}</strong></td><td>${escapeHtml(proj.nome)}</td><td>${escapeHtml(proj.cliente)}</td><td>${proj.analista ? escapeHtml(nomeParaExibicao(proj.analista)) : '—'}</td><td>${proj.supervisor ? escapeHtml(nomeParaExibicao(proj.supervisor)) : '—'}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarProjeto('${nomeJs}')">🗑️</button></td></tr>`; });
}
function alimentarDropdownsProjeto() {
    const cl = JSON.parse(localStorage.getItem('banco_clientes')) || []; const fu = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const dc = document.getElementById('proj-cliente'); const da = document.getElementById('proj-analista'); const ds = document.getElementById('proj-supervisor'); const dd = document.getElementById('proj-detalhista');
    dc.innerHTML = '<option value="">-- Selecione o Cliente --</option>'; cl.forEach(c => dc.innerHTML += `<option value="${escapeHtml(c.nome)}">${escapeHtml(c.nome)}</option>`);
    da.innerHTML = '<option value="">-- Selecione --</option>'; ds.innerHTML = '<option value="">-- Selecione --</option>'; dd.innerHTML = '<option value="">-- Selecione --</option>';
    fu.forEach(f => { const nomeAttr = escapeHtml(f.nome), nomeTexto = escapeHtml(nomeParaExibicao(f.nome)); da.innerHTML += `<option value="${nomeAttr}">${nomeTexto}</option>`; ds.innerHTML += `<option value="${nomeAttr}">${nomeTexto}</option>`; dd.innerHTML += `<option value="${nomeAttr}">${nomeTexto}</option>`; });
}

// --- E-MAILS DOS RESPONSÁVEIS (lado do CLIENTE) — item 4 da Rodada de
// Comentários da Gerência (ver prompt_gemini.md §12). Vários e-mails por
// projeto, guardados em `projeto.emails_responsaveis` (array de
// strings). Mesmo padrão do histórico de valor da hora (Cadastro de
// Funcionários): fica numa lista TEMPORÁRIA em memória enquanto o
// formulário está aberto, só vira dado de verdade quando salvarProjeto()
// roda — nada é gravado no localStorage antes de clicar Salvar.
let projTempEmailsResponsaveis = [];

// --- ETAPAS DEFAULT NO CADASTRO DE PROJETO — Etapas Default v2
// (prompt_gemini.md §12.30, pedido da diretoria, agosto/2026). Mesmo
// padrão dos e-mails acima: lista TEMPORÁRIA em memória enquanto o
// formulário está aberto, só vira dado de verdade em salvarProjeto()
// — só que aqui o destino final não é um campo do PRÓPRIO projeto, é
// gravado direto em `banco_arvores_projetos` (a árvore), no instante
// da criação. Existe só na CRIAÇÃO (ver abrirFormulario acima) — na
// edição de um projeto já existente, essa seção do formulário fica
// escondida e salvarProjeto() não toca na árvore de jeito nenhum.
const ETAPAS_DEFAULT_NOMES = ['Pré-Lançamento', 'Lançamento', 'Análise', 'Detalhamento'];
let projTempEtapasDefault = [];

// Comparação tolerante a espaço extra/maiúscula-minúscula/etc — sem
// isso, qualquer diferença mínima entre o nome digitado no Catálogo de
// Etapas e a lista fixa acima fazia a Etapa Default correspondente
// sumir SILENCIOSAMENTE da lista automática (bug reportado pelo
// usuário: "etapas não vieram prontas" — a causa era essa comparação
// exata, não a lógica de pré-popular em si, que já estava correta).
function normalizarNomeEtapa(s) {
    return (s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos (é→e, ã→a, etc.) — faltava aqui, era a causa provável de "Pré-Lançamento" sumir da lista automática
        .replace(/-/g, ' ') // trata hífen como espaço — "Pré-Lançamento" casa com "Pré Lançamento"
        .replace(/\s+/g, ' ') // colapsa espaços múltiplos
        .trim()
        .toLowerCase();
}

// Tabela com edição IN-PLACE — mesmo espírito da aba "Distribuição de
// Custos Analista" (distribuicao-custos.js::construirLinhaDistribuicaoAnalista):
// um campo editável por linha, direto na tabela, sem formulário
// separado. Cada linha tem seu próprio <select> (já com a Etapa atual
// selecionada) — trocar o valor ali edita a linha na hora
// (alterarEtapaNaLinhaProjeto), sem precisar excluir e recriar.
// Grid compacto (não é mais <table>) — pedido do usuário: dar pra ver
// todas as Etapas numa tela só, sem rolar. Coluna "Tipo" REMOVIDA
// (Árvore Genérica Recursiva, prompt_gemini.md §12.31) — Etapa não
// tem mais tipo nenhum pra mostrar; cada item agora é só
// [seletor de Etapa — cresce] [🗑️].
function renderizarTabelaEtapasProjeto() {
    const container = document.getElementById('proj-tabela-etapas-body');
    if (!container) return;
    const etapasLego = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];

    if (projTempEtapasDefault.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:10px; font-size:12px;">Nenhuma Etapa na lista — clique em "+ Adicionar Linha".</div>';
        return;
    }

    container.innerHTML = projTempEtapasDefault.map((nome, idx) => {
        const opcoes = etapasLego.map(e => '<option value="' + escapeHtml(e.nome) + '"' + (e.nome === nome ? ' selected' : '') + '>' + escapeHtml(e.nome) + '</option>').join('');
        return '<div style="display:flex; align-items:center; gap:5px; padding:4px 6px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc;">' +
            '<select style="flex:1; min-width:0; padding:3px 4px; font-size:12px; background:white; border:1px solid #cbd5e1; border-radius:3px;" onchange="alterarEtapaNaLinhaProjeto(' + idx + ', this.value)">' + opcoes + '</select>' +
            '<button class="btn-delete" style="flex-shrink:0; padding:2px 6px;" onclick="removerEtapaProjeto(' + idx + ')">🗑️</button>' +
            '</div>';
    }).join('');
}

// Editar uma linha in-place (troca a Etapa dela por outra do
// Catálogo) — pedido do usuário: "deve ser possível... editá-las na
// aba cadastro de projeto", não só excluir+recriar.
function alterarEtapaNaLinhaProjeto(idx, novoNome) {
    if (projTempEtapasDefault.some((n, i) => i !== idx && n === novoNome)) {
        alert('Essa Etapa já está em outra linha da lista.');
        renderizarTabelaEtapasProjeto(); // desfaz a troca no <select> (volta pro valor anterior)
        return;
    }
    projTempEtapasDefault[idx] = novoNome;
    renderizarTabelaEtapasProjeto();
}

// "+ Adicionar Linha": pega a primeira Etapa do Catálogo que ainda não
// está na lista (usuário troca depois pelo <select> da própria linha,
// se quiser outra).
function adicionarEtapaProjeto() {
    const etapasLego = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
    if (etapasLego.length === 0) return alert('Cadastre ao menos uma Etapa no Catálogo antes.');
    const disponivel = etapasLego.find(e => !projTempEtapasDefault.includes(e.nome));
    if (!disponivel) return alert('Todas as Etapas do Catálogo já estão na lista.');
    projTempEtapasDefault.push(disponivel.nome);
    renderizarTabelaEtapasProjeto();
}

function removerEtapaProjeto(idx) {
    projTempEtapasDefault.splice(idx, 1);
    renderizarTabelaEtapasProjeto();
}

function validarEmailSimples(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function renderizarTabelaEmailsResponsaveisProjeto() {
    const tbody = document.getElementById('proj-tabela-emails-body');
    if (!tbody) return;
    if (projTempEmailsResponsaveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding:10px;">Nenhum e-mail cadastrado ainda.</td></tr>';
        return;
    }
    // Compatível com o formato antigo (string simples, sem cargo) caso
    // exista algum projeto salvo antes desse campo existir — trata como
    // {email: string, cargo: ''}.
    tbody.innerHTML = projTempEmailsResponsaveis.map((item, idx) => {
        const email = typeof item === 'string' ? item : item.email;
        const cargo = typeof item === 'string' ? '' : (item.cargo || '');
        return '<tr><td>' + escapeHtml(email) + '</td><td>' + escapeHtml(cargo || '—') + '</td><td style="text-align:center;"><button class="btn-delete" onclick="removerEmailResponsavelProjeto(' + idx + ')">🗑️</button></td></tr>';
    }).join('');
}

function adicionarEmailResponsavelProjeto() {
    const campoEmail = document.getElementById('proj-novo-email');
    const campoCargo = document.getElementById('proj-novo-email-cargo');
    const email = (campoEmail.value || '').trim();
    const cargo = (campoCargo.value || '').trim();
    if (!validarEmailSimples(email)) return alert('Informe um e-mail válido.');
    if (projTempEmailsResponsaveis.some(item => (typeof item === 'string' ? item : item.email) === email)) return alert('Esse e-mail já foi adicionado.');
    projTempEmailsResponsaveis.push({ email: email, cargo: cargo });
    campoEmail.value = '';
    campoCargo.value = '';
    renderizarTabelaEmailsResponsaveisProjeto();
}

function removerEmailResponsavelProjeto(idx) {
    projTempEmailsResponsaveis.splice(idx, 1);
    renderizarTabelaEmailsResponsaveisProjeto();
}
function salvarProjeto() {
    // Item 17 (prompt_gemini.md §14, leva 4 — bug real confirmado):
    // .trim() no nome antes de usar — sem isso, um espaço a mais no
    // início/fim virava parte do NOME salvo e da CHAVE em
    // banco_arvores_projetos, fazendo buscas por esse projeto
    // "falharem" silenciosamente (ex: projeto salvo como " B" em vez
    // de "B" — parecia que a árvore tinha sumido, não tinha, só
    // estava com um nome ligeiramente diferente do esperado).
    const i = document.getElementById('proj-index').value; const nomeOriginalNaEdicao = document.getElementById('proj-nome-original').value; const n = document.getElementById('proj-nome').value.trim(); const c = document.getElementById('proj-cliente').value; if (!n || !c) return alert("Campos obrigatórios!");
    // Itens 2/14 (prompt_gemini.md §14): bloqueia salvar se a data de
    // Início estiver preenchida errado.
    if (!validarTodasDatasDaTela()) return;
    const nv = { nome: n, prefixo: document.getElementById('proj-prefixo').value, cliente: c, rua: document.getElementById('proj-rua').value, numero: document.getElementById('proj-numero').value, bairro: document.getElementById('proj-bairro').value, cidade: document.getElementById('proj-cidade').value, uf: document.getElementById('proj-uf').value, area: desformatarNumeroBR(document.getElementById('proj-area').value), pavimentos: document.getElementById('proj-pavimentos').value, altura: document.getElementById('proj-altura').value, esbeltez: document.getElementById('proj-esbeltez').value, dificuldade: document.getElementById('proj-dificuldade').value, valor: desformatarNumeroBR(document.getElementById('proj-valor').value), pagamento: document.getElementById('proj-pagamento').value, dt_inicio: document.getElementById('proj-dt-inicio').value, analista: document.getElementById('proj-analista').value, supervisor: document.getElementById('proj-supervisor').value, detalhista: document.getElementById('proj-detalhista').value, emails_responsaveis: projTempEmailsResponsaveis.slice() };
    let l = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    // status_liberacao (item 3 da Rodada de Comentários da Gerência —
    // ver prompt_gemini.md §12) não tem campo no formulário (o controle
    // vive na Árvore de Projeto, não aqui) — projeto NOVO nasce "Em
    // Análise" de propósito; ao EDITAR, preserva o que já estava
    // gravado (senão qualquer edição no Cadastro re-liberaria um
    // projeto que alguém tinha voltado pra análise de propósito).
    if (i === "") {
        // Item 17 (prompt_gemini.md §14 — decisão do usuário: colisão
        // de nome BLOQUEIA em vez de só avisar): se já existe uma
        // árvore sob esse nome (provavelmente órfã, de um projeto
        // criado antes com o mesmo nome depois apagado do Cadastro
        // sem limpar a árvore), não cria o projeto — evita reaproveitar
        // em silêncio uma estrutura que pode não ser a esperada, como
        // já aconteceu com dados reais (caso "OBRA B").
        let todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
        if (todasArvores[n]) {
            alert('Não foi possível salvar: já existe uma Estrutura de Projeto (árvore) salva com o nome "' + n + '". Escolha outro nome, ou peça pra quem mantém o sistema resolver a colisão manualmente antes de criar este projeto.');
            return;
        }
        nv.status_liberacao = 'em_analise';
        l.push(nv);
        // Etapas Default v2 (prompt_gemini.md §12.30): grava a árvore
        // deste projeto direto em banco_arvores_projetos AGORA, no
        // instante da criação — com as Etapas que o usuário deixou no
        // mini-editor acima (`projTempEtapasDefault`, pode ser as 4
        // default, uma lista diferente, ou vazia). Reaproveita
        // criarEtapaDefaultAPartirDoCatalogo() de arvore.js (mesmo
        // arquivo carregado na mesma página) — não duplica a lógica de
        // criação por tipo. Projeto EDITADO (branch else abaixo) nunca
        // passa por aqui — decisão explícita do usuário, pra não
        // arriscar sobrescrever uma árvore que já tem trabalho real.
        if (typeof criarEtapaDefaultAPartirDoCatalogo === 'function') {
            const etapasIniciais = projTempEtapasDefault
                .map(nome => criarEtapaDefaultAPartirDoCatalogo(nome, nv.analista))
                .filter(etapa => etapa !== null);
            todasArvores[n] = {
                nome: n, area_comercial: "5000", valor_contrato: "250000",
                f_esb: "1.0", f_analista: "1.0", supervisor: nv.supervisor || '', analista: nv.analista || '',
                etapas: etapasIniciais
            };
            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
        }
    }
    else {
        // Item 17 (prompt_gemini.md §14, leva 4 — bug real confirmado):
        // busca o projeto que está sendo editado pelo NOME que estava
        // salvo quando o formulário foi aberto
        // (`proj-nome-original`), não mais pela posição (`i`) dentro
        // do array — a posição podia ficar desatualizada se
        // `banco_projetos` mudasse enquanto o formulário estava
        // aberto (ex: sincronização em segundo plano), fazendo
        // salvar por cima do projeto ERRADO. Fallback pro índice
        // antigo só se por algum motivo o nome original não bater
        // com nada (não deveria acontecer, mas não trava o salvamento
        // por causa disso).
        let index = l.findIndex(p => p.nome === nomeOriginalNaEdicao);
        if (index === -1) index = parseInt(i, 10);
        const nomeAntigo = l[index] ? l[index].nome : n;
        nv.status_liberacao = l[index] ? l[index].status_liberacao : undefined;
        l[index] = nv;
        // Item 5/6 (prompt_gemini.md §14, leva 4): projeto renomeado
        // precisa migrar a chave em banco_arvores_projetos também —
        // esse banco é indexado pelo NOME do projeto. Sem isso, a
        // árvore antiga (Etapas/Tarefas de verdade) fica órfã sob o
        // nome antigo, some da Estrutura de Projeto (que busca pelo
        // nome novo) mas continua aparecendo no Kanban/Atribuição de
        // Tarefas (que hoje iteram todo banco_arvores_projetos sem
        // cruzar com banco_projetos).
        if (nomeAntigo && nomeAntigo !== n) {
            let todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            if (todasArvores[nomeAntigo] && !todasArvores[n]) {
                todasArvores[n] = todasArvores[nomeAntigo];
                todasArvores[n].nome = n;
                delete todasArvores[nomeAntigo];
                localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
            } else if (todasArvores[nomeAntigo] && todasArvores[n]) {
                // Item 17 (prompt_gemini.md §14 — decisão do usuário:
                // colisão de nome BLOQUEIA em vez de só avisar): já
                // existe uma árvore sob o nome NOVO — migrar por cima
                // perderia o trabalho que já estava lá (causa raiz do
                // caso real "OBRA B" sumindo), então agora a renomeação
                // inteira é bloqueada (nada é salvo) em vez de só
                // avisar e seguir sem migrar.
                alert('Não foi possível renomear: já existe uma Estrutura de Projeto salva com o nome "' + n + '". Escolha outro nome, ou peça pra quem mantém o sistema resolver a colisão manualmente antes de renomear.');
                return;
            }
        }
    }
    localStorage.setItem('banco_projetos', JSON.stringify(l)); fecharFormulario('projetos');
}
function carregarProjetoParaEdicao(nome) {
    alimentarDropdownsProjeto();
    const l = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const index = l.findIndex(x => x.nome === nome);
    if (index === -1) return;
    const p = l[index]; abrirFormulario('projetos', false);
    document.getElementById('proj-index').value = index; document.getElementById('proj-nome-original').value = p.nome; document.getElementById('proj-nome').value = p.nome; document.getElementById('proj-prefixo').value = p.prefixo; document.getElementById('proj-cliente').value = p.cliente; document.getElementById('proj-rua').value = p.rua || p.endereco || ''; document.getElementById('proj-numero').value = p.numero || ''; document.getElementById('proj-bairro').value = p.bairro || ''; document.getElementById('proj-cidade').value = p.cidade || ''; document.getElementById('proj-uf').value = p.uf || ''; document.getElementById('proj-area').value = p.area ? formatarNumeroBRParaExibicao(p.area) : ''; document.getElementById('proj-pavimentos').value = p.pavimentos; document.getElementById('proj-altura').value = p.altura; document.getElementById('proj-esbeltez').value = p.esbeltez; document.getElementById('proj-dificuldade').value = p.dificuldade; document.getElementById('proj-valor').value = p.valor ? formatarNumeroBRParaExibicao(p.valor) : ''; document.getElementById('proj-pagamento').value = p.pagamento; document.getElementById('proj-dt-inicio').value = p.dt_inicio; document.getElementById('proj-analista').value = p.analista; document.getElementById('proj-supervisor').value = p.supervisor; document.getElementById('proj-detalhista').value = p.detalhista || '';
    projTempEmailsResponsaveis = Array.isArray(p.emails_responsaveis) ? p.emails_responsaveis.slice() : [];
    renderizarTabelaEmailsResponsaveisProjeto();
}
function deletarProjeto(nome) {
    if (!confirm("Remover " + nome + "?")) return;
    let l = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const index = l.findIndex(x => x.nome === nome);
    if (index === -1) return;
    l.splice(index, 1); localStorage.setItem('banco_projetos', JSON.stringify(l));
    // Item 5/6 (prompt_gemini.md §14, leva 4): sem isso, a árvore do
    // projeto (Etapas/Tarefas de verdade, em banco_arvores_projetos)
    // ficava órfã e continuava aparecendo no Kanban e na Atribuição de
    // Tarefas mesmo depois do projeto "deletado" no Cadastro.
    let todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    if (todasArvores[nome]) {
        delete todasArvores[nome];
        localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
    }
    renderizarTabelaProjetos();
}
