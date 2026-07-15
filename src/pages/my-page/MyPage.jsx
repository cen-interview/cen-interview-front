import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import analysisMascotImage from '../../assets/images/analysis-mascot.png'
import {
  createGitHubAuthorizeUrl,
  createGitHubSource,
  deleteEvidenceSource,
  getEvidenceIndexStatus,
  getEvidenceSummary,
  getGitHubConnectionStatus,
  getGitHubSources,
  startEvidenceIndex,
} from '../../api/githubEvidence.js'
import { getInterviewHistory } from '../../api/interview.js'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import { useAuthStore } from '../../store/authStore.js'
import './MyPage.scss'

const GITHUB_QUERY_KEYS = {
  connection: ['github', 'connection'],
  sources: ['evidence', 'github', 'sources'],
  status: ['evidence', 'index', 'status'],
  summary: ['evidence', 'summary'],
}
const INTERVIEW_HISTORY_QUERY_KEY = ['interview-results', 'history', 1, 10]
const EMPTY_GITHUB_SOURCES = []
const EMPTY_PRACTICE_RECORDS = []
const MODE_PRESENTATION = {
  chat: { label: '채팅 모드', icon: 'CH' },
  voice: { label: '음성 모드', icon: 'VO' },
}

function isGitHubRepositoryUrl(value) {
  try {
    const url = new URL(value)
    const segments = url.pathname
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)

    return (
      ['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) &&
      segments.length >= 2
    )
  } catch {
    return false
  }
}

function getRepositoryName(source) {
  return (
    (source.normalized_url || source.url)
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.git$/, '') || 'GitHub 프로젝트'
  )
}

function getRequestErrorMessage(error, fallbackMessage) {
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') return detail

  const statusMessages = {
    400: '분석할 GitHub 저장소를 먼저 등록해주세요.',
    404: 'GitHub 연결 또는 저장소 정보를 다시 확인해주세요.',
    409: '이미 분석이 진행 중입니다.',
    422: '올바른 GitHub 저장소 URL을 입력해주세요.',
    500: 'GitHub 연동을 위한 서버 설정을 확인해주세요.',
    502: 'GitHub와 통신하지 못했습니다. 잠시 후 다시 시도해주세요.',
  }

  return statusMessages[error.response?.status] || fallbackMessage
}

function getIndexPresentation(status) {
  const presentations = {
    idle: { badge: 'analyzing', label: '분석 대기' },
    running: { badge: 'analyzing', label: '분석 중' },
    success: { badge: 'complete', label: '분석 완료' },
    partial_failed: { badge: 'analyzing', label: '일부 오류' },
    failed: { badge: 'error', label: '분석 오류' },
  }

  return presentations[status] || presentations.idle
}

