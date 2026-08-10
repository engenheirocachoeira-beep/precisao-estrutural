// =========================================================================
// MÓDULO: MONTAGEM DE ÁRVORE DE PROJETOS (ESTILO EBERICK)
// =========================================================================

// 1. Injeção da Interface no Chassi Central do Sistema
// Criamos um layout de duas colunas (Split Panel): Esquerda (Árvore) e Direita (Propriedades/Ações)
document.getElementById('container-paineis-dinamicos').innerHTML += `
    <div id="panel-arvore-projetos" class="content-panel" style="flex-direction: row; gap: 20px; height: 100%; overflow: hidden;">
        
        <div style="width: 380px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden;">
            <div style="background: #0f223f; color: white; padding: 12px 16px; font-size: 13px; font-weight: 600; border-bottom: 2px solid #00b4d8;">
                🏗️ Árvore Estrutural do Projeto
            </div>
            
            <div style="padding: 12px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                <label style="font-size: 10px; color: #64748b; font-weight: 700;">SELECIONE O PROJETO ATIVO:</label>
                <select id="arvore-projeto-seletor" style="margin-top: 4px; background: #ffffff;" onchange="carregarArvoreProjetoAtual()">
                    </select>
            </div>
            
            <div id="corpo-arvore-eberick" style="flex: 1; overflow-y: auto; padding: 16px; font-size: 13px; color: #334155;">
                </div>
        </div>

        <div id="painel-propriedades-lego" style="flex: 1; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; padding: 24px; display: flex; flex-direction: column; overflow-y: auto;">
            <div class="workspace-blank" style="justify-content: center; align-items: center; height: 100%;">
                <div class="workspace-blank-icon">📐</div>
                <h3>Inspetor de Elementos (Estilo Eberick)</h3>
                <p style="font-size: 12px; color: #94a3b8; max-width: 400px; text-align: center; margin-top: 6px;">
                    Selecione um nó ou clique nos botões de controle estruturais na árvore para plugar novas fases, etapas e tarefas técnicas ao projeto.
                </p>
            </div>
        </div>

    </div>
`;

// Adicionar o novo botão de menu de forma dinâmica no menu lateral do Chassi
const menuLateral = document.querySelector('.submenu');
if (menuLateral) {
    menuLateral.innerHTML += `<div id="nav-arvore" class="menu-item" onclick="alternarModulo('arvore')">🌳 Montagem Estrutural (Eberick)</div>`;
}

// 2. Estrutura de Dados da Árvore de Projetos no LocalStorage
// Chave: 'banco_arvores_projetos' -> Guarda um dicionário mapeado por Prefixo/Nome do projeto
if (!localStorage.getItem('banco_arvores_projetos')) {
    localStorage.setItem('banco_arvores_projetos', JSON.stringify({}));
}

// 3. Controlador de Navegação e Carga de Tela
function inicializarModuloArvore() {
    const seletor = document.getElementById('arvore-projeto-seletor');
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    
    seletor.innerHTML = '<option value="">-- Escolha um Projeto para Montar --</option>';
    projetos.forEach(p => {
        seletor.innerHTML += `<option value="${p.nome}">${p.prefixo || 'PRJ'} - ${p.nome}</option>`;
    });

    // Atualiza os títulos no contexto global do Chassi
    document.getElementById('page-context-title').innerText = "Contexto: Engenharia e Montagem de Árvore";
    document.getElementById('browser-tab-title').innerText = "Precisão Estrutural - Árvore Eberick";
    
    carregarArvoreProjetoAtual();
}

