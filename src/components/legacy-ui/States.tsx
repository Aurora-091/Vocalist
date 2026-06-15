import { ReactNode } from "react";
import { Inbox, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";

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
    <Empty className="bg-card border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {cta && <EmptyContent>{cta}</EmptyContent>}
    </Empty>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <UiSkeleton className={cn(className)} />;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