function formatIndexedAt(value) {
  if (!value) return '아직 분석하지 않았어요'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCompletedDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}. ${month}. ${day}`
}

function formatRelativeDate(value) {
  const completedDate = new Date(value)

  if (Number.isNaN(completedDate.getTime())) return ''

  const today = new Date()
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const completedUtc = Date.UTC(
    completedDate.getFullYear(),
    completedDate.getMonth(),
    completedDate.getDate(),
  )
  const dayDifference = Math.floor(
    (todayUtc - completedUtc) / (24 * 60 * 60 * 1000),
  )

  if (dayDifference < 0) return ''
  if (dayDifference === 0) return '오늘'
  if (dayDifference === 1) return '어제'
  if (dayDifference <= 30) return `${dayDifference}일 전`

  return ''
}

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
  const [githubNotice, setGithubNotice] = useState(null)

  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const queryEnabled = Boolean(accessToken)
  const githubStatusQuery = useQuery({
    queryKey: GITHUB_QUERY_KEYS.connection,
    queryFn: getGitHubConnectionStatus,
    enabled: queryEnabled,
  })
  const githubSourcesQuery = useQuery({
    queryKey: GITHUB_QUERY_KEYS.sources,
    queryFn: getGitHubSources,
    enabled: queryEnabled,
  })
  const evidenceSummaryQuery = useQuery({
    queryKey: GITHUB_QUERY_KEYS.summary,
    queryFn: getEvidenceSummary,
    enabled: queryEnabled,
  })
  const evidenceStatusQuery = useQuery({
    queryKey: GITHUB_QUERY_KEYS.status,
    queryFn: getEvidenceIndexStatus,
    enabled: queryEnabled,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 1500 : false,
  })
  const interviewHistoryQuery = useQuery({
    queryKey: INTERVIEW_HISTORY_QUERY_KEY,
    queryFn: () => getInterviewHistory(1, 10),
    enabled: queryEnabled,
  })

  const githubStatus = githubStatusQuery.data ?? { connected: false }
  const githubSources = githubSourcesQuery.data ?? EMPTY_GITHUB_SOURCES
  const evidenceSummary = evidenceSummaryQuery.data
  const evidenceStatus = evidenceStatusQuery.data ?? { status: 'idle' }
  const indexPresentation = getIndexPresentation(evidenceStatus.status)
  const indexFailures = evidenceStatus.result?.failures ?? []
  const historySummary = interviewHistoryQuery.data?.summary
  const practiceRecords =
    interviewHistoryQuery.data?.items ?? EMPTY_PRACTICE_RECORDS
  const totalPracticeCount = historySummary?.total_practice_count ?? 0
  const averageScore = historySummary?.average_score ?? null
  const registeredSourceCount = Object.values(
    evidenceSummary?.source_counts ?? {},
  ).reduce((total, count) => total + (Number(count) || 0), 0)
  const userName = user?.name || '사용자'
  const userInitial = userName.slice(0, 1)
  const canStartInterview = ['success', 'partial_failed'].includes(
    evidenceStatus.status,
  )
  const topicCoverage = useMemo(
    () =>
      Object.entries(
        evidenceSummary?.coverage_map?.topic_coverage ?? {},
      ).sort(([, left], [, right]) => right.confidence - left.confidence),
    [evidenceSummary],
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)

    if (
      params.get('oauth') === 'github' &&
      params.get('oauth_result') === 'connected'
    ) {
      setGithubNotice({
        type: 'success',
        message: 'GitHub 연결이 완료되었습니다.',
      })
      queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.connection })
      navigate(ROUTES.MY_PAGE, { replace: true })
    }
  }, [location.search, navigate, queryClient])

  useEffect(() => {
    if (!['success', 'partial_failed', 'failed'].includes(evidenceStatus.status)) {
      return
    }

    queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.sources })
    queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.summary })
  }, [evidenceStatus.status, queryClient])

  const connectGitHubMutation = useMutation({
    mutationFn: createGitHubAuthorizeUrl,
    onSuccess: ({ authorize_url: authorizeUrl }) => {
      window.location.assign(authorizeUrl)
    },
    onError: (error) => {
      setGithubNotice({
        type: 'error',
        message: getRequestErrorMessage(
          error,
          'GitHub 연결을 시작하지 못했습니다.',
        ),
      })
    },
  })

  const startIndexMutation = useMutation({
    mutationFn: startEvidenceIndex,
    onSuccess: (status) => {
      queryClient.setQueryData(GITHUB_QUERY_KEYS.status, status)
      setGithubNotice({
        type: 'success',
        message: 'GitHub 저장소를 등록하고 분석을 시작했습니다.',
      })
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        evidenceStatusQuery.refetch()
      }

      setGithubNotice({
        type: 'error',
        message: getRequestErrorMessage(
          error,
          'GitHub 저장소 분석을 시작하지 못했습니다.',
        ),
      })
    },
  })

  const createSourceMutation = useMutation({
    mutationFn: createGitHubSource,
    onSuccess: (source) => {
      setGithubDraft('')
      queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.sources })
      queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.summary })
      startIndexMutation.mutate([source.id])
    },
    onError: (error) => {
      setGithubNotice({
        type: 'error',
        message: getRequestErrorMessage(
          error,
          'GitHub 저장소를 등록하지 못했습니다.',
        ),
      })
    },
  })

  const deleteSourceMutation = useMutation({
    mutationFn: deleteEvidenceSource,
    onSuccess: () => {
      setGithubNotice({
        type: 'success',
        message: '저장소 링크를 삭제했습니다. 기존 분석 결과는 다시 분석할 때 정리됩니다.',
      })
      queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.sources })
      queryClient.invalidateQueries({ queryKey: GITHUB_QUERY_KEYS.summary })
    },
    onError: (error) => {
      setGithubNotice({
        type: 'error',
        message: getRequestErrorMessage(
          error,
          'GitHub 저장소를 삭제하지 못했습니다.',
        ),
      })
    },
  })

  const isGithubSubmitPending =
    createSourceMutation.isPending ||
    startIndexMutation.isPending ||
    evidenceStatus.status === 'running'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

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

    if (!isGitHubRepositoryUrl(nextUrl)) {
      setGithubNotice({
        type: 'error',
        message: 'https://github.com/{소유자}/{저장소} 형식으로 입력해주세요.',
      })
      return
    }

    setGithubNotice(null)
    createSourceMutation.mutate(nextUrl)
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
            <h1>안녕하세요, {userName}님!</h1>
            <p>
              학습 자료와 면접 연습 기록을 한곳에서 관리하고 확인해보세요.
            </p>
          </div>
          <p className="my-page__updated">
            <LineIcon name="refresh" />
            최근 분석 업데이트 · {formatIndexedAt(evidenceSummary?.last_indexed_at)}
          </p>
        </section>

        <section className="profile-card" aria-label="사용자 정보">
          <div className="profile-card__user">
            <div className="profile-card__avatar" aria-hidden="true">
              <span>{userInitial}</span>
            </div>
            <div>
              <div className="profile-card__name-row">
                <h2>{userName}</h2>
                <span>아이티센 교육생</span>
              </div>
              <p>{user?.email ?? ''}</p>
            </div>
          </div>

          <dl className="profile-card__stats">
            <div>
              <dt>총 연습</dt>
              <dd className={interviewHistoryQuery.isPending ? 'is-loading' : ''}>
                {interviewHistoryQuery.isPending ? '···' : totalPracticeCount}
                <span>회</span>
              </dd>
            </div>
            <div>
              <dt>등록 자료</dt>
              <dd className={evidenceSummaryQuery.isPending ? 'is-loading' : ''}>
                {evidenceSummaryQuery.isPending ? '···' : registeredSourceCount}
                <span>개</span>
              </dd>
            </div>
            <div>
              <dt>평균 점수</dt>
              <dd className={interviewHistoryQuery.isPending ? 'is-loading' : ''}>
                {interviewHistoryQuery.isPending
                  ? '···'
                  : averageScore === null
                    ? '-'
                    : Math.round(averageScore)}
                {averageScore !== null && !interviewHistoryQuery.isPending && (
                  <span>점</span>
                )}
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
                  <div className="source-card__header-actions">
                    {githubStatus.connected && (
                      <StatusBadge status="complete">연결됨</StatusBadge>
                    )}
                    <span className="source-card__count">
                      {githubSources.length}개 등록
                    </span>
                  </div>
                </header>

                <div
                  className={`github-connection${
                    githubStatus.connected ? ' github-connection--connected' : ''
                  }`}
                >
                  <div>
                    <strong>
                      {githubStatusQuery.isFetching
                        ? 'GitHub 연결 상태 확인 중'
                        : !accessToken
                          ? '로그인 후 GitHub를 연결할 수 있어요'
                        : githubStatus.connected
                          ? `@${githubStatus.account_name || 'GitHub 사용자'}`
                          : 'GitHub 계정을 먼저 연결해주세요'}
                    </strong>
                    <small>
                      {githubStatus.connected
                        ? '등록한 저장소를 읽어 면접 근거를 만들 수 있어요.'
                        : '연결 후 공개 및 권한이 허용된 저장소를 분석할 수 있어요.'}
                    </small>
                  </div>
                  {!githubStatus.connected && !githubStatusQuery.isFetching && (
                    <button
                      type="button"
                      disabled={connectGitHubMutation.isPending || !accessToken}
                      onClick={() => connectGitHubMutation.mutate()}
                    >
                      {connectGitHubMutation.isPending
                        ? '연결 준비 중...'
                        : 'GitHub 연결'}
                    </button>
                  )}
                </div>

                {githubNotice && (
                  <p
                    className={`github-notice github-notice--${githubNotice.type}`}
                    role={githubNotice.type === 'error' ? 'alert' : 'status'}
                  >
                    {githubNotice.message}
                  </p>
                )}

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
                      disabled={
                        !githubStatus.connected || isGithubSubmitPending
                      }
                    />
                    <button
                      type="submit"
                      disabled={
                        !githubStatus.connected || isGithubSubmitPending
                      }
                    >
                      <LineIcon name="plus" />
                      {createSourceMutation.isPending
                        ? '등록 중'
                        : startIndexMutation.isPending ||
                            evidenceStatus.status === 'running'
                          ? '분석 중'
                          : '추가'}
                    </button>
                  </div>
                  <p>
                    {githubStatus.connected
                      ? 'GitHub 저장소 주소를 추가하면 분석이 바로 시작됩니다.'
                      : '저장소를 등록하려면 먼저 GitHub 계정을 연결해주세요.'}
                  </p>
                </form>

                <div className="github-list">
                  <div className="github-list__label">
                    <span>등록된 프로젝트</span>
                    <small>{githubSources.length}개 등록</small>
                  </div>
                  {githubSourcesQuery.isFetching && !githubSourcesQuery.data && (
                    <p className="github-list__empty">저장소 목록을 불러오고 있어요.</p>
                  )}
                  {!githubSourcesQuery.isFetching && githubSources.length === 0 && (
                    <p className="github-list__empty">
                      아직 등록한 GitHub 저장소가 없습니다.
                    </p>
                  )}
                  {githubSources.map((source) => (
                    <div className="github-project" key={source.id}>
                      <span className="github-project__icon" aria-hidden="true">
                        <LineIcon name="code" />
                      </span>
                      <span className="github-project__info">
                        <strong>{getRepositoryName(source)}</strong>
                        <small>{source.normalized_url || source.url}</small>
                      </span>
                      <StatusBadge status={indexPresentation.badge}>
                        {indexPresentation.label}
                      </StatusBadge>
                      <button
                        className="github-project__delete"
                        type="button"
                        disabled={
                          evidenceStatus.status === 'running' ||
                          deleteSourceMutation.isPending
                        }
                        onClick={() => deleteSourceMutation.mutate(source.id)}
                      >
                        삭제
                      </button>
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
                  <h3>GitHub 프로젝트를 읽고 있어요</h3>
                  <span>
                    구현 경험과 코드 구조를 근거로
                    <br />
                    나에게 맞는 기술면접 질문을 만들어요.
                  </span>
                </div>
                <img
                  src={analysisMascotImage}
                  alt="학습 자료를 분석하는 AI 면접관 마스코트"
                />
              </div>

              <div className="analysis-card__flow" aria-label="자료 분석 과정">
                <div>
                  <span className="analysis-card__flow-icon">
                    <LineIcon name="code" />
                  </span>
                  <small>GitHub</small>
                </div>
                <span className="analysis-card__arrow">→</span>
                <div>
                  <span className="analysis-card__flow-icon analysis-card__flow-icon--result">
                    <LineIcon name="spark" />
                  </span>
                  <small>Evidence</small>
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
                    <small>등록 저장소</small>
                    <strong>{evidenceSummary?.source_counts?.github ?? githubSources.length}개</strong>
                  </span>
                </div>
                <div>
                  <span className="analysis-card__summary-icon analysis-card__summary-icon--analyzing">
                    <LineIcon name="refresh" />
                  </span>
                  <span>
                    <small>Evidence</small>
                    <strong>{evidenceSummary?.chunk_count ?? 0}개</strong>
                  </span>
                </div>
                <div>
                  <span className="analysis-card__summary-icon analysis-card__summary-icon--error">
                    <LineIcon name="alert" />
                  </span>
                  <span>
                    <small>분석 오류</small>
                    <strong>{indexFailures.length}개</strong>
                  </span>
                </div>
              </div>

              <div className="analysis-card__insight">
                <p>
                  {topicCoverage.length > 0
                    ? 'GitHub에서 발견한 주요 기술 주제'
                    : 'GitHub에서는 이런 내용을 찾고 있어요'}
                </p>
                <div>
                  {topicCoverage.length > 0 ? (
                    topicCoverage.slice(0, 5).map(([topic, coverage]) => (
                      <span key={topic}>
                        {topic} {Math.round(coverage.confidence * 100)}%
                      </span>
                    ))
                  ) : (
                    <>
                      <span>기술 스택</span>
                      <span>구현 기능</span>
                      <span>코드 구조</span>
                    </>
                  )}
                </div>
              </div>

              {canStartInterview ? (
                <Link
                  className="analysis-card__detail"
                  to={ROUTES.MODE_SELECT}
                >
                  분석 결과로 면접 시작
                  <LineIcon name="arrow" />
                </Link>
              ) : (
                <span className="analysis-card__detail analysis-card__detail--disabled">
                  분석 완료 후 면접을 시작할 수 있어요
                </span>
              )}
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
            <span className="practice-section__total">
              전체 {interviewHistoryQuery.isPending ? '···' : totalPracticeCount}회
            </span>
          </div>

          <div className="practice-list">
            <div className="practice-list__head" aria-hidden="true">
              <span>면접 날짜</span>
              <span>면접 모드</span>
              <span>종합 점수</span>
              <span>결과 리포트</span>
            </div>
            {interviewHistoryQuery.isPending ? (
              <div className="practice-list__state" aria-live="polite">
                면접 기록을 불러오고 있어요.
              </div>
            ) : interviewHistoryQuery.isError ? (
              <div className="practice-list__state practice-list__state--error">
                <p>면접 기록을 불러오지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() => interviewHistoryQuery.refetch()}
                  disabled={interviewHistoryQuery.isFetching}
                >
                  {interviewHistoryQuery.isFetching ? '다시 불러오는 중' : '다시 시도'}
                </button>
              </div>
            ) : practiceRecords.length === 0 ? (
              <div className="practice-list__state">
                아직 완료한 면접 연습이 없습니다.
              </div>
            ) : (
              practiceRecords.map((record) => {
                const modePresentation = MODE_PRESENTATION[record.mode] ?? {
                  label: '면접 모드',
                  icon: '--',
                }
                const relativeDate = formatRelativeDate(record.completed_at)

                return (
                  <Link
                    className="practice-record"
                    key={record.result_id}
                    to={`/report/${encodeURIComponent(record.result_id)}`}
                  >
                    <span className="practice-record__date">
                      <strong>{formatCompletedDate(record.completed_at)}</strong>
                      {relativeDate && <small>{relativeDate}</small>}
                    </span>
                    <span className="practice-record__mode">
                      <i
                        className={
                          record.mode === 'voice'
                            ? 'practice-record__mode-icon practice-record__mode-icon--voice'
                            : 'practice-record__mode-icon'
                        }
                        aria-hidden="true"
                      >
                        {modePresentation.icon}
                      </i>
                      <span>
                        <strong>{modePresentation.label}</strong>
                      </span>
                    </span>
                    <span className="practice-record__score">
                      <strong>{Math.round(record.overall_score)}</strong>
                      <small>/ 100</small>
                    </span>
                    <span className="practice-record__report">
                      리포트 보기
                      <LineIcon name="arrow" />
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </section>

        <footer className="my-page__footer">
          <p>계정 이용을 마치셨나요?</p>
          <button type="button" onClick={handleLogout}>
            <LineIcon name="logout" />
            로그아웃
          </button>
        </footer>
      </main>
    </div>
  )
}

export default MyPage
