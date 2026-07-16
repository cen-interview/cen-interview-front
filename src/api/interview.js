import { apiClient } from './client.js'

/**
 * 채팅 면접 세션을 생성하고 첫 질문이 포함된 세션 응답을 반환한다.
 *
 * 채팅 전용 API이므로 mode는 호출하는 쪽에서 받지 않고 항상 chat으로
 * 고정한다. 인증 헤더와 토큰 갱신은 공통 apiClient가 처리한다.
 *
 * @returns {Promise<object>} 생성된 채팅 면접 세션 응답
 */
export const startChatInterview = async () => {
  const response = await apiClient.post('/sessions', {
    mode: 'chat',
  })

  return response.data
}

/**
 * 음성 면접 세션을 생성하고 첫 질문이 포함된 세션 응답을 반환한다.
 *
 * OpenAI Realtime은 지원자의 음성을 텍스트로 변환하는 역할만 담당한다.
 * 실제 질문 생성과 면접 흐름은 이 API가 만든 voice 세션에서 관리한다.
 *
 * @returns {Promise<object>} 생성된 음성 면접 세션 응답
 */
export const startVoiceInterview = async () => {
  const response = await apiClient.post('/sessions', {
    mode: 'voice',
  })

  return response.data
}

/**
 * Web Speech 폴백용 발화 텍스트를 백엔드 TTS로 전달하고 MP3 Blob을 반환한다.
 *
 * 기본 재생은 브라우저의 Web Speech API를 사용한다. Web Speech를 지원하지
 * 않거나 실제 합성에 실패한 환경에서만 이 API를 호출한다. OpenAI API 키와
 * 모델 설정은 백엔드가 관리하고, 반환된 오디오는 Object URL로 바꿔 재생한다.
 *
 * @param {string} text 음성으로 재생할 면접관 발화
 * @param {{ signal?: AbortSignal }} [options] 화면 이탈이나 재생 교체 시 요청을 취소하기 위한 옵션
 * @returns {Promise<Blob>} 백엔드가 스트리밍한 MP3 음성 데이터
 */
export const generateInterviewSpeech = async (text, { signal } = {}) => {
  const response = await apiClient.post(
    '/interview/tts',
    { text },
    {
      responseType: 'blob',
      signal,
    },
  )

  return response.data
}

/**
 * 진행 중인 채팅 면접 세션에 사용자 이벤트를 전송한다.
 *
 * 동일한 사용자 행동을 재시도할 때는 호출하는 쪽에서 최초 요청에 사용한
 * clientEventId를 그대로 전달해야 서버가 중복 이벤트를 처리하지 않는다.
 *
 * @param {string} sessionId 이벤트를 전송할 면접 세션 ID
 * 채팅 MVP에서 프론트가 전달하는 행동은 답변 제출과 사용자 종료뿐이다.
 * 꼬리 질문, challenge, 다음 주제 이동, 자동 종료 같은 면접 흐름은
 * 백엔드가 결정하며 프론트는 그 결과를 세션 응답으로 받는다.
 *
 * @param {{ action: 'submit', text: string } | { action: 'end' }} payload 사용자가 실제로 수행한 채팅 이벤트
 * @param {string} clientEventId 사용자 행동별 멱등성 ID
 * @returns {Promise<object>} 이벤트 처리 후의 전체 채팅 면접 세션 응답
 */
export const sendChatEvent = async (
  sessionId,
  payload,
  clientEventId,
) => {
  const encodedSessionId = encodeURIComponent(sessionId)
  const response = await apiClient.post(`/sessions/${encodedSessionId}/events`, {
    payload,
    client_event_id: clientEventId,
  })

  return response.data
}

/**
 * 진행 중인 음성 면접 세션에 사용자의 수동 답변을 전송한다.
 *
 * clientEventId는 한 번의 답변 행동에 대해 최초 생성한 값을 재시도에서도
 * 그대로 사용해야 백엔드가 동일한 답변을 중복 처리하지 않는다.
 *
 * @param {string} sessionId 이벤트를 전송할 음성 면접 세션 ID
 * @param {{ action: 'submit', text: string, submission_type: 'manual' }} payload 확정된 음성 답변 이벤트
 * @param {string} clientEventId 사용자 행동별 멱등성 ID
 * @returns {Promise<object>} 이벤트 처리 후의 전체 음성 면접 세션 응답
 */
export const sendVoiceEvent = async (
  sessionId,
  payload,
  clientEventId,
) => {
  const encodedSessionId = encodeURIComponent(sessionId)
  const response = await apiClient.post(`/sessions/${encodedSessionId}/events`, {
    payload,
    client_event_id: clientEventId,
  })

  return response.data
}

/**
 * 현재 사용자의 완료된 면접 기록과 요약 통계를 조회한다.
 *
 * 페이지 번호는 백엔드 계약에 맞춰 1부터 시작한다. 응답의 summary는
 * 마이페이지 통계 카드에, items는 연습 기록 목록에 사용한다.
 *
 * @param {number} [page=1] 조회할 페이지 번호
 * @param {number} [size=10] 페이지당 기록 수
 * @returns {Promise<{
 *   summary: { total_practice_count: number, average_score: number | null },
 *   items: Array<{
 *     result_id: number,
 *     session_id: string,
 *     completed_at: string,
 *     mode: 'chat' | 'voice',
 *     overall_score: number
 *   }>,
 *   page: number,
 *   size: number,
 *   total: number
 * }>} 면접 기록과 요약 통계
 */
export const getInterviewHistory = async (page = 1, size = 10) => {
  const response = await apiClient.get('/interview-results/history', {
    params: { page, size },
  })

  return response.data
}

/**
 * 저장된 면접 결과 ID로 과거 리포트를 조회한다.
 *
 * 상세 API 응답은 리포트 외의 결과 메타데이터를 함께 포함할 수 있으므로
 * 화면에서 바로 사용할 수 있도록 report 필드만 반환한다.
 *
 * @param {number | string} resultId 조회할 면접 결과 ID
 * @returns {Promise<object>} 저장된 최종 면접 리포트
 */
export const getInterviewResult = async (resultId) => {
  const encodedResultId = encodeURIComponent(resultId)
  const response = await apiClient.get(`/interview-results/${encodedResultId}`)

  return response.data.report
}
