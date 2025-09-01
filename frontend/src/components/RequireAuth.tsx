import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getToken } from '../api/base';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [ok, setOk] = React.useState<boolean>(false);
  const location = useLocation();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await authApi.me();
        if (!alive) return;
        if (me) {
          setOk(true);
          return;
        }
        // no cookie session; if a token exists, still allow and let subsequent calls fail if invalid
        setOk(!!getToken());
      } catch {
        setOk(!!getToken());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (loading) return <div className="p-6 text-white">Checking session…</div>;
  if (!ok) return <Navigate to="/" replace state={{ from: location }} />;
  return <>{children}</>;
}