// 4. Renderizador da Árvore Hierárquica Estilo Eberick
function carregarArvoreProjetoAtual() {
    const projetoNome = document.getElementById('arvore-projeto-seletor').value;
    const corpo = document.getElementById('corpo-arvore-eberick');
    const painelDireito = document.getElementById('painel-propriedades-lego');

    // Reseta painel direito
    painelDireito.innerHTML = `
        <div class="workspace-blank" style="justify-content: center; align-items: center; height: 100%;">
            <div class="workspace-blank-icon">📐</div>
            <h3>Inspetor de Elementos</h3>
            <p style="font-size: 12px; color: #94a3b8;">Selecione um componente para ver suas propriedades ou adicionar sub-elementos.</p>
        </div>
    `;

    if (!projetoNome) {
        corpo.innerHTML = `<div style="color: #94a3b8; text-align: center; margin-top: 40px; font-style: italic;">Selecione um projeto acima...</div>`;
        return;
    }

    const todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    // Se não existir árvore para o projeto, inicializa vazia
    if (!todasArvores[projetoNome]) {
        todasArvores[projetoNome] = { nome: projetoNome, fases: [] };
        localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
    }

    const arvoreProjeto = todasArvores[projetoNome];

    // Desenha o Nó Raiz (O Arquivo de Projeto .EBK do Eberick)
    let htmlArvore = `
        <div style="font-weight: bold; color: #0a192f; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; padding: 4px; border-radius: 4px; background: #e0f2fe;">
            <span>📋</span> <span style="cursor: pointer;" onclick="abrirFormularioEncaixe('fase', null)">${arvoreProjeto.nome.toUpperCase()}</span>
            <button style="margin-left: auto; background: #00b4d8; color: white; border: none; font-size: 10px; padding: 2px 6px; border-radius: 3px; cursor: pointer;" onclick="abrirFormularioEncaixe('fase', null)">+ Fase</button>
        </div>
        <div style="border-left: 1px dashed #cbd5e1; margin-left: 8px; padding-left: 4px;">
    `;

    // Varre as Fases (Nível 1)
    arvoreProjeto.fases.forEach((fase, fIdx) => {
        htmlArvore += `
            <div style="margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px; padding: 4px; border-radius: 4px; transition: background 0.2s; cursor: pointer;" class="clickable-row">
                    <span style="color: #eab308;">📁</span>
                    <span style="font-weight: 600;" onclick="visualizarElemento('fase', '${fIdx}')">${fase.nome} <small style="color: #64748b; font-weight: normal;">(${fase.verba || 0}%)</small></span>
                    <button style="margin-left: auto; background: #10b981; color: white; border: none; font-size: 10px; padding: 1px 4px; border-radius: 3px; cursor: pointer;" onclick="abrirFormularioEncaixe('etapa', ${fIdx})">+ Etp</button>
                </div>
                <div style="border-left: 1px dashed #cbd5e1; margin-left: 12px; padding-left: 8px;">
        `;

        // Varre as Etapas (Nível 2)
        if (fase.etapas) {
            fase.etapas.forEach((etapa, eIdx) => {
                htmlArvore += `
                    <div style="margin-top: 4px;">
                        <div style="display: flex; align-items: center; gap: 6px; padding: 3px; border-radius: 4px;" class="clickable-row">
                            <span style="color: #3b82f6;">📐</span>
                            <span onclick="visualizarElemento('etapa', '${fIdx}-${eIdx}')">${etapa.nome}</span>
                            <button style="margin-left: auto; background: #64748b; color: white; border: none; font-size: 9px; padding: 1px 4px; border-radius: 3px; cursor: pointer;" onclick="abrirFormularioEncaixe('subetapa', '${fIdx}-${eIdx}')">+ Sub</button>
                        </div>
                        <div style="border-left: 1px dashed #cbd5e1; margin-left: 12px; padding-left: 8px;">
                `;

                // Varre as Sub-etapas (Nível 3)
                if (etapa.subetapas) {
                    etapa.subetapas.forEach((sub, sIdx) => {
                        htmlArvore += `
                            <div style="margin-top: 4px;">
                                <div style="display: flex; align-items: center; gap: 6px; padding: 2px; border-radius: 4px;" class="clickable-row">
                                    <span style="color: #a855f7;">🧮</span>
                                    <span onclick="visualizarElemento('subetapa', '${fIdx}-${eIdx}-${sIdx}')">${sub.nome}</span>
                                    <button style="margin-left: auto; background: #475569; color: white; border: none; font-size: 9px; padding: 1px 4px; border-radius: 3px; cursor: pointer;" onclick="abrirFormularioEncaixe('tarefa', '${fIdx}-${eIdx}-${sIdx}')">+ Tar</button>
                                </div>
                                <div style="border-left: 1px dashed #cbd5e1; margin-left: 12px; padding-left: 8px;">
                        `;

                        // Varre as Tarefas (Nível 4 - Folha Final)
                        if (sub.tarefas) {
                            sub.tarefas.forEach((tarefa, tIdx) => {
                                htmlArvore += `
                                    <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px; padding: 2px; border-radius: 4px;" class="clickable-row">
                                        <span style="color: #64748b;">⚙️</span>
                                        <span style="font-size: 12px;" onclick="visualizarElemento('tarefa', '${fIdx}-${eIdx}-${sIdx}-${tIdx}')">${tarefa.nome} <small style="color: #00b4d8;">[${tarefa.analista || 'Sem Alocação'}]</small></span>
                                    </div>
                                `;
                            });
                        }

                        htmlArvore += `</div></div>`; // Fecha Sub-etapa
                    });
                }

                htmlArvore += `</div></div>`; // Fecha Etapa
            });
        }

        htmlArvore += `</div></div>`; // Fecha Fase
    });

    htmlArvore += `</div>`; // Fecha Raiz do Projeto
    corpo.innerHTML = htmlArvore;
}

