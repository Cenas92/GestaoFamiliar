# Gestão Familiar — Casa, Stock & Receitas

Aplicação Web / PWA **offline-first** desenhada para uso familiar (casal, filhos e animais de estimação), sem pesquisa externa de receitas nem servidores terceiros.

## Funcionalidades (v1)

- **Stock Doméstico (`Stock`)**: Locais personalizáveis (`Frigorífico`, `Congelador`, `Despensa`, `Casa e Higiene`, `Animais`, `Farmácia Caseira`), quantidades híbridas (`g/kg/ml/L/un` + `Tem/Pouco/Acabou`), validades com alertas, data de congelação/sobras, stock mínimo e catálogo base PT-PT (~110 itens editáveis).
- **Receitas Próprias (`Receitas`)**: Receitas 100% vossas com ingredientes ligados ao catálogo genérico, substitutos aceites, `q.b.`/opcionais, passos com campos opcionais para robô de cozinha, fotos comprimidas automaticamente, anexos PDF/fotos, alergénios e favoritos do agregado.
- **Motor de Sugestão (`Hoje` & `Receitas`)**:
  - Receitas `100% prontas` e `Quase lá (faltam 1–2)`
  - Prioridade **Aproveitar já** para itens perto do fim da validade
  - Aviso **Precisa descongelar** quando um ingrediente está apenas no congelador
  - Escalonamento dinâmico de doses e fluxo **"Cozinhei isto!"** (abate FEFO no stock + criação rápida de sobras/tupperwares)
- **Ementa Semanal (`Ementa`)**: Almoço, Jantar e Lanches por dia; cálculo do que falta face ao stock atual e envio para a Lista de Compras; aviso na página inicial do que descongelar hoje para amanhã.
- **Lista de Compras (`Compras`)**: Organizada por corredores de supermercado, importação de stock abaixo do mínimo e fluxo **"Arrumar no Stock"**.
- **Privacidade, Backup & Sync (`Definições`)**:
  - Funciona 100% offline em **IndexedDB** (`Dexie.js`).
  - Sincronização opcional privada entre dispositivos através de uma pasta partilhada no vosso **Google Drive** (única ligação externa) com merge por registo e backups rotativos.
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

As instruções detalhadas passo-a-passo estão também integradas dentro da própria app em **Definições → Como configurar?**:

1. Criar um projeto gratuito em [console.cloud.google.com](https://console.cloud.google.com/).
2. Ativar **Google Drive API** e **Google Picker API**.
3. Configurar **OAuth consent screen** (External, modo Testing) e adicionar os dois emails Gmail em **Test users**.
4. Criar um **OAuth 2.0 Client ID** (Web application) com **Authorized JavaScript origins** igual ao domínio da app (ex: `https://cenas92.github.io`) e, opcionalmente, uma **API Key** para o Picker.
5. No 1.º telemóvel: colar o Client ID nas Definições e clicar **Criar / Ligar pasta GestaoFamiliar**, depois partilhar essa pasta no Google Drive com o cônjuge como Editor.
6. No 2.º telemóvel: colar o mesmo Client ID (+ API Key) e clicar **Escolher pasta partilhada (Picker)**.
