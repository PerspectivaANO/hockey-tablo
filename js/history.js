import { h } from "./dom.js";
import { teamName } from "./format.js";

/** Прошлые игры команд предстоящего матча: личные встречи и последние игры каждой команды. */

const dateText = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" });

/** Игра глазами команды: дома или в гостях, соперник, забитые и пропущенные, исход. */
function view(g, teamId, year) {
  const isHome = g.homeId === teamId;
  const gf = isHome ? g.homeGoals : g.awayGoals;
  const ga = isHome ? g.awayGoals : g.homeGoals;
  return {
    isHome, gf, ga,
    opp: teamName(isHome ? g.away : g.home, year),
    res: gf > ga ? "w" : gf < ga ? "l" : "d",
  };
}

const suffix = (g) => (g.technical ? " тех." : g.decidedBy === "ot" ? " ОТ" : g.decidedBy === "so" ? " Б" : "");

function gameRow(g, teamId, year) {
  const v = view(g, teamId, year);
  return h("div", { class: "hrow" },
    h("span", { class: "hd" }, dateText(g.at)),
    h("span", { class: "hn" }, h("small", {}, v.isHome ? "дома" : "в гостях"), v.opp),
    h("span", { class: "hs " + v.res }, `${v.gf}:${v.ga}${suffix(g)}`));
}

/** Форма: последние пять игр буквами («В В П В П»), средние забитые и пропущенные. */
function formLine(games, teamId, year) {
  if (games.length === 0) return h("p", { class: "note" }, "Сыгранных игр в базе пока нет.");
  const last = games.slice(0, 5).map((g) => view(g, teamId, year));
  const all = games.map((g) => view(g, teamId, year));
  const avg = (k) => (all.reduce((n, v) => n + v[k], 0) / all.length).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  return h("div", { class: "form" },
    h("span", { class: "fl" }, last.map((v) => h("i", { class: v.res }, v.res === "w" ? "В" : v.res === "l" ? "П" : "Н"))),
    h("span", { class: "fa" }, `забивает ${avg("gf")} · пропускает ${avg("ga")} за игру`));
}

function teamBlock(title, games, teamId, year) {
  return h("div", { class: "hteam" },
    h("p", { class: "hh" }, title),
    formLine(games, teamId, year),
    games.map((g) => gameRow(g, teamId, year)));
}

/** Блок на экране матча. Сложен, пока не нажали: заголовок-кнопка, внутри встречи и игры обеих команд. */
export function historyBlock({ history, m, year, open, onToggle }) {
  if (!history) return null;
  const home = teamName(m.home, year);
  const away = teamName(m.away, year);
  const empty = history.home.length + history.away.length === 0;
  return h("div", { class: "tile hist" },
    h("button", { type: "button", class: "histbtn", "aria-expanded": String(open), onclick: onToggle },
      h("span", {}, "Прошлые игры этих команд"), h("span", {}, open ? "▴" : "▾")),
    open ? (empty ? h("p", { class: "note" }, "У этих команд пока нет сыгранных игр в базе.") : [
      history.h2h.length ? h("div", { class: "hteam" },
        h("p", { class: "hh" }, "Личные встречи"),
        history.h2h.map((g) => h("div", { class: "hrow" },
          h("span", { class: "hd" }, dateText(g.at)),
          h("span", { class: "hn" }, `${teamName(g.home, year)} — ${teamName(g.away, year)}`),
          h("span", { class: "hs" }, `${g.homeGoals}:${g.awayGoals}${suffix(g)}`)))) : null,
      teamBlock(home, history.home, m.homeId, year),
      teamBlock(away, history.away, m.awayId, year),
    ]) : null);
}
