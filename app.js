// ALLE ELEMENTE OBEN DEFINIEREN!
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

  // GitHub Pages laeuft ueber HTTPS; blockiere dort unsichere HTTP-Backends.
  if (window.location.protocol === "https:" && parsed.protocol === "http:") {
    const host = (parsed.hostname || "").toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!localHosts.has(host)) {
      return "";
    }
  }

  return parsed.toString().replace(/\/+$/, "");
}

function resolveApiBase() {
  const params = new URL(window.location.href).searchParams;
  const queryValue = sanitizeApiBase(params.get("apiBase"));
  const storedValue = sanitizeApiBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
  const metaValue = sanitizeApiBase(document.querySelector('meta[name="baupass-api-base"]')?.content);
  const configuredValue = queryValue || metaValue || storedValue;

  if (configuredValue) {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, configuredValue);
    return configuredValue;
  }

  // Entfernt veraltete/ungueltige API-Konfigurationen, damit der sichere Default greift.
  if (!configuredValue && window.localStorage.getItem(API_BASE_STORAGE_KEY)) {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
  }

  if (window.location.hostname.endsWith("github.io")) {
    return DEFAULT_RENDER_API_BASE;
  }

  return "";
}

const API_BASE = resolveApiBase();
const SYSTEM_THEME_STORAGE_KEY = "baupass-system-theme";
const SYSTEM_THEME_WHITE = "white";
const SYSTEM_THEME_BLACK = "black";

function normalizeSystemTheme(value) {
  if (value === SYSTEM_THEME_BLACK) return SYSTEM_THEME_BLACK;
  return SYSTEM_THEME_WHITE;
}

function getStoredSystemTheme() {
  return normalizeSystemTheme(window.localStorage.getItem(SYSTEM_THEME_STORAGE_KEY));
}

function getThemeModeLabel(mode) {
  if (mode === SYSTEM_THEME_BLACK) return "Schwarz";
  return "Weiß";
}

function applySystemTheme(themeMode, { persist = true } = {}) {
  const selectedMode = normalizeSystemTheme(themeMode);
  document.body.classList.remove("theme-white", "theme-black");
  document.body.classList.add(selectedMode === SYSTEM_THEME_BLACK ? "theme-black" : "theme-white");
  if (persist) {
    window.localStorage.setItem(SYSTEM_THEME_STORAGE_KEY, selectedMode);
  }

  const button = document.querySelector("#systemThemeToggleButton");
  if (button) {
    button.textContent = `Fensterfarbe: ${getThemeModeLabel(selectedMode)}`;
    button.setAttribute("aria-label", "Fensterfarbe wechseln");
    button.title = selectedMode === SYSTEM_THEME_BLACK
      ? "Aktuell Schwarz. Klicken für Weiß."
      : "Aktuell Weiß. Klicken für Schwarz.";
  }
}

function toggleSystemTheme() {
  const currentMode = getStoredSystemTheme();
  applySystemTheme(currentMode === SYSTEM_THEME_BLACK ? SYSTEM_THEME_WHITE : SYSTEM_THEME_BLACK);
}

function initSystemThemeControl() {
  applySystemTheme(getStoredSystemTheme());
}

let deferredDesktopInstallPrompt = null;
const elements = {
  body: document.body,
  authOverlay: document.querySelector("#authOverlay"),
  mainShell: document.querySelector("#mainShell"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginOtpCode: document.querySelector("#loginOtpCode"),
  loginScope: document.querySelector("#loginScope"),
  systemThemeToggleButton: document.querySelector("#systemThemeToggleButton"),
  desktopInstallButton: document.querySelector("#desktopInstallButton"),
  desktopInstallHint: document.querySelector("#desktopInstallHint"),
  logoutButton: document.querySelector("#logoutButton"),
  seedDataButton: document.querySelector("#seedDataButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  sessionCard: document.querySelector("#sessionCard"),
  views: Array.from(document.querySelectorAll(".view")),
  navLinks: Array.from(document.querySelectorAll(".nav-link")),
  statsGrid: document.querySelector("#statsGrid"),
  reportingSummaryGrid: document.querySelector("#reportingSummaryGrid"),
  reportingTopOverdueList: document.querySelector("#reportingTopOverdueList"),
  reportingAccessDaily: document.querySelector("#reportingAccessDaily"),
  recentAccessList: document.querySelector("#recentAccessList"),
  dashboardPorterLivePanel: document.querySelector("#dashboardPorterLivePanel"),
  workerList: document.querySelector("#workerList"),
  workerSearchInput: document.querySelector("#workerSearchInput"),
  bulkSelectAll: document.querySelector("#bulkSelectAll"),
  bulkActionBar: document.querySelector("#bulkActionBar"),
  bulkSelectionCount: document.querySelector("#bulkSelectionCount"),
  bulkDeleteButton: document.querySelector("#bulkDeleteButton"),
  bulkSetActiveButton: document.querySelector("#bulkSetActiveButton"),
  bulkSetInactiveButton: document.querySelector("#bulkSetInactiveButton"),
  bulkCancelButton: document.querySelector("#bulkCancelButton"),
  badgePreview: document.querySelector("#badgePreview"),
  badgeMeta: document.querySelector("#badgeMeta"),
  accessLogList: document.querySelector("#accessLogList"),
  accessSummaryGrid: document.querySelector("#accessSummaryGrid"),
  accessHourlyGrid: document.querySelector("#accessHourlyGrid"),
  accessOpenWarnings: document.querySelector("#accessOpenWarnings"),
  dayCloseBanner: document.querySelector("#dayCloseBanner"),
  porterLivePanel: document.querySelector("#porterLivePanel"),
  accessFeedbackOverlay: document.querySelector("#accessFeedbackOverlay"),
  accessFeedbackTitle: document.querySelector("#accessFeedbackTitle"),
  accessFeedbackMeta: document.querySelector("#accessFeedbackMeta"),
  accessFeedbackPhoto: document.querySelector("#accessFeedbackPhoto"),
  accessWorkerSelect: document.querySelector("#accessWorkerSelect"),
  turnstileQuickPanel: document.querySelector("#turnstileQuickPanel"),
  companySelect: document.querySelector("#companySelect"),
  workerType: document.querySelector("#workerType"),
  visitorFields: document.querySelector("#visitorFields"),
  visitorCompany: document.querySelector("#visitorCompany"),
  visitPurpose: document.querySelector("#visitPurpose"),
  hostName: document.querySelector("#hostName"),
  visitEndAt: document.querySelector("#visitEndAt"),
  badgePinHint: document.querySelector("#badgePinHint"),
  invoiceCompanySelect: document.querySelector("#invoiceCompanySelect"),
  companyList: document.querySelector("#companyList"),
  dayCloseAcknowledgeForm: document.querySelector("#dayCloseAcknowledgeForm"),
  dayCloseComment: document.querySelector("#dayCloseComment"),
  dayCloseAcknowledgeButton: document.querySelector("#dayCloseAcknowledgeButton"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  cameraPreview: document.querySelector("#cameraPreview"),
  capturedPhoto: document.querySelector("#capturedPhoto"),
  companyForm: document.querySelector("#companyForm"),
  invoiceHistoryList: document.querySelector("#invoiceHistoryList"),
  invoiceLogoData: document.querySelector("#invoiceLogoData"),
  invoiceLogoPreview: document.querySelector("#invoiceLogoPreview"),
  invoiceRecipientEmail: document.querySelector("#invoiceRecipientEmail"),
  invoicePreviewFrame: document.querySelector("#invoicePreviewFrame"),
  photoAdjustStatus: document.querySelector("#photoAdjustStatus"),
  photoRequiredHint: document.querySelector("#photoRequiredHint"),
  photoCanvas: document.querySelector("#photoCanvas"),
  photoData: document.querySelector("#photoData"),
  photoFileInput: document.querySelector("#photoFileInput"),
  photoDebugText: document.querySelector("#photoDebugText"),
  photoMoveButtons: Array.from(document.querySelectorAll(".photo-move-btn")),
  photoResetButton: document.querySelector("#photoResetButton"),
  photoSharpen: document.querySelector("#photoSharpen"),
  photoSharpenValue: document.querySelector("#photoSharpenValue"),
  photoZoom: document.querySelector("#photoZoom"),
  photoZoomValue: document.querySelector("#photoZoomValue"),
  // ...weitere Elemente nach Bedarf...
};

let token = "";
let qrLibraryLoadPromise = null;
let accessFeedbackTimer = null;
let accessAudioContext = null;
let cameraStream = null;
let backendStatusTimer = null;
let heartbeatTimer = null;
let selfieSegmenter = null;
let sessionExpiryNoticeShown = false;

const PLAN_LABELS = {
  tageskarte: "Besucherkarte",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise"
};

const PLAN_NET_PRICE_EUR = {
  tageskarte: 19,
  starter: 49,
  professional: 99,
  enterprise: 199,
};

const state = {
  currentUser: null,
  settings: {
    platformName: "BauPass Control",
    operatorName: "Deine Betriebsfirma",
    turnstileEndpoint: ""
  },
  companies: [],
  subcompanies: [],
  workers: [],
  accessLogs: [],
  accessInsights: { hourly: [], openEntries: [] },
  reporting: { kpis: {}, accessDaily: [], topOverdueCompanies: [] },
  invoices: [],
  companyRepairHistory: {},
  companyRepairBusy: {},
  companyRepairStatus: {},
  companyLockBusy: {},
  repairHistoryWindowDays: 30,
  onlyCompaniesWithRepairs: false,
  dayClose: null,
  editingWorkerId: null,
  selectedWorkerId: null,
  accessFilter: { from: "", to: "", direction: "", gate: "" },
  porterLive: { workerId: null, lastEvent: null },
  twofa: { enabled: false, secret: "", otpauthUri: "" }
};

const PHOTO_EDITOR_ZOOM_DEFAULT = 1.18;
const PHOTO_EDITOR_ZOOM_MIN = 1;
const PHOTO_EDITOR_ZOOM_MAX = 1.8;
const PHOTO_EDITOR_STEP = 10;
const PHOTO_TARGET_WIDTH = 480;
const PHOTO_TARGET_HEIGHT = 360;
const PHOTO_JPEG_QUALITY = 0.92;

let photoEditorSourceData = "";
let photoEditorImage = null;
let photoEditorOffset = { x: 0, y: 0 };
let photoEditorZoom = PHOTO_EDITOR_ZOOM_DEFAULT;
let photoSharpenAmount = 0.28;
let photoDragState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  baseOffsetX: 0,
  baseOffsetY: 0
};

function normalizeLog(entry) {
  return {
    id: entry?.id || "",
    workerId: entry?.workerId || entry?.worker_id || "",
    direction: entry?.direction || "",
    gate: entry?.gate || "",
    note: entry?.note || "",
    timestamp: entry?.timestamp || ""
  };
}

function getRoleLabel(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "superadmin") return "Superadmin";
  if (normalized === "company-admin") return "Firmen-Admin";
  if (normalized === "turnstile") return "Drehkreuz";
  return normalized || "unbekannt";
}

function userCanManageSystem() {
  const role = getCurrentUser()?.role;
  return role === "superadmin";
}

function userCanManageWorkers() {
  const role = getCurrentUser()?.role;
  return role === "superadmin" || role === "company-admin";
}

function userCanManageAccess() {
  const role = getCurrentUser()?.role;
  return role === "superadmin" || role === "company-admin" || role === "turnstile";
}

function canRepairCompany(company) {
  const user = getCurrentUser();
  if (!user || !company?.id) {
    return false;
  }
  if (user.role === "superadmin") {
    return true;
  }
  return user.role === "company-admin" && user.company_id === company.id;
}

function mapCompanyRepairError(error) {
  const message = String(error?.message || error || "");
  if (message === "forbidden") {
    return "Du darfst nur deine eigene Firma reparieren.";
  }
  if (message === "backend_unreachable") {
    return "Backend nicht erreichbar. Bitte Server und Netzwerk prüfen.";
  }
  if (message === "company_not_found") {
    return "Die Firma wurde nicht gefunden oder wurde inzwischen gelöscht.";
  }
  if (message === "company_locked") {
    return "Diese Firma ist aktuell gesperrt.";
  }
  if (message === "company_has_workers") {
    return "Die Firma hat noch aktive Mitarbeiter. Bitte komplette Löschung als Superadmin verwenden.";
  }
  return message || "unbekannter_fehler";
}

function getCompanyStatusMeta(status) {
  const normalized = String(status || "aktiv").trim().toLowerCase();
  if (normalized === "gesperrt") {
    return { label: "Gesperrt", className: "helper-text helper-text-warning" };
  }
  if (normalized === "pausiert") {
    return { label: "Pausiert", className: "helper-text helper-text-info" };
  }
  if (normalized === "test") {
    return { label: "Testphase", className: "helper-text helper-text-info" };
  }
  return { label: "Aktiv", className: "helper-text helper-text-ok" };
}

function isStandaloneDesktopApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateDesktopInstallHint() {
  if (!elements.desktopInstallHint) {
    return;
  }
  if (isStandaloneDesktopApp()) {
    elements.desktopInstallHint.textContent = "BauPass Control ist auf diesem Geraet bereits als Desktop-App installiert.";
    return;
  }
  elements.desktopInstallHint.textContent = "Dieses Portal kann auf Windows, macOS und Linux wie ein lokales Programm installiert werden.";
}

function registerControlServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("./control-sw.js").then((registration) => {
    registration.update().catch(() => {
      // ignore update check failures
    });
  }).catch(() => {
    // ignore install failures
  });
}

function wireDesktopInstallPrompt() {
  updateDesktopInstallHint();
  window.addEventListener("beforeinstallprompt", (event) => {
    deferredDesktopInstallPrompt = event;
    if (elements.desktopInstallButton) {
      elements.desktopInstallButton.hidden = false;
    }
  });
  window.addEventListener("appinstalled", () => {
    deferredDesktopInstallPrompt = null;
    if (elements.desktopInstallButton) {
      elements.desktopInstallButton.hidden = true;
    }
    updateDesktopInstallHint();
  });
}

async function triggerDesktopInstall() {
  if (isStandaloneDesktopApp()) {
    updateDesktopInstallHint();
    return;
  }
  if (!deferredDesktopInstallPrompt) {
    window.alert("Die Installation ist in diesem Browser gerade nicht direkt verfügbar. In Chrome oder Edge kannst du im Browser-Menü 'App installieren' wählen.");
    return;
  }
  deferredDesktopInstallPrompt.prompt();
  await deferredDesktopInstallPrompt.userChoice;
  deferredDesktopInstallPrompt = null;
  if (elements.desktopInstallButton) {
    elements.desktopInstallButton.hidden = true;
  }
  updateDesktopInstallHint();
}

function getSubcompanyLabel(worker) {
  if (!worker?.subcompanyId) return "";
  const sub = state.subcompanies.find((entry) => entry.id === worker.subcompanyId);
  return sub?.name || "";
}

function isVisitorWorker(worker) {
  return String(worker?.workerType || worker?.worker_type || "worker").toLowerCase() === "visitor";
}

