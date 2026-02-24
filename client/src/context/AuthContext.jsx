import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState(null); // { tempToken }

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            apiRequest('/auth/me')
                .then(data => setUser(data.user))
                .catch(() => localStorage.removeItem('token'))
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

        // If 2FA is required, return challenge instead of logging in
        if (data.requires2FA) {
            setTwoFactorChallenge({ tempToken: data.tempToken });
            return { requires2FA: true };
        }

        localStorage.setItem('token', data.token);
        setUser(data.user);
        return data.user;
    };

    const verify2FA = async (code) => {
        if (!twoFactorChallenge) throw new Error('No 2FA challenge active');

        const data = await apiRequest('/2fa/validate', {
            method: 'POST',
            body: JSON.stringify({ tempToken: twoFactorChallenge.tempToken, code }),
        });

        if (!data.valid) throw new Error('Invalid 2FA code');

        localStorage.setItem('token', data.token);
        setUser(data.user);
        setTwoFactorChallenge(null);
        return data.user;
    };

    const cancel2FA = () => {
        setTwoFactorChallenge(null);
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

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setTwoFactorChallenge(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, verify2FA, cancel2FA, twoFactorChallenge }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
