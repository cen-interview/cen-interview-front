import { useCallback, useRef, useState } from 'react'
import {
  confirmChatRubricSharing,
  sendChatEvent,
  startChatInterview,
} from '../api/interview.js'

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

  if (status === 409) {
    return '현재 면접 상태에서는 이 요청을 처리할 수 없습니다.'
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

export const useChatInterview = () => {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState(INITIAL_PHASE)
  const [errorMessage, setErrorMessage] = useState(null)
  const [failedRequest, setFailedRequest] = useState(null)
  const [pendingAnswer, setPendingAnswer] = useState(null)

  const requestInFlightRef = useRef(false)
  const sessionId = session?.session_id

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
      if (requestInFlightRef.current || !sessionId) {
        return null
      }

      requestInFlightRef.current = true

      if (request.payload.action === 'submit') {
        setPendingAnswer((currentPendingAnswer) => {
          if (
            currentPendingAnswer?.clientEventId ===
            request.clientEventId
          ) {
            return currentPendingAnswer
          }

          return {
            clientEventId: request.clientEventId,
            text: request.payload.text,
            created_at: new Date().toISOString(),
          }
        })
      }

      setPhase(
        request.payload.action === 'end'
          ? 'ending'
          : 'submitting',
      )
      setErrorMessage(null)

      try {
        const response = await sendChatEvent(
          sessionId,
          request.payload,
          request.clientEventId,
        )

        const isSuccessful = applySessionResponse(response)

        if (isSuccessful) {
          setFailedRequest(null)

          if (request.payload.action === 'submit') {
            setPendingAnswer(null)
          }
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
    [applySessionResponse, sessionId],
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

  const confirmRubricSharing = useCallback(
    async (share) => {
      if (
        requestInFlightRef.current ||
        !sessionId
      ) {
        return null
      }

      requestInFlightRef.current = true
      setPhase('confirming-rubric')
      setErrorMessage(null)

      try {
        const response = await confirmChatRubricSharing(
          sessionId,
          share,
        )

        const isSuccessful = applySessionResponse(response)

        return isSuccessful ? response : null
      } catch (error) {
        setErrorMessage(getErrorMessage(error))
        setPhase('error')
        return null
      } finally {
        requestInFlightRef.current = false
      }
    },
    [applySessionResponse, sessionId],
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
    pendingAnswer,
    canRetry: failedRequest !== null,
    start,
    submitAnswer,
    end,
    confirmRubricSharing,
    retry,
  }
}
