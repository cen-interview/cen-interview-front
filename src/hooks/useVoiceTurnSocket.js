import { useCallback, useEffect, useRef, useState } from 'react'
import { createVoiceTurnSocket } from '../api/voiceTurnSocket.js'

const AUTHENTICATION_TIMEOUT_MS = 6500
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000]
const RECONNECT_JITTER_MS = 250
const RECONNECTABLE_FATAL_CODES = new Set([
  'turn_commit_in_progress',
  'worker_not_available',
])
const SERVER_STATES = new Set([
  'listening',
  'complete_candidate',
  'confirmation_pending',
  'confirmation_prompting',
  'confirming_end',
  'committing',
  'committed',
])

const getServerErrorMessage = (message) => {
  const messagesByCode = {
    authentication_required: '음성 면접 연결 인증 시간이 초과되었습니다.',
    invalid_token: '로그인 정보가 만료되었습니다. 다시 로그인해주세요.',
    session_not_found: '진행 중인 음성 면접 세션을 찾을 수 없습니다.',
    session_forbidden: '이 음성 면접 세션에 접근할 수 없습니다.',
    session_finished: '이미 종료된 음성 면접 세션입니다.',
    voice_mode_required: '음성 면접 세션에서만 사용할 수 있습니다.',
    question_unavailable: '현재 답변할 면접 질문을 찾을 수 없습니다.',
  }

  return (
    messagesByCode[message.code] ||
    message.message ||
    '음성 면접 실시간 연결을 준비하지 못했습니다.'
  )
}

/**
 * 백엔드 Voice Turn WebSocket 연결과 첫 메시지 인증을 관리한다.
 *
 * sessionId와 questionId가 준비되면 socket을 열고 첫 JSON 메시지로 Access
 * Token을 전송한다. 서버의 connection.ready가 현재 세션·질문과 일치해야만
 * ready 상태가 되며, 그 전에는 일반 메시지를 전송하지 않는다.
 *
 * @param {{
 *   sessionId?: string,
 *   questionId?: string,
 *   accessToken?: string,
 *   enabled?: boolean
 * }} options 연결에 필요한 음성 세션과 인증 정보
 * @returns {{
 *   status: 'idle' | 'connecting' | 'authenticating' | 'ready' | 'reconnecting' | 'disconnected' | 'error',
 *   errorMessage: string,
 *   readyState: { sessionId: string, questionId: string, revision: number, serverState: string } | null,
 *   lastMessage: object | null,
 *   reconnectAttempt: number,
 *   sendMessage: (message: object) => boolean,
 *   subscribe: (listener: (message: object) => void) => () => void,
 *   reconnect: (nextQuestionId?: string) => void,
 *   disconnect: () => void
 * }} WebSocket 연결 상태와 제어 함수
 */