function toDateInputValue(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function syncWorkerTypeUi() {
  const workerType = elements.workerType?.value || "worker";
  const isVisitor = workerType === "visitor";
  if (elements.visitorFields) {
    elements.visitorFields.classList.toggle("hidden", !isVisitor);
  }
  const insuranceField = document.querySelector("#insuranceNumber");
  const roleField = document.querySelector("#role");
  const badgePinField = document.querySelector("#badgePin");
  if (insuranceField) {
    insuranceField.required = !isVisitor;
    insuranceField.placeholder = isVisitor ? "Optional für Besucher" : "12 345678 A 123";
  }
  if (roleField) {
    roleField.required = !isVisitor;
    roleField.placeholder = isVisitor ? "Besucher" : "Polier, Kranfuehrer, Monteur";
    if (isVisitor && !roleField.value.trim()) {
      roleField.value = "Besucher";
    }
  }
  if (badgePinField) {
    badgePinField.required = !isVisitor;
    badgePinField.placeholder = isVisitor ? "Für Besucher nicht nötig" : "4 bis 8 Ziffern";
  }
  if (elements.badgePinHint) {
    elements.badgePinHint.textContent = isVisitor
      ? "Besucher nutzen den Einmal-Link/QR. Eine Badge-PIN ist für Besucher nicht erforderlich."
      : "Badge-Login in der Mitarbeiter-App funktioniert nur noch mit Badge-ID und dieser PIN. Beim Bearbeiten kannst du hier eine neue PIN setzen.";
  }
  if (isVisitor && elements.visitEndAt && !elements.visitEndAt.value) {
    const defaultEnd = new Date(Date.now() + (8 * 60 * 60 * 1000));
    elements.visitEndAt.value = toDateTimeLocalValue(defaultEnd);
  }
  if (isVisitor && document.querySelector("#validUntil") && elements.visitEndAt?.value) {
    document.querySelector("#validUntil").value = elements.visitEndAt.value.slice(0, 10);
  }
}

function populateSubcompanySelects() {
  const select = document.querySelector("#subcompanySelect");
  const companyId = document.querySelector("#companySelect")?.value || "";
  if (!select) return;
  const normalizedCompanyId = String(companyId).trim();

  const options = state.subcompanies
    .filter((entry) => {
      const isDeleted = Boolean(entry?.deletedAt || entry?.deleted_at);
      const entryCompanyId = String(entry?.companyId || entry?.company_id || "").trim();
      return !isDeleted && (!normalizedCompanyId || entryCompanyId === normalizedCompanyId);
    })
    .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`)
    .join("");

  const current = select.value || "";
  select.innerHTML = `<option value="">Kein Subunternehmen</option>${options}`;
  if (current && Array.from(select.options).some((opt) => opt.value === current)) {
    select.value = current;
  }
}

function setPhotoEditorSource(source, { resetOffset = false } = {}) {
  photoEditorSourceData = source || "";
  if (resetOffset) {
    photoEditorOffset = { x: 0, y: 0 };
  }
  if (elements.photoData) {
    elements.photoData.value = photoEditorSourceData;
  }
  if (elements.capturedPhoto) {
    elements.capturedPhoto.src = photoEditorSourceData;
    elements.capturedPhoto.style.display = photoEditorSourceData ? "inline-block" : "none";
    elements.capturedPhoto.style.transform = "translate(0px, 0px)";
    elements.capturedPhoto.setAttribute("data-x", "0");
    elements.capturedPhoto.setAttribute("data-y", "0");
  }
  if (typeof updatePhotoAdjustControlsState === "function") {
    updatePhotoAdjustControlsState();
  }
}

function syncWorkerEditorUi() {
  const submitButton = document.querySelector("#workerSubmitButton");
  const cancelButton = document.querySelector("#workerCancelEditButton");
  const editing = Boolean(state.editingWorkerId);
  if (submitButton) {
    submitButton.textContent = editing ? "Mitarbeiter aktualisieren" : "Mitarbeiter speichern und Ausweis erzeugen";
  }
  if (cancelButton) {
    cancelButton.classList.toggle("hidden", !editing);
  }
}

function clearWorkerEditor() {
  const form = document.querySelector("#workerForm");
  if (form) {
    form.reset();
  }
  const badgePinInput = document.querySelector("#badgePin");
  if (badgePinInput) {
    badgePinInput.value = "";
  }
  state.editingWorkerId = null;
  setPhotoEditorSource("", { resetOffset: true });
  if (elements.workerType) {
    elements.workerType.value = "worker";
  }
  syncWorkerTypeUi();
  syncWorkerEditorUi();
}

function applyWebsiteLogo(dataUrl) {
  const hasLogo = Boolean(dataUrl);
  document.querySelectorAll(".website-logo-sync").forEach((img) => {
    if (hasLogo) {
      img.src = dataUrl;
    }
    img.classList.toggle("hidden", !hasLogo && img.classList.contains("website-logo-sidebar"));
  });
}

function getCurrentUser() {
  return state.currentUser;
}

function getDefaultViewForRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "turnstile") {
    return "access";
  }
  return "dashboard";
}

function getAllowedViewsForRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "superadmin") {
    return ["dashboard", "workers", "badge", "access", "invoices", "admin"];
  }
  if (normalized === "company-admin") {
    return ["dashboard", "workers", "badge", "access"];
  }
  if (normalized === "turnstile") {
    return ["access", "dashboard"];
  }
  return ["dashboard"];
}

function getCurrentViewName() {
  const activeView = elements.views.find((view) => view.classList.contains("active"));
  return activeView?.dataset?.view || "dashboard";
}

function enforceRoleViewAccess() {
  const role = getCurrentUser()?.role;
  const allowedViews = getAllowedViewsForRole(role);
  const currentView = getCurrentViewName();

  elements.navLinks.forEach((link) => {
    const viewName = link.dataset.view || "";
    const allowed = allowedViews.includes(viewName);
    link.style.display = allowed ? "" : "none";
  });

  if (!allowedViews.includes(currentView)) {
    setView(getDefaultViewForRole(role));
  }
}

function setView(viewName) {
  const role = getCurrentUser()?.role;
  const allowedViews = getAllowedViewsForRole(role);
  const targetView = allowedViews.includes(viewName) ? viewName : getDefaultViewForRole(role);

  elements.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === targetView);
  });
  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === targetView);
  });
}

function clearSession() {
  token = "";
  state.currentUser = null;
}

function handleExpiredControlSession() {
  clearSession();
  refreshAll();
  if (sessionExpiryNoticeShown) {
    return;
  }
  sessionExpiryNoticeShown = true;
  window.alert("Sitzung abgelaufen. Bitte neu anmelden.");
}

function startHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
  }
  heartbeatTimer = window.setInterval(async () => {
    if (!token) return;
    try {
      await apiRequest(`${API_BASE}/api/me/heartbeat`, { method: "POST", body: {}, auth: true });
    } catch {
      // heartbeat failures should not hard-crash UI
    }
  }, 4 * 60 * 1000);
}

function startBackendStatusMonitor() {
  if (backendStatusTimer) {
    window.clearInterval(backendStatusTimer);
  }
  backendStatusTimer = window.setInterval(async () => {
    try {
      await fetch(`${API_BASE}/api/health`, { credentials: "include" });
    } catch {
      // ignore transient offline checks
    }
  }, 30 * 1000);
}

async function apiRequest(url, options = {}) {
  const { method = "GET", body, auth = true, retries = 1 } = options;
  if (auth && !token) {
    handleExpiredControlSession();
    throw new Error("session_expired");
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error("backend_unreachable");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (auth && ["invalid_session", "unauthorized"].includes(String(payload?.error || ""))) {
      handleExpiredControlSession();
      throw new Error("session_expired");
    }
    // ── Retry bei 401 mit neuer Session ──
    if (auth && response.status === 401 && retries > 0) {
      console.warn("⚠️  401 erhalten, versuche neue Session zu laden...");
      try {
        await loadAllData();
        if (token) {
          console.log("✓ Session erneuert, wiederhole Request");
          return apiRequest(url, { ...options, retries: retries - 1 });
        }
      } catch {
        // Fallback zu Session-Ablauf
        handleExpiredControlSession();
        throw new Error("session_expired");
      }
    }
    throw new Error(payload?.error || `http_${response.status}`);
  }
  return payload;
}

function normalizeWorkerAppLink(rawLink) {
  const candidate = String(rawLink || "").trim();
  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate, window.location.origin).toString();
  } catch {
    return candidate;
  }
}

async function loadAllData() {
  const bootstrap = await apiRequest(`${API_BASE}/api/session/bootstrap`, { auth: false });
  token = bootstrap.token || token;
  state.currentUser = bootstrap.user || null;
  sessionExpiryNoticeShown = false;

  const reportUrl = `${API_BASE}/api/reporting/summary`;
  const requests = await Promise.allSettled([
    apiRequest(`${API_BASE}/api/settings`),
    apiRequest(`${API_BASE}/api/companies`),
    apiRequest(`${API_BASE}/api/subcompanies`),
    apiRequest(`${API_BASE}/api/workers`),
    apiRequest(`${API_BASE}/api/access-logs`),
    apiRequest(`${API_BASE}/api/invoices`),
    apiRequest(`${API_BASE}/api/access-logs/summary`),
    apiRequest(`${API_BASE}/api/access-logs/day-close-check`),
    apiRequest(`${API_BASE}/api/audit-logs?eventType=company.repair&targetType=company&limit=120`),
    apiRequest(reportUrl)
  ]);

  const [settings, companies, subcompanies, workers, accessLogs, invoices, summary, dayClose, repairAudit, reporting] = requests;
  if (settings.status === "fulfilled") state.settings = settings.value || state.settings;
  if (companies.status === "fulfilled") state.companies = companies.value || [];
  if (subcompanies.status === "fulfilled") state.subcompanies = subcompanies.value || [];
  if (workers.status === "fulfilled") state.workers = workers.value || [];
  if (accessLogs.status === "fulfilled") state.accessLogs = (accessLogs.value || []).map(normalizeLog);
  if (invoices.status === "fulfilled") state.invoices = invoices.value || [];
  if (invoices.status !== "fulfilled") state.invoices = [];
  if (summary.status === "fulfilled") state.accessInsights = summary.value || state.accessInsights;
  if (reporting.status === "fulfilled") state.reporting = reporting.value || state.reporting;
  if (dayClose.status === "fulfilled") state.dayClose = dayClose.value || null;
  if (repairAudit.status === "fulfilled") {
    const grouped = {};
    (repairAudit.value || []).forEach((entry) => {
      const companyId = entry?.target_id || "";
      if (!companyId) {
        return;
      }
      if (!grouped[companyId]) {
        grouped[companyId] = [];
      }
      grouped[companyId].push(entry);
    });
    Object.keys(grouped).forEach((companyId) => {
      grouped[companyId] = grouped[companyId].slice(0, 5);
    });
    state.companyRepairHistory = grouped;
  } else {
    state.companyRepairHistory = {};
  }
}

function refreshAll() {
  const loggedIn = Boolean(token && state.currentUser);
  if (elements.authOverlay) {
    elements.authOverlay.style.display = loggedIn ? "none" : "grid";
  }
  if (elements.mainShell) {
    elements.mainShell.style.display = loggedIn ? "grid" : "none";
    elements.mainShell.classList.toggle("locked", !loggedIn);
  }
  if (elements.body) {
    elements.body.classList.toggle("auth-locked", !loggedIn);
  }

  updateTopbarActionsState(loggedIn);

  if (loggedIn && elements.sessionCard) {
    const role = state.currentUser?.role || "-";
    const user = state.currentUser?.username || "-";
    elements.sessionCard.innerHTML = `<strong>Angemeldet:</strong> ${escapeHtml(user)} | <strong>Rolle:</strong> ${escapeHtml(role)}`;
  }

  if (!loggedIn) {
    return;
  }

  enforceRoleViewAccess();

  renderStats();
  renderReportingPanels();
  renderWorkerList();
  renderCompanyList();
  populateWorkerSelectOptions();
  populateCompanySelectOptions();
  renderSystemIdentity();
  renderAdminSettingsForm();
  renderDashboardPorterLivePanel();
  renderRecentAccess();
  renderAccessLog();
  renderAccessSummary();
  renderAccessHourly();
  renderAccessWarnings();
  renderDayCloseBanner();
  renderTurnstileQuickPanel();
  renderBadge();
  renderInvoiceHistory();
  renderInvoiceManagementList();
  ensureInvoiceDefaults();
  refreshInvoicePreview({ silent: true });
}

function ensureInvoiceDefaults() {
  const invoiceDateField = document.querySelector("#invoiceDate");
  const invoiceDueDateField = document.querySelector("#invoiceDueDate");
  const invoicePeriodField = document.querySelector("#invoicePeriod");
  if (invoiceDateField && !invoiceDateField.value) {
    invoiceDateField.value = new Date().toISOString().slice(0, 10);
  }
  if (invoiceDueDateField && !invoiceDueDateField.value) {
    const base = invoiceDateField?.value ? new Date(`${invoiceDateField.value}T00:00:00`) : new Date();
    const due = new Date(base.getTime() + (14 * 24 * 60 * 60 * 1000));
    invoiceDueDateField.value = due.toISOString().slice(0, 10);
  }
  if (invoicePeriodField && !invoicePeriodField.value) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const format = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    invoicePeriodField.value = `${format(first)} - ${format(last)}`;
  }
}

function updateTopbarActionsState(loggedIn) {
  const role = getCurrentUser()?.role || "";
  const canSeed = role === "superadmin" || role === "company-admin";

  if (elements.seedDataButton) {
    elements.seedDataButton.style.display = loggedIn ? "inline-flex" : "none";
    elements.seedDataButton.disabled = !canSeed;
    elements.seedDataButton.title = canSeed ? "" : "Nur für Admin-Rollen";
  }

  if (elements.exportButton) {
    const canExport = role === "superadmin" || role === "company-admin";
    elements.exportButton.style.display = loggedIn && canExport ? "inline-flex" : "none";
    elements.exportButton.disabled = !canExport;
    elements.exportButton.title = canExport ? "" : "Nur für Admin-Rollen";
  }

  if (elements.importButton) {
    const canImport = role === "superadmin" || role === "company-admin";
    elements.importButton.style.display = loggedIn && canImport ? "inline-flex" : "none";
    elements.importButton.disabled = !canImport;
    elements.importButton.title = canImport ? "" : "Nur für Admin-Rollen";
  }

  if (elements.logoutButton) {
    elements.logoutButton.style.display = loggedIn ? "inline-flex" : "none";
    elements.logoutButton.disabled = false;
  }
}

function renderStats() {
  if (!elements.statsGrid) return;

  const totalWorkers = state.workers.filter((w) => !w.deletedAt).length;
  const activeWorkers = state.workers.filter((w) => !w.deletedAt && w.status === "aktiv").length;
  const totalVisitors = state.workers.filter((w) => !w.deletedAt && isVisitorWorker(w)).length;
  const totalCompanies = state.companies.filter((c) => !c.deleted_at).length;
  const accessToday = state.accessLogs.filter((log) => {
    const ts = String(log.timestamp || "").slice(0, 10);
    return ts === new Date().toISOString().slice(0, 10);
  }).length;

  const cards = [
    ["Mitarbeiter gesamt", totalWorkers],
    ["Aktive Mitarbeiter", activeWorkers],
    ["Besucher gesamt", totalVisitors],
    ["Firmen", totalCompanies],
    ["Zutritte heute", accessToday]
  ];

  elements.statsGrid.innerHTML = cards
    .map(([label, value]) => `<article class="stat-card"><p>${escapeHtml(label)}</p><strong>${escapeHtml(String(value))}</strong></article>`)
    .join("");
}

function formatCurrencyEur(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function renderReportingPanels() {
  const summaryGrid = elements.reportingSummaryGrid;
  const topOverdueList = elements.reportingTopOverdueList;
  const accessDailyList = elements.reportingAccessDaily;
  const reportingPanels = document.querySelector("#reportingPanels");
  if (!summaryGrid || !topOverdueList || !accessDailyList) {
    return;
  }

  const role = String(getCurrentUser()?.role || "").toLowerCase();
  if (role !== "superadmin") {
    if (reportingPanels) {
      reportingPanels.style.display = "none";
    }
    summaryGrid.innerHTML = "";
    topOverdueList.innerHTML = "";
    accessDailyList.innerHTML = "";
    return;
  }

  if (reportingPanels) {
    reportingPanels.style.display = "grid";
  }

  const kpis = state.reporting?.kpis || {};
  const generatedAt = state.reporting?.generatedAt || "";
  const summaryCards = [
    ["Bezahlt", formatCurrencyEur(kpis.paidTotal)],
    ["Offen", formatCurrencyEur(kpis.openTotal)],
    ["Überfällig", `${Number(kpis.overdueInvoiceCount || 0)} Rechnungen`],
    ["Überfällige Summe", formatCurrencyEur(kpis.overdueTotal)],
    ["Gesperrte Firmen", String(Number(kpis.lockedCompanies || 0))],
    ["Auto-Sperren (30d)", String(Number(kpis.suspensionsLast30d || 0))]
  ];

  summaryGrid.innerHTML = summaryCards
    .map(([label, value]) => `
      <article class="card-item">
        <p class="helper-text">${escapeHtml(label)}</p>
        <strong>${escapeHtml(String(value))}</strong>
      </article>
    `)
    .join("") + (generatedAt ? `<p class="helper-text">Stand: ${escapeHtml(formatTimestamp(generatedAt))}</p>` : "");

  const topCompanies = state.reporting?.topOverdueCompanies || [];
  if (!topCompanies.length) {
    topOverdueList.innerHTML = '<div class="empty-state">Keine überfälligen Firmen vorhanden.</div>';
  } else {
    topOverdueList.innerHTML = topCompanies
      .map((entry) => `
        <article class="card-item">
          <strong>${escapeHtml(entry.companyName || "Firma")}</strong>
          <p class="helper-text">${Number(entry.overdueCount || 0)} überfällige Rechnungen</p>
          <p>${escapeHtml(formatCurrencyEur(entry.overdueTotal))}</p>
        </article>
      `)
      .join("");
  }

  const dailyRows = state.reporting?.accessDaily || [];
  if (!dailyRows.length) {
    accessDailyList.innerHTML = '<div class="empty-state">Keine Zutrittsdaten für die letzten 7 Tage.</div>';
  } else {
    const maxDaily = Math.max(
      ...dailyRows.map((entry) => Number(entry.checkIn || 0) + Number(entry.checkOut || 0)),
      1
    );

    accessDailyList.innerHTML = dailyRows
      .map((entry) => {
        const checkIn = Number(entry.checkIn || 0);
        const checkOut = Number(entry.checkOut || 0);
        const inWidth = Math.max(3, Math.round((checkIn / maxDaily) * 100));
        const outWidth = Math.max(3, Math.round((checkOut / maxDaily) * 100));
        return `
        <article class="card-item">
          <strong>${escapeHtml(formatDate(entry.day))}</strong>
          <p class="helper-text">Check-in: ${escapeHtml(String(checkIn))}</p>
          <div style="height:8px; background:#e6edf2; border-radius:6px; overflow:hidden; margin:4px 0 8px;">
            <div style="height:100%; width:${inWidth}%; background:#0f7a5a;"></div>
          </div>
          <p class="helper-text">Check-out: ${escapeHtml(String(checkOut))}</p>
          <div style="height:8px; background:#e6edf2; border-radius:6px; overflow:hidden; margin:4px 0 0;">
            <div style="height:100%; width:${outWidth}%; background:#4c6faf;"></div>
          </div>
        </article>
      `;
      })
      .join("");
  }
}

function renderWorkerList() {
  if (!elements.workerList) return;
  const searchTerm = ((elements.workerSearchInput?.value) || "").trim().toLowerCase();
  const workers = [...state.workers]
    .filter((w) => {
      if (!searchTerm) return true;
      const hay = [w.firstName, w.lastName, w.badgeId, w.site, w.role, w.status, w.visitorCompany].join(" ").toLowerCase();
      return hay.includes(searchTerm);
    })
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));

  if (!workers.length) {
    elements.workerList.innerHTML = `<div class="empty-state">${searchTerm ? "Keine Treffer f\u00fcr \u00ab" + escapeHtml(searchTerm) + "\u00bb." : "Noch keine Mitarbeiter angelegt."}</div>`;
    return;
  }

  elements.workerList.innerHTML = workers
    .map((worker) => {
      const deleted = Boolean(worker.deletedAt);
      const sub = getSubcompanyLabel(worker);
      const visitor = isVisitorWorker(worker);
      const visitorMeta = visitor
        ? `<p>Besucherfirma: <strong>${escapeHtml(worker.visitorCompany || "-")}</strong> | Zweck: <strong>${escapeHtml(worker.visitPurpose || "-")}</strong></p>
           <p>Ansprechpartner: <strong>${escapeHtml(worker.hostName || "-")}</strong> | Besuchsende: <strong>${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</strong></p>`
        : "";
      return `
        <article class="card-item ${deleted ? "is-deleted" : ""}">
          <header>
            <div>
              <input type="checkbox" class="bulk-checkbox" data-bulk-id="${escapeHtml(worker.id)}" />
              <strong>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</strong>
              <span>${escapeHtml(worker.badgeId || "-")}</span>
            </div>
            <span class="status-pill">${escapeHtml(worker.status || "-")}</span>
          </header>
          <p>${escapeHtml(visitor ? "Besucher" : (worker.role || "-"))} | ${escapeHtml(worker.site || "-")}</p>
          <p>App-PIN: <strong>${visitor ? "nicht nötig" : (worker.badgePinConfigured ? "gesetzt" : "fehlt")}</strong> | Karte: <strong>${escapeHtml(worker.physicalCardId || "nicht zugewiesen")}</strong></p>
          ${sub ? `<p>Subunternehmen: ${escapeHtml(sub)}</p>` : ""}
          ${visitorMeta}
          <div class="button-row">
            <button type="button" class="ghost-button" data-worker-edit="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>Bearbeiten</button>
            <button type="button" class="ghost-button" data-worker-delete="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>Löschen</button>
            <button type="button" class="ghost-button" data-worker-restore="${escapeHtml(worker.id)}" ${deleted ? "" : "disabled"}>Wiederherstellen</button>
            <button type="button" class="ghost-button" data-worker-app-link="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>App-Link</button>
            ${!visitor && !deleted ? `<button type="button" class="ghost-button" data-worker-reset-pin="${escapeHtml(worker.id)}">PIN zurücksetzen</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  bindWorkerRowActions();
}

function bindWorkerRowActions() {

  // Delegate checkbox changes to update bulk bar
  elements.workerList.addEventListener("change", (e) => {
    if (e.target.classList.contains("bulk-checkbox")) {
      updateBulkActionBar();
      // Sync "select all" state
      const all = elements.workerList.querySelectorAll(".bulk-checkbox");
      const checked = elements.workerList.querySelectorAll(".bulk-checkbox:checked");
      if (elements.bulkSelectAll) {
        elements.bulkSelectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        elements.bulkSelectAll.checked = checked.length === all.length && all.length > 0;
      }
    }
  });
  elements.workerList.querySelectorAll("[data-worker-edit]").forEach((button) => {
    button.onclick = () => {
      const worker = state.workers.find((entry) => entry.id === button.dataset.workerEdit);
      if (!worker || worker.deletedAt) return;
      state.editingWorkerId = worker.id;
      if (elements.companySelect) elements.companySelect.value = worker.companyId;
      populateSubcompanySelects();
      document.querySelector("#subcompanySelect").value = worker.subcompanyId || "";
      document.querySelector("#firstName").value = worker.firstName || "";
      document.querySelector("#lastName").value = worker.lastName || "";
      document.querySelector("#insuranceNumber").value = worker.insuranceNumber || "";
      if (elements.workerType) elements.workerType.value = isVisitorWorker(worker) ? "visitor" : "worker";
      document.querySelector("#role").value = worker.role || "";
      document.querySelector("#site").value = worker.site || "";
      document.querySelector("#physicalCardId").value = worker.physicalCardId || "";
      document.querySelector("#validUntil").value = worker.validUntil || "";
      if (elements.visitorCompany) elements.visitorCompany.value = worker.visitorCompany || "";
      if (elements.visitPurpose) elements.visitPurpose.value = worker.visitPurpose || "";
      if (elements.hostName) elements.hostName.value = worker.hostName || "";
      if (elements.visitEndAt) elements.visitEndAt.value = worker.visitEndAt ? toDateTimeLocalValue(worker.visitEndAt) : "";
      document.querySelector("#workerStatus").value = worker.status || "aktiv";
      document.querySelector("#badgePin").value = "";
      setPhotoEditorSource(worker.photoData || "", { resetOffset: true });
      syncWorkerTypeUi();
      syncWorkerEditorUi();
      setView("workers");
    };
  });

  elements.workerList.querySelectorAll("[data-worker-delete]").forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm("Mitarbeiter wirklich löschen?")) return;
      try {
        await apiRequest(`${API_BASE}/api/workers/${button.dataset.workerDelete}`, { method: "DELETE" });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Mitarbeiter konnte nicht gelöscht werden: ${error.message}`);
      }
    };
  });

  elements.workerList.querySelectorAll("[data-worker-restore]").forEach((button) => {
    button.onclick = async () => {
      try {
        await apiRequest(`${API_BASE}/api/workers/${button.dataset.workerRestore}/restore`, { method: "POST" });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Mitarbeiter konnte nicht wiederhergestellt werden: ${error.message}`);
      }
    };
  });

  elements.workerList.querySelectorAll("[data-worker-app-link]").forEach((button) => {
    button.onclick = async () => {
      try {
        const payload = await apiRequest(`${API_BASE}/api/workers/${button.dataset.workerAppLink}/app-access`, { method: "POST" });
        const absoluteLink = normalizeWorkerAppLink(payload.link);
        const worker = state.workers.find((entry) => entry.id === button.dataset.workerAppLink) || null;
        showWorkerAppQrDialog(worker, absoluteLink, payload);
      } catch (error) {
        window.alert(`App-Link konnte nicht erzeugt werden: ${error.message}`);
      }
    };
  });

  elements.workerList.querySelectorAll("[data-worker-reset-pin]").forEach((button) => {
    button.onclick = async () => {
      const workerId = button.dataset.workerResetPin;
      const worker = state.workers.find((w) => w.id === workerId);
      const name = worker ? `${worker.firstName} ${worker.lastName}` : workerId;
      const newPin = window.prompt(`Neue Badge-PIN für ${name} (4–8 Ziffern):`);
      if (newPin === null) return; // abgebrochen
      if (!/^\d{4,8}$/.test(newPin.trim())) {
        window.alert("PIN muss aus 4 bis 8 Ziffern bestehen.");
        return;
      }
      try {
        await apiRequest(`${API_BASE}/api/workers/${workerId}/reset-pin`, { method: "POST", body: { newPin: newPin.trim() } });
        window.alert(`PIN für ${name} wurde erfolgreich zurückgesetzt.`);
      } catch (error) {
        window.alert(`PIN konnte nicht zurückgesetzt werden: ${error.message}`);
      }
    };
  });
}

function renderCompanyList() {
  if (!elements.companyList) return;
  if (!state.companies.length) {
    elements.companyList.innerHTML = '<div class="empty-state">Noch keine Firmen vorhanden.</div>';
    return;
  }
  const userRole = getCurrentUser()?.role || "";
  const userCompanyId = getCurrentUser()?.company_id || getCurrentUser()?.companyId || "";
  const canRepairAny = userRole === "superadmin";
  const canDeleteAny = userRole === "superadmin";
  const canRepairOwn = userRole === "company-admin";
  const historyWindowValue = String(state.repairHistoryWindowDays || 0);
  const onlyProblemsChecked = Boolean(state.onlyCompaniesWithRepairs);

  const companiesToRender = state.companies.filter((company) => {
    if (!onlyProblemsChecked) {
      return true;
    }
    const companyId = company.id || "";
    const repairHistory = filterRepairHistoryByWindow(state.companyRepairHistory?.[companyId] || []);
    return repairHistory.length > 0;
  });
  const shownCount = companiesToRender.length;
  const totalCount = state.companies.length;

  const cardsMarkup = companiesToRender
    .map((company) => {
      const companyId = company.id || "";
      const deleted = Boolean(company.deleted_at || company.deletedAt);
      const statusMeta = getCompanyStatusMeta(company.status);
      const canRepair = canRepairCompany(company);
      const canToggleLock = userRole === "superadmin";
      const isRepairing = Boolean(state.companyRepairBusy?.[companyId]);
      const isLockBusy = Boolean(state.companyLockBusy?.[companyId]);
      const repairStatus = state.companyRepairStatus?.[companyId] || null;
      const repairStatusClass = repairStatus?.kind === "error"
        ? "helper-text helper-text-warning"
        : repairStatus?.kind === "success"
          ? "helper-text helper-text-ok"
          : "helper-text helper-text-info";
      const repairHistory = filterRepairHistoryByWindow(state.companyRepairHistory?.[companyId] || []);
      const historyMarkup = repairHistory.length
        ? repairHistory
            .map((entry) => `<span>• ${escapeHtml(formatTimestamp(entry.created_at))}: ${escapeHtml(entry.message || "Reparatur ausgefuehrt")}</span>`)
            .join("")
        : "<span>Keine Reparaturen im gewaelten Zeitraum.</span>";
      return `
        <article class="card-item ${deleted ? "is-deleted" : ""}">
          <strong>${escapeHtml(company.name || "Firma")}</strong>
          <span>${escapeHtml(company.plan || "-")}</span>
          <p class="${statusMeta.className}">Status: ${escapeHtml(statusMeta.label)}</p>
          <div class="meta-box">
            <p><strong>Letzte Reparaturen</strong></p>
            ${historyMarkup}
          </div>
          ${repairStatus ? `<p class="${repairStatusClass}">${escapeHtml(repairStatus.message || "")}</p>` : ""}
          <div class="button-row">
            <button type="button" class="ghost-button" data-company-repair="${escapeHtml(companyId)}" ${canRepair && !deleted && !isRepairing ? "" : "disabled"}>${isRepairing ? "Reparatur laeuft..." : "Firma reparieren"}</button>
            <button type="button" class="ghost-button" data-company-toggle-lock="${escapeHtml(companyId)}" ${canToggleLock && !deleted && !isLockBusy ? "" : "disabled"}>${isLockBusy ? "Speichert..." : String(company.status || "aktiv").toLowerCase() === "gesperrt" ? "Sperre aufheben" : "Firma sperren"}</button>
            <button type="button" class="ghost-button" data-company-delete="${escapeHtml(companyId)}" ${canDeleteAny && !deleted ? "" : "disabled"}>Firma löschen</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.companyList.innerHTML = `
    <article class="card-item">
      <div class="button-row" style="justify-content:space-between; align-items:center;">
        <div>
          <strong>Reparatur-Verlauf filtern</strong>
          <p class="helper-text">${shownCount} von ${totalCount} Firmen angezeigt</p>
        </div>
        <div class="button-row" style="gap:10px;">
          <label>
            Zeitraum
            <select id="companyRepairHistoryWindow" style="margin-left:8px;">
              <option value="7" ${historyWindowValue === "7" ? "selected" : ""}>Letzte 7 Tage</option>
              <option value="30" ${historyWindowValue === "30" ? "selected" : ""}>Letzte 30 Tage</option>
              <option value="90" ${historyWindowValue === "90" ? "selected" : ""}>Letzte 90 Tage</option>
              <option value="0" ${historyWindowValue === "0" ? "selected" : ""}>Alle</option>
            </select>
          </label>
          <label>
            <input id="companyOnlyProblems" type="checkbox" ${onlyProblemsChecked ? "checked" : ""} />
            Nur Probleme anzeigen
          </label>
        </div>
      </div>
    </article>
    ${cardsMarkup || '<div class="empty-state">Keine Firmen mit Reparaturen im ausgewaehlten Zeitraum.</div>'}
  `;

  bindCompanyHistoryControls();
  bindCompanyRowActions();
}

function filterRepairHistoryByWindow(entries) {
  const days = Number(state.repairHistoryWindowDays || 0);
  if (!days || days <= 0) {
    return entries;
  }
  const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
  return (entries || []).filter((entry) => {
    const ts = Date.parse(entry?.created_at || "");
    return Number.isFinite(ts) && ts >= cutoffMs;
  });
}

function bindCompanyHistoryControls() {
  const filterSelect = document.querySelector("#companyRepairHistoryWindow");
  const onlyProblemsToggle = document.querySelector("#companyOnlyProblems");
  if (!filterSelect) {
    return;
  }

  filterSelect.addEventListener("change", () => {
    const value = Number(filterSelect.value || 30);
    state.repairHistoryWindowDays = Number.isFinite(value) ? value : 30;
    renderCompanyList();
  });

  if (onlyProblemsToggle) {
    onlyProblemsToggle.addEventListener("change", () => {
      state.onlyCompaniesWithRepairs = Boolean(onlyProblemsToggle.checked);
      renderCompanyList();
    });
  }
}

function bindCompanyRowActions() {
  if (!elements.companyList || elements.companyList.dataset.repairBound === "1") return;

  elements.companyList.dataset.repairBound = "1";
  elements.companyList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-company-delete]");
    if (deleteButton && !deleteButton.disabled && elements.companyList.contains(deleteButton)) {
      const companyId = deleteButton.dataset.companyDelete;
      if (!companyId) {
        return;
      }
      const company = state.companies.find((entry) => entry.id === companyId);
      const companyName = company?.name || "diese Firma";
      const forceDelete = window.confirm(
        `Firma ${companyName} und alle zugehörigen Datensätze löschen?\n\nOK = komplette Löschung (inkl. Mitarbeiter, Subunternehmen und Logs)\nAbbrechen = nicht löschen`
      );
      if (!forceDelete) {
        return;
      }

      try {
        await apiRequest(`${API_BASE}/api/companies/${companyId}?force=1`, { method: "DELETE" });
        await loadAllData();
        refreshAll();
        window.alert(`Firma ${companyName} wurde gelöscht.`);
      } catch (error) {
        const repairMessage = mapCompanyRepairError(error);
        window.alert(`Firma ${companyName} konnte nicht gelöscht werden: ${repairMessage}`);
      }
      return;
    }

    const lockButton = event.target.closest("[data-company-toggle-lock]");
    if (lockButton && !lockButton.disabled && elements.companyList.contains(lockButton)) {
      const companyId = lockButton.dataset.companyToggleLock;
      if (!companyId) {
        return;
      }
      const company = state.companies.find((entry) => entry.id === companyId);
      const companyName = company?.name || "diese Firma";
      const currentStatus = String(company?.status || "aktiv").toLowerCase();
      const nextStatus = currentStatus === "gesperrt" ? "aktiv" : "gesperrt";
      const promptText = nextStatus === "gesperrt"
        ? `Firma ${companyName} jetzt sperren? Firmen-Admin, Drehkreuz und Mitarbeiter-App dieser Firma werden blockiert.`
        : `Sperre fuer ${companyName} jetzt aufheben? Die Firma kann sich danach wieder anmelden.`;
      if (!window.confirm(promptText)) {
        return;
      }

      state.companyLockBusy[companyId] = true;
      state.companyRepairStatus[companyId] = {
        kind: "info",
        message: nextStatus === "gesperrt" ? "Firma wird gesperrt..." : "Sperre wird aufgehoben..."
      };
      renderCompanyList();

      try {
        await apiRequest(`${API_BASE}/api/companies/${companyId}`, { method: "PUT", body: { status: nextStatus } });
        state.companyRepairStatus[companyId] = {
          kind: nextStatus === "gesperrt" ? "error" : "success",
          message: nextStatus === "gesperrt" ? "Firma ist jetzt gesperrt." : "Firma ist wieder aktiv."
        };
        await loadAllData();
        refreshAll();
        window.alert(nextStatus === "gesperrt"
          ? `Firma ${companyName} wurde gesperrt.`
          : `Sperre fuer ${companyName} wurde aufgehoben.`);
      } catch (error) {
        const repairMessage = mapCompanyRepairError(error);
        state.companyRepairStatus[companyId] = {
          kind: "error",
          message: repairMessage
        };
        renderCompanyList();
        window.alert(`Statuswechsel für ${companyName} fehlgeschlagen: ${repairMessage}`);
      } finally {
        delete state.companyLockBusy[companyId];
        renderCompanyList();
      }
      return;
    }

    const button = event.target.closest("[data-company-repair]");
    if (!button || button.disabled || !elements.companyList.contains(button)) {
      return;
    }

    const companyId = button.dataset.companyRepair;
    if (!companyId) {
      return;
    }

    const company = state.companies.find((entry) => entry.id === companyId);
    const companyName = company?.name || "diese Firma";
    if (!window.confirm(`Firmen-Reparatur für ${companyName} starten? Dabei werden inkonsistente Einträge automatisch korrigiert.`)) {
      return;
    }

    state.companyRepairBusy[companyId] = true;
    state.companyRepairStatus[companyId] = {
      kind: "info",
      message: "Reparatur wird ausgefuehrt..."
    };
    renderCompanyList();

    try {
      const payload = await apiRequest(`${API_BASE}/api/companies/${companyId}/repair`, { method: "POST", body: {} });
      const fixed = Array.isArray(payload?.fixed) ? payload.fixed : [];
      state.companyRepairStatus[companyId] = {
        kind: "success",
        message: fixed.length ? fixed[0] : "Firma erfolgreich geprueft."
      };
      await loadAllData();
      refreshAll();
      if (fixed.length) {
        window.alert(`Firmen-Reparatur für ${companyName} abgeschlossen:\n- ${fixed.join("\n- ")}`);
      } else {
        window.alert(`Firmen-Reparatur für ${companyName} abgeschlossen.`);
      }
    } catch (error) {
      const repairMessage = mapCompanyRepairError(error);
      state.companyRepairStatus[companyId] = {
        kind: "error",
        message: repairMessage
      };
      renderCompanyList();
      window.alert(`Firmen-Reparatur für ${companyName} fehlgeschlagen: ${repairMessage}`);
    } finally {
      delete state.companyRepairBusy[companyId];
      renderCompanyList();
    }
  });
}

