import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Loader2, BarChart3, Users, Heart, Gift, Ticket, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const chartConfig: ChartConfig = {
  logins: { label: "Logins", color: "hsl(var(--primary))" },
  doacoes: { label: "Doações", color: "hsl(var(--chart-2, 142 71% 45%))" },
  trocas: { label: "Trocas", color: "hsl(var(--chart-3, 47 100% 68%))" },
};

const AdminAnalytics = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
    queryFn: async () => {
      const now = new Date();
      const days7 = subDays(now, 7).toISOString();

      const [
        { count: totalUsers },
        { data: activeProfiles },
        { data: doacoes7d },
        { data: resgates7d },
        { data: allProfiles },
        { count: totalDoacoes },
        { count: totalResgates },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id").gte("updated_at", days7),
        supabase.from("doacoes_premios").select("created_at, likes_recebidos").gte("created_at", days7),
        supabase.from("resgates").select("created_at, likes_gastos, likes_transferidos").gte("created_at", days7),
        supabase.from("profiles").select("total_likes"),
        supabase.from("doacoes_premios").select("*", { count: "exact", head: true }),
        supabase.from("resgates").select("*", { count: "exact", head: true }),
      ]);

      const likesTransferidos = (resgates7d || [])
        .filter((r: any) => r.likes_transferidos)
        .reduce((s: number, r: any) => s + (r.likes_gastos || 0), 0);

      // Build 7-day chart data
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const dayStr = format(day, "yyyy-MM-dd");
        const label = format(day, "dd/MM", { locale: ptBR });

        const doacoesDia = (doacoes7d || []).filter(
          (d: any) => d.created_at?.startsWith(dayStr)
        ).length;
        const trocasDia = (resgates7d || []).filter(
          (r: any) => r.created_at?.startsWith(dayStr)
        ).length;
        const loginsDia = (activeProfiles || []).length > 0
          ? Math.round((activeProfiles || []).length / 7)
          : 0;

        chartData.push({ day: label, logins: loginsDia, doacoes: doacoesDia, trocas: trocasDia });
      }

      return {
        totalUsers: totalUsers || 0,
        activeUsers: (activeProfiles || []).length,
        totalDoacoes: totalDoacoes || 0,
        totalResgates: totalResgates || 0,
        likesTransferidos,
        chartData,
      };
    },
  });

  if (adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const stats = data || { totalUsers: 0, activeUsers: 0, totalDoacoes: 0, totalResgates: 0, likesTransferidos: 0, chartData: [] };

  const cards = [
    { label: "Usuários Total", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Ativos (7d)", value: stats.activeUsers, icon: TrendingUp, color: "text-green-500" },
    { label: "Doações Criadas", value: stats.totalDoacoes, icon: Gift, color: "text-yellow-500" },
    { label: "Trocas Realizadas", value: stats.totalResgates, icon: Ticket, color: "text-blue-500" },
    { label: "Likes Transferidos", value: stats.likesTransferidos, icon: Heart, color: "text-red-500" },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 pt-4 space-y-6">
        <h1 className="font-cinzel font-bold text-2xl text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Analytics
        </h1>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {cards.map((c) => (
                <Card key={c.label} className="p-3 text-center">
                  <c.icon className={`w-5 h-5 mx-auto mb-1 ${c.color}`} />
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value.toLocaleString()}</p>
                </Card>
              ))}
            </div>

            <Card className="p-4">
              <h2 className="font-semibold text-foreground mb-3">Últimos 7 dias</h2>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="doacoes" fill="var(--color-doacoes)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="trocas" fill="var(--color-trocas)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
