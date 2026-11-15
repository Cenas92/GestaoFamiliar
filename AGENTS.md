# Memória e Regras do Projeto — Gestão Familiar

Este ficheiro guarda as preferências permanentes de produto, interface e fluxo de desenvolvimento do projeto **Gestão Familiar**. Seguir estas regras em todas as sessões sem exigir que o utilizador as repita.

## Comunicação e Entrevista
- Responder sempre em **português europeu (pt-PT)**.
- **Entrevistar antes de implementar**: sempre que o utilizador pedir uma funcionalidade nova ou uma alteração de interface com várias opções de desenho, densidade, ícones ou interação em aberto, utilizar `ask_question` para alinhar os detalhes essenciais antes de escrever código.

## Padrões de Interface Mobile-First
- **Cabeçalho em linha única**: colocar título e contador compacto à esquerda (com singular/plural correto) e botões de ação compactos à direita na mesma linha (`flex-nowrap` / `shrink-0`) para não desperdiçar espaço vertical no telemóvel.
- **Barras horizontais limpas**: usar `.no-scrollbar` em tiras horizontais (`overflow-x-auto`) para ocultar barras de scroll visuais e omitir opções de filtros com `0` registos quando não aplicável (ex.: localizações vazias).
- **Pesquisa + painel recolhível de Filtros**:
  - Barra única com pesquisa (incluindo botão rápido para limpar quando tem texto) e botão **Filtros** com contador de filtros ativos.
  - Começar **recolhido por padrão no telemóvel (`< 640px`)** e **aberto lado a lado no PC (`>= 640px`)**.
  - Quando fechado e existirem filtros ativos, exibir chips clicáveis (`×`) para limpar cada filtro num toque.
- **Vistas múltiplas de coleções**:
  - Disponibilizar os **4 modos** (`Cartões padrão`, `Cartões detalhados`, `Lista compacta em linha`, `Grelha em quadrados` com 3 quadrados por linha no telemóvel) junto com seletor de ordenação e toggle **Agrupar** colapsável.
  - Guardar preferências de visualização **por dispositivo em `localStorage`**.
  - Usar símbolos vetoriais modernos (Lucide) com fundo pastel suave por tipologia (ou miniatura da foto quando existir, como nas receitas).
  - Manter espaçamentos verticais enxutos (`space-y-2.5`).

## Verificação e Publicação
- Em Windows PowerShell usar sempre `npm.cmd` (nunca `npm`) e encadear comandos com `; if ($LASTEXITCODE -eq 0) { ... }` em vez de `&&`.
- Após qualquer alteração, executar `npm.cmd test` e `npm.cmd run build`, atualizar `"version"` em `package.json`, criar commit em português claro, enviar para `origin/main` e confirmar o sucesso do workflow `Deploy PWA para GitHub Pages` no GitHub.
