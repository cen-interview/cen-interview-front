const KOREAN_LANGUAGE = 'ko-KR'
const VOICE_LOAD_TIMEOUT_MS = 1000

let activeSpeech = null
let voicePreparation = null

const getSpeechSynthesis = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  return window.speechSynthesis
}

const getAvailableVoices = () => {
  const speechSynthesis = getSpeechSynthesis()

  if (!speechSynthesis) {
    return []
  }

  try {
    return speechSynthesis.getVoices()
  } catch {
    return []
  }
}

const normalizeLanguage = (language) => {
  return language?.trim().replace('_', '-').toLowerCase() || ''
}

const selectKoreanVoice = () => {
  const koreanVoices = getAvailableVoices().filter((voice) => {
    return normalizeLanguage(voice.lang).startsWith('ko')
  })

  if (koreanVoices.length === 0) {
    return null
  }

  return koreanVoices.sort((left, right) => {
    const scoreVoice = (voice) => {
      const languageScore =
        normalizeLanguage(voice.lang) === normalizeLanguage(KOREAN_LANGUAGE)
          ? 4
          : 0
      const localServiceScore = voice.localService ? 2 : 0
      const defaultScore = voice.default ? 1 : 0

      return languageScore + localServiceScore + defaultScore
    }

    return scoreVoice(right) - scoreVoice(left)
  })[0]
}

const createSpeechError = (event) => {
  const speechError = new Error(
    event.error
      ? `브라우저 음성 합성에 실패했습니다: ${event.error}`
      : '브라우저 음성 합성에 실패했습니다.',
  )
  speechError.name =
    event.error === 'not-allowed'
      ? 'NotAllowedError'
      : 'SpeechSynthesisError'
  speechError.code = event.error || 'unknown'
  return speechError
}

const finishActiveSpeech = ({ result, error } = {}) => {
  const currentSpeech = activeSpeech

  if (!currentSpeech) {
    return
  }

  activeSpeech = null
  currentSpeech.utterance.onstart = null
  currentSpeech.utterance.onend = null
  currentSpeech.utterance.onerror = null

  if (error) {
    currentSpeech.reject(error)
    return
  }

  currentSpeech.resolve(result ?? false)
}

const replaceActiveSpeech = () => {
  if (!activeSpeech) {
    return
  }

  const speechSynthesis = getSpeechSynthesis()
  finishActiveSpeech({ result: false })
  speechSynthesis?.cancel()
}

/**
 * 현재 브라우저가 Web Speech 음성 합성을 제공하는지 확인한다.
 *
 * @returns {boolean} SpeechSynthesis와 SpeechSynthesisUtterance 지원 여부
 */
export const isBrowserSpeechSupported = () => {
  return Boolean(
    getSpeechSynthesis() &&
      typeof window !== 'undefined' &&
      'SpeechSynthesisUtterance' in window,
  )
}

/**
 * 브라우저의 음성 목록이 준비될 때까지 짧게 기다린다.
 *
 * Chrome 계열 브라우저는 최초 getVoices 호출에서 빈 배열을 반환할 수 있다.
 * voiceschanged 이벤트를 기다리되, 기본 음성 선택만으로도 합성할 수 있도록
 * 제한 시간이 지나면 Web Speech를 사용할 수 있는 상태로 처리한다.
 *
 * @returns {Promise<boolean>} Web Speech 사용 가능 여부
 */
export const prepareBrowserSpeech = () => {
  if (!isBrowserSpeechSupported()) {
    return Promise.resolve(false)
  }

  if (getAvailableVoices().length > 0) {
    return Promise.resolve(true)
  }

  if (voicePreparation) {
    return voicePreparation
  }

  const speechSynthesis = getSpeechSynthesis()
  voicePreparation = new Promise((resolve) => {
    let settled = false
    let timeoutId = null

    const complete = () => {
      if (settled) {
        return
      }

      settled = true
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      voicePreparation = null
      resolve(true)
    }

    const handleVoicesChanged = () => {
      if (getAvailableVoices().length > 0) {
        complete()
      }
    }

    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
    timeoutId = window.setTimeout(complete, VOICE_LOAD_TIMEOUT_MS)
    handleVoicesChanged()
  })

  return voicePreparation
}

/**
 * 텍스트 한 문장을 Web Speech API로 재생한다.
 *
 * 한국어 로컬 음성이 있으면 우선 선택하고, 별도 음성이 없으면 ko-KR 언어
 * 설정과 브라우저 기본 음성을 사용한다. 새 발화가 시작되면 Web Speech의
 * 전역 큐에 남은 이전 발화를 정리한다.
 *
 * @param {string} text 재생할 면접관 발화
 * @param {{ ownerId: symbol, onStart?: () => void }} options 재생 소유자와 시작 callback
 * @returns {Promise<boolean>} 끝까지 재생했으면 true, 취소됐으면 false
 */
export const speakWithBrowserSpeech = (text, { ownerId, onStart } = {}) => {
  if (!isBrowserSpeechSupported()) {
    const unsupportedError = new Error(
      '이 브라우저에서는 Web Speech 음성 합성을 사용할 수 없습니다.',
    )
    unsupportedError.name = 'NotSupportedError'
    return Promise.reject(unsupportedError)
  }

  replaceActiveSpeech()

  const speechSynthesis = getSpeechSynthesis()
  const utterance = new window.SpeechSynthesisUtterance(text)
  const koreanVoice = selectKoreanVoice()
  utterance.lang = KOREAN_LANGUAGE

  if (koreanVoice) {
    utterance.voice = koreanVoice
  }

  return new Promise((resolve, reject) => {
    activeSpeech = {
      ownerId,
      utterance,
      resolve,
      reject,
    }

    utterance.onstart = () => {
      if (activeSpeech?.utterance === utterance) {
        onStart?.()
      }
    }
    utterance.onend = () => {
      if (activeSpeech?.utterance === utterance) {
        finishActiveSpeech({ result: true })
      }
    }
    utterance.onerror = (event) => {
      if (activeSpeech?.utterance !== utterance) {
        return
      }

      if (event.error === 'canceled' || event.error === 'interrupted') {
        finishActiveSpeech({ result: false })
        return
      }

      finishActiveSpeech({ error: createSpeechError(event) })
    }

    try {
      speechSynthesis.speak(utterance)
    } catch (error) {
      if (activeSpeech?.utterance === utterance) {
        finishActiveSpeech({ error })
      }
    }
  })
}

/**
 * 지정한 재생 소유자의 Web Speech 발화만 중단한다.
 *
 * 질문·리액션과 확인 문구가 서로 다른 훅에서 관리되므로, 소유자가 다른
 * 발화까지 speechSynthesis.cancel로 끊지 않도록 현재 소유자를 확인한다.
 *
 * @param {symbol} ownerId 중단을 요청한 useInterviewSpeech 인스턴스 식별자
 */
export const cancelBrowserSpeech = (ownerId) => {
  if (!activeSpeech || activeSpeech.ownerId !== ownerId) {
    return
  }

  const speechSynthesis = getSpeechSynthesis()
  finishActiveSpeech({ result: false })
  speechSynthesis?.cancel()
}
