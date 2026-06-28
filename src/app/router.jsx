import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import HomePage from '../pages/home/HomePage'
import ModeSelectPage from '../pages/mode-select/ModeSelectPage'
import VoiceInterviewPage from '../pages/interview/VoiceInterviewPage'
import ChatInterviewPage from '../pages/interview/ChatInterviewPage'
import ReportPage from '../pages/report/ReportPage'
import MyPage from '../pages/my-page/MyPage'
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
      { path: ROUTES.REPORT, element: <ReportPage /> },
      { path: ROUTES.MY_PAGE, element: <MyPage /> },
    ],
  },
])
