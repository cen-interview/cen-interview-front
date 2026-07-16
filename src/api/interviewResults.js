import { apiClient } from './client.js'

export const getInterviewHistory = async ({ page = 1, size = 10 } = {}) => {
  const response = await apiClient.get('/interview-results/history', {
    params: { page, size },
  })

  return response.data
}

export const getInterviewResult = async (resultId) => {
  const response = await apiClient.get(
    `/interview-results/${encodeURIComponent(resultId)}`,
  )

  return response.data
}