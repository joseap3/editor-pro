# TEXT EDITOR PRO ULTRA

Editor profissional com suporte a Código (Monaco/VSCode), Texto Rico, Markdown, Terminal e Preview. PWA instalável offline.

## Como publicar no GitHub Pages (para instalar no celular)

### Passo 1 — Suba os arquivos para um repositório GitHub

1. Crie uma conta em [github.com](https://github.com) se não tiver
2. Clique em **"New repository"**
3. Dê o nome: `editor-ultra` (ou qualquer nome)
4. Deixe como **Public**
5. Clique em **"Create repository"**

### Passo 2 — Faça upload dos arquivos

Na página do repositório, clique em **"uploading an existing file"** e arraste TODOS os arquivos desta pasta.

Arquivos necessários:
```
index.html
style.css
app.js
tabs.js
editor.js
terminal.js
backup.js
crypto.js
sw.js
manifest.json
404.html
.nojekyll
icons/
  icon-192.png
  icon-512.png
```

### Passo 3 — Ative o GitHub Pages

1. Vá em **Settings** do repositório
2. No menu lateral, clique em **"Pages"**
3. Em **Source**, selecione **"Deploy from a branch"**
4. Em **Branch**, selecione **"main"** e pasta **"/ (root)"**
5. Clique em **Save**

### Passo 4 — Acesse e instale

Após ~2 minutos, seu app estará em:
```
https://SEU-USUARIO.github.io/editor-ultra/
```

**No celular Android (Chrome):**
- Abra a URL no Chrome
- Toque no menu (⋮) → "Adicionar à tela inicial" → "Instalar"
- Ou aguarde o banner de instalação aparecer automaticamente

**No iPhone (Safari):**
- Abra a URL no Safari
- Toque no botão de compartilhar (□↑) → "Adicionar à Tela de Início"

### ⚠️ IMPORTANTE — Ajuste o service worker para GitHub Pages

Se o repositório não for na raiz (ex: `github.io/editor-ultra/` em vez de `github.io/`),
abra `sw.js` e troque as URLs de `/index.html` para `./index.html` etc.

Ou use o sw.js que já está configurado com paths relativos (`./`).

