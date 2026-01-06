import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    // Load theme from localStorage
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('milestone-settings')
        if (saved) {
            try {
                return JSON.parse(saved).darkMode ?? true
            } catch {
                return true
            }
        }
        return true
    })

    // Apply dark mode class to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark')
            document.body.classList.remove('light-mode')
            document.body.classList.add('dark-mode')
        } else {
            document.documentElement.classList.remove('dark')
            document.body.classList.remove('dark-mode')
            document.body.classList.add('light-mode')
        }

        // Save to localStorage
        const settings = JSON.parse(localStorage.getItem('milestone-settings') || '{}')
        settings.darkMode = darkMode
        localStorage.setItem('milestone-settings', JSON.stringify(settings))
    }, [darkMode])

    const toggleDarkMode = () => {
        setDarkMode(prev => !prev)
    }

    const value = {
        darkMode,
        setDarkMode,
        toggleDarkMode
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

export default ThemeContext
