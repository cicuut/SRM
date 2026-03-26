import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest){
    const token = request.cookies.get('access_token')?.value;
    const { pathname } = request.nextUrl;

    const protectedPaths =['/dashboard' ];

    if (protectedPaths.some(path => pathname.startsWith(path)) && !token){
        return NextResponse.redirect(new URL('/login', request.url));
    }
    if ((pathname === '/register-clinic' && !token)){
        return NextResponse.redirect(new URL('/register', request.url));
    }
    if ((pathname === '/' && token)){
        return NextResponse.redirect(new URL('/dashboard', request.url) )
    }
    return NextResponse.next();
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};