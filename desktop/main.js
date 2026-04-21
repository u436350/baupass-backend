const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DESKTOP_URL = (process.env.BAUPASS_DESKTOP_URL || "https://web-production-c21ed.up.railway.app").trim();
// Backend auto-start only makes sense when pointing at localhost.
const IS_LOCAL = DESKTOP_URL.includes("127.0.0.1") || DESKTOP_URL.includes("localhost");
const AUTOSTART_BACKEND = IS_LOCAL && String(process.env.BAUPASS_DESKTOP_AUTOSTART_BACKEND || "1").trim() !== "0";

let mainWindow = null;
let backendProcess = null;
let backendStartedByDesktop = false;

function buildHealthUrl(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/+$/, "");
  return `${normalized}/api/health`;
}

function probeBackend(baseUrl, timeoutMs = 1200) {
  const healthUrl = buildHealthUrl(baseUrl);
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(healthUrl);
    } catch {
      resolve(false);
      return;
    }

    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname,
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePythonCommand() {
  const candidates = [
    path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe"),
    path.join(PROJECT_ROOT, ".venv", "bin", "python"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return process.platform === "win32" ? "python" : "python3";
}

function startBackend() {
  if (backendProcess) {
    return;
  }

  const pythonCmd = resolvePythonCommand();
  // Derive the port from DESKTOP_URL so backend and frontend always match.
  let desktopPort = "8080";
  try {
    desktopPort = String(new URL(DESKTOP_URL).port || "8080");
  } catch {
    // keep default
  }
  backendProcess = spawn(pythonCmd, ["backend/run_prod.py"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, PORT: desktopPort, HOST: "127.0.0.1" },
  });
  backendStartedByDesktop = true;

  backendProcess.stdout.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) {
      console.log(`[desktop][backend] ${text}`);
    }
  });

  backendProcess.stderr.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) {
      console.warn(`[desktop][backend] ${text}`);
    }
  });

  backendProcess.on("exit", (code) => {
    console.log(`[desktop] backend exited with code ${code}`);
    backendProcess = null;
  });
}

async function ensureBackend() {
  // For hosted deployments, avoid blocking startup with a remote health probe.
  // The app should open immediately and let the web app handle its own loading state.
  if (!IS_LOCAL) {
    return;
  }

  const available = await probeBackend(DESKTOP_URL);
  if (available) {
    return;
  }
  if (!AUTOSTART_BACKEND) {
    return;
  }

  startBackend();
  for (let i = 0; i < 30; i += 1) {
    // Wait up to about 15s for backend startup.
    // If still unavailable, the shell still opens and user sees unreachable message.
    // This avoids hanging desktop startup forever.
    // eslint-disable-next-line no-await-in-loop
    await wait(500);
    // eslint-disable-next-line no-await-in-loop
    if (await probeBackend(DESKTOP_URL)) {
      return;
    }
  }
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("desktop:window-state", {
    isMaximized: mainWindow.isMaximized(),
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    backgroundColor: "#0d131a",
    autoHideMenuBar: true,
    icon: path.join(PROJECT_ROOT, process.platform === "win32" ? "worker-icon-512.ico" : "worker-icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(DESKTOP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", sendWindowState);
  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("desktop:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle("desktop:toggle-maximize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  sendWindowState();
});

ipcMain.handle("desktop:close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle("desktop:get-window-state", () => ({
  isMaximized: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()),
}));

async function bootstrap() {
  await ensureBackend();
  createWindow();
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendStartedByDesktop && backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
