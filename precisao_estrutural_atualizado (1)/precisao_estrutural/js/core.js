// =========================================================================
// MELHORIA #17 (prompt_gemini.md §12.15) — CODINOME DE FUNCIONÁRIO
//
// Codinome = primeiro nome, derivado automaticamente (não é um campo
// digitado — não existe funcionario.codinome no schema, é sempre
// calculado a partir de funcionario.nome). `nome` continua sendo o
// identificador interno único em TODO dado gravado (tarefa.executor,
// tarefa.responsavel, projeto.analista/supervisor, chaves de
// comparação) — nada disso muda. `nomeParaExibicao()` é usada SÓ na
// hora de desenhar texto na tela — troca em TODO lugar que hoje mostra
// o nome completo (cartão do Kanban, coluna de tabela, dropdown de
// escolha de Executor/Responsável/Analista/Supervisor etc.), com UMA
// exceção deliberada: a própria tela **Cadastro de Funcionários**
// continua mostrando o nome completo na lista — é o registro-fonte de
// nomes completos, não faz sentido resumir ali (e como o primeiro
// nome já é garantido único pela validação de duplicidade em
// salvarFuncionario(), não há ambiguidade em usar codinome no resto
// do sistema).
//
// Testada em sandbox antes de aplicar em qualquer tela real
// (/home/claude/testes/sandbox_backlog/rodar_teste_codinome.js, 9
// cenários — inclusive colisão case-insensitive e edição não colidir
// consigo mesma).
// =========================================================================
// Codinome voltou a ser campo digitado (cadastros.js) — obrigatório e
// único, com migração retroativa preenchendo o primeiro nome pra quem
// não tinha (ver migração v11, abaixo). O fallback aqui (split do
// nome) só entra em cenários residuais: nome sem cadastro
// correspondente encontrado, ou (por segurança) campo vazio.
// Movida de desempenho-projeto.js pra cá (auditoria de segurança,
// 2026-08-26): precisa estar num arquivo carregado CEDO — core.js é o
// primeiro — pra ficar disponível pra todo arquivo que monta HTML via
// innerHTML com texto vindo de formulário (nome de cliente,
// funcionário, tarefa etc.), não só pra quem a definia originalmente.
function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nomeParaExibicao(nomeCompleto) {
    if (!nomeCompleto) return '';
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const f = funcionarios.find(x => x.nome === nomeCompleto);
    if (f && f.codinome) return f.codinome;
    return nomeCompleto.trim().split(/\s+/)[0];
}

// Travessia genérica da Árvore Genérica Recursiva (prompt_gemini.md
// §12.31, arvore.js): devolve uma lista achatada de TODOS os nós-folha
// de um array de Etapas — Etapa/Sub-etapa/Pavimento agindo como tarefa
// (sem filho no próximo nível), OU Tarefa de verdade dentro de um
// Pavimento container. Cada item:
// { no: <objeto com os campos de Tarefa>,
//   path: "0"/"0-1"/"0-1-2"/"0-1-2-3" — MESMO formato que
//   arvore.js::visualizarNo()/salvarAlteracoesNo()/removerNo() usam,
//   já serve pra chamar essas funções direto;
//   localizacao: "Nome da Etapa"/"Etapa › Sub-etapa"/"Etapa › Sub-etapa › Pav"
//   — breadcrumb legível pra exibir em telas de lista (Atribuição de
//   Tarefas, Kanban "sob responsabilidade", etc.) }.
// Substitui, em qualquer arquivo que precise varrer a árvore pra achar
// as tarefas, o padrão antigo
// `if (etapa.tipo === 'unica' || etapa.tipo === 'subetapas') {...}`
// (que não existe mais — não há mais campo `tipo`).
// Árvore Genérica Recursiva v2 (prompt_gemini.md §12.31, revisão de
// agosto/2026 — "níveis puláveis, mas ordem obrigatória"): não existem
// mais campos fixos por nível (`etapa.setores`/`setor.pavimentos`/
// `pavimento.tarefas`). Todo nó (Etapa e qualquer filho) guarda seus
// filhos num ÚNICO array `filhos`, e cada filho carrega um campo
// `nivel` ('subetapa'|'pavimento'|'tarefa') dizendo o que ele é. Isso
// permite que uma Etapa tenha uma Sub-etapa, OU um Pavimento direto, OU uma
// Tarefa direto como filho — a ORDEM relativa continua obrigatória
// (Sub-etapa sempre antes de Pavimento, que sempre antes de Tarefa,
// nunca invertido), mas cada nível pode ser PULADO. Etapa continua
// vivendo em `arv.etapas` (array de topo, sem mudança); só o que está
// ABAIXO da Etapa virou genérico.

// Acha um nó em qualquer profundidade, andando pelo path
// ("0", "0-1", "0-1-2", "0-2-1-0" etc.) — primeiro dígito é o índice
// da Etapa em `arv.etapas`, cada dígito seguinte é o índice dentro do
// `.filhos` do nó anterior. Usado por TODO arquivo que precisa achar
// um nó a partir de um "caminho" salvo — substitui os acessos diretos
// tipo `arv.etapas[p[0]].setores[p[1]].pavimentos[p[2]].tarefas[p[3]]`
// que só faziam sentido na hierarquia rígida antiga.
function resolverNoPorPath(arv, path) {
    if (!arv || path === undefined || path === null || path === '') return null;
    const p = String(path).split('-').map(s => parseInt(s, 10));
    let no = arv.etapas[p[0]];
    for (let i = 1; i < p.length; i++) {
        if (!no || !Array.isArray(no.filhos)) return null;
        no = no.filhos[p[i]];
    }
    return no || null;
}

// Um nó é folha quando não tem filhos (array vazio/ausente) — Tarefa é
// sempre folha (nunca tem `.filhos` usado).
function ehNoFolha(no) {
    return !no || !Array.isArray(no.filhos) || no.filhos.length === 0;
}

// Item 5/6/7 (prompt_gemini.md §14, leva 4 — bug confirmado): banco_arvores_projetos
// é indexado por nome de projeto, mas nada garante que toda chave ali
// ainda corresponda a um projeto vivo em banco_projetos — deletar ou
// renomear um projeto no Cadastro podia deixar (ou ainda deixa, se
// veio de antes desta correção) uma árvore órfã sob o nome antigo, que
// o Kanban e a Atribuição de Tarefas mostravam porque liam
// Object.keys(banco_arvores_projetos) direto, sem cruzar com a lista
// atual do Cadastro. deletarProjeto()/salvarProjeto() (cadastros.js)
// já foram corrigidas pra não deixar órfãos NOVOS — esta função aqui é
// o filtro defensivo usado por quem LISTA projetos/tarefas, cobrindo
// tanto órfãos futuros (por segurança) quanto órfãos que já existiam
// no localStorage de antes da correção.
function obterArvoresProjetosAtivas() {
    const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    const projetosCadastro = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const nomesValidos = new Set(projetosCadastro.map(p => p.nome));
    const ativas = {};
    Object.keys(arvores).forEach(nome => {
        if (nomesValidos.has(nome)) ativas[nome] = arvores[nome];
    });
    return ativas;
}

// Devolve uma lista achatada de TODOS os nós-folha de um array de
// Etapas, em QUALQUER profundidade (já que os níveis agora são
// puláveis, não dá mais pra saber de antemão se a folha vai estar a 1,
// 2, 3 ou mais níveis de distância). Cada item:
// { no: <objeto com os campos de Tarefa>, path: "0"/"0-1"/"0-2-0" etc,
//   localizacao: "Etapa › Sub-etapa › Pavimento" — breadcrumb legível,
//   só com os nomes dos nós realmente presentes no caminho até ali }.
function coletarNosFolhaDaArvore(etapas) {
    const resultado = [];
    function caminhar(no, path, breadcrumb) {
        if (ehNoFolha(no)) {
            resultado.push({ no: no, path: path, localizacao: breadcrumb });
            return;
        }
        no.filhos.forEach((filho, idx) => {
            caminhar(filho, path + '-' + idx, breadcrumb + ' › ' + filho.nome);
        });
    }
    (etapas || []).forEach((etapa, fIdx) => {
        caminhar(etapa, '' + fIdx, etapa.nome);
    });
    return resultado;
}

// =========================================================================
// MÓDULO: NÚCLEO (seeds, estado global, navegação entre painéis, boot)
//
// alternarModulo() foi MESCLADO: a versão original do index.html não
// tinha ramos para 'clientes' / 'funcionarios' / 'projetos' — esses
// módulos caíam no branch "else" genérico, que chamava
// renderizarListaLegoComum(modulo) e lia a chave errada do localStorage
// (ex: 'banco_clientes_lego' em vez de 'banco_clientes'). Isso é um bug
// real que existia no index.html original antes desta reorganização.
// Os branches de arvore/bi_calibracao/controladoria_global/catálogo lego
// continuam com a lógica exatamente como estava.
// =========================================================================

