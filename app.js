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
const SESSION_TOKEN_STORAGE_KEY = "baupass-control-token";
const UI_LANG_STORAGE_KEY = "baupass-ui-lang";
const UI_FALLBACK_LANG = "de";

function loadStoredSessionToken() {
  try {
    return (window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function persistSessionToken(value) {
  try {
    const next = String(value || "").trim();
    if (next) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, next);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures (private mode / quota)
  }
}
const UI_TRANSLATIONS = {
  de: {
    authEyebrow: "Melde-Seite",
    authTitle: "Sicher in BauPass Control anmelden",
    authCopy: "Super-Admin behält die Systemhoheit. Firmen-Admins sehen nur ihre Firma. Der Drehkreuz-Login bekommt einen schnellen Zutrittsmodus.",
    authPlatform: "Plattform",
    authOperator: "Betreiber",
    authTurnstile: "Drehkreuz-Endpunkt",
    loginUsernameLabel: "Benutzername",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Passwort",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "OTP-Code (wenn 2FA aktiv)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Sprache",
    loginScopeLabel: "Zugangstyp",
    loginScopeAuto: "Automatisch",
    loginScopeServerAdmin: "Server-Admin",
    loginScopeCompanyAdmin: "Firmen-Admin",
    loginScopeTurnstile: "Drehkreuz",
    loginButton: "Anmelden",
    demoAccessTitle: "Demo-Zugänge",
    demoSuperAdmin: "Super-Admin: superadmin / 1234",
    demoCompanyAdmin: "Firmen-Admin: firma / 1234",
    demoTurnstile: "Drehkreuz: drehkreuz / 1234",
    desktopAppTitle: "Desktop-App",
    desktopInstallHint: "Dieses Portal kann auf dem Computer wie ein Programm installiert werden.",
    desktopInstallButton: "Auf diesem Computer installieren",
    appTitle: "BauPass Control",
    alertInstallUnavailable: "Die Installation ist in diesem Browser gerade nicht direkt verfuegbar. In Chrome oder Edge kannst du im Browser-Menue 'App installieren' waehlen.",
    alertSessionExpired: "Sitzung abgelaufen. Bitte neu anmelden.",
    // Shell
    sidebarEyebrow: "Firmenportal",
    sidebarCopy: "Mitarbeiter erfassen, Fotos aufnehmen, digitale Ausweise erzeugen und Zutritte am Drehkreuz steuern.",
    sidebarCardTitle: "Vermietungsmodus",
    sidebarCardStrong: "Multi-Firma f\u00e4hig",
    sidebarCardDesc: "Jede Baufirma verwaltet ihr Team getrennt. Super-Admin beh\u00e4lt Systemkontrolle.",
    navDashboard: "Dashboard",
    navWorkers: "Mitarbeiter",
    navBadge: "Ausweis",
    navAccess: "Zutritt",
    navInvoices: "Rechnungen",
    navAdmin: "Admin",
    topbarEyebrow: "Systemstatus",
    topbarHeading: "Baustellen-Ausweise und Zutritt",
    btnSeedData: "Demo-Daten einspielen",
    btnExport: "System exportieren",
    btnImport: "System importieren",
    btnLogout: "Sicher abmelden",
    dashEyebrow: "Verbesserter MVP",
    dashHeading: "Digitale Ausweise mit Foto, Badge-ID und Check-in am Drehkreuz",
    dashSubtext: "Der Prototyp ist bereits f\u00fcr Vermietung an Baufirmen gedacht: Firmenverwaltung, Mitarbeiter-Stammdaten, lokale Zutrittslogs, Export und Systemkonfiguration.",
    dashBadge1: "Fotoaufnahme",
    dashBadge2: "Zutrittslog",
    dashBadge3: "Mandantenf\u00e4hig",
    reportingEyebrow: "Reporting",
    reportingH3: "Zahlung und Sperrstatus",
    reportingPaid: "Bezahlt",
    reportingOpen: "Offen",
    reportingOverdue: "Ueberfaellig",
    reportingInvoicesLabel: "Rechnungen",
    reportingOverdueTotal: "Ueberfaellige Summe",
    reportingLockedCompanies: "Gesperrte Firmen",
    reportingAutoSuspensions30d: "Auto-Sperren (30d)",
    reportingGeneratedAt: "Stand",
    reportingNoOverdueCompanies: "Keine ueberfaelligen Firmen vorhanden.",
    reportingFallbackCompany: "Firma",
    reportingOverdueInvoicesLabel: "ueberfaellige Rechnungen",
    reportingNoAccessDataLast7Days: "Keine Zutrittsdaten fuer die letzten 7 Tage.",
    reportingCheckin: "Check-in",
    reportingCheckout: "Check-out",
    navDocuments: "Dokumente",
    docInboxEyebrow: "Posteingang",
    docInboxH3: "Eingehende Dokumente per Mail",
    btnDocInboxRefresh: "Aktualisieren",
    btnDocInboxSync: "System-Eingang abrufen",
    btnDocInboxPoll: "Postfach jetzt abrufen",
    btnDocInboxOpenGmail: "Gmail oeffnen",
    docEmailInfoLabel: "Dokument-E-Mail (Mitarbeiter schicken Nachweise hierhin):",
    btnCopyEmail: "Kopieren",
    btnCopyEmailDone: "Kopiert!",
    docInboxHint: "Mitarbeiter schicken ihre Nachweise an die konfigurierte Dokuments-E-Mail. Der Pf\u00f6rtner ordnet die Anh\u00e4nge hier einem Mitarbeiter zu.",
    docAssignEyebrow: "Zuweisen",
    docAssignH3: "Anhang einem Mitarbeiter zuordnen",
    docInboxEmpty: "Kein unverarbeiteter Posteingang.",
    docInboxEmailFrom: "Von",
    docInboxEmailSubject: "Betreff",
    docInboxEmailDate: "Datum",
    docInboxAttachments: "Anh\u00e4nge",
    btnAssignDoc: "Zuweisen",
    btnDismissEmail: "Verwerfen",
    docAssignWorkerLabel: "Mitarbeiter w\u00e4hlen",
    docAssignTypeLabel: "Dokumenttyp",
    docAssignNotesLabel: "Anmerkungen (optional)",
    btnConfirmAssign: "Dokument zuweisen",
    docAssignSuccess: "Dokument erfolgreich zugewiesen.",
    docTypeMindestlohnnachweis: "Mindestlohnnachweis",
    docTypePersonalausweis: "Personalausweis / Reisepass",
    docTypeSozialversicherungsnachweis: "Sozialversicherungsnachweis",
    docTypeArbeitserlaubnis: "Arbeitserlaubnis",
    docTypeGesundheitszeugnis: "Gesundheitszeugnis",
    docTypeSonstiges: "Sonstiges",
    workerDocsHeading: "Gespeicherte Dokumente",
    workerDocsEmpty: "Keine Dokumente hinterlegt.",
    workerAkteLabel: "Mitarbeiter-Akte",
    btnUploadWorkerDoc: "Dokument hochladen",
    btnConfirmUpload: "Hochladen",
    docUploadSuccess: "Dokument erfolgreich hochgeladen.",
    confirmDeleteDoc: "Dokument wirklich l\u00f6schen?",
    btnDownloadDoc: "Download",
    btnDeleteDoc: "L\u00f6schen",
    imapSectionEyebrow: "Dokument-Eingang",
    imapSectionH4: "IMAP-Postfach f\u00fcr Nachweise",
    labelImapHint: "Mitarbeiter schicken Nachweise an diese Adresse. Das System ruft das Postfach alle paar Minuten ab.",
    labelImapHost: "IMAP Host",
    labelImapPort: "IMAP Port",
    labelImapUser: "IMAP Benutzername",
    labelImapPass: "IMAP Passwort",
    labelImapFolder: "IMAP Ordner",
    labelImapSsl: "SSL/TLS",
    btnImapTest: "IMAP-Verbindung testen",
    imapTestOk: "Verbindung erfolgreich!",
    imapTestFail: "Verbindung fehlgeschlagen",
    accessWeekEyebrow: "7 Tage",
    accessWeekH3: "Zutritte pro Tag",
    recentEyebrow: "Letzte Aktivit\u00e4ten",
    recentH3: "Zutrittsprotokoll",
    porterLiveEmpty: "Letzter Zutritt wird angezeigt, sobald eine An- oder Abmeldung vorliegt.",
    workersFormEyebrow: "Stammdaten",
    workersFormH3: "Mitarbeiter oder Besucher erfassen",
    labelType: "Typ",
    optWorker: "Mitarbeiter",
    optVisitor: "Besucher",
    labelFirm: "Firma",
    labelSubcompany: "Subunternehmen",
    optNoSubcompany: "Kein Subunternehmen",
    labelNewSubcompany: "Neues Subunternehmen",
    btnAddSubcompany: "Subunternehmen anlegen",
    labelFirstName: "Vorname",
    labelLastName: "Nachname",
    labelInsuranceNumber: "Rentenversicherungsnummer",
    labelRoleField: "Funktion",
    labelSite: "Baustelle",
    labelPhysicalCard: "Physische Karten-ID (NFC/RFID)",
    labelValidUntil: "G\u00fcltig bis",
    labelVisitorCompany: "Besucherfirma",
    labelVisitPurpose: "Besuchszweck",
    labelHostName: "Ansprechpartner vor Ort",
    labelVisitEndAt: "Besuchsende",
    visitorHint: "Besucher sind f\u00fcr ein paar Stunden oder bis Tagesende g\u00fcltig. Offene Zutritte werden sp\u00e4testens um 00:00 automatisch abgemeldet, die Karte bleibt aber f\u00fcr Auswertungen erhalten.",
    labelWorkerStatus: "Status",
    optStatusActive: "Aktiv",
    optStatusLocked: "Gesperrt",
    optStatusExpired: "Abgelaufen",
    labelBadgePin: "Badge-PIN f\u00fcr App-Login",
    btnStartCamera: "Kamera starten",
    btnCapturePhoto: "Foto aufnehmen",
    btnUploadPhoto: "Foto hochladen",
    btnPhotoUp: "\u2191 Hoch",
    btnPhotoLeft: "\u2190 Links",
    btnPhotoRight: "Rechts \u2192",
    btnPhotoDown: "Runter \u2193",
    btnPhotoReset: "Position zur\u00fccksetzen",
    btnWorkerSubmit: "Mitarbeiter speichern und Ausweis erzeugen",
    btnWorkerCancelEdit: "Bearbeiten abbrechen",
    workersListEyebrow: "Datenbestand",
    workersListH3: "Registrierte Mitarbeiter",
    btnWorkerCsv: "Mitarbeiterliste als PDF herunterladen",
    btnBulkDelete: "Ausgew\u00e4hlte l\u00f6schen",
    btnBulkActive: "Status: aktiv",
    btnBulkInactive: "Status: inaktiv",
    btnBulkCancel: "Abbrechen",
    badgeEyebrow: "Digitaler Ausweis",
    badgeH3: "Badge-Vorschau",
    badgeEmptyState: "Bitte zuerst einen Mitarbeiter anlegen oder aus der Liste ausw\u00e4hlen.",
    badgeScanEyebrow: "Scan-Hilfe",
    badgeScanH3: "Badge-Code",
    badgeScanEmpty: "Kein Badge ausgew\u00e4hlt.",
    badgeTitleVisitor: "Digitale Besucherkarte",
    badgeTitleDayPass: "Digitaler Baustellen-Tagesausweis",
    badgeTitleRegular: "Digitaler Baustellen-Ausweis",
    badgeUnknownCompany: "Unbekannte Firma",
    badgeQrHint: "QR scannen, App installieren und Ausweis direkt oeffnen.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "QR-Funktion",
    badgeMetaQrFuncVal: "Mitarbeiter-App Installation",
    badgeMetaRoleLabel: "Rolle im System",
    badgePhotoUploadHint: "Foto aufnehmen oder hochladen",
    appPinLabel: "App-PIN",
    pinNotRequired: "nicht noetig",
    pinSet: "gesetzt",
    pinMissing: "fehlt",
    cardLabel: "Karte",
    cardUnassigned: "nicht zugewiesen",
    btnEdit: "Bearbeiten",
    btnDelete: "Loeschen",
    btnRestore: "Wiederherstellen",
    btnAppLink: "App-Link",
    btnResetPin: "PIN zuruecksetzen",
    confirmDeleteWorker: "Mitarbeiter wirklich loeschen?",
    alertDeleteWorkerFailed: "Mitarbeiter konnte nicht geloescht werden: {error}",
    alertRestoreWorkerFailed: "Mitarbeiter konnte nicht wiederhergestellt werden: {error}",
    alertAppLinkCreateFailed: "App-Link konnte nicht erzeugt werden: {error}",
    promptResetPinFor: "Neue Badge-PIN fuer {name} (4-8 Ziffern):",
    alertPinMustDigits: "PIN muss aus 4 bis 8 Ziffern bestehen.",
    alertPinResetSuccessFor: "PIN fuer {name} wurde erfolgreich zurueckgesetzt.",
    alertPinResetFailed: "PIN konnte nicht zurueckgesetzt werden: {error}",
    detailCloseTitle: "Schliessen",
    detailPhotoAlt: "Mitarbeiterfoto",
    detailCheckinBtn: "Anmelden (Check-in)",
    detailCheckoutBtn: "Abmelden (Check-out)",
    accessFormEyebrow: "Drehkreuz",
    accessFormH3: "Check-in und Check-out",
    labelAccessBadge: "Badge-ID oder Mitarbeiter",
    labelAccessDir: "Richtung",
    labelAccessGate: "Punkt",
    labelAccessNote: "Notiz",
    optCheckin: "Check-in",
    optCheckout: "Check-out",
    btnAccessSubmit: "Zutritt buchen",
    porterEmpty: "Pf\u00f6rtner-Live-Ansicht: Mitarbeiter w\u00e4hlen und Zutritt buchen.",
    accessLogEyebrow: "Zutrittsjournal",
    accessLogH3: "Eintritt und Austritt mit Zeitstempel",
    labelFrom: "Von",
    labelTo: "Bis",
    labelFilterDir: "Richtung",
    labelFilterGate: "Drehkreuz",
    optAllDir: "Alle",
    btnApplyFilter: "Filter anwenden",
    btnResetFilter: "Filter zur\u00fccksetzen",
    btnAccessCsv: "Zutritts-CSV exportieren",
    dailyReportEyebrow: "Tagesbericht",
    dailyReportH3: "Pro Drehkreuz",
    btnPrintDaily: "Tagesreport drucken",
    btnPrintVisitorWeekly: "Besucher-Wochenliste drucken",
    hourlyEyebrow: "Stundenanalyse",
    hourlyH3: "Eintritt/Austritt je Stunde",
    warningsEyebrow: "Warnungen",
    warningsH3: "Eintritt ohne Austritt",
    invListEyebrow: "Fakturierung",
    invListH3: "Rechnungen und Zahlungsstatus",
    optAllStatus: "Alle Status",
    optDraft: "Entwurf",
    optSent: "Versendet",
    optOverdue: "\u00dcberf\u00e4llig",
    optPaid: "Bezahlt",
    optFailed: "Fehler",
    btnRefreshList: "Aktualisieren",
    inkassoEyebrow: "Inkasso",
    inkassoH3: "\u00dcberf\u00e4llig, vor Sperre, gesperrt",
    optAllPositions: "Alle offenen Positionen",
    optPrelock: "Vor Sperre",
    optLocked: "Bereits gesperrt",
    adminEyebrow: "Admin-Zentrale",
    adminH3: "System & Konfiguration",
    sysStatusEyebrow: "Systemstatus",
    sysStatusH3: "Notfallzugriff & Reparatur",
    btnRefreshStatus: "Status neu laden",
    btnRepairSessions: "Sitzungen reparieren",
    superAdminEyebrow: "Systemhoheit",
    superAdminH3: "Super-Admin Einstellungen",
    labelPlatformName: "Plattformname",
    labelOperatorName: "Betreiber",
    labelTurnstileEp: "Drehkreuz-API Endpoint",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "SMTP Benutzer",
    labelSmtpPass: "SMTP Passwort",
    labelSenderEmail: "Absender E-Mail",
    labelSenderName: "Absender Name",
    labelTls: "TLS aktiv",
    optTlsYes: "Ja",
    optTlsNo: "Nein",
    optYes: "Ja",
    optNo: "Nein",
    labelIpWhitelist: "Admin IP-Whitelist (Komma getrennt, optional CIDR)",
    labelEnforceDomain: "Firmen-Domain erzwingen",
    btnSaveAdmin: "Admin-Einstellungen speichern",
    companyNewEyebrow: "Mandanten",
    companyNewH3: "Neue Baufirma anlegen",
    labelCompanyName: "Firmenname",
    labelCompanyContact: "Ansprechpartner",
    labelBillingEmail: "Rechnungs-E-Mail",
    labelAccessHost: "Firmen-Zugangsdomain",
    labelPlan: "Tarif",
    labelCompanyStatus: "Status",
    optCompanyActive: "Aktiv",
    optCompanyTest: "Testphase",
    optCompanyPaused: "Pausiert",
    optCompanyLocked: "Gesperrt wegen Zahlungsverzug",
    labelCompanyAdminPassword: "Admin-Startpasswort",
    companyAdminPasswordPlaceholder: "z.B. Sicher!2025",
    btnCreateCompany: "Baufirma anlegen",
    accountEyebrow: "Konto",
    accountH3: "Passwort \u00e4ndern",
    labelCurrentPassword: "Aktuelles Passwort",
    labelNewPassword: "Neues Passwort",
    btnChangePassword: "Passwort \u00e4ndern",
    tfaEyebrow: "Zwei-Faktor",
    tfaH3: "2FA Verwaltung",
    companiesListEyebrow: "Mandanten",
    companiesListH3: "Baufirmen und Pl\u00e4ne",
    invFormEyebrow: "Rechnungen",
    invFormH3: "Mit Logo und Design versenden",
    labelInvFirm: "Firma",
    labelInvNumber: "Rechnungsnummer",
    labelInvRecipient: "Empf\u00e4nger E-Mail",
    labelInvDate: "Rechnungsdatum",
    labelInvDueDate: "F\u00e4lligkeitsdatum",
    labelInvPeriod: "Leistungszeitraum",
    labelInvDescription: "Leistungsbeschreibung",
    labelInvNet: "Nettobetrag (EUR)",
    labelInvVat: "MwSt. (%)",
    btnPrintInvoice: "Rechnung drucken / als PDF speichern",
    btnSendInvoice: "Rechnung per E-Mail senden",
    btnUpdatePreview: "Vorschau aktualisieren",
    auditEyebrow: "Sicherheitsprotokoll",
    auditH3: "Audit-Log",
    labelAuditEvent: "Event-Typ",
    labelAuditRole: "Rolle",
    btnAuditCsv: "Audit-CSV exportieren",
  },
  en: {
    authEyebrow: "Login Page",
    authTitle: "Secure Sign-in to BauPass Control",
    authCopy: "Super admin keeps full system control. Company admins only see their own company. Turnstile login gets a fast access mode.",
    authPlatform: "Platform",
    authOperator: "Operator",
    authTurnstile: "Turnstile Endpoint",
    loginUsernameLabel: "Username",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Password",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "OTP code (if 2FA is enabled)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Language",
    loginScopeLabel: "Access type",
    loginScopeAuto: "Automatic",
    loginScopeServerAdmin: "Server Admin",
    loginScopeCompanyAdmin: "Company Admin",
    loginScopeTurnstile: "Turnstile",
    loginButton: "Sign in",
    demoAccessTitle: "Demo Accounts",
    demoSuperAdmin: "Super Admin: superadmin / 1234",
    demoCompanyAdmin: "Company Admin: firma / 1234",
    demoTurnstile: "Turnstile: drehkreuz / 1234",
    desktopAppTitle: "Desktop App",
    desktopInstallHint: "This portal can be installed on your computer like a native app.",
    desktopInstallButton: "Install on this computer",
    appTitle: "BauPass Control",
    alertInstallUnavailable: "Installation is not directly available in this browser right now. In Chrome or Edge, choose 'Install app' from the browser menu.",
    alertSessionExpired: "Session expired. Please sign in again.",
    // Shell
    sidebarEyebrow: "Company Portal",
    sidebarCopy: "Register workers, take photos, generate digital ID cards and control access at turnstiles.",
    sidebarCardTitle: "Rental Mode",
    sidebarCardStrong: "Multi-Company Ready",
    sidebarCardDesc: "Each construction company manages its team separately. Super admin retains system control.",
    navDashboard: "Dashboard",
    navWorkers: "Workers",
    navBadge: "Badge",
    navAccess: "Access",
    navInvoices: "Invoices",
    navAdmin: "Admin",
    topbarEyebrow: "System Status",
    topbarHeading: "Construction Badges & Access Control",
    btnSeedData: "Insert demo data",
    btnExport: "Export system",
    btnImport: "Import system",
    btnLogout: "Sign out securely",
    dashEyebrow: "Enhanced MVP",
    dashHeading: "Digital badges with photo, badge ID and check-in at turnstile",
    dashSubtext: "The prototype is already designed for renting to construction companies: company management, worker records, local access logs, export and system configuration.",
    dashBadge1: "Photo capture",
    dashBadge2: "Access log",
    dashBadge3: "Multi-tenant",
    reportingEyebrow: "Reporting",
    reportingH3: "Payment & Block Status",
    reportingPaid: "Paid",
    reportingOpen: "Open",
    reportingOverdue: "Overdue",
    reportingInvoicesLabel: "invoices",
    reportingOverdueTotal: "Overdue total",
    reportingLockedCompanies: "Blocked companies",
    reportingAutoSuspensions30d: "Auto suspensions (30d)",
    reportingGeneratedAt: "Generated",
    reportingNoOverdueCompanies: "No overdue companies found.",
    reportingFallbackCompany: "Company",
    reportingOverdueInvoicesLabel: "overdue invoices",
    reportingNoAccessDataLast7Days: "No access data for the last 7 days.",
    reportingCheckin: "Check-in",
    reportingCheckout: "Check-out",
    navDocuments: "Documents",
    docInboxEyebrow: "Inbox",
    docInboxH3: "Incoming Documents by Email",
    btnDocInboxRefresh: "Refresh",
    btnDocInboxSync: "Sync system inbox",
    btnDocInboxPoll: "Fetch mailbox now",
    btnDocInboxOpenGmail: "Open Gmail",
    docEmailInfoLabel: "Document email (workers send proofs here):",
    btnCopyEmail: "Copy",
    btnCopyEmailDone: "Copied!",
    docInboxHint: "Workers send their proof documents to the configured document email. The porter assigns attachments to a worker here.",
    docAssignEyebrow: "Assign",
    docAssignH3: "Assign attachment to a worker",
    docInboxEmpty: "No unprocessed emails in inbox.",
    docInboxEmailFrom: "From",
    docInboxEmailSubject: "Subject",
    docInboxEmailDate: "Date",
    docInboxAttachments: "Attachments",
    btnAssignDoc: "Assign",
    btnDismissEmail: "Dismiss",
    docAssignWorkerLabel: "Select worker",
    docAssignTypeLabel: "Document type",
    docAssignNotesLabel: "Notes (optional)",
    btnConfirmAssign: "Assign document",
    docAssignSuccess: "Document assigned successfully.",
    docTypeMindestlohnnachweis: "Minimum wage proof",
    docTypePersonalausweis: "ID / Passport",
    docTypeSozialversicherungsnachweis: "Social security certificate",
    docTypeArbeitserlaubnis: "Work permit",
    docTypeGesundheitszeugnis: "Health certificate",
    docTypeSonstiges: "Other",
    workerDocsHeading: "Stored Documents",
    workerDocsEmpty: "No documents on file.",
    workerAkteLabel: "Worker File",
    btnUploadWorkerDoc: "Upload document",
    btnConfirmUpload: "Upload",
    docUploadSuccess: "Document uploaded successfully.",
    confirmDeleteDoc: "Really delete this document?",
    btnDownloadDoc: "Download",
    btnDeleteDoc: "Delete",
    imapSectionEyebrow: "Document Inbox",
    imapSectionH4: "IMAP mailbox for proof documents",
    labelImapHint: "Workers send their proof documents to this address. The system polls the mailbox every few minutes.",
    labelImapHost: "IMAP Host",
    labelImapPort: "IMAP Port",
    labelImapUser: "IMAP Username",
    labelImapPass: "IMAP Password",
    labelImapFolder: "IMAP Folder",
    labelImapSsl: "SSL/TLS",
    btnImapTest: "Test IMAP connection",
    imapTestOk: "Connection successful!",
    imapTestFail: "Connection failed",
    accessWeekEyebrow: "7 Days",
    accessWeekH3: "Access per Day",
    recentEyebrow: "Recent Activity",
    recentH3: "Access Log",
    porterLiveEmpty: "Last access entry will be shown once a check-in or check-out occurs.",
    workersFormEyebrow: "Master Data",
    workersFormH3: "Register Worker or Visitor",
    labelType: "Type",
    optWorker: "Worker",
    optVisitor: "Visitor",
    labelFirm: "Company",
    labelSubcompany: "Subcompany",
    optNoSubcompany: "No subcompany",
    labelNewSubcompany: "New Subcompany",
    btnAddSubcompany: "Create subcompany",
    labelFirstName: "First name",
    labelLastName: "Last name",
    labelInsuranceNumber: "Social security number",
    labelRoleField: "Job title",
    labelSite: "Construction site",
    labelPhysicalCard: "Physical card ID (NFC/RFID)",
    labelValidUntil: "Valid until",
    labelVisitorCompany: "Visitor company",
    labelVisitPurpose: "Visit purpose",
    labelHostName: "On-site contact person",
    labelVisitEndAt: "Visit end",
    visitorHint: "Visitors are valid for a few hours or until end of day. Open check-ins are automatically checked out at 00:00 at the latest, but the card is retained for reporting.",
    labelWorkerStatus: "Status",
    optStatusActive: "Active",
    optStatusLocked: "Blocked",
    optStatusExpired: "Expired",
    labelBadgePin: "Badge PIN for app login",
    btnStartCamera: "Start camera",
    btnCapturePhoto: "Take photo",
    btnUploadPhoto: "Upload photo",
    btnPhotoUp: "\u2191 Up",
    btnPhotoLeft: "\u2190 Left",
    btnPhotoRight: "Right \u2192",
    btnPhotoDown: "Down \u2193",
    btnPhotoReset: "Reset position",
    btnWorkerSubmit: "Save worker and generate badge",
    btnWorkerCancelEdit: "Cancel editing",
    workersListEyebrow: "Records",
    workersListH3: "Registered Workers",
    btnWorkerCsv: "Download worker list as PDF",
    btnBulkDelete: "Delete selected",
    btnBulkActive: "Set active",
    btnBulkInactive: "Set inactive",
    btnBulkCancel: "Cancel",
    badgeEyebrow: "Digital Badge",
    badgeH3: "Badge Preview",
    badgeEmptyState: "Please create or select a worker first.",
    badgeScanEyebrow: "Scan Help",
    badgeScanH3: "Badge Code",
    badgeScanEmpty: "No badge selected.",
    badgeTitleVisitor: "Digital Visitor Card",
    badgeTitleDayPass: "Digital Site Day Pass",
    badgeTitleRegular: "Digital Site Badge",
    badgeUnknownCompany: "Unknown Company",
    badgeQrHint: "Scan QR, install app and open badge directly.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "QR Function",
    badgeMetaQrFuncVal: "Worker App Installation",
    badgeMetaRoleLabel: "Role in System",
    badgePhotoUploadHint: "Take or upload photo",
    appPinLabel: "App PIN",
    pinNotRequired: "not required",
    pinSet: "set",
    pinMissing: "missing",
    cardLabel: "Card",
    cardUnassigned: "not assigned",
    btnEdit: "Edit",
    btnDelete: "Delete",
    btnRestore: "Restore",
    btnAppLink: "App link",
    btnResetPin: "Reset PIN",
    confirmDeleteWorker: "Delete worker now?",
    alertDeleteWorkerFailed: "Worker could not be deleted: {error}",
    alertRestoreWorkerFailed: "Worker could not be restored: {error}",
    alertAppLinkCreateFailed: "App link could not be created: {error}",
    promptResetPinFor: "New badge PIN for {name} (4-8 digits):",
    alertPinMustDigits: "PIN must contain 4 to 8 digits.",
    alertPinResetSuccessFor: "PIN for {name} was reset successfully.",
    alertPinResetFailed: "PIN could not be reset: {error}",
    detailCloseTitle: "Close",
    detailPhotoAlt: "Worker photo",
    detailCheckinBtn: "Check in",
    detailCheckoutBtn: "Check out",
    accessFormEyebrow: "Turnstile",
    accessFormH3: "Check-in and Check-out",
    labelAccessBadge: "Badge ID or Worker",
    labelAccessDir: "Direction",
    labelAccessGate: "Gate",
    labelAccessNote: "Note",
    optCheckin: "Check-in",
    optCheckout: "Check-out",
    btnAccessSubmit: "Book access",
    porterEmpty: "Porter live view: Select worker and book access.",
    accessLogEyebrow: "Access Journal",
    accessLogH3: "Entry and exit with timestamp",
    labelFrom: "From",
    labelTo: "To",
    labelFilterDir: "Direction",
    labelFilterGate: "Gate",
    optAllDir: "All",
    btnApplyFilter: "Apply filter",
    btnResetFilter: "Reset filter",
    btnAccessCsv: "Export access CSV",
    dailyReportEyebrow: "Daily Report",
    dailyReportH3: "Per gate",
    btnPrintDaily: "Print daily report",
    btnPrintVisitorWeekly: "Print visitor weekly list",
    hourlyEyebrow: "Hourly Analysis",
    hourlyH3: "Entry/Exit per hour",
    warningsEyebrow: "Warnings",
    warningsH3: "Entry without exit",
    invListEyebrow: "Billing",
    invListH3: "Invoices & Payment Status",
    optAllStatus: "All statuses",
    optDraft: "Draft",
    optSent: "Sent",
    optOverdue: "Overdue",
    optPaid: "Paid",
    optFailed: "Error",
    btnRefreshList: "Refresh",
    inkassoEyebrow: "Collections",
    inkassoH3: "Overdue, pre-block, blocked",
    optAllPositions: "All open items",
    optPrelock: "Pre-block",
    optLocked: "Already blocked",
    adminEyebrow: "Admin Center",
    adminH3: "System & Configuration",
    sysStatusEyebrow: "System Status",
    sysStatusH3: "Emergency Access & Repair",
    btnRefreshStatus: "Reload status",
    btnRepairSessions: "Repair sessions",
    superAdminEyebrow: "System Control",
    superAdminH3: "Super Admin Settings",
    labelPlatformName: "Platform name",
    labelOperatorName: "Operator",
    labelTurnstileEp: "Turnstile API endpoint",
    labelSmtpHost: "SMTP host",
    labelSmtpPort: "SMTP port",
    labelSmtpUser: "SMTP user",
    labelSmtpPass: "SMTP password",
    labelSenderEmail: "Sender email",
    labelSenderName: "Sender name",
    labelTls: "TLS active",
    optTlsYes: "Yes",
    optTlsNo: "No",
    optYes: "Yes",
    optNo: "No",
    labelIpWhitelist: "Admin IP whitelist (comma separated, optional CIDR)",
    labelEnforceDomain: "Enforce company domain",
    btnSaveAdmin: "Save admin settings",
    companyNewEyebrow: "Tenants",
    companyNewH3: "Create New Construction Company",
    labelCompanyName: "Company name",
    labelCompanyContact: "Contact person",
    labelBillingEmail: "Billing email",
    labelAccessHost: "Company access domain",
    labelPlan: "Plan",
    labelCompanyStatus: "Status",
    optCompanyActive: "Active",
    optCompanyTest: "Trial",
    optCompanyPaused: "Paused",
    optCompanyLocked: "Blocked due to overdue payment",
    labelCompanyAdminPassword: "Admin start password",
    companyAdminPasswordPlaceholder: "e.g. Secure!2025",
    btnCreateCompany: "Create company",
    accountEyebrow: "Account",
    accountH3: "Change Password",
    labelCurrentPassword: "Current password",
    labelNewPassword: "New password",
    btnChangePassword: "Change password",
    tfaEyebrow: "Two-Factor",
    tfaH3: "2FA Management",
    companiesListEyebrow: "Tenants",
    companiesListH3: "Companies & Plans",
    invFormEyebrow: "Invoices",
    invFormH3: "Send with logo and branding",
    labelInvFirm: "Company",
    labelInvNumber: "Invoice number",
    labelInvRecipient: "Recipient email",
    labelInvDate: "Invoice date",
    labelInvDueDate: "Due date",
    labelInvPeriod: "Service period",
    labelInvDescription: "Service description",
    labelInvNet: "Net amount (EUR)",
    labelInvVat: "VAT (%)",
    btnPrintInvoice: "Print invoice / save as PDF",
    btnSendInvoice: "Send invoice by email",
    btnUpdatePreview: "Update preview",
    auditEyebrow: "Security Log",
    auditH3: "Audit Log",
    labelAuditEvent: "Event type",
    labelAuditRole: "Role",
    btnAuditCsv: "Export audit CSV",
  },
  tr: {
    authEyebrow: "Giriş Sayfası",
    authTitle: "BauPass Control'a Güvenli Giriş",
    authCopy: "Süper admin tüm sistem kontrolünü elinde tutar. Firma adminleri yalnızca kendi firmalarını görür. Turnike girişi hızlı geçiş moduna sahiptir.",
    authPlatform: "Platform",
    authOperator: "İşletmeci",
    authTurnstile: "Turnike Uç Noktası",
    loginUsernameLabel: "Kullanıcı adı",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Şifre",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "OTP kodu (2FA aktifse)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Dil",
    loginScopeLabel: "Erişim tipi",
    loginScopeAuto: "Otomatik",
    loginScopeServerAdmin: "Sunucu Yöneticisi",
    loginScopeCompanyAdmin: "Firma Yöneticisi",
    loginScopeTurnstile: "Turnike",
    loginButton: "Giriş yap",
    demoAccessTitle: "Demo Hesaplar",
    demoSuperAdmin: "Süper Admin: superadmin / 1234",
    demoCompanyAdmin: "Firma Yöneticisi: firma / 1234",
    demoTurnstile: "Turnike: drehkreuz / 1234",
    desktopAppTitle: "Masaüstü Uygulaması",
    desktopInstallHint: "Bu portal bilgisayarınıza yerel uygulama gibi kurulabilir.",
    desktopInstallButton: "Bu bilgisayara yükle",
    // Shell (nav + buttons + headings)
    sidebarEyebrow: "Firma Portali",
    sidebarCopy: "\u00c7al\u0131\u015fanlar\u0131 kaydet, foto\u011fraf \u00e7ek, dijital kimlik kart\u0131 olu\u015ftur ve turnike giri\u015fini y\u00f6net.",
    sidebarCardTitle: "Kiralama Modu",
    sidebarCardStrong: "\u00c7ok Firmaya Uygun",
    sidebarCardDesc: "Her in\u015faat firmas\u0131 kendi ekibini ayr\u0131 y\u00f6netir. S\u00fcper admin sistem kontroln\u00fc elinde tutar.",
    navDashboard: "Kontrol Paneli",
    navWorkers: "\u00c7al\u0131\u015fanlar",
    navBadge: "Rozet",
    navAccess: "Giri\u015f",
    navInvoices: "Faturalar",
    navAdmin: "Y\u00f6netim",
    topbarEyebrow: "Sistem Durumu",
    topbarHeading: "\u0130n\u015faat Rozetleri ve Giri\u015f Kontrol",
    btnSeedData: "Demo veri ekle",
    btnExport: "Sistemi d\u0131\u015fa aktar",
    btnImport: "Sistemi i\u00e7e aktar",
    btnLogout: "G\u00fcvenli \u00e7\u0131k\u0131\u015f",
    dashEyebrow: "Geli\u015ftirilmi\u015f MVP",
    dashHeading: "Foto\u011frafl\u0131, Badge ID\u2019li dijital kimlikler ve turnike check-in",
    dashSubtext: "Prototip, in\u015faat firmalar\u0131na kiralama i\u00e7in tasarlanm\u0131\u015ft\u0131r.",
    dashBadge1: "Foto\u011fraf \u00c7ekimi",
    dashBadge2: "Giri\u015f Kayd\u0131",
    dashBadge3: "\u00c7ok Kirac\u0131l\u0131",
    reportingEyebrow: "Raporlama",
    reportingH3: "\u00d6deme ve Engelleme Durumu",
    accessWeekEyebrow: "7 G\u00fcn",
    accessWeekH3: "G\u00fcnl\u00fck Giri\u015f",
    recentEyebrow: "Son Aktiviteler",
    recentH3: "Giri\u015f Kayd\u0131",
    porterLiveEmpty: "Bir check-in veya check-out oldu\u011funda son giri\u015f burada g\u00f6r\u00fcnt\u00fclenecek.",
    workersFormEyebrow: "Ana Veriler",
    workersFormH3: "\u00c7al\u0131\u015fan veya Ziyaret\u00e7i Kaydet",
    labelType: "Tip",
    optWorker: "\u00c7al\u0131\u015fan",
    optVisitor: "Ziyaret\u00e7i",
    labelFirm: "Firma",
    labelSubcompany: "Alt Firma",
    optNoSubcompany: "Alt firma yok",
    labelNewSubcompany: "Yeni Alt Firma",
    btnAddSubcompany: "Alt firma olu\u015ftur",
    labelFirstName: "Ad",
    labelLastName: "Soyad",
    labelInsuranceNumber: "Sigorta numaras\u0131",
    labelRoleField: "G\u00f6rev",
    labelSite: "\u015eantiye",
    labelPhysicalCard: "Fiziksel Kart ID (NFC/RFID)",
    labelValidUntil: "Ge\u00e7erlilik tarihi",
    labelVisitorCompany: "Ziyaret\u00e7i firmas\u0131",
    labelVisitPurpose: "Ziyaret amac\u0131",
    labelHostName: "Sahada ileti\u015fim ki\u015fisi",
    labelVisitEndAt: "Ziyaret biti\u015fi",
    visitorHint: "Ziyaretçiler birkaç saat veya gün sonuna kadar geçerlidir. Açık girişler en geç 00:00'da otomatik olarak çıkış yapar, kart raporlama için saklanır.",
    labelWorkerStatus: "Durum",
    optStatusActive: "Aktif",
    optStatusLocked: "Engelli",
    optStatusExpired: "S\u00fcresi doldu",
    labelBadgePin: "Uygulama giri\u015fi i\u00e7in Badge PIN",
    btnStartCamera: "Kameray\u0131 ba\u015flat",
    btnCapturePhoto: "Foto\u011fraf \u00e7ek",
    btnUploadPhoto: "Foto\u011fraf y\u00fckle",
    btnPhotoUp: "\u2191 Yukar\u0131",
    btnPhotoLeft: "\u2190 Sol",
    btnPhotoRight: "Sa\u011f \u2192",
    btnPhotoDown: "A\u015fa\u011f\u0131 \u2193",
    btnPhotoReset: "Konumu s\u0131f\u0131rla",
    btnWorkerSubmit: "\u00c7al\u0131\u015fan\u0131 kaydet ve rozet olu\u015ftur",
    btnWorkerCancelEdit: "D\u00fczenli\u015f i\u00e7in iptal",
    workersListEyebrow: "Kay\u0131tlar",
    workersListH3: "Kay\u0131tl\u0131 \u00c7al\u0131\u015fanlar",
    btnWorkerCsv: "\u00c7al\u0131\u015fan listesini PDF olarak indir",
    btnBulkDelete: "Se\u00e7ilenleri sil",
    btnBulkActive: "Durumu: aktif",
    btnBulkInactive: "Durumu: pasif",
    btnBulkCancel: "\u0130ptal",
    badgeEyebrow: "Dijital Kimlik",
    badgeH3: "Rozet \u00d6nizleme",
    badgeEmptyState: "L\u00fctfen \u00f6nce bir \u00e7al\u0131\u015fan olu\u015fturun veya listeden se\u00e7in.",
    badgeScanEyebrow: "Tarama Yard\u0131m\u0131",
    badgeScanH3: "Rozet Kodu",
    badgeScanEmpty: "Rozet se\u00e7ilmedi.",
    accessFormEyebrow: "Turnike",
    accessFormH3: "Check-in ve Check-out",
    labelAccessBadge: "Badge ID veya \u00c7al\u0131\u015fan",
    labelAccessDir: "Y\u00f6n",
    labelAccessGate: "Kap\u0131",
    labelAccessNote: "Not",
    optCheckin: "Check-in",
    optCheckout: "Check-out",
    btnAccessSubmit: "Giri\u015f kaydet",
    porterEmpty: "Kap\u0131c\u0131 canl\u0131 g\u00f6r\u00fcn\u00fcm\u00fc: \u00c7al\u0131\u015fan se\u00e7 ve giri\u015fi kaydet.",
    accessLogEyebrow: "Giri\u015f G\u00fcnl\u00fc\u011f\u00fc",
    accessLogH3: "Zaman damgal\u0131 giri\u015f ve \u00e7\u0131k\u0131\u015f",
    labelFrom: "Ba\u015flang\u0131\u00e7",
    labelTo: "Biti\u015f",
    labelFilterDir: "Y\u00f6n",
    labelFilterGate: "Turnike",
    optAllDir: "T\u00fcm\u00fc",
    btnApplyFilter: "Filtre uygula",
    btnResetFilter: "Filtreyi s\u0131f\u0131rla",
    btnAccessCsv: "Giri\u015f CSV disa aktar",
    dailyReportEyebrow: "G\u00fcnl\u00fck Rapor",
    dailyReportH3: "Kapiya g\u00f6re",
    btnPrintDaily: "G\u00fcnl\u00fck rapor yazd\u0131r",
    btnPrintVisitorWeekly: "Haftal\u0131k ziyaret\u00e7i listesi yazd\u0131r",
    hourlyEyebrow: "Saatlik Analiz",
    hourlyH3: "Saate g\u00f6re giri\u015f/\u00e7\u0131k\u0131\u015f",
    warningsEyebrow: "Uyar\u0131lar",
    warningsH3: "\u00c7\u0131k\u0131\u015fs\u0131z giri\u015f",
    invListEyebrow: "Faturaland\u0131rma",
    invListH3: "Faturalar ve \u00d6deme Durumu",
    optAllStatus: "T\u00fcm durumlar",
    optDraft: "Taslak",
    optSent: "G\u00f6nderildi",
    optOverdue: "Vadesi ge\u00e7mi\u015f",
    optPaid: "\u00d6dendi",
    optFailed: "Hata",
    btnRefreshList: "Yenile",
    inkassoEyebrow: "Tahsilat",
    inkassoH3: "Vadesi ge\u00e7mi\u015f, \u00f6n engel, engellendi",
    optAllPositions: "T\u00fcm a\u00e7\u0131k kalemler",
    optPrelock: "\u00d6n engel",
    optLocked: "Zaten engellendi",
    adminEyebrow: "Y\u00f6netim Merkezi",
    adminH3: "Sistem & Yap\u0131land\u0131rma",
    sysStatusEyebrow: "Sistem Durumu",
    sysStatusH3: "Acil Eri\u015fim & Onar\u0131m",
    btnRefreshStatus: "Durumu yenile",
    btnRepairSessions: "Oturumlar\u0131 onar",
    superAdminEyebrow: "Sistem Kontrolu",
    superAdminH3: "S\u00fcper Admin Ayarlar\u0131",
    labelPlatformName: "Platform ad\u0131",
    labelOperatorName: "\u0130\u015flet",
    labelTurnstileEp: "Turnike API endpoint",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "SMTP Kullan\u0131c\u0131s\u0131",
    labelSmtpPass: "SMTP \u015eifre",
    labelSenderEmail: "G\u00f6nderen E-Posta",
    labelSenderName: "G\u00f6nderen Ad\u0131",
    labelTls: "TLS aktif",
    optTlsYes: "Evet",
    optTlsNo: "Hay\u0131r",
    optYes: "Evet",
    optNo: "Hay\u0131r",
    labelIpWhitelist: "Admin IP beyaz listesi",
    labelEnforceDomain: "Firma domain zorla",
    btnSaveAdmin: "Admin ayarlar\u0131n\u0131 kaydet",
    companyNewEyebrow: "Kirac\u0131lar",
    companyNewH3: "Yeni \u0130n\u015faat Firmas\u0131 Ekle",
    labelCompanyName: "Firma ad\u0131",
    labelCompanyContact: "\u0130leti\u015fim ki\u015fisi",
    labelBillingEmail: "Fatura e-postas\u0131",
    labelAccessHost: "Firma eri\u015fim alan\u0131",
    labelPlan: "Plan",
    labelCompanyStatus: "Durum",
    optCompanyActive: "Aktif",
    optCompanyTest: "Deneme",
    optCompanyPaused: "Askıya alındı",
    optCompanyLocked: "\u00d6deme gecikmi\u015f, engellendi",
    labelCompanyAdminPassword: "Yönetici başlangıç şifresi",
    companyAdminPasswordPlaceholder: "Örn. Güvenli!2025",
    btnCreateCompany: "Firma olu\u015ftur",
    accountEyebrow: "Hesap",
    accountH3: "\u015eifreyi De\u011fi\u015ftir",
    labelCurrentPassword: "Mevcut \u015fifre",
    labelNewPassword: "Yeni \u015fifre",
    btnChangePassword: "\u015eifreyi de\u011fi\u015ftir",
    tfaEyebrow: "\u0130ki Fakt\u00f6r",
    tfaH3: "2FA Y\u00f6netimi",
    companiesListEyebrow: "Kirac\u0131lar",
    companiesListH3: "Firmalar ve Planlar",
    invFormEyebrow: "Faturalar",
    invFormH3: "Logo ve tasar\u0131mla g\u00f6nder",
    labelInvFirm: "Firma",
    labelInvNumber: "Fatura numaras\u0131",
    labelInvRecipient: "Al\u0131c\u0131 e-postas\u0131",
    labelInvDate: "Fatura tarihi",
    labelInvDueDate: "Son \u00f6deme tarihi",
    labelInvPeriod: "Hizmet d\u00f6nemi",
    labelInvDescription: "Hizmet a\u00e7\u0131klamas\u0131",
    labelInvNet: "Net tutar (EUR)",
    labelInvVat: "KDV (%)",
    btnPrintInvoice: "Faturay\u0131 yazd\u0131r / PDF kaydet",
    btnSendInvoice: "Faturay\u0131 e-postayla g\u00f6nder",
    btnUpdatePreview: "\u00d6nizlemeyi g\u00fcncelle",
    auditEyebrow: "G\u00fcvenlik Kayd\u0131",
    auditH3: "Denetim Kayd\u0131",
    labelAuditEvent: "Olay tipi",
    labelAuditRole: "Rol",
    btnAuditCsv: "Denetim CSV disa aktar",
    // Shell (nav + buttons + headings)
    sidebarEyebrow: "Firma Portali",
    sidebarCopy: "\u00c7al\u0131\u015fanlar\u0131 kaydet, foto\u011fraf \u00e7ek, dijital kimlik kart\u0131 olu\u015ftur ve turnike giri\u015fini y\u00f6net.",
    sidebarCardTitle: "Kiralama Modu",
    sidebarCardStrong: "\u00c7ok Firmaya Uygun",
    sidebarCardDesc: "Her in\u015faat firmas\u0131 kendi ekibini ayr\u0131 y\u00f6netir. S\u00fcper admin sistem kontroln\u00fc elinde tutar.",
    navDashboard: "Kontrol Paneli",
    navWorkers: "\u00c7al\u0131\u015fanlar",
    navBadge: "Rozet",
    navAccess: "Giri\u015f",
    navInvoices: "Faturalar",
    navAdmin: "Y\u00f6netim",
    topbarEyebrow: "Sistem Durumu",
    topbarHeading: "\u0130n\u015faat Rozetleri ve Giri\u015f Kontrol",
    btnSeedData: "Demo veri ekle",
    btnExport: "Sistemi d\u0131\u015fa aktar",
    btnImport: "Sistemi i\u00e7e aktar",
    btnLogout: "G\u00fcvenli \u00e7\u0131k\u0131\u015f",
    dashEyebrow: "Geli\u015ftirilmi\u015f MVP",
    dashHeading: "Foto\u011frafl\u0131, Badge ID\u2019li dijital kimlikler ve turnike check-in",
    dashSubtext: "Prototip, in\u015faat firmalar\u0131na kiralama i\u00e7in tasarlanm\u0131\u015ft\u0131r.",
    dashBadge1: "Foto\u011fraf \u00c7ekimi",
    dashBadge2: "Giri\u015f Kayd\u0131",
    dashBadge3: "\u00c7ok Kirac\u0131l\u0131",
    reportingEyebrow: "Raporlama",
    reportingH3: "\u00d6deme ve Engelleme Durumu",
    accessWeekEyebrow: "7 G\u00fcn",
    accessWeekH3: "G\u00fcnl\u00fck Giri\u015f",
    recentEyebrow: "Son Aktiviteler",
    recentH3: "Giri\u015f Kayd\u0131",
    porterLiveEmpty: "Bir check-in veya check-out oldu\u011funda son giri\u015f burada g\u00f6r\u00fcnt\u00fclenecek.",
    workersFormEyebrow: "Ana Veriler",
    workersFormH3: "\u00c7al\u0131\u015fan veya Ziyaret\u00e7i Kaydet",
    labelType: "Tip",
    optWorker: "\u00c7al\u0131\u015fan",
    optVisitor: "Ziyaret\u00e7i",
    labelFirm: "Firma",
    labelSubcompany: "Alt Firma",
    optNoSubcompany: "Alt firma yok",
    labelNewSubcompany: "Yeni Alt Firma",
    btnAddSubcompany: "Alt firma olu\u015ftur",
    labelFirstName: "Ad",
    labelLastName: "Soyad",
    labelInsuranceNumber: "Sigorta numaras\u0131",
    labelRoleField: "G\u00f6rev",
    labelSite: "\u015eantiye",
    labelPhysicalCard: "Fiziksel Kart ID (NFC/RFID)",
    labelValidUntil: "Ge\u00e7erlilik tarihi",
    labelVisitorCompany: "Ziyaret\u00e7i firmas\u0131",
    labelVisitPurpose: "Ziyaret amac\u0131",
    labelHostName: "Sahada ileti\u015fim ki\u015fisi",
    labelVisitEndAt: "Ziyaret biti\u015fi",
    visitorHint: "Ziyaretçiler birkaç saat veya gün sonuna kadar geçerlidir. Açık girişler en geç 00:00'da otomatik olarak çıkış yapar, kart raporlama için saklanır.",
    labelWorkerStatus: "Durum",
    optStatusActive: "Aktif",
    optStatusLocked: "Engelli",
    optStatusExpired: "S\u00fcresi doldu",
    labelBadgePin: "Uygulama giri\u015fi i\u00e7in Badge PIN",
    btnStartCamera: "Kameray\u0131 ba\u015flat",
    btnCapturePhoto: "Foto\u011fraf \u00e7ek",
    btnUploadPhoto: "Foto\u011fraf y\u00fckle",
    btnPhotoUp: "\u2191 Yukar\u0131",
    btnPhotoLeft: "\u2190 Sol",
    btnPhotoRight: "Sa\u011f \u2192",
    btnPhotoDown: "A\u015fa\u011f\u0131 \u2193",
    btnPhotoReset: "Konumu s\u0131f\u0131rla",
    btnWorkerSubmit: "\u00c7al\u0131\u015fan\u0131 kaydet ve rozet olu\u015ftur",
    btnWorkerCancelEdit: "D\u00fczenli\u015f i\u00e7in iptal",
    workersListEyebrow: "Kay\u0131tlar",
    workersListH3: "Kay\u0131tl\u0131 \u00c7al\u0131\u015fanlar",
    btnWorkerCsv: "\u00c7al\u0131\u015fan listesini PDF olarak indir",
    btnBulkDelete: "Se\u00e7ilenleri sil",
    btnBulkActive: "Durumu: aktif",
    btnBulkInactive: "Durumu: pasif",
    btnBulkCancel: "\u0130ptal",
    badgeEyebrow: "Dijital Kimlik",
    badgeH3: "Rozet \u00d6nizleme",
    badgeEmptyState: "L\u00fctfen \u00f6nce bir \u00e7al\u0131\u015fan olu\u015fturun veya listeden se\u00e7in.",
    badgeScanEyebrow: "Tarama Yard\u0131m\u0131",
    badgeScanH3: "Rozet Kodu",
    badgeScanEmpty: "Rozet se\u00e7ilmedi.",
    badgeTitleVisitor: "Dijital Ziyaret\u00e7i Kart\u0131",
    badgeTitleDayPass: "Dijital \u015eantiye G\u00fcnl\u00fck Kart\u0131",
    badgeTitleRegular: "Dijital \u015eantiye Rozeti",
    badgeUnknownCompany: "Bilinmeyen Firma",
    badgeQrHint: "QR kodu tara, uygulamas\u0131 y\u00fckle ve rozeti do\u011frudan a\u00e7.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "QR Fonksiyonu",
    badgeMetaQrFuncVal: "\u00c7al\u0131\u015fan Uygulamas\u0131 Kurulumu",
    badgeMetaRoleLabel: "Sistemdeki Rol",
    badgePhotoUploadHint: "Foto\u011fraf \u00e7ek veya y\u00fckle",
    appPinLabel: "Uygulama PIN",
    pinNotRequired: "gerekli degil",
    pinSet: "ayarli",
    pinMissing: "eksik",
    cardLabel: "Kart",
    cardUnassigned: "atanmamis",
    btnEdit: "Duzenle",
    btnDelete: "Sil",
    btnRestore: "Geri yukle",
    btnAppLink: "Uygulama linki",
    btnResetPin: "PIN sifirla",
    confirmDeleteWorker: "Calisan silinsin mi?",
    alertDeleteWorkerFailed: "Calisan silinemedi: {error}",
    alertRestoreWorkerFailed: "Calisan geri yuklenemedi: {error}",
    alertAppLinkCreateFailed: "Uygulama linki olusturulamadi: {error}",
    promptResetPinFor: "{name} icin yeni rozet PIN'i (4-8 hane):",
    alertPinMustDigits: "PIN 4 ila 8 hane olmali.",
    alertPinResetSuccessFor: "{name} icin PIN basariyla sifirlandi.",
    alertPinResetFailed: "PIN sifirlanamadi: {error}",
    detailCloseTitle: "Kapat",
    detailPhotoAlt: "Calisan fotografi",
    detailCheckinBtn: "Giris (Check-in)",
    detailCheckoutBtn: "Cikis (Check-out)",
    accessFormEyebrow: "Turnike",
    accessFormH3: "Check-in ve Check-out",
    labelAccessBadge: "Badge ID veya \u00c7al\u0131\u015fan",
    labelAccessDir: "Y\u00f6n",
    labelAccessGate: "Kap\u0131",
    labelAccessNote: "Not",
    optCheckin: "Check-in",
    optCheckout: "Check-out",
    btnAccessSubmit: "Giri\u015f kaydet",
    porterEmpty: "Kap\u0131c\u0131 canl\u0131 g\u00f6r\u00fcn\u00fcm\u00fc: \u00c7al\u0131\u015fan se\u00e7 ve giri\u015fi kaydet.",
    accessLogEyebrow: "Giri\u015f G\u00fcnl\u00fc\u011f\u00fc",
    accessLogH3: "Zaman damgal\u0131 giri\u015f ve \u00e7\u0131k\u0131\u015f",
    labelFrom: "Ba\u015flang\u0131\u00e7",
    labelTo: "Biti\u015f",
    labelFilterDir: "Y\u00f6n",
    labelFilterGate: "Turnike",
    optAllDir: "T\u00fcm\u00fc",
    btnApplyFilter: "Filtre uygula",
    btnResetFilter: "Filtreyi s\u0131f\u0131rla",
    btnAccessCsv: "Giri\u015f CSV disa aktar",
    dailyReportEyebrow: "G\u00fcnl\u00fck Rapor",
    dailyReportH3: "Kapiya g\u00f6re",
    btnPrintDaily: "G\u00fcnl\u00fck rapor yazd\u0131r",
    btnPrintVisitorWeekly: "Haftal\u0131k ziyaret\u00e7i listesi yazd\u0131r",
    hourlyEyebrow: "Saatlik Analiz",
    hourlyH3: "Saate g\u00f6re giri\u015f/\u00e7\u0131k\u0131\u015f",
    warningsEyebrow: "Uyar\u0131lar",
    warningsH3: "\u00c7\u0131k\u0131\u015fs\u0131z giri\u015f",
    invListEyebrow: "Faturaland\u0131rma",
    invListH3: "Faturalar ve \u00d6deme Durumu",
    optAllStatus: "T\u00fcm durumlar",
    optDraft: "Taslak",
    optSent: "G\u00f6nderildi",
    optOverdue: "Vadesi ge\u00e7mi\u015f",
    optPaid: "\u00d6dendi",
    optFailed: "Hata",
    btnRefreshList: "Yenile",
    inkassoEyebrow: "Tahsilat",
    inkassoH3: "Vadesi ge\u00e7mi\u015f, \u00f6n engel, engellendi",
    optAllPositions: "T\u00fcm a\u00e7\u0131k kalemler",
    optPrelock: "\u00d6n engel",
    optLocked: "Zaten engellendi",
    adminEyebrow: "Y\u00f6netim Merkezi",
    adminH3: "Sistem & Yap\u0131land\u0131rma",
    sysStatusEyebrow: "Sistem Durumu",
    sysStatusH3: "Acil Eri\u015fim & Onar\u0131m",
    btnRefreshStatus: "Durumu yenile",
    btnRepairSessions: "Oturumlar\u0131 onar",
    superAdminEyebrow: "Sistem Kontrolu",
    superAdminH3: "S\u00fcper Admin Ayarlar\u0131",
    labelPlatformName: "Platform ad\u0131",
    labelOperatorName: "\u0130\u015flet",
    labelTurnstileEp: "Turnike API endpoint",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "SMTP Kullan\u0131c\u0131s\u0131",
    labelSmtpPass: "SMTP \u015eifre",
    labelSenderEmail: "G\u00f6nderen E-Posta",
    labelSenderName: "G\u00f6nderen Ad\u0131",
    labelTls: "TLS aktif",
    optTlsYes: "Evet",
    optTlsNo: "Hay\u0131r",
    optYes: "Evet",
    optNo: "Hay\u0131r",
    labelIpWhitelist: "Admin IP beyaz listesi",
    labelEnforceDomain: "Firma domain zorla",
    btnSaveAdmin: "Admin ayarlar\u0131n\u0131 kaydet",
    companyNewEyebrow: "Kirac\u0131lar",
    companyNewH3: "Yeni \u0130n\u015faat Firmas\u0131 Ekle",
    labelCompanyName: "Firma ad\u0131",
    labelCompanyContact: "\u0130leti\u015fim ki\u015fisi",
    labelBillingEmail: "Fatura e-postas\u0131",
    labelAccessHost: "Firma eri\u015fim alan\u0131",
    labelPlan: "Plan",
    labelCompanyStatus: "Durum",
    optCompanyActive: "Aktif",
    optCompanyTest: "Deneme",
    optCompanyPaused: "Askıya alındı",
    optCompanyLocked: "\u00d6deme gecikmi\u015f, engellendi",
    labelCompanyAdminPassword: "Yönetici başlangıç şifresi",
    companyAdminPasswordPlaceholder: "Örn. Güvenli!2025",
    btnCreateCompany: "Firma olu\u015ftur",
    accountEyebrow: "Hesap",
    accountH3: "\u015eifreyi De\u011fi\u015ftir",
    labelCurrentPassword: "Mevcut \u015fifre",
    labelNewPassword: "Yeni \u015fifre",
    btnChangePassword: "\u015eifreyi de\u011fi\u015ftir",
    tfaEyebrow: "\u0130ki Fakt\u00f6r",
    tfaH3: "2FA Y\u00f6netimi",
    companiesListEyebrow: "Kirac\u0131lar",
    companiesListH3: "Firmalar ve Planlar",
    invFormEyebrow: "Faturalar",
    invFormH3: "Logo ve tasar\u0131mla g\u00f6nder",
    labelInvFirm: "Firma",
    labelInvNumber: "Fatura numaras\u0131",
    labelInvRecipient: "Al\u0131c\u0131 e-postas\u0131",
    labelInvDate: "Fatura tarihi",
    labelInvDueDate: "Son \u00f6deme tarihi",
    labelInvPeriod: "Hizmet d\u00f6nemi",
    labelInvDescription: "Hizmet a\u00e7\u0131klamas\u0131",
    labelInvNet: "Net tutar (EUR)",
    labelInvVat: "KDV (%)",
    btnPrintInvoice: "Faturay\u0131 yazd\u0131r / PDF kaydet",
    btnSendInvoice: "Faturay\u0131 e-postayla g\u00f6nder",
    btnUpdatePreview: "\u00d6nizlemeyi g\u00fcncelle",
    auditEyebrow: "G\u00fcvenlik Kayd\u0131",
    auditH3: "Denetim Kayd\u0131",
    labelAuditEvent: "Olay tipi",
    labelAuditRole: "Rol",
    btnAuditCsv: "Denetim CSV disa aktar",
  },
  ar: {
    authEyebrow: "صفحة تسجيل الدخول",
    authTitle: "تسجيل دخول آمن إلى BauPass Control",
    authCopy: "يمتلك المشرف العام التحكم الكامل بالنظام. مديرو الشركات يرون شركتهم فقط. تسجيل دخول البوابة الدوّارة يوفر وضع وصول سريع.",
    authPlatform: "المنصة",
    authOperator: "المشغّل",
    authTurnstile: "نقطة نهاية البوابة",
    loginUsernameLabel: "اسم المستخدم",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "كلمة المرور",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "رمز OTP (إذا كانت 2FA مفعلة)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "اللغة",
    loginScopeLabel: "نوع الوصول",
    loginScopeAuto: "تلقائي",
    loginScopeServerAdmin: "مدير الخادم",
    loginScopeCompanyAdmin: "مدير الشركة",
    loginScopeTurnstile: "البوابة الدوارة",
    loginButton: "تسجيل الدخول",
    demoAccessTitle: "حسابات تجريبية",
    demoSuperAdmin: "مشرف عام: superadmin / 1234",
    demoCompanyAdmin: "مدير شركة: firma / 1234",
    demoTurnstile: "البوابة: drehkreuz / 1234",
    desktopAppTitle: "تطبيق سطح المكتب",
    desktopInstallHint: "يمكن تثبيت هذه البوابة على الكمبيوتر كتطبيق محلي.",
    desktopInstallButton: "ثبّت على هذا الكمبيوتر",
    // Shell nav+buttons (full, AR - RTL)
    sidebarEyebrow: "بوابة الشركة",
    sidebarCopy: "تسجيل العمال، التقاط الصور، إنشاء بطاقات هوية رقمية وإدارة البوابات الدوارة.",
    sidebarCardTitle: "وضع التأجير",
    sidebarCardStrong: "دعم متعدد الشركات",
    sidebarCardDesc: "تدير كل شركة بناء فريقها بشكل مستقل. يحتفظ المشرف العام بالتحكم في النظام.",
    navDashboard: "لوحة التحكم",
    navWorkers: "العمال",
    navBadge: "بطاقة الهوية",
    navAccess: "الدخول",
    navInvoices: "الفواتير",
    navAdmin: "الإدارة",
    topbarEyebrow: "حالة النظام",
    topbarHeading: "بطاقات البناء والتحكم في الدخول",
    btnSeedData: "إدخال بيانات تجريبية",
    btnExport: "تصدير النظام",
    btnImport: "استيراد النظام",
    btnLogout: "تسجيل خروج آمن",
    dashEyebrow: "نموذج محسّن",
    dashHeading: "بطاقات رقمية مع صورة و Badge ID وتسجيل الدخول عند البوابة",
    dashSubtext: "مصمّم لتأجير شركات البناء.",
    dashBadge1: "التقاط الصور",
    dashBadge2: "سجل الدخول",
    dashBadge3: "تعدد المستأجرين",
    reportingEyebrow: "التقارير",
    reportingH3: "حالة الدفع والتجميد",
    accessWeekEyebrow: "7 أيام",
    accessWeekH3: "الدخول يومياً",
    recentEyebrow: "النشاط الأخير",
    recentH3: "سجل الدخول",
    porterLiveEmpty: "سيظهر آخر دخول عند أول تسجيل.",
    workersFormEyebrow: "البيانات الرئيسية",
    workersFormH3: "تسجيل عامل أو زائر",
    labelType: "النوع",
    optWorker: "عامل",
    optVisitor: "زائر",
    labelFirm: "الشركة",
    labelSubcompany: "شركة فرعية",
    optNoSubcompany: "بدون شركة فرعية",
    labelNewSubcompany: "شركة فرعية جديدة",
    btnAddSubcompany: "إنشاء شركة فرعية",
    labelFirstName: "الاسم الأول",
    labelLastName: "اسم العائلة",
    labelInsuranceNumber: "رقم التأمين",
    labelRoleField: "المنصب",
    labelSite: "موقع البناء",
    labelPhysicalCard: "معرّف البطاقة المادية (NFC/RFID)",
    labelValidUntil: "صالح حتى",
    labelVisitorCompany: "شركة الزائر",
    labelVisitPurpose: "غرض الزيارة",
    labelHostName: "جهة الاتصال في الموقع",
    labelVisitEndAt: "نهاية الزيارة",
    visitorHint: "الزوار صالحون لبضع ساعات أو حتى نهاية اليوم. يتم تسجيل خروج الدخلات المفتوحة تلقائيًا في منتصف الليل على أبعد تقدير، لكن البطاقة تُحفظ لأغراض التقارير.",
    labelWorkerStatus: "الحالة",
    optStatusActive: "نشط",
    optStatusLocked: "محظور",
    optStatusExpired: "منتهي الصلاحية",
    labelBadgePin: "Badge PIN لتسجيل الدخول",
    btnStartCamera: "تشغيل الكاميرا",
    btnCapturePhoto: "التقاط صورة",
    btnUploadPhoto: "رفع صورة",
    btnPhotoUp: "↑ للأعلى",
    btnPhotoLeft: "← يسار",
    btnPhotoRight: "يمين →",
    btnPhotoDown: "للأسفل ↓",
    btnPhotoReset: "إعادة ضبط الموضع",
    btnWorkerSubmit: "حفظ العامل وإنشاء البطاقة",
    btnWorkerCancelEdit: "إلغاء التحرير",
    workersListEyebrow: "السجلات",
    workersListH3: "العمال المسجلون",
    btnWorkerCsv: "تنزيل قائمة العمال PDF",
    btnBulkDelete: "حذف المحددة",
    btnBulkActive: "نشط",
    btnBulkInactive: "غير نشط",
    btnBulkCancel: "إلغاء",
    badgeEyebrow: "بطاقة رقمية",
    badgeH3: "معاينة البطاقة",
    badgeEmptyState: "يرجى إنشاء أو اختيار عامل أولاً.",
    badgeScanEyebrow: "مساعدة المسح",
    badgeScanH3: "رمز البطاقة",
    badgeScanEmpty: "لم يتم اختيار بطاقة.",
    badgeTitleVisitor: "بطاقة زائر رقمية",
    badgeTitleDayPass: "تصريح يومي رقمي للموقع",
    badgeTitleRegular: "بطاقة هوية رقمية للموقع",
    badgeUnknownCompany: "شركة غير معروفة",
    badgeQrHint: "امسح الرمز، ثبّت التطبيق وافتح البطاقة مباشرةً.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "وظيفة QR",
    badgeMetaQrFuncVal: "تثبيت تطبيق العمال",
    badgeMetaRoleLabel: "الدور في النظام",
    badgePhotoUploadHint: "التقط أو ارفع صورة",
    appPinLabel: "PIN التطبيق",
    pinNotRequired: "غير مطلوب",
    pinSet: "مضبوط",
    pinMissing: "مفقود",
    cardLabel: "البطاقة",
    cardUnassigned: "غير مخصصة",
    btnEdit: "تعديل",
    btnDelete: "حذف",
    btnRestore: "استعادة",
    btnAppLink: "رابط التطبيق",
    btnResetPin: "إعادة تعيين PIN",
    confirmDeleteWorker: "حذف العامل الآن؟",
    alertDeleteWorkerFailed: "تعذر حذف العامل: {error}",
    alertRestoreWorkerFailed: "تعذر استعادة العامل: {error}",
    alertAppLinkCreateFailed: "تعذر إنشاء رابط التطبيق: {error}",
    promptResetPinFor: "PIN جديد للشارة لـ {name} (4-8 أرقام):",
    alertPinMustDigits: "يجب أن يكون PIN من 4 إلى 8 أرقام.",
    alertPinResetSuccessFor: "تمت إعادة تعيين PIN لـ {name} بنجاح.",
    alertPinResetFailed: "تعذر إعادة تعيين PIN: {error}",
    detailCloseTitle: "إغلاق",
    detailPhotoAlt: "صورة العامل",
    detailCheckinBtn: "تسجيل دخول",
    detailCheckoutBtn: "تسجيل خروج",
    accessFormEyebrow: "البوابة الدوارة",
    accessFormH3: "تسجيل دخول وخروج",
    labelAccessBadge: "Badge ID أو عامل",
    labelAccessDir: "الاتجاه",
    labelAccessGate: "البوابة",
    labelAccessNote: "ملاحظة",
    optCheckin: "دخول",
    optCheckout: "خروج",
    btnAccessSubmit: "تسجيل الدخول",
    porterEmpty: "مشهد الحارس المباشر: اختر عاملاً وسجّل الدخول.",
    accessLogEyebrow: "سجل الدخول",
    accessLogH3: "دخول وخروج بتوقيت زمني",
    labelFrom: "من",
    labelTo: "إلى",
    labelFilterDir: "الاتجاه",
    labelFilterGate: "البوابة",
    optAllDir: "الكل",
    btnApplyFilter: "تطبيق الفلتر",
    btnResetFilter: "إعادة ضبط الفلتر",
    btnAccessCsv: "تصدير CSV الدخول",
    dailyReportEyebrow: "التقرير اليومي",
    dailyReportH3: "لكل بوابة",
    btnPrintDaily: "طباعة التقرير اليومي",
    btnPrintVisitorWeekly: "طباعة قائمة الزيار الأسبوعية",
    hourlyEyebrow: "التحليل بالساعة",
    hourlyH3: "دخول/خروج لكل ساعة",
    warningsEyebrow: "تحذيرات",
    warningsH3: "دخول بدون خروج",
    invListEyebrow: "الفواتير",
    invListH3: "الفواتير وحالة الدفع",
    optAllStatus: "جميع الحالات",
    optDraft: "مسودة",
    optSent: "مرسلة",
    optOverdue: "متأخرة",
    optPaid: "مدفوعة",
    optFailed: "خطأ",
    btnRefreshList: "تحديث",
    inkassoEyebrow: "التحصيل",
    inkassoH3: "متأخرة، مسبق الحظر، محظورة",
    optAllPositions: "جميع العناصر المفتوحة",
    optPrelock: "مسبق الحظر",
    optLocked: "محظور بالفعل",
    adminEyebrow: "مركز الإدارة",
    adminH3: "النظام والتكوين",
    sysStatusEyebrow: "حالة النظام",
    sysStatusH3: "وصول طارئ وإصلاح",
    btnRefreshStatus: "تحديث الحالة",
    btnRepairSessions: "إصلاح الجلسات",
    superAdminEyebrow: "التحكم الكامل",
    superAdminH3: "إعدادات المشرف العام",
    labelPlatformName: "اسم المنصة",
    labelOperatorName: "المشغّل",
    labelTurnstileEp: "نقطة نهاية API للبوابة",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "مستخدم SMTP",
    labelSmtpPass: "كلمة مرور SMTP",
    labelSenderEmail: "بريد المرسل",
    labelSenderName: "اسم المرسل",
    labelTls: "TLS نشط",
    optTlsYes: "نعم",
    optTlsNo: "لا",
    optYes: "نعم",
    optNo: "لا",
    labelIpWhitelist: "قائمة بيضاء IP للمشرف",
    labelEnforceDomain: "فرض دومين الشركة",
    btnSaveAdmin: "حفظ إعدادات المشرف",
    companyNewEyebrow: "المستأجرون",
    companyNewH3: "إضافة شركة بناء جديدة",
    labelCompanyName: "اسم الشركة",
    labelCompanyContact: "جهة الاتصال",
    labelBillingEmail: "بريد الفواتير",
    labelAccessHost: "نطاق وصول الشركة",
    labelPlan: "الخطة",
    labelCompanyStatus: "الحالة",
    optCompanyActive: "نشط",
    optCompanyTest: "تجريبي",
    optCompanyPaused: "موقوف مؤقتاً",
    optCompanyLocked: "محظور بسبب تأخر الدفع",
    labelCompanyAdminPassword: "كلمة مرور المشرف الأولية",
    companyAdminPasswordPlaceholder: "مثال: آمن!2025",
    btnCreateCompany: "إنشاء شركة",
    accountEyebrow: "الحساب",
    accountH3: "تغيير كلمة المرور",
    labelCurrentPassword: "كلمة المرور الحالية",
    labelNewPassword: "كلمة مرور جديدة",
    btnChangePassword: "تغيير كلمة المرور",
    tfaEyebrow: "عاملان",
    tfaH3: "إدارة 2FA",
    companiesListEyebrow: "المستأجرون",
    companiesListH3: "الشركات والخطط",
    invFormEyebrow: "الفواتير",
    invFormH3: "إرسال بشعار وتصميم",
    labelInvFirm: "الشركة",
    labelInvNumber: "رقم الفاتورة",
    labelInvRecipient: "بريد المستلم",
    labelInvDate: "تاريخ الفاتورة",
    labelInvDueDate: "تاريخ الاستحقاق",
    labelInvPeriod: "فترة الخدمة",
    labelInvDescription: "وصف الخدمة",
    labelInvNet: "المبلغ الصافي (EUR)",
    labelInvVat: "ضريبة القيمة المضافة (%)",
    btnPrintInvoice: "طباعة الفاتورة / حفظ PDF",
    btnSendInvoice: "إرسال الفاتورة بالبريد الإلكتروني",
    btnUpdatePreview: "تحديث المعاينة",
    auditEyebrow: "سجل الأمان",
    auditH3: "سجل المراجعة",
    labelAuditEvent: "نوع الحدث",
    labelAuditRole: "الدور",
    btnAuditCsv: "تصدير CSV المراجعة",
  },
  fr: {
    authEyebrow: "Page de connexion",
    authTitle: "Connexion sécurisée à BauPass Control",
    authCopy: "Le super admin garde le contrôle total du système. Les admins d'entreprise ne voient que leur entreprise. Le login tourniquet offre un mode d'accès rapide.",
    authPlatform: "Plateforme",
    authOperator: "Opérateur",
    authTurnstile: "Point d'accès tourniquet",
    loginUsernameLabel: "Nom d'utilisateur",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Mot de passe",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "Code OTP (si 2FA activée)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Langue",
    loginScopeLabel: "Type d'accès",
    loginScopeAuto: "Automatique",
    loginScopeServerAdmin: "Admin serveur",
    loginScopeCompanyAdmin: "Admin entreprise",
    loginScopeTurnstile: "Tourniquet",
    loginButton: "Se connecter",
    demoAccessTitle: "Comptes de démonstration",
    demoSuperAdmin: "Super Admin: superadmin / 1234",
    demoCompanyAdmin: "Admin entreprise: firma / 1234",
    demoTurnstile: "Tourniquet: drehkreuz / 1234",
    desktopAppTitle: "Application bureau",
    desktopInstallHint: "Ce portail peut être installé sur votre ordinateur comme une application native.",
    desktopInstallButton: "Installer sur cet ordinateur",
    // Shell
    sidebarEyebrow: "Portail entreprise",
    sidebarCopy: "Enregistrez les travailleurs, prenez des photos, créez des badges numériques et gérez le contrôle d'accès.",
    sidebarCardTitle: "Mode location",
    sidebarCardStrong: "Multi-entreprises",
    sidebarCardDesc: "Chaque entreprise de construction gère son équipe séparément. Le super admin garde le contrôle du système.",
    navDashboard: "Tableau de bord",
    navWorkers: "Travailleurs",
    navBadge: "Badge",
    navAccess: "Accès",
    navInvoices: "Factures",
    navAdmin: "Administration",
    topbarEyebrow: "État du système",
    topbarHeading: "Badges chantier et contrôle d'accès",
    btnSeedData: "Données de démo",
    btnExport: "Exporter le système",
    btnImport: "Importer le système",
    btnLogout: "Déconnexion sécurisée",
    dashEyebrow: "MVP amélioré",
    dashHeading: "Badges numériques avec photo, Badge ID et check-in tourniquet",
    dashSubtext: "Conçu pour la location aux entreprises de construction.",
    dashBadge1: "Prise de photo",
    dashBadge2: "Journal d'accès",
    dashBadge3: "Multi-locataires",
    reportingEyebrow: "Rapports",
    reportingH3: "État de paiement et blocage",
    accessWeekEyebrow: "7 jours",
    accessWeekH3: "Accès quotidien",
    recentEyebrow: "Activité récente",
    recentH3: "Journal d'accès",
    porterLiveEmpty: "Le dernier accès s'affichera ici lors du premier enregistrement.",
    workersFormEyebrow: "Données maîtres",
    workersFormH3: "Enregistrer un travailleur ou visiteur",
    labelType: "Type",
    optWorker: "Travailleur",
    optVisitor: "Visiteur",
    labelFirm: "Entreprise",
    labelSubcompany: "Sous-entreprise",
    optNoSubcompany: "Pas de sous-entreprise",
    labelNewSubcompany: "Nouvelle sous-entreprise",
    btnAddSubcompany: "Créer sous-entreprise",
    labelFirstName: "Prénom",
    labelLastName: "Nom",
    labelInsuranceNumber: "Numéro d'assurance",
    labelRoleField: "Fonction",
    labelSite: "Chantier",
    labelPhysicalCard: "ID carte physique (NFC/RFID)",
    labelValidUntil: "Valide jusqu'au",
    labelVisitorCompany: "Entreprise du visiteur",
    labelVisitPurpose: "Objet de la visite",
    labelHostName: "Contact sur site",
    labelVisitEndAt: "Fin de visite",
    visitorHint: "Les visiteurs sont valides quelques heures ou jusqu'\u00e0 la fin de la journ\u00e9e. Les entr\u00e9es ouvertes sont automatiquement cl\u00f4tur\u00e9es \u00e0 00h00 au plus tard, la carte est conserv\u00e9e pour les rapports.",
    labelWorkerStatus: "Statut",
    optStatusActive: "Actif",
    optStatusLocked: "Bloqué",
    optStatusExpired: "Expiré",
    labelBadgePin: "Badge PIN pour connexion app",
    btnStartCamera: "Démarrer caméra",
    btnCapturePhoto: "Prendre photo",
    btnUploadPhoto: "Uploader photo",
    btnPhotoUp: "↑ Haut",
    btnPhotoLeft: "← Gauche",
    btnPhotoRight: "Droite →",
    btnPhotoDown: "Bas ↓",
    btnPhotoReset: "Réinitialiser position",
    btnWorkerSubmit: "Sauvegarder travailleur et créer badge",
    btnWorkerCancelEdit: "Annuler l'édition",
    workersListEyebrow: "Enregistrements",
    workersListH3: "Travailleurs enregistrés",
    btnWorkerCsv: "Télécharger liste PDF",
    btnBulkDelete: "Supprimer sélection",
    btnBulkActive: "Statut : actif",
    btnBulkInactive: "Statut : inactif",
    btnBulkCancel: "Annuler",
    badgeEyebrow: "Identité numérique",
    badgeH3: "Aperçu du badge",
    badgeEmptyState: "Veuillez créer ou sélectionner un travailleur d'abord.",
    badgeScanEyebrow: "Aide scan",
    badgeScanH3: "Code badge",
    badgeScanEmpty: "Aucun badge sélectionné.",
    badgeTitleVisitor: "Carte visiteur numérique",
    badgeTitleDayPass: "Laissez-passer journalier numérique chantier",
    badgeTitleRegular: "Badge numérique chantier",
    badgeUnknownCompany: "Entreprise inconnue",
    badgeQrHint: "Scanner le QR, installer l'app et ouvrir le badge directement.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "Fonction QR",
    badgeMetaQrFuncVal: "Installation app travailleurs",
    badgeMetaRoleLabel: "Rôle dans le système",
    badgePhotoUploadHint: "Prendre ou télécharger une photo",
    appPinLabel: "PIN app",
    pinNotRequired: "non requis",
    pinSet: "defini",
    pinMissing: "manquant",
    cardLabel: "Carte",
    cardUnassigned: "non attribuee",
    btnEdit: "Modifier",
    btnDelete: "Supprimer",
    btnRestore: "Restaurer",
    btnAppLink: "Lien app",
    btnResetPin: "Reinitialiser PIN",
    confirmDeleteWorker: "Supprimer ce travailleur ?",
    alertDeleteWorkerFailed: "Le travailleur n'a pas pu etre supprime: {error}",
    alertRestoreWorkerFailed: "Le travailleur n'a pas pu etre restaure: {error}",
    alertAppLinkCreateFailed: "Le lien app n'a pas pu etre cree: {error}",
    promptResetPinFor: "Nouveau PIN badge pour {name} (4-8 chiffres):",
    alertPinMustDigits: "Le PIN doit contenir 4 a 8 chiffres.",
    alertPinResetSuccessFor: "Le PIN pour {name} a ete reinitialise.",
    alertPinResetFailed: "Le PIN n'a pas pu etre reinitialise: {error}",
    detailCloseTitle: "Fermer",
    detailPhotoAlt: "Photo du travailleur",
    detailCheckinBtn: "Entree (Check-in)",
    detailCheckoutBtn: "Sortie (Check-out)",
    accessFormEyebrow: "Tourniquet",
    accessFormH3: "Check-in et check-out",
    labelAccessBadge: "Badge ID ou travailleur",
    labelAccessDir: "Direction",
    labelAccessGate: "Porte",
    labelAccessNote: "Note",
    optCheckin: "Entrée",
    optCheckout: "Sortie",
    btnAccessSubmit: "Enregistrer accès",
    porterEmpty: "Vue portier : sélectionnez un travailleur et enregistrez l'accès.",
    accessLogEyebrow: "Journal d'accès",
    accessLogH3: "Entrées et sorties horodatées",
    labelFrom: "De",
    labelTo: "À",
    labelFilterDir: "Direction",
    labelFilterGate: "Tourniquet",
    optAllDir: "Tous",
    btnApplyFilter: "Appliquer filtre",
    btnResetFilter: "Réinitialiser filtre",
    btnAccessCsv: "Exporter accès CSV",
    dailyReportEyebrow: "Rapport journalier",
    dailyReportH3: "Par porte",
    btnPrintDaily: "Imprimer rapport journalier",
    btnPrintVisitorWeekly: "Imprimer liste visiteurs semaine",
    hourlyEyebrow: "Analyse horaire",
    hourlyH3: "Entrées/sorties par heure",
    warningsEyebrow: "Avertissements",
    warningsH3: "Entrée sans sortie",
    invListEyebrow: "Facturation",
    invListH3: "Factures et état de paiement",
    optAllStatus: "Tous les statuts",
    optDraft: "Brouillon",
    optSent: "Envoyée",
    optOverdue: "En retard",
    optPaid: "Payée",
    optFailed: "Erreur",
    btnRefreshList: "Actualiser",
    inkassoEyebrow: "Recouvrement",
    inkassoH3: "En retard, pré-blocage, bloqué",
    optAllPositions: "Tous les postes ouverts",
    optPrelock: "Pré-blocage",
    optLocked: "Déjà bloqué",
    adminEyebrow: "Centre d'administration",
    adminH3: "Système et configuration",
    sysStatusEyebrow: "État du système",
    sysStatusH3: "Accès d'urgence et réparation",
    btnRefreshStatus: "Actualiser état",
    btnRepairSessions: "Réparer sessions",
    superAdminEyebrow: "Contrôle système",
    superAdminH3: "Paramètres super admin",
    labelPlatformName: "Nom de la plateforme",
    labelOperatorName: "Opérateur",
    labelTurnstileEp: "Endpoint API tourniquet",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "Utilisateur SMTP",
    labelSmtpPass: "Mot de passe SMTP",
    labelSenderEmail: "E-mail expéditeur",
    labelSenderName: "Nom expéditeur",
    labelTls: "TLS actif",
    optTlsYes: "Oui",
    optTlsNo: "Non",
    optYes: "Oui",
    optNo: "Non",
    labelIpWhitelist: "Liste blanche IP admin",
    labelEnforceDomain: "Forcer domaine entreprise",
    btnSaveAdmin: "Sauvegarder paramètres admin",
    companyNewEyebrow: "Locataires",
    companyNewH3: "Ajouter une entreprise de construction",
    labelCompanyName: "Nom de l'entreprise",
    labelCompanyContact: "Personne de contact",
    labelBillingEmail: "E-mail facturation",
    labelAccessHost: "Domaine d'accès entreprise",
    labelPlan: "Plan",
    labelCompanyStatus: "Statut",
    optCompanyActive: "Actif",
    optCompanyTest: "Test",
    optCompanyPaused: "Suspendu",
    optCompanyLocked: "Bloqué (paiement en retard)",
    labelCompanyAdminPassword: "Mot de passe admin initial",
    companyAdminPasswordPlaceholder: "ex. Sécurisé!2025",
    btnCreateCompany: "Créer entreprise",
    accountEyebrow: "Compte",
    accountH3: "Changer le mot de passe",
    labelCurrentPassword: "Mot de passe actuel",
    labelNewPassword: "Nouveau mot de passe",
    btnChangePassword: "Changer mot de passe",
    tfaEyebrow: "Double facteur",
    tfaH3: "Gestion 2FA",
    companiesListEyebrow: "Locataires",
    companiesListH3: "Entreprises et plans",
    invFormEyebrow: "Factures",
    invFormH3: "Envoyer avec logo et design",
    labelInvFirm: "Entreprise",
    labelInvNumber: "Numéro de facture",
    labelInvRecipient: "E-mail destinataire",
    labelInvDate: "Date de facture",
    labelInvDueDate: "Date d'échéance",
    labelInvPeriod: "Période de service",
    labelInvDescription: "Description du service",
    labelInvNet: "Montant net (EUR)",
    labelInvVat: "TVA (%)",
    btnPrintInvoice: "Imprimer facture / Enregistrer PDF",
    btnSendInvoice: "Envoyer facture par e-mail",
    btnUpdatePreview: "Mettre à jour l'aperçu",
    auditEyebrow: "Journal sécurité",
    auditH3: "Journal d'audit",
    labelAuditEvent: "Type d'événement",
    labelAuditRole: "Rôle",
    btnAuditCsv: "Exporter audit CSV",
  },
  es: {
    authEyebrow: "Página de acceso",
    authTitle: "Inicio de sesión seguro en BauPass Control",
    authCopy: "El super admin mantiene el control completo del sistema. Los admins de empresa solo ven su empresa. El acceso de torniquete ofrece un modo rápido.",
    authPlatform: "Plataforma",
    authOperator: "Operador",
    authTurnstile: "Endpoint de torniquete",
    loginUsernameLabel: "Usuario",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Contraseña",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "Código OTP (si 2FA está activa)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Idioma",
    loginScopeLabel: "Tipo de acceso",
    loginScopeAuto: "Automático",
    loginScopeServerAdmin: "Admin del servidor",
    loginScopeCompanyAdmin: "Admin de empresa",
    loginScopeTurnstile: "Torniquete",
    loginButton: "Iniciar sesión",
    demoAccessTitle: "Cuentas demo",
    demoSuperAdmin: "Super Admin: superadmin / 1234",
    demoCompanyAdmin: "Admin empresa: firma / 1234",
    demoTurnstile: "Torniquete: drehkreuz / 1234",
    desktopAppTitle: "App de escritorio",
    desktopInstallHint: "Este portal puede instalarse en tu ordenador como una app local.",
    desktopInstallButton: "Instalar en este ordenador",
    // Shell
    sidebarEyebrow: "Portal de empresa",
    sidebarCopy: "Registra trabajadores, toma fotos, crea credenciales digitales y gestiona el control de acceso.",
    sidebarCardTitle: "Modo alquiler",
    sidebarCardStrong: "Multi-empresa",
    sidebarCardDesc: "Cada empresa de construcción gestiona su equipo por separado. El super admin controla el sistema.",
    navDashboard: "Panel de control",
    navWorkers: "Trabajadores",
    navBadge: "Credencial",
    navAccess: "Acceso",
    navInvoices: "Facturas",
    navAdmin: "Administración",
    topbarEyebrow: "Estado del sistema",
    topbarHeading: "Credenciales de obra y control de acceso",
    btnSeedData: "Datos de demo",
    btnExport: "Exportar sistema",
    btnImport: "Importar sistema",
    btnLogout: "Cerrar sesión segura",
    dashEyebrow: "MVP mejorado",
    dashHeading: "Credenciales digitales con foto, Badge ID y check-in de torniquete",
    dashSubtext: "Diseñado para alquiler a empresas de construcción.",
    dashBadge1: "Captura de foto",
    dashBadge2: "Registro de acceso",
    dashBadge3: "Multi-inquilino",
    reportingEyebrow: "Informes",
    reportingH3: "Estado de pago y bloqueo",
    accessWeekEyebrow: "7 días",
    accessWeekH3: "Acceso diario",
    recentEyebrow: "Actividad reciente",
    recentH3: "Registro de acceso",
    porterLiveEmpty: "El último acceso se mostrará aquí en el primer registro.",
    workersFormEyebrow: "Datos maestros",
    workersFormH3: "Registrar trabajador o visitante",
    labelType: "Tipo",
    optWorker: "Trabajador",
    optVisitor: "Visitante",
    labelFirm: "Empresa",
    labelSubcompany: "Subempresa",
    optNoSubcompany: "Sin subempresa",
    labelNewSubcompany: "Nueva subempresa",
    btnAddSubcompany: "Crear subempresa",
    labelFirstName: "Nombre",
    labelLastName: "Apellido",
    labelInsuranceNumber: "Número de seguro",
    labelRoleField: "Función",
    labelSite: "Obra",
    labelPhysicalCard: "ID tarjeta física (NFC/RFID)",
    labelValidUntil: "Válido hasta",
    labelVisitorCompany: "Empresa del visitante",
    labelVisitPurpose: "Propósito de la visita",
    labelHostName: "Contacto en obra",
    labelVisitEndAt: "Fin de visita",
    visitorHint: "Los visitantes son válidos por unas horas o hasta el final del día. Los registros abiertos se cierran automáticamente a las 00:00 como máximo, la tarjeta se conserva para informes.",
    labelWorkerStatus: "Estado",
    optStatusActive: "Activo",
    optStatusLocked: "Bloqueado",
    optStatusExpired: "Expirado",
    labelBadgePin: "Badge PIN para inicio de sesión",
    btnStartCamera: "Iniciar cámara",
    btnCapturePhoto: "Tomar foto",
    btnUploadPhoto: "Subir foto",
    btnPhotoUp: "↑ Arriba",
    btnPhotoLeft: "← Izquierda",
    btnPhotoRight: "Derecha →",
    btnPhotoDown: "Abajo ↓",
    btnPhotoReset: "Restablecer posición",
    btnWorkerSubmit: "Guardar trabajador y crear credencial",
    btnWorkerCancelEdit: "Cancelar edición",
    workersListEyebrow: "Registros",
    workersListH3: "Trabajadores registrados",
    btnWorkerCsv: "Descargar lista PDF",
    btnBulkDelete: "Eliminar selección",
    btnBulkActive: "Estado: activo",
    btnBulkInactive: "Estado: inactivo",
    btnBulkCancel: "Cancelar",
    badgeEyebrow: "Identidad digital",
    badgeH3: "Vista previa de credencial",
    badgeEmptyState: "Por favor crea o selecciona un trabajador primero.",
    badgeScanEyebrow: "Ayuda escaneo",
    badgeScanH3: "Código de credencial",
    badgeScanEmpty: "Ninguna credencial seleccionada.",
    badgeTitleVisitor: "Tarjeta de visitante digital",
    badgeTitleDayPass: "Pase diario de obra digital",
    badgeTitleRegular: "Insignia de obra digital",
    badgeUnknownCompany: "Empresa desconocida",
    badgeQrHint: "Escanear QR, instalar la app y abrir la insignia directamente.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "Funci\u00f3n QR",
    badgeMetaQrFuncVal: "Instalaci\u00f3n de app de trabajadores",
    badgeMetaRoleLabel: "Rol en el sistema",
    badgePhotoUploadHint: "Tomar o subir foto",
    appPinLabel: "PIN de app",
    pinNotRequired: "no necesario",
    pinSet: "configurado",
    pinMissing: "faltante",
    cardLabel: "Tarjeta",
    cardUnassigned: "no asignada",
    btnEdit: "Editar",
    btnDelete: "Eliminar",
    btnRestore: "Restaurar",
    btnAppLink: "Enlace app",
    btnResetPin: "Restablecer PIN",
    confirmDeleteWorker: "\u00bfEliminar al trabajador ahora?",
    alertDeleteWorkerFailed: "No se pudo eliminar al trabajador: {error}",
    alertRestoreWorkerFailed: "No se pudo restaurar al trabajador: {error}",
    alertAppLinkCreateFailed: "No se pudo crear el enlace de la app: {error}",
    promptResetPinFor: "Nuevo PIN de badge para {name} (4-8 digitos):",
    alertPinMustDigits: "El PIN debe tener de 4 a 8 digitos.",
    alertPinResetSuccessFor: "El PIN de {name} se restablecio correctamente.",
    alertPinResetFailed: "No se pudo restablecer el PIN: {error}",
    detailCloseTitle: "Cerrar",
    detailPhotoAlt: "Foto del trabajador",
    detailCheckinBtn: "Entrada (Check-in)",
    detailCheckoutBtn: "Salida (Check-out)",
    accessFormEyebrow: "Torniquete",
    accessFormH3: "Check-in y check-out",
    labelAccessBadge: "Badge ID o trabajador",
    labelAccessDir: "Dirección",
    labelAccessGate: "Puerta",
    labelAccessNote: "Nota",
    optCheckin: "Entrada",
    optCheckout: "Salida",
    btnAccessSubmit: "Registrar acceso",
    porterEmpty: "Vista portero: selecciona un trabajador y registra el acceso.",
    accessLogEyebrow: "Registro de acceso",
    accessLogH3: "Entradas y salidas con marca de tiempo",
    labelFrom: "Desde",
    labelTo: "Hasta",
    labelFilterDir: "Dirección",
    labelFilterGate: "Torniquete",
    optAllDir: "Todos",
    btnApplyFilter: "Aplicar filtro",
    btnResetFilter: "Restablecer filtro",
    btnAccessCsv: "Exportar acceso CSV",
    dailyReportEyebrow: "Informe diario",
    dailyReportH3: "Por puerta",
    btnPrintDaily: "Imprimir informe diario",
    btnPrintVisitorWeekly: "Imprimir lista visitantes semanal",
    hourlyEyebrow: "Análisis horario",
    hourlyH3: "Entradas/salidas por hora",
    warningsEyebrow: "Advertencias",
    warningsH3: "Entrada sin salida",
    invListEyebrow: "Facturación",
    invListH3: "Facturas y estado de pago",
    optAllStatus: "Todos los estados",
    optDraft: "Borrador",
    optSent: "Enviada",
    optOverdue: "Vencida",
    optPaid: "Pagada",
    optFailed: "Error",
    btnRefreshList: "Actualizar",
    inkassoEyebrow: "Cobro",
    inkassoH3: "Vencida, pre-bloqueo, bloqueada",
    optAllPositions: "Todas las posiciones abiertas",
    optPrelock: "Pre-bloqueo",
    optLocked: "Ya bloqueado",
    adminEyebrow: "Centro de administración",
    adminH3: "Sistema y configuración",
    sysStatusEyebrow: "Estado del sistema",
    sysStatusH3: "Acceso de emergencia y reparación",
    btnRefreshStatus: "Actualizar estado",
    btnRepairSessions: "Reparar sesiones",
    superAdminEyebrow: "Control del sistema",
    superAdminH3: "Ajustes del super admin",
    labelPlatformName: "Nombre de la plataforma",
    labelOperatorName: "Operador",
    labelTurnstileEp: "Endpoint API torniquete",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "Usuario SMTP",
    labelSmtpPass: "Contraseña SMTP",
    labelSenderEmail: "E-mail remitente",
    labelSenderName: "Nombre remitente",
    labelTls: "TLS activo",
    optTlsYes: "Sí",
    optTlsNo: "No",
    optYes: "Sí",
    optNo: "No",
    labelIpWhitelist: "Lista blanca IP admin",
    labelEnforceDomain: "Forzar dominio empresa",
    btnSaveAdmin: "Guardar ajustes admin",
    companyNewEyebrow: "Inquilinos",
    companyNewH3: "Añadir empresa de construcción",
    labelCompanyName: "Nombre de empresa",
    labelCompanyContact: "Persona de contacto",
    labelBillingEmail: "E-mail de facturación",
    labelAccessHost: "Dominio de acceso empresa",
    labelPlan: "Plan",
    labelCompanyStatus: "Estado",
    optCompanyActive: "Activo",
    optCompanyTest: "Prueba",
    optCompanyPaused: "Pausado",
    optCompanyLocked: "Bloqueado (pago pendiente)",
    labelCompanyAdminPassword: "Contraseña inicial del admin",
    companyAdminPasswordPlaceholder: "ej. Seguro!2025",
    btnCreateCompany: "Crear empresa",
    accountEyebrow: "Cuenta",
    accountH3: "Cambiar contraseña",
    labelCurrentPassword: "Contraseña actual",
    labelNewPassword: "Nueva contraseña",
    btnChangePassword: "Cambiar contraseña",
    tfaEyebrow: "Doble factor",
    tfaH3: "Gestión 2FA",
    companiesListEyebrow: "Inquilinos",
    companiesListH3: "Empresas y planes",
    invFormEyebrow: "Facturas",
    invFormH3: "Enviar con logo y diseño",
    labelInvFirm: "Empresa",
    labelInvNumber: "Número de factura",
    labelInvRecipient: "E-mail destinatario",
    labelInvDate: "Fecha de factura",
    labelInvDueDate: "Fecha de vencimiento",
    labelInvPeriod: "Período de servicio",
    labelInvDescription: "Descripción del servicio",
    labelInvNet: "Importe neto (EUR)",
    labelInvVat: "IVA (%)",
    btnPrintInvoice: "Imprimir factura / Guardar PDF",
    btnSendInvoice: "Enviar factura por e-mail",
    btnUpdatePreview: "Actualizar vista previa",
    auditEyebrow: "Registro de seguridad",
    auditH3: "Registro de auditoría",
    labelAuditEvent: "Tipo de evento",
    labelAuditRole: "Rol",
    btnAuditCsv: "Exportar auditoría CSV",
  },
  it: {
    authEyebrow: "Pagina di accesso",
    authTitle: "Accesso sicuro a BauPass Control",
    authCopy: "Il super admin mantiene il controllo completo del sistema. Gli admin aziendali vedono solo la propria azienda. L'accesso tornello ha una modalità rapida.",
    authPlatform: "Piattaforma",
    authOperator: "Operatore",
    authTurnstile: "Endpoint tornello",
    loginUsernameLabel: "Nome utente",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Password",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "Codice OTP (se 2FA è attiva)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Lingua",
    loginScopeLabel: "Tipo di accesso",
    loginScopeAuto: "Automatico",
    loginScopeServerAdmin: "Admin server",
    loginScopeCompanyAdmin: "Admin azienda",
    loginScopeTurnstile: "Tornello",
    loginButton: "Accedi",
    demoAccessTitle: "Account demo",
    demoSuperAdmin: "Super Admin: superadmin / 1234",
    demoCompanyAdmin: "Admin azienda: firma / 1234",
    demoTurnstile: "Tornello: drehkreuz / 1234",
    desktopAppTitle: "App desktop",
    desktopInstallHint: "Questo portale può essere installato sul computer come app locale.",
    desktopInstallButton: "Installa su questo computer",
    // Shell
    sidebarEyebrow: "Portale aziendale",
    sidebarCopy: "Registra i lavoratori, scatta foto, crea badge digitali e gestisci il controllo accessi.",
    sidebarCardTitle: "Modalità noleggio",
    sidebarCardStrong: "Multi-azienda",
    sidebarCardDesc: "Ogni impresa edile gestisce il proprio team separatamente. Il super admin mantiene il controllo del sistema.",
    navDashboard: "Pannello di controllo",
    navWorkers: "Lavoratori",
    navBadge: "Badge",
    navAccess: "Accesso",
    navInvoices: "Fatture",
    navAdmin: "Amministrazione",
    topbarEyebrow: "Stato del sistema",
    topbarHeading: "Badge cantiere e controllo accessi",
    btnSeedData: "Dati demo",
    btnExport: "Esporta sistema",
    btnImport: "Importa sistema",
    btnLogout: "Disconnessione sicura",
    dashEyebrow: "MVP migliorato",
    dashHeading: "Badge digitali con foto, Badge ID e check-in tornello",
    dashSubtext: "Progettato per il noleggio alle imprese edili.",
    dashBadge1: "Scatto foto",
    dashBadge2: "Registro accessi",
    dashBadge3: "Multi-tenant",
    reportingEyebrow: "Report",
    reportingH3: "Stato pagamento e blocco",
    accessWeekEyebrow: "7 giorni",
    accessWeekH3: "Accesso giornaliero",
    recentEyebrow: "Attività recente",
    recentH3: "Registro accessi",
    porterLiveEmpty: "L'ultimo accesso verrà mostrato qui al primo ingresso.",
    workersFormEyebrow: "Dati anagrafici",
    workersFormH3: "Registra lavoratore o visitatore",
    labelType: "Tipo",
    optWorker: "Lavoratore",
    optVisitor: "Visitatore",
    labelFirm: "Azienda",
    labelSubcompany: "Sub-azienda",
    optNoSubcompany: "Nessuna sub-azienda",
    labelNewSubcompany: "Nuova sub-azienda",
    btnAddSubcompany: "Crea sub-azienda",
    labelFirstName: "Nome",
    labelLastName: "Cognome",
    labelInsuranceNumber: "Numero assicurazione",
    labelRoleField: "Mansione",
    labelSite: "Cantiere",
    labelPhysicalCard: "ID tessera fisica (NFC/RFID)",
    labelValidUntil: "Valido fino al",
    labelVisitorCompany: "Azienda del visitatore",
    labelVisitPurpose: "Scopo della visita",
    labelHostName: "Contatto in cantiere",
    labelVisitEndAt: "Fine visita",
    visitorHint: "I visitatori sono validi per alcune ore o fino a fine giornata. Gli accessi aperti vengono chiusi automaticamente alle 00:00 al pi\u00f9 tardi, la tessera rimane conservata per i report.",
    labelWorkerStatus: "Stato",
    optStatusActive: "Attivo",
    optStatusLocked: "Bloccato",
    optStatusExpired: "Scaduto",
    labelBadgePin: "Badge PIN per login app",
    btnStartCamera: "Avvia fotocamera",
    btnCapturePhoto: "Scatta foto",
    btnUploadPhoto: "Carica foto",
    btnPhotoUp: "↑ Su",
    btnPhotoLeft: "← Sinistra",
    btnPhotoRight: "Destra →",
    btnPhotoDown: "Giù ↓",
    btnPhotoReset: "Reimposta posizione",
    btnWorkerSubmit: "Salva lavoratore e crea badge",
    btnWorkerCancelEdit: "Annulla modifica",
    workersListEyebrow: "Registrazioni",
    workersListH3: "Lavoratori registrati",
    btnWorkerCsv: "Scarica lista PDF",
    btnBulkDelete: "Elimina selezionati",
    btnBulkActive: "Stato: attivo",
    btnBulkInactive: "Stato: inattivo",
    btnBulkCancel: "Annulla",
    badgeEyebrow: "Identità digitale",
    badgeH3: "Anteprima badge",
    badgeEmptyState: "Crea o seleziona prima un lavoratore.",
    badgeScanEyebrow: "Aiuto scansione",
    badgeScanH3: "Codice badge",
    badgeScanEmpty: "Nessun badge selezionato.",
    badgeTitleVisitor: "Tessera visitatore digitale",
    badgeTitleDayPass: "Pass giornaliero cantiere digitale",
    badgeTitleRegular: "Badge cantiere digitale",
    badgeUnknownCompany: "Azienda sconosciuta",
    badgeQrHint: "Scansiona il QR, installa l'app e apri il badge direttamente.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "Funzione QR",
    badgeMetaQrFuncVal: "Installazione app lavoratori",
    badgeMetaRoleLabel: "Ruolo nel sistema",
    badgePhotoUploadHint: "Scatta o carica una foto",
    appPinLabel: "PIN app",
    pinNotRequired: "non necessario",
    pinSet: "impostato",
    pinMissing: "mancante",
    cardLabel: "Carta",
    cardUnassigned: "non assegnata",
    btnEdit: "Modifica",
    btnDelete: "Elimina",
    btnRestore: "Ripristina",
    btnAppLink: "Link app",
    btnResetPin: "Reimposta PIN",
    confirmDeleteWorker: "Eliminare il lavoratore ora?",
    alertDeleteWorkerFailed: "Impossibile eliminare il lavoratore: {error}",
    alertRestoreWorkerFailed: "Impossibile ripristinare il lavoratore: {error}",
    alertAppLinkCreateFailed: "Impossibile creare il link app: {error}",
    promptResetPinFor: "Nuovo PIN badge per {name} (4-8 cifre):",
    alertPinMustDigits: "Il PIN deve contenere da 4 a 8 cifre.",
    alertPinResetSuccessFor: "PIN di {name} reimpostato con successo.",
    alertPinResetFailed: "Impossibile reimpostare il PIN: {error}",
    detailCloseTitle: "Chiudi",
    detailPhotoAlt: "Foto lavoratore",
    detailCheckinBtn: "Entrata (Check-in)",
    detailCheckoutBtn: "Uscita (Check-out)",
    accessFormEyebrow: "Tornello",
    accessFormH3: "Check-in e check-out",
    labelAccessBadge: "Badge ID o lavoratore",
    labelAccessDir: "Direzione",
    labelAccessGate: "Cancello",
    labelAccessNote: "Nota",
    optCheckin: "Entrata",
    optCheckout: "Uscita",
    btnAccessSubmit: "Registra accesso",
    porterEmpty: "Vista portiere: seleziona un lavoratore e registra l'accesso.",
    accessLogEyebrow: "Registro accessi",
    accessLogH3: "Ingressi e uscite con timestamp",
    labelFrom: "Da",
    labelTo: "A",
    labelFilterDir: "Direzione",
    labelFilterGate: "Tornello",
    optAllDir: "Tutti",
    btnApplyFilter: "Applica filtro",
    btnResetFilter: "Reimposta filtro",
    btnAccessCsv: "Esporta accessi CSV",
    dailyReportEyebrow: "Report giornaliero",
    dailyReportH3: "Per cancello",
    btnPrintDaily: "Stampa report giornaliero",
    btnPrintVisitorWeekly: "Stampa lista visitatori settimanale",
    hourlyEyebrow: "Analisi oraria",
    hourlyH3: "Ingressi/uscite per ora",
    warningsEyebrow: "Avvisi",
    warningsH3: "Entrata senza uscita",
    invListEyebrow: "Fatturazione",
    invListH3: "Fatture e stato pagamento",
    optAllStatus: "Tutti gli stati",
    optDraft: "Bozza",
    optSent: "Inviata",
    optOverdue: "Scaduta",
    optPaid: "Pagata",
    optFailed: "Errore",
    btnRefreshList: "Aggiorna",
    inkassoEyebrow: "Recupero crediti",
    inkassoH3: "Scaduta, pre-blocco, bloccata",
    optAllPositions: "Tutte le posizioni aperte",
    optPrelock: "Pre-blocco",
    optLocked: "Già bloccato",
    adminEyebrow: "Centro amministrativo",
    adminH3: "Sistema e configurazione",
    sysStatusEyebrow: "Stato del sistema",
    sysStatusH3: "Accesso emergenza e riparazione",
    btnRefreshStatus: "Aggiorna stato",
    btnRepairSessions: "Ripara sessioni",
    superAdminEyebrow: "Controllo sistema",
    superAdminH3: "Impostazioni super admin",
    labelPlatformName: "Nome della piattaforma",
    labelOperatorName: "Operatore",
    labelTurnstileEp: "Endpoint API tornello",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "Utente SMTP",
    labelSmtpPass: "Password SMTP",
    labelSenderEmail: "E-mail mittente",
    labelSenderName: "Nome mittente",
    labelTls: "TLS attivo",
    optTlsYes: "Sì",
    optTlsNo: "No",
    optYes: "Sì",
    optNo: "No",
    labelIpWhitelist: "Whitelist IP admin",
    labelEnforceDomain: "Imponi dominio aziendale",
    btnSaveAdmin: "Salva impostazioni admin",
    companyNewEyebrow: "Tenant",
    companyNewH3: "Aggiungi impresa edile",
    labelCompanyName: "Nome azienda",
    labelCompanyContact: "Persona di contatto",
    labelBillingEmail: "E-mail fatturazione",
    labelAccessHost: "Dominio accesso azienda",
    labelPlan: "Piano",
    labelCompanyStatus: "Stato",
    optCompanyActive: "Attivo",
    optCompanyTest: "Test",
    optCompanyPaused: "In pausa",
    optCompanyLocked: "Bloccato (pagamento in ritardo)",
    labelCompanyAdminPassword: "Password admin iniziale",
    companyAdminPasswordPlaceholder: "es. Sicuro!2025",
    btnCreateCompany: "Crea azienda",
    accountEyebrow: "Account",
    accountH3: "Cambia password",
    labelCurrentPassword: "Password attuale",
    labelNewPassword: "Nuova password",
    btnChangePassword: "Cambia password",
    tfaEyebrow: "Doppio fattore",
    tfaH3: "Gestione 2FA",
    companiesListEyebrow: "Tenant",
    companiesListH3: "Aziende e piani",
    invFormEyebrow: "Fatture",
    invFormH3: "Invia con logo e design",
    labelInvFirm: "Azienda",
    labelInvNumber: "Numero fattura",
    labelInvRecipient: "E-mail destinatario",
    labelInvDate: "Data fattura",
    labelInvDueDate: "Data scadenza",
    labelInvPeriod: "Periodo di servizio",
    labelInvDescription: "Descrizione servizio",
    labelInvNet: "Importo netto (EUR)",
    labelInvVat: "IVA (%)",
    btnPrintInvoice: "Stampa fattura / Salva PDF",
    btnSendInvoice: "Invia fattura per e-mail",
    btnUpdatePreview: "Aggiorna anteprima",
    auditEyebrow: "Registro sicurezza",
    auditH3: "Registro audit",
    labelAuditEvent: "Tipo evento",
    labelAuditRole: "Ruolo",
    btnAuditCsv: "Esporta audit CSV",
  },
  pl: {
    authEyebrow: "Strona logowania",
    authTitle: "Bezpieczne logowanie do BauPass Control",
    authCopy: "Super administrator zachowuje pełną kontrolę nad systemem. Administratorzy firm widzą tylko swoją firmę. Logowanie bramki ma szybki tryb dostępu.",
    authPlatform: "Platforma",
    authOperator: "Operator",
    authTurnstile: "Endpoint bramki",
    loginUsernameLabel: "Nazwa użytkownika",
    loginUsernamePlaceholder: "superadmin",
    loginPasswordLabel: "Hasło",
    loginPasswordPlaceholder: "1234",
    loginOtpLabel: "Kod OTP (jeśli 2FA jest aktywne)",
    loginOtpPlaceholder: "123456",
    uiLanguageLabel: "Język",
    loginScopeLabel: "Typ dostępu",
    loginScopeAuto: "Automatycznie",
    loginScopeServerAdmin: "Admin serwera",
    loginScopeCompanyAdmin: "Admin firmy",
    loginScopeTurnstile: "Bramka",
    loginButton: "Zaloguj się",
    demoAccessTitle: "Konta demo",
    demoSuperAdmin: "Super Admin: superadmin / 1234",
    demoCompanyAdmin: "Admin firmy: firma / 1234",
    demoTurnstile: "Bramka: drehkreuz / 1234",
    desktopAppTitle: "Aplikacja desktopowa",
    desktopInstallHint: "Ten portal można zainstalować na komputerze jak aplikację lokalną.",
    desktopInstallButton: "Zainstaluj na tym komputerze",
    // Shell
    sidebarEyebrow: "Portal firmowy",
    sidebarCopy: "Rejestruj pracowników, rób zdjęcia, twórz cyfrowe identyfikatory i zarządzaj kontrolą dostępu.",
    sidebarCardTitle: "Tryb wynajmu",
    sidebarCardStrong: "Obsługa wielu firm",
    sidebarCardDesc: "Każda firma budowlana zarządza swoim zespołem osobno. Super admin zachowuje kontrolę nad systemem.",
    navDashboard: "Pulpit",
    navWorkers: "Pracownicy",
    navBadge: "Identyfikator",
    navAccess: "Dostęp",
    navInvoices: "Faktury",
    navAdmin: "Administracja",
    topbarEyebrow: "Stan systemu",
    topbarHeading: "Identyfikatory budowlane i kontrola dostępu",
    btnSeedData: "Dane demo",
    btnExport: "Eksportuj system",
    btnImport: "Importuj system",
    btnLogout: "Bezpieczne wylogowanie",
    dashEyebrow: "Ulepszony MVP",
    dashHeading: "Cyfrowe identyfikatory ze zdjęciem, Badge ID i check-in bramki",
    dashSubtext: "Zaprojektowany do wynajmu firmom budowlanym.",
    dashBadge1: "Zdjęcie",
    dashBadge2: "Rejestr wejść",
    dashBadge3: "Multi-najemca",
    reportingEyebrow: "Raporty",
    reportingH3: "Status płatności i blokady",
    accessWeekEyebrow: "7 dni",
    accessWeekH3: "Codzienne wejścia",
    recentEyebrow: "Ostatnia aktywność",
    recentH3: "Rejestr wejść",
    porterLiveEmpty: "Ostatnie wejście pojawi się tutaj przy pierwszym zapisie.",
    workersFormEyebrow: "Dane podstawowe",
    workersFormH3: "Rejestracja pracownika lub gościa",
    labelType: "Typ",
    optWorker: "Pracownik",
    optVisitor: "Gość",
    labelFirm: "Firma",
    labelSubcompany: "Podwykonawca",
    optNoSubcompany: "Brak podwykonawcy",
    labelNewSubcompany: "Nowy podwykonawca",
    btnAddSubcompany: "Utwórz podwykonawcę",
    labelFirstName: "Imię",
    labelLastName: "Nazwisko",
    labelInsuranceNumber: "Numer ubezpieczenia",
    labelRoleField: "Stanowisko",
    labelSite: "Plac budowy",
    labelPhysicalCard: "ID karty fizycznej (NFC/RFID)",
    labelValidUntil: "Ważny do",
    labelVisitorCompany: "Firma gościa",
    labelVisitPurpose: "Cel wizyty",
    labelHostName: "Kontakt na budowie",
    labelVisitEndAt: "Koniec wizyty",
    visitorHint: "Goście są ważni przez kilka godzin lub do końca dnia. Otwarte wejścia są automatycznie wyrejestrowane najpóźniej o 00:00, karta jest zachowana do celów raportowania.",
    labelWorkerStatus: "Status",
    optStatusActive: "Aktywny",
    optStatusLocked: "Zablokowany",
    optStatusExpired: "Wygasły",
    labelBadgePin: "Badge PIN do logowania",
    btnStartCamera: "Uruchom kamerę",
    btnCapturePhoto: "Zrób zdjęcie",
    btnUploadPhoto: "Prześlij zdjęcie",
    btnPhotoUp: "↑ Góra",
    btnPhotoLeft: "← Lewo",
    btnPhotoRight: "Prawo →",
    btnPhotoDown: "Dół ↓",
    btnPhotoReset: "Resetuj pozycję",
    btnWorkerSubmit: "Zapisz pracownika i utwórz identyfikator",
    btnWorkerCancelEdit: "Anuluj edycję",
    workersListEyebrow: "Rekordy",
    workersListH3: "Zarejestrowani pracownicy",
    btnWorkerCsv: "Pobierz listę PDF",
    btnBulkDelete: "Usuń zaznaczone",
    btnBulkActive: "Status: aktywny",
    btnBulkInactive: "Status: nieaktywny",
    btnBulkCancel: "Anuluj",
    badgeEyebrow: "Tożsamość cyfrowa",
    badgeH3: "Podgląd identyfikatora",
    badgeEmptyState: "Najpierw utwórz lub wybierz pracownika.",
    badgeScanEyebrow: "Pomoc skanowania",
    badgeScanH3: "Kod identyfikatora",
    badgeScanEmpty: "Nie wybrano identyfikatora.",
    badgeTitleVisitor: "Cyfrowa karta go\u015bcia",
    badgeTitleDayPass: "Cyfrowa dzienna przepustka budowy",
    badgeTitleRegular: "Cyfrowa odznaka budowy",
    badgeUnknownCompany: "Nieznana firma",
    badgeQrHint: "Zeskanuj QR, zainstaluj aplikacj\u0119 i otw\u00f3rz odznak\u0119 bezpo\u015brednio.",
    badgeLabelBadgeId: "Badge-ID",
    badgeMetaQrFunc: "Funkcja QR",
    badgeMetaQrFuncVal: "Instalacja aplikacji pracownika",
    badgeMetaRoleLabel: "Rola w systemie",
    badgePhotoUploadHint: "Zr\u00f3b lub prze\u015blij zdj\u0119cie",
    appPinLabel: "PIN aplikacji",
    pinNotRequired: "nie wymagany",
    pinSet: "ustawiony",
    pinMissing: "brak",
    cardLabel: "Karta",
    cardUnassigned: "nieprzypisana",
    btnEdit: "Edytuj",
    btnDelete: "Usun",
    btnRestore: "Przywroc",
    btnAppLink: "Link aplikacji",
    btnResetPin: "Resetuj PIN",
    confirmDeleteWorker: "Usunac pracownika teraz?",
    alertDeleteWorkerFailed: "Nie udalo sie usunac pracownika: {error}",
    alertRestoreWorkerFailed: "Nie udalo sie przywrocic pracownika: {error}",
    alertAppLinkCreateFailed: "Nie udalo sie utworzyc linku aplikacji: {error}",
    promptResetPinFor: "Nowy PIN odznaki dla {name} (4-8 cyfr):",
    alertPinMustDigits: "PIN musi zawierac od 4 do 8 cyfr.",
    alertPinResetSuccessFor: "PIN dla {name} zostal pomyslnie zresetowany.",
    alertPinResetFailed: "Nie udalo sie zresetowac PIN: {error}",
    detailCloseTitle: "Zamknij",
    detailPhotoAlt: "Zdjecie pracownika",
    detailCheckinBtn: "Wejscie (Check-in)",
    detailCheckoutBtn: "Wyjscie (Check-out)",
    accessFormEyebrow: "Bramka",
    accessFormH3: "Check-in i check-out",
    labelAccessBadge: "Badge ID lub pracownik",
    labelAccessDir: "Kierunek",
    labelAccessGate: "Brama",
    labelAccessNote: "Uwaga",
    optCheckin: "Wejście",
    optCheckout: "Wyjście",
    btnAccessSubmit: "Zapisz wejście",
    porterEmpty: "Widok portiera: wybierz pracownika i zapisz wejście.",
    accessLogEyebrow: "Rejestr wejść",
    accessLogH3: "Wejścia i wyjścia ze znacznikiem czasu",
    labelFrom: "Od",
    labelTo: "Do",
    labelFilterDir: "Kierunek",
    labelFilterGate: "Bramka",
    optAllDir: "Wszystkie",
    btnApplyFilter: "Zastosuj filtr",
    btnResetFilter: "Resetuj filtr",
    btnAccessCsv: "Eksportuj wejścia CSV",
    dailyReportEyebrow: "Raport dzienny",
    dailyReportH3: "Według bramy",
    btnPrintDaily: "Drukuj raport dzienny",
    btnPrintVisitorWeekly: "Drukuj tygodniową listę gości",
    hourlyEyebrow: "Analiza godzinowa",
    hourlyH3: "Wejścia/wyjścia na godzinę",
    warningsEyebrow: "Ostrzeżenia",
    warningsH3: "Wejście bez wyjścia",
    invListEyebrow: "Fakturowanie",
    invListH3: "Faktury i status płatności",
    optAllStatus: "Wszystkie statusy",
    optDraft: "Szkic",
    optSent: "Wysłana",
    optOverdue: "Zaległa",
    optPaid: "Opłacona",
    optFailed: "Błąd",
    btnRefreshList: "Odśwież",
    inkassoEyebrow: "Windykacja",
    inkassoH3: "Zaległa, pre-blokada, zablokowana",
    optAllPositions: "Wszystkie otwarte pozycje",
    optPrelock: "Pre-blokada",
    optLocked: "Już zablokowana",
    adminEyebrow: "Centrum administracji",
    adminH3: "System i konfiguracja",
    sysStatusEyebrow: "Stan systemu",
    sysStatusH3: "Dostęp awaryjny i naprawa",
    btnRefreshStatus: "Odśwież stan",
    btnRepairSessions: "Napraw sesje",
    superAdminEyebrow: "Kontrola systemu",
    superAdminH3: "Ustawienia super admina",
    labelPlatformName: "Nazwa platformy",
    labelOperatorName: "Operator",
    labelTurnstileEp: "Endpoint API bramki",
    labelSmtpHost: "SMTP Host",
    labelSmtpPort: "SMTP Port",
    labelSmtpUser: "Użytkownik SMTP",
    labelSmtpPass: "Hasło SMTP",
    labelSenderEmail: "E-mail nadawcy",
    labelSenderName: "Nazwa nadawcy",
    labelTls: "TLS aktywne",
    optTlsYes: "Tak",
    optTlsNo: "Nie",
    optYes: "Tak",
    optNo: "Nie",
    labelIpWhitelist: "Biała lista IP admina",
    labelEnforceDomain: "Wymuś domenę firmy",
    btnSaveAdmin: "Zapisz ustawienia admina",
    companyNewEyebrow: "Najemcy",
    companyNewH3: "Dodaj firmę budowlaną",
    labelCompanyName: "Nazwa firmy",
    labelCompanyContact: "Osoba kontaktowa",
    labelBillingEmail: "E-mail do faktur",
    labelAccessHost: "Domena dostępu firmy",
    labelPlan: "Plan",
    labelCompanyStatus: "Status",
    optCompanyActive: "Aktywna",
    optCompanyTest: "Testowa",
    optCompanyPaused: "Wstrzymana",
    optCompanyLocked: "Zablokowana (zaległa płatność)",
    labelCompanyAdminPassword: "Startowe hasło admina",
    companyAdminPasswordPlaceholder: "np. Bezpieczne!2025",
    btnCreateCompany: "Utwórz firmę",
    accountEyebrow: "Konto",
    accountH3: "Zmień hasło",
    labelCurrentPassword: "Aktualne hasło",
    labelNewPassword: "Nowe hasło",
    btnChangePassword: "Zmień hasło",
    tfaEyebrow: "Drugi czynnik",
    tfaH3: "Zarządzanie 2FA",
    companiesListEyebrow: "Najemcy",
    companiesListH3: "Firmy i plany",
    invFormEyebrow: "Faktury",
    invFormH3: "Wyślij z logo i projektem",
    labelInvFirm: "Firma",
    labelInvNumber: "Numer faktury",
    labelInvRecipient: "E-mail odbiorcy",
    labelInvDate: "Data faktury",
    labelInvDueDate: "Termin płatności",
    labelInvPeriod: "Okres usługi",
    labelInvDescription: "Opis usługi",
    labelInvNet: "Kwota netto (EUR)",
    labelInvVat: "VAT (%)",
    btnPrintInvoice: "Drukuj fakturę / Zapisz PDF",
    btnSendInvoice: "Wyślij fakturę e-mailem",
    btnUpdatePreview: "Aktualizuj podgląd",
    auditEyebrow: "Rejestr bezpieczeństwa",
    auditH3: "Rejestr audytu",
    labelAuditEvent: "Typ zdarzenia",
    labelAuditRole: "Rola",
    btnAuditCsv: "Eksportuj audyt CSV",
  },
};

function normalizeUiLang(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(UI_TRANSLATIONS, candidate) ? candidate : UI_FALLBACK_LANG;
}

function getStoredUiLang() {
  return normalizeUiLang(window.localStorage.getItem(UI_LANG_STORAGE_KEY));
}

function uiT(key) {
  const lang = getStoredUiLang();
  return UI_TRANSLATIONS[lang]?.[key] || UI_TRANSLATIONS[UI_FALLBACK_LANG]?.[key] || key;
}

const UI_PLACEHOLDER_TEXTS = {
  subcompanyName: { de: "z. B. Elektro Yilmaz GmbH", intl: "e.g. Elektro Yilmaz Ltd" },
  firstName: { de: "Max", intl: "John" },
  lastName: { de: "Mustermann", intl: "Smith" },
  insuranceNumber: { de: "12 345678 A 123", intl: "12 345678 A 123" },
  role: { de: "Polier, Kranfuehrer, Monteur", intl: "Foreman, Crane operator, Installer" },
  site: { de: "Neubau Mitte", intl: "Central construction site" },
  physicalCardId: { de: "UID oder Kartenkennung", intl: "UID or card identifier" },
  visitorCompany: { de: "z. B. Lieferant, Kunde, externe Firma", intl: "e.g. Supplier, Customer, External company" },
  visitPurpose: { de: "z. B. Besprechung, Lieferung, Abnahme", intl: "e.g. Meeting, Delivery, Inspection" },
  hostName: { de: "z. B. Bauleiter Mustafa Yilmaz", intl: "e.g. Site manager Michael Miller" },
  badgePin: { de: "4 bis 8 Ziffern", intl: "4 to 8 digits" },
  workerSearchInput: { de: "Suchen: Name, Badge-ID, Baustelle ...", intl: "Search: Name, Badge ID, Site ..." },
  accessWorkerSearch: { de: "Name oder Badge-ID suchen", intl: "Search name or Badge ID" },
  accessNote: { de: "Optional", intl: "Optional" },
  accessFilterGate: { de: "z. B. Drehkreuz Nord", intl: "e.g. Gate North" },
  dayCloseComment: { de: "z. B. Schichtleiter informiert, Austritt wird nachgetragen", intl: "e.g. Shift lead informed, exit will be recorded later" },
  invoiceFilterCompany: { de: "Nach Firma filtern...", intl: "Filter by company..." },
  platformName: { de: "BauPass Control", intl: "BauPass Control" },
  operatorName: { de: "Deine Firma", intl: "Your company" },
  turnstileEndpoint: { de: "https://api.dein-gateway.de/access", intl: "https://api.your-gateway.com/access" },
  smtpHost: { de: "smtp.dein-provider.de", intl: "smtp.your-provider.com" },
  smtpUsername: { de: "mailer@deinefirma.de", intl: "mailer@yourcompany.com" },
  smtpPassword: { de: "App-Passwort", intl: "App password" },
  smtpSenderEmail: { de: "rechnung@deinefirma.de", intl: "billing@yourcompany.com" },
  smtpSenderName: { de: "Deine Firma", intl: "Your company" },
  adminIpWhitelist: { de: "203.0.113.10, 203.0.113.0/24", intl: "203.0.113.10, 203.0.113.0/24" },
  companyName: { de: "Muster Bau GmbH", intl: "Example Construction Ltd" },
  companyContact: { de: "Sabine Keller", intl: "Sarah Keller" },
  companyBillingEmail: { de: "buchhaltung@firma.de", intl: "billing@company.com" },
  companyAccessHost: { de: "firma-a.deine-domain.de", intl: "company-a.your-domain.com" },
  invoiceNumber: { de: "RE-2026-0001", intl: "INV-2026-0001" },
  invoiceRecipientEmail: { de: "buchhaltung@firma.de", intl: "billing@company.com" },
  invoicePeriod: { de: "01.04.2026 - 30.04.2026", intl: "2026-04-01 - 2026-04-30" },
  invoiceDescription: { de: "Digitale Baustellen-Ausweise + Zutrittskontrolle", intl: "Digital site IDs + access control" },
  auditEventType: { de: "z. B. worker.deleted", intl: "e.g. worker.deleted" },
};

function applyUiPlaceholders() {
  const lang = getStoredUiLang();
  const useGerman = lang === "de";
  Object.entries(UI_PLACEHOLDER_TEXTS).forEach(([elementId, texts]) => {
    const element = document.querySelector(`#${elementId}`);
    if (!element) {
      return;
    }
    const nextPlaceholder = useGerman
      ? (texts.de || "")
      : (texts[lang] || texts.intl || texts.de || "");
    if (nextPlaceholder) {
      element.setAttribute("placeholder", nextPlaceholder);
    }
  });
}

const UI_LANGUAGE_META = {
  de: { code: "DE", flag: "de" },
  en: { code: "EN", flag: "en" },
  tr: { code: "TR", flag: "tr" },
  ar: { code: "AR", flag: "ar" },
  fr: { code: "FR", flag: "fr" },
  es: { code: "ES", flag: "es" },
  it: { code: "IT", flag: "it" },
  pl: { code: "PL", flag: "pl" },
};

function updateAuthLanguageControl(lang) {
  const normalized = normalizeUiLang(lang);
  const meta = UI_LANGUAGE_META[normalized] || UI_LANGUAGE_META[UI_FALLBACK_LANG];
  const authSelect = document.querySelector("#uiLangAuthSelect");
  if (authSelect) {
    authSelect.value = normalized;
  }

  const triggerFlag = document.querySelector("#uiLangAuthTriggerFlag");
  const triggerCode = document.querySelector("#uiLangAuthTriggerCode");
  if (triggerFlag) triggerFlag.setAttribute("data-flag", meta.flag);
  if (triggerCode) triggerCode.textContent = meta.code;

  document.querySelectorAll(".auth-lang-option[data-ui-lang-option]").forEach((button) => {
    const isActive = button.getAttribute("data-ui-lang-option") === normalized;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function closeAuthLanguageMenu() {
  const shell = document.querySelector("#uiLangAuthShell");
  const trigger = document.querySelector("#uiLangAuthTrigger");
  if (shell) shell.classList.remove("is-open");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function toggleAuthLanguageMenu() {
  const shell = document.querySelector("#uiLangAuthShell");
  const trigger = document.querySelector("#uiLangAuthTrigger");
  if (!shell || !trigger) return;
  const nextOpen = !shell.classList.contains("is-open");
  shell.classList.toggle("is-open", nextOpen);
  trigger.setAttribute("aria-expanded", nextOpen ? "true" : "false");
}

function applyUiTranslations() {
  const lang = getStoredUiLang();
  const isRtl = lang === "ar";
  document.documentElement.lang = lang;
  const authPanel = document.querySelector(".auth-panel");
  if (authPanel) {
    authPanel.setAttribute("dir", isRtl ? "rtl" : "ltr");
  }

  document.querySelectorAll("[data-ui-i18n]").forEach((el) => {
    const key = el.getAttribute("data-ui-i18n");
    const attr = el.getAttribute("data-ui-i18n-attr");
    if (!key) return;
    const value = uiT(key);
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });

  applyUiPlaceholders();
  applyRuntimeUiTexts();

  updateAuthLanguageControl(lang);
  const topbarSelect = document.querySelector("#uiLangTopbarSelect");
  if (topbarSelect) topbarSelect.value = lang;
}

function setUiLang(lang) {
  const normalized = normalizeUiLang(lang);
  window.localStorage.setItem(UI_LANG_STORAGE_KEY, normalized);
  applyUiTranslations();
  applySystemTheme(getStoredSystemTheme(), { persist: false });
  updateDesktopInstallHint();
}

function initUiLanguageControl() {
  const initial = getStoredUiLang();
  window.localStorage.setItem(UI_LANG_STORAGE_KEY, initial);
  const authSelect = document.querySelector("#uiLangAuthSelect");
  const authShell = document.querySelector("#uiLangAuthShell");
  const authTrigger = document.querySelector("#uiLangAuthTrigger");
  if (authSelect) {
    authSelect.value = initial;
    authSelect.addEventListener("change", () => setUiLang(authSelect.value || UI_FALLBACK_LANG));
  }
  if (authTrigger) {
    authTrigger.addEventListener("click", () => toggleAuthLanguageMenu());
  }
  document.querySelectorAll(".auth-lang-option[data-ui-lang-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextLang = button.getAttribute("data-ui-lang-option") || UI_FALLBACK_LANG;
      closeAuthLanguageMenu();
      setUiLang(nextLang);
    });
  });
  document.addEventListener("click", (event) => {
    if (!authShell || !authShell.contains(event.target)) {
      closeAuthLanguageMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthLanguageMenu();
    }
  });
  const topbarSelect = document.querySelector("#uiLangTopbarSelect");
  if (topbarSelect) {
    topbarSelect.value = initial;
    topbarSelect.addEventListener("change", () => setUiLang(topbarSelect.value));
  }
  applyUiTranslations();
}

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

function getSystemThemeTexts() {
  const lang = getStoredUiLang();
  const map = {
    de: {
      labelPrefix: "Fensterfarbe",
      white: "Weiss",
      dark: "Dunkel",
      titleWhenDark: "Aktuell Dunkel. Klicken fuer Weiss.",
      titleWhenWhite: "Aktuell Weiss. Klicken fuer Dunkel."
    },
    en: {
      labelPrefix: "Window color",
      white: "Light",
      dark: "Dark",
      titleWhenDark: "Currently dark. Click for light.",
      titleWhenWhite: "Currently light. Click for dark."
    },
    tr: {
      labelPrefix: "Pencere rengi",
      white: "Aydinlik",
      dark: "Koyu",
      titleWhenDark: "Su an koyu. Aydinlik icin tiklayin.",
      titleWhenWhite: "Su an aydinlik. Koyu icin tiklayin."
    },
    ar: {
      labelPrefix: "لون النافذة",
      white: "فاتح",
      dark: "داكن",
      titleWhenDark: "الوضع الحالي داكن. انقر للوضع الفاتح.",
      titleWhenWhite: "الوضع الحالي فاتح. انقر للوضع الداكن."
    },
    fr: {
      labelPrefix: "Couleur de fenetre",
      white: "Clair",
      dark: "Sombre",
      titleWhenDark: "Mode sombre actif. Cliquer pour clair.",
      titleWhenWhite: "Mode clair actif. Cliquer pour sombre."
    },
    es: {
      labelPrefix: "Color de ventana",
      white: "Claro",
      dark: "Oscuro",
      titleWhenDark: "Modo oscuro activo. Haz clic para claro.",
      titleWhenWhite: "Modo claro activo. Haz clic para oscuro."
    },
    it: {
      labelPrefix: "Colore finestra",
      white: "Chiaro",
      dark: "Scuro",
      titleWhenDark: "Modalita scura attiva. Clicca per chiaro.",
      titleWhenWhite: "Modalita chiara attiva. Clicca per scuro."
    },
    pl: {
      labelPrefix: "Kolor okna",
      white: "Jasny",
      dark: "Ciemny",
      titleWhenDark: "Aktualnie ciemny. Kliknij, aby ustawic jasny.",
      titleWhenWhite: "Aktualnie jasny. Kliknij, aby ustawic ciemny."
    }
  };
  return map[lang] || map.de;
}

function getThemeModeLabel(mode) {
  const texts = getSystemThemeTexts();
  return mode === SYSTEM_THEME_BLACK ? texts.dark : texts.white;
}

function applySystemTheme(mode, { persist = true } = {}) {
  const selectedMode = normalizeSystemTheme(mode);
  document.body.classList.remove("theme-black", "theme-white");
  document.body.classList.add(selectedMode === SYSTEM_THEME_BLACK ? "theme-black" : "theme-white");
  document.body.style.setProperty("--window-color", selectedMode === SYSTEM_THEME_BLACK ? "#000000" : "#ffffff");
  if (persist) {
    window.localStorage.setItem(SYSTEM_THEME_STORAGE_KEY, selectedMode);
  }
  window.localStorage.removeItem("baupass-system-theme-color");

  const button = document.querySelector("#systemThemeToggleButton");
  if (button) {
    const texts = getSystemThemeTexts();
    button.textContent = `${texts.labelPrefix}: ${getThemeModeLabel(selectedMode)}`;
    button.title = selectedMode === SYSTEM_THEME_BLACK
      ? texts.titleWhenDark
      : texts.titleWhenWhite;
  }
}

function toggleSystemTheme() {
  const currentMode = getStoredSystemTheme();
  applySystemTheme(currentMode === SYSTEM_THEME_BLACK ? SYSTEM_THEME_WHITE : SYSTEM_THEME_BLACK);
}

function initSystemThemeControl() {
  applySystemTheme(getStoredSystemTheme(), { persist: false });
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

let token = loadStoredSessionToken();
let qrLibraryLoadPromise = null;
let accessFeedbackTimer = null;
let accessAudioContext = null;
let cameraStream = null;
let backendStatusTimer = null;
let heartbeatTimer = null;
let selfieSegmenter = null;
let sessionExpiryNoticeShown = false;
let sessionExpiryNoticeAt = 0;

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

function getRuntimeUiTexts() {
  const lang = getStoredUiLang();
  const base = {
    sessionLoggedIn: "Signed in",
    sessionRole: "Role",
    roleUnknown: "Unknown",
    roleSuperadmin: "Superadmin",
    roleCompanyAdmin: "Company admin",
    roleTurnstile: "Turnstile",
    statsWorkersTotal: "Workers total",
    statsWorkersActive: "Active workers",
    statsVisitorsTotal: "Visitors total",
    statsCompanies: "Companies",
    statsAccessToday: "Access today",
    badgePinHintVisitor: "Visitors use the one-time link/QR. A badge PIN is not required for visitors.",
    badgePinHintWorker: "Badge login in the worker app now works only with badge ID and this PIN. While editing, you can set a new PIN here.",
    workerListEmpty: "No workers created yet.",
    workerListNoResults: "No results for \"{term}\".",
    recentAccessEmpty: "No access bookings yet.",
    badgeEmptyStateShort: "Please create a worker first.",
    badgeNoneSelected: "No badge selected.",
    dayReportEmpty: "No data available for the daily report yet.",
    hourlyEmpty: "No hourly values available.",
    summaryEntries: "Entries",
    summaryExits: "Exits",
    summaryTotal: "Total",
    summaryLastBooking: "Latest booking",
    summaryPeople: "Visitors / Workers",
    hourlyIn: "In",
    hourlyOut: "Out",
    cameraNotStarted: "Camera not started.",
    cameraUnavailableWithHint: "Browser camera unavailable.{hint}",
    cameraHintSecureContext: " HTTPS or localhost is required.",
    cameraActiveCanCapture: "Camera active. You can now take a photo.",
    cameraNeedsHttps: "Browser camera requires HTTPS or localhost.",
    cameraAccessBlocked: "Camera access was blocked. Please allow camera permission in the browser.",
    cameraNotFound: "No camera found.",
    cameraInUse: "Camera is already in use by another app or browser tab.",
    cameraConstraintFailed: "Camera could not be started with the requested settings.",
    cameraApiMissing: "This browser does not provide a live camera API.",
    cameraStartFailed: "Camera could not be started: {reason}",
    photoCaptured: "Photo captured ({preview})",
    photoPosition: "Position: X {x} | Y {y}",
    photoSharpenNormal: "Normal",
    photoSharpenSoft: "Soft",
    photoSharpenVerySharp: "Very sharp",
    photoRequiredOk: "Photo captured. Badge can be saved.",
    photoRequiredMissing: "Required: Without a photo, the badge cannot be saved.",
    bulkSelectedCount: "{count} selected",
    photoWhiteBgActive: "Background fully white (active)",
    photoAdjustHelp: "Move the photo after capture so it fits cleanly on the right side of the badge.",
    photoZoomCropLabel: "Zoom / Crop",
    photoSharpenLabel: "Sharpness:",
    bulkSelectAllLabel: "Select all",
    noSubcompanyOption: "No subcompany",
    selectPersonOption: "Please select a person",
    visitorTagShort: "Visitor",
    dashboardLastAccessPlaceholder: "Latest access is shown once a check-in or check-out exists.",
    dashboardLastAccessHeading: "Latest access",
    dashboardDirectionCheckin: "Check-in",
    dashboardDirectionCheckout: "Check-out",
    unknownPerson: "Unknown",
    unknownCompany: "Unknown company",
    unknownTurnstile: "Unknown turnstile",
    accessFilterEmpty: "No access bookings for the selected filter.",
    dayCloseAutoClosedAfterMidnight: "Automatically checked out after 00:00:",
    dayCloseAckTitle: "Day-close already acknowledged",
    dayCloseAckByOn: "By {user} on {when}",
    dayCloseCommentLabel: "Comment: {comment}",
    dayCloseCheckActive: "Day-close check active",
    dayCloseOpenEntriesNoExit: "{count} open check-ins without check-out.",
    dayCloseNoOpenEntries: "No open check-ins.",
    dayCloseAlertAt18: "Day-close 18:00: {count} open check-ins without check-out found.",
    dayCloseCommentMin: "Please enter a meaningful comment with at least 4 characters.",
    dayCloseAckSuccess: "Day-close acknowledged successfully.",
    turnstileSelectWorkerFirst: "Please select a worker first.",
    workerPhotoRequired: "Please take a photo first. The badge can only be saved with photo.",
    subcompanyNameRequired: "Please select company and subcompany name first.",
    cameraPermissionRetry: "Camera access was blocked. Please allow camera access in the browser and click Start camera again.",
    photoReadFailed: "Photo could not be read.",
    photoLoadFailed: "Photo could not be loaded.",
    cameraStartFirst: "Please start the camera first.",
    photoProcessingUnavailable: "Photo processing unavailable.",
    workerBadgePinMissing: "Please set a badge PIN for the worker.",
    visitorPurposeMissing: "Please provide a visit purpose.",
    visitorCompanyMissing: "Please provide the visitor company.",
    visitorHostMissing: "Please provide an on-site contact person.",
    visitorEndMissing: "Please provide a visit end date and time.",
    popupBlockedAllow: "Popup blocked. Please allow popups.",
    logoImageFileRequired: "Please select an image file for the logo.",
    invoiceSentEmail: "Invoice sent by email.",
    invoiceSavedEmailNotConfigured: "Invoice saved, but email is not configured. Please configure SMTP in Admin settings.",
    invoiceSelectCompany: "Please select a company.",
    invoiceRecipientInvalid: "Please enter a valid recipient email.",
    invoiceFormRequiredFields: "Please fill in invoice date, due date, service period, and service description.",
    invoiceMarkedPaid: "Invoice marked as paid.",
    backendUnreachableReload: "Backend unreachable. Please check server/network and reload.",
    loginResponseIncomplete: "Login response from server is incomplete. Please reload and try again.",
    demoAdminOnly: "Only admin roles can load demo data.",
    loginFirst: "Please sign in first.",
  };
  const map = {
    de: {
      sessionLoggedIn: "Angemeldet",
      sessionRole: "Rolle",
      roleUnknown: "Unbekannt",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Firmen-Admin",
      roleTurnstile: "Drehkreuz",
      statsWorkersTotal: "Mitarbeiter gesamt",
      statsWorkersActive: "Aktive Mitarbeiter",
      statsVisitorsTotal: "Besucher gesamt",
      statsCompanies: "Firmen",
      statsAccessToday: "Zutritte heute",
      badgePinHintVisitor: "Besucher nutzen den Einmal-Link/QR. Eine Badge-PIN ist fuer Besucher nicht erforderlich.",
      badgePinHintWorker: "Badge-Login in der Mitarbeiter-App funktioniert nur noch mit Badge-ID und dieser PIN. Beim Bearbeiten kannst du hier eine neue PIN setzen.",
      workerListEmpty: "Noch keine Mitarbeiter angelegt.",
      workerListNoResults: "Keine Treffer fuer \"{term}\".",
      recentAccessEmpty: "Noch keine Zutrittsbuchungen vorhanden.",
      badgeEmptyStateShort: "Bitte zuerst einen Mitarbeiter anlegen.",
      badgeNoneSelected: "Kein Badge ausgewaehlt.",
      dayReportEmpty: "Noch keine Daten fuer den Tagesbericht.",
      hourlyEmpty: "Keine Stundenwerte verfuegbar.",
      summaryEntries: "Eintritte",
      summaryExits: "Austritte",
      summaryTotal: "Gesamt",
      summaryLastBooking: "Letzte Buchung",
      summaryPeople: "Besucher / Mitarbeiter",
      hourlyIn: "In",
      hourlyOut: "Out",
      cameraNotStarted: "Kamera noch nicht gestartet.",
      cameraUnavailableWithHint: "Browser-Kamera nicht verfuegbar.{hint}",
      cameraHintSecureContext: " HTTPS oder localhost ist erforderlich.",
      cameraActiveCanCapture: "Kamera aktiv. Du kannst jetzt ein Foto aufnehmen.",
      cameraNeedsHttps: "Browser-Kamera benoetigt HTTPS oder localhost.",
      cameraAccessBlocked: "Kamera-Zugriff wurde blockiert. Bitte Browser-Berechtigung fuer Kamera erlauben.",
      cameraNotFound: "Keine Kamera gefunden.",
      cameraInUse: "Kamera ist bereits von einer anderen App oder Browser-Registerkarte belegt.",
      cameraConstraintFailed: "Kamera konnte mit den angeforderten Einstellungen nicht gestartet werden.",
      cameraApiMissing: "Dieser Browser stellt keine Live-Kamera-API bereit.",
      cameraStartFailed: "Kamera konnte nicht gestartet werden: {reason}",
      photoCaptured: "Foto erfasst ({preview})",
      photoPosition: "Position: X {x} | Y {y}",
      photoSharpenNormal: "Normal",
      photoSharpenSoft: "Weich",
      photoSharpenVerySharp: "Sehr scharf",
      photoRequiredOk: "Foto erfasst. Ausweis kann gespeichert werden.",
      photoRequiredMissing: "Pflicht: Ohne Foto kann der Ausweis nicht gespeichert werden.",
      bulkSelectedCount: "{count} ausgewaehlt",
      photoWhiteBgActive: "Hintergrund komplett weiss (aktiv)",
      photoAdjustHelp: "Foto nach Aufnahme verschieben, damit es rechts im Ausweis sauber passt.",
      photoZoomCropLabel: "Zoom / Zuschneiden",
      photoSharpenLabel: "Schaerfe:",
      bulkSelectAllLabel: "Alle auswaehlen",
      noSubcompanyOption: "Kein Subunternehmen",
      selectPersonOption: "Bitte Person waehlen",
      visitorTagShort: "Besucher",
      dashboardLastAccessPlaceholder: "Letzter Zutritt wird angezeigt, sobald eine An- oder Abmeldung vorliegt.",
      dashboardLastAccessHeading: "Letzter Zutritt",
      dashboardDirectionCheckin: "Anmeldung",
      dashboardDirectionCheckout: "Abmeldung",
      unknownPerson: "Unbekannt",
      unknownCompany: "Unbekannte Firma",
      unknownTurnstile: "Unbekanntes Drehkreuz",
      accessFilterEmpty: "Keine Zutrittsbuchungen fuer den gewaelten Filter.",
      dayCloseAutoClosedAfterMidnight: "Nach 00:00 automatisch abgemeldet:",
      dayCloseAckTitle: "Tagesabschluss bereits quittiert",
      dayCloseAckByOn: "Von {user} am {when}",
      dayCloseCommentLabel: "Kommentar: {comment}",
      dayCloseCheckActive: "Tagesabschluss-Pruefung aktiv",
      dayCloseOpenEntriesNoExit: "{count} offene Eintritte ohne Austritt.",
      dayCloseNoOpenEntries: "Keine offenen Eintritte.",
      dayCloseAlertAt18: "Tagesabschluss 18:00: {count} offene Eintritte ohne Austritt gefunden.",
      dayCloseCommentMin: "Bitte einen aussagekraeftigen Kommentar mit mindestens 4 Zeichen eingeben.",
      dayCloseAckSuccess: "Tagesabschluss wurde erfolgreich quittiert.",
      turnstileSelectWorkerFirst: "Bitte zuerst einen Mitarbeiter auswaehlen.",
      workerPhotoRequired: "Bitte zuerst ein Foto aufnehmen. Der Ausweis wird nur mit Foto gespeichert.",
      subcompanyNameRequired: "Bitte zuerst Firma und Subunternehmensname angeben.",
      cameraPermissionRetry: "Kamera-Zugriff wurde blockiert. Bitte Browser-Zugriff auf die Kamera erlauben und erneut auf Kamera starten klicken.",
      photoReadFailed: "Foto konnte nicht gelesen werden.",
      photoLoadFailed: "Foto konnte nicht geladen werden.",
      cameraStartFirst: "Bitte zuerst die Kamera starten.",
      photoProcessingUnavailable: "Fotoverarbeitung nicht verfuegbar.",
      workerBadgePinMissing: "Bitte eine Badge-PIN fuer den Mitarbeiter setzen.",
      visitorPurposeMissing: "Bitte einen Besuchszweck angeben.",
      visitorCompanyMissing: "Bitte die Besucherfirma angeben.",
      visitorHostMissing: "Bitte einen Ansprechpartner vor Ort angeben.",
      visitorEndMissing: "Bitte ein Besuchsende mit Datum und Uhrzeit angeben.",
      popupBlockedAllow: "Popup blockiert. Bitte Popups erlauben.",
      logoImageFileRequired: "Bitte eine Bilddatei fuer das Logo auswaehlen.",
      invoiceSentEmail: "Rechnung wurde per E-Mail versendet.",
      invoiceSavedEmailNotConfigured: "Rechnung wurde gespeichert, aber E-Mail ist nicht eingerichtet. Bitte SMTP im Superadmin-Bereich unter Admin-Einstellungen konfigurieren.",
      invoiceSelectCompany: "Bitte eine Firma auswaehlen.",
      invoiceRecipientInvalid: "Bitte eine gueltige Empfaenger-E-Mail eingeben.",
      invoiceFormRequiredFields: "Bitte Rechnungsdatum, Faelligkeitsdatum, Leistungszeitraum und Leistungsbeschreibung ausfuellen.",
      invoiceMarkedPaid: "Rechnung als bezahlt markiert",
      backendUnreachableReload: "Backend nicht erreichbar. Bitte pruefe, ob der Server laeuft und lade die Seite neu.",
      loginResponseIncomplete: "Login-Antwort vom Server ist unvollstaendig. Bitte Seite neu laden und erneut versuchen.",
      demoAdminOnly: "Nur Admin-Rollen duerfen Demo-Daten laden.",
      loginFirst: "Bitte zuerst anmelden.",
    },
    tr: {
      sessionLoggedIn: "Giris yapan",
      sessionRole: "Rol",
      roleUnknown: "Bilinmiyor",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Firma Y\u00f6neticisi",
      roleTurnstile: "Turnike",
      statsWorkersTotal: "Toplam \u00e7al\u0131\u015fan",
      statsWorkersActive: "Aktif \u00e7al\u0131\u015fan",
      statsVisitorsTotal: "Toplam ziyaret\u00e7i",
      statsCompanies: "Firmalar",
      statsAccessToday: "Bug\u00fcnk\u00fc giri\u015f",
      recentAccessEmpty: "Hen\u00fcz eri\u015fim kayd\u0131 yok.",
    },
    ar: {
      sessionLoggedIn: "تسجيل الدخول",
      sessionRole: "الدور",
      roleUnknown: "غير معروف",
      roleSuperadmin: "مشرف عام",
      roleCompanyAdmin: "مسؤول الشركة",
      roleTurnstile: "البوابة",
      statsWorkersTotal: "إجمالي الموظفين",
      statsWorkersActive: "الموظفون النشطون",
      statsVisitorsTotal: "إجمالي الزوار",
      statsCompanies: "الشركات",
      statsAccessToday: "دخول اليوم",
      recentAccessEmpty: "\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a \u0648\u0635\u0648\u0644 \u0628\u0639\u062f.",
    },
    fr: {
      sessionLoggedIn: "Connecte",
      sessionRole: "Role",
      roleUnknown: "Inconnu",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Admin entreprise",
      roleTurnstile: "Tourniquet",
      statsWorkersTotal: "Employes total",
      statsWorkersActive: "Employes actifs",
      statsVisitorsTotal: "Visiteurs total",
      statsCompanies: "Entreprises",
      statsAccessToday: "Acces aujourd'hui",
      recentAccessEmpty: "Aucune r\u00e9servation d'acc\u00e8s encore.",
    },
    es: {
      sessionLoggedIn: "Conectado",
      sessionRole: "Rol",
      roleUnknown: "Desconocido",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Admin de empresa",
      roleTurnstile: "Torno",
      statsWorkersTotal: "Trabajadores total",
      statsWorkersActive: "Trabajadores activos",
      statsVisitorsTotal: "Visitantes total",
      statsCompanies: "Empresas",
      statsAccessToday: "Accesos hoy",
      recentAccessEmpty: "A\u00fan no hay registros de acceso.",
    },
    it: {
      sessionLoggedIn: "Accesso",
      sessionRole: "Ruolo",
      roleUnknown: "Sconosciuto",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Admin azienda",
      roleTurnstile: "Tornello",
      statsWorkersTotal: "Lavoratori totali",
      statsWorkersActive: "Lavoratori attivi",
      statsVisitorsTotal: "Visitatori totali",
      statsCompanies: "Aziende",
      statsAccessToday: "Accessi oggi",
      recentAccessEmpty: "Nessuna prenotazione di accesso ancora.",
    },
    pl: {
      sessionLoggedIn: "Zalogowany",
      sessionRole: "Rola",
      roleUnknown: "Nieznana",
      roleSuperadmin: "Superadmin",
      roleCompanyAdmin: "Admin firmy",
      roleTurnstile: "Bramka",
      statsWorkersTotal: "Pracownicy lacznie",
      statsWorkersActive: "Aktywni pracownicy",
      statsVisitorsTotal: "Goscie lacznie",
      statsCompanies: "Firmy",
      statsAccessToday: "Wejscia dzis",
      recentAccessEmpty: "Brak jeszcze rezerwacji dost\u0119pu.",
    },
  };
  return {
    ...base,
    ...(map[lang] || map.de),
  };
}

function runtimeText(key) {
  const texts = getRuntimeUiTexts();
  return texts[key] || "";
}

function runtimeTextTemplate(key, values = {}) {
  let template = runtimeText(key);
  Object.entries(values).forEach(([token, value]) => {
    template = template.replace(new RegExp(`\\{${token}\\}`, "g"), String(value));
  });
  return template;
}

function applyRuntimeUiTexts() {
  const cameraPlaceholder = document.querySelector("#cameraPlaceholder");
  const photoDebugText = document.querySelector("#photoDebugText");
  const photoWhiteBgLabel = document.querySelector("#photoWhiteBgLabel");
  const photoAdjustHelp = document.querySelector("#photoAdjustHelp");
  const photoZoomCropLabel = document.querySelector("#photoZoomCropLabel");
  const photoSharpenLabel = document.querySelector("#photoSharpenLabel");
  const photoRequiredHint = document.querySelector("#photoRequiredHint");
  const photoAdjustStatus = document.querySelector("#photoAdjustStatus");
  const badgePinHint = document.querySelector("#badgePinHint");
  const bulkSelectAllText = document.querySelector("#bulkSelectAllText");

  if (cameraPlaceholder && !cameraPlaceholder.hidden) {
    cameraPlaceholder.textContent = runtimeText("cameraNotStarted");
  }
  if (photoDebugText) {
    const current = (photoDebugText.textContent || "").trim();
    const defaultDe = "Kamera noch nicht gestartet.";
    const defaultEn = "Camera not started.";
    if (!current || current === defaultDe || current === defaultEn) {
      photoDebugText.textContent = runtimeText("cameraNotStarted");
    }
  }
  if (photoWhiteBgLabel) photoWhiteBgLabel.textContent = runtimeText("photoWhiteBgActive");
  if (photoAdjustHelp) photoAdjustHelp.textContent = runtimeText("photoAdjustHelp");
  if (photoZoomCropLabel) photoZoomCropLabel.textContent = runtimeText("photoZoomCropLabel");
  if (photoSharpenLabel) photoSharpenLabel.textContent = runtimeText("photoSharpenLabel");
  if (photoRequiredHint && photoRequiredHint.classList.contains("helper-text-warning")) {
    photoRequiredHint.textContent = runtimeText("photoRequiredMissing");
  }
  if (photoAdjustStatus) {
    const current = (photoAdjustStatus.textContent || "").trim();
    if (!current || current.startsWith("Position:")) {
      photoAdjustStatus.textContent = runtimeTextTemplate("photoPosition", { x: 0, y: 0 });
    }
  }
  if (badgePinHint) {
    const workerType = document.querySelector("#workerType")?.value || "worker";
    badgePinHint.textContent = workerType === "visitor"
      ? runtimeText("badgePinHintVisitor")
      : runtimeText("badgePinHintWorker");
  }
  if (bulkSelectAllText) bulkSelectAllText.textContent = runtimeText("bulkSelectAllLabel");
}

function getRoleLabel(role) {
  const texts = getRuntimeUiTexts();
  const normalized = String(role || "").toLowerCase();
  if (normalized === "superadmin") return texts.roleSuperadmin;
  if (normalized === "company-admin") return texts.roleCompanyAdmin;
  if (normalized === "turnstile") return texts.roleTurnstile;
  return normalized || texts.roleUnknown;
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

  const lang = getStoredUiLang();
  const installHintInstalledByLang = {
    de: "BauPass Control ist auf diesem Geraet bereits als Desktop-App installiert.",
    en: "BauPass Control is already installed as a desktop app on this device.",
    tr: "BauPass Control bu cihazda zaten masaustu uygulamasi olarak kurulu.",
    ar: "BauPass Control مثبت بالفعل كتطبيق سطح مكتب على هذا الجهاز.",
    fr: "BauPass Control est deja installe comme application de bureau sur cet appareil.",
    es: "BauPass Control ya esta instalado como aplicacion de escritorio en este dispositivo.",
    it: "BauPass Control e gia installato come app desktop su questo dispositivo.",
    pl: "BauPass Control jest juz zainstalowany na tym urzadzeniu jako aplikacja desktopowa.",
  };
  const installHintDefaultByLang = {
    de: "Dieses Portal kann auf Windows, macOS und Linux wie ein lokales Programm installiert werden.",
    en: "This portal can be installed on Windows, macOS, and Linux like a local app.",
    tr: "Bu portal Windows, macOS ve Linux'a yerel uygulama gibi kurulabilir.",
    ar: "يمكن تثبيت هذه البوابة على Windows وmacOS وLinux كتطبيق محلي.",
    fr: "Ce portail peut etre installe sur Windows, macOS et Linux comme une application locale.",
    es: "Este portal puede instalarse en Windows, macOS y Linux como una app local.",
    it: "Questo portale puo essere installato su Windows, macOS e Linux come app locale.",
    pl: "Ten portal mozna zainstalowac w systemach Windows, macOS i Linux jako aplikacje lokalna.",
  };

  if (isStandaloneDesktopApp()) {
    elements.desktopInstallHint.textContent = installHintInstalledByLang[lang] || installHintInstalledByLang.de;
    return;
  }
  elements.desktopInstallHint.textContent = installHintDefaultByLang[lang] || installHintDefaultByLang.de;
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
    window.alert(uiT("alertInstallUnavailable"));
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
      ? runtimeText("badgePinHintVisitor")
      : runtimeText("badgePinHintWorker");
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
  select.innerHTML = `<option value="">${uiT("optNoSubcompany")}</option>${options}`;
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
    return ["dashboard", "workers", "badge", "access", "documents", "invoices", "admin"];
  }
  if (normalized === "company-admin") {
    return ["dashboard", "workers", "badge", "access", "documents"];
  }
  if (normalized === "turnstile") {
    return ["access", "documents", "dashboard"];
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
  persistSessionToken("");
  state.currentUser = null;
}

function handleExpiredControlSession() {
  clearSession();
  refreshAll();
  const now = Date.now();
  if (sessionExpiryNoticeShown && (now - sessionExpiryNoticeAt) < 2500) {
    return;
  }
  sessionExpiryNoticeShown = true;
  sessionExpiryNoticeAt = now;
  window.alert(uiT("alertSessionExpired"));
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
  // Ohne gespeicherten Token gibt es keine Session zum Bootstrappen.
  // So vermeiden wir unnoetige 401-Requests im ausgeloggten Zustand.
  if (!token) {
    sessionExpiryNoticeShown = false;
    return;
  }

  // Bootstrap nur dann nutzen, wenn ein Token existiert, aber der User noch
  // nicht in den lokalen State geladen wurde.
  if (!state.currentUser) {
    let bootstrap;
    try {
      bootstrap = await apiRequest(`${API_BASE}/api/session/bootstrap`, {
        auth: false,
        // Bei Cross-Site-Cookies (z. B. Railway) kann der Cookie fehlen.
        // Wenn bereits ein Token im Speicher ist, sende es explizit mit.
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch (error) {
      const msg = String(error?.message || "");
      // Nicht eingeloggt ist beim ersten Laden ein normaler Zustand.
      if (["unauthorized", "invalid_session", "session_expired"].includes(msg)) {
        clearSession();
        sessionExpiryNoticeShown = false;
        return;
      }
      throw error;
    }
    if (bootstrap?.token) {
      token = bootstrap.token;
      persistSessionToken(token);
    }
    if (bootstrap?.user) {
      state.currentUser = bootstrap.user;
    }
  }

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
  if (settings.status === "fulfilled") {
    state.settings = settings.value || state.settings;
    document.dispatchEvent(new CustomEvent("baupass:settingsLoaded"));
  }
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
    const texts = getRuntimeUiTexts();
    const role = getRoleLabel(state.currentUser?.role || "");
    const user = state.currentUser?.username || "-";
    elements.sessionCard.innerHTML = `<strong>${escapeHtml(texts.sessionLoggedIn)}:</strong> ${escapeHtml(user)} | <strong>${escapeHtml(texts.sessionRole)}:</strong> ${escapeHtml(role)}`;
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
  const texts = getRuntimeUiTexts();

  const totalWorkers = state.workers.filter((w) => !w.deletedAt).length;
  const activeWorkers = state.workers.filter((w) => !w.deletedAt && w.status === "aktiv").length;
  const totalVisitors = state.workers.filter((w) => !w.deletedAt && isVisitorWorker(w)).length;
  const totalCompanies = state.companies.filter((c) => !c.deleted_at).length;
  const accessToday = state.accessLogs.filter((log) => {
    const ts = String(log.timestamp || "").slice(0, 10);
    return ts === new Date().toISOString().slice(0, 10);
  }).length;

  const cards = [
    [texts.statsWorkersTotal, totalWorkers],
    [texts.statsWorkersActive, activeWorkers],
    [texts.statsVisitorsTotal, totalVisitors],
    [texts.statsCompanies, totalCompanies],
    [texts.statsAccessToday, accessToday]
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
    [uiT("reportingPaid"), formatCurrencyEur(kpis.paidTotal)],
    [uiT("reportingOpen"), formatCurrencyEur(kpis.openTotal)],
    [uiT("reportingOverdue"), `${Number(kpis.overdueInvoiceCount || 0)} ${uiT("reportingInvoicesLabel")}`],
    [uiT("reportingOverdueTotal"), formatCurrencyEur(kpis.overdueTotal)],
    [uiT("reportingLockedCompanies"), String(Number(kpis.lockedCompanies || 0))],
    [uiT("reportingAutoSuspensions30d"), String(Number(kpis.suspensionsLast30d || 0))]
  ];

  summaryGrid.innerHTML = summaryCards
    .map(([label, value]) => `
      <article class="card-item">
        <p class="helper-text">${escapeHtml(label)}</p>
        <strong>${escapeHtml(String(value))}</strong>
      </article>
    `)
    .join("") + (generatedAt ? `<p class="helper-text">${escapeHtml(uiT("reportingGeneratedAt"))}: ${escapeHtml(formatTimestamp(generatedAt))}</p>` : "");

  const topCompanies = state.reporting?.topOverdueCompanies || [];
  if (!topCompanies.length) {
    topOverdueList.innerHTML = `<div class="empty-state">${escapeHtml(uiT("reportingNoOverdueCompanies"))}</div>`;
  } else {
    topOverdueList.innerHTML = topCompanies
      .map((entry) => `
        <article class="card-item">
          <strong>${escapeHtml(entry.companyName || uiT("reportingFallbackCompany"))}</strong>
          <p class="helper-text">${Number(entry.overdueCount || 0)} ${escapeHtml(uiT("reportingOverdueInvoicesLabel"))}</p>
          <p>${escapeHtml(formatCurrencyEur(entry.overdueTotal))}</p>
        </article>
      `)
      .join("");
  }

  const dailyRows = state.reporting?.accessDaily || [];
  if (!dailyRows.length) {
    accessDailyList.innerHTML = `<div class="empty-state">${escapeHtml(uiT("reportingNoAccessDataLast7Days"))}</div>`;
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
          <p class="helper-text">${escapeHtml(uiT("reportingCheckin"))}: ${escapeHtml(String(checkIn))}</p>
          <div style="height:8px; background:#e6edf2; border-radius:6px; overflow:hidden; margin:4px 0 8px;">
            <div style="height:100%; width:${inWidth}%; background:#0f7a5a;"></div>
          </div>
          <p class="helper-text">${escapeHtml(uiT("reportingCheckout"))}: ${escapeHtml(String(checkOut))}</p>
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
    const emptyText = searchTerm
      ? runtimeTextTemplate("workerListNoResults", { term: escapeHtml(searchTerm) })
      : runtimeText("workerListEmpty");
    elements.workerList.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  elements.workerList.innerHTML = workers
    .map((worker) => {
      const deleted = Boolean(worker.deletedAt);
      const sub = getSubcompanyLabel(worker);
      const visitor = isVisitorWorker(worker);
      const visitorMeta = visitor
        ? `<p>${uiT("labelVisitorCompany")}: <strong>${escapeHtml(worker.visitorCompany || "-")}</strong> | ${uiT("labelVisitPurpose")}: <strong>${escapeHtml(worker.visitPurpose || "-")}</strong></p>
          <p>${uiT("labelHostName")}: <strong>${escapeHtml(worker.hostName || "-")}</strong> | ${uiT("labelVisitEndAt")}: <strong>${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</strong></p>`
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
          <p>${escapeHtml(visitor ? uiT("optVisitor") : (worker.role || "-"))} | ${escapeHtml(worker.site || "-")}</p>
          <p>${uiT("appPinLabel")}: <strong>${visitor ? uiT("pinNotRequired") : (worker.badgePinConfigured ? uiT("pinSet") : uiT("pinMissing"))}</strong> | ${uiT("cardLabel")}: <strong>${escapeHtml(worker.physicalCardId || uiT("cardUnassigned"))}</strong></p>
          ${sub ? `<p>Subunternehmen: ${escapeHtml(sub)}</p>` : ""}
          ${visitorMeta}
          <div class="button-row">
            <button type="button" class="ghost-button" data-worker-edit="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>${uiT("btnEdit")}</button>
            <button type="button" class="ghost-button" data-worker-delete="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>${uiT("btnDelete")}</button>
            <button type="button" class="ghost-button" data-worker-restore="${escapeHtml(worker.id)}" ${deleted ? "" : "disabled"}>${uiT("btnRestore")}</button>
            <button type="button" class="ghost-button" data-worker-app-link="${escapeHtml(worker.id)}" ${deleted ? "disabled" : ""}>${uiT("btnAppLink")}</button>
            ${!visitor && !deleted ? `<button type="button" class="ghost-button" data-worker-reset-pin="${escapeHtml(worker.id)}">${uiT("btnResetPin")}</button>` : ""}
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
      if (!window.confirm(uiT("confirmDeleteWorker"))) return;
      try {
        await apiRequest(`${API_BASE}/api/workers/${button.dataset.workerDelete}`, { method: "DELETE" });
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(uiT("alertDeleteWorkerFailed").replace("{error}", error.message));
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
        window.alert(uiT("alertRestoreWorkerFailed").replace("{error}", error.message));
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
        window.alert(uiT("alertAppLinkCreateFailed").replace("{error}", error.message));
      }
    };
  });

  elements.workerList.querySelectorAll("[data-worker-reset-pin]").forEach((button) => {
    button.onclick = async () => {
      const workerId = button.dataset.workerResetPin;
      const worker = state.workers.find((w) => w.id === workerId);
      const name = worker ? `${worker.firstName} ${worker.lastName}` : workerId;
      const newPin = window.prompt(uiT("promptResetPinFor").replace("{name}", name));
      if (newPin === null) return; // abgebrochen
      if (!/^\d{4,8}$/.test(newPin.trim())) {
        window.alert(uiT("alertPinMustDigits"));
        return;
      }
      try {
        await apiRequest(`${API_BASE}/api/workers/${workerId}/reset-pin`, { method: "POST", body: { newPin: newPin.trim() } });
        window.alert(uiT("alertPinResetSuccessFor").replace("{name}", name));
      } catch (error) {
        window.alert(uiT("alertPinResetFailed").replace("{error}", error.message));
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
    .map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(`${w.firstName} ${w.lastName}`)}${isVisitorWorker(w) ? ` [${runtimeText("visitorTagShort")}]` : ""} (${escapeHtml(w.badgeId || "-")})</option>`)
    .join("");
  select.innerHTML = `<option value="">${runtimeText("selectPersonOption")}</option>${options}`;
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
  // IMAP-Felder
  const imapHost = document.querySelector("#imapHost");
  const imapPort = document.querySelector("#imapPort");
  const imapUsername = document.querySelector("#imapUsername");
  const imapPassword = document.querySelector("#imapPassword");
  const imapFolder = document.querySelector("#imapFolder");
  const imapUseSsl = document.querySelector("#imapUseSsl");
  if (imapHost) imapHost.value = state.settings.imapHost || "";
  if (imapPort) imapPort.value = String(state.settings.imapPort || 993);
  if (imapUsername) imapUsername.value = state.settings.imapUsername || "";
  if (imapPassword) imapPassword.value = "";
  if (imapFolder) imapFolder.value = state.settings.imapFolder || "INBOX";
  if (imapUseSsl) imapUseSsl.value = state.settings.imapUseSsl === false ? "0" : "1";
}

function showWorkerDetailOverlay(worker) {
  const overlay = document.getElementById("workerDetailOverlay");
  if (!overlay) return;
  const company = state.companies.find((entry) => entry.id === worker.companyId);
  const subcompanyLabel = getSubcompanyLabel(worker);
  const role = String(getCurrentUser()?.role || "").toLowerCase();
  const canResetPin = !isVisitorWorker(worker) && ["superadmin", "company-admin", "turnstile"].includes(role);
  const safePhoto = sanitizeImageSrc(worker.photoData, createAvatar(worker));
  overlay.innerHTML = `
    <div class="worker-detail-card">
      <button class="close-btn" title="${uiT("detailCloseTitle")}">&times;</button>
      <img src="${safePhoto}" alt="${uiT("detailPhotoAlt")}" />
      <h2>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</h2>
      <p><strong>${uiT("labelType")}:</strong> ${escapeHtml(isVisitorWorker(worker) ? uiT("optVisitor") : uiT("optWorker"))}</p>
      <p><strong>${uiT("labelFirm")}:</strong> ${escapeHtml(company?.name || "-")}</p>
      ${subcompanyLabel ? `<p><strong>${uiT("labelSubcompany")}:</strong> ${escapeHtml(subcompanyLabel)}</p>` : ""}
      <p><strong>${uiT("badgeLabelBadgeId")}:</strong> ${escapeHtml(worker.badgeId)}</p>
      ${isVisitorWorker(worker) ? `<p><strong>${uiT("labelVisitorCompany")}:</strong> ${escapeHtml(worker.visitorCompany || "-")}</p><p><strong>${uiT("labelVisitPurpose")}:</strong> ${escapeHtml(worker.visitPurpose || "-")}</p><p><strong>${uiT("labelHostName")}:</strong> ${escapeHtml(worker.hostName || "-")}</p><p><strong>${uiT("labelVisitEndAt")}:</strong> ${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</p>` : `<p><strong>${uiT("labelInsuranceNumber")}:</strong> ${escapeHtml(worker.insuranceNumber)}</p><p><strong>${uiT("labelRoleField")}:</strong> ${escapeHtml(worker.role)}</p>`}
      <p><strong>${uiT("labelSite")}:</strong> ${escapeHtml(worker.site)}</p>
      <p><strong>${uiT("labelValidUntil")}:</strong> ${formatDate(worker.validUntil)}</p>
      <p><strong>${uiT("labelWorkerStatus")}:</strong> ${escapeHtml(worker.status)}</p>
      <p><strong>${uiT("appPinLabel")}:</strong> ${isVisitorWorker(worker) ? uiT("pinNotRequired") : (worker.badgePinConfigured ? uiT("pinSet") : uiT("pinMissing"))}</p>
      <p><strong>${uiT("labelPhysicalCard")}:</strong> ${escapeHtml(worker.physicalCardId || uiT("cardUnassigned"))}</p>
      <div class="button-row">
        <button type="button" class="primary-button" id="workerCheckInBtn">${uiT("detailCheckinBtn")}</button>
        <button type="button" class="ghost-button" id="workerCheckOutBtn">${uiT("detailCheckoutBtn")}</button>
        ${canResetPin ? `<button type="button" class="ghost-button" id="workerResetPinBtn">${uiT("btnResetPin")}</button>` : ""}
      </div>
      ${!isVisitorWorker(worker) ? `
      <hr style="margin:16px 0; border:none; border-top:1px solid #e5e7eb;" />
      <div class="worker-docs-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="margin:0;">${escapeHtml(uiT("workerDocsHeading"))}</h4>
          <span class="muted" style="font-size:0.82em;">${escapeHtml(uiT("workerAkteLabel"))}</span>
        </div>
        <div id="workerDocsList"><p class="muted">…</p></div>
      </div>` : ""}
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

  const resetButton = overlay.querySelector("#workerResetPinBtn");
  if (resetButton) {
    resetButton.onclick = async () => {
      const name = `${worker.firstName} ${worker.lastName}`.trim() || worker.id;
      const newPin = window.prompt(uiT("promptResetPinFor").replace("{name}", name));
      if (newPin === null) return;
      if (!/^\d{4,8}$/.test(String(newPin).trim())) {
        window.alert(uiT("alertPinMustDigits"));
        return;
      }
      try {
        await apiRequest(`${API_BASE}/api/workers/${worker.id}/reset-pin`, {
          method: "POST",
          body: { newPin: String(newPin).trim() }
        });
        window.alert(uiT("alertPinResetSuccessFor").replace("{name}", name));
        await loadAllData();
        refreshAll();
      } catch (error) {
        window.alert(uiT("alertPinResetFailed").replace("{error}", error.message));
      }
    };
  }

  // Worker-Dokumente laden und rendern
  if (!isVisitorWorker(worker)) {
    const docsContainer = overlay.querySelector("#workerDocsList");
    if (docsContainer) {
      loadWorkerDocuments(worker.id).then((docs) => {
        renderWorkerDocuments(docs, worker.id, docsContainer);
      });
    }
  }
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
    elements.badgePreview.innerHTML = runtimeText("badgeEmptyStateShort");
    elements.badgePreview.className = "badge-shell empty-state";
    elements.badgeMeta.innerHTML = runtimeText("badgeNoneSelected");
    elements.badgeMeta.className = "badge-meta empty-state";
    return;
  }

  state.selectedWorkerId = worker.id;
  const company = state.companies.find((entry) => entry.id === worker.companyId);
  const normalizedPlan = String(company?.plan || "").trim().toLowerCase();
  const isDayPass = normalizedPlan === "tageskarte";
  const visitor = isVisitorWorker(worker);
  const badgeTitle = visitor
    ? uiT("badgeTitleVisitor")
    : (isDayPass ? uiT("badgeTitleDayPass") : uiT("badgeTitleRegular"));
  const badgeClass = isDayPass ? "badge-card badge-card-daypass" : "badge-card";
  const planLabel = getPlanLabel(normalizedPlan || "tageskarte");
  const subcompanyLabel = getSubcompanyLabel(worker);
  const qrId = `qr-${worker.id}`;
  const safeBadgePhoto = sanitizeImageSrc(worker.photoData, createAvatar(worker));

  elements.badgePreview.className = "badge-shell";
  elements.badgePreview.innerHTML = `
    <article class="${badgeClass}">
      <div class="badge-top">
        <div>
          <p class="eyebrow">${escapeHtml(state.settings.platformName)}</p>
          <h3>${escapeHtml(badgeTitle)}</h3>
          <p>${escapeHtml(company?.name || uiT("badgeUnknownCompany"))}</p>
        </div>
        <span class="badge-chip">${escapeHtml(worker.status)}</span>
      </div>

      <div class="badge-body">
        <div class="badge-copy">
          <img class="badge-photo${!worker.photoData ? ' badge-photo-placeholder' : ''}" src="${safeBadgePhoto}" alt="${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}" style="${!worker.photoData ? 'cursor:pointer;outline:2px dashed #b07d00;' : ''}" />
          <p><strong>${escapeHtml(worker.firstName)} ${escapeHtml(worker.lastName)}</strong></p>
          <p>${escapeHtml(visitor ? uiT("optVisitor") : worker.role)}</p>
          ${subcompanyLabel ? `<p>${uiT("labelSubcompany")}: ${escapeHtml(subcompanyLabel)}</p>` : ""}
          ${visitor ? `<p>${uiT("labelVisitorCompany")}: ${escapeHtml(worker.visitorCompany || "-")}</p><p>${uiT("labelVisitPurpose")}: ${escapeHtml(worker.visitPurpose || "-")}</p><p>${uiT("labelHostName")}: ${escapeHtml(worker.hostName || "-")}</p><p>${uiT("labelVisitEndAt")}: ${escapeHtml(worker.visitEndAt ? formatTimestamp(worker.visitEndAt) : "-")}</p>` : ""}
          <p>${uiT("labelPlan")}: ${escapeHtml(planLabel)}</p>
          <p>${uiT("labelSite")}: ${escapeHtml(worker.site)}</p>
          <p>${uiT("labelValidUntil")}: ${formatDate(worker.validUntil)}</p>
        </div>
        <div class="qr-block">
          <img id="${qrId}" alt="Mitarbeiter-App QR fuer ${escapeHtml(worker.badgeId)}" style="width:100%; border-radius:12px;" />
          <p class="helper-text" style="margin-top:10px; text-align:center;">${uiT("badgeQrHint")}</p>
        </div>
      </div>

      <div class="badge-footer">
        <p>${uiT("badgeLabelBadgeId")}: ${escapeHtml(worker.badgeId)}</p>
        <p>${escapeHtml(state.settings.operatorName)}</p>
      </div>
    </article>
  `;

  // Make badge photo placeholder clickable if no photo is present
  setTimeout(() => {
    const badgePhoto = elements.badgePreview.querySelector('.badge-photo-placeholder');
    if (badgePhoto) {
      badgePhoto.title = uiT('badgePhotoUploadHint');
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
      <p>${uiT("badgeLabelBadgeId")}</p>
      <code>${escapeHtml(worker.badgeId)}</code>
    </div>
    <div class="meta-box">
      <p>${uiT("badgeMetaQrFunc")}</p>
      <code>${uiT("badgeMetaQrFuncVal")}</code>
    </div>
    <div class="meta-box">
      <p>${uiT("badgeMetaRoleLabel")}</p>
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
    elements.recentAccessList.innerHTML = `<div class="empty-state">${runtimeText("recentAccessEmpty")}</div>`;
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
    panel.innerHTML = runtimeText("dashboardLastAccessPlaceholder");
    return;
  }

  const worker = state.workers.find((entry) => entry.id === latest.workerId) || null;
  const company = worker ? state.companies.find((entry) => entry.id === worker.companyId) : null;
  const subcompanyLabel = getSubcompanyLabel(worker);
  const directionLabel = latest.direction === "check-in"
    ? runtimeText("dashboardDirectionCheckin")
    : runtimeText("dashboardDirectionCheckout");
  const photoSrc = worker
    ? sanitizeImageSrc(worker.photoData, createAvatar(worker))
    : createAvatar({ firstName: "?", lastName: "?" });
  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : runtimeText("unknownPerson");
  const eventClass = latest.direction === "check-in" ? "porter-event" : "porter-event muted";

  panel.className = "porter-live-card";
  panel.innerHTML = `
    <div class="porter-live-topline">
      <strong>${runtimeText("dashboardLastAccessHeading")}</strong>
      <span>${escapeHtml(formatTimestamp(latest.timestamp))}</span>
    </div>
    <div class="porter-head">
      <img class="porter-photo" src="${photoSrc}" alt="${escapeHtml(workerName)}" />
      <div>
        <strong>${escapeHtml(workerName)}</strong>
        <span>${escapeHtml(company?.name || runtimeText("unknownCompany"))}</span>
        ${subcompanyLabel ? `<span>${escapeHtml(subcompanyLabel)}</span>` : ""}
        <span>${escapeHtml(latest.gate || runtimeText("unknownTurnstile"))}</span>
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
  const safePhoto = sanitizeImageSrc(worker.photoData, createAvatar(worker));
  detail.innerHTML = `
    <button class="close-btn" title="Schließen">&times;</button>
    <div class="worker-detail-card">
      <img src="${safePhoto}" alt="Mitarbeiterfoto" />
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
        <button type="button" class="primary-button" data-worker-id="${escapeHtml(worker.id)}" data-direction="check-in">Anmelden (Check-in)</button>
        <button type="button" class="ghost-button" data-worker-id="${escapeHtml(worker.id)}" data-direction="check-out">Abmelden (Check-out)</button>
      </div>
    </div>
  `;
  overlay.classList.remove("hidden");
  detail.querySelector(".close-btn").onclick = () => overlay.classList.add("hidden");
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add("hidden"); };
  detail.querySelectorAll("[data-worker-id][data-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetWorker = state.workers.find((item) => item.id === button.dataset.workerId);
      if (!targetWorker) {
        return;
      }
      triggerWorkerAccess(targetWorker, button.dataset.direction);
    });
  });
}

function renderAccessLog() {
  document.querySelector("#accessFrom").value = state.accessFilter.from;
  document.querySelector("#accessTo").value = state.accessFilter.to;
  document.querySelector("#accessFilterDirection").value = state.accessFilter.direction;
  document.querySelector("#accessFilterGate").value = state.accessFilter.gate;

  const entries = [...state.accessLogs].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  if (!entries.length) {
    elements.accessLogList.innerHTML = `<div class="empty-state">${runtimeText("accessFilterEmpty")}</div>`;
    return;
  }

  elements.accessLogList.innerHTML = entries.map(renderAccessItem).join("");
}

function renderAccessSummary() {
  const entries = [...state.accessLogs];
  if (!entries.length) {
    elements.accessSummaryGrid.innerHTML = `<div class="empty-state">${runtimeText("dayReportEmpty")}</div>`;
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
          <span>${runtimeText("summaryEntries")}: ${item.checkIn}</span>
          <span>${runtimeText("summaryExits")}: ${item.checkOut}</span>
          <span>${runtimeText("summaryTotal")}: ${item.total}</span>
          <span>${runtimeText("summaryLastBooking")}: ${formatTimestamp(item.latest)}</span>
          <div class="summary-visitor-block">
            <span class="summary-visitor-title">${runtimeText("summaryPeople")}:</span>
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
    elements.accessHourlyGrid.innerHTML = `<div class="empty-state">${runtimeText("hourlyEmpty")}</div>`;
    return;
  }

  elements.accessHourlyGrid.innerHTML = rows
    .map(
      (row) => `
        <article class="hour-row">
          <strong>${escapeHtml(row.hour)}</strong>
          <span>${runtimeText("hourlyIn")}: ${Number(row.checkIn) || 0}</span>
          <span>${runtimeText("hourlyOut")}: ${Number(row.checkOut) || 0}</span>
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
        <span class="summary-visitor-title">${runtimeText("dayCloseAutoClosedAfterMidnight")}</span>
        <div class="summary-visitor-list">${autoClosedEntries.map((entry) => `<span class="summary-visitor-pill">${escapeHtml(entry.name)}</span>`).join("")}</div>
      </div>
    `
    : "";

  if (acknowledgement) {
    const when = formatTimestamp(acknowledgement.createdAt);
    elements.dayCloseBanner.innerHTML = `<strong>${runtimeText("dayCloseAckTitle")}</strong><span>${runtimeTextTemplate("dayCloseAckByOn", { user: escapeHtml(acknowledgement.acknowledgedBy), when: escapeHtml(when) })}</span><span>${runtimeTextTemplate("dayCloseCommentLabel", { comment: escapeHtml(acknowledgement.comment) })}</span>${autoClosedMarkup}`;
  } else if (count > 0) {
    elements.dayCloseBanner.innerHTML = `<strong>${runtimeText("dayCloseCheckActive")}</strong><span>${runtimeTextTemplate("dayCloseOpenEntriesNoExit", { count })}</span>${autoClosedMarkup}`;
  } else {
    elements.dayCloseBanner.innerHTML = `<strong>${runtimeText("dayCloseCheckActive")}</strong><span>${runtimeText("dayCloseNoOpenEntries")}</span>${autoClosedMarkup}`;
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
  window.alert(runtimeTextTemplate("dayCloseAlertAt18", { count }));
}

async function handleDayCloseAcknowledge(event) {
  event.preventDefault();
  const comment = elements.dayCloseComment.value.trim();
  if (comment.length < 4) {
    window.alert(runtimeText("dayCloseCommentMin"));
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
    window.alert(runtimeText("dayCloseAckSuccess"));
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
  const photoSrc = worker
    ? sanitizeImageSrc(worker.photoData, createAvatar(worker))
    : createAvatar({ firstName: "?", lastName: "?" });
  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : "Unbekannt";
  const itemClass = featured ? "list-item recent-access-item clickable access-entry-featured" : "list-item recent-access-item clickable";
  return `
    <article class="${itemClass}" data-worker-id="${worker ? escapeHtml(worker.id) : ""}">
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
        window.alert(runtimeText("turnstileSelectWorkerFirst"));
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
    window.alert(runtimeText("workerPhotoRequired"));
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
      window.alert(runtimeText("workerBadgePinMissing"));
      return;
    }
    if (error.message === "duplicate_physical_card_id") {
      window.alert("Diese physische Karten-ID ist bereits einem anderen Mitarbeiter zugeordnet.");
      return;
    }
    if (error.message === "visit_purpose_required") {
      window.alert(runtimeText("visitorPurposeMissing"));
      return;
    }
    if (error.message === "visitor_company_required") {
      window.alert(runtimeText("visitorCompanyMissing"));
      return;
    }
    if (error.message === "host_name_required") {
      window.alert(runtimeText("visitorHostMissing"));
      return;
    }
    if (error.message === "visit_end_required") {
      window.alert(runtimeText("visitorEndMissing"));
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
  elements.accessFeedbackPhoto.src = worker
    ? sanitizeImageSrc(worker.photoData, createAvatar(worker))
    : createAvatar({ firstName: "?", lastName: "?" });
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
    window.alert(runtimeText("popupBlockedAllow"));
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
    window.alert(runtimeText("popupBlockedAllow"));
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
    const settingsBody = {
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
      workerAppEnabled: document.querySelector("#workerAppEnabled").value !== "0",
      imapHost: (document.querySelector("#imapHost")?.value || "").trim(),
      imapPort: Number(document.querySelector("#imapPort")?.value || 993),
      imapUsername: (document.querySelector("#imapUsername")?.value || "").trim(),
      imapFolder: (document.querySelector("#imapFolder")?.value || "INBOX").trim() || "INBOX",
      imapUseSsl: document.querySelector("#imapUseSsl")?.value !== "0",
    };
    const imapPasswordValue = document.querySelector("#imapPassword")?.value || "";
    if (imapPasswordValue.trim()) {
      settingsBody.imapPassword = imapPasswordValue;
    }

    const updated = await apiRequest(API_BASE + "/api/settings", {
      method: "PUT",
      body: settingsBody
    });
    state.settings = updated;
    document.dispatchEvent(new CustomEvent("baupass:settingsLoaded"));
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
    window.alert(runtimeText("logoImageFileRequired"));
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
    window.alert(runtimeText("popupBlockedAllow"));
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
      window.alert(runtimeText("invoiceSentEmail"));
    } else {
      const errorText = String(payload.error || "");
      if (errorText.toLowerCase().includes("smtp ist nicht konfiguriert")) {
        window.alert(runtimeText("invoiceSavedEmailNotConfigured"));
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
      window.alert(runtimeText("invoiceSelectCompany"));
    }
    return null;
  }

  const recipientEmail = elements.invoiceRecipientEmail.value.trim();
  if (!recipientEmail.includes("@")) {
    if (!silent) {
      window.alert(runtimeText("invoiceRecipientInvalid"));
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
      window.alert(runtimeText("invoiceFormRequiredFields"));
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
        status: document.querySelector("#companyStatus").value,
        adminPassword: document.querySelector("#companyAdminPassword").value.trim() || undefined
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
        window.alert(runtimeText("invoiceMarkedPaid"));
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
    persistSessionToken(token);
    state.currentUser = payload.user;
    elements.loginForm.reset();
    startHeartbeat();
    startBackendStatusMonitor();
    setView(getDefaultViewForRole(payload.user?.role));
    refreshAll();

    try {
      await loadAllData();
      refreshAll();
    } catch (loadError) {
      console.warn("Post-login data load failed (session stays active):", loadError);
    }
  } catch (error) {
    if (error.message === "backend_unreachable") {
      window.alert(runtimeText("backendUnreachableReload"));
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
      window.alert(runtimeText("loginResponseIncomplete"));
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
      return runtimeText("cameraNeedsHttps");
    }
    if (errorName === "NotAllowedError" || errorName === "SecurityError") {
      return runtimeText("cameraAccessBlocked");
    }
    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      return runtimeText("cameraNotFound");
    }
    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      return runtimeText("cameraInUse");
    }
    if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
      return runtimeText("cameraConstraintFailed");
    }
    if (errorName === "" && error?.message === "getUserMedia_not_supported") {
      return runtimeText("cameraApiMissing");
    }
    return runtimeTextTemplate("cameraStartFailed", { reason: error?.message || errorName || "unknown error" });
  };

  if (!navigator.mediaDevices?.getUserMedia && !legacyGetUserMedia) {
    if (elements.photoDebugText) {
      const secureHint = window.isSecureContext ? "" : runtimeText("cameraHintSecureContext");
      elements.photoDebugText.textContent = runtimeTextTemplate("cameraUnavailableWithHint", { hint: secureHint });
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
      elements.photoDebugText.textContent = runtimeText("cameraActiveCanCapture");
      elements.photoDebugText.style.color = "#0b7a3b";
    }
  } catch (error) {
    const reason = buildCameraErrorMessage(error);
    if (elements.photoDebugText) {
      elements.photoDebugText.textContent = reason;
      elements.photoDebugText.style.color = "#8a5a00";
    }
    if (isMobile && (error?.name === "NotAllowedError" || error?.name === "SecurityError")) {
      window.alert(runtimeText("cameraPermissionRetry"));
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
      window.alert(runtimeText("photoReadFailed"));
      return;
    }
    const cleaned = await processStillImageBackground(dataUrl);
    setPhotoEditorSource(cleaned || dataUrl, { resetOffset: true });
  };
  reader.onerror = () => {
    window.alert(runtimeText("photoLoadFailed"));
  };
  reader.readAsDataURL(file);
}

async function capturePhoto() {
  const context = elements.photoCanvas.getContext("2d", { willReadFrequently: true });
  const video = elements.cameraPreview;

  if (!video.videoWidth || !video.videoHeight) {
    window.alert(runtimeText("cameraStartFirst"));
    return;
  }

  if (!context) {
    window.alert(runtimeText("photoProcessingUnavailable"));
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
    elements.photoDebugText.textContent = runtimeTextTemplate("photoCaptured", {
      preview: photo ? photo.slice(0, 30) : "empty",
    });
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
    elements.photoAdjustStatus.textContent = runtimeTextTemplate("photoPosition", {
      x: photoEditorOffset.x,
      y: photoEditorOffset.y,
    });
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
    let label = runtimeText("photoSharpenNormal");
    if (photoSharpenAmount < 0.13) label = runtimeText("photoSharpenSoft");
    else if (photoSharpenAmount > 0.45) label = runtimeText("photoSharpenVerySharp");
    elements.photoSharpenValue.textContent = label;
  }

  if (elements.photoRequiredHint) {
    if (hasPhoto) {
      elements.photoRequiredHint.textContent = runtimeText("photoRequiredOk");
      elements.photoRequiredHint.classList.remove("helper-text-warning");
      elements.photoRequiredHint.classList.add("helper-text-ok");
    } else {
      elements.photoRequiredHint.textContent = runtimeText("photoRequiredMissing");
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
    elements.photoAdjustStatus.textContent = runtimeTextTemplate("photoPosition", {
      x: photoEditorOffset.x,
      y: photoEditorOffset.y,
    });
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
    let label = runtimeText("photoSharpenNormal");
    if (photoSharpenAmount < 0.13) label = runtimeText("photoSharpenSoft");
    else if (photoSharpenAmount > 0.45) label = runtimeText("photoSharpenVerySharp");
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
    if (elements.photoAdjustStatus) {
      elements.photoAdjustStatus.textContent = runtimeTextTemplate("photoPosition", { x, y });
    }
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
    window.alert(runtimeText("photoLoadFailed"));
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
    window.alert(runtimeText("demoAdminOnly"));
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
    window.alert(runtimeText("loginFirst"));
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
    window.alert(runtimeText("loginFirst"));
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
  const first = String(worker?.firstName || "");
  const last = String(worker?.lastName || "");
  const rawInitials = `${first[0] || ""}${last[0] || ""}`.toUpperCase();
  const initials = rawInitials.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "BP";
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

function sanitizeImageSrc(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("data:image/")) {
    return raw;
  }
  if (normalized.startsWith("blob:")) {
    return raw;
  }
  if (normalized.startsWith("https://") || normalized.startsWith("http://")) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return raw;
  }
  return fallback;
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
      window.alert(runtimeText("subcompanyNameRequired"));
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
initUiLanguageControl();
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
  if (elements.bulkSelectionCount) {
    elements.bulkSelectionCount.textContent = runtimeTextTemplate("bulkSelectedCount", { count });
  }
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
  setView("dashboard");
  refreshAll();

  try {
    await loadAllData();
    if (token && state.currentUser) {
      startHeartbeat();
      startBackendStatusMonitor();
      setView(getDefaultViewForRole(state.currentUser.role));
    }
  } catch (error) {
    if (error.message !== "session_expired" && error.message !== "backend_unreachable") {
      console.warn("Initial session bootstrap failed:", error);
    }
    clearSession();
  }

  refreshAll();
})();

// ─────────────────────────────────────────────────────────────────────
// Dokument-Inbox (IMAP) & Worker-Dokumente
// ─────────────────────────────────────────────────────────────────────

// Dokumenttypen für die Auswahlfelder
const DOC_TYPES = [
  { value: "mindestlohnnachweis", key: "docTypeMindestlohnnachweis" },
  { value: "personalausweis", key: "docTypePersonalausweis" },
  { value: "sozialversicherungsnachweis", key: "docTypeSozialversicherungsnachweis" },
  { value: "arbeitserlaubnis", key: "docTypeArbeitserlaubnis" },
  { value: "gesundheitszeugnis", key: "docTypeGesundheitszeugnis" },
  { value: "sonstiges", key: "docTypeSonstiges" },
];

function docTypeLabelForValue(value) {
  const found = DOC_TYPES.find((d) => d.value === value);
  return found ? uiT(found.key) : value;
}

async function loadDocumentInbox() {
  const listEl = document.querySelector("#docInboxList");
  if (!listEl) return;
  try {
    const data = await apiRequest(API_BASE + "/api/documents/inbox");
    renderDocumentInbox(data.emails || []);
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}

function renderDocumentInbox(emails) {
  const listEl = document.querySelector("#docInboxList");
  if (!listEl) return;
  if (!emails.length) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(uiT("docInboxEmpty"))}</div>`;
    return;
  }
  listEl.innerHTML = emails.map((email) => {
    const attachments = (email.attachments || []).map((att) => `
      <span class="attachment-chip">
        📎 ${escapeHtml(att.filename)}
        <button class="link-button" data-inbox-id="${escapeHtml(String(email.id))}" data-attachment-id="${escapeHtml(String(att.id))}" data-filename="${escapeHtml(att.filename)}" data-assign-btn>
          ${escapeHtml(uiT("btnAssignDoc"))}
        </button>
      </span>`).join("");
    return `
      <div class="list-item" data-email-id="${escapeHtml(String(email.id))}">
        <div class="list-item-meta">
          <strong>${escapeHtml(email.from_addr || "-")}</strong>
          <span class="muted">${escapeHtml(email.received_at ? formatTimestamp(email.received_at) : "")}</span>
        </div>
        <div class="list-item-subject">${escapeHtml(email.subject || "(kein Betreff)")}</div>
        ${attachments ? `<div class="attachment-list">${attachments}</div>` : ""}
        <div class="button-row" style="margin-top:8px">
          <button class="ghost-button small-button" data-dismiss-email-id="${escapeHtml(String(email.id))}">
            ${escapeHtml(uiT("btnDismissEmail"))}
          </button>
        </div>
      </div>`;
  }).join("");

  // Assign-Buttons
  listEl.querySelectorAll("[data-assign-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openDocAssignPanel(btn.dataset.inboxId, btn.dataset.attachmentId, btn.dataset.filename);
    });
  });

  // Dismiss-Buttons
  listEl.querySelectorAll("[data-dismiss-email-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const emailId = btn.dataset.dismissEmailId;
      try {
        await apiRequest(API_BASE + `/api/documents/inbox/${emailId}/dismiss`, { method: "POST" });
        loadDocumentInbox();
      } catch (e) {
        window.alert(e.message);
      }
    });
  });
}

function openDocAssignPanel(inboxId, attachmentId, filename) {
  const panel = document.querySelector("#docAssignPanel");
  const content = document.querySelector("#docAssignContent");
  if (!panel || !content) return;
  panel.style.display = "";

  // Mitarbeiter-Liste aus state.workers (aktive Nicht-Besucher)
  const workers = (state.workers || []).filter((w) => !isVisitorWorker(w) && w.status !== "inaktiv");
  const workerOptions = workers.map((w) =>
    `<option value="${escapeHtml(String(w.id))}">${escapeHtml(w.firstName + " " + w.lastName)} — ${escapeHtml(w.badgeId)}</option>`
  ).join("");

  const docTypeOptions = DOC_TYPES.map((d) =>
    `<option value="${escapeHtml(d.value)}">${escapeHtml(uiT(d.key))}</option>`
  ).join("");

  content.innerHTML = `
    <form id="docAssignForm" class="settings-form">
      <p class="muted">📎 ${escapeHtml(filename)}</p>
      <label>
        <span>${escapeHtml(uiT("docAssignWorkerLabel"))}</span>
        <select id="docAssignWorkerId" required>
          <option value="">— bitte wählen —</option>
          ${workerOptions}
        </select>
      </label>
      <label>
        <span>${escapeHtml(uiT("docAssignTypeLabel"))}</span>
        <select id="docAssignType" required>
          ${docTypeOptions}
        </select>
      </label>
      <label>
        <span>${escapeHtml(uiT("docAssignNotesLabel"))}</span>
        <input id="docAssignNotes" type="text" />
      </label>
      <div class="button-row">
        <button type="submit" class="primary-button">${escapeHtml(uiT("btnConfirmAssign"))}</button>
        <button type="button" class="ghost-button" id="docAssignCancelBtn">Abbrechen</button>
      </div>
      <p id="docAssignMsg" class="helper-text"></p>
    </form>`;

  document.querySelector("#docAssignCancelBtn").addEventListener("click", () => {
    panel.style.display = "none";
  });

  document.querySelector("#docAssignForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const workerId = document.querySelector("#docAssignWorkerId").value;
    const docType = document.querySelector("#docAssignType").value;
    const notes = document.querySelector("#docAssignNotes").value.trim();
    const msgEl = document.querySelector("#docAssignMsg");
    if (!workerId) return;
    try {
      await apiRequest(API_BASE + `/api/documents/inbox/${inboxId}/attachments/${attachmentId}/assign`, {
        method: "POST",
        body: { workerId: Number(workerId), docType, notes },
      });
      msgEl.textContent = uiT("docAssignSuccess");
      msgEl.style.color = "var(--color-success, green)";
      panel.style.display = "none";
      loadDocumentInbox();
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.style.color = "var(--color-danger, red)";
    }
  });
}

async function loadWorkerDocuments(workerId) {
  try {
    const data = await apiRequest(API_BASE + `/api/workers/${workerId}/documents`);
    return Array.isArray(data) ? data : (data.documents || []);
  } catch {
    return [];
  }
}

async function uploadWorkerDocument(workerId, file, docType, notes) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("docType", docType);
  fd.append("notes", notes);
  const response = await fetch(API_BASE + `/api/workers/${workerId}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `http_${response.status}`);
  return payload;
}

function renderWorkerDocuments(docs, workerId, containerEl) {
  if (!containerEl) return;
  const role = String(getCurrentUser()?.role || "").toLowerCase();
  const canDelete = ["superadmin", "company-admin"].includes(role);
  const canUpload = ["superadmin", "company-admin", "turnstile"].includes(role);

  const docTypeOptions = DOC_TYPES.map((d) =>
    `<option value="${escapeHtml(d.value)}">${escapeHtml(uiT(d.key))}</option>`
  ).join("");

  const uploadForm = canUpload ? `
    <details style="margin-top:12px;">
      <summary style="cursor:pointer; font-weight:600; padding:6px 0;">${escapeHtml(uiT("btnUploadWorkerDoc"))}</summary>
      <form class="worker-doc-upload-form" style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
        <input type="file" class="doc-upload-file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx" required />
        <select class="doc-upload-type" required>${docTypeOptions}</select>
        <input type="text" class="doc-upload-notes" placeholder="${escapeHtml(uiT("docAssignNotesLabel"))}" />
        <div class="button-row">
          <button type="submit" class="primary-button small-button">${escapeHtml(uiT("btnConfirmUpload"))}</button>
        </div>
        <p class="doc-upload-msg helper-text" style="display:none;"></p>
      </form>
    </details>` : "";

  const listHtml = docs.length
    ? `<ul class="document-list">` + docs.map((doc) => `
      <li class="document-list-item">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <span style="font-weight:600;">📄 ${escapeHtml(docTypeLabelForValue(doc.doc_type))}</span>
            <span class="muted" style="display:block; font-size:0.8em;">${escapeHtml(doc.filename)}</span>
            ${doc.notes ? `<span class="muted" style="display:block; font-size:0.8em;">${escapeHtml(doc.notes)}</span>` : ""}
            <span class="muted" style="display:block; font-size:0.8em;">${escapeHtml(doc.created_at ? formatTimestamp(doc.created_at) : "")}</span>
          </div>
          <div class="button-row" style="flex-shrink:0;">
            <a class="ghost-button small-button" href="${API_BASE}/api/workers/${workerId}/documents/${doc.id}/download" target="_blank" rel="noopener noreferrer">${escapeHtml(uiT("btnDownloadDoc"))}</a>
            ${canDelete ? `<button class="ghost-button small-button danger" data-delete-doc-id="${escapeHtml(String(doc.id))}">${escapeHtml(uiT("btnDeleteDoc"))}</button>` : ""}
          </div>
        </div>
      </li>`).join("") + `</ul>`
    : `<p class="muted">${escapeHtml(uiT("workerDocsEmpty"))}</p>`;

  containerEl.innerHTML = listHtml + uploadForm;

  containerEl.querySelectorAll("[data-delete-doc-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm(uiT("confirmDeleteDoc"))) return;
      try {
        await apiRequest(API_BASE + `/api/workers/${workerId}/documents/${btn.dataset.deleteDocId}`, { method: "DELETE" });
        const updatedDocs = await loadWorkerDocuments(workerId);
        renderWorkerDocuments(updatedDocs, workerId, containerEl);
      } catch (e) {
        window.alert(e.message);
      }
    });
  });

  const uploadFormEl = containerEl.querySelector(".worker-doc-upload-form");
  if (uploadFormEl) {
    uploadFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = uploadFormEl.querySelector(".doc-upload-file");
      const typeSelect = uploadFormEl.querySelector(".doc-upload-type");
      const notesInput = uploadFormEl.querySelector(".doc-upload-notes");
      const msgEl = uploadFormEl.querySelector(".doc-upload-msg");
      const submitBtn = uploadFormEl.querySelector("[type='submit']");
      const file = fileInput?.files?.[0];
      if (!file) return;
      submitBtn.disabled = true;
      msgEl.style.display = "none";
      try {
        await uploadWorkerDocument(workerId, file, typeSelect.value, notesInput.value.trim());
        msgEl.textContent = uiT("docUploadSuccess");
        msgEl.style.color = "var(--color-success, green)";
        msgEl.style.display = "";
        uploadFormEl.reset();
        const updatedDocs = await loadWorkerDocuments(workerId);
        renderWorkerDocuments(updatedDocs, workerId, containerEl);
      } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = "var(--color-danger, red)";
        msgEl.style.display = "";
        submitBtn.disabled = false;
      }
    });
  }
}

// Dokument-Inbox beim Wechsel zur documents-View laden
// DOM ist bereits bereit wenn app.js am Ende von <body> läuft.
// Führe sofort aus, statt auf DOMContentLoaded zu warten (wird sonst nie gefeuert).
(function initDocumentSection() {
  // Documents Nav-Link
  const docNavLink = document.querySelector("[data-view='documents']");
  if (docNavLink) {
    docNavLink.addEventListener("click", () => {
      if (!token) {
        handleExpiredControlSession();
        return;
      }
      loadDocumentInbox();
    });
  }

  const refreshBtn = document.querySelector("#docInboxRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (!token) {
        handleExpiredControlSession();
        return;
      }
      loadDocumentInbox();
    });
  }

  // Zeige die konfigurierte Dokument-E-Mail-Adresse für den Pförtner
  function updateDocEmailInfoBar() {
    const bar = document.querySelector("#docEmailInfoBar");
    const addrEl = document.querySelector("#docEmailInfoAddr");
    const copyBtn = document.querySelector("#docEmailCopyBtn");
    if (!bar || !addrEl) return;
    const email = (state.settings?.imapUsername || "").trim();
    if (email) {
      addrEl.textContent = email;
      bar.style.display = "";
    } else {
      bar.style.display = "none";
    }
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(email);
          } else {
            window.prompt(uiT("docEmailInfoLabel"), email);
          }
          const orig = copyBtn.textContent;
          copyBtn.textContent = uiT("btnCopyEmailDone");
          window.setTimeout(() => { copyBtn.textContent = orig; }, 1800);
        } catch {
          window.prompt(uiT("docEmailInfoLabel"), email);
        }
      };
    }
  }

  updateDocEmailInfoBar();
  // Auch aktualisieren wenn Einstellungen neu geladen werden
  document.addEventListener("baupass:settingsLoaded", updateDocEmailInfoBar);

  const runDocumentInboxSync = async (buttonEl) => {
    if (buttonEl) buttonEl.disabled = true;
    try {
      await apiRequest(API_BASE + "/api/documents/imap/trigger", { method: "POST" });
      await loadDocumentInbox();
    } catch (e) {
      window.alert(e.message);
    } finally {
      if (buttonEl) buttonEl.disabled = false;
    }
  };

  const syncBtn = document.querySelector("#docInboxSyncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      if (!token) {
        handleExpiredControlSession();
        return;
      }
      await runDocumentInboxSync(syncBtn);
    });
  }

  const pollBtn = document.querySelector("#docInboxPollBtn");
  if (pollBtn) {
    pollBtn.addEventListener("click", () => {
      if (!token) {
        handleExpiredControlSession();
        return;
      }
      const imapHostVal = (state.settings?.imapHost || "").toLowerCase();
      let webmailUrl;
      if (imapHostVal.includes("gmail") || imapHostVal.includes("google")) {
        webmailUrl = "https://mail.google.com/mail/u/0/#inbox";
      } else if (imapHostVal.includes("outlook") || imapHostVal.includes("hotmail") || imapHostVal.includes("live.com") || imapHostVal.includes("office365")) {
        webmailUrl = "https://outlook.live.com/mail/0/inbox";
      } else if (imapHostVal.includes("yahoo")) {
        webmailUrl = "https://mail.yahoo.com/";
      } else if (imapHostVal) {
        // Versuche Webmail aus dem Domain-Teil des IMAP-Hosts abzuleiten
        const domain = imapHostVal.replace(/^imap\./, "");
        webmailUrl = "https://mail." + domain;
      } else {
        webmailUrl = "https://mail.google.com/mail/u/0/#inbox";
      }

      // Öffne Webmail direkt (kein noopener, damit Browser es nicht blockiert)
      const win = window.open(webmailUrl, "_blank");
      if (!win) {
        // Popup geblockt – als Fallback im aktuellen Tab öffnen
        window.location.href = webmailUrl;
        return;
      }

      // Nach dem Öffnen des Postfachs direkt den Import starten.
      window.setTimeout(() => {
        runDocumentInboxSync(syncBtn || undefined);
      }, 700);
    });
  }

  // IMAP-Test-Button
  const imapTestBtn = document.querySelector("#imapTestBtn");
  if (imapTestBtn) {
    imapTestBtn.addEventListener("click", async () => {
      const resultEl = document.querySelector("#imapTestResult");
      const imapHost = (document.querySelector("#imapHost")?.value || "").trim();
      const imapUsername = (document.querySelector("#imapUsername")?.value || "").trim();
      const imapPassword = document.querySelector("#imapPassword")?.value || "";
      if (!imapHost || !imapUsername || !imapPassword) {
        if (resultEl) {
          resultEl.textContent = "Bitte IMAP Host, Benutzername und Passwort ausfüllen und speichern.";
          resultEl.style.color = "var(--color-danger, red)";
        }
        return;
      }
      imapTestBtn.disabled = true;
      if (resultEl) resultEl.textContent = "…";
      try {
        const res = await apiRequest(API_BASE + "/api/settings/imap/test", {
          method: "POST",
          body: {
            imapHost,
            imapPort: Number(document.querySelector("#imapPort")?.value || 993),
            imapUsername,
            imapPassword,
            imapFolder: (document.querySelector("#imapFolder")?.value || "INBOX").trim() || "INBOX",
            imapUseSsl: document.querySelector("#imapUseSsl")?.value !== "0",
          },
        });
        if (resultEl) {
          resultEl.textContent = uiT("imapTestOk") + (res.message ? ` (${res.message})` : "");
          resultEl.style.color = "var(--color-success, green)";
        }
      } catch (e) {
        if (resultEl) {
          resultEl.textContent = `${uiT("imapTestFail")}: ${e.message}`;
          resultEl.style.color = "var(--color-danger, red)";
        }
      } finally {
        imapTestBtn.disabled = false;
      }
    });
  }
})();