// 5. Controlador Contextual do Painel Direito (O Encaixe de Peças)
function abrirFormularioEncaixe(tipoLego, indexPai) {
    const painelDireito = document.getElementById('painel-propriedades-lego');
    const catalogos = { 'fase': 'fases', 'etapa': 'etapas', 'subetapa': 'subetapas', 'tarefa': 'tarefas' };
    
    // Busca as peças oficiais fabricadas pelo Administrador no Almoxarifado Geral Lego
    const pecasDisponiveis = JSON.parse(localStorage.getItem(`banco_${catalogos[tipoLego]}_lego`)) || [];
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];

    if (pecasDisponiveis.length === 0) {
        alert(`Atenção: Não existem peças de [${tipoLego.toUpperCase()}] fabricadas no Almoxarifado Lego. Vá ao menu de cadastros e fabrique as peças primeiro!`);
        return;
    }

    let formHtml = `
        <div class="form-section">
            <div class="form-section-title">Encaixar Nova Peça: ${tipoLego.toUpperCase()}</div>
            <input type="hidden" id="lego-tipo-alvo" value="${tipoLego}">
            <input type="hidden" id="lego-pai-index" value="${indexPai}">
            
            <div class="form-grid" style="margin-top: 14px;">
                <div class="form-group col-12">
                    <label>Escolha a Peça no Catálogo Geral (Lego):</label>
                    <select id="lego-nome-selecionado" style="background: #ffffff;">
                        ${pecasDisponiveis.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('')}
                    </select>
                </div>
    `;

    // Campos adicionais dependendo da hierarquia (Estilo Eberick)
    if (tipoLego === 'fase') {
        formHtml += `
            <div class="form-group col-12" style="margin-top: 14px;">
                <label>Verba / Peso Comercial da Fase (% do Contrato):</label>
                <input type="number" id="lego-verba" value="0" min="0" max="100">
            </div>
        `;
    } else if (tipoLego === 'tarefa') {
        formHtml += `
            <div class="form-group col-12" style="margin-top: 14px;">
                <label>Analista Técnico Responsável (Alocação):</label>
                <select id="lego-analista" style="background: #ffffff;">
                    <option value="">-- Selecione o Analista --</option>
                    ${funcionarios.map(f => `<option value="${f.nome}">${f.nome} (${f.cargo})</option>`).join('')}
                </select>
            </div>
        `;
    }

    formHtml += `
            </div>
        </div>
        <div style="margin-top: auto; display: flex; gap: 10px; padding-top: 20px;">
            <button class="btn-success" style="width: 100%;" onclick="gravarPecaNaArvore()">Plugar Peça na Estrutura</button>
        </div>
    `;

    painelDireito.innerHTML = formHtml;
}

