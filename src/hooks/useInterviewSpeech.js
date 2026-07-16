import { useCallback, useEffect, useRef, useState } from 'react'
import { generateInterviewSpeech } from '../api/interview.js'

const AUTOPLAY_ERROR_MESSAGE =
  '브라우저에서 자동 재생을 허용하지 않았습니다. 질문 듣기를 눌러주세요.'

const normalizeUtterances = (utterances) => {
  return utterances.map((utterance) => utterance?.trim()).filter(Boolean)
}

/**
 * 면접관 발화를 미리 합성하고 요청 순서대로 끊김 없이 재생한다.
 *
 * playQueue는 기존 재생을 취소하고 새 큐로 교체한다. enqueueAfterCurrent는
 * 현재 음성을 유지한 채 다음 큐의 TTS 요청을 즉시 시작하고, 실제 재생만
 * 앞선 큐가 끝날 때까지 기다린다. 합성된 Blob은 문장별로 캐싱하므로 고정
 * 리액션과 동일 문장을 다시 받을 때 네트워크 요청을 반복하지 않는다.
 *
 * @returns {{
 *   phase: 'idle' | 'loading' | 'playing' | 'completed' | 'error',
 *   errorMessage: string,
 *   playQueue: (utterances: string[]) => Promise<boolean>,
 *   enqueueAfterCurrent: (utterances: string[]) => Promise<boolean>,
 *   warmCache: (utterances: string[]) => Promise<boolean[]>,
 *   stop: () => void
 * }} TTS 캐시, 직렬 재생 상태와 제어 함수
 */
function useInterviewSpeech() {
  const [phase, setPhase] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const audioRef = useRef(null)
  const objectUrlRef = useRef('')
  const playbackIdRef = useRef(0)
  const pendingPlaybackRef = useRef(null)
  const queueTailRef = useRef(Promise.resolve(true))
  const audioCacheRef = useRef(new Map())
  const requestControllersRef = useRef(new Set())
  const mountedRef = useRef(true)

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current

    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
    }
  }, [])

  const cancelCurrentPlayback = useCallback(() => {
    playbackIdRef.current += 1
    pendingPlaybackRef.current?.(false)
    pendingPlaybackRef.current = null
    releaseAudio()
    queueTailRef.current = Promise.resolve(false)
  }, [releaseAudio])

  const getCachedSpeech = useCallback((utterance) => {
    const cachedSpeech = audioCacheRef.current.get(utterance)

    if (cachedSpeech) {
      return cachedSpeech
    }

    const abortController = new AbortController()
    requestControllersRef.current.add(abortController)
    const speechRequest = generateInterviewSpeech(utterance, {
      signal: abortController.signal,
    })
      .catch((error) => {
        audioCacheRef.current.delete(utterance)
        throw error
      })
      .finally(() => {
        requestControllersRef.current.delete(abortController)
      })
    audioCacheRef.current.set(utterance, speechRequest)
    return speechRequest
  }, [])

  const prepareQueue = useCallback(
    (utterances) => {
      return normalizeUtterances(utterances).map((utterance) => ({
        audioBlob: getCachedSpeech(utterance),
      }))
    },
    [getCachedSpeech],
  )

  const playPreparedQueue = useCallback(
    async (preparedQueue, playbackId) => {
      if (preparedQueue.length === 0) {
        if (mountedRef.current) {
          setPhase('error')
          setErrorMessage('재생할 면접관 질문이 없습니다.')
        }
        return false
      }

      if (mountedRef.current) {
        setErrorMessage('')
      }

      try {
        for (const preparedSpeech of preparedQueue) {
          if (playbackId !== playbackIdRef.current) {
            return false
          }

          if (mountedRef.current) {
            setPhase('loading')
          }
          const audioBlob = await preparedSpeech.audioBlob

          if (playbackId !== playbackIdRef.current) {
            return false
          }

          const objectUrl = URL.createObjectURL(audioBlob)
          const audio = new Audio(objectUrl)
          objectUrlRef.current = objectUrl
          audioRef.current = audio

          if (mountedRef.current) {
            setPhase('playing')
          }

          const playedToEnd = await new Promise((resolve, reject) => {
            pendingPlaybackRef.current = resolve

            audio.addEventListener(
              'ended',
              () => {
                pendingPlaybackRef.current = null
                resolve(true)
              },
              { once: true },
            )
            audio.addEventListener(
              'error',
              () => {
                pendingPlaybackRef.current = null
                reject(new Error('면접관 음성을 재생하지 못했습니다.'))
              },
              { once: true },
            )

            audio.play().catch((playError) => {
              pendingPlaybackRef.current = null
              reject(playError)
            })
          })

          releaseAudio()

          if (!playedToEnd || playbackId !== playbackIdRef.current) {
            return false
          }
        }

        if (mountedRef.current) {
          setPhase('completed')
        }
        return true
      } catch (playError) {
        releaseAudio()

        if (playbackId !== playbackIdRef.current) {
          return false
        }

        const message =
          playError.name === 'NotAllowedError'
            ? AUTOPLAY_ERROR_MESSAGE
            : '면접관 음성을 생성하거나 재생하지 못했습니다.'

        if (mountedRef.current) {
          setPhase('error')
          setErrorMessage(message)
        }
        return false
      }
    },
    [releaseAudio],
  )

  const playQueue = useCallback(
    (utterances) => {
      cancelCurrentPlayback()
      const playbackId = playbackIdRef.current
      const preparedQueue = prepareQueue(utterances)
      const playback = playPreparedQueue(preparedQueue, playbackId)
      queueTailRef.current = playback
      return playback
    },
    [cancelCurrentPlayback, playPreparedQueue, prepareQueue],
  )

  const enqueueAfterCurrent = useCallback(
    (utterances) => {
      const playbackId = playbackIdRef.current
      // TTS Promise는 앞선 음성 재생을 기다리기 전에 생성해 프리페치한다.
      const preparedQueue = prepareQueue(utterances)
      const previousQueue = queueTailRef.current
      const playback = previousQueue.then(() => {
        return playPreparedQueue(preparedQueue, playbackId)
      })
      queueTailRef.current = playback
      return playback
    },
    [playPreparedQueue, prepareQueue],
  )

  const warmCache = useCallback(
    (utterances) => {
      return Promise.all(
        normalizeUtterances(utterances).map((utterance) => {
          return getCachedSpeech(utterance).then(
            () => true,
            () => false,
          )
        }),
      )
    },
    [getCachedSpeech],
  )

  const stop = useCallback(() => {
    cancelCurrentPlayback()

    if (mountedRef.current) {
      setPhase('idle')
      setErrorMessage('')
    }
  }, [cancelCurrentPlayback])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      cancelCurrentPlayback()
      requestControllersRef.current.forEach((controller) => controller.abort())
      requestControllersRef.current.clear()
      audioCacheRef.current.clear()
    }
  }, [cancelCurrentPlayback])

  return {
    phase,
    errorMessage,
    playQueue,
    enqueueAfterCurrent,
    warmCache,
    stop,
  }
}

export default useInterviewSpeech