function populateWorkerSelectOptions() {
  const select = elements.accessWorkerSelect;
  if (!select) return;
  const current = select.value;
  const options = state.workers
    .filter((w) => !w.deletedAt)
    .map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(`${w.firstName} ${w.lastName}`)}${isVisitorWorker(w) ? " [Besucher]" : ""} (${escapeHtml(w.badgeId || "-")})</option>`)
    .join("");
  select.innerHTML = `<option value="">Bitte Person waehlen</option>${options}`;
  if (current && Array.from(select.options).some((o) => o.value === current)) {
    select.value = current;
  }
}

function populateCompanySelectOptions() {
  const companies = state.companies.filter((c) => !c.deleted_at);
  const syncSelect = (select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = companies.map((company) => `<option value="${escapeHtml(company.id)}">${escapeHtml(company.name)}</option>`).join("");
    if (current && Array.from(select.options).some((o) => o.value === current)) {
      select.value = current;
    }
  };
  syncSelect(elements.companySelect);
  syncSelect(elements.invoiceCompanySelect);
  syncInvoiceRecipientFromCompany();
}

function getCompanyBillingEmail(company) {
  return (company?.billingEmail || company?.billing_email || "").trim();
}

function syncInvoiceRecipientFromCompany() {
  if (!elements.invoiceCompanySelect || !elements.invoiceRecipientEmail) {
    return;
  }
  const companyId = elements.invoiceCompanySelect.value;
  const company = state.companies.find((entry) => entry.id === companyId);
  const billingEmail = getCompanyBillingEmail(company);
  if (billingEmail && !elements.invoiceRecipientEmail.value.trim()) {
    elements.invoiceRecipientEmail.value = billingEmail;
  }
}

function renderSystemIdentity() {
  const platform = document.querySelector("#loginPlatformName");
  const operator = document.querySelector("#loginOperatorName");
  const endpoint = document.querySelector("#loginTurnstileEndpoint");
  if (platform) platform.textContent = state.settings.platformName || "BauPass Control";
  if (operator) operator.textContent = state.settings.operatorName || "Deine Betriebsfirma";
  if (endpoint) endpoint.textContent = state.settings.turnstileEndpoint || "Noch nicht gesetzt";
}

function renderAdminSettingsForm() {
  const platformName = document.querySelector("#platformName");
  const operatorName = document.querySelector("#operatorName");
  const turnstileEndpoint = document.querySelector("#turnstileEndpoint");
  const rentalModel = document.querySelector("#rentalModel");
  const invoicePrimaryColor = document.querySelector("#invoicePrimaryColor");
  const invoiceAccentColor = document.querySelector("#invoiceAccentColor");
  const smtpHost = document.querySelector("#smtpHost");
  const smtpPort = document.querySelector("#smtpPort");
  const smtpUsername = document.querySelector("#smtpUsername");
  const smtpPassword = document.querySelector("#smtpPassword");
  const smtpSenderEmail = document.querySelector("#smtpSenderEmail");
  const smtpSenderName = document.querySelector("#smtpSenderName");
  const smtpUseTls = document.querySelector("#smtpUseTls");
  const adminIpWhitelist = document.querySelector("#adminIpWhitelist");
  const enforceTenantDomain = document.querySelector("#enforceTenantDomain");
  const workerAppEnabled = document.querySelector("#workerAppEnabled");

  if (platformName) platformName.value = state.settings.platformName || "BauPass Control";
  if (operatorName) operatorName.value = state.settings.operatorName || "Deine Betriebsfirma";
  if (turnstileEndpoint) turnstileEndpoint.value = state.settings.turnstileEndpoint || "";
  if (rentalModel) rentalModel.value = state.settings.rentalModel || "tageskarte";
  if (invoicePrimaryColor) invoicePrimaryColor.value = state.settings.invoicePrimaryColor || "#0f4c5c";
  if (invoiceAccentColor) invoiceAccentColor.value = state.settings.invoiceAccentColor || "#e36414";
  if (smtpHost) smtpHost.value = state.settings.smtpHost || "";
  if (smtpPort) smtpPort.value = String(state.settings.smtpPort || 587);
  if (smtpUsername) smtpUsername.value = state.settings.smtpUsername || "";
  if (smtpPassword) smtpPassword.value = "";
  if (smtpSenderEmail) smtpSenderEmail.value = state.settings.smtpSenderEmail || "";
  if (smtpSenderName) smtpSenderName.value = state.settings.smtpSenderName || "";
  if (smtpUseTls) smtpUseTls.value = state.settings.smtpUseTls === false ? "0" : "1";
  if (adminIpWhitelist) adminIpWhitelist.value = state.settings.adminIpWhitelist || "";
  if (enforceTenantDomain) enforceTenantDomain.value = state.settings.enforceTenantDomain ? "1" : "0";
  if (workerAppEnabled) workerAppEnabled.value = state.settings.workerAppEnabled === false ? "0" : "1";
  if (elements.invoiceLogoData && !elements.invoiceLogoData.value) {
    elements.invoiceLogoData.value = state.settings.invoiceLogoData || "";
  }
}

function showWorkerDetailOverlay(worker) {
  const overlay = document.getElementById("workerDetailOverlay");
  if (!overlay) return;
  const company = state.companies.find((entry) => entry.id === worker.companyId);
  const subcompanyLabel = getSubcompanyLabel(worker);
  overlay.innerHTML = `
    <div class="worker-detail-card">
      <button class="close-btn" title="Schließen">&times;</button>
      <img src="${worker.photoData || createAvatar(worker)}" alt="Mitarbeiterfoto" />
      <h2>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</h2>
      <p><strong>Typ:</strong> ${escapeHtml(isVisitorWorker(worker) ? "Besucher" : "Mitarbeiter")}</p>
      <p><strong>Firma:</strong> ${escapeHtml(company?.name || "-")}</p>
      ${subcompanyLabel ? `<p><strong>Subunternehmen:</strong> ${escapeHtml(subcompanyLabel)}</p>` : ""}
      <p><strong>Badge-ID:</strong> ${escapeHtml(worker.badgeId)}</p>
      ${isVisitorWorker(worker) ? `<p><strong>Besucherfirma:</strong> ${escapeHtml(worker.visitorCompany || "-")}</p><p><strong>Zweck:</strong> ${escapeHtml(worker.visitPurpose || "-")}</p><p><strong>Ansprechpartner:</strong> ${escapeHtml(worker.hostName || "-")}</p><p><strong>Besuchsende:</strong> ${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</p>` : `<p><strong>Rentenversicherung:</strong> ${escapeHtml(worker.insuranceNumber)}</p><p><strong>Funktion:</strong> ${escapeHtml(worker.role)}</p>`}
      <p><strong>Baustelle:</strong> ${escapeHtml(worker.site)}</p>
      <p><strong>Gültig bis:</strong> ${formatDate(worker.validUntil)}</p>
      <p><strong>Status:</strong> ${escapeHtml(worker.status)}</p>
      <p><strong>Badge-PIN:</strong> ${isVisitorWorker(worker) ? "nicht nötig" : (worker.badgePinConfigured ? "gesetzt" : "nicht gesetzt")}</p>
      <p><strong>Karten-ID:</strong> ${escapeHtml(worker.physicalCardId || "nicht zugewiesen")}</p>
      <div class="button-row">
        <button type="button" class="primary-button" id="workerCheckInBtn">Anmelden (Check-in)</button>
        <button type="button" class="ghost-button" id="workerCheckOutBtn">Abmelden (Check-out)</button>
      </div>
    </div>
  `;
  overlay.classList.remove("hidden");
  overlay.querySelector(".close-btn").onclick = () => overlay.classList.add("hidden");
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add("hidden"); };
  overlay.querySelector("#workerCheckInBtn").onclick = () => {
    triggerWorkerAccess(worker, "check-in");
    overlay.classList.add("hidden");
  };
  overlay.querySelector("#workerCheckOutBtn").onclick = () => {
    triggerWorkerAccess(worker, "check-out");
    overlay.classList.add("hidden");
  };
}

async function triggerWorkerAccess(worker, direction) {
  try {
    await apiRequest(API_BASE + "/api/access-logs", {
      method: "POST",
      body: {
        workerId: worker.id,
        direction,
        gate: "Dashboard",
        note: "Dashboard Schnellbuchung"
      }
    });
    await loadAllData();
    refreshAll();
    showAccessFeedback(worker.id, direction, "Dashboard", new Date().toISOString());
  } catch (error) {
    window.alert("Zutritt konnte nicht gebucht werden: " + error.message);
  }
}

window.triggerWorkerAccess = triggerWorkerAccess;

  elements.workerList.querySelectorAll("[data-worker-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const worker = state.workers.find((entry) => entry.id === button.dataset.workerEdit);
      if (!worker) {
        return;
      }
      if (worker.deletedAt) {
        window.alert("Gelöschte Mitarbeiter können nicht bearbeitet werden.");
        return;
      }

      state.editingWorkerId = worker.id;
      document.querySelector("#companySelect").value = worker.companyId;
      populateSubcompanySelects();
      document.querySelector("#subcompanySelect").value = worker.subcompanyId || "";
      document.querySelector("#firstName").value = worker.firstName;
      document.querySelector("#lastName").value = worker.lastName;
      document.querySelector("#insuranceNumber").value = worker.insuranceNumber;
      document.querySelector("#role").value = worker.role;
      document.querySelector("#site").value = worker.site;
      document.querySelector("#physicalCardId").value = worker.physicalCardId || "";
      document.querySelector("#validUntil").value = worker.validUntil;
      document.querySelector("#workerStatus").value = worker.status;
      document.querySelector("#badgePin").value = "";
      setPhotoEditorSource(worker.photoData || "", { resetOffset: true });
      syncWorkerEditorUi();
      setView("workers");
    });
  });

  elements.workerList.querySelectorAll("[data-worker-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Mitarbeiter wirklich loeschen?")) {
        return;
      }

      try {
        await apiRequest(API_BASE + `/api/workers/${button.dataset.workerDelete}`, { method: "DELETE" });
        if (state.editingWorkerId === button.dataset.workerDelete) {
          clearWorkerEditor();
        }
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Mitarbeiter konnte nicht gelöscht werden: ${error.message}`);
      }
    });
  });

  elements.workerList.querySelectorAll("[data-worker-restore]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await apiRequest(API_BASE + `/api/workers/${button.dataset.workerRestore}/restore`, { method: "POST" });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Mitarbeiter konnte nicht wiederhergestellt werden: ${error.message}`);
      }
    });
  });

  elements.workerList.querySelectorAll("[data-worker-app-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const payload = await apiRequest(API_BASE + `/api/workers/${button.dataset.workerAppLink}/app-access`, { method: "POST" });
        const absoluteLink = normalizeWorkerAppLink(payload.link);
        const worker = state.workers.find((entry) => entry.id === button.dataset.workerAppLink) || null;
        showWorkerAppQrDialog(worker, absoluteLink, payload);
      } catch (error) {
        window.alert(`App-Link konnte nicht erzeugt werden: ${error.message}`);
      }
    });
  });

function closeWorkerAppQrDialog() {
  const existing = document.querySelector(".worker-app-qr-overlay");
  if (existing) {
    existing.remove();
  }
}

function printWorkerAppQr(workerName, qrSrc) {
  const w = window.open("", "_blank", "width=720,height=840");
  if (!w) {
    window.alert("Druckfenster konnte nicht geöffnet werden.");
    return;
  }

  const safeName = escapeHtml(workerName || "Mitarbeiter");
  w.document.write(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8" />
      <title>Mitarbeiter-App QR</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; text-align: center; }
        .sheet { border: 1px solid #ddd; border-radius: 16px; padding: 24px; }
        img { width: 320px; height: 320px; object-fit: contain; }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 6px 0; color: #444; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <h1>Mitarbeiter-App installieren</h1>
        <p><strong>${safeName}</strong></p>
        <p>QR-Code mit der Kamera scannen und App starten.</p>
        <img src="${qrSrc}" alt="Mitarbeiter App QR" />
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  w.document.close();
}

function showWorkerAppQrDialog(worker, absoluteLink, payload = null) {
  closeWorkerAppQrDialog();

  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : "Mitarbeiter";
  const isVisitorCard = worker ? isVisitorWorker(worker) : true;
  const linkExpiresAt = payload?.accessExpiresAt ? formatDateTime(payload.accessExpiresAt) : "-";
  const oneTimeHint = payload?.oneTime ? "Einmal-Link: Nach erstem Login ungueltig." : "";
  const dialog = document.createElement("div");
  dialog.className = "worker-app-qr-overlay";

  const qrId = `workerAppQr-${Date.now()}`;
  dialog.innerHTML = `
    <div class="worker-app-qr-card">
      <h3>Besucherkarte QR</h3>
      <p>Fuer: <strong>${escapeHtml(workerName)}</strong></p>
      <p>Code mit der Kamera scannen, um die Besucherkarte digital in der App zu oeffnen.</p>
      <p class="helper-text">Gueltig bis: ${escapeHtml(linkExpiresAt)} Uhr</p>
      ${oneTimeHint ? `<p class="helper-text">${escapeHtml(oneTimeHint)}</p>` : ""}
      <img id="${qrId}" alt="Mitarbeiter App QR" />
      <div class="button-row">
        ${isVisitorCard ? "" : `<button type="button" class="primary-button" data-worker-app-print>QR drucken</button>`}
        <button type="button" class="ghost-button" data-worker-app-copy>Link kopieren</button>
        <button type="button" class="ghost-button" data-worker-app-close>Schliessen</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  renderRealQr(qrId, absoluteLink);

  dialog.querySelector("[data-worker-app-close]")?.addEventListener("click", () => {
    closeWorkerAppQrDialog();
  });

  dialog.querySelector("[data-worker-app-copy]")?.addEventListener("click", async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteLink);
        window.alert("App-Link kopiert.");
      } else {
        window.prompt("App-Link für den Mitarbeiter:", absoluteLink);
      }
    } catch {
      window.prompt("App-Link für den Mitarbeiter:", absoluteLink);
    }
  });

  dialog.querySelector("[data-worker-app-print]")?.addEventListener("click", () => {
    const qrImage = dialog.querySelector(`#${qrId}`);
    if (!qrImage?.src) {
      window.alert("QR-Code wird noch erzeugt. Bitte kurz erneut versuchen.");
      return;
    }
    printWorkerAppQr(workerName, qrImage.src);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeWorkerAppQrDialog();
    }
  });
}

