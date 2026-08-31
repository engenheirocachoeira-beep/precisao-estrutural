#!/usr/bin/env node
// ============================================================================
// verificar-sync-modulos-isolados.js
// ============================================================================
// A duplicação entre js/*.js e modulos_isolados/*/js/*.js é PROPOSITAL (ver
// prompt_gemini.md e a memória do projeto) — cada pasta em modulos_isolados/
// é uma página de teste isolada de UMA tela só, sem tela de login, sem os
// outros 14 arquivos do app. Isso significa que os arquivos NUNCA vão ser
// idênticos byte a byte (a cópia isolada tem menos código ao redor), então
// um diff comum não serve pra detectar "esqueci de replicar uma mudança".
//
// O que este script faz: extrai cada função nomeada (`function nomeX(...) {...}`)
// de um arquivo do app principal e da(s) cópia(s) correspondente(s) em
// modulos_isolados/ (mesmo nome de arquivo, pode haver mais de uma cópia,
// ex: feriados.js aparece em 4 pastas), e compara o CORPO de cada função que
// existe nos dois lados. Se o corpo for diferente, é um forte sinal de que
// uma mudança foi feita num lado só — exatamente o tipo de lapso que já
// aconteceu antes (relatorios.js, várias rodadas sem replicar, prompt_gemini.md
// parte 39).
//
// Uso:
//   node scripts/verificar-sync-modulos-isolados.js
//
// Não altera nada — só relatório. Rodar depois de qualquer mudança em
// js/*.js que tenha cópia(s) em modulos_isolados/, antes de considerar a
// tarefa terminada.
// ============================================================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_JS_PRINCIPAL = path.join(RAIZ, 'js');
const PASTA_MODULOS_ISOLADOS = path.join(RAIZ, 'modulos_isolados');

// ---- 1) Extrai funções nomeadas de um código-fonte JS ----
// Retorna um Map nome -> corpo (string, incluindo `function nome(...) {...}`).
// Tokenizer simplificado: percorre char a char rastreando se está dentro de
// string ('...'/"..."/`...`) ou comentário (//.../* ... */), pra não deixar
// uma chave `{`/`}` dentro de uma string bagunçar a contagem de profundidade.
function extrairFuncoes(codigo) {
    const funcoes = new Map();
    const regexInicio = /^[ \t]*function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = regexInicio.exec(codigo)) !== null) {
        const nome = m[1];
        const inicioAssinatura = m.index;
        // Acha o primeiro `{` depois da assinatura (fim dos parâmetros).
        let i = regexInicio.lastIndex;
        while (i < codigo.length && codigo[i] !== '{') i++;
        if (i >= codigo.length) continue; // assinatura sem corpo (não deveria acontecer)

        let profundidade = 0;
        let dentroDeString = null; // null | "'" | '"' | '`'
        let fimCorpo = -1;
        for (let j = i; j < codigo.length; j++) {
            const c = codigo[j];
            const anterior = codigo[j - 1];

            if (dentroDeString) {
                if (c === dentroDeString && anterior !== '\\') dentroDeString = null;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') { dentroDeString = c; continue; }
            if (c === '/' && codigo[j + 1] === '/') { // comentário de linha
                while (j < codigo.length && codigo[j] !== '\n') j++;
                continue;
            }
            if (c === '/' && codigo[j + 1] === '*') { // comentário de bloco
                j += 2;
                while (j < codigo.length && !(codigo[j] === '*' && codigo[j + 1] === '/')) j++;
                j++; // deixa o loop's j++ passar do '/'
                continue;
            }
            if (c === '{') profundidade++;
            else if (c === '}') {
                profundidade--;
                if (profundidade === 0) { fimCorpo = j + 1; break; }
            }
        }
        if (fimCorpo === -1) continue; // não fechou corretamente — ignora, não trava o script

        funcoes.set(nome, codigo.slice(inicioAssinatura, fimCorpo));
        regexInicio.lastIndex = fimCorpo;
    }
    return funcoes;
}

