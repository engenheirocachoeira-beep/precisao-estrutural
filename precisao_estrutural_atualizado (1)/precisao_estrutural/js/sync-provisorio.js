// ============================================================================
// sync-provisorio.js — Sincronização MULTI-USUÁRIO PROVISÓRIA
// ============================================================================
// Objetivo: permitir que a equipe, cada um numa rede diferente, use o mesmo
// "banco de dados" durante a fase de teste — sem reescrever nenhuma das ~292
// chamadas a localStorage.getItem/setItem espalhadas pelos outros 14
// arquivos JS do sistema. Esses arquivos continuam lendo/escrevendo
// localStorage exatamente como sempre fizeram; este arquivo só intercepta
// por trás e replica pra um Firebase Realtime Database compartilhado.
//
// COMO FUNCIONA (resumo):
// 1) Este arquivo é o ÚNICO <script src> estático no index.html além do
//    SDK do Firebase — os 15 arquivos do app (core.js, cadastros.js, etc.)
//    NÃO são mais carregados como <script src> fixo no HTML. Este arquivo
//    os carrega dinamicamente, em código, na mesma ordem de sempre — mas
//    só DEPOIS de buscar e aplicar os dados da equipe vindos do Firebase.
//    Isso elimina de vez a corrida entre "página terminou de carregar" e
//    "dados já chegaram", que fazia o sistema achar (numa aba/dispositivo
//    novo) que não tinha ninguém cadastrado e cair na tela de login normal
//    mesmo com MODO_TESTE_SEM_LOGIN ligado.
// 2) Como os scripts são carregados DEPOIS do evento "load" da página já
//    ter passado, window.onload (que core.js define) nunca dispararia
//    sozinho — por isso, depois de carregar o último arquivo, este script
//    CHAMA window.onload() manualmente (é só uma função guardada numa
//    propriedade; chamar direto tem o mesmo efeito do evento disparar).
// 3) A partir daí, toda escrita feita por QUALQUER parte do sistema
//    (Storage.prototype.setItem/removeItem/clear, interceptado abaixo) agenda
//    um envio do localStorage inteiro pro Firebase, com debounce de alguns
//    segundos. Também há um envio periódico de segurança.
// 4) Enquanto a aba está aberta, se ALGUÉM MAIS alterar o banco remoto, este
//    arquivo NÃO sobrescreve os dados da tela sozinho (evita apagar uma
//    edição em andamento) — só mostra um aviso discreto convidando a
//    recarregar a página.
//
// LIMITAÇÕES CONHECIDAS (é provisório, não é a solução definitiva):
// - Não é colaboração em tempo real de verdade: é "o último que salvou
//   vence" (last-write-wins) no nível do banco inteiro, não por campo.
// - Duas pessoas editando a MESMA coisa ao mesmo tempo podem se sobrescrever.
// - Só cobre o app principal (index.html) — NÃO foi sincronizado com
//   modulos_isolados/ de propósito: são páginas de teste isoladas de
//   desenvolvimento, não a ferramenta que a equipe vai usar pra inserir
//   dados de verdade.
//
// EXCEÇÃO DELIBERADA à regra "não sobrescreva window.nomeDaFuncao com
// monkey-patch" (ver seção 2 do prompt_gemini.md): aqui não existe outro
// jeito de interceptar as ~292 chamadas sem reescrevê-las uma por uma. A
// diferença chave: isto substitui uma API NATIVA do navegador (Storage),
// uma vez só, no primeiro arquivo carregado — não uma função própria do
// projeto definida em outro lugar, então não há ambiguidade de "qual versão
// vale" por ordem de carregamento.
//
// CONFIGURAÇÃO NECESSÁRIA (ver LEIA-ME_SYNC_PROVISORIO.md na raiz do
// projeto para o passo a passo completo de criar o projeto Firebase
// gratuito): preencher SYNC_PROVISORIO_CONFIG_FIREBASE abaixo.
// ============================================================================

// ======= 1) CONFIGURAÇÃO =======
// Vive em js/sync-provisorio-config.js, carregado ANTES deste arquivo —
// ver esse arquivo pra editar apiKey/databaseURL/projectId ou desligar a
// sincronização. Aqui só ficam as constantes que são parte da LÓGICA, não
// configuração da equipe:

// Os arquivos do app (eram 15, na mesma ordem em que estavam como
// <script src> fixo no index.html antes desta mudança; `desempenho-projeto.js`
// entrou depois, por último — a ordem importa (dependências entre
// arquivos), por isso são carregados um de cada vez, em sequência,
// nunca em paralelo.
const SYNC_PROVISORIO_SCRIPTS_APP = [
    'js/core.js',
    'js/cadastros.js',
    'js/importexport.js',
    'js/catalogo-lego.js',
    'js/arvore.js',
    'js/bi.js',
    'js/distribuicao-custos.js',
    'js/distribuicao-lucro.js',
    'js/painel-progresso.js',
    'js/feriados.js',
    'js/apontamento.js',
    'js/atribuicao-tarefas.js',
    'js/kanban.js',
    'js/aprovacoes-calendario.js',
    'js/relatorios.js',
    'js/desempenho-projeto.js'
];

// ======= 2) ESTADO INTERNO =======
let _syncTimeoutEnvio = null;
let _syncFirebaseRef = null;
let _syncUltimoEnvioAssinatura = null;
let _syncAplicandoRemoto = false;      // trava reentrância enquanto grava dados vindos do servidor
let _syncPullInicialConcluido = false; // trava envios antes da primeira leitura do servidor terminar

// ======= 3) OVERLAY E AVISO VISUAL (criados via JS, sem tocar no HTML) =======
function _syncCriarOverlay() {
    if (document.getElementById('sync-provisorio-overlay')) return;
    const div = document.createElement('div');
    div.id = 'sync-provisorio-overlay';
    div.style.cssText = 'position:fixed;inset:0;background:#0a192f;color:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;z-index:99999;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;font-size:14px;';
    div.innerHTML = '<div style="font-size:28px;">🔄</div><div id="sync-provisorio-overlay-texto">Sincronizando dados da equipe...</div>';
    document.body.appendChild(div);
}
function _syncAtualizarOverlay(texto) {
    const el = document.getElementById('sync-provisorio-overlay-texto');
    if (el) el.textContent = texto;
}
function _syncRemoverOverlay() {
    const el = document.getElementById('sync-provisorio-overlay');
    if (el) el.remove();
}
function _syncMostrarBannerAtualizacao() {
    if (document.getElementById('sync-provisorio-banner')) return; // já mostrando
    const div = document.createElement('div');
    div.id = 'sync-provisorio-banner';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f97316;color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:600;z-index:99998;cursor:pointer;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;';
    div.textContent = '🔄 A equipe atualizou dados no servidor. Clique aqui pra recarregar e ver a versão mais recente.';
    div.onclick = function () { location.reload(); };
    document.body.appendChild(div);
}

// ======= 4) SNAPSHOT DE localStorage =======

// Caracteres proibidos em chave/nó do Firebase Realtime Database — ver
// https://firebase.google.com/docs/database/web/structure-data
const SYNC_PROVISORIO_REGEX_CHAVE_INVALIDA = /[.#$\[\]]/;

function _syncColetarSnapshotLocal() {
    const dados = {};
    for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (SYNC_PROVISORIO_CHAVES_LOCAIS.includes(chave)) continue;
        // Chaves como "firebase:host:..." ou "firebase:authUser:..." são
        // gravadas pelo PRÓPRIO SDK do
        // Firebase no localStorage (controle interno dele, ex: cache de
        // qual servidor usar, ou a sessão de autenticação anônima) — não
        // são dado do app, e contêm "." (proibido
        // como nome de nó no Realtime Database), então travariam o envio.
        if (SYNC_PROVISORIO_REGEX_CHAVE_INVALIDA.test(chave)) continue;
        dados[chave] = localStorage.getItem(chave);
    }
    return dados;
}
function _syncAplicarSnapshotRemoto(dados) {
    _syncAplicandoRemoto = true;
    try {
        Object.keys(dados || {}).forEach(function (chave) {
            if (SYNC_PROVISORIO_CHAVES_LOCAIS.includes(chave)) return;
            localStorage.setItem(chave, dados[chave]);
        });
    } finally {
        _syncAplicandoRemoto = false;
    }
}

