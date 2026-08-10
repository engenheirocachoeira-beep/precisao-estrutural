// --- INFORMAÇÕES TÉCNICAS E MÓDULOS DA FÁBRICA DE LEGOS ---

// Injeção Automática dos Painéis de HTML para manter o index limpo
document.getElementById('container-paineis-dinamicos').innerHTML = `
    <div id="panel-clientes-lista" class="content-panel">
        <div class="search-container"><input type="text" class="search-input" id="search-clientes" placeholder="🔍 Pesquisar por Razão Social, CNPJ ou Contato..." oninput="filtrarTabela('clientes')"></div>
        <div class="table-wrapper"><table><thead><tr><th>Código</th><th>Razão Social / Nome</th><th>CNPJ / CPF</th><th style="text-align: center; width: 80px;">Ações</th></tr></thead><tbody id="tabela-clientes-body"></tbody></table></div>
        <div class="footer-actions"><button class="btn-primary" onclick="abrirFormulario('clientes', true)">+ Incluir Novo Cliente</button><div class="action-group-right"><label class="file-import-label">⬇️ Importar Planilha <input type="file" class="input-file-hidden" onchange="detectarEImportarPlanilha(this, 'clientes')"></label><button class="btn-excel" onclick="exportarPlanilhaElaborada('clientes')">⬆️ Exportar Planilha</button></div></div>
    </div>
    <div id="panel-clientes-form" class="content-panel">
        <div class="form-panel"><input type="hidden" id="cli-index"><div class="form-section"><div class="form-section-title">1. Dados Institucionais</div><div class="form-grid"><div class="form-group col-6"><label>Razão Social / Nome *:</label><input type="text" id="cli-nome"></div><div class="form-group col-6"><label>CNPJ / CPF:</label><input type="text" id="cli-cnpj"></div></div></div><div class="form-section"><div class="form-section-title">2. Endereço Completo</div><div class="form-grid"><div class="form-group col-8"><label>Logradouro:</label><input type="text" id="cli-logradouro"></div><div class="form-group col-4"><label>Cidade / UF:</label><input type="text" id="cli-cidade"></div></div></div><div class="form-section"><div class="form-section-title">3. Contatos da Obra</div><div class="form-grid"><div class="form-group col-4"><label>Contato:</label><input type="text" id="cli-contato"></div><div class="form-group col-4"><label>WhatsApp:</label><input type="text" id="cli-whatsapp"></div><div class="form-group col-4"><label>E-mail:</label><input type="text" id="cli-email"></div></div></div><div class="form-footer"><button class="btn-secondary" onclick="fecharFormulario('clientes')">Voltar</button><button class="btn-success" onclick="salvarCliente()">Salvar</button></div></div>
    </div>

    <div id="panel-funcionarios-lista" class="content-panel">
        <div class="search-container"><input type="text" class="search-input" id="search-funcionarios" placeholder="🔍 Pesquisar por Nome, CPF ou Cargo..." oninput="filtrarTabela('funcionarios')"></div>
        <div class="table-wrapper"><table><thead><tr><th style="width: 150px;">CPF</th><th>Nome do Funcionário</th><th>Cargo / Função</th><th>Nível de Acesso</th><th style="text-align: center; width: 80px;">Ações</th></tr></thead><tbody id="tabela-funcionarios-body"></tbody></table></div>
        <div class="footer-actions"><button class="btn-primary" onclick="abrirFormulario('funcionarios', true)">+ Incluir Novo Funcionário</button><div class="action-group-right"><label class="file-import-label">⬇️ Importar Planilha <input type="file" class="input-file-hidden" onchange="detectarEImportarPlanilha(this, 'funcionarios')"></label><button class="btn-excel" onclick="exportarPlanilhaElaborada('funcionarios')">⬆️ Exportar Planilha</button></div></div>
    </div>
    <div id="panel-funcionarios-form" class="content-panel">
        <div class="form-panel"><input type="hidden" id="func-index"><div class="form-section"><div class="form-section-title">1. Identificação Contratual</div><div class="form-grid"><div class="form-group col-6"><label>Nome *:</label><input type="text" id="func-nome"></div><div class="form-group col-3"><label>CPF *:</label><input type="text" id="func-cpf" placeholder="xxx.xxx.xxx-34"></div><div class="form-group col-3"><label>Acesso *:</label><select id="func-nivel"><option>administrador</option><option>supervisor</option><option>analista</option><option>executor</option></select></div><div class="form-group col-4"><label>Cargo *:</label><select id="func-cargo"><option>analista pleno</option><option>analista senior</option><option>analista junior</option><option>detalhista plano</option><option>detalhista senior</option><option>detalhista junior</option><option>estagiário plemo</option><option>estagiário senior</option><option>estagiário júnior</option></select></div><div class="form-group col-2"><label>Valor Hora:</label><input type="text" id="func-hora"></div><div class="form-group col-3"><label>Início:</label><input type="text" id="func-dt-inicio" class="input-data-mask"></div><div class="form-group col-3"><label>Desligamento:</label><input type="text" id="func-dt-desligamento" class="input-data-mask"></div></div></div><div class="form-section"><div class="form-section-title">2. Dados Pessoais</div><div class="form-grid"><div class="form-group col-3"><label>Nascimento:</label><input type="text" id="func-dt-nascimento" class="input-data-mask"></div><div class="form-group col-6"><label>Endereço:</label><input type="text" id="func-endereco"></div><div class="form-group col-3"><label>Telefone:</label><input type="text" id="func-telefone"></div><div class="form-group col-6"><label>E-mail:</label><input type="text" id="func-email"></div><div class="form-group col-6"><label>Senha:</label><input type="password" id="func-senha"></div></div></div><div class="form-footer"><button class="btn-secondary" onclick="fecharFormulario('funcionarios')">Voltar</button><button class="btn-success" onclick="salvarFuncionario()">Salvar</button></div></div>
    </div>

    <div id="panel-projetos-lista" class="content-panel">
        <div class="search-container"><input type="text" class="search-input" id="search-projetos" placeholder="🔍 Pesquisar por Obra, Prefixo ou Cliente..." oninput="filtrarTabela('projetos')"></div>
        <div class="table-wrapper"><table><thead><tr><th style="width: 140px;">Prefixo</th><th>Nome da Obra</th><th>Cliente</th><th>Valor Contrato</th><th style="text-align: center; width: 80px;">Ações</th></tr></thead><tbody id="tabela-projetos-body"></tbody></table></div>
        <div class="footer-actions"><button class="btn-primary" onclick="abrirFormulario('projetos', true)">+ Incluir Novo Projeto</button><div class="action-group-right"><label class="file-import-label">⬇️ Importar Planilha <input type="file" class="input-file-hidden" onchange="detectarEImportarPlanilha(this, 'projetos')"></label><button class="btn-excel" onclick="exportarPlanilhaElaborada('projetos')">⬆️ Exportar Planilha</button></div></div>
    </div>
    <div id="panel-projetos-form" class="content-panel">
        <div class="form-panel"><input type="hidden" id="proj-index"><div class="form-section"><div class="form-section-title">1. Dados Estruturais</div><div class="form-grid"><div class="form-group col-6"><label>Nome Obra *:</label><input type="text" id="proj-nome"></div><div class="form-group col-3"><label>Prefixo:</label><input type="text" id="proj-prefixo"></div><div class="form-group col-3"><label>Cliente *:</label><select id="proj-cliente"></select></div><div class="form-group col-12" style="margin-top:10px;"><label>Endereço:</label><input type="text" id="proj-endereco"></div><div class="form-group col-3" style="margin-top:10px;"><label>Área:</label><input type="text" id="proj-area"></div><div class="form-group col-3" style="margin-top:10px;"><label>Pavimentos:</label><input type="text" id="proj-pavimentos"></div><div class="form-group col-3" style="margin-top:10px;"><label>Altura:</label><input type="text" id="proj-altura"></div><div class="form-group col-3" style="margin-top:10px;"><label>Esbeltez:</label><input type="text" id="proj-esbeltez"></div></div></div><div class="form-section"><div class="form-section-title">2. Gerenciamento</div><div class="form-grid"><div class="form-group col-3"><label>Dificuldade:</label><input type="text" id="proj-dificuldade"></div><div class="form-group col-3"><label>Valor:</label><input type="text" id="proj-valor"></div><div class="form-group col-3"><label>Pagamento *:</label><select id="proj-pagamento"><option>Por entrega</option><option>Mensal</option><option>Permuta</option><option>Permuta e mensal</option><option>Permuta e entrega</option></select></div><div class="form-group col-3"><label>Início:</label><input type="text" id="proj-dt-inicio" class="input-data-mask"></div><div class="form-group col-6"><label>Analista:</label><select id="proj-analista"></select></div><div class="form-group col-6"><label>Supervisor:</label><select id="proj-supervisor"></select></div></div></div><div class="form-footer"><button class="btn-secondary" onclick="fecharFormulario('projetos')">Voltar</button><button class="btn-success" onclick="salvarProjeto()">Salvar</button></div></div>
    </div>

    ${['fases', 'etapas', 'subetapas', 'tarefas'].map(m => `
        <div id="panel-${m}-lista" class="content-panel">
            <div class="search-container"><input type="text" class="search-input" id="search-${m}" placeholder="🔍 Pesquisar..." oninput="filtrarTabela('${m}')"></div>
            <div class="table-wrapper"><table><thead><tr><th style="width: 120px;">ID Peça</th><th>Nome Cadastrado Geral (Padrão Global)</th><th style="text-align: center; width: 100px;">Ações</th></tr></thead><tbody id="tabela-${m}-body"></tbody></table></div>
            <div class="footer-actions"><button class="btn-primary" onclick="abrirFormulario('${m}', true)">+ Fabricar Componente</button><div class="action-group-right"><label class="file-import-label">⬇️ Importar Planilha <input type="file" class="input-file-hidden" onchange="detectarEImportarPlanilha(this, '${m}')"></label><button class="btn-excel" onclick="exportarPlanilhaElaborada('${m}')">⬆️ Exportar Planilha</button></div></div>
        </div>
        <div id="panel-${m}-form" class="content-panel">
            <div class="form-panel"><input type="hidden" id="${m}-index"><div class="form-section"><div class="form-section-title">Almoxarifado Global Lego</div><div class="form-grid"><div class="form-group col-12"><label>Nome Oficial do Componente *:</label><input type="text" id="${m}-nome"></div></div></div><div class="form-footer"><button class="btn-secondary" onclick="fecharFormulario('${m}')">Cancelar</button><button class="btn-success" onclick="salvarLego('${m}')">Gravar no Catálogo</button></div></div>
        </div>
    `).join('')}
`;

