import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import './AppBrand.scss'

function AppBrand({ compact = false }) {
  return (
    <Link
      className={`app-brand${compact ? ' app-brand--compact' : ''}`}
      to={ROUTES.HOME}
      aria-label="말해보센 홈"
    >
      <span className="app-brand__symbol" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="app-brand__name">말해보센</span>
    </Link>
  )
}

export default AppBrand
