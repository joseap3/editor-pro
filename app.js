/* ===================== APP.JS ===================== */
'use strict';

// ── UI helpers exposed globally ──────────────────────────────
const UI = (() => {
  function openExport() {
    const tab = TabManager.getActiveTab();
    const fmt = document.getElementById('export-format')?.value || 'txt';
    const el  = document.getElementById('export-filename');
    if (el && tab) el.value = tab.name.replace(/\.[^.]+$/, '') + '.' + fmt;
    document.getElementById('export-modal')?.classList.remove('hidden');
  }
  function openEncrypt() { document.getElementById('encrypt-modal')?.classList.remove('hidden'); }
  function openRename()  {
    const tab = TabManager.getActiveTab();
    const inp = document.getElementById('rename-input');
    if (inp && tab) inp.value = tab.name;
    document.getElementById('rename-modal')?.classList.remove('hidden');
  }
  function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

  function toggleTerminal() {
    const pane = document.getElementById('terminal-pane');
    if (!pane) return;
    const open = pane.classList.toggle('open');
    document.body.classList.toggle('terminal-open', open);
    if (open) setTimeout(() => document.getElementById('terminal-input')?.focus(), 80);
  }

  let _previewSide = false;
  function togglePreview() {
    const panel = document.getElementById('preview-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      AppMain.refreshPreview();
    } else {
      panel.classList.add('hidden');
      if (_previewSide) _exitSide();
    }
  }
  function _exitSide() {
    _previewSide = false;
    const panel = document.getElementById('preview-panel');
    const main  = document.getElementById('main-area');
    if (!panel || !main) return;
    panel.classList.remove('side-mode');
    main.classList.remove('with-preview');
    document.body.appendChild(panel);
    const btn = document.getElementById('btn-preview-side');
    if (btn) btn.textContent = '⬜ Lado';
  }

  function openDrawer()  {
    const d = document.getElementById('mobile-drawer');
    if (d) { d.classList.add('open'); d.setAttribute('aria-hidden','false'); }
  }
  function closeDrawer() {
    const d = document.getElementById('mobile-drawer');
    if (d) { d.classList.remove('open'); d.setAttribute('aria-hidden','true'); }
  }

  return { openExport, openEncrypt, openRename, closeModal, toggleTerminal, togglePreview, openDrawer, closeDrawer, _exitSide, get previewSide() { return _previewSide; }, set previewSide(v) { _previewSide = v; } };
})();

