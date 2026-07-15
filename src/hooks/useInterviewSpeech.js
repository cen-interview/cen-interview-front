import { useCallback, useEffect, useRef, useState } from 'react'
import { generateInterviewSpeech } from '../api/interview.js'

const AUTOPLAY_ERROR_MESSAGE =
  '브라우저에서 자동 재생을 허용하지 않았습니다. 질문 듣기를 눌러주세요.'

/**
 * 면접관 발화 목록을 순서대로 TTS로 변환하고 재생한다.
 *
 * 각 발화는 백엔드에서 MP3 Blob으로 받은 뒤 임시 Object URL로 재생한다.
 * 새 재생이 시작되거나 화면을 벗어나면 진행 중인 요청과 오디오를 정리해
 * 이전 질문이 다음 질문과 겹쳐 들리지 않도록 한다.
 *
 * @returns {{
 *   phase: 'idle' | 'loading' | 'playing' | 'completed' | 'error',
 *   errorMessage: string,
 *   playQueue: (utterances: string[]) => Promise<boolean>,
 *   stop: () => void
 * }} TTS 재생 상태와 제어 함수
 */
function useInterviewSpeech() {
  const [phase, setPhase] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const audioRef = useRef(null)
  const objectUrlRef = useRef('')
  const abortControllerRef = useRef(null)
  const playbackIdRef = useRef(0)
  const pendingPlaybackRef = useRef(null)
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
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    pendingPlaybackRef.current?.(false)
    pendingPlaybackRef.current = null
    releaseAudio()
  }, [releaseAudio])

  const stop = useCallback(() => {
    cancelCurrentPlayback()

    if (mountedRef.current) {
      setPhase('idle')
      setErrorMessage('')
    }
  }, [cancelCurrentPlayback])

  const playQueue = useCallback(
    async (utterances) => {
      const playableUtterances = utterances
        .map((utterance) => utterance?.trim())
        .filter(Boolean)

      cancelCurrentPlayback()
      const playbackId = playbackIdRef.current

      if (playableUtterances.length === 0) {
        setPhase('error')
        setErrorMessage('재생할 면접관 질문이 없습니다.')
        return false
      }

      setErrorMessage('')

      try {
        for (const utterance of playableUtterances) {
          if (playbackId !== playbackIdRef.current) {
            return false
          }

          const abortController = new AbortController()
          abortControllerRef.current = abortController
          setPhase('loading')

          const audioBlob = await generateInterviewSpeech(utterance, {
            signal: abortController.signal,
          })

          if (playbackId !== playbackIdRef.current) {
            return false
          }

          abortControllerRef.current = null
          const objectUrl = URL.createObjectURL(audioBlob)
          const audio = new Audio(objectUrl)
          objectUrlRef.current = objectUrl
          audioRef.current = audio
          setPhase('playing')

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

        setPhase('completed')
        return true
      } catch (playError) {
        releaseAudio()
        abortControllerRef.current = null

        if (
          playbackId !== playbackIdRef.current ||
          playError.name === 'AbortError' ||
          playError.name === 'CanceledError'
        ) {
          return false
        }

        const message =
          playError.name === 'NotAllowedError'
            ? AUTOPLAY_ERROR_MESSAGE
            : '면접관 음성을 생성하거나 재생하지 못했습니다.'

        setPhase('error')
        setErrorMessage(message)
        return false
      }
    },
    [cancelCurrentPlayback, releaseAudio],
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      cancelCurrentPlayback()
    }
  }, [cancelCurrentPlayback])

  return {
    phase,
    errorMessage,
    playQueue,
    stop,
  }
}

export default useInterviewSpeech
