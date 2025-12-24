import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MobileNav } from '@/components/MobileNav';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Eye,
  CalendarIcon,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisitReport {
  id: string;
  company_id: string;
  employee_id: string | null;
  location_id: string;
  spot_id: string | null;
  setup_id: string | null;
  employee_name_snapshot: string | null;
  location_name_snapshot: string | null;
  spot_name_snapshot: string | null;
  visit_date: string;
  visit_type: string | null;
  visit_summary: string | null;
  total_cash_collected: number | null;
  total_units_sold: number | null;
  total_units_refilled: number | null;
  total_units_removed: number | null;
  total_units_surplus_shortage: number | null;
  total_current_stock: number | null;
  total_toy_capacity: number | null;
  total_issues_reported: number | null;
  image_url: string | null;
  general_notes: string | null;
  observation_text: string | null;
  is_signed: boolean | null;
  created_at: string;
  slot_performance_snapshot: any[] | null;
}

export default function VisitReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [viewingReport, setViewingReport] = useState<VisitReport | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rollbackNotes, setRollbackNotes] = useState('');
  const [logBookEntries, setLogBookEntries] = useState<any[]>([]);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole } = useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .maybeSingle();
      return data?.role;
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRole === 'admin';

  const { data: visitReports, isLoading } = useQuery({
    queryKey: ['visit_reports', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_reports')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      return data as VisitReport[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('locations')
        .select('id, name')
        .eq('company_id', profile?.company_id)
        .order('name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: locationSpots } = useQuery({
    queryKey: ['location_spots', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('location_spots')
        .select('id, location_id, spot_number, place_name')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch log book entries for selected reports
  const fetchLogBookEntries = async (reportIds: string[]) => {
    const { data, error } = await supabase
      .from('submit_report_log_book')
      .select('*')
      .in('visit_report_id', reportIds)
      .eq('is_rolled_back', false);
    
    if (error) {
      console.error('Error fetching log book entries:', error);
      return [];
    }
    return data || [];
  };

  const rollbackMutation = useMutation({
    mutationFn: async ({ logId, notes }: { logId: string; notes: string }) => {
      const { data, error } = await supabase.rpc('rollback_visit_report', {
        p_log_id: logId,
        p_rollback_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit_reports'] });
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['machine_toy_slots'] });
    },
    onError: (error) => {
      toast.error('Failed to rollback report: ' + error.message);
    },
  });

  // Fallback delete for reports without log book entries
  const directDeleteMutation = useMutation({
    mutationFn: async (reportIds: string[]) => {
      // Delete machine_toy_movements
      const { error: movementError } = await supabase
        .from('machine_toy_movements')
        .delete()
        .in('visit_report_id', reportIds);
      if (movementError) throw movementError;

      // Delete visit_report_stock
      const { error: stockError } = await supabase
        .from('visit_report_stock')
        .delete()
        .in('visit_report_id', reportIds);
      if (stockError) throw stockError;

      // Delete from log book (if any exist)
      const { error: logError } = await supabase
        .from('submit_report_log_book')
        .delete()
        .in('visit_report_id', reportIds);
      if (logError) console.warn('Log book cleanup warning:', logError);

      // Delete the reports
      const { error } = await supabase
        .from('visit_reports')
        .delete()
        .in('id', reportIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit_reports'] });
    },
    onError: (error) => {
      toast.error('Failed to delete reports: ' + error.message);
    },
  });

  const filteredReports = useMemo(() => {
    if (!visitReports) return [];
    
    return visitReports.filter(report => {
      // Location filter
      if (locationFilter !== 'all' && report.location_id !== locationFilter) {
        return false;
      }
      
      // Date range filter
      const reportDate = new Date(report.visit_date);
      if (dateFrom && reportDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (reportDate > endOfDay) return false;
      }
      
      // Search filter
      if (search) {
        const location = locations?.find(l => l.id === report.location_id);
        const searchLower = search.toLowerCase();
        return (
          location?.name.toLowerCase().includes(searchLower) ||
          report.observation_text?.toLowerCase().includes(searchLower) ||
          report.visit_type?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [visitReports, locationFilter, dateFrom, dateTo, search, locations]);

  const getLocationName = (locationId: string) => {
    return locations?.find(l => l.id === locationId)?.name || 'Unknown';
  };

  const getSpotName = (spotId: string | null) => {
    if (!spotId) return '-';
    const spot = locationSpots?.find(s => s.id === spotId);
    if (!spot) return '-';
    const location = locations?.find(l => l.id === spot.location_id);
    return `${location?.name || ''} #${spot.spot_number}${spot.place_name ? ` (${spot.place_name})` : ''}`;
  };

  const getEmployeeName = (employeeId: string | null) => {
    if (!employeeId) return '-';
    const employee = employees?.find(e => e.id === employeeId);
    if (!employee) return '-';
    return `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReports(new Set(filteredReports.map(r => r.id)));
    } else {
      setSelectedReports(new Set());
    }
  };

  const handleSelectReport = (reportId: string, checked: boolean) => {
    const newSelected = new Set(selectedReports);
    if (checked) {
      newSelected.add(reportId);
    } else {
      newSelected.delete(reportId);
    }
    setSelectedReports(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedReports.size === 0) return;
    
    // Fetch log book entries for selected reports
    const entries = await fetchLogBookEntries(Array.from(selectedReports));
    setLogBookEntries(entries);
    setRollbackNotes('');
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    const reportIds = Array.from(selectedReports);
    
    // Find which reports have log book entries
    const reportsWithLogs = new Set(logBookEntries.map(e => e.visit_report_id));
    const reportsWithoutLogs = reportIds.filter(id => !reportsWithLogs.has(id));
    
    let successCount = 0;
    let errorCount = 0;

    // Rollback reports with log entries (proper revert)
    for (const entry of logBookEntries) {
      try {
        await rollbackMutation.mutateAsync({ 
          logId: entry.id, 
          notes: rollbackNotes 
        });
        successCount++;
      } catch (err) {
        console.error('Rollback failed for log:', entry.id, err);
        errorCount++;
      }
    }

    // Direct delete for reports without log entries (older reports)
    if (reportsWithoutLogs.length > 0) {
      try {
        await directDeleteMutation.mutateAsync(reportsWithoutLogs);
        successCount += reportsWithoutLogs.length;
      } catch (err) {
        console.error('Direct delete failed:', err);
        errorCount += reportsWithoutLogs.length;
      }
    }

    setSelectedReports(new Set());
    setDeleteConfirmOpen(false);
    setLogBookEntries([]);

    if (errorCount === 0) {
      toast.success(`Successfully rolled back/deleted ${successCount} report(s)`);
    } else {
      toast.warning(`Completed with errors: ${successCount} succeeded, ${errorCount} failed`);
    }
  };

  const exportToCSV = () => {
    if (!filteredReports.length) return;

    const headers = [
      'Date',
      'Location',
      'Spot',
      'Visit Type',
      'Employee',
      'Time In',
      'Cash Recollected',
      'Rent Calculated',
      'Has Issues',
      'Observations',
      'Signed'
    ];

    const rows = filteredReports.map(report => [
      format(new Date(report.visit_date), 'yyyy-MM-dd'),
      report.location_name_snapshot || getLocationName(report.location_id),
      report.spot_name_snapshot || getSpotName(report.spot_id),
      report.visit_type || 'routine',
      report.employee_name_snapshot || getEmployeeName(report.employee_id),
      '-',
      report.total_cash_collected?.toFixed(2) || '0.00',
      '0.00',
      (report.total_issues_reported || 0) > 0 ? 'Yes' : 'No',
      report.observation_text || '-',
      report.is_signed ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `visit_reports_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('CSV exported successfully');
  };

  // Summary stats
  const summary = useMemo(() => {
    return {
      total: filteredReports.length,
      withIssues: filteredReports.filter(r => (r.total_issues_reported || 0) > 0).length,
      totalCash: filteredReports.reduce((sum, r) => sum + (r.total_cash_collected || 0), 0),
      signed: filteredReports.filter(r => r.is_signed).length,
    };
  }, [filteredReports]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Visit Reports</h1>
              <p className="text-sm text-muted-foreground">Field service visit history</p>
            </div>
            <Button onClick={() => navigate('/visit-report/new')}>
              <Plus className="h-4 w-4 mr-1" />
              New Report
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(dateFrom || dateTo || locationFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setLocationFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Total Reports</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="bg-card rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">With Issues</div>
            <div className="text-2xl font-bold text-destructive">{summary.withIssues}</div>
          </div>
          <div className="bg-card rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Total Cash</div>
            <div className="text-2xl font-bold">${summary.totalCash.toFixed(2)}</div>
          </div>
          <div className="bg-card rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Signed</div>
            <div className="text-2xl font-bold">{summary.signed}</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedReports.size > 0 && `${selectedReports.size} selected`}
          </div>
          <div className="flex gap-2">
            {isAdmin && selectedReports.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedReports.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedReports.size === filteredReports.length && filteredReports.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Spot</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No visit reports found
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map(report => (
                  <TableRow key={report.id}>
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedReports.has(report.id)}
                          onCheckedChange={(checked) => handleSelectReport(report.id, !!checked)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {format(new Date(report.visit_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{getLocationName(report.location_id)}</TableCell>
                    <TableCell className="text-sm">{getSpotName(report.spot_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {report.visit_type || 'routine'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getEmployeeName(report.employee_id)}</TableCell>
                    <TableCell>${(report.total_cash_collected || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(report.total_issues_reported || 0) > 0 && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {report.is_signed && (
                          <CheckCircle className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingReport(report)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* View Report Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Visit Report Details
            </DialogTitle>
          </DialogHeader>
          {viewingReport && (
            <div className="space-y-6">
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Date</div>
                  <div className="font-semibold">
                    {format(new Date(viewingReport.visit_date), 'PPP')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Location</div>
                  <div className="font-semibold">{viewingReport.location_name_snapshot || getLocationName(viewingReport.location_id)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Spot</div>
                  <div className="font-semibold">{viewingReport.spot_name_snapshot || getSpotName(viewingReport.spot_id)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Employee</div>
                  <div className="font-semibold">{viewingReport.employee_name_snapshot || getEmployeeName(viewingReport.employee_id)}</div>
                </div>
              </div>

              {/* Visit Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Visit Type</div>
                  <Badge variant="outline" className="capitalize mt-1">{viewingReport.visit_type || 'routine'}</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Units Sold</div>
                  <div className="font-medium mt-1">{viewingReport.total_units_sold || 0}</div>
                </div>
                <div className="p-3 border rounded-lg bg-primary/5">
                  <div className="text-xs text-muted-foreground">Cash Collected</div>
                  <div className="font-bold text-lg text-primary">${(viewingReport.total_cash_collected || 0).toFixed(2)}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Issues Reported</div>
                  <div className="font-medium mt-1">{viewingReport.total_issues_reported || 0}</div>
                </div>
              </div>

              {/* Slot Performance Summary */}
              {viewingReport.slot_performance_snapshot && viewingReport.slot_performance_snapshot.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Slot Performance</div>
                  <div className="space-y-2">
                    {viewingReport.slot_performance_snapshot.map((slot: any, index: number) => {
                      const formatJamType = (jamType: string) => {
                        const formatted = jamType.replace(/_/g, ' ').split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                        return jamType === 'jammed_with_coins' ? `${formatted} +1` : formatted;
                      };
                      
                      const stockPercentage = slot.toy_capacity > 0 
                        ? Math.min(100, Math.round((slot.current_stock / slot.toy_capacity) * 100))
                        : 0;
                      
                      // Calculate surplus/shortage for old toy in replacement
                      const surplusShortage = slot.is_replacing_toy
                        ? (slot.surplus_shortage ?? (slot.removed_for_replacement - (slot.last_stock - slot.units_sold)))
                        : 0;
                      
                      return (
                        <div 
                          key={index} 
                          className={cn(
                            "border rounded-lg overflow-hidden",
                            slot.has_issue && "border-destructive/50 bg-destructive/5"
                          )}
                        >
                          {/* Slot Header */}
                          <div className="flex items-center justify-between p-3 bg-muted/50">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm bg-background px-2 py-0.5 rounded">#{slot.slot_number}</span>
                              {slot.is_replacing_toy ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Replaced
                                </Badge>
                              ) : (
                                <span className="font-medium">{slot.product_name || 'Unknown'}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {slot.jam_type && (
                                <Badge variant="destructive" className="text-xs">
                                  {formatJamType(slot.jam_type)}
                                </Badge>
                              )}
                              {slot.has_issue && (
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Issue
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* If Replacement - Show Both Old and New Toys */}
                          {slot.is_replacing_toy ? (
                            <div className="p-3 space-y-3">
                              {/* Old Toy Section */}
                              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Removed Toy</span>
                                </div>
                                <div className="text-sm font-medium mb-2">{slot.original_product_name || 'Unknown'}</div>
                                <div className="grid grid-cols-5 gap-2 text-xs">
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-muted-foreground">Last Stock</div>
                                    <div className="font-semibold">{slot.last_stock || 0}</div>
                                  </div>
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-muted-foreground">Sold</div>
                                    <div className="font-semibold text-primary">{slot.units_sold || 0}</div>
                                  </div>
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-muted-foreground">Removed</div>
                                    <div className="font-semibold">{slot.removed_for_replacement || 0}</div>
                                  </div>
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-muted-foreground">Surplus/Short</div>
                                    <div className={cn(
                                      "font-semibold",
                                      surplusShortage > 0 ? "text-green-600" : surplusShortage < 0 ? "text-red-600" : ""
                                    )}>
                                      {surplusShortage > 0 ? '+' : ''}{surplusShortage}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-muted-foreground">Current Stock</div>
                                    <div className="font-semibold">0</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* New Toy Section */}
                              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500" />
                                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">New Toy Installed</span>
                                </div>
                                <div className="text-sm font-medium mb-2">{slot.product_name || 'Unknown'}</div>
                                {(() => {
                                  // For replacements, current_stock should equal units_refilled
                                  const newToyCurrentStock = slot.units_refilled || 0;
                                  const newToyCapacity = slot.toy_capacity || 0;
                                  const newStockPercentage = newToyCapacity > 0 
                                    ? Math.min(100, Math.round((newToyCurrentStock / newToyCapacity) * 100))
                                    : 0;
                                  return (
                                    <>
                                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                        <div className="p-2 bg-background rounded">
                                          <div className="text-muted-foreground">Refilled</div>
                                          <div className="font-semibold text-green-600">{slot.units_refilled || 0}</div>
                                        </div>
                                        <div className="p-2 bg-background rounded">
                                          <div className="text-muted-foreground">Current Stock</div>
                                          <div className="font-semibold">{newToyCurrentStock}</div>
                                        </div>
                                        <div className="p-2 bg-background rounded">
                                          <div className="text-muted-foreground">Capacity</div>
                                          <div className="font-semibold">{newToyCapacity}</div>
                                        </div>
                                      </div>
                                      {/* Stock vs Capacity Bar */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                          <span>Stock Level</span>
                                          <span>{newToyCurrentStock} / {newToyCapacity}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className={cn(
                                              "h-full transition-all",
                                              newStockPercentage > 50 ? "bg-green-500" : newStockPercentage > 25 ? "bg-amber-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${newStockPercentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : (
                            /* Regular Slot - No Replacement */
                            <div className="p-3 space-y-2">
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="p-2 bg-muted/30 rounded text-center">
                                  <div className="text-muted-foreground">Last</div>
                                  <div className="font-semibold">{slot.last_stock || 0}</div>
                                </div>
                                <div className="p-2 bg-muted/30 rounded text-center">
                                  <div className="text-muted-foreground">Sold</div>
                                  <div className="font-semibold text-primary">{slot.units_sold || 0}</div>
                                </div>
                                <div className="p-2 bg-muted/30 rounded text-center">
                                  <div className="text-muted-foreground">Refilled</div>
                                  <div className="font-semibold text-green-600">{slot.units_refilled || 0}</div>
                                </div>
                                <div className="p-2 bg-muted/30 rounded text-center">
                                  <div className="text-muted-foreground">Current Stock</div>
                                  <div className="font-semibold">{slot.current_stock || 0}</div>
                                </div>
                              </div>
                              
                              {/* Stock vs Capacity Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Stock Level</span>
                                  <span>{slot.current_stock || 0} / {slot.toy_capacity || 0}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full transition-all",
                                      stockPercentage > 50 ? "bg-green-500" : stockPercentage > 25 ? "bg-amber-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${stockPercentage}%` }}
                                  />
                                </div>
                              </div>
                              
                              {slot.discrepancy !== 0 && slot.discrepancy != null && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    slot.discrepancy > 0 
                                      ? "bg-green-500/10 text-green-700 border-green-500/30" 
                                      : "bg-red-500/10 text-red-700 border-red-500/30"
                                  )}
                                >
                                  Discrepancy: {slot.discrepancy > 0 ? '+' : ''}{slot.discrepancy}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {/* Issue Description if any */}
                          {slot.has_issue && slot.issue_description && (
                            <div className="px-3 pb-3">
                              <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                                <div className="flex items-center gap-2 mb-1">
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                  <span className="text-xs font-semibold text-destructive">Reported Issue</span>
                                  {slot.issue_severity && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-[10px] px-1.5 py-0",
                                        slot.issue_severity === 'high' ? "bg-red-500/20 text-red-700 border-red-500/30" :
                                        slot.issue_severity === 'medium' ? "bg-amber-500/20 text-amber-700 border-amber-500/30" :
                                        "bg-blue-500/20 text-blue-700 border-blue-500/30"
                                      )}
                                    >
                                      {slot.issue_severity}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{slot.issue_description}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Machine Issues */}
              {(viewingReport.total_issues_reported || 0) > 0 && (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    {viewingReport.total_issues_reported} Issue(s) Reported
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div className="space-y-3">
                {viewingReport.observation_text && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Observations</div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">{viewingReport.observation_text}</div>
                  </div>
                )}

                {viewingReport.general_notes && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">General Notes</div>
                    <div className="p-3 bg-muted/30 rounded-lg text-sm">{viewingReport.general_notes}</div>
                  </div>
                )}
              </div>

              {/* Photo */}
              {viewingReport.image_url && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Photo</div>
                  <img 
                    src={viewingReport.image_url} 
                    alt="Visit photo" 
                    className="rounded-lg max-w-full h-auto border"
                  />
                </div>
              )}

              {/* Signature Status */}
              <div className="flex items-center gap-2 pt-4 border-t">
                {viewingReport.is_signed ? (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Signed & Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Signed</Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rollback/Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Rollback Visit Reports
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to rollback {selectedReports.size} report(s). This will:
                </p>
                
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Revert machine slot stock levels to previous values</li>
                  <li>Restore location & spot statistics</li>
                  <li>Delete all related movements and stock records</li>
                  <li>Remove the visit report(s)</li>
                </ul>

                {logBookEntries.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-foreground">Log Book Entries</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {logBookEntries.map((entry) => {
                        const report = visitReports?.find(r => r.id === entry.visit_report_id);
                        return (
                          <div key={entry.id} className="text-xs p-2 bg-background rounded border">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="font-medium">{report?.location_name_snapshot || 'Unknown Location'}</span>
                                {report?.spot_name_snapshot && (
                                  <span className="text-muted-foreground"> • {report.spot_name_snapshot}</span>
                                )}
                              </div>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {format(new Date(entry.submitted_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="text-muted-foreground mt-1">
                              {entry.created_machine_toy_movement_ids?.length || 0} movements • 
                              {entry.created_visit_report_stock_ids?.length || 0} stock records
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {logBookEntries.length === 0 && selectedReports.size > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>No log book entries found. Direct delete will be used (stats won't be reverted).</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Rollback Notes (optional)</label>
                  <textarea
                    value={rollbackNotes}
                    onChange={(e) => setRollbackNotes(e.target.value)}
                    placeholder="Reason for rollback..."
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rollbackMutation.isPending || directDeleteMutation.isPending}
            >
              {(rollbackMutation.isPending || directDeleteMutation.isPending) ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Rollback & Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}