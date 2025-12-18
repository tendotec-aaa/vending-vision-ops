import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Progress } from '@/components/ui/progress';
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
import { format, differenceInDays } from 'date-fns';
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
  Camera,
  Upload,
  User,
  Calendar,
  TrendingUp,
  AlertCircle,
  RefreshCw
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
  toy_capacity: number;
  original_toy_capacity: number;
  jam_type: string | null;
  is_replacing_toy: boolean;
  replacement_toy_id: string | null;
  removed_for_replacement: number;
}

interface MachineAudit {
  machine_id: string;
  serial_number: string;
  slots: ToySlotAudit[];
}

const DRAFT_STORAGE_KEY = 'visit_report_draft';

interface DraftData {
  selectedLocation: string;
  selectedSpot: string;
  visitType: string;
  visitDate: string;
  accessNotes: string;
  coinBoxNotes: string;
  hasObservation: boolean;
  observation: string;
  generalNotes: string;
  machineAudits: MachineAudit[];
  savedAt: string;
}

export default function NewVisitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSpot, setSelectedSpot] = useState('');
  const [visitType, setVisitType] = useState('routine');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeIn] = useState(new Date().toISOString());
  const [accessNotes, setAccessNotes] = useState('');
  const [coinBoxNotes, setCoinBoxNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasObservation, setHasObservation] = useState(false);
  const [observation, setObservation] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [machineAudits, setMachineAudits] = useState<MachineAudit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Save draft to localStorage
  const saveDraft = () => {
    const draft: DraftData = {
      selectedLocation,
      selectedSpot,
      visitType,
      visitDate,
      accessNotes,
      coinBoxNotes,
      hasObservation,
      observation,
      generalNotes,
      machineAudits,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  };

  // Load draft from localStorage
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: DraftData = JSON.parse(saved);
        setSelectedLocation(draft.selectedLocation || '');
        setSelectedSpot(draft.selectedSpot || '');
        setVisitType(draft.visitType || 'routine');
        setVisitDate(draft.visitDate || new Date().toISOString().split('T')[0]);
        setAccessNotes(draft.accessNotes || '');
        setCoinBoxNotes(draft.coinBoxNotes || '');
        setHasObservation(draft.hasObservation || false);
        setObservation(draft.observation || '');
        setGeneralNotes(draft.generalNotes || '');
        if (draft.machineAudits?.length > 0) {
          setMachineAudits(draft.machineAudits);
        }
        toast.info(`Draft restored from ${format(new Date(draft.savedAt), 'PPp')}`);
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
    setDraftLoaded(true);
  };

  // Clear draft
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraft(false);
  };

  // Check for existing draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      setHasDraft(true);
    } else {
      setDraftLoaded(true);
    }
  }, []);

  // Auto-save draft when form changes (debounced)
  useEffect(() => {
    if (!draftLoaded) return;
    const timeoutId = setTimeout(() => {
      if (selectedLocation || selectedSpot || accessNotes || coinBoxNotes || observation || generalNotes || machineAudits.length > 0) {
        saveDraft();
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [selectedLocation, selectedSpot, visitType, visitDate, accessNotes, coinBoxNotes, hasObservation, observation, generalNotes, machineAudits, draftLoaded]);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*, companies(*)')
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
        .select('*')
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
        .select('*')
        .eq('company_id', profile?.company_id)
        .not('setup_id', 'is', null)
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
        .select('*, products(*)')
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
        .select('id, product_name, cogs')
        .eq('company_id', profile?.company_id)
        .eq('product_type', 'Toys')
        .order('product_name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: lastVisitReport } = useQuery({
    queryKey: ['last_visit_report', selectedSpot],
    queryFn: async () => {
      if (!selectedSpot) return null;
      const { data } = await supabase
        .from('visit_reports')
        .select('*, visit_report_stock(*)')
        .eq('spot_id', selectedSpot)
        .order('visit_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedSpot,
  });

  // Filter spots for selected location - only spots with setups
  const spotsForLocation = useMemo(() => {
    if (!selectedLocation) return [];
    return locationSpots?.filter(s => s.location_id === selectedLocation && s.setup_id) || [];
  }, [selectedLocation, locationSpots]);

  const selectedLocationData = locations?.find(l => l.id === selectedLocation);
  const selectedSpotData = locationSpots?.find(s => s.id === selectedSpot);
  const selectedSetup = setups?.find(s => s.id === selectedSpotData?.setup_id);

  // Calculate days since last visit
  const daysSinceLastVisit = useMemo(() => {
    if (!selectedSpotData?.spot_last_visit_report) return null;
    return differenceInDays(new Date(), new Date(selectedSpotData.spot_last_visit_report));
  }, [selectedSpotData]);

  // Calculate rent cost since last visit using correct formula: ((monthly_rent * 12) / 365) * days
  const rentCostSinceLastVisit = useMemo(() => {
    if (!selectedLocationData?.rent_amount || daysSinceLastVisit === null) return 0;
    const spots = locationSpots?.filter(s => s.location_id === selectedLocation).length || 1;
    const rentPerSpot = Number(selectedLocationData.rent_amount) / spots;
    // Formula: ((monthly_rent * 12) / 365) * days_active
    return ((rentPerSpot * 12) / 365) * daysSinceLastVisit;
  }, [selectedLocationData, daysSinceLastVisit, locationSpots, selectedLocation]);

  // Calculate total capacity and current stock
  const stockCapacityInfo = useMemo(() => {
    let totalCapacity = 0;
    let currentStock = 0;
    machineAudits.forEach(machine => {
      machine.slots.forEach(slot => {
        if (slot.toy_id) {
          totalCapacity += slot.toy_capacity;
          currentStock += slot.calculated_stock;
        }
      });
    });
    return { totalCapacity, currentStock, percentage: totalCapacity > 0 ? (currentStock / totalCapacity) * 100 : 0 };
  }, [machineAudits]);

  // Auto-set visit date and type when spot has no records
  useEffect(() => {
    if (!selectedSpot) return;
    
    const spot = locationSpots?.find(s => s.id === selectedSpot);
    const location = locations?.find(l => l.id === selectedLocation);
    
    // If spot has never been visited
    if (!spot?.spot_last_visit_report) {
      // Set visit type to installation
      setVisitType('installation');
      
      // Set visit date to location start date if available
      if (location?.start_date) {
        setVisitDate(location.start_date);
      }
    }
  }, [selectedSpot, locationSpots, locations, selectedLocation]);

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
        const product = existingSlot?.products;
        
        // Get last stock from previous visit report
        const lastStockRecord = lastVisitReport?.visit_report_stock?.find(
          (vrs: any) => vrs.machine_id === machine.id && vrs.slot_number === i + 1
        );
        const lastStock = lastStockRecord?.current_stock ?? 0;
        
        const existingCapacity = (existingSlot as any)?.toy_capacity ?? 20;
        return {
          toy_id: existingSlot?.product_id || '',
          toy_name: product?.product_name || '',
          slot_number: i + 1,
          last_stock: lastStock,
          units_sold: 0,
          units_refilled: 0,
          units_removed: 0,
          calculated_stock: lastStock,
          audited_count: null,
          discrepancy: 0,
          has_issue: false,
          issue_description: '',
          issue_severity: 'low',
          toy_capacity: existingCapacity,
          original_toy_capacity: existingCapacity,
          jam_type: null,
          is_replacing_toy: false,
          replacement_toy_id: null,
          removed_for_replacement: 0,
        };
      });

      return {
        machine_id: machine.id,
        serial_number: machine.serial_number,
        slots,
      };
    }).filter(Boolean) as MachineAudit[];

    setMachineAudits(audits);
  }, [selectedSpot, locationSpots, setupMachines, machineSlots, lastVisitReport]);

  // Calculate total cash recollected - $1 per unit sold
  const totalCashRecollected = useMemo(() => {
    let total = 0;
    machineAudits.forEach(machine => {
      machine.slots.forEach(slot => {
        if (slot.toy_id && slot.units_sold > 0) {
          total += slot.units_sold * 1.00; // $1 per unit
        }
      });
    });
    return total;
  }, [machineAudits]);

  const updateSlotField = (machineIndex: number, slotIndex: number, field: keyof ToySlotAudit, value: any) => {
    setMachineAudits(prev => {
      const updated = [...prev];
      const slot = { ...updated[machineIndex].slots[slotIndex] };
      (slot as any)[field] = value;

      // Handle jam type stock adjustment
      let jamAdjustment = 0;
      if (slot.jam_type === 'jammed_with_coins') {
        jamAdjustment = 1;
      }

      // Recalculate stock
      slot.calculated_stock = slot.last_stock - slot.units_sold + slot.units_refilled - slot.units_removed + jamAdjustment;
      
      // If audited, update calculated stock to match audited count and record discrepancy
      if (slot.audited_count !== null) {
        slot.discrepancy = slot.audited_count - slot.calculated_stock;
        slot.calculated_stock = slot.audited_count; // Update to real verified amount
      }

      updated[machineIndex].slots[slotIndex] = slot;
      return updated;
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !profile?.company_id) return null;
    
    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${profile.company_id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('visit-photos')
        .upload(fileName, photoFile);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('visit-photos')
        .getPublicUrl(data.path);
      
      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }
    if (!selectedSpot) {
      toast.error('Please select a spot');
      return;
    }
    if (!isSigned) {
      toast.error('Please sign off on the report');
      return;
    }
    
    // Validate visit date is not before last visit
    if (selectedSpotData?.spot_last_visit_report) {
      const lastVisitDate = new Date(selectedSpotData.spot_last_visit_report);
      const newVisitDate = new Date(visitDate);
      if (newVisitDate < lastVisitDate) {
        toast.error(`Visit date cannot be before last visit (${format(lastVisitDate, 'MMM d, yyyy')})`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Upload photo first if exists
      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      // Build the slot_performance_snapshot JSONB array with product_name
      const slotPerformanceSnapshot: any[] = [];
      const issuesForWorkOrders: { machine_serial: string; slot_number: number; description: string; severity: string }[] = [];
      
      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          const existingSlot = machineSlots?.find(
            ms => ms.machine_id === machine.machine_id && ms.slot_number === slot.slot_number
          );
          
          if (slot.toy_id || slot.replacement_toy_id) {
            const productId = slot.is_replacing_toy ? slot.replacement_toy_id : slot.toy_id;
            const product = products?.find(p => p.id === productId);
            const originalProduct = products?.find(p => p.id === slot.toy_id);
            
            // For replacement: new toy's current_stock = units_refilled (what was put in)
            // For non-replacement: current_stock = calculated_stock
            const currentStockValue = slot.is_replacing_toy ? slot.units_refilled : slot.calculated_stock;
            
            // For replacement: calculate surplus/shortage for old toy
            const oldToySurplusShortage = slot.is_replacing_toy 
              ? slot.removed_for_replacement - (slot.last_stock - slot.units_sold) 
              : 0;
            
            slotPerformanceSnapshot.push({
              slot_id: existingSlot?.id || null,
              machine_id: machine.machine_id,
              slot_number: slot.slot_number,
              product_id: productId,
              product_name: product?.product_name || slot.toy_name || 'Unknown',
              original_product_id: slot.is_replacing_toy ? slot.toy_id : null,
              original_product_name: slot.is_replacing_toy ? (originalProduct?.product_name || slot.toy_name) : null,
              toy_capacity: slot.toy_capacity,
              original_toy_capacity: slot.original_toy_capacity,
              last_stock: slot.last_stock,
              current_stock: currentStockValue,
              units_sold: slot.units_sold,
              units_refilled: slot.units_refilled,
              units_removed: slot.units_removed,
              audited_count: slot.audited_count,
              discrepancy: slot.discrepancy,
              surplus_shortage: oldToySurplusShortage,
              has_issue: slot.has_issue,
              issue_description: slot.has_issue ? slot.issue_description : null,
              issue_severity: slot.has_issue ? slot.issue_severity : null,
              jam_type: slot.jam_type,
              is_replacing_toy: slot.is_replacing_toy,
              replacement_product_id: slot.is_replacing_toy ? slot.replacement_toy_id : null,
              removed_for_replacement: slot.removed_for_replacement,
            });
            
            // Collect issues for work orders
            if (slot.has_issue && slot.issue_description) {
              issuesForWorkOrders.push({
                machine_serial: machine.serial_number,
                slot_number: slot.slot_number,
                description: slot.issue_description,
                severity: slot.issue_severity,
              });
            }
          }
        });
      });

      // Create visit report with JSONB snapshot (triggers handle inventory updates)
      const { data: report, error: reportError } = await supabase
        .from('visit_reports')
        .insert({
          company_id: profile?.company_id!,
          location_id: selectedLocation,
          spot_id: selectedSpot,
          employee_id: user!.id,
          visit_type: visitType,
          time_in: new Date(visitDate).toISOString(),
          access_notes: accessNotes || null,
          coin_box_notes: coinBoxNotes || null,
          photo_url: photoUrl,
          has_observation: hasObservation,
          observation_text: hasObservation ? observation : null,
          general_notes: generalNotes || null,
          total_cash_removed: totalCashRecollected,
          is_signed: isSigned,
          slot_performance_snapshot: slotPerformanceSnapshot.length > 0 ? slotPerformanceSnapshot : null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Create work orders for issues reported on slots
      if (issuesForWorkOrders.length > 0) {
        const workOrdersToInsert = issuesForWorkOrders.map(issue => ({
          company_id: profile?.company_id!,
          location_id: selectedLocation,
          issue_type: `Slot Issue - ${issue.machine_serial} Slot #${issue.slot_number}`,
          description: issue.description,
          status: 'pending',
        }));
        
        await supabase.from('work_orders').insert(workOrdersToInsert);
      }
      
      // Create work order for observation if flagged
      if (hasObservation && observation) {
        await supabase.from('work_orders').insert({
          company_id: profile?.company_id!,
          location_id: selectedLocation,
          issue_type: 'Observation',
          description: observation,
          status: 'pending',
        });
      }

      // Insert stock records for backward compatibility
      const stockRecords: any[] = [];

      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          if (slot.toy_id || slot.replacement_toy_id) {
            const productId = slot.is_replacing_toy ? slot.replacement_toy_id : slot.toy_id;
            const product = products?.find(p => p.id === productId);
            stockRecords.push({
              visit_report_id: report.id,
              product_id: productId,
              product_name: product?.product_name || slot.toy_name || 'Unknown',
              toy_id: productId,
              machine_id: machine.machine_id,
              slot_number: slot.slot_number,
              last_stock: slot.last_stock,
              current_stock: slot.calculated_stock,
              units_sold: slot.units_sold,
              units_refilled: slot.units_refilled,
              units_removed: slot.units_removed,
              audited_count: slot.audited_count,
              discrepancy: slot.discrepancy,
              has_issue: slot.has_issue,
              issue_description: slot.has_issue ? slot.issue_description : null,
              issue_severity: slot.has_issue ? slot.issue_severity : null,
              jam_type: slot.jam_type,
              is_replacing_toy: slot.is_replacing_toy,
              replacement_toy_id: slot.is_replacing_toy ? slot.replacement_toy_id : null,
              removed_for_replacement: slot.removed_for_replacement,
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
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['machine_toy_slots'] });
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      clearDraft();
      toast.success('Visit report submitted successfully!');
      navigate('/visit-reports');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInstallation = visitType === 'installation';
  const isAudit = visitType === 'audit';

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
        {/* Draft Restore Prompt */}
        {hasDraft && !draftLoaded && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-sm">You have a saved draft</p>
                    <p className="text-xs text-muted-foreground">Would you like to restore it?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { clearDraft(); setDraftLoaded(true); }}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={loadDraft}>
                    Restore
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* User Profile Card */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <p className="text-xs text-muted-foreground">
                  Started: {format(new Date(), 'PPp')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <Label htmlFor="spot">Spot * (with setup only)</Label>
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
                  {machineAudits.length} machine(s) to {isInstallation ? 'set up' : 'audit'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* General Info Card */}
        {selectedSpotData && selectedLocationData && (
          <Card className="bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Location Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
                  <div className="text-xs text-muted-foreground">Monthly Rent</div>
                  <div className="font-bold">${Number(selectedLocationData.rent_amount || 0).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                  <div className="text-xs text-muted-foreground">Last Visit</div>
                  <div className="font-bold">
                    {selectedSpotData.spot_last_visit_report 
                      ? format(new Date(selectedSpotData.spot_last_visit_report), 'MMM d')
                      : 'Never'}
                  </div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                  <div className="text-xs text-muted-foreground">Days Since</div>
                  <div className="font-bold">{daysSinceLastVisit ?? 'N/A'}</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <DollarSign className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                  <div className="text-xs text-muted-foreground">Rent Cost</div>
                  <div className="font-bold">${rentCostSinceLastVisit.toFixed(2)}</div>
                </div>
              </div>

              {/* Last Visit Photo */}
              {lastVisitReport?.photo_url && (
                <div className="mt-4 p-3 bg-background rounded-lg">
                  <div className="text-sm font-medium mb-2">Last Service Photo</div>
                  <div className="w-full max-w-[200px] mx-auto aspect-video overflow-hidden rounded-lg">
                    <img 
                      src={lastVisitReport.photo_url} 
                      alt="Last visit" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {machineAudits.length > 0 && (
                <div className="mt-4 p-3 bg-background rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Stock Capacity</span>
                    <span className="text-sm text-muted-foreground">
                      {stockCapacityInfo.currentStock} / {stockCapacityInfo.totalCapacity}
                    </span>
                  </div>
                  <Progress 
                    value={stockCapacityInfo.percentage} 
                    className={`h-3 ${stockCapacityInfo.percentage < 30 ? 'bg-destructive/20' : 'bg-muted'}`}
                  />
                  {stockCapacityInfo.percentage < 30 && (
                    <div className="flex items-center gap-1 mt-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Low stock alert!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Visit Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Step 2: Visit Details
            </CardTitle>
            <CardDescription>Record visit information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitDate">Visit Date *</Label>
              <Input
                id="visitDate"
                type="date"
                value={visitDate}
                min={selectedSpotData?.spot_last_visit_report 
                  ? new Date(selectedSpotData.spot_last_visit_report).toISOString().split('T')[0]
                  : undefined}
                onChange={(e) => setVisitDate(e.target.value)}
              />
              {selectedSpotData?.spot_last_visit_report && (
                <p className="text-xs text-muted-foreground">
                  Cannot be before last visit: {format(new Date(selectedSpotData.spot_last_visit_report), 'MMM d, yyyy')}
                </p>
              )}
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

            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Total Cash Recollected (Auto-calculated)</div>
                  <div className="text-2xl font-bold">${totalCashRecollected.toFixed(2)}</div>
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
                Step 3: {isInstallation ? 'Machine Setup' : 'Inventory Audit'}
              </CardTitle>
              <CardDescription>
                {isInstallation 
                  ? 'Assign toys to each slot and set capacity' 
                  : 'Record inventory for each machine'}
              </CardDescription>
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
                          <div className="font-medium text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Slot {slot.slot_number}
                            {slot.toy_name && !isInstallation && (
                              <Badge variant="secondary">{slot.toy_name}</Badge>
                            )}
                          </div>
                          {slot.discrepancy !== 0 && (
                            <Badge variant={slot.discrepancy < 0 ? "destructive" : "default"}>
                              {slot.discrepancy > 0 ? '+' : ''}{slot.discrepancy} {slot.discrepancy < 0 ? 'shortage' : 'surplus'}
                            </Badge>
                          )}
                        </div>

                        {/* Installation Mode: Select Toy */}
                        {isInstallation && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Assign Toy *</Label>
                                <Select
                                  value={slot.toy_id}
                                  onValueChange={(v) => {
                                    updateSlotField(machineIndex, slotIndex, 'toy_id', v);
                                    const product = products?.find(p => p.id === v);
                                    updateSlotField(machineIndex, slotIndex, 'toy_name', product?.product_name || '');
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select toy" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products?.map(product => (
                                      <SelectItem key={product.id} value={product.id}>{product.product_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Toy Capacity</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={slot.toy_capacity}
                                  onChange={(e) => updateSlotField(machineIndex, slotIndex, 'toy_capacity', parseInt(e.target.value) || 20)}
                                  className="h-8"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Units Refilled</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={slot.units_refilled}
                                  onChange={(e) => updateSlotField(machineIndex, slotIndex, 'units_refilled', parseInt(e.target.value) || 0)}
                                  className="h-8"
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Current Stock</Label>
                                <div className="h-8 px-3 flex items-center bg-muted/50 rounded-md text-sm font-medium">
                                  {slot.calculated_stock}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Non-Installation Mode */}
                        {!isInstallation && slot.toy_id && (
                          <>
                            {/* Replace Toy Option */}
                            <div className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
                              <Checkbox
                                id={`replace-${machine.machine_id}-${slot.slot_number}`}
                                checked={slot.is_replacing_toy}
                                onCheckedChange={(checked) => {
                                  updateSlotField(machineIndex, slotIndex, 'is_replacing_toy', !!checked);
                                  if (!checked) {
                                    updateSlotField(machineIndex, slotIndex, 'replacement_toy_id', null);
                                    updateSlotField(machineIndex, slotIndex, 'removed_for_replacement', 0);
                                  }
                                }}
                              />
                              <Label htmlFor={`replace-${machine.machine_id}-${slot.slot_number}`} className="text-sm flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                Replace all toys in this slot
                              </Label>
                            </div>

                            {slot.is_replacing_toy && (
                              <div className="space-y-3 p-2 border-l-2 border-primary/50">
                                <div className="text-xs font-medium text-muted-foreground">Current Toy: {slot.toy_name}</div>
                                <div className="grid grid-cols-2 gap-2">
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
                                    <Label className="text-xs">Removed Count</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={slot.removed_for_replacement}
                                      onChange={(e) => updateSlotField(machineIndex, slotIndex, 'removed_for_replacement', parseInt(e.target.value) || 0)}
                                      className="h-8"
                                    />
                                    {(() => {
                                      // Expected remaining of old toy = last_stock - units_sold
                                      const expectedRemaining = slot.last_stock - slot.units_sold;
                                      if (slot.removed_for_replacement !== expectedRemaining && slot.removed_for_replacement > 0) {
                                        return (
                                          <p className="text-xs text-destructive">
                                            Expected: {expectedRemaining} (surplus/shortage: {slot.removed_for_replacement - expectedRemaining > 0 ? '+' : ''}{slot.removed_for_replacement - expectedRemaining})
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">New Toy</Label>
                                  <Select
                                    value={slot.replacement_toy_id || ''}
                                    onValueChange={(v) => updateSlotField(machineIndex, slotIndex, 'replacement_toy_id', v)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Select replacement toy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products?.filter(p => p.id !== slot.toy_id).map(product => (
                                        <SelectItem key={product.id} value={product.id}>{product.product_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Units Refilled (New Toy)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={slot.units_refilled}
                                      onChange={(e) => updateSlotField(machineIndex, slotIndex, 'units_refilled', parseInt(e.target.value) || 0)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Slot Capacity</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={slot.toy_capacity}
                                      onChange={(e) => updateSlotField(machineIndex, slotIndex, 'toy_capacity', parseInt(e.target.value) || 20)}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {!slot.is_replacing_toy && (
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Last Stock</Label>
                                    <Input
                                      type="number"
                                      value={slot.last_stock}
                                      disabled
                                      className="h-8 bg-muted"
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

                                <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                                  <span className="text-muted-foreground">Calculated Stock:</span>
                                  <span className="font-bold">{slot.calculated_stock}</span>
                                </div>

                                {/* Jam Type Selection */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Jam Status (if any)</Label>
                                  <Select
                                    value={slot.jam_type || 'none'}
                                    onValueChange={(v) => updateSlotField(machineIndex, slotIndex, 'jam_type', v === 'none' ? null : v)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="No jam" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No Jam</SelectItem>
                                      <SelectItem value="jammed_with_coins">Jammed WITH Coins (+1 stock)</SelectItem>
                                      <SelectItem value="jammed_without_coins">Jammed WITHOUT Coins</SelectItem>
                                      <SelectItem value="jammed_by_coins">Jammed BY Coins</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Audit Mode: Physical Count */}
                                {isAudit && (
                                  <div className="space-y-1 p-2 bg-primary/5 rounded">
                                    <Label className="text-xs font-medium">Audited Count (Physical)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder="Enter physical count"
                                      value={slot.audited_count ?? ''}
                                      onChange={(e) => updateSlotField(machineIndex, slotIndex, 'audited_count', e.target.value ? parseInt(e.target.value) : null)}
                                      className="h-8"
                                    />
                                    {slot.audited_count !== null && slot.discrepancy !== 0 && (
                                      <p className={`text-xs font-medium ${slot.discrepancy < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                        {slot.discrepancy < 0 ? 'Shortage' : 'Surplus'}: {Math.abs(slot.discrepancy)} units (stock updated to {slot.audited_count})
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Capacity Info */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Capacity: {slot.toy_capacity}</span>
                                  <span className={slot.calculated_stock < slot.toy_capacity * 0.3 ? 'text-destructive' : ''}>
                                    {Math.round((slot.calculated_stock / slot.toy_capacity) * 100)}% full
                                  </span>
                                </div>
                              </>
                            )}

                            {/* Issue Reporting */}
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
                          </>
                        )}

                        {/* Empty slot indicator for non-installation */}
                        {!isInstallation && !slot.toy_id && (
                          <div className="text-center py-4 text-muted-foreground">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Empty Slot - Use Installation visit to assign a toy</p>
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

        {/* Step 4: Observations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Step 4: Observations
            </CardTitle>
            <CardDescription>Add any notes or observations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="observation" className="text-base">Add Observation?</Label>
                <p className="text-sm text-muted-foreground">Notes about this visit</p>
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

        {/* Step 5: Photo & Sign Off */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Step 5: Photo & Sign Off
            </CardTitle>
            <CardDescription>Upload a photo and confirm the report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Visit Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                      fileInputRef.current.setAttribute('capture', 'environment');
                    }
                  }}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              {photoPreview && (
                <div className="relative mt-2">
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* Sign Off */}
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
              disabled={isSubmitting || !isSigned || uploadingPhoto}
            >
              {isSubmitting || uploadingPhoto ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingPhoto ? 'Uploading Photo...' : 'Submitting...'}
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