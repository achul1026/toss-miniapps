// 사무실 픽셀아트 (2차). 점 단위 도안 + 외곽선 + 2~3단 명암 + 바닥 그림자.
// 그림은 모두 이 파일에서 직접 그린다. 에셋 팩으로 바꿀 때는 이 파일만 교체하면 된다.

export const TILE = 16;
export const COLS = 10;
export const ROWS = 9;
export const W = COLS * TILE; // 160
export const H = ROWS * TILE; // 144

export type Ctx = CanvasRenderingContext2D;

/* 도안: 글자 한 칸이 픽셀 하나. '.'은 투명. 글자 → 색은 팔레트로 정한다. */
type Pal = Record<string, string>;
const cache = new Map<string, HTMLCanvasElement>();
const rep = (ch: string, n: number) => ch.repeat(n);

function sprite(key: string, rows: string[], pal: Pal): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = rows.length;
  const c = cv.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = pal[ch];
      if (!color) return;
      c.fillStyle = color;
      c.fillRect(x, y, 1, 1);
    });
  });
  cache.set(key, cv);
  return cv;
}

function blit(c: Ctx, cv: HTMLCanvasElement, x: number, y: number, flip = false) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (!flip) {
    c.drawImage(cv, rx, ry);
    return;
  }
  c.save();
  c.translate(rx + cv.width, ry);
  c.scale(-1, 1);
  c.drawImage(cv, 0, 0);
  c.restore();
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

function shadow(c: Ctx, cx: number, cy: number, rx: number) {
  c.fillStyle = 'rgba(60, 36, 20, 0.18)';
  c.beginPath();
  c.ellipse(Math.round(cx), Math.round(cy), rx, Math.max(1.5, rx / 3), 0, 0, Math.PI * 2);
  c.fill();
}

/* 팔레트: 따뜻한 오후의 사무실 */
const OUT = '#3b2a30'; // 외곽선: 검정 대신 짙은 자주갈색
const P = {
  floor: '#d8b48a',
  floorLine: '#c49d74',
  floorDark: '#b8906a',
  wall: '#f1e6d2',
  wallShade: '#e2d3ba',
  base: '#9c7a5c',
  glass: '#b9e2ef',
  glassHi: '#e3f5fa',
  glassNight: '#2a3a5c',
  frame: '#8a6a52',
  wood: '#b07a4e',
  woodHi: '#c99466',
  woodDark: '#86583a',
  metal: '#c7ccd4',
  metalDark: '#8f97a3',
  screen: '#7fd0f5',
  screenHi: '#c4ecff',
  screenOff: '#4b5668',
  bezel: '#2f3646',
  leaf: '#5fa65a',
  leafHi: '#86c46b',
  leafDark: '#3f7f45',
  pot: '#c46a46',
  potDark: '#9a4f33',
  sofa: '#5e8fc4',
  sofaHi: '#7aa8d8',
  sofaDark: '#466f9c',
  rug: '#e6c9a3',
  rugEdge: '#c98f6b',
  rack: '#3a404d',
  rackHi: '#4f5768',
  ledOk: '#62e08a',
  ledBad: '#ff5a5a',
  white: '#fbf7f0',
  postit: '#ffd84d',
  coffee: '#6b4430',
};

/* 사무실 단계: 직급이 오르면 더 좋은 곳으로 이사한다 */
export interface Theme {
  level: number;
  name: string; // 화면에 보이는 곳 이름
  wall: string;
  wallShade: string;
  base: string;
  desk: [string, string, string]; // 상판, 밝은 면, 어두운 면
  sofa: [string, string, string]; // 기본, 밝은 면, 어두운 면
  rug: [string, string] | null; // 안, 테두리
}

