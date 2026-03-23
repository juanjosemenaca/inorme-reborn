import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { MOCK_MESSAGES } from "@/data/mockBackofficeMessages";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminMessages = () => {
  const { user, isAdmin } = useAdminAuth();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!user) return [];
    const base = isAdmin
      ? MOCK_MESSAGES
      : MOCK_MESSAGES.filter((m) => m.assignedToUserId === user.userId);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.fromEmail.toLowerCase().includes(q)
    );
  }, [user, isAdmin, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdmin ? "Bandeja de mensajes" : "Mis mensajes asignados"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            {isAdmin
              ? "Consulta y gestiona todos los mensajes entrantes. Datos de demostración hasta conectar tu API."
              : "Solo ves los mensajes asignados a tu usuario."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por asunto o email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2" disabled title="Conectar exportación">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        )}
      </div>

      <Card className={isAdmin ? "shadow-sm border-slate-200/80" : ""}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Listado</CardTitle>
            <CardDescription>
              {rows.length} mensaje{rows.length !== 1 ? "s" : ""}
              {query && ` (filtrado)`}
            </CardDescription>
          </div>
          {isAdmin && (
            <Badge variant="secondary" className="font-normal">
              Vista global
            </Badge>
          )}
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={isAdmin ? "hover:bg-transparent" : undefined}>
                <TableHead className="w-[28%]">Asunto</TableHead>
                <TableHead>Remitente</TableHead>
                <TableHead>Fecha</TableHead>
                {isAdmin && <TableHead>Estado</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id} className="group">
                  <TableCell className="font-medium">{m.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{m.fromEmail}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {m.date}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {m.assignedToUserId ? (
                        <Badge variant="outline" className="font-normal">
                          Asignado
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="font-normal bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100"
                        >
                          Sin asignar
                        </Badge>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No hay mensajes que coincidan.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminMessages;
