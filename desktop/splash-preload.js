const { ipcRenderer } = require("electron");

function toPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(100, n));
}

function updateSplash(payload) {
  const fill = document.getElementById("splashProgressFill");
  const message = document.getElementById("splashMessage");
  const detail = document.getElementById("splashDetail");
  const percent = toPercent(payload?.percent);

  if (fill) {
    fill.style.width = `${percent}%`;
  }
  if (message && payload?.message) {
    message.textContent = String(payload.message);
  }
  if (detail) {
    const suffix = payload?.detail ? ` - ${String(payload.detail)}` : "";
    detail.textContent = `${Math.round(percent)}%${suffix}`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateSplash({ percent: 0, message: "Ladevorgang läuft", detail: "Bitte kurz warten" });
});

ipcRenderer.on("splash:progress", (_event, payload) => {
  updateSplash(payload || {});
});
