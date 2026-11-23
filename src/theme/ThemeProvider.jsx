import { useEffect, useMemo, useState } from "react"
import { ThemeContext } from "./themeContext.js"
import { DEFAULT_THEME, THEMES, isThemeId } from "../lib/themes.js"

const STORAGE_KEY = "labease:theme"

const readStoredTheme = () => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (isThemeId(stored)) return stored
    } catch {
        // Private mode / storage disabled: fall through to the default.
    }
    return DEFAULT_THEME
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const initial = readStoredTheme()
        // Applied during the first render so the stored accent cannot flash
        // the default one before an effect runs.
        document.documentElement.dataset.theme = initial
        return initial
    })

    useEffect(() => {
        document.documentElement.dataset.theme = theme
        try {
            window.localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            // Preference still applies for this session.
        }
    }, [theme])

    const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
