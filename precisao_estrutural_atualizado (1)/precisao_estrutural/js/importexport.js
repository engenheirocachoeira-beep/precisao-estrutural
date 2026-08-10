// =========================================================================
// MÓDULO: IMPORTAR / EXPORTAR PLANILHA (Clientes, Funcionários, Projetos)
//
// FUNCIONALIDADE NOVA — não existia implementada em nenhum arquivo
// original (era só chamada em botões, sem função por trás).
//
// Formato: CSV delimitado por ponto e vírgula (;), com cabeçalho na
// primeira linha. Abre normalmente no Excel/LibreOffice/Google Sheets.
//
// Importação usa "acréscimo limpo": registros já existentes (mesmo campo-
// chave) são ignorados; só os novos são adicionados. Nada é sobrescrito
// ou apagado por uma importação.
// =========================================================================

const CONFIG_PLANILHA = {
    clientes: {
        storageKey: 'banco_clientes',
        campoChave: 'nome',
        colunas: [
            { campo: 'nome', label: 'Razao Social' },
            { campo: 'cnpj', label: 'CNPJ' },
            { campo: 'rua', label: 'Rua' },
            { campo: 'numero', label: 'Numero' },
            { campo: 'bairro', label: 'Bairro' },
            { campo: 'cidade', label: 'Cidade' },
            { campo: 'uf', label: 'UF' },
            { campo: 'contato', label: 'Contato' },
            { campo: 'whatsapp', label: 'WhatsApp' },
            { campo: 'email', label: 'Email' }
        ],
        renderizar: () => renderizarTabelaClientes()
    },
    funcionarios: {
        storageKey: 'banco_funcionarios',
        campoChave: 'cpf',
        colunas: [
            { campo: 'nome', label: 'Nome' },
            { campo: 'cpf', label: 'CPF' },
            { campo: 'nivel', label: 'Nivel de Acesso' },
            { campo: 'cargo', label: 'Cargo' },
            { campo: 'hora', label: 'Valor Hora (atual)' },
            { campo: 'dt_inicio', label: 'Data Inicio' },
            { campo: 'dt_desligamento', label: 'Data Desligamento' },
            { campo: 'dt_nascimento', label: 'Data Nascimento' },
            { campo: 'rua', label: 'Rua' },
            { campo: 'numero', label: 'Numero' },
            { campo: 'bairro', label: 'Bairro' },
            { campo: 'cidade', label: 'Cidade' },
            { campo: 'uf', label: 'UF' },
            { campo: 'telefone', label: 'Telefone' },
            { campo: 'email', label: 'Email' }
            // "senha" propositalmente fora do CSV (não expor credenciais em arquivo exportável).
        ],
        renderizar: () => renderizarTabelaFuncionarios()
    },
    projetos: {
        storageKey: 'banco_projetos',
        campoChave: 'nome',
        colunas: [
            { campo: 'nome', label: 'Nome da Obra' },
            { campo: 'prefixo', label: 'Prefixo Tecnico' },
            { campo: 'cliente', label: 'Cliente' },
            { campo: 'rua', label: 'Rua' },
            { campo: 'numero', label: 'Numero' },
            { campo: 'bairro', label: 'Bairro' },
            { campo: 'cidade', label: 'Cidade' },
            { campo: 'uf', label: 'UF' },
            { campo: 'area', label: 'Area' },
            { campo: 'pavimentos', label: 'Pavimentos' },
            { campo: 'altura', label: 'Altura' },
            { campo: 'esbeltez', label: 'Esbeltez' },
            { campo: 'dificuldade', label: 'Dificuldade' },
            { campo: 'valor', label: 'Valor Contrato' },
            { campo: 'pagamento', label: 'Tipo Pagamento' },
            { campo: 'dt_inicio', label: 'Data Inicio' },
            { campo: 'analista', label: 'Analista' },
            { campo: 'supervisor', label: 'Supervisor' }
        ],
        renderizar: () => renderizarTabelaProjetos()
    }
};

