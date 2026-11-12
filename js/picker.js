import { h } from "./dom.js";
import { COMP_ORDER, COMP_SHORT, FEDERATIONS, GROUP_ORDER } from "./labels.js";
import { S, league, saveChoice } from "./state.js";

const fedOf = (l) => l.federation || "fhm";
const compOf = (l) => l.compCode || "main";
const ageKey = (l) => `${compOf(l)}|${l.birthYear}|${l.format}`;
const groupSort = (a, b) => (GROUP_ORDER[a.code] || 9) - (GROUP_ORDER[b.code] || 9);

/** Год или пара лет: «2014» или «2014–2015» (у КФК возрастные категории идут парами). */
const years = (l) => (l.birthYearTo ? `${l.birthYear}–${l.birthYearTo}` : String(l.birthYear));

/** 2016 у ФХМ идёт в двух турнирах (5х5 и 4х4) — различаем их в подписи, остальные возраста — просто год. */
export function ageLabel(l, all = S.leagues) {
  const both = all.some((x) => fedOf(x) === fedOf(l) && compOf(x) === compOf(l) && x.birthYear === l.birthYear && x.format !== l.format);
  return both ? `${years(l)} · ${l.format === "4x4" ? "4х4" : "5х5"}` : years(l);
}

/** Откуда группа, если это важно: у области подпись «Область», у Москвы без подписи (так было всегда). */
export function federationTag(l) {
  return fedOf(l) === "fhm" ? "" : (FEDERATIONS[fedOf(l)] && FEDERATIONS[fedOf(l)].short) || "";
}

/** Последняя выбранная группа каждой федерации запоминается: вернулись на вкладку — и вы в той же группе. */
function loadFed() {
  try {
    return JSON.parse(localStorage.getItem("tablo.fed") || "{}");
  } catch {
    return {};
  }
}
function saveFed(l) {
  try {
    localStorage.setItem("tablo.fed", JSON.stringify({ ...loadFed(), [fedOf(l)]: l.id }));
  } catch {
    /* хранилище может быть недоступно — не страшно */
  }
}

/**
 * Многоярусный выбор: федерация (вкладки «Москва» и «Область»), соревнование (если их несколько),
 * возраст и группа. Лишние ряды не показываются: у Москвы одно соревнование, у соревнования без деления
 * на группы нет ряда групп. onChange получает id группы. Выбор запоминается на устройстве.
 */
export function leaguePicker({ leagues = S.leagues, current = S.leagueId, onChange }) {
  const cur = leagues.find((l) => l.id === current) || leagues[0];
  if (!cur) return h("div");

  const feds = [...new Set(leagues.map(fedOf))].sort((a, b) => ((FEDERATIONS[a] && FEDERATIONS[a].order) || 9) - ((FEDERATIONS[b] && FEDERATIONS[b].order) || 9));
  const inFed = leagues.filter((l) => fedOf(l) === fedOf(cur));
  const comps = [...new Set(inFed.map(compOf))].sort((a, b) => (COMP_ORDER[a] ?? 9) - (COMP_ORDER[b] ?? 9));
  const inComp = inFed.filter((l) => compOf(l) === compOf(cur));
  const ages = [];
  for (const l of inComp) if (!ages.some((a) => ageKey(a) === ageKey(l))) ages.push(l);
  ages.sort((a, b) => b.birthYear - a.birthYear || (a.format < b.format ? 1 : -1));
  const groups = inComp.filter((l) => ageKey(l) === ageKey(cur)).sort(groupSort);

  const pick = (l) => {
    S.leagueId = l.id;
    saveChoice();
    saveFed(l);
    onChange(l.id);
  };
  const firstOf = (list) => [...list].sort(groupSort)[0];
  const pressed = (on) => ({ type: "button", "aria-pressed": String(on) });

  return h(
    "div",
    {},
    feds.length > 1
      ? h("div", { class: "segs fed", role: "group", "aria-label": "Федерация" },
          feds.map((f) => h("button", {
            ...pressed(f === fedOf(cur)),
            onclick: () => {
              if (f === fedOf(cur)) return;
              const mine = leagues.filter((l) => fedOf(l) === f);
              const remembered = mine.find((l) => l.id === loadFed()[f]);
              const base = [...mine].sort((a, b) => (COMP_ORDER[compOf(a)] ?? 9) - (COMP_ORDER[compOf(b)] ?? 9) || b.birthYear - a.birthYear)[0];
              pick(remembered || firstOf(mine.filter((l) => compOf(l) === compOf(base) && ageKey(l) === ageKey(base))));
            },
          }, (FEDERATIONS[f] && FEDERATIONS[f].title) || f)))
      : null,
    comps.length > 1
      ? h("div", { class: "gsw", role: "group", "aria-label": "Соревнование" },
          comps.map((c) => h("button", {
            ...pressed(c === compOf(cur)),
            onclick: () => {
              if (c === compOf(cur)) return;
              const mine = inFed.filter((l) => compOf(l) === c);
              // тот же год рождения, если он есть в другом соревновании, иначе первый возраст
              const same = mine.filter((l) => l.birthYear === cur.birthYear);
              pick(firstOf(same.length ? same : mine.filter((l) => ageKey(l) === ageKey(mine[0]))));
            },
          }, COMP_SHORT[c] || c)))
      : null,
    h("div", { class: "gsw", role: "group", "aria-label": "Возраст" },
      ages.map((a) => h("button", {
        ...pressed(ageKey(a) === ageKey(cur)),
        onclick: () => pick(firstOf(inComp.filter((l) => ageKey(l) === ageKey(a)))),
      }, ageLabel(a, leagues)))),
    groups.length > 1
      ? h("div", { class: "gsw sub2", role: "group", "aria-label": "Группа" },
          groups.map((g) => h("button", { ...pressed(g.id === cur.id), onclick: () => pick(g) }, g.groupTitle)))
      : null,
  );
}

export function leagueHead(l = league()) {
  if (!l) return null;
  const where = fedOf(l) === "fhm" ? "" : `${COMP_SHORT[compOf(l)] || ""} · `;
  const group = l.code === "ALL" ? "общая таблица" : l.groupTitle;
  return h("div", { class: "lghead" },
    h("b", {}, `${where}${ageLabel(l)} · ${l.comp ? l.comp + ", " : ""}${group}`),
    h("span", {}, `${l.teamCount} команд · формат ${l.format === "4x4" ? "4х4, ничьи возможны, счёт десятками" : "5х5, овертайм и буллиты"}`));
}

/** Выбор среди групп своих команд — компактные чипы «2015 · Группа Б», у области с пометкой «Область». Если группа одна, показывать нечего. */
export function groupChips({ leagueIds, current, onPick }) {
  const ls = leagueIds.map((id) => S.leagues.find((l) => l.id === id)).filter(Boolean);
  if (ls.length < 2) return null;
  return h("div", { class: "gsw", role: "group", "aria-label": "Группа" },
    ls.map((l) => h("button", { type: "button", "aria-pressed": String(l.id === current), onclick: () => onPick(l.id) },
      [federationTag(l), ageLabel(l, S.leagues), l.code === "ALL" ? "" : l.groupTitle].filter(Boolean).join(" · "))));
}
