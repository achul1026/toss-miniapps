import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  attachBanner,
  dayNumber,
  koreanDate,
  preloadRewarded,
  reminderSupported,
  requestDailyReminder,
  showRewarded,
  useScreens,
  WEEK,
  type Question,
} from 'daily-kit';
import { useApp } from './store';
import { PHRASES } from './data/phrases';
import { buildQuiz, buildReview } from './quiz';
import { canSpeak, speak } from './speech';

type Screen =
  | { name: 'home' }
  | { name: 'learn' }
  | { name: 'quiz'; questions: Question[]; review: boolean }
  | { name: 'result'; correct: number; total: number; review: boolean }
  | { name: 'records' };
type Go = (s: Screen) => void;

export default function App() {
  const { ready, init } = useApp();
  const [screen, go] = useScreens<Screen>({ name: 'home' });
  useEffect(() => {
    init();
  }, [init]);
  if (!ready) return <div className="page center">불러오는 중…</div>;
  switch (screen.name) {
    case 'home':
      return <Home go={go} />;
    case 'learn':
      return <Learn go={go} />;
    case 'quiz':
      return <Quiz key={String(screen.review)} questions={screen.questions} review={screen.review} go={go} />;
    case 'result':
      return <Result {...screen} go={go} />;
    case 'records':
      return <Records />;
  }
}

function Listen({ text, label = '듣기' }: { text: string; label?: string }) {
  const [slow, setSlow] = useState(false);
  if (!canSpeak()) return null;
  return (
    <button
      className="listen"
      onClick={() => {
        speak(text, slow);
        setSlow(!slow); // 두 번째 누르면 더 천천히
      }}
      aria-label={`${label}: ${text}`}
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
        <path d="M13 7q2 3 0 6M15.5 5q4 5 0 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      {slow ? '천천히 듣기' : label}
    </button>
  );
}

// 여권 입국 도장
function Stamp({ date, press = false }: { date: string; press?: boolean }) {
  return (
    <div className={`stamp${press ? ' stamp-press' : ''}`} role="img" aria-label="오늘 공부를 마쳤다는 도장">
      <span className="stamp-top">하루 한마디</span>
      <span className="stamp-mid">통과</span>
      <span className="stamp-date">{date.slice(5).replace('-', '.')}</span>
    </div>
  );
}

function Home({ go }: { go: Go }) {
  const { item, saved, today, streakNow } = useApp();
  const done = saved.lastDoneDate === today;
  const streak = streakNow();
  return (
    <div className="page">
      <p className="date">{koreanDate(today)}</p>
      <section className="pass" aria-label="오늘의 영어 한마디">
        <div className="pass-head">
          <span>오늘의 한마디</span>
          <span>DAY {saved.learned.length + (done ? 0 : 1)}</span>
        </div>
        <div className="pass-body">
          <p className="pass-when">{item.when}</p>
          <p className="pass-en" lang="en">
            {item.en}
          </p>
          <p className="pass-ko">{done ? item.ko : '무슨 뜻일까요?'}</p>
          {done && <Stamp date={today} />}
        </div>
        <div className="pass-stub">
          <span>{streak > 0 ? `${streak}일째 이어서 배우는 중` : '하루 1분, 한 문장씩'}</span>
        </div>
      </section>
      <button className="primary" onClick={() => go({ name: 'learn' })}>
        {done ? '오늘 배운 표현 다시 보기' : '뜻 보고 배우기'}
      </button>
      <button className="quiet" onClick={() => go({ name: 'records' })}>
        지난 기록 보기
      </button>
    </div>
  );
}

function Learn({ go }: { go: Go }) {
  const { item, today } = useApp();
  const banner = useRef<HTMLDivElement>(null);
  const [bannerEmpty, setBannerEmpty] = useState(false);
  useEffect(() => (banner.current ? attachBanner(banner.current, () => setBannerEmpty(true)) : undefined), []);
  const questions = useMemo(() => buildQuiz(item, PHRASES, dayNumber(today)), [item, today]);
  return (
    <div className="page">
      <header className="learn-head">
        <p className="learn-en" lang="en">
          {item.en}
        </p>
        <p className="learn-say">{item.say}</p>
        <p className="learn-ko">{item.ko}</p>
        <Listen text={item.en} />
      </header>
      <section className="section">
        <h2>이럴 때 써요</h2>
        <p>{item.when}</p>
      </section>
      <section className="section">
        <h2>이렇게 주고받아요</h2>
        <div className="talk">
          <div className="bubble me">
            <p lang="en">{item.en}</p>
            <p className="bubble-ko">{item.ko}</p>
          </div>
          <div className="bubble you">
            <p lang="en">{item.reply[0]}</p>
            <p className="bubble-ko">{item.reply[1]}</p>
            <Listen text={item.reply[0]} label="대답 듣기" />
          </div>
        </div>
      </section>
      {!bannerEmpty && <div ref={banner} className="banner" aria-label="광고" />}
      <button className="primary" onClick={() => go({ name: 'quiz', questions, review: false })}>
        퀴즈 3문제 풀기
      </button>
    </div>
  );
}

