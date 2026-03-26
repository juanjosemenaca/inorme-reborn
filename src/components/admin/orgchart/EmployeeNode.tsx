import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgChartEmployee } from "@/types/orgChart";

export type EmployeeNodeData = {
  employee: OrgChartEmployee;
  roleAccentClass: string;
  direction: "TB" | "LR";
};

export type EmployeeFlowNode = Node<EmployeeNodeData, "employee">;

function EmployeeNodeInner({ data, selected }: NodeProps<EmployeeFlowNode>) {
  const { employee, roleAccentClass, direction } = data;
  const targetPos = direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = direction === "LR" ? Position.Right : Position.Bottom;

  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-card px-3 py-2.5 shadow-sm w-[min(260px,22vw)] min-w-[200px]",
        roleAccentClass,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={targetPos} className="!bg-muted-foreground/80 !border-background" />
      <p className="font-semibold text-sm leading-snug text-foreground">{employee.name}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {employee.roles.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">—</span>
        ) : (
          employee.roles.map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {r}
            </Badge>
          ))
        )}
      </div>
      <Handle type="source" position={sourcePos} className="!bg-muted-foreground/80 !border-background" />
    </div>
  );
}

export const EmployeeNode = memo(EmployeeNodeInner);
