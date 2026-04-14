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
const LOCAL_LAST_PHOTO_KEY = "baupass-last-local-photo";
const OFFLINE_PHOTO_QUEUE_KEY = "baupass-offline-photo-queue";
const QR_CACHE_PREFIX = "baupass-worker-qr-cache";

let workerToken = localStorage.getItem(WORKER_TOKEN_KEY) || "";
let deferredInstallPrompt = null;
let cameraStream = null;
let lastCameraPhotoDataUrl = null;
let lastCameraPhotoRotation = 0;
let wakeLockHandle = null;
let dynamicManifestUrl = "";

const elements = {
  loginCard: document.querySelector("#loginCard"),
  badgeCard: document.querySelector("#badgeCard"),
  workerNotice: document.querySelector("#workerNotice"),
  workerLoginForm: document.querySelector("#workerLoginForm"),
  workerAccessToken: document.querySelector("#workerAccessToken"),
  companyName: document.querySelector("#companyName"),
    workerSubcompany: document.querySelector("#workerSubcompany"),
  workerName: document.querySelector("#workerName"),
  workerRole: document.querySelector("#workerRole"),
  workerStatus: document.querySelector("#workerStatus"),
  workerPhoto: document.querySelector("#workerPhoto"),
  workerBadgeId: document.querySelector("#workerBadgeId"),
  workerSite: document.querySelector("#workerSite"),
  workerValidUntil: document.querySelector("#workerValidUntil"),
  workerQr: document.querySelector("#workerQr"),
  qrFallbackText: document.querySelector("#qrFallbackText"),
  refreshButton: document.querySelector("#refreshButton"),
  logoutButton: document.querySelector("#logoutButton"),
  installButton: document.querySelector("#installButton"),
  installPlatformHint: document.querySelector("#installPlatformHint"),
  gateModeButton: document.querySelector("#gateModeButton"),
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
  deletePhotoButton: document.querySelector("#deletePhotoButton")
};

init();

