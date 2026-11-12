import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { teamName, whenText, fmtMult, pucks } from "./format.js";
import { STATE_TEXT, shortOption } from "./labels.js";
import { S, paintHeader, setNotify } from "./state.js";

/** Откуда матч: год, группа, федерация. Нужна, чтобы отличать матчи одних и тех же команд в разных возрастах. */
const whereOf = (x) => `${x.birthYear} г.р. · ${x.groupTitle} · ${x.federation === "fhmo" ? "Область" : x.federation === "cfo" ? "ЦФО" : "Москва"}`;

const PICK_STATE = { accepted: "ждём матч", void: "матч не состоялся" };
const pickWon = (p) => p.state === "done" && (p.puckBonus > 0 || p.points > 0);
const pickText = (p) => (p.state === "done"
  ? (p.puckBonus > 0 ? `точный счёт · +${p.puckBonus} шайб в банк тура` : p.points > 0 ? `верный исход · +${p.points} очков` : "мимо")
  : PICK_STATE[p.state] || p.state);
const rowClass = (state) => (state === "won" ? "won" : state === "lost" ? "lost" : state === "void" ? "void" : "");

/** Броски и прогнозы счёта, собранные по матчам: у матча видны год, группа и итоговый счёт; угаданное зелёным, неугаданное красным. */
function matchCards(bets, picks) {
  const cards = new Map();
  const card = (x) => {
    if (!cards.has(x.matchId)) cards.set(x.matchId, { x, bets: [], picks: [] });
    return cards.get(x.matchId);
  };
  for (const b of bets) card(b).bets.push(b);
  for (const p of picks) card(p).picks.push(p);
  const list = [...cards.values()].sort((a, b) => Date.parse(a.x.startsAt || 0) - Date.parse(b.x.startsAt || 0));
  return list.map(({ x, bets: bs, picks: ps }) => {
    const year = x.birthYear || 0;
    const home = teamName(x.home, year);
    const away = teamName(x.away, year);
    const score = x.homeGoals !== null && x.homeGoals !== undefined ? `${x.homeGoals}:${x.awayGoals}` : null;
    return h("div", { class: "mcard" },
      h("div", { class: "mhead" },
        h("div", { class: "mt" }, `${home} — ${away}`, score ? h("span", { class: "ms" }, score) : null),
        h("small", {}, whereOf(x)),
        h("small", {}, whenText(x.startsAt, x.startsAt))),
      bs.map((b) => h("div", { class: "bet " + rowClass(b.state) },
        h("span", { class: "bl" }, shortOption(b.optionKey, home, away),
          h("small", {}, `${STATE_TEXT[b.state] || b.state} · ${fmtMult(b.mult)}${b.state === "won" ? ` · +${b.points} очков` : b.state === "accepted" ? ` · до ${b.potentialPoints} очков` : ""}`)),
        h("span", {}), h("span", { class: "bs" }, b.stake), h("span", { class: "sub" }, "шайб"))),
      ps.map((p) => h("div", { class: "bet " + (p.state === "done" ? (pickWon(p) ? "won" : "lost") : p.state === "void" ? "void" : "") },
        h("span", { class: "bl" }, `Прогноз счёта ${p.pickHome}:${p.pickAway}`, h("small", {}, pickText(p))),
        h("span", {}), h("span", { class: "bs" }, ""), h("span", { class: "sub" }, "бесплатно"))));
  });
}

export async function renderMine(root) {
  const body = h("div", {}, h("p", { class: "empty" }, "Загружаем…"));
  mount(root, h("section", { class: "screen" }, h("p", { class: "stitle" }, h("span", {}, "Мои броски · этот тур")), body));
  const r = await api("/api/tour");
  if (!r.ok) return mount(body, h("p", { class: "empty" }, (r.data && r.data.message) || "Не удалось загрузить."));
  const { pucks: p, points, bets, picks, tour } = r.data;
  if (S.me) { S.me.pucks = p; paintHeader(); }
  const stat = (label, value) => h("div", { class: "tile" }, h("div", { class: "sub" }, label), h("div", { class: "big" }, value));
  mount(body,
    h("div", { class: "quad" },
      stat("Осталось шайб", p ? p.left : "—"),
      stat("Брошено", p ? p.spent : 0),
      stat("Очков за тур", points),
      stat("Тур", tour.number)),
    bets.length === 0 && (picks || []).length === 0
      ? h("p", { class: "empty" }, "В этом туре бросков пока нет. Откройте «Табло», выберите матч и вариант.")
      : h("div", { class: "tile" }, matchCards(bets, picks || [])),
    h("label", { class: "check" },
      h("input", { type: "checkbox", checked: !S.me || S.me.notify !== false,
        onchange: async (e) => { const el = e.target; el.disabled = true; el.checked = await setNotify(el.checked); el.disabled = false; } }),
      h("span", {}, "Присылать итоги бросков в Телеграм")),
    h("p", { class: "note" }, `Банк тура — ${p ? pucks(p.granted) : "ещё не выдан"}. В понедельник он обнуляется и выдаётся заново.`));
}
