import mascotImage from '../../assets/images/interview-mascot.gif'
import AppHeader from '../../components/common/AppHeader'
import './VoiceInterviewPage.scss'

const answerParagraphs = [
  <>
    네, <strong>REST API와 RESTful API의 차이</strong>에 대해
    말씀드리겠습니다.
  </>,
  <>
    먼저 REST는 Representational State Transfer의 약자로, 웹에서 자원을
    이름으로 구분하여 해당 자원의 상태를 주고받는 아키텍처 스타일입니다.
  </>,
  <>
    반면 RESTful API는 REST 원칙을 따르는 API를 의미합니다. 즉, REST는
    개념이고, RESTful은 그 개념을 따르는 구체적인 설계 방식입니다.
  </>,
  <>
    예를 들어 RESTful API는 HTTP 메서드를 적절히 사용하고, 자원을 URI로
    표현하며, 무상태성을 유지하는 등의 원칙을 지켜야 합니다.
  </>,
]

const waveform = [
  12, 22, 31, 48, 61, 38, 19, 12, 9, 17, 35, 43, 37, 18, 12, 23, 12, 16,
  34, 55, 76, 48, 28, 17, 11, 15, 28, 47, 35, 18, 11, 20, 42, 54, 32, 17,
  10, 19, 27, 17, 12, 22, 39, 48, 30, 17, 10, 15, 24, 16,
]

function VoiceInterviewPage() {
  return (
    <div className="voice-interview">
      <div className="voice-interview__ambient" aria-hidden="true" />
      <div
        className="voice-interview__dots voice-interview__dots--top"
        aria-hidden="true"
      />
      <div
        className="voice-interview__dots voice-interview__dots--bottom"
        aria-hidden="true"
      />

      <AppHeader
        afterBrand={
          <>
            <span className="voice-interview__divider" aria-hidden="true" />
            <p className="voice-interview__page-name">
              <span aria-hidden="true" />
              음성 인터뷰 진행 중
            </p>
          </>
        }
      />

      <main className="voice-interview__main">
        <section className="interviewer" aria-label="AI 면접관 질문">
          <div className="interviewer__visual">
            <div className="interviewer__glow" aria-hidden="true" />
            <img
              src={mascotImage}
              alt="헤드셋을 쓰고 질문하는 AI 면접관"
            />
            <div className="interviewer__shadow" aria-hidden="true" />
          </div>

          <div className="question-bubble">
            <span className="question-bubble__tail" aria-hidden="true" />
            <p className="question-bubble__name">면접관 센</p>
            <p className="question-bubble__text">
              REST API와 RESTful API의
              <br />
              차이를 설명해볼까요?
            </p>
          </div>
        </section>

        <section className="live-answer" aria-label="실시간 답변 내용">
          <header className="live-answer__header">
            <h1>
              <span className="live-answer__pulse" aria-hidden="true">
                <i />
              </span>
              실시간 답변
            </h1>
            <p>
              <span className="signal-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              음성 인식 중
            </p>
          </header>

          <div className="live-answer__copy">
            {answerParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <span className="live-answer__cursor" aria-hidden="true" />
          </div>
        </section>
      </main>

      <section className="voice-status" aria-label="인터뷰 음성 상태">
        <div className="voice-status__meta">
          <span className="voice-status__recording" aria-hidden="true">
            <i />
          </span>
          <div>
            <p>인터뷰 진행 중</p>
            <time dateTime="PT2M35S">02:35</time>
          </div>
        </div>

        <div className="waveform" aria-hidden="true">
          {waveform.map((height, index) => (
            <i
              key={index}
              style={{
                '--bar-height': `${height}%`,
                '--bar-delay': `${(index % 9) * -0.11}s`,
              }}
            />
          ))}
        </div>

        <div className="voice-status__message">
          <p>답변을 듣고 있어요</p>
          <span>음성을 텍스트로 변환 중입니다</span>
        </div>
      </section>
    </div>
  )
}

export default VoiceInterviewPage
