'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function Page() {
    const router = useRouter();

    useEffect(() => {
        const token = Cookies.get('access_token');

        if (token) {
            router.replace('/dashboard');
            return;
        }

        router.replace('/login');
    }, [router]);

    return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-[#FDFEF9]">
            <p className="text-[14px] font-bold text-[#5F785F]">
                Redirecting...
            </p>
        </div>
    );
}