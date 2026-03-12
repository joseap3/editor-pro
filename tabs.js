// ===================== TABS.JS =====================
const TabManager = (() => {
  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;

  function generateId() {
    return 'tab_' + (++tabCounter) + '_' + Date.now();
  }

  function createTab(name = 'Untitled', content = '', mode = 'code', language = 'plaintext') {
    const id = generateId();
    const tab = { id, name, content, mode, language, modified: false, encrypted: false, cryptoKey: '' };
    tabs.push(tab);
    renderTabs();
    setActive(id);
    return tab;
  }

  function closeTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab && tab.modified) {
      if (!confirm(`"${tab.name}" tem alterações não salvas. Fechar mesmo assim?`)) return;
    }
    tabs = tabs.filter(t => t.id !== id);
    if (activeTabId === id) {
      activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
    }
    renderTabs();
    if (activeTabId) {
      setActive(activeTabId);
    } else {
      createTab();
    }
    BackupManager.deleteFile(id);
  }

  function setActive(id) {
    activeTabId = id;
    const tab = getActiveTab();
    if (!tab) return;
    renderTabs();
    window.EditorManager && EditorManager.loadTab(tab);
    updateStats(tab.content);
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
  }

  function updateTabContent(id, content) {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.content = content;
      tab.modified = true;
      markTabModified(id);
      updateStats(content);
    }
  }

  function markTabModified(id) {
    const el = document.querySelector(`.tab[data-id="${id}"] .tab-name`);
    if (el && !el.textContent.startsWith('●')) {
      el.textContent = '● ' + el.textContent;
    }
  }

  function markTabSaved(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.modified = false;
      const el = document.querySelector(`.tab[data-id="${id}"] .tab-name`);
      if (el) el.textContent = tab.name;
    }
  }

  function renameTab(id, name) {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.name = name;
      renderTabs();
    }
  }

  function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
      el.dataset.id = tab.id;

      const icon = getModeIcon(tab.mode);
      el.innerHTML = `
        <span class="tab-icon">${icon}</span>
        <span class="tab-name">${tab.modified ? '● ' : ''}${escapeHtml(tab.name)}</span>
        <button class="tab-close" title="Fechar">×</button>
      `;
      el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) setActive(tab.id);
      });
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      container.appendChild(el);
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'tab-new-btn';
    newBtn.title = 'Nova aba';
    newBtn.textContent = '+';
    newBtn.addEventListener('click', () => createTab());
    container.appendChild(newBtn);
  }

  function getModeIcon(mode) {
    const icons = { code: '⟨/⟩', word: '📝', markdown: '#', notepad: '📋' };
    return icons[mode] || '📄';
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function updateStats(content) {
    const text = content || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    const chars = text.length;
    const el = document.getElementById('stats-bar');
    if (el) el.innerHTML = `<span>Palavras: <b>${words}</b></span><span>Linhas: <b>${lines}</b></span><span>Caracteres: <b>${chars}</b></span>`;
  }

  function getAllTabs() { return tabs; }

  async function restoreFromDB() {
    try {
      const saved = await BackupManager.loadAllFiles();
      if (saved && saved.length > 0) {
        saved.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
        saved.forEach(f => {
          const t = { id: f.id, name: f.name, content: f.content, mode: f.mode || 'code', language: f.language || 'plaintext', modified: false, encrypted: f.encrypted || false, cryptoKey: f.cryptoKey || '' };
          tabs.push(t);
          const num = parseInt(f.id.split('_')[1]) || 0;
          if (num >= tabCounter) tabCounter = num;
        });
        renderTabs();
        if (tabs.length > 0) setActive(tabs[0].id);
        return true;
      }
    } catch (e) { console.error('Restore error:', e); }
    return false;
  }

  return { createTab, closeTab, setActive, getActiveTab, getAllTabs, updateTabContent, markTabSaved, renameTab, renderTabs, restoreFromDB };
})();
