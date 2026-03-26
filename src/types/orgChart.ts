/**
 * Nodo de organigrama (empleado) para React Flow + Dagre.
 */
export interface OrgChartEmployee {
  id: string;
  name: string;
  managerId: string | null;
  roles: string[];
  teams: string[];
}