function useVoiceTurnSocket({
  sessionId,
  questionId,
  accessToken,
  enabled = true,
} = {}) {
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [readyState, setReadyState] = useState(null)
  const [lastMessage, setLastMessage] = useState(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const socketRef = useRef(null)
  const connectionGenerationRef = useRef(0)
  const statusRef = useRef('idle')
  const questionIdRef = useRef(questionId)
  const reconnectQuestionIdRef = useRef(null)
  const messageListenersRef = useRef(new Set())
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef()
  const reconnectCycleRef = useRef(false)

  useEffect(() => {
    questionIdRef.current = questionId
  }, [questionId])

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = undefined
    }
  }, [])

  const scheduleReconnect = useCallback(
    (message, minimumDelay = 0) => {
      if (!enabled || !sessionId || !accessToken || reconnectTimerRef.current) {
        return false
      }

      const nextAttempt = reconnectAttemptRef.current + 1

      if (nextAttempt > RECONNECT_DELAYS_MS.length) {
        reconnectCycleRef.current = false
        setErrorMessage(
          message || '음성 연결을 자동으로 복구하지 못했습니다.',
        )
        updateStatus('error')
        return false
      }

      const backoffDelay = RECONNECT_DELAYS_MS[nextAttempt - 1]
      const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS)
      const delay = Math.max(backoffDelay + jitter, minimumDelay)

      reconnectAttemptRef.current = nextAttempt
      reconnectCycleRef.current = true
      setReconnectAttempt(nextAttempt)
      setReadyState(null)
      setErrorMessage('')
      updateStatus('reconnecting')
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = undefined
        setConnectionAttempt((currentAttempt) => currentAttempt + 1)
      }, delay)
      return true
    },
    [accessToken, enabled, sessionId, updateStatus],
  )

  const disconnect = useCallback(() => {
    clearReconnectTimer()
    reconnectCycleRef.current = false
    connectionGenerationRef.current += 1
    const socket = socketRef.current
    socketRef.current = null

    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, 'client disconnect')
    }

    setReadyState(null)
    updateStatus('disconnected')
  }, [clearReconnectTimer, updateStatus])

  const reconnect = useCallback((nextQuestionId) => {
    clearReconnectTimer()
    reconnectAttemptRef.current = 0
    reconnectCycleRef.current = true
    reconnectQuestionIdRef.current = nextQuestionId?.trim() || null
    setErrorMessage('')
    setReadyState(null)
    setReconnectAttempt(0)
    updateStatus('reconnecting')
    setConnectionAttempt((currentAttempt) => currentAttempt + 1)
  }, [clearReconnectTimer, updateStatus])

  useEffect(() => {
    clearReconnectTimer()
    reconnectAttemptRef.current = 0
    reconnectCycleRef.current = false
    setReconnectAttempt(0)
  }, [clearReconnectTimer, sessionId])

  useEffect(() => {
    return () => clearReconnectTimer()
  }, [clearReconnectTimer])

  const subscribe = useCallback((listener) => {
    messageListenersRef.current.add(listener)

    return () => {
      messageListenersRef.current.delete(listener)
    }
  }, [])

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current

    if (statusRef.current !== 'ready' || socket?.readyState !== WebSocket.OPEN) {
      return false
    }

    socket.send(JSON.stringify(message))
    return true
  }, [])

  useEffect(() => {
    const expectedQuestionId =
      reconnectQuestionIdRef.current || questionIdRef.current
    reconnectQuestionIdRef.current = null

    if (!enabled || !sessionId || !expectedQuestionId || !accessToken) {
      clearReconnectTimer()
      reconnectAttemptRef.current = 0
      reconnectCycleRef.current = false
      connectionGenerationRef.current += 1
      const currentSocket = socketRef.current
      socketRef.current = null

      if (currentSocket && currentSocket.readyState < WebSocket.CLOSING) {
        currentSocket.close(1000, 'connection disabled')
      }

      setErrorMessage('')
      setReadyState(null)
      setLastMessage(null)
      setReconnectAttempt(0)
      updateStatus('idle')
      return undefined
    }

    const generation = connectionGenerationRef.current + 1
    connectionGenerationRef.current = generation
    let socket
    let authenticationTimeoutId
    let connectionFailed = false
    let intentionallyClosed = false
    let reconnectAfterClose = false
    let reconnectDelay = 0
    let reconnectMessage = ''
    const isReconnectCycle = reconnectCycleRef.current

    const isCurrentConnection = () => {
      return (
        !intentionallyClosed &&
        connectionGenerationRef.current === generation &&
        socketRef.current === socket
      )
    }

    const failConnection = (message) => {
      if (!isCurrentConnection()) {
        return
      }

      connectionFailed = true
      window.clearTimeout(authenticationTimeoutId)
      setReadyState(null)
      setErrorMessage(message)
      updateStatus('error')
    }

    const closeForReconnect = (message, minimumDelay = 0) => {
      if (!isCurrentConnection()) {
        return
      }

      reconnectAfterClose = true
      reconnectMessage = message
      reconnectDelay = minimumDelay
      window.clearTimeout(authenticationTimeoutId)
      socket.close(1012, 'temporary connection failure')
    }

    try {
      socket = createVoiceTurnSocket(sessionId)
      socketRef.current = socket
      setErrorMessage('')
      setReadyState(null)
      if (!isReconnectCycle) {
        setLastMessage(null)
        updateStatus('connecting')
      } else {
        updateStatus('reconnecting')
      }
    } catch (connectionError) {
      scheduleReconnect(
        connectionError.message || '음성 면접 실시간 연결을 만들지 못했습니다.',
      )
      return undefined
    }

    const handleOpen = () => {
      if (!isCurrentConnection()) {
        return
      }

      if (!isReconnectCycle) {
        updateStatus('authenticating')
      }
      socket.send(
        JSON.stringify({
          type: 'connection.authenticate',
          access_token: accessToken,
        }),
      )

      authenticationTimeoutId = window.setTimeout(() => {
        closeForReconnect('음성 면접 연결 인증 시간이 초과되었습니다.')
      }, AUTHENTICATION_TIMEOUT_MS)
    }

    const handleMessage = ({ data }) => {
      if (!isCurrentConnection()) {
        return
      }

      let message

      try {
        message = JSON.parse(data)
      } catch {
        failConnection('음성 면접 서버에서 올바르지 않은 응답을 받았습니다.')
        socket.close(1000, 'invalid server message')
        return
      }

      setLastMessage(message)

      if (message.type === 'error') {
        messageListenersRef.current.forEach((listener) => {
          try {
            listener(message)
          } catch {
            // 한 구독자의 오류가 다른 메시지 처리와 socket을 막지 않게 한다.
          }
        })

        if (message.recoverable) {
          return
        }

        if (RECONNECTABLE_FATAL_CODES.has(message.code)) {
          closeForReconnect(
            getServerErrorMessage(message),
            message.code === 'turn_commit_in_progress' ? 1000 : 0,
          )
          return
        }

        failConnection(getServerErrorMessage(message))
        socket.close(1000, 'fatal server error')
        return
      }

      if (message.type === 'connection.ready') {
        const connectionMatches =
          message.session_id === sessionId &&
          message.question_id === expectedQuestionId
        const validRevision =
          Number.isInteger(message.revision) && message.revision >= 0
        const validServerState = SERVER_STATES.has(message.state)

        if (!connectionMatches || !validRevision || !validServerState) {
          failConnection('현재 질문과 일치하지 않는 음성 연결 응답을 받았습니다.')
          socket.close(1000, 'connection ready mismatch')
          return
        }

        window.clearTimeout(authenticationTimeoutId)
        setReadyState({
          sessionId: message.session_id,
          questionId: message.question_id,
          revision: message.revision,
          serverState: message.state,
        })
        setErrorMessage('')
        clearReconnectTimer()
        reconnectAttemptRef.current = 0
        reconnectCycleRef.current = false
        setReconnectAttempt(0)
        updateStatus('ready')
      }

      if (message.type === 'answer.committed') {
        const committedSession = message.session
        const nextQuestionId = committedSession?.question?.question_id

        if (
          committedSession?.session_id === sessionId &&
          !committedSession.finished &&
          nextQuestionId
        ) {
          setReadyState({
            sessionId,
            questionId: nextQuestionId,
            revision: 0,
            serverState: 'listening',
          })
        }
      }

      messageListenersRef.current.forEach((listener) => {
        try {
          listener(message)
        } catch {
          // 한 구독자의 오류가 다른 메시지 처리와 socket을 막지 않게 한다.
        }
      })
    }

    const handleError = () => {
      closeForReconnect('음성 면접 실시간 연결을 열지 못했습니다.')
    }

    const handleClose = () => {
      if (!isCurrentConnection()) {
        return
      }

      window.clearTimeout(authenticationTimeoutId)
      socketRef.current = null
      setReadyState(null)

      if (reconnectAfterClose || !connectionFailed) {
        scheduleReconnect(
          reconnectMessage || '음성 면접 실시간 연결이 종료되었습니다.',
          reconnectDelay,
        )
      }
    }

    socket.addEventListener('open', handleOpen)
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', handleError)
    socket.addEventListener('close', handleClose)

    return () => {
      intentionallyClosed = true
      window.clearTimeout(authenticationTimeoutId)
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('message', handleMessage)
      socket.removeEventListener('error', handleError)
      socket.removeEventListener('close', handleClose)

      if (socketRef.current === socket) {
        socketRef.current = null
      }

      if (socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, 'connection replaced')
      }
    }
  }, [
    accessToken,
    clearReconnectTimer,
    connectionAttempt,
    enabled,
    scheduleReconnect,
    sessionId,
    updateStatus,
  ])

  return {
    status,
    errorMessage,
    readyState,
    lastMessage,
    reconnectAttempt,
    sendMessage,
    subscribe,
    reconnect,
    disconnect,
  }
}

export default useVoiceTurnSocket
