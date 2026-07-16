import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mascotImage from '../../assets/images/interview-mascot.gif'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import { saveChatInterviewReport } from '../../features/interview/reportStorage.js'
import { useChatInterview } from '../../hooks/useChatInterview.js'
import { useAuthStore } from '../../store/authStore.js'
import './ChatInterviewPage.scss'

const formatMessageTime = (createdAt) => {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const getLastInterviewerTurnIndex = (turns) => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === 'interviewer') {
      return index
    }
  }

  return -1
}

function InterviewProgress({ progress, isSubmitting }) {
  if (!progress) {
    return null
  }

  const statusLabel = isSubmitting
    ? '답변 분석 중'
    : progress.status === 'completed'
      ? '면접 완료'
      : progress.answered_question_count < progress.asked_question_count
        ? '답변 대기'
        : '다음 질문 준비 중'
  const statusModifier = isSubmitting ? 'analyzing' : progress.status
  const mainQuestion = progress.main_question

  return (
    <div
      className="chat-bubble__progress"
      aria-label={`면접 진행 상태: ${statusLabel}, 메인 질문 ${mainQuestion.current}/${mainQuestion.total}`}
    >
      <span
        className={`chat-bubble__progress-status chat-bubble__progress-status--${statusModifier}`}
      >
        {statusLabel}
      </span>
      <span className="chat-bubble__progress-metric">
        메인 질문
        <strong>
          {mainQuestion.current} / {mainQuestion.total}
        </strong>
      </span>
    </div>
  )
}

