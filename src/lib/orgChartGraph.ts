import type { Edge, Node } from "@xyflow/react";
import type { OrgChartEmployee } from "@/types/orgChart";
import { getLayoutedElements, ORG_NODE_HEIGHT, ORG_NODE_WIDTH } from "@/lib/orgChartLayout";

const TEAM_PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#0ea5e9", "#22c55e", "#eab308"];

export function teamEdgeColor(team: string): string {
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) >>> 0;
  return TEAM_PALETTE[h % TEAM_PALETTE.length];
}

/** Color de acento por rol (primera letra / hash estable). */
export function roleAccentBorderClass(primaryRole: string): string {
  const classes = [
    "border-indigo-400/90",
    "border-violet-400/90",
    "border-sky-400/90",
    "border-emerald-400/90",
    "border-amber-400/90",
    "border-rose-400/90",
    "border-cyan-400/90",
    "border-fuchsia-400/90",
  ];
  let h = 0;
  for (let i = 0; i < primaryRole.length; i++) h = (h * 17 + primaryRole.charCodeAt(i)) >>> 0;
  return classes[h % classes.length];
}

function managerEdgeIsAcyclic(
  managerId: string,
  employeeId: string,
  byId: Map<string, OrgChartEmployee>
): boolean {
  const seen = new Set<string>();
  let cur: string | null = managerId;
  while (cur) {
    if (cur === employeeId) return false;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = byId.get(cur)?.managerId ?? null;
  }
  return true;
}

function buildHierarchicalEdges(employees: OrgChartEmployee[]): Edge[] {
  const byId = new Map(employees.map((e) => [e.id, e] as const));
  const idSet = new Set(employees.map((e) => e.id));
  const edges: Edge[] = [];
  for (const e of employees) {
    const m = e.managerId;
    if (!m || !idSet.has(m)) continue;
    if (!managerEdgeIsAcyclic(m, e.id, byId)) continue;
    edges.push({
      id: `mgr-${m}-${e.id}`,
      source: m,
      target: e.id,
      type: "smoothstep",
      style: { strokeWidth: 2 },
    });
  }
  return edges;
}

/** Estrella por equipo: un hub (id mínimo) conecta al resto. */
function buildTeamEdges(employees: OrgChartEmployee[]): Edge[] {
  const teamToMembers = new Map<string, string[]>();
  for (const e of employees) {
    for (const team of e.teams) {
      const t = team.trim();
      if (!t) continue;
      if (!teamToMembers.has(t)) teamToMembers.set(t, []);
      teamToMembers.get(t)!.push(e.id);
    }
  }

  const edges: Edge[] = [];
  for (const [team, members] of teamToMembers) {
    if (members.length < 2) continue;
    const sorted = [...new Set(members)].sort();
    const hub = sorted[0]!;
    const color = teamEdgeColor(team);
    for (let i = 1; i < sorted.length; i++) {
      const m = sorted[i]!;
      edges.push({
        id: `team-${team}-${hub}-${m}`,
        source: hub,
        target: m,
        type: "smoothstep",
        style: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: "6 5",
        },
        data: { team },
      });
    }
  }
  return edges;
}

export function buildOrgChartElements(
  employees: OrgChartEmployee[],
  direction: "TB" | "LR"
): { nodes: Node[]; edges: Edge[] } {
  const hierarchical = buildHierarchicalEdges(employees);
  const teamEdges = buildTeamEdges(employees);

  const nodes: Node[] = employees.map((e) => ({
    id: e.id,
    type: "employee",
    position: { x: 0, y: 0 },
    data: {
      employee: e,
      roleAccentClass: roleAccentBorderClass(e.roles[0] ?? "—"),
      direction,
    },
  }));

  const { nodes: layoutedNodes, edges: layoutHierarchy } = getLayoutedElements(
    nodes,
    hierarchical,
    direction
  );

  return {
    nodes: layoutedNodes,
    edges: [...layoutHierarchy, ...teamEdges],
  };
}

export { ORG_NODE_WIDTH, ORG_NODE_HEIGHT };
