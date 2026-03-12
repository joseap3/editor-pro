// ===================== EDITOR.JS =====================
const EditorManager = (() => {
  let monacoEditor = null;
  let monacoReady  = false;
  let quillEditor  = null;
  let quillReady   = false;

  // ── Monaco ──────────────────────────────────────────
  function initMonaco(cb) {
    if (monacoReady) { cb && cb(); return; }
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: '', language: 'plaintext',
        theme: document.body.dataset.theme === 'light' ? 'vs' : 'vs-dark',
        fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
        lineNumbers: 'on', wordWrap: 'on',
        minimap: { enabled: true }, scrollBeyondLastLine: false,
        automaticLayout: true, tabSize: 2,
        suggestOnTriggerCharacters: true, quickSuggestions: true,
        folding: true, bracketPairColorization: { enabled: true },
      });
      monacoEditor.onDidChangeModelContent(() => {
        const tab = TabManager.getActiveTab();
        if (tab) TabManager.updateTabContent(tab.id, monacoEditor.getValue());
      });
      monacoReady = true;
      cb && cb();
    });
  }

  // ── Quill ────────────────────────────────────────────
  function initQuill() {
    if (quillReady) return;
    const el = document.getElementById('quill-editor');
    if (!el || typeof Quill === 'undefined') return;
    quillEditor = new Quill('#quill-editor', {
      theme: 'snow',
      modules: { toolbar: '#quill-toolbar', history: { delay: 500, maxStack: 100 } }
    });
    quillEditor.on('text-change', () => {
      const tab = TabManager.getActiveTab();
      if (tab) TabManager.updateTabContent(tab.id, quillEditor.root.innerHTML);
    });
    quillReady = true;
  }

  // ── Tab ──────────────────────────────────────────────
  function loadTab(tab) {
    switchMode(tab.mode);
    if (tab.mode === 'code') {
      if (!monacoReady) initMonaco(() => _setMonaco(tab.content, tab.language));
      else _setMonaco(tab.content, tab.language);
    } else if (tab.mode === 'word') {
      initQuill();
      setTimeout(() => { if (quillEditor) quillEditor.root.innerHTML = tab.content || ''; }, 50);
    } else if (tab.mode === 'markdown') {
      const ta = document.getElementById('md-source');
      if (ta) ta.value = tab.content || '';
      renderMarkdown(tab.content || '');
    } else if (tab.mode === 'notepad') {
      const ta = document.getElementById('notepad-area');
      if (ta) ta.value = tab.content || '';
    }
    if (document.getElementById('search-panel')?.style.display === 'flex') {
      setTimeout(doSearch, 120);
    }
  }

  function _setMonaco(content, language) {
    if (!monacoEditor) return;
    const model = monacoEditor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language || 'plaintext');
      monacoEditor.setValue(content || '');
    }
  }

  function switchMode(mode) {
    ['code','word','markdown','notepad'].forEach(m => {
      const p = document.getElementById('panel-' + m);
      if (p) p.style.display = m === mode ? 'flex' : 'none';
    });
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));
    const tb = document.getElementById('word-toolbar');
    if (tb) tb.style.display = mode === 'word' ? 'flex' : 'none';
  }

  function setContent(content) {
    const tab = TabManager.getActiveTab();
    if (!tab) return;
    tab.content = content;
    if (tab.mode === 'code' && monacoEditor) monacoEditor.setValue(content);
    else if (tab.mode === 'word' && quillEditor) quillEditor.root.innerHTML = content;
    else if (tab.mode === 'markdown') {
      const ta = document.getElementById('md-source');
      if (ta) ta.value = content;
      renderMarkdown(content);
    } else if (tab.mode === 'notepad') {
      const ta = document.getElementById('notepad-area');
      if (ta) ta.value = content;
    }
  }

  function getContent() {
    const tab = TabManager.getActiveTab();
    return tab ? (tab.content || '') : '';
  }

  function renderMarkdown(source) {
    const preview = document.getElementById('md-preview');
    if (preview && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(source || '');
      preview.querySelectorAll('pre code').forEach(b => {
        Object.assign(b.style, { background:'var(--code-bg)', padding:'1rem',
          borderRadius:'6px', display:'block', overflow:'auto' });
      });
    }
  }

  function updateMonacoTheme(theme) {
    if (!monacoReady || !monacoEditor) return;
    monaco.editor.setTheme(theme === 'light' ? 'vs' : theme === 'hacker' ? 'hc-black' : 'vs-dark');
  }

  // ════════════════════════════════════════════════════
  //  SEARCH & REPLACE  — highlight + setas
  //  Suporta: code (Monaco), word (Quill), markdown, notepad
  // ════════════════════════════════════════════════════
  let matches     = [];
  let activeIdx   = -1;
  let monacoDecos = [];
  // Para Quill: guarda os ranges Quill encontrados
  let quillMatches = [];  // [{index, length}]

  function openSearch() {
    document.getElementById('search-panel').style.display = 'flex';
    const i = document.getElementById('search-input');
    if (i) { i.focus(); i.select(); }
  }

  function closeSearch() {
    const p = document.getElementById('search-panel');
    if (p) p.style.display = 'none';
    _clearAll();
  }

  // ── doSearch — chamado a cada tecla ─────────────────
  function doSearch() {
    const query = document.getElementById('search-input')?.value || '';
    const cs    = document.getElementById('search-case')?.checked  || false;
    const rx    = document.getElementById('search-regex')?.checked || false;
    const tab   = TabManager.getActiveTab();

    _clearAll();
    if (!query || !tab) { _counter(0, 0); _inputColor(false, false); return; }

    if (tab.mode === 'code' && monacoReady && monacoEditor) {
      _monacoSearch(query, cs, rx);
    } else if (tab.mode === 'word') {
      _quillSearch(query, cs, rx);
    } else {
      // notepad ou markdown
      _taSearch(query, cs, rx, tab);
    }
  }

  // ── Navegação ↑↓ ────────────────────────────────────
  function gotoNextMatch() {
    if (!matches.length && !quillMatches.length) return;
    const tab = TabManager.getActiveTab();
    if (tab && tab.mode === 'word') {
      activeIdx = (activeIdx + 1) % quillMatches.length;
      _quillHighlight(activeIdx);
      _counter(quillMatches.length, activeIdx + 1);
    } else {
      if (!matches.length) return;
      activeIdx = (activeIdx + 1) % matches.length;
      _applyActive();
    }
  }

  function gotoPrevMatch() {
    if (!matches.length && !quillMatches.length) return;
    const tab = TabManager.getActiveTab();
    if (tab && tab.mode === 'word') {
      activeIdx = (activeIdx - 1 + quillMatches.length) % quillMatches.length;
      _quillHighlight(activeIdx);
      _counter(quillMatches.length, activeIdx + 1);
    } else {
      if (!matches.length) return;
      activeIdx = (activeIdx - 1 + matches.length) % matches.length;
      _applyActive();
    }
  }

  function _applyActive() {
    const tab = TabManager.getActiveTab();
    if (!tab) return;
    _counter(matches.length, activeIdx + 1);
    if (tab.mode === 'code' && monacoReady && monacoEditor) {
      _monacoDrawDecos(activeIdx);
      monacoEditor.revealRangeInCenter(matches[activeIdx]);
    } else {
      _taDrawHL(tab, activeIdx);
      _taScrollTo(tab.mode, matches[activeIdx]);
    }
  }

  // ════════════════════════════════════════════════════
  //  QUILL SEARCH — busca e marca diretamente no DOM
  // ════════════════════════════════════════════════════
  function _quillSearch(query, cs, rx) {
    if (!quillEditor) return;

    // Primeiro remove qualquer highlight anterior
    _quillClearHL();

    // Pega o texto puro do Quill
    const text = quillEditor.getText();
    let pat;
    try {
      const flags = cs ? 'g' : 'gi';
      pat = rx ? new RegExp(query, flags) : new RegExp(_escRx(query), flags);
    } catch(e) { _inputColor(false, true); return; }

    const found = [];
    let m;
    pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null) {
      found.push({ index: m.index, length: m[0].length });
      if (m[0].length === 0) pat.lastIndex++;
    }

    quillMatches = found;
    activeIdx    = found.length ? 0 : -1;
    _counter(found.length, found.length ? 1 : 0);
    _inputColor(found.length > 0, true);

    if (!found.length) return;

    // Aplica background colorido em TODAS as ocorrências via Quill formatText
    found.forEach((f, i) => {
      // background amarelo para todas
      quillEditor.formatText(f.index, f.length, { background: '#e3b34166', color: false }, 'silent');
    });

    // Destaca a primeira em laranja
    _quillHighlight(0);
  }

  function _quillHighlight(idx) {
    if (!quillEditor || !quillMatches.length) return;

    // Reaplica amarelo em todas primeiro
    quillMatches.forEach(f => {
      quillEditor.formatText(f.index, f.length, { background: '#e3b34166' }, 'silent');
    });

    // Laranja na ativa
    const active = quillMatches[idx];
    if (active) {
      quillEditor.formatText(active.index, active.length, { background: '#f9826c99' }, 'silent');
      // Scrola para o match ativo
      try {
        const bounds = quillEditor.getBounds(active.index, active.length);
        const container = document.querySelector('.ql-container');
        if (container && bounds) {
          container.scrollTop = Math.max(0, bounds.top - container.clientHeight / 2);
        }
      } catch(e) {}
    }
  }

  function _quillClearHL() {
    if (!quillEditor || !quillMatches.length) return;
    // Remove o background de formatação de todos os matches anteriores
    quillMatches.forEach(f => {
      quillEditor.removeFormat(f.index, f.length, 'silent');
    });
    quillMatches = [];
  }

  // ════════════════════════════════════════════════════
  //  MONACO SEARCH
  // ════════════════════════════════════════════════════
  function _monacoSearch(query, cs, rx) {
    const model = monacoEditor.getModel();
    if (!model) return;
    let found;
    try { found = model.findMatches(query, true, rx, cs, null, true); }
    catch(e) { return; }
    matches   = found.map(m => m.range);
    activeIdx = found.length ? 0 : -1;
    _monacoDrawDecos(0);
    if (found.length) monacoEditor.revealRangeInCenter(found[0].range);
    _counter(found.length, found.length ? 1 : 0);
    _inputColor(found.length > 0, true);
  }

  function _monacoDrawDecos(curIdx) {
    const decos = matches.map((range, i) => ({
      range,
      options: {
        inlineClassName: i === curIdx ? 'search-match-active' : 'search-match-all',
        overviewRuler: { color: i === curIdx ? '#f9826c' : '#e3b341', position: 1 },
        minimap: { color: '#e3b341', position: 1 },
      }
    }));
    monacoDecos = monacoEditor.deltaDecorations(monacoDecos, decos);
  }

  // ════════════════════════════════════════════════════
  //  TEXTAREA SEARCH (notepad + markdown)
  // ════════════════════════════════════════════════════
  function _taSearch(query, cs, rx, tab) {
    const ta = _getTA(tab.mode);
    if (!ta) return;

    const content = ta.value;
    let pat;
    try {
      const flags = cs ? 'g' : 'gi';
      pat = rx ? new RegExp(query, flags) : new RegExp(_escRx(query), flags);
    } catch(e) { _inputColor(false, true); return; }

    const found = [];
    let m;
    pat.lastIndex = 0;
    while ((m = pat.exec(content)) !== null) {
      found.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) pat.lastIndex++;
    }

    matches   = found;
    activeIdx = found.length ? 0 : -1;
    _counter(found.length, found.length ? 1 : 0);
    _inputColor(found.length > 0, true);

    if (!found.length) { _clearHL(tab.mode); return; }
    _taDrawHL(tab, 0);
    _taScrollTo(tab.mode, found[0]);
  }

  function _taDrawHL(tab, curIdx) {
    const hl = _getHL(tab.mode);
    const ta = _getTA(tab.mode);
    if (!hl || !ta) return;

    const cs = window.getComputedStyle(ta);
    hl.style.fontFamily    = cs.fontFamily;
    hl.style.fontSize      = cs.fontSize;
    hl.style.fontWeight    = cs.fontWeight;
    hl.style.lineHeight    = cs.lineHeight;
    hl.style.letterSpacing = cs.letterSpacing;
    hl.style.padding       = cs.padding;
    hl.style.whiteSpace    = 'pre-wrap';
    hl.style.wordBreak     = 'break-word';
    hl.style.overflowWrap  = 'break-word';

    const text = ta.value;
    let html = '', last = 0;
    matches.forEach((match, i) => {
      html += _esc(text.slice(last, match.start));
      const cls = i === curIdx ? 'sh-active' : 'sh-all';
      html += `<mark class="${cls}">${_esc(text.slice(match.start, match.end))}</mark>`;
      last = match.end;
    });
    html += _esc(text.slice(last));

    hl.innerHTML = html;
    hl.scrollTop  = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;

    if (!ta._hlSync) {
      ta._hlSync = true;
      ta.addEventListener('scroll', () => {
        hl.scrollTop  = ta.scrollTop;
        hl.scrollLeft = ta.scrollLeft;
      }, { passive: true });
    }
  }

  function _taScrollTo(mode, match) {
    const ta = _getTA(mode);
    const hl = _getHL(mode);
    if (!ta || !match) return;
    try { ta.setSelectionRange(match.start, match.end); } catch(e) {}
    const before  = ta.value.slice(0, match.start);
    const lineNum = (before.match(/\n/g) || []).length;
    const lh      = parseFloat(window.getComputedStyle(ta).lineHeight) || 20;
    const padTop  = parseFloat(window.getComputedStyle(ta).paddingTop)  || 0;
    ta.scrollTop  = Math.max(0, padTop + lineNum * lh - ta.clientHeight / 3);
    if (hl) hl.scrollTop = ta.scrollTop;
  }

  function _clearHL(mode) {
    const hl = _getHL(mode);
    if (hl) hl.innerHTML = '';
  }

  function _clearAll() {
    // Monaco
    if (monacoReady && monacoEditor && monacoDecos.length) {
      monacoDecos = monacoEditor.deltaDecorations(monacoDecos, []);
    }
    // Quill
    _quillClearHL();
    // Textareas
    _clearHL('notepad');
    _clearHL('markdown');
    matches   = [];
    activeIdx = -1;
    _counter(0, 0);
    _inputColor(false, false);
  }

  function _getTA(mode) {
    return document.getElementById(mode === 'notepad' ? 'notepad-area' : 'md-source');
  }
  function _getHL(mode) {
    return document.getElementById(mode === 'notepad' ? 'notepad-hl' : 'md-source-hl');
  }

  // ── UI helpers ───────────────────────────────────────
  function _counter(total, cur) {
    const el = document.getElementById('search-count');
    if (!el) return;
    const q = document.getElementById('search-input')?.value || '';
    if (!q)          { el.textContent = '';                  el.style.color = 'var(--text3)'; }
    else if (!total) { el.textContent = 'Não encontrado';    el.style.color = 'var(--red)'; }
    else             { el.textContent = cur + ' / ' + total; el.style.color = 'var(--green)'; }
  }

  function _inputColor(found, hasQ) {
    const inp = document.getElementById('search-input');
    if (!inp) return;
    inp.style.borderColor = !hasQ ? '' : found ? 'var(--green)' : 'var(--red)';
  }

  // ── Replace ─────────────────────────────────────────
  function doReplace() {
    const tab = TabManager.getActiveTab();
    if (!tab) return;
    const val = document.getElementById('replace-input')?.value || '';

    if (tab.mode === 'code' && monacoEditor) {
      monacoEditor.trigger('', 'editor.action.replaceOne', {});
      setTimeout(doSearch, 80); return;
    }

    if (tab.mode === 'word' && quillEditor) {
      const idx2 = activeIdx < 0 ? 0 : activeIdx;
      const m = quillMatches[idx2];
      if (!m) return;
      // Remove highlight, aplica substituição, rebusca
      _quillClearHL();
      quillEditor.deleteText(m.index, m.length, 'user');
      quillEditor.insertText(m.index, val, 'user');
      setTimeout(doSearch, 80); return;
    }

    // notepad / markdown
    if (!matches.length) return;
    const idx2 = activeIdx < 0 ? 0 : activeIdx;
    const match = matches[idx2];
    if (!match) return;
    const ta = _getTA(tab.mode);
    const c  = ta ? ta.value : (tab.content || '');
    const nc = c.slice(0, match.start) + val + c.slice(match.end);
    setContent(nc);
    if (tab) tab.content = nc;
    setTimeout(doSearch, 50);
  }

  function doReplaceAll() {
    const tab = TabManager.getActiveTab();
    if (!tab) return;
    const val = document.getElementById('replace-input')?.value || '';
    const q   = document.getElementById('search-input')?.value  || '';
    const cs  = document.getElementById('search-case')?.checked  || false;
    const rx  = document.getElementById('search-regex')?.checked || false;
    if (!q) return;

    if (tab.mode === 'code' && monacoEditor) {
      monacoEditor.trigger('', 'editor.action.replaceAll', {});
      setTimeout(doSearch, 80); return;
    }

    if (tab.mode === 'word' && quillEditor) {
      const count = quillMatches.length;
      if (!count) return;
      _quillClearHL();
      // Substitui de trás pra frente para não deslocar índices
      const sorted = [...quillMatches].reverse();
      sorted.forEach(m => {
        quillEditor.deleteText(m.index, m.length, 'user');
        quillEditor.insertText(m.index, val, 'user');
      });
      _clearAll();
      window.AppMain?.showToast(count + ' substituição(ões) realizada(s).');
      return;
    }

    // notepad / markdown
    const flags = cs ? 'g' : 'gi';
    let pat;
    try { pat = rx ? new RegExp(q, flags) : new RegExp(_escRx(q), flags); }
    catch(e) { return; }
    const ta    = _getTA(tab.mode);
    const c     = ta ? ta.value : (tab.content || '');
    const count = (c.match(pat) || []).length;
    const nc    = c.replace(pat, val);
    setContent(nc);
    if (tab) tab.content = nc;
    _clearAll();
    if (count) window.AppMain?.showToast(count + ' substituição(ões) realizada(s).');
  }

  // ── Utils ────────────────────────────────────────────
  function _escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function _esc(s)   { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return {
    initMonaco, initQuill, loadTab, switchMode, setContent, getContent,
    renderMarkdown, updateMonacoTheme,
    openSearch, closeSearch,
    doSearch, gotoNextMatch, gotoPrevMatch,
    doReplace, doReplaceAll
  };
})();