// Normaliza espaço em branco (indentação/CRLF variam entre cópias por causa
// de edição em momentos diferentes) antes de comparar — o que importa é o
// CONTEÚDO da função, não formatação incidental.
function normalizar(corpo) {
    return corpo.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

// ---- 2) Localiza todos os arquivos .js dentro de modulos_isolados/ ----
function listarArquivosIsolados() {
    const resultado = [];
    for (const pastaModulo of fs.readdirSync(PASTA_MODULOS_ISOLADOS)) {
        const pastaJs = path.join(PASTA_MODULOS_ISOLADOS, pastaModulo, 'js');
        if (!fs.existsSync(pastaJs) || !fs.statSync(pastaJs).isDirectory()) continue;
        for (const arquivo of fs.readdirSync(pastaJs)) {
            if (arquivo.endsWith('.js')) {
                resultado.push({ modulo: pastaModulo, arquivo, caminho: path.join(pastaJs, arquivo) });
            }
        }
    }
    return resultado;
}

// ---- 3) Compara cada cópia isolada com o arquivo principal correspondente ----
function main() {
    const isolados = listarArquivosIsolados();
    let algumProblema = false;
    let totalArquivosComparados = 0;

    isolados.forEach(({ modulo, arquivo, caminho }) => {
        const caminhoPrincipal = path.join(PASTA_JS_PRINCIPAL, arquivo);
        if (!fs.existsSync(caminhoPrincipal)) {
            console.log(`⚠️  modulos_isolados/${modulo}/js/${arquivo} não tem arquivo correspondente em js/ — ignorado (pode ser arquivo específico do harness).`);
            return;
        }
        totalArquivosComparados++;

        const codigoPrincipal = fs.readFileSync(caminhoPrincipal, 'utf8');
        const codigoIsolado = fs.readFileSync(caminho, 'utf8');
        const funcoesPrincipal = extrairFuncoes(codigoPrincipal);
        const funcoesIsolado = extrairFuncoes(codigoIsolado);

        const divergentes = [];
        funcoesPrincipal.forEach((corpoPrincipal, nome) => {
            if (!funcoesIsolado.has(nome)) return; // só existe no principal — ok, não é sinal de drift
            const corpoIsolado = funcoesIsolado.get(nome);
            if (normalizar(corpoPrincipal) !== normalizar(corpoIsolado)) {
                divergentes.push(nome);
            }
        });

        if (divergentes.length > 0) {
            algumProblema = true;
            console.log(`\n❌ modulos_isolados/${modulo}/js/${arquivo} — ${divergentes.length} função(ões) desatualizada(s) em relação a js/${arquivo}:`);
            divergentes.forEach(nome => console.log(`   - ${nome}()`));
        }
    });

    // ---- estilos.css: convenção é ser idêntico em todas as cópias (ver
    // prompt_gemini.md, sincronização feita em "todos os
    // modulos_isolados/*/estilos.css" de uma vez, mais de uma vez) ----
    const cssPrincipal = fs.readFileSync(path.join(RAIZ, 'estilos.css'), 'utf8');
    for (const pastaModulo of fs.readdirSync(PASTA_MODULOS_ISOLADOS)) {
        const cssIsolado = path.join(PASTA_MODULOS_ISOLADOS, pastaModulo, 'estilos.css');
        if (!fs.existsSync(cssIsolado)) continue;
        if (fs.readFileSync(cssIsolado, 'utf8') !== cssPrincipal) {
            algumProblema = true;
            console.log(`\n❌ modulos_isolados/${pastaModulo}/estilos.css difere de estilos.css (deveria ser idêntico).`);
        }
    }

    console.log(`\n${'-'.repeat(70)}`);
    console.log(`Arquivos .js comparados: ${totalArquivosComparados}`);
    if (!algumProblema) {
        console.log('✅ Nada desatualizado encontrado — modulos_isolados/ em dia com js/.');
    } else {
        console.log('⚠️  Encontrado(s) ponto(s) desatualizado(s) acima — considerar replicar antes de encerrar a tarefa.');
        process.exitCode = 1;
    }
}

main();
