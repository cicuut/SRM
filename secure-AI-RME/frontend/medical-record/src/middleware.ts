import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value;
    const { pathname } = request.nextUrl;

    const authPaths = ['/login', '/register'];

    const protectedPaths = [
        '/dashboard',
        '/daily-report',
        '/medical-record',
        '/financial-report',
        '/management-setting',
        '/account-setting',
        '/activity-history',
        '/register-clinic',
    ];

    const isAuthPath = authPaths.some((path) => pathname === path);
    const isProtectedPath = protectedPaths.some((path) =>
        pathname.startsWith(path),
    );

    if (pathname === '/') {
        if (token) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isProtectedPath && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthPath && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
};