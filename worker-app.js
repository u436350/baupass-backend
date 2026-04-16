const DEFAULT_RENDER_API_BASE = "https://baupass-backend.onrender.com";
const API_BASE_STORAGE_KEY = "baupass-api-base";

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function sanitizeApiBase(value) {
  const normalized = normalizeApiBase(value);
  if (!normalized) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return "";
  }

  if (window.location.protocol === "https:" && parsed.protocol === "http:") {
    const host = (parsed.hostname || "").toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!localHosts.has(host)) {
      return "";
    }
  }

  return parsed.toString().replace(/\/+$/, "");
}

function resolveWorkerApiBase() {
  const params = new URL(window.location.href).searchParams;
  const queryValue = sanitizeApiBase(params.get("apiBase"));
  const storedValue = sanitizeApiBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
  const configuredValue = queryValue || storedValue;

  if (configuredValue) {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, configuredValue);
    return `${configuredValue}/api/worker-app`;
  }

  if (!configuredValue && window.localStorage.getItem(API_BASE_STORAGE_KEY)) {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
  }

  if (window.location.hostname.endsWith("github.io")) {
    return `${DEFAULT_RENDER_API_BASE}/api/worker-app`;
  }

  return "/api/worker-app";
}

const API_BASE = resolveWorkerApiBase();
const API_ROOT = resolveApiRoot(API_BASE);
const WORKER_TOKEN_KEY = "baupass-worker-token";
const WORKER_ACCESS_TOKEN_KEY = "baupass-worker-access-token";
const WORKER_BADGE_LOGIN_KEY = "baupass-worker-badge-login";
const LOCAL_LAST_PHOTO_KEY = "baupass-last-local-photo";
const OFFLINE_PHOTO_QUEUE_KEY = "baupass-offline-photo-queue";
const QR_CACHE_PREFIX = "baupass-worker-qr-cache";
const QR_HIGH_CONTRAST_KEY = "baupass-qr-high-contrast";
const AUTO_OPEN_SCANNER_KEY = "baupass-auto-open-scanner";
const WORKER_SESSION_IP_KEY = "baupass-worker-session-ip";
const WORKER_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes aggressive timeout

let workerToken = localStorage.getItem(WORKER_TOKEN_KEY) || "";
let deferredInstallPrompt = null;
let cameraStream = null;
let lastCameraPhotoDataUrl = null;
let lastCameraPhotoRotation = 0;
let wakeLockHandle = null;
let dynamicManifestUrl = "";
let workerSessionExpiryTimeout = null;
let workerSessionCountdownInterval = null;
let inactivityCheckInterval = null;
let qrHighContrastEnabled = localStorage.getItem(QR_HIGH_CONTRAST_KEY) === "1";
let sessionExpiringSoonNotified = false;
let ambientLightSensorHandle = null;
let ambientLowLightRecommended = false;
let gateAutoOpenTriggered = false;
let lastUserInteractionAt = Date.now();
let autoOpenScannerEnabled = localStorage.getItem(AUTO_OPEN_SCANNER_KEY) !== "0";

const AUTO_OPEN_ACTIVITY_WINDOW_MS = 30 * 1000;

const elements = {
  loginCard: document.querySelector("#loginCard"),
  badgeCard: document.querySelector("#badgeCard"),
  workerNotice: document.querySelector("#workerNotice"),
  workerLoginForm: document.querySelector("#workerLoginForm"),
  workerAccessToken: document.querySelector("#workerAccessToken"),
  workerBadgePin: document.querySelector("#workerBadgePin"),
  companyName: document.querySelector("#companyName"),
    workerSubcompany: document.querySelector("#workerSubcompany"),
  workerName: document.querySelector("#workerName"),
  workerRole: document.querySelector("#workerRole"),
  workerPassTitle: document.querySelector("#workerPassTitle"),
  workerPassSubLabel: document.querySelector("#workerPassSubLabel"),
  workerStatus: document.querySelector("#workerStatus"),
  workerPhoto: document.querySelector("#workerPhoto"),
  workerBadgeId: document.querySelector("#workerBadgeId"),
  workerSite: document.querySelector("#workerSite"),
  workerSiteMapLink: document.querySelector("#workerSiteMapLink"),
  workerValidUntil: document.querySelector("#workerValidUntil"),
  workerDayCardValidity: document.querySelector("#workerDayCardValidity"),
  workerVisitorMeta: document.querySelector("#workerVisitorMeta"),
  workerVisitorCompany: document.querySelector("#workerVisitorCompany"),
  workerVisitPurpose: document.querySelector("#workerVisitPurpose"),
  workerHostName: document.querySelector("#workerHostName"),
  workerVisitEndAt: document.querySelector("#workerVisitEndAt"),
  workerQr: document.querySelector("#workerQr"),
  workerSessionCountdown: document.querySelector("#workerSessionCountdown"),
  autoOpenScannerToggle: document.querySelector("#autoOpenScannerToggle"),
  qrContrastToggle: document.querySelector("#qrContrastToggle"),
  qrFallbackText: document.querySelector("#qrFallbackText"),
  refreshButton: document.querySelector("#refreshButton"),
  logoutButton: document.querySelector("#logoutButton"),
  installButton: document.querySelector("#installButton"),
  installPlatformHint: document.querySelector("#installPlatformHint"),
  gateModeButton: document.querySelector("#gateModeButton"),
  quickGateModeButton: document.querySelector("#quickGateModeButton"),
  gateScannerOverlay: document.querySelector("#gateScannerOverlay"),
  gateQr: document.querySelector("#gateQr"),
  gateBadgeId: document.querySelector("#gateBadgeId"),
  gateWorkerName: document.querySelector("#gateWorkerName"),
  gateBrightnessHint: document.querySelector("#gateBrightnessHint"),
  closeGateModeButton: document.querySelector("#closeGateModeButton"),
  changePhotoButton: document.querySelector("#changePhotoButton"),
  photoInput: document.querySelector("#photoInput"),
  cameraOverlay: document.querySelector("#cameraOverlay"),
  cameraVideo: document.querySelector("#cameraVideo"),
  cameraCanvas: document.querySelector("#cameraCanvas"),
  takePhotoButton: document.querySelector("#takePhotoButton"),
  confirmPhotoButton: document.querySelector("#confirmPhotoButton"),
  retakePhotoButton: document.querySelector("#retakePhotoButton"),
  closeCameraButton: document.querySelector("#closeCameraButton"),
  photoPreviewWrap: document.querySelector("#photoPreviewWrap"),
  rotatePhotoButton: document.querySelector("#rotatePhotoButton"),
  deletePhotoButton: document.querySelector("#deletePhotoButton"),
  workerStatusBanner: document.querySelector("#workerStatusBanner"),
  workerStatusText: document.querySelector("#workerStatusText"),
  gateStatusFeedback: document.querySelector("#gateStatusFeedback"),
  gateContrastToggle: document.querySelector("#gateContrastToggle"),
  connectionBanner: document.querySelector("#connectionBanner"),
  lastSyncInfo: document.querySelector("#lastSyncInfo")
};

