import React, { useState, useEffect } from 'react';

const ThemeSwitcher = () => {
    const [theme, setTheme] = useState('');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            const root = document.getElementsByTagName('html')[0];
            if (savedTheme === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
            setTheme(savedTheme);
        }
    }, []);

    const onThemeToggler = () => {
        const root = document.getElementsByTagName('html')[0];
        let newTheme = theme === '' ? 'dark' : '';

        if (newTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={onThemeToggler}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
            <i className={`pi ${theme === 'dark' ? 'pi-sun' : 'pi-moon'}`} />
        </button>
    );
};

export default ThemeSwitcher;