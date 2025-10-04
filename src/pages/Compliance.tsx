import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";

export default function Compliance() {
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

  const { data: certifications } = useQuery({
    queryKey: ["certifications", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("certifications")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("expiration_date");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const isExpired = (date: string) => new Date(date) < new Date();
  const isExpiringSoon = (date: string) => {
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">Compliance & Certifications</h1>

        <div className="grid gap-4">
          {certifications?.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {cert.cert_name}
                  </div>
                  {isExpired(cert.expiration_date) ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Expired
                    </Badge>
                  ) : isExpiringSoon(cert.expiration_date) ? (
                    <Badge variant="outline" className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Expiring Soon
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1 text-success">
                      <CheckCircle className="h-3 w-3" />
                      Valid
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm"><span className="font-medium">Type:</span> {cert.cert_type}</p>
                <p className="text-sm"><span className="font-medium">Expires:</span> {new Date(cert.expiration_date).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
