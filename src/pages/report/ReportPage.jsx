import { Link } from 'react-router-dom'
import reportMascotImage from '../../assets/images/report-mascot.png'
import AppBrand from '../../components/common/AppBrand'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import './ReportPage.scss'

const summaryCards = [
  {
    type: 'strength',
    icon: 'thumb',
    title: '강점',
    items: [
      '기술 개념에 대한 이해가 정확해요',
      '답변 구조가 논리적이고 명확해요',
      '문제 해결 경험을 잘 설명했어요',
    ],
  },
  {
    type: 'improvement',
    icon: 'spark',
    title: '보완 포인트',
    items: [
      '답변에 구체적인 예시가 부족해요',
      '성능과 예외 상황에 대한 언급이 더 필요해요',
      '핵심부터 답하는 연습을 해보세요',
    ],
  },
  {
    type: 'learning',
    icon: 'book',
    title: '추천 학습 방향',
    items: [
      '실제 프로젝트 경험을 구조화하기',
      '시스템 설계 질문 연습하기',
      '예외 처리와 성능 최적화 학습하기',
    ],
  },
]

const questionReviews = [
  {
    question: '데이터베이스 인덱스의 장단점에 대해 설명해주세요.',
    answer:
      '인덱스는 검색 성능을 향상시키지만, 쓰기 성능이 저하될 수 있습니다. 또한, 인덱스가 많아지면 저장 공간이 더 필요합니다.',
    feedback:
      '인덱스의 장단점을 잘 설명했어요. B-Tree 인덱스의 구조나 동작 방식까지 언급하면 더 좋아요.',
    score: 85,
    level: '잘했어요!',
    tone: 'good',
    points: ['핵심 내용을 정확히 이해했어요', '장단점을 균형 있게 설명했어요'],
  },
  {
    question: '동시에 여러 요청이 들어왔을 때, 서버는 어떻게 처리하나요?',
    answer:
      '멀티 스레드나 비동기 방식으로 요청을 처리합니다. 스레드 풀을 사용해서 리소스를 효율적으로 관리합니다.',
    feedback:
      '기본 개념은 잘 이해하고 있어요. 동시성과 관련된 문제와 교착 상태 등도 함께 설명해보세요.',
    score: 75,
    level: '보통이에요',
    tone: 'normal',
    points: ['기본 개념은 잘 설명했어요', '심화 개념 보완이 필요해요'],
  },
  {
    question: 'REST API와 RESTful의 차이에 대해 설명해주세요.',
    answer:
      'REST는 아키텍처 스타일이고, RESTful은 REST 원칙을 따르는 API를 의미합니다. HTTP 메서드와 상태 코드를 적절히 사용하는 것이 중요합니다.',
    feedback:
      '정확한 답변이에요! REST 원칙과 캐시, 계층화 등까지 설명하면 완벽해요.',
    score: 90,
    level: '훌륭해요!',
    tone: 'great',
    points: ['정확하고 완전한 답변이에요', '실무 이해도가 높아 보여요'],
  },
  {
    question: '이전에 해결했던 가장 어려운 기술적 문제는 무엇이었나요?',
    answer:
      '트래픽 급증으로 서버가 불안정했던 경험이 있습니다. DB 쿼리 최적화와 캐싱 도입으로 문제를 해결했습니다.',
    feedback:
      '좋은 경험을 공유했어요! 문제 해결 과정과 고민했던 점을 더 구체적으로 설명하면 좋아요.',
    score: 78,
    level: '보통이에요',
    tone: 'normal',
    points: ['문제 해결 경험이 좋아요', '과정과 결과를 더 구체화해요'],
  },
]

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
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4" />
        <path d="M5 18v3h14v-3" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function ImagePlaceholder({ label }) {
  return (
    <div className="report-image-placeholder" aria-label={`${label} 이미지 영역`}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="5" width="26" height="22" rx="3" />
        <circle cx="11" cy="13" r="2.2" />
        <path d="m6 24 7-7 5 5 3-3 5 5" />
      </svg>
      <span>{label}</span>
    </div>
  )
}

function SummaryCard({ card }) {
  return (
    <article className={`summary-card summary-card--${card.type}`}>
      <h3>
        <span className="summary-card__icon">
          <LineIcon name={card.icon} />
        </span>
        {card.title}
      </h3>
      <ul>
        {card.items.map((item) => (
          <li key={item}>
            <span aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
      <ImagePlaceholder label="일러스트 영역" />
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
  return (
    <article className="question-review">
      <div className="question-review__content">
        <h3>
          <span>Q{index + 1}</span>
          {item.question}
        </h3>

        <div className="answer-block">
          <h4>내 답변 요약</h4>
          <p>{item.answer}</p>
        </div>

        <div className="feedback-block">
          <h4>평가 코멘트</h4>
          <p>{item.feedback}</p>
        </div>
      </div>

      <aside className="question-score" aria-label={`${index + 1}번 답변 평가`}>
        <span className="question-score__label">평가</span>
        <div className="question-score__result">
          <ScoreRing score={item.score} tone={item.tone} />
          <div>
            <strong className={`level-badge level-badge--${item.tone}`}>
              {item.level}
            </strong>
            <ul>
              {item.points.map((point) => (
                <li key={point}>
                  <span aria-hidden="true">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </article>
  )
}

function ReportPage() {
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
              <span>음성 모드</span>
              면접 · 백엔드 개발자
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
              면접 답변이었어요!
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
              <p>
                전반적으로 기술에 대한 이해가 탄탄하고, 논리적인 설명 능력이
                인상적이었어요.
              </p>
              <p>
                다만, 예시 중심의 구체성과 깊이 있는 확장 설명에서 조금 더
                보완하면 좋아요.
              </p>
            </div>

            <aside className="overall-score">
              <span>종합 점수</span>
              <p>
                <strong>82</strong>
                <b>/100</b>
              </p>
              <div className="overall-score__bar" aria-label="종합 점수 82점">
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
              {questionReviews.map((item, index) => (
                <QuestionReview item={item} index={index} key={item.question} />
              ))}
            </div>
          </section>

          <section className="download-report">
            <div className="download-report__info">
              <span className="download-report__document" aria-hidden="true">
                <i>PDF</i>
              </span>
              <p>
                결과 리포트를 PDF로 다운로드하고
                <br />
                나중에 다시 확인해보세요!
              </p>
            </div>
            <button type="button">
              <LineIcon name="download" />
              PDF 다운로드
            </button>
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
