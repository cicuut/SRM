'use client';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const LoadingOverlay = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="w-64 h-64">
                <DotLottieReact
                    src="/loading.lottie"
                    loop
                    autoplay
                />
            </div>
            <p className="mt-4 text-[#4F6F52] font-poppins font-bold text-xl animate-pulse text-center">
                Loading
            </p>
        </div>
    );
};

export default LoadingOverlay;