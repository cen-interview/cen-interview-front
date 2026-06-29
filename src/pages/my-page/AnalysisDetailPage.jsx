import { Link } from 'react-router-dom'
import reportMascotImage from '../../assets/images/report-mascot.png'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import './AnalysisDetailPage.scss'

const notionTopics = [
  {
    name: 'Java',
    count: 38,
    level: 88,
    description: 'JVM, 컬렉션, 동시성 중심으로 정리되어 있어요.',
  },
  {
    name: 'Spring',
    count: 31,
    level: 82,
    description: 'DI, AOP, 트랜잭션 흐름을 학습했어요.',
  },
  {
    name: 'Database',
    count: 27,
    level: 76,
    description: '인덱스와 트랜잭션 내용이 포함되어 있어요.',
  },
  {
    name: 'Network',
    count: 19,
    level: 68,
    description: 'HTTP와 네트워크 계층을 정리했어요.',
  },
]

const repositories = [
  {
    name: 'cen-interview-server',
    branch: 'main',
    status: 'complete',
    statusLabel: '분석 완료',
    updated: '10분 전',
  },
  {
    name: 'daily-tech-note',
    branch: 'develop',
    status: 'analyzing',
    statusLabel: '분석 중',
    updated: '진행률 64%',
  },
  {
    name: 'spring-lab',
    branch: 'main',
    status: 'error',
    statusLabel: '분석 오류',
    updated: '접근 권한 확인 필요',
  },
]

const stackGroups = [
  {
    label: 'Language',
    items: ['Java 17', 'JavaScript'],
  },
  {
    label: 'Framework',
    items: ['Spring Boot', 'Spring Security', 'JPA'],
  },
  {
    label: 'Data & Infra',
    items: ['MySQL', 'Redis', 'Docker'],
  },
]

const features = [
  {
    title: 'JWT 기반 인증',
    description: 'Access/Refresh Token을 분리하고 재발급 흐름을 구현했어요.',
    source: 'auth 패키지 · 12개 파일',
  },
  {
    title: '면접 세션 관리',
    description: '질문과 답변 상태를 세션 단위로 관리하고 저장해요.',
    source: 'interview 도메인 · 18개 파일',
  },
  {
    title: '비동기 자료 분석',
    description: '외부 AI 응답을 비동기로 처리하고 실패 상태를 관리해요.',
    source: 'analysis 도메인 · 9개 파일',
  },
]

const codeStructure = [
  ['구조', '도메인 중심 레이어드 아키텍처'],
  ['주요 도메인', 'member · interview · analysis · report'],
  ['코드 규모', 'Java 146개 파일 · 약 12.8K lines'],
  ['특징', 'DTO 분리 · 전역 예외 처리 · 공통 응답'],
]

const questionPreviews = [
  {
    number: '01',
    source: 'Notion + GitHub',
    question:
      'Spring 트랜잭션 전파 속성을 정리해두었는데, 현재 프로젝트의 면접 결과 저장 과정에는 어떤 전파 전략이 적합할까요?',
    tags: ['Spring', '트랜잭션', '프로젝트 적용'],
  },
  {
    number: '02',
    source: 'GitHub 코드',
    question:
      'JWT 재발급 과정에서 Redis를 사용한 이유와, Redis 장애 시 고려해야 할 대응 방법을 설명해주세요.',
    tags: ['JWT', 'Redis', '장애 대응'],
  },
  {
    number: '03',
    source: 'Notion 학습 기록',
    question:
      'B-Tree 인덱스의 구조를 설명하고, 인덱스가 오히려 성능을 낮추는 상황을 예로 들어주세요.',
    tags: ['Database', '인덱스'],
  },
]

