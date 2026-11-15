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
- **Vistas múltiplas e modos globais (`Clean` vs `Completa`)**:
  - Suportar dois modos de densidade guardados **por dispositivo em `localStorage`** (`gestao_familiar_ui_density_mode`), alternáveis pelo botão rápido no cabeçalho superior (`Clean` / `Completa`) e em **Definições → Aspeto e Vista da App**:
    - **`Clean` (predefinido em dispositivos novos)**: vista padrão **`Lista compacta em linha` (`line`)** em `Stock`, `Receitas` e `Compras`, filtros recolhidos por padrão no telemóvel (`< 640px`), barra **Hoje** calma (sem atalhos extra nem stock mínimo, até 3 sugestões prontas), sem contadores técnicos nem pills vazias.
    - **`Completa` (pré-1.2.0)**: aplica por defeito **`Cartões padrão` (`medium`)** e filtros/adição visíveis desde logo no telemóvel e PC; mostra atalhos rápidos (`+ Produto`, `+ Receita`, `Compras`, `Sync`) e `Alertas Prioritários` (validades + stock abaixo do mínimo) com até 5 receitas em **Hoje**; em **Stock**, exibe botão direto `Catálogo`, localizações com `0` e pills rápidas de estado; em **Receitas** e **Compras**, exibe todas as pills de estado mesmo com `0`. Após alternar de modo, o utilizador pode continuar a personalizar individualmente qualquer vista (`Em linha`, `Padrão`, `Detalhada`, `Quadrados`).
  - Em **Definições → Corredores do Supermercado**, permitir criar, renomear, personalizar cor e ícone, reordenar pelo percurso real (`↑` / `↓`) e remover corredores com reatribuição segura de produtos do catálogo e itens de compras, tudo sincronizado entre dispositivos (Dexie v2 + Google Drive / backup manual).
  - Em **Ementa**, manter `Hoje` e dias com refeições expandidos, e compactar dias vazios numa linha simples com botão `+ Planear`.
  - Usar símbolos vetoriais modernos (Lucide) com fundo pastel suave por tipologia (ou miniatura da foto quando existir, como nas receitas) e manter espaçamentos verticais enxutos (`space-y-2.5`).

## Verificação e Publicação
- Em Windows PowerShell usar sempre `npm.cmd` (nunca `npm`) e encadear comandos com `; if ($LASTEXITCODE -eq 0) { ... }` em vez de `&&`.
- Após qualquer alteração, executar `npm.cmd test` e `npm.cmd run build`, atualizar `"version"` em `package.json`, criar commit em português claro, enviar para `origin/main` e confirmar o sucesso do workflow `Deploy PWA para GitHub Pages` no GitHub.
