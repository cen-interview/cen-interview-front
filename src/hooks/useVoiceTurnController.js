import { useCallback, useEffect, useRef, useState } from 'react'
import { createVoiceDeliveryMetricsTracker } from '../features/interview/voiceDeliveryMetrics.js'

const TRANSCRIPT_THROTTLE_MS = 500
const INITIAL_SILENCE_TIMEOUT_MS = 8000
const CONFIRMATION_RESULT_REASONS = new Set([
  'candidate_wants_to_continue',
  'additional_answer_content',
  'confirmation_unknown',
])

const appendAnswer = (baseText, additionalText) => {
  return [baseText?.trim(), additionalText?.trim()].filter(Boolean).join(' ')
}

/**
 * 질문별 누적 전사와 Voice Turn WebSocket 메시지를 조정한다.
 *
 * Delta 전사는 최대 초당 두 번 latest-wins 방식으로 전송하고 completed
 * snapshot은 즉시 전송한다. 서버의 계속 듣기, 확인 질문, 자동 제출 응답도
 * 같은 질문 ID와 revision 범위 안에서만 반영한다.
 *
 * @param {object} options 현재 세션, socket과 음성·TTS 제어 함수
 * @returns 질문별 Voice Turn 상태와 Realtime callback, 수동 제출 제어 함수
 */