// --- MIGRAÇÃO DE NOMENCLATURA (Fase→Etapa, Etapa→Setor, Sub-etapa→Pavimento) ---
// Renomeia dados já salvos no localStorage do navegador de quem testou a
// versão anterior, sem perder nada. Roda uma única vez; depois disso as
// chaves antigas não existem mais e este bloco não faz nada.
(function migrarNomenclaturaAntiga() {
    if (localStorage.getItem('banco_fases_lego') && !localStorage.getItem('banco_etapas_lego')) {
        localStorage.setItem('banco_etapas_lego', localStorage.getItem('banco_fases_lego'));
        localStorage.removeItem('banco_fases_lego');
    }
    if (localStorage.getItem('banco_subetapas_lego') && !localStorage.getItem('banco_pavimentos_lego')) {
        localStorage.setItem('banco_pavimentos_lego', localStorage.getItem('banco_subetapas_lego'));
        localStorage.removeItem('banco_subetapas_lego');
    }

    // Árvores de projeto: troca as chaves de campo (fases→etapas, etapas→setores,
    // subetapas→pavimentos) dentro de cada projeto salvo, recursivamente.
    const marcador = 'banco_arvores_projetos_migrado_v2';
    if (!localStorage.getItem(marcador)) {
        try {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            function migrarNo(no) {
                if (!no || typeof no !== 'object') return no;
                if (Array.isArray(no.fases)) {
                    no.etapas = no.fases.map(f => {
                        if (Array.isArray(f.etapas)) {
                            f.setores = f.etapas.map(e => {
                                if (Array.isArray(e.subetapas)) e.pavimentos = e.subetapas;
                                delete e.subetapas;
                                return e;
                            });
                        }
                        delete f.etapas;
                        return f;
                    });
                    delete no.fases;
                }
                return no;
            }
            Object.keys(arvores).forEach(k => migrarNo(arvores[k]));
            localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcador, '1');
    }

    // Migração v3: campos físicos (tipo_pavimento/area_fisica/peso_esforco)
    // moveram do nível Setor pro nível Pavimento, pra bater com o nome.
    const marcadorV3 = 'banco_arvores_projetos_migrado_v3_nivel_pavimento';
    if (!localStorage.getItem(marcadorV3)) {
        try {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            Object.values(arvores).forEach(proj => {
                if (!Array.isArray(proj.etapas)) return;
                proj.etapas.forEach(etapa => {
                    if (!Array.isArray(etapa.setores)) return;
                    etapa.setores.forEach(setor => {
                        // Se o setor antigo tinha os campos físicos, empurra pro primeiro
                        // pavimento (ou cria um pavimento "Geral" se não houver nenhum ainda).
                        if (setor.tipo_pavimento !== undefined) {
                            if (!Array.isArray(setor.pavimentos)) setor.pavimentos = [];
                            if (setor.pavimentos.length === 0) {
                                setor.pavimentos.push({ nome: 'Geral', tarefas: [] });
                            }
                            setor.pavimentos.forEach(pav => {
                                if (pav.tipo_pavimento === undefined) {
                                    pav.tipo_pavimento = setor.tipo_pavimento;
                                    pav.area_fisica = setor.area_fisica;
                                    pav.peso_esforco = setor.peso_esforco;
                                }
                            });
                            delete setor.tipo_pavimento;
                            delete setor.area_fisica;
                            delete setor.peso_esforco;
                        }
                    });
                });
            });
            localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV3, '1');
    }

    // Migração v4: campo "peso" do catálogo de Tarefas foi renomeado pra
    // "pontos" (mesmo valor, nome novo — decisão de produto pra deixar
    // claro que representa horas razoáveis / pontos de produtividade, não
    // um peso físico como em Pavimentos).
    const marcadorV4 = 'banco_tarefas_lego_migrado_v4_peso_para_pontos';
    if (!localStorage.getItem(marcadorV4)) {
        try {
            const tarefasLego = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
            tarefasLego.forEach(t => {
                if (t.peso !== undefined && t.pontos === undefined) {
                    t.pontos = t.peso;
                    delete t.peso;
                }
                if (t.unidade_fisica === undefined) t.unidade_fisica = '';
            });
            localStorage.setItem('banco_tarefas_lego', JSON.stringify(tarefasLego));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV4, '1');
    }

    // Migração v5 (melhoria #5, prompt_gemini.md §12): Tarefas de Etapa
    // "Única" já criadas antes dessa regra existir tinham executor
    // livre — passam a ter o Analista do projeto correspondente, uma
    // única vez (marcador evita rodar de novo e sobrescrever trocas
    // legítimas feitas por um Administrador depois desta migração).
    const marcadorV5 = 'banco_arvores_projetos_migrado_v5_executor_etapa_unica';
    if (!localStorage.getItem(marcadorV5)) {
        try {
            const projetosCadastro = JSON.parse(localStorage.getItem('banco_projetos')) || [];
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let alterouArvores = false;

            Object.keys(arvores).forEach(nomeProjeto => {
                const projetoCadastro = projetosCadastro.find(p => p.nome === nomeProjeto);
                const nomeAnalista = projetoCadastro ? (projetoCadastro.analista || '') : '';
                if (!nomeAnalista) return; // sem Analista cadastrado, não tem pra onde migrar — deixa como está

                const arv = arvores[nomeProjeto];
                if (!arv || !Array.isArray(arv.etapas)) return;

                arv.etapas.forEach(etapa => {
                    if (etapa.tipo === 'unica' && Array.isArray(etapa.tarefas)) {
                        etapa.tarefas.forEach(tarefa => {
                            if (tarefa.executor !== nomeAnalista) {
                                tarefa.executor = nomeAnalista;
                                alterouArvores = true;
                            }
                        });
                    }
                });
            });

            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV5, '1');
    }

    // Migração v6 (melhoria #18, prompt_gemini.md §12.6): funcionários
    // já cadastrados antes desse campo existir recebem uma
    // `forma_pagamento` inicial, deduzida do Nível (administrador/
    // supervisor/analista = comissionado; executor = hora) — só de
    // largada, o campo continua editável depois pra cobrir exceções
    // (decisão explícita do usuário: é campo independente, não fica
    // preso ao Nível pra sempre).
    const marcadorV6 = 'banco_funcionarios_migrado_v6_forma_pagamento';
    if (!localStorage.getItem(marcadorV6)) {
        try {
            const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            let alterouFuncionarios = false;
            funcionarios.forEach(f => {
                if (f.forma_pagamento === undefined) {
                    f.forma_pagamento = (f.nivel === 'administrador' || f.nivel === 'supervisor' || f.nivel === 'analista') ? 'comissionado' : 'hora';
                    alterouFuncionarios = true;
                }
            });
            if (alterouFuncionarios) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionarios));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV6, '1');
    }

    // Migração v7 (melhoria #18, prompt_gemini.md §12.6): Tarefas já
    // existentes (Subdivididas E Únicas) ganham `responsavel` = mesmo
    // `executor` que já tinham, uma vez só — daí em diante o campo é
    // independente (trocar o Executor só volta a sincronizar o
    // Responsável enquanto ele não tiver sido customizado pra outra
    // pessoa, ver aplicarAtribuicaoExecutorNaTarefa em
    // atribuicao-tarefas.js).
    const marcadorV7 = 'banco_arvores_projetos_migrado_v7_responsavel_tarefa';
    if (!localStorage.getItem(marcadorV7)) {
        try {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let alterouArvores = false;

            function migrarResponsavelTarefa(tarefa) {
                if (tarefa.responsavel === undefined) {
                    tarefa.responsavel = tarefa.executor || '';
                    alterouArvores = true;
                }
            }

            Object.keys(arvores).forEach(nomeProjeto => {
                const arv = arvores[nomeProjeto];
                if (!arv || !Array.isArray(arv.etapas)) return;
                arv.etapas.forEach(etapa => {
                    if (etapa.tipo === 'unica' && Array.isArray(etapa.tarefas)) {
                        etapa.tarefas.forEach(migrarResponsavelTarefa);
                    }
                    (etapa.setores || []).forEach(setor => {
                        (setor.pavimentos || []).forEach(pav => {
                            (pav.tarefas || []).forEach(migrarResponsavelTarefa);
                        });
                    });
                });
            });

            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV7, '1');
    }

    // Migração v8 (melhoria #18/#10, prompt_gemini.md §12.6): sessões de
    // EXECUÇÃO que já estavam ativas ANTES dessa mudança
    // (`sessao_ativa_inicio` existe, mas não o `sessao_ativa_quem`
    // novo) recebem o Executor da própria tarefa como dono da sessão —
    // sem isso, `localizarSessaoAtivaDaPessoa()` não acharia essa sessão
    // pra ninguém (ficaria "órfã", sem dono, até alguém pausar na mão).
    const marcadorV8 = 'banco_arvores_projetos_migrado_v8_sessao_ativa_quem';
    if (!localStorage.getItem(marcadorV8)) {
        try {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let alterouArvores = false;

            function migrarSessaoAtivaQuem(tarefa) {
                if (tarefa.sessao_ativa_inicio && tarefa.sessao_ativa_quem === undefined) {
                    tarefa.sessao_ativa_quem = tarefa.executor || null;
                    alterouArvores = true;
                }
            }

            Object.keys(arvores).forEach(nomeProjeto => {
                const arv = arvores[nomeProjeto];
                if (!arv || !Array.isArray(arv.etapas)) return;
                arv.etapas.forEach(etapa => {
                    if (etapa.tipo === 'unica' && Array.isArray(etapa.tarefas)) {
                        etapa.tarefas.forEach(migrarSessaoAtivaQuem);
                    }
                    (etapa.setores || []).forEach(setor => {
                        (setor.pavimentos || []).forEach(pav => {
                            (pav.tarefas || []).forEach(migrarSessaoAtivaQuem);
                        });
                    });
                });
            });

            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV8, '1');
    }

    // Migração v9 (pedido explícito do usuário, depois de encontrar o
    // caso real "Duo Praia Brava" com executor "Carlos"/"Eliomar" —
    // nomes que não existem mais no Cadastro de Funcionários):
    // sobrescreve de vez, no dado gravado (não só na exibição — isso já
    // tinha sido corrigido antes só como fallback de leitura em
    // atribuicao-tarefas.js), qualquer `tarefa.executor`/
    // `tarefa.responsavel`/`etapa.responsavel` que aponte pra um nome
    // órfão. Mesma regra de fallback já fechada: Executor órfão vira o
    // Detalhista do projeto (ou vazio, se o Detalhista também não
    // existir/não estiver definido); Responsável órfão vira o
    // Responsável da Etapa (se válido) ou o Analista do projeto (ou
    // vazio). Roda uma vez só — depois disso o dado já está limpo,
    // rodar de novo seria inofensivo mas desnecessário.
    const marcadorV9 = 'banco_arvores_projetos_migrado_v9_nomes_orfaos';
    if (!localStorage.getItem(marcadorV9)) {
        try {
            const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            const projetosCadastro = JSON.parse(localStorage.getItem('banco_projetos')) || [];
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let alterouArvores = false;

            const nomeValido = (nome) => !!nome && funcionarios.some(f => f.nome === nome);

            Object.keys(arvores).forEach(nomeProjeto => {
                const arv = arvores[nomeProjeto];
                if (!arv || !Array.isArray(arv.etapas)) return;

                const projCadastro = projetosCadastro.find(p => p.nome === nomeProjeto);
                const detalhistaDoProjeto = (projCadastro && nomeValido(projCadastro.detalhista)) ? projCadastro.detalhista : '';
                const analistaDoProjeto = (projCadastro && nomeValido(projCadastro.analista)) ? projCadastro.analista : '';

                function corrigirTarefa(tarefa, etapaResponsavelValido) {
                    if (tarefa.executor && !nomeValido(tarefa.executor)) {
                        tarefa.executor = detalhistaDoProjeto;
                        alterouArvores = true;
                    }
                    if (tarefa.responsavel && !nomeValido(tarefa.responsavel)) {
                        tarefa.responsavel = etapaResponsavelValido || analistaDoProjeto;
                        alterouArvores = true;
                    }
                }

                arv.etapas.forEach(etapa => {
                    if (etapa.responsavel && !nomeValido(etapa.responsavel)) {
                        etapa.responsavel = '';
                        alterouArvores = true;
                    }
                    const etapaResponsavelValido = (etapa.responsavel && nomeValido(etapa.responsavel)) ? etapa.responsavel : '';

                    if (etapa.tipo === 'unica') {
                        (etapa.tarefas || []).forEach(t => corrigirTarefa(t, ''));
                        return;
                    }
                    (etapa.setores || []).forEach(setor => {
                        (setor.pavimentos || []).forEach(pav => {
                            (pav.tarefas || []).forEach(t => corrigirTarefa(t, etapaResponsavelValido));
                        });
                    });
                });
            });

            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV9, '1');
    }

    // Migração v10 — bug real encontrado pelo usuário: os 3
    // funcionários de exemplo (seed) já estavam salvos no localStorage
    // de quem já tinha usado o sistema, SEM nenhum `nivel` — corrige o
    // que já está gravado (a correção do array `funcionariosSeed`, mais
    // abaixo neste arquivo, só vale pra quem parte de uma instalação
    // nova/vazia, não alcança dado já salvo). Identifica pelo nome
    // exato (só esses 3, não mexe em funcionário real cadastrado pelo
    // usuário que porventura também esteja sem nível por outro motivo).
    const marcadorV10 = 'banco_funcionarios_migrado_v10_seed_sem_nivel';
    if (!localStorage.getItem(marcadorV10)) {
        try {
            const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            const niveisSeedConhecidos = {
                'Carlos Eduardo (Senior)': 'administrador',
                'Fernanda Almeida (Pleno)': 'supervisor',
                'Julia Santos (Estagiária)': 'executor'
            };
            let alterouFuncionarios = false;
            funcionarios.forEach(f => {
                if (!f.nivel && niveisSeedConhecidos[f.nome]) {
                    f.nivel = niveisSeedConhecidos[f.nome];
                    alterouFuncionarios = true;
                }
            });
            if (alterouFuncionarios) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionarios));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV10, '1');
    }

    // Migração v11 — Codinome voltou a ser campo digitado (era
    // calculado automático do primeiro nome antes). Pedido do usuário:
    // funcionário já cadastrado sem `codinome` recebe o primeiro nome
    // atual como valor inicial, uma vez só — editável depois, igual
    // qualquer outro cadastro. Não resolve sozinho uma eventual colisão
    // (dois "David", por exemplo) — a validação de único em
    // salvarFuncionario() só vale daqui pra frente, pra quem editar;
    // se dois migrados aqui ficarem com o mesmo codinome, precisa
    // ajustar manualmente um deles no Cadastro de Funcionários.
    const marcadorV11 = 'banco_funcionarios_migrado_v11_codinome_retroativo';
    if (!localStorage.getItem(marcadorV11)) {
        try {
            const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            let alterouFuncionarios = false;
            funcionarios.forEach(f => {
                if (!f.codinome && f.nome) {
                    f.codinome = f.nome.trim().split(/\s+/)[0];
                    alterouFuncionarios = true;
                }
            });
            if (alterouFuncionarios) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionarios));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV11, '1');
    }

    // Migração v12 — Reforma Setor→Sub-etapa (ver CHANGELOG.md): retag
    // genérico de qualquer nó `nivel === 'setor'`, em qualquer projeto/
    // profundidade, pra `nivel === 'subetapa'`. Sem suposição de nome —
    // roda igual pra qualquer projeto, é no-op pra quem não tem nó
    // nenhum nesse nível.
    const marcadorV12 = 'banco_arvores_projetos_migrado_v12_setor_para_subetapa';
    if (!localStorage.getItem(marcadorV12)) {
        try {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let alterouArvores = false;
            function retagSetorParaSubetapa(no) {
                if (!no || typeof no !== 'object') return;
                if (no.nivel === 'setor') { no.nivel = 'subetapa'; alterouArvores = true; }
                (no.filhos || []).forEach(retagSetorParaSubetapa);
            }
            Object.values(arvores).forEach(arv => (arv.etapas || []).forEach(retagSetorParaSubetapa));
            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));

            // Catálogo: banco_setores_lego -> banco_subetapas_lego.
            // IMPORTANTE: `banco_subetapas_lego` pode já existir como
            // dado ÓRFÃO de uma nomenclatura AINDA MAIS antiga (quando
            // "Sub-etapa" era o nome do que hoje é Pavimento — ver a
            // migração de nomenclatura antiga logo acima, linhas
            // ~169-172). Esse dado órfão nunca é lido por nenhum código
            // atual (confirmado — só a migração antiga o referenciava,
            // condicionada a `banco_pavimentos_lego` não existir, que
            // já existe há muito tempo em qualquer instalação real).
            // Por isso aqui SOBRESCREVE sem checar se já existe — o
            // conteúdo real e em uso hoje é sempre o de
            // `banco_setores_lego`, nunca o órfão.
            if (localStorage.getItem('banco_setores_lego')) {
                localStorage.setItem('banco_subetapas_lego', localStorage.getItem('banco_setores_lego'));
                localStorage.removeItem('banco_setores_lego');
            }
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV12, '1');
    }

    // Migração v13 — Reforma Setor→Sub-etapa (parte 2): empacota as 4
    // etapas legadas "achatadas" (Pré-Lançamento/Lançamento/Análise/
    // Cargas — Etapas de topo sem `nivel`) dentro de uma nova Etapa
    // "Análise Global", como Sub-etapas. Casamento por nome SEM
    // diferenciar maiúsculas/minúsculas (dado real de produção tem
    // esses nomes em CAIXA ALTA — "PRÉ-LANÇAMENTO" etc. — enquanto o
    // catálogo seed usa Title Case; confirmado testando contra os
    // dados reais antes de subir, ver CHANGELOG.md) e PARCIAL (empacota
    // só as que existirem — projeto sem nenhuma das 4 é no-op; projeto
    // que já tem uma Etapa "Análise Global" é pulado, defensivo, pra
    // nunca duplicar/colidir). O nome ORIGINAL do nó nunca é alterado —
    // só a detecção ignora caixa.
    // `peso_esforco="1"` em todas + `area_fisica` = o % que a etapa já
    // tinha salvo (Distribuição de Custos) faz a Área Equivalente entre
    // elas reproduzir EXATAMENTE a proporção de % que já existia — os
    // números não mudam pro usuário depois da migração. Roda DEPOIS da
    // v12 (precisa do retag pra Sub-etapa já ter acontecido, mas não
    // depende diretamente dele — só da ordem de execução no arquivo).
    const marcadorV13 = 'banco_arvores_projetos_migrado_v13_analise_global';
    if (!localStorage.getItem(marcadorV13)) {
        try {
            const NOMES_ETAPAS_LEGADAS_NORMALIZADOS = ['pré-lançamento', 'lançamento', 'análise', 'cargas'];
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            const salvosAnalista = JSON.parse(localStorage.getItem('banco_distribuicao_custos_analista')) || {};
            let alterouArvores = false, alterouAnalista = false;

            Object.keys(arvores).forEach(nomeProjeto => {
                const arv = arvores[nomeProjeto];
                if (!arv || !Array.isArray(arv.etapas)) return;
                if (arv.etapas.some(e => e.nome.toLowerCase() === 'análise global')) return; // já existe, não mexe

                const encontrados = [];
                arv.etapas.forEach((e, idx) => {
                    if (!e.nivel && NOMES_ETAPAS_LEGADAS_NORMALIZADOS.indexOf((e.nome || '').toLowerCase()) !== -1) encontrados.push({ etapa: e, idx: idx });
                });
                if (encontrados.length === 0) return; // projeto não tem essa forma legada — no-op

                const primeiroIdx = Math.min.apply(null, encontrados.map(function (f) { return f.idx; }));
                const salvoProjeto = salvosAnalista[nomeProjeto] || {};
                const salvoEtapas = salvoProjeto.etapas || salvoProjeto;
                let somaPct = 0;

                const subetapas = encontrados.map(function (f) {
                    const etapa = f.etapa;
                    etapa.nivel = 'subetapa';
                    const dadosEtapa = salvoEtapas[etapa.nome];
                    const pctSalvo = (dadosEtapa && dadosEtapa.pct !== undefined && dadosEtapa.pct !== '') ? (parseFloat(dadosEtapa.pct) || 0) : 0;
                    somaPct += pctSalvo;
                    etapa.peso_esforco = "1";
                    etapa.area_fisica = String(pctSalvo);
                    return etapa;
                });

                const idxsRemover = {};
                encontrados.forEach(function (f) { idxsRemover[f.idx] = true; });
                arv.etapas = arv.etapas.filter(function (e, idx) { return !idxsRemover[idx]; });

                const analiseGlobal = {
                    nome: "Análise Global", status: "Apontada", executor: "", responsavel: "",
                    custo_max: "0", qtd_fisica: "0", unidade_fisica: "-", pontos: "0",
                    horas_reais: "0.0", is_outlier: false, verba: "0", filhos: subetapas
                };
                arv.etapas.splice(Math.min(primeiroIdx, arv.etapas.length), 0, analiseGlobal);
                alterouArvores = true;

                if (somaPct > 0) {
                    if (!salvosAnalista[nomeProjeto]) salvosAnalista[nomeProjeto] = { etapas: {} };
                    if (!salvosAnalista[nomeProjeto].etapas) salvosAnalista[nomeProjeto].etapas = salvoEtapas;
                    salvosAnalista[nomeProjeto].etapas['Análise Global'] = { pct: String(somaPct) };
                    alterouAnalista = true;
                }

                // Coparticipação: única exceção deliberada de nome-match
                // no código novo, só aqui na migração — marca a Etapa
                // que já se chamava "Detalhamento" como tendo
                // Coparticipação habilitada, pra preservar o
                // comportamento de hoje sem exigir que o usuário
                // reconfigure manualmente depois do upgrade.
                const etapaDet = arv.etapas.find(function (e) { return e.nome.toLowerCase().indexOf('detalhamento') !== -1; });
                if (etapaDet) { etapaDet.tem_coparticipacao = true; alterouArvores = true; }
            });

            if (alterouArvores) localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
            if (alterouAnalista) localStorage.setItem('banco_distribuicao_custos_analista', JSON.stringify(salvosAnalista));

            const etapasLego = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
            if (!etapasLego.some(function (e) { return e.nome === 'Análise Global'; })) {
                etapasLego.push({ nome: 'Análise Global', base_h: '2.0' });
                localStorage.setItem('banco_etapas_lego', JSON.stringify(etapasLego));
            }
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV13, '1');
    }

    // Migração v14 (revisão 2026-09-01, item 12): pedido do usuário — "as
    // únicas etapas cadastradas deverão ser Análise Global e
    // Detalhamento; as demais serão sub-etapas e devem estar no
    // cadastro de sub-etapas". Feito só a metade ADITIVA aqui —
    // qualquer nome do catálogo de Etapa que não seja "Detalhamento"
    // nem "Análise Global" entra no catálogo de Sub-etapa (se ainda não
    // estiver lá). NÃO remove nada de banco_etapas_lego automaticamente
    // (ver por quê abaixo) — a remoção final é 1 clique manual no
    // 🗑️ de cada linha, em Cadastro → Gestão de Etapas (já existe,
    // não precisou de UI nova).
    //
    // Por que não remove sozinho: a trava de sanidade do sync
    // (_syncSnapshotPareceIncompleto, sync-provisorio.js, criada depois
    // do incidente real de 2026-08-31 documentado no CHANGELOG) bloqueia
    // qualquer ENVIO que encolha uma lista "de verdade" (>=5 itens) pra
    // menos da metade — banco_etapas_lego tem 8 itens hoje, a lista
    // final teria 2 (75% de encolhimento), então cairia direto nesse
    // bloqueio pra QUALQUER cliente que tentasse migrar sozinho: a
    // mudança ficaria só local, nunca sincronizaria, e a cada
    // recarregamento um PULL traria de volta os 8 itens do servidor —
    // um loop sem saída automática. Descoberto testando contra o app
    // real antes de considerar isso pronto (não é hipotético). A
    // exclusão manual, um item de cada vez, fica bem abaixo desse
    // limite e sincroniza normalmente.
    const marcadorV14 = 'banco_etapas_lego_migrado_v14_so_detalhamento_analise_global';
    if (!localStorage.getItem(marcadorV14)) {
        try {
            const NOMES_ETAPA_PERMITIDOS_NORMALIZADOS = ['detalhamento', 'análise global'];
            const etapasLego = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
            const subetapasLego = JSON.parse(localStorage.getItem('banco_subetapas_lego')) || [];

            let alterouSubetapas = false;
            etapasLego.forEach(function (e) {
                const nomeNormalizado = (e.nome || '').toLowerCase();
                if (NOMES_ETAPA_PERMITIDOS_NORMALIZADOS.indexOf(nomeNormalizado) !== -1) return;
                const jaExiste = subetapasLego.some(function (s) { return (s.nome || '').toLowerCase() === nomeNormalizado; });
                if (!jaExiste) { subetapasLego.push(e); alterouSubetapas = true; }
            });
            if (alterouSubetapas) localStorage.setItem('banco_subetapas_lego', JSON.stringify(subetapasLego));
        } catch (e) { /* nada salvo ainda, sem problema */ }
        localStorage.setItem(marcadorV14, '1');
    }
})();

