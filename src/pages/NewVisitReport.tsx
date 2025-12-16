import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileNav } from '@/components/MobileNav';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Package, 
  Cpu, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Camera
} from 'lucide-react';

interface ToySlotAudit {
  toy_id: string;
  toy_name: string;
  slot_number: number;
  last_stock: number;
  units_sold: number;
  units_refilled: number;
  units_removed: number;
  calculated_stock: number;
  audited_count: number | null;
  discrepancy: number;
  has_issue: boolean;
  issue_description: string;
  issue_severity: string;
}

interface MachineAudit {
  machine_id: string;
  serial_number: string;
  slots: ToySlotAudit[];
}

export default function NewVisitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSpot, setSelectedSpot] = useState('');
  const [visitType, setVisitType] = useState('routine');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [coinBoxNotes, setCoinBoxNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isJammed, setIsJammed] = useState(false);
  const [jamStatus, setJamStatus] = useState('');
  const [hasObservation, setHasObservation] = useState(false);
  const [observation, setObservation] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [machineAudits, setMachineAudits] = useState<MachineAudit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const { data: locations } = useQuery({
    queryKey: ['locations', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('locations')
        .select('id, name')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
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
        .select('id, location_id, spot_number, place_name, setup_id')
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
        .select('id, name')
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
        .select('id, name, cogs')
        .eq('company_id', profile?.company_id)
        .order('name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Filter spots for selected location
  const spotsForLocation = useMemo(() => {
    if (!selectedLocation) return [];
    return locationSpots?.filter(s => s.location_id === selectedLocation) || [];
  }, [selectedLocation, locationSpots]);

  // Load machines when spot is selected
  useEffect(() => {
    if (!selectedSpot) {
      setMachineAudits([]);
      return;
    }

    const spot = locationSpots?.find(s => s.id === selectedSpot);
    if (!spot?.setup_id) {
      setMachineAudits([]);
      return;
    }

    const machinesInSetup = setupMachines?.filter(sm => sm.setup_id === spot.setup_id) || [];
    
    const audits: MachineAudit[] = machinesInSetup.map(sm => {
      const machine = sm.machines;
      if (!machine) return null;

      const slotsForMachine = machineSlots?.filter(ms => ms.machine_id === machine.id) || [];
      const slotCount = machine.slots_per_machine || 8;

      const slots: ToySlotAudit[] = Array.from({ length: slotCount }, (_, i) => {
        const existingSlot = slotsForMachine.find(s => s.slot_number === i + 1);
        const toy = existingSlot?.toys;
        
        return {
          toy_id: existingSlot?.toy_id || '',
          toy_name: toy?.name || `Empty Slot ${i + 1}`,
          slot_number: i + 1,
          last_stock: 0, // TODO: Get from last visit report
          units_sold: 0,
          units_refilled: 0,
          units_removed: 0,
          calculated_stock: 0,
          audited_count: null,
          discrepancy: 0,
          has_issue: false,
          issue_description: '',
          issue_severity: 'low',
        };
      });

      return {
        machine_id: machine.id,
        serial_number: machine.serial_number,
        slots,
      };
    }).filter(Boolean) as MachineAudit[];

    setMachineAudits(audits);
  }, [selectedSpot, locationSpots, setupMachines, machineSlots]);

  // Calculate total cash removed
  const totalCashRemoved = useMemo(() => {
    let total = 0;
    machineAudits.forEach(machine => {
      machine.slots.forEach(slot => {
        const toy = toys?.find(t => t.id === slot.toy_id);
        if (toy && slot.units_sold > 0) {
          // Assuming a standard price per unit - you may want to adjust this
          total += slot.units_sold * 0.50; // $0.50 per play
        }
      });
    });
    return total;
  }, [machineAudits, toys]);

  const updateSlotField = (machineIndex: number, slotIndex: number, field: keyof ToySlotAudit, value: any) => {
    setMachineAudits(prev => {
      const updated = [...prev];
      const slot = { ...updated[machineIndex].slots[slotIndex] };
      (slot as any)[field] = value;

      // Recalculate stock
      slot.calculated_stock = slot.last_stock - slot.units_sold + slot.units_refilled - slot.units_removed;
      
      // Calculate discrepancy if audited
      if (slot.audited_count !== null) {
        slot.discrepancy = slot.audited_count - slot.calculated_stock;
      }

      updated[machineIndex].slots[slotIndex] = slot;
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }
    if (!isSigned) {
      toast.error('Please sign off on the report');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create visit report
      const { data: report, error: reportError } = await supabase
        .from('visit_reports')
        .insert({
          company_id: profile?.company_id!,
          location_id: selectedLocation,
          spot_id: selectedSpot || null,
          employee_id: user!.id,
          visit_type: visitType,
          time_in: timeIn ? new Date(`1970-01-01T${timeIn}`).toISOString() : null,
          time_out: timeOut ? new Date(`1970-01-01T${timeOut}`).toISOString() : null,
          access_notes: accessNotes || null,
          coin_box_notes: coinBoxNotes || null,
          photo_url: photoUrl || null,
          is_jammed: isJammed,
          jam_status: isJammed ? jamStatus : null,
          has_observation: hasObservation,
          observation_text: hasObservation ? observation : null,
          general_notes: generalNotes || null,
          total_cash_removed: totalCashRemoved,
          is_signed: isSigned,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Insert stock records for each slot
      const stockRecords: any[] = [];
      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          if (slot.toy_id) {
            stockRecords.push({
              visit_report_id: report.id,
              toy_id: slot.toy_id,
              machine_id: machine.machine_id,
              slot_number: slot.slot_number,
              last_stock: slot.last_stock,
              current_stock: slot.calculated_stock,
              units_sold: slot.units_sold,
              units_refilled: slot.units_refilled,
              units_removed: slot.units_removed,
              audited_count: slot.audited_count,
              discrepancy: slot.discrepancy,
              variance: slot.calculated_stock - slot.last_stock,
              has_issue: slot.has_issue,
              issue_description: slot.has_issue ? slot.issue_description : null,
              issue_severity: slot.has_issue ? slot.issue_severity : null,
            });
          }
        });
      });

      if (stockRecords.length > 0) {
        const { error: stockError } = await supabase
          .from('visit_report_stock')
          .insert(stockRecords);
        if (stockError) throw stockError;
      }

      queryClient.invalidateQueries({ queryKey: ['visit_reports'] });
      toast.success('Visit report submitted successfully!');
      navigate('/visit-reports');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSpotData = locationSpots?.find(s => s.id === selectedSpot);
  const selectedSetup = setups?.find(s => s.id === selectedSpotData?.setup_id);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/visit-reports')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">New Visit Report</h1>
              <p className="text-sm text-muted-foreground">Submit field service data</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Step 1: Location & Spot Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Step 1: Location & Visit Type
            </CardTitle>
            <CardDescription>Select where you're visiting and the type of service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select value={selectedLocation} onValueChange={(v) => {
                  setSelectedLocation(v);
                  setSelectedSpot('');
                }}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spot">Spot</Label>
                <Select value={selectedSpot} onValueChange={setSelectedSpot} disabled={!selectedLocation}>
                  <SelectTrigger id="spot">
                    <SelectValue placeholder={selectedLocation ? "Select spot" : "Select location first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {spotsForLocation.map(spot => (
                      <SelectItem key={spot.id} value={spot.id}>
                        #{spot.spot_number}{spot.place_name ? ` - ${spot.place_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitType">Visit Type *</Label>
              <Select value={visitType} onValueChange={setVisitType}>
                <SelectTrigger id="visitType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine Service</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="audit">Inventory Audit</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedSpot && selectedSetup && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Assigned Setup:</div>
                <div className="font-medium">{selectedSetup.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {machineAudits.length} machine(s) to audit
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Visit Audit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Step 2: Visit Details
            </CardTitle>
            <CardDescription>Record timing and general visit information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeIn">Time In</Label>
                <Input
                  id="timeIn"
                  type="time"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeOut">Time Out</Label>
                <Input
                  id="timeOut"
                  type="time"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessNotes">Access Notes</Label>
              <Input
                id="accessNotes"
                placeholder="e.g., Had to wait for security, key under mat..."
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coinBoxNotes">Coin Box Notes</Label>
              <Input
                id="coinBoxNotes"
                placeholder="Condition of coin box, any issues..."
                value={coinBoxNotes}
                onChange={(e) => setCoinBoxNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Photo URL</Label>
              <div className="flex gap-2">
                <Camera className="h-5 w-5 text-muted-foreground mt-2" />
                <Input
                  id="photo"
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Total Cash Removed (Auto-calculated)</div>
                  <div className="text-2xl font-bold">${totalCashRemoved.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Machine Audits */}
        {machineAudits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Step 3: Inventory Audit
              </CardTitle>
              <CardDescription>Record inventory for each machine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {machineAudits.map((machine, machineIndex) => (
                <div key={machine.machine_id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-3 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="font-medium">{machine.serial_number}</span>
                    <Badge variant="outline" className="ml-auto">
                      {machine.slots.length} slots
                    </Badge>
                  </div>
                  <div className="p-3 space-y-3">
                    {machine.slots.map((slot, slotIndex) => (
                      <div key={slot.slot_number} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">
                            Slot {slot.slot_number}: {slot.toy_name}
                          </div>
                          {slot.discrepancy !== 0 && (
                            <Badge variant={slot.discrepancy < 0 ? "destructive" : "default"}>
                              {slot.discrepancy > 0 ? '+' : ''}{slot.discrepancy} discrepancy
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Last Stock</Label>
                            <Input
                              type="number"
                              min="0"
                              value={slot.last_stock}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'last_stock', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Units Sold</Label>
                            <Input
                              type="number"
                              min="0"
                              value={slot.units_sold}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'units_sold', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Refilled</Label>
                            <Input
                              type="number"
                              min="0"
                              value={slot.units_refilled}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'units_refilled', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Removed</Label>
                            <Input
                              type="number"
                              min="0"
                              value={slot.units_removed}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'units_removed', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Calculated Stock:</span>
                          <span className="font-medium">{slot.calculated_stock}</span>
                        </div>

                        {visitType === 'audit' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Audited Count (Physical)</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Enter if performing physical count"
                              value={slot.audited_count ?? ''}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'audited_count', e.target.value ? parseInt(e.target.value) : null)}
                              className="h-8"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`issue-${machine.machine_id}-${slot.slot_number}`}
                            checked={slot.has_issue}
                            onCheckedChange={(checked) => updateSlotField(machineIndex, slotIndex, 'has_issue', checked)}
                          />
                          <Label htmlFor={`issue-${machine.machine_id}-${slot.slot_number}`} className="text-sm">
                            Report Issue
                          </Label>
                        </div>

                        {slot.has_issue && (
                          <div className="space-y-2 pl-4 border-l-2 border-destructive/50">
                            <Input
                              placeholder="Describe the issue..."
                              value={slot.issue_description}
                              onChange={(e) => updateSlotField(machineIndex, slotIndex, 'issue_description', e.target.value)}
                            />
                            <Select
                              value={slot.issue_severity}
                              onValueChange={(v) => updateSlotField(machineIndex, slotIndex, 'issue_severity', v)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Issues & Observations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Step 4: Issues & Observations
            </CardTitle>
            <CardDescription>Log any general issues or observations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="jammed" className="text-base">Machine Jammed?</Label>
                <p className="text-sm text-muted-foreground">Toggle if any machine has issues</p>
              </div>
              <Switch
                id="jammed"
                checked={isJammed}
                onCheckedChange={setIsJammed}
              />
            </div>

            {isJammed && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="jamStatus">Jam Status *</Label>
                <Input
                  id="jamStatus"
                  placeholder="e.g., Blocked by coin, Display failure"
                  value={jamStatus}
                  onChange={(e) => setJamStatus(e.target.value)}
                  required={isJammed}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="observation" className="text-base">General Observation?</Label>
                <p className="text-sm text-muted-foreground">Add notes about this visit</p>
              </div>
              <Switch
                id="observation"
                checked={hasObservation}
                onCheckedChange={setHasObservation}
              />
            </div>

            {hasObservation && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="observationText">Observation Notes *</Label>
                <Textarea
                  id="observationText"
                  placeholder="Enter your observations..."
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  required={hasObservation}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="generalNotes">General Notes</Label>
              <Textarea
                id="generalNotes"
                placeholder="Any additional notes for this visit..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Sign Off */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Step 5: Sign Off
            </CardTitle>
            <CardDescription>Confirm the accuracy of this report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                id="signOff"
                checked={isSigned}
                onCheckedChange={(checked) => setIsSigned(!!checked)}
              />
              <div className="space-y-1">
                <Label htmlFor="signOff" className="font-medium cursor-pointer">
                  I confirm that this report is accurate
                </Label>
                <p className="text-sm text-muted-foreground">
                  By checking this box, I attest that all information entered in this report is accurate to the best of my knowledge.
                </p>
              </div>
            </div>

            <Button 
              onClick={handleSubmit} 
              className="w-full" 
              size="lg" 
              disabled={isSubmitting || !isSigned}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </CardContent>
        </Card>
      </main>

      <MobileNav />
    </div>
  );
}