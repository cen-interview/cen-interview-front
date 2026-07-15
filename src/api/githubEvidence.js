import { apiClient } from './client.js'

/** GitHub OAuth 연결 상태를 조회한다. */
export async function getGitHubConnectionStatus() {
  const response = await apiClient.get('/auth/github/status')
  return response.data
}

/** 백엔드에서 GitHub OAuth 승인 URL을 발급받는다. */
export async function createGitHubAuthorizeUrl() {
  const response = await apiClient.post('/auth/github/authorize-url', {})
  return response.data
}

/** 현재 사용자에게 등록된 GitHub Evidence source만 조회한다. */
export async function getGitHubSources() {
  const response = await apiClient.get('/evidence/sources')

  return (response.data.sources ?? []).filter(
    (source) => source.source_type === 'github',
  )
}

/** GitHub 저장소 URL을 Evidence source로 등록한다. */
export async function createGitHubSource(url) {
  const response = await apiClient.post('/evidence/sources', {
    source_type: 'github',
    url,
  })

  return response.data
}

/** 등록된 Evidence source를 삭제한다. */
export async function deleteEvidenceSource(sourceId) {
  await apiClient.delete(`/evidence/sources/${sourceId}`)
}

/** 지정한 GitHub source의 Evidence 인덱싱을 시작한다. */
export async function startEvidenceIndex(sourceIds) {
  const response = await apiClient.post('/evidence/index', {
    source_ids: sourceIds,
  })

  return response.data
}

/** 현재 Evidence 인덱싱 작업 상태를 조회한다. */
export async function getEvidenceIndexStatus() {
  const response = await apiClient.get('/evidence/status')
  return response.data
}

/** 현재 사용자의 Evidence 분석 요약을 조회한다. */
export async function getEvidenceSummary() {
  const response = await apiClient.get('/evidence/summary')
  return response.data
}
