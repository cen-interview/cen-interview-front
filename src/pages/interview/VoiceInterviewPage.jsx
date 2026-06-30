import mascotImage from '../../assets/images/interview-mascot.gif'
import AppHeader from '../../components/common/AppHeader'
import useRealtimeTranscription from '../../hooks/useRealtimeTranscription'
import './VoiceInterviewPage.scss'

const waveform = [
  12, 22, 31, 48, 61, 38, 19, 12, 9, 17, 35, 43, 37, 18, 12, 23, 12, 16,
  34, 55, 76, 48, 28, 17, 11, 15, 28, 47, 35, 18, 11, 20, 42, 54, 32, 17,
  10, 19, 27, 17, 12, 22, 39, 48, 30, 17, 10, 15, 24, 16,
]

function VoiceInterviewPage() {
  const { transcript, listening, status, error } =
    useRealtimeTranscription()

  const recognitionStatus = {
    connecting: '음성 인식 연결 중',
    listening: '음성 인식 중',
    unsupported: '음성 인식 미지원',
    'permission-denied': '마이크 권한 필요',
    error: '음성 인식 연결 실패',
  }[status]

  const recognitionMessage = {
    connecting: 'OpenAI Realtime에 연결하고 있습니다',
    listening: '음성을 텍스트로 변환 중입니다',
    unsupported: '이 브라우저에서는 WebRTC를 사용할 수 없습니다',
    'permission-denied': '브라우저의 마이크 권한을 허용해 주세요',
    error: error || '잠시 후 페이지를 새로고침해 주세요',
  }[status]

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
              {recognitionStatus}
            </p>
          </header>

          <div className="live-answer__copy">
            <p
              className={
                error
                  ? 'live-answer__error'
                  : !transcript
                    ? 'live-answer__placeholder'
                    : undefined
              }
            >
              {transcript ||
                error ||
                (status === 'connecting'
                  ? '음성 인식을 준비하고 있습니다.'
                  : '마이크에 대고 답변을 시작해 주세요.')}
              {listening && (
                <span className="live-answer__cursor" aria-hidden="true" />
              )}
            </p>
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
          <p>{listening ? '답변을 듣고 있어요' : recognitionStatus}</p>
          <span>{recognitionMessage}</span>
        </div>
      </section>
    </div>
  )
}

export default VoiceInterviewPage
