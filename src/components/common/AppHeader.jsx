import AppBrand from './AppBrand'
import './AppHeader.scss'

function AppHeader({ afterBrand, children }) {
  return (
    <header className="app-header">
      <div className="app-header__leading">
        <AppBrand />
        {afterBrand}
      </div>
      {children}
    </header>
  )
}

export default AppHeader