export const THEMES: Theme[] = [
  {
    level: 0,
    name: '반지하 사무실',
    wall: '#d3d6c6',
    wallShade: '#c1c5b2',
    base: '#878b7c',
    desk: ['#9aa3ad', '#b3bbc4', '#747d88'],
    sofa: ['#9a6b4a', '#b5845f', '#7a5238'],
    rug: null,
  },
  {
    level: 1,
    name: '상가 2층 사무실',
    wall: P.wall,
    wallShade: P.wallShade,
    base: P.base,
    desk: [P.wood, P.woodHi, P.woodDark],
    sofa: [P.sofa, P.sofaHi, P.sofaDark],
    rug: [P.rug, P.rugEdge],
  },
  {
    level: 2,
    name: '강남 빌딩 12층',
    wall: '#f3f4f6',
    wallShade: '#e1e4ea',
    base: '#3e4a63',
    desk: ['#7a5038', '#94654a', '#573624'],
    sofa: ['#7d8794', '#98a2ae', '#5f6874'],
    rug: ['#d9dde4', '#a9b2bf'],
  },
  {
    level: 3,
    name: '판교 사옥 꼭대기 층',
    wall: '#f7f6f2',
    wallShade: '#e6e3db',
    base: '#2c3140',
    desk: ['#e4e0d8', '#f6f4ef', '#b9b3a8'],
    sofa: ['#4f9a7a', '#6db594', '#3a7a5e'],
    rug: ['#efe1c6', '#c7a777'],
  },
];

/** 직급 → 사무실 단계. 인턴·신입 반지하, 주니어·시니어 상가, PL·PM 강남, 리드 아키텍트부터 판교 */
export function officeLevel(rank: number): number {
  return rank >= 6 ? 3 : rank >= 4 ? 2 : rank >= 2 ? 1 : 0;
}

function drawFloor(c: Ctx, level: number) {
  if (level === 0) {
    // 콘크리트 타일, 군데군데 금
    rect(c, 0, 16, W, H - 16, '#bbb6ab');
    for (let y = 19; y < H; y += 16) rect(c, 0, y, W, 1, '#a7a196');
    for (let x = 0; x < W; x += 16) rect(c, x, 16, 1, H - 16, '#a7a196');
    for (const [x, y] of [[37, 60], [38, 61], [39, 61], [101, 98], [102, 99], [102, 100], [61, 134], [62, 133]]) rect(c, x, y, 1, 1, '#958f84');
    return;
  }
  if (level === 2) {
    // 카펫 타일 체크무늬
    for (let y = 16; y < H; y += 16)
      for (let x = 0; x < W; x += 16) rect(c, x, y, 16, 16, ((x + y) / 16) % 2 === 0 ? '#8a95a6' : '#96a0b0');
    for (let i = 0; i < 90; i++) rect(c, (i * 53) % W, 17 + ((i * 37) % (H - 17)), 1, 1, '#7d889a');
    return;
  }
  if (level === 3) {
    // 밝은 원목, 세로로 긴 판재
    rect(c, 0, 16, W, H - 16, '#e6cfa9');
    for (let x = 0; x < W; x += 8) {
      rect(c, x, 16, 1, H - 16, '#d3b88f');
      const off = ((x / 8) % 3) * 17;
      for (let y = 22 + off; y < H; y += 51) rect(c, x, y, 8, 1, '#d3b88f');
    }
    return;
  }
  // 나무 바닥: 가로 판재, 이음새를 엇갈리게
  rect(c, 0, 16, W, H - 16, P.floor);
  for (let y = 18; y < H; y += 6) {
    rect(c, 0, y + 5, W, 1, P.floorLine);
    const off = (((y - 18) / 6) % 3) * 18;
    for (let x = off; x < W; x += 54) rect(c, x, y, 1, 5, P.floorLine);
  }
}

// 판교 사옥: 통유리 너머 도시
function drawSkyline(c: Ctx, night: boolean) {
  rect(c, 5, 1, 106, 14, OUT);
  rect(c, 6, 2, 104, 12, night ? '#1d2747' : '#a9dcf0');
  const towers = [[8, 7], [16, 4], [25, 8], [31, 3], [42, 6], [50, 5], [60, 9], [67, 4], [78, 7], [86, 5], [96, 8], [102, 6]];
  towers.forEach(([x, top], i) => {
    const w = 6 + (i % 3);
    rect(c, x, 2 + top, w, 12 - top, night ? '#2e3a63' : '#7fb0c9');
    if (night) for (let yy = 4 + top; yy < 13; yy += 3) rect(c, x + 1 + (i % 2) * 2, yy, 1, 1, '#f5e9a8');
  });
  if (!night) rect(c, 9, 3, 6, 1, '#e3f5fa');
  for (const x of [32, 58, 84]) rect(c, x, 2, 1, 12, '#5d6577');
}

