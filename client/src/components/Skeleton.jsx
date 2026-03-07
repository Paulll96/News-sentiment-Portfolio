/**
 * Skeleton loader components for loading states
 */

export function Skeleton({ width = '100%', height = 16, rounded = false, style = {} }) {
    return (
        <div
            className="skeleton"
            style={{
                width,
                height,
                borderRadius: rounded ? 9999 : 'var(--radius-md)',
                ...style,
            }}
        />
    );
}

export function SkeletonCard({ children }) {
    return (
        <div className="glass-card no-hover" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {children}
        </div>
    );
}

export function SkeletonStatCard() {
    return (
        <SkeletonCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Skeleton width={48} height={48} style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton width="60%" height={22} />
                    <Skeleton width="40%" height={13} />
                </div>
            </div>
        </SkeletonCard>
    );
}

export function SkeletonChartCard({ height = 300 }) {
    return (
        <SkeletonCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Skeleton width={140} height={14} />
                <Skeleton width={60} height={20} rounded />
            </div>
            <Skeleton width="100%" height={height} />
        </SkeletonCard>
    );
}

export function SkeletonTableRow() {
    return (
        <tr>
            <td><Skeleton width={40} height={14} /></td>
            <td><Skeleton width="80%" height={14} /></td>
            <td><Skeleton width="60%" height={14} /></td>
            <td><Skeleton width={60} height={20} rounded /></td>
            <td><Skeleton width={30} height={14} /></td>
            <td><Skeleton width={20} height={14} /></td>
        </tr>
    );
}
