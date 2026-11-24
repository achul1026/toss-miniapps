import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { IDIOMS, type Idiom } from './data/idioms';
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

function Home({ go }: { go: Go }) {
  const { idiom, saved, today, streakNow } = useApp();
  const doneToday = saved.lastDoneDate === today;
  return (
    <div className="page">
      <p className="muted">오늘의 사자성어</p>
      <div className="card big-card">
        <div className="hanja">{idiom.hanja}</div>
        <div className="hangul">{idiom.hangul}</div>
      </div>
      <p className="streak">
        연속 <strong>{streakNow()}</strong>일째 · 지금까지 {saved.learned.length}개 배움
      </p>
      <button className="primary" onClick={() => go({ name: 'learn' })}>
        {doneToday ? '오늘 사자성어 다시 보기' : '오늘의 사자성어 배우기'}
      </button>
      <button className="secondary" onClick={() => go({ name: 'records' })}>
        내 기록 · 오답 노트
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
      <IdiomCard idiom={idiom} />
      <button className="primary" onClick={() => go({ name: 'quiz', questions, review: false })}>
        퀴즈 3문제 풀기
      </button>
    </div>
  );
}

function IdiomCard({ idiom }: { idiom: Idiom }) {
  return (
    <div className="card">
      <div className="hanja">{idiom.hanja}</div>
      <div className="hangul">{idiom.hangul}</div>
      <p className="meaning">{idiom.meaning}</p>
      <div className="chars">
        {idiom.chars.map(([h, m], i) => (
          <div className="char" key={i}>
            <span className="char-h">{h}</span>
            <span className="char-m">{m}</span>
          </div>
        ))}
      </div>
      <h3>이야기</h3>
      <p>{idiom.story}</p>
      <h3>이렇게 써요</h3>
      <p className="example">{idiom.example.replace('____', idiom.hangul)}</p>
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

  return (
    <div className="page">
      <p className="muted">
        {review ? '복습' : '오늘의 퀴즈'} {i + 1} / {questions.length}
      </p>
      <h2 className="prompt">{q.prompt}</h2>
      {q.sub && <div className={q.kind === 'situation' ? 'sub sub-text' : 'sub'}>{q.sub}</div>}
      <div className="options">
        {q.options.map((o, n) => {
          const state = picked === null ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : 'dim';
          return (
            <button key={n} className={`option ${state}`} onClick={() => choose(n)}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <p className={picked === q.answer ? 'feedback ok' : 'feedback no'}>
            {picked === q.answer ? '맞았어요!' : `정답은 '${q.options[q.answer]}'예요`}
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
      <h2 className="prompt">
        {total}문제 중 {correct}문제 맞혔어요
      </h2>
      {!review && (
        <div className="card stamp">
          <div className="stamp-mark">출석</div>
          <p>
            연속 <strong>{streakNow()}</strong>일째예요. 내일 또 만나요!
          </p>
        </div>
      )}
      {!review && learned.length >= 2 && (
        <button className="secondary" disabled={adBusy} onClick={bonus}>
          {adBusy ? '광고 불러오는 중…' : '광고 보고 복습 3문제 더 풀기'}
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
  const days = Array.from({ length: 28 }, (_, k) => addDays(today, k - 27));
  const wrong = IDIOMS.filter((i) => saved.wrong.includes(i.id));
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ‹ 처음으로
      </button>
      <h2 className="prompt">최근 4주 출석</h2>
      <div className="calendar">
        {days.map((d) => (
          <div key={d} className={saved.doneDates.includes(d) ? 'day done' : 'day'}>
            {Number(d.slice(8))}
          </div>
        ))}
      </div>
      <p className="muted">최고 연속 기록 {saved.bestStreak}일</p>
      <h2 className="prompt">오답 노트</h2>
      {wrong.length === 0 && <p className="muted">틀린 사자성어가 없어요.</p>}
      {wrong.map((i) => (
        <div className="card wrong-item" key={i.id}>
          <div>
            <strong>{i.hangul}</strong> {i.hanja}
            <p>{i.meaning}</p>
          </div>
          <button className="small" onClick={() => clearWrong(i.id)}>
            외웠어요
          </button>
        </div>
      ))}
    </div>
  );
}
