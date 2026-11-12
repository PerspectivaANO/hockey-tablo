import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { plural, teamName } from "./format.js";
import { groupChips, leagueHead, leaguePicker } from "./picker.js";
import { S, myLeagueIds, myTeams } from "./state.js";

let seq = 0;
let tab = "tour";
/** Какая из групп своих команд открыта (если их несколько). */
let ratingLeague = null;

const TABS = [["tour", "Тур"], ["month", "Месяц"], ["quarter", "Круг"], ["rank", "Разряд"]];

const HINT = {
  tour: "Тур — неделя с понедельника, потом обнуляется. Хороший результат за тур — 100–150 очков.",
  month: "Месяц — очки за все туры месяца.",
  quarter: "Круг — 12 туров подряд.",
  season: "Сезон целиком, итоги — в конце мая.",
};

function bar(value, goal) {
  const i = h("i");
  i.style.setProperty("--w", String(Math.min(100, Math.round((value / goal) * 100))));
  return h("div", { class: "bar" }, i);
}

function goalTile(label, value) {
  return h("div", { class: "tile" }, h("div", { class: "sub" }, label), h("div", { class: "big" }, value));
}

/** Строка рейтинга: место, родитель, под именем его команда, очки. */
function row(r, myId, year) {
  return h("div", { class: "lb" + (r.userId === myId ? " me" : "") },
    h("span", { class: "rk" }, r.place),
    h("span", { class: "nm2" }, r.userId === myId ? "Вы" : r.name,
      h("small", {}, `${r.team ? r.team.split(", ").map((n) => teamName(n, year)).join(", ") + " · " : ""}угадано ${r.hitsCount} из ${r.betsCount}`)),
    h("span", { class: "pt" }, r.points));
}

function board(data, myId, year, leagueId) {
  const { top, me } = data;
  const myNames = myTeams().filter((t) => t.leagueId === leagueId).map((t) => t.name).join(", ");
  const mine = me || { place: "—", userId: myId, name: "Вы", team: myNames || null, points: 0, betsCount: 0, hitsCount: 0 };
  return h("div", { class: "tile" },
    top.length === 0
      ? h("p", { class: "empty" }, "Пока никто не набрал очков. Рейтинг появится после первых сыгранных матчей.")
      : top.map((r) => row(r, myId, year)),
    top.some((r) => r.userId === myId) ? null : row(mine, myId, year));
}

/**
 * Рейтинг родителей своей трибуны. Если команд в нескольких группах — переключатель между ними;
 * если команд нет (человек только следит), можно выбрать любую группу.
 */
export async function renderRating(root) {
  const mineIds = myLeagueIds();
  const watcher = mineIds.length === 0;
  if (!watcher && !mineIds.includes(ratingLeague)) ratingLeague = mineIds[0];
  const lg = S.leagues.find((l) => l.id === (watcher ? S.leagueId : ratingLeague)) || null;
  const my = ++seq;
  const body = h("div", {}, h("p", { class: "empty" }, "Загружаем…"));
  mount(root, h("section", { class: "screen" },
    h("div", { class: "segs", role: "group", "aria-label": "Период" },
      TABS.map(([k, t]) => h("button", { type: "button", "aria-pressed": String(tab === k),
        onclick: () => { tab = k; renderRating(root); } }, t))),
    h("p", { class: "stitle" }, h("span", {}, "Рейтинг родителей")),
    watcher ? leaguePicker({ onChange: () => renderRating(root) })
            : groupChips({ leagueIds: mineIds, current: ratingLeague, onPick: (id) => { ratingLeague = id; renderRating(root); } }),
    leagueHead(lg),
    watcher ? h("p", { class: "note" }, "Вы следите без своей команды, поэтому здесь можно смотреть любую группу.") : null,
    body));
  if (!lg) return mount(body, h("p", { class: "empty" }, "Группы ещё не загружены."));

  const horizon = tab === "rank" ? "season" : tab;
  const r = await api(`/api/rating?leagueId=${lg.id}&horizon=${horizon}`);
  if (my !== seq) return;
  if (!r.ok) return mount(body, h("p", { class: "empty" }, "Не удалось загрузить рейтинг."));
  const d = r.data;
  const myId = S.me.id;
  const year = lg.birthYear;
  const mine = d.me ? d.me.points : 0;

  if (tab === "tour") {
    return mount(body, board(d, myId, year, lg.id), h("p", { class: "note" }, HINT.tour));
  }
  if (tab === "month" || tab === "quarter") {
    return mount(body,
      goalTile(tab === "month" ? "Моих очков за месяц" : "Моих очков за круг", mine),
      h("p", { class: "stitle" }, h("span", {}, tab === "month" ? "Таблица месяца" : "Таблица круга")),
      board(d, myId, year, lg.id),
      h("p", { class: "note" }, HINT[tab]));
  }

  const c = d.career;
  const rank = c.rank;
  const base = rank.at;
  const span = rank.next ? rank.next.at - base : 1;
  const ladder = c.ladder.map((x) => [x.name, x.at]);
  mount(body,
    h("p", { class: "stitle" }, h("span", {}, `Разряд · сезон ${c.season}`), h("span", {}, "в новом сезоне заново")),
    h("div", { class: "tile" },
      h("div", { class: "hdr" },
        h("div", {}, h("div", { class: "sub" }, "Мой разряд"), h("div", { class: "big" }, rank.name)),
        h("div", { class: "right" }, h("div", { class: "sub" }, "Очков за сезон"), h("div", { class: "big" }, c.points))),
      bar(c.points - base, span),
      h("p", { class: "note" }, rank.next
        ? `До «${rank.next.name}» осталось ${rank.next.need} ${plural(rank.next.need, "очко", "очка", "очков")}. `
        : "Высший разряд взят. ",
        "Разряд считается за сезон по всем возрастам вместе. В новом сезоне счёт начинается заново, а взятый разряд остаётся значком.")),
    c.last ? h("div", { class: "tile" }, h("div", { class: "sub" }, `Прошлый сезон ${c.last.season}`), h("div", { class: "big" }, `${c.last.name} прошлого сезона`)) : null,
    h("p", { class: "stitle" }, h("span", {}, "Лестница разрядов")),
    h("div", { class: "tile" }, ladder.map(([n, at]) => h("div", { class: "rank" + (c.points >= at ? "" : " off") },
      h("b", {}, n), h("span", { class: "need" }, c.points >= at ? "взят" : `${at} очков`)))),
    h("p", { class: "stitle" }, h("span", {}, "Таблица сезона"), h("span", {}, "итоги в конце мая")),
    goalTile("Моих очков за сезон", mine),
    board(d, myId, year, lg.id),
    h("p", { class: "note" }, HINT.season));
}
