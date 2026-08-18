// =========================================================================
// MÓDULO: MONTAGEM ESTRUTURAL DA ÁRVORE DE PROJETO (ESTILO EBERICK)
// Cronômetro, timesheet, cálculo de pontos e persistência em
// 'banco_arvores_projetos'.
//
// ÁRVORE GENÉRICA RECURSIVA v2 (prompt_gemini.md §12.31, revisão de
// agosto/2026 — pedido do usuário: "níveis puláveis, mas ordem
// obrigatória"). Não existem mais campos fixos por nível
// (`etapa.setores`/`setor.pavimentos`/`pavimento.tarefas`). Todo nó
// (Etapa e qualquer filho) guarda seus filhos num ÚNICO array
// `filhos`, e cada filho carrega um campo `nivel`
// ('setor'|'pavimento'|'tarefa'). Isso permite que uma Etapa tenha um
// Setor, OU um Pavimento direto, OU uma Tarefa direto como filho — a
// ORDEM relativa continua obrigatória (Setor sempre antes de
// Pavimento, que sempre antes de Tarefa — nunca invertido), mas cada
// nível pode ser PULADO, sem precisar existir todos. Etapa continua
// vivendo em `arv.etapas` (array de topo). Todo nó nasce como tarefa
// (campos de status/executor/pontos/etc. já disponíveis) — vira
// container só quando ganha o 1º filho; os dados de tarefa ficam
// adormecidos (não apagados) enquanto for container.
//
// `resolverNoPorPath()`, `ehNoFolha()` e `coletarNosFolhaDaArvore()`
// moraram pra `core.js` (carregado antes deste arquivo) — são usados
// por praticamente todo o resto do sistema, não só aqui.
//
// IMPORTANTE — ESCOPO: além deste arquivo, os arquivos que ainda
// acessavam caminho fixo diretamente (sem passar pela travessia
// genérica) precisaram de ajuste separado — ver prompt_gemini.md
// §12.31 pra lista completa e status de cada um.
// =========================================================================

        function renderizerProjetosParaSelecaoArvore() {
            let p = JSON.parse(localStorage.getItem('banco_projetos')) || [];
            if (typeof obterNomesProjetosPermitidos === 'function') {
                const permitidos = obterNomesProjetosPermitidos();
                if (permitidos) p = p.filter(proj => permitidos.has(proj.nome));
            }
            // Item 6 (prompt_gemini.md §14): lista de projetos em ordem
            // alfabética pelo Nome da Obra — Cadastro de Projetos já
            // fazia isso (cadastros.js::renderizarTabelaProjetos()),
            // essa lista aqui (hub "📁 Projetos") não fazia ainda.
            p.sort((a, b) => a.nome.localeCompare(b.nome));
            const tbody = document.getElementById('tabela-projetos-arvore-body'); tbody.innerHTML = '';
            p.forEach(proj => {
                tbody.innerHTML += '<tr class="clickable-row" onclick="abrirProjetoNaArvore(\''+proj.nome+'\')"><td># <strong>'+(proj.prefixo || "PRJ")+'</strong></td><td>'+proj.nome+'</td></tr>';
            });
        }

        function filtrarTabelaProjetosArvore() {
            const filter = document.getElementById('search-proj-arvore').value.toLowerCase();
            const rows = document.getElementById('tabela-projetos-arvore-body').getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) rows[i].style.display = rows[i].innerText.toLowerCase().indexOf(filter) > -1 ? "" : "none";
        }

        // Objeto genérico de UM nó recém-criado — nasce folha (sem
        // filhos) com os campos de Tarefa já disponíveis pra editar
        // depois. `nivel` é null pra Etapa (implícita, vive em
        // `arv.etapas`) ou 'setor'/'pavimento'/'tarefa' pra qualquer
        // filho.
        function criarNoVazio(nome, nivel, executorInicial, responsavelInicial) {
            const no = {
                nome: nome,
                status: "Apontada",
                executor: executorInicial || '',
                responsavel: responsavelInicial || '',
                custo_max: "0",
                qtd_fisica: "0",
                unidade_fisica: "-",
                pontos: "0",
                horas_reais: "0.0",
                is_outlier: false,
                verba: "0",
                filhos: []
            };
            if (nivel) no.nivel = nivel;
            return no;
        }

        // Cria o objeto de UMA Etapa pronta pra empilhar em arv.etapas —
        // já nasce como tarefa (folha), sem filho nenhum. Item 16
        // (prompt_gemini.md §14, leva 4): Executor E Responsável já
        // nascem preenchidos com o Analista do Cadastro de Projetos
        // (antes só Executor vinha preenchido, Responsável ficava
        // vazio). Usada por cadastros.js::salvarProjeto() (Etapas
        // Default v2, §12.30). Retorna null se o nome não existir mais
        // no Catálogo.
        function criarEtapaDefaultAPartirDoCatalogo(nomeEtapa, nomeAnalistaProjeto) {
            const etapasLego = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
            const encontrada = etapasLego.find(e => e.nome === nomeEtapa);
            if (!encontrada) return null;
            return criarNoVazio(encontrada.nome, null, nomeAnalistaProjeto || '', nomeAnalistaProjeto || '');
        }

        function abrirProjetoNaArvore(nomeProj) {
            projetoSelecionadoAtivo = nomeProj;
            document.getElementById('subpanel-lista-projetos-arvore').style.display = 'none';
            document.getElementById('subpanel-arvore-visual').style.display = 'flex';
            document.getElementById('nome-projeto-titulo-arvore').innerText = "📋 " + nomeProj.substring(0,18) + "...";
            // Pedido do usuário: título principal da tela + orelhas
            // (Estrutura de Projeto/Custos) — ver atualizarOrelhasProjetoAtivo()
            // em core.js.
            if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nomeProj, 'estrutura');

            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            if (!todas[projetoSelecionadoAtivo]) {
                // Etapas Default v2 (prompt_gemini.md §12.30): projeto
                // NOVO já grava as Etapas escolhidas no mini-editor do
                // Cadastro direto aqui, no instante do Save
                // (cadastros.js::salvarProjeto()) — então, na prática,
                // um projeto novo já chega aqui com a entrada em
                // `todas` existindo. Esse `if` só dispara mesmo pra
                // projeto ANTIGO (sem entrada prévia).
                todas[projetoSelecionadoAtivo] = { 
                    nome: projetoSelecionadoAtivo, area_comercial: "5000", valor_contrato: "250000",
                    f_esb: "1.0", f_analista: "1.0", supervisor: "Carlos Eduardo (Senior)", analista: "Fernanda Almeida (Pleno)",
                    etapas: [] 
                };
                localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            }
            carregarArvoreProjetoAtual();
            visualizarNo('raiz');
        }

        function fecharProjetoAtivoNaArvore() {
            if (typeof fecharSessaoCronometroSilencioso === 'function') fecharSessaoCronometroSilencioso();
            projetoSelecionadoAtivo = "";
            document.getElementById('subpanel-arvore-visual').style.display = 'none';
            document.getElementById('subpanel-lista-projetos-arvore').style.display = 'flex';
            document.getElementById('painel-propriedades-lego').innerHTML = '';
            // Sem projeto aberto, some a barra de orelhas e o título volta
            // a ser o genérico da tela (mesmo texto que alternarModulo('arvore')
            // já usava antes das orelhas existirem).
            document.getElementById('page-context-title').innerText = "Estrutura de Projeto Construtiva";
            if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo('', null);
        }

        // Pedido do usuário: abrir um projeto já mostra a lista de Etapas
        // (raiz sempre começa expandida), mas os níveis DENTRO de cada
        // Etapa (Setor/Pavimento/Tarefa) começam recolhidos — só abrem
        // quando a pessoa clica. 'raiz' mantém o padrão antigo (ausente
        // no objeto = expandida); qualquer outra chave ('n-...') agora
        // tem o padrão invertido (ausente = recolhida).
        function alternarRecolhimentoNo(pathKey) {
            const recolhidoPorPadrao = pathKey !== 'raiz';
            const atual = (pathKey in nosRecolhidosEstado) ? nosRecolhidosEstado[pathKey] : recolhidoPorPadrao;
            nosRecolhidosEstado[pathKey] = !atual;
            carregarArvoreProjetoAtual();
        }

        // --- REORDENAR ETAPAS (arrastar e soltar) ---
        // Etapas são todas irmãs direto na raiz do projeto. Reordenar
        // filhos abaixo da Etapa (Setor/Pavimento/Tarefa misturados
        // livremente) não tem mais arrastar-e-soltar dedicado nesta
        // versão — simplificação deliberada, dado que agora podem ser
        // de níveis diferentes convivendo na mesma lista (ver
        // prompt_gemini.md §12.31 pra nota completa).
        // Item 14 (prompt_gemini.md §14 — decisão do usuário: todos os
        // níveis, só reordenar entre irmãos, sem reparenting):
        // generalização do que já existia só pra Etapa. `path` é o
        // mesmo formato usado por resolverNoPorPath() ("0", "0-1",
        // "0-1-2"...) — o último segmento é o índice do nó dentro da
        // lista de irmãos (arv.etapas na raiz, ou .filhos do pai em
        // qualquer profundidade); os segmentos anteriores identificam
        // o pai. Arrastar pra dentro de um pai DIFERENTE do de origem
        // é ignorado de propósito (fora do escopo combinado).
        let noArrastado = null;

        function iniciarArrastoNo(event, path) {
            noArrastado = path;
            event.dataTransfer.effectAllowed = 'move';
        }

        function resolverListaIrmaos(arv, partesPath) {
            if (partesPath.length === 1) return arv.etapas;
            const noPai = resolverNoPorPath(arv, partesPath.slice(0, -1).join('-'));
            return noPai && Array.isArray(noPai.filhos) ? noPai.filhos : null;
        }

        function soltarNo(event, pathDestino) {
            if (noArrastado === null) return;
            const pathOrigem = noArrastado;
            noArrastado = null;
            if (pathOrigem === pathDestino) return;

            const origemPartes = pathOrigem.split('-').map(s => parseInt(s, 10));
            const destinoPartes = pathDestino.split('-').map(s => parseInt(s, 10));

            // Mesmo pai? (todos os segmentos menos o último precisam bater)
            if (origemPartes.length !== destinoPartes.length) return;
            for (let i = 0; i < origemPartes.length - 1; i++) {
                if (origemPartes[i] !== destinoPartes[i]) return;
            }

            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            let arv = todas[projetoSelecionadoAtivo];
            let lista = resolverListaIrmaos(arv, origemPartes);
            if (!lista) return;

            let origem = origemPartes[origemPartes.length - 1];
            let destino = destinoPartes[destinoPartes.length - 1];
            let [item] = lista.splice(origem, 1);
            if (origem < destino) destino -= 1;
            lista.splice(destino, 0, item);

            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            carregarArvoreProjetoAtual();
        }

        // --- CONSTANTES DE NÍVEL ---
        // Ordem obrigatória (Setor sempre antes de Pavimento, sempre
        // antes de Tarefa) — mas cada um pode ser pulado. `niveisFilhoDisponiveis()`
        // devolve quais níveis ainda cabem como filho de um nó de um
        // certo nível (tudo que vem DEPOIS dele nesta lista).
        const NIVEIS_ORDEM = ['etapa', 'setor', 'pavimento', 'tarefa'];
        const ICONE_POR_NIVEL = { etapa: '📁', setor: '📐', pavimento: '🧮', tarefa: '⚙️' };
        const COR_BOTAO_POR_NIVEL = { setor: '#10b981', pavimento: '#64748b', tarefa: '#475569' };
        const ROTULO_BOTAO_POR_NIVEL = { setor: 'Set', pavimento: 'Pav', tarefa: 'Tar' };

        function niveisFilhoDisponiveis(nivelAtual) {
            const idx = NIVEIS_ORDEM.indexOf(nivelAtual);
            return idx === -1 ? [] : NIVEIS_ORDEM.slice(idx + 1);
        }

        // Etapa/Setor/Pavimento agindo como folha NÃO ganha mais um
        // card separado embaixo — a PRÓPRIA linha já mostra Executor e
        // Status, coladinhos no nome (§12.33: "a etapa deveria vir com
        // status de tarefa", não um card duplicado abaixo).
        function infoInlineNoFolha(no) {
            let badgeClass = "status-apontada";
            if (no.status === "Em Desenvolvimento") badgeClass = "status-desenvolvimento";
            if (no.status === "Aguardando Verificação") badgeClass = "status-verificacao";
            if (no.status === "Finalizada") badgeClass = "status-finalizada";
            if (no.status === "Para revisão") badgeClass = "status-validacao";
            return '<span style="font-size:9px; color:#64748b; margin-left:8px; white-space:nowrap;">👤 '+(no.executor ? nomeParaExibicao(no.executor) : '⚠️ sem executor')+'</span>' +
                   '<span class="badge-status '+badgeClass+'" style="font-size:8px; margin-left:6px;">'+(no.status || 'Apontada')+'</span>';
        }

        // Botões "+ Set"/"+ Pav"/"+ Tar" — só os níveis que ainda cabem
        // como filho deste nó (ordem obrigatória, mas puláveis). Nó
        // 'tarefa' nunca tem filho — sem botão nenhum.
        function botoesAdicionar(path, nivelAtual) {
            if (nivelAtual === 'tarefa') return '';
            return niveisFilhoDisponiveis(nivelAtual).map(niv => {
                return '<button style="margin-left:4px; background:'+COR_BOTAO_POR_NIVEL[niv]+'; color:white; border:none; font-size:9px; padding:1px 4px; border-radius:2px; cursor:pointer; white-space:nowrap;" onclick="event.stopPropagation(); abrirFormEncaixe(\''+niv+'\', \''+path+'\')">+ '+ROTULO_BOTAO_POR_NIVEL[niv]+'</button>';
            }).join('');
        }

        // Renderização recursiva — um nó (Etapa ou filho) e, se não for
        // folha, seus filhos embaixo (que podem ser de QUALQUER nível
        // seguinte, misturados livremente).
        function renderizarNoRecursivo(no, path, nivel) {
            const nKey = 'n-' + path;
            // Padrão pedido pelo usuário: níveis dentro de cada Etapa
            // começam recolhidos (ausente no objeto = true), só ficam
            // expandidos depois que alguém clica pra abrir.
            const isRecolhido = (nKey in nosRecolhidosEstado) ? nosRecolhidosEstado[nKey] : true;
            const ehFolha = ehNoFolha(no);
            const seta = ehFolha ? '•' : (isRecolhido ? '►' : '▼');
            const icone = ehFolha ? '⚙️' : ICONE_POR_NIVEL[nivel];
            const isEtapa = nivel === 'etapa';

            let html = '<div style="margin-top:'+(isEtapa?'6px':'4px')+';">' +
                    '<div style="display:flex; align-items:center; gap:4px; padding:'+(isEtapa?'3px':'2px')+'; cursor:pointer; border-top:2px solid transparent;" ' +
                    // Item 14: arrastar-e-soltar agora vale pra qualquer
                    // nível (antes só Etapa) — reordena só entre irmãos,
                    // soltarNo() ignora silenciosamente se o pai for
                    // diferente do de origem.
                    'draggable="true" ondragstart="event.stopPropagation(); iniciarArrastoNo(event, \''+path+'\')" ondragover="event.preventDefault(); event.stopPropagation(); event.currentTarget.style.borderTopColor=\'#10b981\';" ondragleave="event.currentTarget.style.borderTopColor=\'transparent\';" ondrop="event.stopPropagation(); event.currentTarget.style.borderTopColor=\'transparent\'; soltarNo(event, \''+path+'\')" ' +
                    'onclick="event.stopPropagation(); visualizarNo(\''+path+'\')">' +
                    '<span style="cursor:grab; color:#94a3b8; font-size:11px;" title="Arraste para reordenar">⠿</span>' +
                    (ehFolha
                        ? '<span class="tree-toggle-icon" style="color:#cbd5e1;">' + seta + '</span>'
                        : '<span onclick="event.stopPropagation(); alternarRecolhimentoNo(\''+nKey+'\')" class="tree-toggle-icon">' + seta + '</span>') +
                    '<span>'+icone+'</span> <span style="font-weight:600; color:#334155;">'+no.nome+'</span>' +
                    (ehFolha ? infoInlineNoFolha(no) : '') +
                    '<span style="margin-left:auto; display:flex; flex-shrink:0;">' + botoesAdicionar(path, nivel) + '</span>' +
                    '</div>';

            if (!isRecolhido && !ehFolha) {
                html += '<div class="tree-branch" style="border-left:1px dashed #cbd5e1; margin-left:12px; padding-left:8px;">';
                no.filhos.forEach((filho, idx) => {
                    html += renderizarNoRecursivo(filho, path + '-' + idx, filho.nivel);
                });
                html += '</div>';
            }
            html += '</div>';
            return html;
        }

        function carregarArvoreProjetoAtual() {
            const corpo = document.getElementById('corpo-arvore-eberick');
            if (!projetoSelecionadoAtivo) return;

            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            const arv = todas[projetoSelecionadoAtivo];
            
            let isRaizRecolhida = nosRecolhidosEstado['raiz'];
            let setaRaiz = isRaizRecolhida ? '►' : '▼';

            let html = '<div style="font-weight:bold; color:#0a192f; margin-bottom:12px; display:flex; align-items:center; background:#f0f2f5; padding:6px; border-radius:4px; cursor:pointer;" onclick="visualizarNo(\'raiz\')">' +
                       '<span onclick="event.stopPropagation(); alternarRecolhimentoNo(\'raiz\')" class="tree-toggle-icon">' + setaRaiz + '</span>' +
                       '<span>🏢 ' + projetoSelecionadoAtivo.toUpperCase() + '</span>' +
                       '<button style="margin-left:auto; background:#00b4d8; color:white; border:none; font-size:10px; padding:2px 6px; border-radius:3px; cursor:pointer;" onclick="event.stopPropagation(); abrirFormEncaixe(\'etapa\', null)">+ Etapa</button>' +
                       '</div>';

            if (!isRaizRecolhida && arv.etapas) {
                html += '<div class="tree-branch" style="border-left:1px dashed #cbd5e1; margin-left:8px; padding-left:8px;">';
                arv.etapas.forEach((etapa, fIdx) => {
                    html += renderizarNoRecursivo(etapa, ''+fIdx, 'etapa');
                });
                html += '</div>';
            }
            corpo.innerHTML = html;
        }

        function abrirFormEncaixe(nivel, pai) {
            const pd = document.getElementById('painel-propriedades-lego');

            const catsPorNivel = { 'etapa':'etapas', 'setor':'setores', 'pavimento':'pavimentos', 'tarefa':'tarefas' };
            const pecas = JSON.parse(localStorage.getItem('banco_' + catsPorNivel[nivel] + '_lego')) || [];
            const funcs = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];

            let optionsHtml = pecas.map(p => '<option value="'+p.nome+'">'+p.nome+'</option>').join('');
            let funcsHtml = '<option value="">-- Selecione --</option>' + funcs.map(f => '<option value="'+f.nome+'">'+nomeParaExibicao(f.nome)+'</option>').join('');
            let indicesHtml = relacaoIndicesDesempenho.map(i => '<option value="'+i+'">'+i+'</option>').join('');

            let onchangeNome = nivel === 'tarefa' ? 'atualizarUnidadeFisicaTarefa()' : '';
            let html = '<div class="form-panel" style="border:none; padding:0;">' +
                       '<div class="form-section">' +
                       '<div class="form-section-title">Encaixar Componente: '+nivel.toUpperCase()+'</div>' +
                       '<input type="hidden" id="l-nivel" value="'+nivel+'"><input type="hidden" id="l-pai" value="'+(pai===null||pai===undefined?'':pai)+'">' +
                       '<div class="form-group col-12" style="margin-top:10px;">' +
                       '<label>Catálogo Global (Peças Lego):</label>' +
                       '<select id="l-nome" style="background:white;" onchange="'+onchangeNome+'">'+optionsHtml+'</select>' +
                       '</div>';

            // Etapa e Setor não pedem NADA além do Nome — nascem como
            // tarefa (folha), com Executor/Custo/Pontos/Verba em
            // branco/zero, editáveis depois clicando no próprio card.
            // Item 10 (prompt_gemini.md §14, leva 4): Setor passou a
            // pedir Área Física/Peso do Esforço também, na criação —
            // precisa disso pra competir por Área Equivalente contra
            // Setores irmãos quando a Etapa tem Setor(es) como filho
            // direto (regra "nunca mistura tipo de filho": nesse caso
            // a Etapa não pode ter Pavimento/Tarefa direto — só Setor).
            if(nivel === 'setor') {
                html += '<div class="form-group col-12" style="margin-top:12px;"><label>Área Física (m²):</label><input type="number" id="l-setor-area" value="500"></div>' +
                        '<div class="form-group col-12" style="margin-top:8px;"><label>Peso de Esforço:</label><input type="number" id="l-setor-peso" value="1.0" step="0.1"></div>';
            }
            if(nivel === 'pavimento') {
                // Continua pedindo Tipo de Pavimento/Área/Peso na
                // criação — é sobre o dado FÍSICO do pavimento (mestre
                // ou repetido, área real), não faz parte da
                // generalização de nível.
                html += '<div class="form-group col-12" style="margin-top:12px;"><label>Tipo de Pavimento:</label><select id="l-tipo-pav" style="background:white;" onchange="document.getElementById(\'box-area-mestre\').style.display = this.value===\'mestre\'?\'block\':\'none\'"><option value="mestre">Mestre (Detalhável Original)</option><option value="repetido">Repetido (Ocultado na Árvore)</option></select></div>' +
                        '<div id="box-area-mestre" style="display:block; margin-top:10px;">' +
                        '<div class="form-group col-12"><label>Área Física Real (m²):</label><input type="number" id="l-pav-area" value="500"></div>' +
                        '<div class="form-group col-12" style="margin-top:8px;"><label>Peso de Esforço:</label><input type="number" id="l-pav-peso" value="1.0" step="0.1"></div>' +
                        '</div>';
            }
            if(nivel === 'tarefa') {
                html += '<div class="form-group col-12" style="margin-top:12px;"><label>Executor Designado:</label><select id="l-executor" style="background:white;">'+funcsHtml+'</select></div>' +
                        '<div class="form-group col-12" style="margin-top:12px;"><label>Custo Máximo Designado Teto (R$):</label><input type="number" id="l-custo-max" value="1200"></div>' +
                        '<div style="margin-top:16px; font-weight:bold; font-size:11px; color:#1e3a66; border-top:1px solid #cbd5e1; padding-top:12px;">📊 CALIBRAÇÃO DE PONTOS</div>' +
                        '<div class="form-group col-12" style="margin-top:8px;"><label>Índice de Medição Física:</label><select id="l-indice-desempenho" style="background:white;" onchange="calcularPontosPorQtdFisica()">'+indicesHtml+'</select></div>' +
                        '<div class="form-group col-8" style="margin-top:8px;"><label>Quantidade:</label><input type="number" id="l-qtd-fisica" value="15" oninput="calcularPontosPorQtdFisica()"></div>' +
                        '<div class="form-group col-4" style="margin-top:8px;"><label>Unidade Física:</label><input type="text" id="l-unidade-fisica" readonly style="background:#e2e8f0; font-weight:bold; color:#1e40af;"></div>' +
                        '<div class="form-group col-12" style="margin-top:8px;"><label>Pontos Gerados (Horas Razoáveis):</label><input type="number" id="l-pontos" value="30"></div>' +
                        '<div id="box-alerta-estatistica" style="margin-top:10px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:8px; border-radius:4px; font-size:11px;">Métrica física ativa.</div>';
            }

            html += '</div><button class="btn-success" style="margin-top:20px; width:100%;" onclick="salvarPecaNaArvore()">Plugar Componente na Árvore</button></div>';
            pd.innerHTML = html;
            if(nivel==='tarefa') { calcularPontosPorQtdFisica(); atualizarUnidadeFisicaTarefa(); }
        }

        // Preenche a Unidade Física (readonly) a partir do catálogo de
        // Tarefas. Sempre lê o catálogo ATUAL.
        function buscarUnidadeFisicaDoCatalogo(nomeTarefa) {
            const tarefasCatalogo = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
            const tarefaCatalogo = tarefasCatalogo.find(t => t.nome === nomeTarefa);
            return (tarefaCatalogo && tarefaCatalogo.unidade_fisica) ? tarefaCatalogo.unidade_fisica : '—';
        }

        function atualizarUnidadeFisicaTarefa() {
            const campoUnidade = document.getElementById('l-unidade-fisica');
            const campoNome = document.getElementById('l-nome');
            if (!campoUnidade || !campoNome) return;
            campoUnidade.value = buscarUnidadeFisicaDoCatalogo(campoNome.value);
        }

        function calcularPontosPorQtdFisica() {
            const un = document.getElementById('l-indice-desempenho').value;
            const qtd = parseFloat(document.getElementById('l-qtd-fisica').value) || 0;
            const box = document.getElementById('box-alerta-estatistica');
            
            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            let projObj = todas[projetoSelecionadoAtivo];
            let f_analista = parseFloat(projObj ? projObj.f_analista : 1.0) || 1.0;

            let FatorIndex = 2.0; 
            if (un.indexOf("m2") > -1) FatorIndex = 0.5;
            if (un.indexOf("kg") > -1) FatorIndex = 0.05;

            let calculo = Math.round(qtd * FatorIndex * f_analista);
            if(calculo < 1) calculo = 1;
            
            let elPontos = document.getElementById('l-pontos');
            if(elPontos) elPontos.value = calculo;
            if(box) box.innerHTML = "💡 Indicador base de ("+FatorIndex+"h) × Sensibilidade ("+f_analista+") gerou: "+calculo+" Pontos.";
        }

        function salvarPecaNaArvore() {
            const nivel = document.getElementById('l-nivel').value;
            const pai = document.getElementById('l-pai').value;
            const nome = document.getElementById('l-nome').value;

            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            let arv = todas[projetoSelecionadoAtivo];

            if (nivel === 'etapa') {
                // Item 16 (prompt_gemini.md §14, leva 4): Etapa criada
                // manualmente aqui (formulário "Plugar Componente na
                // Árvore") também nasce com Executor e Responsável já
                // preenchidos com o Analista do Cadastro de Projetos —
                // antes só as Etapas Default (criadas automaticamente
                // ao criar o projeto) tinham isso, e só no Executor.
                const projetosCadastroAgora = JSON.parse(localStorage.getItem('banco_projetos')) || [];
                const projCadastroAgora = projetosCadastroAgora.find(p => p.nome === projetoSelecionadoAtivo);
                const analistaDoProjeto = projCadastroAgora ? (projCadastroAgora.analista || '') : '';
                arv.etapas.push(criarNoVazio(nome, null, analistaDoProjeto, analistaDoProjeto));
            } else {
                const noPai = resolverNoPorPath(arv, pai);
                if (!noPai) return;
                if (!Array.isArray(noPai.filhos)) noPai.filhos = [];
                const novoNo = criarNoVazio(nome, nivel, '');

                if (nivel === 'setor') {
                    novoNo.area_fisica = document.getElementById('l-setor-area').value;
                    novoNo.peso_esforco = document.getElementById('l-setor-peso').value;
                }
                if (nivel === 'pavimento') {
                    let tipoPav = document.getElementById('l-tipo-pav').value;
                    novoNo.tipo_pavimento = tipoPav;
                    novoNo.area_fisica = tipoPav === 'mestre' ? document.getElementById('l-pav-area').value : "0";
                    novoNo.peso_esforco = tipoPav === 'mestre' ? document.getElementById('l-pav-peso').value : "0";
                }
                if (nivel === 'tarefa') {
                    novoNo.executor = document.getElementById('l-executor').value;
                    novoNo.custo_max = document.getElementById('l-custo-max').value;
                    novoNo.indice_desempenho = document.getElementById('l-indice-desempenho').value;
                    novoNo.qtd_fisica = document.getElementById('l-qtd-fisica').value;
                    novoNo.unidade_fisica = document.getElementById('l-unidade-fisica').value;
                    novoNo.pontos = document.getElementById('l-pontos').value;
                }

                noPai.filhos.push(novoNo);
                if (nivel === 'pavimento') recalcularDistribuicaoVerbaSetores(arv);
            }

            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            carregarArvoreProjetoAtual();
            document.getElementById('painel-propriedades-lego').innerHTML = '';
        }

        // Soma de Área Equivalente do projeto inteiro — percorre a
        // árvore recursivamente procurando QUALQUER nó com
        // nivel==='pavimento' e tipo_pavimento==='mestre', em qualquer
        // profundidade (antes só existia exatamente 2 níveis abaixo da
        // Etapa; agora pode estar em qualquer lugar, já que os níveis
        // são puláveis).
        function recalcularDistribuicaoVerbaSetores(arv) {
            let somaAreaEquivalenteTotal = 0;
            function caminhar(no) {
                if (no.nivel === 'pavimento' && no.tipo_pavimento === 'mestre') {
                    somaAreaEquivalenteTotal += (parseFloat(no.area_fisica) || 0) * (parseFloat(no.peso_esforco) || 1);
                }
                (no.filhos || []).forEach(caminhar);
            }
            (arv.etapas || []).forEach(caminhar);
            arv.soma_a_eq = somaAreaEquivalenteTotal;
        }

        function visualizarNo(path) {
            const pd = document.getElementById('painel-propriedades-lego');
            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            const funcs = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];

            if (path === 'raiz') {
                let pObj = todas[projetoSelecionadoAtivo];
                recalcularDistribuicaoVerbaSetores(pObj);

                const projetosCadastro = JSON.parse(localStorage.getItem('banco_projetos')) || [];
                const projCadastro = projetosCadastro.find(x => x.nome === projetoSelecionadoAtivo);
                const analistaAtual = projCadastro ? (nomeParaExibicao(projCadastro.analista) || '—') : '—';
                const supervisorAtual = projCadastro ? (nomeParaExibicao(projCadastro.supervisor) || '—') : '—';
                const detalhistaAtual = projCadastro ? (nomeParaExibicao(projCadastro.detalhista) || '—') : '—';

                const statusLiberacaoAtual = projCadastro ? (projCadastro.status_liberacao || 'liberado') : 'liberado';
                const emAnalise = statusLiberacaoAtual === 'em_analise';
                const corStatus = emAnalise ? '#f59e0b' : '#10b981';
                const rotuloStatus = emAnalise ? '🔬 Em Análise' : '✅ Liberado pra Detalhamento';
                const rotuloBotao = emAnalise ? 'Liberar pra Detalhamento' : 'Voltar pra "Em Análise"';

                // Item 2 (prompt_gemini.md §14, leva 4): "Valor Contratado
                // Líquido" = valor do contrato MENOS impostos — o % de
                // Impostos é o que já está SALVO na Distribuição de
                // Custos deste projeto (não tem como ler o DOM daquela
                // tela a partir daqui). Decisão do usuário: sempre vai
                // ter algo salvo (default de 23%, item 1) — sem
                // fallback especial; se por acaso não tiver nada salvo
                // ainda, sai R$ 0,00 mesmo (registrado, não é bug).
                const orcamentosSalvos = JSON.parse(localStorage.getItem('banco_distribuicao_custos')) || {};
                const orcamentoDoProjeto = orcamentosSalvos[projetoSelecionadoAtivo] || {};
                const pctImpostosSalvo = parseFloat(orcamentoDoProjeto.pct_impostos) || 0;
                const valorContratoBruto = projCadastro ? (parseFloat(projCadastro.valor) || 0) : 0;
                const valorContratadoLiquido = valorContratoBruto - (pctImpostosSalvo / 100 * valorContratoBruto);

                let html = '<div class="form-panel" style="border:none; padding:0;">' +
                           '<div class="form-section">' +
                           '<div class="form-section-title">🏢 Propriedades Contratuais Macro do Projeto</div>' +
                           '<div class="form-group col-12" style="margin-top:14px; padding:10px 14px; border-radius:6px; display:flex; align-items:center; justify-content:space-between; background:'+(emAnalise ? '#fef9c3' : '#f0fdf4')+'; color:'+(emAnalise ? '#854d0e' : '#166534')+';">' +
                           '<span title="'+(emAnalise ? 'As tarefas deste projeto não aparecem na Atribuição de Tarefas ainda.' : 'As tarefas deste projeto já aparecem na Atribuição de Tarefas.')+'" style="font-size:14px; font-weight:bold;">'+rotuloStatus+'</span>' +
                           '<button type="button" onclick="alternarStatusLiberacaoProjeto()" style="white-space:nowrap; background:none; border:1px solid currentColor; border-radius:4px; color:inherit; font-size:11px; cursor:pointer; padding:4px 10px;">'+rotuloBotao+'</button>' +
                           '</div>' +
                           '<div class="form-grid" style="margin-top:14px;">' +
                           '<div class="form-group col-12" style="margin-top:14px;"><label>Nome Oficial da Obra:</label>' +
                           '<input type="text" value="' + projetoSelecionadoAtivo + '" readonly style="width:100%; background:#e2e8f0;">' +
                           '</div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Área Total Comercial (m²):</label><input type="number" value="'+(projCadastro ? (projCadastro.area || 0) : 0)+'" readonly style="background:#e2e8f0;" title="Editável no Cadastro de Projetos"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Valor Contratado Líquido (R$):</label><input type="text" value="'+formatarMoeda(valorContratadoLiquido)+'" readonly style="background:#e2e8f0;" title="Valor do contrato menos impostos (% definido na Distribuição de Custos deste projeto)"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Fator de Esbeltez ($F_{esb}$):</label><input type="number" id="edit-p-esb" step="0.1" value="'+(pObj.f_esb || 1.0)+'"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Sensibilidade Analista ($F_{analista}$):</label><input type="number" id="edit-p-sens" step="0.1" value="'+(pObj.f_analista || 1.0)+'"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Supervisor:</label><input type="text" value="'+supervisorAtual+'" readonly style="background:#e2e8f0;" title="Editável no Cadastro de Projetos"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Analista:</label><input type="text" value="'+analistaAtual+'" readonly style="background:#e2e8f0;" title="Editável no Cadastro de Projetos"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Detalhista:</label><input type="text" value="'+detalhistaAtual+'" readonly style="background:#e2e8f0;" title="Editável no Cadastro de Projetos"></div>' +
                           '<div class="form-group col-6" style="margin-top:10px;"><label>Número de Pavimentos:</label><input type="text" value="'+(projCadastro ? (projCadastro.pavimentos || '—') : '—')+'" readonly style="background:#e2e8f0;" title="Editável no Cadastro de Projetos"></div>' +
                           '<div class="form-group col-12" style="font-size:10px; color:#94a3b8; margin-top:-4px;">Área, Valor, Analista, Supervisor, Detalhista e Número de Pavimentos são editados no Cadastro de Projetos — aqui é só visualização.</div>' +
                           '<div class="form-group col-12" style="margin-top:10px; background:#f8fafc; padding:8px; border-radius:4px; font-size:11px; font-weight:bold; color:#00b4d8;">📐 Área Equivalente Total: '+(pObj.soma_a_eq || 0)+' m² Equivalentes.</div>' +
                           '</div></div>' +
                           '<button class="btn-primary" style="width:100%; margin-top:20px;" onclick="salvarDadosMacroProjetoRaiz()">Atualizar Diretrizes do Projeto</button></div>';
                pd.innerHTML = html;
                return;
            }

            const arv = todas[projetoSelecionadoAtivo];
            const no = resolverNoPorPath(arv, path);
            if (!no) return;
            const nivel = path.indexOf('-') === -1 ? 'etapa' : no.nivel;
            const ehFolha = ehNoFolha(no);

            let html = '<div class="form-panel" style="border:none; padding:0;">' +
                       '<div class="form-section">' +
                       '<div class="form-section-title">ℹ️ Detalhes - Componente ' + nivel.toUpperCase() + '</div>' +
                       '<div class="form-grid" style="margin-top:8px;">' +
                       '<div class="form-group col-12"><label>Componente Vinculado:</label><input type="text" value="' + no.nome + '" readonly style="background:#e2e8f0;"></div>';

            if(nivel === 'setor') {
                // Item 10 (prompt_gemini.md §14, leva 4): mesma lógica
                // de Área Equivalente/Fração de Verba que Pavimento já
                // mostra, só que comparando contra os Setores IRMÃOS
                // (mesmo pai), não contra o projeto inteiro — Setor só
                // compete dentro da própria Etapa/Setor pai.
                const caminhoPai = path.slice(0, path.lastIndexOf('-'));
                const noPaiDoSetor = caminhoPai ? resolverNoPorPath(arv, caminhoPai) : null;
                const irmaosSetor = noPaiDoSetor ? (noPaiDoSetor.filhos || []) : arv.etapas;
                let totalAeqIrmaos = 0;
                irmaosSetor.forEach(irmao => {
                    if (irmao.nivel === 'setor') totalAeqIrmaos += (parseFloat(irmao.area_fisica) || 0) * (parseFloat(irmao.peso_esforco) || 0);
                });
                let a_eq_setor = (parseFloat(no.area_fisica)||0) * (parseFloat(no.peso_esforco)||0);
                let pct_verba_setor = totalAeqIrmaos > 0 ? ((a_eq_setor / totalAeqIrmaos) * 100).toFixed(1) : '0.0';

                html += '<div class="form-group col-6" style="margin-top:6px;"><label>Área Física (m²):</label><input type="number" id="edit-setor-area" value="' + (no.area_fisica || 0) + '"></div>' +
                        '<div class="form-group col-6" style="margin-top:6px;"><label>Peso de Esforço:</label><input type="number" id="edit-setor-peso" step="0.1" value="' + (no.peso_esforco || 0) + '"></div>' +
                        '<div class="form-group col-12" style="margin-top:6px; background:#f0fdf4; border:1px solid #bbf7d0; padding:6px 10px; border-radius:4px; font-size:11px; color:#166534; display:flex; justify-content:space-between;">' +
                        '<span>📐 <b>Área Eq.:</b> ' + a_eq_setor + ' m²</span>' +
                        '<span>💰 <b>Fração de Verba (entre Setores irmãos):</b> ' + pct_verba_setor + '%</span>' +
                        '</div>';
            }

            if(nivel === 'pavimento') {
                let a_eq = (parseFloat(no.area_fisica)||0) * (parseFloat(no.peso_esforco)||1);
                let total_a_eq = arv.soma_a_eq || a_eq || 1;
                let pct_verba = ((a_eq / total_a_eq) * 100).toFixed(1);

                html += '<div class="form-group col-6" style="margin-top:6px;"><label>Área Física Real (m²):</label><input type="number" id="edit-pav-area" value="' + no.area_fisica + '"></div>' +
                        '<div class="form-group col-6" style="margin-top:6px;"><label>Peso do Pavimento:</label><input type="number" id="edit-pav-peso" step="0.1" value="' + no.peso_esforco + '"></div>' +
                        '<div class="form-group col-12" style="margin-top:6px; background:#f0fdf4; border:1px solid #bbf7d0; padding:6px 10px; border-radius:4px; font-size:11px; color:#166534; display:flex; justify-content:space-between;">' +
                        '<span>📐 <b>Área Eq.:</b> ' + a_eq + ' m²</span>' +
                        '<span>💰 <b>Fração de Verba:</b> ' + pct_verba + '%</span>' +
                        '</div>';
            }

            const ehNoDeExecucao = (nivel === 'tarefa') || ehFolha;

            if (ehNoDeExecucao) {
                let fExecs = '<option value="" '+(!no.executor?"selected":"")+'>-- Selecione --</option>' + funcs.map(f => '<option value="'+f.nome+'" '+(f.nome===no.executor?"selected":"")+'>'+nomeParaExibicao(f.nome)+'</option>').join('');
                let fResps = '<option value="" '+(!no.responsavel?"selected":"")+'>-- Selecione --</option>' + funcs.map(f => '<option value="'+f.nome+'" '+(f.nome===no.responsavel?"selected":"")+'>'+nomeParaExibicao(f.nome)+'</option>').join('');

                // Item 15 (prompt_gemini.md §14, leva 4): "Custo Máx
                // Teto" deixa de ser digitado à mão — passa a ser o
                // resultado do cálculo de verba (item 10) apontado pra
                // ESTA Tarefa especificamente, calculado AO VIVO
                // (opção "b" escolhida pelo usuário — nunca fica
                // desatualizado esperando alguém salvar a Distribuição
                // de Custos de novo). Roda a cascata
                // (distribuirVerbaRecursiva, de
                // js/distribuicao-custos.js, carregada na mesma
                // página) direto em CIMA da árvore `arv` já carregada
                // aqui (mesmo objeto que `no` faz parte, via
                // resolverNoPorPath acima) — assim `no._verbaCalc`
                // fica disponível direto, sem precisar comparar
                // objetos de duas leituras separadas do localStorage
                // (que nunca bateriam por referência). "Horas Limite"
                // continua sendo essa verba dividida pelo valor-hora
                // do Executor (confirmado pelo usuário) — troquei a
                // fonte do valor-hora pra `valorHoraVigente()`, a
                // mesma que a Aba 5 de Distribuição de Custos já usa
                // (antes lia `funcionario.hora`, um campo solto que
                // não existe de verdade no Cadastro de Funcionários —
                // sempre caía no fallback de 50, sem relação com o
                // valor de hora real do funcionário).
                if (typeof calcularVerbaPorEtapaSalvo === 'function' && typeof distribuirVerbaRecursiva === 'function' && Array.isArray(arv.etapas)) {
                    const verbasPorEtapaAgora = calcularVerbaPorEtapaSalvo(projetoSelecionadoAtivo);
                    const verbaPorNomeEtapaAgora = {};
                    verbasPorEtapaAgora.forEach(v => { verbaPorNomeEtapaAgora[v.nome] = v.verbaLiquida; });
                    arv.etapas.forEach(etapaNo => distribuirVerbaRecursiva(etapaNo, verbaPorNomeEtapaAgora[etapaNo.nome] || 0));
                }
                const custoMaxCalculado = no._verbaCalc || 0;
                const hojeISOAgora = new Date().toISOString().slice(0, 10);
                let vHora = no.executor && typeof valorHoraVigente === 'function' ? valorHoraVigente(no.executor, hojeISOAgora) : 0;
                let hLimiteMax = vHora > 0 ? (custoMaxCalculado / vHora).toFixed(1) : '0.0';

                const usuarioAtualParaTrava = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
                const souOExecutorDesteNo = usuarioAtualParaTrava && usuarioAtualParaTrava.nome === no.executor;
                const temAutoridadeDeRevisar = usuarioAtualParaTrava && typeof podeRevisarTarefa === 'function'
                    && podeRevisarTarefa(no, projetoSelecionadoAtivo, usuarioAtualParaTrava, funcs, JSON.parse(localStorage.getItem('banco_projetos')) || []);
                const noTravadoParaRevisao = no.status === 'Aguardando Verificação' && souOExecutorDesteNo && !temAutoridadeDeRevisar;
                const disabledSeTravada = noTravadoParaRevisao ? ' disabled' : '';
                const avisoEmRevisao = noTravadoParaRevisao
                    ? '<div class="form-group col-12" style="margin-top:6px; background:#eff6ff; color:#1e40af; padding:6px 8px; border-radius:4px; font-size:11px; font-weight:bold;">🔒 Este item está em revisão — só leitura até o Responsável liberar (mover pra "Para revisão" ou "Finalizada").</div>'
                    : '';

                html += avisoEmRevisao +
                        '<div class="form-group col-6" style="margin-top:6px;"><label>Executor:</label><select id="edit-t-exec" style="background:white;"'+disabledSeTravada+'>'+fExecs+'</select></div>' +
                        '<div class="form-group col-6" style="margin-top:6px;"><label>Responsável:</label><select id="edit-t-responsavel" style="background:white;"'+disabledSeTravada+'>'+fResps+'</select></div>' +
                        '<div class="form-group col-3" style="margin-top:6px;"><label>Custo Máx Teto:</label><input type="text" value="' + formatarMoeda(custoMaxCalculado) + '" readonly style="background:#e2e8f0;" title="Calculado a partir da Verba desta Tarefa na Distribuição de Custos — não é mais editável aqui."></div>' +
                        '<div class="form-group col-3" style="margin-top:6px;"><label>Horas Limite:</label><input type="text" value="' + hLimiteMax + 'h" readonly style="background:#e2e8f0; font-weight:bold; color:#1e40af;"></div>' +
                        '<div class="form-group col-4" style="margin-top:6px;"><label>Quantidade Física:</label><input type="number" id="edit-t-qtd" value="' + (no.qtd_fisica || 0) + '"'+disabledSeTravada+'></div>' +
                        '<div class="form-group col-2" style="margin-top:6px;"><label>Unidade:</label><input type="text" value="' + buscarUnidadeFisicaDoCatalogo(no.nome) + '" readonly style="background:#e2e8f0; font-weight:bold; color:#1e40af;"></div>' +
                        '<div class="form-group col-3" style="margin-top:6px;"><label>Pontos:</label><input type="number" id="edit-t-pontos" value="' + (no.pontos || 0) + '"'+disabledSeTravada+'></div>' +
                        '<div class="form-group col-3" style="margin-top:6px;"><label>Verba (R$):</label><input type="number" id="edit-t-verba" value="' + (no.verba || 0) + '"'+disabledSeTravada+'></div>' +
                        '<div class="form-group col-6" style="margin-top:6px;"><label>Status Operacional:</label><select id="edit-t-status" style="background:white;"'+disabledSeTravada+'>' +
                        '<option '+(no.status==="Apontada"?"selected":"")+'>Apontada</option>' +
                        '<option '+(no.status==="Sem Executor"?"selected":"")+'>Sem Executor</option>' +
                        '<option '+(no.status==="Em Desenvolvimento"?"selected":"")+'>Em Desenvolvimento</option>' +
                        '<option '+(no.status==="Aguardando Verificação"?"selected" : "")+'>Aguardando Verificação</option>' +
                        '<option '+(no.status==="Finalizada"?"selected":"")+'>Finalizada</option>' +
                        '<option '+(no.status==="Para revisão"?"selected":"")+'>Para revisão</option>' +
                        '</select></div>';

                if(no.is_outlier) {
                    html += '<div class="form-group col-12" style="margin-top:6px; background:#fee2e2; color:#991b1b; padding:6px 8px; border-radius:4px; font-size:11px; font-weight:bold;">⚠️ Outlier detectado (>40% desvio). Excluído do histórico.</div>';
                }
            }

            html += '</div></div>' +
                    '<div style="margin-top:auto; display:flex; gap:10px; padding-top:12px;">' +
                    '<button class="btn-primary" style="flex:1;" onclick="salvarAlteracoesNo(\''+path+'\')">Atualizar Componente</button>' +
                    '<button class="btn-secondary" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;" onclick="removerNo(\''+path+'\')">Desencaixar</button>' +
                    '</div></div>';
            pd.innerHTML = html;
        }

        function alternarStatusLiberacaoProjeto() {
            let projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
            const idx = projetos.findIndex(p => p.nome === projetoSelecionadoAtivo);
            if (idx === -1) return;

            const atual = projetos[idx].status_liberacao || 'liberado';
            const novo = atual === 'em_analise' ? 'liberado' : 'em_analise';
            const mensagem = novo === 'liberado'
                ? 'Liberar este projeto pra Detalhamento? As tarefas dele passam a aparecer na Atribuição de Tarefas.'
                : 'Voltar este projeto pra "Em Análise"? As tarefas dele deixam de aparecer na Atribuição de Tarefas até liberar de novo.';
            if (!confirm(mensagem)) return;

            projetos[idx].status_liberacao = novo;
            localStorage.setItem('banco_projetos', JSON.stringify(projetos));
            visualizarNo('raiz');
        }

        function salvarDadosMacroProjetoRaiz() {
            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            const arv = todas[projetoSelecionadoAtivo];
            if (!arv) return;

            arv.f_esb = document.getElementById('edit-p-esb').value;
            arv.f_analista = document.getElementById('edit-p-sens').value;

            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            alert('Diretrizes do projeto atualizadas.');
            visualizarNo('raiz');
        }

        function salvarAlteracoesNo(path) {
            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            const funcs = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            const arv = todas[projetoSelecionadoAtivo];
            const no = resolverNoPorPath(arv, path);
            if (!no) return;
            const nivel = path.indexOf('-') === -1 ? 'etapa' : no.nivel;
            const ehFolha = ehNoFolha(no);

            if (nivel === 'setor') {
                no.area_fisica = document.getElementById('edit-setor-area').value;
                no.peso_esforco = document.getElementById('edit-setor-peso').value;
            }

            if (nivel === 'pavimento') {
                no.area_fisica = document.getElementById('edit-pav-area').value;
                no.peso_esforco = document.getElementById('edit-pav-peso').value;
                recalcularDistribuicaoVerbaSetores(arv);
            }

            const ehNoDeExecucao = (nivel === 'tarefa') || ehFolha;

            if (ehNoDeExecucao) {
                const usuarioAtualParaTrava = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
                const souOExecutorDesteNo = usuarioAtualParaTrava && usuarioAtualParaTrava.nome === no.executor;
                const temAutoridadeDeRevisar = usuarioAtualParaTrava && typeof podeRevisarTarefa === 'function'
                    && podeRevisarTarefa(no, projetoSelecionadoAtivo, usuarioAtualParaTrava, funcs, JSON.parse(localStorage.getItem('banco_projetos')) || []);
                const noTravadoParaRevisao = no.status === 'Aguardando Verificação' && souOExecutorDesteNo && !temAutoridadeDeRevisar;
                if (noTravadoParaRevisao) return;

                no.executor = document.getElementById('edit-t-exec').value;
                const elResponsavel = document.getElementById('edit-t-responsavel');
                if (elResponsavel) no.responsavel = elResponsavel.value;
                no.qtd_fisica = document.getElementById('edit-t-qtd').value;
                no.pontos = document.getElementById('edit-t-pontos').value;
                const elVerba = document.getElementById('edit-t-verba');
                if (elVerba) no.verba = elVerba.value;

                let novoStatus = document.getElementById('edit-t-status').value;

                if (novoStatus === "Finalizada" && no.status !== "Finalizada") {
                    no.finalizada_em = new Date().toISOString();
                }

                // Cálculo de outlier (k_real vs base_h do catálogo)
                // depende do Peso do Pavimento-PAI IMEDIATO — só faz
                // sentido quando esse pai realmente é um Pavimento
                // (nivel==='pavimento'). Como os níveis agora são
                // puláveis, isso NÃO está mais garantido só por ser
                // `nivel === 'tarefa'` — precisa checar o pai de
                // verdade.
                if (nivel === 'tarefa' && novoStatus === "Finalizada" && no.status !== "Finalizada") {
                    const segs = path.split('-');
                    const pathPai = segs.slice(0, -1).join('-');
                    const noPai = resolverNoPorPath(arv, pathPai);
                    if (noPai && noPai.nivel === 'pavimento') {
                        let horasReais = parseFloat(no.horas_reais) || 0.1;
                        let qtdFisica = parseFloat(no.qtd_fisica) || 1;
                        let pesoPav = parseFloat(noPai.peso_esforco) || 1;
                        let f_esb = parseFloat(arv.f_esb) || 1;
                        let f_analista = parseFloat(arv.f_analista) || 1;

                        let kRealApurado = horasReais / (qtdFisica * pesoPav * f_esb * f_analista);
                        no.k_real_calculado = kRealApurado.toFixed(3);

                        let tLegoList = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
                        let tCat = tLegoList.find(t => t.nome === no.nome);
                        let baseH = tCat ? parseFloat(tCat.base_h || 2.0) : 2.0;

                        let desvioPct = Math.abs((kRealApurado - baseH) / baseH);
                        if(desvioPct > 0.40) {
                            no.is_outlier = true;
                        }
                    }
                }
                no.status = novoStatus;
            }

            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            alert("Componente atualizado com sucesso!");
            carregarArvoreProjetoAtual();
            visualizarNo(path);
        }

        function removerNo(path) {
            if(!confirm("Deseja desencaixar o componente da estrutura?")) return;
            let todas = JSON.parse(localStorage.getItem('banco_arvores_projetos'));
            const arv = todas[projetoSelecionadoAtivo];
            const segs = path.split('-');

            if (segs.length === 1) {
                arv.etapas.splice(parseInt(segs[0], 10), 1);
            } else {
                const pathPai = segs.slice(0, -1).join('-');
                const noPai = resolverNoPorPath(arv, pathPai);
                if (!noPai || !Array.isArray(noPai.filhos)) return;
                noPai.filhos.splice(parseInt(segs[segs.length - 1], 10), 1);
            }

            localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
            document.getElementById('painel-propriedades-lego').innerHTML = '';
            carregarArvoreProjetoAtual();
        }
