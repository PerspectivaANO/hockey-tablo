/*
 * Скрипт Телеграма (telegram-web-app.js) нужен только внутри Телеграма. На обычном сайте он ни к чему, а если telegram.org
 * недоступен, страница ждала бы его десятки секунд. Поэтому подключаем его только когда мы в Телеграме: в адресе есть
 * параметры запуска (tgWebApp…), они сохранены в сессии браузера, либо Телеграм назвался в User-Agent.
 * Модуль tg-wait.js (его импортирует api.js) ждёт window.__tgReady, поэтому приложение стартует уже с готовым Telegram.WebApp,
 * но не дольше 8 секунд, если telegram.org не отвечает.
 * Обычный (не модульный) скрипт: он должен выполниться до модулей приложения.
 */
(function () {
  var inTelegram = false;
  try {
    inTelegram = /tgWebApp/.test(location.hash) || !!sessionStorage.getItem("__telegram__initParams") || /Telegram/i.test(navigator.userAgent);
  } catch (e) {
    inTelegram = /tgWebApp/.test(location.hash);
  }
  window.__tgReady = Promise.resolve();
  if (!inTelegram) return;
  window.__tgReady = new Promise(function (resolve) {
    var s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
    setTimeout(resolve, 8000);
  });
})();
