# toss-miniapps

앱인토스(토스 미니앱) 1인 프로젝트 모노레포.

| 경로 | 서비스 | 상태 |
| --- | --- | --- |
| `apps/saja` | 하루 한 사자성어 (5060 대상 매일 퀴즈) | MVP 개발 중 |
| `apps/dev-idle` | SI 개발자 키우기 (방치형 게임) | 예정 |
| `content/saja` | 사자성어 콘텐츠 (JSON) | 30개 |

## 시작하기

```sh
pnpm install
pnpm dev:saja          # 로컬 개발 서버
pnpm --filter saja test
pnpm build:saja        # dist/ + haru-saja.ait 생성 → 앱인토스 콘솔에 업로드
```

광고 ID는 `apps/saja/.env.example`을 복사해 `.env`로 만들고 콘솔에서 받은 값을 넣는다.
`apps-in-toss.config.ts`의 `appName`은 콘솔에 등록한 앱 이름과 같아야 한다.
