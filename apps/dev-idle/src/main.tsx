import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGame } from './game'

// 개발 모드에서만: 브라우저 콘솔에서 상태를 다루기 위한 핸들
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