// ======= 5) PUSH (local -> servidor) =======
function _syncAgendarEnvio() {
    if (!SYNC_PROVISORIO_ATIVO || _syncAplicandoRemoto || !_syncPullInicialConcluido) return;
    if (_syncTimeoutEnvio) clearTimeout(_syncTimeoutEnvio);
    _syncTimeoutEnvio = setTimeout(_syncEnviarAgora, SYNC_PROVISORIO_DEBOUNCE_MS);
}
function _syncEnviarAgora() {
    if (!_syncFirebaseRef) return;
    const snapshot = _syncColetarSnapshotLocal();
    // Assinatura simples (não é hash criptográfico, só evita reenviar o
    // mesmo conteúdo sem necessidade) — tamanho + quantidade de chaves já é
    // suficiente pra esse propósito de reduzir tráfego, não de segurança.
    const assinatura = Object.keys(snapshot).length + ':' + JSON.stringify(snapshot).length;
    if (assinatura === _syncUltimoEnvioAssinatura) return;
    _syncUltimoEnvioAssinatura = assinatura;
    _syncFirebaseRef.set(snapshot).catch(function (err) {
        console.warn('[sync-provisorio] falha ao enviar dados', err);
    });
}

// ======= 6) INTERCEPTAÇÃO DAS ESCRITAS EM localStorage =======
(function _syncInterceptarEscritasLocalStorage() {
    const setItemOriginal = Storage.prototype.setItem;
    const removeItemOriginal = Storage.prototype.removeItem;
    const clearOriginal = Storage.prototype.clear;
    Storage.prototype.setItem = function () {
        setItemOriginal.apply(this, arguments);
        _syncAgendarEnvio();
    };
    Storage.prototype.removeItem = function () {
        removeItemOriginal.apply(this, arguments);
        _syncAgendarEnvio();
    };
    Storage.prototype.clear = function () {
        clearOriginal.apply(this, arguments);
        _syncAgendarEnvio();
    };
})();

// ======= 7) ESCUTA DE MUDANÇAS REMOTAS (feitas por outra pessoa) =======
function _syncEscutarMudancasRemotas() {
    let primeiraNotificacao = true;
    _syncFirebaseRef.on('value', function () {
        if (primeiraNotificacao) { primeiraNotificacao = false; return; } // disparo inicial = nosso próprio estado
        if (_syncAplicandoRemoto) return;
        _syncMostrarBannerAtualizacao();
    });
}

// ======= 8) CARREGADOR SEQUENCIAL DOS 14 ARQUIVOS DO APP =======
// Carrega um <script src> de cada vez, só chamando o próximo depois que o
// anterior terminou de executar — preserva exatamente a mesma ordem e
// garantia de execução que as tags <script> estáticas davam antes.
function _syncCarregarScriptsApp(indice) {
    indice = indice || 0;
    if (indice >= SYNC_PROVISORIO_SCRIPTS_APP.length) {
        _syncRemoverOverlay();
        // window.onload já passou há muito tempo (a página carregou antes
        // de qualquer um desses scripts existir) — então precisamos CHAMAR
        // a função manualmente; é só uma função guardada numa propriedade,
        // chamar direto tem o mesmo efeito de deixar o evento disparar.
        if (typeof window.onload === 'function') window.onload();
        return;
    }
    const caminho = SYNC_PROVISORIO_SCRIPTS_APP[indice];
    const tag = document.createElement('script');
    tag.src = caminho;
    tag.onload = function () { _syncCarregarScriptsApp(indice + 1); };
    tag.onerror = function () {
        console.error('[sync-provisorio] falha ao carregar ' + caminho + ' — o app pode não funcionar corretamente.');
        _syncCarregarScriptsApp(indice + 1); // segue tentando os demais em vez de travar tudo
    };
    document.body.appendChild(tag);
}

