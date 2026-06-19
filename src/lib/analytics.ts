declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });
}

export function trackTryDemo() {
  trackEvent("click_try_demo");
}

export function trackEarlyAccess() {
  trackEvent("click_early_access");
}

export function trackFormSubmit() {
  trackEvent("form_submit");
}

export function trackFormSuccess() {
  trackEvent("form_success");
}

export function trackSignupConversion() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "signup_success" });
}
