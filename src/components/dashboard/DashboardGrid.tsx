import { useState } from "react";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import type { DashboardWidget } from "@/types/dashboard";

type Props = {
  widgets: DashboardWidget[];
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onWiden: (id: string) => void;
  onSwap: (a: string, b: string) => void;
};

export function DashboardGrid({ widgets, onDelete, onMoveUp, onWiden, onSwap }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const sorted = [...widgets].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      {sorted.map((w) => (
        <div
          key={w.id}
          className="col-span-1 min-w-0 md:[grid-column:var(--gc)]"
          style={{ ["--gc" as string]: `span ${Math.min(12, Math.max(1, w.width))} / span ${Math.min(12, Math.max(1, w.width))}` }}
          draggable
          onDragStart={() => setDragId(w.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragId && dragId !== w.id) onSwap(dragId, w.id);
            setDragId(null);
          }}
        >
          <DashboardWidgetCard widget={w} onDelete={onDelete} onMoveUp={onMoveUp} onWiden={onWiden} />
        </div>
      ))}
    </div>
  );
}
