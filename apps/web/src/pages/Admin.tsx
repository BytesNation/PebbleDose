import { BrandMark } from '../components/BrandMark';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Pill,
  Clock,
  History as HistoryIcon,
  LogOut,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { api, ApiError, queryClient } from '../api';
import { PinDialog } from '../components/PinDialog';
import { Dashboard } from '../admin/Dashboard';
import { Users } from '../admin/Users';
import { Medications } from '../admin/Medications';
import { Schedules } from '../admin/Schedules';
import { History } from '../admin/History';
import { Rewards } from '../admin/Rewards';
import type { AdminData } from '../admin/types';
export function Admin() {
  const navigate = useNavigate(),
    location = useLocation();
  const { data, error, refetch } = useQuery({
    queryKey: ['admin'],
    queryFn: () => api<AdminData>('/admin'),
  });
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  )
    return (
      <PinDialog
        title="Parent sign-in"
        onDone={async () => {
          await refetch();
        }}
        onCancel={() => navigate('/kiosk')}
      />
    );
  if (!data)
    return (
      <main className="loading">
        {error
          ? 'Parent controls are unavailable. Check the local connection.'
          : 'Opening parent controls…'}
      </main>
    );
  const setup = location.search.includes('setup=1');
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand admin-brand" to="/admin">
          <BrandMark />
          PebbleDose
        </Link>
        <p className="eyebrow sidebar-label">PARENT SPACE</p>
        <nav aria-label="Parent navigation">
          {[
            ['/admin', 'Overview', LayoutDashboard],
            ['/admin/users', 'Family members', UsersIcon],
            ['/admin/medications', 'Medications', Pill],
            ['/admin/schedules', 'Schedules', Clock],
            ['/admin/rewards', 'Rewards', Gift],
            ['/admin/history', 'History', HistoryIcon],
          ].map(([path, label, Icon]) => (
            <NavLink
              key={path as string}
              to={path as string}
              end={path === '/admin'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={20} />
              {label as string}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>{data.household.name}</p>
          <small>{data.household.timezone}</small>
          <button
            className="text-button"
            onClick={async () => {
              await api('/auth/logout', 'POST');
              queryClient.clear();
              navigate('/kiosk');
            }}
          >
            <LogOut size={18} />
            Lock parent controls
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {error && (
          <p className="error" role="alert">
            Connection interrupted. Changes may not save until the household
            server reconnects.
          </p>
        )}
        {setup && (
          <div className="setup-banner">
            <strong>Finish your household setup</strong>
            <span>Add family members, medications, then schedules.</span>
            <div>
              <Link to="/admin/users?setup=1">1. Family</Link>
              <Link to="/admin/medications?setup=1">2. Medicines</Link>
              <Link to="/admin/schedules?setup=1">3. Schedules</Link>
              <Link to="/kiosk">
                Launch kiosk
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
        <Routes>
          <Route index element={<Dashboard data={data} />} />
          <Route path="users" element={<Users data={data} />} />
          <Route path="medications" element={<Medications data={data} />} />
          <Route path="schedules" element={<Schedules data={data} />} />
          <Route path="history" element={<History data={data} />} />
          <Route path="rewards" element={<Rewards data={data} />} />
          <Route path="*" element={<Dashboard data={data} />} />
        </Routes>
      </main>
    </div>
  );
}