// --- SEEDS INICIAIS (idênticos ao index.html original, exceto o
// campo `nivel` novo abaixo — bug real encontrado: os 3 funcionários
// de exemplo nunca tiveram nível nenhum, e o login automático do
// MODO_TESTE_SEM_LOGIN procura primeiro um Administrador; sem achar
// nenhum, cai no primeiro da lista SEM nível reconhecido, travando
// esse funcionário no menu mais restrito (Executor) — sem acesso a
// Cadastros/Configurações, ou seja, sem NENHUM caminho pela interface
// pra corrigir a própria situação (nem a tela de Restaurar Backup,
// já que a de Login também é pulada nesse modo). `forma_pagamento`
// não precisa ser adicionado aqui — a migração v6 já deriva
// automaticamente pelo nível, na próxima vez que o app carregar.) ---
const funcionariosSeed = [
    { nome: "Carlos Eduardo (Senior)", codinome: "Carlos", cpf: "111.222.333-44", cargo: "Senior", hora: "100", nivel: "administrador" },
    { nome: "Fernanda Almeida (Pleno)", codinome: "Fernanda", cpf: "222.333.444-55", cargo: "Pleno", hora: "50", nivel: "supervisor" },
    { nome: "Julia Santos (Estagiária)", codinome: "Julia", cpf: "333.444.555-66", cargo: "Estagiária", hora: "25", nivel: "executor" }
];
const projetosSeed = [{ nome: "Residencial Excellence", prefixo: "PRJ-BC-01", cliente: "Pasqualotto & GT" }];
const componentesSeed = {
    etapas: [{ nome: "Detalhamento Estrutural" }],
    subetapas: [{ nome: "Pavimento Térreo" }, { nome: "Tipo Padrão" }],
    pavimentos: [{ nome: "Dimensionamento de Vigas" }],
    tarefas: [{ nome: "Detalhamento de vigas", base_h: "2.0", pontos: "1.0", unidade_fisica: "m³" }]
};

