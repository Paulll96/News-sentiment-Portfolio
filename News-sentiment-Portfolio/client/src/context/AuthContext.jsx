import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            apiRequest('/auth/me')
                .then(data => setUser(data.user))
                .catch((error) => {
                    // Only clear auth on definitive auth failures.
                    if (error?.status === 401 || error?.status === 403) {
                        localStorage.removeItem('token');
                        setUser(null);
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        localStorage.setItem('token', data.token);
        setUser(data.user);
        return data.user;
    };



    const signup = async (name, email, password) => {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
        localStorage.setItem('token', data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        const token = localStorage.getItem('token');

        try {
            if (token) {
                await apiRequest('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            // Best-effort server logout; local sign-out still proceeds.
            if (![0, 401, 403].includes(error?.status)) {
                console.warn('Logout request failed:', error?.message || error);
            }
        } finally {
            localStorage.removeItem('token');
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
