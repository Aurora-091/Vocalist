import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { WeeberLogo } from "../../components/WeeberLogo";
import { Loader as Loader2, CircleAlert as AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard?welcome=1", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/dashboard?welcome=1", { replace: true });
      }
    });

    timeout = setTimeout(() => {
      setError("Email confirmation timed out. The link may have expired.");
    }, 15000);

    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-full flex items-center justify-center bg-[#F8F9FB] p-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <WeeberLogo size="md" />
        </div>

        {!error ? (
          <>
            <Loader2 className="w-8 h-8 text-[#0F172A] animate-spin mx-auto" />
            <h2 className="mt-4 text-lg font-semibold text-[#0F172A]">
              Confirming your email...
            </h2>
            <p className="mt-2 text-sm text-[#475569]">
              Just a moment while we verify your account.
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#0F172A]">
              Confirmation failed
            </h2>
            <p className="mt-2 text-sm text-[#475569]">{error}</p>
            <Link
              to="/login"
              className="inline-block mt-6 text-sm font-medium text-[#0F172A] hover:underline"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
