'use strict';

const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const {
  app,
  BrowserWindow,
  WebContentsView,
  session,
  ipcMain,
  dialog,
  protocol
} = require('electron');
const { isAllowedNavigationUrl, resolveAddressInput } = require('./url-policy');

const APP_NAME = 'VELA Browser';
const CHROME_HEIGHT = 132;
const SHELL_URL = 'vela://app/index.html';
const SHELL_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";

// Register a secure custom scheme before app readiness, then serve only the
// three known local UI assets. Remote pages never share this origin.
protocol.registerSchemesAsPrivileged([{
  scheme: 'vela',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);
const NORMAL_PARTITION = 'persist:vela-main';
const PRIVATE_PARTITION = 'vela-private'; // No "persist:" prefix: in-memory session.

let mainWindow = null;
let activeTabId = null;
const tabs = new Map();
const configuredSessions = new WeakSet();

function configureSession(browserSession) {
  if (configuredSessions.has(browserSession)) return;
  configuredSessions.add(browserSession);

  // Permissions are denied by default. A future permission center can add
  // explicit, per-origin, user-approved grants.
  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  browserSession.setPermissionCheckHandler(() => false);

  browserSession.on('will-download', async (_event, item) => {
    try {
      item.pause();
      const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
        title: 'Salvar download',
        defaultPath: item.getFilename(),
        buttonLabel: 'Salvar'
      });
      if (result.canceled || !result.filePath) {
        item.cancel();
        return;
      }
      item.setSavePath(result.filePath);
      item.resume();
      item.once('done', (_doneEvent, state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vela:download-finished', {
            filename: item.getFilename(),
            state
          });
        }
      });
    } catch (error) {
      console.error('[VELA] Falha ao iniciar download:', error);
      item.cancel();
    }
  });
}

function getSession(isPrivate) {
  const browserSession = session.fromPartition(
    isPrivate ? PRIVATE_PARTITION : NORMAL_PARTITION
  );
  configureSession(browserSession);
  return browserSession;
}

function isTrustedShellSender(event) {
  return Boolean(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame &&
    event.senderFrame.url === SHELL_URL
  );
}

function assertTrustedShell(event) {
  if (!isTrustedShellSender(event)) {
    throw new Error('Origem IPC não autorizada.');
  }
}

function getTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || tab.view.webContents.isDestroyed()) return null;
  return tab;
}

function snapshot() {
  const tabList = [...tabs.values()].map((tab) => {
    const contents = tab.view.webContents;
    const url = contents.isDestroyed() ? '' : contents.getURL();
    let secure = false;
    try {
      secure = new URL(url).protocol === 'https:';
    } catch {
      secure = false;
    }
    return {
      id: tab.id,
      title: tab.title || 'Nova guia',
      url,
      isPrivate: tab.isPrivate,
      isLoading: tab.isLoading,
      canGoBack: !contents.isDestroyed() && contents.canGoBack(),
      canGoForward: !contents.isDestroyed() && contents.canGoForward(),
      isSecure: secure
    };
  });
  return { tabs: tabList, activeTabId };
}

function publishState() {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('vela:state', snapshot());
  }
}

function setViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !activeTabId) return;
  const tab = getTab(activeTabId);
  if (!tab) return;
  const [width, height] = mainWindow.getContentSize();
  tab.view.setBounds({
    x: 0,
    y: CHROME_HEIGHT,
    width: Math.max(0, width),
    height: Math.max(0, height - CHROME_HEIGHT)
  });
}

function attachActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (activeTabId) {
    const active = getTab(activeTabId);
    if (active) {
      try {
        mainWindow.contentView.addChildView(active.view);
      } catch (error) {
        // Electron can report an already-attached view during rapid tab switches.
        if (!String(error?.message || '').toLowerCase().includes('already')) {
          console.error('[VELA] Não foi possível anexar a aba:', error);
        }
      }
      setViewBounds();
      active.view.webContents.focus();
    }
  }
  publishState();
}

function detachView(tab) {
  if (!mainWindow || mainWindow.isDestroyed() || !tab) return;
  try {
    mainWindow.contentView.removeChildView(tab.view);
  } catch {
    // The view may already have been detached or its window may be closing.
  }
}

