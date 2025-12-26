import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wrench, CheckCircle, Clock, AlertCircle, DollarSign, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function MaintenanceLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [resolutionData, setResolutionData] = useState({
    cost: "",
    notes: "",
  });
  const [formData, setFormData] = useState({
    location_id: "",
    spot_id: "",
    issue_type: "",
    description: "",
    status: "pending",
  });

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

  const { data: locations } = useQuery({
    queryKey: ["locations", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("company_id", profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: spots } = useQuery({
    queryKey: ["location_spots", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("location_spots")
        .select("*")
        .eq("company_id", profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: workOrders } = useQuery({
    queryKey: ["work_orders", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const locationsMap = locations?.reduce((acc, loc) => ({ 
    ...acc, 
    [loc.id]: loc.name 
  }), {} as Record<string, string>) || {};

  const spotsMap = spots?.reduce((acc, spot) => ({ 
    ...acc, 
    [spot.id]: `#${spot.spot_number}${spot.place_name ? ` - ${spot.place_name}` : ''}` 
  }), {} as Record<string, string>) || {};

  const filteredSpots = spots?.filter(s => s.location_id === formData.location_id) || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("work_orders").insert({
        location_id: data.location_id,
        spot_id: data.spot_id || null,
        issue_type: data.issue_type,
        description: data.description,
        status: data.status,
        company_id: profile?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["location_spots"] });
      toast({ title: "Work order created successfully" });
      setIsOpen(false);
      setFormData({ location_id: "", spot_id: "", issue_type: "", description: "", status: "pending" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, cost, notes }: { orderId: string; status: string; cost?: number; notes?: string }) => {
      const updateData: Record<string, unknown> = { 
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'completed') {
        updateData.resolved_at = new Date().toISOString();
        if (cost) updateData.cost = cost;
        if (notes) updateData.description = notes;
      }
      
      const { error } = await supabase
        .from("work_orders")
        .update(updateData)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["location_spots"] });
      toast({ title: "Work order updated successfully" });
      setSelectedOrder(null);
      setResolutionData({ cost: "", notes: "" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "in_progress":
        return "secondary" as const;
      default:
        return "destructive" as const;
    }
  };

  const pendingOrders = workOrders?.filter(o => o.status === 'pending') || [];
  const inProgressOrders = workOrders?.filter(o => o.status === 'in_progress') || [];
  const completedOrders = workOrders?.filter(o => o.status === 'completed') || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Maintenance Log</h1>
            <p className="text-muted-foreground text-sm">
              {pendingOrders.length} pending, {inProgressOrders.length} in progress
            </p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Work Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Work Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Location</Label>
                  <Select 
                    value={formData.location_id} 
                    onValueChange={(value) => setFormData({ ...formData, location_id: value, spot_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.location_id && filteredSpots.length > 0 && (
                  <div>
                    <Label>Spot (Optional)</Label>
                    <Select 
                      value={formData.spot_id} 
                      onValueChange={(value) => setFormData({ ...formData, spot_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select spot" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSpots.map((spot) => (
                          <SelectItem key={spot.id} value={spot.id}>
                            #{spot.spot_number} {spot.place_name ? `- ${spot.place_name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="issue_type">Issue Type</Label>
                  <Input
                    id="issue_type"
                    value={formData.issue_type}
                    onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                    placeholder="e.g., Machine jam, Coin mechanism"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the issue..."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.location_id || !formData.issue_type}
                >
                  Create Work Order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{pendingOrders.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{inProgressOrders.length}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{completedOrders.length}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Work Orders List */}
        <div className="grid gap-4">
          {workOrders?.map((order) => (
            <Card key={order.id} className={order.status === 'pending' ? 'border-red-300' : order.status === 'in_progress' ? 'border-yellow-300' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <span>{order.issue_type}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(order.status || 'pending')} className="flex items-center gap-1">
                    {getStatusIcon(order.status || 'pending')}
                    {order.status || 'pending'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {locationsMap[order.location_id]}
                  </span>
                  {order.spot_id && spotsMap[order.spot_id] && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      • Spot {spotsMap[order.spot_id]}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {order.description && (
                  <p className="text-sm text-muted-foreground">{order.description}</p>
                )}
                
                {order.cost && (
                  <p className="text-sm flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span className="font-medium">Cost:</span> ${order.cost}
                  </p>
                )}
                
                {order.resolved_at && (
                  <p className="text-sm text-green-600">
                    Resolved: {format(new Date(order.resolved_at), 'MMM d, yyyy')}
                  </p>
                )}

                {/* Action Buttons */}
                {order.status !== 'completed' && (
                  <div className="flex gap-2 pt-2 border-t">
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'in_progress' })}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Start Working
                      </Button>
                    )}
                    <Dialog open={selectedOrder === order.id} onOpenChange={(open) => setSelectedOrder(open ? order.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Mark Resolved
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve Work Order</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="cost">Repair Cost (Optional)</Label>
                            <Input
                              id="cost"
                              type="number"
                              step="0.01"
                              value={resolutionData.cost}
                              onChange={(e) => setResolutionData({ ...resolutionData, cost: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="notes">Resolution Notes (Optional)</Label>
                            <Textarea
                              id="notes"
                              value={resolutionData.notes}
                              onChange={(e) => setResolutionData({ ...resolutionData, notes: e.target.value })}
                              placeholder="What was done to fix the issue..."
                            />
                          </div>
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => updateStatusMutation.mutate({
                              orderId: order.id,
                              status: 'completed',
                              cost: resolutionData.cost ? parseFloat(resolutionData.cost) : undefined,
                              notes: resolutionData.notes || undefined,
                            })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Resolution
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {(!workOrders || workOrders.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No work orders yet</p>
                <p className="text-sm">Create a new work order when maintenance is needed</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