/* 방 */
export function drawRoom(c: Ctx, night: boolean, alarm: boolean, t: number, level = 1) {
  const th = THEMES[level] ?? THEMES[1];
  drawFloor(c, level);
  // 벽, 걸레받이
  rect(c, 0, 0, W, 18, th.wall);
  rect(c, 0, 14, W, 2, th.wallShade);
  rect(c, 0, 16, W, 2, th.base);
  rect(c, 0, 18, W, 1, level === 1 ? P.floorDark : 'rgba(0,0,0,0.12)');

  if (level === 3) drawSkyline(c, night);
  // 반지하: 천장 가까이 작은 창, 밖은 길바닥
  else if (level === 0)
    for (const wx of [20, 76]) {
      rect(c, wx - 1, 1, 22, 7, OUT);
      rect(c, wx, 2, 20, 5, night ? P.glassNight : P.glass);
      rect(c, wx, 5, 20, 2, night ? '#3a3d48' : '#9a9a92');
      if (!night) rect(c, wx + 6, 3, 2, 2, '#5b4a44');
      rect(c, wx - 1, 7, 22, 1, '#6f7366');
    }
  // 창문 세 개
  else for (const wx of [14, 50, 86]) {
    rect(c, wx - 1, 2, 26, 12, OUT);
    rect(c, wx, 3, 24, 10, P.frame);
    rect(c, wx + 1, 4, 10, 8, night ? P.glassNight : P.glass);
    rect(c, wx + 13, 4, 10, 8, night ? P.glassNight : P.glass);
    if (!night) {
      rect(c, wx + 2, 5, 3, 1, P.glassHi);
      rect(c, wx + 14, 5, 3, 1, P.glassHi);
    } else {
      rect(c, wx + 4, 6, 1, 1, '#f5e9a8');
      rect(c, wx + 19, 8, 1, 1, '#f5e9a8');
    }
    rect(c, wx - 1, 13, 26, 1, level === 2 ? '#5d6577' : P.woodDark);
  }
  if (level === 0) {
    // 벽걸이 달력
    rect(c, 116, 3, 14, 12, OUT);
    rect(c, 117, 4, 12, 3, '#e05a4f');
    rect(c, 117, 7, 12, 7, P.white);
    for (let i = 0; i < 9; i++) rect(c, 118 + (i % 4) * 3, 8 + Math.floor(i / 4) * 2, 1, 1, '#9aa0a8');
  } else if (level === 3) {
    // 대시보드 TV
    rect(c, 114, 2, 24, 13, OUT);
    rect(c, 115, 3, 22, 11, '#1e2533');
    const bars = [3, 5, 4, 7, 6, 8];
    bars.forEach((b, i) => rect(c, 117 + i * 3, 12 - b, 2, b, i === bars.length - 1 ? P.ledOk : '#5aa9e6'));
  } else {
  // 화이트보드와 포스트잇
  rect(c, 116, 3, 20, 11, OUT);
  rect(c, 117, 4, 18, 9, P.white);
  rect(c, 119, 6, 9, 1, '#9db3c9');
  rect(c, 119, 8, 6, 1, '#9db3c9');
  rect(c, 130, 5, 3, 3, P.postit);
  rect(c, 126, 9, 3, 3, '#ff9db0');
  if (level === 2) {
    // 액자 속 감사패
    rect(c, 41, 5, 7, 7, OUT);
    rect(c, 42, 6, 5, 5, '#d9b44a');
    rect(c, 43, 7, 3, 3, '#f3e3a0');
  }
  }
  // 시계
  rect(c, 143, 4, 9, 9, OUT);
  rect(c, 144, 5, 7, 7, P.white);
  rect(c, 147, 6, 1, 3, OUT);
  const hand = Math.floor(t / 2) % 4;
  if (hand === 0) rect(c, 147, 8, 2, 1, OUT);
  if (hand === 1) rect(c, 147, 8, 1, 2, OUT);
  if (hand === 2) rect(c, 146, 8, 1, 1, OUT);
  if (hand === 3) rect(c, 146, 7, 1, 1, OUT);

  // 소파 아래 러그
  if (th.rug) {
    rect(c, 120, 112, 38, 28, th.rug[1]);
    rect(c, 122, 114, 34, 24, th.rug[0]);
    for (let x = 124; x < 154; x += 4) rect(c, x, 125, 2, 1, th.rug[1]);
  }

  blit(c, SOFA(th), 124, 116);
  blit(c, COUNTER(), 126, 18);
  blit(c, RACK(alarm, Math.floor(t * 4) % 2 === 0), 2, 108);
  if (level === 0) {
    // 반지하: 화분 대신 쌓인 박스, 복사기 대신 프린터 한 대
    blit(c, BOXES(), 26, 127);
    blit(c, BOXES(), 54, 127);
    blit(c, BOXES(), 98, 127);
  } else {
    blit(c, PLANT(), 100, 120);
    blit(c, COPIER(Math.floor(t * 2) % 6 === 0), 26, 121);
    blit(c, BOXES(), 54, 127);
  }
  if (level >= 2) blit(c, PLANT(), 78, 120);
  else blit(c, BIN(), 80, 131);

  if (night) {
    c.fillStyle = 'rgba(22, 26, 52, 0.38)';
    c.fillRect(0, 0, W, H);
  }
}

