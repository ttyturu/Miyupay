import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { WalletIcon, ArrowsLeftRightIcon, ClockCounterClockwiseIcon, ShieldCheckIcon, SignOutIcon } from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../ui/Logo';

const NAV = [
  { to: '/dashboard',    label: 'Dashboard', icon: WalletIcon },
  { to: '/send',         label: 'Send', icon: ArrowsLeftRightIcon },
  { to: '/transactions', label: 'Transactions', icon: ClockCounterClockwiseIcon },
  { to: '/audit',        label: 'Audit Trail', icon: ShieldCheckIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo className="scale-90 origin-left" />
            <div className="hidden sm:flex gap-1">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-muted text-primary font-semibold'
                        : 'text-muted-foreground hover:text-primary'
                    }`
                  }
                >
                  <Icon size={16} weight="regular" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <SignOutIcon size={16} />
              Sign out
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-1 px-4 pb-2 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-muted text-primary font-semibold'
                    : 'text-muted-foreground hover:text-primary'
                }`
              }
            >
              <Icon size={16} weight="regular" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
