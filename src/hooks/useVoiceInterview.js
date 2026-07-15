import { useCallback, useRef, useState } from 'react'
import { sendVoiceEvent, startVoiceInterview } from '../api/interview.js'

const getErrorMessage = (error) => {
  const status = error.response?.status
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (status === 401) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해주세요.'
  }

  if (status === 422) {
    return '음성 면접 요청을 처리할 수 없습니다.'
  }

  if (status === 404) {
    return '진행 중인 음성 면접 세션을 찾을 수 없습니다.'
  }

  if (status >= 500) {
    return 'AI 면접관의 응답을 준비하지 못했습니다. 다시 시도해주세요.'
  }

  if (error.code === 'ECONNABORTED') {
    return '면접 시작 요청 시간이 초과되었습니다. 다시 시도해주세요.'
  }

  return '음성 면접 요청을 처리하지 못했습니다. 네트워크 상태를 확인해주세요.'
}

/**
 * 음성 면접 세션 생성 상태와 백엔드 세션 응답을 관리한다.
 *
 * 마이크 권한이 승인된 뒤 start를 호출하면 mode가 voice인 세션을 만든다.
 * 동일 시점에 start가 여러 번 호출되면 진행 중인 Promise를 공유해 React의
 * 중복 Effect 실행이나 빠른 재호출로 세션이 여러 개 생성되지 않게 한다.
 *
 * 답변 제출이 실패하면 최초 client_event_id와 답변을 보관해 동일한 요청으로
 * 재시도한다. 이를 통해 네트워크 응답이 유실되어도 답변이 중복 반영되지 않는다.
 *
 * @returns 음성 세션 상태와 시작, 답변 제출, 재시도 함수
 */
export const useVoiceInterview = () => {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)
  const [failedRequest, setFailedRequest] = useState(null)
  const requestPromiseRef = useRef(null)

  const applySessionResponse = useCallback((response) => {
    setSession(response)

    if (response.error) {
      setErrorMessage(response.error)
      setPhase('error')
      return false
    }

    setErrorMessage(null)
    setPhase(response.finished ? 'finished' : 'active')
    return true
  }, [])

  const start = useCallback(async () => {
    if (requestPromiseRef.current) {
      return requestPromiseRef.current
    }

    const request = (async () => {
      setPhase('starting')
      setErrorMessage(null)

      try {
        const response = await startVoiceInterview()
        const isSuccessful = applySessionResponse(response)
        setFailedRequest(isSuccessful ? null : { type: 'start' })
        return isSuccessful ? response : null
      } catch (error) {
        setErrorMessage(getErrorMessage(error))
        setFailedRequest({ type: 'start' })
        setPhase('error')
        return null
      }
    })()

    requestPromiseRef.current = request

    try {
      return await request
    } finally {
      if (requestPromiseRef.current === request) {
        requestPromiseRef.current = null
      }
    }
  }, [applySessionResponse])

  const runEvent = useCallback(
    async (request) => {
      if (requestPromiseRef.current || !session?.session_id) {
        return null
      }

      const eventRequest = (async () => {
        setPhase('submitting')
        setErrorMessage(null)

        try {
          const response = await sendVoiceEvent(
            session.session_id,
            request.payload,
            request.clientEventId,
          )
          const isSuccessful = applySessionResponse(response)
          setFailedRequest(isSuccessful ? null : request)
          return isSuccessful ? response : null
        } catch (error) {
          setErrorMessage(getErrorMessage(error))
          setFailedRequest(request)
          setPhase('error')
          return null
        }
      })()

      requestPromiseRef.current = eventRequest

      try {
        return await eventRequest
      } finally {
        if (requestPromiseRef.current === eventRequest) {
          requestPromiseRef.current = null
        }
      }
    },
    [applySessionResponse, session?.session_id],
  )

  const submitAnswer = useCallback(
    async (text) => {
      const answer = text.trim()

      if (!answer || session?.finished) {
        return null
      }

      return runEvent({
        type: 'event',
        payload: {
          action: 'submit',
          text: answer,
          submission_type: 'manual',
          completion_reason: 'manual_button',
        },
        clientEventId: crypto.randomUUID(),
      })
    },
    [runEvent, session?.finished],
  )

  const retry = useCallback(async () => {
    if (!failedRequest) {
      return null
    }

    if (failedRequest.type === 'start') {
      return start()
    }

    return runEvent(failedRequest)
  }, [failedRequest, runEvent, start])

  return {
    session,
    phase,
    errorMessage,
    canRetry: failedRequest !== null,
    start,
    applySessionResponse,
    submitAnswer,
    retry,
  }
}
