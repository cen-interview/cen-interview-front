import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import './LoginPage.scss'
import { useLoginMutation } from "../../hooks/useLoginMutation";


function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.7 12s3.2-5.5 9.3-5.5 9.3 5.5 9.3 5.5-3.2 5.5-9.3 5.5S2.7 12 2.7 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {!visible && <path className="login__eye-slash" d="m4 4 16 16" />}
    </svg>
  )
}

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)

  const loginMutation = useLoginMutation();

  const handleSubmit = (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget);

    const email = formData.get("email");
    const password = formData.get("password");

    loginMutation.mutate({
      email,
      password,
    });
  }

  return (
    <div className="login">
      <div className="login__dot-pattern" aria-hidden="true" />
      <span className="login__pixel login__pixel--top" aria-hidden="true" />
      <span className="login__pixel login__pixel--middle" aria-hidden="true" />
      <span className="login__pixel login__pixel--bottom" aria-hidden="true" />

      <AppHeader>
        <Link className="login__sign-up-link" to={ROUTES.SIGN_UP}>
          아직 회원이 아니신가요? <strong>회원가입</strong>
          <span aria-hidden="true">→</span>
        </Link>
      </AppHeader>

      <main className="login__main">
        <section className="login__card" aria-labelledby="login-title">
          <div className="login__card-heading">
            <p className="login__eyebrow">
              <span aria-hidden="true" />
              WELCOME BACK
            </p>
            <h1 id="login-title">다시 만나서 반가워요!</h1>
            <p>계속해서 면접 실력을 키워볼까요?</p>
          </div>

          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span>이메일</span>
              <input
                type="email"
                name="email"
                placeholder="example@email.com"
                autoComplete="email"
                required
              />
            </label>

            <div className="login__field">
              <label htmlFor="login-password">비밀번호</label>
              <div className="login__password-input">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="비밀번호를 입력해주세요"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
            </div>

            <div className="login__options">
              <label className="login__remember">
                {/*<input type="checkbox" name="remember" />*/}
                {/*<span className="login__checkbox" aria-hidden="true">*/}
                {/*  ✓*/}
                {/*</span>*/}
                {/*로그인 상태 유지*/}
              </label>
              <button className="login__find-password" type="button">
                비밀번호 찾기
              </button>
            </div>

            <button className="login__submit" type="submit">
              로그인
            </button>
          </form>

          <div className="login__divider">
            <span />
            또는
            <span />
          </div>

          <Link className="login__guest-link" to={ROUTES.MODE_SELECT}>
            가입 없이 먼저 둘러보기
          </Link>
        </section>

        <section className="login__visual" aria-label="면접 성장 현황 미리보기">
          <p className="login__visual-eyebrow">
            <span aria-hidden="true" />
            YOUR GROWTH
          </p>
          <h2>
            연습할수록 선명해지는
            <br />
            <strong>나만의 면접 데이터</strong>
          </h2>
          <p className="login__visual-copy">
            지난 기록부터 맞춤 피드백까지,
            <br />
            로그인하고 이어서 확인해보세요.
          </p>

          <div className="login__dashboard" aria-hidden="true">
            <div className="login__dashboard-bar">
              <span />
              <span />
              <span />
              <i />
            </div>

            <div className="login__dashboard-content">
              <div className="login__score-card">
                <div>
                  <span>최근 면접 점수</span>
                  <strong>86</strong>
                </div>
                <em>+12%</em>
              </div>

              <div className="login__chart-card">
                <div className="login__chart-heading">
                  <span>답변 완성도</span>
                  <strong>최근 5회</strong>
                </div>
                <div className="login__chart">
                  <span style={{ '--height': '34%' }} />
                  <span style={{ '--height': '48%' }} />
                  <span style={{ '--height': '57%' }} />
                  <span style={{ '--height': '73%' }} />
                  <span style={{ '--height': '88%' }} />
                </div>
              </div>

              <div className="login__feedback-card">
                <span className="login__feedback-icon">✓</span>
                <div>
                  <strong>좋아지고 있어요!</strong>
                  <p>답변 구조가 지난 면접보다 안정적이에요.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="login__visual-points">
            <span>
              <i aria-hidden="true">01</i>
              면접별 상세 리포트
            </span>
            <span>
              <i aria-hidden="true">02</i>
              성장 흐름 한눈에 보기
            </span>
          </div>
        </section>
      </main>

      <footer className="login__footer">© 말해보센</footer>
    </div>
  )
}

export default LoginPage
