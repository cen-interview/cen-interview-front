import { Outlet } from 'react-router-dom'

function RootLayout() {
  return (
    <div className="app">
      <Outlet />
    </div>
  )
}

export default RootLayout
