const REPORT_STORAGE_PREFIX = 'chat-interview-report:'

const getStorageKey = (sessionId) =>
  `${REPORT_STORAGE_PREFIX}${encodeURIComponent(sessionId)}`

/**
 * 종료 이벤트 응답에 포함된 채팅 면접 리포트를 현재 브라우저 탭에 보관한다.
 *
 * @param {string} sessionId 종료된 면접 세션 ID
 * @param {object} report 백엔드가 생성한 최종 리포트
 * @returns {boolean} 저장 성공 여부
 */
export const saveChatInterviewReport = (sessionId, report) => {
  if (!sessionId || !report) {
    return false
  }

  try {
    sessionStorage.setItem(getStorageKey(sessionId), JSON.stringify(report))
    return true
  } catch {
    return false
  }
}

/**
 * 현재 브라우저 탭에 보관된 채팅 면접 리포트를 읽는다.
 *
 * @param {string} sessionId 조회할 면접 세션 ID
 * @returns {object | null} 저장된 리포트 또는 null
 */
export const getChatInterviewReport = (sessionId) => {
  if (!sessionId) {
    return null
  }

  try {
    const storedReport = sessionStorage.getItem(getStorageKey(sessionId))
    return storedReport ? JSON.parse(storedReport) : null
  } catch {
    return null
  }
}