const SOFA = (th: Theme) =>
  sprite(
    `sofa-${th.level}`,
    [
      '.' + rep('o', 30) + '.',
      'o' + rep('H', 30) + 'o',
      'oH' + rep('s', 28) + 'Ho',
      'oH' + rep('s', 28) + 'Ho',
      'oo' + rep('s', 28) + 'oo',
      'oH' + rep('o', 28) + 'Ho',
      'oH' + rep('s', 13) + 'o' + rep('s', 14) + 'Ho',
      'oH' + rep('H', 13) + 'o' + rep('H', 14) + 'Ho',
      'oH' + rep('s', 13) + 'o' + rep('s', 14) + 'Ho',
      'o' + rep('d', 30) + 'o',
      'o' + rep('d', 30) + 'o',
      '.' + rep('o', 30) + '.',
      '..oo' + rep('.', 24) + 'oo..',
    ],
    { o: OUT, H: th.sofa[1], s: th.sofa[0], d: th.sofa[2] },
  );

const COUNTER = () =>
  sprite(
    'counter',
    [
      '...........oooooooooooooooo.',
      '....oooo...ommmmmmmmmmmmmmo.',
      '...obbbbo..omkkkkkkkkmmmmmo.',
      '...obwwbo..omkrrrrrrkmggmmo.',
      '...obwwbo..omkkkkkkkkmmmmmo.',
      '...obbbbo..ommmmmmmmmmmmmmo.',
      '...owwwwo..ommmmoccomnnmmmo.',
      '...owwwwo..oMMMMoccoMMMMMMo.',
      rep('o', 28),
      'o' + rep('A', 26) + 'o',
      'o' + rep('w', 26) + 'o',
      'o' + rep('w', 26) + 'o',
      'owwdddwwwwwwwwwwwwwwwdddwwwo',
      'o' + rep('w', 26) + 'o',
      'o' + rep('d', 26) + 'o',
      rep('o', 28),
    ],
    {
      o: OUT,
      m: P.metal,
      M: P.metalDark,
      k: '#2d2f36',
      r: '#e05a4f',
      g: P.ledOk,
      c: P.coffee,
      n: '#ffffff',
      b: '#7fb7e0',
      w: P.woodHi,
      A: '#e8c9a0',
      d: P.woodDark,
    },
  );