async function init() {
  bindEvents();
  const params = new URL(window.location.href).searchParams;
  const urlToken = (params.get("access") || "").trim();
  const storedAccessToken = (window.localStorage.getItem(WORKER_ACCESS_TOKEN_KEY) || "").trim();
  const bootstrapAccessToken = urlToken || storedAccessToken;

  if (bootstrapAccessToken) {
    window.localStorage.setItem(WORKER_ACCESS_TOKEN_KEY, bootstrapAccessToken);
    applyDynamicManifestStartUrl(bootstrapAccessToken);
  }

  registerWorkerSw();
  wireInstallPrompt();

  if (urlToken) {
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = urlToken;
    }
    await loginWithAccessToken(urlToken, { keepUrlToken: true, silent: false });
    return;
  }

  if (workerToken) {
    await loadWorkerData();
    return;
  }

  if (storedAccessToken) {
    if (elements.workerAccessToken) {
      elements.workerAccessToken.value = storedAccessToken;
    }
    await loginWithAccessToken(storedAccessToken, { keepUrlToken: false, silent: true });
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
  if (elements.workerLoginForm) {
    elements.workerLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const accessToken = (elements.workerAccessToken?.value || "").trim();
      await loginWithAccessToken(accessToken);
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

  if (elements.closeGateModeButton) {
    elements.closeGateModeButton.addEventListener("click", closeGateMode);
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
    event.preventDefault();
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
    showWorkerNotice("iPhone: In Safari auf Teilen tippen und dann 'Zum Home-Bildschirm' waehlen.");
    return;
  }

  if (isAndroidDevice()) {
      if (!isAndroidChrome()) {
        showWorkerNotice("Bitte in Google Chrome oeffnen. Nur dort funktioniert die direkte Installation ohne Play Store.");
        return;
      }
    showWorkerNotice("Android: Im Browser-Menue auf 'App installieren' oder 'Zum Startbildschirm' tippen.");
    return;
  }

  showWorkerNotice("Installation manuell: Browser-Menue oeffnen und 'Zum Startbildschirm' bzw. 'App installieren' waehlen.");
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
  } catch (error) {
    if (["invalid_access_token", "access_token_revoked", "access_token_expired"].includes(error.code)) {
      localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
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

async function loadWorkerData() {
  if (!workerToken) {
    showLogin();
    return;
  }

  try {
    const payload = await fetchJson(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    renderWorker(payload);
    await syncOfflinePhotoQueue();
  } catch {
    localStorage.removeItem(WORKER_TOKEN_KEY);
    workerToken = "";
    showLogin();
  }
}

function renderWorker(payload) {
  const worker = payload.worker || {};
  const company = payload.company || {};
    const subcompany = payload.subcompany || {};

  if (elements.companyName) elements.companyName.textContent = company.name || "Baufirma";
    if (elements.workerSubcompany) {
      const subcompanyName = String(subcompany.name || "").trim();
      if (subcompanyName) {
        elements.workerSubcompany.textContent = subcompanyName;
        elements.workerSubcompany.classList.remove("hidden");
      } else {
        elements.workerSubcompany.textContent = "";
        elements.workerSubcompany.classList.add("hidden");
      }
    }
  if (elements.workerName) elements.workerName.textContent = `${worker.firstName || ""} ${worker.lastName || ""}`.trim();
  if (elements.workerRole) elements.workerRole.textContent = worker.role || "-";
  if (elements.workerStatus) elements.workerStatus.textContent = worker.status || "-";
  if (elements.workerBadgeId) elements.workerBadgeId.textContent = worker.badgeId || "-";
  if (elements.workerSite) elements.workerSite.textContent = worker.site || "-";
  if (elements.workerValidUntil) elements.workerValidUntil.textContent = formatDate(worker.validUntil);

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
  if (elements.workerQr) {
    if (!qrPayload) {
      elements.workerQr.removeAttribute("src");
      elements.workerQr.classList.add("hidden");
    } else {
      elements.workerQr.classList.remove("hidden");
      void setQrImage(elements.workerQr, qrPayload, 280);
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
      void setQrImage(elements.gateQr, qrPayload, 420);
    }
  }

  if (elements.gateBadgeId) {
    elements.gateBadgeId.textContent = qrPayload ? `Badge ${qrPayload}` : "Badge nicht gesetzt";
  }

  if (elements.gateWorkerName) {
    elements.gateWorkerName.textContent = `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || "Mitarbeiter";
  }

  if (elements.loginCard) elements.loginCard.classList.add("hidden");
  if (elements.badgeCard) elements.badgeCard.classList.remove("hidden");
}

function showLogin() {
  if (elements.badgeCard) elements.badgeCard.classList.add("hidden");
  if (elements.loginCard) elements.loginCard.classList.remove("hidden");
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
  workerToken = "";
  closeGateMode();
  showLogin();
}

async function openGateMode() {
  if (!elements.gateScannerOverlay) {
    return;
  }
  elements.gateScannerOverlay.classList.remove("hidden");
  showBrightnessHintTemporarily();
  await requestWakeLock();
}

function closeGateMode() {
  if (elements.gateScannerOverlay) {
    elements.gateScannerOverlay.classList.add("hidden");
  }
  releaseWakeLock();
}

function buildQrPayload(worker) {
  const badge = String(worker?.badgeId || "").trim();
  if (badge) {
    return badge;
  }
  const fallback = String(worker?.id || "").trim();
  return fallback;
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
        elements.installPlatformHint.textContent = "Android (Chrome): Menue > App installieren. Danach wie eine normale Handy-App nutzbar.";
      } else {
        elements.installPlatformHint.textContent = "Android: Bitte in Google Chrome oeffnen, dann Menue > App installieren.";
      }
    return;
  }

  elements.installPlatformHint.textContent = "Fuer iPhone und Android optimiert. Installiere die App fuer schnellen Zugriff am Drehkreuz.";
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
    showWorkerNotice("Safari blockiert hier die Browser-Kamera. Bitte Foto direkt aus Kamera oder Mediathek waehlen.");
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
          : "Safari erlaubt die Browser-Kamera meist nur ueber HTTPS. Bitte Foto direkt aus Kamera oder Mediathek waehlen."
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