function registerWebContents(contents, tab) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigationUrl(url)) {
      createTab({ url, isPrivate: tab.isPrivate });
    }
    return { action: 'deny' };
  });

  const blockUnsupportedNavigation = (event, targetUrl) => {
    if (!isAllowedNavigationUrl(targetUrl)) {
      event.preventDefault();
    }
  };

  contents.on('will-navigate', blockUnsupportedNavigation);
  contents.on('will-redirect', blockUnsupportedNavigation);

  contents.on('did-start-loading', () => {
    tab.isLoading = true;
    publishState();
  });
  contents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.title = contents.getTitle() || tab.title || 'Nova guia';
    publishState();
  });
  contents.on('page-title-updated', (_event, title) => {
    tab.title = title || 'Nova guia';
    publishState();
  });
  contents.on('did-navigate', () => publishState());
  contents.on('did-navigate-in-page', () => publishState());
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      tab.isLoading = false;
      tab.error = `${errorDescription} (${errorCode})`;
      publishState();
    }
  });
  contents.on('render-process-gone', (_event, details) => {
    tab.isLoading = false;
    tab.error = `A página foi encerrada (${details.reason}).`;
    publishState();
  });

  contents.on('before-input-event', (event, input) => handleBrowserShortcut(event, input));
}

function handleBrowserShortcut(event, input) {
  if (input.type !== 'keyDown') return;
  const key = String(input.key || '').toLowerCase();
  const command = process.platform === 'darwin' ? input.meta : input.control;
  const shift = Boolean(input.shift);
  const alt = Boolean(input.alt);
  let handled = true;

  if (command && !alt && key === 'l') {
    mainWindow?.webContents.send('vela:focus-address');
  } else if (command && !alt && key === 't' && shift) {
    createTab({ isPrivate: true });
  } else if (command && !alt && key === 't') {
    createTab();
  } else if (command && !alt && key === 'w') {
    if (activeTabId) closeTab(activeTabId);
  } else if (command && !alt && key === 'r') {
    const tab = getTab(activeTabId);
    if (tab) tab.view.webContents.reload();
  } else if (command && !alt && key === 'd') {
    mainWindow?.webContents.send('vela:bookmark-current');
  } else if (command && key === 'tab') {
    cycleTab(shift ? -1 : 1);
  } else if (alt && key === 'arrowleft') {
    const tab = getTab(activeTabId);
    if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
  } else if (alt && key === 'arrowright') {
    const tab = getTab(activeTabId);
    if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
  } else {
    handled = false;
  }

  if (handled) event.preventDefault();
}

function cycleTab(direction) {
  const ids = [...tabs.keys()];
  if (ids.length < 2) return;
  const currentIndex = Math.max(0, ids.indexOf(activeTabId));
  const nextIndex = (currentIndex + direction + ids.length) % ids.length;
  activateTab(ids[nextIndex]);
}

