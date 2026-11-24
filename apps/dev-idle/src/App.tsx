import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GEARS,
  HIRES,
  RANKS,
  RANK_AT,
  careerFrom,
  costOf,
  linesPerSec,
  linesPerTap,
  multiplier,
  project,
  rankIndex,
  synergy,
  SYNERGY_AT,
} from 'dev-idle-core';
import { useGame } from './game';
import { duration, won } from './lib/format';
import { OfficeScene } from './office/OfficeScene';
import { officeLevel, THEMES } from './office/art';
import { adReady, onAdReady, preloadRewarded, showRewarded } from './lib/ads';
import { buy, CATALOG, iapSupported, loadPrices } from './lib/shop';
import { isMuted, onMutedChange, setMuted, sfx } from './lib/sound';
import { finishedTips, nextTip, type Tip } from './tutorial';

// 보상형 광고가 준비됐는지 화면에서 쓰는 훅
function useAdReady() {
  const [ready, setReady] = useState(adReady());
  useEffect(() => onAdReady(setReady) as () => void, []);
  return ready;
}

const CLIENTS = ['동네 꽃집', '치킨 프랜차이즈', '중견 제조사', '지역 농협', '대학교', '구청', '시청', '도청', '공기업', '중앙부처'];
// 고객 규모에 맞는 일감: 고객 단계와 같은 줄에서 두 가지 중 하나
const KINDS = [
  ['홈페이지', '블로그'],
  ['주문 앱', '쇼핑몰'],
  ['재고 관리 시스템', '쇼핑몰'],
  ['조합원 포털', '예약 시스템'],
  ['학사 관리 시스템', '그룹웨어'],
  ['민원 포털', '모바일 앱'],
  ['통합 민원 시스템', '빅데이터 플랫폼'],
  ['행정 포털', 'ITS 빅데이터 플랫폼'],
  ['ERP', '차세대 시스템'],
  ['차세대 시스템', 'AI 플랫폼'],
];

function projectName(k: number) {
  const tier = Math.min(CLIENTS.length - 1, Math.floor(k / 13));
  return `${CLIENTS[tier]} ${KINDS[tier][k % 2]} 구축`;
}

const CODE = [
  '@RestController',
  'public class OrderController {',
  '  @Autowired OrderService service;',
  '  @GetMapping("/orders")',
  '  public List<Order> list() {',
  '    return service.findAll();',
  '  }',
  '  // TODO: 감리 전에 주석 정리',
  '  @Transactional',
  '  public void save(Order o) {',
  '    if (o == null) throw new BizException();',
  '    repository.save(o);',
  '  }',
  '}',
  'SELECT * FROM TB_USER WHERE DEL_YN = \'N\';',
  '// 요구사항 변경 반영 (v3_최종_진짜최종)',
];

type Tab = 'hire' | 'gear' | 'resign' | 'shop';
const TABS: [Tab, string][] = [
  ['hire', '팀원 채용'],
  ['gear', '장비'],
  ['resign', '이직'],
  ['shop', '상점'],
];

// 게임 상태가 바뀔 때 효과음 (탭·깨우기·버그 잡기 소리는 사무실 화면에서 낸다)
function useSounds() {
  useEffect(
    () =>
      useGame.subscribe((g, prev) => {
        const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
        if (rankIndex(g.s.delivered) > rankIndex(prev.s.delivered)) sfx.promote();
        else if (g.s.delivered > prev.s.delivered && g.s.career === prev.s.career) sfx.deliver();
        if (total(g.s.hires) > total(prev.s.hires) || total(g.s.gears) > total(prev.s.gears)) sfx.buy();
        if (g.event && !prev.event) sfx.alert();
      }),
    [],
  );
}

function SoundToggle() {
  const [muted, set] = useState(isMuted());
  useEffect(() => onMutedChange(set) as () => void, []);
  return (
    <button className="sound" aria-label={muted ? '소리 켜기' : '소리 끄기'} aria-pressed={!muted} onClick={() => setMuted(!muted)}>
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
        {muted ? (
          <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.6" />
        ) : (
          <path d="M11 5.5q2 2.5 0 5M13 4q3.5 4 0 8" stroke="currentColor" strokeWidth="1.4" fill="none" />
        )}
      </svg>
    </button>
  );
}

