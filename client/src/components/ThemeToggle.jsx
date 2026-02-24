import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * ThemeToggle — Dark/Light mode switch
 * Persists preference to localStorage and applies data-theme attribute to <html>
 */
export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('sq-theme') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sq-theme', theme);
    }, [theme]);

    const toggle = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    return (
        <button
            onClick={toggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
            }}
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}