function renderBadge() {
  const worker = state.workers.find((entry) => entry.id === state.selectedWorkerId) || state.workers[0] || null;

  if (!worker) {
    elements.badgePreview.innerHTML = "Bitte zuerst einen Mitarbeiter anlegen.";
    elements.badgePreview.className = "badge-shell empty-state";
    elements.badgeMeta.innerHTML = "Kein Badge ausgewaehlt.";
    elements.badgeMeta.className = "badge-meta empty-state";
    return;
  }

  state.selectedWorkerId = worker.id;
  const company = state.companies.find((entry) => entry.id === worker.companyId);
  const normalizedPlan = String(company?.plan || "").trim().toLowerCase();
  const isDayPass = normalizedPlan === "tageskarte";
  const visitor = isVisitorWorker(worker);
  const badgeTitle = visitor
    ? "Digitale Besucherkarte"
    : (isDayPass ? "Digitaler Baustellen-Tagesausweis" : "Digitaler Baustellen-Ausweis");
  const badgeClass = isDayPass ? "badge-card badge-card-daypass" : "badge-card";
  const planLabel = getPlanLabel(normalizedPlan || "tageskarte");
  const subcompanyLabel = getSubcompanyLabel(worker);
  const qrId = `qr-${worker.id}`;

  elements.badgePreview.className = "badge-shell";
  elements.badgePreview.innerHTML = `
    <article class="${badgeClass}">
      <div class="badge-top">
        <div>
          <p class="eyebrow">${escapeHtml(state.settings.platformName)}</p>
          <h3>${escapeHtml(badgeTitle)}</h3>
          <p>${escapeHtml(company?.name || "Unbekannte Firma")}</p>
        </div>
        <span class="badge-chip">${escapeHtml(worker.status)}</span>
      </div>

      <div class="badge-body">
        <div class="badge-copy">
          <img class="badge-photo${!worker.photoData ? ' badge-photo-placeholder' : ''}" src="${worker.photoData || createAvatar(worker)}" alt="${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}" style="${!worker.photoData ? 'cursor:pointer;outline:2px dashed #b07d00;' : ''}" />
          <p><strong>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</strong></p>
          <p>${escapeHtml(visitor ? "Besucher" : worker.role)}</p>
          ${subcompanyLabel ? `<p>Subunternehmen: ${escapeHtml(subcompanyLabel)}</p>` : ""}
          ${visitor ? `<p>Besucherfirma: ${escapeHtml(worker.visitorCompany || "-")}</p><p>Zweck: ${escapeHtml(worker.visitPurpose || "-")}</p><p>Ansprechpartner: ${escapeHtml(worker.hostName || "-")}</p><p>Besuchsende: ${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</p>` : ""}
          <p>Tarif: ${escapeHtml(planLabel)}</p>
          <p>Baustelle: ${escapeHtml(worker.site)}</p>
          <p>Gueltig bis: ${formatDate(worker.validUntil)}</p>
        </div>
        <div class="qr-block">
          <img id="${qrId}" alt="Mitarbeiter-App QR fuer ${escapeHtml(worker.badgeId)}" style="width:100%; border-radius:12px;" />
          <p class="helper-text" style="margin-top:10px; text-align:center;">QR scannen, App installieren und Ausweis direkt oeffnen.</p>
        </div>
      </div>

      <div class="badge-footer">
        <p>Badge-ID: ${escapeHtml(worker.badgeId)}</p>
        <p>${escapeHtml(state.settings.operatorName)}</p>
      </div>
    </article>
  `;

  // Make badge photo placeholder clickable if no photo is present
  setTimeout(() => {
    const badgePhoto = elements.badgePreview.querySelector('.badge-photo-placeholder');
    if (badgePhoto) {
      badgePhoto.title = 'Foto aufnehmen oder hochladen';
      badgePhoto.addEventListener('click', () => {
        // Switch to workers view and open editor for this exact worker.
        setView('workers');
        state.editingWorkerId = worker.id;
        if (elements.companySelect) elements.companySelect.value = worker.companyId;
        populateSubcompanySelects();
        document.querySelector("#subcompanySelect").value = worker.subcompanyId || "";
        document.querySelector("#firstName").value = worker.firstName || "";
        document.querySelector("#lastName").value = worker.lastName || "";
        document.querySelector("#insuranceNumber").value = worker.insuranceNumber || "";
        document.querySelector("#role").value = worker.role || "";
        document.querySelector("#site").value = worker.site || "";
        document.querySelector("#physicalCardId").value = worker.physicalCardId || "";
        document.querySelector("#validUntil").value = worker.validUntil || "";
        document.querySelector("#workerStatus").value = worker.status || "aktiv";
        document.querySelector("#badgePin").value = "";
        syncWorkerEditorUi();
        setTimeout(() => {
          if (typeof setPhotoEditorSource === 'function') {
            setPhotoEditorSource(worker.photoData || "", { resetOffset: true });
          }
          // Optionally, scroll to the camera/photo section
          const cameraBlock = document.querySelector('.camera-block');
          if (cameraBlock) cameraBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      });
    }
  }, 0);

  elements.badgeMeta.className = "badge-meta";
  elements.badgeMeta.innerHTML = `
    <div class="meta-box">
      <p>Badge-ID</p>
      <code>${escapeHtml(worker.badgeId)}</code>
    </div>
    <div class="meta-box">
      <p>QR-Funktion</p>
      <code>Mitarbeiter-App Installation</code>
    </div>
    <div class="meta-box">
      <p>Rolle im System</p>
      <p>${escapeHtml(getRoleLabel(getCurrentUser()?.role || "unbekannt"))}</p>
    </div>
  `;

  renderWorkerBadgeAppQr(worker.id, qrId, worker.badgeId);
}

async function renderWorkerBadgeAppQr(workerId, qrId, fallbackBadgeId) {
  try {
    const payload = await apiRequest(`${API_BASE}/api/workers/${workerId}/app-access`);
    const appLink = normalizeWorkerAppLink(payload?.link || "");
    if (!appLink) {
      throw new Error("missing_app_link");
    }
    const stillSelected = state.selectedWorkerId === workerId;
    if (!stillSelected) {
      return;
    }
    renderRealQr(qrId, appLink);
  } catch {
    const installFallback = normalizeWorkerAppLink(`${window.location.origin}/worker.html`);
    renderRealQr(qrId, installFallback || fallbackBadgeId);
  }
}

function ensureQrLibrary() {
  return Promise.resolve(false);
}

async function renderRealQr(elementId, payload) {
  const target = document.getElementById(elementId);
  if (!target) {
    return;
  }

  await ensureQrLibrary();
  try {
    const qrUrl = `${API_BASE}/api/qr.png?size=280&data=${encodeURIComponent(payload)}`;
    target.src = qrUrl;
    target.alt = "QR Code";
  } catch {
    target.alt = "QR Code konnte nicht erzeugt werden";
  }
}

function renderRecentAccess() {
  const recent = [...state.accessLogs].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 5);

  if (!recent.length) {
    elements.recentAccessList.innerHTML = '<div class="empty-state">Noch keine Zutrittsbuchungen vorhanden.</div>';
    return;
  }

  elements.recentAccessList.innerHTML = recent
    .map((entry, index) => renderAccessItem(entry, { featured: index === 0 }))
    .join("");

  // Klick-Handler für Einträge
  elements.recentAccessList.querySelectorAll(".recent-access-item").forEach((item) => {
    item.addEventListener("click", () => {
      const worker = state.workers.find((entry) => String(entry.id) === String(item.dataset.workerId));
      if (worker) renderDashboardWorkerDetail(worker);
    });
  });
}

function renderDashboardPorterLivePanel() {
  const panel = elements.dashboardPorterLivePanel;
  if (!panel) {
    return;
  }

  const latest = [...state.accessLogs].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] || null;
  if (!latest) {
    panel.className = "porter-live-card empty-state";
    panel.innerHTML = "Letzter Zutritt wird angezeigt, sobald eine An- oder Abmeldung vorliegt.";
    return;
  }

  const worker = state.workers.find((entry) => entry.id === latest.workerId) || null;
  const company = worker ? state.companies.find((entry) => entry.id === worker.companyId) : null;
  const subcompanyLabel = getSubcompanyLabel(worker);
  const directionLabel = latest.direction === "check-in" ? "Anmeldung" : "Abmeldung";
  const photoSrc = worker ? (worker.photoData || createAvatar(worker)) : createAvatar({ firstName: "?", lastName: "?" });
  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : "Unbekannt";
  const eventClass = latest.direction === "check-in" ? "porter-event" : "porter-event muted";

  panel.className = "porter-live-card";
  panel.innerHTML = `
    <div class="porter-live-topline">
      <strong>Letzter Zutritt</strong>
      <span>${escapeHtml(formatTimestamp(latest.timestamp))}</span>
    </div>
    <div class="porter-head">
      <img class="porter-photo" src="${photoSrc}" alt="${escapeHtml(workerName)}" />
      <div>
        <strong>${escapeHtml(workerName)}</strong>
        <span>${escapeHtml(company?.name || "Unbekannte Firma")}</span>
        ${subcompanyLabel ? `<span>${escapeHtml(subcompanyLabel)}</span>` : ""}
        <span>${escapeHtml(latest.gate || "Unbekanntes Drehkreuz")}</span>
      </div>
    </div>
    <div class="${eventClass}">${escapeHtml(directionLabel)}${latest.note ? ` | ${escapeHtml(latest.note)}` : ""}</div>
  `;
}

// Zeige Mitarbeiterdetails direkt im Dashboard-Bereich
function renderDashboardWorkerDetail(worker) {
  // Overlay und Detail-Elemente holen
  const overlay = document.getElementById("dashboardDetailOverlay");
  const detail = document.getElementById("dashboardWorkerDetail");
  if (!overlay || !detail) return;
  const company = state.companies.find((entry) => entry.id === worker.companyId);
  const subcompanyLabel = getSubcompanyLabel(worker);
  detail.innerHTML = `
    <button class="close-btn" title="Schließen">&times;</button>
    <div class="worker-detail-card">
      <img src="${worker.photoData || createAvatar(worker)}" alt="Mitarbeiterfoto" />
      <h2>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</h2>
      <p><strong>Firma:</strong> ${escapeHtml(company?.name || "-")}</p>
      ${subcompanyLabel ? `<p><strong>Subunternehmen:</strong> ${escapeHtml(subcompanyLabel)}</p>` : ""}
      <p><strong>Badge-ID:</strong> ${escapeHtml(worker.badgeId)}</p>
      <p><strong>Rentenversicherung:</strong> ${escapeHtml(worker.insuranceNumber)}</p>
      <p><strong>Funktion:</strong> ${escapeHtml(worker.role)}</p>
      <p><strong>Baustelle:</strong> ${escapeHtml(worker.site)}</p>
      <p><strong>Gültig bis:</strong> ${formatDate(worker.validUntil)}</p>
      <p><strong>Status:</strong> ${escapeHtml(worker.status)}</p>
      <p><strong>Badge-PIN:</strong> ${worker.badgePinConfigured ? "gesetzt" : "nicht gesetzt"}</p>
      <p><strong>Karten-ID:</strong> ${escapeHtml(worker.physicalCardId || "nicht zugewiesen")}</p>
      <div class="button-row">
        <button type="button" class="primary-button" onclick="triggerWorkerAccess(state.workers.find(w=>w.id==='${worker.id}'),'check-in')">Anmelden (Check-in)</button>
        <button type="button" class="ghost-button" onclick="triggerWorkerAccess(state.workers.find(w=>w.id==='${worker.id}'),'check-out')">Abmelden (Check-out)</button>
      </div>
    </div>
  `;
  overlay.classList.remove("hidden");
  detail.querySelector(".close-btn").onclick = () => overlay.classList.add("hidden");
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add("hidden"); };
}

function renderAccessLog() {
  document.querySelector("#accessFrom").value = state.accessFilter.from;
  document.querySelector("#accessTo").value = state.accessFilter.to;
  document.querySelector("#accessFilterDirection").value = state.accessFilter.direction;
  document.querySelector("#accessFilterGate").value = state.accessFilter.gate;

  const entries = [...state.accessLogs].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  if (!entries.length) {
    elements.accessLogList.innerHTML = '<div class="empty-state">Keine Zutrittsbuchungen fuer den gewaelten Filter.</div>';
    return;
  }

  elements.accessLogList.innerHTML = entries.map(renderAccessItem).join("");
}

function renderAccessSummary() {
  const entries = [...state.accessLogs];
  if (!entries.length) {
    elements.accessSummaryGrid.innerHTML = '<div class="empty-state">Noch keine Daten fuer den Tagesbericht.</div>';
    return;
  }

  const grouped = new Map();
  entries.forEach((entry) => {
    const gateKey = (entry.gate || "Unbekanntes Drehkreuz").trim() || "Unbekanntes Drehkreuz";
    const current = grouped.get(gateKey) || {
      gate: gateKey,
      total: 0,
      checkIn: 0,
      checkOut: 0,
      latest: "",
      visitors: []
    };

    const worker = state.workers.find((item) => item.id === entry.workerId);
    const visitorName = worker ? `${worker.firstName} ${worker.lastName}` : `Mitarbeiter ${entry.workerId}`;
    const visitorMeta = worker && isVisitorWorker(worker)
      ? `${worker.visitorCompany || "Besucherfirma"} | ${worker.visitPurpose || "Besuch"}`
      : "";

    current.total += 1;
    if (entry.direction === "check-in") {
      current.checkIn += 1;
    }
    if (entry.direction === "check-out") {
      current.checkOut += 1;
    }
    if (!current.latest || entry.timestamp > current.latest) {
      current.latest = entry.timestamp;
    }
    const visitorLabel = visitorMeta ? `${visitorName} (${visitorMeta})` : visitorName;
    if (!current.visitors.includes(visitorLabel)) {
      current.visitors.push(visitorLabel);
    }

    grouped.set(gateKey, current);
  });

  const cards = Array.from(grouped.values()).sort((a, b) => a.gate.localeCompare(b.gate));
  elements.accessSummaryGrid.innerHTML = cards
    .map(
      (item) => `
        <article class="summary-card">
          <strong>${escapeHtml(item.gate)}</strong>
          <span>Eintritte: ${item.checkIn}</span>
          <span>Austritte: ${item.checkOut}</span>
          <span>Gesamt: ${item.total}</span>
          <span>Letzte Buchung: ${formatTimestamp(item.latest)}</span>
          <div class="summary-visitor-block">
            <span class="summary-visitor-title">Besucher / Mitarbeiter:</span>
            <div class="summary-visitor-list">${item.visitors.map((name) => `<span class="summary-visitor-pill">${escapeHtml(name)}</span>`).join("")}</div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAccessHourly() {
  const rows = state.accessInsights.hourly || [];
  if (!rows.length) {
    elements.accessHourlyGrid.innerHTML = '<div class="empty-state">Keine Stundenwerte verfuegbar.</div>';
    return;
  }

  elements.accessHourlyGrid.innerHTML = rows
    .map(
      (row) => `
        <article class="hour-row">
          <strong>${escapeHtml(row.hour)}</strong>
          <span>In: ${Number(row.checkIn) || 0}</span>
          <span>Out: ${Number(row.checkOut) || 0}</span>
        </article>
      `
    )
    .join("");
}

function renderAccessWarnings() {
  const warnings = state.accessInsights.openEntries || [];
  if (!warnings.length) {
    elements.accessOpenWarnings.innerHTML = '<div class="empty-state">Keine offenen Eintritte gefunden.</div>';
    return;
  }

  elements.accessOpenWarnings.innerHTML = warnings
    .slice(0, 40)
    .map(
      (entry) => `
        <article class="list-item warning-item severity-${escapeHtml(getSeverity(entry))}">
          <header>
            <div>
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${escapeHtml(entry.badgeId)}</span>
            </div>
            <span class="status-pill status-check-in">${escapeHtml(getSeverityLabel(getSeverity(entry)))}</span>
          </header>
          <span>Drehkreuz: ${escapeHtml(entry.gate || "Unbekannt")}</span>
          <span>Letzter Eintritt: ${formatTimestamp(entry.timestamp)}</span>
          <span>Offen seit: ${escapeHtml(formatDurationMinutes(getOpenMinutes(entry)))}</span>
        </article>
      `
    )
    .join("");
}

function renderDayCloseBanner() {
  const due = state.dayClose?.due;
  const count = state.dayClose?.openCount || 0;
  const autoClosedCount = state.dayClose?.autoClosedCount || 0;
  const autoClosedEntries = state.dayClose?.autoClosedEntries || [];
  const acknowledgement = state.dayClose?.acknowledgement || null;
  const canAcknowledge = ["superadmin", "company-admin"].includes(getCurrentUser()?.role);

  if (!due) {
    elements.dayCloseBanner.classList.add("hidden");
    elements.dayCloseBanner.textContent = "";
    elements.dayCloseAcknowledgeForm.classList.add("hidden");
    return;
  }

  elements.dayCloseBanner.classList.remove("hidden");
  const isWarning = count > 0 && !acknowledgement;
  const isOk = count === 0 || Boolean(acknowledgement);
  elements.dayCloseBanner.classList.toggle("is-warning", isWarning);
  elements.dayCloseBanner.classList.toggle("is-ok", isOk);

  const autoClosedMarkup = autoClosedCount > 0
    ? `
      <div class="summary-visitor-block">
        <span class="summary-visitor-title">Nach 00:00 automatisch abgemeldet:</span>
        <div class="summary-visitor-list">${autoClosedEntries.map((entry) => `<span class="summary-visitor-pill">${escapeHtml(entry.name)}</span>`).join("")}</div>
      </div>
    `
    : "";

  if (acknowledgement) {
    const when = formatTimestamp(acknowledgement.createdAt);
    elements.dayCloseBanner.innerHTML = `<strong>Tagesabschluss bereits quittiert</strong><span>Von ${escapeHtml(acknowledgement.acknowledgedBy)} am ${escapeHtml(when)}</span><span>Kommentar: ${escapeHtml(acknowledgement.comment)}</span>${autoClosedMarkup}`;
  } else if (count > 0) {
    elements.dayCloseBanner.innerHTML = `<strong>Tagesabschluss-Pruefung aktiv</strong><span>${count} offene Eintritte ohne Austritt.</span>${autoClosedMarkup}`;
  } else {
    elements.dayCloseBanner.innerHTML = `<strong>Tagesabschluss-Pruefung aktiv</strong><span>Keine offenen Eintritte.</span>${autoClosedMarkup}`;
  }

  const showForm = canAcknowledge && count > 0 && !acknowledgement;
  elements.dayCloseAcknowledgeForm.classList.toggle("hidden", !showForm);
  if (!showForm) {
    elements.dayCloseComment.value = "";
  }
}

function triggerAutoDayCloseAlert() {
  const due = state.dayClose?.due;
  const count = state.dayClose?.openCount || 0;
  const acknowledgement = state.dayClose?.acknowledgement || null;
  const date = state.dayClose?.date || new Date().toISOString().slice(0, 10);
  if (!due || count <= 0 || acknowledgement) {
    return;
  }

  const companyScope = getCurrentUser()?.companyId || "system";
  const key = `baupass-day-close-alert-${companyScope}-${date}`;
  if (localStorage.getItem(key) === "1") {
    return;
  }

  localStorage.setItem(key, "1");
  window.alert(`Tagesabschluss 18:00: ${count} offene Eintritte ohne Austritt gefunden.`);
}

async function handleDayCloseAcknowledge(event) {
  event.preventDefault();
  const comment = elements.dayCloseComment.value.trim();
  if (comment.length < 4) {
    window.alert("Bitte einen aussagekräftigen Kommentar mit mindestens 4 Zeichen eingeben.");
    return;
  }

  elements.dayCloseAcknowledgeButton.disabled = true;
  try {
    await apiRequest(API_BASE + "/api/access-logs/day-close-ack", {
      method: "POST",
      body: {
        date: state.dayClose?.date || new Date().toISOString().slice(0, 10),
        comment
      }
    });
    elements.dayCloseComment.value = "";
    await loadAllData();
    refreshAll();
    window.alert("Tagesabschluss wurde erfolgreich quittiert.");
  } catch (error) {
    window.alert(`Tagesabschluss konnte nicht quittiert werden: ${error.message}`);
  } finally {
    elements.dayCloseAcknowledgeButton.disabled = false;
  }
}

function getOpenMinutes(entry) {
  if (typeof entry.openMinutes === "number") {
    return entry.openMinutes;
  }
  const at = new Date(entry.timestamp).getTime();
  if (!Number.isFinite(at)) {
    return 0;
  }
  return Math.max(Math.floor((Date.now() - at) / 60000), 0);
}

function getSeverity(entry) {
  if (entry.severity) {
    return entry.severity;
  }
  const minutes = getOpenMinutes(entry);
  if (minutes >= 240) {
    return "red";
  }
  if (minutes >= 120) {
    return "yellow";
  }
  return "green";
}

function getSeverityLabel(severity) {
  if (severity === "red") {
    return "Kritisch";
  }
  if (severity === "yellow") {
    return "Warnung";
  }
  return "OK";
}

function formatDurationMinutes(minutes) {
  const safeMinutes = Math.max(Number(minutes) || 0, 0);
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

function renderAccessItem(log, options = {}) {
  const { featured = false } = options;
  const worker = state.workers.find((entry) => entry.id === log.workerId);
  const subcompanyLabel = getSubcompanyLabel(worker);
  const photoSrc = worker ? (worker.photoData || createAvatar(worker)) : createAvatar({ firstName: "?", lastName: "?" });
  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : "Unbekannt";
  const itemClass = featured ? "list-item recent-access-item clickable access-entry-featured" : "list-item recent-access-item clickable";
  return `
    <article class="${itemClass}" data-worker-id="${worker ? worker.id : ''}">
      <div class="access-entry-layout">
        <img class="access-entry-photo" src="${photoSrc}" alt="${escapeHtml(workerName)}" />
        <div class="access-entry-copy">
          <header>
            <div>
              <strong>${escapeHtml(workerName)}</strong>
              <span>${escapeHtml(log.gate)}${subcompanyLabel ? ` | ${escapeHtml(subcompanyLabel)}` : ""}</span>
            </div>
            <span class="status-pill status-${escapeHtml(log.direction)}">${escapeHtml(log.direction)}</span>
          </header>
          <span>${formatTimestamp(log.timestamp)}</span>
          <span>${escapeHtml(log.note || "Keine Notiz")}</span>
        </div>
      </div>
    </article>
  `;
}

function renderTurnstileQuickPanel() {
  if (getCurrentUser()?.role !== "turnstile") {
    elements.turnstileQuickPanel.innerHTML = "";
    return;
  }

  elements.turnstileQuickPanel.innerHTML = `
    <div class="quick-panel-card">
      <strong>Drehkreuz-Schnellmodus</strong>
      <p class="helper-text">Mitarbeiter waehlen und sofort Check-in oder Check-out buchen.</p>
      <div class="button-row">
        <button type="button" class="ghost-button" data-quick-direction="check-in">Schnell Check-in</button>
        <button type="button" class="ghost-button" data-quick-direction="check-out">Schnell Check-out</button>
      </div>
    </div>
  `;

  elements.turnstileQuickPanel.querySelectorAll("[data-quick-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const workerId = elements.accessWorkerSelect.value;
      if (!workerId) {
        window.alert("Bitte zuerst einen Mitarbeiter auswählen.");
        return;
      }
      bookAccess(workerId, button.dataset.quickDirection, "Drehkreuz Schnellmodus", "Terminalbuchung");
    });
  });
}

async function handleWorkerSubmit(event) {
  event.preventDefault();
  if (!userCanManageWorkers()) {
    return;
  }

  const firstName = document.querySelector("#firstName").value.trim();
  const lastName = document.querySelector("#lastName").value.trim();

  const photoDataValue = document.querySelector("#photoData").value;
  if (!photoDataValue) {
    window.alert("Bitte zuerst ein Foto aufnehmen. Der Ausweis wird nur mit Foto gespeichert.");
    setView("workers");
    const cameraBlock = document.querySelector(".camera-block");
    if (cameraBlock) {
      cameraBlock.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }
  const payload = {
    companyId: document.querySelector("#companySelect").value,
    subcompanyId: document.querySelector("#subcompanySelect").value || null,
    workerType: elements.workerType?.value || "worker",
    firstName,
    lastName,
    insuranceNumber: document.querySelector("#insuranceNumber").value.trim(),
    role: document.querySelector("#role").value.trim(),
    site: document.querySelector("#site").value.trim(),
    physicalCardId: document.querySelector("#physicalCardId").value.trim(),
    validUntil: document.querySelector("#validUntil").value,
    visitorCompany: elements.visitorCompany?.value.trim() || "",
    visitPurpose: elements.visitPurpose?.value.trim() || "",
    hostName: elements.hostName?.value.trim() || "",
    visitEndAt: elements.visitEndAt?.value || "",
    status: document.querySelector("#workerStatus").value,
    photoData: photoDataValue,
    badgeId: buildBadgeId(firstName, lastName, elements.workerType?.value || "worker"),
    badgePin: document.querySelector("#badgePin").value.trim()
  };

  try {
    let targetWorkerId = state.editingWorkerId || null;
    if (state.editingWorkerId) {
      await apiRequest(API_BASE + `/api/workers/${state.editingWorkerId}`, { method: "PUT", body: payload });
    } else {
      const createdWorker = await apiRequest(API_BASE + "/api/workers", { method: "POST", body: payload });
      targetWorkerId = createdWorker?.id || null;
    }
    clearWorkerEditor();
    stopCamera();
    await loadAllData();
    if (targetWorkerId && state.workers.some((worker) => worker.id === targetWorkerId)) {
      state.selectedWorkerId = targetWorkerId;
    }
    refreshAll();
    setView("badge");
  } catch (error) {
    if (error.message === "invalid_badge_pin") {
      window.alert("Badge-PIN muss aus 4 bis 8 Ziffern bestehen.");
      return;
    }
    if (error.message === "badge_pin_required") {
      window.alert("Bitte eine Badge-PIN für den Mitarbeiter setzen.");
      return;
    }
    if (error.message === "duplicate_physical_card_id") {
      window.alert("Diese physische Karten-ID ist bereits einem anderen Mitarbeiter zugeordnet.");
      return;
    }
    if (error.message === "visit_purpose_required") {
      window.alert("Bitte einen Besuchszweck angeben.");
      return;
    }
    if (error.message === "visitor_company_required") {
      window.alert("Bitte die Besucherfirma angeben.");
      return;
    }
    if (error.message === "host_name_required") {
      window.alert("Bitte einen Ansprechpartner vor Ort angeben.");
      return;
    }
    if (error.message === "visit_end_required") {
      window.alert("Bitte ein Besuchsende mit Datum und Uhrzeit angeben.");
      return;
    }
    window.alert(`Mitarbeiter konnte nicht gespeichert werden: ${error.message}`);
  }
}

async function handleAccessSubmit(event) {
  event.preventDefault();
  await bookAccess(
    document.querySelector("#accessWorkerSelect").value,
    document.querySelector("#accessDirection").value,
    document.querySelector("#accessGate").value.trim(),
    document.querySelector("#accessNote").value.trim()
  );
}

async function bookAccess(workerId, direction, gate, note) {
  if (!workerId) {
    return;
  }

  // Prevent multiple consecutive check-ins or check-outs
  const lastEvent = [...state.accessLogs]
    .filter((log) => log.workerId === workerId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  if (lastEvent && lastEvent.direction === direction) {
    window.alert(
      direction === "check-in"
        ? "Der Mitarbeiter ist bereits eingetreten. Erst Austritt buchen, dann wieder Eintritt."
        : "Der Mitarbeiter ist bereits ausgetreten. Erst Eintritt buchen, dann wieder Austritt."
    );
    return;
  }

  try {
    const createdLog = await apiRequest(API_BASE + "/api/access-logs", {
      method: "POST",
      body: {
        workerId,
        direction,
        gate,
        note,
        timestamp: new Date().toISOString()
      }
    });
    state.porterLive.workerId = workerId;
    state.porterLive.lastEvent = normalizeLog(createdLog);
    showAccessFeedback(workerId, direction, gate, createdLog.timestamp);
    await loadAllData();
    refreshAll();
  } catch (error) {
    window.alert(`Zutritt konnte nicht gebucht werden: ${error.message}`);
  }
}

function showAccessFeedback(workerId, direction, gate, timestamp) {
  const worker = state.workers.find((entry) => entry.id === workerId);
  const company = worker ? state.companies.find((entry) => entry.id === worker.companyId) : null;
  const subcompanyLabel = getSubcompanyLabel(worker);
  const title = direction === "check-in" ? "EINTRITT ERFASST" : "AUSTRITT ERFASST";
  const dirLabel = direction === "check-in" ? "Anmeldung" : "Abmeldung";
  const who = worker ? `${worker.firstName} ${worker.lastName}` : "Mitarbeiter";
  const companyLabel = company?.name || "Unbekannte Firma";
  const subLabel = subcompanyLabel ? ` | ${subcompanyLabel}` : "";
  const when = formatTimestamp(timestamp || new Date().toISOString());

  elements.accessFeedbackTitle.textContent = title;
  elements.accessFeedbackMeta.textContent = `${who} | ${companyLabel}${subLabel} | ${dirLabel} | ${gate} | ${when}`;
  elements.accessFeedbackPhoto.src = worker ? (worker.photoData || createAvatar(worker)) : createAvatar({ firstName: "?", lastName: "?" });
  elements.accessFeedbackPhoto.alt = worker ? `${worker.firstName} ${worker.lastName}` : "Mitarbeiterfoto";
  elements.accessFeedbackOverlay.classList.remove("hidden", "feedback-in", "feedback-out");
  elements.accessFeedbackOverlay.classList.add(direction === "check-in" ? "feedback-in" : "feedback-out");

  // Zeige auch den Baustellen-Ausweis mit Foto
  if (worker) {
    state.selectedWorkerId = worker.id;
    renderBadge();
    // Schalte zur Badge-Ansicht um
    const badgeTab = document.querySelector('a[href="#badge"]') || document.querySelector('[data-view="badge"]');
    if (badgeTab) badgeTab.click();
  }

  playAccessTone(direction);

  if (accessFeedbackTimer) {
    window.clearTimeout(accessFeedbackTimer);
  }
  accessFeedbackTimer = window.setTimeout(() => {
    elements.accessFeedbackOverlay.classList.add("hidden");
    elements.accessFeedbackOverlay.classList.remove("feedback-in", "feedback-out");
  }, 3500);
}

function playAccessTone(direction) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    if (!accessAudioContext) {
      accessAudioContext = new AudioCtx();
    }

    const baseTime = accessAudioContext.currentTime;
    const sequence = direction === "check-in" ? [660, 880] : [440, 330];
    sequence.forEach((freq, index) => {
      const osc = accessAudioContext.createOscillator();
      const gain = accessAudioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, baseTime + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, baseTime + index * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + index * 0.12 + 0.1);
      osc.connect(gain);
      gain.connect(accessAudioContext.destination);
      osc.start(baseTime + index * 0.12);
      osc.stop(baseTime + index * 0.12 + 0.11);
    });
  } catch {
    // ignore audio errors
  }
}

async function handleAccessFilterSubmit(event) {
  event.preventDefault();
  state.accessFilter.from = document.querySelector("#accessFrom").value;
  state.accessFilter.to = document.querySelector("#accessTo").value;
  state.accessFilter.direction = document.querySelector("#accessFilterDirection").value;
  state.accessFilter.gate = document.querySelector("#accessFilterGate").value.trim();
  await loadAllData();
  refreshAll();
}

async function resetAccessFilter() {
  state.accessFilter = { from: "", to: "", direction: "", gate: "" };
  await loadAllData();
  refreshAll();
}

async function exportAccessCsv() {
  try {
    const query = new URLSearchParams();
    if (state.accessFilter.from) {
      query.set("from", state.accessFilter.from);
    }
    if (state.accessFilter.to) {
      query.set("to", state.accessFilter.to);
    }
    if (state.accessFilter.direction) {
      query.set("direction", state.accessFilter.direction);
    }
    if (state.accessFilter.gate) {
      query.set("gate", state.accessFilter.gate);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";

    const response = await fetch(`${API_BASE}/api/access-logs/export.csv${suffix}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API Fehler ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zutrittsjournal-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(`Zutritts-CSV Export fehlgeschlagen: ${error.message}`);
  }
}

