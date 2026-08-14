// =========================================================================
// MÓDULO: CATÁLOGO GLOBAL DE PEÇAS LEGO (Etapas, Setores, Pavimentos, Tarefas)
// Cadastro rápido usado pela Fábrica de Legos.
//
// Tarefas tem campos extras que as outras 3 categorias não têm:
// - "Pontos" (antes chamado "Peso" — renomeado por decisão de produto):
//   sugestão inicial de quantas horas "razoáveis" a tarefa deveria levar.
//   Serve de ponto de partida pro analista definir os Pontos reais de cada
//   instância da tarefa na árvore do projeto. No futuro, essa sugestão
//   poderá vir de tratamento estatístico dos tempos reais já registrados.
//   Também é a base do ranking de produtividade dos executores: ao
//   terminar a tarefa, o executor ganha os Pontos dela, independente de
//   quantas horas realmente levou.
// - "Unidade Física": a unidade de medição da tarefa (ex: m², kg, m³, un).
//   Definida uma vez aqui no cadastro, e reaproveitada como referência
//   fixa quando essa tarefa é plugada na árvore do projeto (índice de
//   controle de produtividade — todas as instâncias da mesma tarefa usam
//   sempre a mesma unidade, pra dado estatístico comparável entre projetos).
//
// Etapas/Setores/Pavimentos continuam só com nome, sem edição (só
// incluir/excluir).
//
// IMPORTANTE: quando o Nome de uma Tarefa do catálogo é editado, a
// mudança é propagada automaticamente pra todas as tarefas já plugadas em
// qualquer árvore de projeto com o nome antigo (a árvore guarda uma CÓPIA
// do nome no momento em que a tarefa foi plugada, não uma referência viva
// — sem essa propagação, o nome ficaria desalinhado do catálogo, e a
// calibração de BI, que casa por nome exato, pararia de encontrar essas
// tarefas).
// =========================================================================

        function adicionarCatalogoLego(modulo) {
            const input = document.getElementById('add-' + modulo + '-nome');
            if(!input.value.trim()) return;
            let lista = JSON.parse(localStorage.getItem('banco_' + modulo + '_lego')) || [];

            if (modulo === 'tarefas') {
                const inputPontos = document.getElementById('add-tarefas-pontos');
                const inputUnidade = document.getElementById('add-tarefas-unidade');
                lista.push({
                    nome: input.value.trim(),
                    base_h: "2.0",
                    pontos: inputPontos.value || "1.0",
                    unidade_fisica: inputUnidade.value.trim()
                });
                inputPontos.value = "1.0";
                inputUnidade.value = "";
            } else if (modulo === 'etapas') {
                // Árvore Genérica Recursiva (prompt_gemini.md §12.31):
                // Etapa não tem mais "tipo" (subdividida/única/
                // sub-etapas) — vira container ou tarefa sozinha,
                // conforme ganha filho ou não, na hora, sem precisar
                // declarar nada aqui no Catálogo.
                lista.push({ nome: input.value.trim(), base_h: "2.0" });
            } else {
                lista.push({ nome: input.value.trim(), base_h: "2.0" });
            }

            localStorage.setItem('banco_' + modulo + '_lego', JSON.stringify(lista));
            input.value = "";
            renderizarListaLegoComum(modulo);
        }

        function renderizarListaLegoComum(modulo) {
            let lista = JSON.parse(localStorage.getItem('banco_' + modulo + '_lego')) || [];
            const tbody = document.getElementById('tabela-' + modulo + '-body');
            if(!tbody) return;
            tbody.innerHTML = '';

            // Monta pares {item, idx} pra poder exibir em ordem alfabética sem
            // perder o índice real de armazenamento (usado por editar/excluir).
            let ordemExibicao = lista.map((item, idx) => ({ item: item, idx: idx }));
            if (modulo === 'tarefas') {
                ordemExibicao.sort((a, b) => a.item.nome.localeCompare(b.item.nome, 'pt-BR'));
            }

            ordemExibicao.forEach(({ item, idx }) => {
                if (modulo === 'tarefas') {
                    tbody.innerHTML += '<tr>' +
                        '<td>L-'+idx+'</td>' +
                        '<td><input type="text" class="cat-input-nome" id="cat-nome-'+idx+'" value="'+item.nome+'" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>' +
                        '<td><input type="number" step="0.1" class="cat-input-pontos" id="cat-pontos-'+idx+'" value="'+(item.pontos || '1.0')+'" style="width:80px; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>' +
                        '<td><input type="text" class="cat-input-unidade" id="cat-unidade-'+idx+'" value="'+(item.unidade_fisica || '')+'" placeholder="ex: m², kg, m³, un" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>' +
                        '<td style="text-align:center; white-space:nowrap;">' +
                        '<button class="btn-secondary" style="padding:4px 8px; margin-right:4px;" title="Salvar" onclick="salvarEdicaoTarefaCatalogo('+idx+')">💾</button>' +
                        '<button class="btn-delete" onclick="deletarLegoItem(\''+modulo+'\','+idx+')">🗑️</button>' +
                        '</td></tr>';
                } else if (modulo === 'etapas') {
                    const pctSugeridoAtual = (item.pct_sugerido !== undefined && item.pct_sugerido !== '') ? item.pct_sugerido : '';
                    tbody.innerHTML += '<tr>' +
                        '<td>L-'+idx+'</td>' +
                        '<td><b>'+item.nome+'</b></td>' +
                        '<td><input type="number" step="0.01" class="cat-input-pct-sugerido" id="cat-pct-sugerido-'+idx+'" value="'+pctSugeridoAtual+'" placeholder="ex: 10" style="width:90px; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>' +
                        '<td style="text-align:center; white-space:nowrap;">' +
                        '<button class="btn-secondary" style="padding:4px 8px; margin-right:4px;" title="Salvar" onclick="salvarEdicaoEtapaCatalogo('+idx+')">💾</button>' +
                        '<button class="btn-delete" onclick="deletarLegoItem(\''+modulo+'\','+idx+')">🗑️</button>' +
                        '</td></tr>';
                } else {
                    tbody.innerHTML += '<tr><td>L-'+idx+'</td><td><b>'+item.nome+'</b></td><td style="text-align:center;"><button class="btn-delete" onclick="deletarLegoItem(\''+modulo+'\','+idx+')">🗑️</button></td></tr>';
                }
            });
        }

        function deletarLegoItem(modulo, idx) {
            let lista = JSON.parse(localStorage.getItem('banco_' + modulo + '_lego'));
            lista.splice(idx, 1);
            localStorage.setItem('banco_' + modulo + '_lego', JSON.stringify(lista));
            renderizarListaLegoComum(modulo);
        }

        // --- EDIÇÃO DE TAREFA NO CATÁLOGO (nome + pontos + unidade física) ---
        function salvarEdicaoTarefaCatalogo(idx) {
            const novoNome = document.getElementById('cat-nome-' + idx).value.trim();
            const novosPontos = document.getElementById('cat-pontos-' + idx).value || '1.0';
            const novaUnidade = document.getElementById('cat-unidade-' + idx).value.trim();
            if (!novoNome) { alert('O nome da tarefa não pode ficar vazio.'); return; }

            let lista = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
            const nomeAntigo = lista[idx].nome;

            let mensagemPropagacao = '';
            if (novoNome !== nomeAntigo) {
                const qtdAtualizada = propagarRenomeTarefaNaArvore(nomeAntigo, novoNome);
                if (qtdAtualizada > 0) {
                    mensagemPropagacao = ' ' + qtdAtualizada + ' tarefa(s) já plugada(s) em árvores de projeto foram atualizadas para o novo nome.';
                }
            }

            lista[idx] = { nome: novoNome, base_h: lista[idx].base_h || '2.0', pontos: novosPontos, unidade_fisica: novaUnidade };
            localStorage.setItem('banco_tarefas_lego', JSON.stringify(lista));
            renderizarListaLegoComum('tarefas');

            alert('Tarefa atualizada.' + mensagemPropagacao);
        }

        // --- EDIÇÃO DE % SUGERIDO DE ETAPA NO CATÁLOGO ---
        // Nome da Etapa não é editável aqui (mesma regra de sempre pra
        // Etapas/Setores/Pavimentos) — só o % Sugerido. O campo "Tipo"
        // que existia aqui foi removido (Árvore Genérica Recursiva,
        // prompt_gemini.md §12.31) — Etapa não declara mais tipo
        // nenhum, vira container ou tarefa sozinha conforme ganha
        // filho ou não, na hora.
        function salvarEdicaoEtapaCatalogo(idx) {
            const inputPct = document.getElementById('cat-pct-sugerido-' + idx);

            let lista = JSON.parse(localStorage.getItem('banco_etapas_lego')) || [];
            if (!lista[idx]) return;
            lista[idx].pct_sugerido = inputPct ? inputPct.value : '';
            localStorage.setItem('banco_etapas_lego', JSON.stringify(lista));

            alert('Etapa "' + lista[idx].nome + '" atualizada (% Sugerido: ' + (lista[idx].pct_sugerido || '—') + ').');
        }

        // Renomeia (por igualdade exata de nome) todas as tarefas já plugadas em
        // qualquer árvore de projeto. Retorna quantas tarefas foram atualizadas.
        // Filtra por `nivel === 'tarefa'` — Etapa/Setor/Pavimento agindo
        // como folha nunca têm nome vindo do Catálogo de Tarefas, só
        // Tarefa de verdade (§12.31 v2).
        function propagarRenomeTarefaNaArvore(nomeAntigo, nomeNovo) {
            const arvores = JSON.parse(localStorage.getItem('banco_arvores_projetos')) || {};
            let contador = 0;

            Object.values(arvores).forEach(proj => {
                if (!Array.isArray(proj.etapas)) return;
                coletarNosFolhaDaArvore(proj.etapas).forEach(({ no }) => {
                    if (no.nivel === 'tarefa' && no.nome === nomeAntigo) {
                        no.nome = nomeNovo;
                        contador++;
                    }
                });
            });

            if (contador > 0) {
                localStorage.setItem('banco_arvores_projetos', JSON.stringify(arvores));
            }
            return contador;
        }
