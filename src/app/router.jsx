import { Route, Routes } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import HomePage from '../pages/home/HomePage'
import ModeSelectPage from '../pages/mode-select/ModeSelectPage'
import VoiceInterviewPage from '../pages/interview/VoiceInterviewPage'
import ChatInterviewPage from '../pages/interview/ChatInterviewPage'
import LoginPage from '../pages/login/LoginPage'
import SignUpPage from '../pages/sign-up/SignUpPage'
import ReportPage from '../pages/report/ReportPage'
import MyPage from '../pages/my-page/MyPage'
import AnalysisDetailPage from '../pages/my-page/AnalysisDetailPage'
import NotFoundPage from '../pages/not-found/NotFoundPage'
import { ROUTES } from '../constants/routes'

function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.MODE_SELECT} element={<ModeSelectPage />} />
        <Route path={ROUTES.VOICE_INTERVIEW} element={<VoiceInterviewPage />} />
        <Route path={ROUTES.CHAT_INTERVIEW} element={<ChatInterviewPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.SIGN_UP} element={<SignUpPage />} />
        <Route path={ROUTES.REPORT} element={<ReportPage />} />
        <Route path={ROUTES.MY_PAGE} element={<MyPage />} />
        <Route path={ROUTES.MY_PAGE_ANALYSIS} element={<AnalysisDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
