import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ChevronDown, Cpu, Edit2, Check, X, Hash, Package, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { AssignSetupDialog } from './AssignSetupDialog';
import { MachineSlotManager } from './MachineSlotManager';
import { format } from 'date-fns';

interface Setup {
  id: string;
  name: string;
}

interface Machine {
  id: string;
  serial_number: string;
  slots_per_machine: number;
}

interface SetupMachine {
  id: string;
  setup_id: string;
  machine_id: string;
  machines: Machine | null;
}

interface MachineSlot {
  id: string;
  machine_id: string;
  slot_number: number;
  toy_id: string | null;
}

interface Toy {
  id: string;
  name: string;
}

interface Spot {
  id: string;
  location_id: string;
  company_id: string;
  spot_number: number;
  place_name: string | null;
  setup_id: string | null;
  spot_start_date?: string | null;
  spot_last_visit_report?: string | null;
  spot_total_sales?: number | null;
  spot_total_rent?: number | null;
  spot_open_maintenance_tickets?: number | null;
}

interface SpotCardProps {
  spot: Spot;
  locationName: string;
  rentPerSpot: number | null;
  setups: Setup[];
  setupMachines: SetupMachine[];
  machineSlots: MachineSlot[];
  toys: Toy[];
  companyId: string;
  allSpots: Spot[];
}

export function SpotCard({ 
  spot, 
  locationName, 
  rentPerSpot, 
  setups, 
  setupMachines, 
  machineSlots, 
  toys,
  companyId,
  allSpots
}: SpotCardProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [placeName, setPlaceName] = useState(spot.place_name || '');
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  const assignedSetup = setups.find(s => s.id === spot.setup_id);
  const machines = setupMachines.filter(sm => sm.setup_id === spot.setup_id);

  const updatePlaceNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from('location_spots')
        .update({ place_name: newName || null })
        .eq('id', spot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      setIsEditing(false);
      toast.success('Spot name updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleSavePlaceName = () => {
    updatePlaceNameMutation.mutate(placeName);
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

  const getSlotsForMachine = (machineId: string) => {
    return machineSlots.filter(ms => ms.machine_id === machineId);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  {locationName} #{spot.spot_number}
                </span>
                {spot.place_name && (
                  <span className="text-muted-foreground text-sm">({spot.place_name})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(spot.spot_open_maintenance_tickets ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {spot.spot_open_maintenance_tickets}
                  </Badge>
                )}
                {assignedSetup ? (
                  <Badge variant="secondary" className="text-xs">
                    {assignedSetup.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No setup
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {(spot.spot_total_sales ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-green-500" />
                  ${Number(spot.spot_total_sales || 0).toFixed(2)} sales
                </span>
              )}
              {rentPerSpot !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${rentPerSpot.toFixed(2)}/mo rent
                </span>
              )}
              {spot.spot_last_visit_report && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last visit: {format(new Date(spot.spot_last_visit_report), 'MMM d')}
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
            {/* Place Name Editor */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Place Name:</span>
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                    placeholder="e.g., Coffee Shop, Main Entrance"
                    className="h-7 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleSavePlaceName}
                    disabled={updatePlaceNameMutation.isPending}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setIsEditing(false);
                      setPlaceName(spot.place_name || '');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm">{spot.place_name || 'Not set'}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Setup Assignment */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Setup:</span>
              <AssignSetupDialog
                spotId={spot.id}
                currentSetupId={spot.setup_id}
                setups={setups}
                allSpots={allSpots}
              />
            </div>

            {/* Machines in Setup */}
            {assignedSetup && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  Machines ({machines.length})
                </h5>
                {machines.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic ml-4">No machines in this setup</p>
                ) : (
                  <div className="space-y-2 ml-4">
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
                              <div className="p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Cpu className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-medium">{machine.serial_number}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {slots.filter(s => s.toy_id).length}/{machine.slots_per_machine || 8} slots
                                    </Badge>
                                  </div>
                                  <ChevronDown className={`h-3 w-3 transition-transform ${isMachineExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-2 pb-2 border-t border-border pt-2">
                                <h6 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  Toy Slots
                                </h6>
                                <MachineSlotManager
                                  machineId={machine.id}
                                  companyId={companyId}
                                  slots={slots}
                                  toys={toys}
                                  slotCount={machine.slots_per_machine || 8}
                                />
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
