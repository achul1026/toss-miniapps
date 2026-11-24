// 사무실 픽셀아트. 전부 사각형으로 직접 그린다 (외부 그림 없음).
// 나중에 에셋 팩으로 바꿀 때는 이 파일만 스프라이트 시트 그리기로 교체하면 된다.

export const TILE = 16;
export const COLS = 10;
export const ROWS = 9;
export const W = COLS * TILE; // 160
export const H = ROWS * TILE; // 144

export const PAL = {
  floorA: '#d9cbb0',
  floorB: '#d2c2a5',
  wall: '#8fa3b8',
  wallDark: '#6f8399',
  window: '#bfe3f2',
  windowNight: '#24324a',
  desk: '#a8784e',
  deskDark: '#7f5636',
  monitor: '#2b3444',
  screen: '#8fd3ff',
  screenWarm: '#ffe6a3',
  chair: '#3f4a5c',
  sofa: '#5f8fbf',
  sofaDark: '#47729c',
  plant: '#4f9a5a',
  pot: '#b5643c',
  rack: '#39414f',
  ledOk: '#5be37d',
  ledBad: '#ff5a5a',
  coffee: '#5b3a2a',
  machine: '#c9ced6',
  ink: '#1e2430',
  skin: '#f1c7a1',
  postit: '#ffd84d',
};

export type Ctx = CanvasRenderingContext2D;

export function px(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

export function drawRoom(c: Ctx, night: boolean, alarm: boolean) {
  // 바닥: 체크 무늬 타일
  for (let ty = 1; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      px(c, tx * TILE, ty * TILE, TILE, TILE, (tx + ty) % 2 ? PAL.floorA : PAL.floorB);
    }
  }
  // 벽과 창문
  px(c, 0, 0, W, TILE, PAL.wall);
  px(c, 0, TILE - 2, W, 2, PAL.wallDark);
  for (const wx of [16, 56, 96]) {
    px(c, wx, 3, 28, 9, PAL.wallDark);
    px(c, wx + 1, 4, 26, 7, night ? PAL.windowNight : PAL.window);
    px(c, wx + 14, 4, 1, 7, PAL.wallDark);
  }
  // 시계
  px(c, 136, 3, 9, 9, '#f4f4f4');
  px(c, 140, 5, 1, 4, PAL.ink);
  px(c, 140, 8, 3, 1, PAL.ink);

  // 탕비실 (오른쪽 위): 커피 머신과 정수기
  px(c, 144, 18, 14, 12, PAL.machine);
  px(c, 147, 21, 8, 4, PAL.ink);
  px(c, 149, 26, 4, 3, PAL.coffee);
  px(c, 130, 18, 8, 14, '#e8f3fb');
  px(c, 131, 19, 6, 5, '#9fd0f0');

  // 소파 (오른쪽 아래)
  px(c, 126, 118, 32, 6, PAL.sofaDark);
  px(c, 126, 124, 32, 10, PAL.sofa);
  px(c, 126, 120, 4, 14, PAL.sofaDark);
  px(c, 154, 120, 4, 14, PAL.sofaDark);

  // 서버실 랙 (왼쪽 아래)
  px(c, 2, 108, 14, 30, PAL.rack);
  for (let i = 0; i < 4; i++) {
    px(c, 4, 111 + i * 7, 10, 4, '#2a303b');
    px(c, 12, 112 + i * 7, 1, 1, alarm && i % 2 === 0 ? PAL.ledBad : PAL.ledOk);
  }

  // 화분
  for (const [x, y] of [[2, 18], [114, 120]] as const) {
    px(c, x + 2, y + 8, 8, 6, PAL.pot);
    px(c, x, y, 12, 9, PAL.plant);
    px(c, x + 3, y - 3, 6, 4, PAL.plant);
  }

  if (night) {
    c.fillStyle = 'rgba(12, 18, 36, 0.42)';
    c.fillRect(0, 0, W, H);
  }
}

// 책상: (x, y)는 책상 왼쪽 위. 의자는 아래쪽에 있고 사람은 화면을 등지고 앉는다.
export function drawDesk(c: Ctx, x: number, y: number, occupiedWorking: boolean, night: boolean, frame: number, mine = false) {
  px(c, x, y + 4, 24, 9, PAL.desk);
  px(c, x, y + 12, 24, 2, PAL.deskDark);
  // 모니터
  px(c, x + 6, y - 2, 12, 8, PAL.monitor);
  const lit = occupiedWorking || mine;
  px(c, x + 7, y - 1, 10, 6, lit ? (frame % 2 ? PAL.screen : '#a9ddff') : '#4a5568');
  if (night && lit) {
    // 모니터 불빛: 화면 앞쪽으로만 은은하게
    c.fillStyle = 'rgba(143, 211, 255, 0.18)';
    c.fillRect(x + 4, y + 5, 16, 12);
  }
  px(c, x + 11, y + 6, 2, 2, PAL.monitor);
  // 포스트잇, 머그컵
  if (mine) px(c, x + 2, y + 5, 3, 3, PAL.postit);
  px(c, x + 19, y + 6, 3, 3, '#ffffff');
  // 의자
  px(c, x + 8, y + 16, 8, 6, PAL.chair);
}