// --- BANCOS DE DADOS DE TESTE INICIAIS ---
const empresasIniciais = [{ nome: "Pasqualotto & GT Empreendimentos", cnpj: "17.234.567/0001-80", logradouro: "Av. Atlântica, nº 4000", cidade: "Balneário Camboriú - SC", contato: "Eng. Lindomar Pasqualotto", whatsapp: "(47) 3361-0000", email: "engenharia@pasqualottoegt.com.br" }];
const funcionariosIniciais = [{ nome: "Carlos Eduardo Souza", cpf: "111.222.333-44", nivel: "analista", cargo: "analista senior", hora: "75.00", dt_inicio: "15/01/2024", dt_desligamento: "", dt_nascimento: "22/08/1988", endereco: "Rua das Palmeiras, 150 - Centro", telefone: "47988885566", email: "carlos.estrutura@precisao.com", senha: "123" }];
const projetosIniciais = [{ nome: "Residencial Excellence", prefixo: "PRJ-2026-01", cliente: "Pasqualotto & GT Empreendimentos", endereco: "Av. Atlântica", area: "2450.00", pavimentos: "18", altura: "54.00", esbeltez: "4.2", dificuldade: "Alto", valor: "145000", pagamento: "Por entrega", dt_inicio: "01/03/2026", analista: "Carlos Eduardo Souza", supervisor: "Carlos Eduardo Souza" }];
const fasesLegoIniciais = [{ nome: "Contratação" }, { nome: "Análise" }, { nome: "Detalhamento" }, { nome: "Revisão" }, { nome: "Supervisão" }];
const etapasLegoIniciais = [{ nome: "Pavimento Térreo" }, { nome: "Garagem G1" }, { nome: "Tipo Padrão" }];
const subEtapasLegoIniciais = [{ nome: "Fôrmas e Escoramentos" }, { nome: "Armação de Lajes" }, { nome: "Lançamento de Concreto" }];
const tarefasLegoIniciais = [{ nome: "Desenho de Forma" }, { nome: "Detalhamento de lajes" }, { nome: "Detalhamento de vigas" }];

