import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../../lib/admin-api";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authorized" | "denied">("loading");

  useEffect(() => {
    let mounted = true;
    adminApi.checkAccess()
      .then((res) => {
        if (!mounted) return;
        setStatus(res.platform_role === "super_admin" ? "authorized" : "denied");
      })
      .catch(() => {
        if (mounted) setStatus("denied");
      });
    return () => { mounted = false; };
  }, []);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Verifying access...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
