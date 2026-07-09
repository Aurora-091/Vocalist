import { Button } from "./button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalEntries?: number;
  entryLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  totalEntries,
  entryLabel = "entries",
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between px-4 py-3 border-t border-border", className)}>
      <span className="text-xs text-muted-foreground font-medium">
        {totalEntries !== undefined ? `${totalEntries} ${entryLabel}` : ""}
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
