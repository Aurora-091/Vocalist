import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AuthBridge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function hydrate() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const redirect = searchParams.get("redirect") || "/dashboard";

      if (accessToken && refreshToken) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        navigate(redirect, { replace: true });
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate(redirect, { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }
    hydrate();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center">
      <img
        src="/weeber_favicon_transparent.png"
        alt="Loading"
        className="h-8 w-8 object-contain dark:invert animate-pulse"
      />
    </div>
  );
}
