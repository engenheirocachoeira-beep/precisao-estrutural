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
let _syncUltimoSnapshotServidor = null; // último estado conhecido do servidor — baseline pra detectar envio de dado incompleto (ver seção 5)
// Bug real encontrado (2026-09-01): a trava de sanidade (seção 5) não
// tinha limite de tempo — uma vez que UM envio fosse bloqueado (ex:
// apagar várias entradas de um catálogo de propósito, de verdade, na
// MESMA sessão — coisa que o próprio app sugere fazer, ver Cadastro →
// Gestão de Etapas), TODO envio seguinte da mesma aba continuava
// bloqueado pra sempre (o "último estado conhecido do servidor" só
// avança quando um PUSH consegue passar, e ele nunca mais passava —
// nem 2+ minutos depois). Único jeito de sair era recarregar, o que
// justamente DESCARTA a edição que travou tudo. Marcado aqui pra
// destravar sozinho depois de um tempo — ver _syncSnapshotPareceIncompleto.
let _syncMomentoPullConcluidoMs = null;

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
// Trava de sanidade (ver seção 5, _syncSnapshotPareceIncompleto): banner
// bem mais chamativo que o de cima, porque aqui o risco é o OPOSTO — não é
// "tem coisa nova no servidor", é "o que essa aba ia mandar pro servidor
// ia APAGAR dado de verdade". Só recarregar resolve (busca o estado bom
// do servidor de novo); não some sozinho.
function _syncMostrarBannerEnvioBloqueado(motivos) {
    if (document.getElementById('sync-provisorio-banner-bloqueio')) return;
    const div = document.createElement('div');
    div.id = 'sync-provisorio-banner-bloqueio';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:600;z-index:99999;cursor:pointer;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;';
    div.textContent = '⚠️ Envio bloqueado por segurança — os dados desta aba parecem incompletos comparados ao servidor (' + motivos.join('; ') + '). Clique aqui pra recarregar e evitar perder dado.';
    div.onclick = function () { location.reload(); };
    document.body.appendChild(div);
}

