import './Login.css'
import logo from '../assets/logo.png'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'

function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token") || ""

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")
        setMessage("")

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }
        if (password.length < 8) {
            setError("New password must be at least 8 characters.")
            return
        }

        setSubmitting(true)

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Could not reset the password")
            setMessage(data.message)
            setPassword("")
            setConfirmPassword("")
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
                <h1 id="login-title">Reset Password</h1>

                {error && <p className="login-error" role="alert">{error}</p>}

                {!token ? (
                    <div className="login-form">
                        <p className="login-error" role="alert">
                            This reset link is incomplete. Ask MIS or the admin for a new one.
                        </p>
                        <Link className="submit" to="/forgot-password" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '50px' }}>
                            Request a New Link
                        </Link>
                    </div>
                ) : message ? (
                    <div className="login-form">
                        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6 }}>
                            {message}
                        </p>
                        <Link className="submit" to="/login" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '50px' }}>
                            Go to Log In
                        </Link>
                    </div>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="prompt-label-box">
                            <label>New Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="prompt-box"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </div>

                        <div className="prompt-label-box">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="prompt-box"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                            />
                        </div>

                        <button className="submit" type="submit" disabled={submitting}>
                            {submitting ? "Updating..." : "Set New Password"}
                        </button>

                        <div className="support-prompt">
                            <p>Changed your mind?</p>
                            <Link to="/login">Back to Log In</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

export default ResetPassword
