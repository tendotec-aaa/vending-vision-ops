import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

export default function MarketingPromotions() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single();
      return data;
    },
  });

  const { data: promotions } = useQuery({
    queryKey: ["marketing_promotions", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_promotions")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const isActive = (start: string, end: string) => {
    const now = new Date();
    return new Date(start) <= now && new Date(end) >= now;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">Marketing & Promotions</h1>

        <div className="grid gap-4">
          {promotions?.map((promo) => (
            <Card key={promo.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {promo.name}
                  </div>
                  {isActive(promo.start_date, promo.end_date) && (
                    <Badge className="bg-success">Active</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{promo.description}</p>
                <p className="text-sm"><span className="font-medium">Period:</span> {new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}</p>
                {promo.discount_amount && <p className="text-sm"><span className="font-medium">Discount:</span> ${promo.discount_amount}</p>}
                {promo.sales_lift && <p className="text-sm"><span className="font-medium">Sales Lift:</span> {promo.sales_lift}%</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
