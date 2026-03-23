import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ColumnSort } from "@/lib/adminListUtils";

type Props = {
  label: string;
  columnKey: string;
  currentSort: ColumnSort | null;
  onSort: (key: string) => void;
  className?: string;
};

export function SortableTableHead({ label, columnKey, currentSort, onSort, className }: Props) {
  const active = currentSort?.key === columnKey;
  const dir = active ? currentSort.dir : null;

  return (
    <TableHead className={cn(className)}>
      <Button
        type="button"
        variant="ghost"
        className="-ml-3 h-8 px-3 font-medium hover:bg-muted/60"
        onClick={() => onSort(columnKey)}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="ml-1 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="ml-1 h-4 w-4 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-4 w-4 shrink-0 opacity-40" aria-hidden />
        )}
      </Button>
    </TableHead>
  );
}