const splashStartedAt = performance.now();
const SPLASH_MIN_MS = 1050;

function dismissSplash() {
  const elapsed = performance.now() - splashStartedAt;
  const delay = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    document.body.classList.add("splash-released");
    const el = document.getElementById("splashScreen");
    if (!el) return;
    el.classList.add("splash-done");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => { if (el.parentNode) el.remove(); }, 800);
  }, delay);
}

// ── Globale User-Interaktions-Tracking-Funktion ──
function markUserInteraction() {
  lastUserInteractionAt = Date.now();
}

init().finally(dismissSplash);

async function init() {
  bindEvents();
  applyQrContrastState();
  applyAutoOpenScannerState();
  
  // Enable Dark Mode support
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.style.colorScheme = "dark";
  }
  
  const params = new URL(window.location.href).searchParams;
  const urlToken = (params.get("access") || "").trim();
  const storedAccessToken = (window.localStorage.getItem(WORKER_ACCESS_TOKEN_KEY) || "").trim();
  const storedBadgeId = (window.localStorage.getItem(WORKER_BADGE_LOGIN_KEY) || "").trim();
  const bootstrapAccessToken = urlToken || storedAccessToken;

  if (bootstrapAccessToken) {
    window.localStorage.setItem(WORKER_ACCESS_TOKEN_KEY, bootstrapAccessToken);
    applyDynamicManifestStartUrl(bootstrapAccessToken);
  }

  registerWorkerSw();
  wireInstallPrompt();
  updateConnectionState();

  if (urlToken) {
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = urlToken;
    }
    await loginWithAccessToken(urlToken, { keepUrlToken: true, silent: false });
    return;
  }

  if (workerToken) {
    const loaded = await loadWorkerData();
    if (loaded) {
      return;
    }
  }

  if (storedAccessToken) {
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = storedAccessToken;
    }
    await loginWithAccessToken(storedAccessToken, { keepUrlToken: false, silent: true });
    if (workerToken) {
      return;
    }
  }

  if (storedBadgeId) {
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = storedBadgeId;
    }
  }
}

function applyDynamicManifestStartUrl(accessToken) {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink || !accessToken) {
    return;
  }

  fetch("./worker-manifest.json", { cache: "no-store" })
    .then((response) => response.json())
    .then((manifest) => {
      const params = new URLSearchParams();
      params.set("access", accessToken);

      const apiBaseParam = new URL(window.location.href).searchParams.get("apiBase");
      if (apiBaseParam) {
        params.set("apiBase", apiBaseParam);
      }

      manifest.start_url = `/worker.html?${params.toString()}`;

      const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      if (dynamicManifestUrl) {
        URL.revokeObjectURL(dynamicManifestUrl);
      }
      dynamicManifestUrl = URL.createObjectURL(blob);
      manifestLink.href = dynamicManifestUrl;
    })
    .catch(() => {
      // ignore manifest customization failures
    });
}

function bindEvents() {
  window.addEventListener("online", updateConnectionState);
  window.addEventListener("offline", updateConnectionState);
  window.addEventListener("pointerdown", markUserInteraction, { passive: true });
  window.addEventListener("touchstart", markUserInteraction, { passive: true });
  window.addEventListener("keydown", markUserInteraction, { passive: true });
  window.addEventListener("scroll", markUserInteraction, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      markUserInteraction();
    }
  });

  if (elements.workerLoginForm) {
    elements.workerLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const credential = (elements.workerAccessToken?.value || "").trim();
      if (looksLikeBadgeId(credential)) {
        const badgePin = (elements.workerBadgePin?.value || "").trim();
        await loginWithBadgeId(credential, badgePin);
        return;
      }
      await loginWithAccessToken(credential);
    });
  }

  if (elements.refreshButton) {
    elements.refreshButton.addEventListener("click", loadWorkerData);
  }

  if (elements.logoutButton) {
    elements.logoutButton.addEventListener("click", workerLogout);
  }

  if (elements.installButton) {
    elements.installButton.addEventListener("click", triggerInstall);
  }

  if (elements.gateModeButton) {
    elements.gateModeButton.addEventListener("click", openGateMode);
  }

  if (elements.quickGateModeButton) {
    elements.quickGateModeButton.addEventListener("click", openGateMode);
  }

  if (elements.closeGateModeButton) {
    elements.closeGateModeButton.addEventListener("click", closeGateMode);
  }

  if (elements.qrContrastToggle) {
    elements.qrContrastToggle.addEventListener("click", toggleQrContrastMode);
  }

  if (elements.gateContrastToggle) {
    elements.gateContrastToggle.addEventListener("click", toggleQrContrastMode);
  }

  if (elements.autoOpenScannerToggle) {
    elements.autoOpenScannerToggle.addEventListener("change", () => {
      autoOpenScannerEnabled = Boolean(elements.autoOpenScannerToggle?.checked);
      localStorage.setItem(AUTO_OPEN_SCANNER_KEY, autoOpenScannerEnabled ? "1" : "0");
      applyAutoOpenScannerState();
    });
  }

  if (elements.changePhotoButton) {
    elements.changePhotoButton.addEventListener("click", openCameraOverlay);
  }

  if (elements.photoInput) {
    elements.photoInput.addEventListener("change", handlePhotoSelected);
  }

  if (elements.takePhotoButton) {
    elements.takePhotoButton.addEventListener("click", takePhotoFromCamera);
  }
  if (elements.confirmPhotoButton) {
    elements.confirmPhotoButton.addEventListener("click", confirmCameraPhoto);
  }
  if (elements.retakePhotoButton) {
    elements.retakePhotoButton.addEventListener("click", retakeCameraPhoto);
  }
  if (elements.closeCameraButton) {
    elements.closeCameraButton.addEventListener("click", closeCameraOverlay);
  }
  if (elements.rotatePhotoButton) {
    elements.rotatePhotoButton.addEventListener("click", rotateCameraPhoto);
  }
  if (elements.deletePhotoButton) {
    elements.deletePhotoButton.addEventListener("click", deleteCameraPhoto);
  }

  window.addEventListener("beforeunload", stopCameraStream);
}

