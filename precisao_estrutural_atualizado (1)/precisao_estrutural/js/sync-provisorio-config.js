// ============================================================================
// sync-provisorio-config.js — CONFIGURAÇÃO da sincronização provisória
// ============================================================================
// Separado de propósito de js/sync-provisorio.js (que tem a LÓGICA) — assim,
// se algum dia sync-provisorio.js precisar de uma reescrita grande, este
// arquivo aqui nunca é tocado, e a configuração já preenchida da equipe
// nunca corre risco de ser apagada por acidente de novo (já aconteceu 2x
// antes dessa separação — ver §12.24/12.25/12.26 do prompt_gemini.md).
//
// Deve ser carregado no index.html ANTES de sync-provisorio.js.
// ============================================================================

// Interruptor geral: false = comporta-se como antes da sincronização
// existir (100% local, sem nenhuma tentativa de rede) — útil pra desligar
// rápido se algo no Firebase der problema durante o teste da equipe, sem
// precisar mexer em mais nada.
const SYNC_PROVISORIO_ATIVO = true;

// Dados do projeto Firebase da equipe (ver LEIA-ME_SYNC_PROVISORIO.md para
// o passo a passo de como conseguir esses 3 valores, caso precise recriar).
const SYNC_PROVISORIO_CONFIG_FIREBASE = {
    apiKey: "AIzaSyDjdOMD_tacJc1ekt0BkOqUStyAMraCydI",
    databaseURL: "https://precisao-estrutural-default-rtdb.firebaseio.com",
    projectId: "precisao-estrutural"
};

// Nó dentro do Realtime Database onde o banco inteiro fica guardado — pode
// trocar (ex: pra separar "produção" de "teste") sem precisar mexer em
// mais nada além disto.
const SYNC_PROVISORIO_CAMINHO = "precisao_estrutural_dados";

// Chaves de localStorage que são identidade/preferência DESTE dispositivo,
// não dado de projeto — nunca entram no snapshot sincronizado (nem pra
// enviar, nem pra receber), senão a última pessoa a sincronizar "roubaria"
// a identidade de login automático de todo mundo.
const SYNC_PROVISORIO_CHAVES_LOCAIS = ['banco_identidade_teste_atual'];

const SYNC_PROVISORIO_DEBOUNCE_MS = 3000;   // espera após a última digitação/ação antes de enviar
const SYNC_PROVISORIO_INTERVALO_MS = 30000; // envio periódico de segurança
