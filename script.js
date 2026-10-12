/*
 * Public-facing Sky_Hex site.
 * The status feed is read-only and contains only public service states.
 */
const STATUS_URL = "/status.json";
const STORMWORKS_PLAYERS_URL = "/players.json";
const PLAYERS_MAX_AGE_MS = 90_000;
const STATUS_MAX_AGE_MS = 120_000;
const PUBLIC_STATUS = {
  updatedAt: null,
  services: { stormworks: "unknown", ksp: "unknown" }
};

const pageNames = ["home", "games", "electronics", "projects", "about"];
const navLinks = [...document.querySelectorAll("[data-page]")];
const pages = [...document.querySelectorAll(".page")];
const currentSection = document.getElementById("currentSection");
const nav = document.getElementById("primaryNav");
const menuToggle = document.getElementById("menuToggle");

function showPage(name, updateHash = true) {
  if (!pageNames.includes(name)) name = "home";
  pages.forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav-link").forEach(link => {
    const active = link.dataset.page === name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  currentSection.textContent = name.toUpperCase();
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (updateHash && location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

navLinks.forEach(link => link.addEventListener("click", event => {
  const name = link.dataset.page;
  if (!name) return;
  event.preventDefault();
  showPage(name);
}));

window.addEventListener("hashchange", () => showPage(location.hash.slice(1), false));
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("open", !expanded);
});

// This is elapsed time since the counter's launch date, not a measured uptime percentage.
const SITE_COUNTER_START = new Date("2026-10-11T00:00:00Z").getTime();

function updateSiteUptime() {
  const output = document.getElementById("siteUptime");
  if (!output) return;
  let seconds = Math.max(0, Math.floor((Date.now() - SITE_COUNTER_START) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  output.textContent = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
updateSiteUptime();
setInterval(updateSiteUptime, 1000);

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  document.getElementById("dateText").textContent = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  document.getElementById("year").textContent = now.getFullYear();
}
updateClock();
setInterval(updateClock, 1000);

const statusLabels = {
  online: "Online",
  offline: "Offline",
  unknown: "Unknown"
};

function renderPublicStatus() {
  const services = PUBLIC_STATUS.services;
  document.querySelectorAll("[data-service]").forEach(el => {
    const value = services[el.dataset.service];
    const state = value === "online" || value === "offline" ? value : "unknown";
    el.textContent = statusLabels[state];
    el.classList.remove("is-online", "is-offline");
    if (state === "online") el.classList.add("is-online");
    if (state === "offline") el.classList.add("is-offline");
  });
  document.querySelectorAll("[data-service-text]").forEach(el => {
    const value = services[el.dataset.service];
    const state = value === "online" || value === "offline" ? value : "unknown";
    el.textContent = statusLabels[state];
  });

  const values = Object.values(services);
  const overall = document.getElementById("overallStatus");
  const description = document.getElementById("overallDescription");
  const sideStatus = document.getElementById("sideStatus");
  const lastUpdated = document.getElementById("lastUpdated");
  const sideDot = document.querySelector(".side-status .status-dot");
  const uptimeDot = document.querySelector(".uptime-foot .status-dot");
  const uptimeRing = document.querySelector(".uptime-ring");
  const uptimeRingDot = document.querySelector(".uptime-ring span");
  const statusClasses = ["status-online", "status-partial", "status-offline", "status-unknown"];
  [sideDot, uptimeDot, uptimeRing, uptimeRingDot].forEach(el => {
    if (el) el.classList.remove(...statusClasses);
  });

  const bothOnline = values.length === 2 && values.every(value => value === "online");
  const bothOffline = values.length === 2 && values.every(value => value === "offline");
  const oneOnline = values.length === 2 && values.filter(value => value === "online").length === 1 && values.filter(value => value === "offline").length === 1;

  let overallState = "unknown";
  if (bothOnline) {
    overallState = "online";
    overall.textContent = "All monitored online";
    description.textContent = "Both monitored services report online.";
    sideStatus.textContent = "Services online";
  } else if (oneOnline) {
    overallState = "partial";
    overall.textContent = "Partial availability";
    description.textContent = "One monitored service is online; the other is offline.";
    sideStatus.textContent = "One service online";
  } else if (bothOffline) {
    overallState = "offline";
    overall.textContent = "All services offline";
    description.textContent = "Neither monitored service is currently online.";
    sideStatus.textContent = "All services offline";
  } else {
    overall.textContent = "Status unknown";
    description.textContent = "The live status feed is unavailable or not yet verified.";
    sideStatus.textContent = "Status unknown";
    lastUpdated.textContent = "No fresh status feed";
  }

  const stateClass = overallState === "online" ? "status-online"
    : overallState === "partial" ? "status-partial"
    : overallState === "offline" ? "status-offline"
    : "status-unknown";
  [sideDot, uptimeDot, uptimeRing, uptimeRingDot].forEach(el => {
    if (el) el.classList.add(stateClass);
  });
  if (PUBLIC_STATUS.updatedAt) {
    lastUpdated.textContent = "Status checked " + new Date(PUBLIC_STATUS.updatedAt).toLocaleString();
  }
}

async function fetchPublicStatus() {
  try {
    const response = await fetch(STATUS_URL + "?_=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Status feed unavailable");
    const data = await response.json();
    const timestamp = Date.parse(data.updatedAt);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > STATUS_MAX_AGE_MS || timestamp > Date.now() + 30_000) {
      throw new Error("Status feed is stale");
    }
    const services = data.services || {};
    PUBLIC_STATUS.services = {
      stormworks: ["online", "offline"].includes(services.stormworks) ? services.stormworks : "unknown",
      ksp: ["online", "offline"].includes(services.ksp) ? services.ksp : "unknown"
    };
    PUBLIC_STATUS.updatedAt = data.updatedAt;
  } catch {
    PUBLIC_STATUS.services = { stormworks: "unknown", ksp: "unknown" };
    PUBLIC_STATUS.updatedAt = null;
  }
  renderPublicStatus();
}


async function fetchStormworksPlayers() {
  const nameEl = document.getElementById("stormworksServerName");
  const playersEl = document.getElementById("stormworksPlayerCount");
  const updatedEl = document.getElementById("stormworksPlayersUpdated");
  if (!nameEl || !playersEl || !updatedEl) return;

  try {
    const response = await fetch(STORMWORKS_PLAYERS_URL + "?_=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Player feed unavailable");
    const data = await response.json();
    const timestamp = Date.parse(data.updatedAt);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > PLAYERS_MAX_AGE_MS ||
        timestamp > Date.now() + 30_000 || data.online !== true ||
        typeof data.serverName !== "string" || !Number.isInteger(data.players) ||
        !Number.isInteger(data.maxPlayers)) {
      throw new Error("Player feed stale or invalid");
    }
    nameEl.textContent = data.serverName;
    playersEl.textContent = data.players + " / " + data.maxPlayers;
    updatedEl.textContent = "Updated " + new Date(data.updatedAt).toLocaleTimeString();
  } catch {
    nameEl.textContent = "Unavailable";
    playersEl.textContent = "—";
    updatedEl.textContent = "Player count unavailable";
  }
}

fetchPublicStatus();
setInterval(fetchPublicStatus, 30_000);
fetchStormworksPlayers();
setInterval(fetchStormworksPlayers, 15_000);
showPage(location.hash.slice(1) || "home", false);