const RACK = (alarm: boolean, blink: boolean) =>
  sprite(
    `rack-${alarm}-${blink}`,
    [
      rep('o', 14),
      'o' + rep('A', 12) + 'o',
      'o' + rep('r', 12) + 'o',
      'or' + rep('k', 9) + 'Lro',
      'o' + rep('r', 12) + 'o',
      'or' + rep('k', 9) + 'Gro',
      'o' + rep('r', 12) + 'o',
      'or' + rep('k', 9) + 'Lro',
      'o' + rep('r', 12) + 'o',
      'or' + rep('k', 9) + 'Gro',
      'o' + rep('r', 12) + 'o',
      'o' + rep('r', 12) + 'o',
      'o' + rep('d', 12) + 'o',
      rep('o', 14),
    ],
    {
      o: OUT,
      A: P.rackHi,
      r: P.rack,
      k: '#262b35',
      d: '#2a2f3a',
      L: alarm ? (blink ? P.ledBad : '#7a2a2a') : blink ? P.ledOk : '#3f9a5c',
      G: alarm ? (blink ? '#7a2a2a' : P.ledBad) : P.ledOk,
    },
  );

const PLANT = () =>
  sprite(
    'plant',
    [
      '....oo..oo....',
      '...oLLooLLo...',
      '..oLlLLoLLlo..',
      '.oLlLlLLLlLLo.',
      '.oLLlLLlLLLlo.',
      'oLdLLlLLLlLdLo',
      'oddLLLddLLLddo',
      '.oddddddddddo.',
      '..oppppppppo..',
      '..oPpppppppo..',
      '..oPpppppppo..',
      '...oPPPPPPo...',
      '....oooooo....',
    ],
    { o: OUT, L: P.leaf, l: P.leafHi, d: P.leafDark, p: P.pot, P: P.potDark },
  );

const COPIER = (busy: boolean) =>
  sprite(
    `copier-${busy}`,
    [
      '.oooooooooooooooo.',
      'oAAAAAAAAAAAAAAAAo',
      'oAkkkkkkkkkkkkkkAo',
      'oooooooooooooooooo',
      'ommmmmmmmmmmmmmmmo',
      'ommgmmmmmmmmmmmmmo',
      'omwwwwwwwwwwwwwwmo',
      'oMMMMMMMMMMMMMMMMo',
      'ommmmmmmmmmmmmmmmo',
      'ommmmmmmmmmmmmmmmo',
      'oMMMMMMMMMMMMMMMMo',
      'oooooooooooooooooo',
      '.oo............oo.',
    ],
    { o: OUT, A: '#e9ecf1', k: '#5b6475', m: P.metal, M: P.metalDark, g: busy ? P.ledOk : '#3f9a5c', w: P.white },
  );

const BOXES = () =>
  sprite(
    'boxes',
    [
      '..oooooooo....',
      '..obbbbbbo....',
      '..obttttbo....',
      '..obbbbbbo....',
      'oooooooooooooo',
      'obbbbbobbbbbbo',
      'obttttobbttbbo',
      'obbbbbobbbbbbo',
      'oBBBBBoBBBBBBo',
      'oooooooooooooo',
    ],
    { o: OUT, b: '#d9a86c', B: '#b8864f', t: '#f0d9b0' },
  );

const BIN = () =>
  sprite(
    'bin',
    ['oooooooo', 'oggggggo', 'oGwGGGGo', 'oGGGGwGo', 'oGGGGGGo', '.oooooo.'],
    { o: OUT, g: '#9fb0a8', G: '#7f928a', w: P.white },
  );

/* 책상: 비스듬히 위에서 본 책상과 모니터. (x, y)는 책상 상판 왼쪽 위 */
const DESK = (th: Theme) =>
  sprite(
    `desk-${th.level}`,
    [
      rep('o', 24),
      'o' + rep('w', 22) + 'o',
      'ow' + rep('W', 20) + 'wo',
      'ow' + rep('W', 20) + 'wo',
      'ow' + rep('W', 20) + 'wo',
      'o' + rep('w', 22) + 'o',
      rep('o', 24),
      'o' + rep('d', 22) + 'o',
      'o' + rep('d', 22) + 'o',
      rep('o', 24),
      'od' + rep('.', 20) + 'do',
      'oo' + rep('.', 20) + 'oo',
    ],
    { o: OUT, w: th.desk[0], W: th.desk[1], d: th.desk[2] },
  );

