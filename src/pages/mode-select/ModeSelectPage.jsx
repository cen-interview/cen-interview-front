import { Link } from 'react-router-dom'
import chatModeIcon from '../../assets/images/chat-mode.png'
import mascotImage from '../../assets/images/mascot.gif'
import voiceModeIcon from '../../assets/images/voice-mode.png'
import { ROUTES } from '../../constants/routes'
import './ModeSelectPage.scss'

const interviewModes = [
  {
    title: '음성 모드',
    description: (
      <>
        말로 답변하고 실시간으로
        <br />
        피드백을 받아보세요.
      </>
    ),
    icon: voiceModeIcon,
    path: ROUTES.VOICE_INTERVIEW,
  },
  {
    title: '채팅 모드',
    description: (
      <>
        텍스트로 답변하고 AI와
        <br />
        대화를 이어가세요.
      </>
    ),
    icon: chatModeIcon,
    path: ROUTES.CHAT_INTERVIEW,
  },
]

function ModeSelectPage() {
  return (
    <div className="mode-select">
      <div className="mode-select__dot-pattern" aria-hidden="true" />
      <span
        className="mode-select__pixel mode-select__pixel--top"
        aria-hidden="true"
      />
      <span
        className="mode-select__pixel mode-select__pixel--middle"
        aria-hidden="true"
      />
      <span
        className="mode-select__pixel mode-select__pixel--bottom"
        aria-hidden="true"
      />

      <header className="mode-select__header">
        <Link
          className="mode-brand"
          to={ROUTES.HOME}
          aria-label="코드픽 홈"
        >
          <span className="mode-brand__symbol" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="mode-brand__name">CODEPICK</span>
        </Link>

        <nav aria-label="주요 메뉴">
          <Link className="mode-select__my-page-link" to={ROUTES.MY_PAGE}>
            마이페이지
          </Link>
        </nav>
      </header>

      <main className="mode-select__main">
        <section className="mode-select__content">
          <p className="mode-select__eyebrow">
            <span aria-hidden="true" />
            INTERVIEW MODE
          </p>

          <h1 className="mode-select__title">
            어떤 방식으로
            <br />
            면접 연습을 할까요?
          </h1>

          <p className="mode-select__description">
            원하는 모드를 선택하면 AI 면접관이 함께 연습해드려요.
          </p>

          <div className="mode-select__cards">
            {interviewModes.map((mode) => (
              <Link
                className="mode-card"
                to={mode.path}
                key={mode.title}
                aria-label={`${mode.title} 시작하기`}
              >
                <img
                  className="mode-card__icon"
                  src={mode.icon}
                  alt=""
                  aria-hidden="true"
                />
                <h2 className="mode-card__title">{mode.title}</h2>
                <p className="mode-card__description">{mode.description}</p>
                <span className="mode-card__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="mode-select__mascot" aria-label="AI 면접관 안내">
          <div className="mode-select__mascot-glow" aria-hidden="true" />
          <div className="mode-select__mascot-grid" aria-hidden="true" />
          <span
            className="mode-select__mini-pixels mode-select__mini-pixels--top"
            aria-hidden="true"
          />
          <span
            className="mode-select__mini-pixels mode-select__mini-pixels--bottom"
            aria-hidden="true"
          />
          <img
            src={mascotImage}
            alt="면접 모드를 안내하는 코드픽 AI 면접관 마스코트"
          />
          <div className="mode-select__shadow" aria-hidden="true" />
        </aside>
      </main>

      <footer className="mode-select__footer">© CODEPICK</footer>
    </div>
  )
}

export default ModeSelectPage
