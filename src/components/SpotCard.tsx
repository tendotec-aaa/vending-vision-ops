import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ChevronDown, Cpu, Edit2, Check, X, Hash, Package, DollarSign, Calendar, AlertTriangle, TrendingUp, Clock, Wrench } from 'lucide-react';
import { AssignSetupDialog } from './AssignSetupDialog';
import { ReadOnlySlotDisplay } from './ReadOnlySlotDisplay';
import { format, differenceInDays } from 'date-fns';

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
  current_stock?: number | null;
  capacity?: number | null;
  price_per_unit?: number | null;
  toy_name_cached?: string | null;
}

interface Product {
  id: string;
  product_name: string;
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
  products: Product[];
  companyId: string;
  allSpots: Spot[];
  locationStartDate?: string | null;
}

export function SpotCard({ 
  spot, 
  locationName, 
  rentPerSpot, 
  setups, 
  setupMachines, 
  machineSlots, 
  products,
  companyId,
  allSpots,
  locationStartDate
}: SpotCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [placeName, setPlaceName] = useState(spot.place_name || '');
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  const assignedSetup = setups.find(s => s.id === spot.setup_id);
  const machines = setupMachines.filter(sm => sm.setup_id === spot.setup_id);

  // Fetch actual sales from visit_reports to ensure accuracy
  const { data: visitReportTotals } = useQuery({
    queryKey: ['spot_visit_totals', spot.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('visit_reports')
        .select('total_cash_collected')
        .eq('spot_id', spot.id);
      
      const totalSales = data?.reduce((sum, vr) => sum + (Number(vr.total_cash_collected) || 0), 0) || 0;
      return { totalSales };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Calculate operational days - from start date to last visit (not current date)
  const startDate = spot.spot_start_date || locationStartDate;
  const endDate = spot.spot_last_visit_report ? new Date(spot.spot_last_visit_report) : null;
  const operationalDays = startDate && endDate 
    ? differenceInDays(endDate, new Date(startDate)) 
    : null;

  // Calculate total capacity and current stock across all machines
  const allSlotsForSpot = machines.flatMap(sm => 
    machineSlots.filter(ms => ms.machine_id === sm.machine_id)
  );
  const totalCapacity = allSlotsForSpot.reduce((sum, slot) => sum + (slot.capacity || 20), 0);
  const currentStock = allSlotsForSpot.reduce((sum, slot) => sum + (slot.current_stock || 0), 0);
  const stockPercentage = totalCapacity > 0 ? (currentStock / totalCapacity) * 100 : 0;

  // Use actual sales from visit_reports (accurate) instead of denormalized spot_total_sales (potentially stale)
  const totalSales = visitReportTotals?.totalSales ?? 0;

  // Calculate 30-day average (rough estimate based on total sales and operational days)
  const thirtyDayAverage = operationalDays && operationalDays > 0 && totalSales > 0
    ? (totalSales / operationalDays) * 30
    : null;

  // Calculate total rent: (monthly rent * 12 / 365) × days active (from start to last visit)
  const dailyRentRate = rentPerSpot ? (rentPerSpot * 12) / 365 : 0;
  const totalRent = rentPerSpot && operationalDays && operationalDays > 0
    ? dailyRentRate * operationalDays
    : 0;
  const profit = totalSales - totalRent;
  const isProfitable = profit > 0;

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
                  <Badge 
                    variant="destructive" 
                    className="text-xs cursor-pointer animate-pulse hover:animate-none flex items-center gap-1 px-2 py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/maintenance');
                    }}
                  >
                    <Wrench className="h-3 w-3" />
                    <AlertTriangle className="h-3 w-3" />
                    {spot.spot_open_maintenance_tickets} Open {spot.spot_open_maintenance_tickets === 1 ? 'Ticket' : 'Tickets'}
                  </Badge>
                )}
                {isProfitable ? (
                  <Badge variant="default" className="text-xs bg-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Profitable
                  </Badge>
                ) : totalSales > 0 || totalRent > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                    Loss
                  </Badge>
                ) : null}
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

            {/* Stats Row - Enhanced */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {operationalDays !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {operationalDays} days active
                </span>
              )}
              {totalSales > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <DollarSign className="h-3 w-3" />
                  ${totalSales.toFixed(2)} sales
                </span>
              )}
              {rentPerSpot !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${rentPerSpot.toFixed(2)}/mo
                </span>
              )}
              {thirtyDayAverage !== null && (
                <span className="flex items-center gap-1 text-blue-600">
                  <TrendingUp className="h-3 w-3" />
                  ~${thirtyDayAverage.toFixed(2)}/30d avg
                </span>
              )}
              {spot.spot_last_visit_report && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last: {format(new Date(spot.spot_last_visit_report), 'MMM d')}
                </span>
              )}
            </div>

            {/* Stock Capacity Bar */}
            {totalCapacity > 0 && assignedSetup && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Stock: {currentStock}/{totalCapacity}</span>
                  <span className={`font-medium ${stockPercentage < 25 ? 'text-red-600' : stockPercentage < 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {stockPercentage.toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={stockPercentage} 
                  className="h-1.5"
                />
              </div>
            )}
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

            {/* Profitability Summary */}
            {(totalSales > 0 || totalRent > 0) && (
              <div className="grid grid-cols-3 gap-2 text-xs bg-background rounded-md p-2 border">
                <div className="text-center">
                  <p className="text-muted-foreground">Total Sales</p>
                  <p className="font-semibold text-green-600">${Number(totalSales).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Total Rent</p>
                  <p className="font-semibold text-red-600">${Number(totalRent).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Net Profit</p>
                  <p className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

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
                      const filledSlots = slots.filter(s => s.toy_id).length;
                      const machineCapacity = slots.reduce((sum, s) => sum + (s.capacity || 20), 0);
                      const machineStock = slots.reduce((sum, s) => sum + (s.current_stock || 0), 0);

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
                                      {filledSlots}/{machine.slots_per_machine || 8} slots
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      ({machineStock}/{machineCapacity} units)
                                    </span>
                                  </div>
                                  <ChevronDown className={`h-3 w-3 transition-transform ${isMachineExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-2 pb-2 border-t border-border pt-2">
                                <h6 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  Toy Slots (View Only - Edit in Visit Reports)
                                </h6>
                                <ReadOnlySlotDisplay
                                  slots={slots}
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