export interface Look {
  hair: string;
  shirt: string;
  pants: string;
}

export type Pose = 'stand' | 'walk' | 'sit' | 'sleep' | 'drink' | 'cheer';

// 사람: (x, y)는 발밑 가운데. 키는 약 14px.
export function drawPerson(c: Ctx, x: number, y: number, look: Look, pose: Pose, frame: number, facing: 1 | -1 = 1) {
  if (pose === 'sleep') {
    // 소파에 누운 모습
    px(c, x - 8, y - 6, 4, 4, look.hair);
    px(c, x - 7, y - 5, 3, 3, PAL.skin);
    px(c, x - 4, y - 6, 8, 4, look.shirt);
    px(c, x + 4, y - 5, 5, 3, look.pants);
    // Zzz
    const bob = frame % 2;
    c.fillStyle = PAL.ink;
    c.font = '6px monospace';
    c.fillText('z', x - 6, y - 10 - bob);
    c.fillText('Z', x - 2, y - 14 + bob);
    return;
  }
  const bob = pose === 'walk' ? frame % 2 : 0;
  const top = y - 14 - bob;
  if (pose === 'sit') {
    // 뒷모습: 머리와 어깨, 팔이 키보드 위에서 움직인다
    px(c, x - 3, top + 2, 6, 5, look.hair);
    px(c, x - 4, top + 7, 8, 5, look.shirt);
    const a = frame % 2;
    px(c, x - 5, top + 6 + a, 2, 3, look.shirt);
    px(c, x + 3, top + 7 - a, 2, 3, look.shirt);
    return;
  }
  // 앞모습
  px(c, x - 3, top, 6, 3, look.hair);
  px(c, x - 3, top + 3, 6, 3, PAL.skin);
  px(c, x - 3, top + 3, 1, 1, look.hair);
  px(c, x + 2, top + 3, 1, 1, look.hair);
  px(c, x - 1 + (facing > 0 ? 1 : -1), top + 4, 1, 1, PAL.ink);
  px(c, x + (facing > 0 ? 1 : -1) + 1, top + 4, 1, 1, PAL.ink);
  px(c, x - 4, top + 6, 8, 5, look.shirt);
  if (pose === 'cheer') {
    px(c, x - 6, top + 1 - (frame % 2), 2, 5, look.shirt);
    px(c, x + 4, top + 1 - ((frame + 1) % 2), 2, 5, look.shirt);
  } else if (pose === 'drink') {
    px(c, x + 3, top + 4, 2, 3, look.shirt);
    px(c, x + 3, top + 2, 3, 3, '#ffffff');
  } else {
    px(c, x - 5, top + 6, 1, 4, look.shirt);
    px(c, x + 4, top + 6, 1, 4, look.shirt);
  }
  // 다리
  const step = pose === 'walk' ? frame % 2 : 0;
  px(c, x - 3, top + 11, 2, 3 - step, look.pants);
  px(c, x + 1, top + 11, 2, 2 + step, look.pants);
}

// 직군별 겉모습
export const LOOKS: Record<string, Look> = {
  me: { hair: '#2b2b2b', shirt: '#2f6fed', pants: '#2f3747' },
  junior: { hair: '#4a3426', shirt: '#7fb069', pants: '#3b4252' },
  publisher: { hair: '#a0522d', shirt: '#e07a5f', pants: '#3d405b' },
  qa: { hair: '#1f1f1f', shirt: '#f2cc8f', pants: '#4a4e69' },
  designer: { hair: '#c06c84', shirt: '#9a8c98', pants: '#22223b' },
  dba: { hair: '#555555', shirt: '#6c757d', pants: '#343a40' },
  architect: { hair: '#bbbbbb', shirt: '#ffffff', pants: '#2b2d42' },
  pmo: { hair: '#3d2c2e', shirt: '#264653', pants: '#1d1d1d' },
  consultant: { hair: '#e9c46a', shirt: '#1d3557', pants: '#111111' },
};