function createTab({ url = 'https://duckduckgo.com/', isPrivate = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const id = randomUUID();
  const browserSession = getSession(isPrivate);
  const view = new WebContentsView({
    webPreferences: {
      session: browserSession,
      // Intentionally no preload here: untrusted websites receive no VELA bridge.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: true,
      safeDialogs: true,
      plugins: false
    }
  });

  const tab = {
    id,
    view,
    title: isPrivate ? 'Guia privada' : 'Nova guia',
    isPrivate,
    isLoading: true,
    error: null
  };
  tabs.set(id, tab);
  registerWebContents(view.webContents, tab);

  if (activeTabId) {
    const previous = getTab(activeTabId);
    if (previous) detachView(previous);
  }
  activeTabId = id;
  attachActiveView();

  const target = isAllowedNavigationUrl(url) ? url : 'https://duckduckgo.com/';
  view.webContents.loadURL(target).catch((error) => {
    tab.isLoading = false;
    tab.error = error.message;
    publishState();
  });

  return id;
}

function activateTab(tabId) {
  const target = getTab(tabId);
  if (!target || activeTabId === tabId) return false;

  const previous = getTab(activeTabId);
  if (previous) detachView(previous);
  activeTabId = tabId;
  attachActiveView();
  return true;
}

async function closeTab(tabId) {
  const tab = getTab(tabId);
  if (!tab) return false;
  const wasPrivate = tab.isPrivate;
  const wasActive = activeTabId === tabId;

  if (wasActive) detachView(tab);
  tabs.delete(tabId);
  try {
    tab.view.webContents.close();
  } catch {
    // The renderer may already have exited.
  }

  if (wasActive) {
    activeTabId = null;
    const remainingIds = [...tabs.keys()];
    if (remainingIds.length > 0) {
      activeTabId = remainingIds[remainingIds.length - 1];
      attachActiveView();
    } else {
      createTab();
    }
  } else {
    publishState();
  }

  if (wasPrivate && ![...tabs.values()].some((item) => item.isPrivate)) {
    const privateSession = getSession(true);
    // Last private tab closed: purge ephemeral site data and cache.
    await Promise.allSettled([
      privateSession.clearStorageData(),
      privateSession.clearCache()
    ]);
  }
  return true;
}

function navigateTab(tabId, input) {
  const tab = getTab(tabId);
  if (!tab) throw new Error('Esta aba não está mais disponível.');
  const targetUrl = resolveAddressInput(input);
  tab.error = null;
  tab.isLoading = true;
  publishState();
  return tab.view.webContents.loadURL(targetUrl).catch((error) => {
    tab.isLoading = false;
    tab.error = error.message;
    publishState();
    throw error;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: APP_NAME,
    backgroundColor: '#0b1119',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => handleBrowserShortcut(event, input));
  mainWindow.on('resize', setViewBounds);
  mainWindow.on('maximize', setViewBounds);
  mainWindow.on('unmaximize', setViewBounds);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.loadURL(SHELL_URL);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (tabs.size === 0) createTab();
    else attachActiveView();
  });

  mainWindow.on('closed', () => {
    for (const tab of tabs.values()) {
      try { tab.view.webContents.close(); } catch { /* already closed */ }
    }
    tabs.clear();
    activeTabId = null;
    mainWindow = null;
  });
}

ipcMain.handle('vela:get-state', (event) => {
  assertTrustedShell(event);
  return snapshot();
});
ipcMain.handle('vela:create-tab', (event) => {
  assertTrustedShell(event);
  return createTab();
});
ipcMain.handle('vela:create-private-tab', (event) => {
  assertTrustedShell(event);
  return createTab({ isPrivate: true });
});
ipcMain.handle('vela:activate-tab', (event, tabId) => {
  assertTrustedShell(event);
  return activateTab(String(tabId));
});
ipcMain.handle('vela:close-tab', (event, tabId) => {
  assertTrustedShell(event);
  return closeTab(String(tabId));
});
ipcMain.handle('vela:navigate', (event, tabId, input) => {
  assertTrustedShell(event);
  if (typeof input !== 'string' || input.length > 4096) {
    throw new Error('Endereço inválido ou muito longo.');
  }
  return navigateTab(String(tabId), input);
});
ipcMain.handle('vela:go-back', (event, tabId) => {
  assertTrustedShell(event);
  const tab = getTab(String(tabId));
  if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
});
ipcMain.handle('vela:go-forward', (event, tabId) => {
  assertTrustedShell(event);
  const tab = getTab(String(tabId));
  if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
});
ipcMain.handle('vela:reload', (event, tabId) => {
  assertTrustedShell(event);
  const tab = getTab(String(tabId));
  if (tab) tab.view.webContents.reload();
});

app.whenReady().then(async () => {
  app.setAppUserModelId('app.vela.browser');
  const shellDirectory = path.join(__dirname, '..', 'renderer');
  const shellAssets = new Map([
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/renderer.js', ['renderer.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
  ]);
  protocol.handle('vela', async (request) => {
    const requested = new URL(request.url);
    const asset = shellAssets.get(requested.pathname);
    if (request.method !== 'GET' || requested.hostname !== 'app' || !asset) {
      return new Response('Not Found', { status: 404 });
    }
    try {
      const body = await readFile(path.join(shellDirectory, asset[0]));
      return new Response(body, {
        headers: {
          'Content-Type': asset[1],
          'Content-Security-Policy': SHELL_CSP,
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer'
        }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
  configureSession(session.fromPartition(NORMAL_PARTITION));
  configureSession(session.fromPartition(PRIVATE_PARTITION));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  // No remote WebContents is allowed to create an unrestricted native window.
  contents.setWindowOpenHandler(({ url }) => {
    if (contents.getType() === 'webview' && isAllowedNavigationUrl(url)) {
      // Tab-specific handling is installed by registerWebContents; this is a
      // defense-in-depth fallback for any unexpected WebContents instance.
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
});
