import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileNav } from '@/components/MobileNav';
import { SpotCard } from '@/components/SpotCard';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  MapPin, 
  Search, 
  DollarSign, 
  ChevronDown,
  Hash,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Phone
} from 'lucide-react';

export default function Locations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    rent_amount: '',
    number_of_spots: '1',
    start_date: '',
  });

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

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
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
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('spot_number');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: setups } = useQuery({
    queryKey: ['setups', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('setups')
        .select('*')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: setupMachines } = useQuery({
    queryKey: ['setup_machines', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('setup_machines')
        .select('*, machines(*)')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: machineSlots } = useQuery({
    queryKey: ['machine_slots', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('machine_toy_slots')
        .select('*')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: products } = useQuery({
    queryKey: ['products_toys', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, product_name')
        .eq('company_id', profile?.company_id)
        .eq('product_type', 'Toys')
        .order('product_name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const addLocationMutation = useMutation({
    mutationFn: async (locationData: typeof newLocation) => {
      // First create the location
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          company_id: profile?.company_id!,
          name: locationData.name,
          address: locationData.address || null,
          contact_name: locationData.contact_name || null,
          contact_phone: locationData.contact_phone || null,
          rent_amount: locationData.rent_amount ? parseFloat(locationData.rent_amount) : null,
          start_date: locationData.start_date || null,
        })
        .select()
        .single();
      
      if (locationError) throw locationError;

      // Then create the spots
      const numberOfSpots = parseInt(locationData.number_of_spots) || 1;
      const spotsToCreate = Array.from({ length: numberOfSpots }, (_, i) => ({
        location_id: location.id,
        company_id: profile?.company_id!,
        spot_number: i + 1,
        place_name: null,
        setup_id: null,
        spot_start_date: locationData.start_date || null,
      }));

      const { error: spotsError } = await supabase
        .from('location_spots')
        .insert(spotsToCreate);

      if (spotsError) throw spotsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      setIsAddDialogOpen(false);
      setNewLocation({ name: '', address: '', contact_name: '', contact_phone: '', rent_amount: '', number_of_spots: '1', start_date: '' });
      toast.success('Location added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add location: ' + error.message);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (locationData: any) => {
      const { error } = await supabase
        .from('locations')
        .update({
          name: locationData.name,
          address: locationData.address || null,
          contact_name: locationData.contact_name || null,
          contact_phone: locationData.contact_phone || null,
          rent_amount: locationData.rent_amount ? parseFloat(locationData.rent_amount) : null,
          start_date: locationData.start_date || null,
        })
        .eq('id', locationData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setEditingLocation(null);
      toast.success('Location updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update location: ' + error.message);
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      // First delete associated spots
      const { error: spotsError } = await supabase
        .from('location_spots')
        .delete()
        .eq('location_id', locationId);
      
      if (spotsError) throw spotsError;

      // Then delete the location
      const { error: locationError } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);
      
      if (locationError) throw locationError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      setDeleteLocationId(null);
      toast.success('Location deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete location: ' + error.message);
    },
  });

  const handleAddLocation = () => {
    if (!newLocation.name.trim()) {
      toast.error('Location name is required');
      return;
    }
    const spots = parseInt(newLocation.number_of_spots);
    if (isNaN(spots) || spots < 1 || spots > 20) {
      toast.error('Number of spots must be between 1 and 20');
      return;
    }
    addLocationMutation.mutate(newLocation);
  };

  const handleEditLocation = () => {
    if (!editingLocation?.name?.trim()) {
      toast.error('Location name is required');
      return;
    }
    updateLocationMutation.mutate(editingLocation);
  };

  const openEditDialog = (location: any) => {
    setEditingLocation({
      id: location.id,
      name: location.name,
      address: location.address || '',
      contact_name: location.contact_name || '',
      contact_phone: location.contact_phone || '',
      rent_amount: location.rent_amount?.toString() || '',
      start_date: location.start_date || '',
    });
  };

  const filteredLocations = locations?.filter((location) =>
    location.name.toLowerCase().includes(search.toLowerCase()) ||
    location.address?.toLowerCase().includes(search.toLowerCase())
  );

  const getSpotsForLocation = (locationId: string) => {
    return locationSpots?.filter(s => s.location_id === locationId) || [];
  };

  const toggleLocation = (locationId: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Locations & Spots</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Location Name *</Label>
                    <Input
                      id="name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                      placeholder="e.g., TTGYE"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number_of_spots">Number of Spots * (1-20)</Label>
                    <Input
                      id="number_of_spots"
                      type="number"
                      min="1"
                      max="20"
                      value={newLocation.number_of_spots}
                      onChange={(e) => setNewLocation({ ...newLocation, number_of_spots: e.target.value })}
                      placeholder="How many spots at this location?"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will create {newLocation.name || 'Location'} #1, #2, etc.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                      placeholder="123 Main St, City"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Contact Name</Label>
                      <Input
                        id="contact_name"
                        value={newLocation.contact_name}
                        onChange={(e) => setNewLocation({ ...newLocation, contact_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Contact Phone</Label>
                      <Input
                        id="contact_phone"
                        value={newLocation.contact_phone}
                        onChange={(e) => setNewLocation({ ...newLocation, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent_amount">Monthly Rent ($)</Label>
                    <Input
                      id="rent_amount"
                      type="number"
                      value={newLocation.rent_amount}
                      onChange={(e) => setNewLocation({ ...newLocation, rent_amount: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Will be divided equally between spots
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newLocation.start_date}
                      onChange={(e) => setNewLocation({ ...newLocation, start_date: e.target.value })}
                    />
                  </div>
                  <Button 
                    onClick={handleAddLocation} 
                    className="w-full"
                    disabled={addLocationMutation.isPending}
                  >
                    {addLocationMutation.isPending ? 'Adding...' : 'Add Location'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredLocations?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? 'No locations found' : 'No locations yet'}
            </CardContent>
          </Card>
        ) : (
          filteredLocations?.map((location) => {
            const spots = getSpotsForLocation(location.id);
            const isExpanded = expandedLocations.has(location.id);
            const rentPerSpot = location.rent_amount && spots.length > 0 
              ? Number(location.rent_amount) / spots.length 
              : null;

            return (
              <Collapsible 
                key={location.id} 
                open={isExpanded} 
                onOpenChange={() => toggleLocation(location.id)}
              >
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-primary/10 rounded-lg">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {location.name}
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </CardTitle>
                            {location.address && (
                              <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {spots.length} spot{spots.length !== 1 ? 's' : ''}
                              </span>
                              {location.start_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Started: {format(new Date(location.start_date), 'MMM d, yyyy')}
                                </span>
                              )}
                              {(location.location_total_sales ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <TrendingUp className="h-3 w-3" />
                                  ${Number(location.location_total_sales || 0).toFixed(2)} total sales
                                </span>
                              )}
                              {location.rent_amount && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${Number(location.rent_amount).toFixed(2)}/month
                                </span>
                              )}
                              {location.location_last_visit_report && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last visit: {format(new Date(location.location_last_visit_report), 'MMM d, yyyy')}
                                </span>
                              )}
                              {(location.location_open_maintenance_tickets ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  {location.location_open_maintenance_tickets} open tickets
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(location);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLocationId(location.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {location.is_prospect && (
                            <Badge variant="outline">Prospect</Badge>
                          )}
                          <Badge variant={location.is_active ? 'default' : 'secondary'}>
                            {location.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="border-t border-border pt-4 space-y-4">
                      {/* Location Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        {location.contact_name && (
                          <div>
                            <span className="font-medium">Contact:</span> {location.contact_name}
                          </div>
                        )}
                        {location.contact_phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {location.contact_phone}
                          </div>
                        )}
                        {rentPerSpot !== null && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            ${rentPerSpot.toFixed(2)}/spot
                          </div>
                        )}
                      </div>

                      {/* Spots */}
                      {spots.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No spots at this location</p>
                      ) : (
                        <div className="space-y-2">
                          {spots.map((spot) => (
                            <SpotCard
                              key={spot.id}
                              spot={spot}
                              locationName={location.name}
                              rentPerSpot={rentPerSpot}
                              setups={setups || []}
                              setupMachines={setupMachines || []}
                              machineSlots={machineSlots || []}
                              products={products || []}
                              companyId={profile?.company_id || ''}
                              allSpots={locationSpots || []}
                              locationStartDate={location.start_date}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </main>

      {/* Edit Location Dialog */}
      <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_name">Location Name *</Label>
              <Input
                id="edit_name"
                value={editingLocation?.name || ''}
                onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_address">Address</Label>
              <Input
                id="edit_address"
                value={editingLocation?.address || ''}
                onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_contact_name">Contact Name</Label>
                <Input
                  id="edit_contact_name"
                  value={editingLocation?.contact_name || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_contact_phone">Contact Phone</Label>
                <Input
                  id="edit_contact_phone"
                  value={editingLocation?.contact_phone || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_rent_amount">Monthly Rent ($)</Label>
              <Input
                id="edit_rent_amount"
                type="number"
                value={editingLocation?.rent_amount || ''}
                onChange={(e) => setEditingLocation({ ...editingLocation, rent_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_start_date">Start Date</Label>
              <Input
                id="edit_start_date"
                type="date"
                value={editingLocation?.start_date || ''}
                onChange={(e) => setEditingLocation({ ...editingLocation, start_date: e.target.value })}
              />
            </div>
            <Button 
              onClick={handleEditLocation} 
              className="w-full"
              disabled={updateLocationMutation.isPending}
            >
              {updateLocationMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteLocationId} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the location and all its spots. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteLocationId && deleteLocationMutation.mutate(deleteLocationId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLocationMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
