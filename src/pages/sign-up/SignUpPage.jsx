import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/common/AppHeader'
import { ROUTES } from '../../constants/routes'
import './SignUpPage.scss'

const agreementItems = [
  { id: 'age', label: '만 14세 이상입니다.', required: true },
  { id: 'terms', label: '서비스 이용약관에 동의합니다.', required: true },
  { id: 'privacy', label: '개인정보 수집 및 이용에 동의합니다.', required: true },
  {
    id: 'marketing',
    label: '면접 팁과 서비스 소식 수신에 동의합니다.',
    required: false,
  },
]

function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.7 12s3.2-5.5 9.3-5.5 9.3 5.5 9.3 5.5-3.2 5.5-9.3 5.5S2.7 12 2.7 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {!visible && <path className="sign-up__eye-slash" d="m4 4 16 16" />}
    </svg>
  )
}

function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [agreements, setAgreements] = useState(
    Object.fromEntries(agreementItems.map(({ id }) => [id, false])),
  )

  const allAgreed = agreementItems.every(({ id }) => agreements[id])

  const toggleAllAgreements = () => {
    const nextValue = !allAgreed

    setAgreements(
      Object.fromEntries(agreementItems.map(({ id }) => [id, nextValue])),
    )
  }

  const toggleAgreement = (id) => {
    setAgreements((current) => ({ ...current, [id]: !current[id] }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
  }

  return (
    <div className="sign-up">
      <div className="sign-up__dot-pattern" aria-hidden="true" />
      <span className="sign-up__pixel sign-up__pixel--top" aria-hidden="true" />
      <span
        className="sign-up__pixel sign-up__pixel--bottom"
        aria-hidden="true"
      />

      <AppHeader>
        <Link className="sign-up__home-link" to={ROUTES.LOGIN}>
          이미 계정이 있나요? <strong>로그인</strong>
          <span aria-hidden="true">→</span>
        </Link>
      </AppHeader>

      <main className="sign-up__main">
        <section className="sign-up__intro">
          <p className="sign-up__eyebrow">
            <span aria-hidden="true" />
            JOIN US
          </p>
          <h1>
            실전 같은 연습,
            <br />
            <strong>오늘부터 시작해요.</strong>
          </h1>
          <p className="sign-up__intro-copy">
            나만의 면접 기록을 쌓고 AI 피드백으로
            <br />
            매일 더 나은 답변을 만들어보세요.
          </p>

          <div className="sign-up__preview" aria-hidden="true">
            <div className="sign-up__preview-window">
              <span />
              <span />
              <span />
            </div>
            <div className="sign-up__preview-message sign-up__preview-message--question">
              가장 자신 있는 기술을 설명해주세요.
            </div>
            <div className="sign-up__preview-message sign-up__preview-message--answer">
              <span />
              답변을 분석하고 있어요
              <i />
              <i />
              <i />
            </div>
            <div className="sign-up__preview-score">
              <span>AI FEEDBACK</span>
              <strong>+ 12%</strong>
            </div>
          </div>

          <ul className="sign-up__benefits">
            <li>
              <span aria-hidden="true">✓</span>
              음성·채팅 면접 연습
            </li>
            <li>
              <span aria-hidden="true">✓</span>
              답변별 맞춤 AI 피드백
            </li>
            <li>
              <span aria-hidden="true">✓</span>
              면접 기록과 성장 분석
            </li>
          </ul>
        </section>

        <section className="sign-up__card" aria-labelledby="sign-up-title">
          <div className="sign-up__card-heading">
            <span className="sign-up__step">01</span>
            <div>
              <h2 id="sign-up-title">회원가입</h2>
              <p>연습 기록을 저장할 계정을 만들어주세요.</p>
            </div>
          </div>

          <form className="sign-up__form" onSubmit={handleSubmit}>
            <label className="sign-up__field">
              <span>이메일</span>
              <input
                type="email"
                name="email"
                placeholder="example@email.com"
                autoComplete="email"
                required
              />
            </label>

            <div className="sign-up__field">
              <label htmlFor="sign-up-password">비밀번호</label>
              <div className="sign-up__password-input">
                <input
                  id="sign-up-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="영문, 숫자 포함 8자 이상"
                  autoComplete="new-password"
                  minLength="8"
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

            <div className="sign-up__field">
              <label htmlFor="sign-up-password-confirm">비밀번호 확인</label>
              <div className="sign-up__password-input">
                <input
                  id="sign-up-password-confirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  name="passwordConfirm"
                  placeholder="비밀번호를 한 번 더 입력해주세요"
                  autoComplete="new-password"
                  minLength="8"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswordConfirm((visible) => !visible)
                  }
                  aria-label={
                    showPasswordConfirm
                      ? '비밀번호 확인 숨기기'
                      : '비밀번호 확인 보기'
                  }
                  aria-pressed={showPasswordConfirm}
                >
                  <EyeIcon visible={showPasswordConfirm} />
                </button>
              </div>
            </div>

            <label className="sign-up__field">
              <span>닉네임</span>
              <input
                type="text"
                name="nickname"
                placeholder="면접 연습에 사용할 이름"
                autoComplete="nickname"
                maxLength="12"
                required
              />
            </label>

            <div className="sign-up__agreements">
              <label className="sign-up__agreement sign-up__agreement--all">
                <input
                  type="checkbox"
                  checked={allAgreed}
                  onChange={toggleAllAgreements}
                />
                <span className="sign-up__checkbox" aria-hidden="true">✓</span>
                <strong>약관에 모두 동의합니다.</strong>
              </label>

              <div className="sign-up__agreement-list">
                {agreementItems.map(({ id, label, required }) => (
                  <label className="sign-up__agreement" key={id}>
                    <input
                      type="checkbox"
                      checked={agreements[id]}
                      onChange={() => toggleAgreement(id)}
                      required={required}
                    />
                    <span className="sign-up__checkbox" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <em>{required ? '[필수]' : '[선택]'}</em> {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button className="sign-up__submit" type="submit">
              회원가입 완료
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </main>

      <footer className="sign-up__footer">© 말해보센</footer>
    </div>
  )
}

export default SignUpPage
