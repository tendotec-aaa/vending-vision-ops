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
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisitReport {
  id: string;
  visit_date: string;
  location_id: string;
  spot_id: string | null;
  visit_type: string | null;
  is_jammed: boolean | null;
  has_observation: boolean | null;
  observation_text: string | null;
  jam_status: string | null;
  photo_url: string | null;
  total_cash_removed: number | null;
  is_signed: boolean | null;
  time_in: string | null;
  time_out: string | null;
  access_notes: string | null;
  general_notes: string | null;
  employee_id: string | null;
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

  const deleteMutation = useMutation({
    mutationFn: async (reportIds: string[]) => {
      // First delete associated stock records
      const { error: stockError } = await supabase
        .from('visit_report_stock')
        .delete()
        .in('visit_report_id', reportIds);
      if (stockError) throw stockError;

      // Then delete the reports
      const { error } = await supabase
        .from('visit_reports')
        .delete()
        .in('id', reportIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit_reports'] });
      setSelectedReports(new Set());
      setDeleteConfirmOpen(false);
      toast.success('Reports deleted successfully');
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

  const handleBulkDelete = () => {
    if (selectedReports.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(Array.from(selectedReports));
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
      'Time Out',
      'Cash Removed',
      'Has Issues',
      'Observations',
      'Signed'
    ];

    const rows = filteredReports.map(report => [
      format(new Date(report.visit_date), 'yyyy-MM-dd'),
      getLocationName(report.location_id),
      getSpotName(report.spot_id),
      report.visit_type || 'routine',
      getEmployeeName(report.employee_id),
      report.time_in ? format(new Date(report.time_in), 'HH:mm') : '-',
      report.time_out ? format(new Date(report.time_out), 'HH:mm') : '-',
      report.total_cash_removed?.toFixed(2) || '0.00',
      report.is_jammed ? 'Yes' : 'No',
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
      withIssues: filteredReports.filter(r => r.is_jammed).length,
      totalCash: filteredReports.reduce((sum, r) => sum + (r.total_cash_removed || 0), 0),
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
                    <TableCell>${(report.total_cash_removed || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {report.is_jammed && (
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visit Report Details</DialogTitle>
          </DialogHeader>
          {viewingReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div className="font-medium">{format(new Date(viewingReport.visit_date), 'PPP')}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Location</div>
                  <div className="font-medium">{getLocationName(viewingReport.location_id)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Spot</div>
                  <div className="font-medium">{getSpotName(viewingReport.spot_id)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Visit Type</div>
                  <div className="font-medium capitalize">{viewingReport.visit_type || 'routine'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time In</div>
                  <div className="font-medium">
                    {viewingReport.time_in ? format(new Date(viewingReport.time_in), 'HH:mm') : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time Out</div>
                  <div className="font-medium">
                    {viewingReport.time_out ? format(new Date(viewingReport.time_out), 'HH:mm') : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Cash Removed</div>
                  <div className="font-medium">${(viewingReport.total_cash_removed || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Employee</div>
                  <div className="font-medium">{getEmployeeName(viewingReport.employee_id)}</div>
                </div>
              </div>

              {viewingReport.is_jammed && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Machine Issue Reported
                  </div>
                  {viewingReport.jam_status && (
                    <div className="text-sm mt-1">{viewingReport.jam_status}</div>
                  )}
                </div>
              )}

              {viewingReport.observation_text && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Observations</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">{viewingReport.observation_text}</div>
                </div>
              )}

              {viewingReport.access_notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Access Notes</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">{viewingReport.access_notes}</div>
                </div>
              )}

              {viewingReport.general_notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">General Notes</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">{viewingReport.general_notes}</div>
                </div>
              )}

              {viewingReport.photo_url && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Photo</div>
                  <img 
                    src={viewingReport.photo_url} 
                    alt="Visit photo" 
                    className="rounded-lg max-w-full h-auto"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t">
                {viewingReport.is_signed ? (
                  <Badge variant="default" className="bg-success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Signed
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Signed</Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visit Reports?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedReports.size} report(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}