function LineIcon({ name }) {
  const paths = {
    back: (
      <>
        <path d="m15 5-7 7 7 7" />
        <path d="M8 12h12" />
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
    spark: (
      <>
        <path d="m12 3 1.3 4.3L17 9l-3.7 1.7L12 15l-1.3-4.3L7 9l3.7-1.7L12 3Z" />
        <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-2 .7 1.8 1.8.7-1.8.7L18 17l-.7-1.8-1.8-.7 1.8-.7L18 12Z" />
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
    branch: (
      <>
        <circle cx="7" cy="5" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="7" cy="19" r="2" />
        <path d="M7 7v10M9 11h3a5 5 0 0 0 5-5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    question: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.1.9-1.1 1.8m0 3h.01" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    external: (
      <>
        <path d="M14 4h6v6M20 4l-9 9" />
        <path d="M18 13v7H4V6h7" />
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
    <span className={`detail-status detail-status--${status}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}

function SectionTitle({ icon, eyebrow, title, description, action }) {
  return (
    <header className="detail-section-title">
      <div className="detail-section-title__main">
        <span className="detail-section-title__icon">
          {icon === 'notion' ? 'N' : <LineIcon name={icon} />}
        </span>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
      </div>
      {action}
    </header>
  )
}

function AnalysisDetailPage() {
  return (
    <div className="analysis-detail-page">
      <div className="analysis-detail-page__ambient" aria-hidden="true" />

      <AppHeader
        afterBrand={
          <span className="analysis-detail-page__header-label">
            ANALYSIS DETAIL
          </span>
        }
      >
        <Link
          className="analysis-detail-page__back"
          to={ROUTES.MY_PAGE}
        >
          <LineIcon name="back" />
          마이페이지로
        </Link>
      </AppHeader>

      <main className="analysis-detail-page__main">
        <section className="analysis-detail-hero">
          <div className="analysis-detail-hero__copy">
            <p className="analysis-detail-hero__eyebrow">
              <LineIcon name="spark" />
              나의 자료 분석 리포트
            </p>
            <h1>
              연결한 자료를
              <br />
              이렇게 이해했어요
            </h1>
            <p className="analysis-detail-hero__description">
              학습 기록과 프로젝트 코드를 함께 읽고,
              <br />
              면접 질문에 활용할 핵심 경험을 정리했어요.
            </p>
            <div className="analysis-detail-hero__meta">
              <span>
                <LineIcon name="check" />
                최근 분석 2026. 06. 29
              </span>
              <span>총 4개 자료 연결</span>
            </div>
          </div>

          <div className="analysis-detail-hero__visual">
            <div className="analysis-detail-hero__bubble">
              분석한 내용을
              <br />
              하나씩 살펴볼까요?
            </div>
            <img
              src={reportMascotImage}
              alt="자료 분석 결과를 안내하는 AI 면접관 마스코트"
            />
          </div>
        </section>

        <section className="analysis-overview" aria-label="전체 분석 요약">
          <div className="analysis-overview__intro">
            <span>
              <LineIcon name="spark" />
            </span>
            <div>
              <p>전체 분석 요약</p>
              <h2>면접 준비에 활용할 핵심 내용을 찾았어요</h2>
            </div>
          </div>
          <dl className="analysis-overview__stats">
            <div>
              <dt>학습 주제</dt>
              <dd>
                115<span>개</span>
              </dd>
            </div>
            <div>
              <dt>기술 스택</dt>
              <dd>
                8<span>개</span>
              </dd>
            </div>
            <div>
              <dt>구현 기능</dt>
              <dd>
                12<span>개</span>
              </dd>
            </div>
            <div>
              <dt>생성 가능 질문</dt>
              <dd>
                18<span>개</span>
              </dd>
            </div>
          </dl>
        </section>

        <div className="analysis-detail-layout">
          <div className="analysis-detail-content">
            <section className="material-detail-card notion-detail">
              <SectionTitle
                icon="notion"
                eyebrow="NOTION ANALYSIS"
                title="학습 기록 분석"
                description="정리해둔 개념과 학습 흐름을 분석했어요."
                action={
                  <StatusBadge status="complete">분석 완료</StatusBadge>
                }
              />

              <a
                className="material-source"
                href="https://notion.so/soyeon/backend-interview-notes"
                target="_blank"
                rel="noreferrer"
              >
                <span className="material-source__icon">
                  <LineIcon name="document" />
                </span>
                <span>
                  <small>분석한 Notion 페이지</small>
                  <strong>백엔드 기술면접 학습 노트</strong>
                </span>
                <span className="material-source__url">
                  notion.so/soyeon/backend-interview-notes
                </span>
                <LineIcon name="external" />
              </a>

              <div className="notion-detail__heading">
                <div>
                  <h3>주제별 학습 현황</h3>
                  <p>페이지 내 키워드와 정리된 내용의 깊이를 기준으로 분석했어요.</p>
                </div>
                <span>총 42개 페이지 분석</span>
              </div>

              <div className="notion-topic-grid">
                {notionTopics.map((topic, index) => (
                  <article
                    className={`notion-topic notion-topic--${index + 1}`}
                    key={topic.name}
                  >
                    <div className="notion-topic__top">
                      <span>{topic.name.slice(0, 2).toUpperCase()}</span>
                      <p>
                        <strong>{topic.name}</strong>
                        <small>{topic.count}개 주제</small>
                      </p>
                      <b>{topic.level}%</b>
                    </div>
                    <div
                      className="notion-topic__progress"
                      aria-label={`${topic.name} 학습 밀도 ${topic.level}%`}
                    >
                      <i style={{ width: `${topic.level}%` }} />
                    </div>
                    <p className="notion-topic__description">
                      {topic.description}
                    </p>
                  </article>
                ))}
              </div>

              <div className="notion-insight">
                <div className="notion-insight__title">
                  <span>
                    <LineIcon name="spark" />
                  </span>
                  <div>
                    <p>AI가 발견한 학습 특징</p>
                    <h3>개념 이해는 탄탄하고, 실무 연결을 보완하면 좋아요</h3>
                  </div>
                </div>
                <ul>
                  <li>
                    <span>강점</span>
                    Java와 Spring의 핵심 개념이 질문·답변 형태로 잘 정리되어
                    있어요.
                  </li>
                  <li>
                    <span>연결</span>
                    트랜잭션, 인증 관련 내용은 실제 GitHub 구현과 연결할 수
                    있어요.
                  </li>
                  <li>
                    <span>보완</span>
                    네트워크 장애 상황과 성능 개선 사례를 더 정리하면 좋아요.
                  </li>
                </ul>
              </div>

              <div className="keyword-group">
                <p>자주 등장한 핵심 키워드</p>
                <div>
                  <span>트랜잭션</span>
                  <span>JVM</span>
                  <span>Spring Security</span>
                  <span>인덱스</span>
                  <span>동시성</span>
                  <span>HTTP</span>
                  <span>객체지향</span>
                  <span>캐시</span>
                </div>
              </div>
            </section>

            <section className="material-detail-card github-detail">
              <SectionTitle
                icon="code"
                eyebrow="GITHUB ANALYSIS"
                title="프로젝트 코드 분석"
                description="기술 스택, 구현 기능과 코드 구조를 읽었어요."
                action={<span className="github-detail__count">3개 프로젝트</span>}
              />

              <div className="repository-list">
                {repositories.map((repository) => (
                  <article className="repository-item" key={repository.name}>
                    <span className="repository-item__icon">
                      <LineIcon name="code" />
                    </span>
                    <span className="repository-item__info">
                      <strong>{repository.name}</strong>
                      <small>
                        <LineIcon name="branch" />
                        {repository.branch}
                      </small>
                    </span>
                    <span className="repository-item__state">
                      <StatusBadge status={repository.status}>
                        {repository.statusLabel}
                      </StatusBadge>
                      <small>{repository.updated}</small>
                    </span>
                  </article>
                ))}
              </div>

              <div className="selected-project">
                <div className="selected-project__heading">
                  <div>
                    <span>분석 완료 프로젝트</span>
                    <h3>cen-interview-server</h3>
                    <p>AI 기술면접 서비스의 백엔드 API 프로젝트</p>
                  </div>
                  <a
                    href="https://github.com/soyeon-dev/cen-interview-server"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub에서 보기
                    <LineIcon name="external" />
                  </a>
                </div>

                <section className="stack-analysis">
                  <h4>
                    <span>
                      <LineIcon name="layers" />
                    </span>
                    발견한 기술 스택
                  </h4>
                  <div className="stack-analysis__groups">
                    {stackGroups.map((group) => (
                      <div key={group.label}>
                        <p>{group.label}</p>
                        <div>
                          {group.items.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="code-analysis-grid">
                  <section className="feature-analysis">
                    <h4>주요 구현 기능</h4>
                    <div>
                      {features.map((feature, index) => (
                        <article key={feature.title}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <div>
                            <h5>{feature.title}</h5>
                            <p>{feature.description}</p>
                            <small>{feature.source}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="structure-analysis">
                    <h4>코드 구조 요약</h4>
                    <dl>
                      {codeStructure.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="structure-analysis__note">
                      <LineIcon name="check" />
                      면접에서 설명할 수 있는 구현 근거가 충분해요.
                    </div>
                  </section>
                </div>
              </div>
            </section>
          </div>

          <aside className="question-preview">
            <div className="question-preview__header">
              <span>
                <LineIcon name="question" />
              </span>
              <p>INTERVIEW PREVIEW</p>
              <h2>이런 질문을 만들 수 있어요</h2>
              <div>
                Notion의 개념과 GitHub 구현을 연결해
                <br />
                프로젝트 기반 질문을 구성했어요.
              </div>
            </div>

            <div className="question-preview__list">
              {questionPreviews.map((item) => (
                <article className="preview-question" key={item.number}>
                  <div className="preview-question__meta">
                    <span>Q{item.number}</span>
                    <small>{item.source}</small>
                  </div>
                  <p>{item.question}</p>
                  <div className="preview-question__tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="question-preview__more">
              <strong>+ 15</strong>
              <span>개의 질문을 더 만들 수 있어요</span>
            </div>

            <Link
              className="question-preview__action"
              to={ROUTES.MODE_SELECT}
            >
              이 자료로 면접 연습 시작
              <LineIcon name="arrow" />
            </Link>

            <p className="question-preview__notice">
              자료를 수정하면 다음 분석부터 질문에도 반영돼요.
            </p>
          </aside>
        </div>

        <footer className="analysis-detail-footer">
          <p>
            분석 결과는 등록된 학습 자료를 바탕으로 만든 예시 데이터입니다.
          </p>
          <Link to={ROUTES.MY_PAGE}>
            <LineIcon name="back" />
            마이페이지로 돌아가기
          </Link>
        </footer>
      </main>
    </div>
  )
}

export default AnalysisDetailPage
