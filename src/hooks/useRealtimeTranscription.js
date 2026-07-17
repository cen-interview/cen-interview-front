import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../api/client'

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
// 소리로 인정할 최소 볼륨 기준
const SILENCE_THRESHOLD = 0.018
// 말이 끝났다고 판단할지 정하는 값 0.8초
const SILENCE_DURATION_MS = 800
// 한 번에 녹음해서 보내는 음성 조각의 최대 길이야. 15초
const MAX_CHUNK_DURATION_MS = 15000
// 확인 질문 TTS의 스피커 잔향보다 확실히 큰 소리만 재발화 후보로 본다.
const BARGE_IN_THRESHOLD = 0.035
// 확인 질문 재생 직후의 장치 전환음과 잔향을 무시하는 시간이다.
const BARGE_IN_GRACE_MS = 350
// 순간 소음이 아니라 실제 발화로 판단하기 위한 최소 연속 시간이다.
const BARGE_IN_HOLD_MS = 120

/**
 * 문장 끝에서 STT가 연속으로 반환한 동일한 종결 어절을 하나로 축약한다.
 *
 * 일반 단어 반복은 사용자 발화일 수 있으므로 유지한다. 동일한 마지막 두 어절이
 * 모두 같은 내용이고 해당 어절이 "-니다", "-요", "-죠" 형태로 끝날 때만
 * 뒤쪽 어절을 제거한다.
 *
 * @param {string} text 화면과 서버에 전달할 누적 전사 문장
 * @returns {string} 중복된 종결 어절을 제거한 문장
 */
const removeRepeatedSentenceEnding = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const normalizeWord = (word) => word.replace(/[.!?。！？]+$/u, '')

  while (words.length >= 2) {
    const previousWord = normalizeWord(words.at(-2))
    const lastWord = normalizeWord(words.at(-1))
    const isRepeatedEnding =
      previousWord === lastWord && /(?:니다|요|죠)$/u.test(lastWord)

    if (!isRepeatedEnding) {
      break
    }

    words.pop()
  }

  return words.join(' ')
}

/**
 * OpenAI Realtime STT 연결과 발화 구간을 관리한다.
 *
 * 화면용 누적 transcript 외에 Voice Turn WebSocket에서 사용할 수 있는 누적
 * 전사 snapshot과 실제 발화 시작·종료 snapshot을 만든다. callback은 Ref로
 * 보관하므로 호출하는 컴포넌트가 다시 렌더링돼도 음성 인식 연결을 재생성하지
 * 않는다. 마이크 권한과 음성 면접 세션이 준비되면 OpenAI Realtime WebRTC
 * 연결을 만들고 모든 환경에서 동일한 전사 엔진을 사용한다.
 *
 * @param {{
 *   onPermissionGranted?: () => Promise<object>,
 *   startListeningOnConnect?: boolean,
 *   onTranscriptSnapshot?: (snapshot: { text: string, itemId: string, segmentFinal: boolean }) => void,
 *   onSpeechActivityChange?: (snapshot: { speechActive: boolean, changedAt: number }) => void
 * }} options 음성 세션 시작과 구조화된 STT 이벤트 callback
 * @returns STT 상태, 누적 전사·발화 snapshot과 마이크 제어 함수
 */
