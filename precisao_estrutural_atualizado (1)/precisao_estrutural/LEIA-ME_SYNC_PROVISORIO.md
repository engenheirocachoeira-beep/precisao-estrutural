# Sincronização provisória multi-usuário — passo a passo

Isso permite que a equipe, cada um numa rede/local diferente, use o MESMO
banco de dados durante o teste. É uma solução **provisória** (ver
avisos no topo de `js/sync-provisorio.js`), não a definitiva.

Leva uns 5 minutos, é gratuito, e só precisa ser feito **uma vez** por
quem for administrar (não precisa que cada pessoa da equipe crie conta).

## 1. Criar o projeto Firebase (gratuito)

1. Acesse https://console.firebase.google.com/ e entre com uma conta Google.
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `precisao-estrutural`) e
   siga o assistente (pode desativar o Google Analytics, não é necessário).
3. Dentro do projeto criado, no menu lateral, clique em **"Compilação" →
   "Realtime Database"**.
4. Clique em **"Criar banco de dados"**.
   - Escolha a região mais próxima da equipe.
   - Nas regras iniciais, escolha **"Iniciar no modo de teste"** — isso
     libera leitura/escrita sem exigir login por um período (30 dias por
     padrão). **É proposital, pra simplificar o teste da equipe** — ver
     aviso de segurança no fim deste documento.

## 2. Pegar as credenciais do projeto

1. No menu lateral, clique na engrenagem ⚙️ ao lado de "Visão geral do
   projeto" → **"Configurações do projeto"**.
2. Na aba "Geral", role até "Seus aplicativos" e clique no ícone `</>`
   (Web) pra registrar um app novo. Dê qualquer apelido (ex: `web`) e
   confirme — **não precisa marcar Firebase Hosting**.
3. Vai aparecer um bloco de código com `const firebaseConfig = {...}`.
   Você precisa de só 3 valores dali: `apiKey`, `databaseURL` e
   `projectId`.
   - Se `databaseURL` não aparecer nesse bloco, pegue direto na tela do
     Realtime Database (passo 1.4) — fica no topo, algo como
     `https://SEU-PROJETO-default-rtdb.firebaseio.com`.

## 3. Preencher no projeto

Abra `js/sync-provisorio-config.js` (não é mais em `sync-provisorio.js` —
foram separados de propósito, pra edições futuras no código nunca mais
arriscarem apagar sua configuração) e edite:

```js
const SYNC_PROVISORIO_CONFIG_FIREBASE = {
    apiKey: "AIzaSy...",                                          // cole aqui
    databaseURL: "https://precisao-estrutural-default-rtdb.firebaseio.com", // cole aqui
    projectId: "precisao-estrutural"                              // cole aqui
};
```

Salve, suba/abra o `index.html` de novo. Pronto — a partir daqui, todo
mundo que abrir a página com esses mesmos 3 valores preenchidos vai ler e
escrever no mesmo banco.

## 4. Como distribuir pra equipe

Cada pessoa precisa abrir o **mesmo `index.html`** (com o
`sync-provisorio.js` já preenchido). Formas mais simples:
- Subir a pasta `precisao_estrutural/` inteira num serviço de hospedagem
  estática gratuita (ex: GitHub Pages, Netlify, Vercel) e mandar o link.
- Ou compactar e mandar a pasta pra cada um abrir localmente
  (`index.html` direto no navegador funciona, sem precisar de servidor
  próprio — só precisa de internet pra falar com o Firebase).

## 5. Desligando (se precisar)

Em `js/sync-provisorio-config.js`, mude:
```js
const SYNC_PROVISORIO_ATIVO = false;
```
Isso volta o app a funcionar 100% local, sem tentar nenhuma sincronização
— nenhuma outra parte do sistema é afetada.

## Aviso de segurança (importante)

O "modo de teste" do Realtime Database deixa o banco **aberto pra
qualquer pessoa que descobrir a URL**, sem senha nenhuma — aceitável
por um tempo curto, só durante esta fase de teste com a equipe. Depois
de 30 dias o Firebase bloqueia automaticamente a leitura/escrita até
alguém trocar as regras. **Não é adequado para dados reais de produção
como está** — quando o sistema sair do teste, isso precisa de regras de
acesso de verdade (autenticação), que é um trabalho à parte.
