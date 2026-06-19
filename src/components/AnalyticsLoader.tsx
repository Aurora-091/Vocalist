import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { initPostHog, capturePageView } from "../lib/posthog";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

let tagInjected = false;

function injectGtag(measurementId: string) {
  if (document.getElementById("gtag-script")) return;

  const gtagScript = document.createElement("script");
  gtagScript.id = "gtag-script";
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.insertBefore(gtagScript, document.head.firstChild);

  const inlineScript = document.createElement("script");
  inlineScript.id = "gtag-init";
  inlineScript.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`;
  document.head.insertBefore(inlineScript, gtagScript.nextSibling);
}

function injectGTM(containerId: string) {
  if (document.getElementById("gtm-script")) return;

  const script = document.createElement("script");
  script.id = "gtm-script";
  script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`;
  document.head.insertBefore(script, document.head.firstChild);

  const noscript = document.createElement("noscript");
  noscript.id = "gtm-noscript";
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(noscript, document.body.firstChild);
}

export function AnalyticsLoader() {
  const location = useLocation();

  useEffect(() => {
    initPostHog();

    (async () => {
      let tagId = import.meta.env.VITE_GTM_ID || import.meta.env.VITE_GA4_ID || null;
      let trackingEnabled = true;

      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("gtm_container_id, tracking_enabled")
          .eq("id", true)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          tagId = data.gtm_container_id || tagId;
          trackingEnabled = data.tracking_enabled;
        }
      } catch (err) {
        console.error("Failed to fetch tracking configuration:", err);
      }

      if (!trackingEnabled || !tagId || tagInjected) return;

      window.dataLayer = window.dataLayer || [];

      if (tagId.startsWith("GTM-")) {
        injectGTM(tagId);
      } else if (tagId.startsWith("G-")) {
        injectGtag(tagId);
      }

      tagInjected = true;
    })();
  }, []);

  useEffect(() => {
    const fullPath = location.pathname + location.search;

    capturePageView(fullPath);

    if (tagInjected && window.gtag) {
      window.gtag("event", "page_view", { page_path: fullPath });
    } else if (tagInjected) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "spa_pageview", page_path: fullPath });
    }
  }, [location]);

  return null;
}
