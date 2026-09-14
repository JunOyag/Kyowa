import React, { useState, useEffect } from 'react';
const ThemeSwitcher = () => {
    const [theme, setTheme] = useState('');

    useEffect(() => {
        // Check local storage for saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            console.log("Saved theme : " + savedTheme);
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
        <div className="card flex justify-end p-2 mb-4">
            <button
                type="button"
                className="flex border-1 w-2rem h-2rem p-0 align-center justify-center"
                onClick={onThemeToggler}
            >
                <i className={`dark:text-white pi ${theme === 'dark' ? 'pi-sun' : 'pi-moon'}`} />
            </button>
        </div>
    );
};

export default ThemeSwitcher;