import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { initPostHog, capturePageView } from "../lib/posthog";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

let gtmInjected = false;

export function AnalyticsLoader() {
  const location = useLocation();

  useEffect(() => {
    initPostHog();

    (async () => {
      let gtmId = import.meta.env.VITE_GTM_ID || null;
      let trackingEnabled = true;

      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("gtm_container_id, tracking_enabled")
          .eq("id", true)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          gtmId = data.gtm_container_id || gtmId;
          trackingEnabled = data.tracking_enabled;
        }
      } catch (err) {
        console.error("Failed to fetch GTM configuration from database:", err);
      }

      if (!trackingEnabled || !gtmId) {
        return;
      }

      if (gtmInjected || document.getElementById("gtm-script")) {
        gtmInjected = true;
        return;
      }

      window.dataLayer = window.dataLayer || [];

      const script = document.createElement("script");
      script.id = "gtm-script";
      script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(script);

      const noscript = document.createElement("noscript");
      noscript.id = "gtm-noscript";
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
      iframe.height = "0";
      iframe.width = "0";
      iframe.style.display = "none";
      iframe.style.visibility = "hidden";
      noscript.appendChild(iframe);
      document.body.insertBefore(noscript, document.body.firstChild);

      gtmInjected = true;
    })();
  }, []);

  useEffect(() => {
    const fullPath = location.pathname + location.search;

    capturePageView(fullPath);

    if (gtmInjected) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "spa_pageview",
        page_path: fullPath,
      });
    }
  }, [location]);

  return null;
}
