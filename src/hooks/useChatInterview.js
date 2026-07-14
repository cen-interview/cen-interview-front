import { useCallback, useRef, useState } from 'react'
import { sendChatEvent, startChatInterview } from '../api/interview.js'

const INITIAL_PHASE = 'idle'

const getErrorMessage = (error) => {
  const status = error.response?.status
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (status === 401) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해주세요.'
  }

  if (status === 404) {
    return '진행 중인 면접 세션을 찾을 수 없습니다. 새 면접을 시작해주세요.'
  }

  if (status === 422) {
    return '요청 내용을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'
  }

  if (status >= 500) {
    return '면접 응답을 만드는 중 문제가 발생했습니다. 다시 시도해주세요.'
  }

  if (error.code === 'ECONNABORTED') {
    return '요청 시간이 초과되었습니다. 다시 시도해주세요.'
  }

  return '면접 요청을 처리하지 못했습니다. 네트워크 상태를 확인해주세요.'
}

/**
 * 채팅 면접 세션과 사용자 이벤트 요청 상태를 관리한다.
 *
 * 프론트는 사용자가 실제로 수행한 답변 제출과 종료만 백엔드에 전달한다.
 * 다음 질문 종류, 다음 주제 이동, 자동 종료는 백엔드 응답을 그대로 반영한다.
 *
 * @returns 채팅 세션 상태와 시작, 답변 제출, 종료, 재시도 함수
 */
export const useChatInterview = () => {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState(INITIAL_PHASE)
  const [errorMessage, setErrorMessage] = useState(null)
  const [failedRequest, setFailedRequest] = useState(null)
  const requestInFlightRef = useRef(false)

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
    if (requestInFlightRef.current) {
      return null
    }

    requestInFlightRef.current = true
    setPhase('starting')
    setErrorMessage(null)

    try {
      const response = await startChatInterview()
      const isSuccessful = applySessionResponse(response)

      if (isSuccessful) {
        setFailedRequest(null)
      } else {
        setFailedRequest({ type: 'start' })
      }

      return isSuccessful ? response : null
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setFailedRequest({ type: 'start' })
      setPhase('error')
      return null
    } finally {
      requestInFlightRef.current = false
    }
  }, [applySessionResponse])

  const runEvent = useCallback(
    async (request) => {
      if (requestInFlightRef.current || !session?.session_id) {
        return null
      }

      requestInFlightRef.current = true
      setPhase(request.payload.action === 'end' ? 'ending' : 'submitting')
      setErrorMessage(null)

      try {
        const response = await sendChatEvent(
          session.session_id,
          request.payload,
          request.clientEventId,
        )
        const isSuccessful = applySessionResponse(response)

        if (isSuccessful) {
          setFailedRequest(null)
        } else {
          setFailedRequest(request)
        }

        return isSuccessful ? response : null
      } catch (error) {
        setErrorMessage(getErrorMessage(error))
        setFailedRequest(request)
        setPhase('error')
        return null
      } finally {
        requestInFlightRef.current = false
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
        },
        clientEventId: crypto.randomUUID(),
      })
    },
    [runEvent, session?.finished],
  )

  const end = useCallback(async () => {
    if (session?.finished) {
      return null
    }

    return runEvent({
      type: 'event',
      payload: {
        action: 'end',
      },
      clientEventId: crypto.randomUUID(),
    })
  }, [runEvent, session?.finished])

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
    submitAnswer,
    end,
    retry,
  }
}