if (!localStorage.getItem('banco_clientes')) localStorage.setItem('banco_clientes', JSON.stringify([{ nome: "Pasqualotto & GT Empreendimentos", cnpj: "17.234.567/0001-80" }]));
if (!localStorage.getItem('banco_funcionarios')) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionariosSeed));
if (!localStorage.getItem('banco_projetos')) localStorage.setItem('banco_projetos', JSON.stringify(projetosSeed));

['etapas', 'subetapas', 'pavimentos', 'tarefas'].forEach(cat => {
    if (!localStorage.getItem('banco_' + cat + '_lego')) localStorage.setItem('banco_' + cat + '_lego', JSON.stringify(componentesSeed[cat]));
});

if (!localStorage.getItem('banco_arvores_projetos')) localStorage.setItem('banco_arvores_projetos', JSON.stringify({}));
if (!localStorage.getItem('banco_fator_coparticipacao')) localStorage.setItem('banco_fator_coparticipacao', "0.52");

// --- ESTADO GLOBAL (idêntico ao index.html original) ---
// As variáveis de cronômetro (tarefaAtivaCronometro, ponteiroIntervalId,
// tempoDecorridoSessao, timestampInicioSessao, pingIntervalId,
// pingCountdownIntervalId) foram movidas pra js_estacionado/timesheet_executor.js
// junto com a engine que as usa — ver nota lá.
const relacaoIndicesDesempenho = ["m2 (Área de Laje)", "un (Nº de Elementos/Vigas)", "kg (Peso de Aço)", "m3 (Volume de Concreto)"];
let nosRecolhidosEstado = {};
let projetoSelecionadoAtivo = "";

// --- NAVEGAÇÃO ---
// toggleArvoreCadastro() e escolherOpcaoCadastro() (do antigo submenu
// em cascata de Cadastro) removidas — a tela de Cadastro agora é
// #panel-cadastro com abas internas, aberta direto por
// alternarModulo('cadastro') e trocada por alternarAbaCadastro().

function limparWorkspace() {
    if (typeof fecharSessaoCronometroSilencioso === 'function') fecharSessaoCronometroSilencioso();
    document.querySelectorAll('.sidebar .menu-item, .submenu .menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-blank-state').style.display = 'flex';
    document.getElementById('page-context-title').innerText = "Aguardando Ação";

    // Usa as funções de renderização completas (com clique para editar e excluir)
    // em vez da renderização simplificada e somente-leitura que existia antes.
    renderizarTabelaClientes();
    renderizarTabelaFuncionarios();
    renderizarTabelaProjetos();
}

function filtrarTabela(modulo) {
    const filter = document.getElementById('search-' + modulo).value.toLowerCase();
    const rows = document.getElementById('tabela-' + modulo + '-body').getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) rows[i].style.display = rows[i].innerText.toLowerCase().indexOf(filter) > -1 ? "" : "none";
}

// Cadastro em abas (pedido do usuário) — substitui o antigo menu em
// cascata (7 itens sempre visíveis na barra lateral) por 1 item só
// ("📝 Cadastro"), que abre uma tela com essas 7 abas dentro.
const ABAS_CADASTRO = ['clientes', 'funcionarios', 'projetos', 'etapas', 'subetapas', 'pavimentos', 'tarefas', 'feriados'];
let cadAbaAtiva = 'clientes'; // lembra a última aba usada, mesmo padrão de aprovAbaAtiva (aprovacoes-calendario.js)