function useVoiceTurnController({
  sessionId,
  questionId,
  socketStatus,
  readyState,
  sendMessage,
  subscribe,
  pauseListening,
  resumeListening,
  startBargeInDetection,
  clearAudioBuffer,
  resetTranscript,
  replaceTranscript,
  playConfirmation,
  stopConfirmation,
  playAnswerReaction,
  onSessionCommitted,
}) {
  const [phase, setPhase] = useState('idle')
  const [answerText, setAnswerText] = useState('')
  const [revision, setRevision] = useState(0)
  const [speechActive, setSpeechActive] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const phaseRef = useRef('idle')
  const sessionIdRef = useRef(sessionId)
  const questionIdRef = useRef(questionId)
  const revisionRef = useRef(0)
  const answerTextRef = useRef('')
  const speechActiveRef = useRef(false)
  const modeRef = useRef('answer')
  const confirmationRef = useRef(null)
  const manualSubmissionRef = useRef(false)
  const pendingSnapshotRef = useRef(null)
  const throttleTimerRef = useRef()
  const lastSentAtRef = useRef(0)
  const lastSentSnapshotRef = useRef(null)
  const socketReadyRef = useRef(false)
  const automaticallyCommittedQuestionsRef = useRef(new Set())
  const playedReactionQuestionsRef = useRef(new Set())
  const cancelledConfirmationIdsRef = useRef(new Set())
  const previousSocketStatusRef = useRef(socketStatus)
  const reconnectPendingRef = useRef(false)
  const phaseBeforeReconnectRef = useRef('idle')
  const syncBlockedRef = useRef(false)
  const disconnectedSnapshotDirtyRef = useRef(false)
  const hasSpokenRef = useRef(false)
  const initialSilenceTimerRef = useRef()
  const deliveryMetricsTrackerRef = useRef()

  if (!deliveryMetricsTrackerRef.current) {
    deliveryMetricsTrackerRef.current = createVoiceDeliveryMetricsTracker()
  }

  const updatePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const clearInitialSilenceTimer = useCallback(() => {
    if (initialSilenceTimerRef.current) {
      window.clearTimeout(initialSilenceTimerRef.current)
      initialSilenceTimerRef.current = undefined
    }
  }, [])

  const markFirstSpeech = useCallback(() => {
    if (hasSpokenRef.current) {
      return
    }

    hasSpokenRef.current = true
    clearInitialSilenceTimer()

    if (phaseRef.current === 'initial_silence') {
      updatePhase('listening')
    }
  }, [clearInitialSilenceTimer, updatePhase])

  const startInitialSilenceTimer = useCallback(() => {
    clearInitialSilenceTimer()

    if (
      hasSpokenRef.current ||
      answerTextRef.current ||
      manualSubmissionRef.current ||
      modeRef.current !== 'answer'
    ) {
      return false
    }

    const targetQuestionId = questionIdRef.current
    initialSilenceTimerRef.current = window.setTimeout(() => {
      initialSilenceTimerRef.current = undefined

      if (
        targetQuestionId !== questionIdRef.current ||
        hasSpokenRef.current ||
        answerTextRef.current ||
        manualSubmissionRef.current ||
        modeRef.current !== 'answer' ||
        !socketReadyRef.current ||
        !['listening', 'initial_silence'].includes(phaseRef.current)
      ) {
        return
      }

      updatePhase('initial_silence')
    }, INITIAL_SILENCE_TIMEOUT_MS)
    return true
  }, [clearInitialSilenceTimer, updatePhase])

  const clearPendingTranscript = useCallback(() => {
    if (throttleTimerRef.current) {
      window.clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = undefined
    }

    pendingSnapshotRef.current = null
  }, [])

  const preserveDisconnectedSnapshot = useCallback((snapshot) => {
    const text = snapshot?.text?.trim()

    if (!text || text === answerTextRef.current) {
      return
    }

    if (!disconnectedSnapshotDirtyRef.current) {
      revisionRef.current += 1
      disconnectedSnapshotDirtyRef.current = true
      setRevision(revisionRef.current)
    }

    answerTextRef.current = text
    const delivery = deliveryMetricsTrackerRef.current.createSnapshot(text)
    lastSentSnapshotRef.current = {
      text,
      segmentFinal: Boolean(snapshot.segmentFinal),
      speechActive: speechActiveRef.current,
      delivery,
    }
    setAnswerText(text)
  }, [])

  useEffect(() => {
    socketReadyRef.current =
      socketStatus === 'ready' && readyState?.sessionId === sessionId
  }, [readyState?.sessionId, sessionId, socketStatus])

  useEffect(() => {
    sessionIdRef.current = sessionId
    questionIdRef.current = questionId
    const initialRevision = 0

    clearPendingTranscript()
    // 새 질문이 활성화되는 즉시 이전 질문의 화면 전사와 내부 발화 조각을 비운다.
    resetTranscript()
    revisionRef.current = initialRevision
    answerTextRef.current = ''
    speechActiveRef.current = false
    modeRef.current = 'answer'
    confirmationRef.current = null
    manualSubmissionRef.current = false
    lastSentAtRef.current = 0
    lastSentSnapshotRef.current = null
    reconnectPendingRef.current = false
    phaseBeforeReconnectRef.current = 'idle'
    syncBlockedRef.current = false
    disconnectedSnapshotDirtyRef.current = false
    hasSpokenRef.current = false
    deliveryMetricsTrackerRef.current.reset(questionId)
    clearInitialSilenceTimer()
    setRevision(initialRevision)
    setAnswerText('')
    setSpeechActive(false)
    setConfirmation(null)
    setErrorMessage('')
    updatePhase('idle')
  }, [
    clearInitialSilenceTimer,
    clearPendingTranscript,
    questionId,
    resetTranscript,
    sessionId,
    updatePhase,
  ])

  useEffect(() => {
    const previousStatus = previousSocketStatusRef.current
    previousSocketStatusRef.current = socketStatus

    if (previousStatus !== 'ready' || socketStatus !== 'reconnecting') {
      return
    }

    preserveDisconnectedSnapshot(pendingSnapshotRef.current)
    clearInitialSilenceTimer()
    clearPendingTranscript()
    reconnectPendingRef.current = true
    if (phaseRef.current !== 'reconnecting') {
      phaseBeforeReconnectRef.current = phaseRef.current
    }
    deliveryMetricsTrackerRef.current.suspend()
    pauseListening()

    const activeConfirmation = confirmationRef.current
    if (activeConfirmation) {
      cancelledConfirmationIdsRef.current.add(
        activeConfirmation.confirmationId,
      )
      stopConfirmation()
      modeRef.current = 'answer'
      confirmationRef.current = null
      revisionRef.current = activeConfirmation.baseRevision
      answerTextRef.current = activeConfirmation.baseAnswer
      lastSentSnapshotRef.current = {
        text: activeConfirmation.baseAnswer,
        segmentFinal: false,
        speechActive: false,
        delivery: deliveryMetricsTrackerRef.current.createSnapshot(
          activeConfirmation.baseAnswer,
        ),
      }
      setRevision(activeConfirmation.baseRevision)
      setAnswerText(activeConfirmation.baseAnswer)
      setConfirmation(null)
      replaceTranscript(activeConfirmation.baseAnswer)
      phaseBeforeReconnectRef.current = 'listening'
    }

    speechActiveRef.current = false
    setSpeechActive(false)
    updatePhase('reconnecting')
  }, [
    clearInitialSilenceTimer,
    clearPendingTranscript,
    pauseListening,
    preserveDisconnectedSnapshot,
    replaceTranscript,
    socketStatus,
    stopConfirmation,
    updatePhase,
  ])

  useEffect(() => {
    automaticallyCommittedQuestionsRef.current.clear()
    cancelledConfirmationIdsRef.current.clear()
  }, [sessionId])

  useEffect(() => {
    if (
      readyState?.questionId !== questionId ||
      !Number.isInteger(readyState?.revision)
    ) {
      return
    }

    if (!answerTextRef.current) {
      revisionRef.current = readyState.revision
      setRevision(readyState.revision)
    }
  }, [questionId, readyState?.questionId, readyState?.revision])

  const publishTranscript = useCallback(
    (snapshot) => {
      if (
        manualSubmissionRef.current ||
        syncBlockedRef.current ||
        modeRef.current !== 'answer' ||
        !socketReadyRef.current ||
        !sessionIdRef.current ||
        !questionIdRef.current
      ) {
        return false
      }

      const text = snapshot.text?.trim()

      if (!text) {
        return false
      }

      const previousSnapshot = lastSentSnapshotRef.current
      if (
        previousSnapshot?.text === text &&
        previousSnapshot.segmentFinal === snapshot.segmentFinal &&
        previousSnapshot.speechActive === speechActiveRef.current
      ) {
        return false
      }

      const nextRevision = revisionRef.current + 1
      const delivery = deliveryMetricsTrackerRef.current.createSnapshot(text)
      const sent = sendMessage({
        type: 'answer.transcript.updated',
        question_id: questionIdRef.current,
        revision: nextRevision,
        text,
        speech_active: speechActiveRef.current,
        segment_final: snapshot.segmentFinal,
        ...(delivery.answerDurationSeconds !== undefined && {
          answer_duration_seconds: delivery.answerDurationSeconds,
        }),
        ...(delivery.metrics && { metrics: delivery.metrics }),
      })

      if (!sent) {
        preserveDisconnectedSnapshot(snapshot)
        return false
      }

      revisionRef.current = nextRevision
      disconnectedSnapshotDirtyRef.current = false
      answerTextRef.current = text
      lastSentAtRef.current = Date.now()
      lastSentSnapshotRef.current = {
        text,
        segmentFinal: snapshot.segmentFinal,
        speechActive: speechActiveRef.current,
        delivery,
      }
      setRevision(nextRevision)
      setAnswerText(text)
      updatePhase(
        snapshot.segmentFinal && !speechActiveRef.current
          ? 'judging'
          : 'listening',
      )
      return true
    },
    [preserveDisconnectedSnapshot, sendMessage, updatePhase],
  )

  const flushPendingTranscript = useCallback(() => {
    const pendingSnapshot = pendingSnapshotRef.current
    pendingSnapshotRef.current = null
    throttleTimerRef.current = undefined

    if (pendingSnapshot) {
      publishTranscript(pendingSnapshot)
    }
  }, [publishTranscript])

  const handleConfirmationTranscript = useCallback(
    (snapshot) => {
      const activeConfirmation = confirmationRef.current
      const responseText = snapshot.text?.trim()

      if (
        phaseRef.current !== 'confirmation_response' ||
        !activeConfirmation ||
        activeConfirmation.responded ||
        !snapshot.segmentFinal ||
        !responseText
      ) {
        return
      }

      const responseRevision = activeConfirmation.baseRevision + 1
      const sent = sendMessage({
        type: 'turn.confirmation.responded',
        confirmation_id: activeConfirmation.confirmationId,
        question_id: questionIdRef.current,
        revision: activeConfirmation.baseRevision,
        response_revision: responseRevision,
        text: responseText,
      })

      if (!sent) {
        return
      }

      const nextConfirmation = {
        ...activeConfirmation,
        responded: true,
        responseText,
        responseRevision,
      }
      confirmationRef.current = nextConfirmation
      setConfirmation(nextConfirmation)
      pauseListening()
      updatePhase('judging')
    },
    [pauseListening, sendMessage, updatePhase],
  )

  const handleTranscriptSnapshot = useCallback(
    (snapshot) => {
      if (snapshot.text?.trim()) {
        markFirstSpeech()
      }

      if (modeRef.current === 'confirmation') {
        handleConfirmationTranscript(snapshot)
        return
      }

      if (!socketReadyRef.current && reconnectPendingRef.current) {
        preserveDisconnectedSnapshot(snapshot)
        return
      }

      if (
        manualSubmissionRef.current ||
        ![
          'listening',
          'initial_silence',
          'judging',
          'barge_in',
        ].includes(phaseRef.current)
      ) {
        return
      }

      if (snapshot.segmentFinal) {
        clearPendingTranscript()
        publishTranscript(snapshot)
        return
      }

      pendingSnapshotRef.current = snapshot
      const elapsed = Date.now() - lastSentAtRef.current

      if (elapsed >= TRANSCRIPT_THROTTLE_MS) {
        flushPendingTranscript()
        return
      }

      if (!throttleTimerRef.current) {
        throttleTimerRef.current = window.setTimeout(
          flushPendingTranscript,
          TRANSCRIPT_THROTTLE_MS - elapsed,
        )
      }
    },
    [
      clearPendingTranscript,
      flushPendingTranscript,
      handleConfirmationTranscript,
      markFirstSpeech,
      preserveDisconnectedSnapshot,
      publishTranscript,
    ],
  )

  const handleSpeechActivityChange = useCallback(
    ({ speechActive: nextSpeechActive, changedAt }) => {
      const activityChangedAt = Number.isFinite(changedAt)
        ? changedAt
        : Date.now()

      if (nextSpeechActive) {
        markFirstSpeech()
      }

      speechActiveRef.current = nextSpeechActive
      setSpeechActive(nextSpeechActive)

      const activeConfirmation = confirmationRef.current
      if (
        nextSpeechActive &&
        phaseRef.current === 'confirmation_tts' &&
        activeConfirmation &&
        !cancelledConfirmationIdsRef.current.has(
          activeConfirmation.confirmationId,
        )
      ) {
        cancelledConfirmationIdsRef.current.add(
          activeConfirmation.confirmationId,
        )
        stopConfirmation()
        modeRef.current = 'answer'
        deliveryMetricsTrackerRef.current.startSpeaking(activityChangedAt)
        confirmationRef.current = null
        answerTextRef.current = activeConfirmation.baseAnswer
        speechActiveRef.current = true
        const delivery = deliveryMetricsTrackerRef.current.createSnapshot(
          activeConfirmation.baseAnswer,
          activityChangedAt,
        )
        lastSentSnapshotRef.current = {
          text: activeConfirmation.baseAnswer,
          segmentFinal: false,
          speechActive: true,
          delivery,
        }
        setAnswerText(activeConfirmation.baseAnswer)
        setConfirmation(null)
        replaceTranscript(activeConfirmation.baseAnswer, {
          preserveActivity: true,
        })

        sendMessage({
          type: 'voice.activity.changed',
          question_id: questionIdRef.current,
          revision: activeConfirmation.baseRevision,
          speech_active: true,
        })
        setSpeechActive(true)
        updatePhase('barge_in')
        return
      }

      if (modeRef.current === 'answer') {
        if (nextSpeechActive) {
          deliveryMetricsTrackerRef.current.startSpeaking(activityChangedAt)
        } else if (manualSubmissionRef.current) {
          deliveryMetricsTrackerRef.current.suspend(activityChangedAt)
        } else {
          deliveryMetricsTrackerRef.current.stopSpeaking(activityChangedAt)
        }
      }

      if (
        manualSubmissionRef.current ||
        syncBlockedRef.current ||
        modeRef.current !== 'answer' ||
        !socketReadyRef.current ||
        !questionIdRef.current
      ) {
        return
      }

      sendMessage({
        type: 'voice.activity.changed',
        question_id: questionIdRef.current,
        revision: revisionRef.current,
        speech_active: nextSpeechActive,
      })

      if (nextSpeechActive) {
        updatePhase('listening')
      }
    },
    [
      markFirstSpeech,
      replaceTranscript,
      sendMessage,
      stopConfirmation,
      updatePhase,
    ],
  )

  const restoreAnswerAfterConfirmation = useCallback(
    (message) => {
      const activeConfirmation = confirmationRef.current

      if (!activeConfirmation) {
        return
      }

      const nextAnswer =
        message.reason === 'additional_answer_content'
          ? appendAnswer(
              activeConfirmation.baseAnswer,
              activeConfirmation.responseText,
            )
          : activeConfirmation.baseAnswer

      clearInitialSilenceTimer()
      clearPendingTranscript()
      modeRef.current = 'answer'
      confirmationRef.current = null
      answerTextRef.current = nextAnswer
      revisionRef.current = message.revision
      speechActiveRef.current = false
      lastSentSnapshotRef.current = {
        text: nextAnswer,
        segmentFinal: false,
        speechActive: false,
      }
      setAnswerText(nextAnswer)
      setRevision(message.revision)
      setSpeechActive(false)
      setConfirmation(null)
      replaceTranscript(nextAnswer)
      deliveryMetricsTrackerRef.current.resume()
      resumeListening()
      updatePhase('listening')
    },
    [
      clearInitialSilenceTimer,
      clearPendingTranscript,
      replaceTranscript,
      resumeListening,
      updatePhase,
    ],
  )

  const handleConfirmationRequested = useCallback(
    async (message) => {
      if (
        message.question_id !== questionIdRef.current ||
        message.revision !== revisionRef.current ||
        manualSubmissionRef.current ||
        cancelledConfirmationIdsRef.current.has(message.confirmation_id)
      ) {
        return
      }

      clearInitialSilenceTimer()
      clearPendingTranscript()
      deliveryMetricsTrackerRef.current.suspend()
      const nextConfirmation = {
        confirmationId: message.confirmation_id,
        baseRevision: message.revision,
        baseAnswer: answerTextRef.current,
        text: message.text,
        responseText: '',
        responseRevision: null,
        responded: false,
      }
      confirmationRef.current = nextConfirmation
      modeRef.current = 'confirmation'
      setConfirmation(nextConfirmation)
      pauseListening()
      updatePhase('confirmation_tts')

      startBargeInDetection()

      await playConfirmation([message.text])

      if (
        confirmationRef.current?.confirmationId !== message.confirmation_id ||
        phaseRef.current !== 'confirmation_tts'
      ) {
        return
      }

      clearAudioBuffer()
      resetTranscript()
      resumeListening()
      updatePhase('confirmation_response')
    },
    [
      clearAudioBuffer,
      clearInitialSilenceTimer,
      clearPendingTranscript,
      pauseListening,
      playConfirmation,
      resetTranscript,
      resumeListening,
      startBargeInDetection,
      updatePhase,
    ],
  )

  const handleServerMessage = useCallback(
    (message) => {
      if (message.type === 'connection.ready') {
        if (!reconnectPendingRef.current) {
          if (message.question_id === questionIdRef.current) {
            revisionRef.current = message.revision
            setRevision(message.revision)
          }
          return
        }

        reconnectPendingRef.current = false

        if (message.question_id !== questionIdRef.current) {
          syncBlockedRef.current = true
          setErrorMessage(
            '서버가 이미 다른 질문으로 이동했습니다. 음성 연결을 다시 시작해 주세요.',
          )
          updatePhase('sync_error')
          return
        }

        if (revisionRef.current < message.revision) {
          syncBlockedRef.current = true
          setErrorMessage(
            '서버에 더 최신 답변이 있어 자동 동기화를 중단했습니다. 현재 답변을 수동으로 제출해 주세요.',
          )
          deliveryMetricsTrackerRef.current.resume()
          resumeListening()
          updatePhase('sync_error')
          return
        }

        if (answerTextRef.current) {
          const latestSnapshot = lastSentSnapshotRef.current
          const delivery = deliveryMetricsTrackerRef.current.createSnapshot(
            answerTextRef.current,
          )
          const synchronized = sendMessage({
            type: 'answer.transcript.updated',
            question_id: questionIdRef.current,
            revision: revisionRef.current,
            text: answerTextRef.current,
            speech_active: false,
            segment_final: latestSnapshot?.segmentFinal ?? false,
            ...(delivery.answerDurationSeconds !== undefined && {
              answer_duration_seconds: delivery.answerDurationSeconds,
            }),
            ...(delivery.metrics && { metrics: delivery.metrics }),
          })

          if (!synchronized) {
            setErrorMessage('보존한 답변을 다시 연결하지 못했습니다.')
            syncBlockedRef.current = true
            deliveryMetricsTrackerRef.current.resume()
            resumeListening()
            updatePhase('sync_error')
            return
          }
        } else {
          revisionRef.current = message.revision
          setRevision(message.revision)
        }

        syncBlockedRef.current = false
        disconnectedSnapshotDirtyRef.current = false
        setErrorMessage('')

        if (
          message.state === 'listening' &&
          ['listening', 'initial_silence', 'judging', 'barge_in'].includes(
            phaseBeforeReconnectRef.current,
          )
        ) {
          deliveryMetricsTrackerRef.current.resume()
          resumeListening()
          updatePhase('listening')

          if (!hasSpokenRef.current) {
            startInitialSilenceTimer()
          }
        } else if (message.state === 'committing') {
          updatePhase('committing')
        } else {
          updatePhase(phaseBeforeReconnectRef.current)
        }
        return
      }

      if (message.type === 'error') {
        if (
          ['turn_commit_in_progress', 'worker_not_available'].includes(
            message.code,
          )
        ) {
          if (phaseRef.current !== 'reconnecting') {
            phaseBeforeReconnectRef.current = phaseRef.current
          }
          clearInitialSilenceTimer()
          deliveryMetricsTrackerRef.current.suspend()
          pauseListening()
          updatePhase('reconnecting')
          return
        }

        if (message.recoverable) {
          setErrorMessage(message.message || '자동 제출을 처리하지 못했습니다.')

          if (message.code === 'revision_conflict') {
            syncBlockedRef.current = true
            updatePhase('sync_error')
            return
          }

          if (message.code === 'commit_failed') {
            playedReactionQuestionsRef.current.delete(questionIdRef.current)
            manualSubmissionRef.current = false
            syncBlockedRef.current = false
            deliveryMetricsTrackerRef.current.resume()
            updatePhase('listening')
            resumeListening()
          }
        }

        if (!message.recoverable) {
          clearInitialSilenceTimer()
          deliveryMetricsTrackerRef.current.suspend()
          pauseListening()
        }
        return
      }

      if (message.question_id !== questionIdRef.current) {
        return
      }

      if (message.type === 'answer.reaction') {
        if (playedReactionQuestionsRef.current.has(message.question_id)) {
          return
        }

        playedReactionQuestionsRef.current.add(message.question_id)
        clearInitialSilenceTimer()
        clearPendingTranscript()
        deliveryMetricsTrackerRef.current.suspend()
        manualSubmissionRef.current = true
        pauseListening()
        stopConfirmation()
        updatePhase('committing')
        void playAnswerReaction({
          ...message,
          answer_text: answerTextRef.current,
        })
        return
      }

      if (message.type === 'turn.confirmation.requested') {
        void handleConfirmationRequested(message)
        return
      }

      if (message.type === 'turn.confirmation.cancelled') {
        const activeConfirmation = confirmationRef.current

        if (activeConfirmation?.confirmationId === message.confirmation_id) {
          stopConfirmation()
          restoreAnswerAfterConfirmation({
            revision: activeConfirmation.baseRevision,
            reason: 'candidate_wants_to_continue',
          })
        }
        return
      }

      if (message.type === 'turn.state.changed') {
        setErrorMessage('')

        if (
          confirmationRef.current &&
          CONFIRMATION_RESULT_REASONS.has(message.reason)
        ) {
          restoreAnswerAfterConfirmation(message)
          return
        }

        if (!manualSubmissionRef.current) {
          updatePhase('listening')
        }
        return
      }

      if (message.type === 'answer.committed') {
        clearInitialSilenceTimer()
        clearPendingTranscript()
        deliveryMetricsTrackerRef.current.suspend()
        automaticallyCommittedQuestionsRef.current.add(message.question_id)
        manualSubmissionRef.current = true
        pauseListening()
        stopConfirmation()
        updatePhase('committing')
        onSessionCommitted(message.session)
      }
    },
    [
      clearInitialSilenceTimer,
      clearPendingTranscript,
      handleConfirmationRequested,
      onSessionCommitted,
      pauseListening,
      playAnswerReaction,
      restoreAnswerAfterConfirmation,
      resumeListening,
      sendMessage,
      startInitialSilenceTimer,
      stopConfirmation,
      updatePhase,
    ],
  )

  useEffect(() => subscribe(handleServerMessage), [handleServerMessage, subscribe])

  const startQuestion = useCallback(() => {
    clearInitialSilenceTimer()
    manualSubmissionRef.current = false
    modeRef.current = 'answer'
    syncBlockedRef.current = false
    disconnectedSnapshotDirtyRef.current = false
    hasSpokenRef.current = false
    deliveryMetricsTrackerRef.current.reset(questionIdRef.current)
    setErrorMessage('')
    updatePhase('listening')
  }, [clearInitialSilenceTimer, updatePhase])

  const beginManualSubmission = useCallback(() => {
    if (
      manualSubmissionRef.current ||
      modeRef.current !== 'answer' ||
      ![
        'listening',
        'initial_silence',
        'judging',
        'barge_in',
        'sync_error',
      ].includes(phaseRef.current)
    ) {
      return false
    }

    manualSubmissionRef.current = true
    clearInitialSilenceTimer()
    clearPendingTranscript()

    if (!speechActiveRef.current) {
      deliveryMetricsTrackerRef.current.suspend()
    }

    updatePhase('committing')
    return true
  }, [clearInitialSilenceTimer, clearPendingTranscript, updatePhase])

  const cancelManualSubmission = useCallback(() => {
    manualSubmissionRef.current = false

    if (hasSpokenRef.current) {
      deliveryMetricsTrackerRef.current.resume()
    }

    updatePhase(syncBlockedRef.current ? 'sync_error' : 'listening')

    if (!hasSpokenRef.current && !syncBlockedRef.current) {
      startInitialSilenceTimer()
    }
  }, [startInitialSilenceTimer, updatePhase])

  const canSubmitManualAnswer = useCallback((targetQuestionId) => {
    return !automaticallyCommittedQuestionsRef.current.has(targetQuestionId)
  }, [])

  const createDeliverySnapshot = useCallback((text) => {
    return deliveryMetricsTrackerRef.current.createSnapshot(text)
  }, [])

  const completeManualSubmission = useCallback(
    (response) => {
      if (!response) {
        return
      }

      clearPendingTranscript()
      clearInitialSilenceTimer()
      manualSubmissionRef.current = true
      updatePhase(response.finished ? 'finished' : 'idle')
    },
    [clearInitialSilenceTimer, clearPendingTranscript, updatePhase],
  )

  useEffect(() => {
    return () => {
      clearInitialSilenceTimer()
      clearPendingTranscript()
      stopConfirmation()
    }
  }, [clearInitialSilenceTimer, clearPendingTranscript, stopConfirmation])

  return {
    phase,
    answerText,
    revision,
    speechActive,
    confirmation,
    errorMessage,
    handleTranscriptSnapshot,
    handleSpeechActivityChange,
    startQuestion,
    startInitialSilenceTimer,
    clearInitialSilenceTimer,
    beginManualSubmission,
    cancelManualSubmission,
    canSubmitManualAnswer,
    createDeliverySnapshot,
    completeManualSubmission,
  }
}

export default useVoiceTurnController
