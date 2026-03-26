import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

export const ORG_NODE_WIDTH = 240;
export const ORG_NODE_HEIGHT = 112;

/**
 * Layout Dagre solo con aristas jerárquicas; el resto se añade después sin afectar posiciones.
 */
export function getLayoutedElements(
  nodes: Node[],
  hierarchicalEdges: Edge[],
  direction: "TB" | "LR"
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: 72,
    nodesep: 52,
    edgesep: 28,
    marginx: 32,
    marginy: 32,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: ORG_NODE_WIDTH, height: ORG_NODE_HEIGHT });
  });

  hierarchicalEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) {
      return { ...node, position: { x: 0, y: 0 } };
    }
    return {
      ...node,
      position: {
        x: pos.x - ORG_NODE_WIDTH / 2,
        y: pos.y - ORG_NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: hierarchicalEdges };
}