function abrirAbaCadastro(modulo) {
    cadAbaAtiva = modulo;
    const painelCadastro = document.getElementById('panel-cadastro');
    if (painelCadastro) painelCadastro.style.display = 'flex';

    // Esconde os 10 sub-painéis (3 pares lista/form + 4 só-lista),
    // mostra só a "-lista" da aba escolhida — a "-form" (editar/criar)
    // continua sendo aberta à parte por abrirFormulario()/fecharFormulario(),
    // que já existiam e não precisaram mudar.
    document.querySelectorAll('.sub-panel-cadastro').forEach(p => p.style.display = 'none');
    const painelLista = document.getElementById('panel-' + modulo + '-lista');
    if (painelLista) painelLista.style.display = 'flex';

    ABAS_CADASTRO.forEach(m => {
        const aba = document.getElementById('cad-aba-' + m);
        if (aba) aba.classList.toggle('aprov-aba-ativa', m === modulo);
    });

    const titulosPorAba = {
        clientes: 'Gestão de Clientes',
        funcionarios: 'Gestão de Funcionários',
        projetos: 'LISTA DE PROJETOS',
        etapas: 'Gestão de ETAPAS',
        subetapas: 'Gestão de SUB-ETAPAS',
        pavimentos: 'Gestão de LOCAIS',
        tarefas: 'Gestão de TAREFAS',
        feriados: 'Feriados'
    };
    document.getElementById('page-context-title').innerText = titulosPorAba[modulo] || 'Cadastro';

    if (modulo === 'clientes') renderizarTabelaClientes();
    else if (modulo === 'funcionarios') renderizarTabelaFuncionarios();
    else if (modulo === 'projetos') renderizarTabelaProjetos();
    // Pedido do usuário (prompt_gemini.md §14, item 1): Feriados virou
    // aba do Cadastro em vez de item próprio no menu principal — tela
    // própria (calendário de feriados), não o padrão genérico de
    // catálogo (Etapas/Sub-etapas/Pavimentos/Tarefas).
    else if (modulo === 'feriados') carregarPainelFeriados();
    else renderizarListaLegoComum(modulo); // etapas/subetapas/pavimentos/tarefas
}

// Pedido do usuário: quando um Projeto está "aberto" (na Árvore/Estrutura
// de Projeto OU na Distribuição de Custos dele), o título principal da
// tela mostra o NOME do projeto (em vez de um rótulo genérico), e logo
// abaixo aparecem 2 "orelhas" (abas) — Estrutura de Projeto / Custos —
// pra pular de uma pra outra sem re-escolher o projeto. Sem projeto
// aberto, a barra de orelhas fica escondida e cada tela cuida do seu
// próprio título genérico (esta função só MEXE no título quando HÁ
// projeto — ver `nomeProjeto` vazio abaixo).
function atualizarOrelhasProjetoAtivo(nomeProjeto, abaAtiva) {
    const barra = document.getElementById('orelhas-projeto-ativo');
    if (!barra) return;
    if (!nomeProjeto) {
        barra.style.display = 'none';
        return;
    }
    barra.style.display = 'flex';
    document.getElementById('page-context-title').innerText = nomeProjeto;
    const orelhaEstrutura = document.getElementById('orelha-estrutura-projeto');
    const orelhaCustos = document.getElementById('orelha-custos-projeto');
    const orelhaDetalhamento = document.getElementById('orelha-detalhamento-projeto');
    const orelhaDiagnostico = document.getElementById('orelha-diagnostico-projeto');
    const orelhaBonificacao = document.getElementById('orelha-bonificacao-projeto');
    if (orelhaEstrutura) orelhaEstrutura.classList.toggle('active', abaAtiva === 'estrutura');
    if (orelhaCustos) orelhaCustos.classList.toggle('active', abaAtiva === 'custos');
    // Reforma de orelhas (prompt_gemini.md, retomada 2026-08-25): as
    // orelhas "Desempenho" (Produtividade) e "Distribuições"
    // (Financeira) viraram sub-abas DENTRO de uma única orelha
    // "Detalhamento" — as duas continuam mandando 'desempenho'/
    // 'distribuicoes' aqui (irParaDesempenhoDoProjetoAtivo()/
    // irParaDistribuicoesDoProjetoAtivo() não mudaram), só que agora as
    // duas acendem a MESMA orelha de topo; qual sub-aba (.subaba-pill)
    // fica marcada como ativa é decidido estaticamente no HTML de cada
    // painel (#panel-desempenho-projeto/#panel-distribuicoes-projeto),
    // não aqui.
    if (orelhaDetalhamento) orelhaDetalhamento.classList.toggle('active', abaAtiva === 'desempenho' || abaAtiva === 'distribuicoes');
    if (orelhaDiagnostico) orelhaDiagnostico.classList.toggle('active', abaAtiva === 'diagnostico');
    if (orelhaBonificacao) orelhaBonificacao.classList.toggle('active', abaAtiva === 'bonificacao');
}

function alternarModulo(modulo) {
    document.getElementById('panel-blank-state').style.display = 'none';
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');

    // As "orelhas" (Estrutura de Projeto/Custos) só fazem sentido dentro
    // do fluxo de Projeto — indo pra QUALQUER outro módulo, escondem.
    // 'arvore' fica de fora daqui de propósito: fecharProjetoAtivoNaArvore()
    // (chamada logo abaixo) já decide se mostra ou esconde, conforme tinha
    // ou não um projeto aberto antes.
    if (modulo !== 'arvore' && typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo('', null);

    if (document.getElementById('nav-' + modulo)) document.getElementById('nav-' + modulo).classList.add('active');

    if (modulo === 'arvore') {
        document.getElementById('panel-arvore-projetos').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Estrutura de Projeto Construtiva";
        // Sempre volta pra tela "Escolha o projeto estrutural" ao reabrir
        // o menu — antes ficava mostrando o último projeto aberto, o que
        // a diretoria achou confuso. fecharProjetoAtivoNaArvore() já faz
        // exatamente esse reset (e é seguro chamar mesmo na primeiríssima
        // vez, antes de qualquer projeto ter sido aberto).
        fecharProjetoAtivoNaArvore();
        renderizerProjetosParaSelecaoArvore();
    } else if (modulo === 'bi_calibracao') {
        document.getElementById('panel-bi-calibracao').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Business Intelligence - Catálogo Base";
        renderizarPainelCalibracaoBI();
    } else if (modulo === 'controladoria_global') {
        document.getElementById('panel-controladoria-global').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Controladoria - Distribuição Periódica";
        renderizarControladoriaGlobalFechamento();
    } else if (modulo === 'distribuicao_lucro') {
        document.getElementById('panel-distribuicao-lucro').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Distribuição de Lucro (Estagiários)";
        carregarPainelDistribuicaoLucro();
    } else if (modulo === 'distribuicao_custos') {
        document.getElementById('panel-distribuicao-custos').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Distribuição de Custos";
        carregarPainelDistribuicaoCustos();
    } else if (modulo === 'atribuicao_tarefas') {
        document.getElementById('panel-atribuicao-tarefas').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Atribuição de Tarefas";
        carregarPainelAtribuicaoTarefas();
    } else if (modulo === 'kanban') {
        document.getElementById('panel-kanban').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Kanban";
        carregarPainelKanban();
    } else if (modulo === 'aprovacoes_calendario') {
        document.getElementById('panel-aprovacoes_calendario').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Aprovações";
        renderizarPainelAprovacoes();
    } else if (modulo === 'relatorios') {
        document.getElementById('panel-relatorios').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Relatórios";
        carregarPainelRelatorios();
    } else if (modulo === 'cadastro') {
        // Item novo do menu — abre a tela de Cadastro em abas, na
        // última aba usada (ou "clientes" na primeira vez).
        abrirAbaCadastro(cadAbaAtiva);
    } else if (ABAS_CADASTRO.includes(modulo)) {
        // As 7 abas de dentro de #panel-cadastro (Clientes,
        // Funcionários, Projetos, Etapas, Sub-etapas, Pavimentos, Tarefas)
        // chamam alternarModulo(modulo) direto — mesma função que
        // fecharFormulario() já chama pra voltar da tela de edição pra
        // lista, sem precisar de um caminho separado.
        abrirAbaCadastro(modulo);
    } else if (modulo === 'progresso') {
        document.getElementById('panel-progresso').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Dashboard";
        if (typeof renderizarPainelProgresso === 'function') renderizarPainelProgresso();
    } else if (modulo === 'configuracoes') {
        document.getElementById('panel-configuracoes').style.display = 'flex';
        document.getElementById('page-context-title').innerText = "Configurações";
    }

    if (typeof aplicarMascarasLocais === 'function') aplicarMascarasLocais();
}

// Hub "📁 Projetos" (prompt_gemini.md §14, item 2): Distribuição de
// Custos e Estrutura de Projeto agora compartilham a mesma seleção de
// projeto (`projetoSelecionadoAtivo`, já existia só pra Árvore) — esses
// 2 atalhos deixam pular de um pro outro SEM re-escolher o projeto.
// O item de menu "📁 Projetos" continua sendo `nav-arvore`/`alternarModulo('arvore')`
// por baixo (é a mesma tela "Escolha o Projeto" de sempre) — só o
// rótulo visível mudou; nenhum painel novo foi necessário.
function irParaDistribuicaoCustosDoProjetoAtivo() {
    const nome = projetoSelecionadoAtivo;
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-distribuicao-custos').style.display = 'flex';
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nome, 'custos');
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    carregarPainelDistribuicaoCustos();
    escolherProjetoDistribuicaoInicial(nome);
}

// Pedido do usuário: 3ª orelha do Hub "📁 Projetos", ao lado de
// Estrutura de Projeto/Custos — mostra horas previstas×realizadas,
// custo real, % de conclusão e o saldo (verba − custo) do projeto
// (ver js/desempenho-projeto.js pelos cálculos). Mesmo padrão de
// irParaDistribuicaoCustosDoProjetoAtivo() acima, mas com a mesma
// cautela de irParaEstruturaProjetoDoProjetoAtivo() quanto à origem do
// nome do projeto: `projetoSelecionadoAtivo` cobre quem vem da
// Estrutura de Projeto, mas quem abriu o projeto direto pelo portal da
// Distribuição de Custos nunca passou por ali — nesse caso o nome só
// existe no select `#dc-projeto`.
function irParaDesempenhoDoProjetoAtivo() {
    const elProjeto = document.getElementById('dc-projeto');
    const nome = projetoSelecionadoAtivo || (elProjeto ? elProjeto.value : '');
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-desempenho-projeto').style.display = 'flex';
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nome, 'desempenho');
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    if (typeof carregarPainelDesempenho === 'function') carregarPainelDesempenho(nome);
}

