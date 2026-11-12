const WORD = ["Т", "А", "Б", "Л", "О"];
const FLIP_MS = 106; // на 20% медленнее прежних 85 мс
const STAGGER_MS = 112;

/**
 * Что показывает плитка, пока табло «листает»: счёт вроде «12:05». Две плитки слева и две справа —
 * цифры, средняя (на месте «Б») — двоеточие. Первая цифра каждой пары без нуля: вместо «0» тёмная
 * пустая плитка, как на настоящем табло («1:05», а не «01:05»). Каждое из двух чисел не больше
 * MAX_SCORE: плитки листаются по очереди, поэтому новая цифра выбирается с оглядкой на соседнюю
 * («45» или «89» не появятся ни на одном кадре).
 */
const MAX_SCORE = 25;
const MAX_TENS = Math.floor(MAX_SCORE / 10);
const MAX_UNITS_AT_TOP = MAX_SCORE % 10;

export function makeScore() {
  const digit = [0, 0, 0, 0, 0]; // что показывает каждая плитка сейчас (двоеточие в счёт не входит)
  return (i) => {
    if (i === 2) return ":";
    const tens = i === 0 || i === 3;
    const max = tens
      ? (digit[i + 1] > MAX_UNITS_AT_TOP ? MAX_TENS - 1 : MAX_TENS)
      : (digit[i - 1] === MAX_TENS ? MAX_UNITS_AT_TOP : 9);
    const d = Math.floor(Math.random() * (max + 1));
    digit[i] = d;
    return tens && d === 0 ? "" : String(d);
  };
}
/** Как часто табло оживает, пока приложение открыто. */
export const REPLAY_MS = 5000;

let running = false;

/**
 * Табло «перебирает» счёт (цифры и двоеточие) и останавливается на слове, как настоящее спортивное. Запускается, когда
 * приложение показано пользователю (после загрузки, при возвращении в приложение и по нажатию на
 * логотип), а не при разборе страницы: в Телеграме окно ещё выезжает, и анимация, начатая сразу,
 * заканчивалась бы до того, как её видно. При включённом «уменьшении движения» в системе не играет.
 */
export function playLogo() {
  if (running || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const tiles = [...document.querySelectorAll(".flaps .flap")];
  if (tiles.length !== WORD.length) return;
  running = true;
  let left = tiles.length;
  const score = makeScore();
  tiles.forEach((el, i) => {
    const steps = 5 + i * 2;
    let n = 0;
    setTimeout(() => {
      const id = setInterval(() => {
        n++;
        const last = n > steps;
        el.textContent = last ? WORD[i] : score(i);
        el.classList.remove("tick");
        void el.offsetWidth; // перезапуск CSS-анимации перекидывания
        el.classList.add("tick");
        if (last) {
          clearInterval(id);
          if (--left === 0) running = false;
        }
      }, FLIP_MS);
    }, i * STAGGER_MS);
  });
  // Страховка: что бы ни случилось, слово «ТАБЛО» должно остаться на месте.
  setTimeout(() => {
    tiles.forEach((el, i) => { el.textContent = WORD[i]; });
    running = false;
  }, 3600);
}

export function initLogo(telegram) {
  const logo = document.querySelector(".flaps");
  if (logo) logo.addEventListener("click", playLogo);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) playLogo(); });
  // Каждые 5 секунд, пока приложение на экране; в фоне не тратим заряд.
  setInterval(() => { if (!document.hidden) playLogo(); }, REPLAY_MS);
  if (telegram && telegram.onEvent) {
    telegram.onEvent("activated", playLogo);
    telegram.onEvent("viewportChanged", (e) => { if (e && e.isStateStable) playLogo(); });
  }
}
