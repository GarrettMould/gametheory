import { useEffect, useRef, useState } from 'react'
import { ADMIN_PIN, unlockLab } from './adminPin.js'
import './AdminLock.css'

export default function AdminLock({
  className,
  eyebrow,
  title,
  prompt,
  action,
  onUnlock,
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    if (pin !== ADMIN_PIN) {
      setError('That PIN is not correct.')
      return
    }
    unlockLab()
    onUnlock()
  }

  return (
    <main className={className}>
      <header className="intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{prompt}</p>
      </header>

      <form className="sheet admin-lock" onSubmit={handleSubmit}>
        <label className="field" htmlFor="admin-pin">
          <span>Admin PIN</span>
          <input
            ref={inputRef}
            id="admin-pin"
            name="admin-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'admin-pin-error' : undefined}
            onChange={(event) => {
              setPin(event.target.value)
              setError('')
            }}
          />
        </label>
        {error && (
          <small id="admin-pin-error" className="error">
            {error}
          </small>
        )}
        <div className="actions">
          <button type="submit">{action}</button>
        </div>
      </form>
    </main>
  )
}