const MONITOR = (lit: boolean, alt: boolean, err = false) =>
  sprite(
    `mon-${lit}-${alt}-${err}`,
    [
      'oooooooooooo',
      'obbbbbbbbbbo',
      'obSSSSSSSSbo',
      'obSssssssSbo',
      'obSsHsssssbo',
      'obSssssHssbo',
      'obbbbbbbbbbo',
      'ooooobbooooo',
      '....oMMo....',
      '...oMMMMo...',
      '...oooooo...',
    ],
    {
      o: OUT,
      b: P.bezel,
      S: err ? '#c8382f' : lit ? P.screen : P.screenOff,
      s: err ? (alt ? '#ff8a80' : '#e2483d') : lit ? (alt ? P.screenHi : P.screen) : P.screenOff,
      H: err ? '#fff1ee' : lit ? (alt ? P.screen : P.screenHi) : P.screenOff,
      M: P.metalDark,
    },
  );

const CHAIR = () =>
  sprite(
    'chair',
    [
      '.oooooooooo.',
      'oCCCCCCCCCCo',
      'oCccccccccCo',
      'oCccccccccCo',
      'oCCCCCCCCCCo',
      '.oooooooooo.',
      '....oMMo....',
      '..oooMMooo..',
      '..o......o..',
    ],
    { o: OUT, C: '#4a5470', c: '#5d6987', M: P.metalDark },
  );

export function drawDesk(c: Ctx, x: number, y: number, working: boolean, night: boolean, frame: number, mine = false, ramen = false, error = false, level = 1) {
  shadow(c, x + 12, y + 12, 13);
  blit(c, DESK(THEMES[level] ?? THEMES[1]), x, y + 1);
  blit(c, MONITOR(working || mine, frame % 2 === 1, error && (working || mine)), x + 6, y - 7);
  // 키보드, 머그, 서류
  rect(c, x + 7, y + 4, 10, 2, OUT);
  rect(c, x + 8, y + 4, 8, 1, '#e9e2d6');
  rect(c, x + 19, y + 2, 3, 3, OUT);
  rect(c, x + 19, y + 2, 2, 2, P.white);
  rect(c, x + 2, y + 3, 4, 3, P.white);
  if (mine) rect(c, x + 3, y + 2, 3, 3, P.postit);
  if (ramen) {
    // 컵라면과 김
    rect(c, x + 1, y + 1, 5, 5, OUT);
    rect(c, x + 2, y + 2, 3, 1, '#f3e3c3');
    rect(c, x + 2, y + 3, 3, 2, '#e8533f');
    if (frame % 3 === 0) rect(c, x + 3, y - 2, 1, 2, '#efefef');
    if (frame % 3 === 1) rect(c, x + 2, y - 3, 1, 2, '#efefef');
  }
  if (night && (working || mine)) {
    c.fillStyle = 'rgba(127, 208, 245, 0.16)';
    c.fillRect(x + 3, y + 3, 18, 14);
  }
}

// 앉은 사람 위에 덮는 의자 등받이
export function drawChair(c: Ctx, seatX: number, seatY: number) {
  blit(c, CHAIR(), seatX - 6, seatY - 5);
}

/* 사람 */
export interface Look {
  hair: string;
  hairShade: string;
  shirt: string;
  shirtShade: string;
  pants: string;
  skin?: string;
}

export type Pose = 'stand' | 'walk' | 'sit' | 'sleep' | 'drink' | 'cheer';
export type Dir = 'down' | 'up' | 'side';