async function exportWorkersPdf() {
  try {
    const includeDeleted = window.confirm("Gelöschte Mitarbeiter ebenfalls exportieren?");
    const query = new URLSearchParams();
    if (includeDeleted) {
      query.set("includeDeleted", "1");
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";

    const response = await fetch(`${API_BASE}/api/workers/export.pdf${suffix}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API Fehler ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mitarbeiterliste-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(`Mitarbeiterlisten-Export (PDF) fehlgeschlagen: ${error.message}`);
  }
}

function printDailyReport() {
  const now = new Date();
  const fromLabel = state.accessFilter.from || now.toISOString().slice(0, 10);
  const toLabel = state.accessFilter.to || fromLabel;
  const role = getRoleLabel(getCurrentUser()?.role || "unbekannt");
  const summaryItems = Array.from(document.querySelectorAll("#accessSummaryGrid .summary-card")).map((card) => card.outerHTML).join("");
  const warningItems = Array.from(document.querySelectorAll("#accessOpenWarnings .warning-item")).map((card) => card.outerHTML).join("");
  const visitorRows = getVisitorReportRows(fromLabel, toLabel)
    .map((entry) => `<tr><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(entry.visitorCompany || "-")}</td><td>${escapeHtml(entry.purpose || "-")}</td><td>${escapeHtml(entry.hostName || "-")}</td><td>${escapeHtml(entry.site || "-")}</td><td>${escapeHtml(entry.lastSeen || "-")}</td></tr>`)
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8" />
      <title>Zutrittsreport</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
        h1, h2 { margin: 0 0 10px; }
        .muted { color: #555; margin-bottom: 18px; }
        .grid { display: grid; gap: 10px; }
        .summary-card, .warning-item { border: 1px solid #ddd; border-radius: 10px; padding: 10px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #f3f6f8; }
        .summary-visitor-block { margin-top: 8px; }
        .summary-visitor-title { display: block; font-weight: 700; color: #333; margin-bottom: 6px; }
        .summary-visitor-list { display: flex; gap: 6px; flex-wrap: wrap; }
        .summary-visitor-pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2f6; color: #334; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>Zutrittsreport</h1>
      <p class="muted">Zeitraum: ${fromLabel} bis ${toLabel} | Rolle: ${escapeHtml(role)}</p>
      <h2>Drehkreuz-Uebersicht</h2>
      <div class="grid">${summaryItems || "<p>Keine Daten.</p>"}</div>
      <h2>Offene Eintritte</h2>
      <div class="grid">${warningItems || "<p>Keine offenen Eintritte.</p>"}</div>
      <h2>Besucher im Zeitraum</h2>
      ${visitorRows ? `<table><thead><tr><th>Name</th><th>Firma</th><th>Zweck</th><th>Ansprechpartner</th><th>Baustelle</th><th>Letzte Aktivität</th></tr></thead><tbody>${visitorRows}</tbody></table>` : "<p>Keine Besucher im Zeitraum.</p>"}
    </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank", "width=960,height=800");
  if (!reportWindow) {
    window.alert("Popup blockiert. Bitte Popups erlauben.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function getVisitorReportRows(fromDate, toDate) {
  const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Date.now() - (7 * 24 * 60 * 60 * 1000);
  const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Date.now();
  return state.workers
    .filter((worker) => !worker.deletedAt && isVisitorWorker(worker))
    .map((worker) => {
      const lastLog = [...state.accessLogs]
        .filter((log) => log.workerId === worker.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const lastSeenTs = lastLog ? new Date(lastLog.timestamp).getTime() : 0;
      return {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        visitorCompany: worker.visitorCompany || "",
        purpose: worker.visitPurpose || "",
        hostName: worker.hostName || "",
        site: worker.site || "",
        lastSeenTs,
        lastSeen: lastLog ? formatTimestamp(lastLog.timestamp) : (worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")
      };
    })
    .filter((entry) => entry.lastSeenTs === 0 || (entry.lastSeenTs >= fromTs && entry.lastSeenTs <= toTs))
    .sort((a, b) => b.lastSeenTs - a.lastSeenTs);
}

function printVisitorWeeklyReport() {
  const end = new Date();
  const start = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000));
  const rows = getVisitorReportRows(toDateInputValue(start), toDateInputValue(end));
  const htmlRows = rows.map((entry) => `<tr><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(entry.visitorCompany || "-")}</td><td>${escapeHtml(entry.purpose || "-")}</td><td>${escapeHtml(entry.hostName || "-")}</td><td>${escapeHtml(entry.site || "-")}</td><td>${escapeHtml(entry.lastSeen || "-")}</td></tr>`).join("");
  const reportWindow = window.open("", "_blank", "width=1100,height=800");
  if (!reportWindow) {
    window.alert("Popup blockiert. Bitte Popups erlauben.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8" /><title>Besucher-Wochenliste</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f3f6f8}h1{margin:0 0 8px}.muted{color:#555}</style></head><body><h1>Besucher-Wochenliste</h1><p class="muted">Zeitraum: ${escapeHtml(toDateInputValue(start))} bis ${escapeHtml(toDateInputValue(end))}</p>${htmlRows ? `<table><thead><tr><th>Name</th><th>Firma</th><th>Zweck</th><th>Ansprechpartner</th><th>Baustelle</th><th>Letzte Aktivität</th></tr></thead><tbody>${htmlRows}</tbody></table>` : "<p>Keine Besucher in dieser Woche.</p>"}</body></html>`);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  if (!userCanManageSystem()) {
    return;
  }

  try {
    const updated = await apiRequest(API_BASE + "/api/settings", {
      method: "PUT",
      body: {
        platformName: document.querySelector("#platformName").value.trim(),
        operatorName: document.querySelector("#operatorName").value.trim(),
        turnstileEndpoint: document.querySelector("#turnstileEndpoint").value.trim(),
        rentalModel: document.querySelector("#rentalModel").value,
        invoiceLogoData: elements.invoiceLogoData.value,
        invoicePrimaryColor: document.querySelector("#invoicePrimaryColor").value,
        invoiceAccentColor: document.querySelector("#invoiceAccentColor").value,
        smtpHost: document.querySelector("#smtpHost").value.trim(),
        smtpPort: Number(document.querySelector("#smtpPort").value || 587),
        smtpUsername: document.querySelector("#smtpUsername").value.trim(),
        smtpPassword: document.querySelector("#smtpPassword").value,
        smtpSenderEmail: document.querySelector("#smtpSenderEmail").value.trim(),
        smtpSenderName: document.querySelector("#smtpSenderName").value.trim(),
        smtpUseTls: document.querySelector("#smtpUseTls").value === "1",
        adminIpWhitelist: document.querySelector("#adminIpWhitelist").value.trim(),
        enforceTenantDomain: document.querySelector("#enforceTenantDomain").value === "1",
        workerAppEnabled: document.querySelector("#workerAppEnabled").value !== "0"
      }
    });
    state.settings = updated;
    refreshAll();
  } catch (error) {
    window.alert(`Einstellungen konnten nicht gespeichert werden: ${error.message}`);
  }
}

function renderSystemStatusPanel(statusPayload) {
  const panel = document.querySelector("#systemStatusPanel");
  if (!panel) return;

  if (!statusPayload) {
    panel.innerHTML = "<p>Status konnte nicht geladen werden.</p>";
    return;
  }

  const activeSessions = Number(statusPayload.activeSessions || 0);
  const activeWorkerSessions = Number(statusPayload.activeWorkerSessions || 0);
  const openEntries = Number(statusPayload.openEntries || 0);
  const loginLocks = Array.isArray(statusPayload.loginLocks) ? statusPayload.loginLocks.length : 0;
  const recentIssues = Array.isArray(statusPayload.recentIssues) ? statusPayload.recentIssues.length : 0;
  const serverTime = formatTimestamp(statusPayload.serverTime || new Date().toISOString());

  panel.innerHTML = `
    <p><strong>Serverzeit:</strong> ${escapeHtml(serverTime)}</p>
    <p><strong>Aktive Admin-Sitzungen:</strong> ${activeSessions}</p>
    <p><strong>Aktive Mitarbeiter-App-Sitzungen:</strong> ${activeWorkerSessions}</p>
    <p><strong>Offene Eintritte:</strong> ${openEntries}</p>
    <p><strong>Login-Sperren:</strong> ${loginLocks}</p>
    <p><strong>Letzte Probleme:</strong> ${recentIssues}</p>
  `;
}

async function refreshSystemStatus() {
  const panel = document.querySelector("#systemStatusPanel");
  if (panel) {
    panel.innerHTML = "<p>Status wird geladen...</p>";
  }

  try {
    const status = await apiRequest(`${API_BASE}/api/system/status`, { method: "GET" });
    renderSystemStatusPanel(status);
  } catch (error) {
    if (panel) {
      panel.innerHTML = `<p>Status konnte nicht geladen werden: ${escapeHtml(error.message)}</p>`;
    }
  }
}

async function handleSystemRepair() {
  if (!window.confirm("System-Reparatur ausfuehren? Abgelaufene Sitzungen und Login-Sperren werden bereinigt.")) {
    return;
  }

  try {
    await apiRequest(`${API_BASE}/api/system/repair`, { method: "POST", body: {} });
    await refreshSystemStatus();
    window.alert("System-Reparatur wurde ausgefuehrt.");
  } catch (error) {
    window.alert(`System-Reparatur fehlgeschlagen: ${error.message}`);
  }
}

async function handleInvoiceLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    window.alert("Bitte eine Bilddatei für das Logo auswählen.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = typeof reader.result === "string" ? reader.result : "";
    elements.invoiceLogoData.value = dataUrl;
    elements.invoiceLogoPreview.src = dataUrl;
    elements.invoiceLogoPreview.classList.toggle("hidden", !dataUrl);
    applyWebsiteLogo(dataUrl);
  };
  reader.readAsDataURL(file);
}

async function loadCustomBrandingPreset() {
  try {
    const response = await fetch(API_BASE + "/branding/baukometra-logo.svg");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const svg = await response.text();
    const logoDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    document.querySelector("#platformName").value = "BauKometra Control";
    document.querySelector("#operatorName").value = "BauKometra";
    document.querySelector("#invoicePrimaryColor").value = "#0f4c5c";
    document.querySelector("#invoiceAccentColor").value = "#e36414";

    elements.invoiceLogoData.value = logoDataUrl;
    elements.invoiceLogoPreview.src = logoDataUrl;
    elements.invoiceLogoPreview.classList.remove("hidden");
    applyWebsiteLogo(logoDataUrl);

    window.alert("BauKometra Branding geladen. Jetzt nur noch auf Admin-Einstellungen speichern klicken.");
  } catch (error) {
    window.alert(`Branding konnte nicht geladen werden: ${error.message}`);
  }
}

async function loadCustomBrandingPresetAlt() {
  try {
    const response = await fetch(API_BASE + "/branding/baukometra-alt-logo.svg");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const svg = await response.text();
    const logoDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    document.querySelector("#platformName").value = "BauKometra Control";
    document.querySelector("#operatorName").value = "BauKometra";
    document.querySelector("#invoicePrimaryColor").value = "#24324a";
    document.querySelector("#invoiceAccentColor").value = "#c65a2e";

    elements.invoiceLogoData.value = logoDataUrl;
    elements.invoiceLogoPreview.src = logoDataUrl;
    elements.invoiceLogoPreview.classList.remove("hidden");
    applyWebsiteLogo(logoDataUrl);

    window.alert("Alternative BauKometra Branding-Variante geladen. Jetzt nur noch auf Admin-Einstellungen speichern klicken.");
  } catch (error) {
    window.alert(`Alternative Branding-Variante konnte nicht geladen werden: ${error.message}`);
  }
}

async function handleInvoicePrint(event) {
  event.preventDefault();
  const invoice = buildInvoiceDraft({ silent: false });
  if (!invoice) {
    return;
  }
  const html = renderInvoiceHtml(invoice);

  const invoiceWindow = window.open("", "_blank", "width=980,height=860");
  if (!invoiceWindow) {
    window.alert("Popup blockiert. Bitte Popups erlauben.");
    return;
  }
  invoiceWindow.document.open();
  invoiceWindow.document.write(html);
  invoiceWindow.document.close();
  invoiceWindow.focus();
  invoiceWindow.print();
}

async function handleInvoiceSend() {
  const invoice = buildInvoiceDraft({ silent: false });
  if (!invoice) {
    return;
  }

  const html = renderInvoiceHtml(invoice);
  try {
    const payload = await apiRequest(API_BASE + "/api/invoices/send", {
      method: "POST",
      body: {
        companyId: invoice.company.id,
        recipientEmail: invoice.recipientEmail,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        invoicePeriod: invoice.invoicePeriod,
        description: invoice.invoiceDescription,
        netAmount: invoice.netAmount,
        vatRate: invoice.vatRate,
        renderedHtml: html
      }
    });

    await loadAllData();
    refreshAll();
    if (payload.sent) {
      window.alert("Rechnung wurde per E-Mail versendet.");
    } else {
      const errorText = String(payload.error || "");
      if (errorText.toLowerCase().includes("smtp ist nicht konfiguriert")) {
        window.alert("Rechnung wurde gespeichert, aber E-Mail ist nicht eingerichtet. Bitte SMTP im Superadmin-Bereich unter Admin-Einstellungen konfigurieren.");
      } else {
        window.alert(`Rechnung gespeichert, Versand fehlgeschlagen: ${payload.error}`);
      }
    }
  } catch (error) {
    if (String(error.message || "") === "duplicate_invoice_number") {
      window.alert(`Rechnungsnummer ${invoice.invoiceNumber} ist bereits vergeben. Bitte eine andere Nummer verwenden.`);
      return;
    }
    window.alert(`Rechnung konnte nicht versendet werden: ${error.message}`);
  }
}