// 4ª orelha do Hub "📁 Projetos" — leituras automáticas (Diagnóstico)
// em cima dos mesmos dados de Desempenho, ver
// js/desempenho-projeto.js::calcularDiagnosticoProjeto(). Mesmo padrão
// de origem do nome do projeto que irParaDesempenhoDoProjetoAtivo().
function irParaDiagnosticoDoProjetoAtivo() {
    const elProjeto = document.getElementById('dc-projeto');
    const nome = projetoSelecionadoAtivo || (elProjeto ? elProjeto.value : '');
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-diagnostico-projeto').style.display = 'flex';
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nome, 'diagnostico');
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    if (typeof carregarPainelDiagnostico === 'function') carregarPainelDiagnostico(nome);
}

// 5ª orelha do Hub "📁 Projetos" — Bonificação (Lucro/Sobra e
// Bonificação por Executor, rateio da Verba Global em 3 blocos), ver
// js/desempenho-projeto.js::calcularBonificacaoProjeto(). Mesmo padrão
// de origem do nome do projeto das outras orelhas.
function irParaBonificacaoDoProjetoAtivo() {
    const elProjeto = document.getElementById('dc-projeto');
    const nome = projetoSelecionadoAtivo || (elProjeto ? elProjeto.value : '');
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-bonificacao-projeto').style.display = 'flex';
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nome, 'bonificacao');
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    if (typeof carregarPainelBonificacao === 'function') carregarPainelBonificacao(nome);
}

// 6ª orelha do Hub "📁 Projetos" — Distribuições (relatório editorial
// de bonificação, formato trazido pelo usuário de um Artifact de
// referência), ver js/desempenho-projeto.js::calcularDistribuicoesProjeto().
// Mesmo padrão de origem do nome do projeto das outras orelhas.
function irParaDistribuicoesDoProjetoAtivo() {
    const elProjeto = document.getElementById('dc-projeto');
    const nome = projetoSelecionadoAtivo || (elProjeto ? elProjeto.value : '');
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-distribuicoes-projeto').style.display = 'flex';
    if (typeof atualizarOrelhasProjetoAtivo === 'function') atualizarOrelhasProjetoAtivo(nome, 'distribuicoes');
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    if (typeof carregarPainelDistribuicoes === 'function') carregarPainelDistribuicoes(nome);
}