function savePhotoToOfflineQueue(dataUrl) {
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_PHOTO_QUEUE_KEY) || "[]");
  } catch {
    queue = [];
  }
  queue.push({ dataUrl, timestamp: Date.now() });
  localStorage.setItem(OFFLINE_PHOTO_QUEUE_KEY, JSON.stringify(queue));
}

async function syncOfflinePhotoQueue() {
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_PHOTO_QUEUE_KEY) || "[]");
  } catch {
    queue = [];
  }

  if (!queue.length || !workerToken) {
    return;
  }

  const pending = [];
  for (const item of queue) {
    try {
      await fetchJson(`${API_BASE}/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerToken}`
        },
        body: JSON.stringify({ photoData: item.dataUrl })
      });
    } catch {
      pending.push(item);
    }
  }

  localStorage.setItem(OFFLINE_PHOTO_QUEUE_KEY, JSON.stringify(pending));
}

function registerWorkerSw() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("./worker-sw.js").then((registration) => {
    registration.update().catch(() => {
      // ignore update check failures
    });
  }).catch(() => {
    // ignore service worker install failures
  });
}

function wireInstallPrompt() {
  updatePlatformInstallHint();
  window.addEventListener("beforeinstallprompt", (event) => {
    deferredInstallPrompt = event;
    if (elements.installButton) {
      elements.installButton.hidden = false;
    }
  });
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function triggerInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (elements.installButton) {
      elements.installButton.hidden = true;
    }
    return;
  }

  if (isStandaloneMode()) {
    showWorkerNotice("App ist bereits installiert.");
    return;
  }

  if (isIosDevice()) {
    showWorkerNotice("iPhone: In Safari auf Teilen tippen und dann 'Zum Home-Bildschirm' wählen.");
    return;
  }

  if (isAndroidDevice()) {
      if (!isAndroidChrome()) {
        showWorkerNotice("Bitte in Google Chrome öffnen. Nur dort funktioniert die direkte Installation ohne Play Store.");
        return;
      }
    showWorkerNotice("Android: Im Browser-Menü auf 'App installieren' oder 'Zum Startbildschirm' tippen.");
    return;
  }

  showWorkerNotice("Installation manuell: Browser-Menü öffnen und 'Zum Startbildschirm' bzw. 'App installieren' wählen.");
}

async function loginWithAccessToken(accessToken, { keepUrlToken = false, silent = false } = {}) {
  if (!accessToken) {
    if (!silent) {
      showWorkerNotice("Bitte Zugangscode eingeben.");
    }
    return;
  }

  if (!silent) {
    hideWorkerNotice();
  }

  try {
    const payload = await fetchJson(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken })
    });

    workerToken = payload.token;
    localStorage.setItem(WORKER_TOKEN_KEY, workerToken);
    localStorage.setItem(WORKER_ACCESS_TOKEN_KEY, accessToken);
    localStorage.removeItem(WORKER_BADGE_LOGIN_KEY);
    applyDynamicManifestStartUrl(accessToken);
    if (!keepUrlToken) {
      window.history.replaceState({}, document.title, "./worker.html");
    }
    await loadWorkerData();

    if (!isStandaloneMode() && elements.installButton) {
      elements.installButton.hidden = false;
      if (!silent) {
        showWorkerNotice("Tipp: App jetzt installieren, damit dein Ausweis direkt auf dem Handy verfuegbar ist.");
      }
    }

    // ── Schutzlogik: Session-Inaktivitäts-Monitor starten ──
    initializeSessionInactivityProtection();
  } catch (error) {
    if (["invalid_access_token", "access_token_revoked", "access_token_expired", "access_token_already_used"].includes(error.code)) {
      localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
    }
    if (error.code === "visitor_visit_expired") {
      localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
      showWorkerNotice("Besucherkarte ist abgelaufen. Bitte neuen Link anfordern.");
      return;
    }
    if (silent) {
      showLogin();
      return;
    }
    if (error.code === "worker_app_disabled") {
      showWorkerNotice("Mitarbeiter-App ist derzeit deaktiviert.");
      return;
    }
    showWorkerNotice(`Zugang fehlgeschlagen: ${error.message}`);
  }
}

