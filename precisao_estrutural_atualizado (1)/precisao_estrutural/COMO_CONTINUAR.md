# Como continuar este projeto numa conversa nova com o Claude

## Passo a passo

1. Abra uma conversa nova no Claude.
2. Anexe o arquivo `precisao_estrutural.zip` (o projeto inteiro) na primeira mensagem.
3. Cole o texto da seção **"Prompt de abertura"** abaixo como o texto dessa mesma primeira mensagem.
4. Espere o Claude confirmar que leu o `prompt_gemini.md` e resumir o estado atual antes de pedir qualquer coisa nova — isso é o sinal de que o contexto foi absorvido corretamente.
5. Siga normalmente a partir daí.

Não existe necessidade de recolar o histórico da nossa conversa — o `prompt_gemini.md` (dentro do zip) já documenta a arquitetura, as convenções, o schema de dados e o roadmap combinado. O prompt abaixo só adiciona o que **não** está naquele arquivo: o estilo de trabalho que a gente estabeleceu e o ponto exato de onde paramos.

---

## Prompt de abertura (copie tudo daqui pra baixo)

Este é um projeto em andamento — um sistema de controle de fluxo de trabalho pra projetos de estruturas (HTML/CSS/JS puro, sem framework, persistência em `localStorage`). Já trabalhei bastante nele com você (Claude) em conversas anteriores, e estou continuando aqui porque a conversa anterior ficou grande demais.

**Antes de qualquer coisa, leia o arquivo `prompt_gemini.md`** que está na raiz do projeto anexado. Ele documenta a arquitetura completa, as convenções de código, o schema de dados, e — na seção final — um roadmap combinado comigo de features ainda por fazer. Foi escrito originalmente pra orientar o Gemini, mas serve igual pra você: é a fonte de verdade do estado atual do projeto, não esta mensagem.

Como gostamos de trabalhar, e por favor mantenha esse padrão:

- **Uma mudança por vez.** Não tento resolver várias coisas não relacionadas na mesma resposta.
- **Teste antes de aplicar.** Sempre que a mudança envolve lógica (cálculo, regra de negócio, algoritmo), rode um teste isolado em Node antes de mexer nos arquivos de verdade — e me mostra o resultado do teste, não só "deu certo".
- **Valide no final.** Sintaxe (`node --check`) de todos os `.js`, balanceamento de HTML, e uma checagem de que toda função chamada em `onclick`/`onchange` realmente existe em algum arquivo.
- **Sincronize os módulos isolados.** Este projeto tem uma pasta `modulos_isolados/`, com uma versão standalone de cada módulo (pra eu poder testar ou levar pro Gemini uma peça por vez, sem o app inteiro). Toda mudança nos arquivos principais precisa ser replicada lá também.
- **Atualize o `prompt_gemini.md`** a cada mudança relevante — mas com cuidado: releia o parágrafo inteiro antes E depois de editar. Esse arquivo já quebrou no meio de parágrafos umas duas vezes por edição descuidada.
- **Sempre entregue o `.zip` da pasta inteira no final**, não arquivos soltos.
- **Quando o pedido for ambíguo ou abrir um leque grande de decisões de design** (como aconteceu com controle de acesso, ou com o motor de agendamento), prefiro parar e conversar/decidir antes de você construir — não assuma o caminho mais óbvio sem confirmar comigo.

**Onde paramos:** Acabamos de fechar o **controle de acesso completo**
(login por CPF/nome + senha, permissões por nível — Administrador/
Analista/Supervisor/Executor —, restrição de Analista aos projetos
onde é responsável, e os ajustes finos no Kanban — travar Executor no
próprio nome, "Meu Calendário" virar "Calendário de [nome]" quando
outra pessoa é vista). Depois disso construímos **backup e restauração
completa** (tela "🔒 Configurações", baixa/restaura tudo que é
`localStorage`), incluindo restaurar **direto pela tela de login**
(sem precisar estar logado) — corrigimos isso depois de um caso real:
mandamos o `.zip` pra um colaborador testar, e ele não conseguia nem
logar numa máquina nova, porque não tinha nenhum funcionário cadastrado
ainda (e restaurar exigia login — um "ovo e galinha" que só apareceu no
uso real, não em teste). Confira a seção "Estado atual conhecido" do
`prompt_gemini.md` pra ver a lista completa.

**Não tem nenhuma funcionalidade pendente no meio do caminho** — tudo
que começamos, terminamos. Os dois assuntos em aberto pra próxima
sessão, ainda sem decisão tomada:

1. **Teste com usuários reais.** O sistema é 100% client-side
   (`localStorage`, sem servidor/banco compartilhado) — cada navegador
   tem sua própria cópia isolada dos dados. Discutimos dois caminhos:
   (A) testar assim mesmo, revezando numa sessão só ou aceitando que
   cada um vê só o próprio trabalho; (B) construir um backend de
   verdade primeiro, pra todo mundo ver os mesmos dados ao vivo — mas
   isso é um projeto de arquitetura à parte, não uma continuação
   natural de uma rodada (toda função que hoje lê/escreve `localStorage`
   direto viraria assíncrona). Ainda não decidimos qual caminho seguir.
2. **Índice de produtividade e distribuição de lucro.** Tivemos uma
   conversa longa e bem detalhada sobre isso (pontos calibrados por
   massa de dados histórica + fator de ajuste por Cargo, índice de
   produtividade neutro a volume de horas, índice de retrabalho,
   saldo de contribuição pra distribuição de lucro com parte
   igualitária + parte proporcional) — é só desenho conceitual, **nada
   foi implementado em código ainda**, mas o design inteiro já está
   registrado com fidelidade na seção **"11.1. Produtividade e
   Distribuição de Lucro"** do `prompt_gemini.md` — não precisa pedir
   pra eu resumir de novo, é só ler.

Antes de escrever qualquer código, me confirme rapidamente: (1) que leu o `prompt_gemini.md`, (2) um resumo curto do que já existe no sistema, e (3) qual é o próximo passo do roadmap combinado. Só depois disso a gente segue.
