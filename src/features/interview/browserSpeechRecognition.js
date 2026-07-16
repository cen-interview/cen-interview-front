const RECOGNITION_RESTART_DELAY_MS = 150
const FINALIZATION_TIMEOUT_MS = 2000
const EXPECTED_ERROR_CODES = new Set(['aborted', 'no-speech'])

const getRecognitionConstructor = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

const createRecognitionError = (event) => {
  const recognitionError = new Error(
    event.error
      ? `브라우저 음성 인식에 실패했습니다: ${event.error}`
      : '브라우저 음성 인식에 실패했습니다.',
  )
  recognitionError.name =
    event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'NotAllowedError'
      : 'SpeechRecognitionError'
  recognitionError.code = event.error || 'unknown'
  return recognitionError
}

/**
 * 현재 브라우저가 Web Speech 음성 인식을 제공하는지 확인한다.
 *
 * Chrome 계열의 기존 webkitSpeechRecognition도 같은 인터페이스로 처리한다.
 *
 * @returns {boolean} 브라우저 SpeechRecognition 지원 여부
 */
export const isBrowserSpeechRecognitionSupported = () => {
  return Boolean(getRecognitionConstructor())
}

/**
 * 브라우저 SpeechRecognition의 시작·종료와 자동 재시작을 관리한다.
 *
 * 브라우저는 continuous 설정에서도 세션을 임의로 종료할 수 있으므로 인식을
 * 계속해야 하는 상태라면 end 이벤트 뒤에 새 cycle을 시작한다. commit은 현재
 * cycle을 stop해서 final 결과를 유도하고, finalize는 재시작 없이 마지막 결과가
 * 도착할 때까지 기다린다.
 *
 * @param {{
 *   onResult: (result: { itemId: string, cycle: number, transcript: string, isFinal: boolean }) => void,
 *   onFatalError: (error: Error) => void
 * }} callbacks 전사 결과와 폴백이 필요한 오류 callback
 * @returns {{
 *   start: () => boolean,
 *   pause: () => void,
 *   commit: () => boolean,
 *   finalize: () => Promise<void>,
 *   destroy: () => void
 * }} 브라우저 음성 인식 제어기
 */
export const createBrowserSpeechRecognition = ({
  onResult,
  onFatalError,
}) => {
  const Recognition = getRecognitionConstructor()

  if (!Recognition) {
    throw new Error('이 브라우저에서는 음성 인식을 사용할 수 없습니다.')
  }

  const recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.interimResults = true
  recognition.continuous = true
  recognition.maxAlternatives = 1

  let destroyed = false
  let shouldRun = false
  let state = 'idle'
  let cycle = 0
  let restartTimerId = null
  let lastResult = null
  let promoteInterimOnEnd = true
  const finalizationWaiters = new Set()

  const resolveFinalizationWaiters = () => {
    finalizationWaiters.forEach(({ resolve, timeoutId }) => {
      window.clearTimeout(timeoutId)
      resolve()
    })
    finalizationWaiters.clear()
  }

  const startRecognition = () => {
    if (destroyed) {
      return false
    }

    shouldRun = true

    if (state !== 'idle') {
      return true
    }

    if (restartTimerId !== null) {
      window.clearTimeout(restartTimerId)
      restartTimerId = null
    }

    try {
      cycle += 1
      lastResult = null
      promoteInterimOnEnd = true
      state = 'starting'
      recognition.start()
      return true
    } catch (error) {
      state = 'idle'
      shouldRun = false
      onFatalError(error)
      return false
    }
  }

  const stopRecognition = ({ abort = false, restart = false } = {}) => {
    shouldRun = restart
    promoteInterimOnEnd = !abort

    if (restartTimerId !== null) {
      window.clearTimeout(restartTimerId)
      restartTimerId = null
    }

    if (state === 'idle') {
      if (restart) {
        return startRecognition()
      }
      return false
    }

    try {
      state = 'stopping'
      if (abort) {
        recognition.abort()
      } else {
        recognition.stop()
      }
      return true
    } catch (error) {
      state = 'idle'
      shouldRun = false
      onFatalError(error)
      return false
    }
  }

  recognition.onstart = () => {
    state = 'running'
  }

  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript?.trim() ?? ''

      lastResult = {
        itemId: `browser-${cycle}-${index}`,
        cycle,
        transcript,
        isFinal: result.isFinal,
      }
      onResult(lastResult)
    }
  }

  recognition.onerror = (event) => {
    if (EXPECTED_ERROR_CODES.has(event.error)) {
      return
    }

    shouldRun = false
    promoteInterimOnEnd = false
    onFatalError(createRecognitionError(event))
  }

  recognition.onend = () => {
    state = 'idle'

    if (
      promoteInterimOnEnd &&
      lastResult &&
      !lastResult.isFinal &&
      lastResult.transcript
    ) {
      lastResult = {
        ...lastResult,
        isFinal: true,
      }
      onResult(lastResult)
    }

    resolveFinalizationWaiters()

    if (!destroyed && shouldRun) {
      restartTimerId = window.setTimeout(() => {
        restartTimerId = null
        startRecognition()
      }, RECOGNITION_RESTART_DELAY_MS)
    }
  }

  const finalize = () => {
    shouldRun = false

    if (restartTimerId !== null) {
      window.clearTimeout(restartTimerId)
      restartTimerId = null
    }

    if (state === 'idle') {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timeoutId: window.setTimeout(() => {
          finalizationWaiters.delete(waiter)
          resolve()
        }, FINALIZATION_TIMEOUT_MS),
      }
      finalizationWaiters.add(waiter)
      stopRecognition()
    })
  }

  const destroy = () => {
    destroyed = true
    shouldRun = false

    if (restartTimerId !== null) {
      window.clearTimeout(restartTimerId)
      restartTimerId = null
    }

    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null

    try {
      recognition.abort()
    } catch {
      // 이미 종료된 브라우저 인식 세션은 추가 정리가 필요하지 않다.
    }

    resolveFinalizationWaiters()
  }

  return {
    start: startRecognition,
    pause: () => stopRecognition({ abort: true }),
    commit: () => stopRecognition({ restart: true }),
    finalize,
    destroy,
  }
}