function ChatMessage({ turn, progress, isSubmitting = false }) {
  const isInterviewer = turn.role === 'interviewer'
  const formattedTime = formatMessageTime(turn.created_at)

  if (!isInterviewer) {
    return (
      <section className="chat-message chat-message--answer">
        <div className="chat-bubble chat-bubble--mine">
          <p className="chat-bubble__label">나의 답변</p>
          <p className="chat-bubble__answer">{turn.text}</p>
          <div className="chat-bubble__sent">
            {formattedTime && (
              <time dateTime={turn.created_at}>{formattedTime}</time>
            )}
            <span aria-label={turn.pending ? '전송 중' : '전송 완료'}>
              {turn.pending ? '…' : '✓'}
            </span>
          </div>
        </div>
      </section>
    )
  }

  if (turn.pending) {
    return (
      <section
        className="chat-message chat-message--follow-up"
        aria-label="AI 면접관이 답변을 준비하고 있습니다."
        aria-live="polite"
      >
        <InterviewerAvatar small />
        <div className="chat-bubble chat-bubble--interviewer chat-bubble--compact chat-bubble--pending">
          <p className="chat-bubble__label">AI 면접관</p>
          <div className="chat-bubble__typing" aria-hidden="true">
            <span>답변을 준비하고 있어요</span>
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="chat-message chat-message--follow-up">
      <InterviewerAvatar small />
      <div className="chat-bubble chat-bubble--interviewer chat-bubble--compact">
        <div className="chat-bubble__header">
          <p className="chat-bubble__label">AI 면접관</p>
          <InterviewProgress progress={progress} isSubmitting={isSubmitting} />
        </div>
        <p className="chat-bubble__feedback">{turn.text}</p>
        {formattedTime && (
          <time dateTime={turn.created_at}>{formattedTime}</time>
        )}
      </div>
    </section>
  )
}

function InterviewerAvatar({ small = false }) {
  return (
    <div
      className={`chat-avatar${small ? ' chat-avatar--small' : ''}`}
      aria-hidden="true"
    >
      <span className="chat-avatar__pixels chat-avatar__pixels--left" />
      <span className="chat-avatar__pixels chat-avatar__pixels--right" />
      <img src={mascotImage} alt="" />
      <span className="chat-avatar__shadow" />
    </div>
  )
}

function ChatSessionState({ errorMessage, onRetry }) {
  const hasError = Boolean(errorMessage)

  return (
    <div className="chat-interview">
      <div className="chat-interview__ambient" aria-hidden="true" />
      <AppHeader />

      <main
        className="chat-session-state"
        aria-live="polite"
        aria-busy={!hasError}
      >
        <InterviewerAvatar />
        <p className="chat-session-state__eyebrow">CHAT INTERVIEW</p>
        <h1>
          {hasError
            ? '면접을 시작하지 못했어요.'
            : 'AI 면접관이 첫 질문을 준비하고 있어요.'}
        </h1>
        <p className="chat-session-state__description">
          {hasError
            ? errorMessage
            : '잠시만 기다리면 채팅 면접이 시작됩니다.'}
        </p>

        {hasError && (
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </main>
    </div>
  )
}

function ChatInterviewPage() {
  const [draft, setDraft] = useState('')
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false)
  const pageEndRef = useRef(null)
  const textareaRef = useRef(null)
  const accessToken = useAuthStore((state) => state.accessToken)
  const navigate = useNavigate()
  const {
    session,
    phase,
    errorMessage,
    pendingAnswer,
    start,
    submitAnswer,
    end,
    retry,
  } = useChatInterview()

  useEffect(() => {
    if (!accessToken) {
      navigate(ROUTES.LOGIN, { replace: true })
      return
    }

    start()
  }, [accessToken, navigate, start])

  useEffect(() => {
    pageEndRef.current?.scrollIntoView({ block: 'end' })
  }, [session?.transcript?.length, pendingAnswer, phase])

  useEffect(() => {
    if (!session?.finished || !session.report || !session.session_id) {
      return
    }

    const reportId =
      session.result_id ?? session.report.result_id ?? session.session_id

    saveChatInterviewReport(reportId, session.report)

    navigate(
      ROUTES.REPORT.replace(
        ':interviewId',
        encodeURIComponent(reportId),
      ),
      {
        replace: true,
        state: {
          mode: 'chat',
          report: session.report,
        },
      },
    )
  }, [navigate, session])

  useEffect(() => {
    if (!isEndConfirmOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape' && phase !== 'ending') {
        setIsEndConfirmOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => window.removeEventListener('keydown', handleEscape)
  }, [isEndConfirmOpen, phase])

  const handleRetry = async () => {
    const wasEventRequest = Boolean(session?.session_id)
    const response = await retry()

    if (response && wasEventRequest) {
      setDraft('')
    }
  }

  if (!accessToken) {
    return null
  }

  if (phase === 'idle' || phase === 'starting') {
    return <ChatSessionState />
  }

  if (phase === 'error') {
    return (
      <ChatSessionState errorMessage={errorMessage} onRetry={handleRetry} />
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const answer = draft.trim()
    if (!answer) return

    setDraft('')
    const response = await submitAnswer(answer)

    if (response) {
      if (!response.finished) {
        window.requestAnimationFrame(() => textareaRef.current?.focus())
      }
    }
  }

  const handleAnswerKeyDown = (event) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.repeat
    ) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  const handleConfirmEnd = async () => {
    const response = await end()

    if (response) {
      setIsEndConfirmOpen(false)
    }
  }

  const transcript = session?.transcript ?? []
  const isSubmitting = phase === 'submitting'
  const isEnding = phase === 'ending'
  const isBusy = isSubmitting || isEnding
  const displayedTurns = pendingAnswer
    ? [
        ...transcript,
        {
          role: 'candidate',
          text: pendingAnswer.text,
          created_at: pendingAnswer.created_at,
          pending: true,
        },
        {
          role: 'interviewer',
          pending: true,
          clientEventId: pendingAnswer.clientEventId,
        },
      ]
    : transcript
  const lastInterviewerTurnIndex = getLastInterviewerTurnIndex(displayedTurns)

  return (
    <div className="chat-interview">
      <div className="chat-interview__ambient" aria-hidden="true" />

      <AppHeader>
        <div className="chat-interview__progress" aria-label="면접 진행 상황">
          <p>
            <strong>{session?.finished ? '완료' : '진행 중'}</strong>
          </p>
          {!session?.finished && (
            <button
              className="chat-interview__end-button"
              type="button"
              disabled={isBusy}
              onClick={() => setIsEndConfirmOpen(true)}
            >
              면접 종료
            </button>
          )}
        </div>
      </AppHeader>

      <main className="chat-thread">
        {displayedTurns.map((turn, index) => {
          const isCurrentInterviewerTurn = index === lastInterviewerTurnIndex

          return (
            <ChatMessage
              turn={turn}
              progress={isCurrentInterviewerTurn ? session?.progress : null}
              isSubmitting={isCurrentInterviewerTurn && isSubmitting}
              key={`${turn.role}-${turn.created_at ?? turn.clientEventId}-${turn.question_id ?? index}`}
            />
          )
        })}
      </main>

      {!session?.finished && (
        <form className="chat-composer" onSubmit={handleSubmit}>
          <div className="chat-composer__row">
            <div className="chat-composer__field">
              <textarea
                ref={textareaRef}
                aria-label="면접 답변"
                disabled={isBusy}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleAnswerKeyDown}
                placeholder="답변을 입력해보세요"
                rows={1}
                value={draft}
              />
            </div>
            <button
              className="chat-composer__submit"
              type="submit"
              disabled={!draft.trim() || isBusy}
            >
              {isSubmitting ? '처리 중...' : '제출'}
            </button>
          </div>

          <p className="chat-composer__count">
            {draft.length.toLocaleString()} / 2000
          </p>
          <p className="chat-composer__tip">
            <span aria-hidden="true">ⓘ</span>
            정확하고 논리적인 답변이 좋은 인상을 줍니다. 모르는 내용은
            솔직하게, 아는 범위 내에서 답변해보세요.
          </p>
        </form>
      )}

      <div ref={pageEndRef} aria-hidden="true" />

      {isEndConfirmOpen && (
        <div
          className="chat-end-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isEnding) {
              setIsEndConfirmOpen(false)
            }
          }}
        >
          <section
            className="chat-end-dialog__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-end-dialog-title"
            aria-describedby="chat-end-dialog-description"
          >
            <p className="chat-end-dialog__eyebrow">END INTERVIEW</p>
            <h2 id="chat-end-dialog-title">면접을 종료할까요?</h2>
            <p id="chat-end-dialog-description">
              종료하면 현재까지의 답변을 기준으로 최종 리포트를 생성합니다.
            </p>
            <div className="chat-end-dialog__actions">
              <button
                type="button"
                disabled={isEnding}
                onClick={() => setIsEndConfirmOpen(false)}
              >
                계속하기
              </button>
              <button
                className="chat-end-dialog__confirm"
                type="button"
                disabled={isEnding}
                onClick={handleConfirmEnd}
              >
                {isEnding ? '종료 중...' : '종료하기'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default ChatInterviewPage
