import { Suspense } from 'react';
import FluidGlass from '../components/ReactBits/FluidGlass';
import './Landing.css';

export default function Landing() {
    return (
        <div className="landing-page">
            <Suspense fallback={
                <div className="landing-hero-fallback">
                    <div className="landing-hero-loader">
                        <div className="loader-ring"></div>
                        <span>Loading 3D Experience…</span>
                    </div>
                </div>
            }>
                <FluidGlass
                    mode="lens"
                    lensProps={{
                        scale: 0.25,
                        ior: 1.15,
                        thickness: 5,
                        chromaticAberration: 0.1,
                        anisotropy: 0.01
                    }}
                />
            </Suspense>
        </div>
    );
}