// ── Main App ─────────────────────────────────────────────────
const AppMain = (() => {
  let _deferredInstall = null;
  let _autoSaveTimer   = null;

  // ════════ INIT ════════
  async function init() {
    // Theme
    const savedTheme = await BackupManager.loadSetting('theme').catch(() => null);
    if (savedTheme) setTheme(savedTheme, false);

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[SW] Registered:', reg.scope);
      } catch (e) {
        console.warn('[SW] Registration failed:', e);
      }
    }

    // Restore tabs or create default
    const restored = await TabManager.restoreFromDB();
    if (!restored) TabManager.createTab('Untitled.html', '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Minha Página</title>\n</head>\n<body>\n  <h1>Olá, Mundo!</h1>\n</body>\n</html>', 'code', 'html');

    // Bind all UI events
    _bindEvents();

    // Start auto-save (every 5s)
    _autoSaveTimer = setInterval(_autoSave, 5000);

    // Clock
    _updateClock();
    setInterval(_updateClock, 1000);

    // Online/offline
    window.addEventListener('online',  () => _setOffline(false));
    window.addEventListener('offline', () => _setOffline(true));
    _setOffline(!navigator.onLine);

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstall = e;
      // Show install button
      const btn = document.getElementById('btn-pwa-install');
      const dBtn = document.getElementById('drawer-pwa-btn');
      if (btn)  btn.style.display  = '';
      if (dBtn) dBtn.style.display = '';
      showToast('💡 Este app pode ser instalado no seu celular! Toque em 📲', 'info', 6000);
    });

    window.addEventListener('appinstalled', () => {
      _deferredInstall = null;
      const btn = document.getElementById('btn-pwa-install');
      if (btn) btn.style.display = 'none';
      showToast('✅ App instalado com sucesso!', 'success');
    });

    console.log('[App] Initialized');
  }

  // ════════ EVENTS ════════
  function _bindEvents() {
    // Toolbar buttons
    document.getElementById('btn-new')?.addEventListener('click',    () => TabManager.createTab());
    document.getElementById('btn-open')?.addEventListener('click',   () => document.getElementById('file-input').click());
    document.getElementById('btn-save')?.addEventListener('click',   saveActive);
    document.getElementById('btn-export')?.addEventListener('click', UI.openExport);
    document.getElementById('btn-search')?.addEventListener('click', () => EditorManager.openSearch());
    document.getElementById('btn-encrypt')?.addEventListener('click',UI.openEncrypt);
    document.getElementById('btn-rename')?.addEventListener('click', UI.openRename);
    document.getElementById('btn-terminal')?.addEventListener('click',UI.toggleTerminal);
    document.getElementById('btn-preview')?.addEventListener('click', UI.togglePreview);
    document.getElementById('btn-pwa-install')?.addEventListener('click', installPWA);

    // Terminal close
    document.getElementById('btn-terminal-close')?.addEventListener('click', UI.toggleTerminal);

    // Mode buttons
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => _switchMode(btn.dataset.mode));
    });

    // File input
    document.getElementById('file-input')?.addEventListener('change', _handleFileInput);

    // Export
    document.getElementById('export-format')?.addEventListener('change', _updateExportName);
    document.getElementById('btn-do-export')?.addEventListener('click', _doExport);

    // Encrypt
    document.getElementById('btn-do-encrypt')?.addEventListener('click', _doEncrypt);
    document.getElementById('btn-do-decrypt')?.addEventListener('click', _doDecrypt);

    // Rename
    document.getElementById('btn-do-rename')?.addEventListener('click', _doRename);
    document.getElementById('rename-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _doRename();
    });

    // Language modal
    document.getElementById('btn-do-lang')?.addEventListener('click', _doLang);

    // Search panel
    document.getElementById('search-input')?.addEventListener('input', () => EditorManager.doSearch());
    document.getElementById('search-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? EditorManager.gotoPrevMatch() : EditorManager.gotoNextMatch(); }
      if (e.key === 'Escape') EditorManager.closeSearch();
    });
    document.getElementById('btn-next-match')?.addEventListener('click', () => EditorManager.gotoNextMatch());
    document.getElementById('btn-prev-match')?.addEventListener('click', () => EditorManager.gotoPrevMatch());
    document.getElementById('btn-search-close')?.addEventListener('click', () => EditorManager.closeSearch());
    document.getElementById('btn-replace-one')?.addEventListener('click', () => EditorManager.doReplace());
    document.getElementById('btn-replace-all')?.addEventListener('click', () => EditorManager.doReplaceAll());
    document.getElementById('search-case')?.addEventListener('change', () => EditorManager.doSearch());
    document.getElementById('search-regex')?.addEventListener('change', () => EditorManager.doSearch());

    // Keyboard shortcuts
    document.addEventListener('keydown', _handleKeys);

    // Modal overlay close on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
    });

    // Context menu
    document.addEventListener('contextmenu', _handleContextMenu);
    document.addEventListener('click', e => { if (!e.target.closest('#context-menu')) _closeCtxMenu(); });
    _bindCtxMenu();

    // Hamburger / drawer
    document.getElementById('btn-hamburger')?.addEventListener('click', UI.openDrawer);
    document.getElementById('btn-drawer-close')?.addEventListener('click', UI.closeDrawer);
    document.getElementById('drawer-backdrop')?.addEventListener('click', UI.closeDrawer);

    // Theme buttons (titlebar + drawer)
    document.querySelectorAll('.theme-btn[data-t]').forEach(btn => {
      btn.addEventListener('click', () => setTheme(btn.dataset.t));
    });

    // Mobile bottom nav
    document.querySelectorAll('#mobile-nav .mob-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#mobile-nav .mob-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _switchMode(btn.dataset.mode);
      });
    });
    document.getElementById('mob-search')?.addEventListener('click', () => EditorManager.openSearch());
    document.getElementById('mob-save')?.addEventListener('click', saveActive);

    // Preview panel buttons
    document.getElementById('btn-preview-close')?.addEventListener('click', () => {
      document.getElementById('preview-panel')?.classList.add('hidden');
      if (UI.previewSide) UI._exitSide();
    });
    document.getElementById('btn-preview-refresh')?.addEventListener('click', refreshPreview);
    document.getElementById('btn-preview-newwin')?.addEventListener('click', _previewNewWindow);
    document.getElementById('btn-preview-side')?.addEventListener('click', _togglePreviewSide);
    _initPreviewDrag();
    _initPreviewResize();

    // Terminal resize
    _initTerminalResize();

    // Textarea live update for markdown
    document.getElementById('md-source')?.addEventListener('input', e => {
      const tab = TabManager.getActiveTab();
      if (tab) { tab.content = e.target.value; TabManager.updateTabContent(tab.id, e.target.value); }
      EditorManager.renderMarkdown(e.target.value);
      refreshPreview();
    });
    document.getElementById('notepad-area')?.addEventListener('input', e => {
      const tab = TabManager.getActiveTab();
      if (tab) TabManager.updateTabContent(tab.id, e.target.value);
      refreshPreview();
    });
  }

  function _switchMode(mode) {
    const tab = TabManager.getActiveTab();
    if (tab) tab.mode = mode;
    EditorManager.switchMode(mode);
    if (tab) EditorManager.loadTab(tab);
    // Sync toolbar buttons
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.querySelectorAll('#mobile-nav .mob-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    // Status
    const names = { code:'CODE', word:'WORD', markdown:'MD', notepad:'NOTAS' };
    const el = document.getElementById('status-mode');
    if (el) el.textContent = names[mode] || mode.toUpperCase();
  }

  function _handleKeys(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 's') { e.preventDefault(); saveActive(); }
    if (ctrl && e.key === 'n') { e.preventDefault(); TabManager.createTab(); }
    if (ctrl && e.key === 'f') { e.preventDefault(); EditorManager.openSearch(); }
    if (ctrl && e.key === 'w') { e.preventDefault(); const t = TabManager.getActiveTab(); if (t) TabManager.closeTab(t.id); }
    if (ctrl && e.key === '`') { e.preventDefault(); UI.toggleTerminal(); }
    if (ctrl && e.key === 'p') { e.preventDefault(); UI.togglePreview(); }
    if (e.key === 'F5') {
      const p = document.getElementById('preview-panel');
      if (p && !p.classList.contains('hidden')) { e.preventDefault(); refreshPreview(); }
    }
    if (e.key === 'Escape') { EditorManager.closeSearch(); _closeCtxMenu(); }
  }

  // ════════ SAVE ════════
  function saveActive() {
    const tab = TabManager.getActiveTab();
    if (!tab) return;
    // Sync content from active editor
    tab.content = EditorManager.getContent();
    BackupManager.saveFile(tab).then(() => {
      TabManager.markTabSaved(tab.id);
      showToast(`💾 "${tab.name}" salvo`, 'success');
    }).catch(e => showToast('Erro ao salvar: ' + e.message, 'error'));
  }

  async function _autoSave() {
    const tabs = TabManager.getAllTabs();
    for (const tab of tabs) {
      if (tab.modified) {
        await BackupManager.saveFile(tab).catch(() => {});
      }
    }
  }

  // ════════ FILE IMPORT ════════
  async function _handleFileInput(e) {
    const files = Array.from(e.target.files);
    for (const file of files) await _importFile(file);
    e.target.value = '';
  }

  async function _importFile(file) {
    const ext  = file.name.split('.').pop().toLowerCase();
    let content = '', mode = 'code', lang = 'plaintext';
    try {
      if (ext === 'docx' && typeof mammoth !== 'undefined') {
        const arr = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: arr });
        content = res.value; mode = 'word';
      } else if (ext === 'pdf') {
        content = await _extractPDF(file); mode = 'notepad';
      } else {
        content = await file.text();
        const modeMap = { txt:'notepad', md:'markdown', html:'code', htm:'code', css:'code',
          js:'code', ts:'code', json:'code', py:'code', java:'code', cpp:'code',
          c:'code', cs:'code', php:'code', rb:'code', go:'code', rs:'code',
          xml:'code', yaml:'code', yml:'code', sql:'code', sh:'code' };
        const langMap = { html:'html', htm:'html', css:'css', js:'javascript', ts:'typescript',
          json:'json', py:'python', java:'java', cpp:'cpp', c:'c', cs:'csharp',
          php:'php', rb:'ruby', go:'go', rs:'rust', xml:'xml', yaml:'yaml',
          yml:'yaml', sql:'sql', sh:'shell', md:'markdown' };
        mode = modeMap[ext] || 'code';
        lang = langMap[ext] || 'plaintext';
      }
      TabManager.createTab(file.name, content, mode, lang);
      showToast(`📂 "${file.name}" importado`, 'success');
    } catch (err) {
      showToast(`Erro ao importar "${file.name}": ` + err.message, 'error');
    }
  }

  async function _extractPDF(file) {
    if (typeof pdfjsLib === 'undefined') return await file.text().catch(() => '');
    const arr = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
    let out = `[PDF: ${file.name} — ${pdf.numPages} página(s)]\n\n`;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc   = await page.getTextContent();
      let txt = '', lastY = null;
      tc.items.forEach(item => {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) txt += '\n';
        txt   += item.str;
        lastY  = item.transform[5];
      });
      out += `--- Página ${p} ---\n${txt.trim()}\n\n`;
    }
    return out;
  }

  // ════════ EXPORT ════════
  function _updateExportName() {
    const tab = TabManager.getActiveTab();
    const fmt = document.getElementById('export-format')?.value || 'txt';
    const el  = document.getElementById('export-filename');
    if (el && tab) el.value = tab.name.replace(/\.[^.]+$/, '') + '.' + fmt;
  }

  function _doExport() {
    const tab   = TabManager.getActiveTab();
    if (!tab) return;
    const fmt   = document.getElementById('export-format')?.value || 'txt';
    const fname = document.getElementById('export-filename')?.value || ('documento.' + fmt);
    const content = tab.content || '';

    try {
      if (fmt === 'pdf') {
        _exportPDF(tab, fname);
      } else {
        let text = content, mime = 'text/plain;charset=utf-8';
        if (fmt === 'html') {
          text = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${_esc(tab.name)}</title>\n</head>\n<body>\n<pre>${_esc(content)}</pre>\n</body>\n</html>`;
          mime = 'text/html;charset=utf-8';
        } else if (fmt === 'json') {
          text = JSON.stringify({ name: tab.name, content, mode: tab.mode, exportedAt: new Date().toISOString() }, null, 2);
          mime = 'application/json;charset=utf-8';
        }
        _download(new Blob([text], { type: mime }), fname);
      }
      document.getElementById('export-modal')?.classList.add('hidden');
      showToast(`📤 Exportado como "${fname}"`, 'success');
    } catch (err) {
      showToast('Erro ao exportar: ' + err.message, 'error');
    }
  }

  function _exportPDF(tab, fname) {
    const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
    if (!jsPDF) { showToast('jsPDF não carregado', 'error'); return; }
    const doc   = new jsPDF();
    const lines = doc.splitTextToSize(tab.content || '', 180);
    doc.setFontSize(14); doc.setFont('Helvetica', 'bold');
    doc.text(tab.name, 14, 20);
    doc.setFontSize(10); doc.setFont('Courier', 'normal');
    let y = 32;
    lines.forEach(line => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y); y += 5;
    });
    doc.save(fname);
  }

  function _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ════════ ENCRYPT ════════
  function _doEncrypt() {
    const tab = TabManager.getActiveTab();
    const pwd = document.getElementById('encrypt-password')?.value;
    if (!tab || !pwd) { showToast('Digite uma senha', 'error'); return; }
    try {
      tab.content  = CryptoJS.AES.encrypt(tab.content, pwd).toString();
      tab.encrypted = true;
      EditorManager.setContent(tab.content);
      document.getElementById('encrypt-modal')?.classList.add('hidden');
      showToast('🔒 Arquivo criptografado', 'success');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  function _doDecrypt() {
    const tab = TabManager.getActiveTab();
    const pwd = document.getElementById('encrypt-password')?.value;
    if (!tab || !pwd) { showToast('Digite a senha', 'error'); return; }
    try {
      const bytes  = CryptoJS.AES.decrypt(tab.content, pwd);
      const dec    = bytes.toString(CryptoJS.enc.Utf8);
      if (!dec) throw new Error('Senha incorreta ou arquivo corrompido');
      tab.content  = dec; tab.encrypted = false;
      EditorManager.setContent(dec);
      document.getElementById('encrypt-modal')?.classList.add('hidden');
      showToast('🔓 Arquivo descriptografado', 'success');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  // ════════ RENAME ════════
  function _doRename() {
    const tab  = TabManager.getActiveTab();
    const name = document.getElementById('rename-input')?.value?.trim();
    if (!tab || !name) return;
    TabManager.renameTab(tab.id, name);
    document.getElementById('active-file-name').textContent = name;
    document.getElementById('rename-modal')?.classList.add('hidden');
    showToast(`✏ Renomeado para "${name}"`, 'success');
  }

  // ════════ LANGUAGE ════════
  function _doLang() {
    const lang = document.getElementById('lang-select')?.value;
    const tab  = TabManager.getActiveTab();
    if (!tab || !lang) return;
    tab.language = lang;
    if (typeof monaco !== 'undefined') {
      const model = monaco.editor.getModels()[0];
      if (model) monaco.editor.setModelLanguage(model, lang);
    }
    document.getElementById('lang-modal')?.classList.add('hidden');
    showToast('🌐 Linguagem: ' + lang, 'success');
  }

  // ════════ CONTEXT MENU ════════
  let _ctxTarget = null;

  function _handleContextMenu(e) {
    const editable = e.target.closest('#notepad-area, #md-source, .ql-editor, #monaco-editor, .textarea-wrap');
    if (!editable) return;
    e.preventDefault();
    _ctxTarget = e.target;
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    let x = e.clientX, y = e.clientY;
    if (x + 200 > window.innerWidth)  x = window.innerWidth  - 205;
    if (y + 200 > window.innerHeight) y = window.innerHeight - 205;
    Object.assign(menu.style, { left: x + 'px', top: y + 'px' });
    menu.classList.add('open');
  }

  function _closeCtxMenu() {
    document.getElementById('context-menu')?.classList.remove('open');
  }

  function _getFocusedTA() {
    const a = document.activeElement;
    if (a && (a.id === 'notepad-area' || a.id === 'md-source')) return a;
    if (_ctxTarget) return _ctxTarget.closest('textarea');
    return null;
  }

  function _bindCtxMenu() {
    document.getElementById('ctx-cut')?.addEventListener('click', async () => {
      _closeCtxMenu();
      const ta = _getFocusedTA();
      if (ta) {
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        if (!sel) return;
        await navigator.clipboard.writeText(sel).catch(() => {});
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + ta.value.slice(ta.selectionEnd);
        ta.setSelectionRange(s, s);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    document.getElementById('ctx-copy')?.addEventListener('click', async () => {
      _closeCtxMenu();
      const ta = _getFocusedTA();
      const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : (window.getSelection()?.toString() || '');
      if (sel) await navigator.clipboard.writeText(sel).catch(() => {});
    });
    document.getElementById('ctx-paste')?.addEventListener('click', async () => {
      _closeCtxMenu();
      const ta = _getFocusedTA();
      if (!ta) return;
      try {
        const text = await navigator.clipboard.readText();
        const s = ta.selectionStart, e2 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e2);
        ta.setSelectionRange(s + text.length, s + text.length);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      } catch { showToast('Use Ctrl+V para colar', 'info'); }
    });
    document.getElementById('ctx-selectall')?.addEventListener('click', () => {
      _closeCtxMenu();
      const ta = _getFocusedTA();
      if (ta) { ta.focus(); ta.setSelectionRange(0, ta.value.length); }
      else document.execCommand('selectAll');
    });
    document.getElementById('ctx-search')?.addEventListener('click', () => {
      _closeCtxMenu();
      const ta  = _getFocusedTA();
      const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : (window.getSelection()?.toString() || '');
      EditorManager.openSearch();
      if (sel) { const inp = document.getElementById('search-input'); if (inp) { inp.value = sel; EditorManager.doSearch(); } }
    });
    document.getElementById('ctx-save')?.addEventListener('click', () => { _closeCtxMenu(); saveActive(); });
  }

  // ════════ PREVIEW ════════
  function refreshPreview() {
    const panel = document.getElementById('preview-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    const tab   = TabManager.getActiveTab();
    const frame = document.getElementById('preview-frame');
    const empty = document.getElementById('preview-empty');
    const badge = document.getElementById('preview-badge');
    if (!frame || !tab) return;

    const content = tab.content || '';
    let html = '', badgeText = 'TEXTO';

    if (tab.mode === 'code') {
      const lang = (tab.language || '').toLowerCase();
      if (['html','htm'].includes(lang)) {
        html = content; badgeText = 'HTML';
      } else if (['javascript','js'].includes(lang)) {
        badgeText = 'JS';
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:monospace;background:#111;color:#0f0;padding:16px;margin:0;}
.err{color:#f66;} pre{white-space:pre-wrap;word-break:break-word;}
</style></head><body><pre id="out"></pre><script>
const out=document.getElementById('out');
const _cl=console.log.bind(console),_ce=console.error.bind(console);
console.log=(...a)=>{out.textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):x).join(' ')+'\\n';_cl(...a);};
console.error=(...a)=>{out.innerHTML+='<span class="err">'+a.join(' ')+'\\n<\\/span>';_ce(...a);};
try{${content.replace(/<\/script>/g,'<\\/script>')}}catch(e){console.error('Erro: '+e.message);}
<\/script></body></html>`;
      } else if (lang === 'css') {
        badgeText = 'CSS';
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${content}</style></head><body style="padding:24px;font-family:sans-serif">
<h2>Preview CSS</h2><p class="demo">Parágrafo demo</p><div class="demo" style="padding:8px">Div demo</div><button class="demo">Botão demo</button>
</body></html>`;
      } else if (lang === 'markdown') {
        const md = typeof marked !== 'undefined' ? marked.parse(content) : content;
        badgeText = 'MD';
        html = _mdHtml(md);
      } else {
        badgeText = lang.toUpperCase() || 'CODE';
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:monospace;white-space:pre-wrap;padding:16px;background:#1e1e1e;color:#d4d4d4;margin:0;word-break:break-word;}</style></head><body>${_esc(content)}</body></html>`;
      }
    } else if (tab.mode === 'markdown') {
      const md = typeof marked !== 'undefined' ? marked.parse(content) : content;
      badgeText = 'MARKDOWN'; html = _mdHtml(md);
    } else if (tab.mode === 'word') {
      badgeText = 'WORD';
      html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css" rel="stylesheet">
<style>body{padding:24px;max-width:820px;margin:0 auto;font-family:sans-serif;}.ql-editor{padding:0;}</style>
</head><body><div class="ql-editor">${content}</div></body></html>`;
    } else {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;white-space:pre-wrap;padding:20px;line-height:1.7;word-break:break-word;}</style></head><body>${_esc(content)}</body></html>`;
    }

    if (badge) badge.textContent = badgeText;
    const lbl = document.getElementById('preview-label');
    if (lbl) lbl.textContent = `Preview — ${tab.name}`;
    frame.srcdoc = html || '';
    if (empty) empty.style.display = html ? 'none' : 'flex';
  }

  function _mdHtml(md) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:24px;line-height:1.7;}
