import { h } from "./dom.js";
import { S, setRemind, toast } from "./state.js";

/**
 * Карточка с вопросом про напоминания для тех, кого ещё не спрашивали (зарегистрировались до появления напоминаний).
 * Пока человек не ответил, бот ему про матчи не пишет. Ответ можно изменить в «Мои команды».
 */
export function remindTile() {
  if (!S.me || S.me.remind !== null || !S.me.profileDone) return null;
  const answer = async (on, buttons) => {
    for (const b of buttons) b.disabled = true;
    const value = await setRemind(on);
    toast(value ? "Хорошо, напомним за 2 дня до матча." : on ? "Телеграм не разрешил боту писать вам, напоминаний не будет." : "Хорошо, не напоминаем. Таблицы и результаты всегда здесь.");
    S.render();
  };
  const yes = h("button", { type: "button", class: "cta small" }, "Да, напоминайте");
  const no = h("button", { type: "button", class: "cta ghost small" }, "Нет, я просто смотрю");
  yes.addEventListener("click", () => answer(true, [yes, no]));
  no.addEventListener("click", () => answer(false, [yes, no]));
  return h("div", { class: "tile" },
    h("div", { class: "stitle" }, "Напоминания о матчах"),
    h("p", { class: "lede" }, "Напомнить вам о матчах ваших команд за 2 дня до игры? Бот пришлёт сообщение, если вы ещё не сделали бросок. Если откажетесь, будете просто смотреть таблицы и результаты."),
    h("div", { class: "segs" }, yes, no));
}

/** Переключатель в «Мои команды». */
export function remindToggle() {
  return h("label", { class: "check" },
    h("input", { type: "checkbox", checked: !!(S.me && S.me.remind),
      onchange: async (e) => { const el = e.target; el.disabled = true; el.checked = await setRemind(el.checked); el.disabled = false; } }),
    h("span", {}, "Напоминать о матчах моих команд за 2 дня"));
}
