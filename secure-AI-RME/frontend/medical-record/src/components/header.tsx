"use client"
import React from "react"
import { usePathname } from "next/navigation"


const Header = () => {
    const pathname = usePathname();

    const routesName: Record<string, string> = {
        "/": "Dashboard",
        "/daily-report": "Daily Report Visitor",
        "/medical-record": "Medical Record",
        "/financial-report": "Financial Report",
        "/management-setting": "Management Setting",
        "/account-setting": "Account Setting",
        "/activity-history": "Activity History"
    }

    const currentTitle = routesName[pathname] || 'Dashboard';
    return (
        <header>
            <h1 className="text-[#4F6F52] underline font-bold text-2xl">{currentTitle}</h1>
        </header>
    )
}
export default Header;