const FRONT = [
  '....oooo....',
  '...ohhhho...',
  '..ohhhhhho..',
  '..ohhhhhho..',
  '..ohssssho..',
  '..osesseso..',
  '..osssssso..',
  '...oSSSSo...',
  '..otttttto..',
  '.otttttttto.',
  '.otTttttTto.',
  '.osTttttTso.',
  '..oTTTTTTo..',
  '..oppppppo..',
  '..oppPPppo..',
  '..oppo.oppo.',
  '..okko.okko.',
  '...oo...oo..',
];
const SIDE = [
  '....oooo....',
  '...ohhhhho..',
  '..ohhhhhhho.',
  '..ohhhhssso.',
  '..ohhhssseo.',
  '..ohhssssso.',
  '...ossssSo..',
  '....oSSSo...',
  '...otttto...',
  '..otttttto..',
  '..otttTtto..',
  '..ottsTtto..',
  '...oTTTTo...',
  '...oppppo...',
  '...oppppo...',
  '..opo..opo..',
  '.okko..okko.',
  '..oo....oo..',
];
const SIDE_STEP = [...SIDE.slice(0, 15), '....oppo....', '....okko....', '.....oo.....'];
const BACK_WALK = [
  '............',
  '....oooo....',
  '...ohhhho...',
  '..ohhhhhho..',
  '..ohhHHhho..',
  '..ohHHHHho..',
  '..oHHHHHHo..',
  '...oSSSSo...',
  '..otttttto..',
  '.otttttttto.',
  '.otTttttTto.',
  '.osTttttTso.',
  '..oTTTTTTo..',
  '..oppppppo..',
  '..oppPPppo..',
  '..oppo.oppo.',
  '..okko.okko.',
  '...oo...oo..',
];
const BACK_STEP = [...BACK_WALK.slice(0, 15), '..oppo.oppo.', '..okko..oo..', '...oo.......'];
const FRONT_STEP = [...FRONT.slice(0, 15), '..oppo.oppo.', '..okko..oo..', '...oo.......'];
const FRONT_SLEEPY = FRONT.map((r, i) => (i === 5 ? '..osSssSso..' : r));
const FRONT_BLINK = FRONT_SLEEPY;
const CHEER = FRONT.map((r, i) => {
  const arms: Record<number, string> = {
    0: 'o...oooo...o',
    1: 's..ohhhho..s',
    2: 't.ohhhhhho.t',
    3: 't.ohhhhhho.t',
    4: 't.ohssssho.t',
    9: '..otttttto..',
    10: '..otTttTto..',
    11: '..oTttttTo..',
  };
  return arms[i] ?? r;
});
const BACK_SIT = [
  '....oooo....',
  '...ohhhho...',
  '..ohhhhhho..',
  '..ohhHHhho..',
  '..ohHHHHho..',
  '..oHHHHHHo..',
  '...oSSSSo...',
  '..otttttto..',
  '.otttttttto.',
  '.otTttttTto.',
  'osTttttttTso',
  '.oTTTTTTTTo.',
];
const BACK_TYPE = BACK_SIT.map((r, i) => (i === 10 ? '.osTttttTso.' : i === 9 ? 'osTttttttTso' : r));

function personPal(look: Look): Pal {
  return {
    o: OUT,
    h: look.hair,
    H: look.hairShade,
    s: look.skin ?? '#f3c9a2',
    S: '#dba987',
    e: OUT,
    t: look.shirt,
    T: look.shirtShade,
    p: look.pants,
    P: '#2a2a35',
    k: '#4a3a3a',
  };
}

// (x, y)는 발밑 가운데
export function drawPerson(c: Ctx, x: number, y: number, look: Look, pose: Pose, frame: number, facing: 1 | -1 = 1, dir: Dir = 'down', seed = 0) {
  const pal = personPal(look);
  const id = `${look.hair}${look.shirt}`;
  if (pose === 'sit') {
    const typing = frame % 2 === 1;
    blit(c, sprite(`bs${typing ? 1 : 0}${id}`, typing ? BACK_TYPE : BACK_SIT, pal), x - 6, y - 15);
    return;
  }
  if (pose === 'sleep') {
    // 소파에 앉아 꾸벅: 앞모습 상반신, 눈 감고 고개가 살짝 흔들림
    const tilt = frame % 4 < 2 ? 0 : 1;
    blit(c, sprite(`sl${id}`, FRONT_SLEEPY.slice(0, 13), pal), x - 6 + tilt, y - 16);
    c.fillStyle = OUT;
    c.font = '6px monospace';
    const bob = frame % 2;
    c.fillText('z', x + 5, y - 15 - bob);
    c.fillText('Z', x + 9, y - 19 + bob);
    return;
  }
  shadow(c, x, y, 5);
  if (pose === 'cheer') {
    blit(c, sprite(`ch${id}`, CHEER, pal), x - 6, y - 18 - (frame % 2));
    return;
  }
  const stepping = pose === 'walk' && frame % 2 === 1;
  const lift = stepping ? 1 : 0;
  if (pose === 'walk' && dir === 'side') {
    blit(c, sprite(`sd${lift}${id}`, stepping ? SIDE_STEP : SIDE, pal), x - 6, y - 18 - lift, facing < 0);
    return;
  }
  if (pose === 'walk' && dir === 'up') {
    blit(c, sprite(`bw${lift}${id}`, stepping ? BACK_STEP : BACK_WALK, pal), x - 6, y - 18 - lift);
    return;
  }
  // 앞모습. 가끔 눈을 깜빡인다
  const blink = (frame + seed) % 14 === 0;
  const rows = stepping ? FRONT_STEP : blink ? FRONT_BLINK : FRONT;
  blit(c, sprite(`f${lift}${blink ? 'b' : ''}${id}`, rows, pal), x - 6, y - 18 - lift, facing < 0);
  if (pose === 'drink') {
    const mx = x + 4;
    const my = y - 9;
    rect(c, mx, my, 4, 4, OUT);
    rect(c, mx + 1, my + 1, 2, 2, P.white);
    rect(c, mx + 4, my + 1, 1, 2, OUT);
    if (frame % 4 === 0) rect(c, mx + 1, my - 3, 1, 2, '#e8e8e8');
    if (frame % 4 === 2) rect(c, mx + 2, my - 3, 1, 2, '#e8e8e8');
  }
}

