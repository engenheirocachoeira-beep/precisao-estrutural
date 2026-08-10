# Hospedar num link único (Netlify, gratuito)

Isso resolve o problema de ter que mandar um zip novo pra cada pessoa
toda vez que o sistema for atualizado — todo mundo passa a abrir a
MESMA URL, e quando você atualiza o site, todo mundo já vê a versão
nova na próxima vez que abrir.

Leva uns 5 minutos, é gratuito, e só precisa ser feito por quem for
administrar (a equipe só recebe o link, não precisa criar conta em
nada).

## Opção rápida — sem conta, só pra testar hoje (Netlify Drop)

1. Acesse **https://app.netlify.com/drop**
2. Arraste a pasta `precisao_estrutural/` inteira (a mesma que você usa
   localmente, já com `js/sync-provisorio-config.js` preenchido) pra
   dentro da página.
3. Em segundos, o Netlify gera uma URL tipo
   `https://nome-aleatorio-123.netlify.app` — é isso que você manda pra
   equipe.

**Limitação**: sem criar conta, esse link é temporário-ish (o Netlify
pode expirar sites "anônimos" depois de um tempo sem dono). Bom pra
testar hoje mesmo; pra deixar fixo, use a opção com conta abaixo.

## Opção com conta (recomendado assim que decidir seguir com isso)

1. Acesse **https://app.netlify.com/** e crie uma conta gratuita
   (pode entrar direto com Google).
2. No painel, clique em **"Add new site" → "Deploy manually"**.
3. Arraste a pasta `precisao_estrutural/` inteira pra área indicada.
4. Pronto — o Netlify gera uma URL fixa (dá pra personalizar o nome nas
   configurações do site, tipo `precisao-estrutural.netlify.app`).

## Como atualizar depois que eu mandar um zip novo

Sempre que eu entregar uma versão nova do sistema:
1. Baixe e extraia o zip novo.
2. **Confira que `js/sync-provisorio-config.js` está com a configuração
   preenchida** (eu sempre preservo isso ao te entregar, mas vale
   conferir antes de subir).
3. No painel do Netlify, vá no site → aba **"Deploys"** → arraste a
   pasta nova pra área de deploy manual de novo.
4. A equipe não precisa fazer nada — na próxima vez que abrirem o link,
   já vem a versão nova (os dados continuam os mesmos, vêm do Firebase,
   não do arquivo).

## Por que isso é mais seguro que abrir `file://` local

Hospedado como site de verdade (`https://...`), somem os avisos de
`'file:' URLs are treated as unique security origins` que apareciam no
Console — eram só ruído do modo de arquivo local, mas com hospedagem
de verdade nem aparecem mais.
