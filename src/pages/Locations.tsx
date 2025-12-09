import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/MobileNav';
import { MachineSlotManager } from '@/components/MachineSlotManager';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  MapPin, 
  Search, 
  Phone, 
  DollarSign, 
  ChevronDown, 
  Cpu, 
  Package,
  Settings
} from 'lucide-react';

export default function Locations() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

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

  const filteredLocations = locations?.filter((location) =>
    location.name.toLowerCase().includes(search.toLowerCase()) ||
    location.address?.toLowerCase().includes(search.toLowerCase())
  );

  const getSetupsForLocation = (locationId: string) => {
    return setups?.filter(s => s.location_id === locationId) || [];
  };

  const getMachinesForSetup = (setupId: string) => {
    return setupMachines?.filter(sm => sm.setup_id === setupId) || [];
  };

  const getSlotsForMachine = (machineId: string) => {
    return machineSlots?.filter(ms => ms.machine_id === machineId) || [];
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

  const toggleMachine = (machineId: string) => {
    setExpandedMachines(prev => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  };

  const getMachineCount = (locationId: string) => {
    const locationSetups = getSetupsForLocation(locationId);
    return locationSetups.reduce((count, setup) => {
      return count + getMachinesForSetup(setup.id).length;
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Locations & Machines</h1>
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
            const locationSetups = getSetupsForLocation(location.id);
            const machineCount = getMachineCount(location.id);
            const isExpanded = expandedLocations.has(location.id);

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
                                <Settings className="h-3 w-3" />
                                {locationSetups.length} setup{locationSetups.length !== 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Cpu className="h-3 w-3" />
                                {machineCount} machine{machineCount !== 1 ? 's' : ''}
                              </span>
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
                        {location.rent_amount && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            ${location.rent_amount}/month
                          </div>
                        )}
                      </div>

                      {/* Setups and Machines */}
                      {locationSetups.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No setups at this location</p>
                      ) : (
                        <div className="space-y-3">
                          {locationSetups.map((setup) => {
                            const machines = getMachinesForSetup(setup.id);
                            return (
                              <div key={setup.id} className="bg-muted/30 rounded-lg p-3">
                                <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                                  <Settings className="h-4 w-4 text-primary" />
                                  {setup.name}
                                  <Badge variant="outline" className="text-xs">
                                    {machines.length} machine{machines.length !== 1 ? 's' : ''}
                                  </Badge>
                                </h4>

                                {machines.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic ml-6">No machines in this setup</p>
                                ) : (
                                  <div className="space-y-2 ml-6">
                                    {machines.map((sm) => {
                                      const machine = sm.machines;
                                      if (!machine) return null;
                                      const slots = getSlotsForMachine(machine.id);
                                      const isMachineExpanded = expandedMachines.has(machine.id);

                                      return (
                                        <Collapsible
                                          key={machine.id}
                                          open={isMachineExpanded}
                                          onOpenChange={() => toggleMachine(machine.id)}
                                        >
                                          <div className="bg-background rounded-md border border-border">
                                            <CollapsibleTrigger asChild>
                                              <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Cpu className="h-4 w-4 text-primary" />
                                                    <span className="font-medium text-sm">{machine.serial_number}</span>
                                                    <Badge variant="secondary" className="text-xs">
                                                      {slots.filter(s => s.toy_id).length}/8 slots filled
                                                    </Badge>
                                                  </div>
                                                  <ChevronDown className={`h-4 w-4 transition-transform ${isMachineExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                              </div>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                              <div className="px-3 pb-3 border-t border-border pt-3">
                                                <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                                  <Package className="h-3 w-3" />
                                                  Toy Slots (2-8 slots)
                                                </h5>
                                                {profile?.company_id && (
                                                  <MachineSlotManager
                                                    machineId={machine.id}
                                                    companyId={profile.company_id}
                                                    slots={slots}
                                                    toys={toys || []}
                                                    slotCount={8}
                                                  />
                                                )}
                                              </div>
                                            </CollapsibleContent>
                                          </div>
                                        </Collapsible>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
