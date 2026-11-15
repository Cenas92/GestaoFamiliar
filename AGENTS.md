# Memória e Regras do Projeto — Gestão Familiar

Este ficheiro guarda as preferências permanentes de produto, interface e fluxo de desenvolvimento do projeto **Gestão Familiar**. Seguir estas regras em todas as sessões sem exigir que o utilizador as repita.

## Comunicação e Entrevista
- Responder sempre em **português europeu (pt-PT)**.
- **Entrevistar sempre em janela popup (`ask_question`)**: sempre que o utilizador pedir uma funcionalidade nova, uma alteração de interface, ou quando houver perguntas/opções em aberto (desenho, densidade, ícones, fluxo ou prioridades — incluindo ao apresentar propostas de melhoria), utilizar **sempre** a ferramenta `ask_question` em vez de listar perguntas em texto no chat. Só escrever perguntas em texto quando for uma única confirmação simples de sim/não. Não escrever código com escolhas de interface em aberto antes de concluir esta entrevista.

## Padrões de Interface Mobile-First
- **Cabeçalho global dinâmico e linguagem limpa**:
  - Mostrar na barra global de topo o ícone colorido da aba ativa, o título do ecrã (`<h1>`) e o subtítulo contextual por baixo (sem logotipo `GF` nem subtítulo técnico `vX.X.X`, reservando a versão para **Definições → Acerca**).
  - Não repetir título nem subtítulo dentro do corpo da página; colocar os botões de ação principal (ex.: `⋯`, `+ Adicionar`, `+ Nova Receita`, `Em falta`) na primeira linha do conteúdo ao lado das pills/atalhos.
  - Evitar linguagem técnica/de armazém nos ecrãs diários (ex.: sem "abaixo do mín." nos cabeçalhos do Stock) e evitar atalhos ou botões de sincronização duplicados na aba **Hoje**.
  - Em **Stock**, manter `+ Adicionar` como ação principal e arrumar **Catálogo** e atalhos secundários num menu discreto `⋯` (e em **Definições**).
- **Cabeçalho de secção em linha única**: colocar título e contador compacto à esquerda (com singular/plural correto) e botões de ação compactos à direita na mesma linha (`flex-nowrap` / `shrink-0`) para não desperdiçar espaço vertical no telemóvel.
- **Barras horizontais limpas**: usar `.no-scrollbar` em tiras horizontais (`overflow-x-auto`) para ocultar barras de scroll visuais e omitir opções secundárias com `0` registos quando não aplicável.
- **Pesquisa + painel recolhível único `Filtros e vista`**:
  - Barra única com pesquisa (incluindo botão rápido `×` para limpar quando tem texto) e um único botão **Filtros e vista** com contador apenas de filtros ativos.
  - Começar **recolhido por padrão no telemóvel (`< 640px`)** e **aberto no PC (`>= 640px`)**.
  - Juntar os controlos de **Vista** (`Em linha`, `Padrão`, `Detalhada`, `Quadrados`), **Ordenar** e **Agrupar** dentro desse mesmo painel (abaixo dos selects de filtro) em vez de empilhar uma barra extra visível por defeito.
  - Quando fechado e existirem filtros ativos, exibir chips clicáveis (`×`) para limpar cada filtro num toque.
- **Vistas múltiplas e densidade limpa**:
  - Usar **`Lista compacta em linha` (`line`) como vista padrão** em dispositivos novos nas coleções (`Stock`, `Receitas`, `Compras`), mantendo os **4 modos** (`Em linha`, `Padrão`, `Detalhada`, `Quadrados` com 3 quadrados por linha no telemóvel) guardados **por dispositivo em `localStorage`**.
  - Em **Hoje**, apresentar apenas resumo calmo do dia (`Descongelar`, `Validades`, `Ementa de Hoje` e até 3 sugestões prontas para cozinhar).
  - Em **Ementa**, manter `Hoje` e dias com refeições expandidos, e compactar dias vazios numa linha simples com botão `+ Planear`.
  - Usar símbolos vetoriais modernos (Lucide) com fundo pastel suave por tipologia (ou miniatura da foto quando existir, como nas receitas) e manter espaçamentos verticais enxutos (`space-y-2.5`).

## Verificação e Publicação
- Em Windows PowerShell usar sempre `npm.cmd` (nunca `npm`) e encadear comandos com `; if ($LASTEXITCODE -eq 0) { ... }` em vez de `&&`.
- Após qualquer alteração, executar `npm.cmd test` e `npm.cmd run build`, atualizar `"version"` em `package.json`, criar commit em português claro, enviar para `origin/main` e confirmar o sucesso do workflow `Deploy PWA para GitHub Pages` no GitHub.
