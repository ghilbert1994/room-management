/* eslint-disable no-unused-vars */
import './Login.css'
import logo from '../assets/logo.png'
import { Link } from 'react-router-dom'
import { useEffect, useState, useContext } from 'react'
import { UserContext } from './UserContext.jsx'

const ROLE_OPTIONS = [
    { value: 'student', label: 'Student', needsCode: false },
    { value: 'faculty', label: 'Faculty', needsCode: true },
    { value: 'mis_staff', label: 'MIS Staff', needsCode: true },
    { value: 'admin', label: 'Admin', needsCode: true }
]

function Register() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [role, setRole] = useState("student")
    const [inviteCode, setInviteCode] = useState("")
    const [sectionId, setSectionId] = useState("")
    const [sections, setSections] = useState([])
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const { setUser } = useContext(UserContext)

    const selectedRole = ROLE_OPTIONS.find(option => option.value === role)

    useEffect(() => {
        const loadSections = async () => {
            try {
                const response = await fetch('/api/sections/public')
                const data = await response.json()
                if (response.ok) setSections(data.sections || [])
            } catch {
                setSections([])
            }
        }
        loadSections()
    }, [])

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        setSubmitting(true)

        try {
            const response = await fetch(`/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ 
                    name, 
                    email, 
                    password, 
                    role,
                    sectionId: role === 'student' ? sectionId || undefined : undefined,
                    invite_code: selectedRole?.needsCode ? inviteCode : undefined
                })
            })

            const data = await response.json()

            if (response.ok) {
                setUser(data.user)
            } else {
                setError(data.message || "Registration failed")
            }
        } catch (err) {
            setError("Network error. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container" style={{ height: 'auto', minHeight: '70vh', paddingTop: '28px', paddingBottom: '28px' }}>
                <img src={logo} id="logo" alt="Logo"/>
                <h1 id="login-title">Create Account</h1>
                
                {error && <p className="login-error" role="alert">{error}</p>}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="prompt-label-box">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            required 
                            className="prompt-box"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>

                    <div className="prompt-label-box">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            required 
                            className="prompt-box"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="prompt-label-box">
                        <label>Password</label>
                        <input 
                            type="password" 
                            required 
                            minLength={8}
                            autoComplete="new-password"
                            className="prompt-box"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                            At least 8 characters.
                        </small>
                    </div>

                    <div className="prompt-label-box">
                        <label>Confirm Password</label>
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

                    <div className="prompt-label-box">
                        <label>Account Type</label>
                        <select
                            className="prompt-box"
                            value={role}
                            onChange={(event) => {
                                setRole(event.target.value)
                                setInviteCode("")
                                setSectionId("")
                            }}
                        >
                            {ROLE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    {role === 'student' && sections.length > 0 && (
                        <div className="prompt-label-box">
                            <label>Section</label>
                            <select
                                required
                                className="prompt-box"
                                value={sectionId}
                                onChange={(event) => setSectionId(event.target.value)}
                            >
                                <option value="">Select your section</option>
                                {sections.map((section) => (
                                    <option key={section.id} value={section.id}>{section.label}</option>
                                ))}
                            </select>
                            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                                Your section is used for reservations and equipment reports.
                            </small>
                        </div>
                    )}

                    {selectedRole?.needsCode && (
                        <div className="prompt-label-box">
                            <label>User Account Code</label>
                            <input
                                type="text"
                                required
                                className="prompt-box"
                                placeholder="LCUP-XXX-XXXX-XXXX"
                                value={inviteCode}
                                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                            />
                            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                                Ask the administrator for a user account code for this role.
                            </small>
                        </div>
                    )}

                    <button className="submit" type="submit" style={{ marginTop: '20px' }} disabled={submitting}>
                        {submitting ? "Creating account..." : "Register"}
                    </button>

                    <div className="support-prompt">
                        <p>Already have an account?</p> 
                        <Link to="/login">Log In</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Register
