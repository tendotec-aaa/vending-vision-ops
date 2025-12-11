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
import { toast } from 'sonner';
import { 
  MapPin, 
  Search, 
  Phone, 
  DollarSign, 
  ChevronDown,
  Hash,
  Plus
} from 'lucide-react';

export default function Locations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
        .select('*, toys(*)')
        .eq('company_id', profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: toys } = useQuery({
    queryKey: ['toys', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('toys')
        .select('id, name')
        .eq('company_id', profile?.company_id)
        .order('name');
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
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {spots.length} spot{spots.length !== 1 ? 's' : ''}
                              </span>
                              {location.rent_amount && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${Number(location.rent_amount).toFixed(2)}/month
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
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
                              toys={toys || []}
                              companyId={profile?.company_id || ''}
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

      <MobileNav />
    </div>
  );
}
