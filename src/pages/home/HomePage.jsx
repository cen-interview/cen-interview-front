import { Link } from 'react-router-dom'
import mascotImage from '../../assets/images/mascot.gif'
import { ROUTES } from '../../constants/routes'
import './HomePage.scss'

function HomePage() {
  return (
    <div className="home">
      <div className="home__dot-pattern" aria-hidden="true" />
      <span className="home__pixel home__pixel--left-top" aria-hidden="true" />
      <span className="home__pixel home__pixel--left-bottom" aria-hidden="true" />
      <span className="home__pixel home__pixel--right-bottom" aria-hidden="true" />

      <header className="home__header">
        <Link className="brand" to={ROUTES.HOME} aria-label="코드픽 홈">
          <span className="brand__symbol" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="brand__name">CEN-INTERVIEW</span>
        </Link>

        <nav aria-label="주요 메뉴">
          <Link className="home__my-page-link" to={ROUTES.MY_PAGE}>
            마이페이지
          </Link>
        </nav>
      </header>

      <main className="home__main">
        <section className="home__content">
          <p className="home__eyebrow">
            <span aria-hidden="true" />
            AI 기술면접 연습 서비스
          </p>

          <h1 className="home__title">
            <span>말해보센에서</span>
            <span>
              <strong>기술 면접</strong>을 준비하세요
            </span>
          </h1>

          <p className="home__description">
            AI 면접관과 1:1로 실전처럼 연습하고, 면접이 끝나면 바로
            피드백 리포트를 받아보세요.
          </p>

          <div className="home__actions">
            <Link
              className="home__button home__button--primary"
              to={ROUTES.MODE_SELECT}
            >
              면접 연습하러가기
              <span className="home__button-arrow" aria-hidden="true">
                ▶
              </span>
            </Link>
            <Link
              className="home__button home__button--secondary"
              to={ROUTES.MY_PAGE}
            >
              연습기록 확인하기
            </Link>
          </div>
        </section>

        <section className="mascot-stage" aria-label="AI 면접관">
          <div className="mascot-stage__backdrop" aria-hidden="true" />
          <div className="mascot-stage__grid" aria-hidden="true" />

          <div className="mascot-stage__status">
            <span aria-hidden="true" />
            AI 면접관 · 대기중
          </div>

          <img
            className="mascot-stage__image"
            src={mascotImage}
            alt="정장을 입고 인사하는 코드픽 AI 면접관 마스코트"
          />

          <span
            className="mascot-stage__pixel mascot-stage__pixel--top"
            aria-hidden="true"
          />
          <span
            className="mascot-stage__pixel mascot-stage__pixel--bottom"
            aria-hidden="true"
          />
        </section>
      </main>

      <footer className="home__footer">© CEN-INTERVIEW</footer>
    </div>
  )
}

export default HomePage
