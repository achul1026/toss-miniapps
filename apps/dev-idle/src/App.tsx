import { useEffect, useMemo, useRef, useState } from 'react';
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

type Tab = 'hire' | 'gear' | 'resign';

export default function App() {
  const { ready, init, tick, persist } = useGame();
  useEffect(() => {
    init();
  }, [init]);

  // 게임 루프 + 주기적 저장
  useEffect(() => {
    if (!ready) return;
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
  const { s, offline, dismissOffline } = useGame();
  const [tab, setTab] = useState<Tab>('hire');
  const rank = rankIndex(s.delivered);
  const p = project(s.delivered);
  const progress = Math.min(1, s.lines / p.lines);

  // 승진 알림
  const prevRank = useRef(rank);
  const [promoted, setPromoted] = useState<string | null>(null);
  useEffect(() => {
    if (rank > prevRank.current) {
      setPromoted(RANKS[rank]);
      const t = window.setTimeout(() => setPromoted(null), 2600);
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
          <button className="small" onClick={dismissOffline}>
            확인
          </button>
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

      <Monitor />

      <p className="rates">
        탭 한 번에 {won(linesPerTap(s))}줄 · 팀이 초당 {won(linesPerSec(s))}줄
      </p>

      <nav className="tabs" role="tablist">
        {(
          [
            ['hire', '팀원 채용'],
            ['gear', '장비'],
            ['resign', '이직'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'hire' && <HireList />}
      {tab === 'gear' && <GearList />}
      {tab === 'resign' && <Resign />}

      {promoted && (
        <div className="toast" role="status">
          {promoted}(으)로 승진했어요
        </div>
      )}
    </div>
  );
}

function Monitor() {
  const { tap, taps } = useGame();
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const lines = useMemo(() => Array.from({ length: 7 }, (_, i) => CODE[(taps + i) % CODE.length]), [taps]);
  const onTap = (e: React.PointerEvent<HTMLButtonElement>) => {
    tap();
    const r = e.currentTarget.getBoundingClientRect();
    const id = performance.now();
    setPops((p) => [...p.slice(-6), { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 700);
  };
  const s = useGame((g) => g.s);
  return (
    <button className="monitor" onPointerDown={onTap} aria-label="코딩하기 (탭)">
      <div className="screen">
        {lines.map((l, i) => (
          <code key={i} className={i === lines.length - 1 ? 'line cursor' : 'line'}>
            {l}
          </code>
        ))}
      </div>
      {pops.map((p) => (
        <span key={p.id} className="pop" style={{ left: p.x, top: p.y }}>
          +{won(linesPerTap(s))}
        </span>
      ))}
      <span className="hint">모니터를 탭해서 코딩해요</span>
    </button>
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
