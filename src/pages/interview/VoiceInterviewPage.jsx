import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mascotImage from '../../assets/images/interview-mascot.gif'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import { saveChatInterviewReport } from '../../features/interview/reportStorage.js'
import useInterviewSpeech from '../../hooks/useInterviewSpeech.js'
import useRealtimeTranscription from '../../hooks/useRealtimeTranscription'
import { useVoiceInterview } from '../../hooks/useVoiceInterview.js'
import useVoiceTurnController from '../../hooks/useVoiceTurnController.js'
import useVoiceTurnSocket from '../../hooks/useVoiceTurnSocket.js'
import { useAuthStore } from '../../store/authStore.js'
import './VoiceInterviewPage.scss'

const waveform = [
  12, 22, 31, 48, 61, 38, 19, 12, 9, 17, 35, 43, 37, 18, 12, 23, 12, 16,
  34, 55, 76, 48, 28, 17, 11, 15, 28, 47, 35, 18, 11, 20, 42, 54, 32, 17,
  10, 19, 27, 17, 12, 22, 39, 48, 30, 17, 10, 15, 24, 16,
]

function VoiceSessionState({ errorMessage, onRetry }) {
  const hasError = Boolean(errorMessage)

  return (
    <div className="voice-interview">
      <div className="voice-interview__ambient" aria-hidden="true" />
      <AppHeader />

      <main
        className="voice-session-state"
        aria-live="polite"
        aria-busy={!hasError}
      >
        <div className="voice-session-state__visual" aria-hidden="true">
          <span className="voice-session-state__glow" />
          <img src={mascotImage} alt="" />
          <span className="voice-session-state__shadow" />
        </div>
        <p className="voice-session-state__eyebrow">VOICE INTERVIEW</p>
        <h1>
          {hasError
            ? '음성 면접을 진행하지 못했어요.'
            : 'AI 면접관이 질문을 준비하고 있어요.'}
        </h1>
        <p className="voice-session-state__description">
          {hasError
            ? errorMessage
            : '잠시만 기다리면 음성 면접이 시작됩니다.'}
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

function VoiceInterviewSession({ accessToken }) {
  const navigate = useNavigate()
  const [answerErrorMessage, setAnswerErrorMessage] = useState('')
  const [isFinalizing, setIsFinalizing] = useState(false)
  const voiceTurnControllerRef = useRef(null)
  const handleTranscriptSnapshot = useCallback((snapshot) => {
    voiceTurnControllerRef.current?.handleTranscriptSnapshot(snapshot)
  }, [])
  const handleSpeechActivityChange = useCallback((snapshot) => {
    voiceTurnControllerRef.current?.handleSpeechActivityChange(snapshot)
  }, [])
  const {
    session,
    phase: sessionPhase,
    errorMessage: sessionErrorMessage,
    start,
    applySessionResponse,
    submitAnswer,
    retry,
  } = useVoiceInterview()
  const {
    transcript,
    listening,
    status,
    error,
    pauseListening,
    resumeListening,
    startBargeInDetection,
    clearAudioBuffer,
    resetTranscript,
    replaceTranscript,
    finalizeTranscript,
  } = useRealtimeTranscription({
    onPermissionGranted: start,
    startListeningOnConnect: false,
    onTranscriptSnapshot: handleTranscriptSnapshot,
    onSpeechActivityChange: handleSpeechActivityChange,
  })
  const {
    phase: questionSpeechPhase,
    errorMessage: speechErrorMessage,
    playQueue,
    stop: stopSpeech,
  } = useInterviewSpeech()
  const {
    phase: confirmationSpeechPhase,
    errorMessage: confirmationSpeechErrorMessage,
    playQueue: playConfirmation,
    stop: stopConfirmation,
  } = useInterviewSpeech()
  const {
    status: voiceTurnStatus,
    errorMessage: voiceTurnErrorMessage,
    readyState: voiceTurnReadyState,
    reconnectAttempt: voiceTurnReconnectAttempt,
    sendMessage: sendVoiceTurnMessage,
    subscribe: subscribeVoiceTurn,
    reconnect: reconnectVoiceTurn,
  } = useVoiceTurnSocket({
    sessionId: session?.session_id,
    questionId: session?.question?.question_id,
    accessToken,
    enabled: Boolean(session && !session.finished),
  })
  const voiceTurnController = useVoiceTurnController({
    sessionId: session?.session_id,
    questionId: session?.question?.question_id,
    socketStatus: voiceTurnStatus,
    readyState: voiceTurnReadyState,
    sendMessage: sendVoiceTurnMessage,
    subscribe: subscribeVoiceTurn,
    pauseListening,
    resumeListening,
    startBargeInDetection,
    clearAudioBuffer,
    resetTranscript,
    replaceTranscript,
    playConfirmation,
    stopConfirmation,
    onSessionCommitted: applySessionResponse,
  })
  voiceTurnControllerRef.current = voiceTurnController
  const lastAutoPlayedQuestionRef = useRef('')
  const isRecognitionFailed =
    status === 'error' ||
    status === 'permission-denied' ||
    status === 'unsupported'
  const isVoiceTurnFailed = voiceTurnStatus === 'error'
  const isVoiceTurnReconnecting = voiceTurnStatus === 'reconnecting'
  const hasStartedVoiceTurn = voiceTurnController.phase !== 'idle'
  const isVoiceTurnReady =
    voiceTurnStatus === 'ready' &&
    voiceTurnReadyState?.sessionId === session?.session_id &&
    voiceTurnReadyState?.questionId === session?.question?.question_id
  const interviewerUtterance =
    session?.last_utterance || session?.question?.text || ''
  const isQuestionSpeechBusy =
    questionSpeechPhase === 'loading' || questionSpeechPhase === 'playing'
  const isConfirmationSpeechBusy =
    confirmationSpeechPhase === 'loading' ||
    confirmationSpeechPhase === 'playing'
  const isConfirmationFlow = [
    'confirmation_tts',
    'confirmation_response',
  ].includes(voiceTurnController.phase)
  const displayedTranscript =
    voiceTurnController.phase === 'confirmation_tts'
      ? voiceTurnController.answerText
      : transcript
  const isSpeechBusy = isQuestionSpeechBusy || isConfirmationSpeechBusy
  const isSubmitting =
    sessionPhase === 'submitting' ||
    isFinalizing ||
    voiceTurnController.phase === 'committing'
  const controllerLocksInteraction = [
    'confirmation_tts',
    'confirmation_response',
    'committing',
  ].includes(voiceTurnController.phase)
  const isInteractionBusy =
    isSpeechBusy ||
    isSubmitting ||
    controllerLocksInteraction ||
    isVoiceTurnReconnecting

  /**
   * 현재 질문의 발화 큐를 순서대로 재생한 뒤 지원자 마이크를 연다.
   *
   * 백엔드가 utterance_queue를 보내지 않은 경우에도 기존 질문 문장을 한 번
   * 재생할 수 있도록 last_utterance 또는 question.text를 대체값으로 쓴다.
   */
  const playCurrentQuestion = useCallback(async () => {
    const utteranceQueue = session?.utterance_queue?.filter(
      (utterance) => utterance?.trim(),
    )
    const playableQueue = utteranceQueue?.length
      ? utteranceQueue
      : [interviewerUtterance]

    voiceTurnControllerRef.current?.clearInitialSilenceTimer()
    pauseListening()
    const playedToEnd = await playQueue(playableQueue)

    if (playedToEnd) {
      clearAudioBuffer()
      resetTranscript()
    }

    // 자동 재생 실패 시에도 텍스트를 보고 답변할 수 있도록 마이크를 복구한다.
    voiceTurnControllerRef.current?.startQuestion()
    const listeningStarted = resumeListening()

    if (listeningStarted) {
      voiceTurnControllerRef.current?.startInitialSilenceTimer()
    }
    return playedToEnd
  }, [
    clearAudioBuffer,
    interviewerUtterance,
    pauseListening,
    playQueue,
    resetTranscript,
    resumeListening,
    session?.utterance_queue,
  ])

  useEffect(() => {
    if (
      !session ||
      session.finished ||
      status !== 'ready' ||
      !isVoiceTurnReady ||
      !interviewerUtterance
    ) {
      return
    }

    const questionKey = `${session.session_id}:${
      session.question?.question_id ?? interviewerUtterance
    }`

    if (lastAutoPlayedQuestionRef.current === questionKey) {
      return
    }

    lastAutoPlayedQuestionRef.current = questionKey
    void playCurrentQuestion()
  }, [
    interviewerUtterance,
    isVoiceTurnReady,
    playCurrentQuestion,
    session,
    status,
  ])

  useEffect(() => {
    if (!session?.finished || !session.session_id) {
      return
    }

    pauseListening()
    stopSpeech()
    stopConfirmation()

    const reportId =
      session.result_id ?? session.report?.result_id ?? session.session_id

    if (session.report) {
      saveChatInterviewReport(reportId, session.report)
    }

    navigate(
      ROUTES.REPORT.replace(':interviewId', encodeURIComponent(reportId)),
      {
        replace: true,
        state: {
          mode: 'voice',
          report: session.report,
        },
      },
    )
  }, [navigate, pauseListening, session, stopConfirmation, stopSpeech])

  const handleAnswerSubmit = async () => {
    const submittingQuestionId = session?.question?.question_id

    if (
      isInteractionBusy ||
      status !== 'listening' ||
      !submittingQuestionId ||
      !voiceTurnController.beginManualSubmission()
    ) {
      return
    }

    setAnswerErrorMessage('')
    setIsFinalizing(true)

    try {
      const finalTranscript = await finalizeTranscript()

      // 전사 확정 대기 중 WebSocket 자동 제출이 먼저 끝났다면 중복 HTTP 제출을 막는다.
      if (!voiceTurnController.canSubmitManualAnswer(submittingQuestionId)) {
        return
      }

      if (!finalTranscript) {
        setAnswerErrorMessage(
          '인식된 답변이 없습니다. 마이크에 대고 다시 답변해 주세요.',
        )
        voiceTurnController.cancelManualSubmission()
        resumeListening()
        return
      }

      const deliverySnapshot =
        voiceTurnController.createDeliverySnapshot(finalTranscript)
      const response = await submitAnswer(
        finalTranscript,
        deliverySnapshot.metrics,
      )

      if (response) {
        voiceTurnController.completeManualSubmission(response)

        if (!response.finished) {
          reconnectVoiceTurn(response.question?.question_id)
        }
      }
    } finally {
      setIsFinalizing(false)
    }
  }

  const handleSessionRetry = async () => {
    if (isVoiceTurnFailed && session && !isRecognitionFailed) {
      reconnectVoiceTurn(session.question?.question_id)
      return
    }

    if (session && !isRecognitionFailed) {
      const wasManualSubmission =
        voiceTurnController.phase === 'committing'
      const response = await retry()

      if (response && wasManualSubmission) {
        voiceTurnController.completeManualSubmission(response)

        if (!response.finished) {
          reconnectVoiceTurn(response.question?.question_id)
        }
      }
      return
    }

    window.location.reload()
  }

  // 훅에서 받은 내부 상태를 사용자에게 보여줄 문구로 변환한다.
  const recognitionStatus = {
    'requesting-permission': '마이크 권한 확인 중',
    connecting: '음성 인식 연결 중',
    ready: '면접관 질문 재생 대기',
    listening: '음성 인식 중',
    unsupported: '음성 인식 미지원',
    'permission-denied': '마이크 권한 필요',
    error: '음성 인식 연결 실패',
  }[status]

  const recognitionMessage = {
    'requesting-permission': '브라우저에서 마이크 사용을 허용해주세요',
    connecting: 'OpenAI Realtime에 연결하고 있습니다',
    ready: '면접관의 질문을 재생하고 있습니다',
    listening: '음성을 텍스트로 변환 중입니다',
    unsupported: '이 브라우저에서는 WebRTC를 사용할 수 없습니다',
    'permission-denied': '브라우저의 마이크 권한을 허용해 주세요',
    error: error || '잠시 후 페이지를 새로고침해 주세요',
  }[status]
  const initializationError =
    sessionErrorMessage ||
    error ||
    voiceTurnErrorMessage ||
    (isRecognitionFailed ? recognitionMessage : null)
  const isPreparing =
    !session ||
    sessionPhase === 'idle' ||
    sessionPhase === 'starting' ||
    status === 'requesting-permission' ||
    status === 'connecting' ||
    (Boolean(session && !session.finished) &&
      !isVoiceTurnReady &&
      (!isVoiceTurnReconnecting || !hasStartedVoiceTurn) &&
      (!isVoiceTurnFailed || !hasStartedVoiceTurn))
  let voiceStatusTitle = recognitionStatus
  let voiceStatusMessage = recognitionMessage

  if (listening) {
    voiceStatusTitle = '답변을 듣고 있어요'
  }

  if (questionSpeechPhase === 'playing') {
    voiceStatusTitle = '면접관 질문 재생 중'
  }

  if (questionSpeechPhase === 'loading') {
    voiceStatusTitle = '면접관 음성 준비 중'
  }

  if (isSpeechBusy) {
    voiceStatusMessage = '질문이 끝나면 마이크가 자동으로 시작됩니다'
  }

  if (isSubmitting) {
    voiceStatusTitle = '답변 제출 중'
    voiceStatusMessage = 'AI 면접관이 답변을 확인하고 있습니다'
  }

  if (voiceTurnController.phase === 'judging') {
    voiceStatusTitle = '답변 완료 여부 확인 중'
    voiceStatusMessage = '계속 말씀하시면 답변을 이어서 들을게요'
  }

  if (voiceTurnController.phase === 'initial_silence') {
    voiceStatusTitle = '답변을 기다리고 있어요'
    voiceStatusMessage = '천천히 생각한 뒤 말씀해 주세요'
  }

  if (voiceTurnController.phase === 'confirmation_tts') {
    voiceStatusTitle = '답변 종료 확인 중'
    voiceStatusMessage =
      voiceTurnController.confirmation?.text || '확인 질문을 재생하고 있습니다'
  }

  if (voiceTurnController.phase === 'confirmation_response') {
    voiceStatusTitle = '확인 응답을 듣고 있어요'
    voiceStatusMessage = '답변을 마쳤는지 짧게 말씀해 주세요'
  }

  if (voiceTurnController.phase === 'barge_in') {
    voiceStatusTitle = '답변을 계속 듣고 있어요'
    voiceStatusMessage = '이어서 말씀해 주세요'
  }

  if (isVoiceTurnReconnecting) {
    voiceStatusTitle = '음성 연결을 복구하고 있어요'
    voiceStatusMessage = `현재까지의 답변은 유지됩니다 · ${voiceTurnReconnectAttempt || 1}번째 시도`
  }

  if (voiceTurnController.phase === 'sync_error') {
    voiceStatusTitle = '자동 답변 동기화를 중단했어요'
    voiceStatusMessage = '현재 답변을 확인한 뒤 수동으로 제출해 주세요'
  }

  if (isVoiceTurnFailed && hasStartedVoiceTurn) {
    voiceStatusTitle = '음성 연결이 중단됐어요'
    voiceStatusMessage = '현재 답변을 유지한 채 다시 연결할 수 있습니다'
  }

  if (
    sessionPhase === 'error' ||
    isRecognitionFailed ||
    (isVoiceTurnFailed && !hasStartedVoiceTurn)
  ) {
    return (
      <VoiceSessionState
        errorMessage={initializationError}
        onRetry={() => void handleSessionRetry()}
      />
    )
  }

  if (isPreparing) {
    return <VoiceSessionState />
  }

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
            <p className="question-bubble__text">{interviewerUtterance}</p>
            <div className="question-bubble__actions">
              <button
                type="button"
                disabled={
                  isInteractionBusy ||
                  voiceTurnController.speechActive ||
                  Boolean(voiceTurnController.answerText)
                }
                onClick={() => void playCurrentQuestion()}
              >
                {isQuestionSpeechBusy ? '질문 재생 중...' : '질문 듣기'}
              </button>
              <span>AI로 생성된 음성입니다.</span>
            </div>
            {speechErrorMessage && (
              <p className="question-bubble__error" role="alert">
                {speechErrorMessage}
              </p>
            )}
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
                !displayedTranscript ? 'live-answer__placeholder' : undefined
              }
            >
              {displayedTranscript ||
                (isConfirmationFlow
                  ? '답변을 마쳤는지 짧게 말씀해 주세요.'
                  : isSpeechBusy
                    ? '면접관의 질문을 듣고 있습니다.'
                    : '마이크에 대고 답변을 시작해 주세요.')}
              {listening && (
                <span className="live-answer__cursor" aria-hidden="true" />
              )}
            </p>
          </div>
          <footer className="live-answer__footer">
            <div aria-live="polite">
              {(answerErrorMessage ||
                voiceTurnController.errorMessage ||
                voiceTurnErrorMessage ||
                confirmationSpeechErrorMessage) && (
                <p className="live-answer__error">
                  {answerErrorMessage ||
                    voiceTurnController.errorMessage ||
                    voiceTurnErrorMessage ||
                    confirmationSpeechErrorMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={
                isVoiceTurnFailed
                  ? false
                  : isInteractionBusy || status !== 'listening'
              }
              onClick={() => {
                if (isVoiceTurnFailed) {
                  reconnectVoiceTurn(session?.question?.question_id)
                  return
                }

                void handleAnswerSubmit()
              }}
            >
              {isVoiceTurnFailed
                ? '다시 연결'
                : isSubmitting
                  ? '답변 정리 중...'
                  : '답변 완료'}
            </button>
          </footer>
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
          <p>{voiceStatusTitle}</p>
          <span>{voiceStatusMessage}</span>
        </div>
      </section>
    </div>
  )
}

function VoiceInterviewPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const navigate = useNavigate()

  useEffect(() => {
    if (!accessToken) {
      navigate(ROUTES.LOGIN, { replace: true })
    }
  }, [accessToken, navigate])

  if (!accessToken) {
    return null
  }

  return <VoiceInterviewSession accessToken={accessToken} />
}

export default VoiceInterviewPage
