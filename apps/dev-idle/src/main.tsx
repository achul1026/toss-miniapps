import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGame } from './game'

// 개발 모드에서만: 브라우저 콘솔에서 상태를 다루기 위한 핸들
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

const root = createRoot(document.getElementById('root')!)
// 개발 모드에서 #promo: 콘솔 등록용 아이콘·썸네일 그리기
if (import.meta.env.DEV && location.hash === '#promo') {
  import('./promo/Promo').then(({ default: Promo }) => root.render(<Promo />))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
