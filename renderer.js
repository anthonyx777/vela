'use strict';

const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  incognito: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18l-2-4H5L3 8Z"/><path d="M5 8v2m14-2v2M4 13h16M7.5 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm9 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h12"/></svg>',
  forward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/><path d="M16 12H4"/></svg>',
  reload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5l3 5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/></svg>',
  'bookmark-small': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20V4Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  'shield-large': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.3c0 5-3.4 8.7-8 10.7-4.6-2-8-5.7-8-10.7V6l8-3.5Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>'
};

for (const node of document.querySelectorAll('[data-icon]')) {
  node.innerHTML = icons[node.dataset.icon] || '';
}

const elements = {
  tabs: document.getElementById('tabs'),
  addressForm: document.getElementById('address-form'),
  addressInput: document.getElementById('address-input'),
  back: document.getElementById('back'),
  forward: document.getElementById('forward'),
  reload: document.getElementById('reload'),
  newTab: document.getElementById('new-tab'),
  newPrivateTab: document.getElementById('new-private-tab'),
  bookmark: document.getElementById('bookmark'),
  bookmarkItems: document.getElementById('bookmark-items'),
  bookmarkEmpty: document.getElementById('bookmark-empty'),
  bookmarkRow: document.getElementById('bookmark-row'),
  bookmarkToggle: document.getElementById('bookmarks-toggle'),
  securityIndicator: document.getElementById('security-indicator'),
  loadingTrack: document.getElementById('loading-track'),
  privacyStatus: document.getElementById('privacy-status'),
  privacyDialog: document.getElementById('privacy-dialog'),
  closePrivacy: document.getElementById('close-privacy'),
  privacyOk: document.getElementById('privacy-ok'),
  toastRegion: document.getElementById('toast-region')
};

let state = { tabs: [], activeTabId: null };
let bookmarks = loadBookmarks();
let toastTimer = null;

function loadBookmarks() {
  try {
    const value = JSON.parse(localStorage.getItem('vela.bookmarks') || '[]');
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item.url === 'string' && typeof item.title === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveBookmarks() {
  localStorage.setItem('vela.bookmarks', JSON.stringify(bookmarks));
}

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
}

function showToast(message) {
  elements.toastRegion.textContent = message;
  elements.toastRegion.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toastRegion.classList.remove('visible'), 2600);
}

function renderTabs() {
  elements.tabs.replaceChildren();
  for (const tab of state.tabs) {
    const button = document.createElement('button');
    button.className = `tab${tab.id === state.activeTabId ? ' active' : ''}${tab.isPrivate ? ' private' : ''}`;
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.id === state.activeTabId));
    button.title = tab.title;
    button.addEventListener('click', () => window.vela.activateTab(tab.id));

    const favicon = document.createElement('span');
    favicon.className = 'tab-favicon';
    favicon.textContent = tab.isPrivate ? '◈' : (tab.isLoading ? '◌' : '◉');

    const label = document.createElement('span');
    label.className = 'tab-title';
    label.textContent = tab.title || 'Nova guia';

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.title = 'Fechar guia';
    close.textContent = '×';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      window.vela.closeTab(tab.id);
    });

    button.append(favicon, label, close);
    elements.tabs.append(button);
  }
}

function renderBookmarks() {
  elements.bookmarkItems.replaceChildren();
  elements.bookmarkEmpty.hidden = bookmarks.length > 0;
  for (const bookmark of bookmarks) {
    const button = document.createElement('button');
    button.className = 'bookmark-chip';
    button.type = 'button';
    button.title = bookmark.url;
    button.textContent = bookmark.title;
    button.addEventListener('click', () => {
      const tab = activeTab();
      if (tab) window.vela.navigate(tab.id, bookmark.url).catch(showToast);
    });
    elements.bookmarkItems.append(button);
  }
}

function renderState(nextState) {
  if (!nextState || !Array.isArray(nextState.tabs)) return;
  state = nextState;
  renderTabs();
  renderBookmarks();

  const tab = activeTab();
  elements.back.disabled = !tab?.canGoBack;
  elements.forward.disabled = !tab?.canGoForward;
  elements.reload.classList.toggle('is-loading', Boolean(tab?.isLoading));
  elements.loadingTrack.classList.toggle('loading', Boolean(tab?.isLoading));
  elements.newPrivateTab.classList.toggle('selected', Boolean(tab?.isPrivate));
  elements.securityIndicator.classList.toggle('secure', Boolean(tab?.isSecure));
  elements.securityIndicator.classList.toggle('insecure', Boolean(tab?.url && !tab.isSecure));
  elements.securityIndicator.title = tab?.isSecure
    ? 'Conexão HTTPS'
    : (tab?.url?.startsWith('http:') ? 'Conexão HTTP sem criptografia' : 'Estado da conexão');

  if (document.activeElement !== elements.addressInput) {
    elements.addressInput.value = tab?.url || '';
  }

  const isBookmarked = tab && bookmarks.some((item) => item.url === tab.url);
  elements.bookmark.classList.toggle('bookmarked', Boolean(isBookmarked));
  elements.bookmark.title = isBookmarked ? 'Remover dos favoritos' : 'Adicionar aos favoritos (Ctrl+D)';
}

function addCurrentBookmark() {
  const tab = activeTab();
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
    showToast('Não há uma página válida para favoritar.');
    return;
  }
  const existingIndex = bookmarks.findIndex((item) => item.url === tab.url);
  if (existingIndex >= 0) {
    bookmarks.splice(existingIndex, 1);
    showToast('Favorito removido.');
  } else {
    bookmarks.unshift({ title: tab.title || new URL(tab.url).hostname, url: tab.url });
    showToast('Adicionado aos favoritos.');
  }
  saveBookmarks();
  renderBookmarks();
  renderState(state);
}

function focusAddress() {
  elements.addressInput.focus();
  elements.addressInput.select();
}

function navigateFromAddress() {
  const tab = activeTab();
  if (!tab) return;
  const value = elements.addressInput.value;
  window.vela.navigate(tab.id, value)
    .then(() => elements.addressInput.blur())
    .catch((error) => showToast(error.message || 'Não foi possível abrir esse endereço.'));
}

elements.addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  navigateFromAddress();
});
elements.newTab.addEventListener('click', () => window.vela.createTab());
elements.newPrivateTab.addEventListener('click', () => window.vela.createPrivateTab());
elements.back.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) window.vela.goBack(tab.id);
});
elements.forward.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) window.vela.goForward(tab.id);
});
elements.reload.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) window.vela.reload(tab.id);
});
elements.bookmark.addEventListener('click', addCurrentBookmark);
elements.bookmarkToggle.addEventListener('click', () => {
  const hidden = elements.bookmarkRow.classList.toggle('collapsed');
  elements.bookmarkToggle.classList.toggle('selected', !hidden);
});
elements.privacyStatus.addEventListener('click', () => elements.privacyDialog.showModal());
elements.closePrivacy.addEventListener('click', () => elements.privacyDialog.close());
elements.privacyOk.addEventListener('click', () => elements.privacyDialog.close());

document.addEventListener('keydown', (event) => {
  const command = event.ctrlKey || event.metaKey;
  if (command && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    focusAddress();
  }
});

window.vela.onState(renderState);
window.vela.onFocusAddress(focusAddress);
window.vela.onBookmarkShortcut(addCurrentBookmark);
window.vela.getState().then(renderState).catch((error) => showToast(error.message));
