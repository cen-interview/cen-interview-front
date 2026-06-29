import { useState } from 'react'
import mascotImage from '../../assets/images/mascot.gif'
import AppHeader from '../../components/common/AppHeader'
import './ChatInterviewPage.scss'

const initialAnswer = `REST API는 리소스 중심의 아키텍처로, HTTP 메서드(GET, POST, PUT, DELETE)를
사용해 데이터를 CRUD 합니다. 각 엔드포인트는 고정된 구조의 응답을 반환합니다.
반면 GraphQL은 쿼리 언어를 사용하여 클라이언트가 필요한 데이터만 정확히 요청할 수 있고,
단일 엔드포인트로 다양한 데이터를 조회할 수 있습니다.
또한 타입 시스템을 통해 스키마 기반의 강력한 검증과 자동 문서화가 가능합니다.`

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m20.5 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l9.1-9.1a3.5 3.5 0 1 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.4-8.4" />
    </svg>
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

function ChatInterviewPage() {
  const [draft, setDraft] = useState('')
  const [submittedAnswer, setSubmittedAnswer] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    const answer = draft.trim()
    if (!answer) return

    setSubmittedAnswer(answer)
    setDraft('')
  }

  return (
    <div className="chat-interview">
      <div className="chat-interview__ambient" aria-hidden="true" />

      <AppHeader>
        <div className="chat-interview__progress" aria-label="면접 진행 상황">
          <p>
            질문 <strong>2</strong> / 5
          </p>
          <span aria-hidden="true" />
          <time dateTime="PT4M32S">
            <ClockIcon />
            00:04:32
          </time>
        </div>
      </AppHeader>

      <main className="chat-thread">
        <section className="chat-message chat-message--question">
          <InterviewerAvatar />
          <div className="chat-bubble chat-bubble--interviewer">
            <span className="chat-bubble__tail" aria-hidden="true" />
            <p className="chat-bubble__label">AI 면접관</p>
            <h1>REST API와 GraphQL의 차이를 설명해보세요.</h1>
            <time dateTime="10:30">오전 10:30</time>
          </div>
        </section>

        <section className="chat-message chat-message--answer">
          <div className="chat-bubble chat-bubble--mine">
            <p className="chat-bubble__label">나의 답변</p>
            <p className="chat-bubble__answer">{initialAnswer}</p>
            <div className="chat-bubble__sent">
              <time dateTime="10:33">오전 10:33</time>
              <span aria-label="전송 완료">✓</span>
            </div>
          </div>
        </section>

        <section className="chat-message chat-message--follow-up">
          <InterviewerAvatar small />
          <div className="chat-bubble chat-bubble--interviewer chat-bubble--compact">
            <span className="chat-bubble__tail" aria-hidden="true" />
            <p className="chat-bubble__label">AI 면접관</p>
            <p className="chat-bubble__feedback">
              좋은 답변입니다! 핵심 차이를 잘 짚어주셨네요.
              <br />
              각 방식의 장단점을 구체적인 예시와 함께 설명해볼 수 있을까요?
            </p>
            <time dateTime="10:34">오전 10:34</time>
          </div>
        </section>

        {submittedAnswer && (
          <section className="chat-message chat-message--answer chat-message--new">
            <div className="chat-bubble chat-bubble--mine">
              <p className="chat-bubble__label">나의 답변</p>
              <p className="chat-bubble__answer">{submittedAnswer}</p>
              <div className="chat-bubble__sent">
                <span>방금</span>
                <span aria-label="전송 완료">✓</span>
              </div>
            </div>
          </section>
        )}
      </main>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <div className="chat-composer__row">
          <div className="chat-composer__field">
            <textarea
              aria-label="면접 답변"
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="답변을 입력해보세요"
              rows={1}
              value={draft}
            />
            <button
              className="chat-composer__attach"
              type="button"
              aria-label="파일 첨부"
            >
              <AttachIcon />
            </button>
          </div>
          <button
            className="chat-composer__submit"
            type="submit"
            disabled={!draft.trim()}
          >
            제출
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
    </div>
  )
}

export default ChatInterviewPage
