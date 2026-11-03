/* Sky_Hex — front-end behaviour and public, read-only service telemetry. */
(() => {
  "use strict";
  const STATUS_URL = "/status.json";
  const STORMWORKS_PLAYERS_URL = "/players.json";
  const LUNA_PLAYERS_URL = "/luna_players.json";
  const PLAYERS_MAX_AGE_MS = 90000;
  const STATUS_MAX_AGE_MS = 120000;
  const SITE_COUNTER_START = new Date("2026-10-11T00:00:00Z").getTime();
  const status = { updatedAt: null, services: { stormworks: "unknown", ksp: "unknown" } };

  const menu = document.getElementById("primaryNav");
  const toggle = document.getElementById("menuToggle");
  if (menu && toggle) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("open", !open);
      toggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
    });
    menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
    }));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
      }
    });
  }

  // Highlight the section currently in view without changing the browser's hash.
  const navLinks = [...document.querySelectorAll('.main-nav a[href^="#"]')];
  const observedSections = ["work", "lab", "servers", "about"]
    .map(id => document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window && observedSections.length) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === "#" + entry.target.id));
      });
    }, { rootMargin: "-28% 0px -62% 0px" });
    observedSections.forEach(section => sectionObserver.observe(section));
  }

  // A simple elapsed-time counter, not a measured uptime percentage.
  function updateSiteUptime() {
    const output = document.getElementById("siteUptime");
    if (!output) return;
    let seconds = Math.max(0, Math.floor((Date.now() - SITE_COUNTER_START) / 1000));
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60); seconds %= 60;
    output.textContent = `${days}d ${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m ${String(seconds).padStart(2,"0")}s`;
  }
  updateSiteUptime();
  window.setInterval(updateSiteUptime, 1000);
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const stateLabel = value => value === "online" ? "Online" : value === "offline" ? "Offline" : "Unknown";
  function renderStatus() {
    document.querySelectorAll("[data-service]").forEach(el => {
      const value = status.services[el.dataset.service];
      const state = value === "online" || value === "offline" ? value : "unknown";
      el.textContent = stateLabel(state);
      el.classList.remove("is-online", "is-offline");
      if (state !== "unknown") el.classList.add("is-" + state);
    });
    const values = Object.values(status.services);
    const online = values.filter(value => value === "online").length;
    const offline = values.filter(value => value === "offline").length;
    const overall = document.getElementById("overallStatus");
    const updated = document.getElementById("lastUpdated");
    if (overall) {
      if (online === 2) overall.textContent = "All monitored services online";
      else if (offline === 2) overall.textContent = "All monitored services offline";
      else if (online === 1 && offline === 1) overall.textContent = "Partial service availability";
      else overall.textContent = "Service status unknown";
    }
    if (updated) updated.textContent = status.updatedAt
      ? "Last checked " + new Date(status.updatedAt).toLocaleString()
      : "No fresh status feed";
  }

  async function fetchPublicStatus() {
    try {
      const response = await fetch(STATUS_URL + "?_=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Status feed unavailable");
      const data = await response.json();
      const timestamp = Date.parse(data.updatedAt);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > STATUS_MAX_AGE_MS || timestamp > Date.now() + 30000) {
        throw new Error("Status feed is stale");
      }
      const services = data.services || {};
      status.services = {
        stormworks: ["online", "offline"].includes(services.stormworks) ? services.stormworks : "unknown",
        ksp: ["online", "offline"].includes(services.ksp) ? services.ksp : "unknown"
      };
      status.updatedAt = data.updatedAt;
    } catch {
      status.services = { stormworks: "unknown", ksp: "unknown" };
      status.updatedAt = null;
    }
    renderStatus();
  }

  async function fetchStormworksPlayers() {
    const name = document.getElementById("stormworksServerName");
    const players = document.getElementById("stormworksPlayerCount");
    const updated = document.getElementById("stormworksPlayersUpdated");
    if (!name || !players || !updated) return;
    try {
      const response = await fetch(STORMWORKS_PLAYERS_URL + "?_=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Player feed unavailable");
      const data = await response.json();
      const timestamp = Date.parse(data.updatedAt);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > PLAYERS_MAX_AGE_MS ||
          timestamp > Date.now() + 30000 || data.online !== true ||
          typeof data.serverName !== "string" || !Number.isInteger(data.players) ||
          !Number.isInteger(data.maxPlayers)) throw new Error("Player feed stale or invalid");
      name.textContent = data.serverName;
      players.textContent = data.players + " / " + data.maxPlayers;
      updated.textContent = "Updated " + new Date(data.updatedAt).toLocaleTimeString();
    } catch {
      name.textContent = "Unavailable";
      players.textContent = "—";
      updated.textContent = "Player count unavailable";
    }
  }

  async function fetchLunaPlayers() {
    const players = document.getElementById("lunaPlayerCount");
    const updated = document.getElementById("lunaPlayersUpdated");
    if (!players || !updated) return;
    try {
      const response = await fetch(LUNA_PLAYERS_URL + "?_=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Luna player feed unavailable");
      const data = await response.json();
      const timestamp = Date.parse(data.updatedAt);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > PLAYERS_MAX_AGE_MS ||
          timestamp > Date.now() + 30000 || data.online !== true ||
          !Number.isInteger(data.players) || data.players < 0) throw new Error("Luna player feed stale or invalid");
      players.textContent = String(data.players);
      updated.textContent = "Updated " + new Date(data.updatedAt).toLocaleTimeString();
    } catch {
      players.textContent = "—";
      updated.textContent = "Player count unavailable";
    }
  }

  fetchPublicStatus();
  window.setInterval(fetchPublicStatus, 30000);
  fetchStormworksPlayers();
  window.setInterval(fetchStormworksPlayers, 15000);
  fetchLunaPlayers();
  window.setInterval(fetchLunaPlayers, 15000);

  // Reveal elements only when JS is active; no-JS users see the complete page.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js-reveal");
    const candidates = document.querySelectorAll(".section-heading,.featured-project,.project-card,.documentation-band,.build-stage,.log-item,.hardware-spec,.photo-gallery>a,.other-labs article,.server-card,.community-card,.about-copy");
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -35px 0px" });
    candidates.forEach((element, index) => {
      element.classList.add("reveal");
      element.style.transitionDelay = (index % 3) * 65 + "ms";
      revealObserver.observe(element);
    });
  }
})();