function buildInvoiceDraft(options = {}) {
  const { silent = false } = options;
  const companyId = document.querySelector("#invoiceCompanySelect").value;
  const company = state.companies.find((entry) => entry.id === companyId);
  if (!company) {
    if (!silent) {
      window.alert("Bitte eine Firma auswählen.");
    }
    return null;
  }

  const recipientEmail = elements.invoiceRecipientEmail.value.trim();
  if (!recipientEmail.includes("@")) {
    if (!silent) {
      window.alert("Bitte eine gültige Empfänger-E-Mail eingeben.");
    }
    return null;
  }

  const invoiceDate = document.querySelector("#invoiceDate").value;
  const invoiceDueDate = document.querySelector("#invoiceDueDate")?.value || "";
  const invoicePeriod = document.querySelector("#invoicePeriod").value.trim();
  const invoiceDescription = document.querySelector("#invoiceDescription").value.trim();
  const requestedNetAmount = Number(document.querySelector("#invoiceNetAmount").value || "0");
  const invoiceNumberRaw = document.querySelector("#invoiceNumber").value.trim();
  const invoiceNumber = invoiceNumberRaw || `RE-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const duplicateInvoice = (state.invoices || []).some((entry) => {
    const sameCompany = String(entry.company_id || entry.companyId || "") === String(company.id || "");
    const sameNumber = String(entry.invoice_number || entry.invoiceNumber || "").trim().toLowerCase() === invoiceNumber.trim().toLowerCase();
    return sameCompany && sameNumber;
  });
  if (duplicateInvoice) {
    if (!silent) {
      window.alert(`Rechnungsnummer ${invoiceNumber} ist bereits vergeben. Bitte eine andere Nummer verwenden.`);
    }
    return null;
  }

  if (!invoiceDate || !invoiceDueDate || !invoicePeriod || !invoiceDescription) {
    if (!silent) {
      window.alert("Bitte Rechnungsdatum, Fälligkeitsdatum, Leistungszeitraum und Leistungsbeschreibung ausfüllen.");
    }
    return null;
  }

  // Extrahiere Datumsbereich aus invoicePeriod (z. B. "01.04.2026 - 30.04.2026")
  const accessLineItems = extractAccessLineItems(company.id, invoicePeriod);

  const lineItemsNet = accessLineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const fallbackNetAmount = getPlanNetPrice(company.plan);
  const netAmount = requestedNetAmount > 0
    ? requestedNetAmount
    : (lineItemsNet > 0 ? Math.round(lineItemsNet * 100) / 100 : fallbackNetAmount);
  const vatRate = Number(document.querySelector("#invoiceVatRate").value || "0");
  const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  return {
    company,
    recipientEmail,
    invoiceNumber,
    invoiceDate,
    dueDate: invoiceDueDate,
    invoicePeriod,
    invoiceDescription,
    planLabel: getPlanLabel(company.plan),
    netAmount,
    vatRate,
    vatAmount,
    totalAmount,
    accessLineItems,
    primaryColor: normalizeHexColor(state.settings.invoicePrimaryColor, "#0f4c5c"),
    accentColor: normalizeHexColor(state.settings.invoiceAccentColor, "#e36414"),
    logo: sanitizeInvoiceLogoSrc(state.settings.invoiceLogoData)
      || sanitizeInvoiceLogoSrc(elements.invoiceLogoData.value)
      || DEFAULT_BRAND_LOGO
  };
}

function parseInvoicePeriodRange(invoicePeriod) {
  const normalized = String(invoicePeriod || "").trim();
  const parts = normalized.split(/\s+-\s+|\s+bis\s+|\s+to\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const parseDate = (input) => {
    const value = String(input || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [day, month, year] = value.split(".").map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const from = parseDate(parts[0]);
  const to = parseDate(parts[1]);
  if (!from || !to) {
    return null;
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function extractAccessLineItems(companyId, invoicePeriod) {
  const range = parseInvoicePeriodRange(invoicePeriod);
  if (!range) {
    return [];
  }
  const { from, to } = range;
  
  // Filter access logs for this company and period
  const companyWorkerIds = state.workers
    .filter(w => w.companyId === companyId)
    .map(w => w.id);
  
  const relevantLogs = state.accessLogs.filter(log => {
    if (!companyWorkerIds.includes(log.workerId)) return false;
    const logTime = new Date(log.timestamp);
    return logTime >= from && logTime <= to;
  });
  
  // Group by worker
  const workerCounts = {};
  relevantLogs.forEach(log => {
    if (!workerCounts[log.workerId]) {
      workerCounts[log.workerId] = 0;
    }
    workerCounts[log.workerId]++;
  });
  
  // Build line items
  return Object.keys(workerCounts)
    .map(workerId => {
      const worker = state.workers.find(w => w.id === workerId);
      const accessCount = workerCounts[workerId];
      // Berechne Betrag: vereinfacht als (count * tariff_per_access)
      const pricePerAccess = 2.0; // Beispiel: 2 EUR pro Zugang
      const amount = accessCount * pricePerAccess;
      return {
        workerId,
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : "Unbekannt",
        accessCount,
        amount: Math.round(amount * 100) / 100
      };
    })
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}

function renderInvoiceHtml(invoice) {
  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8" />
      <title>Rechnung ${escapeHtml(invoice.invoiceNumber)}</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; color: #1b1b1b; }
        .sheet { padding: 28px; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
        .brand h1 { margin: 0; color: ${invoice.primaryColor}; }
        .brand p { margin: 6px 0 0; color: #555; }
        .logo { max-width: 180px; max-height: 84px; object-fit: contain; }
        .bar { height: 5px; background: linear-gradient(90deg, ${invoice.primaryColor}, ${invoice.accentColor}); border-radius: 4px; margin: 12px 0 20px; }
        .meta, .totals { width: 100%; border-collapse: collapse; }
        .meta td { padding: 6px 4px; vertical-align: top; }
        .service { margin: 14px 0 16px; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; }
        .service table { width: 100%; border-collapse: collapse; }
        .service th { text-align: left; background: #f8f8f8; padding: 10px; }
        .service td { padding: 10px; border-top: 1px solid #eee; }
        .totals td { padding: 6px 4px; }
        .totals tr:last-child td { font-size: 1.1rem; font-weight: 700; color: ${invoice.primaryColor}; }
        .footer { margin-top: 22px; font-size: 0.9rem; color: #666; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="head">
          <div class="brand">
            <h1>Rechnung</h1>
            <p>${escapeHtml(state.settings.operatorName)}</p>
            <p>${escapeHtml(state.settings.platformName)}</p>
          </div>
          ${invoice.logo ? `<img class="logo" src="${invoice.logo}" alt="Firmenlogo" />` : ""}
        </div>

        <div class="bar"></div>

        <table class="meta">
          <tr>
            <td><strong>Rechnungsnummer:</strong> ${escapeHtml(invoice.invoiceNumber)}</td>
            <td><strong>Rechnungsdatum:</strong> ${escapeHtml(formatDate(invoice.invoiceDate))}</td>
          </tr>
          <tr>
            <td><strong>Faelligkeitsdatum:</strong> ${escapeHtml(formatDate(invoice.dueDate))}</td>
            <td></td>
          </tr>
          <tr>
            <td><strong>Kunde:</strong> ${escapeHtml(invoice.company.name)}</td>
            <td><strong>Ansprechpartner:</strong> ${escapeHtml(invoice.company.contact || "-")}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Leistungszeitraum:</strong> ${escapeHtml(invoice.invoicePeriod)}</td>
          </tr>
        </table>

        <div class="service">
          <table>
            <thead>
              <tr>
                <th>Leistung / Mitarbeiter</th>
                <th style="text-align:center">Zugänge</th>
                <th style="text-align:right">Nettobetrag</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.accessLineItems && invoice.accessLineItems.length > 0 ? 
                invoice.accessLineItems.map(item => `
                  <tr>
                    <td>${escapeHtml(item.workerName || 'Unbekannt')}</td>
                    <td style="text-align:center">${item.accessCount}</td>
                    <td style="text-align:right">${formatCurrency(item.amount)}</td>
                  </tr>
                `).join('') :
                `
                  <tr>
                    <td>Tarif: ${escapeHtml(invoice.planLabel)}</td>
                    <td style="text-align:center">-</td>
                    <td style="text-align:right">${formatCurrency(invoice.netAmount)}</td>
                  </tr>
                  <tr>
                    <td>${escapeHtml(invoice.invoiceDescription)}</td>
                    <td style="text-align:center">-</td>
                    <td style="text-align:right">${formatCurrency(invoice.netAmount)}</td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>

        <table class="totals">
          <tr><td>Zwischensumme netto</td><td>${formatCurrency(invoice.netAmount)}</td></tr>
          <tr><td>MwSt. (${invoice.vatRate.toFixed(1)} %)</td><td>${formatCurrency(invoice.vatAmount)}</td></tr>
          <tr><td>Gesamtbetrag</td><td>${formatCurrency(invoice.totalAmount)}</td></tr>
        </table>

        <p class="footer">Vielen Dank für die Zusammenarbeit. Diese Rechnung wurde digital erstellt und kann direkt versendet werden.</p>
      </div>
    </body>
    </html>
  `;
}

function refreshInvoicePreview(options = {}) {
  const { silent = true } = options;
  if (!elements.invoicePreviewFrame) {
    return;
  }

  const invoice = buildInvoiceDraft({ silent });
  if (!invoice) {
    elements.invoicePreviewFrame.srcdoc = "";
    return;
  }
  elements.invoicePreviewFrame.srcdoc = renderInvoiceHtml(invoice);
}

function renderInvoiceHistory() {
  if (!state.invoices.length) {
    elements.invoiceHistoryList.innerHTML = '<div class="empty-state">Noch keine versendeten oder gespeicherten Rechnungen.</div>';
    return;
  }

  elements.invoiceHistoryList.innerHTML = state.invoices
    .slice(0, 20)
    .map(
      (invoice) => `
        <article class="list-item">
          <header>
            <div>
              <strong>${escapeHtml(invoice.invoice_number)}</strong>
              <span>${escapeHtml(invoice.company_name || "Firma")}</span>
            </div>
            <span class="status-pill status-${escapeHtml(invoice.status || "test")}">${escapeHtml(invoice.status || "-")}</span>
          </header>
          <span>Empfänger: ${escapeHtml(invoice.recipient_email)}</span>
          <span>Gesamt: ${formatCurrency(invoice.total_amount)}</span>
          <span>Erstellt: ${formatTimestamp(invoice.created_at)}</span>
          ${invoice.sent_at ? `<span>Versendet: ${formatTimestamp(invoice.sent_at)}</span>` : ""}
          ${invoice.error_message ? `<span>Fehler: ${escapeHtml(invoice.error_message)}</span>` : ""}
        </article>
      `
    )
    .join("");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}

function normalizeHexColor(value, fallback) {
  const candidate = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate;
  }
  return fallback;
}

function sanitizeInvoiceLogoSrc(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("data:image/")) {
    return raw;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol === "https:" || parsed.protocol === "blob:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}

async function handleCompanySubmit(event) {
  event.preventDefault();
  if (!userCanManageSystem()) {
    return;
  }

  try {
    const response = await apiRequest(API_BASE + "/api/companies", {
      method: "POST",
      body: {
        name: document.querySelector("#companyName").value.trim(),
        contact: document.querySelector("#companyContact").value.trim(),
        billingEmail: document.querySelector("#companyBillingEmail").value.trim(),
        accessHost: document.querySelector("#companyAccessHost").value.trim().toLowerCase(),
        plan: document.querySelector("#companyPlan").value,
        status: document.querySelector("#companyStatus").value
      }
    });

    elements.companyForm.reset();
    document.querySelector("#companyPlan").value = "tageskarte";
    document.querySelector("#companyStatus").value = "aktiv";

    await loadAllData();
    refreshAll();

    if (response.adminCredentials) {
      window.alert(`Firma angelegt. Admin-Zugang: ${response.adminCredentials.username} / ${response.adminCredentials.password}`);
    }
  } catch (error) {
    window.alert(`Firma konnte nicht angelegt werden: ${error.message}`);
  }
}

async function loadAndRenderInvoices() {
  try {
    const response = await apiRequest(API_BASE + "/api/invoices");
    state.invoices = response || [];
    renderInvoiceManagementList();
  } catch (error) {
    console.error("Failed to load invoices:", error);
    state.invoices = [];
    renderInvoiceManagementList();
  }
}

function renderInvoiceManagementList() {
  const container = document.querySelector("#invoiceManagementList");
  if (!container) return;

  const filterCompany = (document.querySelector("#invoiceFilterCompany")?.value || "").toLowerCase();
  const filterStatus = (document.querySelector("#invoiceFilterStatus")?.value || "");

  let invoices = state.invoices || [];
  
  // Apply filters
  if (filterCompany) {
    invoices = invoices.filter(inv => {
      const companyName = (inv.company_name || "").toLowerCase();
      return companyName.includes(filterCompany);
    });
  }
  
  if (filterStatus) {
    invoices = invoices.filter(inv => inv.status === filterStatus);
  }

  if (!invoices.length) {
    container.innerHTML = '<div class="empty-state">Keine Rechnungen vorhanden oder keine Treffer.</div>';
    renderCollectionsList();
    return;
  }

  const rows = invoices
    .map((inv) => {
      const statusLabel = {
        draft: "Entwurf",
        sent: "Versendet",
        overdue: "Überfällig",
        bezahlt: "Bezahlt",
        send_failed: "Fehler"
      }[inv.status] || inv.status;

      const statusClass = {
        draft: "",
        sent: "helper-text-info",
        overdue: "helper-text-warning",
        bezahlt: "helper-text-ok",
        send_failed: "helper-text-warning"
      }[inv.status] || "";

      const isPaid = inv.status === "bezahlt" || Boolean(inv.paid_at);
      const canMarkPaid = !isPaid && (getCurrentUser()?.role === "superadmin" || inv.company_id === getCurrentUser()?.company_id);

      return `
        <article class="card-item">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div style="flex:1;">
              <strong>${escapeHtml(inv.invoice_number || "RE-???")}</strong>
              <p class="helper-text">${escapeHtml(inv.company_name || "Firma")}</p>
              <p class="meta-text">
                ${inv.invoice_date ? formatTimestamp(inv.invoice_date) : "-"} 
                ${inv.paid_at ? ` • Bezahlt: ${formatTimestamp(inv.paid_at)}` : ""}
              </p>
            </div>
            <div style="text-align:right; min-width:140px;">
              <p class="meta-text">${inv.total_amount ? inv.total_amount.toFixed(2) : "0.00"} EUR</p>
              <p class="helper-text ${statusClass}">Status: ${statusLabel}</p>
            </div>
          </div>

          ${inv.due_date ? `<p class="helper-text">Fälligkeitsdatum: ${formatTimestamp(inv.due_date)}</p>` : ""}
          ${inv.auto_suspend_triggered_at ? `<p class="helper-text helper-text-warning">Auto-Sperrung ausgelöst: ${formatTimestamp(inv.auto_suspend_triggered_at)}</p>` : ""}

          <div class="button-row" style="margin-top:8px;">
            ${canMarkPaid ? `<button type="button" class="ghost-button invoice-mark-paid" data-invoice-id="${escapeHtml(inv.id)}">Als bezahlt markieren</button>` : ""}
            <span class="helper-text" style="flex:1; margin:0;">${inv.error_message ? `Fehler: ${escapeHtml(inv.error_message)}` : ""}</span>
          </div>
        </article>
      `;
    })
    .join("");

  container.innerHTML = rows;

  // Bind mark-paid buttons
  container.querySelectorAll("[data-invoice-id]").forEach(button => {
    button.addEventListener("click", async (e) => {
      const invId = e.target.dataset.invoiceId;
      if (!invId || !window.confirm("Diese Rechnung als bezahlt markieren? Firmensperrung wird ggf. aufgehoben.")) return;
      
      try {
        await apiRequest(API_BASE + `/api/invoices/${invId}/pay`, {
          method: "PUT",
          body: { paymentDate: new Date().toISOString().split("T")[0] }
        });
        window.alert("Rechnung als bezahlt markiert");
        await loadAndRenderInvoices();
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Fehler: ${error.message}`);
      }
    });
  });

  renderCollectionsList();
}

function toDateOnly(value) {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getInvoiceCollectionsMeta(invoice) {
  const today = toDateOnly(new Date().toISOString().slice(0, 10));
  const due = toDateOnly(invoice?.due_date);
  const isPaid = String(invoice?.status || "") === "bezahlt" || Boolean(invoice?.paid_at);
  const company = state.companies.find((entry) => entry.id === invoice?.company_id);
  const companyLocked = String(company?.status || "aktiv").toLowerCase() === "gesperrt";

  if (isPaid || !due || !today) {
    return { open: false, overdue: false, prelock: false, locked: false, daysOverdue: 0, companyLocked };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / msPerDay);
  const overdue = daysOverdue > 0;
  const prelock = daysOverdue >= 0 && daysOverdue <= 3 && !companyLocked;
  const locked = companyLocked;

  return {
    open: true,
    overdue,
    prelock,
    locked,
    daysOverdue,
    companyLocked,
  };
}

function renderCollectionsKpis(allOpenRows) {
  const kpiContainer = document.querySelector("#collectionsKpiGrid");
  if (!kpiContainer) {
    return;
  }

  const rows = Array.isArray(allOpenRows) ? allOpenRows : [];
  const totals = {
    all: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    prelock: { count: 0, amount: 0 },
    locked: { count: 0, amount: 0 },
  };

  rows.forEach(({ invoice, meta }) => {
    const amount = Number(invoice?.total_amount || 0);
    totals.all.count += 1;
    totals.all.amount += amount;
    if (meta?.overdue) {
      totals.overdue.count += 1;
      totals.overdue.amount += amount;
    }
    if (meta?.prelock) {
      totals.prelock.count += 1;
      totals.prelock.amount += amount;
    }
    if (meta?.locked) {
      totals.locked.count += 1;
      totals.locked.amount += amount;
    }
  });

  const cards = [
    ["Offen gesamt", totals.all],
    ["Ueberfaellig", totals.overdue],
    ["Vor Sperre", totals.prelock],
    ["Gesperrte Firmen", totals.locked],
  ];

  kpiContainer.innerHTML = cards
    .map(([label, data]) => `
      <article class="card-item" style="display:inline-block; min-width:220px; margin:0 8px 8px 0;">
        <p class="helper-text">${escapeHtml(label)}</p>
        <strong>${escapeHtml(String(data.count))}</strong>
        <p class="helper-text">${escapeHtml(formatCurrency(data.amount))}</p>
      </article>
    `)
    .join("");
}

function renderCollectionsList() {
  const container = document.querySelector("#collectionsList");
  if (!container) {
    return;
  }

  const filter = String(document.querySelector("#collectionsFilter")?.value || "all");
  const role = String(getCurrentUser()?.role || "").toLowerCase();
  const canToggleLock = role === "superadmin";

  const allOpenRows = (state.invoices || [])
    .map((invoice) => ({ invoice, meta: getInvoiceCollectionsMeta(invoice) }))
    .filter((entry) => entry.meta.open);

  renderCollectionsKpis(allOpenRows);

  let rows = [...allOpenRows];

  if (filter === "overdue") {
    rows = rows.filter((entry) => entry.meta.overdue);
  } else if (filter === "prelock") {
    rows = rows.filter((entry) => entry.meta.prelock);
  } else if (filter === "locked") {
    rows = rows.filter((entry) => entry.meta.locked);
  }

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">Keine Inkasso-Faelle fuer den gewaehlten Filter.</div>';
    return;
  }

  container.innerHTML = rows
    .sort((a, b) => {
      const aDue = String(a.invoice?.due_date || "");
      const bDue = String(b.invoice?.due_date || "");
      return aDue.localeCompare(bDue);
    })
    .map(({ invoice, meta }) => {
      const stage = Number(invoice?.reminder_stage || 0);
      const dueText = invoice?.due_date ? formatDate(invoice.due_date) : "-";
      const overdueText = meta.daysOverdue > 0 ? `${meta.daysOverdue} Tag(e) ueberfaellig` : "noch nicht ueberfaellig";
      const badge = meta.locked
        ? '<span class="helper-text helper-text-warning">Firma gesperrt</span>'
        : meta.prelock
          ? '<span class="helper-text helper-text-warning">Vor Sperre</span>'
          : meta.overdue
            ? '<span class="helper-text helper-text-warning">Ueberfaellig</span>'
            : '<span class="helper-text helper-text-info">Offen</span>';
      return `
        <article class="card-item">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="flex:1;">
              <strong>${escapeHtml(invoice.invoice_number || "RE-???")}</strong>
              <p class="helper-text">${escapeHtml(invoice.company_name || "Firma")}</p>
              <p class="helper-text">Faellig: ${escapeHtml(dueText)} | ${escapeHtml(overdueText)}</p>
              <p class="helper-text">Mahnstufe: ${escapeHtml(String(stage))}</p>
            </div>
            <div style="text-align:right; min-width:160px;">
              <p class="meta-text">${formatCurrency(invoice.total_amount)}</p>
              ${badge}
            </div>
          </div>
          <div class="button-row" style="margin-top:8px;">
            <button type="button" class="ghost-button" data-collections-mark-paid="${escapeHtml(invoice.id || "")}">Als bezahlt markieren</button>
            ${canToggleLock ? `<button type="button" class="ghost-button" data-collections-toggle-lock="${escapeHtml(invoice.company_id || "")}">${meta.companyLocked ? "Sperre aufheben" : "Firma sperren"}</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  container.onclick = async (event) => {
    const paidButton = event.target.closest("[data-collections-mark-paid]");
    if (paidButton && container.contains(paidButton)) {
      const invoiceId = paidButton.dataset.collectionsMarkPaid;
      if (!invoiceId || !window.confirm("Rechnung jetzt als bezahlt markieren?")) {
        return;
      }
      try {
        await apiRequest(`${API_BASE}/api/invoices/${invoiceId}/pay`, {
          method: "PUT",
          body: { paymentDate: new Date().toISOString().slice(0, 10) }
        });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Aktion fehlgeschlagen: ${error.message}`);
      }
      return;
    }

    const lockButton = event.target.closest("[data-collections-toggle-lock]");
    if (lockButton && container.contains(lockButton)) {
      const companyId = lockButton.dataset.collectionsToggleLock;
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!companyId || !company) {
        return;
      }
      const currentStatus = String(company.status || "aktiv").toLowerCase();
      const nextStatus = currentStatus === "gesperrt" ? "aktiv" : "gesperrt";
      const ok = window.confirm(nextStatus === "gesperrt"
        ? `Firma ${company.name} jetzt manuell sperren?`
        : `Sperre fuer ${company.name} jetzt aufheben?`
      );
      if (!ok) {
        return;
      }

      try {
        await apiRequest(`${API_BASE}/api/companies/${companyId}`, {
          method: "PUT",
          body: { status: nextStatus }
        });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(`Statuswechsel fehlgeschlagen: ${error.message}`);
      }
    }
  };
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  try {
    const payload = await apiRequest(API_BASE + "/api/login", {
      auth: false,
      method: "POST",
      body: {
        username: elements.loginUsername.value.trim(),
        password: elements.loginPassword.value,
        otpCode: elements.loginOtpCode.value.trim(),
        loginScope: elements.loginScope?.value || "auto"
      }
    });

    if (payload?.ok === false || payload?.error) {
      throw new Error(payload?.error || "login_failed");
    }
    if (!payload?.token || !payload?.user) {
      throw new Error("invalid_login_response");
    }

    token = payload.token;
    elements.loginForm.reset();

    await loadAllData();
    startHeartbeat();
    startBackendStatusMonitor();
    setView(getDefaultViewForRole(getCurrentUser()?.role));
    refreshAll();
  } catch (error) {
    if (error.message === "backend_unreachable") {
      window.alert("Backend nicht erreichbar. Bitte prüfe, ob der Server läuft und lade die Seite neu.");
      return;
    }
    if (error.message === "otp_required") {
      window.alert("Für dieses Konto ist 2FA aktiv. Bitte OTP-Code eingeben.");
      return;
    }
    if (error.message === "otp_invalid") {
      window.alert("OTP-Code ist ungültig oder abgelaufen. Bitte neuen Code eingeben.");
      return;
    }
    if (error.message === "too_many_attempts") {
      window.alert("Zu viele Fehlversuche. Bitte 10 Minuten warten und erneut versuchen.");
      return;
    }
    if (error.message === "forbidden_tenant_host") {
      window.alert("Dieser Zugang ist nur über die freigegebene Firmen-Domain erlaubt.");
      return;
    }
    if (error.message === "company_locked") {
      window.alert("Diese Firma ist gesperrt. Bitte zuerst offene Rechnungen begleichen oder die Sperre im Superadmin aufheben.");
      return;
    }
    if (error.message === "invalid_credentials") {
      window.alert("Benutzername oder Passwort ist falsch. Bitte Daten prüfen und erneut versuchen.");
      return;
    }
    if (error.message === "admin_ip_not_allowed") {
      window.alert("Admin-Zugriff von dieser IP ist nicht erlaubt.");
      return;
    }
    if (error.message === "login_scope_mismatch") {
      window.alert("Zugangstyp passt nicht zum Konto. Bitte Server-Admin/Firmen-Admin korrekt auswählen.");
      return;
    }
    if (error.message === "http_405") {
      const targetInfo = API_BASE || window.location.origin;
      window.alert(`Login fehlgeschlagen: 405. Der Login-Request landet aktuell auf ${targetInfo}. Für GitHub Pages muss das Frontend dein Render-Backend nutzen.`);
      return;
    }
    if (error.message === "invalid_login_response") {
      window.alert("Login-Antwort vom Server ist unvollständig. Bitte Seite neu laden und erneut versuchen.");
      return;
    }
    window.alert(`Login fehlgeschlagen: ${error.message}`);
  }
}

async function handleLogout() {
  try {
    if (token) {
      await apiRequest(API_BASE + "/api/logout", { method: "POST" });
    }
  } catch {
    // ignore logout call failures
  }

  clearSession();
  setView("dashboard");
  stopCamera();
  refreshAll();
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const currentPassword = document.querySelector("#currentPassword").value;
  const newPassword = document.querySelector("#newPassword").value;

  try {
    await apiRequest(API_BASE + "/api/me/password", {
      method: "POST",
      body: { currentPassword, newPassword }
    });
    window.alert("Passwort geaendert. Bitte neu anmelden.");
    await handleLogout();
  } catch (error) {
    window.alert(`Passwortwechsel fehlgeschlagen: ${error.message}`);
  }
}

async function setupTwofa() {
  try {
    const payload = await apiRequest(API_BASE + "/api/me/2fa/setup", { method: "POST", body: {} });
    state.twofa.secret = payload.secret;
    state.twofa.otpauthUri = payload.otpauthUri;
    state.twofa.enabled = Boolean(payload.enabled);
    refreshAll();
  } catch (error) {
    window.alert(`2FA Setup fehlgeschlagen: ${error.message}`);
  }
}

async function enableTwofa() {
  const code = window.prompt("Bitte 6-stelligen Code aus deiner Authenticator-App eingeben:") || "";
  if (!code) {
    return;
  }
  try {
    await apiRequest(API_BASE + "/api/me/2fa/enable", { method: "POST", body: { code } });
    state.twofa.enabled = true;
    refreshAll();
  } catch (error) {
    window.alert(`2FA konnte nicht aktiviert werden: ${error.message}`);
  }
}

async function disableTwofa() {
  const code = window.prompt("Bitte aktuellen 2FA-Code zum Deaktivieren eingeben:") || "";
  if (!code) {
    return;
  }
  try {
    await apiRequest(API_BASE + "/api/me/2fa/disable", { method: "POST", body: { code } });
    state.twofa.enabled = false;
    refreshAll();
  } catch (error) {
    window.alert(`2FA konnte nicht deaktiviert werden: ${error.message}`);
  }
}

async function startCamera() {
  if (!userCanManageWorkers()) {
    return;
  }

  const ua = (navigator.userAgent || "").toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
  const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  const requestUserMedia = async (constraints) => {
    if (navigator.mediaDevices?.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    if (legacyGetUserMedia) {
      return new Promise((resolve, reject) => {
        legacyGetUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
    throw new Error("getUserMedia_not_supported");
  };

  const buildCameraErrorMessage = (error) => {
    const errorName = String(error?.name || "").trim();
    if (!window.isSecureContext) {
      return "Browser-Kamera benoetigt HTTPS oder localhost.";
    }
    if (errorName === "NotAllowedError" || errorName === "SecurityError") {
      return "Kamera-Zugriff wurde blockiert. Bitte Browser-Berechtigung fuer Kamera erlauben.";
    }
    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      return "Keine Kamera gefunden.";
    }
    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      return "Kamera ist bereits von einer anderen App oder Browser-Registerkarte belegt.";
    }
    if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
      return "Kamera konnte mit den angeforderten Einstellungen nicht gestartet werden.";
    }
    if (errorName === "" && error?.message === "getUserMedia_not_supported") {
      return "Dieser Browser stellt keine Live-Kamera-API bereit.";
    }
    return `Kamera konnte nicht gestartet werden: ${error?.message || errorName || "unbekannter Fehler"}`;
  };

  if (!navigator.mediaDevices?.getUserMedia && !legacyGetUserMedia) {
    if (elements.photoDebugText) {
      const secureHint = window.isSecureContext ? "" : " HTTPS oder localhost ist erforderlich.";
      elements.photoDebugText.textContent = `Browser-Kamera nicht verfuegbar.${secureHint}`;
      elements.photoDebugText.style.color = "#8a5a00";
    }
    return;
  }

  const videoConstraintCandidates = [
    {
      facingMode: { ideal: "user" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 }
    },
    {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    true
  ];

  try {
    stopCamera();
    let lastError = null;

    for (const videoConstraint of videoConstraintCandidates) {
      try {
        cameraStream = await requestUserMedia({
          video: videoConstraint,
          audio: false
        });
        if (cameraStream) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!cameraStream && navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      for (const device of videoInputs) {
        try {
          cameraStream = await requestUserMedia({
            video: { deviceId: { exact: device.deviceId } },
            audio: false
          });
          if (cameraStream) {
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (!cameraStream) {
      throw lastError || new Error("camera_unavailable");
    }

    elements.cameraPreview.srcObject = cameraStream;
    await new Promise((resolve) => {
      const finalize = () => resolve();
      elements.cameraPreview.onloadedmetadata = finalize;
      window.setTimeout(finalize, 1200);
    });
    await elements.cameraPreview.play();
    elements.cameraPreview.style.visibility = "visible";
    elements.cameraPlaceholder.hidden = true;
    if (elements.photoDebugText) {
      elements.photoDebugText.textContent = "Kamera aktiv. Du kannst jetzt ein Foto aufnehmen.";
      elements.photoDebugText.style.color = "#0b7a3b";
    }
  } catch (error) {
    const reason = buildCameraErrorMessage(error);
    if (elements.photoDebugText) {
      elements.photoDebugText.textContent = reason;
      elements.photoDebugText.style.color = "#8a5a00";
    }
    if (isMobile && (error?.name === "NotAllowedError" || error?.name === "SecurityError")) {
      window.alert("Kamera-Zugriff wurde blockiert. Bitte Browser-Zugriff auf die Kamera erlauben und erneut auf Kamera starten klicken.");
      return;
    }
  }
}

function openPhotoFilePicker(options = {}) {
  const { preferCamera = false } = options;
  if (!elements.photoFileInput) {
    return;
  }
  if (preferCamera) {
    elements.photoFileInput.setAttribute("capture", "user");
  }
  elements.photoFileInput.value = "";
  elements.photoFileInput.click();
}

function handlePhotoFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    const dataUrl = typeof loadEvent.target?.result === "string" ? loadEvent.target.result : "";
    if (!dataUrl) {
      window.alert("Foto konnte nicht gelesen werden.");
      return;
    }
    const cleaned = await processStillImageBackground(dataUrl);
    setPhotoEditorSource(cleaned || dataUrl, { resetOffset: true });
  };
  reader.onerror = () => {
    window.alert("Foto konnte nicht geladen werden.");
  };
  reader.readAsDataURL(file);
}

async function capturePhoto() {
  const context = elements.photoCanvas.getContext("2d", { willReadFrequently: true });
  const video = elements.cameraPreview;

  if (!video.videoWidth || !video.videoHeight) {
    window.alert("Bitte zuerst die Kamera starten.");
    return;
  }

  if (!context) {
    window.alert("Fotoverarbeitung nicht verfuegbar.");
    return;
  }

  const targetWidth = PHOTO_TARGET_WIDTH;
  const targetHeight = PHOTO_TARGET_HEIGHT;
  elements.photoCanvas.width = targetWidth;
  elements.photoCanvas.height = targetHeight;

  // Keep transparent canvas so removed background stays truly transparent.
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  // Passfoto framing: crop to portrait ratio with a slight top bias for face/headroom.
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspect > targetAspect) {
    cropWidth = Math.round(sourceHeight * targetAspect);
    cropX = Math.round((sourceWidth - cropWidth) / 2);
  } else {
    cropHeight = Math.round(sourceWidth / targetAspect);
    const centered = Math.round((sourceHeight - cropHeight) / 2);
    cropY = Math.max(Math.round(centered * 0.55), 0);
  }

  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;
  const brightness = 8;
  const contrast = 1.05;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrast + 128 + brightness));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * contrast + 128 + brightness));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * contrast + 128 + brightness));
  }
  context.putImageData(imageData, 0, 0);

  // Background removal disabled: keep original camera background as requested.

  const photo = elements.photoCanvas.toDataURL("image/png");
  setPhotoEditorSource(photo, { resetOffset: true });
  applyPhotoEditorTransform();

  if (elements.photoDebugText) {
    elements.photoDebugText.textContent = `Foto erfasst (${photo ? photo.slice(0, 30) : "leer"})`;
    elements.photoDebugText.style.color = "#0b7a3b";
  }

  // Setze Bild auch im digitalen Ausweis (Badge-Vorschau)
  if (elements.badgePreview) {
    let badgeImg = elements.badgePreview.querySelector('img');
    if (!badgeImg) {
      badgeImg = document.createElement('img');
      badgeImg.alt = "Mitarbeiterfoto";
      badgeImg.style.maxWidth = "120px";
      badgeImg.style.maxHeight = "150px";
      badgeImg.style.borderRadius = "14px";
      badgeImg.style.border = "1px solid #ccc";
      elements.badgePreview.innerHTML = "";
      elements.badgePreview.appendChild(badgeImg);
    }
    badgeImg.src = photo;
    badgeImg.style.display = 'inline-block';
  }
}

async function processStillImageBackground(dataUrl) {
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const context = elements.photoCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return dataUrl;
    }

    const targetWidth = PHOTO_TARGET_WIDTH;
    const targetHeight = PHOTO_TARGET_HEIGHT;
    elements.photoCanvas.width = targetWidth;
    elements.photoCanvas.height = targetHeight;

    context.clearRect(0, 0, targetWidth, targetHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = targetWidth / targetHeight;

    let cropX = 0;
    let cropY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceAspect > targetAspect) {
      cropWidth = Math.round(sourceHeight * targetAspect);
      cropX = Math.round((sourceWidth - cropWidth) / 2);
    } else {
      cropHeight = Math.round(sourceWidth / targetAspect);
      const centered = Math.round((sourceHeight - cropHeight) / 2);
      cropY = Math.max(Math.round(centered * 0.55), 0);
    }

    context.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
    return elements.photoCanvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

function initSelfieSegmenter() {
  if (selfieSegmenter) {
    return Promise.resolve(selfieSegmenter);
  }
  return new Promise((resolve, reject) => {
    const seg = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`
    });
    // Model 0 gives cleaner edges than the fast landscape model.
    seg.setOptions({ modelSelection: 0 });
    seg.onResults(() => {});
    seg.initialize().then(() => {
      selfieSegmenter = seg;
      resolve(selfieSegmenter);
    }).catch(reject);
  });
}

async function removeBackgroundML(canvas, context) {
  try {
    const segmenter = await initSelfieSegmenter();
    const width = canvas.width;
    const height = canvas.height;

    const result = await new Promise((resolve) => {
      segmenter.onResults((r) => resolve(r));
      segmenter.send({ image: canvas });
    });

    // Draw segmentation mask to a temp canvas and smooth it to reduce jagged edges.
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!maskCtx) {
      boostWhiteBackground(context, canvas.width, canvas.height);
      return;
    }
    maskCtx.imageSmoothingEnabled = true;
    maskCtx.imageSmoothingQuality = "high";
    maskCtx.drawImage(result.segmentationMask, 0, 0, width, height);

    const smoothMaskCanvas = document.createElement("canvas");
    smoothMaskCanvas.width = width;
    smoothMaskCanvas.height = height;
    const smoothMaskCtx = smoothMaskCanvas.getContext("2d", { willReadFrequently: true });
    if (!smoothMaskCtx) {
      boostWhiteBackground(context, canvas.width, canvas.height);
      return;
    }
    smoothMaskCtx.imageSmoothingEnabled = true;
    smoothMaskCtx.imageSmoothingQuality = "high";
    smoothMaskCtx.filter = "blur(1.1px)";
    smoothMaskCtx.drawImage(maskCanvas, 0, 0, width, height);
    smoothMaskCtx.filter = "none";
    const maskData = smoothMaskCtx.getImageData(0, 0, width, height).data;

    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const personConfidence = maskData[i] / 255;
      if (personConfidence < 0.56) {
        data[i + 3] = 0;
      } else if (personConfidence < 0.84) {
        const alpha = Math.round(((personConfidence - 0.56) / 0.28) * 255);
        data[i + 3] = Math.max(0, Math.min(255, alpha));
      } else {
        data[i + 3] = 255;
      }
    }
    context.putImageData(imageData, 0, 0);
    enhancePhotoClarity(context, width, height, maskData);
    knockOutWhitePixelsToAlpha(context, width, height);
  } catch {
    // ML not available — keep original image without forced white background.
    enhancePhotoClarity(context, canvas.width, canvas.height);
    knockOutWhitePixelsToAlpha(context, canvas.width, canvas.height);
  }
}

