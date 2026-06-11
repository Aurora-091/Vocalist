import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon,
  cta,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-md py-16 px-6 text-center animate-slide-up">
      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4 text-text-muted">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-text-muted max-w-md mx-auto leading-relaxed">{description}</p>
      )}
      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div className={`bg-surface-2 rounded-md animate-pulse ${className}`} />
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-surface border border-danger/30 rounded-md p-6 text-center animate-slide-up">
      <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-3">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text">Something went wrong</p>
      <p className="mt-1 text-xs text-text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-700 transition-colors focus-ring rounded-md px-3 py-1"
        >
          Try again
        </button>
      )}
    </div>
  );
}