async function loginWithBadgeId(badgeId, badgePin, { silent = false } = {}) {
  const normalizedBadgeId = normalizeBadgeIdInput(badgeId);
  const normalizedBadgePin = normalizeBadgePinInput(badgePin);
  if (!normalizedBadgeId) {
    if (!silent) {
      showWorkerNotice("Bitte Badge-ID eingeben.");
    }
    return;
  }
  if (!normalizedBadgePin) {
    if (!silent) {
      showWorkerNotice("Bitte Badge-PIN eingeben.");
    }
    return;
  }

  if (!silent) {
    hideWorkerNotice();
  }

  try {
    const payload = await fetchJson(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeId: normalizedBadgeId, badgePin: normalizedBadgePin })
    });

    workerToken = payload.token;
    localStorage.setItem(WORKER_TOKEN_KEY, workerToken);
    localStorage.setItem(WORKER_BADGE_LOGIN_KEY, normalizedBadgeId);
    localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = normalizedBadgeId;
    }
    if (elements.workerBadgePin) {
      elements.workerBadgePin.value = normalizedBadgePin;
    }
    await loadWorkerData();

    if (!isStandaloneMode() && elements.installButton) {
      elements.installButton.hidden = false;
      if (!silent) {
        showWorkerNotice("Tipp: App jetzt installieren, damit dein Ausweis direkt auf dem Handy verfuegbar ist.");
      }
    }

    // ── Schutzlogik: Session-Inaktivitäts-Monitor starten ──
    initializeSessionInactivityProtection();
  } catch (error) {
    if (silent) {
      showLogin();
      return;
    }
    if (error.code === "worker_app_disabled") {
      showWorkerNotice("Mitarbeiter-App ist derzeit deaktiviert.");
      return;
    }
    showWorkerNotice(`Anmeldung fehlgeschlagen: ${error.message}`);
  }
}

async function loadWorkerData() {
  if (!workerToken) {
    showLogin();
    return false;
  }

  try {
    const payload = await fetchJson(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    renderWorker(payload);
    if (elements.lastSyncInfo) {
      elements.lastSyncInfo.textContent = `Zuletzt synchronisiert: ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    }
    updateConnectionState();
    await syncOfflinePhotoQueue();
    return true;
  } catch (error) {
    localStorage.removeItem(WORKER_TOKEN_KEY);
    workerToken = "";
    clearWorkerSessionExpiryTimer();
    if (error?.code === "worker_session_expired" || error?.code === "invalid_worker_session") {
      showWorkerNotice("Digitale Besucherkarte abgelaufen. Bitte fuer heute neu anmelden.");
    }
    showLogin();
    return false;
  }
}

function renderWorker(payload) {
  const worker = payload.worker || {};
  const company = payload.company || {};
    const subcompany = payload.subcompany || {};
  const normalizedStatus = String(worker.status || "").trim().toLowerCase();
  const workerType = String(worker.workerType || "worker").trim().toLowerCase();
  const isVisitor = workerType === "visitor";
  const sessionExpiresAt = String(payload.sessionExpiresAt || "").trim();

  if (elements.workerPassTitle) {
    elements.workerPassTitle.textContent = isVisitor ? "Deine digitale Besucherkarte" : "Dein BauPass für heute";
  }
  if (elements.workerPassSubLabel) {
    elements.workerPassSubLabel.textContent = isVisitor ? "Besucherausweis" : "Mitarbeiterausweis";
  }

  if (elements.companyName) elements.companyName.textContent = company.name || "Baufirma";
  if (elements.workerSubcompany) {
    const subcompanyName = String(subcompany.name || "").trim();
    if (subcompanyName) {
      elements.workerSubcompany.textContent = `✓ Sub: ${subcompanyName}`;
      elements.workerSubcompany.title = `Subunternehmer: ${subcompanyName}`;
      elements.workerSubcompany.classList.remove("hidden");
    } else {
      elements.workerSubcompany.textContent = "";
      elements.workerSubcompany.removeAttribute("title");
      elements.workerSubcompany.classList.add("hidden");
    }
  }
  if (elements.workerName) elements.workerName.textContent = `${worker.firstName || ""} ${worker.lastName || ""}`.trim();
  if (elements.workerRole) elements.workerRole.textContent = isVisitor ? "Besucher" : (worker.role || "-");
  if (elements.workerStatus) {
    elements.workerStatus.textContent = worker.status || "-";
    elements.workerStatus.dataset.status = normalizedStatus;
  }
  if (elements.workerBadgeId) elements.workerBadgeId.textContent = worker.badgeId || "-";
  if (elements.workerSite) elements.workerSite.textContent = worker.site || "-";
  updateSiteMapLink(worker.site || "");
  if (elements.workerValidUntil) elements.workerValidUntil.textContent = formatDate(worker.validUntil);
  renderDayCardValidity(sessionExpiresAt);
  scheduleWorkerSessionExpiry(sessionExpiresAt);
  if (elements.workerVisitorMeta) {
    elements.workerVisitorMeta.classList.toggle("hidden", !isVisitor);
  }
  if (elements.workerVisitorCompany) {
    elements.workerVisitorCompany.textContent = worker.visitorCompany || "-";
  }
  if (elements.workerVisitPurpose) {
    elements.workerVisitPurpose.textContent = worker.visitPurpose || "-";
  }
  if (elements.workerHostName) {
    elements.workerHostName.textContent = worker.hostName || "-";
  }
  if (elements.workerVisitEndAt) {
    elements.workerVisitEndAt.textContent = worker.visitEndAt ? formatDateTime(worker.visitEndAt) : "-";
  }

  if (elements.workerPhoto) {
    if (worker.photoData && String(worker.photoData).startsWith("data:image")) {
      elements.workerPhoto.src = worker.photoData;
      localStorage.setItem(LOCAL_LAST_PHOTO_KEY, worker.photoData);
    } else {
      const localPhoto = localStorage.getItem(LOCAL_LAST_PHOTO_KEY);
      elements.workerPhoto.src = localPhoto && localPhoto.startsWith("data:image")
        ? localPhoto
        : createAvatar(worker.firstName, worker.lastName);
    }
  }

  const qrPayload = buildQrPayload(worker);
  const isCompactViewport = window.matchMedia("(max-width: 520px)").matches;
  const workerQrSize = isCompactViewport ? 520 : 460;
  const gateQrSize = isCompactViewport ? 520 : 420;
  if (elements.workerQr) {
    if (!qrPayload) {
      elements.workerQr.removeAttribute("src");
      elements.workerQr.classList.add("hidden");
    } else {
      elements.workerQr.classList.remove("hidden");
      void setQrImage(elements.workerQr, qrPayload, workerQrSize);
    }
  }

  if (elements.qrFallbackText) {
    if (!qrPayload) {
      elements.qrFallbackText.textContent = "Kein QR verfuegbar. Bitte Admin kontaktieren.";
      elements.qrFallbackText.classList.remove("hidden");
    } else {
      elements.qrFallbackText.textContent = `Code: ${qrPayload}`;
      elements.qrFallbackText.classList.remove("hidden");
    }
  }

  if (elements.gateQr) {
    if (!qrPayload) {
      elements.gateQr.removeAttribute("src");
      elements.gateQr.classList.add("hidden");
    } else {
      elements.gateQr.classList.remove("hidden");
      void setQrImage(elements.gateQr, qrPayload, gateQrSize);
    }
  }

  if (elements.gateBadgeId) {
    elements.gateBadgeId.textContent = qrPayload ? `Badge ${qrPayload}` : "Badge nicht gesetzt";
  }

  if (elements.gateWorkerName) {
    elements.gateWorkerName.textContent = `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || "Mitarbeiter";
  }

  // Update Status Banner
  if (elements.workerStatusBanner && elements.workerStatusText) {
    const banned = String(worker.banned || "false").trim().toLowerCase() === "true";
    const validUntilDate = new Date(worker.validUntil || "");
    const isExpired = validUntilDate < new Date();
    
    elements.workerStatusBanner.style.display = "flex";
    
    if (banned) {
      elements.workerStatusBanner.className = "status-banner error";
      elements.workerStatusText.textContent = "❌ Zugang entzogen";
    } else if (isExpired) {
      elements.workerStatusBanner.className = "status-banner warning";
      elements.workerStatusText.textContent = "⚠ Ausweis abgelaufen";
    } else {
      elements.workerStatusBanner.className = "status-banner active";
      elements.workerStatusText.textContent = "✓ Aktiv und berechtigt";
    }
  }

  if (elements.loginCard) elements.loginCard.classList.add("hidden");
  if (elements.badgeCard) elements.badgeCard.classList.remove("hidden");
  document.body.classList.add("worker-loaded");
}

function showLogin() {
  clearWorkerSessionExpiryTimer();
  clearWorkerSessionCountdown();
  sessionExpiringSoonNotified = false;
  gateAutoOpenTriggered = false;
  stopAmbientLightRecommendation();
  if (elements.badgeCard) elements.badgeCard.classList.add("hidden");
  if (elements.loginCard) elements.loginCard.classList.remove("hidden");
  document.body.classList.remove("worker-loaded");
}

function updateConnectionState() {
  if (!elements.connectionBanner) {
    return;
  }
  if (navigator.onLine) {
    elements.connectionBanner.textContent = "Online";
    elements.connectionBanner.className = "connection-banner online";
  } else {
    elements.connectionBanner.textContent = "Offline";
    elements.connectionBanner.className = "connection-banner offline";
  }
}

function showWorkerNotice(message) {
  if (!elements.workerNotice) {
    return;
  }
  elements.workerNotice.textContent = message;
  elements.workerNotice.classList.remove("hidden");
}

function hideWorkerNotice() {
  if (!elements.workerNotice) {
    return;
  }
  elements.workerNotice.textContent = "";
  elements.workerNotice.classList.add("hidden");
}

// ═════════════════════════════════════════════════════════════════════
// ── SESSION PROTECTION: Aggressive Inactivity Timeout ──
// Schützt gegen Telefon-Weitergabe durch autom. Logout nach 5min ohne Interaktion
// ═════════════════════════════════════════════════════════════════════

function initializeSessionInactivityProtection() {
  // Stoppe jeden existierenden Timer
  if (inactivityCheckInterval) {
    clearInterval(inactivityCheckInterval);
  }

  lastUserInteractionAt = Date.now();

  // Prüfe alle 30 Sekunden auf Inaktivität
  inactivityCheckInterval = setInterval(() => {
    const timeSinceLastInteraction = Date.now() - lastUserInteractionAt;
    if (timeSinceLastInteraction > WORKER_INACTIVITY_TIMEOUT_MS) {
      console.warn("🔐 Session timeout: Zu lange inaktiv, Auto-Logout für Sicherheit");
      showWorkerNotice("Zu lange inaktiv. Bitte melde dich neu an.");
      workerLogout();
    }
  }, 30 * 1000);

  console.log("✓ Session protection: 5min Inaktivitäts-Monitor gestartet");
}

async function workerLogout() {
  try {
    if (workerToken) {
      await fetchJson(`${API_BASE}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${workerToken}` }
      });
    }
  } catch {
    // ignore logout call failures
  }

  localStorage.removeItem(WORKER_TOKEN_KEY);
  localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
  localStorage.removeItem(WORKER_BADGE_LOGIN_KEY);
  workerToken = "";
  clearWorkerSessionExpiryTimer();
  if (inactivityCheckInterval) {
    clearInterval(inactivityCheckInterval);
    inactivityCheckInterval = null;
  }
  closeGateMode();
  showLogin();
}

