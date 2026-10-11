/*
 * Public-facing Sky_Hex site.
 * Service states intentionally default to "unknown" rather than pretending to be live.
 * Later, replace this local configuration with a carefully limited public status endpoint.
 */
const PUBLIC_STATUS = {
  updatedAt: null,
  services: {
    stormworks: "unknown",
    minecraft: "unknown",
    ksp: "unknown"
  }
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
  unknown: "Unverified"
};
function renderPublicStatus() {
  const services = PUBLIC_STATUS.services;
  document.querySelectorAll("[data-service]").forEach(el => {
    const state = statusLabels[services[el.dataset.service] || "unknown"] ? (services[el.dataset.service] || "unknown") : "unknown";
    el.textContent = statusLabels[state];
    el.classList.remove("is-online", "is-offline");
    if (state === "online") el.classList.add("is-online");
    if (state === "offline") el.classList.add("is-offline");
  });
  document.querySelectorAll("[data-service-text]").forEach(el => {
    el.textContent = statusLabels[services[el.dataset.service] || "unknown"] || "Unverified";
  });

  const values = Object.values(services);
  const overall = document.getElementById("overallStatus");
  const description = document.getElementById("overallDescription");
  const sideStatus = document.getElementById("sideStatus");
  const lastUpdated = document.getElementById("lastUpdated");
  const sideDot = document.querySelector(".side-status .status-dot");
  const uptimeDot = document.querySelector(".uptime-foot .status-dot");

  [sideDot, uptimeDot].forEach(dot => dot.classList.remove("status-online", "status-offline"));
  if (values.length && values.every(value => value === "online")) {
    overall.textContent = "All monitored online";
    description.textContent = "All listed services report online.";
    sideStatus.textContent = "Services online";
    sideDot.classList.add("status-online");
    uptimeDot.classList.add("status-online");
  } else if (values.some(value => value === "offline")) {
    overall.textContent = "Service issue";
    description.textContent = "At least one monitored service reports offline.";
    sideStatus.textContent = "Service issue";
    sideDot.classList.add("status-offline");
    uptimeDot.classList.add("status-offline");
  } else {
    overall.textContent = "Not connected";
    description.textContent = "Live checks have not been configured.";
    sideStatus.textContent = "Status not connected";
    lastUpdated.textContent = "No live status feed";
  }
  if (PUBLIC_STATUS.updatedAt) lastUpdated.textContent = `Status checked ${PUBLIC_STATUS.updatedAt}`;
}

renderPublicStatus();
showPage(location.hash.slice(1) || "home", false);
