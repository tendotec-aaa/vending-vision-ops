import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, ClipboardList, TrendingUp, AlertCircle } from 'lucide-react';
import { MobileNav } from '@/components/MobileNav';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalLocations: 0,
    activeLocations: 0,
    recentReports: 0,
    pendingIssues: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      // Get user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Fetch locations count
      const { count: totalLocations } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id);

      const { count: activeLocations } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      // Fetch recent reports count (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentReports } = await supabase
        .from('visit_reports')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .gte('visit_date', sevenDaysAgo.toISOString());

      // Fetch jammed machines count
      const { count: pendingIssues } = await supabase
        .from('visit_reports')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_jammed', true)
        .order('visit_date', { ascending: false })
        .limit(50);

      setStats({
        totalLocations: totalLocations || 0,
        activeLocations: activeLocations || 0,
        recentReports: recentReports || 0,
        pendingIssues: pendingIssues || 0,
      });
    };

    fetchStats();
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-6 shadow-md">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Vending ERP</h1>
          </div>
          <p className="text-primary-foreground/90">
            Welcome back! {isAdmin && <Badge variant="secondary" className="ml-2">Admin</Badge>}
          </p>
        </div>
      </header>

      {/* Stats Cards */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/locations">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Total Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{stats.totalLocations}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeLocations} active
                </p>
              </CardContent>
            </Card>
          </a>

          <a href="/visit-report">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Recent Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-secondary">{stats.recentReports}</p>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardContent>
            </Card>
          </a>

          <a href="/routes">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-success">Good</p>
                <p className="text-xs text-muted-foreground mt-1">Overall status</p>
              </CardContent>
            </Card>
          </a>

          <a href="/maintenance-log">
            <Card className={`cursor-pointer hover:shadow-lg transition-shadow ${stats.pendingIssues > 0 ? 'border-warning' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{stats.pendingIssues}</p>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start" asChild>
              <a href="/visit-report">
                <ClipboardList className="mr-2 h-4 w-4" />
                Submit Visit Report
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="/locations">
                <MapPin className="mr-2 h-4 w-4" />
                View Locations
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>

      <MobileNav />
    </div>
  );
}
