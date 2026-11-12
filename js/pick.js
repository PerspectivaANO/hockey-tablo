import { api, uuid, serverNow } from "./api.js";
import { h, mount } from "./dom.js";
import { teamName, whenText, fmtMult, pct, pucks } from "./format.js";
import { marketsFor, shortOption } from "./labels.js";
import { S, askNotifyOnce, countdown, league, refreshMe, toast } from "./state.js";
import { historyBlock } from "./history.js";
import { scoreBlock } from "./scorepick.js";

const MIN = 10;
const STEP = 5;

/** Черновик броска: вариант → сколько шайб добавить. Отправляется кнопкой «Бросить». */
let draft = new Map();
let lastMatch = null;
let busy = false;
/** Блок «Прошлые игры» раскрыт? Помним, пока человек на этом матче. */
let histOpen = false;
/** Выбранный счёт для прогноза счёта; null — ещё не трогали (берётся сохранённый). */
let scoreDraft = null;

export async function renderPick(root) {
  const lg = league();
  const matchId = S.pick.matchId;
  if (lastMatch !== matchId) {
    draft = new Map();
    lastMatch = matchId;
    histOpen = false;
    scoreDraft = null;
  }
  mount(root, h("section", { class: "screen" }, h("p", { class: "empty" }, "Загружаем матч…")));
  const r = await api(`/api/match/${matchId}`);
  const m = r.ok ? r.data.match : null;
  if (!m) {
    toast("Матч не найден", true);
    S.pick = null;
    return S.render();
  }
  draw(root, m, lg, r.data.banks || {}, r.data.history || null);
}

