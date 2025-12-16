import { initTelegram, getTelegram } from "./telegram";

import { useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";
import data from "./data/test.v1.json";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Считает суммарные баллы по типам, и возвращает профиль:
 * - primary (обязателен)
 * - secondary (если >= 30% от primary)
 */
function computeProfile(testData, answersByQid) {
  const typeKeys = Object.keys(testData.types);

  // init scores
  const scores = {};
  for (const k of typeKeys) scores[k] = 0;

  // accumulate weights
  for (const q of testData.questions) {
    const pickedId = answersByQid[q.id];
    if (!pickedId) continue;

    const answer = q.answers.find((a) => a.id === pickedId);
    if (!answer) continue;

    const weights = answer.weights || {};
    for (const [k, v] of Object.entries(weights)) {
      if (scores[k] == null) scores[k] = 0;
      scores[k] += Number(v) || 0;
    }
  }

  // sort by score desc
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const [primaryKey, primaryScoreRaw] = sorted[0] || [null, 0];
  const [secondaryKey, secondaryScoreRaw] = sorted[1] || [null, 0];

  const primaryScore = Number(primaryScoreRaw) || 0;
  const secondaryScore = Number(secondaryScoreRaw) || 0;

  const secondaryOk = primaryScore > 0 && secondaryScore / primaryScore >= 0.3;

  // percent for UI
  const total = sorted.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 1;
  const pct = (v) => Math.round((Number(v) || 0) / total * 100);

  return {
    scores,
    sorted,
    primary: primaryKey
      ? { key: primaryKey, score: primaryScore, pct: pct(primaryScore), meta: testData.types[primaryKey] }
      : null,
    secondary: secondaryOk && secondaryKey
      ? { key: secondaryKey, score: secondaryScore, pct: pct(secondaryScore), meta: testData.types[secondaryKey] }
      : null
  };
}

export default function App() {
  const questions = data.questions;
  const total = questions.length;

  const [step, setStep] = useState(0); // 0..total, где total = экран результата
  const [answersByQid, setAnswersByQid] = useState({}); // { [qid]: answerId }
  const [micro, setMicro] = useState(null);
  const [isTelegram, setIsTelegram] = useState(false);




  useEffect(() => {
    const tg = initTelegram();
  
    if (tg && tg.initDataUnsafe?.user) {
      setIsTelegram(true);
      console.log("Telegram user:", tg.initDataUnsafe.user);
      console.log("Platform:", tg.platform);
    } else {
      setIsTelegram(false);
      console.log("Not in Telegram");
    }
  }, []);
  


  
      
    

  const isResult = step >= total;
  console.log("STATE", { step, total, isResult });

  const q = !isResult ? questions[step] : null;

  const selectedId = !isResult && q ? (answersByQid[q.id] ?? null) : null;

  const selectedAnswer = useMemo(() => {
    if (!q || !selectedId) return null;
    return q.answers.find((a) => a.id === selectedId) || null;
  }, [q, selectedId]);

  const profile = useMemo(() => computeProfile(data, answersByQid), [answersByQid]);


  function pickMicroByWeights(weights) {
    if (!weights) return null;
  
    // берём тип с максимальным весом в выбранном ответе
    const entries = Object.entries(weights);
    entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
    const topType = entries[0]?.[0];
    if (!topType) return null;
  
    const list = data.microFeedback?.[topType];
    if (!list || list.length === 0) return null;
  
    return list[Math.floor(Math.random() * list.length)];
  }
  

  function selectAnswer(answerId) {
    const answer = q.answers.find((a) => a.id === answerId);
    const msg = pickMicroByWeights(answer?.weights);
  
    setAnswersByQid((prev) => ({ ...prev, [q.id]: answerId }));
  
    if (msg) {
      setMicro(msg);
      window.clearTimeout(selectAnswer._t);
      selectAnswer._t = window.setTimeout(() => setMicro(null), 900);
    }
  }
  

  function buildShareText() {
    const typeName = p?.meta?.name || p?.key || "Мой тип";
    const disc = p?.meta?.disc?.code ? `${p.meta.disc.code} - ${p.meta.disc.label}` : "";
    const jung = p?.meta?.jung?.label || "";
    const archetype = p?.meta?.archetype || "";
    const second = s ? `\nВторичный вектор: ${s.meta?.name || s.key} (${s.pct}%)` : "";
  
    const title = `Мой тип селлера: ${typeName}`;
    const meta = [disc, jung, archetype].filter(Boolean).join(" | ");
  
    return `${title}\n${meta}${second}\n\nПройди тест: ${window.location.origin}`;
  }
  


  async function shareResult() {
    const text = buildShareText();
  
    const tg = getTelegram?.() || null; // если у тебя есть getTelegram
    // если getTelegram нет — ниже дам вариант без него
  
    if (tg) {
      // Откроем "поделиться" через ссылку на Telegram share
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
      tg.openTelegramLink(url);
      return;
    }
  
    // fallback для браузера
    try {
      await navigator.clipboard.writeText(text);
      alert("Скопировано. Вставь в Telegram и отправь.");
    } catch {
      prompt("Скопируй текст и отправь:", text);
    }
  }
  





  function next() {
    if (!q) return;
    if (!selectedId) return;
    setStep((s) => clamp(s + 1, 0, total));
  }
  useEffect(() => {
    if (isResult) return; // на экране результата не обрабатываем
  
    function onKeyDown(e) {
      // не мешаем, если пользователь печатает в инпуте (на будущее)
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (isTyping) return;
  
      // 1-4: выбор вариантов
      if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        const answer = q?.answers?.[idx];
        if (answer) {
          e.preventDefault();
          selectAnswer(answer.id);
        }
        return;
      }
  
      // Enter: Далее/Завершить
      if (e.key === "Enter") {
        if (!selectedId) return;
        e.preventDefault();
        next();
      }
    }
  
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isResult, q, selectedId]); // зависимости важны
  

  function restart() {
    setStep(0);
    setAnswersByQid({});
  }

  // ---------------- RESULT SCREEN ----------------
  if (isResult) {
    const p = profile.primary;
    const s = profile.secondary;

    return (
      <div className={styles.container}>
       <div className={styles.progress}>Результат</div>


       <div className={styles.hero}>
  <div className={styles.heroTop}>
    <div className={styles.heroMedia}>
      <img
        className={styles.typeImg}
        src={p?.meta?.image || "/types/a.webp"}
        alt={p?.meta?.name || "type"}
      />

      <div>
        <h1 className={styles.heroTitle}>
          Ты - {p?.meta?.name || p?.key || "Не определено"}
        </h1>

        <div className={styles.heroSub}>
          {s
            ? `Вторичный вектор: ${s.meta?.name || s.key} (${s.pct}%)`
            : "Профиль выражен чётко: один основной вектор."}
        </div>

        <div className={styles.badges}>
          <span className={styles.badge}>
            <span className={styles.badgeKey}>DISC</span>
            <span className={styles.badgeValue}>
              {p?.meta?.disc?.code || "-"} - {p?.meta?.disc?.label || ""}
            </span>
          </span>

          <span className={styles.badge}>
            <span className={styles.badgeKey}>Юнг</span>
            <span className={styles.badgeValue}>{p?.meta?.jung?.label || "-"}</span>
          </span>

          <span className={styles.badge}>
            <span className={styles.badgeKey}>Архетип</span>
            <span className={styles.badgeValue}>{p?.meta?.archetype || "-"}</span>
          </span>

          {s && (
            <span className={`${styles.badge} ${styles.secondaryBadge}`}>
              <span className={styles.badgeKey}>+ вторичный</span>
              <span className={styles.badgeValue}>{s.meta?.name || s.key}</span>
            </span>
          )}
        </div>
      </div>
    </div>

              <div className={styles.actions}>
                {isTelegram && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={shareResult}
                  >
                    Поделиться
                  </button>
                )}

                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={restart}
                >
                  Пройти заново
                </button>
              </div>


  </div>
</div>


 

        {s && (
  <div className={styles.card}>
    <div className={styles.cardTitle}>Вторичный вектор</div>

    <div className={styles.secondaryLine}>
      Добавляет:{" "}
      <b>{p?.meta?.result?.secondaryMix?.[s.key]?.adds || "-"}</b>
    </div>

    <div className={styles.secondaryLine}>
      Риск:{" "}
      <b>{p?.meta?.result?.secondaryMix?.[s.key]?.risk || "-"}</b>
    </div>
  </div>
)}


        <div className={styles.card}>
          <div className={styles.cardTitle}>Научный стержень</div>


                                <div className={styles.cardGrid}>
                    <div>
                        DISC: <b>{p?.meta?.disc?.code || "-"}</b> — {p?.meta?.disc?.label || ""}
                        <div className={styles.discHint}>{p?.meta?.disc?.hint || ""}</div>
                    </div>

                    <div>
                        Юнг: <b>{p?.meta?.jung?.label || "-"}</b>
                        <div className={styles.jungHint}>{p?.meta?.jung?.hint || ""}</div>
                    </div>

                    <div>
                        Архетип: <b>{p?.meta?.archetype || "-"}</b>
                    </div>
                    </div>


        </div>

        <div className={styles.card}>
  <div className={styles.cardTitle}>Сильные стороны</div>
  <ul className={styles.list}>
    {(p?.meta?.result?.strengths || []).map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ul>

  <div className={styles.cardTitle} style={{ marginTop: 14 }}>Ловушки</div>
  <ul className={styles.list}>
    {(p?.meta?.result?.traps || []).map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ul>
</div>
<div className={styles.card}>
  <div className={styles.cardTitle}>Как расти</div>
  <ol className={styles.listOl}>
    {(p?.meta?.result?.growth || []).map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ol>
</div>



<details className={styles.card}>
  <summary className={styles.detailsSummary}>Баллы (подробно)</summary>

  <div className={styles.scoreList} style={{ marginTop: 12 }}>
    {profile.sorted.map(([k, v]) => (
      <div key={k} className={styles.scoreRow}>
        <div className={styles.scoreName}>{data.types[k]?.name || k}</div>
        <div className={styles.scoreValue}>{v}</div>
      </div>
    ))}
  </div>
</details>


        
      </div>
    );
  }

  // ---------------- QUESTION SCREEN ----------------
  const isLast = step === total - 1;

  return (
    <div className={styles.container}>
<div className={styles.progressDots} aria-label={`Вопрос ${step + 1} из ${total}`}>
  {Array.from({ length: total }).map((_, i) => {
    const isDone = i < step;
    const isActive = i === step;
    const cls = `${styles.dot} ${isActive ? styles.dotActive : ""} ${isDone ? styles.dotDone : ""}`;
    return <span key={i} className={cls} />;
  })}
</div>

      <h1 className={styles.title}>{q.title}</h1>
      <p className={styles.prompt}>{q.prompt}</p>

      <div className={styles.answers}>
        {q.answers.map((a) => {
          const active = a.id === selectedId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => selectAnswer(a.id)}
              className={`${styles.option} ${active ? styles.optionActive : ""}`}
            >
              {a.text}
            </button>
          );
        })}
      </div>

            <div className={styles.footer}>
            <button
    type="button"
    className={styles.primaryBtn}
    disabled={!selectedId}
    onClick={next}
  >
    {isLast ? "Завершить" : "Далее"}
  </button>

  <div className={styles.selection}>
            <div className={styles.hint}>
            {selectedAnswer ? `Выбрано: "${selectedAnswer.text}"` : "Выбери вариант, чтобы продолжить"}
            <div className={styles.kbdHint}>
                Горячие клавиши: 1-4 - выбор, Enter - далее
            </div>
            </div>


            <div className={styles.microSlot}>
                {micro ? <div className={styles.micro}>{micro}</div> : null}
            </div>

  </div>
</div>

    </div>
  );
}
