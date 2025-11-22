'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import Button from './ui/Button'; // Using our new Brick

export default function Navbar() {
  const { login, authenticated, user, logout } = usePrivy();

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <div className="text-xl font-bold tracking-tighter text-blue-500">
          FlightStakeFi ✈️
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-4">
          {authenticated ? (
            <>
              {/* User ID Pill */}
              <div className="hidden md:block px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400 border border-white/5">
                {user?.email?.address || user?.wallet?.address?.slice(0, 6) + '...'}
              </div>

              <Link href="/dashboard">
                <Button variant="ghost" className="text-sm">Dashboard</Button>
              </Link>
              
              <Link href="/market">
                <Button variant="ghost" className="text-sm">Market</Button>
              </Link>

              <Button 
                variant="danger" 
                onClick={logout}
                className="px-4"
              >
                Log out
              </Button>
            </>
          ) : (
            <Button onClick={login} variant="primary">
              Log in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}