async function openGateMode() {
  if (!elements.gateScannerOverlay) {
    return;
  }
  elements.gateScannerOverlay.classList.remove("hidden");
  
  // Show feedback
  if (elements.gateStatusFeedback) {
    elements.gateStatusFeedback.textContent = "📱 Bereit zum Scannen...";
    elements.gateStatusFeedback.style.color = "rgba(255, 255, 255, 0.7)";
  }
  
  showBrightnessHintTemporarily();
  await requestWakeLock();
  await requestGateFullscreen();
  startAmbientLightRecommendation();
}

function closeGateMode() {
  if (elements.gateScannerOverlay) {
    elements.gateScannerOverlay.classList.add("hidden");
  }
  if (elements.gateStatusFeedback) {
    elements.gateStatusFeedback.textContent = "";
  }
  void exitGateFullscreen();
  stopAmbientLightRecommendation();
  releaseWakeLock();
}

function applyQrContrastState() {
  document.body.classList.toggle("qr-high-contrast", qrHighContrastEnabled);
  const label = qrHighContrastEnabled ? "High-Contrast QR: Ein" : "High-Contrast QR: Aus";
  if (elements.qrContrastToggle) {
    elements.qrContrastToggle.textContent = label;
  }
  if (elements.gateContrastToggle) {
    elements.gateContrastToggle.textContent = label;
  }
}

