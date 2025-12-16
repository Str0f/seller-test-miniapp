export function getTelegram() {
    if (typeof window === "undefined") return null;
    if (!window.Telegram) return null;
    if (!window.Telegram.WebApp) return null;
    return window.Telegram.WebApp;
  }
  
  export function initTelegram() {
    const tg = getTelegram();
    if (!tg) return null;
  
    tg.ready();
    tg.expand();
  
    return tg;
  }
  