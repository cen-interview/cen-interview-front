import { Link, useLocation, useParams } from 'react-router-dom'
import reportMascotImage from '../../assets/images/report-mascot.png'
import AppBrand from '../../components/common/AppBrand'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import { getChatInterviewReport } from '../../features/interview/reportStorage.js'
import './ReportPage.scss'

const clampScore = (score) => Math.min(100, Math.max(0, Number(score) || 0))

const getScorePresentation = (score) => {
  if (score >= 85) {
    return { level: '훌륭해요!', tone: 'great' }
  }

  if (score >= 70) {
    return { level: '잘했어요!', tone: 'good' }
  }

  return { level: '보완이 필요해요', tone: 'normal' }
}

const getEvaluationPoints = (evaluation) => {
  const rationale = (evaluation.quality_trace ?? []).flatMap(
    (trace) => trace.rationale ?? [],
  )

  if (evaluation.delivery_note) {
    rationale.push(evaluation.delivery_note)
  }

  return [...new Set(rationale.filter(Boolean))]
}

function LineIcon({ name }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5.5 9v11h13V9M9 20v-6h6v6" />
      </>
    ),
    star: (
      <path d="m12 2.8 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8Z" />
    ),
    thumb: (
      <>
        <path d="M7.5 20H4V9.5h3.5" />
        <path d="M7.5 10 12 3.5c1.3.3 1.7 1.4 1.4 2.8L13 9h5.2c1.4 0 2.2 1.2 1.9 2.5l-1.4 6c-.3 1.1-1.2 1.8-2.3 1.8H7.5V10Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 3.3L16.5 8l-3.3 1.7L12 13l-1.2-3.3L7.5 8l3.3-1.7L12 3Z" />
        <path d="m6 13 .8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13Zm12-1 .6 1.4L20 14l-1.4.6L18 16l-.6-1.4L16 14l1.4-.6L18 12Z" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5c3.2-.8 5.8-.1 8 2v12c-2.2-2.1-4.8-2.8-8-2V5.5Z" />
        <path d="M20 5.5c-3.2-.8-5.8-.1-8 2v12c2.2-2.1 4.8-2.8 8-2V5.5Z" />
      </>
    ),
    people: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M6.5 19c.3-3 2.2-5 5.5-5s5.2 2 5.5 5" />
        <circle cx="5" cy="10" r="2" />
        <circle cx="19" cy="10" r="2" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function SummaryCard({ card }) {
  const items = card.items.length > 0 ? card.items : ['제공된 내용이 없습니다.']

  return (
    <article className={`summary-card summary-card--${card.type}`}>
      <h3>
        <span className="summary-card__icon">
          <LineIcon name={card.icon} />
        </span>
        {card.title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <span aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}

function ScoreRing({ score, tone }) {
  return (
    <div
      className={`score-ring score-ring--${tone}`}
      style={{ '--score': `${score * 3.6}deg` }}
      aria-label={`${score}점`}
    >
      <div>
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  )
}

function QuestionReview({ item, index }) {
  const score = clampScore(item.score)
  const { level, tone } = getScorePresentation(score)
  const points = getEvaluationPoints(item)

  return (
    <article className="question-review">
      <div className="question-review__content">
        <h3>
          <span>Q{index + 1}</span>
          {item.question}
        </h3>

        <div className="answer-block">
          <h4>내 답변 요약</h4>
          <p>{item.answer_summary}</p>
        </div>

        <div className="feedback-block">
          <h4>평가 코멘트</h4>
          <p>{item.comment}</p>
        </div>
      </div>

      <aside className="question-score" aria-label={`${index + 1}번 답변 평가`}>
        <span className="question-score__label">평가</span>
        <div className="question-score__result">
          <ScoreRing score={score} tone={tone} />
          <div>
            <strong className={`level-badge level-badge--${tone}`}>
              {level}
            </strong>
            {points.length > 0 && (
              <ul>
                {points.map((point) => (
                  <li key={point}>
                    <span aria-hidden="true">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </article>
  )
}

function ReportPage() {
  const location = useLocation()
  const { interviewId } = useParams()
  const report =
    location.state?.report ?? getChatInterviewReport(interviewId ?? '')

  if (!report) {
    return (
      <div className="report-page">
        <AppHeader>
          <Link className="report-header__home" to={ROUTES.HOME}>
            <LineIcon name="home" />
            홈으로
          </Link>
        </AppHeader>
        <main className="report-empty">
          <h1>면접 결과를 불러올 수 없어요.</h1>
          <p>
            현재 백엔드에서는 종료된 면접 결과를 다시 조회할 수 없습니다.
            새로운 채팅 면접을 시작해주세요.
          </p>
          <Link to={ROUTES.MODE_SELECT}>면접 모드 선택으로 이동</Link>
        </main>
      </div>
    )
  }

  const overallScore = clampScore(report.overall_score)
  const summaryCards = [
    {
      type: 'strength',
      icon: 'thumb',
      title: '강점',
      items: report.strengths ?? [],
    },
    {
      type: 'improvement',
      icon: 'spark',
      title: '보완 포인트',
      items: report.improvement_points ?? [],
    },
    {
      type: 'learning',
      icon: 'book',
      title: '추천 학습 방향',
      items: report.learning_recommendations ?? [],
    },
  ]

  return (
    <div className="report-page">
      <AppHeader>
        <Link className="report-header__home" to={ROUTES.HOME}>
          <LineIcon name="home" />
          홈으로
        </Link>
      </AppHeader>

      <main>
        <section className="report-hero">
          <div className="report-hero__copy">
            <p className="report-hero__eyebrow">
              <span>채팅 모드</span>
              AI 면접 연습
            </p>
            <h1>면접이 완료되었어요!</h1>
            <p className="report-hero__description">
              수고하셨습니다! 면접 결과를 확인하고,
              <br />
              더 성장할 수 있는 포인트를 찾아보세요.
            </p>
          </div>

          <div className="report-hero__visual">
            <div className="report-hero__bubble">
              채팅 면접이 끝났어요!
              <br />
              결과를 확인해볼까요?
            </div>
            <img
              className="report-hero__mascot"
              src={reportMascotImage}
              alt="평가 리포트를 들고 있는 AI 면접관 캐릭터"
            />
          </div>
        </section>

        <section className="report-sheet" aria-label="면접 평가 결과">
          <div className="report-overview">
            <div className="report-overview__copy">
              <h2>
                <span>
                  <LineIcon name="star" />
                </span>
                면접 결과 요약
              </h2>
              <p>{report.summary}</p>
            </div>

            <aside className="overall-score">
              <span>종합 점수</span>
              <p>
                <strong>{overallScore}</strong>
                <b>/100</b>
              </p>
              <div
                className="overall-score__bar"
                style={{ '--overall-score': `${overallScore}%` }}
                aria-label={`종합 점수 ${overallScore}점`}
              >
                <i />
              </div>
            </aside>
          </div>

          <div className="summary-grid">
            {summaryCards.map((card) => (
              <SummaryCard card={card} key={card.title} />
            ))}
          </div>

          <section className="question-section">
            <h2>
              <span>
                <LineIcon name="people" />
              </span>
              질문별 답변 평가
            </h2>
            <div className="question-section__list">
              {(report.evaluations ?? []).length > 0 ? (
                report.evaluations.map((item, index) => (
                  <QuestionReview
                    item={item}
                    index={index}
                    key={item.question_id ?? `${item.question}-${index}`}
                  />
                ))
              ) : (
                <p className="question-section__empty">
                  표시할 질문별 평가가 없습니다.
                </p>
              )}
            </div>
          </section>
        </section>
      </main>

      <footer className="report-footer">
        <AppBrand compact />
        <p>
          오늘도 성장하는 당신을 응원해요! <span aria-hidden="true">♥</span>
        </p>
      </footer>
    </div>
  )
}

export default ReportPage