function toggleQrContrastMode() {
  qrHighContrastEnabled = !qrHighContrastEnabled;
  localStorage.setItem(QR_HIGH_CONTRAST_KEY, qrHighContrastEnabled ? "1" : "0");
  applyQrContrastState();
}

function applyAutoOpenScannerState() {
  if (elements.autoOpenScannerToggle) {
    elements.autoOpenScannerToggle.checked = autoOpenScannerEnabled;
  }
}

function showGateFeedback(message, color = "rgba(255, 255, 255, 0.78)") {
  if (!elements.gateStatusFeedback) {
    return;
  }
  elements.gateStatusFeedback.textContent = message;
  elements.gateStatusFeedback.style.color = color;
}

function startAmbientLightRecommendation() {
  ambientLowLightRecommended = false;
  if (typeof window.AmbientLightSensor !== "function") {
    return;
  }
  try {
    ambientLightSensorHandle = new window.AmbientLightSensor({ frequency: 0.5 });
    ambientLightSensorHandle.addEventListener("reading", () => {
      const lux = Number(ambientLightSensorHandle.illuminance || 0);
      if (lux > 0 && lux < 20 && !ambientLowLightRecommended) {
        ambientLowLightRecommended = true;
        showGateFeedback("Dunkle Umgebung erkannt. High-Contrast QR empfohlen.", "#ffd5a3");
      }
    });
    ambientLightSensorHandle.addEventListener("error", () => {
      stopAmbientLightRecommendation();
    });
    ambientLightSensorHandle.start();
  } catch {
    stopAmbientLightRecommendation();
  }
}

function stopAmbientLightRecommendation() {
  ambientLowLightRecommended = false;
  if (!ambientLightSensorHandle) {
    return;
  }
  try {
    ambientLightSensorHandle.stop();
  } catch {
    // ignore sensor stop issues
  }
  ambientLightSensorHandle = null;
}

function buildQrPayload(worker) {
  const badge = String(worker?.badgeId || "").trim();
  if (badge) {
    return badge;
  }
  const fallback = String(worker?.id || "").trim();
  return fallback;
}

function normalizeBadgeIdInput(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeBadgePinInput(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function looksLikeBadgeId(value) {
  const normalized = normalizeBadgeIdInput(value);
  return normalized.length >= 6 && normalized.length <= 32 && /^[A-Z0-9-]+$/.test(normalized) && normalized.includes("-");
}

function updateSiteMapLink(site) {
  if (!elements.workerSite) {
    return;
  }

  const normalizedSite = String(site || "").trim();
  if (!normalizedSite) {
    elements.workerSite.textContent = "-";
    elements.workerSite.setAttribute("href", "#");
    elements.workerSite.setAttribute("aria-disabled", "true");
    return;
  }

  const mapsUrl = new URL("https://www.google.com/maps/search/");
  mapsUrl.searchParams.set("api", "1");
  mapsUrl.searchParams.set("query", normalizedSite);
  elements.workerSite.textContent = normalizedSite;
  elements.workerSite.href = mapsUrl.toString();
  elements.workerSite.removeAttribute("aria-disabled");
}

function resolveApiRoot(workerApiBase) {
  return String(workerApiBase || "").replace(/\/api\/worker-app\/?$/, "");
}

function buildQrImageUrl(payload, size = 280) {
  const text = String(payload || "").trim();
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(API_ROOT)) {
    const url = new URL("/api/qr.png", API_ROOT);
    url.searchParams.set("data", text);
    url.searchParams.set("size", String(size));
    return url.toString();
  }

  const url = new URL("/api/qr.png", window.location.origin);
  url.searchParams.set("data", text);
  url.searchParams.set("size", String(size));
  return `${url.pathname}${url.search}`;
}

function getQrCacheKey(payload, size) {
  return `${QR_CACHE_PREFIX}:${size}:${payload}`;
}

function getCachedQr(payload, size) {
  const key = getQrCacheKey(payload, size);
  return localStorage.getItem(key) || "";
}

function setCachedQr(payload, size, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
    return;
  }
  const key = getQrCacheKey(payload, size);
  localStorage.setItem(key, dataUrl);
}

async function fetchQrAsDataUrl(payload, size) {
  const url = buildQrImageUrl(payload, size);
  if (!url) {
    return "";
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`qr_fetch_failed_${response.status}`);
  }
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("blob_to_dataurl_failed"));
    reader.readAsDataURL(blob);
  });
}

async function setQrImage(imgElement, payload, size) {
  if (!imgElement || !payload) {
    return;
  }

  const cached = getCachedQr(payload, size);
  if (cached) {
    imgElement.src = cached;
  } else {
    const directUrl = buildQrImageUrl(payload, size);
    if (directUrl) {
      imgElement.src = directUrl;
    }
  }

  try {
    const freshDataUrl = await fetchQrAsDataUrl(payload, size);
    if (freshDataUrl) {
      setCachedQr(payload, size, freshDataUrl);
      imgElement.src = freshDataUrl;
    }
  } catch {
    if (!cached) {
      imgElement.alt = "QR-Code konnte nicht geladen werden";
    }
  }
}

function showBrightnessHintTemporarily() {
  if (!elements.gateBrightnessHint) {
    return;
  }
  elements.gateBrightnessHint.classList.remove("hidden");
  window.setTimeout(() => {
    if (elements.gateBrightnessHint) {
      elements.gateBrightnessHint.classList.add("hidden");
    }
  }, 6000);
}

async function requestGateFullscreen() {
  const panel = elements.gateScannerOverlay;
  if (!panel || document.fullscreenElement) {
    return;
  }
  const requestFullscreen = panel.requestFullscreen || panel.webkitRequestFullscreen;
  if (typeof requestFullscreen !== "function") {
    return;
  }
  try {
    await requestFullscreen.call(panel);
  } catch {
    // ignore fullscreen failures
  }
}

async function exitGateFullscreen() {
  const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
  if (typeof exitFullscreen !== "function" || !document.fullscreenElement) {
    return;
  }
  try {
    await exitFullscreen.call(document);
  } catch {
    // ignore fullscreen exit failures
  }
}

