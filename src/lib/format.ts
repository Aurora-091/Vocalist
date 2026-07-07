export function formatMoney(value: number | string | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined) {
    return `${currency === "INR" ? "₹" : "$"}0`;
  }
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numericValue)) {
    return `${currency === "INR" ? "₹" : "$"}0`;
  }
  
  try {
    const formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    return formatter.format(numericValue);
  } catch (err) {
    // Fallback if currency code is unknown or invalid
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${numericValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

export function formatRelative(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }

  // Fall back to short absolute date format
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
  });
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const trimmed = phone.trim();

  // India E.164: +919876543210 -> +91 98765 43210
  if (trimmed.startsWith("+91") && trimmed.length === 13) {
    return `+91 ${trimmed.slice(3, 8)} ${trimmed.slice(8)}`;
  }
  
  // US E.164: +14155552671 -> +1 415 555 2671
  if (trimmed.startsWith("+1") && trimmed.length === 12) {
    return `+1 ${trimmed.slice(2, 5)} ${trimmed.slice(5, 8)} ${trimmed.slice(8)}`;
  }

  // General fallback for E.164-like formatting
  if (trimmed.startsWith("+") && trimmed.length >= 12) {
    const countryLength = trimmed.length - 10;
    const country = trimmed.slice(0, countryLength);
    const rest = trimmed.slice(countryLength);
    return `${country} ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }

  return trimmed;
}
