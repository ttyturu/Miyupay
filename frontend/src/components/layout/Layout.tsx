import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  WalletIcon, ArrowsLeftRightIcon, ClockCounterClockwiseIcon, SignOutIcon,
  MagnifyingGlassIcon, WarningCircleIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../ui/Logo';
import Avatar from '../ui/Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: typeof WalletIcon;
  // NavLink's active-match is prefix-based by default, so a route that's a
  // prefix of another (e.g. /admin vs /admin/flagged) needs `end` or both
  // links stay highlighted together on the nested route.
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard', icon: WalletIcon },
  { to: '/convert',      label: 'Convert', icon: ArrowsLeftRightIcon },
  { to: '/send',         label: 'Send', icon: ArrowsLeftRightIcon },
  { to: '/transactions', label: 'Transactions', icon: ClockCounterClockwiseIcon },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin',         label: 'Admin', icon: MagnifyingGlassIcon, end: true },
  { to: '/admin/flagged', label: 'Flagged', icon: WarningCircleIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV;

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 min-w-0">
            <Logo className="h-8 w-auto scale-90 origin-left shrink-0" />
            <div className="hidden sm:flex gap-1 overflow-x-auto">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
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
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <Link to="/account" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar name={user.fullName} size={28} />
                <span className="hidden sm:inline text-sm text-muted-foreground">{user.email}</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <SignOutIcon size={16} />
              Sign out
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-1 px-4 pb-2 overflow-x-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
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
