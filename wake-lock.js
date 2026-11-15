"use strict";

/* Maintien de l’écran allumé pendant la consultation de la recette.
   Préférence locale, activation automatique si autorisée, repli sur un bouton. */
(function () {
  const button = document.getElementById("wakeToggle");
  const label = document.getElementById("wakeLabel");
  const status = document.getElementById("wakeStatus");
  if (!button || !label || !status) return;

  const KEY = "carnet-foie-gras-wake-preference-v1";
  const supported = Boolean(window.isSecureContext && navigator.wakeLock && typeof navigator.wakeLock.request === "function");
  let desired = true; // activé par défaut pour lire la recette pendant la préparation
  let sentinel = null;
  let requesting = false;
  let failed = false;
  let generation = 0;

  try { desired = localStorage.getItem(KEY) !== "off"; } catch (_) { /* mode privé */ }

  function storePreference() {
    try { localStorage.setItem(KEY, desired ? "on" : "off"); } catch (_) { /* stockage indisponible */ }
  }

  function render() {
    const active = Boolean(sentinel && !sentinel.released);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(desired));
    button.disabled = !supported;

    if (!supported) {
      label.textContent = "Écran non pris en charge";
      status.textContent = "Utilise Safari récent";
      button.title = "Cette fonction nécessite un navigateur compatible et une connexion HTTPS.";
    } else if (!desired) {
      label.textContent = "Garder l’écran allumé";
      status.textContent = "Désactivé";
      button.title = "Appuyer pour empêcher la mise en veille automatique.";
    } else if (active) {
      label.textContent = "Écran allumé";
      status.textContent = "Maintien activé";
      button.title = "L’écran reste allumé tant que la page est active. Appuyer pour désactiver.";
    } else if (requesting) {
      label.textContent = "Écran allumé";
      status.textContent = "Activation…";
      button.title = "Demande d’activation en cours.";
    } else if (document.visibilityState !== "visible") {
      label.textContent = "Garder l’écran allumé";
      status.textContent = "En pause";
      button.title = "Le maintien sera réactivé au retour sur la page.";
    } else if (failed) {
      label.textContent = "Toucher pour activer";
      status.textContent = "Autorisation nécessaire";
      button.title = "Le navigateur a refusé l’activation automatique. Appuyer pour réessayer.";
    } else {
      label.textContent = "Garder l’écran allumé";
      status.textContent = "Non actif";
      button.title = "Appuyer pour activer le maintien de l’écran.";
    }
  }

  async function requestWakeLock() {
    if (!supported || !desired || document.visibilityState !== "visible") {
      render();
      return;
    }
    if (requesting || (sentinel && !sentinel.released)) {
      render();
      return;
    }
    const requestId = ++generation;
    requesting = true;
    failed = false;
    render();

    try {
      const lock = await navigator.wakeLock.request("screen");
      requesting = false;

      if (requestId !== generation || !desired || document.visibilityState !== "visible") {
        try { await lock.release(); } catch (_) { /* déjà révoqué */ }
        render();
        return;
      }
      sentinel = lock;
      lock.addEventListener("release", function () {
        if (sentinel === lock) {
          sentinel = null;
          render();
        }
      });
      render();
    } catch (_) {
      requesting = false;
      if (requestId === generation) failed = true;
      render();
    }
  }

  async function disable() {
    desired = false;
    storePreference();
    ++generation;
    const lock = sentinel;
    sentinel = null;
    requesting = false;
    failed = false;
    render();

    if (lock && !lock.released) {
      try { await lock.release(); } catch (_) { /* déjà révoqué */ }
    }
  }

  button.addEventListener("click", function () {
    if (!supported) return;
    if (desired && sentinel && !sentinel.released) {
      void disable();
    } else if (desired && failed) {
      void requestWakeLock();
    } else if (desired && requesting) {
      return;
    } else if (desired) {
      void disable();
    } else {
      desired = true;
      storePreference();
      void requestWakeLock();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && desired) {
      void requestWakeLock();
    } else {
      render();
    }
  });
  window.addEventListener("pageshow", function () {
    if (desired) void requestWakeLock();
  });

  render();
  if (desired) void requestWakeLock();
})();
