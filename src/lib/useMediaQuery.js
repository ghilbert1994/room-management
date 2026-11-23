import { useEffect, useState } from "react"

// Reads a CSS media query in React. Used to pick a sane default calendar view
// on phones. The initial state is computed synchronously so the first render is
// already correct; the effect only tracks later resizes/rotations.
export const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
        return window.matchMedia(query).matches
    })

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined

        const mql = window.matchMedia(query)
        const handleChange = (event) => setMatches(event.matches)

        mql.addEventListener("change", handleChange)
        return () => mql.removeEventListener("change", handleChange)
    }, [query])

    return matches
}

export const useIsNarrow = () => useMediaQuery("(max-width: 760px)")