pre{background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow:auto;}
code{background:#f0f0f0;padding:2px 5px;border-radius:3px;font-family:monospace;}
blockquote{border-left:3px solid #58a6ff;margin-left:0;padding-left:16px;color:#666;}
table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:8px;}th{background:#f5f5f5;}
img{max-width:100%;border-radius:6px;}
</style></head><body>${md}</body></html>`;
  }

  function _previewNewWindow() {
    const frame = document.getElementById('preview-frame');
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { showToast('Pop-up bloqueado', 'error'); return; }
    w.document.write(frame?.srcdoc || '<p>Sem conteúdo</p>');
    w.document.close();
  }

  function _togglePreviewSide() {
    const panel = document.getElementById('preview-panel');
    const main  = document.getElementById('main-area');
    if (!panel || !main) return;
    if (UI.previewSide) {
      UI._exitSide();
    } else {
      UI.previewSide = true;
      panel.classList.add('side-mode');
      panel.classList.remove('hidden');
      main.classList.add('with-preview');
      main.appendChild(panel);
      refreshPreview();
      const btn = document.getElementById('btn-preview-side');
      if (btn) btn.textContent = '⬛ Flutuar';
    }
  }

  function _initPreviewDrag() {
    const panel  = document.getElementById('preview-panel');
    const handle = document.getElementById('preview-titlebar');
    if (!panel || !handle) return;
    let drag = false, ox = 0, oy = 0;
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.preview-btn') || UI.previewSide) return;
      drag = true; const r = panel.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      panel.style.transition = 'none'; e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      panel.style.right = panel.style.bottom = 'auto';
      panel.style.left = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  e.clientX - ox)) + 'px';
      panel.style.top  = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - oy)) + 'px';
    });
    document.addEventListener('mouseup', () => { drag = false; });
  }

  function _initPreviewResize() {
    const panel  = document.getElementById('preview-panel');
    const handle = document.getElementById('preview-resize-h');
    if (!panel || !handle) return;
    let res = false, sx, sw;
    handle.addEventListener('mousedown', e => {
      if (UI.previewSide) return;
      res = true; sx = e.clientX; sw = panel.offsetWidth; e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!res) return;
      panel.style.width = Math.max(280, sw - (e.clientX - sx)) + 'px';
    });
    document.addEventListener('mouseup', () => { res = false; });
  }

  // ════════ TERMINAL RESIZE ════════
  function _initTerminalResize() {
    const pane   = document.getElementById('terminal-pane');
    const handle = document.getElementById('terminal-resize');
    if (!pane || !handle) return;
    let res = false, sy, sh;
    handle.addEventListener('mousedown', e => {
      res = true; sy = e.clientY; sh = pane.offsetHeight; e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!res) return;
      const h = Math.max(120, Math.min(600, sh + (sy - e.clientY)));
      pane.style.height = h + 'px';
    });
    document.addEventListener('mouseup', () => { res = false; });
  }

  // ════════ CLOCK ════════
  function _updateClock() {
    const el = document.getElementById('datetime-display');
    if (el) el.textContent = new Date().toLocaleString('pt-BR');
  }

  function _setOffline(offline) {
    const el = document.getElementById('status-offline');
    if (el) el.style.display = offline ? '' : 'none';
  }

  // ════════ THEME ════════
  function setTheme(t, save = true) {
    document.documentElement.dataset.theme = t;
    document.body.dataset.theme = t;
    const colors = { dark: '#58a6ff', light: '#0969da', hacker: '#00ff41' };
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[t] || '#58a6ff');
    EditorManager.updateMonacoTheme && EditorManager.updateMonacoTheme(t);
    if (save) BackupManager.saveSetting('theme', t).catch(() => {});
  }

  // ════════ PWA INSTALL ════════
  async function installPWA() {
    if (!_deferredInstall) {
      showToast('Para instalar: use o menu do navegador → "Adicionar à tela inicial"', 'info', 5000);
      return;
    }
    try {
      _deferredInstall.prompt();
      const { outcome } = await _deferredInstall.userChoice;
      if (outcome === 'accepted') {
        _deferredInstall = null;
        showToast('✅ App instalado!', 'success');
      }
    } catch (e) { showToast('Erro na instalação: ' + e.message, 'error'); }
  }

  // ════════ TOAST ════════
  function showToast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ════════ UTILS ════════
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { init, saveActive, setTheme, installPWA, showToast, refreshPreview };
})();

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  BackupManager.init().then(() => AppMain.init()).catch(e => {
    console.error('Boot error:', e);
    AppMain.init();
  });
});
