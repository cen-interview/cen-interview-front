import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
// 소리로 인정할 최소 볼륨 기준
const SILENCE_THRESHOLD = 0.018
// 말이 끝났다고 판단할지 정하는 값 0.8초
const SILENCE_DURATION_MS = 800
// 한 번에 녹음해서 보내는 음성 조각의 최대 길이야. 15초
const MAX_CHUNK_DURATION_MS = 15000

function useRealtimeTranscription() {
  // 화면에 전달할 최종 인식 문장과 현재 연결 상태
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState('')

  useEffect(() => {
    // 페이지를 벗어날 때 정리해야 하는 브라우저 음성·통신 자원
    let disposed = false
    let peerConnection
    let dataChannel
    let mediaStream
    let audioContext
    let animationFrameId

    const segments = new Map()
    let segmentOrder = 0
    let hasSpeech = false
    let speechStartedAt = 0
    let lastSpeechAt = 0

    // 발화 단위로 받은 텍스트 조각들을 화면에 표시할 한 문장으로 합친다.
    const updateTranscript = () => {
      const nextTranscript = [...segments.values()]
        .sort((first, second) => first.order - second.order)
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(' ')

      if (!disposed) {
        setTranscript(nextTranscript)
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
      updateTranscript()
    }

    // 이 모델은 서버 VAD를 사용하지 않으므로 브라우저가 오디오 구간을 직접 확정한다.
    const commitAudio = () => {
      if (dataChannel?.readyState !== 'open' || !hasSpeech) {
        return
      }

      dataChannel.send(
        JSON.stringify({
          type: 'input_audio_buffer.commit',
        }),
      )

      hasSpeech = false
      speechStartedAt = 0
      lastSpeechAt = 0
    }

    // 마이크 음량을 관찰해 무음이 이어지거나 한 구간이 너무 길어지면 commit한다.
    const startVolumeMonitoring = () => {
      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(mediaStream)
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 1024
      const samples = new Float32Array(analyser.fftSize)
      source.connect(analyser)

      const detectSilence = (now) => {
        analyser.getFloatTimeDomainData(samples)

        const meanSquare =
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
          samples.length
        const volume = Math.sqrt(meanSquare)

        if (volume >= SILENCE_THRESHOLD) {
          if (!hasSpeech) {
            hasSpeech = true
            speechStartedAt = now
          }
          lastSpeechAt = now
        }

        const silenceDetected =
          hasSpeech &&
          lastSpeechAt > 0 &&
          now - lastSpeechAt >= SILENCE_DURATION_MS
        const chunkIsFull =
          hasSpeech &&
          speechStartedAt > 0 &&
          now - speechStartedAt >= MAX_CHUNK_DURATION_MS

        if (silenceDetected || chunkIsFull) {
          commitAudio()
        }

        animationFrameId = requestAnimationFrame(detectSilence)
      }

      animationFrameId = requestAnimationFrame(detectSilence)
    }

    const startTranscription = async () => {
      try {
        // WebRTC 또는 마이크 API가 없는 브라우저에서는 음성 인식을 시작할 수 없다.
        if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
          setStatus('unsupported')
          return
        }

        // 실제 OpenAI API 키 대신 백엔드가 발급한 짧은 수명의 임시 키만 받는다.
        const tokenResponse = await apiClient.post(
          '/interview/realtime-transcription/token',
        )
        const ephemeralKey =
          tokenResponse.data.value ??
          tokenResponse.data.client_secret?.value

        if (!ephemeralKey) {
          throw new Error('백엔드에서 Realtime 임시 토큰을 받지 못했습니다.')
        }

        // 브라우저 마이크를 열고 기본적인 소음·울림 보정을 적용한다.
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

        // WebRTC 연결에 마이크 오디오 트랙을 추가한다.
        peerConnection = new RTCPeerConnection()
        mediaStream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, mediaStream))

        // DataChannel은 세션 설정, commit, 인식 결과 이벤트를 주고받는다.
        dataChannel = peerConnection.createDataChannel('oai-events')
        dataChannel.addEventListener('open', () => {
          // 한국어 인식과 정확도 우선 설정으로 transcription 세션을 구성한다.
          dataChannel.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                type: 'transcription',
                audio: {
                  input: {
                    transcription: {
                      model: 'gpt-realtime-whisper',
                      language: 'ko',
                      delay: 'high',
                    },
                    turn_detection: null,
                  },
                },
              },
            }),
          )

          if (!disposed) {
            setStatus('listening')
          }
        })
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

        startVolumeMonitoring()
      } catch (startError) {
        if (disposed) {
          return
        }

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

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }

      mediaStream?.getTracks().forEach((track) => track.stop())
      dataChannel?.close()
      peerConnection?.close()
      audioContext?.close()
    }
  }, [])

  return {
    transcript,
    status,
    error,
    listening: status === 'listening',
  }
}

export default useRealtimeTranscription
