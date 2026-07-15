const MINIMUM_SPEECH_RATE_DURATION_SECONDS = 1
const FILLER_WORDS = new Set(['어', '음', '아', 'uh', 'um', 'erm'])

const roundToOneDecimal = (value) => Math.round(value * 10) / 10

const normalizeTimestamp = (timestamp) => {
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

const countWords = (text) => {
  return text?.trim() ? text.trim().split(/\s+/).length : 0
}

const countFillers = (text) => {
  const words = text?.toLowerCase().match(/[a-z가-힣]+/g) ?? []
  return words.filter((word) => FILLER_WORDS.has(word)).length
}

/**
 * 질문 하나의 실제 발화 시간과 전달 지표를 누적하는 tracker를 만든다.
 *
 * React 렌더링과 무관한 시간 값은 closure에 보관한다. confirmation과 재연결
 * 구간에는 suspend하고, 일반 답변 수집이 재개되면 resume해서 시스템 대기 시간이
 * 답변 시간에 포함되지 않도록 한다.
 *
 * @returns 질문별 발화 시간 기록과 전송용 snapshot 생성 함수
 */
export const createVoiceDeliveryMetricsTracker = () => {
  let questionId = ''
  let firstSpeechAt = null
  let activeSpeechStartedAt = null
  let activeAnswerWindowStartedAt = null
  let accumulatedSpeechMs = 0
  let accumulatedAnswerWindowMs = 0

  const stopSpeaking = (timestamp = Date.now()) => {
    if (activeSpeechStartedAt === null) {
      return
    }

    const stoppedAt = normalizeTimestamp(timestamp)
    accumulatedSpeechMs += Math.max(0, stoppedAt - activeSpeechStartedAt)
    activeSpeechStartedAt = null
  }

  const reset = (nextQuestionId = '') => {
    questionId = nextQuestionId
    firstSpeechAt = null
    activeSpeechStartedAt = null
    activeAnswerWindowStartedAt = null
    accumulatedSpeechMs = 0
    accumulatedAnswerWindowMs = 0
  }

  const startSpeaking = (timestamp = Date.now()) => {
    if (activeSpeechStartedAt !== null) {
      return
    }

    const startedAt = normalizeTimestamp(timestamp)

    if (firstSpeechAt === null) {
      firstSpeechAt = startedAt
    }

    if (activeAnswerWindowStartedAt === null) {
      activeAnswerWindowStartedAt = startedAt
    }

    activeSpeechStartedAt = startedAt
  }

  const suspend = (timestamp = Date.now()) => {
    const suspendedAt = normalizeTimestamp(timestamp)
    stopSpeaking(suspendedAt)

    if (activeAnswerWindowStartedAt !== null) {
      accumulatedAnswerWindowMs += Math.max(
        0,
        suspendedAt - activeAnswerWindowStartedAt,
      )
      activeAnswerWindowStartedAt = null
    }
  }

  const resume = (timestamp = Date.now()) => {
    if (firstSpeechAt === null || activeAnswerWindowStartedAt !== null) {
      return
    }

    activeAnswerWindowStartedAt = normalizeTimestamp(timestamp)
  }

  const createSnapshot = (text, timestamp = Date.now()) => {
    const capturedAt = normalizeTimestamp(timestamp)
    const activeSpeechMs =
      activeSpeechStartedAt === null
        ? 0
        : Math.max(0, capturedAt - activeSpeechStartedAt)
    const activeAnswerWindowMs =
      activeAnswerWindowStartedAt === null
        ? 0
        : Math.max(0, capturedAt - activeAnswerWindowStartedAt)
    const durationSeconds = (accumulatedSpeechMs + activeSpeechMs) / 1000
    const answerDurationSeconds =
      firstSpeechAt === null
        ? undefined
        : roundToOneDecimal(
            (accumulatedAnswerWindowMs + activeAnswerWindowMs) / 1000,
          )
    const wordCount = countWords(text)
    const metrics = {
      filler_count: countFillers(text),
    }
    const roundedDurationSeconds = roundToOneDecimal(durationSeconds)

    if (roundedDurationSeconds > 0) {
      metrics.duration_seconds = roundedDurationSeconds
    }

    if (
      wordCount > 0 &&
      durationSeconds >= MINIMUM_SPEECH_RATE_DURATION_SECONDS
    ) {
      metrics.speech_rate_wpm = roundToOneDecimal(
        (wordCount / durationSeconds) * 60,
      )
    }

    return {
      questionId,
      answerDurationSeconds,
      metrics: wordCount > 0 ? metrics : undefined,
    }
  }

  return {
    reset,
    startSpeaking,
    stopSpeaking,
    suspend,
    resume,
    createSnapshot,
  }
}
