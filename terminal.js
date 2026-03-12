// ===================== TERMINAL.JS =====================
const TerminalManager = (() => {
  let lines = [];
  let historyIndex = -1;
  let cmdHistory = [];
  const MAX_LINES = 200;

  const COMMANDS = {
    help: () => [
      '<span class="t-green">TEXT EDITOR PRO ULTRA - Terminal</span>',
      '<span class="t-yellow">Comandos disponíveis:</span>',
      '  <b>help</b>        - Mostra esta ajuda',
      '  <b>clear</b>       - Limpa o terminal',
      '  <b>date</b>        - Data atual',
      '  <b>time</b>        - Hora atual',
      '  <b>datetime</b>    - Data e hora atual',
      '  <b>save</b>        - Salva o arquivo ativo',
      '  <b>new</b>         - Nova aba',
      '  <b>list</b>        - Lista todas as abas abertas',
      '  <b>close</b>       - Fecha aba ativa',
      '  <b>stats</b>       - Estatísticas do texto',
      '  <b>theme dark</b>  - Tema escuro',
      '  <b>theme light</b> - Tema claro',
      '  <b>theme hacker</b>- Modo Hacker',
      '  <b>upper</b>       - Texto para maiúsculas',
      '  <b>lower</b>       - Texto para minúsculas',
      '  <b>trim</b>        - Remove espaços extras',
      '  <b>wordcount</b>   - Conta palavras',
      '  <b>echo [texto]</b>- Ecoa texto',
      '  <b>version</b>     - Versão do app',
      '  <b>about</b>       - Sobre o app',
    ],

    clear: () => { lines = []; renderTerminal(); return []; },

    date: () => {
      const d = new Date();
      return [`📅 <span class="t-cyan">${d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>`];
    },

    time: () => {
      const d = new Date();
      return [`🕐 <span class="t-cyan">${d.toLocaleTimeString('pt-BR')}</span>`];
    },

    datetime: () => {
      const d = new Date();
      return [`📅🕐 <span class="t-cyan">${d.toLocaleString('pt-BR')}</span>`];
    },

    save: () => {
      window.AppMain && AppMain.saveActive();
      return ['<span class="t-green">✓ Arquivo salvo!</span>'];
    },

    new: () => {
      TabManager.createTab();
      return ['<span class="t-green">✓ Nova aba criada.</span>'];
    },

    list: () => {
      const tabs = TabManager.getAllTabs();
      if (!tabs.length) return ['Nenhuma aba aberta.'];
      return ['<span class="t-yellow">Abas abertas:</span>', ...tabs.map((t, i) => `  ${i + 1}. ${t.name} [${t.mode}]${t.modified ? ' <span class="t-yellow">*modificado</span>' : ''}`)];
    },

    close: () => {
      const tab = TabManager.getActiveTab();
      if (tab) { TabManager.closeTab(tab.id); return ['<span class="t-green">✓ Aba fechada.</span>']; }
      return ['<span class="t-red">Nenhuma aba ativa.</span>'];
    },

    stats: () => {
      const tab = TabManager.getActiveTab();
      if (!tab) return ['<span class="t-red">Nenhuma aba ativa.</span>'];
      const text = tab.content || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const lines_ = text.split('\n').length;
      const chars = text.length;
      const sentences = (text.match(/[.!?]+/g) || []).length;
      return [
        `<span class="t-yellow">Estatísticas de "${tab.name}":</span>`,
        `  Palavras:    <b>${words}</b>`,
        `  Linhas:      <b>${lines_}</b>`,
        `  Caracteres:  <b>${chars}</b>`,
        `  Sentenças:   <b>${sentences}</b>`,
        `  Modo:        <b>${tab.mode}</b>`,
      ];
    },

    version: () => ['<span class="t-green">TEXT EDITOR PRO ULTRA v1.0.0</span>', 'Build: 2025 | PWA Ready | Offline First'],
    about: () => [
      '<span class="t-green">╔══════════════════════════════════╗</span>',
      '<span class="t-green">║   TEXT EDITOR PRO ULTRA v1.0     ║</span>',
      '<span class="t-green">╚══════════════════════════════════╝</span>',
      'Editor profissional multi-modo',
      'VSCode + Word + Markdown + Terminal',
      'PWA • Offline • IndexedDB • Criptografia',
    ],

    upper: () => {
      const tab = TabManager.getActiveTab();
      if (!tab) return ['<span class="t-red">Nenhuma aba ativa.</span>'];
      EditorManager.setContent(tab.content.toUpperCase());
      return ['<span class="t-green">✓ Texto convertido para maiúsculas.</span>'];
    },

    lower: () => {
      const tab = TabManager.getActiveTab();
      if (!tab) return ['<span class="t-red">Nenhuma aba ativa.</span>'];
      EditorManager.setContent(tab.content.toLowerCase());
      return ['<span class="t-green">✓ Texto convertido para minúsculas.</span>'];
    },

    trim: () => {
      const tab = TabManager.getActiveTab();
      if (!tab) return ['<span class="t-red">Nenhuma aba ativa.</span>'];
      const trimmed = tab.content.split('\n').map(l => l.trimEnd()).join('\n').trim();
      EditorManager.setContent(trimmed);
      return ['<span class="t-green">✓ Espaços removidos.</span>'];
    },

    wordcount: () => {
      const tab = TabManager.getActiveTab();
      if (!tab) return ['<span class="t-red">Nenhuma aba ativa.</span>'];
      const words = (tab.content.trim().match(/\S+/g) || []);
      const freq = {};
      words.forEach(w => { const k = w.toLowerCase(); freq[k] = (freq[k] || 0) + 1; });
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return [
        `Total: <b>${words.length}</b> palavras`,
        '<span class="t-yellow">Top 5:</span>',
        ...top.map(([w, c]) => `  "${w}": ${c}x`)
      ];
    },
  };

  function processCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) return;
    cmdHistory.unshift(trimmed);
    historyIndex = -1;
    appendLine(`<span class="t-prompt">ultra@editor</span><span class="t-dim">:</span><span class="t-blue">~</span><span class="t-dim">$</span> ${escapeHtml(trimmed)}`);

    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmd === 'theme') {
      const t = parts[1];
      if (t === 'dark' || t === 'light' || t === 'hacker') {
        window.AppMain && AppMain.setTheme(t);
        appendLine(`<span class="t-green">✓ Tema "${t}" aplicado.</span>`);
      } else {
        appendLine('<span class="t-red">Uso: theme [dark|light|hacker]</span>');
      }
      return;
    }

    if (cmd === 'echo') {
      appendLine(escapeHtml(args));
      return;
    }

    if (COMMANDS[cmd]) {
      const result = COMMANDS[cmd](args);
      if (result && result.length) result.forEach(l => appendLine(l));
    } else {
      appendLine(`<span class="t-red">Comando não encontrado: "${cmd}". Digite <b>help</b> para ajuda.</span>`);
    }
  }

  function appendLine(html) {
    lines.push(html);
    if (lines.length > MAX_LINES) lines.shift();
    renderTerminal();
  }

  function renderTerminal() {
    const out = document.getElementById('terminal-output');
    if (!out) return;
    out.innerHTML = lines.map(l => `<div class="t-line">${l}</div>`).join('');
    out.scrollTop = out.scrollHeight;
  }

  function init() {
    const input = document.getElementById('terminal-input');
    const inputRow = document.getElementById('terminal-input-row');
    const output = document.getElementById('terminal-output');

    if (!input) { console.error('Terminal input not found!'); return; }

    // Make entire input row clickable to focus input
    if (inputRow) {
      inputRow.addEventListener('click', () => input.focus());
    }
    if (output) {
      output.addEventListener('click', () => input.focus());
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value;
        processCommand(val);
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < cmdHistory.length - 1) {
          historyIndex++;
          input.value = cmdHistory[historyIndex];
          // Move cursor to end
          setTimeout(() => { input.selectionStart = input.selectionEnd = input.value.length; }, 0);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          input.value = cmdHistory[historyIndex];
        } else {
          historyIndex = -1;
          input.value = '';
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = input.value.toLowerCase().trim();
        if (!val) return;
        const match = Object.keys(COMMANDS).find(k => k.startsWith(val));
        if (match) input.value = match;
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        appendLine('<span class="t-dim">^C</span>');
        input.value = '';
      }
    });

    // Prevent the input losing focus unexpectedly
    input.addEventListener('blur', () => {
      const pane = document.getElementById('terminal-pane');
      if (pane && pane.classList.contains('open')) {
        // Only refocus if terminal is open and user clicked within terminal
      }
    });

    appendLine('<span class="t-green">TEXT EDITOR PRO ULTRA Terminal v1.0</span>');
    appendLine('Digite <b>help</b> para ver os comandos disponíveis.');
    appendLine('');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, processCommand, appendLine };
})();
