import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card as UiCard, CardContent } from "@/components/ui/card";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // gap-0/py-0 hand padding back to the header/body sub-components (legacy contract);
    // overflow-visible so popovers/menus rendered inside a card are not clipped.
    <UiCard className={cn("gap-0 overflow-visible py-0 shadow-card", className)}>
      {children}
    </UiCard>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b px-6 py-4", className)}>{children}</div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardContent className={cn("px-6 py-5", className)}>{children}</CardContent>;
}