function knockOutWhitePixelsToAlpha(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const nearNeutral = (max - min) <= 22;
    const veryBright = r >= 236 && g >= 236 && b >= 236;
    const brightNeutral = nearNeutral && r >= 224 && g >= 224 && b >= 224;

    if (veryBright || brightNeutral) {
      data[i + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function finalizeWhiteBackdrop(context, width, height, maskData = null) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const confidence = maskData ? (maskData[i] / 255) : 0;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const avg = (r + g + b) / 3;
    const nearNeutral = (max - min) <= 34;

    if (maskData && confidence < 0.9) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      continue;
    }

    if (nearNeutral && avg >= 170 && (!maskData || confidence < 0.96)) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }

  if (!maskData) {
    // Last-resort portrait matte: aggressively whiten outside the central portrait zone.
    const cx = width * 0.5;
    const cy = height * 0.56;
    const rx = width * 0.31;
    const ry = height * 0.44;
    const feather = Math.max(8, Math.round(Math.min(width, height) * 0.04));

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1) {
          continue;
        }
        const p = (y * width + x) * 4;
        const edge = Math.min(1, Math.max(0, (d - 1) * (feather / 6)));
        const blend = Math.max(0.7, edge);
        data[p] = Math.round(data[p] + (255 - data[p]) * blend);
        data[p + 1] = Math.round(data[p + 1] + (255 - data[p + 1]) * blend);
        data[p + 2] = Math.round(data[p + 2] + (255 - data[p + 2]) * blend);
      }
    }
  }

  context.putImageData(imageData, 0, 0);
}

function forceFullWhiteBackground(context, maskData, width, height) {
  if (!maskData) {
    return;
  }
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const personConfidence = maskData[i] / 255;
    if (personConfidence < 0.85) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function enhancePhotoClarity(context, width, height, maskData = null) {
  const imageData = context.getImageData(0, 0, width, height);
  const src = imageData.data;
  const original = new Uint8ClampedArray(src);

  const sharpenAmount = photoSharpenAmount;
  if (sharpenAmount < 0.01) return; // No sharpening
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      if (maskData) {
        const confidence = maskData[i] / 255;
        if (confidence < 0.6) {
          continue;
        }
      }
      for (let channel = 0; channel < 3; channel += 1) {
        const c = original[i + channel];
        const up = original[i - width * 4 + channel];
        const down = original[i + width * 4 + channel];
        const left = original[i - 4 + channel];
        const right = original[i + 4 + channel];
        const sharpened = 5 * c - up - down - left - right;
        const mixed = c * (1 - sharpenAmount) + sharpened * sharpenAmount;
        src[i + channel] = Math.max(0, Math.min(255, Math.round(mixed)));
      }
    }
  }
  context.putImageData(imageData, 0, 0);
}

function resetPhotoEditor() {
  photoEditorSourceData = "";
  photoEditorImage = null;
  photoEditorOffset = { x: 0, y: 0 };
  photoEditorZoom = PHOTO_EDITOR_ZOOM_DEFAULT;
  photoDragState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    baseOffsetX: 0,
    baseOffsetY: 0
  };
  elements.photoData.value = "";
  elements.capturedPhoto.src = "";
  elements.capturedPhoto.classList.remove("has-image", "dragging");
  updatePhotoAdjustControlsState();
}

function updatePhotoAdjustControlsState() {
  const hasPhoto = Boolean(
    elements.capturedPhoto &&
    elements.capturedPhoto.src &&
    elements.capturedPhoto.src.startsWith("data:image")
  );

  elements.photoMoveButtons.forEach((button) => {
    button.disabled = !hasPhoto;
  });

  if (elements.photoResetButton) {
    elements.photoResetButton.disabled = !hasPhoto;
  }

  if (elements.photoAdjustStatus) {
    elements.photoAdjustStatus.textContent = `Position: X ${photoEditorOffset.x} | Y ${photoEditorOffset.y}`;
  }

  if (elements.photoZoom) {
    elements.photoZoom.disabled = !hasPhoto;
    elements.photoZoom.value = String(photoEditorZoom);
  }

  if (elements.photoZoomValue) {
    elements.photoZoomValue.textContent = `${photoEditorZoom.toFixed(2)}x`;
  }

  if (elements.photoSharpen) {
    elements.photoSharpen.disabled = !hasPhoto;
    elements.photoSharpen.value = String(photoSharpenAmount);
  }

  if (elements.photoSharpenValue) {
    let label = "Normal";
    if (photoSharpenAmount < 0.13) label = "Weich";
    else if (photoSharpenAmount > 0.45) label = "Sehr scharf";
    elements.photoSharpenValue.textContent = label;
  }

  if (elements.photoRequiredHint) {
    if (hasPhoto) {
      elements.photoRequiredHint.textContent = "Foto erfasst. Ausweis kann gespeichert werden.";
      elements.photoRequiredHint.classList.remove("helper-text-warning");
      elements.photoRequiredHint.classList.add("helper-text-ok");
    } else {
      elements.photoRequiredHint.textContent = "Pflicht: Ohne Foto kann der Ausweis nicht gespeichert werden.";
      elements.photoRequiredHint.classList.remove("helper-text-ok");
      elements.photoRequiredHint.classList.add("helper-text-warning");
    }
  }
}

function updatePhotoAdjustControlsState() {
  // Aktiviere die Bearbeitungsbuttons immer, wenn ein Foto vorhanden ist
  const hasPhoto = Boolean(elements.capturedPhoto && elements.capturedPhoto.src && elements.capturedPhoto.src.startsWith("data:image"));
  elements.photoMoveButtons.forEach((button) => {
    button.disabled = !hasPhoto;
  });
  if (elements.photoResetButton) {
    elements.photoResetButton.disabled = !hasPhoto;
  }
  if (elements.photoAdjustStatus) {
    elements.photoAdjustStatus.textContent = `Position: X ${photoEditorOffset.x} | Y ${photoEditorOffset.y}`;
  }
  if (elements.photoZoom) {
    elements.photoZoom.disabled = !hasPhoto;
    elements.photoZoom.value = String(photoEditorZoom);
  }
  if (elements.photoZoomValue) {
    elements.photoZoomValue.textContent = `${photoEditorZoom.toFixed(2)}x`;
  }
  if (elements.photoSharpen) {
    elements.photoSharpen.disabled = !hasPhoto;
    elements.photoSharpen.value = String(photoSharpenAmount);
  }
  if (elements.photoSharpenValue) {
    let label = "Normal";
    if (photoSharpenAmount < 0.13) label = "Weich";
    else if (photoSharpenAmount > 0.45) label = "Sehr scharf";
    elements.photoSharpenValue.textContent = label;
  }
}

// Bearbeitungsfunktionen für Foto-Verschiebung
elements.photoMoveButtons.forEach((button) => {
  button.onclick = () => {
    if (!elements.capturedPhoto || !elements.capturedPhoto.src.startsWith("data:image")) return;
    const direction = button.dataset.photoMove;
    // Hole aktuelle Position aus Style oder setze Standard
    let x = parseInt(elements.capturedPhoto.getAttribute('data-x') || '0', 10);
    let y = parseInt(elements.capturedPhoto.getAttribute('data-y') || '0', 10);
    if (direction === "left") x -= 10;
    if (direction === "right") x += 10;
    if (direction === "up") y -= 10;
    if (direction === "down") y += 10;
    elements.capturedPhoto.style.transform = `translate(${x}px, ${y}px)`;
    elements.capturedPhoto.setAttribute('data-x', x);
    elements.capturedPhoto.setAttribute('data-y', y);
    if (elements.photoAdjustStatus) elements.photoAdjustStatus.textContent = `Position: X ${x} | Y ${y}`;
  };
});

function handlePhotoZoomInput(event) {
  const rawValue = Number(event.target.value || PHOTO_EDITOR_ZOOM_DEFAULT);
  photoEditorZoom = Math.min(PHOTO_EDITOR_ZOOM_MAX, Math.max(PHOTO_EDITOR_ZOOM_MIN, rawValue));
  if (photoEditorSourceData) {
    applyPhotoEditorTransform();
  } else {
    updatePhotoAdjustControlsState();
  }
}

function handlePhotoSharpenInput(event) {
  const rawValue = Number(event.target.value || 0.28);
  photoSharpenAmount = Math.max(0, Math.min(2, rawValue));
  if (photoEditorSourceData) {
    applyPhotoEditorTransform();
  } else {
    updatePhotoAdjustControlsState();
  }
}

function resetCapturedPhotoPosition() {
  if (!photoEditorSourceData) {
    return;
  }
  photoEditorOffset = { x: 0, y: 0 };
  applyPhotoEditorTransform();
}

function moveCapturedPhoto(direction) {
  if (!photoEditorSourceData) {
    return;
  }

  if (direction === "left") {
    photoEditorOffset.x -= PHOTO_EDITOR_STEP;
  } else if (direction === "right") {
    photoEditorOffset.x += PHOTO_EDITOR_STEP;
  } else if (direction === "up") {
    photoEditorOffset.y -= PHOTO_EDITOR_STEP;
  } else if (direction === "down") {
    photoEditorOffset.y += PHOTO_EDITOR_STEP;
  }

  applyPhotoEditorTransform();
}

function clampPhotoEditorOffset(offset, maxX, maxY) {
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

function applyPhotoEditorTransform() {
  if (!photoEditorSourceData) {
    updatePhotoAdjustControlsState();
    return;
  }

  if (photoEditorImage?.src === photoEditorSourceData) {
    renderPhotoEditorImage(photoEditorImage);
    return;
  }

  const image = new Image();
  image.onload = () => {
    photoEditorImage = image;
    renderPhotoEditorImage(image);
  };
  image.onerror = () => {
    window.alert("Foto konnte nicht geladen werden.");
    resetPhotoEditor();
  };
  image.src = photoEditorSourceData;
}

function renderPhotoEditorImage(image) {
  const context = elements.photoCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return;
  }

  const width = PHOTO_TARGET_WIDTH;
  const height = PHOTO_TARGET_HEIGHT;
  elements.photoCanvas.width = width;
  elements.photoCanvas.height = height;

  const drawWidth = Math.round(width * photoEditorZoom);
  const drawHeight = Math.round(height * photoEditorZoom);
  const maxOffsetX = Math.max(Math.floor((drawWidth - width) / 2), 0);
  const maxOffsetY = Math.max(Math.floor((drawHeight - height) / 2), 0);
  photoEditorOffset = clampPhotoEditorOffset(photoEditorOffset, maxOffsetX, maxOffsetY);

  const drawX = Math.round((width - drawWidth) / 2 + photoEditorOffset.x);
  const drawY = Math.round((height - drawHeight) / 2 + photoEditorOffset.y);

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  // Keep natural background in preview.

  const adjusted = elements.photoCanvas.toDataURL("image/png");
  elements.photoData.value = adjusted;
  elements.capturedPhoto.src = adjusted;
  elements.capturedPhoto.style.display = "inline-block";
  elements.capturedPhoto.classList.add("has-image");
  updatePhotoAdjustControlsState();
}

