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

const REACTION_PHRASES = [
  '네, 답변 잘 들었습니다.',
  '네, 말씀 잘 들었습니다.',
  '네, 확인했습니다.',
]

const STREAM_CHARACTER_INTERVAL_MS = 28

const formatElapsedTime = (totalSeconds) => {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(normalizedSeconds / 3600)
  const minutes = Math.floor((normalizedSeconds % 3600) / 60)
  const seconds = normalizedSeconds % 60
  const minuteText = String(minutes).padStart(2, '0')
  const secondText = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${minuteText}:${secondText}`
  }

  return `${minuteText}:${secondText}`
}

const formatElapsedDuration = (totalSeconds) => {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(normalizedSeconds / 3600)
  const minutes = Math.floor((normalizedSeconds % 3600) / 60)
  const seconds = normalizedSeconds % 60

  return `PT${hours ? `${hours}H` : ''}${minutes}M${seconds}S`
}

const getLastInterviewerTurnIndex = (turns) => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === 'interviewer') {
      return index
    }
  }

  return -1
}

const mergeReactionTurns = (baseTurns, reactions) => {
  const mergedTurns = [...baseTurns]

  reactions.forEach((reaction) => {
    const reactionTurn = {
      role: 'interviewer',
      text: reaction.text,
      question_id: reaction.questionId,
      client_id: reaction.id,
      isReaction: true,
      streamCompleted: reaction.streamCompleted,
    }
    const candidateIndex = mergedTurns.findIndex((turn) => {
      return (
        turn.role === 'candidate' &&
        turn.question_id === reaction.questionId
      )
    })

    if (candidateIndex < 0) {
      if (reaction.answerText) {
        mergedTurns.push({
          role: 'candidate',
          text: reaction.answerText,
          question_id: reaction.questionId,
          client_id: `answer-${reaction.id}`,
        })
      }
      mergedTurns.push(reactionTurn)
      return
    }

    let insertionIndex = candidateIndex + 1

    while (
      mergedTurns[insertionIndex]?.isReaction &&
      mergedTurns[insertionIndex]?.question_id === reaction.questionId
    ) {
      insertionIndex += 1
    }

    mergedTurns.splice(insertionIndex, 0, reactionTurn)
  })

  const groupedTurns = []

  for (let index = 0; index < mergedTurns.length; index += 1) {
    const turn = mergedTurns[index]
    const nextTurn = mergedTurns[index + 1]

    if (
      turn.isReaction &&
      nextTurn?.role === 'interviewer' &&
      !nextTurn.isReaction
    ) {
      groupedTurns.push({
        ...turn,
        followupText: nextTurn.text,
        followupQuestionId: nextTurn.question_id,
        followupKind: nextTurn.kind,
      })
      index += 1
      continue
    }

    groupedTurns.push(turn)
  }

  const pendingReactionIndex = groupedTurns.findIndex((turn) => {
    return turn.isReaction && !turn.streamCompleted
  })

  return pendingReactionIndex < 0
    ? groupedTurns
    : groupedTurns.slice(0, pendingReactionIndex + 1)
}

/**
 * 면접관 문장을 짧은 간격으로 한 글자씩 표시한다.
 *
 * 운영체제에서 모션 감소를 요청한 사용자는 애니메이션 없이 전체 문장을
 * 즉시 표시한다. 리액션 문장의 출력 완료 callback은 다음 질문 렌더링을
 * 시작할 수 있는 UI 순서 제어 신호로 사용한다.
 *
 * @param {{ text: string, onComplete?: () => void }} props 출력 문장과 완료 callback
 * @returns {JSX.Element} 점진적으로 표시되는 문장
 */
function StreamingInterviewerText({ text, onComplete }) {
  const [visibleText, setVisibleText] = useState('')

  useEffect(() => {
    const normalizedText = text?.trim() || ''
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (!normalizedText || prefersReducedMotion) {
      setVisibleText(normalizedText)
      onComplete?.()
      return undefined
    }

    let visibleCharacterCount = 0
    setVisibleText('')
    const intervalId = window.setInterval(() => {
      visibleCharacterCount += 1
      setVisibleText(normalizedText.slice(0, visibleCharacterCount))

      if (visibleCharacterCount >= normalizedText.length) {
        window.clearInterval(intervalId)
        onComplete?.()
      }
    }, STREAM_CHARACTER_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [onComplete, text])

  const isStreaming = visibleText.length < (text?.trim().length || 0)

  return (
    <>
      {visibleText}
      {isStreaming && (
        <span
          className="question-bubble__stream-cursor"
          aria-hidden="true"
        />
      )}
    </>
  )
}

function VoiceInterviewProgress({ progress, isSubmitting }) {
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
      className="question-bubble__progress"
      aria-label={`면접 진행 상태: ${statusLabel}, 메인 질문 ${mainQuestion.current}/${mainQuestion.total}`}
    >
      <span
        className={`question-bubble__progress-status question-bubble__progress-status--${statusModifier}`}
      >
        {statusLabel}
      </span>
      <span className="question-bubble__progress-metric">
        메인 질문
        <strong>
          {mainQuestion.current} / {mainQuestion.total}
        </strong>
      </span>
    </div>
  )
}

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

function VoiceConversationTurn({
  turn,
  progress,
  isSubmitting = false,
  speechErrorMessage,
  onStreamComplete,
}) {
  const handleStreamComplete = useCallback(() => {
    if (turn.client_id) {
      onStreamComplete(turn.client_id)
    }
  }, [onStreamComplete, turn.client_id])

  if (turn.role === 'candidate') {
    return (
      <section className="voice-message voice-message--answer">
        <div className="voice-answer-bubble">
          <p className="voice-answer-bubble__name">나의 답변</p>
          <p className="voice-answer-bubble__text">{turn.text}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="interviewer" aria-label="AI 면접관 질문">
      <div className="interviewer__visual">
        <div className="interviewer__glow" aria-hidden="true" />
        <img src={mascotImage} alt="" />
        <div className="interviewer__shadow" aria-hidden="true" />
      </div>

      <div className="question-bubble">
        <div className="question-bubble__header">
          <p className="question-bubble__name">면접관 센</p>
          <VoiceInterviewProgress
            progress={progress}
            isSubmitting={isSubmitting}
          />
        </div>
        <p className="question-bubble__text" aria-live="polite">
          <StreamingInterviewerText
            text={turn.text}
            onComplete={turn.isReaction ? handleStreamComplete : undefined}
          />
          {turn.followupText && turn.streamCompleted && (
            <>
              {'\n\n'}
              <StreamingInterviewerText text={turn.followupText} />
            </>
          )}
        </p>
        {speechErrorMessage && (
          <p className="question-bubble__error" role="alert">
            {speechErrorMessage}
          </p>
        )}
      </div>
    </section>
  )
}

function VoiceInterviewSession({ accessToken }) {
  const navigate = useNavigate()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [reactionTurns, setReactionTurns] = useState([])
  const voiceTurnControllerRef = useRef(null)
  const pageEndRef = useRef(null)
  const finishedPlaybackRef = useRef(null)
  const reactionSequenceRef = useRef(0)
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
    enqueueAfterCurrent,
    warmCache: warmSpeechCache,
    stop: stopSpeech,
  } = useInterviewSpeech()
  const {
    phase: confirmationSpeechPhase,
    errorMessage: confirmationSpeechErrorMessage,
    playQueue: playConfirmation,
    stop: stopConfirmation,
  } = useInterviewSpeech()
  const handleAnswerReaction = useCallback(
    (message) => {
      reactionSequenceRef.current += 1
      setReactionTurns((currentTurns) => [
        ...currentTurns,
        {
          id: `reaction-${reactionSequenceRef.current}`,
          questionId: message.question_id,
          revision: message.revision,
          text: message.text,
          answerText: message.answer_text?.trim() || '',
          streamCompleted: false,
        },
      ])
      return playQueue([message.text])
    },
    [playQueue],
  )
  const handleReactionStreamComplete = useCallback((reactionId) => {
    setReactionTurns((currentTurns) => {
      return currentTurns.map((reaction) => {
        return reaction.id === reactionId
          ? { ...reaction, streamCompleted: true }
          : reaction
      })
    })
  }, [])
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
    playAnswerReaction: handleAnswerReaction,
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
  const sessionTranscript = Array.isArray(session?.transcript)
    ? session.transcript
    : []
  const sessionStartedAt = sessionTranscript.find(
    (turn) => turn?.created_at,
  )?.created_at

  useEffect(() => {
    if (!session?.session_id) {
      return
    }

    // Web Speech 음성을 준비하고, 미지원 환경에서는 고정 리액션 TTS를 선제 생성한다.
    void warmSpeechCache(REACTION_PHRASES)
  }, [session?.session_id, warmSpeechCache])

  useEffect(() => {
    if (!session?.session_id) {
      setElapsedSeconds(0)
      return undefined
    }

    const parsedStartedAt = Date.parse(sessionStartedAt)
    const currentTime = Date.now()
    const startedAt = Number.isNaN(parsedStartedAt)
      ? currentTime
      : Math.min(parsedStartedAt, currentTime)
    const updateElapsedTime = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }

    updateElapsedTime()
    const intervalId = window.setInterval(updateElapsedTime, 1000)

    return () => window.clearInterval(intervalId)
  }, [session?.session_id, sessionStartedAt])

  const baseConversationTurns = sessionTranscript.length
    ? sessionTranscript
    : [
        {
          role: 'interviewer',
          text: interviewerUtterance,
          question_id: session?.question?.question_id,
        },
      ]
  const conversationTurns = mergeReactionTurns(
    baseConversationTurns,
    reactionTurns,
  )
  const lastInterviewerTurnIndex =
    getLastInterviewerTurnIndex(conversationTurns)
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
    voiceTurnController.phase === 'committing'

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
    const playedToEnd = await enqueueAfterCurrent(playableQueue)

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
    enqueueAfterCurrent,
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

    let active = true
    pauseListening()
    stopConfirmation()

    const reportId =
      session.result_id ?? session.report?.result_id ?? session.session_id

    if (session.report) {
      saveChatInterviewReport(reportId, session.report)
    }

    const finishKey = `${session.session_id}:${reportId}`
    const finishQueue = session.utterance_queue?.filter((utterance) => {
      return utterance?.trim()
    })

    if (finishedPlaybackRef.current?.key !== finishKey) {
      finishedPlaybackRef.current = {
        key: finishKey,
        playback: finishQueue?.length
          ? enqueueAfterCurrent(finishQueue)
          : Promise.resolve(true),
      }
    }

    void finishedPlaybackRef.current.playback.finally(() => {
      if (!active) {
        return
      }

      stopSpeech()
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
    })

    return () => {
      active = false
    }
  }, [
    enqueueAfterCurrent,
    navigate,
    pauseListening,
    session,
    stopConfirmation,
    stopSpeech,
  ])

  useEffect(() => {
    pageEndRef.current?.scrollIntoView({ block: 'end' })
  }, [
    conversationTurns.length,
    displayedTranscript,
    isSubmitting,
    session?.question?.question_id,
    session?.transcript?.length,
    voiceTurnController.phase,
  ])

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
    connecting: '음성 인식 엔진에 연결하고 있습니다',
    ready: '면접관의 질문을 재생하고 있습니다',
    listening: '음성을 텍스트로 변환 중입니다',
    unsupported: '이 브라우저에서는 음성 인식을 사용할 수 없습니다',
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

      <main
        className="voice-interview__main"
        aria-label="음성 면접 대화"
      >
        {conversationTurns.map((turn, index) => (
          <VoiceConversationTurn
            turn={turn}
            progress={
              index === lastInterviewerTurnIndex ? session?.progress : null
            }
            isSubmitting={
              index === lastInterviewerTurnIndex && isSubmitting
            }
            speechErrorMessage={
              index === lastInterviewerTurnIndex ? speechErrorMessage : ''
            }
            onStreamComplete={handleReactionStreamComplete}
            key={`${turn.role}-${turn.client_id ?? turn.created_at ?? turn.question_id ?? index}`}
          />
        ))}

        <section
          className="live-answer"
          aria-label="실시간 답변 내용"
          hidden={isSubmitting}
        >
          <header className="live-answer__header">
            <h1>나의 답변</h1>
            <p>
              <span className="signal-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {recognitionStatus}
            </p>
          </header>

          <div className="live-answer__copy" aria-live="polite">
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
          {(voiceTurnController.errorMessage ||
            voiceTurnErrorMessage ||
            confirmationSpeechErrorMessage) && (
            <p className="live-answer__error" role="alert">
              {voiceTurnController.errorMessage ||
                voiceTurnErrorMessage ||
                confirmationSpeechErrorMessage}
            </p>
          )}
        </section>
      </main>

      <section className="voice-status" aria-label="인터뷰 음성 상태">
        <div className="voice-status__meta">
          <span className="voice-status__recording" aria-hidden="true">
            <i />
          </span>
          <div>
            <p>인터뷰 진행 중</p>
            <time dateTime={formatElapsedDuration(elapsedSeconds)}>
              {formatElapsedTime(elapsedSeconds)}
            </time>
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

      <div ref={pageEndRef} aria-hidden="true" />
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