// Bug real encontrado (2026-09-01): falha de rede/permissão no envio pro
// Firebase só aparecia no Console — invisível pra quem não tem o DevTools
// aberto, então uma edição podia nunca chegar no servidor sem ninguém
// perceber (ver _syncEnviarAgora, seção 5). Diferente dos outros 2
// banners: aqui recarregar NÃO ajuda (traria de volta o estado antigo do
// servidor, perdendo justamente a edição que falhou) — o clique tenta
// reenviar de novo, em vez de recarregar.
function _syncMostrarBannerFalhaEnvio(err) {
    const existente = document.getElementById('sync-provisorio-banner-falha');
    if (existente) return; // já mostrando — não empilha um por tentativa
    const div = document.createElement('div');
    div.id = 'sync-provisorio-banner-falha';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:600;z-index:99999;cursor:pointer;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;';
    div.textContent = '⚠️ Não consegui enviar sua última edição pro servidor (' + ((err && err.message) || 'erro de rede') + '). Clique aqui pra tentar de novo.';
    div.onclick = function () { _syncRemoverBannerFalhaEnvio(); _syncEnviarAgora(); };
    document.body.appendChild(div);
}
function _syncRemoverBannerFalhaEnvio() {
    const el = document.getElementById('sync-provisorio-banner-falha');
    if (el) el.remove();
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

// Janela de proteção da trava abaixo: só faz sentido bloquear um
// encolhimento suspeito logo depois do pull inicial (aba nova ainda sem
// puxar tudo, storage corrompido nessa hora) — depois que a pessoa já
// está usando a aba normalmente por um tempo, um encolhimento grande é
// muito mais provável ser uma edição de verdade (ex: apagar várias
// entradas de um catálogo, de propósito, uma atrás da outra) do que
// corrupção. Bug real encontrado (2026-09-01): sem esse limite, a trava
// nunca soltava sozinha — todo envio seguinte da mesma aba ficava
// bloqueado pra sempre (o baseline só avança quando um envio passa, e
// ele nunca mais passava), até a pessoa recarregar — o que descartava
// justamente a edição que causou o bloqueio.
const SYNC_PROVISORIO_JANELA_PROTECAO_MS = 90000; // 90s depois do pull inicial

// Trava de sanidade contra o incidente de 2026-08-31 (ver prompt_gemini.md,
// parte 59): compara o snapshot que ESTAMOS PRESTES A ENVIAR contra o
// último estado conhecido do servidor. Se alguma lista que era "de
// verdade" no servidor (>= 5 itens) encolheu à metade ou mais no lado que
// vamos enviar, é sinal forte de dado incompleto (aba nova ainda sem
// puxar tudo, storage corrompido, etc.) — não é uma edição normal de
// usuário (apagar 1 cliente de 62 não dispara isso; "sobrar só 3 de 62"
// dispara). Sem baseline ainda (`_syncUltimoSnapshotServidor` null —
// primeira sincronização, servidor genuinamente vazio) não bloqueia nada,
// senão a configuração inicial da equipe nunca conseguiria subir dado
// nenhum. Só vale dentro da janela de proteção acima do momento em que o
// pull inicial terminou — depois disso, a trava já cumpriu seu papel.
function _syncSnapshotPareceIncompleto(novoSnapshot) {
    if (!_syncUltimoSnapshotServidor) return null;
    if (_syncMomentoPullConcluidoMs && (Date.now() - _syncMomentoPullConcluidoMs) > SYNC_PROVISORIO_JANELA_PROTECAO_MS) return null;
    const motivos = [];
    Object.keys(_syncUltimoSnapshotServidor).forEach(function (chave) {
        let antigo;
        try { antigo = JSON.parse(_syncUltimoSnapshotServidor[chave]); } catch (e) { return; }
        if (!Array.isArray(antigo) || antigo.length < 5) return; // só listas "de verdade"

        let novo = [];
        if (novoSnapshot[chave]) {
            try { novo = JSON.parse(novoSnapshot[chave]); } catch (e) { novo = []; }
        }
        if (!Array.isArray(novo)) novo = [];

        if (novo.length < antigo.length * 0.5) {
            motivos.push(chave + ': ' + antigo.length + ' → ' + novo.length);
        }
    });
    return motivos.length > 0 ? motivos : null;
}

function _syncAgendarEnvio() {
    if (!SYNC_PROVISORIO_ATIVO || _syncAplicandoRemoto || !_syncPullInicialConcluido) return;
    if (_syncTimeoutEnvio) clearTimeout(_syncTimeoutEnvio);
    _syncTimeoutEnvio = setTimeout(_syncEnviarAgora, SYNC_PROVISORIO_DEBOUNCE_MS);
}
// jaTentouReautenticar: uso interno (ver catch abaixo) — marca que esta
// chamada já é a segunda tentativa, depois de forçar renovação do token,
// pra nunca entrar num loop de tentativas.
function _syncEnviarAgora(jaTentouReautenticar) {
    if (!_syncFirebaseRef) return;
    const snapshot = _syncColetarSnapshotLocal();

    const motivosBloqueio = _syncSnapshotPareceIncompleto(snapshot);
    if (motivosBloqueio) {
        console.error('[sync-provisorio] ENVIO BLOQUEADO — dados locais parecem incompletos comparado ao servidor: ' + motivosBloqueio.join('; '));
        _syncMostrarBannerEnvioBloqueado(motivosBloqueio);
        return;
    }

    // Assinatura simples (não é hash criptográfico, só evita reenviar o
    // mesmo conteúdo sem necessidade) — tamanho + quantidade de chaves já é
    // suficiente pra esse propósito de reduzir tráfego, não de segurança.
    // Pulado na nova tentativa pós-reautenticação (mesmo conteúdo da que
    // falhou, mas precisa sair de novo).
    const assinatura = Object.keys(snapshot).length + ':' + JSON.stringify(snapshot).length;
    if (!jaTentouReautenticar) {
        if (assinatura === _syncUltimoEnvioAssinatura) return;
        _syncUltimoEnvioAssinatura = assinatura;
    }
    _syncFirebaseRef.set(snapshot).then(function () {
        _syncRemoverBannerFalhaEnvio(); // uma tentativa seguinte deu certo — some com o aviso da falha anterior
    }).catch(function (err) {
        console.warn('[sync-provisorio] falha ao enviar dados', err);

        // Bug real encontrado (2026-09-01): usuário via "permission_denied"
        // ao salvar numa aba aberta há tempo, mesmo com as regras do
        // Firebase corretas (testado à parte) — causa provável: o token de
        // autenticação anônima (dura 1h) não renovou sozinho a tempo (aba
        // em segundo plano/rede instável no momento exato da renovação
        // automática do SDK). Antes de exibir a falha pro usuário, força
        // renovar o token e tenta reenviar UMA vez — se isso resolver
        // (a causa mais provável), o usuário nunca vê problema nenhum.
        const pareceErroPermissao = err && (
            (err.code && /permission.?denied/i.test(err.code)) ||
            (err.message && /permission.?denied/i.test(err.message))
        );
        if (!jaTentouReautenticar && pareceErroPermissao && typeof firebase !== 'undefined' && firebase.auth().currentUser) {
            firebase.auth().currentUser.getIdToken(true).then(function () {
                _syncEnviarAgora(true);
            }).catch(function () {
                _syncMostrarBannerFalhaEnvio(err);
            });
            return;
        }

        // Até aqui, uma falha de envio (permissão negada, rede caiu, etc.)
        // só aparecia no Console — completamente invisível pra quem não
        // tem o DevTools aberto. Resultado: uma edição podia nunca sair do
        // navegador e ninguém saber por quê. Agora mostra um aviso na
        // tela, igual já existe pros outros 2 casos (envio bloqueado /
        // dado novo no servidor).
        _syncMostrarBannerFalhaEnvio(err);
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
    _syncFirebaseRef.on('value', function (snap) {
        // Atualiza o baseline SEMPRE (mesmo na primeira notificação, e
        // mesmo quando a mudança foi um envio nosso) — é o que
        // _syncSnapshotPareceIncompleto usa pra saber "quão grande o
        // dado real deveria ser" na hora de decidir se bloqueia um envio.
        _syncUltimoSnapshotServidor = snap.val();
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
        _syncMomentoPullConcluidoMs = Date.now();
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
            _syncMomentoPullConcluidoMs = Date.now();
            // Baseline pra trava de sanidade (seção 5) já sai preenchido
            // aqui, sem depender do timing assíncrono de
            // _syncEscutarMudancasRemotas (que também o mantém
            // atualizado dali em diante).
            _syncUltimoSnapshotServidor = dados;
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
            console.warn('[sync-provisorio] falha ao buscar dados iniciais do servidor — seguindo com os dados locais por enquanto, sem sincronizar', err);
            // Zera a referência: sem isso, o app seguia achando que tem
            // servidor pra falar (_syncFirebaseRef non-null) e o envio
            // periódico de segurança (a cada 30s) continuava tentando
            // ENVIAR os dados locais pro Firebase mesmo sem ter
            // conseguido LER o estado real de lá primeiro — em um
            // dispositivo/aba nova (localStorage vazio), isso sobrescreve
            // o banco real da equipe com os dados de exemplo/vazios do
            // dispositivo novo. Incidente real: 2026-08-31, corrigido
            // depois de acontecer (ver prompt_gemini.md).
            _syncFirebaseRef = null;
            _syncPullInicialConcluido = true;
            _syncMomentoPullConcluidoMs = Date.now();
            _syncRemoverOverlay();
            _syncCarregarScriptsApp(0);
        });
    }).catch(function (err) {
        console.warn('[sync-provisorio] falha ao autenticar anonimamente no Firebase — seguindo com os dados locais por enquanto, sem sincronizar (ver se "Anônimo" está habilitado em Authentication > Sign-in method no console do Firebase)', err);
        // Mesmo motivo do catch acima: sem zerar aqui, uma falha de
        // autenticação (ex: "Anônimo" ainda não habilitado no Console)
        // deixava o envio periódico ativo mesmo sem nunca ter lido o
        // servidor — mesmo risco de sobrescrever o banco real da equipe.
        _syncFirebaseRef = null;
        _syncPullInicialConcluido = true;
        _syncMomentoPullConcluidoMs = Date.now();
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