// ======= 9) BOOT =======
function _syncInicializar() {
    const configPreenchida = typeof SYNC_PROVISORIO_ATIVO !== 'undefined'
        && SYNC_PROVISORIO_ATIVO
        && typeof SYNC_PROVISORIO_CONFIG_FIREBASE !== 'undefined'
        && SYNC_PROVISORIO_CONFIG_FIREBASE.apiKey !== 'COLE_AQUI'
        && SYNC_PROVISORIO_CONFIG_FIREBASE.databaseURL !== 'COLE_AQUI'
        && typeof firebase !== 'undefined';

    if (!configPreenchida) {
        if (typeof SYNC_PROVISORIO_ATIVO === 'undefined') {
            console.warn('[sync-provisorio] js/sync-provisorio-config.js não foi carregado (ou foi carregado depois de sync-provisorio.js) — rodando 100% local, sem sincronizar.');
        } else if (SYNC_PROVISORIO_ATIVO) {
            console.warn('[sync-provisorio] configuração do Firebase incompleta ou SDK não carregou — rodando 100% local, sem sincronizar. Ver LEIA-ME_SYNC_PROVISORIO.md.');
        }
        _syncPullInicialConcluido = true; // não há servidor: nada bloqueia envios (que também não vão a lugar nenhum, _syncFirebaseRef fica null)
        _syncCarregarScriptsApp(0);
        return;
    }

    _syncCriarOverlay();
    firebase.initializeApp(SYNC_PROVISORIO_CONFIG_FIREBASE);
    _syncFirebaseRef = firebase.database().ref(SYNC_PROVISORIO_CAMINHO);

    // Autenticação anônima: não é login de verdade (sem tela, sem senha,
    // sem escolha de identidade — isso continua sendo o dropdown de
    // "modo teste" do app, sem relação nenhuma com isto) — é só o app se
    // apresentar ao Firebase como "alguém autenticado" antes de ler/
    // escrever, exigência das regras do Realtime Database (".read"/
    // ".write": "auth != null"). O SDK guarda essa credencial no próprio
    // navegador (chave "firebase:authUser:..." no localStorage — já
    // filtrada da sincronização, ver _syncColetarSnapshotLocal acima) e a
    // reaproveita nas próximas visitas, então isto roda uma vez por
    // dispositivo/navegador, nunca pede nada visível ao usuário.
    firebase.auth().signInAnonymously().then(function () {
        _syncFirebaseRef.once('value').then(function (snap) {
            const dados = snap.val();
            _syncPullInicialConcluido = true;
            if (dados && Object.keys(dados).length > 0) {
                _syncAtualizarOverlay('Aplicando dados da equipe...');
                _syncAplicarSnapshotRemoto(dados);
            } else {
                // Servidor ainda vazio (primeira sincronização da equipe) —
                // sobe o que já existe localmente (seeds/dados já digitados)
                // assim que o app terminar de carregar (ver fim de
                // _syncCarregarScriptsApp, que já deixa tudo pronto pra push).
            }
            _syncEscutarMudancasRemotas();
            _syncCarregarScriptsApp(0);
            if (!dados || Object.keys(dados).length === 0) _syncEnviarAgora();
        }).catch(function (err) {
            console.warn('[sync-provisorio] falha ao buscar dados iniciais do servidor — seguindo com os dados locais por enquanto', err);
            _syncPullInicialConcluido = true;
            _syncRemoverOverlay();
            _syncCarregarScriptsApp(0);
        });
    }).catch(function (err) {
        console.warn('[sync-provisorio] falha ao autenticar anonimamente no Firebase — seguindo com os dados locais por enquanto (ver se "Anônimo" está habilitado em Authentication > Sign-in method no console do Firebase)', err);
        _syncPullInicialConcluido = true;
        _syncRemoverOverlay();
        _syncCarregarScriptsApp(0);
    });
}

// Envio de segurança ao fechar a aba — best effort (o SDK do Firebase já
// tenta persistir sozinho em segundo plano; isso é só reforço).
window.addEventListener('beforeunload', function () {
    if (_syncTimeoutEnvio) { clearTimeout(_syncTimeoutEnvio); _syncEnviarAgora(); }
});

// Reforço periódico (cobre rede instável / debounce que não disparou).
setInterval(function () {
    if (SYNC_PROVISORIO_ATIVO && _syncPullInicialConcluido && !_syncAplicandoRemoto) _syncEnviarAgora();
}, SYNC_PROVISORIO_INTERVALO_MS);

_syncInicializar();
