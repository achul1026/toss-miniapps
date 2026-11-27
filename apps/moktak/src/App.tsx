import { useEffect, useRef, useState } from 'react';
import {
  addDays,
  attachBanner,
  kstDateKey,
  koreanDate,
  preloadRewarded,
  reminderSupported,
  requestDailyReminder,
  showRewarded,
  useScreens,
  WEEK,
} from 'daily-kit';
import { useApp } from './store';
import { cleanPhrase, floatText, GOAL, PHRASES, streakOf, type Mode } from './logic';
import { beadSound, bellSound, keepAwake, moktakSound, vibrate } from './feel';

type Screen = { name: 'home' } | { name: 'records' } | { name: 'phrase' };
type Go = (s: Screen) => void;

const AUTO_MS = 10 * 60 * 1000; // 광고 보고 자동으로 두드리는 시간
const AUTO_EVERY = 1100;

export default function App() {
  const { ready, init, flush } = useApp();
  const [screen, go] = useScreens<Screen>({ name: 'home' });
  useEffect(() => {
    init();
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [init, flush]);
  if (!ready) return <div className="page center">불러오는 중…</div>;
  if (screen.name === 'records') return <Records />;
  if (screen.name === 'phrase') return <Phrase go={go} />;
  return <Home go={go} />;
}

/* 목탁 그림: 둥근 나무 몸통, 입 모양 홈, 손잡이. hit일 때 채가 내려와 친다. */
function Moktak({ hit }: { hit: number }) {
  return (
    <svg className="moktak" viewBox="0 0 300 260" aria-hidden="true">
      <defs>
        <radialGradient id="wood" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#d49a5e" />
          <stop offset="0.55" stopColor="#a8703f" />
          <stop offset="1" stopColor="#6e4423" />
        </radialGradient>
        <linearGradient id="stick" x1="0" x2="1">
          <stop offset="0" stopColor="#8a5a32" />
          <stop offset="1" stopColor="#c58d55" />
        </linearGradient>
      </defs>
      <ellipse cx="150" cy="240" rx="118" ry="13" fill="rgba(35,38,43,0.12)" />
      <g key={hit} className={hit ? 'body hit' : 'body'}>
        {/* 손잡이: 위쪽 고리 */}
        <path d="M104 74 C104 30 196 30 196 74" stroke="#5e381b" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d="M110 70 C112 40 188 40 190 70" stroke="#9a6438" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
        {/* 몸통: 둥글고 아래가 조금 넓은 나무 */}
        <path d="M28 158 C28 92 84 62 150 62 C216 62 272 92 272 158 C272 210 222 236 150 236 C78 236 28 210 28 158 Z" fill="url(#wood)" />
        {/* 가로로 길게 파인 입 (울림 구멍), 양 끝은 둥근 구멍 */}
        <path d="M58 176 C110 198 190 198 242 176" stroke="#2e190a" strokeWidth="14" fill="none" strokeLinecap="round" />
        <circle cx="56" cy="174" r="11" fill="#2e190a" />
        <circle cx="244" cy="174" r="11" fill="#2e190a" />
        <path d="M70 166 C114 184 186 184 230 166" stroke="#e7b77f" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
        {/* 나뭇결 */}
        <path d="M70 120 C110 100 168 96 214 108" stroke="#d8a46c" strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M60 140 C100 128 140 126 170 128" stroke="#8c5a31" strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round" />
      </g>
      <g key={`s${hit}`} className={hit ? 'stick hit' : 'stick'}>
        {/* 목탁채: 오른쪽 위에서 비스듬히 */}
        <rect x="246" y="-34" width="11" height="110" rx="5.5" fill="url(#stick)" transform="rotate(38 251 20)" />
        <circle cx="218" cy="70" r="15" fill="#6b3f1f" />
        <circle cx="213" cy="65" r="5" fill="#a46b3d" opacity="0.7" />
      </g>
    </svg>
  );
}

/* 염주: 108알을 원으로. 지금 알은 맨 아래, 탭마다 한 알씩 돈다. */
function Yeomju({ bead }: { bead: number }) {
  const r = 124;
  const step = 360 / GOAL;
  return (
    <svg className="yeomju" viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <radialGradient id="bead" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#e2b98c" />
          <stop offset="1" stopColor="#8f5f37" />
        </radialGradient>
        <radialGradient id="beadDone" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#9a6a42" />
          <stop offset="1" stopColor="#4a2a14" />
        </radialGradient>
        <radialGradient id="guru" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#6fb2aa" />
          <stop offset="1" stopColor="#1f4f4b" />
        </radialGradient>
      </defs>
      <g style={{ transform: `rotate(${-bead * step}deg)`, transformOrigin: '150px 150px' }} className="ring">
        <circle cx="150" cy="150" r={r} fill="none" stroke="#7a5436" strokeWidth="1" opacity="0.35" />
        {Array.from({ length: GOAL }, (_, i) => {
          const a = ((i * step + 90) * Math.PI) / 180;
          const x = 150 + r * Math.cos(a);
          const y = 150 + r * Math.sin(a);
          const done = i < bead;
          return <circle key={i} cx={x} cy={y} r={i === 0 ? 9 : 4.6} fill={i === 0 ? 'url(#guru)' : done ? 'url(#beadDone)' : 'url(#bead)'} />;
        })}
      </g>
      {/* 지금 넘기는 자리 표시 */}
      <circle cx="150" cy={150 + r} r="11" fill="none" stroke="#b8892e" strokeWidth="3" />
    </svg>
  );
}

function Home({ go }: { go: Go }) {
  const { s, tap, set, setMode } = useApp();
  const today = kstDateKey();
  const count = s.day === today ? s.today : 0;
  const [hit, setHit] = useState(0);
  const [floats, setFloats] = useState<{ id: number; x: number }[]>([]);
  const [justDone, setJustDone] = useState(false);
  const [askReminder, setAskReminder] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [adReady, setAdReady] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const floatId = useRef(0);

  useEffect(() => preloadRewarded(setAdReady), []);

  const strike = () => {
    const r = tap();
    const st = useApp.getState().s;
    if (st.sound) (st.mode === 'yeomju' ? beadSound : moktakSound)();
    if (st.haptic) vibrate(false);
    setHit((h) => h + 1);
    const id = ++floatId.current;
    setFloats((f) => [...f.slice(-5), { id, x: (Math.random() - 0.5) * 120 }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
    if (r.reachedGoal) {
      if (st.sound) bellSound();
      if (st.haptic) vibrate(true);
      setJustDone(true);
      if (st.reminder === null && reminderSupported()) setAskReminder(true);
    } else if (r.roundDone && st.haptic) vibrate(true);
  };

  // 광고 보고 10분 자동 두드리기. 앱이 뒤로 가면 멈춘다.
  const autoEnd = useRef(0);
  useEffect(() => {
    if (autoLeft <= 0) return;
    keepAwake(true);
    const t = window.setInterval(() => {
      const left = autoEnd.current - Date.now();
      if (left <= 0 || document.visibilityState === 'hidden') {
        setAutoLeft(0);
        return;
      }
      setAutoLeft(left);
      strike();
    }, AUTO_EVERY);
    return () => {
      window.clearInterval(t);
      keepAwake(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLeft > 0]);

  const startAuto = async () => {
    setAdBusy(true);
    const ok = await showRewarded();
    setAdBusy(false);
    if (ok) {
      autoEnd.current = Date.now() + AUTO_MS;
      setAutoLeft(AUTO_MS);
    }
  };

  const mode = s.mode;
  const pct = Math.min(1, count / GOAL);
  return (
    <div className="home">
      <header className="top">
        <div className="seg" role="tablist" aria-label="두드리는 방법">
          {(
            [
              ['moktak', '목탁'],
              ['yeomju', '염주'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
        <div className="toggles">
          <button className="icon" aria-pressed={s.sound} aria-label={s.sound ? '소리 끄기' : '소리 켜기'} onClick={() => set({ sound: !s.sound })}>
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
              <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
              {s.sound ? (
                <path d="M13 7q2 3 0 6M15.5 5q4 5 0 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              ) : (
                <path d="M13 7l5 6M18 7l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <button className="icon" aria-pressed={s.haptic} aria-label={s.haptic ? '진동 끄기' : '진동 켜기'} onClick={() => set({ haptic: !s.haptic })}>
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
              <rect x="6.5" y="3" width="7" height="14" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
              {s.haptic ? <path d="M3 7v6M17 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </header>

      <div className="count" aria-live="polite">
        <p className="count-num">
          {count.toLocaleString('ko-KR')}
          <span> / {GOAL}</span>
        </p>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="count-sub">{mode === 'yeomju' ? `염주 ${s.bead}알째 · ${s.rounds}바퀴` : count >= GOAL ? '오늘의 108번을 채웠어요' : '오늘 두드린 횟수'}</p>
      </div>

      <button className="stage" onPointerDown={strike} aria-label={mode === 'yeomju' ? '염주 한 알 넘기기' : '목탁 두드리기'}>
        {mode === 'yeomju' ? <Yeomju bead={s.bead} /> : <Moktak hit={hit} />}
        {floats.map((f) => (
          <span key={f.id} className="float" style={{ marginLeft: f.x }} aria-hidden="true">
            {floatText(s)}
          </span>
        ))}
      </button>

      {justDone && (
        <section className="done" role="status">
          <div className="done-seal" aria-hidden="true">
            百八
          </div>
          <div>
            <p className="done-title">오늘의 108번을 채웠어요</p>
            <p className="done-sub">{streakOf(s, today)}일째 이어서 마음을 다스리고 있어요</p>
          </div>
        </section>
      )}
      {askReminder && (
        <section className="reminder">
          <p className="reminder-title">내일 아침 8시에 알려드릴까요?</p>
          <div className="reminder-row">
            <button
              className="quiet"
              onClick={async () => {
                const r = await requestDailyReminder();
                if (r !== 'unsupported') set({ reminder: r });
                setAskReminder(false);
              }}
            >
              매일 아침 알림 받기
            </button>
            <button
              className="small"
              onClick={() => {
                set({ reminder: 'rejected' });
                setAskReminder(false);
              }}
            >
              괜찮아요
            </button>
          </div>
        </section>
      )}

      <footer className="bottom">
        <button className="chip" onClick={() => go({ name: 'phrase' })}>
          떠오르는 말: <b>{floatText(s)}</b>
        </button>
        {autoLeft > 0 ? (
          <button className="quiet" onClick={() => setAutoLeft(0)}>
            자동으로 두드리는 중 · {Math.ceil(autoLeft / 60000)}분 남음 (멈추기)
          </button>
        ) : (
          adReady && (
            <button className="quiet" disabled={adBusy} onClick={startAuto}>
              {adBusy ? '광고를 보여주고 있어요' : '광고 보고 10분 동안 자동으로 두드리기'}
            </button>
          )
        )}
        <button className="link" onClick={() => go({ name: 'records' })}>
          지난 기록 보기
        </button>
      </footer>
    </div>
  );
}

function Phrase({ go }: { go: Go }) {
  const { s, set } = useApp();
  const [custom, setCustom] = useState('');
  const pick = (phrase: string, minus: boolean) => {
    set({ phrase, minus });
    go({ name: 'home' });
  };
  return (
    <div className="page">
      <h1 className="h2">두드릴 때 떠오르는 말</h1>
      <div className="phrases">
        {PHRASES.map((p) => (
          <button key={p.phrase} className={s.phrase === p.phrase && s.minus === p.minus ? 'phrase on' : 'phrase'} onClick={() => pick(p.phrase, p.minus)}>
            {floatText(p)}
          </button>
        ))}
      </div>
      <label className="custom">
        <span>직접 쓰기 (6자까지)</span>
        <input value={custom} maxLength={6} onChange={(e) => setCustom(e.target.value)} placeholder="예: 합격" />
      </label>
      <div className="custom-row">
        <button className="quiet" disabled={!cleanPhrase(custom)} onClick={() => pick(cleanPhrase(custom), false)}>
          {cleanPhrase(custom) || '○○'} +1 로 쓰기
        </button>
        <button className="quiet" disabled={!cleanPhrase(custom)} onClick={() => pick(cleanPhrase(custom), true)}>
          {cleanPhrase(custom) || '○○'} -1 로 쓰기
        </button>
      </div>
    </div>
  );
}

function Records() {
  const { s } = useApp();
  const today = kstDateKey();
  const banner = useRef<HTMLDivElement>(null);
  const [bannerEmpty, setBannerEmpty] = useState(false);
  useEffect(() => (banner.current ? attachBanner(banner.current, () => setBannerEmpty(true)) : undefined), []);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const end = addDays(today, 6 - dow);
  const days = Array.from({ length: 28 }, (_, k) => addDays(end, k - 27));
  const stats: [string, string][] = [
    ['오늘', `${(s.day === today ? s.today : 0).toLocaleString('ko-KR')}번`],
    ['이어서', `${streakOf(s, today)}일째`],
    ['지금까지', `${s.total.toLocaleString('ko-KR')}번`],
    ['염주', `${s.rounds}바퀴`],
  ];
  return (
    <div className="page">
      <h1 className="h2">나의 기록</h1>
      <dl className="stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="h2">108번 채운 날</h2>
      <div className="weekdays" aria-hidden="true">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="calendar">
        {days.map((d) => {
          const done = s.doneDates.includes(d);
          return (
            <div key={d} className={`day${done ? ' done' : ''}${d === today ? ' today' : ''}`} aria-label={`${koreanDate(d)}${done ? ', 108번 채움' : ''}`}>
              {d > today ? '' : Number(d.slice(8))}
            </div>
          );
        })}
      </div>
      <p className="empty">가장 길게 이어간 기록은 {s.bestStreak}일이에요.</p>
      {!bannerEmpty && <div ref={banner} className="banner" aria-label="광고" />}
    </div>
  );
}
