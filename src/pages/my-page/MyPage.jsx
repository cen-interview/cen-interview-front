import { useState } from 'react'
import { Link } from 'react-router-dom'
import reportMascotImage from '../../assets/images/report-mascot.png'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import './MyPage.scss'

const initialGithubProjects = [
  {
    id: 1,
    name: 'cen-interview-server',
    url: 'github.com/soyeon-dev/cen-interview-server',
    status: 'complete',
    statusLabel: '분석 완료',
  },
  {
    id: 2,
    name: 'daily-tech-note',
    url: 'github.com/soyeon-dev/daily-tech-note',
    status: 'analyzing',
    statusLabel: '분석 중',
  },
  {
    id: 3,
    name: 'spring-lab',
    url: 'github.com/soyeon-dev/spring-lab',
    status: 'error',
    statusLabel: '분석 오류',
  },
]

const practiceRecords = [
  {
    id: 'practice-240628',
    date: '2026. 06. 28',
    day: '어제',
    mode: '음성 모드',
    role: '백엔드 개발자',
    score: 86,
  },
  {
    id: 'practice-240624',
    date: '2026. 06. 24',
    day: '5일 전',
    mode: '채팅 모드',
    role: 'Java · Spring',
    score: 82,
  },
  {
    id: 'practice-240619',
    date: '2026. 06. 19',
    day: '10일 전',
    mode: '음성 모드',
    role: 'CS 기본',
    score: 78,
  },
  {
    id: 'practice-240612',
    date: '2026. 06. 12',
    day: '17일 전',
    mode: '채팅 모드',
    role: '프로젝트 심화',
    score: 91,
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
    link: (
      <>
        <path d="m9.5 14.5 5-5" />
        <path d="M7.5 17.5H6a4 4 0 0 1 0-8h3" />
        <path d="M16.5 6.5H18a4 4 0 0 1 0 8h-3" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16.5 9" />
      </>
    ),
    refresh: (
      <>
        <path d="M19 8a7.5 7.5 0 1 0 .4 7" />
        <path d="M19 3v5h-5" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v5m0 3h.01" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v5h4M9 12h6M9 16h6" />
      </>
    ),
    code: (
      <>
        <path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    logout: (
      <>
        <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.3 4.3L17 9l-3.7 1.7L12 15l-1.3-4.3L7 9l3.7-1.7L12 3Z" />
        <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-2 .7 1.8 1.8.7-1.8.7L18 17l-.7-1.8-1.8-.7 1.8-.7L18 12Z" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function StatusBadge({ status, children }) {
  return (
    <span className={`my-status my-status--${status}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}

function MyPage() {
  const [notionLink, setNotionLink] = useState(
    'https://notion.so/soyeon/backend-interview-notes',
  )
  const [notionDraft, setNotionDraft] = useState('')
  const [githubDraft, setGithubDraft] = useState('')
  const [githubProjects, setGithubProjects] = useState(initialGithubProjects)

  const handleNotionSubmit = (event) => {
    event.preventDefault()
    const nextLink = notionDraft.trim()

    if (!nextLink) return

    setNotionLink(nextLink)
    setNotionDraft('')
  }

  const handleGithubSubmit = (event) => {
    event.preventDefault()
    const nextUrl = githubDraft.trim()

    if (!nextUrl) return

    const projectName =
      nextUrl
        .split('/')
        .filter(Boolean)
        .at(-1)
        ?.replace(/\.git$/, '') || '새 프로젝트'

    setGithubProjects((projects) => [
      ...projects,
      {
        id: Date.now(),
        name: projectName,
        url: nextUrl.replace(/^https?:\/\//, ''),
        status: 'analyzing',
        statusLabel: '분석 중',
      },
    ])
    setGithubDraft('')
  }

  return (
    <div className="my-page">
      <div className="my-page__ambient" aria-hidden="true" />

      <AppHeader
        afterBrand={<span className="my-page__header-label">MY PAGE</span>}
      >
        <Link className="my-page__home-link" to={ROUTES.HOME}>
          <LineIcon name="home" />
          홈으로
        </Link>
      </AppHeader>

      <main className="my-page__main">
        <section className="my-page__intro">
          <div>
            <p className="my-page__eyebrow">
              <span aria-hidden="true" />
              나의 성장 대시보드
            </p>
            <h1>안녕하세요, 김소연님!</h1>
            <p>
              학습 자료와 면접 연습 기록을 한곳에서 관리하고 확인해보세요.
            </p>
          </div>
          <p className="my-page__updated">
            <LineIcon name="refresh" />
            최근 분석 업데이트 · 오늘 오후 2:30
          </p>
        </section>

        <section className="profile-card" aria-label="사용자 정보">
          <div className="profile-card__user">
            <div className="profile-card__avatar" aria-hidden="true">
              <span>김</span>
            </div>
            <div>
              <div className="profile-card__name-row">
                <h2>김소연</h2>
                <span>백엔드 취업 준비생</span>
              </div>
              <p>soyeon.dev@example.com</p>
              <div className="profile-card__tags">
                <span>Java</span>
                <span>Spring Boot</span>
                <span>MySQL</span>
              </div>
            </div>
          </div>

          <dl className="profile-card__stats">
            <div>
              <dt>총 연습</dt>
              <dd>
                12<span>회</span>
              </dd>
            </div>
            <div>
              <dt>등록 자료</dt>
              <dd>
                4<span>개</span>
              </dd>
            </div>
            <div>
              <dt>평균 점수</dt>
              <dd>
                84<span>점</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="learning-section">
          <div className="section-heading">
            <div>
              <span className="section-heading__number">01</span>
              <div>
                <h2>학습 자료 관리</h2>
                <p>내 자료를 연결하면 더 나다운 기술면접 질문을 만들어요.</p>
              </div>
            </div>
          </div>

          <div className="learning-grid">
            <div className="source-column">
              <article className="source-card source-card--notion">
                <header className="source-card__header">
                  <div className="source-card__title">
                    <span className="source-card__service-icon source-card__service-icon--notion">
                      N
                    </span>
                    <div>
                      <h3>Notion 학습 기록</h3>
                      <p>정리한 개념과 학습 노트를 분석해요.</p>
                    </div>
                  </div>
                  <StatusBadge status="complete">분석 완료</StatusBadge>
                </header>

                <form className="source-form" onSubmit={handleNotionSubmit}>
                  <label htmlFor="notion-url">Notion 페이지 링크</label>
                  <div className="source-form__control">
                    <LineIcon name="link" />
                    <input
                      id="notion-url"
                      onChange={(event) => setNotionDraft(event.target.value)}
                      placeholder="https://notion.so/내-학습-기록"
                      type="url"
                      value={notionDraft}
                    />
                    <button type="submit">등록</button>
                  </div>
                  <p>공개로 공유된 Notion 페이지 링크를 입력해주세요.</p>
                </form>

                <div className="registered-link">
                  <div className="registered-link__top">
                    <span>현재 등록된 링크</span>
                    <time dateTime="2026-06-29T14:30">
                      10분 전 분석 완료
                    </time>
                  </div>
                  <a href={notionLink} target="_blank" rel="noreferrer">
                    <span className="registered-link__icon">
                      <LineIcon name="document" />
                    </span>
                    <span>
                      <strong>백엔드 기술면접 학습 노트</strong>
                      <small>{notionLink}</small>
                    </span>
                    <LineIcon name="arrow" />
                  </a>
                </div>
              </article>

              <article className="source-card source-card--github">
                <header className="source-card__header">
                  <div className="source-card__title">
                    <span className="source-card__service-icon source-card__service-icon--github">
                      <LineIcon name="code" />
                    </span>
                    <div>
                      <h3>GitHub 프로젝트</h3>
                      <p>여러 프로젝트를 등록해 코드 경험을 연결해요.</p>
                    </div>
                  </div>
                  <span className="source-card__count">
                    {githubProjects.length}개 등록
                  </span>
                </header>

                <form className="source-form" onSubmit={handleGithubSubmit}>
                  <label htmlFor="github-url">새 프로젝트 링크</label>
                  <div className="source-form__control">
                    <LineIcon name="link" />
                    <input
                      id="github-url"
                      onChange={(event) => setGithubDraft(event.target.value)}
                      placeholder="https://github.com/username/project"
                      type="url"
                      value={githubDraft}
                    />
                    <button type="submit">
                      <LineIcon name="plus" />
                      추가
                    </button>
                  </div>
                </form>

                <div className="github-list">
                  <div className="github-list__label">
                    <span>등록된 프로젝트</span>
                    <small>프로젝트는 여러 개 추가할 수 있어요.</small>
                  </div>
                  {githubProjects.map((project) => (
                    <div className="github-project" key={project.id}>
                      <span className="github-project__icon" aria-hidden="true">
                        <LineIcon name="code" />
                      </span>
                      <span className="github-project__info">
                        <strong>{project.name}</strong>
                        <small>{project.url}</small>
                      </span>
                      <StatusBadge status={project.status}>
                        {project.statusLabel}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <aside className="analysis-card" aria-label="자료 분석 상태">
              <div className="analysis-card__top">
                <div>
                  <p>
                    <LineIcon name="spark" />
                    AI 자료 분석
                  </p>
                  <h3>연결한 자료를 함께 읽고 있어요</h3>
                  <span>
                    학습 내용과 프로젝트 경험을 바탕으로
                    <br />
                    나에게 맞는 기술면접 질문을 만들어요.
                  </span>
                </div>
                <img
                  src={reportMascotImage}
                  alt="학습 자료를 분석하는 AI 면접관 마스코트"
                />
              </div>

              <div className="analysis-card__flow" aria-label="자료 분석 과정">
                <div>
                  <span className="analysis-card__flow-icon analysis-card__flow-icon--notion">
                    N
                  </span>
                  <small>학습 기록</small>
                </div>
                <span className="analysis-card__plus">+</span>
                <div>
                  <span className="analysis-card__flow-icon">
                    <LineIcon name="code" />
                  </span>
                  <small>프로젝트 코드</small>
                </div>
                <span className="analysis-card__arrow">→</span>
                <div>
                  <span className="analysis-card__flow-icon analysis-card__flow-icon--result">
                    <LineIcon name="spark" />
                  </span>
                  <small>맞춤 질문</small>
                </div>
              </div>

              <div className="analysis-card__summary">
                <div>
                  <span className="analysis-card__summary-icon analysis-card__summary-icon--complete">
                    <LineIcon name="check" />
                  </span>
                  <span>
                    <small>분석 완료</small>
                    <strong>3개</strong>
                  </span>
                </div>
                <div>
                  <span className="analysis-card__summary-icon analysis-card__summary-icon--analyzing">
                    <LineIcon name="refresh" />
                  </span>
                  <span>
                    <small>분석 중</small>
                    <strong>1개</strong>
                  </span>
                </div>
                <div>
                  <span className="analysis-card__summary-icon analysis-card__summary-icon--error">
                    <LineIcon name="alert" />
                  </span>
                  <span>
                    <small>분석 오류</small>
                    <strong>1개</strong>
                  </span>
                </div>
              </div>

              <div className="analysis-card__insight">
                <p>GitHub에서는 이런 내용을 찾고 있어요</p>
                <div>
                  <span>기술 스택</span>
                  <span>구현 기능</span>
                  <span>코드 구조</span>
                </div>
              </div>

              <Link
                className="analysis-card__detail"
                to={ROUTES.MY_PAGE_ANALYSIS}
              >
                분석한 자료 상세 확인
                <LineIcon name="arrow" />
              </Link>
            </aside>
          </div>
        </section>

        <section className="practice-section">
          <div className="section-heading">
            <div>
              <span className="section-heading__number">02</span>
              <div>
                <h2>연습 기록</h2>
                <p>이전 면접 결과를 다시 확인하고 성장 과정을 돌아보세요.</p>
              </div>
            </div>
            <span className="practice-section__total">전체 12회</span>
          </div>

          <div className="practice-list">
            <div className="practice-list__head" aria-hidden="true">
              <span>면접 날짜</span>
              <span>면접 모드</span>
              <span>종합 점수</span>
              <span>결과 리포트</span>
            </div>
            {practiceRecords.map((record) => (
              <Link
                className="practice-record"
                key={record.id}
                to={`/report/${record.id}`}
              >
                <span className="practice-record__date">
                  <strong>{record.date}</strong>
                  <small>{record.day}</small>
                </span>
                <span className="practice-record__mode">
                  <i
                    className={
                      record.mode === '음성 모드'
                        ? 'practice-record__mode-icon practice-record__mode-icon--voice'
                        : 'practice-record__mode-icon'
                    }
                    aria-hidden="true"
                  >
                    {record.mode === '음성 모드' ? 'VO' : 'CH'}
                  </i>
                  <span>
                    <strong>{record.mode}</strong>
                    <small>{record.role}</small>
                  </span>
                </span>
                <span className="practice-record__score">
                  <strong>{record.score}</strong>
                  <small>/ 100</small>
                </span>
                <span className="practice-record__report">
                  리포트 보기
                  <LineIcon name="arrow" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="my-page__footer">
          <p>계정 이용을 마치셨나요?</p>
          <button type="button">
            <LineIcon name="logout" />
            로그아웃
          </button>
        </footer>
      </main>
    </div>
  )
}

export default MyPage
