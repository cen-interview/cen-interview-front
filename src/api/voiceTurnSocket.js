const BACKEND_URL = import.meta.env.VITE_APP_API_URL

/**
 * 백엔드 HTTP 주소를 음성 턴 WebSocket 주소로 변환한다.
 *
 * Access Token은 URL에 포함하지 않는다. 브라우저 WebSocket이 열린 뒤
 * connection.authenticate 메시지로 전달해 브라우저 기록과 서버 접근 로그에
 * 인증 정보가 남지 않도록 한다.
 *
 * @param {string} sessionId 연결할 음성 면접 세션 ID
 * @returns {string} 음성 턴 WebSocket 전체 주소
 */
export const getVoiceTurnSocketUrl = (sessionId) => {
  if (!BACKEND_URL) {
    throw new Error('백엔드 API 주소가 설정되지 않았습니다.')
  }

  const normalizedSessionId = sessionId?.trim()

  if (!normalizedSessionId) {
    throw new Error('음성 면접 세션 ID가 필요합니다.')
  }

  const url = new URL(BACKEND_URL, window.location.origin)

  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  } else {
    throw new Error('지원하지 않는 백엔드 API 주소입니다.')
  }

  const basePath = url.pathname.replace(/\/$/, '')
  url.pathname = `${basePath}/api/interview/sessions/${encodeURIComponent(
    normalizedSessionId,
  )}/voice-turn`
  url.search = ''
  url.hash = ''

  return url.toString()
}

/**
 * 지정한 음성 면접 세션의 Voice Turn WebSocket을 생성한다.
 *
 * 이 함수는 연결 객체만 만들며 인증과 서버 메시지 처리는 호출하는 훅이
 * 담당한다.
 *
 * @param {string} sessionId 연결할 음성 면접 세션 ID
 * @returns {WebSocket} 생성된 브라우저 WebSocket
 */
export const createVoiceTurnSocket = (sessionId) => {
  if (!window.WebSocket) {
    throw new Error('이 브라우저에서는 실시간 음성 면접 연결을 지원하지 않습니다.')
  }

  return new window.WebSocket(getVoiceTurnSocketUrl(sessionId))
}
