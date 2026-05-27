import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type JwtPayload = {
    role?: string;
    clinic_id?: string | null;
    exp?: number;
};

const protectedPaths = [
    '/dashboard',
    '/daily-report',
    '/medical-record',
    '/financial-report',
    '/management-setting',
    '/account-setting',
    '/activity-history',
    '/register-clinic',
    '/regist',
];

const authPaths = ['/login'];

const normalizeRole = (role?: string | null) => {
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'developer') return 'admin';

    if (normalizedRole === 'midwife') return 'midwife';
    if (normalizedRole === 'bidan') return 'midwife';
    if (normalizedRole === 'owner') return 'midwife';

    if (normalizedRole === 'asisten') return 'asisten';
    if (normalizedRole === 'assistant') return 'asisten';
    if (normalizedRole === 'staff') return 'asisten';

    return normalizedRole;
};

const normalizeClinicId = (clinicId?: string | null) => {
    const normalizedClinicId = String(clinicId || '').trim().toLowerCase();

    if (!normalizedClinicId) return '';
    if (normalizedClinicId === 'null') return '';
    if (normalizedClinicId === 'none') return '';
    if (normalizedClinicId === 'undefined') return '';

    return String(clinicId);
};

const isPathStartsWith = (pathname: string, paths: string[]) => {
    return paths.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
};

const isProtectedPath = (pathname: string) => {
    return isPathStartsWith(pathname, protectedPaths);
};

const decodeBase64Url = (value: string) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        '=',
    );

    return atob(paddedBase64);
};

const decodeJwtPayload = (token?: string): JwtPayload | null => {
    if (!token) return null;

    try {
        const payloadPart = token.split('.')[1];

        if (!payloadPart) return null;

        const jsonPayload = decodeBase64Url(payloadPart);

        return JSON.parse(jsonPayload) as JwtPayload;
    } catch {
        return null;
    }
};

const isTokenExpired = (payload: JwtPayload | null) => {
    if (!payload?.exp) return false;

    const nowInSeconds = Math.floor(Date.now() / 1000);

    return payload.exp <= nowInSeconds;
};

const redirectTo = (request: NextRequest, path: string) => {
    return NextResponse.redirect(new URL(path, request.url));
};

const clearAuthCookies = (response: NextResponse) => {
    response.cookies.delete('access_token');

    return response;
};

export function middleware(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value;
    const { pathname } = request.nextUrl;

    const payload = decodeJwtPayload(token);
    const role = normalizeRole(payload?.role);
    const clinicId = normalizeClinicId(payload?.clinic_id);

    const hasToken = Boolean(token);
    const tokenExpired = isTokenExpired(payload);

    const isMidwifeWithoutClinic = hasToken && role === 'midwife' && !clinicId;

    if (hasToken && tokenExpired) {
        return clearAuthCookies(redirectTo(request, '/login'));
    }

    if (isProtectedPath(pathname) && !hasToken) {
        return redirectTo(request, '/login');
    }

    if (authPaths.includes(pathname) && hasToken) {
        if (isMidwifeWithoutClinic) {
            return redirectTo(request, '/register-clinic');
        }

        return redirectTo(request, '/dashboard');
    }

    if (pathname === '/' && hasToken) {
        if (isMidwifeWithoutClinic) {
            return redirectTo(request, '/register-clinic');
        }

        return redirectTo(request, '/dashboard');
    }

    if (
        isMidwifeWithoutClinic &&
        isProtectedPath(pathname) &&
        pathname !== '/register-clinic'
    ) {
        return redirectTo(request, '/register-clinic');
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};