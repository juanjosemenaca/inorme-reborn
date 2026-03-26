import { useCallback, useEffect, useMemo, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildOrgChartElements } from "@/lib/orgChartGraph";
import type { OrgChartEmployee } from "@/types/orgChart";
import { EmployeeNode } from "./EmployeeNode";

const nodeTypes = { employee: EmployeeNode };

type Props = {
  employees: OrgChartEmployee[];
  direction: "TB" | "LR";
  onDirectionChange: (d: "TB" | "LR") => void;
  onEmployeeClick?: (emp: OrgChartEmployee) => void;
};

function FitViewSync({ token }: { token: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200 });
    });
    return () => cancelAnimationFrame(id);
  }, [token, fitView]);
  return null;
}

function OrgChartFlowInner({
  employees,
  direction,
  onDirectionChange,
  onEmployeeClick,
}: Props) {
  const { t } = useLanguage();
  const built = useMemo(
    () => buildOrgChartElements(employees, direction),
    [employees, direction]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  const fitViewToken = useMemo(
    () =>
      `${direction}|${employees
        .map((e) => `${e.id}:${e.managerId ?? ""}:${e.roles.join(",")}:${e.teams.join(".")}`)
        .join(";")}`,
    [direction, employees]
  );

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      const emp = (node.data as { employee?: OrgChartEmployee }).employee;
      if (emp && onEmployeeClick) onEmployeeClick(emp);
    },
    [onEmployeeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      minZoom={0.15}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      className="bg-muted/30"
    >
      <FitViewSync token={fitViewToken} />
      <Background gap={20} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeStrokeWidth={3}
        zoomable
        pannable
        className="!bg-background/90 border border-border rounded-md"
      />
      <Panel position="top-right" className="flex gap-2 m-2">
        <Button
          type="button"
          size="sm"
          variant={direction === "TB" ? "default" : "outline"}
          onClick={() => onDirectionChange("TB")}
        >
          {t("admin.orgChart.direction_tb")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={direction === "LR" ? "default" : "outline"}
          onClick={() => onDirectionChange("LR")}
        >
          {t("admin.orgChart.direction_lr")}
        </Button>
      </Panel>
    </ReactFlow>
  );
}

export function OrgChartFlow(props: Props) {
  return (
    <div className="h-full w-full min-h-[420px]">
      <ReactFlowProvider>
        <OrgChartFlowInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