function isIosDevice() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || touchMac;
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent || "");
}

  function isAndroidChrome() {
    const ua = navigator.userAgent || "";
    const isChrome = /Chrome\//i.test(ua) && !/EdgA\//i.test(ua) && !/OPR\//i.test(ua) && !/SamsungBrowser\//i.test(ua);
    return isAndroidDevice() && isChrome;
  }

function updatePlatformInstallHint() {
  if (!elements.installPlatformHint) {
    return;
  }

  if (isStandaloneMode()) {
    elements.installPlatformHint.textContent = "App ist installiert. Am Drehkreuz einfach den QR-Code im Vollbild zeigen.";
    return;
  }

  if (isIosDevice()) {
    elements.installPlatformHint.textContent = "iPhone: Safari > Teilen > Zum Home-Bildschirm. Danach laeuft die App wie Wallet.";
    return;
  }

  if (isAndroidDevice()) {
      if (isAndroidChrome()) {
        elements.installPlatformHint.textContent = "Android (Chrome): Menü > App installieren. Danach wie eine normale Handy-App nutzbar.";
      } else {
        elements.installPlatformHint.textContent = "Android: Bitte in Google Chrome öffnen, dann Menü > App installieren.";
      }
    return;
  }

  elements.installPlatformHint.textContent = "Für iPhone und Android optimiert. Installiere die App für schnellen Zugriff am Drehkreuz.";
}

async function requestWakeLock() {
  if (!navigator.wakeLock || wakeLockHandle) {
    return;
  }
  try {
    wakeLockHandle = await navigator.wakeLock.request("screen");
    wakeLockHandle.addEventListener("release", () => {
      wakeLockHandle = null;
    });
  } catch {
    wakeLockHandle = null;
  }
}

function releaseWakeLock() {
  if (!wakeLockHandle) {
    return;
  }
  wakeLockHandle.release().catch(() => {
    // ignore release failures
  });
  wakeLockHandle = null;
}

function openCameraOverlay() {
  if (!elements.cameraOverlay || !elements.cameraVideo) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showWorkerNotice("Safari blockiert hier die Browser-Kamera. Bitte Foto direkt aus Kamera oder Mediathek wählen.");
    elements.photoInput?.click();
    return;
  }

  if (elements.photoPreviewWrap) elements.photoPreviewWrap.style.display = "none";
  if (elements.cameraCanvas) elements.cameraCanvas.style.display = "none";
  elements.cameraVideo.style.display = "block";
  if (elements.takePhotoButton) elements.takePhotoButton.style.display = "inline-block";
  if (elements.confirmPhotoButton) elements.confirmPhotoButton.style.display = "none";
  if (elements.retakePhotoButton) elements.retakePhotoButton.style.display = "none";

  elements.cameraOverlay.style.display = "flex";
  lastCameraPhotoDataUrl = null;
  lastCameraPhotoRotation = 0;

  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => {
      cameraStream = stream;
      elements.cameraVideo.srcObject = stream;
    })
    .catch(() => {
      showWorkerNotice(
        window.isSecureContext
          ? "Kamera konnte nicht gestartet werden."
          : "Safari erlaubt die Browser-Kamera meist nur über HTTPS. Bitte Foto direkt aus Kamera oder Mediathek wählen."
      );
      closeCameraOverlay();
      elements.photoInput?.click();
    });
}

function stopCameraStream() {
  if (!cameraStream) {
    return;
  }
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

function closeCameraOverlay() {
  if (elements.cameraOverlay) {
    elements.cameraOverlay.style.display = "none";
  }
  stopCameraStream();
  lastCameraPhotoDataUrl = null;
  lastCameraPhotoRotation = 0;
}

function takePhotoFromCamera() {
  if (!elements.cameraVideo || !elements.cameraCanvas) {
    return;
  }

  const video = elements.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    showWorkerNotice("Bitte warte kurz, bis die Kamera bereit ist.");
    return;
  }

  const canvas = elements.cameraCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  lastCameraPhotoDataUrl = canvas.toDataURL("image/jpeg", 0.92);

  canvas.style.display = "block";
  video.style.display = "none";
  if (elements.photoPreviewWrap) elements.photoPreviewWrap.style.display = "flex";
  if (elements.takePhotoButton) elements.takePhotoButton.style.display = "none";
  if (elements.confirmPhotoButton) elements.confirmPhotoButton.style.display = "inline-block";
  if (elements.retakePhotoButton) elements.retakePhotoButton.style.display = "inline-block";
}

function retakeCameraPhoto() {
  if (!elements.cameraVideo || !elements.cameraCanvas) {
    return;
  }
  elements.cameraCanvas.style.display = "none";
  elements.cameraVideo.style.display = "block";
  if (elements.photoPreviewWrap) elements.photoPreviewWrap.style.display = "none";
  if (elements.takePhotoButton) elements.takePhotoButton.style.display = "inline-block";
  if (elements.confirmPhotoButton) elements.confirmPhotoButton.style.display = "none";
  if (elements.retakePhotoButton) elements.retakePhotoButton.style.display = "none";
  lastCameraPhotoDataUrl = null;
  lastCameraPhotoRotation = 0;
}

