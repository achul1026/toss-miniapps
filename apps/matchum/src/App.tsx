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
import { fill, ITEMS, type Spelling } from './data/items';
import { buildQuiz, buildReview } from './quiz';

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

/** 원고지 칸에 한 글자씩. mark: 빨간 교정 표시를 할 글자 범위 */
function Grid({ text, mark }: { text: string; mark?: [number, number] }) {
  return (
    <div className="grid" role="text" aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className={`cell${mark && i >= mark[0] && i < mark[1] ? ' cell-mark' : ''}`} aria-hidden="true">
          {ch === ' ' ? '' : ch}
        </span>
      ))}
    </div>
  );
}

/** 틀린 표기에 빨간 줄을 긋고 위에 바른 표기를 적는 교정 */
function Correction({ s, size = 'md' }: { s: Spelling; size?: 'md' | 'lg' }) {
  return (
    <p className={`corr corr-${size}`} aria-label={`바른 표기 ${s.right}, 틀린 표기 ${s.wrong}`}>
      <span className="corr-right">{s.right}</span>
      <span className="corr-wrong">{s.wrong}</span>
    </p>
  );
}

// 선생님 도장: 참 잘했어요
function Stamp({ press = false }: { press?: boolean }) {
  return (
    <div className={`stamp${press ? ' stamp-press' : ''}`} role="img" aria-label="참 잘했어요 도장">
      <span>참</span>
      <span>잘했어요</span>
    </div>
  );
}

function Home({ go }: { go: Go }) {
  const { item, saved, today, streakNow } = useApp();
  const done = saved.lastDoneDate === today;
  const streak = streakNow();
  // 처음엔 어느 쪽이 맞는지 가려 둔다 (글자 순서를 날짜로 섞음)
  const pair = dayNumber(today) % 2 ? [item.right, item.wrong] : [item.wrong, item.right];
  return (
    <div className="page">
      <p className="date">{koreanDate(today)}</p>
      <section className="sheet" aria-label="오늘의 맞춤법">
        <p className="sheet-label">오늘의 맞춤법</p>
        {done ? (
          <>
            <Correction s={item} size="lg" />
            <Stamp />
          </>
        ) : (
          <div className="pair">
            <span>{pair[0]}</span>
            <span className="pair-or">와</span>
            <span>{pair[1]}</span>
          </div>
        )}
        <p className="sheet-q">{done ? fill(item, item.right) : '어느 쪽이 맞을까요?'}</p>
      </section>
      <p className="status">
        {streak > 0 ? (
          <>
            <strong>{streak}일째</strong> 이어서 배우는 중이에요
          </>
        ) : (
          '하루 1분, 헷갈리는 맞춤법을 하나씩 바로잡아요'
        )}
      </p>
      <button className="primary" onClick={() => go({ name: 'learn' })}>
        {done ? '오늘 배운 내용 다시 보기' : '정답 보고 배우기'}
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
  const questions = useMemo(() => buildQuiz(item, ITEMS, dayNumber(today)), [item, today]);
  const sentence = fill(item, item.right);
  const at = item.sentence.indexOf('{}');
  return (
    <div className="page">
      <section className="sheet learn-sheet">
        <Correction s={item} size="lg" />
        <p className="verdict">빨간 글씨가 바른 표기예요</p>
      </section>
      <section className="section">
        <h2>이렇게 써요</h2>
        <Grid text={sentence} mark={[at, at + item.right.length]} />
      </section>
      <section className="section">
        <h2>왜 그럴까요</h2>
        <p>{item.rule}</p>
      </section>
      {!bannerEmpty && <div ref={banner} className="banner" aria-label="광고" />}
      <section className="section tip">
        <h2>이렇게 구별해요</h2>
        <p>{item.tip}</p>
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
  return (
    <div className="page">
      <div className="progress" aria-label={`${questions.length}문제 중 ${i + 1}번째`}>
        {questions.map((_, k) => (
          <span key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <h1 className="prompt">{q.prompt}</h1>
      {q.sub && <p className="given">{q.sub}</p>}
      <div className={`options${q.options.length === 2 ? ' options-2' : ''}`}>
        {q.options.map((o, n) => {
          const state = picked === null ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : 'dim';
          return (
            <button key={n} className={`option ${q.kind === 'sentence' ? 'opt-sentence ' : ''}${state}`} onClick={() => choose(n)} aria-pressed={picked === n}>
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
  const learned = ITEMS.filter((i) => saved.learned.includes(i.id));
  const offerBonus = !review && learned.length >= 2;
  const [askReminder, setAskReminder] = useState(!review && saved.reminder === null && reminderSupported());
  useEffect(() => (offerBonus ? preloadRewarded(setAdReady) : undefined), [offerBonus]);
  const bonus = async () => {
    setAdBusy(true);
    const ok = await showRewarded();
    setAdBusy(false);
    if (ok) go({ name: 'quiz', questions: buildReview(learned, dayNumber(today) + 7), review: true });
  };
  return (
    <div className="page">
      <div className="result">
        {!review && <Stamp press />}
        <p className="score">
          {total}문제 중 {correct}문제 맞혔어요
        </p>
        {!review && <p className="note">{streakNow()}일째 도장을 받았어요. 내일 또 만나요.</p>}
      </div>
      {askReminder && (
        <section className="reminder">
          <p className="reminder-title">내일 아침 8시에 알려드릴까요?</p>
          <p className="reminder-body">오늘의 맞춤법이 도착하면 토스 알림으로 알려드려요.</p>
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
  const wrong = ITEMS.filter((i) => saved.wrong.includes(i.id));
  return (
    <div className="page">
      <h1 className="h2">도장 받은 날</h1>
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
      <h2 className="h2">다시 볼 맞춤법</h2>
      {wrong.length === 0 ? (
        <p className="empty">틀린 문제가 생기면 여기에 모아 둘게요.</p>
      ) : (
        <ul className="wrong-list">
          {wrong.map((i) => (
            <li className="wrong-row" key={i.id}>
              <div>
                <Correction s={i} />
                <p>{i.tip}</p>
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