function useRealtimeTranscription({
  onPermissionGranted,
  startListeningOnConnect = true,
  onTranscriptSnapshot,
  onSpeechActivityChange,
} = {}) {
  // 화면에 전달할 최종 인식 문장과 현재 연결 상태
  const [transcript, setTranscript] = useState('')
  const [speechActive, setSpeechActive] = useState(false)
  const [transcriptSnapshot, setTranscriptSnapshot] = useState(null)
  const [activitySnapshot, setActivitySnapshot] = useState(null)
  const [status, setStatus] = useState('requesting-permission')
  const [error, setError] = useState('')
  const onPermissionGrantedRef = useRef(onPermissionGranted)
  const startListeningOnConnectRef = useRef(startListeningOnConnect)
  const onTranscriptSnapshotRef = useRef(onTranscriptSnapshot)
  const onSpeechActivityChangeRef = useRef(onSpeechActivityChange)
  const audioTrackRef = useRef(null)
  const dataChannelRef = useRef(null)
  const transcriptionReadyRef = useRef(false)
  const listeningRequestedRef = useRef(false)
  const startTranscriptionCaptureRef = useRef(() => true)
  const stopTranscriptionCaptureRef = useRef(() => {})
  const startVolumeMonitoringRef = useRef(() => {})
  const stopVolumeMonitoringRef = useRef(() => {})
  const setMonitoringModeRef = useRef(() => {})
  const startBargeInDetectionRef = useRef(() => false)
  const resetTranscriptRef = useRef(() => setTranscript(''))
  const replaceTranscriptRef = useRef(() => {})
  const finalizeTranscriptRef = useRef(async () => '')

  useEffect(() => {
    onPermissionGrantedRef.current = onPermissionGranted
  }, [onPermissionGranted])

  useEffect(() => {
    startListeningOnConnectRef.current = startListeningOnConnect
  }, [startListeningOnConnect])

  useEffect(() => {
    onTranscriptSnapshotRef.current = onTranscriptSnapshot
  }, [onTranscriptSnapshot])

  useEffect(() => {
    onSpeechActivityChangeRef.current = onSpeechActivityChange
  }, [onSpeechActivityChange])

  // TTS 재생 직전 마이크 전송과 브라우저 음량 감지를 함께 멈춘다.
  const pauseListening = useCallback(() => {
    listeningRequestedRef.current = false
    stopTranscriptionCaptureRef.current()

    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = false
    }

    stopVolumeMonitoringRef.current()
    setStatus((currentStatus) =>
      currentStatus === 'listening' ? 'ready' : currentStatus,
    )
  }, [])

  // 선택된 STT 엔진과 실제 캡처 시작이 모두 준비된 경우에만 성공을 반환한다.
  const resumeListening = useCallback(() => {
    if (!audioTrackRef.current || !transcriptionReadyRef.current) {
      return false
    }

    listeningRequestedRef.current = true
    audioTrackRef.current.enabled = true
    setMonitoringModeRef.current('answer')
    const transcriptionCaptureStarted =
      startTranscriptionCaptureRef.current()
    startVolumeMonitoringRef.current()

    if (transcriptionCaptureStarted && transcriptionReadyRef.current) {
      setStatus('listening')
    }
    return Boolean(
      transcriptionCaptureStarted && transcriptionReadyRef.current,
    )
  }, [])

  // 확인 질문 TTS 중에는 높은 음량 기준으로 사용자 재발화만 감지한다.
  const startBargeInDetection = useCallback(() => {
    return startBargeInDetectionRef.current()
  }, [])

  // TTS 또는 이전 답변의 오디오가 Realtime 버퍼에 남지 않도록 비운다.
  const clearAudioBuffer = useCallback(() => {
    if (dataChannelRef.current?.readyState !== 'open') {
      return
    }

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'input_audio_buffer.clear',
      }),
    )
  }, [])

  // 새 답변을 받을 때 화면 문장과 내부 발화 조각을 함께 초기화한다.
  const resetTranscript = useCallback(() => {
    resetTranscriptRef.current()
  }, [])

  // 확인 응답 수집 후 기존 기본 답변을 화면과 누적 기준에 다시 복원한다.
  const replaceTranscript = useCallback((text, options) => {
    replaceTranscriptRef.current(text, options)
  }, [])

  // 마이크를 닫고 아직 처리 중인 오디오 구간의 최종 전사를 기다린다.
  const finalizeTranscript = useCallback(() => {
    return finalizeTranscriptRef.current()
  }, [])

  useEffect(() => {
    // 페이지를 벗어날 때 정리해야 하는 마이크·Realtime 통신 자원
    let disposed = false
    let peerConnection
    let dataChannel
    let mediaStream
    let audioTrack
    let audioContext
    let analyser
    let samples
    let animationFrameId
    let openAITranscriptionPromise = null

    const segments = new Map()
    let segmentOrder = 0
    let bufferHasSpeech = false
    let speechActiveValue = false
    let speechStartedAt = 0
    let lastSpeechAt = 0
    let pendingCommitCount = 0
    let transcriptValue = ''
    let monitoringMode = 'answer'
    let bargeInArmedAt = 0
    let bargeInLoudStartedAt = 0
    const finalizationWaiters = []

    // 발화 상태가 실제로 변경된 순간에만 상태와 선택적 callback을 갱신한다.
    const updateSpeechActivity = (nextSpeechActive) => {
      if (speechActiveValue === nextSpeechActive) {
        return
      }

      speechActiveValue = nextSpeechActive

      if (disposed) {
        return
      }

      const nextActivitySnapshot = {
        speechActive: nextSpeechActive,
        changedAt: Date.now(),
      }

      setSpeechActive(nextSpeechActive)
      setActivitySnapshot(nextActivitySnapshot)

      try {
        onSpeechActivityChangeRef.current?.(nextActivitySnapshot)
      } catch {
        // 화면 callback 오류가 마이크와 Realtime 연결을 중단시키지 않게 한다.
      }
    }

    const resolveFinalizationWaiters = () => {
      if (pendingCommitCount > 0) {
        return
      }

      finalizationWaiters.splice(0).forEach(({ resolve, timeoutId }) => {
        window.clearTimeout(timeoutId)
        resolve(transcriptValue.trim())
      })
    }

    resetTranscriptRef.current = () => {
      updateSpeechActivity(false)
      segments.clear()
      segmentOrder = 0
      transcriptValue = ''
      setTranscript('')
      setTranscriptSnapshot(null)
      setActivitySnapshot(null)
    }

    replaceTranscriptRef.current = (text, { preserveActivity = false } = {}) => {
      const normalizedText = text?.trim() ?? ''

      if (!preserveActivity) {
        updateSpeechActivity(false)
      }
      segments.clear()
      segmentOrder = 0
      transcriptValue = normalizedText

      if (normalizedText) {
        segments.set('__restored_answer__', {
          order: segmentOrder,
          text: normalizedText,
        })
        segmentOrder += 1
      }

      setTranscript(normalizedText)
      setTranscriptSnapshot(null)
      setActivitySnapshot(null)
    }

    const buildTranscript = () => {
      const joinedTranscript = [...segments.values()]
        .sort((first, second) => first.order - second.order)
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(' ')

      return removeRepeatedSentenceEnding(joinedTranscript)
    }

    // 발화 단위로 받은 텍스트 조각들을 화면에 표시할 한 문장으로 합친다.
    const updateTranscript = (itemId, segmentFinal) => {
      const nextTranscript = buildTranscript()

      transcriptValue = nextTranscript

      if (!disposed) {
        setTranscript(nextTranscript)

        const nextTranscriptSnapshot = {
          text: nextTranscript,
          itemId,
          segmentFinal,
        }

        setTranscriptSnapshot(nextTranscriptSnapshot)

        try {
          onTranscriptSnapshotRef.current?.(nextTranscriptSnapshot)
        } catch {
          // 화면 callback 오류가 이후 STT 이벤트 처리를 막지 않게 한다.
        }
      }
    }

    // 같은 발화의 delta는 이어 붙이고, completed 이벤트가 오면 최종 문장으로 교체한다.
    const updateSegment = (event, isCompleted = false) => {
      const itemId = event.item_id

      if (!segments.has(itemId)) {
        segments.set(itemId, {
          order: segmentOrder,
          text: '',
        })
        segmentOrder += 1
      }

      const segment = segments.get(itemId)
      segment.text = isCompleted ? event.transcript : segment.text + event.delta
      updateTranscript(itemId, isCompleted)
    }

    // 로컬 VAD가 현재 Realtime 오디오 구간을 확정한다.
    const commitAudio = ({ preserveActivity = false } = {}) => {
      if (!bufferHasSpeech) {
        return false
      }

      if (dataChannel?.readyState !== 'open') {
        return false
      }

      dataChannel.send(
        JSON.stringify({
          type: 'input_audio_buffer.commit',
        }),
      )

      pendingCommitCount += 1

      bufferHasSpeech = false
      speechStartedAt = 0

      if (!preserveActivity) {
        lastSpeechAt = 0
      }

      return true
    }

    // 마이크 음량을 관찰해 무음이 이어지거나 한 구간이 너무 길어지면 commit한다.
    const startVolumeMonitoring = () => {
      if (animationFrameId) {
        return
      }

      if (!audioContext) {
        audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(mediaStream)
        analyser = audioContext.createAnalyser()

        analyser.fftSize = 1024
        samples = new Float32Array(analyser.fftSize)
        source.connect(analyser)
      }

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => {
          // 사용자 활성화가 필요한 브라우저에서는 다음 시작 요청 때 다시 시도한다.
        })
      }

      const detectSilence = (now) => {
        analyser.getFloatTimeDomainData(samples)

        const meanSquare =
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
          samples.length
        const volume = Math.sqrt(meanSquare)
        const detectingBargeIn = monitoringMode === 'barge-in'
        const bargeInVolumeDetected =
          detectingBargeIn &&
          now >= bargeInArmedAt &&
          volume >= BARGE_IN_THRESHOLD

        if (detectingBargeIn) {
          if (bargeInVolumeDetected) {
            if (!bargeInLoudStartedAt) {
              bargeInLoudStartedAt = now
            }

            if (now - bargeInLoudStartedAt >= BARGE_IN_HOLD_MS) {
              monitoringMode = 'answer'
              bufferHasSpeech = true
              speechStartedAt = bargeInLoudStartedAt
              lastSpeechAt = now
              listeningRequestedRef.current = true
              startTranscriptionCaptureRef.current()
              updateSpeechActivity(true)
            }
          } else {
            bargeInLoudStartedAt = 0
          }
        }

        if (!detectingBargeIn && volume >= SILENCE_THRESHOLD) {
          if (!bufferHasSpeech) {
            bufferHasSpeech = true
            speechStartedAt = now
          }

          lastSpeechAt = now
          updateSpeechActivity(true)
        }

        const silenceDetected =
          speechActiveValue &&
          lastSpeechAt > 0 &&
          now - lastSpeechAt >= SILENCE_DURATION_MS
        const chunkIsFull =
          bufferHasSpeech &&
          speechStartedAt > 0 &&
          now - speechStartedAt >= MAX_CHUNK_DURATION_MS

        if (silenceDetected) {
          commitAudio()
          updateSpeechActivity(false)
        } else if (chunkIsFull) {
          // 긴 발화를 조각으로 나눌 뿐 실제 발화 종료 상태로 바꾸지는 않는다.
          commitAudio({ preserveActivity: true })
        }

        animationFrameId = requestAnimationFrame(detectSilence)
      }

      animationFrameId = requestAnimationFrame(detectSilence)
    }

    const stopVolumeMonitoring = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = undefined
      }

      bufferHasSpeech = false
      speechStartedAt = 0
      lastSpeechAt = 0
      updateSpeechActivity(false)
    }

    startVolumeMonitoringRef.current = startVolumeMonitoring
    stopVolumeMonitoringRef.current = stopVolumeMonitoring
    setMonitoringModeRef.current = (nextMode) => {
      monitoringMode = nextMode
      bargeInArmedAt = 0
      bargeInLoudStartedAt = 0
    }
    startBargeInDetectionRef.current = () => {
      if (!audioTrack || !transcriptionReadyRef.current) {
        return false
      }

      stopVolumeMonitoring()
      monitoringMode = 'barge-in'
      bargeInArmedAt = performance.now() + BARGE_IN_GRACE_MS
      bargeInLoudStartedAt = 0
      audioTrack.enabled = true
      startVolumeMonitoring()
      setStatus('listening')
      return true
    }
    finalizeTranscriptRef.current = async () => {
      listeningRequestedRef.current = false

      if (audioTrack) {
        audioTrack.enabled = false
      }

      commitAudio()
      stopVolumeMonitoring()

      if (!disposed) {
        setStatus('ready')
      }

      if (pendingCommitCount === 0) {
        return transcriptValue.trim()
      }

      return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
          const waiterIndex = finalizationWaiters.findIndex(
            (waiter) => waiter.timeoutId === timeoutId,
          )

          if (waiterIndex >= 0) {
            finalizationWaiters.splice(waiterIndex, 1)
          }

          pendingCommitCount = 0
          resolve(transcriptValue.trim())
        }, 8000)

        finalizationWaiters.push({ resolve, timeoutId })
      })
    }

    // SDP 교환이 끝나도 DataChannel은 아직 연결 중일 수 있으므로 open을 기다린다.
    const waitForDataChannelOpen = () => {
      if (dataChannel?.readyState === 'open') {
        return Promise.resolve()
      }

      return new Promise((resolve, reject) => {
        const removeListeners = () => {
          dataChannel?.removeEventListener('open', handleOpen)
          dataChannel?.removeEventListener('error', handleError)
          dataChannel?.removeEventListener('close', handleClose)
        }
        const handleOpen = () => {
          removeListeners()
          resolve()
        }
        const handleError = () => {
          removeListeners()
          reject(new Error('OpenAI Realtime 데이터 채널을 열지 못했습니다.'))
        }
        const handleClose = () => {
          removeListeners()
          reject(new Error('OpenAI Realtime 데이터 채널이 종료되었습니다.'))
        }

        dataChannel?.addEventListener('open', handleOpen)
        dataChannel?.addEventListener('error', handleError)
        dataChannel?.addEventListener('close', handleClose)
      })
    }

    // 연결 실패나 페이지 이탈 시 마이크·Realtime 자원을 한곳에서 정리한다.
    const cleanupVoiceResources = () => {
      stopVolumeMonitoring()

      audioTrack?.stop()
      mediaStream?.getTracks().forEach((track) => {
        if (track !== audioTrack) {
          track.stop()
        }
      })
      dataChannel?.close()
      peerConnection?.close()
      audioContext?.close()
      finalizationWaiters.splice(0).forEach(({ resolve, timeoutId }) => {
        window.clearTimeout(timeoutId)
        resolve(transcriptValue.trim())
      })
      audioTrackRef.current = null
      dataChannelRef.current = null
      transcriptionReadyRef.current = false
      listeningRequestedRef.current = false
      startTranscriptionCaptureRef.current = () => true
      stopTranscriptionCaptureRef.current = () => {}
      startVolumeMonitoringRef.current = () => {}
      stopVolumeMonitoringRef.current = () => {}
      setMonitoringModeRef.current = () => {}
      startBargeInDetectionRef.current = () => false
      replaceTranscriptRef.current = () => {}
      finalizeTranscriptRef.current = async () => ''
    }

    const handleTranscriptionStartError = (startError) => {
      if (disposed) {
        return
      }

      cleanupVoiceResources()

      if (startError.name === 'NotAllowedError') {
        setError('마이크 사용 권한이 필요합니다.')
        setStatus('permission-denied')
        return
      }

      setError(startError.message || '음성 인식을 시작하지 못했습니다.')
      setStatus('error')
    }

    const startOpenAIRealtimeTranscription = async () => {
      if (!window.RTCPeerConnection) {
        throw new Error('이 브라우저에서는 WebRTC를 사용할 수 없습니다.')
      }

      transcriptionReadyRef.current = false
      startTranscriptionCaptureRef.current = () => true
      stopTranscriptionCaptureRef.current = () => {}
      setStatus('connecting')

      // Realtime WebRTC 연결에 사용할 단기 토큰을 백엔드에서 발급한다.
      const tokenResponse = await apiClient.post(
        '/interview/realtime-transcription/token',
      )
      const ephemeralKey =
        tokenResponse.data.value ?? tokenResponse.data.client_secret?.value
      const expiresAt =
        tokenResponse.data.expires_at ??
        tokenResponse.data.client_secret?.expires_at

      if (!ephemeralKey) {
        throw new Error('백엔드에서 Realtime 임시 토큰을 받지 못했습니다.')
      }

      if (expiresAt && expiresAt * 1000 <= Date.now()) {
        throw new Error('Realtime 임시 토큰이 만료되었습니다.')
      }

      if (disposed) {
        return
      }

      peerConnection = new RTCPeerConnection()
      peerConnection.addTrack(audioTrack, mediaStream)
      dataChannel = peerConnection.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel
      dataChannel.addEventListener('message', ({ data }) => {
        const event = JSON.parse(data)

        if (
          event.type === 'conversation.item.input_audio_transcription.delta'
        ) {
          updateSegment(event)
        }

        if (
          event.type === 'conversation.item.input_audio_transcription.completed'
        ) {
          updateSegment(event, true)
          pendingCommitCount = Math.max(0, pendingCommitCount - 1)
          resolveFinalizationWaiters()
        }

        if (event.type === 'error' && !disposed) {
          setError(event.error?.message ?? '음성 인식 중 오류가 발생했습니다.')
          setStatus('error')
        }
      })

      peerConnection.addEventListener('connectionstatechange', () => {
        if (
          !disposed &&
          ['failed', 'disconnected'].includes(peerConnection.connectionState)
        ) {
          setError('OpenAI Realtime 연결이 종료되었습니다.')
          setStatus('error')
        }
      })

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      const sdpResponse = await fetch(OPENAI_REALTIME_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpResponse.ok) {
        throw new Error(await sdpResponse.text())
      }

      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      })
      await waitForDataChannelOpen()

      if (disposed) {
        return
      }

      transcriptionReadyRef.current = true
      setError('')

      if (listeningRequestedRef.current) {
        audioTrack.enabled = true
        startVolumeMonitoring()
        setStatus('listening')
      } else {
        audioTrack.enabled = false
        setStatus('ready')
      }
    }

    const activateOpenAITranscription = () => {
      if (openAITranscriptionPromise || disposed) {
        return openAITranscriptionPromise
      }

      transcriptionReadyRef.current = false

      openAITranscriptionPromise = startOpenAIRealtimeTranscription().catch(
        (connectionError) => {
          handleTranscriptionStartError(connectionError)
        },
      )

      return openAITranscriptionPromise
    }

    const startTranscription = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('unsupported')
          return
        }

        setStatus('requesting-permission')
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        if (disposed) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }

        audioTrack = mediaStream.getAudioTracks()[0]
        if (!audioTrack) {
          throw new Error('사용할 수 있는 마이크 오디오 트랙이 없습니다.')
        }

        audioTrack.enabled = false
        audioTrackRef.current = audioTrack

        if (onPermissionGrantedRef.current) {
          const session = await onPermissionGrantedRef.current()

          if (!session) {
            throw new Error('음성 면접 세션을 시작하지 못했습니다.')
          }
        }

        if (disposed) {
          return
        }

        listeningRequestedRef.current = startListeningOnConnectRef.current
        await activateOpenAITranscription()
      } catch (startError) {
        handleTranscriptionStartError(startError)
      }
    }

    startTranscription()

    // 페이지 이동 또는 컴포넌트 제거 시 마이크와 실시간 연결을 모두 닫는다.
    return () => {
      disposed = true
      resetTranscriptRef.current = () => setTranscript('')
      replaceTranscriptRef.current = () => {}
      finalizeTranscriptRef.current = async () => ''
      cleanupVoiceResources()
    }
  }, [])

  return {
    transcript,
    speechActive,
    transcriptSnapshot,
    activitySnapshot,
    status,
    error,
    listening: status === 'listening',
    pauseListening,
    resumeListening,
    startBargeInDetection,
    clearAudioBuffer,
    resetTranscript,
    replaceTranscript,
    finalizeTranscript,
  }
}

export default useRealtimeTranscription