function draw(root, m, lg, banks, history) {
  const home = teamName(m.home, lg.birthYear);
  const away = teamName(m.away, lg.birthYear);
  // Тур ещё не открыт для бросков: экран только показывает матч (сюда не попасть по кнопке, но ссылка могла устареть).
  const tourLocked = !m.roundOpen;
  const closed = tourLocked || Date.parse(m.closesAt) <= serverNow();
  const bets = new Map(m.myBets.map((b) => [b.optionKey, b]));
  const optByKey = new Map(m.options.map((o) => [o.key, o]));
  // Банк у каждого тура свой. Если у этого тура банка ещё нет, он будет выдан при первом броске: 100 шайб.
  const tourBank = banks[String(m.tour)];
  const left = tourBank ? tourBank.left : 100;
  const spendDraft = () => [...draft.values()].reduce((a, b) => a + b, 0);
  const bonus = 1 + Math.min(35, S.me.bonusPct || 0) / 100 + (m.isDerby ? 0.5 : 0);

  const redraw = () => draw(root, m, lg, banks, history);
  const existing = (k) => (bets.get(k) ? bets.get(k).stake : 0);

  function tap(key) {
    if (closed || busy) return;
    const o = optByKey.get(key);
    if (!o || !o.enabled) return toast("На этот вариант броски не принимаются: он слишком редкий.", true);
    const cur = draft.get(key) || 0;
    const base = existing(key);
    const next = cur === 0 ? (base > 0 ? STEP : MIN) : cur + STEP;
    if (base + next > o.maxStake) return toast(`На этот вариант больше ${o.maxStake} шайб бросить нельзя (множитель ${fmtMult(o.mult)}).`, true);
    if (spendDraft() - cur + next > left) return toast("Не хватает шайб на этот тур.", true);
    draft.set(key, next);
    redraw();
  }
  function step(key, dir) {
    const o = optByKey.get(key);
    const cur = draft.get(key) || 0;
    const base = existing(key);
    const next = cur + dir * STEP;
    const minAdd = base > 0 ? STEP : MIN;
    if (next < minAdd) draft.delete(key);
    else if (base + next > o.maxStake) return toast(`Предел для этого варианта — ${o.maxStake} шайб.`, true);
    else if (spendDraft() - cur + next > left) return toast("Не хватает шайб на этот тур.", true);
    else draft.set(key, next);
    redraw();
  }

  // Прогноз счёта: бесплатный, на матчи своих команд и на «Матч тура»
  const sd = scoreDraft || (m.scorePick ? { home: m.scorePick.home, away: m.scorePick.away } : { home: 0, away: 0 });
  async function saveScore() {
    if (busy) return;
    busy = true;
    redraw();
    const r = await api("/api/score-pick", { body: { matchId: m.id, home: sd.home, away: sd.away } });
    busy = false;
    if (!r.ok) {
      toast((r.data && r.data.message) || "Прогноз не принят.", true);
      return redraw();
    }
    toast(`Прогноз счёта ${sd.home}:${sd.away} принят.`);
    scoreDraft = null;
    void renderPick(root);
  }

  async function throwAll() {
    if (busy || draft.size === 0) return;
    busy = true;
    redraw();
    let ok = 0;
    let firstError = null;
    for (const [key, add] of [...draft]) {
      const r = await api("/api/bet", {
        body: { matchId: m.id, optionKey: key, stake: add },
        headers: { "Idempotency-Key": uuid() },
      });
      if (r.ok) {
        ok++;
        draft.delete(key);
      } else if (!firstError) firstError = (r.data && r.data.message) || "Бросок не принят.";
    }
    busy = false;
    await refreshMe();
    if (ok) toast(`Принято бросков: ${ok}.`);
    if (ok) void askNotifyOnce();
    if (firstError) toast(firstError, true);
    void renderPick(root);
  }

  // Рынок показывается целиком: если у варианта шанс ниже порога, он серый и недоступен.
  const markets = marketsFor(lg.format, home, away, m.line);

  const total = spendDraft();
  const potential = [...draft].reduce((a, [k, add]) => a + (existing(k) + add) * optByKey.get(k).mult * bonus, 0);

  mount(root, h("section", { class: "screen" },
    h("button", { type: "button", class: "cta ghost small back", onclick: () => { S.pick = null; S.render(); } }, "← Назад"),
    h("div", { class: "tile" },
      m.isDerby ? h("span", { class: "tag" }, "Матч тура · +50% очков") : null,
      h("div", { class: "sub" }, `${whenText(m.startsAt, m.day)}`),
      h("div", { class: "vs" }, h("b", {}, home), h("b", {}, away)),
      h("div", {}, countdown(m))),
    historyBlock({ history, m, year: lg.birthYear, open: histOpen, onToggle: () => { histOpen = !histOpen; redraw(); } }),
    tourLocked ? h("p", { class: "note" }, "Бросать на этот матч пока нельзя: его тур откроется, когда будет сыгран текущий.") : null,
    h("p", { class: "stitle" }, h("span", {}, "Шаг 1 · что предсказываете"), h("span", {}, m.tour ? `банк тура ${m.tour}: ${left}` : `в банке ${left}`)),
    markets.map((mk) => h("div", { class: "mkt" },
      h("p", {}, mk.title),
      h("div", { class: `opts c${mk.c}` }, mk.opts.map(([k, label]) => {
        const o = optByKey.get(k);
        const add = draft.get(k) || 0;
        const base = existing(k);
        if (!o || !o.enabled) {
          return h("button", { type: "button", class: "opt rare", disabled: true, "aria-label": `${label}: слишком редкий вариант` },
            h("span", { class: "lbl" }, label),
            h("span", { class: "mult" }, o ? fmtMult(o.mult) : "—"),
            h("span", { class: "pr" }, o ? `шанс ${pct(o.chance)}` : "почти невозможно"),
            h("span", { class: "pr" }, "слишком редкий"));
        }
        return h("button", { type: "button", class: "opt", "data-on": add || base ? "1" : "0", disabled: closed || busy,
          onclick: () => tap(k) },
          h("span", { class: "lbl" }, label),
          h("span", { class: "mult" }, fmtMult(o.mult)),
          h("span", { class: "pr" }, `шанс ${pct(o.chance)}`),
          base || add ? h("span", { class: "st" }, `${base}${add ? " +" + add : ""} шайб`) : null);
      })))),
    h("p", { class: "note" }, "Нажмите на вариант — в бросок попадёт 10 шайб, повторное нажатие добавляет ещё 5. Предел: 50 шайб при множителе до ×5, 25 до ×10 и 10 выше. Серые варианты случаются реже чем в 2,5% матчей — на них броски не принимаются. Приём закрывается за 15 минут до начала матча."),
    h("p", { class: "stitle" }, h("span", {}, "Шаг 2 · мой бросок"), h("span", {}, total ? `${pucks(total)}` : "")),
    h("div", { class: "tile" }, draft.size === 0 && bets.size === 0
      ? h("p", { class: "empty" }, "Выберите вариант выше.")
      : [
        ...[...bets].filter(([k]) => !draft.has(k)).map(([k, b]) => h("div", { class: "bet" },
          h("span", { class: "bl" }, shortOption(k, home, away), h("small", {}, `принят · ${fmtMult(b.mult)} · до ${b.potentialPoints} очков`)),
          h("span", {}), h("span", { class: "bs" }, b.stake), h("span", {}))),
        ...[...draft].map(([k, add]) => h("div", { class: "bet" },
          h("span", { class: "bl" }, shortOption(k, home, away), h("small", {}, `${existing(k) ? `было ${existing(k)}, ` : ""}${fmtMult(optByKey.get(k).mult)}`)),
          h("button", { type: "button", class: "step", "aria-label": "Меньше", onclick: () => step(k, -1) }, "−"),
          h("span", { class: "bs" }, existing(k) + add),
          h("button", { type: "button", class: "step", "aria-label": "Больше", onclick: () => step(k, 1) }, "+"))),
      ]),
    h("button", { type: "button", class: "cta", disabled: closed || busy || draft.size === 0, onclick: throwAll },
      tourLocked ? "Тур ещё не открыт" : closed ? "Закрыто" : busy ? "Отправляем…" : draft.size === 0 ? "Выберите вариант выше" : `Бросить ${pucks(total)}`),
    draft.size && !closed ? h("p", { class: "note" }, `Если угадаете — около ${Math.round(potential)} очков с учётом бонуса из вопроса дня${m.isDerby ? " и «Матча тура»" : ""}. Точное число посчитает сервер.`) : null,
    scoreBlock({ m, home, away, closed, draft: sd, busy, onChange: (v) => { scoreDraft = v; redraw(); }, onSave: saveScore })));
}
