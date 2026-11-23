// Full app themes. The CSS side lives in src/index.css ([data-theme="..."]
// blocks); these hex values are only used where CSS variables cannot reach:
// the Settings preview swatches and the Recharts SVG fills.
export const THEMES = [
    { id: "navy", label: "Navy", brand: "#071f5c", brandDeep: "#04123a", accent: "#f97316", accentLight: "#fdba74" },
    { id: "forest", label: "Forest", brand: "#04432a", brandDeep: "#022617", accent: "#f5c542", accentLight: "#ffd86b" },
    { id: "plum", label: "Plum", brand: "#4a1273", brandDeep: "#2a0a4a", accent: "#f472b6", accentLight: "#f9a8d4" },
    { id: "graphite", label: "Graphite", brand: "#1a2537", brandDeep: "#0b1120", accent: "#22d3ee", accentLight: "#67e8f9" },
    { id: "maroon", label: "Maroon", brand: "#671414", brandDeep: "#3b0a0a", accent: "#f5c542", accentLight: "#ffd86b" },
    { id: "ocean", label: "Ocean", brand: "#0b4a52", brandDeep: "#04262b", accent: "#fb923c", accentLight: "#fdba74" },
    { id: "midnight", label: "Midnight", brand: "#0f172a", brandDeep: "#020617", accent: "#a78bfa", accentLight: "#c4b5fd" },
    { id: "cocoa", label: "Cocoa", brand: "#3a251e", brandDeep: "#1c1210", accent: "#2dd4bf", accentLight: "#5eead4" }
]

export const DEFAULT_THEME = "navy"

export const isThemeId = (id) => THEMES.some((theme) => theme.id === id)

export const themeById = (id) => THEMES.find((theme) => theme.id === id) || THEMES[0]
