import { api, telegram, initData, sessionToken, clearSession } from "./api.js";
import { renderLogin } from "./login.js";
import { h, mount } from "./dom.js";
import { S, loadChoice, paintHeader } from "./state.js";
import { renderOnboarding } from "./onboarding.js";
import { renderHome } from "./home.js";
import { renderPick } from "./pick.js";
import { renderMine } from "./mine.js";
import { renderTable } from "./table.js";
import { renderRating } from "./rating.js";
import { renderTribune } from "./tribune.js";
import { renderInvite } from "./invite.js";
import { renderRules } from "./rules.js";
import { renderTeams } from "./teams.js";
import { renderStats } from "./stats.js";
import { initLogo, playLogo } from "./logo.js";

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const teamsBtn = document.getElementById("teamsBtn");
const statsBtn = document.getElementById("statsBtn");

const SCREENS = { stats: renderStats, home: renderHome, mine: renderMine, table: renderTable, rating: renderRating, tribune: renderTribune, invite: renderInvite, teams: renderTeams };

/** Рисует текущий экран. Экран сам ходит за данными и сам показывает «загрузка» и ошибки. */
S.render = function render() {
  if (!S.me) return;
  if (S.rules) {
    nav.hidden = true;
    renderRules(main);
    window.scrollTo(0, 0);
    return;
  }
  teamsBtn.hidden = !S.me.adult;
  statsBtn.hidden = !S.me.admin;
  if (!S.me.adult || !S.me.profileDone) {
    nav.hidden = true;
    renderOnboarding(main);
    return;
  }
  nav.hidden = false;
  for (const b of nav.querySelectorAll("button")) {
    b.setAttribute("aria-selected", String(b.dataset.sc === S.screen && !S.pick));
  }
  if (S.pick) renderPick(main);
  else SCREENS[S.screen](main);
};

S.go = function go(screen) {
  S.screen = screen;
  S.pick = null;
  S.rules = false;
  S.render();
  window.scrollTo(0, 0);
};

// «Мои команды» — после регистрации: можно изменить команды или перейти в режим «только слежу».
teamsBtn.addEventListener("click", () => S.go("teams"));
statsBtn.addEventListener("click", () => S.go("stats"));

// Правила доступны с любого экрана: из шапки, до и после регистрации.
document.getElementById("rulesBtn").addEventListener("click", () => {
  S.rules = true;
  S.render();
});

// Ссылка в подвале ведёт на сайт разработки: в Телеграме открываем её во внешнем окне, чтобы не уводить приложение со страницы.
for (const link of document.querySelectorAll(".made a")) {
  link.addEventListener("click", (e) => {
    if (telegram && telegram.openLink) {
      e.preventDefault();
      telegram.openLink(new URL(e.currentTarget.getAttribute("href"), location.origin).href);
    }
  });
}

nav.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-sc]");
  if (b) S.go(b.dataset.sc);
});

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: {} });
  clearSession();
  location.reload();
});

function showLogin(note) {
  document.getElementById("subline").textContent = "Вход";
  nav.hidden = true;
  renderLogin(main, note);
}

function fatal(text) {
  mount(main, h("section", { class: "screen" }, h("p", { class: "empty" }, text)));
  document.getElementById("subline").textContent = "Нет доступа";
}

/** Шапка и нижняя полоса Телеграма красятся в цвет приложения: иначе крестик и «⋯» на белых кружках сливаются с фоном. */
function hexOf(css) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return m ? "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("") : "";
}
function paintTelegramChrome() {
  if (!telegram) return;
  try {
    const bg = hexOf(getComputedStyle(document.body).backgroundColor);
    const app = document.querySelector(".app");
    const panel = app ? hexOf(getComputedStyle(app).backgroundColor) : "";
    if (bg && telegram.setHeaderColor) telegram.setHeaderColor(bg);
    if (bg && telegram.setBackgroundColor) telegram.setBackgroundColor(bg);
    if ((panel || bg) && telegram.setBottomBarColor) telegram.setBottomBarColor(panel || bg);
  } catch {
    /* старый клиент Телеграма: останутся цвета по умолчанию */
  }
}

async function boot() {
  if (telegram) {
    telegram.ready();
    telegram.expand();
    paintTelegramChrome();
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintTelegramChrome);
    if (telegram.onEvent) telegram.onEvent("themeChanged", paintTelegramChrome);
  }
  // Вне Телеграма (обычный браузер): нужен вход через бота. Внутри Телеграма всё как раньше, по подписи.
  if (!initData() && !sessionToken()) return showLogin();
  const [me, lg] = await Promise.all([api("/api/me"), api("/api/leagues")]);
  if (me.status === 401 && !initData() && sessionToken()) {
    clearSession();
    return showLogin("Сессия закончилась. Войдите снова.");
  }
  logoutBtn.hidden = !(sessionToken() && !initData());
  if (me.status === 401) return fatal("Не удалось подтвердить, что вы пришли из Телеграма. Закройте и откройте приложение заново.");
  if (me.status === 403) return fatal("Аккаунт заблокирован модератором.");
  if (!me.ok || !lg.ok) return fatal((me.data && me.data.message) || "Сервер не отвечает. Попробуйте через минуту.");
  S.me = me.data;
  S.leagues = lg.data.leagues;
  const saved = loadChoice();
  S.leagueId =
    (S.me.teams[0] && S.me.teams[0].leagueId) ||
    (S.leagues.find((l) => l.id === saved) || S.leagues[0] || {}).id ||
    null;
  paintHeader();
  S.render();
  // Табло оживает, когда приложение уже на экране (в Телеграме окно к этому моменту успевает открыться).
  setTimeout(playLogo, 450);
}

initLogo(telegram);
boot();
