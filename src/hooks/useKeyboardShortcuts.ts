import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useKeyboardShortcuts = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Cmd+K or Ctrl+K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                navigate('/search');
            }

            // Cmd+H or Ctrl+H for home
            if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
                e.preventDefault();
                navigate('/feed');
            }

            // Cmd+P or Ctrl+P for projects
            if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
                e.preventDefault();
                navigate('/projects');
            }

            // Cmd+M or Ctrl+M for messages
            if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
                e.preventDefault();
                navigate('/chats');
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [navigate]);
};
