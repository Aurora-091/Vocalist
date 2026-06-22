import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";


declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    __weeber_analytics?: {
      status: "pending" | "loaded" | "disabled" | "error";
      tagId: string | null;
      tagType: "ga4" | "gtm" | null;

      loadedAt: string | null;
      error: string | null;
    };
  }
}

let tagInjected = false;

function setAnalyticsStatus(update: Partial<NonNullable<typeof window.__weeber_analytics>>) {
  window.__weeber_analytics = {
    status: "pending",
    tagId: null,
    tagType: null,

    loadedAt: null,
    error: null,
    ...window.__weeber_analytics,
    ...update,
  };
}

function injectGtag(measurementId: string) {
  if (document.getElementById("gtag-script")) return;

  const gtagScript = document.createElement("script");
  gtagScript.id = "gtag-script";
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

  gtagScript.onload = () => {
    setAnalyticsStatus({ status: "loaded", loadedAt: new Date().toISOString() });
  };

  gtagScript.onerror = () => {
    setAnalyticsStatus({ status: "error", error: "GA4 script failed to load (blocked by ad-blocker or network error)" });
  };

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
  script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.onload=function(){};f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`;
  document.head.insertBefore(script, document.head.firstChild);

  const noscript = document.createElement("noscript");
  noscript.id = "gtm-noscript";
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(noscript, document.body.firstChild);

  setTimeout(() => {
    const gtmLoaded = document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${containerId}"]`);
    if (gtmLoaded) {
      setAnalyticsStatus({ status: "loaded", loadedAt: new Date().toISOString() });
    } else {
      setAnalyticsStatus({ status: "error", error: "GTM script may be blocked by ad-blocker" });
    }
  }, 3000);
}

function injectTag(tagId: string) {
  if (tagInjected) return;
  window.dataLayer = window.dataLayer || [];
  if (tagId.startsWith("GTM-")) {
    setAnalyticsStatus({ tagId, tagType: "gtm" });
    injectGTM(tagId);
  } else if (tagId.startsWith("G-")) {
    setAnalyticsStatus({ tagId, tagType: "ga4" });
    injectGtag(tagId);
  } else {
    setAnalyticsStatus({ status: "error", tagId, error: "Unrecognized tag format. Expected G-XXXXX or GTM-XXXXX" });
    return;
  }
  tagInjected = true;
}

export function AnalyticsLoader() {
  const location = useLocation();

  useEffect(() => {
    setAnalyticsStatus({ status: "pending" });

    const envTagId = import.meta.env.VITE_GTM_ID || import.meta.env.VITE_GA4_ID || null;

    // Fast path: env var is set — inject immediately, no DB round-trip needed.
    if (envTagId) {
      injectTag(envTagId);
      return;
    }

    // Slow path: no env var — check DB for admin-configured tag ID.
    (async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("gtm_container_id, tracking_enabled")
          .eq("id", true)
          .maybeSingle();

        if (error) throw error;

        if (!data || !data.tracking_enabled) {
          setAnalyticsStatus({ status: "disabled", tagId: data?.gtm_container_id ?? null });
          return;
        }

        if (!data.gtm_container_id) {
          setAnalyticsStatus({ status: "disabled", error: "No tag ID configured" });
          return;
        }

        injectTag(data.gtm_container_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setAnalyticsStatus({ status: "error", error: `DB fetch failed: ${msg}` });
      }
    })();
  }, []);

  useEffect(() => {
    const fullPath = location.pathname + location.search;

    if (tagInjected && window.gtag) {
      window.gtag("event", "page_view", { page_path: fullPath });
    } else if (tagInjected) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "spa_pageview", page_path: fullPath });
    }
  }, [location]);

  return null;
}
