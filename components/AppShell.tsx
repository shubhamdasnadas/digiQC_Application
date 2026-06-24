'use client';

import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Pages that should render without the app shell (auth pages, etc.)
const authPages = ['/login', '/register', '/select-org'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { loading } = useAuth();

    // Auth pages don't need the sidebar/header layout
    if (authPages.includes(pathname)) {
        return <>{children}</>;
    }

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 size={32} className="animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
