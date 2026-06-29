import { createBrowserRouter } from 'react-router-dom'
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

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.MODE_SELECT, element: <ModeSelectPage /> },
      { path: ROUTES.VOICE_INTERVIEW, element: <VoiceInterviewPage /> },
      { path: ROUTES.CHAT_INTERVIEW, element: <ChatInterviewPage /> },
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.SIGN_UP, element: <SignUpPage /> },
      { path: ROUTES.REPORT, element: <ReportPage /> },
      { path: ROUTES.MY_PAGE, element: <MyPage /> },
      { path: ROUTES.MY_PAGE_ANALYSIS, element: <AnalysisDetailPage /> },
    ],
  },
])
