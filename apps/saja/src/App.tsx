import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { IDIOMS } from './data/idioms';
import { buildQuiz, buildReview, type Question } from './lib/quiz';
import { dayNumber, addDays } from './lib/daily';
import { attachBanner, showRewardedAd } from './lib/platform';

type Screen =
  | { name: 'home' }
  | { name: 'learn' }
  | { name: 'quiz'; questions: Question[]; review: boolean }
  | { name: 'result'; correct: number; total: number; review: boolean }
  | { name: 'records' };

export default function App() {
  const { ready, init } = useApp();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  useEffect(() => {
    init();
  }, [init]);
  if (!ready) return <div className="page center">불러오는 중…</div>;
  switch (screen.name) {
    case 'home':
      return <Home go={setScreen} />;
    case 'learn':
      return <Learn go={setScreen} />;
    case 'quiz':
      return <Quiz key={String(screen.review)} questions={screen.questions} review={screen.review} go={setScreen} />;
    case 'result':
      return <Result {...screen} go={setScreen} />;
    case 'records':
      return <Records go={setScreen} />;
  }
}

type Go = (s: Screen) => void;

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function koreanDate(key: string) {
  const d = new Date(`${key}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK[d.getUTCDay()]}요일`;
}

// 낙관: 日新又新(날마다 새로워진다). 오른쪽 줄부터 위에서 아래로 읽는다.
function Seal({ large = false, press = false }: { large?: boolean; press?: boolean }) {
  return (
    <div className={`seal${large ? ' seal-lg' : ''}${press ? ' seal-press' : ''}`} role="img" aria-label="오늘 공부를 마쳤다는 도장">
      <span>日</span>
      <span>新</span>
      <span>又</span>
      <span>新</span>
    </div>
  );
}

function Home({ go }: { go: Go }) {
  const { idiom, saved, today, streakNow } = useApp();
  const doneToday = saved.lastDoneDate === today;
  const streak = streakNow();
  return (
    <div className="page">
      <p className="date">{koreanDate(today)}</p>
      <section className="scroll" aria-label="오늘의 사자성어">
        <div className="scroll-text">
          <p className="scroll-hangul">{idiom.hangul}</p>
          <p className="scroll-meaning">{doneToday ? idiom.meaning : '오늘은 어떤 뜻일까요?'}</p>
        </div>
        <p className="scroll-hanja" lang="zh-Hant">
          {idiom.hanja}
        </p>
        {doneToday && <Seal />}
      </section>
      <p className="status">
        {streak > 0 ? (
          <>
            <strong>{streak}일째</strong> 이어서 배우는 중이에요
          </>
        ) : (
          '오늘부터 하루 한 개씩 배워 봐요'
        )}
      </p>
      <button className="primary" onClick={() => go({ name: 'learn' })}>
        {doneToday ? '오늘 배운 내용 다시 보기' : '오늘 공부 시작하기'}
      </button>
      <button className="quiet" onClick={() => go({ name: 'records' })}>
        지난 기록 보기
      </button>
    </div>
  );
}

function Learn({ go }: { go: Go }) {
  const { idiom, today } = useApp();
  const questions = useMemo(() => buildQuiz(idiom, IDIOMS, dayNumber(today)), [idiom, today]);
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ‹ 처음으로
      </button>
      <header className="learn-head">
        <p className="learn-hanja" lang="zh-Hant">
          {idiom.hanja}
        </p>
        <p className="learn-hangul">{idiom.hangul}</p>
        <p className="learn-meaning">{idiom.meaning}</p>
      </header>
      <ul className="glyphs" aria-label="한 글자씩 풀이">
        {idiom.chars.map(([h, m], i) => (
          <li className="glyph" key={i}>
            <span className="glyph-h" lang="zh-Hant">
              {h}
            </span>
            <span className="glyph-m">{m}</span>
          </li>
        ))}
      </ul>
      <section className="section">
        <h2>어디서 온 말일까</h2>
        <p>{idiom.story}</p>
      </section>
      <section className="section">
        <h2>이렇게 써요</h2>
        <p className="example">
          {idiom.example.split('____')[0]}
          <b>{idiom.hangul}</b>
          {idiom.example.split('____')[1]}
        </p>
      </section>
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
    else setWrong((w) => [...w, q.idiomId]);
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

  const serifOptions = q.kind !== 'meaning';
  return (
    <div className="page">
      <div className="progress" aria-label={`${questions.length}문제 중 ${i + 1}번째`}>
        {questions.map((_, k) => (
          <span key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <h1 className="prompt">{q.prompt}</h1>
      {q.sub && <p className={q.kind === 'situation' ? 'given given-text' : 'given'}>{q.sub}</p>}
      <div className="options">
        {q.options.map((o, n) => {
          const state = picked === null ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : 'dim';
          return (
            <button key={n} className={`option ${serifOptions ? 'serif-opt ' : ''}${state}`} onClick={() => choose(n)} aria-pressed={picked === n}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <p className={picked === q.answer ? 'feedback ok' : 'feedback no'} role="status">
            {picked === q.answer ? '맞았어요' : `정답은 '${q.options[q.answer]}'예요`}
          </p>
          <button className="primary" onClick={next}>
            {i + 1 < questions.length ? '다음 문제' : '결과 보기'}
          </button>
        </>
      )}
    </div>
  );
}

function Result({ correct, total, review, go }: { correct: number; total: number; review: boolean; go: Go }) {
  const { saved, today, streakNow } = useApp();
  const banner = useRef<HTMLDivElement>(null);
  const [adBusy, setAdBusy] = useState(false);
  useEffect(() => (banner.current ? attachBanner(banner.current) : undefined), []);

  const learned = IDIOMS.filter((i) => saved.learned.includes(i.id));
  const bonus = async () => {
    setAdBusy(true);
    const ok = await showRewardedAd();
    setAdBusy(false);
    if (ok) go({ name: 'quiz', questions: buildReview(learned, IDIOMS, dayNumber(today) + 7), review: true });
  };

  return (
    <div className="page">
      <div className="result">
        {!review && <Seal large press />}
        <p className="score">
          {total}문제 중 {correct}문제 맞혔어요
        </p>
        {!review && <p className="note">{streakNow()}일째 도장을 찍었어요. 내일 또 만나요.</p>}
      </div>
      {!review && learned.length >= 2 && (
        <button className="quiet" disabled={adBusy} onClick={bonus}>
          {adBusy ? '광고를 불러오고 있어요' : '광고 보고 복습 3문제 더 풀기'}
        </button>
      )}
      <button className="primary" onClick={() => go({ name: 'home' })}>
        처음으로
      </button>
      <div ref={banner} className="banner" />
    </div>
  );
}

function Records({ go }: { go: Go }) {
  const { saved, today, clearWrong } = useApp();
  // 오늘이 속한 주의 토요일까지, 4주
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const end = addDays(today, 6 - dow);
  const days = Array.from({ length: 28 }, (_, k) => addDays(end, k - 27));
  const wrong = IDIOMS.filter((i) => saved.wrong.includes(i.id));
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ‹ 처음으로
      </button>
      <h1 className="h2">도장 찍은 날</h1>
      <div className="weekdays" aria-hidden="true">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="calendar">
        {days.map((d) => {
          const cls = ['day', saved.doneDates.includes(d) ? 'done' : '', d === today ? 'today' : ''].join(' ');
          return (
            <div key={d} className={cls} aria-label={`${koreanDate(d)}${saved.doneDates.includes(d) ? ', 공부함' : ''}`}>
              {d > today ? '' : Number(d.slice(8))}
            </div>
          );
        })}
      </div>
      <p className="empty">가장 길게 이어간 기록은 {saved.bestStreak}일이에요.</p>
      <h2 className="h2">다시 볼 사자성어</h2>
      {wrong.length === 0 ? (
        <p className="empty">틀린 문제가 생기면 여기에 모아 둘게요.</p>
      ) : (
        <ul className="wrong-list">
          {wrong.map((i) => (
            <li className="wrong-row" key={i.id}>
              <div>
                <span className="w">{i.hangul}</span>
                <p>{i.meaning}</p>
              </div>
              <button className="small" onClick={() => clearWrong(i.id)}>
                외웠어요
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
