import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, FileText, Users, Bell, BarChart3, Building2,
  CreditCard, AlertCircle, CalendarDays, Shield, LogOut, Menu, ChevronLeft, ChevronRight
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/orders', icon: Package, label: 'Orders' },
  { to: '/suppliers', icon: Building2, label: 'Suppliers' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/claims', icon: AlertCircle, label: 'Claims' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/admin', icon: Shield, label: 'Admin Panel' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('zl_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('zl_sidebar_collapsed', collapsed); } catch {}
  }, [collapsed]);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-primary
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className={`border-b border-white/10 flex items-center h-16 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          {collapsed ? (
            <img src="/logo.png" alt="Al-Zanbaka" className="w-8 h-8 object-contain" />
          ) : (
            <>
              <img src="/logo.png" alt="Al-Zanbaka" className="h-9 w-auto object-contain flex-shrink-0" />
              <div className="overflow-hidden">
                <h1 className="font-bold text-white text-base leading-tight whitespace-nowrap">Al-Zanbaka</h1>
                <p className="text-[11px] text-white/40 whitespace-nowrap">Order Management</p>
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center h-10 mx-2 mb-0.5 rounded-lg text-sm font-medium transition-colors duration-150
                ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white/90'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className={`border-t border-white/10 flex-shrink-0 ${collapsed ? 'py-3 flex flex-col items-center gap-2' : 'p-3'}`}>
          {collapsed ? (
            <>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center" title={user?.display_name}>
                <span className="text-sm font-semibold text-accent">{user?.display_name?.[0] || 'U'}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-accent">{user?.display_name?.[0] || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
                <p className="text-xs text-white/40 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── Collapse toggle tab — sticks out on the right edge (desktop only) ── */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="
            hidden lg:flex
            absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-12 rounded-r-lg
            bg-primary border border-white/10 border-l-0
            items-center justify-center
            text-white/50 hover:text-white
            transition-colors duration-150
            z-10
          "
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />
          }
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:hidden h-14 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 flex-1">Al-Zanbaka</span>
          <Link to="/calendar" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors" title="Calendar">
            <CalendarDays className="w-5 h-5" />
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