if (!localStorage.getItem('banco_clientes')) localStorage.setItem('banco_clientes', JSON.stringify(empresasIniciais));
if (!localStorage.getItem('banco_funcionarios')) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionariosIniciais));
if (!localStorage.getItem('banco_projetos')) localStorage.setItem('banco_projetos', JSON.stringify(projetosIniciais));
if (!localStorage.getItem('banco_fases_lego')) localStorage.setItem('banco_fases_lego', JSON.stringify(fasesLegoIniciais));
if (!localStorage.getItem('banco_etapas_lego')) localStorage.setItem('banco_etapas_lego', JSON.stringify(etapasLegoIniciais));
if (!localStorage.getItem('banco_subetapas_lego')) localStorage.setItem('banco_subetapas_lego', JSON.stringify(subEtapasLegoIniciais));
if (!localStorage.getItem('banco_tarefas_lego')) localStorage.setItem('banco_tarefas_lego', JSON.stringify(tarefasLegoIniciais));

// --- MÁSCARAS E EVENTOS ---
function aplicarMascarasLocais() {
    const cpfInput = document.getElementById('func-cpf');
    if(cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g,""); if (v.length > 11) v = v.substring(0, 11);
            v = v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
            e.target.value = v;
        });
    }
    const telInput = document.getElementById('func-telefone');
    if(telInput) telInput.addEventListener('input', function(e) { e.target.value = formatarNumeroTelefone(e.target.value); });
    document.querySelectorAll('.input-data-mask').forEach(i => { i.addEventListener('input', function(e) { e.target.value = formatarDataSlashes(e.target.value); }); });
}

