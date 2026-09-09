import { ContextMenu } from './components/ContextMenu';
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api, queryClient } from './api';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { RewardStore } from './pages/RewardStore';
import { Setup } from './pages/Setup';
import { Admin } from './pages/Admin';
import './style.css';
function App() {
  const { data, error } = useQuery({
    queryKey: ['setup'],
    queryFn: () => api<{ required: boolean; timezone: string }>('/setup'),
  });
  const location = useLocation();
  if (!data)
    return (
      <main className="loading" role="status">
        {error
          ? 'Cannot reach your household server. Check the local connection and try again.'
          : 'Opening PebbleDose…'}
      </main>
    );
  if (data.required && location.pathname !== '/setup')
    return <Navigate to="/setup" replace />;
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          data.required ? (
            <Setup defaultTimezone={data.timezone} />
          ) : (
            <Navigate to="/admin/users?setup=1" replace />
          )
        }
      />
      <Route path="/kiosk" element={<Home />} />
      <Route path="/kiosk/profile/:id" element={<Profile />} />
      <Route path="/kiosk/profile/:id/rewards" element={<RewardStore />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="*" element={<Navigate to="/kiosk" replace />} />
    </Routes>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ContextMenu />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Core operation still works without installation. */
    });
  });
}
