import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { clubKey, teamName, whenText, fmtMult, dayHeader, dayKey } from "./format.js";
import { SOURCE_NAME, shortOption } from "./labels.js";
import { leaguePicker, leagueHead } from "./picker.js";
import { S, countdown, league, myClubKeys, myTeamIds } from "./state.js";
import { dailyTile, inviteTile } from "./daily.js";
import { remindTile } from "./remind.js";
import { scoreLine } from "./scorepick.js";

let seq = 0;

const SCOPES = [["upcoming", "Ближайшие"], ["results", "Итоги предыдущего тура"]];

/** Карточка матча: команды, время, отсчёт до закрытия приёма, мои броски и итог. */
export function matchCard(m, lg, onOpen) {
  const home = teamName(m.home, lg.birthYear);
  const away = teamName(m.away, lg.birthYear);
  const mine = myTeamIds();
  const isMine = mine.has(m.homeId) || mine.has(m.awayId);
  // Одноклубники других возрастов: не «моя команда», но следить за ними тоже интересно — своя наклейка.
  const clubs = myClubKeys();
  const isClub = !isMine && (clubs.has(clubKey(m.home, lg.birthYear)) || clubs.has(clubKey(m.away, lg.birthYear)));
  const done = m.status === "finished" && m.score;
  // Матчи туров, которые ещё не открыты для бросков, не кликабельны вообще: тур откроется, когда отыграют текущий.
  const locked = m.status === "scheduled" && !m.roundOpen;
  // Давно должен был состояться, а итога нет: перенесён. Он остаётся первым в ленте и ждёт новой даты; бросить на него нельзя, пока даты нет.
  const postponed = m.status === "scheduled" && m.late !== null && m.late !== undefined && m.late >= 2;
  const open = !postponed && m.status === "scheduled" && m.roundOpen && m.options.length > 0 && Date.parse(m.closesAt) > Date.now() - 24 * 3600 * 1000;
  const homeWon = done && m.score.home > m.score.away;
  const awayWon = done && m.score.away > m.score.home;

  const tags = h("div", {},
    postponed ? h("span", { class: "tag late" }, "Перенесён") : null,
    m.isDerby ? h("span", { class: "tag" }, "Матч тура") : null,
    isMine ? h("span", { class: "tag mine" }, "Моя команда") : null,
    isClub ? h("span", { class: "tag club" }, "Наши ребята") : null,
    m.technical ? h("span", { class: "tag sens" }, "Тех. поражение") : null);

  const card = h(open ? "button" : "div",
    { type: open ? "button" : undefined, class: "match" + (m.isDerby ? " derby" : "") + (isMine ? " mine" : "") + (isClub ? " club" : "") + (open ? "" : " flat") + (locked ? " locked" : ""),
      onclick: open ? () => onOpen(m) : undefined },
    tags.childNodes.length ? tags : null,
    h("div", { class: "when" }, h("span", {}, whenText(m.startsAt, m.day)),
      postponed ? h("span", { class: "cd lock" }, "ждём новую дату")
        : locked ? h("span", { class: "cd lock" }, m.prevRound ? `откроется после тура ${m.prevRound}` : "пока закрыт") : countdown(m)),
    h("div", { class: "teams" },
      h("span", { class: "tn" + (done && !homeWon ? " lose" : "") }, home), h("span", { class: "sc" }, done ? m.score.home : ""),
      h("span", { class: "tn" + (done && !awayWon ? " lose" : "") }, away), h("span", { class: "sc" }, done ? m.score.away : "")),
    done && m.score.decidedBy && m.score.decidedBy !== "reg" && m.score.decidedBy !== "draw"
      ? h("span", { class: "sub" }, m.score.decidedBy === "ot" ? "после овертайма" : "по буллитам") : null,
    // Видно, на что именно брошено: «Победа: Богородский · 35 шайб, ×1,53»
    ...m.myBets.map((b) => {
      const what = shortOption(b.optionKey, home, away);
      return h("span", { class: "done" + (b.state === "lost" ? " miss" : "") },
        b.state === "won" ? `Угадали: ${what} · +${b.points} очков` :
        b.state === "lost" ? `Мимо: ${what} · ${b.stake} шайб` :
        b.state === "void" ? `Шайбы возвращены: ${what}` : `${what} · ${b.stake} шайб, ${fmtMult(b.mult)}`);
    }),
    scoreLine(m));
  return card;
}