// --- FUNÇÕES DE CONTROLE DE INTERFACE ---
function alternarModulo(modulo) {
    document.getElementById('panel-blank-state').style.display = 'none';
    document.querySelectorAll('.submenu .menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    
    const titulos = { 'clientes': 'Gestão de Clientes', 'funcionarios': 'Gestão de Funcionários', 'projetos': 'Gestão de Projetos de Engenharia', 'fases': 'Fábrica Lego: Catálogo de Fases', 'etapas': 'Fábrica Lego: Catálogo de Etapas', 'subetapas': 'Fábrica Lego: Catálogo de Sub-etapas', 'tarefas': 'Fábrica Lego: Catálogo de Tarefas' };
    document.getElementById('page-context-title').innerText = 'Contexto: ' + titulos[modulo];
    document.getElementById('browser-tab-title').innerText = 'Precisão Estrutural - ' + modulo.charAt(0).toUpperCase() + modulo.slice(1);
    document.getElementById(`nav-${modulo}`).classList.add('active');

    if (modulo === 'clientes') { document.getElementById('panel-clientes-lista').style.display = 'flex'; renderizarTabelaClientes(); }
    else if (modulo === 'funcionarios') { document.getElementById('panel-funcionarios-lista').style.display = 'flex'; renderizarTabelaFuncionarios(); }
    else if (modulo === 'projetos') { document.getElementById('panel-projetos-lista').style.display = 'flex'; renderizarTabelaProjetos(); }
    else { document.getElementById(`panel-${modulo}-lista`).style.display = 'flex'; renderizarLego(modulo); }
    aplicarMascarasLocais();
}

function abrirFormulario(modulo, isNovo = false) {
    document.getElementById(`panel-${modulo}-lista`).style.display = 'none';
    document.getElementById(`panel-${modulo}-form`).style.display = 'flex';
    if(isNovo) {
        document.getElementById('page-context-title').innerText = `Inserir Novo Registro`;
        if (modulo === 'fases' || modulo === 'etapas' || modulo === 'subetapas' || modulo === 'tarefas') {
            document.getElementById(`${modulo}-index`).value = ""; document.getElementById(`${modulo}-nome`).value = "";
        } else {
            if(modulo === 'clientes') { document.getElementById('cli-index').value = ""; document.getElementById('cli-nome').value = ""; document.getElementById('cli-cnpj').value = ""; document.getElementById('cli-logradouro').value = ""; document.getElementById('cli-cidade').value = ""; document.getElementById('cli-contato').value = ""; document.getElementById('cli-whatsapp').value = ""; document.getElementById('cli-email').value = ""; }
            if(modulo === 'funcionarios') { document.getElementById('func-index').value = ""; document.getElementById('func-nome').value = ""; document.getElementById('func-cpf').value = ""; document.getElementById('func-nivel').value = "administrador"; document.getElementById('func-cargo').value = "analista pleno"; document.getElementById('func-hora').value = ""; document.getElementById('func-dt-inicio').value = ""; document.getElementById('func-dt-desligamento').value = ""; document.getElementById('func-dt-nascimento').value = ""; document.getElementById('func-endereco').value = ""; document.getElementById('func-telefone').value = ""; document.getElementById('func-email').value = ""; document.getElementById('func-senha').value = ""; }
            if(modulo === 'projetos') { alimentarDropdownsProjeto(); document.getElementById('proj-index').value = ""; document.getElementById('proj-nome').value = ""; document.getElementById('proj-prefixo').value = ""; document.getElementById('proj-cliente').value = ""; document.getElementById('proj-endereco').value = ""; document.getElementById('proj-area').value = ""; document.getElementById('proj-pavimentos').value = ""; document.getElementById('proj-altura').value = ""; document.getElementById('proj-esbeltez').value = ""; document.getElementById('proj-dificuldade').value = "Baixo"; document.getElementById('proj-valor').value = ""; document.getElementById('proj-pagamento').value = "Por entrega"; document.getElementById('proj-dt-inicio').value = ""; document.getElementById('proj-analista').value = ""; document.getElementById('proj-supervisor').value = ""; }
        }
    }
}

function fecharFormulario(modulo) { document.getElementById(`panel-${modulo}-form`).style.display = 'none'; document.getElementById(`panel-${modulo}-lista`).style.display = 'flex'; alternarModulo(modulo); }

// --- LÓGICA DE NEGÓCIO DE CLIENTES ---
function renderizarTabelaClientes() { 
    let c = JSON.parse(localStorage.getItem('banco_clientes')) || []; c.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-clientes-body'); t.innerHTML = ''; 
    c.forEach((cli, idx) => { t.innerHTML += `<tr class="clickable-row" onclick="carregarClienteParaEdicao(${idx})"><td>C-${String(idx+1).padStart(3,'0')}</td><td><strong>${cli.nome}</strong></td><td>${cli.cnpj}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarCliente(${idx})">🗑️</button></td></tr>`; });
}
function salvarCliente() {
    const i = document.getElementById('cli-index').value; const n = document.getElementById('cli-nome').value; if (!n.trim()) return alert("Obrigatório");
    const nv = { nome: n, cnpj: document.getElementById('cli-cnpj').value, logradouro: document.getElementById('cli-logradouro').value, city: document.getElementById('cli-cidade').value, contato: document.getElementById('cli-contato').value, whatsapp: document.getElementById('cli-whatsapp').value, email: document.getElementById('cli-email').value };
    let l = JSON.parse(localStorage.getItem('banco_clientes')); if (i === "") l.push(nv); else l[i] = nv;
    localStorage.setItem('banco_clientes', JSON.stringify(l)); fecharFormulario('clientes');
}
function carregarClienteParaEdicao(index) { const c = (JSON.parse(localStorage.getItem('banco_clientes')))[index]; abrirFormulario('clientes', false); document.getElementById('cli-index').value = index; document.getElementById('cli-nome').value = c.nome; document.getElementById('cli-cnpj').value = c.cnpj; document.getElementById('cli-logradouro').value = c.logradouro; document.getElementById('cli-cidade').value = c.cidade || c.city || ""; document.getElementById('cli-contato').value = c.contato; document.getElementById('cli-whatsapp').value = c.whatsapp; document.getElementById('cli-email').value = c.email; }
function deletarCliente(index) { if (confirm("Remover?")) { let l = JSON.parse(localStorage.getItem('banco_clientes')); l.splice(index,1); localStorage.setItem('banco_clientes', JSON.stringify(l)); renderizarTabelaClientes(); } }

// --- LÓGICA DE NEGÓCIO DE FUNCIONÁRIOS ---
function renderizarTabelaFuncionarios() { 
    let f = JSON.parse(localStorage.getItem('banco_funcionarios')) || []; f.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-funcionarios-body'); t.innerHTML = ''; 
    f.forEach((func, idx) => { t.innerHTML += `<tr class="clickable-row" onclick="carregarFuncionarioParaEdicao(${idx})"><td>${func.cpf}</td><td><strong>${func.nome}</strong></td><td>${func.cargo}</td><td>${func.nivel}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarFuncionario(${idx})">🗑️</button></td></tr>`; });
}
function salvarFuncionario() {
    const i = document.getElementById('func-index').value; const n = document.getElementById('func-nome').value; const c = document.getElementById('func-cpf').value;
    if (!n.trim() || !c.trim() || !validarCPF(c)) return alert("CPF ou Nome inválido!");
    const nv = { nome: n, cpf: c, nivel: document.getElementById('func-nivel').value, cargo: document.getElementById('func-cargo').value, hora: document.getElementById('func-hora').value, dt_inicio: document.getElementById('func-dt-inicio').value, dt_desligamento: document.getElementById('func-dt-desligamento').value, dt_nascimento: document.getElementById('func-dt-nascimento').value, endereco: document.getElementById('func-endereco').value, telefone: document.getElementById('func-telefone').value, email: document.getElementById('func-email').value, senha: document.getElementById('func-senha').value };
    let l = JSON.parse(localStorage.getItem('banco_funcionarios')); if (i === "") l.push(nv); else l[i] = nv;
    localStorage.setItem('banco_funcionarios', JSON.stringify(l)); fecharFormulario('funcionarios');
}
function carregarFuncionarioParaEdicao(index) { const f = (JSON.parse(localStorage.getItem('banco_funcionarios')))[index]; abrirFormulario('funcionarios', false); document.getElementById('func-index').value = index; document.getElementById('func-nome').value = f.nome; document.getElementById('func-cpf').value = f.cpf; document.getElementById('func-nivel').value = f.nivel; document.getElementById('func-cargo').value = f.cargo; document.getElementById('func-hora').value = f.hora; document.getElementById('func-dt-inicio').value = f.dt_inicio; document.getElementById('func-dt-desligamento').value = f.dt_desligamento; document.getElementById('func-dt-nascimento').value = f.dt_nascimento; document.getElementById('func-endereco').value = f.endereco; document.getElementById('func-telefone').value = formatarNumeroTelefone(f.telefone); document.getElementById('func-email').value = f.email; document.getElementById('func-senha').value = f.senha; }
function deletarFuncionario(index) { if (confirm("Remover?")) { let l = JSON.parse(localStorage.getItem('banco_funcionarios')); l.splice(index,1); localStorage.setItem('banco_funcionarios', JSON.stringify(l)); renderizarTabelaFuncionarios(); } }

// --- LÓGICA DE NEGÓCIO DE PROJETOS ---
function renderizarTabelaProjetos() { 
    let p = JSON.parse(localStorage.getItem('banco_projetos')) || []; p.sort((a, b) => a.nome.localeCompare(b.nome));
    const t = document.getElementById('tabela-projetos-body'); t.innerHTML = ''; 
    p.forEach((proj, idx) => { t.innerHTML += `<tr class="clickable-row" onclick="carregarProjetoParaEdicao(${idx})"><td><strong>${proj.prefixo || '---'}</strong></td><td>${proj.nome}</td><td>${proj.cliente}</td><td>R$ ${parseFloat(proj.valor).toLocaleString('pt-BR')}</td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarProjeto(${idx})">🗑️</button></td></tr>`; });
}
function alimentarDropdownsProjeto() {
    const cl = JSON.parse(localStorage.getItem('banco_clientes')) || []; const fu = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const dc = document.getElementById('proj-cliente'); const da = document.getElementById('proj-analista'); const ds = document.getElementById('proj-supervisor');
    dc.innerHTML = '<option value="">-- Selecione o Cliente --</option>'; cl.forEach(c => dc.innerHTML += `<option value="${c.nome}">${c.nome}</option>`);
    da.innerHTML = '<option value="">-- Selecione --</option>'; ds.innerHTML = '<option value="">-- Selecione --</option>';
    fu.forEach(f => { da.innerHTML += `<option value="${f.nome}">${f.nome}</option>`; ds.innerHTML += `<option value="${f.nome}">${f.nome}</option>`; });
}
function salvarProjeto() {
    const i = document.getElementById('proj-index').value; const n = document.getElementById('proj-nome').value; const c = document.getElementById('proj-cliente').value; if (!n.trim() || !c) return alert("Campos obrigatórios!");
    const nv = { nome: n, prefixo: document.getElementById('proj-prefixo').value, cliente: c, endereco: document.getElementById('proj-endereco').value, area: document.getElementById('proj-area').value, pavimentos: document.getElementById('proj-pavimentos').value, altura: document.getElementById('proj-altura').value, esbeltez: document.getElementById('proj-esbeltez').value, dificuldade: document.getElementById('proj-dificuldade').value, valor: document.getElementById('proj-valor').value, pagamento: document.getElementById('proj-pagamento').value, dt_inicio: document.getElementById('proj-dt-inicio').value, analista: document.getElementById('proj-analista').value, supervisor: document.getElementById('proj-supervisor').value };
    let l = JSON.parse(localStorage.getItem('banco_projetos')); if (i === "") l.push(nv); else l[i] = nv;
    localStorage.setItem('banco_projetos', JSON.stringify(l)); fecharFormulario('projetos');
}
function carregarProjetoParaEdicao(index) { alimentarDropdownsProjeto(); const p = (JSON.parse(localStorage.getItem('banco_projetos')))[index]; abrirFormulario('projetos', false); document.getElementById('proj-index').value = index; document.getElementById('proj-nome').value = p.nome; document.getElementById('proj-prefixo').value = p.prefixo; document.getElementById('proj-cliente').value = p.cliente; document.getElementById('proj-endereco').value = p.endereco; document.getElementById('proj-area').value = p.area; document.getElementById('proj-pavimentos').value = p.pavimentos; document.getElementById('proj-altura').value = p.altura; document.getElementById('proj-esbeltez').value = p.esbeltez; document.getElementById('proj-dificuldade').value = p.dificuldade; document.getElementById('proj-valor').value = p.valor; document.getElementById('proj-pagamento').value = p.pagamento; document.getElementById('proj-dt-inicio').value = p.dt_inicio; document.getElementById('proj-analista').value = p.analista; document.getElementById('proj-supervisor').value = p.supervisor; }
function deletarProjeto(index) { if (confirm("Remover?")) { let l = JSON.parse(localStorage.getItem('banco_projetos')); l.splice(index,1); localStorage.setItem('banco_projetos', JSON.stringify(l)); renderizarTabelaProjetos(); } }

// --- LÓGICA OPERACIONAL DE PEÇAS LEGO ---
function renderizarLego(modulo) {
    let itens = JSON.parse(localStorage.getItem(`banco_${modulo}_lego`)) || []; itens.sort((a, b) => a.nome.localeCompare(b.nome));
    localStorage.setItem(`banco_${modulo}_lego`, JSON.stringify(itens));
    const tbody = document.getElementById(`tabela-${modulo}-body`); tbody.innerHTML = '';
    const prefixes = { 'fases': 'FAS', 'etapas': 'ETP', 'subetapas': 'SUB', 'tarefas': 'TAR' };
    itens.forEach((item, index) => { tbody.innerHTML += `<tr class="clickable-row" onclick="carregarLegoParaEdicao('${modulo}', ${index})"><td><strong>${prefixes[modulo]}-${String(index+1).padStart(3,'0')}</strong></td><td><strong>${item.nome}</strong></td><td style="text-align: center;" onclick="event.stopPropagation();"><button class="btn-delete" onclick="deletarLego('${modulo}', ${index})">🗑️</button></td></tr>`; });
}
function salvarLego(modulo) {
    const index = document.getElementById(`${modulo}-index`).value; const nome = document.getElementById(`${modulo}-nome`).value; if (!nome.trim()) return alert("Nome é obrigatório!");
    let lista = JSON.parse(localStorage.getItem(`banco_${modulo}_lego`)) || []; const novo = { nome: nome.trim() };
    if (index === "") lista.push(novo); else lista[index] = novo;
    localStorage.setItem(`banco_${modulo}_lego`, JSON.stringify(lista)); fecharFormulario(modulo);
}
function carregarLegoParaEdicao(modulo, index) { const lista = JSON.parse(localStorage.getItem(`banco_${modulo}_lego`)); abrirFormulario(modulo, false); document.getElementById(`${modulo}-index`).value = index; document.getElementById(`${modulo}-nome`).value = lista[index].nome; }
...