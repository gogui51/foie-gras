"use strict";

(function () {
  var STORAGE_KEY = "carnet-foie-gras-v1";
  var timerNames = { rest: "Repos après assaisonnement", cook: "Immersion hors du feu", chill: "Repos au réfrigérateur" };
  var baseDurations = { rest: 3600, cook: 2700, chill: 172800 };
  var timerOrder = ["rest", "cook", "chill"];

  function makeTimer(id, cookMinutes) {
    var duration = id === "cook" ? cookMinutes * 60 : baseDurations[id];
    return { status: "idle", duration: duration, remaining: duration, endAt: 0 };
  }
  function defaults() {
    return {
      grams: 1000,
      cookMinutes: 45,
      done: [],
      mode: "all",
      phase: 0,
      timers: {
        rest: makeTimer("rest", 45),
        cook: makeTimer("cook", 45),
        chill: makeTimer("chill", 45)
      }
    };
  }
  function validNumber(v, low, high) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : low;
  }
  function loadState() {
    var initial = defaults();
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || typeof stored !== "object") return initial;
      initial.grams = validNumber(stored.grams || 1000, 100, 10000);
      initial.cookMinutes = [30, 35, 40, 45].includes(Number(stored.cookMinutes)) ? Number(stored.cookMinutes) : 45;
      initial.done = Array.isArray(stored.done) ? Array.from(new Set(stored.done.map(Number).filter(function (n) { return Number.isInteger(n) && n >= 1 && n <= 10; }))) : [];
      initial.mode = stored.mode === "guide" ? "guide" : "all";
      initial.phase = validNumber(stored.phase || 0, 0, 5);
      timerOrder.forEach(function (id) {
        var old = stored.timers && stored.timers[id];
        if (!old || typeof old !== "object") return;
        var fallback = id === "cook" ? initial.cookMinutes * 60 : baseDurations[id];
        var duration = validNumber(old.duration, 1, 604800) || fallback;
        var remaining = validNumber(old.remaining, 0, duration);
        var status = ["idle", "running", "paused", "done"].includes(old.status) ? old.status : "idle";
        var endAt = Number(old.endAt) || 0;
        if (status === "running" && endAt <= Date.now()) {
          status = "done";
          remaining = 0;
          endAt = 0;
        }
        if (status === "running" && endAt <= 0) {
          status = "paused";
          endAt = 0;
        }
        initial.timers[id] = { status: status, duration: duration, remaining: remaining, endAt: endAt };
      });
      if (initial.timers.cook.status === "idle") {
        initial.timers.cook = makeTimer("cook", initial.cookMinutes);
      }
    } catch (error) {
      return initial;
    }
    return initial;
  }

  var state = loadState();
  var toastTimeout = null;
  var audio = null;
  var lastTitle = "";

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* Le navigateur peut interdire le stockage. */ }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Math.round(value * 100) / 100);
  }
  function renderIngredients() {
    document.getElementById("weightInput").value = state.grams;
    document.getElementById("foieQty").textContent = formatNumber(state.grams);
    document.getElementById("saltQty").textContent = formatNumber(12 * state.grams / 1000);
    document.getElementById("pepperQty").textContent = formatNumber(3 * state.grams / 1000);
    document.getElementById("sugarQty").textContent = formatNumber(state.grams / 1000);
    document.querySelectorAll("[data-weight]").forEach(function (button) {
      var selected = Number(button.dataset.weight) === state.grams;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function updateWeight(weight) {
    state.grams = Math.round(validNumber(weight, 100, 10000) / 50) * 50;
    save();
    renderIngredients();
  }
  document.getElementById("weightMinus").addEventListener("click", function () { updateWeight(state.grams - 100); });
  document.getElementById("weightPlus").addEventListener("click", function () { updateWeight(state.grams + 100); });
  document.getElementById("weightInput").addEventListener("change", function (event) { updateWeight(event.target.value || state.grams); });
  document.querySelectorAll("[data-weight]").forEach(function (button) {
    button.addEventListener("click", function () { updateWeight(Number(button.dataset.weight)); });
  });

  function renderSteps() {
    document.querySelectorAll(".step[data-step]").forEach(function (label) {
      var number = Number(label.dataset.step);
      var checked = state.done.includes(number);
      label.querySelector("input").checked = checked;
      label.classList.toggle("is-done", checked);
    });
    document.getElementById("doneCount").innerHTML = state.done.length + " <small>/ 10</small>";
    document.getElementById("overallFill").style.width = (state.done.length * 10) + "%";
  }
  document.querySelectorAll(".step[data-step]").forEach(function (label) {
    label.querySelector("input").addEventListener("change", function (event) {
      var number = Number(label.dataset.step);
      state.done = state.done.filter(function (n) { return n !== number; });
      if (event.target.checked) state.done.push(number);
      state.done.sort(function (a, b) { return a - b; });
      save();
      renderSteps();
      if (state.done.length === 10) toast("Les 10 étapes sont cochées. Bravo !");
    });
  });

  function renderMode() {
    document.querySelectorAll("[data-mode]").forEach(function (button) {
      var selected = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    var guided = state.mode === "guide";
    document.getElementById("guideNavigation").hidden = !guided;
    document.querySelectorAll(".phase").forEach(function (section) {
      section.hidden = guided && Number(section.dataset.phase) !== state.phase;
    });
    document.getElementById("guideProgress").textContent = "Phase " + (state.phase + 1) + " sur 6";
    document.getElementById("phasePrev").disabled = state.phase <= 0;
    document.getElementById("phaseNext").disabled = state.phase >= 5;
  }
  function navigatePhase(change) {
    state.phase = Math.max(0, Math.min(5, state.phase + change));
    save();
    renderMode();
    document.getElementById("guideNavigation").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.addEventListener("click", function () { state.mode = button.dataset.mode; save(); renderMode(); });
  });
  document.getElementById("phasePrev").addEventListener("click", function () { navigatePhase(-1); });
  document.getElementById("phaseNext").addEventListener("click", function () { navigatePhase(1); });

  function secondsRemaining(timer) {
    return timer.status === "running" ? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)) : timer.remaining;
  }
  function formatDuration(seconds) {
    var total = Math.max(0, Math.ceil(seconds));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }
  function expectedFinish(until) {
    var format = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return "Jusqu’au " + format.format(new Date(until));
  }
  function labelForStatus(timer) {
    if (timer.status === "running") return "En cours";
    if (timer.status === "paused") return "En pause";
    if (timer.status === "done") return "Terminé !";
    return "Prêt à démarrer";
  }
  function renderTimer(id) {
    var timer = state.timers[id];
    var remaining = secondsRemaining(timer);
    var card = document.querySelector('[data-timer-card="' + id + '"]');
    card.querySelector("[data-count-for]").textContent = formatDuration(remaining);
    card.querySelector("[data-progress-for]").style.width = Math.max(0, Math.min(100, (1 - remaining / timer.duration) * 100)) + "%";
    card.querySelector("[data-status-for]").textContent = labelForStatus(timer);
    card.querySelector("[data-end-for]").textContent =
      timer.status === "running" ? expectedFinish(timer.endAt) :
      timer.status === "paused" ? "Reprends quand tu veux" :
      timer.status === "done" ? "Minuteur arrivé à zéro" :
      id === "chill" ? "2 jours" : Math.round(timer.duration / 60) + " minutes";
    var start = card.querySelector('[data-timer-action="start"]');
    var pause = card.querySelector('[data-timer-action="pause"]');
    var reset = card.querySelector('[data-timer-action="reset"]');
    start.hidden = timer.status === "running";
    pause.hidden = timer.status !== "running";
    start.textContent = timer.status === "paused" ? "Reprendre" : timer.status === "done" ? "Relancer le minuteur" : "Démarrer le minuteur";
    reset.setAttribute("aria-label", "Réinitialiser : " + timerNames[id]);
    card.classList.toggle("timer-finished", timer.status === "done");
  }
  function renderPresets() {
    var locked = ["running", "paused"].includes(state.timers.cook.status);
    document.querySelectorAll("[data-cook]").forEach(function (button) {
      var active = Number(button.dataset.cook) === state.cookMinutes;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = locked;
    });
  }
  function renderDock() {
    var active = timerOrder.filter(function (id) { return state.timers[id].status === "running"; });
    var dock = document.getElementById("timerDock");
    dock.hidden = active.length === 0;
    if (!active.length) {
      document.title = "Foie gras maison — Le carnet de cuisine";
      return;
    }
    var current = active[0];
    document.getElementById("dockTitle").textContent = timerNames[current] + (active.length > 1 ? " (+" + (active.length - 1) + ")" : "");
    document.getElementById("dockHint").textContent = "Sonnerie si la page reste ouverte";
    document.getElementById("dockTime").textContent = formatDuration(secondsRemaining(state.timers[current]));
    dock.dataset.current = current;
    var title = "⏳ " + formatDuration(secondsRemaining(state.timers[current])) + " · Foie gras";
    if (lastTitle !== title) { document.title = title; lastTitle = title; }
  }
  function renderTimers() {
    timerOrder.forEach(renderTimer);
    renderPresets();
    renderDock();
  }

  function armSound() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audio) audio = new AudioContextClass();
      if (audio.state === "suspended") audio.resume().catch(function () {});
    } catch (error) { /* Audio facultatif. */ }
  }
  function chime() {
    try {
      if (!audio) return;
      if (audio.state === "suspended") audio.resume().catch(function () {});
      [0, .24, .48].forEach(function (delay, i) {
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = [659, 784, 988][i];
        osc.connect(gain);
        gain.connect(audio.destination);
        var start = audio.currentTime + delay;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.12, start + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .33);
        osc.start(start);
        osc.stop(start + .35);
      });
    } catch (error) { /* Audio facultatif. */ }
    if ("vibrate" in navigator) navigator.vibrate([160, 100, 160]);
  }
  function toast(message) {
    var element = document.getElementById("toast");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () { element.hidden = true; }, 5500);
  }
  function tick(silent) {
    var changed = false;
    var finished = [];
    timerOrder.forEach(function (id) {
      var timer = state.timers[id];
      if (timer.status === "running" && secondsRemaining(timer) <= 0) {
        timer.status = "done";
        timer.endAt = 0;
        timer.remaining = 0;
        changed = true;
        finished.push(id);
      }
    });
    if (changed) save();
    renderTimers();
    if (!silent && finished.length) {
      chime();
      toast(finished.map(function (id) { return timerNames[id]; }).join(" et ") + " : minuteur terminé !");
    }
  }
  function startTimer(id) {
    var timer = state.timers[id];
    armSound();
    if (timer.status === "running") return;
    if (timer.status === "idle" || timer.status === "done") {
      timer.duration = id === "cook" ? state.cookMinutes * 60 : baseDurations[id];
      timer.remaining = timer.duration;
    }
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.status = "running";
    save();
    renderTimers();
  }
  function pauseTimer(id) {
    var timer = state.timers[id];
    if (timer.status !== "running") return;
    timer.remaining = secondsRemaining(timer);
    timer.status = "paused";
    timer.endAt = 0;
    save();
    renderTimers();
  }
  function resetTimer(id) {
    state.timers[id] = makeTimer(id, state.cookMinutes);
    save();
    renderTimers();
  }
  document.querySelectorAll("[data-timer-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      var id = button.dataset.for;
      var action = button.dataset.timerAction;
      if (action === "start") startTimer(id);
      else if (action === "pause") pauseTimer(id);
      else if (action === "reset") resetTimer(id);
    });
  });
  document.querySelectorAll("[data-cook]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (["running", "paused"].includes(state.timers.cook.status)) return;
      state.cookMinutes = Number(button.dataset.cook);
      state.timers.cook = makeTimer("cook", state.cookMinutes);
      save();
      renderTimers();
    });
  });
  document.getElementById("dockView").addEventListener("click", function () {
    var id = document.getElementById("timerDock").dataset.current;
    if (!id) return;
    var phaseIndex = id === "rest" ? 1 : id === "cook" ? 3 : 4;
    if (state.mode === "guide" && state.phase !== phaseIndex) {
      state.phase = phaseIndex;
      save();
      renderMode();
    }
    document.querySelector('[data-timer-card="' + id + '"]').scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("resetAll").addEventListener("click", function () {
    if (!window.confirm("Recommencer cette recette ? Les étapes cochées et les minuteurs seront remis à zéro.")) return;
    state = defaults();
    save();
    renderIngredients();
    renderSteps();
    renderMode();
    renderTimers();
    toast("La recette a été réinitialisée.");
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(false); });
  window.addEventListener("focus", function () { tick(false); });

  renderIngredients();
  renderSteps();
  renderMode();
  tick(true);
  setInterval(function () { tick(false); }, 1000);
})();
