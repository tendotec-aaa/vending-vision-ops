import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Star } from "lucide-react";

export default function CustomerFeedback() {
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

  const { data: feedback } = useQuery({
    queryKey: ["customer_feedback", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_feedback")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("feedback_date", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">Customer Feedback</h1>

        <div className="grid gap-4">
          {feedback?.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Feedback - {new Date(item.feedback_date).toLocaleDateString()}
                  </div>
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-warning text-warning" />
                      <span className="text-sm font-medium">{item.rating}/5</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.feedback_text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