function Quiz({ questions, review, go }: { questions: Question[]; review: boolean; go: Go }) {
  const { finishToday } = useApp();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const q = questions[i];
  const choose = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    if (n === q.answer) setCorrect((c) => c + 1);
    else setWrong((w) => [...w, q.itemId]);
  };
  const next = async () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    if (!review) await finishToday(correct, wrong);
    go({ name: 'result', correct, total: questions.length, review });
  };
  const enOptions = q.kind !== 'meaning';
  return (
    <div className="page">
      <div className="progress" aria-label={`${questions.length}문제 중 ${i + 1}번째`}>
        {questions.map((_, k) => (
          <span key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <h1 className="prompt">{q.prompt}</h1>
      {q.sub && (
        <p className="given" lang="en">
          {q.sub}
        </p>
      )}
      <div className="options">
        {q.options.map((o, n) => {
          const state = picked === null ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : 'dim';
          return (
            <button key={n} className={`option ${enOptions ? 'opt-en ' : ''}${state}`} lang={enOptions ? 'en' : undefined} onClick={() => choose(n)} aria-pressed={picked === n}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <div className={picked === q.answer ? 'feedback ok' : 'feedback no'} role="status">
            <p className="feedback-title">{picked === q.answer ? '맞았어요' : `정답: ${q.options[q.answer]}`}</p>
            {q.explain && <p>{q.explain}</p>}
          </div>
          <button className="primary" onClick={next}>
            {i + 1 < questions.length ? '다음 문제' : '결과 보기'}
          </button>
        </>
      )}
    </div>
  );
}

function Result({ correct, total, review, go }: { correct: number; total: number; review: boolean; go: Go }) {
  const { saved, today, streakNow, setReminder } = useApp();
  const [adReady, setAdReady] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const learned = PHRASES.filter((p) => saved.learned.includes(p.id));
  const offerBonus = !review && learned.length >= 2;
  const [askReminder, setAskReminder] = useState(!review && saved.reminder === null && reminderSupported());
  useEffect(() => (offerBonus ? preloadRewarded(setAdReady) : undefined), [offerBonus]);
  const bonus = async () => {
    setAdBusy(true);
    const ok = await showRewarded();
    setAdBusy(false);
    if (ok) go({ name: 'quiz', questions: buildReview(learned, PHRASES, dayNumber(today) + 7), review: true });
  };
  return (
    <div className="page">
      <div className="result">
        {!review && <Stamp date={today} press />}
        <p className="score">
          {total}문제 중 {correct}문제 맞혔어요
        </p>
        {!review && <p className="note">{streakNow()}일째 도장을 찍었어요. 내일 또 만나요.</p>}
      </div>
      {askReminder && (
        <section className="reminder">
          <p className="reminder-title">내일 아침 8시에 알려드릴까요?</p>
          <p className="reminder-body">오늘의 영어 한마디가 도착하면 토스 알림으로 알려드려요.</p>
          <button
            className="quiet"
            onClick={async () => {
              const r = await requestDailyReminder();
              if (r !== 'unsupported') await setReminder(r);
              setAskReminder(false);
            }}
          >
            매일 아침 알림 받기
          </button>
        </section>
      )}
      {offerBonus && adReady && (
        <button className="quiet" disabled={adBusy} onClick={bonus}>
          {adBusy ? '광고를 보여주고 있어요' : '광고 보고 복습 3문제 더 풀기'}
        </button>
      )}
      <button className="primary" onClick={() => go({ name: 'home' })}>
        처음으로
      </button>
    </div>
  );
}

function Records() {
  const { saved, today, clearWrong } = useApp();
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const end = addDays(today, 6 - dow);
  const days = Array.from({ length: 28 }, (_, k) => addDays(end, k - 27));
  const wrong = PHRASES.filter((p) => saved.wrong.includes(p.id));
  return (
    <div className="page">
      <h1 className="h2">도장 찍은 날</h1>
      <div className="weekdays" aria-hidden="true">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="calendar">
        {days.map((d) => {
          const done = saved.doneDates.includes(d);
          return (
            <div key={d} className={`day${done ? ' done' : ''}${d === today ? ' today' : ''}`} aria-label={`${koreanDate(d)}${done ? ', 공부함' : ''}`}>
              {d > today ? '' : Number(d.slice(8))}
            </div>
          );
        })}
      </div>
      <p className="empty">가장 길게 이어간 기록은 {saved.bestStreak}일이에요.</p>
      <h2 className="h2">다시 볼 표현</h2>
      {wrong.length === 0 ? (
        <p className="empty">틀린 문제가 생기면 여기에 모아 둘게요.</p>
      ) : (
        <ul className="wrong-list">
          {wrong.map((p) => (
            <li className="wrong-row" key={p.id}>
              <div>
                <span className="w" lang="en">
                  {p.en}
                </span>
                <p>
                  {p.ko} · {p.say}
                </p>
              </div>
              <button className="small" onClick={() => clearWrong(p.id)}>
                외웠어요
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