// 직군별 겉모습
export const LOOKS: Record<string, Look> = {
  me: { hair: '#3a2c2a', hairShade: '#2a1f1d', shirt: '#3f7cf0', shirtShade: '#2c5fc2', pants: '#3a4256' },
  junior: { hair: '#5a3d2b', hairShade: '#432c1f', shirt: '#8cc084', shirtShade: '#6a9e63', pants: '#3f4a5e' },
  publisher: { hair: '#b8673a', hairShade: '#8f4c29', shirt: '#ef8f6f', shirtShade: '#cc6e50', pants: '#454866' },
  qa: { hair: '#2b2b33', hairShade: '#1b1b22', shirt: '#f3d08c', shirtShade: '#d6b06c', pants: '#4b5070' },
  designer: { hair: '#c4708c', hairShade: '#9c5670', shirt: '#b9a7c9', shirtShade: '#9786aa', pants: '#2c2c48' },
  dba: { hair: '#6b6b6b', hairShade: '#4f4f4f', shirt: '#7e8a99', shirtShade: '#626d7b', pants: '#363c48' },
  architect: { hair: '#c9c9c9', hairShade: '#a3a3a3', shirt: '#f4f1ea', shirtShade: '#d8d2c6', pants: '#2c2f45' },
  pmo: { hair: '#4a3436', hairShade: '#352425', shirt: '#2f5d6e', shirtShade: '#224754', pants: '#22222a' },
  consultant: { hair: '#e0b85a', hairShade: '#b8923f', shirt: '#24406b', shirtShade: '#1a2f52', pants: '#16161c' },
};

/* 이벤트 소품 */
const BUG = (f: number) =>
  sprite(
    `bug${f}`,
    f
      ? ['.o...o.', '..ooo..', 'orrrrro', '.rRrRr.', 'orrrrro', '..ooo..', '.o...o.']
      : ['o.....o', '.oooo..', '.rrrrro', 'orRrRr.', '.rrrrro', '.oooo..', 'o.....o'],
    { o: OUT, r: '#e2483d', R: '#ffd2c8' },
  );

export function drawBug(c: Ctx, x: number, y: number, frame: number) {
  shadow(c, x, y + 3, 4);
  blit(c, BUG(frame % 2), x - 3 + (frame % 2), y - 4);
}

export function drawAuditNote(c: Ctx, x: number, y: number, frame: number) {
  const up = frame % 2;
  rect(c, x - 4, y - 5 - up, 9, 9, OUT);
  rect(c, x - 3, y - 4 - up, 7, 7, '#ff9db0');
  rect(c, x, y - 3 - up, 1, 3, OUT);
  rect(c, x, y + 1 - up, 1, 1, OUT);
}

export function drawExclaim(c: Ctx, x: number, y: number) {
  rect(c, x - 2, y - 7, 5, 8, OUT);
  rect(c, x - 1, y - 6, 3, 4, '#ffd84d');
  rect(c, x - 1, y - 1, 3, 1, '#ffd84d');
}