function rotateCameraPhoto() {
  if (!elements.cameraCanvas || !lastCameraPhotoDataUrl) {
    return;
  }
  lastCameraPhotoRotation = (lastCameraPhotoRotation + 90) % 360;

  const img = new window.Image();
  img.onload = () => {
    const canvas = elements.cameraCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    if (lastCameraPhotoRotation % 180 === 0) {
      canvas.width = img.width;
      canvas.height = img.height;
    } else {
      canvas.width = img.height;
      canvas.height = img.width;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((lastCameraPhotoRotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    lastCameraPhotoDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  };
  img.src = lastCameraPhotoDataUrl;
}

function deleteCameraPhoto() {
  retakeCameraPhoto();
}

function confirmCameraPhoto() {
  if (!lastCameraPhotoDataUrl) {
    return;
  }

  closeCameraOverlay();

  if (elements.workerPhoto) {
    elements.workerPhoto.src = lastCameraPhotoDataUrl;
  }
  localStorage.setItem(LOCAL_LAST_PHOTO_KEY, lastCameraPhotoDataUrl);

  uploadPhotoToBackend(lastCameraPhotoDataUrl).catch(() => {
    savePhotoToOfflineQueue(lastCameraPhotoDataUrl);
    showWorkerNotice("Kein Internet: Foto wird spaeter synchronisiert.");
  });
}

function handlePhotoSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (event.target) {
    event.target.value = "";
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const dataUrl = typeof loadEvent.target?.result === "string" ? loadEvent.target.result : "";
    if (!dataUrl) {
      return;
    }

    if (elements.workerPhoto) {
      elements.workerPhoto.src = dataUrl;
    }
    localStorage.setItem(LOCAL_LAST_PHOTO_KEY, dataUrl);

    uploadPhotoToBackend(dataUrl).catch(() => {
      savePhotoToOfflineQueue(dataUrl);
      showWorkerNotice("Kein Internet: Foto wird spaeter synchronisiert.");
    });
  };
  reader.readAsDataURL(file);
}

async function uploadPhotoToBackend(dataUrl) {
  if (!workerToken) {
    throw new Error("missing_worker_token");
  }

  await fetchJson(`${API_BASE}/photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`
    },
    body: JSON.stringify({ photoData: dataUrl })
  });

  await loadWorkerData();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let code = "";
    try {
      const payload = await response.json();
      code = payload?.error || "";
      message = payload?.message || payload?.error || message;
    } catch {
      // ignore parse errors
    }
    const error = new Error(message);
    error.code = code;
    throw error;
  }
  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function renderDayCardValidity(expiresAt) {
  if (!elements.workerDayCardValidity) {
    return;
  }
  if (!expiresAt) {
    elements.workerDayCardValidity.textContent = "Digitale Besucherkarte: gueltig bis heute 00:00 Uhr.";
    return;
  }
  elements.workerDayCardValidity.textContent = `Digitale Besucherkarte: gueltig bis ${formatDateTime(expiresAt)} Uhr.`;
}

function clearWorkerSessionCountdown() {
  if (workerSessionCountdownInterval !== null) {
    window.clearInterval(workerSessionCountdownInterval);
    workerSessionCountdownInterval = null;
  }
}

function renderWorkerSessionCountdown(expiresAt) {
  clearWorkerSessionCountdown();
  sessionExpiringSoonNotified = false;
  gateAutoOpenTriggered = false;
  if (!elements.workerSessionCountdown) {
    return;
  }
  if (!expiresAt) {
    elements.workerSessionCountdown.textContent = "Ablauf: --:--:--";
    return;
  }

  const updateCountdown = () => {
    const target = new Date(expiresAt).getTime();
    const remainingMs = target - Date.now();
    if (!Number.isFinite(target) || remainingMs <= 0) {
      elements.workerSessionCountdown.textContent = "Ablauf: 00:00:00";
      elements.workerSessionCountdown.classList.remove("ok", "warn", "critical");
      elements.workerSessionCountdown.classList.add("critical");
      clearWorkerSessionCountdown();
      return;
    }
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    elements.workerSessionCountdown.textContent = `Ablauf in ${hours}:${minutes}:${seconds}`;

    elements.workerSessionCountdown.classList.remove("ok", "warn", "critical");
    if (totalSeconds <= 300) {
      elements.workerSessionCountdown.classList.add("critical");
      if (!sessionExpiringSoonNotified) {
        sessionExpiringSoonNotified = true;
        if (navigator.vibrate) {
          navigator.vibrate([120, 80, 120]);
        }
        showWorkerNotice("Hinweis: Deine Besucherkarte laeuft in weniger als 5 Minuten ab.");
      }

      const gateIsClosed = Boolean(elements.gateScannerOverlay?.classList.contains("hidden"));
      const recentlyActive = (Date.now() - lastUserInteractionAt) <= AUTO_OPEN_ACTIVITY_WINDOW_MS;
      if (totalSeconds <= 120 && autoOpenScannerEnabled && !gateAutoOpenTriggered && gateIsClosed && document.visibilityState === "visible" && recentlyActive) {
        gateAutoOpenTriggered = true;
        showWorkerNotice("Scanner wurde automatisch geoeffnet, weil weniger als 2 Minuten verbleiben.");
        void openGateMode();
      }
    } else if (totalSeconds <= 1800) {
      elements.workerSessionCountdown.classList.add("warn");
    } else {
      elements.workerSessionCountdown.classList.add("ok");
    }
  };

  updateCountdown();
  workerSessionCountdownInterval = window.setInterval(updateCountdown, 1000);
}

function clearWorkerSessionExpiryTimer() {
  if (workerSessionExpiryTimeout !== null) {
    window.clearTimeout(workerSessionExpiryTimeout);
    workerSessionExpiryTimeout = null;
  }
}

function expireDailyCardInClient() {
  localStorage.removeItem(WORKER_TOKEN_KEY);
  workerToken = "";
  clearWorkerSessionExpiryTimer();
  closeGateMode();
  showLogin();
  showWorkerNotice("Digitale Besucherkarte wurde um 00:00 automatisch beendet. Bitte neu anmelden.");
}

function scheduleWorkerSessionExpiry(expiresAt) {
  clearWorkerSessionExpiryTimer();
  renderWorkerSessionCountdown(expiresAt);
  if (!expiresAt) {
    return;
  }
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return;
  }
  const msUntilExpiry = parsed.getTime() - Date.now();
  if (msUntilExpiry <= 0) {
    expireDailyCardInClient();
    return;
  }
  workerSessionExpiryTimeout = window.setTimeout(() => {
    expireDailyCardInClient();
  }, msUntilExpiry);
}

function createAvatar(firstName, lastName) {
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="280" height="340" viewBox="0 0 280 340">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d95d39"/><stop offset="100%" stop-color="#121417"/></linearGradient></defs>
      <rect width="280" height="340" rx="28" fill="url(#g)"/>
      <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="84" fill="#fff7ef" font-weight="700">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