function irParaEstruturaProjetoDoProjetoAtivo() {
    const elProjeto = document.getElementById('dc-projeto');
    const nome = elProjeto ? elProjeto.value : '';
    if (!nome) return;
    document.querySelectorAll('.content-panel').forEach(panel => panel.style.display = 'none');
    document.getElementById('panel-arvore-projetos').style.display = 'flex';
    document.querySelectorAll('.submenu .menu-item, .sidebar .menu-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('nav-arvore')) document.getElementById('nav-arvore').classList.add('active');
    abrirProjetoNaArvore(nome);
}

// --- BACKUP E RESTAURAÇÃO COMPLETA ---
// Sistema todo baseado em localStorage (sem servidor) — se o navegador
// perder esses dados (limpeza de cache, troca de máquina, etc.), não
// existe outro lugar pra recuperar. Toda chave relevante do sistema
// segue a convenção `banco_*` (sem exceção — conferido em julho/2026),
// então não precisamos manter uma lista fixa de chaves aqui: qualquer
// chave nova que algum módulo futuro criar já entra automaticamente no
// backup, desde que siga a mesma convenção de prefixo.

// Monta o payload do backup — função pura (recebe as chaves e um
// getter, não lê localStorage direto), testável isolada.
function montarPayloadBackup(chavesLocalStorage, getItem) {
    const dados = {};
    chavesLocalStorage.forEach(chave => {
        if (chave.indexOf('banco_') === 0) dados[chave] = getItem(chave);
    });
    return { versao: 1, dataExportacao: new Date().toISOString(), dados: dados };
}

function baixarBackupCompleto() {
    const payload = montarPayloadBackup(Object.keys(localStorage), k => localStorage.getItem(k));

    if (Object.keys(payload.dados).length === 0) {
        alert('Não há dados pra fazer backup ainda.');
        return;
    }

    const dataArquivo = payload.dataExportacao.slice(0, 10); // "AAAA-MM-DD"
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'backup_precisao_estrutural_' + dataArquivo + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Confere se o arquivo escolhido parece mesmo um backup deste sistema
// antes de mexer em qualquer coisa. Função pura, testável isolada.
function validarPayloadBackup(payload) {
    if (!payload || typeof payload !== 'object') return 'Arquivo inválido: não é um JSON válido.';
    if (!payload.dados || typeof payload.dados !== 'object') return 'Arquivo inválido: não parece um backup deste sistema.';
    if (Object.keys(payload.dados).length === 0) return 'Arquivo de backup está vazio.';
    return null; // válido
}

// Aplica a restauração de verdade — LIMPA toda chave `banco_*` que já
// existe (a restauração é um "ponto no tempo", não uma mesclagem: dado
// criado DEPOIS do backup não deveria sobreviver à restauração) e
// grava só o que estava no arquivo. Função pura (recebe as chaves
// atuais e setters/removedores), testável isolada.
function aplicarRestauracao(payload, chavesAtuais, setItem, removeItem) {
    chavesAtuais.forEach(chave => {
        if (chave.indexOf('banco_') === 0) removeItem(chave);
    });
    Object.keys(payload.dados).forEach(chave => {
        setItem(chave, payload.dados[chave]);
    });
}

// Lê, valida e confirma um arquivo de backup — lógica COMUM aos dois
// pontos de entrada: a tela de Configurações (já logado, ver
// restaurarBackupCompleto()) e a tela de Login (pra "bootstrap" de uma
// instalação nova, sem NENHUM funcionário cadastrado ainda — ver
// restaurarBackupDoLogin(), abaixo). Só chama `aoConfirmar()` depois de
// tudo validado e a pessoa ter confirmado o aviso de que é destrutivo.
function processarArquivoDeBackup(arquivo, aoConfirmar) {
    if (!arquivo) {
        alert('Escolha um arquivo de backup primeiro.');
        return;
    }

    const leitor = new FileReader();
    leitor.onload = function (e) {
        let payload;
        try {
            payload = JSON.parse(e.target.result);
        } catch (erro) {
            alert('Arquivo inválido: não é um JSON válido.');
            return;
        }

        const erroValidacao = validarPayloadBackup(payload);
        if (erroValidacao) {
            alert(erroValidacao);
            return;
        }

        const confirmar = confirm(
            'Isso vai APAGAR os dados atuais deste navegador e substituir pelos do arquivo ' +
            '(backup de ' + (payload.dataExportacao ? payload.dataExportacao.slice(0, 10) : 'data desconhecida') + '). ' +
            'Não tem como desfazer. Continuar?'
        );
        if (!confirmar) return;

        aplicarRestauracao(
            payload,
            Object.keys(localStorage),
            (k, v) => localStorage.setItem(k, v),
            (k) => localStorage.removeItem(k)
        );

        aoConfirmar();
    };
    leitor.readAsText(arquivo, 'UTF-8');
}

// Ponto de entrada 1: tela de Configurações, JÁ LOGADO. Restrita a
// Administrador — ação destrutiva de sistema inteiro, trava de bom
// senso mesmo sem segurança real por trás.
function restaurarBackupCompleto() {
    if (usuarioLogado && usuarioLogado.nivel !== 'administrador') {
        alert('Só o Administrador pode restaurar um backup.');
        return;
    }

    const inputEl = document.getElementById('config-arquivo-restauracao');
    processarArquivoDeBackup(inputEl.files[0], function () {
        alert('Backup restaurado. A página vai recarregar agora.');
        location.reload();
    });
}

// Ponto de entrada 2: tela de LOGIN, ANTES de entrar — pra quando
// alguém abre o sistema pela primeira vez numa máquina nova (mandaram
// o .zip pra um colaborador, por exemplo) e o localStorage está
// completamente vazio, sem NENHUM funcionário cadastrado. Nesse caso
// não tem como logar de jeito nenhum (não existe ninguém pra bater a
// senha), então também não tem como chegar na tela de Configurações —
// esse caminho existe justamente pra resolver esse "ovo e galinha".
// Sem checagem de nível (não tem ninguém logado ainda, por definição).
function restaurarBackupDoLogin(inputEl) {
    processarArquivoDeBackup(inputEl.files[0], function () {
        alert('Backup restaurado. A página vai recarregar — entre com seu usuário e senha normalmente.');
        location.reload();
    });
}


// Duas por enquanto — ambas idempotentes (rodar de novo em dados já
// migrados não faz nada) e só gravam de volta no localStorage se
// encontraram algo pra migrar de verdade. Rodam sempre no boot.

// 1) Renomear o status "Pendente de Validação" pra "Para revisão" em
// qualquer tarefa já salva no localStorage de uma sessão anterior (o
// rótulo mudou, mas o VALOR gravado em tarefa.status precisa
// acompanhar — senão a tarefa salva com o nome antigo não bate com
// nenhuma coluna/filtro do sistema depois da mudança).
function migrarStatusPendenteValidacao() {
    const todas = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
    let alterou = false;

    Object.keys(todas).forEach(nomeProjeto => {
        const arv = todas[nomeProjeto];
        if (!Array.isArray(arv.etapas)) return;
        arv.etapas.forEach(etapa => {
            (etapa.setores || []).forEach(setor => {
                (setor.pavimentos || []).forEach(pav => {
                    (pav.tarefas || []).forEach(tarefa => {
                        if (tarefa.status === 'Pendente de Validação') {
                            tarefa.status = 'Para revisão';
                            alterou = true;
                        }
                    });
                });
            });
        });
    });

    if (alterou) localStorage.setItem('banco_arvores_projetos', JSON.stringify(todas));
}

// Converte "DD/MM/AAAA" (formato de texto com máscara usado nos campos
// de data desse formulário — ver aplicarMascarasLocais() em
// cadastros.js) pro formato ISO "AAAA-MM-DD" usado em todo o resto do
// sistema (Data Prevista, Data de Início, vigência de valor da hora,
// etc). Retorna '' se a data não estiver completa/bem formada — nunca
// quebra, só falha silenciosamente (quem chama decide o fallback).
function converterDataSlashesParaISO(dataSlashes) {
    if (!dataSlashes) return '';
    const partes = dataSlashes.split('/');
    if (partes.length !== 3) return '';
    const [dia, mes, ano] = partes;
    if (dia.length !== 2 || mes.length !== 2 || ano.length !== 4) return '';
    return ano + '-' + mes + '-' + dia;
}

// 2) Converter o campo único antigo `funcionario.hora` (um valor só,
// pra sempre) no novo histórico `funcionario.historico_valor_hora`
// (array de {valor, data_vigencia} — ver feriados.js::valorHoraVigente()).
// A data de vigência da entrada migrada usa `dt_inicio` do funcionário
// (é o valor que ele tinha desde que começou, pelo que sabemos) —
// convertido de "DD/MM/AAAA" (formato do campo com máscara) pro ISO.
// Sem `dt_inicio` válido, usa uma sentinela bem antiga (2000-01-01) pra
// valer desde sempre. Funcionário que já tem histórico (cadastrado ou
// editado depois dessa mudança existir) não é tocado; funcionário sem
// nenhum valor antigo (`hora` vazio/zero) simplesmente não tem nada pra
// migrar — fica sem histórico até alguém cadastrar o primeiro valor
// pela tela.
function migrarValorHoraParaHistorico() {
    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    let alterou = false;

    funcionarios.forEach(f => {
        const jaTemHistorico = Array.isArray(f.historico_valor_hora) && f.historico_valor_hora.length > 0;
        if (jaTemHistorico) return;
        const valorAntigo = parseFloat(f.hora);
        if (!valorAntigo || valorAntigo <= 0) return;
        const dataVigenciaIso = converterDataSlashesParaISO(f.dt_inicio) || '2000-01-01';
        f.historico_valor_hora = [{
            valor: valorAntigo,
            data_vigencia: dataVigenciaIso
        }];
        alterou = true;
    });

    if (alterou) localStorage.setItem('banco_funcionarios', JSON.stringify(funcionarios));
}

// --- LOGIN E SESSÃO ---
// Sistema 100% client-side, sem servidor por trás — a senha fica em
// texto puro no `localStorage` (dentro de `banco_funcionarios`) e a
// comparação também é feita aqui mesmo, no navegador. Isso NÃO é
// segurança de verdade (qualquer um com acesso ao navegador/DevTools
// consegue ler ou contornar) — é uma trava de conveniência/organização,
// consistente com o resto do sistema (nada tinha proteção nenhuma até
// =========================================================================
// ⚠️ MODO TESTE SEM LOGIN — TEMPORÁRIO, REVERTER ANTES DE QUALQUER USO
// REAL/MULTIUSUÁRIO ⚠️
//
// Pedido explícito do usuário: chato digitar login/senha a cada teste e
// ter que lembrar nome de analista/executor pra testar restrição de
// acesso. Enquanto `true`:
// - A tela de login (#tela-login) nunca aparece.
// - O sistema entra automaticamente com a última identidade escolhida
//   (`banco_identidade_teste_atual` no localStorage), ou o primeiro
//   Administrador cadastrado se não houver nenhuma escolha salva ainda.
// - O nome no canto superior direito vira um <select> com TODOS os
//   funcionários cadastrados — trocar a seleção troca `usuarioLogado`
//   de verdade (aplicando as restrições normais por nível) e recarrega
//   a página, SEM PEDIR SENHA NENHUMA.
//
// Isso contradiz uma decisão explícita anterior (ver comentário logo
// abaixo, em `usuarioLogado`: "o sistema SEMPRE pede login de novo a
// cada abertura da página, não 'lembra' quem estava logado antes") —
// por isso esse flag único, fácil de reverter (`false`) quando o teste
// acabar, sem precisar desfazer nada manualmente.
//
// **NUNCA implantar em produção/multiusuário com esse flag em `true`**
// — qualquer pessoa com acesso ao navegador vira qualquer funcionário
// instantaneamente, sem senha nenhuma.
const MODO_TESTE_SEM_LOGIN = true;

// essa rodada). Ciente e combinado com o usuário.
//
// `usuarioLogado` fica só em memória (variável `let` no topo do
// arquivo, NUNCA gravada em localStorage/sessionStorage) — por decisão
// explícita do usuário, o sistema SEMPRE pede login de novo a cada
// abertura da página, não "lembra" quem estava logado antes.
let usuarioLogado = null;

function normalizarCPF(valor) {
    return (valor || '').replace(/\D/g, '');
}

// Função pura (não mexe em DOM, testável isolada) — encontra o
// funcionário que bate com o identificador (aceita CPF OU nome, com ou
// sem formatação, case-insensitive pro nome) e confere a senha.
// Funcionário desligado (`dt_desligamento` preenchida) nunca consegue
// entrar, mesmo com credenciais corretas.
function autenticarFuncionario(funcionarios, identificador, senha) {
    const idNormalizado = (identificador || '').trim();
    const idCpfNormalizado = normalizarCPF(idNormalizado);
    const idNomeNormalizado = idNormalizado.toLowerCase();

    const candidato = funcionarios.find(f => {
        const cpfBate = idCpfNormalizado && normalizarCPF(f.cpf) === idCpfNormalizado;
        const nomeBate = (f.nome || '').trim().toLowerCase() === idNomeNormalizado;
        return cpfBate || nomeBate;
    });

    if (!candidato) return { sucesso: false, motivo: 'Funcionário não encontrado.' };
    if (candidato.dt_desligamento && candidato.dt_desligamento.trim() !== '') {
        return { sucesso: false, motivo: 'Funcionário desligado não pode acessar o sistema.' };
    }
    if ((candidato.senha || '') !== senha) return { sucesso: false, motivo: 'Senha incorreta.' };

    return { sucesso: true, funcionario: candidato };
}

function tentarLogin() {
    const identificador = document.getElementById('login-identificador').value;
    const senha = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');

    if (!identificador.trim() || !senha) {
        erroEl.innerText = 'Preencha os dois campos.';
        return;
    }

    const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
    const resultado = autenticarFuncionario(funcionarios, identificador, senha);

    if (!resultado.sucesso) {
        erroEl.innerText = resultado.motivo;
        return;
    }

    erroEl.innerText = '';
    usuarioLogado = resultado.funcionario;
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('login-senha').value = ''; // não deixa a senha digitada sobrando no campo à toa

    const cabecalho = document.getElementById('cabecalho-usuario-logado');
    if (cabecalho) {
        cabecalho.innerHTML = '👤 ' + escapeHtml(nomeParaExibicao(usuarioLogado.nome)) +
            ' <span style="color:#94a3b8;">(' + usuarioLogado.nivel + ')</span> ' +
            '<button type="button" onclick="sair()" style="background:none; border:1px solid #475569; color:#cbd5e1; border-radius:4px; padding:3px 10px; cursor:pointer; font-size:11px;">Sair</button>';
    }

    iniciarAppPosLogin();
    aplicarPermissoesMenu();
    abrirTelaInicialPorNivel();
}

// "Sair" — como não existe sessão persistida em lugar nenhum (fora do
// MODO TESTE SEM LOGIN, ver acima), recarregar a página já basta: some
// o `usuarioLogado` (era só uma variável em memória) e a tela de login
// volta a aparecer, do jeito que já começa por padrão. No modo teste,
// "Sair" limpa a identidade escolhida (volta pro padrão — primeiro
// Administrador) em vez de voltar pra tela de login, que nem aparece
// mais nesse modo.
function sair() {
    if (MODO_TESTE_SEM_LOGIN) {
        localStorage.removeItem('banco_identidade_teste_atual');
    }
    location.reload();
}

// Troca a identidade ativa no MODO TESTE SEM LOGIN — sem senha nenhuma,
// de propósito (ver aviso no topo do arquivo). Salva a escolha e
// recarrega a página inteira (mais simples e seguro que tentar ajustar
// o estado da tela atual na hora — evita, por exemplo, ficar numa
// Árvore de um projeto que a identidade nova não tem permissão de ver).
function trocarIdentidadeTeste(nomeFuncionario) {
    localStorage.setItem('banco_identidade_teste_atual', nomeFuncionario);
    location.reload();
}

// Monta o <select> de identidade no canto superior direito — substitui
// o texto fixo "👤 Nome (nível)" que aparecia depois do tentarLogin()
// normal. Só usado no MODO TESTE SEM LOGIN.
function renderizarCabecalhoIdentidadeTeste() {
    const funcionarios = (JSON.parse(localStorage.getItem('banco_funcionarios')) || [])
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const opcoes = funcionarios.map(f =>
        '<option value="' + escapeHtml(f.nome) + '"' + (usuarioLogado && f.nome === usuarioLogado.nome ? ' selected' : '') + '>' + escapeHtml(nomeParaExibicao(f.nome)) + ' (' + escapeHtml(f.nivel) + ')</option>'
    ).join('');

    const cabecalho = document.getElementById('cabecalho-usuario-logado');
    if (!cabecalho) return;
    cabecalho.innerHTML =
        '<span style="color:#f59e0b; font-weight:bold;" title="Login suspenso temporariamente pra facilitar testes — ver prompt_gemini.md">🧪 TESTE</span>' +
        '<select onchange="trocarIdentidadeTeste(this.value)" style="background:#0f223f; color:#fff; border:1px solid #475569; border-radius:4px; padding:3px 6px; font-size:11px;">' + opcoes + '</select>' +
        '<button type="button" onclick="sair()" title="Volta pro Administrador padrão" style="background:none; border:1px solid #475569; color:#cbd5e1; border-radius:4px; padding:3px 10px; cursor:pointer; font-size:11px;">↺ Resetar</button>';
}

// --- CONTROLE DE ACESSO: RODADA 2 (esconder telas por nível) ---
// Mapa fechado com o usuário (ver seção 3.1/11 do prompt_gemini.md).
// Ainda SEM restrição por projeto (isso é a Rodada 3 — Analista já
// aparece aqui com acesso à Árvore/Distribuição/Atribuição, só que por
// enquanto sem filtrar POR PROJETO qual delas ele vê).
//
// "Sem entrada no mapa = nada" — nível desconhecido/vazio (não deveria
// acontecer, já que o campo é um <select> fechado, mas defensivo) cai
// no fallback `|| []`, ou seja, falha FECHADA (esconde tudo) em vez de
// aberta.
const MENU_POR_NIVEL = {
    administrador: ['nav-cadastro', 'nav-arvore', 'nav-atribuicao_tarefas', 'nav-kanban', 'nav-aprovacoes_calendario', 'nav-relatorios', 'nav-fundo-global', 'nav-distribuicao-lucro', 'nav-bi-calibracao'],
    supervisor: ['nav-arvore', 'nav-atribuicao_tarefas', 'nav-kanban', 'nav-aprovacoes_calendario', 'nav-relatorios'],
    analista: ['nav-arvore', 'nav-atribuicao_tarefas', 'nav-kanban', 'nav-aprovacoes_calendario', 'nav-relatorios'],
    executor: ['nav-kanban']
};

// Todos os itens de menu que participam do controle de acesso (Dashboard
// e Configurações ficam de fora de propósito — são acessíveis pra
// qualquer nível, sempre).
const TODOS_ITENS_MENU_CONTROLADOS = ['nav-cadastro', 'nav-arvore', 'nav-atribuicao_tarefas', 'nav-kanban', 'nav-aprovacoes_calendario', 'nav-relatorios', 'nav-fundo-global', 'nav-distribuicao-lucro', 'nav-bi-calibracao'];

// Função pura (não mexe em DOM, testável isolada): dado um nível,
// devolve o Set de ids de menu que ele pode ver.
function determinarMenuVisivel(nivel) {
    return new Set(MENU_POR_NIVEL[nivel] || []);
}

// Esconde/mostra os itens de menu conforme o nível do usuário logado.
// Chamada uma vez, logo depois do login — o menu não muda mais durante
// a sessão (não precisa recalcular a cada navegação).
function aplicarPermissoesMenu() {
    if (!usuarioLogado) return;

    const permitidos = determinarMenuVisivel(usuarioLogado.nivel);

    TODOS_ITENS_MENU_CONTROLADOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = permitidos.has(id) ? '' : 'none';
    });

    // (O antigo submenu em cascata de Cadastro foi removido — virou
    // abas dentro de #panel-cadastro, controladas em alternarModulo(),
    // usando a mesma permissão de 'nav-cadastro' que já é aplicada
    // acima, no forEach de TODOS_ITENS_MENU_CONTROLADOS.)
}

