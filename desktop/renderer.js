(function initDesktopShellControls() {
  const desktopApi = window.baupassDesktop;
  if (!desktopApi || !desktopApi.isDesktop) {
    return;
  }

  const titlebar = document.querySelector("#desktopTitlebar");
  const body = document.body;
  if (!titlebar || !body) {
    return;
  }

  body.classList.add("desktop-app");
  titlebar.classList.remove("hidden");

  const minimizeBtn = document.querySelector("#desktopMinimizeBtn");
  const maximizeBtn = document.querySelector("#desktopMaximizeBtn");
  const closeBtn = document.querySelector("#desktopCloseBtn");

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      desktopApi.minimize();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", () => {
      desktopApi.toggleMaximize();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      desktopApi.close();
    });
  }

  const SVG_MAXIMIZE = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
  const SVG_RESTORE = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/><polyline points="0.5,2.5 0.5,9.5 7.5,9.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>';

  const applyWindowState = (state) => {
    const isMaximized = Boolean(state && state.isMaximized);
    if (maximizeBtn) {
      maximizeBtn.innerHTML = isMaximized ? SVG_RESTORE : SVG_MAXIMIZE;
      maximizeBtn.setAttribute("aria-label", isMaximized ? "Wiederherstellen" : "Maximieren");
      maximizeBtn.title = isMaximized ? "Wiederherstellen" : "Maximieren";
    }
  };

  desktopApi.getWindowState().then(applyWindowState).catch(() => {});
  desktopApi.onWindowState(applyWindowState);
})();
