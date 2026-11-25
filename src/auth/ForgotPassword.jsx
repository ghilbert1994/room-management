import './Login.css'
import logo from '../assets/logo.png'
import { Link } from 'react-router-dom'
import { useState } from 'react'

function ForgotPassword() {
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSubmitting(true)
        setError("")
        setMessage("")

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Could not create the reset request")
            setMessage(data.message)
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                <img src={logo} id="logo" alt="Logo" />
                <h1 id="login-title">Forgot Password</h1>

                {error && <p className="login-error" role="alert">{error}</p>}

                {message ? (
                    <div className="login-form">
                        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6 }}>
                            {message}
                        </p>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                            If an email is registered, MIS or the admin can open <strong>User Management</strong> and
                            create a reset link for this account. Ask them for the link, then open it in this browser.
                        </p>
                        <Link className="submit" to="/login" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '50px' }}>
                            Back to Log In
                        </Link>
                    </div>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="prompt-label-box">
                            <label>Email Address</label>
                            <input
                                type="email"
                                required
                                className="prompt-box"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                                Enter the email address on your LabEase account.
                            </small>
                        </div>

                        <button className="submit" type="submit" disabled={submitting}>
                            {submitting ? "Sending..." : "Request Reset Link"}
                        </button>

                        <div className="support-prompt">
                            <p>Remembered it?</p>
                            <Link to="/login">Back to Log In</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

export default ForgotPassword