// Melhorias #8/#11 revisadas (prompt_gemini.md §12.9): em vez de cair
// na tela em branco "Aguardando Ação" (panel-blank-state) depois do
// login (ou troca de identidade, no MODO_TESTE_SEM_LOGIN — troca
// sempre passa por aqui de novo, via location.reload()), abre direto
// o PRÓPRIO Kanban — pra TODOS os níveis, sem exceção (antes só
// `executor` ia pro Kanban, os demais iam pra Árvore; revertido a
// pedido explícito do usuário). `carregarPainelKanban()` já
// pré-seleciona o próprio nome no dropdown (melhoria #7).
// Pedido posterior (prompt_gemini.md parte 31): Analista e
// Administrador passam a abrir direto a tela de seleção de projetos
// (mesma tela do item "📁 Projetos" do menu, via
// `renderizerProjetosParaSelecaoArvore()`, que já filtra pra Analista
// através de `obterNomesProjetosPermitidos()` — pra Administrador essa
// função não filtra nada, então ele vê a lista completa de projetos,
// que é o comportamento esperado). Detalhista/Estagiário (nivel
// 'executor') e Supervisor continuam indo direto pro Kanban.
function abrirTelaInicialPorNivel() {
    if (!usuarioLogado) return;
    if (usuarioLogado.nivel === 'analista' || usuarioLogado.nivel === 'administrador') {
        alternarModulo('arvore');
        return;
    }
    alternarModulo('kanban');
}

// --- CONTROLE DE ACESSO: RODADA 3 (restringir por projeto) ---
// Só Analista tem restrição de projeto — Administrador e Supervisor
// veem tudo (Supervisor: mesmo tipo de acesso do Analista, mas SEM essa
// restrição, por decisão explícita do usuário). Executor nem chega
// nessas telas (a restrição dele já é a tela inteira, ver Rodada 2).
//
// Retorna `null` quando NÃO há restrição (usuário não logado — módulo
// isolado sem tela de login, ou nível diferente de 'analista') — quem
// chama trata `null` como "sem filtro, mostra tudo". Retorna um `Set`
// (que pode ser VAZIO, se o analista não tiver nenhum projeto atribuído
// ainda) quando a restrição está ativa.
function obterNomesProjetosPermitidos() {
    if (!usuarioLogado || usuarioLogado.nivel !== 'analista') return null;

    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    return new Set(
        projetos
            .filter(p => (p.analista || '').trim() === (usuarioLogado.nome || '').trim())
            .map(p => p.nome)
    );
}

// --- STATUS DE LIBERAÇÃO DO PROJETO (item 3 da Rodada de Comentários da
// Gerência, ver prompt_gemini.md §12) ---
// `projeto.status_liberacao`: 'em_analise' | 'liberado'. Motivação do
// usuário: "o projeto só começa a ser detalhado depois que a análise é
// concluída" — não faz sentido tarefas de um projeto ainda em análise
// aparecerem na Atribuição de Tarefas pra distribuir a executores. NÃO
// afeta a Árvore de Projeto — ela continua editável livremente o tempo
// todo, o bloqueio é só de VISIBILIDADE na Atribuição de Tarefas.
//
// Ausência do campo (`undefined`) é tratada como LIBERADO, de propósito
// — projetos criados ANTES desse recurso existir não podem "sumir" da
// Atribuição de Tarefas do nada; só projetos NOVOS nascem em
// 'em_analise' (ver cadastros.js::salvarProjeto()). Quem alterna:
// Analista, Supervisor ou Administrador — controle vive na Árvore de
// Projeto (arvore.js::alternarStatusLiberacaoProjeto()), não no
// Cadastro de Projetos, porque Analista não tem acesso a Cadastros mas
// precisa poder liberar os próprios projetos.
function projetoEstaLiberadoParaDetalhamento(nomeProjeto) {
    const projetos = JSON.parse(localStorage.getItem('banco_projetos')) || [];
    const p = projetos.find(x => x.nome === nomeProjeto);
    if (!p) return true; // projeto não encontrado — não bloqueia (defensivo)
    return (p.status_liberacao || 'liberado') !== 'em_analise';
}


// Tudo que antes rodava direto no window.onload agora só roda DEPOIS
// que tentarLogin() confirma as credenciais — o app inteiro fica
// escondido atrás da tela de login (#tela-login, z-index bem alto) até
// esse momento.
function iniciarAppPosLogin() {
    migrarStatusPendenteValidacao();
    migrarValorHoraParaHistorico();
    limparWorkspace();
    ['etapas', 'subetapas', 'pavimentos', 'tarefas'].forEach(c => renderizarListaLegoComum(c));
    if (typeof atualizarBadgePendenciasAprovacoes === 'function') atualizarBadgePendenciasAprovacoes();
}

// --- BOOT ---
window.onload = function () {
    const campoId = document.getElementById('login-identificador');
    if (campoId) {
        if (MODO_TESTE_SEM_LOGIN) {
            // Escolhe a identidade salva (ou o primeiro Administrador,
            // se não houver nenhuma escolha ainda) e entra direto, sem
            // mostrar a tela de login nenhuma vez. Testado isolado em
            // /home/claude/testes/teste_modo_teste_sem_login.js.
            const funcionarios = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            const nomeSalvo = localStorage.getItem('banco_identidade_teste_atual');
            // Reforço de robustez (depois do bug real do seed sem
            // nível): prioriza identidade salva -> qualquer
            // Administrador -> qualquer funcionário com nível
            // RECONHECIDO (evita cair num sem nível nenhum, que
            // travaria o menu no mais restrito sem escapatória) ->
            // só em último caso, o primeiro da lista, nível ou não.
            let identidade = funcionarios.find(f => f.nome === nomeSalvo);
            if (!identidade) identidade = funcionarios.find(f => f.nivel === 'administrador');
            if (!identidade) identidade = funcionarios.find(f => f.nivel);
            if (!identidade) identidade = funcionarios[0];

            if (identidade) {
                usuarioLogado = identidade;
                document.getElementById('tela-login').style.display = 'none';
                iniciarAppPosLogin();
                aplicarPermissoesMenu();
                renderizarCabecalhoIdentidadeTeste();
                abrirTelaInicialPorNivel();
                return;
            }
            // Nenhum funcionário cadastrado ainda (instalação nova) —
            // sem quem "logar" automaticamente, cai pra tela de login
            // normal (que também serve pra restaurar backup).
        }
        // App principal (index.html), com a tela de login de verdade —
        // só foca o campo, pra digitar direto sem precisar clicar. O
        // resto do boot (migrações, etc.) só roda depois do login — ver
        // iniciarAppPosLogin() e tentarLogin() acima.
        campoId.focus();
    } else {
        // Módulo isolado (modulos_isolados/*), sem tela de login própria
        // — não faz sentido exigir autenticação numa página feita só
        // pra testar UM módulo isoladamente. Pula direto pro boot
        // normal, como sempre funcionou antes do login existir.
        iniciarAppPosLogin();
    }
};
