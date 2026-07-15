import { useCallback, useEffect, useRef, useState } from 'react'

const TRANSCRIPT_THROTTLE_MS = 500
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
  const cancelledConfirmationIdsRef = useRef(new Set())

  const updatePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const clearPendingTranscript = useCallback(() => {
    if (throttleTimerRef.current) {
      window.clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = undefined
    }

    pendingSnapshotRef.current = null
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
    revisionRef.current = initialRevision
    answerTextRef.current = ''
    speechActiveRef.current = false
    modeRef.current = 'answer'
    confirmationRef.current = null
    manualSubmissionRef.current = false
    lastSentAtRef.current = 0
    lastSentSnapshotRef.current = null
    setRevision(initialRevision)
    setAnswerText('')
    setSpeechActive(false)
    setConfirmation(null)
    setErrorMessage('')
    updatePhase('idle')
  }, [clearPendingTranscript, questionId, sessionId, updatePhase])

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
      const sent = sendMessage({
        type: 'answer.transcript.updated',
        question_id: questionIdRef.current,
        revision: nextRevision,
        text,
        speech_active: speechActiveRef.current,
        segment_final: snapshot.segmentFinal,
      })

      if (!sent) {
        return false
      }

      revisionRef.current = nextRevision
      answerTextRef.current = text
      lastSentAtRef.current = Date.now()
      lastSentSnapshotRef.current = {
        text,
        segmentFinal: snapshot.segmentFinal,
        speechActive: speechActiveRef.current,
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
    [sendMessage, updatePhase],
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
      if (modeRef.current === 'confirmation') {
        handleConfirmationTranscript(snapshot)
        return
      }

      if (
        manualSubmissionRef.current ||
        !['listening', 'judging', 'barge_in'].includes(phaseRef.current)
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
      publishTranscript,
    ],
  )

  const handleSpeechActivityChange = useCallback(
    ({ speechActive: nextSpeechActive }) => {
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
        confirmationRef.current = null
        answerTextRef.current = activeConfirmation.baseAnswer
        speechActiveRef.current = true
        lastSentSnapshotRef.current = {
          text: activeConfirmation.baseAnswer,
          segmentFinal: false,
          speechActive: true,
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

      if (
        manualSubmissionRef.current ||
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
    [replaceTranscript, sendMessage, stopConfirmation, updatePhase],
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
      resumeListening()
      updatePhase('listening')
    },
    [clearPendingTranscript, replaceTranscript, resumeListening, updatePhase],
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

      clearPendingTranscript()
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
        if (message.question_id === questionIdRef.current) {
          revisionRef.current = message.revision
          setRevision(message.revision)
        }
        return
      }

      if (message.type === 'error') {
        if (message.recoverable) {
          setErrorMessage(message.message || '자동 제출을 처리하지 못했습니다.')

          if (message.code === 'commit_failed') {
            manualSubmissionRef.current = false
            updatePhase('listening')
            resumeListening()
          }
        }
        return
      }

      if (message.question_id !== questionIdRef.current) {
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
        clearPendingTranscript()
        automaticallyCommittedQuestionsRef.current.add(message.question_id)
        manualSubmissionRef.current = true
        pauseListening()
        stopConfirmation()
        updatePhase('committing')
        onSessionCommitted(message.session)
      }
    },
    [
      clearPendingTranscript,
      handleConfirmationRequested,
      onSessionCommitted,
      pauseListening,
      restoreAnswerAfterConfirmation,
      resumeListening,
      stopConfirmation,
      updatePhase,
    ],
  )

  useEffect(() => subscribe(handleServerMessage), [handleServerMessage, subscribe])

  const startQuestion = useCallback(() => {
    manualSubmissionRef.current = false
    modeRef.current = 'answer'
    setErrorMessage('')
    updatePhase('listening')
  }, [updatePhase])

  const beginManualSubmission = useCallback(() => {
    if (
      manualSubmissionRef.current ||
      modeRef.current !== 'answer' ||
      !['listening', 'judging', 'barge_in'].includes(phaseRef.current)
    ) {
      return false
    }

    manualSubmissionRef.current = true
    clearPendingTranscript()
    updatePhase('committing')
    return true
  }, [clearPendingTranscript, updatePhase])

  const cancelManualSubmission = useCallback(() => {
    manualSubmissionRef.current = false
    updatePhase('listening')
  }, [updatePhase])

  const canSubmitManualAnswer = useCallback((targetQuestionId) => {
    return !automaticallyCommittedQuestionsRef.current.has(targetQuestionId)
  }, [])

  const completeManualSubmission = useCallback(
    (response) => {
      if (!response) {
        return
      }

      clearPendingTranscript()
      manualSubmissionRef.current = true
      updatePhase(response.finished ? 'finished' : 'idle')
    },
    [clearPendingTranscript, updatePhase],
  )

  useEffect(() => {
    return () => {
      clearPendingTranscript()
      stopConfirmation()
    }
  }, [clearPendingTranscript, stopConfirmation])

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
    beginManualSubmission,
    cancelManualSubmission,
    canSubmitManualAnswer,
    completeManualSubmission,
  }
}

export default useVoiceTurnController
