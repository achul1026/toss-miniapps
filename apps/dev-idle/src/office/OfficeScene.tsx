import { useEffect, useRef } from 'react';
import { HIRES, linesPerTap, rankIndex } from 'dev-idle-core';
import { useGame } from '../game';
import { won } from '../lib/format';
import { drawChair, drawDesk, drawPerson, drawRoom, H, LOOKS, W, type Pose } from './art';
import { cheerAll, DESKS, makeAgent, myDeskIndex, rand, seatOf, step, wake, workingCount, type Agent } from './sim';

const SCALE = 4; // 캔버스 내부 해상도 배율 (CSS로 화면 폭에 맞춘다)
const MAX_OTHERS = DESKS.length - 1;

interface Float {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}

// 고용한 팀원 중 사무실에 보일 사람들 (책상 수만큼)
function teamRoles(hires: Record<string, number>): string[] {
  const roles: string[] = [];
  for (const h of HIRES) {
    for (let i = 0; i < (hires[h.id] ?? 0) && roles.length < MAX_OTHERS; i++) roles.push(h.id);
  }
  return roles;
}

function isNight() {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}

export function OfficeScene({ onWorkingChange }: { onWorkingChange?: (working: number, total: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const agents = useRef<Agent[]>([]);
  const floats = useRef<Float[]>([]);
  const meTyping = useRef(0);
  const r = useRef(rand(20261125));
  const s = useGame((g) => g.s);
  const { tap, bonus } = useGame();
  const rank = rankIndex(s.delivered);
  const myDesk = myDeskIndex(rank);
  const roles = teamRoles(s.hires).join(',');

  // 팀 구성이나 내 자리가 바뀌면 자리 배치를 다시 한다 (이미 있는 사람은 그대로)
  useEffect(() => {
    const list = roles ? roles.split(',') : [];
    const seats = DESKS.map((d, i) => ({ d, i })).filter((x) => x.i !== myDesk);
    const prev = agents.current;
    agents.current = list.map((role, i) => {
      const seat = seatOf(seats[i].d);
      const id = `${role}-${i}`;
      const old = prev.find((a) => a.id === id);
      if (old && old.seat.x === seat.x && old.seat.y === seat.y) return old;
      return makeAgent(id, role, seat, r.current);
    });
  }, [roles, myDesk]);

  // 납품하면 다 같이 만세
  const delivered = useRef(s.delivered);
  useEffect(() => {
    if (s.delivered > delivered.current) {
      cheerAll(agents.current);
      const seat = seatOf(DESKS[myDesk]);
      floats.current.push({ x: seat.x, y: seat.y - 26, text: '납품!', t: 1.4, color: '#1f9d61' });
    }
    delivered.current = s.delivered;
  }, [s.delivered, myDesk]);

  // 그리기 루프
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;
    let lastWorking = -1;
    let clock = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      clock += dt;
      acc += dt;
      if (acc > 0.25) {
        acc = 0;
        frame++;
      }
      step(agents.current, dt, r.current);
      meTyping.current = Math.max(0, meTyping.current - dt);

      const night = isNight();
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      c.clearRect(0, 0, W, H);
      drawRoom(c, night, false, clock);

      const occupants = new Map<number, Agent>();
      for (const a of agents.current) {
        const di = DESKS.findIndex((d) => seatOf(d).x === a.seat.x && seatOf(d).y === a.seat.y);
        occupants.set(di, a);
      }
      DESKS.forEach((d, i) => {
        const occ = occupants.get(i);
        const working = i === myDesk ? meTyping.current > 0 : occ?.activity === 'work';
        drawDesk(c, d.x, d.y, !!working, night, frame, i === myDesk);
      });

      // 사람과 의자: 아래쪽에 있는 것이 앞에 보이도록 y순으로. 의자 등받이는 앉은 사람 위에 덮는다.
      const me = seatOf(DESKS[myDesk]);
      const items: { y: number; draw: () => void }[] = [
        {
          y: me.y,
          draw: () => drawPerson(c, me.x, me.y, LOOKS.me, 'sit', meTyping.current > 0 ? frame : 0),
        },
        ...DESKS.map((d) => {
          const seat = seatOf(d);
          return { y: seat.y + 0.5, draw: () => drawChair(c, seat.x, seat.y) };
        }),
        ...agents.current.map((a) => ({
          y: a.pos.y,
          draw: () => {
            const pose: Pose =
              a.activity === 'work' ? 'sit' : a.activity === 'walk' ? 'walk' : a.activity === 'nap' ? 'sleep' : a.activity === 'coffee' ? 'drink' : 'cheer';
            drawPerson(c, a.pos.x, a.pos.y, LOOKS[a.role] ?? LOOKS.junior, pose, frame, a.facing);
          },
        })),
      ];
      items.sort((p, q) => p.y - q.y).forEach((p) => p.draw());

      // 내 머리 위 표시
      c.fillStyle = '#3b2a30';
      c.fillRect(me.x - 3, me.y - 25, 6, 5);
      c.fillStyle = '#ffd84d';
      c.fillRect(me.x - 2, me.y - 24, 4, 3);
      c.fillRect(me.x - 1, me.y - 21, 2, 1);

      // 떠오르는 글자
      c.font = 'bold 7px sans-serif';
      c.textAlign = 'center';
      floats.current = floats.current.filter((f) => (f.t -= dt) > 0);
      for (const f of floats.current) {
        c.globalAlpha = Math.min(1, f.t * 1.5);
        c.fillStyle = f.color;
        c.fillText(f.text, f.x, f.y - (1.4 - f.t) * 10);
      }
      c.globalAlpha = 1;
      c.textAlign = 'start';

      const w = workingCount(agents.current);
      if (w !== lastWorking) {
        lastWorking = w;
        onWorkingChange?.(w, agents.current.length);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [myDesk, onWorkingChange]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - el.left) / el.width) * W;
    const y = ((e.clientY - el.top) / el.height) * H;
    // 조는 사람을 눌렀으면 깨운다
    const sleeper = agents.current.find((a) => a.activity === 'nap' && Math.abs(a.pos.x - x) < 12 && Math.abs(a.pos.y - 4 - y) < 10);
    if (sleeper && wake(sleeper)) {
      const gain = linesPerTap(useGame.getState().s) * 10;
      bonus(gain);
      floats.current.push({ x: sleeper.pos.x, y: sleeper.pos.y - 14, text: `깼다! +${won(gain)}`, t: 1.4, color: '#2f6fed' });
      return;
    }
    tap();
    meTyping.current = 0.6;
    const me = seatOf(DESKS[myDesk]);
    floats.current.push({ x: me.x + (Math.random() * 10 - 5), y: me.y - 24, text: `+${won(linesPerTap(useGame.getState().s))}`, t: 1, color: '#c98a00' });
  };

  return (
    <canvas
      ref={canvas}
      className="scene"
      width={W * SCALE}
      height={H * SCALE}
      onPointerDown={onPointer}
      role="img"
      aria-label="사무실. 누르면 내가 코딩하고, 조는 팀원을 누르면 깨워요"
    />
  );
}
