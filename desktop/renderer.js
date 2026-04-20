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

  const applyWindowState = (state) => {
    const isMaximized = Boolean(state && state.isMaximized);
    if (maximizeBtn) {
      maximizeBtn.textContent = isMaximized ? "❐" : "□";
      maximizeBtn.setAttribute("aria-label", isMaximized ? "Wiederherstellen" : "Maximieren");
      maximizeBtn.title = isMaximized ? "Wiederherstellen" : "Maximieren";
    }
  };

  desktopApi.getWindowState().then(applyWindowState).catch(() => {});
  desktopApi.onWindowState(applyWindowState);
})();
