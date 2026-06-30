import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
const SILENCE_THRESHOLD = 0.018
const SILENCE_DURATION_MS = 800
const MAX_CHUNK_DURATION_MS = 15000

function useRealtimeTranscription() {
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState('')

  useEffect(() => {
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
        if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
          setStatus('unsupported')
          return
        }

        const tokenResponse = await apiClient.post(
          '/interview/realtime-transcription/token',
        )
        const ephemeralKey =
          tokenResponse.data.value ??
          tokenResponse.data.client_secret?.value

        if (!ephemeralKey) {
          throw new Error('백엔드에서 Realtime 임시 토큰을 받지 못했습니다.')
        }

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

        peerConnection = new RTCPeerConnection()
        mediaStream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, mediaStream))

        dataChannel = peerConnection.createDataChannel('oai-events')
        dataChannel.addEventListener('open', () => {
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

          if (
            event.type ===
            'conversation.item.input_audio_transcription.delta'
          ) {
            updateSegment(event)
          }

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
