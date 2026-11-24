// 토스 게임센터 리더보드. 점수는 지금까지(이직 포함) 납품한 프로젝트 수.
// 토스 앱 5.221.0 미만이나 일반 브라우저에서는 아무것도 하지 않는다.
import { Game } from '@apps-in-toss/web-framework';

function supported(fn: { isSupported: () => boolean }) {
  try {
    return fn.isSupported();
  } catch {
    return false;
  }
}

export const leaderboardSupported = () => supported(Game.openLeaderboard);

let sent = -1;
let lastAt = 0;

/** 점수가 늘었을 때만, 1분에 한 번까지 보낸다. force면 바로 보낸다(앱이 뒤로 갈 때). */
export async function submitScore(score: number, force = false) {
  if (score <= sent || !supported(Game.setLeaderboardScore)) return;
  const now = Date.now();
  if (!force && now - lastAt < 60_000) return;
  lastAt = now;
  try {
    const r = await Game.setLeaderboardScore({ score: String(Math.floor(score)) });
    if (r?.statusCode === 'SUCCESS') sent = score;
  } catch {
    /* 다음 기회에 다시 보낸다 */
  }
}

export async function openLeaderboard() {
  if (!leaderboardSupported()) return;
  try {
    await Game.openLeaderboard();
  } catch {
    /* 열지 못하면 그대로 둔다 */
  }
}
