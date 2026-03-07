import { useState } from 'react';
import { Star } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * WatchlistStar — Toggle star to add/remove stock from user's watchlist
 * Props:
 *   stockId: UUID of the stock
 *   initialWatched: boolean (optional, pre-set if already in watchlist)
 */
export default function WatchlistStar({ stockId, initialWatched = false }) {
    const { user } = useAuth();
    const toast = useToast();
    const [watched, setWatched] = useState(initialWatched);
    const [loading, setLoading] = useState(false);

    if (!user) return null;

    const toggle = async (e) => {
        e.stopPropagation(); // Prevent event bubbling on table rows / links
        e.preventDefault();
        if (loading || !stockId) return;

        setLoading(true);
        try {
            if (watched) {
                await apiRequest(`/watchlist/${stockId}`, { method: 'DELETE' });
                setWatched(false);
                toast('Removed from watchlist', 'info');
            } else {
                await apiRequest('/watchlist', {
                    method: 'POST',
                    body: JSON.stringify({ stockId }),
                });
                setWatched(true);
                toast('Added to watchlist ⭐', 'success');
            }
        } catch (err) {
            toast(err.message || 'Watchlist update failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={toggle}
            disabled={loading}
            title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            style={{
                background: 'none',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.15s ease',
                transform: loading ? 'scale(0.9)' : 'scale(1)',
            }}
        >
            <Star
                size={16}
                fill={watched ? '#facc15' : 'transparent'}
                stroke={watched ? '#facc15' : 'var(--text-muted)'}
                strokeWidth={2}
            />
        </button>
    );
}