// 6. Persistência Estrutural da Árvore
function gravarPecaNaArvore() {
    const projetoNome = document.getElementById('arvore-projeto-seletor').value;
    const tipo = document.getElementById('lego-tipo-alvo').value;
    const paiIndex = document.getElementById('lego-pai-index').value;
    const nomePeca = document.getElementById('lego-nome-selecionado').value;

    let todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
    let projetoObj = todasArvores[projetoNome];

    if (tipo === 'fase') {
        const verba = document.getElementById('lego-verba').value;
        projetoObj.fases.push({ nome: nomePeca, verba: verba, etapas: [] });
    } else if (tipo === 'etapa') {
        projetoObj.fases[paiIndex].etapas.push({ nome: nomePeca, subetapas: [] });
    } else if (tipo === 'subetapa') {
        const partes = paiIndex.split('-'); // fIdx-eIdx
        projetoObj.fases[partes[0]].etapas[partes[1]].subetapas.push({ nome: nomePeca, tarefas: [] });
    } else if (tipo === 'tarefa') {
        const partes = paiIndex.split('-'); // fIdx-eIdx-sIdx
        const analista = document.getElementById('lego-analista').value;
        projetoObj.fases[partes[0]].etapas[partes[1]].subetapas[partes[2]].tarefas.push({ nome: nomePeca, analista: analista });
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
    alert("Peça encaixada com sucesso na árvore estrutural!");
    carregarArvoreProjetoAtual();
}

// 7. Visualizador Detalhado de Propriedades do Nó Selecionado
function visualizarElemento(tipo, path) {
    const painelDireito = document.getElementById('painel-propriedades-lego');
    const projetoNome = document.getElementById('arvore-projeto-seletor').value;
    const todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
    const projetoObj = todasArvores[projetoNome];
    
    let item = {};
    const partes = path.split('-');

    if (tipo === 'fase') item = projetoObj.fases[partes[0]];
    else if (tipo === 'etapa') item = projetoObj.fases[partes[0]].etapas[partes[1]];
    else if (tipo === 'subetapa') item = projetoObj.fases[partes[0]].etapas[partes[1]].subetapas[partes[2]];
    else if (tipo === 'tarefa') item = projetoObj.fases[partes[0]].etapas[partes[1]].subetapas[partes[2]].tarefas[partes[3]];

    let htmlView = `
        <div class="form-panel" style="border: none; padding: 0;">
            <div class="form-section">
                <div class="form-section-title">ℹ️ Propriedades do Componente</div>
                <div style="margin-top: 14px; font-size: 13px;">
                    <p style="margin-bottom: 8px;"><strong>Nível Hierárquico:</strong> ${tipo.toUpperCase()}</p>
                    <p style="margin-bottom: 8px;"><strong>Nome Técnico:</strong> ${item.nome}</p>
    `;

    if (tipo === 'fase') htmlView += `<p style="margin-bottom: 8px;"><strong>Peso Orçamentário:</strong> ${item.verba || 0}% do valor global</p>`;
    if (tipo === 'tarefa') htmlView += `<p style="margin-bottom: 8px;"><strong>Responsável Alocado:</strong> 👤 ${item.analista || 'Nenhum analista definido'}</p>`;

    htmlView += `
                </div>
            </div>
            <div style="margin-top: auto; padding-top: 20px;">
                <button class="btn-secondary" style="width: 100%; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;" onclick="removerNoDaArvore('${tipo}', '${path}')">Desencaixar Peça da Árvore</button>
            </div>
        </div>
    `;
    painelDireito.innerHTML = htmlView;
}

function removerNoDaArvore(tipo, path) {
    if (!confirm("Deseja desencaixar esta peça e todos os seus sub-elementos da árvore do projeto?")) return;
    
    const projetoNome = document.getElementById('arvore-projeto-seletor').value;
    let todasArvores = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
    let projetoObj = todasArvores[projetoNome];
    const partes = path.split('-');

    if (tipo === 'fase') {
        projetoObj.fases.splice(partes[0], 1);
    } else if (tipo === 'etapa') {
        projetoObj.fases[partes[0]].etapas.splice(partes[1], 1);
    } else if (tipo === 'subetapa') {
        projetoObj.fases[partes[0]].etapas[partes[1]].subetapas.splice(partes[2], 1);
    } else if (tipo === 'tarefa') {
        projetoObj.fases[partes[0]].etapas[partes[1]].subetapas[partes[2]].tarefas.splice(partes[3], 1);
    }

    localStorage.setItem('banco_arvores_projetos', JSON.stringify(todasArvores));
    carregarArvoreProjetoAtual();
}

// Interceptador de gancho para injetar a inicialização do seletor quando o Administrador clicar no menu
const originalAlternarModulo = window.alternarModulo;
window.alternarModulo = function(modulo) {
    if (modulo === 'arvore') {
        document.getElementById('panel-blank-state').style.display = 'none';
        document.querySelectorAll('.submenu .menu-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
        document.getElementById('panel-arvore-projetos').style.display = 'flex';
        document.getElementById('nav-arvore').classList.add('active');
        inicializarModuloArvore();
    } else {
        if(document.getElementById('panel-arvore-projetos')) document.getElementById('panel-arvore-projetos').style.display = 'none';
        if(document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.remove('active');
        originalAlternarModulo(modulo);
    }
};