import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../api/client'

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
// 소리로 인정할 최소 볼륨 기준
const SILENCE_THRESHOLD = 0.018
// 말이 끝났다고 판단할지 정하는 값 0.8초
const SILENCE_DURATION_MS = 800
// 한 번에 녹음해서 보내는 음성 조각의 최대 길이야. 15초
const MAX_CHUNK_DURATION_MS = 15000

/**
 * OpenAI Realtime 전사 연결과 브라우저 발화 구간을 관리한다.
 *
 * 화면용 누적 transcript 외에 Voice Turn WebSocket에서 사용할 수 있는 누적
 * 전사 snapshot과 실제 발화 시작·종료 snapshot을 만든다. callback은 Ref로
 * 보관하므로 호출하는 컴포넌트가 다시 렌더링돼도 WebRTC 연결을 재생성하지
 * 않는다.
 *
 * @param {{
 *   onPermissionGranted?: () => Promise<object>,
 *   startListeningOnConnect?: boolean,
 *   onTranscriptSnapshot?: (snapshot: { text: string, itemId: string, segmentFinal: boolean }) => void,
 *   onSpeechActivityChange?: (snapshot: { speechActive: boolean, changedAt: number }) => void
 * }} options 음성 세션 시작과 구조화된 STT 이벤트 callback
 * @returns Realtime 상태, 누적 전사·발화 snapshot과 마이크 제어 함수
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
  const startVolumeMonitoringRef = useRef(() => {})
  const stopVolumeMonitoringRef = useRef(() => {})
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
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = false
    }

    stopVolumeMonitoringRef.current()
    setStatus((currentStatus) =>
      currentStatus === 'listening' ? 'ready' : currentStatus,
    )
  }, [])

  // Realtime DataChannel이 준비된 경우에만 마이크 수집을 다시 시작한다.
  const resumeListening = useCallback(() => {
    if (
      !audioTrackRef.current ||
      dataChannelRef.current?.readyState !== 'open'
    ) {
      return false
    }

    audioTrackRef.current.enabled = true
    startVolumeMonitoringRef.current()
    setStatus('listening')
    return true
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
  const replaceTranscript = useCallback((text) => {
    replaceTranscriptRef.current(text)
  }, [])

  // 마이크를 닫고 아직 처리 중인 오디오 구간의 최종 전사를 기다린다.
  const finalizeTranscript = useCallback(() => {
    return finalizeTranscriptRef.current()
  }, [])

  useEffect(() => {
    // 페이지를 벗어날 때 정리해야 하는 브라우저 음성·통신 자원
    let disposed = false
    let peerConnection
    let dataChannel
    let mediaStream
    let audioTrack
    let audioContext
    let analyser
    let samples
    let animationFrameId

    const segments = new Map()
    let segmentOrder = 0
    let bufferHasSpeech = false
    let speechActiveValue = false
    let speechStartedAt = 0
    let lastSpeechAt = 0
    let pendingCommitCount = 0
    let transcriptValue = ''
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

    replaceTranscriptRef.current = (text) => {
      const normalizedText = text?.trim() ?? ''

      updateSpeechActivity(false)
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

    // 발화 단위로 받은 텍스트 조각들을 화면에 표시할 한 문장으로 합친다.
    const updateTranscript = (itemId, segmentFinal) => {
      const nextTranscript = [...segments.values()]
        .sort((first, second) => first.order - second.order)
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(' ')

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

    // 이 모델은 서버 VAD를 사용하지 않으므로 브라우저가 오디오 구간을 직접 확정한다.
    const commitAudio = ({ preserveActivity = false } = {}) => {
      if (dataChannel?.readyState !== 'open' || !bufferHasSpeech) {
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

      const detectSilence = (now) => {
        analyser.getFloatTimeDomainData(samples)

        const meanSquare =
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
          samples.length
        const volume = Math.sqrt(meanSquare)

        if (volume >= SILENCE_THRESHOLD) {
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
    finalizeTranscriptRef.current = async () => {
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

    // 연결 실패나 페이지 이탈 시 브라우저 음성·통신 자원을 한곳에서 정리한다.
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
      startVolumeMonitoringRef.current = () => {}
      stopVolumeMonitoringRef.current = () => {}
      replaceTranscriptRef.current = () => {}
      finalizeTranscriptRef.current = async () => ''
    }

    const startTranscription = async () => {
      try {
        // WebRTC 또는 마이크 API가 없는 브라우저에서는 음성 인식을 시작할 수 없다.
        if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
          setStatus('unsupported')
          return
        }

        // 단기 토큰이나 세션을 만들기 전에 브라우저 마이크 권한부터 확인한다.
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

        // 연결과 면접관 발화 준비 중인 소리가 전사 버퍼에 들어가지 않도록 한다.
        audioTrack.enabled = false
        audioTrackRef.current = audioTrack

        // 음성 면접 세션은 마이크 권한이 확인된 뒤 Realtime 연결보다 먼저 만든다.
        if (onPermissionGrantedRef.current) {
          const session = await onPermissionGrantedRef.current()

          if (!session) {
            throw new Error('음성 면접 세션을 시작하지 못했습니다.')
          }
        }

        if (disposed) {
          return
        }

        setStatus('connecting')

        // 권한 확인 직후 새 단기 토큰을 발급받아 만료 전 WebRTC 연결에 사용한다.
        const tokenResponse = await apiClient.post(
          '/interview/realtime-transcription/token',
        )
        const ephemeralKey =
          tokenResponse.data.value ??
          tokenResponse.data.client_secret?.value
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

        // 비활성화한 마이크 트랙을 WebRTC 연결에 추가한다.
        peerConnection = new RTCPeerConnection()
        peerConnection.addTrack(audioTrack, mediaStream)

        // DataChannel은 commit과 인식 결과 이벤트를 주고받는다.
        dataChannel = peerConnection.createDataChannel('oai-events')
        dataChannelRef.current = dataChannel
        dataChannel.addEventListener('message', ({ data }) => {
          const event = JSON.parse(data)

          // 말하는 도중 전달되는 부분 문장
          if (
            event.type ===
            'conversation.item.input_audio_transcription.delta'
          ) {
            updateSegment(event)
          }

          // 하나의 오디오 구간에 대한 최종 문장
          if (
            event.type ===
            'conversation.item.input_audio_transcription.completed'
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

        // 브라우저가 만든 연결 제안(SDP)을 OpenAI에 보내 연결을 완료한다.
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

        if (startListeningOnConnectRef.current) {
          startVolumeMonitoring()
          audioTrack.enabled = true
          setStatus('listening')
        } else {
          setStatus('ready')
        }
      } catch (startError) {
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
    clearAudioBuffer,
    resetTranscript,
    replaceTranscript,
    finalizeTranscript,
  }
}

export default useRealtimeTranscription
