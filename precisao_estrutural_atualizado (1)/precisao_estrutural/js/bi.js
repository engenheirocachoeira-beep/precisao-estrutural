// =========================================================================
// MÓDULO: BUSINESS INTELLIGENCE (Calibração de Catálogo) E CONTROLADORIA
// (Fechamento periódico do Fundo Global). Extraído sem alterações de
// lógica do index.html original.
// =========================================================================

        function renderizarPainelCalibracaoBI() {
            const tbody = document.getElementById('tabela-bi-calibracao-body'); tbody.innerHTML = '';
            let tLego = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
            // Item 5/6/7 (prompt_gemini.md §14, leva 4): usa a versão
            // filtrada (só projetos que ainda existem no Cadastro) —
            // sem isso, tarefas de projetos já deletados/renomeados
            // continuavam entrando na calibração do Catálogo Global.
            let arvores = obterArvoresProjetosAtivas();

            tLego.forEach((lego, idx) => {
                let somaKReal = 0; let contagemDadosValidos = 0;
                
                Object.keys(arvores).forEach(pKey => {
                    if(arvores[pKey].etapas) {
                        // Só entra na calibração quem tem `k_real_calculado`
                        // de verdade — isso só é gravado pra Tarefa cujo PAI
                        // imediato é um Pavimento de verdade (depende do
                        // `peso_esforco` dele — ver
                        // arvore.js::salvarAlteracoesNo(), prompt_gemini.md
                        // §12.31). Etapa/Setor/Pavimento agindo como folha
                        // (sem Pavimento físico por trás) nunca ganham esse
                        // campo — o filtro abaixo já exclui automaticamente,
                        // sem precisar subir a árvore procurando o pai.
                        coletarNosFolhaDaArvore(arvores[pKey].etapas).forEach(({ no: t }) => {
                            if (t.nivel === 'tarefa' && t.nome === lego.nome && t.status === "Finalizada" && !t.is_outlier && t.k_real_calculado !== undefined) {
                                somaKReal += parseFloat(t.k_real_calculado || 0);
                                contagemDadosValidos++;
                            }
                        });
                    }
                });

                let mediaApurada = contagemDadosValidos > 0 ? (somaKReal / contagemDadosValidos).toFixed(2) : parseFloat(lego.base_h).toFixed(2);
                let desvio = (((mediaApurada - lego.base_h) / lego.base_h) * 100).toFixed(1);

                tbody.innerHTML += '<tr>' +
                                   '<td><b>'+escapeHtml(lego.nome)+'</b></td>' +
                                   '<td>'+parseFloat(lego.base_h).toFixed(2)+' h/un</td>' +
                                   '<td>'+mediaApurada+' h/un <small style="color:#64748b;">('+contagemDadosValidos+' un)</small></td>' +
                                   '<td style="color:'+(desvio > 0 ? '#ef4444':'#10b981')+'">'+(desvio > 0 ? '+':'')+desvio+'%</td>' +
                                   '<td>' +
                                   '<button class="btn-success" style="padding:4px 8px; font-size:11px;" onclick="aplicarCalibracaoManualBI('+idx+', '+mediaApurada+')">Aceitar e Calibrar Global</button> ' +
                                   '</td></tr>';
            });
        }

        function aplicarCalibracaoManualBI(indexLego, novoValor) {
            let tLego = JSON.parse(localStorage.getItem('banco_tarefas_lego')) || [];
            tLego[indexLego].base_h = novoValor.toString();
            localStorage.setItem('banco_tarefas_lego', JSON.stringify(tLego));
            alert("Catálogo Global reajustado!");
            renderizarPainelCalibracaoBI();
        }

        function renderizarControladoriaGlobalFechamento() {
            // Item 5/6/7 (prompt_gemini.md §14, leva 4): usa a versão
            // filtrada — sem isso, o fechamento financeiro global
            // contava projetos já deletados/renomeados no Cadastro,
            // distorcendo sobras/prejuízos acumulados.
            let arvores = obterArvoresProjetosAtivas();
            let funcs = JSON.parse(localStorage.getItem('banco_funcionarios')) || [];
            let fEscritorio = parseFloat(localStorage.getItem('banco_fator_coparticipacao')) || 0.52;
            
            let elTxt = document.getElementById('bi-fator-escritorio-txt');
            if(elTxt) elTxt.innerText = (fEscritorio * 100) + "%";

            let totalSobrasBrutas = 0;
            let totalPrejuizosAbsorvidos = 0;
            const tbody = document.getElementById('tabela-fechamento-projetos-body'); tbody.innerHTML = '';

            Object.keys(arvores).forEach(pKey => {
                let proj = arvores[pKey];
                let custoAcumuladoAnalista = 0;
                let custoAcumuladoEscritorio = 0;
                let balancoResultadoObra = 0;

                // Etapa Única entra aqui normalmente (diferente do laço de
                // calibração acima) — ela TEM horas_reais/custo_max de
                // verdade, só não tem verba por área equivalente. O balanço
                // financeiro do projeto precisa contar com ela.
                function processarTarefaFechamento(t) {
                    let fObj = funcs.find(func => func.nome === t.executor);
                    let vHora = fObj ? parseFloat(fObj.hora) : 50;
                    let custoRealTarefa = (parseFloat(t.horas_reais) || 0) * vHora;

                    custoAcumuladoEscritorio += custoRealTarefa * fEscritorio;
                    custoAcumuladoAnalista += custoRealTarefa * (1 - fEscritorio);

                    let tetoMax = parseFloat(t.custo_max) || 0;
                    balancoResultadoObra += (tetoMax - custoRealTarefa);
                }

                if(proj.etapas) {
                    // Árvore Genérica Recursiva (prompt_gemini.md §12.31):
                    // não há mais `f.tipo === 'unica'` — coletarNosFolhaDaArvore()
                    // (core.js) acha as tarefas em qualquer profundidade.
                    coletarNosFolhaDaArvore(proj.etapas).forEach(({ no }) => processarTarefaFechamento(no));
                }

                if(balancoResultadoObra > 0) totalSobrasBrutas += balancoResultadoObra;
                else totalPrejuizosAbsorvidos += Math.abs(balancoResultadoObra);

                tbody.innerHTML += '<tr>' +
                                   '<td><b>'+escapeHtml(proj.nome)+'</b></td>' +
                                   '<td><span class="badge-status '+(balancoResultadoObra>=0?'status-finalizada':'status-validacao')+'">'+(balancoResultadoObra>=0?'Superavitário':'Déficit')+'</span></td>' +
                                   '<td>R$ '+custoAcumuladoAnalista.toFixed(2)+'</td>' +
                                   '<td>R$ '+custoAcumuladoEscritorio.toFixed(2)+'</td>' +
                                   '<td style="font-weight:bold; color:'+(balancoResultadoObra>=0?'#10b981':'#ef4444')+'">R$ '+balancoResultadoObra.toFixed(2)+'</td>' +
                                   '</tr>';
            });

            let saldoLiquidoConsolidado = totalSobrasBrutas - totalPrejuizosAbsorvidos;
            document.getElementById('bi-sobras-brutas').innerText = "R$ " + totalSobrasBrutas.toFixed(2);
            document.getElementById('bi-prejuizos-absorvidos').innerText = "R$ " + totalPrejuizosAbsorvidos.toFixed(2);
            document.getElementById('bi-saldo-liquido-periodo').innerText = "R$ " + saldoLiquidoConsolidado.toFixed(2);
            document.getElementById('bi-saldo-liquido-periodo').style.color = saldoLiquidoConsolidado >= 0 ? '#10b981' : '#ef4444';
        }

        function executarRateioGlobalFechamento() {
            alert("Rateio global efetuado com sucesso sobre o saldo líquido do período.");
        }