function startPhotoDrag(event) {
  if (!photoEditorSourceData) {
    return;
  }
  photoDragState = {
    active: true,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseOffsetX: photoEditorOffset.x,
    baseOffsetY: photoEditorOffset.y
  };
  elements.capturedPhoto.classList.add("dragging");
  elements.capturedPhoto.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function movePhotoDrag(event) {
  if (!photoDragState.active || event.pointerId !== photoDragState.pointerId) {
    return;
  }
  const deltaX = Math.round(event.clientX - photoDragState.startX);
  const deltaY = Math.round(event.clientY - photoDragState.startY);
  photoEditorOffset = {
    x: photoDragState.baseOffsetX + deltaX,
    y: photoDragState.baseOffsetY + deltaY
  };
  applyPhotoEditorTransform();
}

function endPhotoDrag(event) {
  if (!photoDragState.active || event.pointerId !== photoDragState.pointerId) {
    return;
  }
  photoDragState.active = false;
  photoDragState.pointerId = null;
  elements.capturedPhoto.classList.remove("dragging");
  if (elements.capturedPhoto.hasPointerCapture(event.pointerId)) {
    elements.capturedPhoto.releasePointerCapture(event.pointerId);
  }
}

function boostWhiteBackground(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Sample full perimeter with median for robust background color detection
  const rs = [];
  const gs = [];
  const bs = [];
  const borderThickness = 10;
  const stepX = Math.max(1, Math.floor(width / 80));
  const stepY = Math.max(1, Math.floor(height / 80));

  for (let bRow = 0; bRow < borderThickness; bRow++) {
    for (let x = 0; x < width; x += stepX) {
      const topIdx = (bRow * width + x) * 4;
      rs.push(data[topIdx]); gs.push(data[topIdx + 1]); bs.push(data[topIdx + 2]);
      const botIdx = ((height - 1 - bRow) * width + x) * 4;
      rs.push(data[botIdx]); gs.push(data[botIdx + 1]); bs.push(data[botIdx + 2]);
    }
  }
  for (let bCol = 0; bCol < borderThickness; bCol++) {
    for (let y = borderThickness; y < height - borderThickness; y += stepY) {
      const leftIdx = (y * width + bCol) * 4;
      rs.push(data[leftIdx]); gs.push(data[leftIdx + 1]); bs.push(data[leftIdx + 2]);
      const rightIdx = (y * width + (width - 1 - bCol)) * 4;
      rs.push(data[rightIdx]); gs.push(data[rightIdx + 1]); bs.push(data[rightIdx + 2]);
    }
  }

  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = Math.floor(rs.length / 2);
  const bg = [rs[mid], gs[mid], bs[mid]];

  // Flood-fill from all border pixels inward.
  // Only pixels CONNECTED TO THE BORDER and similar to bg get removed.
  // Face/hair in the center is never touched — even if color is similar to background.
  // High threshold is safe here because flood-fill can never jump over the person.
  const threshold = 95;
  const blendZone = 45;

  const getDistance = (pixIdx) => {
    const dr = data[pixIdx] - bg[0];
    const dg = data[pixIdx + 1] - bg[1];
    const db = data[pixIdx + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const visited = new Uint8Array(width * height);
  const queue = [];

  // Seed queue with all border pixels
  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    if (visited[pos]) {
      continue;
    }
    visited[pos] = 1;
    const pixIdx = pos * 4;
    const d = getDistance(pixIdx);

    if (d < threshold + blendZone) {
      if (d < threshold) {
        data[pixIdx] = 255;
        data[pixIdx + 1] = 255;
        data[pixIdx + 2] = 255;
      } else {
        // Soft blend toward white at edges
        const t = 1 - (d - threshold) / blendZone;
        data[pixIdx] = Math.round(data[pixIdx] + (255 - data[pixIdx]) * t * 0.65);
        data[pixIdx + 1] = Math.round(data[pixIdx + 1] + (255 - data[pixIdx + 1]) * t * 0.65);
        data[pixIdx + 2] = Math.round(data[pixIdx + 2] + (255 - data[pixIdx + 2]) * t * 0.65);
      }

      // Expand to 4-connected neighbors
      const px = pos % width;
      const py = Math.floor(pos / width);
      if (px > 0 && !visited[pos - 1]) queue.push(pos - 1);
      if (px < width - 1 && !visited[pos + 1]) queue.push(pos + 1);
      if (py > 0 && !visited[pos - width]) queue.push(pos - width);
      if (py < height - 1 && !visited[pos + width]) queue.push(pos + width);
    }
  }

  context.putImageData(imageData, 0, 0);
}

function stopCamera() {
  if (!cameraStream) {
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  elements.cameraPreview.srcObject = null;
  elements.cameraPreview.style.visibility = "hidden";
  elements.cameraPlaceholder.hidden = false;
}

async function exportState(options = {}) {
  try {
    const includeAudit = Boolean(options.includeAudit);
    const includeDayClose = Boolean(options.includeDayClose);
    const includeDeleted = Boolean(options.includeDeleted);
    const companyId = String(options.companyId || "").trim();

    const query = new URLSearchParams();
    if (includeAudit) query.set("includeAudit", "1");
    if (includeDayClose) query.set("includeDayClose", "1");
    if (includeDeleted) query.set("includeDeleted", "1");
    if (companyId) query.set("companyId", companyId);

    const exportPayload = await apiRequest(`${API_BASE}/api/export${query.toString() ? `?${query.toString()}` : ""}`);
    const currentUser = getCurrentUser();
    const exportCompanyId = currentUser?.company_id || currentUser?.companyId || "";
    const exportCompany = state.companies.find((entry) => entry.id === exportCompanyId);
    const exportScopeLabel = exportCompany ? ` fuer ${exportCompany.name}` : "";
    const fileScope = exportPayload?.meta?.scope || (companyId ? "company" : "system");
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `baupass-export-${fileScope}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (elements.photoDebugText) {
      const counts = exportPayload?.meta?.counts || {};
      elements.photoDebugText.textContent = `System-Export${exportScopeLabel} wurde heruntergeladen (Firmen: ${counts.companies || 0}, Mitarbeiter: ${counts.workers || 0}, Logs: ${counts.accessLogs || 0}).`;
      elements.photoDebugText.style.color = "#0b7a3b";
    }
  } catch (error) {
    window.alert(`Export fehlgeschlagen: ${error.message}`);
  }
}

async function loadDemoData() {
  if (!userCanManageWorkers()) {
    window.alert("Nur Admin-Rollen duerfen Demo-Daten laden.");
    return;
  }

  const currentUser = getCurrentUser();
  let companyId = currentUser?.company_id || currentUser?.companyId || "";

  if (!companyId) {
    companyId = state.companies.find((entry) => !entry.deleted_at && !entry.deletedAt)?.id || "";
  }

  if (!companyId) {
    window.alert("Keine aktive Firma für Demo-Daten gefunden.");
    return;
  }

  const company = state.companies.find((entry) => entry.id === companyId);
  const companyName = company?.name || "die ausgewaehlte Firma";
  const modeRaw = window.prompt(
    `Demo-Daten fuer ${companyName}: Modus eingeben (replace oder append)`,
    "replace"
  );
  if (modeRaw === null) {
    return;
  }
  const mode = String(modeRaw || "replace").trim().toLowerCase();
  if (!["replace", "append"].includes(mode)) {
    window.alert("Ungültiger Modus. Bitte replace oder append verwenden.");
    return;
  }

  const includeInvoices = window.confirm("Sollen Demo-Rechnungen mit erzeugt werden?");
  const includeAccessLogs = window.confirm("Sollen Demo-Zutrittslogs erzeugt werden?");

  const proceed = window.confirm(
    mode === "replace"
      ? `Demo-Daten jetzt für ${companyName} im Modus REPLACE laden? Vorhandene Mitarbeiter, Subunternehmen und Logs werden ersetzt.`
      : `Demo-Daten jetzt fuer ${companyName} im Modus APPEND zusaetzlich laden?`
  );
  if (!proceed) {
    return;
  }

  try {
    const result = await apiRequest(API_BASE + "/api/demo-seed", {
      method: "POST",
      body: {
        companyId,
        mode,
        includeInvoices: includeInvoices ? 1 : 0,
        includeAccessLogs: includeAccessLogs ? 1 : 0,
        includeOverdueExample: 1,
      }
    });
    await loadAllData();
    refreshAll();
    window.alert(
      `Demo-Daten fuer ${companyName} wurden geladen (Modus: ${result.mode}, Mitarbeiter: ${result.workersCreated}, Logs: ${result.accessLogsCreated}, Rechnungen: ${result.invoicesCreated}).`
    );
  } catch (error) {
    window.alert(`Demo-Daten konnten nicht geladen werden: ${error.message}`);
  }
}

async function handleTopbarExport() {
  if (!token || !state.currentUser) {
    window.alert("Bitte zuerst anmelden.");
    return;
  }
  const exportCompanyId = state.currentUser?.company_id || state.currentUser?.companyId || "";
  const exportCompany = state.companies.find((entry) => entry.id === exportCompanyId);
  const exportScopeLabel = exportCompany ? ` fuer ${exportCompany.name}` : "";
  const includeAudit = window.confirm("Audit-Log im Export einschließen?");
  const includeDayClose = window.confirm("Tagesabschluss-Quittierungen im Export einschließen?");
  const includeDeleted = window.confirm("Gelöschte Einträge im Export einschließen?");

  let exportCompanyTarget = "";
  if (state.currentUser?.role === "superadmin") {
    const exportAll = window.confirm("Als Superadmin: Gesamtsystem exportieren? (Nein = nur aktuelle Firma)");
    if (!exportAll) {
      exportCompanyTarget = exportCompanyId;
    }
  }

  const proceed = window.confirm(`System-Export${exportScopeLabel} jetzt herunterladen?`);
  if (!proceed) {
    return;
  }
  await exportState({
    includeAudit,
    includeDayClose,
    includeDeleted,
    companyId: exportCompanyTarget,
  });
}

async function handleTopbarLogout() {
  const proceed = window.confirm("Wirklich abmelden?");
  if (!proceed) {
    return;
  }
  await handleLogout();
}

function showImportDryRunDialog(summary) {
  return new Promise((resolve) => {
    const accepted = summary?.accepted || {};
    const conflicts = summary?.conflicts || {};
    const skipped = summary?.skipped || {};
    const unchanged = summary?.unchanged || {};
    const importOnlyChanges = Boolean(summary?.importOnlyChanges);

    const formatBadge = (value, mode) => {
      const numeric = Number(value || 0);
      const text = escapeHtml(String(numeric));
      let bg = "#eef2f7";
      let color = "#1f2937";

      if (mode === "accepted") {
        if (numeric > 0) {
          bg = "#dcfce7";
          color = "#166534";
        }
      } else if (mode === "conflict") {
        if (numeric > 5) {
          bg = "#fee2e2";
          color = "#991b1b";
        } else if (numeric > 0) {
          bg = "#fef3c7";
          color = "#92400e";
        } else {
          bg = "#dcfce7";
          color = "#166534";
        }
      } else if (mode === "skip") {
        if (numeric > 0) {
          bg = "#fef3c7";
          color = "#92400e";
        } else {
          bg = "#dcfce7";
          color = "#166534";
        }
      }

      return `<span style="display:inline-flex; min-width:38px; justify-content:center; padding:2px 8px; border-radius:999px; background:${bg}; color:${color}; font-weight:700;">${text}</span>`;
    };

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(10, 16, 26, 0.52)";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.zIndex = "9999";

    const panel = document.createElement("div");
    panel.style.width = "min(860px, 94vw)";
    panel.style.maxHeight = "80vh";
    panel.style.overflow = "auto";
    panel.style.background = "#ffffff";
    panel.style.borderRadius = "14px";
    panel.style.padding = "18px";
    panel.style.boxShadow = "0 12px 38px rgba(0,0,0,0.22)";

    panel.innerHTML = `
      <h3 style="margin:0 0 8px;">Import Vorschau (Dry-Run)</h3>
      <p class="helper-text" style="margin:0 0 12px;">Bitte Zahlen prüfen, bevor der Import angewendet wird.</p>
      <p class="helper-text" style="margin:0 0 12px; color:#475569;">Modus: <strong>${importOnlyChanges ? "Nur Änderungen" : "Alle Datensätze"}</strong> · Unverändert erkannt: ${Number(unchanged.companies || 0) + Number(unchanged.subcompanies || 0) + Number(unchanged.workers || 0) + Number(unchanged.accessLogs || 0) + Number(unchanged.invoices || 0)}</p>
      
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:14px; padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem;">
          <span style="display:inline-flex; min-width:24px; height:24px; justify-content:center; align-items:center; padding:2px 6px; border-radius:999px; background:#dcfce7; color:#166534; font-weight:700; font-size:0.8rem;">✓</span>
          <span style="color:#16a34a;"><strong>Grün:</strong> OK / keine Konflikte</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem;">
          <span style="display:inline-flex; min-width:24px; height:24px; justify-content:center; align-items:center; padding:2px 6px; border-radius:999px; background:#fef3c7; color:#92400e; font-weight:700; font-size:0.8rem;">⚠</span>
          <span style="color:#b45309;"><strong>Gelb:</strong> 1-5 Konflikte</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem;">
          <span style="display:inline-flex; min-width:24px; height:24px; justify-content:center; align-items:center; padding:2px 6px; border-radius:999px; background:#fee2e2; color:#991b1b; font-weight:700; font-size:0.8rem;">✕</span>
          <span style="color:#dc2626;"><strong>Rot:</strong> >5 Konflikte</span>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin-bottom:12px;">
        <thead>
          <tr style="background:#f5f7fa; text-align:left;">
            <th style="padding:8px; border:1px solid #d8dee8;">Bereich</th>
            <th style="padding:8px; border:1px solid #d8dee8;">Accepted</th>
            <th style="padding:8px; border:1px solid #d8dee8;">Conflicts</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px; border:1px solid #d8dee8;">Companies</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(accepted.companies, "accepted")}</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(conflicts.companies, "conflict")}</td></tr>
          <tr><td style="padding:8px; border:1px solid #d8dee8;">Subcompanies</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(accepted.subcompanies, "accepted")}</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(conflicts.subcompanies, "conflict")}</td></tr>
          <tr><td style="padding:8px; border:1px solid #d8dee8;">Workers</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(accepted.workers, "accepted")}</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(conflicts.workers, "conflict")}</td></tr>
          <tr><td style="padding:8px; border:1px solid #d8dee8;">Access Logs</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(accepted.accessLogs, "accepted")}</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(conflicts.accessLogs, "conflict")}</td></tr>
          <tr><td style="padding:8px; border:1px solid #d8dee8;">Invoices</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(accepted.invoices, "accepted")}</td><td style="padding:8px; border:1px solid #d8dee8;">${formatBadge(conflicts.invoices, "conflict")}</td></tr>
        </tbody>
      </table>

      <div style="padding:8px 10px; background:#fef3c7; border-radius:6px; border-left:4px solid #b45309; margin-bottom:14px;">
        <p style="margin:0 0 6px; font-weight:600; color:#92400e; font-size:0.9rem;">⚠ Übersprungene Einträge:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem; color:#78350f;">
          <div><strong>Verboten (Berechtigung):</strong> ${formatBadge(skipped.forbidden, "skip")}</div>
          <div><strong>Ungültig (Format):</strong> ${formatBadge(skipped.invalid, "skip")}</div>
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="ghost-button" data-import-preview="cancel">Abbrechen</button>
        <button type="button" class="primary-button" data-import-preview="apply">Import anwenden</button>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup(false);
      }
    });

    panel.querySelector('[data-import-preview="cancel"]')?.addEventListener("click", () => cleanup(false));
    panel.querySelector('[data-import-preview="apply"]')?.addEventListener("click", () => cleanup(true));
  });
}

async function handleTopbarImport() {
  if (!token || !state.currentUser) {
    window.alert("Bitte zuerst anmelden.");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payloadData = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;

      const importOnlyChanges = window.confirm("Nur Änderungen importieren? (Empfohlen)");

      const dryRunResult = await apiRequest(`${API_BASE}/api/import`, {
        method: "POST",
        body: {
          data: payloadData,
          dryRun: 1,
          importOnlyChanges: importOnlyChanges ? 1 : 0,
        }
      });

      const summary = dryRunResult?.summary || {};
      const proceed = await showImportDryRunDialog(summary);

      if (!proceed) {
        return;
      }

      await apiRequest(`${API_BASE}/api/import`, {
        method: "POST",
        body: {
          data: payloadData,
          dryRun: 0,
          importOnlyChanges: importOnlyChanges ? 1 : 0,
        }
      });

      await loadAllData();
      refreshAll();
      window.alert("Import erfolgreich angewendet.");
    } catch (error) {
      window.alert(`Import fehlgeschlagen: ${error.message}`);
    }
  };

  input.click();
}

function buildBadgeId(firstName, lastName, workerType = "worker") {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  const initials = `${firstName[0] || "X"}${lastName[0] || "X"}`.toUpperCase();
  const prefix = workerType === "visitor" ? "VS" : "BP";
  return `${prefix}-${initials}-${stamp}`;
}

function createAvatar(worker) {
  const initials = `${worker.firstName[0] || ""}${worker.lastName[0] || ""}`.toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#d95d39" />
          <stop offset="100%" stop-color="#121417" />
        </linearGradient>
      </defs>
      <rect width="320" height="420" rx="36" fill="url(#bg)" />
      <circle cx="160" cy="136" r="68" fill="rgba(255,255,255,0.22)" />
      <path d="M76 338c22-58 64-86 84-86s62 28 84 86" fill="rgba(255,255,255,0.22)" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Space Grotesk, Arial" font-size="64" font-weight="700" fill="#fff7ef">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getPlanNetPrice(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  return PLAN_NET_PRICE_EUR[normalized] || PLAN_NET_PRICE_EUR.tageskarte;
}

function getPlanLabel(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  return PLAN_LABELS[normalized] || PLAN_LABELS.tageskarte;
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

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.addEventListener("beforeunload", stopCamera);

if (elements.navLinks.length) {
  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (!token) return;
      setView(link.dataset.view || "dashboard");
    });
  });
}

if (elements.loginForm) {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
}

if (elements.logoutButton) {
  elements.logoutButton.addEventListener("click", handleTopbarLogout);
}

if (elements.seedDataButton) {
  elements.seedDataButton.addEventListener("click", loadDemoData);
}

if (elements.exportButton) {
  elements.exportButton.addEventListener("click", handleTopbarExport);
}

if (elements.importButton) {
  elements.importButton.addEventListener("click", handleTopbarImport);
}

if (elements.systemThemeToggleButton) {
  elements.systemThemeToggleButton.addEventListener("click", toggleSystemTheme);
}

const workerCsvButton = document.querySelector("#workerCsvButton");
if (workerCsvButton) {
  workerCsvButton.addEventListener("click", exportWorkersPdf);
}

const workerForm = document.querySelector("#workerForm");
if (workerForm) {
  workerForm.addEventListener("submit", handleWorkerSubmit);
}

const workerCancelEditButton = document.querySelector("#workerCancelEditButton");
if (workerCancelEditButton) {
  workerCancelEditButton.addEventListener("click", () => {
    clearWorkerEditor();
    stopCamera();
  });
}

if (elements.workerType) {
  elements.workerType.addEventListener("change", () => syncWorkerTypeUi());
}

const validUntilInput = document.querySelector("#validUntil");
if (validUntilInput) {
  validUntilInput.addEventListener("change", () => {
    if ((elements.workerType?.value || "worker") === "visitor" && elements.visitEndAt && validUntilInput.value && !elements.visitEndAt.value) {
      elements.visitEndAt.value = `${validUntilInput.value}T23:00`;
    }
  });
}

if (elements.visitEndAt) {
  elements.visitEndAt.addEventListener("change", () => {
    if ((elements.workerType?.value || "worker") === "visitor" && validUntilInput && elements.visitEndAt.value) {
      validUntilInput.value = elements.visitEndAt.value.slice(0, 10);
    }
  });
}

syncWorkerTypeUi();

const accessForm = document.querySelector("#accessForm");
if (accessForm) {
  accessForm.addEventListener("submit", handleAccessSubmit);
}

const accessFilterForm = document.querySelector("#accessFilterForm");
if (accessFilterForm) {
  accessFilterForm.addEventListener("submit", handleAccessFilterSubmit);
}

const accessResetButton = document.querySelector("#accessResetButton");
if (accessResetButton) {
  accessResetButton.addEventListener("click", resetAccessFilter);
}

const accessCsvButton = document.querySelector("#accessCsvButton");
if (accessCsvButton) {
  accessCsvButton.addEventListener("click", exportAccessCsv);
}

const invoiceRefreshButton = document.querySelector("#invoiceRefreshButton");
if (invoiceRefreshButton) {
  invoiceRefreshButton.addEventListener("click", () => loadAndRenderInvoices());
}

const invoiceFilterCompany = document.querySelector("#invoiceFilterCompany");
if (invoiceFilterCompany) {
  invoiceFilterCompany.addEventListener("input", () => renderInvoiceManagementList());
}

const invoiceFilterStatus = document.querySelector("#invoiceFilterStatus");
if (invoiceFilterStatus) {
  invoiceFilterStatus.addEventListener("change", () => renderInvoiceManagementList());
}

const collectionsFilter = document.querySelector("#collectionsFilter");
if (collectionsFilter) {
  collectionsFilter.addEventListener("change", () => renderCollectionsList());
}

const printDailyReportButton = document.querySelector("#printDailyReportButton");
if (printDailyReportButton) {
  printDailyReportButton.addEventListener("click", printDailyReport);
}

const printVisitorWeeklyReportButton = document.querySelector("#printVisitorWeeklyReportButton");
if (printVisitorWeeklyReportButton) {
  printVisitorWeeklyReportButton.addEventListener("click", printVisitorWeeklyReport);
}

const refreshSystemStatusButton = document.querySelector("#refreshSystemStatusButton");
if (refreshSystemStatusButton) {
  refreshSystemStatusButton.addEventListener("click", refreshSystemStatus);
}

const repairSystemButton = document.querySelector("#repairSystemButton");
if (repairSystemButton) {
  repairSystemButton.addEventListener("click", handleSystemRepair);
}

if (elements.dayCloseAcknowledgeForm) {
  elements.dayCloseAcknowledgeForm.addEventListener("submit", handleDayCloseAcknowledge);
}

const settingsForm = document.querySelector("#settingsForm");
if (settingsForm) {
  settingsForm.addEventListener("submit", handleSettingsSubmit);
}

const companyForm = document.querySelector("#companyForm");
if (companyForm) {
  companyForm.addEventListener("submit", handleCompanySubmit);
}

if (elements.desktopInstallButton) {
  elements.desktopInstallButton.addEventListener("click", () => {
    triggerDesktopInstall().catch(() => {
      window.alert("Desktop-Installation konnte nicht gestartet werden.");
    });
  });
}

const passwordForm = document.querySelector("#passwordForm");
if (passwordForm) {
  passwordForm.addEventListener("submit", handlePasswordChange);
}

const invoiceForm = document.querySelector("#invoiceForm");
if (invoiceForm) {
  invoiceForm.addEventListener("submit", handleInvoicePrint);
}

const invoiceSendButton = document.querySelector("#invoiceSendButton");
if (invoiceSendButton) {
  invoiceSendButton.addEventListener("click", handleInvoiceSend);
}

const invoicePreviewButton = document.querySelector("#invoicePreviewButton");
if (invoicePreviewButton) {
  invoicePreviewButton.addEventListener("click", () => refreshInvoicePreview({ silent: false }));
}

const invoiceCompanySelect = document.querySelector("#invoiceCompanySelect");
if (invoiceCompanySelect) {
  invoiceCompanySelect.addEventListener("change", () => {
    syncInvoiceRecipientFromCompany();
    refreshInvoicePreview({ silent: true });
  });
}

["#invoiceNumber", "#invoiceRecipientEmail", "#invoiceDate", "#invoiceDueDate", "#invoicePeriod", "#invoiceDescription", "#invoiceNetAmount", "#invoiceVatRate"].forEach((selector) => {
  const field = document.querySelector(selector);
  if (field) {
    field.addEventListener("input", () => refreshInvoicePreview({ silent: true }));
  }
});

const invoiceLogoFile = document.querySelector("#invoiceLogoFile");
if (invoiceLogoFile) {
  invoiceLogoFile.addEventListener("change", handleInvoiceLogoUpload);
}

const loadCustomBrandButton = document.querySelector("#loadCustomBrandButton");
if (loadCustomBrandButton) {
  loadCustomBrandButton.addEventListener("click", loadCustomBrandingPreset);
}

const loadCustomBrandAltButton = document.querySelector("#loadCustomBrandAltButton");
if (loadCustomBrandAltButton) {
  loadCustomBrandAltButton.addEventListener("click", loadCustomBrandingPresetAlt);
}

const startCameraButton = document.querySelector("#startCameraButton");
if (startCameraButton) {
  startCameraButton.addEventListener("click", startCamera);
}

const capturePhotoButton = document.querySelector("#capturePhotoButton");
if (capturePhotoButton) {
  capturePhotoButton.addEventListener("click", capturePhoto);
}

const uploadPhotoButton = document.querySelector("#uploadPhotoButton");
if (uploadPhotoButton) {
  uploadPhotoButton.addEventListener("click", openPhotoFilePicker);
}

if (elements.photoFileInput) {
  elements.photoFileInput.addEventListener("change", handlePhotoFileSelected);
}

if (elements.photoZoom) {
  elements.photoZoom.addEventListener("input", handlePhotoZoomInput);
}

if (elements.photoSharpen) {
  elements.photoSharpen.addEventListener("input", handlePhotoSharpenInput);
}

if (elements.photoResetButton) {
  elements.photoResetButton.addEventListener("click", resetCapturedPhotoPosition);
}

const companySelect = document.querySelector("#companySelect");
if (companySelect) {
  companySelect.addEventListener("change", populateSubcompanySelects);
}

const addSubcompanyButton = document.querySelector("#addSubcompanyButton");
if (addSubcompanyButton) {
  addSubcompanyButton.addEventListener("click", async () => {
    const companyId = document.querySelector("#companySelect")?.value || "";
    const name = (document.querySelector("#subcompanyName")?.value || "").trim();
    if (!companyId || !name) {
      window.alert("Bitte zuerst Firma und Subunternehmensname angeben.");
      return;
    }
    try {
      await apiRequest(`${API_BASE}/api/subcompanies`, { method: "POST", body: { companyId, name } });
      const input = document.querySelector("#subcompanyName");
      if (input) input.value = "";
      await loadAllData();
      populateSubcompanySelects();
      refreshAll();
    } catch (error) {
      if (error.message === "session_expired") {
        return;
      }
      window.alert(`Subunternehmen konnte nicht angelegt werden: ${error.message}`);
    }
  });
}

registerControlServiceWorker();
wireDesktopInstallPrompt();

(function initWorkerListControls() {
  // ── Search ──
  if (elements.workerSearchInput) {
    elements.workerSearchInput.addEventListener("input", () => renderWorkerList());
  }

  // ── Bulk select all ──
  if (elements.bulkSelectAll) {
    elements.bulkSelectAll.addEventListener("change", () => {
      const checked = elements.bulkSelectAll.checked;
      elements.workerList?.querySelectorAll(".bulk-checkbox").forEach((cb) => { cb.checked = checked; });
      updateBulkActionBar();
    });
  }

  // ── Bulk action buttons ──
  if (elements.bulkCancelButton) {
    elements.bulkCancelButton.addEventListener("click", () => {
      elements.workerList?.querySelectorAll(".bulk-checkbox").forEach((cb) => { cb.checked = false; });
      if (elements.bulkSelectAll) elements.bulkSelectAll.checked = false;
      updateBulkActionBar();
    });
  }

  if (elements.bulkDeleteButton) {
    elements.bulkDeleteButton.addEventListener("click", async () => {
      const ids = getSelectedWorkerIds();
      if (!ids.length) return;
      if (!window.confirm(`${ids.length} Mitarbeiter wirklich löschen?`)) return;
      try {
        await Promise.all(ids.map((id) => apiRequest(`${API_BASE}/api/workers/${id}`, { method: "DELETE" })));
        await loadAllData();
        if (elements.bulkSelectAll) elements.bulkSelectAll.checked = false;
        refreshAll();
      } catch (error) {
        window.alert(`Fehler beim Löschen: ${error.message}`);
      }
    });
  }

  if (elements.bulkSetActiveButton) {
    elements.bulkSetActiveButton.addEventListener("click", () => bulkSetStatus("aktiv"));
  }
  if (elements.bulkSetInactiveButton) {
    elements.bulkSetInactiveButton.addEventListener("click", () => bulkSetStatus("inaktiv"));
  }
})();

function getSelectedWorkerIds() {
  return [...(elements.workerList?.querySelectorAll(".bulk-checkbox:checked") || [])].map((cb) => cb.dataset.bulkId);
}

function updateBulkActionBar() {
  const count = getSelectedWorkerIds().length;
  if (elements.bulkActionBar) elements.bulkActionBar.classList.toggle("hidden", count === 0);
  if (elements.bulkSelectionCount) elements.bulkSelectionCount.textContent = `${count} ausgewählt`;
}

async function bulkSetStatus(status) {
  const ids = getSelectedWorkerIds();
  if (!ids.length) return;
  try {
    await Promise.all(ids.map((id) => {
      const worker = state.workers.find((w) => w.id === id);
      if (!worker) return Promise.resolve();
      return apiRequest(`${API_BASE}/api/workers/${id}`, {
        method: "PUT",
        body: { ...worker, status, companyId: worker.companyId }
      });
    }));
    await loadAllData();
    if (elements.bulkSelectAll) elements.bulkSelectAll.checked = false;
    refreshAll();
  } catch (error) {
    window.alert(`Fehler beim Status-Ändern: ${error.message}`);
  }
}

(async () => {
  initSystemThemeControl();
  try {
    await loadAllData();
    if (getCurrentUser()?.role === "superadmin") {
      await refreshSystemStatus();
    }
    startHeartbeat();
    startBackendStatusMonitor();
    setView("dashboard");
  } catch {
    clearSession();
  } finally {
    refreshAll();
  }
})();
