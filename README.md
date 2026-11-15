# Gestão Familiar — Casa, Stock & Receitas

Aplicação Web / PWA **offline-first** desenhada para uso familiar (casal, filhos e animais de estimação), sem pesquisa externa de receitas nem servidores terceiros.

## Funcionalidades (v1.1)

- **Stock Doméstico (`Stock`)**: Locais personalizáveis (`Frigorífico`, `Congelador`, `Despensa`, `Casa e Higiene`, `Animais`, `Farmácia Caseira`), quantidades híbridas (`g/kg/ml/L/un` + `Tem/Pouco/Acabou`), validades com alertas, data de congelação/sobras, stock mínimo e catálogo base PT-PT (~110 itens editáveis).
- **Receitas Próprias (`Receitas`)**: Receitas 100% vossas com ingredientes ligados ao catálogo genérico, substitutos aceites, `q.b.`/opcionais, passos com campos opcionais para robô de cozinha, fotos comprimidas automaticamente, anexos PDF/fotos, alergénios e favoritos do agregado.
- **Motor de Sugestão (`Hoje` & `Receitas`)**:
  - Receitas `100% prontas` e `Quase lá (faltam 1–2)`
  - Prioridade **Aproveitar já** para itens perto do fim da validade
  - Aviso **Precisa descongelar** quando um ingrediente está apenas no congelador
  - Escalonamento dinâmico de doses e fluxo **"Cozinhei isto!"** (abate FEFO no stock + criação rápida de sobras/tupperwares)
- **Ementa Semanal (`Ementa`)**: Almoço, Jantar e Lanches por dia; cálculo do que falta face ao stock atual e envio para a Lista de Compras; aviso na página inicial do que descongelar hoje para amanhã.
- **Lista de Compras (`Compras`)**: Organizada por corredores de supermercado, importação de stock abaixo do mínimo e fluxo **"Arrumar no Stock"**.
- **Privacidade, Backup, Sync Automática & PWA (`Definições`)**:
  - Funciona 100% offline em **IndexedDB** (`Dexie.js`).
  - Sincronização opcional privada entre dispositivos através de uma pasta partilhada no vosso **Google Drive** (única ligação externa), com merge por registo, backups rotativos, sync automática (~3,5 s após edições e ao abrir/voltar à rede) e gesto **arrastar para baixo** (*pull-to-refresh*) no telemóvel.
  - Secção **Acerca** com versão, criador (`AI-Cenas92`) e verificação manual de atualizações PWA.
  - Exportação/Importação manual completa em `.json` (inclui fotos e anexos).

## Comandos Locais

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes unitários e integração (Vitest)
npm run build    # verificação TypeScript + build PWA (dist/)
```

## Publicar no GitHub Pages

O projeto inclui o workflow `.github/workflows/deploy.yml`:

1. Inicializar o repositório (se ainda não estiver ligado) e enviar para o GitHub:
   ```bash
   git init -b main
   git add .
   git commit -m "Versão inicial Gestão Familiar"
   git remote add origin https://github.com/Cenas92/GestaoFamiliar.git
   git push -u origin main
   ```
2. No GitHub, abrir **Settings → Pages → Source** e selecionar **GitHub Actions**.
3. O workflow executa os testes, gera o build PWA com base `/<nome-do-repo>/` e publica automaticamente.

## Configurar Sincronização Google Drive (Casal)

As instruções passo-a-passo também estão integradas dentro da app em **Definições → Como configurar?**.

### 1. Preparar o projeto no Google Cloud (apenas 1 vez)

1. Aceder a [console.cloud.google.com](https://console.cloud.google.com/) e criar ou selecionar um projeto (gratuito).
2. Na barra de pesquisa de topo, ativar duas APIs:
   - **Google Drive API**
   - **Google Picker API** (necessária apenas se ligares uma 2.ª conta Google do casal via Picker)
3. No menu lateral, abrir **Google Auth Platform → Visão geral → Vamos começar** (ou **Branding** e **Público-alvo**):
   - Em **Branding**, definir o nome da app (ex.: `Gestão Familiar`) e o email de contacto.
   - Em **Público-alvo**, escolher **Externo** (modo de teste).
   - Ainda em **Público-alvo → Utilizadores de teste**, adicionar os **dois emails Gmail** (o teu e o do cônjuge). Sem isto, a 2.ª conta dá erro ao iniciar sessão.
4. No menu **Google Auth Platform → Clientes → Criar cliente**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: adicionar **apenas o domínio base** (sem `/GestaoFamiliar/` e sem `/` no fim):
     - Produção (GitHub Pages): `https://cenas92.github.io` *(substitui pelo teu utilizador se for outro)*
     - Testes locais (opcional): `http://localhost:4173`
   - **URIs de redirecionamento autorizados**: podes colocar os mesmos endereços (`https://cenas92.github.io` e `http://localhost:4173`).
   - Guardar e copiar o **ID do cliente** (`xxxxx-yyyyy.apps.googleusercontent.com`) **sem `https://` nem espaços**.
5. *(Apenas para contas Google diferentes no casal)* Em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**, criar uma **Chave de API** para o Google Picker.

### 2. Ligar o 1.º dispositivo (PC ou telemóvel)

1. Abrir a app → **Definições**.
2. Colar o **Google OAuth Client ID** (apenas o texto `...apps.googleusercontent.com`, sem `https://`) e clicar em **Guardar definições**.
3. Clicar em **Criar / Ligar pasta GestaoFamiliar** e autorizar a conta Google.
4. Clicar em **Sincronizar agora** para criar o ficheiro inicial na pasta `GestaoFamiliar` do teu Google Drive.

### 3. Ligar o 2.º dispositivo

#### Caso A: Mesma conta Google (ex.: o teu PC + o teu telemóvel)
1. Abrir a app no 2.º dispositivo → **Definições**.
2. Colar o mesmo **Google OAuth Client ID** e clicar em **Guardar definições**.
3. Clicar em **Criar / Ligar pasta GestaoFamiliar** (encontra automaticamente a pasta já existente) — ou copiar o **ID da Pasta Drive** do 1.º dispositivo, colar em **ID da Pasta Drive → Fixar** e clicar em **Sincronizar agora**.

#### Caso B: Duas contas Google diferentes (Casal)
1. No Google Drive da conta A (1.º dispositivo), partilhar a pasta **`GestaoFamiliar`** com o Gmail da conta B com permissão de **Editor** *(e no telemóvel da conta B, abrir uma vez a pasta em "Partilhado comigo" no Google Drive para ficar visível)*.
2. Na app do 2.º dispositivo → **Definições**: colar o mesmo **Google OAuth Client ID** + a **Google API Key**, clicar **Guardar definições** e depois **Escolher pasta partilhada (Picker)**.
3. Selecionar a pasta partilhada `GestaoFamiliar` e clicar em **Sincronizar agora**.

### Notas rápidas e resolução de problemas
- **Erro `401 invalid_client`**: normalmente acontece por colar `https://` antes do ID do cliente ou espaços extra, ou por a origem autorizada não coincidir exatamente com `https://<teu-utilizador>.github.io` (nunca incluir `/GestaoFamiliar/`).
- **Pop-up bloqueado ou nada acontece no telemóvel**: verifica se o browser permite pop-ups para o site e toca diretamente em **Tocar p/ Sync** no cabeçalho ou **Sincronizar agora**.
- **Como funciona depois de ligado**: a app sincroniza automaticamente ~3,5 s após edições, ao abrir e ao voltar à internet; no telemóvel também podes **arrastar o ecrã para baixo** no topo para atualizar.