// 안내 말풍선
function useTip(): [Tip | null, () => void] {
  const s = useGame((g) => g.s);
  const tips = useGame((g) => g.tips);
  const event = useGame((g) => g.event);
  const offline = useGame((g) => g.offline);
  const seeTips = useGame((g) => g.seeTips);
  useEffect(() => {
    const done = finishedTips(s, tips);
    if (done.length) seeTips(done);
  }, [s, tips, seeTips]);
  const tip = event || offline ? null : nextTip(s, tips);
  return [tip, () => tip && seeTips([tip.id])];
}

function Coach({ tip, onOk }: { tip: Tip; onOk: () => void }) {
  const col = TABS.findIndex(([id]) => id === tip.target);
  return (
    <div
      className={col >= 0 ? 'coach coach-down' : 'coach coach-up'}
      style={col >= 0 ? ({ '--arrow': `${((col + 0.5) / TABS.length) * 100}%` } as React.CSSProperties) : undefined}
      role="note"
    >
      <p>{tip.text}</p>
      <button onClick={onOk}>알겠어요</button>
    </div>
  );
}

export default function App() {
  const { ready, init, tick, persist } = useGame();
  useEffect(() => {
    init();
  }, [init]);

  // 게임 루프 + 주기적 저장
  useEffect(() => {
    if (!ready) return;
    preloadRewarded();
    let last = performance.now();
    const loop = window.setInterval(() => {
      const now = performance.now();
      tick(Math.min(1, (now - last) / 1000));
      last = now;
    }, 200);
    const saver = window.setInterval(persist, 5000);
    const onHide = () => document.visibilityState === 'hidden' && persist();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(loop);
      window.clearInterval(saver);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [ready, tick, persist]);

  if (!ready) return <div className="loading">출근하는 중…</div>;
  return <Office />;
}

function Office() {
  const { s, offline, dismissOffline, doubleOffline, offlineDoubled, perkX, seeTips } = useGame();
  const ad = useAdReady();
  const [tab, setTab] = useState<Tab>('hire');
  const [tip, okTip] = useTip();
  useSounds();
  const rank = rankIndex(s.delivered);
  const p = project(s.delivered);
  const progress = Math.min(1, s.lines / p.lines);

  // 승진 알림
  const prevRank = useRef(rank);
  const [promoted, setPromoted] = useState<string | null>(null);
  useEffect(() => {
    if (rank > prevRank.current) {
      const moved = officeLevel(rank) > officeLevel(prevRank.current);
      setPromoted(`${RANKS[rank]}(으)로 승진했어요${moved ? `. 사무실을 ${THEMES[officeLevel(rank)].name}(으)로 옮겼어요` : ''}`);
      const t = window.setTimeout(() => setPromoted(null), moved ? 3600 : 2600);
      prevRank.current = rank;
      return () => window.clearTimeout(t);
    }
    prevRank.current = rank;
  }, [rank]);

  return (
    <div className="office">
      <header className="top">
        <div className="badge">
          <span className="rank">{RANKS[rank]}</span>
          {s.career > 0 && <span className="career">경력 {s.career}년</span>}
        </div>
        <SoundToggle />
        <div className="money">
          <span className="money-label">용역비</span>
          <strong>{won(s.fee)}원</strong>
        </div>
      </header>

      {offline && (
        <section className="away" role="status">
          <div>
            <p className="away-title">자리를 비운 {duration(offline.awaySec)} 동안</p>
            <p className="row-desc">
              팀원들이 코드 {won(offline.lines)}줄을 썼어요
              {offline.delivered > 0 ? `. 납품 ${offline.delivered}건, +${won(offline.fee)}원` : ''}
            </p>
          </div>
          <div className="away-buttons">
            {ad && !offlineDoubled && (
              <button
                className="small ad"
                onClick={async () => {
                  if (await showRewarded()) doubleOffline();
                }}
              >
                광고 보고 2배
              </button>
            )}
            <button className="small" onClick={dismissOffline}>
              확인
            </button>
          </div>
        </section>
      )}

      <section className="project" aria-label="진행 중인 프로젝트">
        <p className="project-name">
          <span className="project-no">#{s.delivered + 1}</span> {projectName(s.delivered)}
        </p>
        <div className="bar" role="progressbar" aria-valuenow={Math.floor(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="project-meta">
          진척률 <strong>{Math.floor(progress * 100)}%</strong>
          <span>납품하면 {won(p.fee)}원</span>
        </p>
      </section>

      <Office2 />
      {tip?.target === 'scene' && <Coach tip={tip} onOk={okTip} />}

      <EventCard />

      <p className="rates">
        탭 한 번에 {won(linesPerTap(s) * perkX())}줄 · 팀이 초당 {won(linesPerSec(s) * perkX())}줄
      </p>

      {tip && tip.target !== 'scene' && <Coach tip={tip} onOk={okTip} />}
      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`tab${tab === id ? ' on' : ''}${tip?.target === id && tab !== id ? ' hint' : ''}`}
            onClick={() => {
              setTab(id);
              if (id === 'resign' && tip?.id === 'resign') seeTips(['resign']);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'hire' && <HireList />}
      {tab === 'gear' && <GearList />}
      {tab === 'resign' && <Resign />}
      {tab === 'shop' && <Shop />}

      {import.meta.env.VITE_GAME_RATING && (
        <p className="rating">
          {import.meta.env.VITE_GAME_RATING}
          {import.meta.env.VITE_GAME_RATING_NO ? ` · 등급분류번호 ${import.meta.env.VITE_GAME_RATING_NO}` : ''}
        </p>
      )}

      {promoted && (
        <div className="toast" role="status">
          {promoted}
        </div>
      )}
    </div>
  );
}

function Office2() {
  const taps = useGame((g) => g.taps);
  const s = useGame((g) => g.s);
  const [team, setTeam] = useState({ working: 0, total: 0 });
  const onWorkingChange = useCallback((working: number, total: number) => setTeam({ working, total }), []);
  const hidden = Object.values(s.hires).reduce((a, b) => a + b, 0) - team.total;
  const place = THEMES[officeLevel(rankIndex(s.delivered))].name;
  return (
    <section className="office-scene" aria-label="사무실">
      <OfficeScene onWorkingChange={onWorkingChange} />
      <p className="code-strip" aria-hidden="true">
        <span>{CODE[taps % CODE.length]}</span>
      </p>
      <p className="scene-note">
        {place} · {team.total > 0 ? `팀원 ${team.total}명 중 ${team.working}명 일하는 중` : '사무실을 눌러 코딩해요'}
        {hidden > 0 ? ` · 다른 층에 ${hidden}명 더` : ''}
      </p>
    </section>
  );
}

function EventCard() {
  const { event, boost, notice, answerEvent, answerEventBoosted, clearNotice } = useGame();
  const ad = useAdReady();
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, 2800);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);

  const left = event ? Math.ceil(event.left) : 0;
  return (
    <>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {boost && !event && (
        <p className={boost.x > 1 ? 'boost up' : 'boost down'}>
          {boost.reason === 'overtime' ? '야근 중' : '장애 여파'} · 생산량 ×{boost.x} · {Math.ceil(boost.left)}초
        </p>
      )}
      {event && (
        <section className={`event ev-${event.kind}`} role="alert">
          {event.kind === 'outage' && (
            <>
              <p className="event-title">장애 발생! 버그를 눌러 잡아요</p>
              <p className="event-desc">
                남은 버그 {event.bugs.filter((b) => !b.done).length}마리 · {left}초
              </p>
            </>
          )}
          {event.kind === 'audit' && (
            <>
              <p className="event-title">감리 지적 사항이 붙었어요</p>
              <p className="event-desc">
                책상 위 분홍 포스트잇을 눌러 처리해요 · 남은 {event.notes.filter((n) => !n.done).length}건 · {left}초
              </p>
            </>
          )}
          {(event.kind === 'overtime' || event.kind === 'change') && (
            <>
              <p className="event-title">{event.kind === 'overtime' ? '오늘 야근할까요?' : '고객이 요구사항을 바꾸자고 해요'}</p>
              <p className="event-desc">
                {event.kind === 'overtime'
                  ? '60초 동안 생산량이 2배가 돼요.'
                  : '진척률이 30% 줄어드는 대신 추가 용역비를 받아요.'}{' '}
                {left}초 안에 정해 주세요.
              </p>
              {event.kind === 'overtime' && ad && (
                <button
                  className="ad-wide"
                  onClick={async () => {
                    if (await showRewarded()) answerEventBoosted();
                  }}
                >
                  광고 보고 4배로 야근하기
                </button>
              )}
              <div className="event-buttons">
                <button className="secondary" onClick={() => answerEvent(false)}>
                  {event.kind === 'overtime' ? '칼퇴할게요' : '거절할게요'}
                </button>
                <button className="primary" onClick={() => answerEvent(true)}>
                  {event.kind === 'overtime' ? '야근할게요' : '받아들일게요'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}

function HireList() {
  const { s, hire } = useGame();
  const visible = HIRES.filter((h, i) => i === 0 || (s.hires[HIRES[i - 1].id] ?? 0) > 0 || (s.hires[h.id] ?? 0) > 0);
  return (
    <ul className="list">
      {visible.map((h) => {
        const owned = s.hires[h.id] ?? 0;
        const cost = costOf(h.baseCost, owned);
        const nextSyn = SYNERGY_AT.find((n) => n > owned);
        return (
          <li key={h.id} className="row">
            <div className="row-main">
              <p className="row-name">
                {h.name} <span className="count">{owned}명</span>
              </p>
              <p className="row-desc">
                1명당 초당 {won(h.linesPerSec * synergy(owned || 1) * multiplier(s))}줄
                {nextSyn && owned > 0 ? ` · ${nextSyn}명이면 2배` : ''}
              </p>
            </div>
            <button className="buy" disabled={s.fee < cost} onClick={() => hire(h.id)}>
              {won(cost)}원
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GearList() {
  const { s, gear } = useGame();
  return (
    <ul className="list">
      {GEARS.map((g) => {
        const owned = s.gears[g.id] ?? 0;
        const cost = costOf(g.baseCost, owned);
        return (
          <li key={g.id} className="row">
            <div className="row-main">
              <p className="row-name">
                {g.name} <span className="count">{owned}개</span>
              </p>
              <p className="row-desc">탭 한 번에 +{won(g.tapBonus * multiplier(s))}줄</p>
            </div>
            <button className="buy" disabled={s.fee < cost} onClick={() => gear(g.id)}>
              {won(cost)}원
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Shop() {
  const { grant, perks } = useGame();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const can = iapSupported();
  useEffect(() => {
    loadPrices().then(setPrices);
  }, []);
  return (
    <ul className="list">
      {CATALOG.map((p) => {
        const owned = p.sku === 'dev_idle_macbook' && perks.macbook;
        return (
          <li key={p.sku} className="row">
            <div className="row-main">
              <p className="row-name">{p.name}</p>
              <p className="row-desc">{p.desc}</p>
            </div>
            <button
              className="buy"
              disabled={!can || owned || busy !== null}
              onClick={async () => {
                setBusy(p.sku);
                await buy(p.sku, grant);
                setBusy(null);
              }}
            >
              {owned ? '보유 중' : busy === p.sku ? '결제 중' : (prices[p.sku] ?? '구매')}
            </button>
          </li>
        );
      })}
      {!can && <li className="row row-desc">결제는 토스 앱에서 열었을 때 할 수 있어요.</li>}
    </ul>
  );
}

function Resign() {
  const { s, resign } = useGame();
  const [confirm, setConfirm] = useState(false);
  const gain = careerFrom(s.totalFee);
  const rank = rankIndex(s.delivered);
  const nextRank = RANK_AT[rank + 1];
  return (
    <div className="resign">
      <p className="resign-now">
        지금 이직하면 경력 <strong>+{gain}년</strong>
      </p>
      <p className="row-desc">
        팀원·장비·용역비는 처음으로 돌아가고, 쌓인 경력 1년마다 모든 생산량이 10%씩 늘어요. 지금 경력 {s.career}년, 생산량 ×
        {multiplier(s).toFixed(1)}.
      </p>
      {nextRank !== undefined && (
        <p className="row-desc">
          다음 직급 {RANKS[rank + 1]}까지 프로젝트 {nextRank - s.delivered}건 남았어요.
        </p>
      )}
      {!confirm ? (
        <button className="secondary" disabled={gain <= 0} onClick={() => setConfirm(true)}>
          {gain > 0 ? '이직하기' : '용역비 10만 원부터 이직할 수 있어요'}
        </button>
      ) : (
        <div className="confirm">
          <p>정말 이직할까요? 지금 회사의 팀원과 장비는 두고 가요.</p>
          <div className="confirm-buttons">
            <button className="secondary" onClick={() => setConfirm(false)}>
              더 다닐게요
            </button>
            <button
              className="primary"
              onClick={async () => {
                await resign();
                setConfirm(false);
              }}
            >
              이직할게요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