const PAGE = 10;

/**
 * Лента матчей группы. «Ближайшие» — все предстоящие подряд по датам, как на сайте ФХМ:
 * у групп разные игровые недели (Первая и Вторая играют через неделю), поэтому
 * показывать одну календарную неделю нельзя — часть групп осталась бы без матчей.
 */
export async function renderHome(root) {
  const lg = league();
  const my = ++seq;
  if (S.scope !== "upcoming" && S.scope !== "results") S.scope = "upcoming";
  const list = h("div", {}, h("p", { class: "empty" }, "Загружаем матчи…"));
  const more = h("button", { type: "button", class: "cta ghost more", hidden: true }, "Показать ещё");
  mount(root, h("section", { class: "screen" },
    S.scope === "upcoming" ? [remindTile(), dailyTile(), inviteTile()] : null,
    leaguePicker({ onChange: () => renderHome(root) }),
    leagueHead(lg),
    h("div", { class: "segs", role: "group", "aria-label": "Матчи" },
      SCOPES.map(([k, t]) => h("button", { type: "button", "aria-pressed": String(S.scope === k),
        onclick: () => { S.scope = k; renderHome(root); } }, t))),
    list, more));
  if (!lg) return mount(list, h("p", { class: "empty" }, "Группы ещё не загружены. Загляните позже."));

  let offset = 0;
  let lastDay = null;
  let inPostponed = false;
  const open = (m) => { S.pick = { matchId: m.id }; S.render(); window.scrollTo(0, 0); };

  async function load() {
    more.disabled = true;
    const r = await api(`/api/board?leagueId=${lg.id}&scope=${S.scope}&limit=${PAGE}&offset=${offset}`);
    more.disabled = false;
    if (my !== seq) return;
    if (!r.ok) return mount(list, h("p", { class: "empty" }, (r.data && r.data.message) || "Не удалось загрузить матчи."));
    const { matches, hasMore } = r.data;
    if (offset === 0) list.replaceChildren();
    if (offset === 0 && matches.length === 0) {
      return mount(list, h("p", { class: "empty" }, S.scope === "results"
        ? "Сыгранных матчей в этой группе пока нет."
        : `Ближайших матчей в этой группе нет: календарь ${SOURCE_NAME[(league() && league().federation) || "fhm"] || "федерации"} пока пуст. Мы обновляем его каждые сутки.`));
    }
    for (const m of matches) {
      // Перенесённые матчи сервер отдаёт после ближайших: под одним заголовком, без разбивки по старым датам.
      const postponed = m.status === "scheduled" && m.late !== null && m.late !== undefined && m.late >= 2;
      if (postponed) {
        if (!inPostponed) {
          inPostponed = true;
          list.append(h("p", { class: "stitle day" }, h("span", {}, "Перенесённые матчи"), h("span", {}, "ждём новые даты")));
        }
        list.append(matchCard(m, lg, open));
        continue;
      }
      const key = dayKey(m.startsAt, m.day);
      if (key !== lastDay) {
        lastDay = key;
        list.append(h("p", { class: "stitle day" }, h("span", {}, dayHeader(m.startsAt, m.day)), // Номер тура — как в расписании федерации (у группы свой), а не наша календарная неделя: иначе у группы «6 тур» подпись говорила бы «тур 7».
        h("span", {}, m.round ? `тур ${m.round}` : "")));
      }
      list.append(matchCard(m, lg, open));
    }
    offset += matches.length;
    more.hidden = !hasMore;
  }
  more.addEventListener("click", load);
  void load();
}
