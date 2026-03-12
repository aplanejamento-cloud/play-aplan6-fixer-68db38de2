import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, XCircle, BarChart3, Ticket, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const exportCSV = (data: any[]) => {
  const headers = ["Usuário", "Prêmio", "Ticket", "Likes", "Status", "Data"];
  const rows = data.map((r: any) => [
    r.usuario_nome || "",
    r.premios?.titulo || "",
    r.codigo_ticket || "",
    r.likes_gastos || 0,
    r.likes_transferidos ? "Retirada confirmada" : r.status || "",
    r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resgates_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado!");
};

const AdminResgates = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const { data: resgates = [], isLoading } = useQuery({
    queryKey: ["admin-resgates"],
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resgates")
        .select("*, premios(titulo, midia_url, likes_custo)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profile names for all usuario_ids
      const userIds = [...new Set((data || []).map((r: any) => r.usuario_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.name]));

      return (data || []).map((r: any) => ({
        ...r,
        usuario_nome: profileMap.get(r.usuario_id) || "Desconhecido",
      }));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (resgate: any) => {
      // Refund likes to user
      if (resgate.likes_gastos && !resgate.likes_transferidos) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_likes")
          .eq("user_id", resgate.usuario_id)
          .single();
        if (profile) {
          await supabase.from("profiles")
            .update({ total_likes: profile.total_likes! + resgate.likes_gastos })
            .eq("user_id", resgate.usuario_id);
        }
        // Restore stock
        if (resgate.premio_id) {
          const { data: premio } = await supabase.from("premios").select("estoque").eq("id", resgate.premio_id).single();
          if (premio) {
            await supabase.from("premios").update({ estoque: premio.estoque! + 1 }).eq("id", resgate.premio_id);
          }
        }
      }
      await supabase.from("resgates").delete().eq("id", resgate.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-resgates"] });
      qc.invalidateQueries({ queryKey: ["premios"] });
      toast.success("Resgate cancelado e likes estornados");
    },
    onError: () => toast.error("Erro ao cancelar resgate"),
  });

  const filtered = useMemo(() => {
    let list = resgates;
    if (statusFilter !== "todos") list = list.filter((r: any) => r.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r: any) =>
        r.usuario_nome?.toLowerCase().includes(s) ||
        r.codigo_ticket?.toLowerCase().includes(s) ||
        r.premios?.titulo?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [resgates, statusFilter, search]);

  // Analytics
  const analytics = useMemo(() => {
    const total = resgates.length;
    const pendentes = resgates.filter((r: any) => r.status === "pendente").length;
    const entregues = resgates.filter((r: any) => r.likes_transferidos).length;
    const totalLikes = resgates
      .filter((r: any) => r.likes_transferidos)
      .reduce((sum: number, r: any) => sum + (r.likes_gastos || 0), 0);
    return { total, pendentes, entregues, totalLikes };
  }, [resgates]);

  if (adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 pt-4 space-y-6">
        <h1 className="font-cinzel font-bold text-2xl text-foreground flex items-center gap-2">
          <Ticket className="w-6 h-6 text-primary" /> Resgates
        </h1>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: analytics.total, color: "text-foreground" },
            { label: "Pendentes", value: analytics.pendentes, color: "text-yellow-500" },
            { label: "Entregues", value: analytics.entregues, color: "text-green-500" },
            { label: "Likes transferidos", value: analytics.totalLikes, color: "text-primary" },
          ].map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, ticket, prêmio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="Aprovado e entregue">Entregue</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum resgate encontrado</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Prêmio</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Likes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.usuario_nome}</TableCell>
                    <TableCell className="text-sm">{r.premios?.titulo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo_ticket || "—"}</TableCell>
                    <TableCell className="text-sm">{r.likes_gastos || 0}</TableCell>
                    <TableCell>
                      {r.likes_transferidos ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">Retirada confirmada ✓</Badge>
                      ) : r.status === "pendente" ? (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs">Pendente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{r.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_at ? format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      {!r.likes_transferidos && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Cancelar resgate de ${r.usuario_nome}?`)) cancelMutation.mutate(r);
                          }}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminResgates;
