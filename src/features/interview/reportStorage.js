const REPORT_STORAGE_PREFIX = 'chat-interview-report:'

const getStorageKey = (reportId) =>
  `${REPORT_STORAGE_PREFIX}${encodeURIComponent(reportId)}`

/**
 * 종료 이벤트 응답에 포함된 채팅 면접 리포트를 현재 브라우저 탭에 보관한다.
 *
 * @param {string | number} reportId 저장된 결과 ID. 결과 ID가 없는 이전 응답은 세션 ID
 * @param {object} report 백엔드가 생성한 최종 리포트
 * @returns {boolean} 저장 성공 여부
 */
export const saveChatInterviewReport = (reportId, report) => {
  if (!reportId || !report) {
    return false
  }

  try {
    sessionStorage.setItem(getStorageKey(reportId), JSON.stringify(report))
    return true
  } catch {
    return false
  }
}

/**
 * 현재 브라우저 탭에 보관된 채팅 면접 리포트를 읽는다.
 *
 * @param {string | number} reportId 조회할 결과 또는 세션 ID
 * @returns {object | null} 저장된 리포트 또는 null
 */
export const getChatInterviewReport = (reportId) => {
  if (!reportId) {
    return null
  }

  try {
    const storedReport = sessionStorage.getItem(getStorageKey(reportId))
    return storedReport ? JSON.parse(storedReport) : null
  } catch {
    return null
  }
}
