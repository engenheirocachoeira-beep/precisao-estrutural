#!/usr/bin/env node
// ============================================================================
// aplicar-sync-modulos-isolados.js
// ============================================================================
// Companheiro de verificar-sync-modulos-isolados.js — em vez de só
// relatar quais funções ficaram desatualizadas nas cópias de
// modulos_isolados/, aplica a correção: substitui, dentro de cada arquivo
// isolado, o CORPO EXATO de cada função divergente pelo texto atual do
// arquivo principal correspondente (js/<mesmo nome>.js), preservando o
// resto do arquivo isolado (que tem código próprio do harness, não é uma
// cópia 1:1 do principal — por isso a substituição é função por função, não
// o arquivo inteiro).
//
// estilos.css é tratado à parte: a convenção documentada é que essas cópias
// devem ser IDÊNTICAS ao estilos.css principal (não uma extração parcial),
// então aqui é cópia integral mesmo, não função por função.
//
// Uso:
//   node scripts/aplicar-sync-modulos-isolados.js
// Depois, rodar node scripts/verificar-sync-modulos-isolados.js de novo
// pra confirmar que não sobrou nada divergente, e node --check em todo
// arquivo tocado.
// ============================================================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_JS_PRINCIPAL = path.join(RAIZ, 'js');
const PASTA_MODULOS_ISOLADOS = path.join(RAIZ, 'modulos_isolados');

// ---- Mesma extração de função usada no script de verificação ----
function extrairFuncoes(codigo) {
    const funcoes = new Map(); // nome -> { inicio, fim } (índices no código-fonte)
    const regexInicio = /^[ \t]*function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = regexInicio.exec(codigo)) !== null) {
        const nome = m[1];
        const inicioAssinatura = m.index;
        let i = regexInicio.lastIndex;
        while (i < codigo.length && codigo[i] !== '{') i++;
        if (i >= codigo.length) continue;

        let profundidade = 0;
        let dentroDeString = null;
        let fimCorpo = -1;
        for (let j = i; j < codigo.length; j++) {
            const c = codigo[j];
            const anterior = codigo[j - 1];
            if (dentroDeString) {
                if (c === dentroDeString && anterior !== '\\') dentroDeString = null;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') { dentroDeString = c; continue; }
            if (c === '/' && codigo[j + 1] === '/') { while (j < codigo.length && codigo[j] !== '\n') j++; continue; }
            if (c === '/' && codigo[j + 1] === '*') { j += 2; while (j < codigo.length && !(codigo[j] === '*' && codigo[j + 1] === '/')) j++; j++; continue; }
            if (c === '{') profundidade++;
            else if (c === '}') { profundidade--; if (profundidade === 0) { fimCorpo = j + 1; break; } }
        }
        if (fimCorpo === -1) continue;

        funcoes.set(nome, { inicio: inicioAssinatura, fim: fimCorpo });
        regexInicio.lastIndex = fimCorpo;
    }
    return funcoes;
}

function normalizar(corpo) {
    return corpo.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

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

function main() {
    let totalFuncoesSubstituidas = 0;
    let totalArquivosAlterados = 0;

    listarArquivosIsolados().forEach(({ modulo, arquivo, caminho }) => {
        const caminhoPrincipal = path.join(PASTA_JS_PRINCIPAL, arquivo);
        if (!fs.existsSync(caminhoPrincipal)) return; // sem correspondente — nada a fazer

        const codigoPrincipal = fs.readFileSync(caminhoPrincipal, 'utf8');
        let codigoIsolado = fs.readFileSync(caminho, 'utf8');

        const funcoesPrincipal = extrairFuncoes(codigoPrincipal);
        // Reextrai a cada substituição, porque os índices mudam depois de
        // cada troca (corpo novo pode ter tamanho diferente do antigo).
        let algumaTroca = false;
        let seguir = true;
        while (seguir) {
            seguir = false;
            const funcoesIsolado = extrairFuncoes(codigoIsolado);
            for (const [nome, posPrincipal] of funcoesPrincipal) {
                if (!funcoesIsolado.has(nome)) continue;
                const posIsolado = funcoesIsolado.get(nome);
                const corpoPrincipal = codigoPrincipal.slice(posPrincipal.inicio, posPrincipal.fim);
                const corpoIsoladoAtual = codigoIsolado.slice(posIsolado.inicio, posIsolado.fim);
                if (normalizar(corpoPrincipal) === normalizar(corpoIsoladoAtual)) continue;

                codigoIsolado = codigoIsolado.slice(0, posIsolado.inicio) + corpoPrincipal + codigoIsolado.slice(posIsolado.fim);
                totalFuncoesSubstituidas++;
                algumaTroca = true;
                console.log(`  substituído: modulos_isolados/${modulo}/js/${arquivo} :: ${nome}()`);
                seguir = true; // índices mudaram — reextrai antes da próxima troca
                break;
            }
        }

        if (algumaTroca) {
            fs.writeFileSync(caminho, codigoIsolado);
            totalArquivosAlterados++;
        }
    });

    // ---- estilos.css: cópia integral (convenção é serem idênticos) ----
    const cssPrincipal = fs.readFileSync(path.join(RAIZ, 'estilos.css'), 'utf8');
    let cssAlterados = 0;
    for (const pastaModulo of fs.readdirSync(PASTA_MODULOS_ISOLADOS)) {
        const cssIsolado = path.join(PASTA_MODULOS_ISOLADOS, pastaModulo, 'estilos.css');
        if (!fs.existsSync(cssIsolado)) continue;
        if (fs.readFileSync(cssIsolado, 'utf8') !== cssPrincipal) {
            fs.writeFileSync(cssIsolado, cssPrincipal);
            cssAlterados++;
            console.log(`  copiado: modulos_isolados/${pastaModulo}/estilos.css (agora idêntico ao principal)`);
        }
    }

    console.log(`\n${'-'.repeat(70)}`);
    console.log(`Funções substituídas: ${totalFuncoesSubstituidas} em ${totalArquivosAlterados} arquivo(s) .js`);
    console.log(`estilos.css atualizados: ${cssAlterados}`);
}

main();
