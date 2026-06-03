import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-md py-16 px-6 text-center">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">{description}</p>
      )}
      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`bg-surface-2 rounded animate-pulse ${className}`} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-surface border border-danger/30 rounded-md p-6 text-center">
      <p className="text-sm text-text">Something went wrong.</p>
      <p className="mt-1 text-xs text-text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
