import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getActiveTrackingProfile, getSiteSettings } from "../lib/tracking";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

let gtagInjected = false;
let fbInjected = false;
let activeProfileCache: {
  ga4_id: string;
  ads_conversion_id: string;
  ads_conversion_label: string;
} | null = null;

export function trackSignupConversion() {
  const adsId = activeProfileCache?.ads_conversion_id || import.meta.env.VITE_ADS_ID;
  const adsLabel = activeProfileCache?.ads_conversion_label || "";
  if (adsId && window.gtag) {
    const sendTo = adsLabel ? `${adsId}/${adsLabel}` : adsId;
    window.gtag!("event", "conversion", { send_to: sendTo });
  }
}

export function AnalyticsLoader() {
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const settings = await getSiteSettings();
        if (!settings.tracking_enabled) {
          return;
        }

        const profile = await getActiveTrackingProfile();
        const ga4Id = profile?.ga4_id || import.meta.env.VITE_GA4_ID;
        const adsId = profile?.ads_conversion_id || import.meta.env.VITE_ADS_ID;
        const adsLabel = profile?.ads_conversion_label || "";

        if (profile) {
          activeProfileCache = {
            ga4_id: profile.ga4_id,
            ads_conversion_id: profile.ads_conversion_id,
            ads_conversion_label: profile.ads_conversion_label,
          };
        } else if (ga4Id && adsId) {
          activeProfileCache = {
            ga4_id: ga4Id,
            ads_conversion_id: adsId,
            ads_conversion_label: adsLabel,
          };
        }

        // Ingest Google Tag Manager (gtag.js)
        if (ga4Id && !gtagInjected) {
          const script = document.createElement("script");
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
          script.id = "gtag-script";
          document.head.appendChild(script);

          const dataLayer = (window.dataLayer = window.dataLayer || []);
          window.gtag = function () {
            dataLayer.push(arguments);
          };
          window.gtag!("js", new Date());
          window.gtag!("config", ga4Id);
          if (adsId) {
            window.gtag!("config", adsId);
          }
          gtagInjected = true;
        }

        // Ingest Meta Pixel
        const metaPixelId = settings.meta_pixel_id;
        if (metaPixelId && !fbInjected) {
          (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
            if (f.fbq) return;
            n = f.fbq = function () {
              n.callMethod
                ? n.callMethod.apply(n, arguments)
                : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = !0;
            n.version = "2.0";
            n.queue = [];
            t = b.createElement(e);
            t.async = !0;
            t.src = v;
            s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
          })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

          window.fbq!("init", metaPixelId);
          window.fbq!("track", "PageView");

          // Noscript tag
          const noscript = document.createElement("noscript");
          const img = document.createElement("img");
          img.height = 1;
          img.width = 1;
          img.style.display = "none";
          img.src = `https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`;
          noscript.appendChild(img);
          document.body.appendChild(noscript);

          fbInjected = true;
        }
      } catch (err) {
        console.error("Failed to load analytics: ", err);
        // Fallback using env vars
        const fallbackGa4 = import.meta.env.VITE_GA4_ID;
        const fallbackAds = import.meta.env.VITE_ADS_ID;
        if (fallbackGa4 && !gtagInjected) {
          const script = document.createElement("script");
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${fallbackGa4}`;
          script.id = "gtag-script";
          document.head.appendChild(script);

          const dataLayer = (window.dataLayer = window.dataLayer || []);
          window.gtag = function () {
            dataLayer.push(arguments);
          };
          window.gtag!("js", new Date());
          window.gtag!("config", fallbackGa4);
          if (fallbackAds) {
            window.gtag!("config", fallbackAds);
          }
          gtagInjected = true;
          activeProfileCache = {
            ga4_id: fallbackGa4,
            ads_conversion_id: fallbackAds || "",
            ads_conversion_label: "",
          };
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (window.gtag && activeProfileCache?.ga4_id) {
      window.gtag!("event", "page_view", {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);

  return null;
}
