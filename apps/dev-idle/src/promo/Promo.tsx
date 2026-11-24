// 개발 모드 전용: 콘솔 등록용 아이콘과 썸네일을 게임 그림 코드로 그린다.
// 주소 끝에 #promo를 붙여 열고 캔버스를 이미지로 저장한다. 배포 번들에는 들어가지 않는다.
import { useEffect, useRef } from 'react';
import { drawChair, drawDesk, drawPerson, drawRoom, LOOKS, W, H } from '../office/art';
import { DESKS, seatOf } from '../office/sim';

const SANS = "'Noto Sans CJK KR', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

function useCanvas(draw: (c: CanvasRenderingContext2D) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    // 스프라이트 캐시가 그려질 때까지 한 박자 쉬고 그린다
    const t = window.setTimeout(() => draw(c), 50);
    return () => window.clearTimeout(t);
  }, [draw]);
  return ref;
}

const TEAM = ['junior', 'publisher', 'qa', 'designer', 'junior', 'dba', 'architect'];

// 사무실 한 장면 (원래 크기 160×144)
function scene(c: CanvasRenderingContext2D, level: number) {
  drawRoom(c, false, false, 3, level);
  const me = 3;
  DESKS.forEach((d, i) => drawDesk(c, d.x, d.y, true, false, i, i === me, i === 1 || i === 6, false, level));
  const people = DESKS.map((d, i) => ({ seat: seatOf(d), look: i === me ? LOOKS.me : LOOKS[TEAM[i % TEAM.length]] }));
  people.forEach((p) => {
    drawPerson(c, p.seat.x, p.seat.y, p.look, 'sit', 1, 1, 'up');
    drawChair(c, p.seat.x, p.seat.y);
  });
  // 커피 마시는 팀원과 소파에서 조는 팀원
  drawPerson(c, 132, 52, LOOKS.qa, 'drink', 0, -1, 'down');
  drawPerson(c, 140, 128, LOOKS.publisher, 'sleep', 0, 1, 'down');
}

function Icon() {
  const ref = useCanvas((c) => {
    const S = 15; // 40×40 → 600×600
    c.setTransform(S, 0, 0, S, 0, 0);
    c.fillStyle = '#ffd84d';
    c.fillRect(0, 0, 40, 40);
    c.fillStyle = '#f2c232';
    c.fillRect(0, 27, 40, 13);
    drawDesk(c, 2, 12, true, false, 1, true);
    drawPerson(c, 31, 37, LOOKS.me, 'cheer', 1, 1, 'down');
  });
  return <canvas ref={ref} id="icon" width={600} height={600} />;
}

function Thumb() {
  const ref = useCanvas((c) => {
    c.fillStyle = '#2a3447';
    c.fillRect(0, 0, 1932, 828);
    // 오른쪽: 판교 사옥 장면
    const S = 5;
    const ox = 1932 - W * S - 72;
    const oy = (828 - H * S) / 2;
    c.fillStyle = '#1f2838';
    c.fillRect(ox - 14, oy - 14, W * S + 28, H * S + 28);
    c.setTransform(S, 0, 0, S, ox, oy);
    scene(c, 3);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // 왼쪽: 제목과 직급 포스트잇
    c.fillStyle = '#ffffff';
    c.font = `900 124px ${SANS}`;
    c.fillText('SI 개발자', 96, 300);
    c.fillText('키우기', 96, 450);
    c.fillStyle = '#b9c3d6';
    c.font = `500 46px ${SANS}`;
    c.fillText('인턴에서 CTO까지, 내 개발팀을 키워요', 100, 548);
    const ranks = ['인턴', '주니어', 'PL', 'CTO'];
    let x = 100;
    c.font = `800 40px ${SANS}`;
    ranks.forEach((r, i) => {
      const w = c.measureText(r).width + 44;
      c.save();
      c.translate(x + w / 2, 650);
      c.rotate((i % 2 ? 1.5 : -1.5) * (Math.PI / 180));
      c.fillStyle = '#ffd84d';
      c.fillRect(-w / 2, -36, w, 72);
      c.fillStyle = '#1e2430';
      c.textAlign = 'center';
      c.fillText(r, 0, 14);
      c.restore();
      x += w + 18;
      if (i < ranks.length - 1) {
        c.fillStyle = '#6f7b93';
        c.font = `800 36px ${SANS}`;
        c.fillText('›', x - 12, 662);
        c.font = `800 40px ${SANS}`;
        x += 18;
      }
    });
  });
  return <canvas ref={ref} id="thumb" width={1932} height={828} />;
}

export default function Promo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: '#ddd' }}>
      <Icon />
      <Thumb />
    </div>
  );
}