// --- EXPORTAÇÃO (XML Spreadsheet 2003 — abre nativamente como .xls no Excel,
// com estilo real: cabeçalho destacado, bordas e largura de coluna automática) ---
function escaparXML(valor) {
    valor = (valor === undefined || valor === null) ? '' : String(valor);
    return valor
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function calcularLarguraColuna(textoMaisLongo) {
    // ~7px por caractere é uma aproximação razoável pra fonte padrão do Excel; limites evitam colunas ilegíveis ou gigantes.
    const largura = Math.max(String(textoMaisLongo).length, 4) * 7 + 14;
    return Math.min(Math.max(largura, 60), 260);
}

function exportarPlanilhaElaborada(modulo) {
    const config = CONFIG_PLANILHA[modulo];
    if (!config) return alert('Módulo sem configuração de exportação: ' + modulo);

    let registros = JSON.parse(localStorage.getItem(config.storageKey)) || [];

    // Funcionários guardam o valor da hora como HISTÓRICO
    // (historico_valor_hora), não mais um campo único — a exportação (um
    // snapshot plano, sem noção de histórico) mostra o valor MAIS
    // RECENTE, só pra referência. Não modifica o registro de verdade,
    // só a cópia usada na hora de montar a planilha.
    if (modulo === 'funcionarios') {
        registros = registros.map(reg => {
            if (reg.hora !== undefined && reg.hora !== '') return reg; // formato antigo, não deveria mais existir pós-migração, mas defensivo
            if (!Array.isArray(reg.historico_valor_hora) || reg.historico_valor_hora.length === 0) return reg;
            const ordenado = reg.historico_valor_hora.slice().sort((a, b) => b.data_vigencia.localeCompare(a.data_vigencia));
            return Object.assign({}, reg, { hora: ordenado[0].valor });
        });
    }

    // Largura de cada coluna = maior string entre o título e os dados daquela coluna
    const larguras = config.colunas.map(col => {
        let maiorTexto = col.label;
        registros.forEach(reg => {
            const v = String(reg[col.campo] || '');
            if (v.length > maiorTexto.length) maiorTexto = v;
        });
        return calcularLarguraColuna(maiorTexto);
    });

    const colunasXML = larguras.map(w => `   <Column ss:Width="${w}"/>`).join('\n');

    const linhaCabecalho = '   <Row ss:Height="22">\n' +
        config.colunas.map(c => `    <Cell ss:StyleID="Cabecalho"><Data ss:Type="String">${escaparXML(c.label)}</Data></Cell>`).join('\n') +
        '\n   </Row>';

    const linhasDados = registros.map(reg =>
        '   <Row>\n' +
        config.colunas.map(c => `    <Cell ss:StyleID="Celula"><Data ss:Type="String">${escaparXML(reg[c.campo])}</Data></Cell>`).join('\n') +
        '\n   </Row>'
    ).join('\n');

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Cabecalho">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/>
   <Interior ss:Color="#0A192F" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
   </Borders>
  </Style>
  <Style ss:ID="Celula">
   <Font ss:Size="10"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${modulo.charAt(0).toUpperCase() + modulo.slice(1)}">
  <Table>
${colunasXML}
${linhaCabecalho}
${linhasDados}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${modulo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// --- IMPORTAÇÃO (híbrida: aceita o .xls que nós geramos ou um .csv simples) ---
function parsearLinhaCSV(linha) {
    // Parser simples que respeita campos entre aspas contendo ';'
    const campos = [];
    let atual = '';
    let dentroAspas = false;
    for (let i = 0; i < linha.length; i++) {
        const ch = linha[i];
        if (ch === '"') {
            if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
            else dentroAspas = !dentroAspas;
        } else if (ch === ';' && !dentroAspas) {
            campos.push(atual); atual = '';
        } else {
            atual += ch;
        }
    }
    campos.push(atual);
    return campos;
}

function extrairLinhasDoXML(texto) {
    // Extrai as linhas de dados de um XML Spreadsheet 2003 (o formato que exportarPlanilhaElaborada gera).
    const parser = new DOMParser();
    const doc = parser.parseFromString(texto, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const linhasXML = Array.from(doc.getElementsByTagName('Row'));
    if (linhasXML.length === 0) return null;

    return linhasXML.map(row => {
        const celulas = Array.from(row.getElementsByTagName('Cell'));
        return celulas.map(cel => {
            const dataEl = cel.getElementsByTagName('Data')[0];
            return dataEl ? dataEl.textContent : '';
        });
    });
}

function detectarEImportarPlanilha(modulo, inputEl) {
    const config = CONFIG_PLANILHA[modulo];
    if (!config) return alert('Módulo sem configuração de importação: ' + modulo);
    const arquivo = inputEl.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = function (e) {
        const textoOriginal = e.target.result.replace(/^\uFEFF/, '');
        const pareceXML = textoOriginal.trim().startsWith('<?xml') || textoOriginal.includes('<Workbook');

        let linhasDeCampos; // array de arrays: cada item é uma linha já dividida em campos
        if (pareceXML) {
            linhasDeCampos = extrairLinhasDoXML(textoOriginal);
            if (!linhasDeCampos) { alert('Não foi possível interpretar este arquivo XML/.xls.'); inputEl.value = ''; return; }
        } else {
            const linhasTexto = textoOriginal.split(/\r\n|\n/).filter(l => l.trim() !== '');
            linhasDeCampos = linhasTexto.map(parsearLinhaCSV);
        }

        if (linhasDeCampos.length < 2) { alert('Arquivo vazio ou sem dados além do cabeçalho.'); inputEl.value = ''; return; }

        const existentes = JSON.parse(localStorage.getItem(config.storageKey)) || [];
        const chavesExistentes = new Set(existentes.map(r => (r[config.campoChave] || '').trim().toLowerCase()));

        let novosRegistros = 0;
        let ignoradosPorDuplicidade = 0;

        for (let i = 1; i < linhasDeCampos.length; i++) { // i=1 pula o cabeçalho
            const valores = linhasDeCampos[i];
            const registro = {};
            config.colunas.forEach((col, idx) => { registro[col.campo] = (valores[idx] || '').trim(); });

            const chave = (registro[config.campoChave] || '').trim().toLowerCase();
            if (!chave) continue; // linha sem o campo-chave preenchido é ignorada
            if (chavesExistentes.has(chave)) { ignoradosPorDuplicidade++; continue; }

            existentes.push(registro);
            chavesExistentes.add(chave);
            novosRegistros++;
        }

        localStorage.setItem(config.storageKey, JSON.stringify(existentes));
        // Funcionários importados via planilha só têm o campo antigo
        // `hora` (é o que a coluna "Valor Hora (atual)" escreve — ver
        // CONFIG_PLANILHA acima). Sem isso, eles ficariam sem
        // historico_valor_hora até o próximo reload da página (quando o
        // boot rodaria a migração de qualquer forma) — rodando aqui
        // também, o valor já fica utilizável na mesma sessão, sem
        // precisar recarregar.
        if (typeof migrarValorHoraParaHistorico === 'function') migrarValorHoraParaHistorico();
        config.renderizar();
        inputEl.value = '';
        alert(`Importação concluída: ${novosRegistros} registro(s) novo(s) adicionado(s). ${ignoradosPorDuplicidade} ignorado(s) por já existir (mesmo "${config.campoChave}").`);
    };
    leitor.onerror = function () { alert('Não foi possível ler o arquivo.'); inputEl.value = ''; };
    leitor.readAsText(arquivo, 'UTF-8');
}
