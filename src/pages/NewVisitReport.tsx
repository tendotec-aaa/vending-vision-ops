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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  RefreshCw,
  Save,
  FileText,
  Trash2,
  ChevronDown
} from 'lucide-react';

interface ToySlotAudit {
  slot_id: string | null;
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
  surplus_shortage: number;
  price_per_unit: number;
}

interface MachineAudit {
  machine_id: string;
  serial_number: string;
  slots: ToySlotAudit[];
}

const DRAFTS_STORAGE_KEY = 'visit_report_drafts';

interface DraftData {
  id: string;
  selectedLocation: string;
  selectedLocationName: string;
  selectedSpot: string;
  selectedSpotName: string;
  visitType: string;
  visitDate: string;
  hasObservation: boolean;
  observation: string;
  generalNotes: string;
  machineAudits: MachineAudit[];
  savedAt: string;
  photoPreviewData?: string | null;
}

// Get all drafts from localStorage
const getAllDrafts = (): DraftData[] => {
  try {
    const saved = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as DraftData[];
    }
  } catch (e) {
    console.error('Failed to parse drafts:', e);
  }
  return [];
};

// Save all drafts to localStorage
const saveAllDrafts = (drafts: DraftData[]) => {
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
};

// Generate unique draft ID
const generateDraftId = () => `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasObservation, setHasObservation] = useState(false);
  const [observation, setObservation] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [machineAudits, setMachineAudits] = useState<MachineAudit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Load drafts on mount
  useEffect(() => {
    const savedDrafts = getAllDrafts();
    setDrafts(savedDrafts);
  }, []);

  // Get location and spot names for draft display
  const getLocationName = (locationId: string) => {
    return locations?.find(l => l.id === locationId)?.name || 'Unknown Location';
  };

  const getSpotName = (spotId: string) => {
    const spot = locationSpots?.find(s => s.id === spotId);
    return spot?.place_name || `Spot #${spot?.spot_number}` || 'Unknown Spot';
  };

  // Save current form as a new draft or update existing
  const saveDraft = (showToast = true) => {
    if (!selectedLocation && !selectedSpot && machineAudits.length === 0) {
      if (showToast) toast.error('Nothing to save');
      return;
    }

    setIsSavingDraft(true);
    
    const newDraft: DraftData = {
      id: activeDraftId || generateDraftId(),
      selectedLocation,
      selectedLocationName: getLocationName(selectedLocation),
      selectedSpot,
      selectedSpotName: getSpotName(selectedSpot),
      visitType,
      visitDate,
      hasObservation,
      observation,
      generalNotes,
      machineAudits,
      savedAt: new Date().toISOString(),
      photoPreviewData: photoPreview,
    };

    // Update drafts list
    const existingDrafts = getAllDrafts();
    const draftIndex = existingDrafts.findIndex(d => d.id === newDraft.id);
    
    if (draftIndex >= 0) {
      existingDrafts[draftIndex] = newDraft;
    } else {
      existingDrafts.unshift(newDraft);
    }
    
    // Keep only the last 10 drafts
    const trimmedDrafts = existingDrafts.slice(0, 10);
    saveAllDrafts(trimmedDrafts);
    setDrafts(trimmedDrafts);
    setActiveDraftId(newDraft.id);
    
    if (showToast) {
      toast.success('Draft saved successfully');
    }
    
    setIsSavingDraft(false);
  };

  // Load a specific draft
  const loadDraft = (draft: DraftData) => {
    setSelectedLocation(draft.selectedLocation || '');
    setSelectedSpot(draft.selectedSpot || '');
    setVisitType(draft.visitType || 'routine');
    setVisitDate(draft.visitDate || new Date().toISOString().split('T')[0]);
    setHasObservation(draft.hasObservation || false);
    setObservation(draft.observation || '');
    setGeneralNotes(draft.generalNotes || '');
    if (draft.machineAudits?.length > 0) {
      setMachineAudits(draft.machineAudits);
    }
    if (draft.photoPreviewData) {
      setPhotoPreview(draft.photoPreviewData);
    }
    setActiveDraftId(draft.id);
    toast.info(`Draft loaded from ${format(new Date(draft.savedAt), 'PPp')}`);
  };

  // Discard a specific draft
  const discardDraft = (draftId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    saveAllDrafts(updatedDrafts);
    setDrafts(updatedDrafts);
    
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    
    toast.success('Draft discarded');
  };

  // Clear active draft (used when submitting)
  const clearActiveDraft = () => {
    if (activeDraftId) {
      discardDraft(activeDraftId);
    }
  };

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
        .select('id, machine_id, slot_number, toy_id, toy_name_cached, current_stock, capacity, price_per_unit, location_id, spot_id, last_refill_date')
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
        // Use cached name or look up from products
        const toyName = existingSlot?.toy_name_cached || 
          products?.find(p => p.id === existingSlot?.toy_id)?.product_name || '';
        
        // Get last stock from previous visit report using new schema
        const lastStockRecord = lastVisitReport?.visit_report_stock?.find(
          (vrs: any) => vrs.machine_id === machine.id && vrs.slot_position_snapshot === `Slot ${i + 1}`
        );
        // Calculate last stock: capacity - sold + refilled - removed + variance
        const lastStock = lastStockRecord 
          ? Math.max(0, (lastStockRecord.capacity_snapshot || 0) - (lastStockRecord.units_sold || 0) + (lastStockRecord.units_refilled || 0) - (lastStockRecord.units_removed || 0) + (lastStockRecord.units_shortage_surplus || 0))
          : (existingSlot?.current_stock ?? 0);
        
        const existingCapacity = existingSlot?.capacity ?? 20;
        const existingPrice = existingSlot?.price_per_unit ?? 1.00;
        return {
          slot_id: existingSlot?.id || null,
          toy_id: existingSlot?.toy_id || '',
          toy_name: toyName,
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
          surplus_shortage: 0,
          price_per_unit: existingPrice,
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

  // Calculate total cash recollected - using price_per_unit from each slot
  const totalCashRecollected = useMemo(() => {
    let total = 0;
    machineAudits.forEach(machine => {
      machine.slots.forEach(slot => {
        if (slot.toy_id && slot.units_sold > 0) {
          total += slot.units_sold * slot.price_per_unit;
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
      
      // Create a signed URL for private bucket access (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('visit-photos')
        .createSignedUrl(data.path, 3600);
      
      if (signedUrlError) throw signedUrlError;
      
      return signedUrlData.signedUrl;
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Generate detailed text summary for visit_summary column
  const generateDetailedSummary = (
    locationName: string,
    spotName: string,
    techName: string,
    visitDateStr: string,
    totals: {
      totalSold: number;
      totalRefilled: number;
      totalRemoved: number;
      totalDiscrepancy: number;
      totalIssues: number;
      totalCurrentStock: number;
      totalCapacity: number;
    },
    cashCollected: number,
    rentExpense: number,
    machineData: MachineAudit[]
  ): string => {
    const lines: string[] = [];
    
    // Header
    lines.push(`=== VISIT REPORT ===`);
    lines.push(`Date: ${format(new Date(visitDateStr), 'PPP')}`);
    lines.push(`Location: ${locationName}`);
    lines.push(`Spot: ${spotName}`);
    lines.push(`Technician: ${techName}`);
    lines.push(``);
    
    // Performance Block
    lines.push(`--- PERFORMANCE SUMMARY ---`);
    lines.push(`Units Sold: ${totals.totalSold}`);
    lines.push(`Units Refilled: ${totals.totalRefilled}`);
    lines.push(`Units Removed: ${totals.totalRemoved}`);
    lines.push(`Surplus/Shortage: ${totals.totalDiscrepancy > 0 ? '+' : ''}${totals.totalDiscrepancy}`);
    lines.push(`Total Cash Collected: $${cashCollected.toFixed(2)}`);
    lines.push(`Rent Expense: $${rentExpense.toFixed(2)}`);
    lines.push(``);
    
    // Capacity Line
    lines.push(`--- CAPACITY STATUS ---`);
    lines.push(`Total Stock: ${totals.totalCurrentStock} / ${totals.totalCapacity} (${totals.totalCapacity > 0 ? Math.round((totals.totalCurrentStock / totals.totalCapacity) * 100) : 0}%)`);
    lines.push(``);
    
    // Breakdown by machine/slot
    lines.push(`--- SLOT DETAILS ---`);
    machineData.forEach(machine => {
      lines.push(`Machine: ${machine.serial_number}`);
      machine.slots.forEach(slot => {
        if (slot.toy_id || slot.replacement_toy_id) {
          const stockInfo = `${slot.calculated_stock}/${slot.toy_capacity}`;
          const toyName = slot.is_replacing_toy 
            ? `${slot.toy_name} → NEW TOY` 
            : slot.toy_name;
          
          // Build slot line with jam info
          let slotLine = `  Slot ${slot.slot_number}: ${toyName} [${stockInfo}] Sold:${slot.units_sold} Refill:${slot.units_refilled}`;
          
          // Add jam info if present
          if (slot.jam_type) {
            const jamLabel = slot.jam_type === 'jammed_with_coins' 
              ? '(Jammed With Coins +1)' 
              : slot.jam_type === 'jammed_without_coins' 
                ? '(Jammed Without Coins)'
                : `(${slot.jam_type.replace(/_/g, ' ')})`;
            slotLine += ` ${jamLabel}`;
          }
          
          // Add issue info on same line
          if (slot.has_issue && slot.issue_description) {
            const severityLabel = slot.issue_severity === 'low' ? 'Low' 
              : slot.issue_severity === 'medium' ? 'Med' 
              : slot.issue_severity === 'high' ? 'High' : slot.issue_severity;
            slotLine += ` #${slot.issue_description} SL: ${severityLabel}`;
          }
          
          lines.push(slotLine);
        }
      });
    });
    
    // Notes
    if (generalNotes || observation) {
      lines.push(``);
      lines.push(`--- NOTES ---`);
      if (generalNotes) lines.push(`General: ${generalNotes}`);
      if (observation) lines.push(`Observation: ${observation}`);
    }
    
    return lines.join('\n');
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
    
    // Track IDs for log book
    const createdWorkOrderIds: string[] = [];
    const createdVisitReportStockIds: string[] = [];
    
    // Capture previous values for rollback
    const previousSlotValues: { id: string; previous_values: any }[] = [];
    const previousSpotValues: { id: string; previous_values: any }[] = [];
    const previousLocationValues: { id: string; previous_values: any }[] = [];
    
    try {
      // Capture current slot values BEFORE any updates (will be updated by trigger)
      for (const machine of machineAudits) {
        for (const slot of machine.slots) {
          if (slot.slot_id && (slot.toy_id || slot.replacement_toy_id)) {
            const slotData = machineSlots?.find(ms => ms.id === slot.slot_id);
            if (slotData) {
              previousSlotValues.push({
                id: slot.slot_id,
                previous_values: {
                  current_stock: slotData.current_stock,
                  toy_id: slotData.toy_id,
                  capacity: slotData.capacity,
                  price_per_unit: slotData.price_per_unit,
                  last_refill_date: slotData.last_refill_date,
                }
              });
            }
          }
        }
      }
      
      // Capture current spot values
      if (selectedSpotData) {
        previousSpotValues.push({
          id: selectedSpot,
          previous_values: {
            spot_last_visit_report: selectedSpotData.spot_last_visit_report,
            spot_last_visit_report_id: selectedSpotData.spot_last_visit_report_id,
            spot_total_sales: selectedSpotData.spot_total_sales,
          }
        });
      }
      
      // Capture current location values
      if (selectedLocationData) {
        previousLocationValues.push({
          id: selectedLocation,
          previous_values: {
            location_last_visit_report: selectedLocationData.location_last_visit_report,
            location_last_visit_report_id: selectedLocationData.location_last_visit_report_id,
            location_total_sales: selectedLocationData.location_total_sales,
          }
        });
      }

      // Upload photo first if exists
      let photoUrl = null;
      let uploadedPhotoPath = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
        // Extract path from URL for potential deletion during rollback
        if (photoUrl) {
          const urlParts = photoUrl.split('/visit-photos/');
          uploadedPhotoPath = urlParts.length > 1 ? urlParts[1] : null;
        }
      }

      // Calculate totals
      let totalSold = 0;
      let totalRefilled = 0;
      let totalRemoved = 0;
      let totalDiscrepancy = 0;
      let totalIssues = 0;
      let totalCurrentStock = 0;
      let totalCapacity = 0;

      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          if (slot.toy_id || slot.replacement_toy_id) {
            totalSold += slot.units_sold;
            totalRefilled += slot.units_refilled;
            totalRemoved += slot.units_removed + slot.removed_for_replacement;
            totalDiscrepancy += slot.discrepancy;
            if (slot.has_issue) totalIssues++;
            totalCurrentStock += slot.is_replacing_toy ? slot.units_refilled : slot.calculated_stock;
            totalCapacity += slot.toy_capacity;
          }
        });
      });

      // Calculate rent expense: ((Monthly Rent / spots) / 30) * Days Since Last Visit
      // If installation, rent = 0
      let rentExpenseCalculated = 0;
      const spots = locationSpots?.filter(s => s.location_id === selectedLocation).length || 1;
      const rentPerSpot = Number(selectedLocationData?.rent_amount || 0) / spots;
      const spotRentMonthly = rentPerSpot;
      const spotRentDaily = spotRentMonthly / 30;
      
      if (visitType !== 'installation' && daysSinceLastVisit !== null) {
        rentExpenseCalculated = spotRentDaily * daysSinceLastVisit;
      }

      // Build the slot_performance_snapshot JSONB array with all snapshot fields
      const slotPerformanceSnapshot: any[] = [];
      const issuesForWorkOrders: { machine_serial: string; slot_number: number; description: string; severity: string }[] = [];
      
      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          if (slot.toy_id || slot.replacement_toy_id) {
            const productId = slot.is_replacing_toy ? slot.replacement_toy_id : slot.toy_id;
            const product = products?.find(p => p.id === productId);
            const originalProduct = products?.find(p => p.id === slot.toy_id);
            const replacementProduct = slot.replacement_toy_id ? products?.find(p => p.id === slot.replacement_toy_id) : null;
            
            // For replacement: new toy's current_stock = units_refilled
            // For non-replacement: current_stock = calculated_stock
            const currentStockValue = slot.is_replacing_toy ? slot.units_refilled : slot.calculated_stock;
            
            // Calculate surplus/shortage for old toy during replacement
            const oldToySurplusShortage = slot.is_replacing_toy 
              ? slot.removed_for_replacement - (slot.last_stock - slot.units_sold) 
              : slot.discrepancy;
            
            slotPerformanceSnapshot.push({
              // IDs
              slot_id: slot.slot_id,
              machine_id: machine.machine_id,
              machine_toy_slot_id: slot.slot_id,
              slot_number: slot.slot_number,
              product_id: productId,
              original_product_id: slot.is_replacing_toy ? slot.toy_id : null,
              replacement_product_id: slot.is_replacing_toy ? slot.replacement_toy_id : null,
              // Snapshots
              product_name: product?.product_name || slot.toy_name || 'Unknown',
              original_product_name: slot.is_replacing_toy ? (originalProduct?.product_name || slot.toy_name) : null,
              replacement_toy_name: replacementProduct?.product_name || null,
              machine_serial_snapshot: machine.serial_number,
              slot_position_snapshot: `Slot ${slot.slot_number}`,
              unit_price_snapshot: slot.price_per_unit,
              // Inventory
              toy_capacity: slot.toy_capacity,
              original_toy_capacity: slot.original_toy_capacity,
              last_stock: slot.last_stock,
              current_stock: currentStockValue,
              units_sold: slot.units_sold,
              units_refilled: slot.units_refilled,
              units_removed: slot.units_removed,
              units_audited: slot.audited_count,
              units_shortage_surplus: oldToySurplusShortage,
              // Logic fields
              visit_type: visitType,
              jam_type: slot.jam_type,
              has_issue: slot.has_issue,
              reported_issue: slot.has_issue ? slot.issue_description : null,
              issue_severity: slot.has_issue ? slot.issue_severity : null,
              is_being_replaced: slot.is_replacing_toy,
              removed_for_replacement: slot.removed_for_replacement,
              // Deprecated but kept for backward compatibility
              audited_count: slot.audited_count,
              discrepancy: slot.discrepancy,
              issue_description: slot.has_issue ? slot.issue_description : null,
              is_replacing_toy: slot.is_replacing_toy,
              surplus_shortage: oldToySurplusShortage,
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

      // Generate text summary
      const visitSummary = generateDetailedSummary(
        selectedLocationData?.name || 'Unknown',
        selectedSpotData?.place_name || `Spot #${selectedSpotData?.spot_number}`,
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
        visitDate,
        { totalSold, totalRefilled, totalRemoved, totalDiscrepancy, totalIssues, totalCurrentStock, totalCapacity },
        totalCashRecollected,
        rentExpenseCalculated,
        machineAudits
      );

      // Create visit report with all new fields
      const { data: report, error: reportError } = await supabase
        .from('visit_reports')
        .insert({
          company_id: profile?.company_id!,
          location_id: selectedLocation,
          spot_id: selectedSpot,
          setup_id: selectedSpotData?.setup_id || null,
          employee_id: user!.id,
          employee_name_snapshot: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
          location_name_snapshot: selectedLocationData?.name || 'Unknown',
          spot_name_snapshot: selectedSpotData?.place_name || `Spot #${selectedSpotData?.spot_number}`,
          visit_date: new Date(visitDate).toISOString(),
          visit_type: visitType,
          visit_summary: visitSummary,
          total_cash_collected: totalCashRecollected,
          total_units_sold: totalSold,
          total_units_refilled: totalRefilled,
          total_units_removed: totalRemoved,
          total_units_surplus_shortage: totalDiscrepancy,
          total_current_stock: totalCurrentStock,
          total_toy_capacity: totalCapacity,
          total_issues_reported: totalIssues,
          image_url: photoUrl,
          general_notes: generalNotes || null,
          observation_text: hasObservation ? observation : null,
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
        
        const { data: workOrders } = await supabase
          .from('work_orders')
          .insert(workOrdersToInsert)
          .select('id');
        
        if (workOrders) {
          createdWorkOrderIds.push(...workOrders.map(wo => wo.id));
        }
      }
      
      // Create work order for observation if flagged
      if (hasObservation && observation) {
        const { data: obsWorkOrder } = await supabase
          .from('work_orders')
          .insert({
            company_id: profile?.company_id!,
            location_id: selectedLocation,
            issue_type: 'Observation',
            description: observation,
            status: 'pending',
          })
          .select('id')
          .single();
        
        if (obsWorkOrder) {
          createdWorkOrderIds.push(obsWorkOrder.id);
        }
      }

      // Insert stock records with the new schema
      const stockRecords: any[] = [];

      machineAudits.forEach(machine => {
        machine.slots.forEach(slot => {
          if (slot.toy_id || slot.replacement_toy_id) {
            const productId = slot.is_replacing_toy ? slot.replacement_toy_id : slot.toy_id;
            const product = products?.find(p => p.id === productId);
            const replacementProduct = slot.replacement_toy_id ? products?.find(p => p.id === slot.replacement_toy_id) : null;
            const surplusShortage = slot.is_replacing_toy 
              ? slot.removed_for_replacement - (slot.last_stock - slot.units_sold) 
              : slot.discrepancy;
            
            // Calculate days since last refill
            const slotData = machineSlots?.find(ms => ms.id === slot.slot_id);
            const daysSinceRefill = slotData?.last_refill_date 
              ? differenceInDays(new Date(), new Date(slotData.last_refill_date))
              : null;
            
            // Calculate total revenue for this slot
            const totalRevenue = slot.units_sold * slot.price_per_unit;

            stockRecords.push({
              // THE LINKS (IDs)
              visit_report_id: report.id,
              company_id: profile?.company_id!,
              employee_id: user!.id,
              machine_toy_slot_id: slot.slot_id,
              machine_id: machine.machine_id,
              toy_id: productId,
              location_id: selectedLocation,
              location_spot_id: selectedSpot,
              replacement_toy_id: slot.is_replacing_toy ? slot.replacement_toy_id : null,
              
              // THE SNAPSHOTS (Text)
              location_name_snapshot: selectedLocationData?.name || 'Unknown',
              spot_name_snapshot: selectedSpotData?.place_name || `Spot #${selectedSpotData?.spot_number}`,
              machine_serial_snapshot: machine.serial_number,
              toy_name_snapshot: product?.product_name || slot.toy_name || 'Unknown',
              slot_position_snapshot: `Slot ${slot.slot_number}`,
              replacement_toy_name: replacementProduct?.product_name || null,
              
              // THE MONEY & MATH
              unit_price_snapshot: slot.price_per_unit,
              cost_per_unit_snapshot: product?.cogs || 0,
              units_sold: slot.units_sold,
              total_revenue: totalRevenue,
              
              // THE OPERATIONS
              units_refilled: slot.units_refilled,
              units_removed: slot.units_removed,
              capacity_snapshot: slot.toy_capacity,
              days_since_last_refill: daysSinceRefill,
              
              // THE ISSUES & AUDITS
              units_audited: slot.audited_count,
              units_shortage_surplus: surplusShortage,
              has_issue: slot.has_issue,
              jam_type: slot.jam_type,
              issue_severity: slot.has_issue ? slot.issue_severity : null,
              reported_issue: slot.has_issue ? slot.issue_description : null,
              reported_issue_photo_url: null,
              is_being_replaced: slot.is_replacing_toy,
              
              // METADATA
              visit_type: visitType,
              visit_date: new Date(visitDate).toISOString(),
            });
          }
        });
      });

      if (stockRecords.length > 0) {
        const { data: insertedStockRecords, error: stockError } = await supabase
          .from('visit_report_stock')
          .insert(stockRecords)
          .select('id');
        if (stockError) throw stockError;
        
        if (insertedStockRecords) {
          createdVisitReportStockIds.push(...insertedStockRecords.map(s => s.id));
        }
      }

      // Create log book entry for rollback capability
      // Note: machine_toy_movement_ids are created by trigger, we'll need to fetch them
      const { data: movements } = await supabase
        .from('machine_toy_movements')
        .select('id')
        .eq('visit_report_id', report.id);
      
      await supabase.from('submit_report_log_book').insert({
        visit_report_id: report.id,
        company_id: profile?.company_id!,
        employee_id: user!.id,
        created_visit_report_id: report.id,
        created_visit_report_stock_ids: createdVisitReportStockIds,
        created_work_order_ids: createdWorkOrderIds,
        created_machine_toy_movement_ids: movements?.map(m => m.id) || [],
        updated_machine_toy_slots: previousSlotValues,
        updated_location_spots: previousSpotValues,
        updated_locations: previousLocationValues,
        uploaded_photo_path: uploadedPhotoPath,
      });

      queryClient.invalidateQueries({ queryKey: ['visit_reports'] });
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['machine_toy_slots'] });
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      clearActiveDraft();
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
        {/* Draft Control Dropdown */}
        {drafts.length > 0 && (
          <Card className="bg-muted/30 border-muted">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">
                      {activeDraftId ? 'Working on draft' : 'Saved drafts available'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {drafts.length} draft{drafts.length !== 1 ? 's' : ''} saved
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Drafts
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 bg-popover">
                    <DropdownMenuLabel>Saved Drafts</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {drafts.map((draft) => (
                      <div key={draft.id} className="flex items-center justify-between px-2 py-1 hover:bg-accent rounded-sm">
                        <DropdownMenuItem
                          className="flex-1 cursor-pointer p-0"
                          onClick={() => loadDraft(draft)}
                        >
                          <div className="flex flex-col py-1">
                            <span className="text-sm font-medium">
                              {draft.selectedLocationName || 'No Location'} - {draft.selectedSpotName || 'No Spot'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(draft.savedAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </DropdownMenuItem>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            discardDraft(draft.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
              {lastVisitReport?.image_url && (
                <div className="mt-4 p-3 bg-background rounded-lg">
                  <div className="text-sm font-medium mb-2">Last Service Photo</div>
                  <div className="w-full max-w-[200px] mx-auto aspect-video overflow-hidden rounded-lg">
                    <img 
                      src={lastVisitReport.image_url} 
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
                            <div className="grid grid-cols-3 gap-2">
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
                                <Label className="text-xs">Price/Unit ($)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  value={slot.price_per_unit}
                                  onChange={(e) => updateSlotField(machineIndex, slotIndex, 'price_per_unit', parseFloat(e.target.value) || 1.00)}
                                  className="h-8"
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
                                <div className="space-y-1">
                                  <Label className="text-xs">Price Per Unit ($)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    value={slot.price_per_unit}
                                    onChange={(e) => updateSlotField(machineIndex, slotIndex, 'price_per_unit', parseFloat(e.target.value) || 1.00)}
                                    className="h-8"
                                  />
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

                                <div className="grid grid-cols-2 gap-2 text-sm p-2 bg-muted/30 rounded">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Calculated Stock:</span>
                                    <span className="font-bold">{slot.calculated_stock}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs">Price/Unit:</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      value={slot.price_per_unit}
                                      onChange={(e) => updateSlotField(machineIndex, slotIndex, 'price_per_unit', parseFloat(e.target.value) || 1.00)}
                                      className="h-6 w-16 text-xs"
                                    />
                                  </div>
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

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Save Draft Button - shown when not signed */}
              {!isSigned && (
                <Button 
                  onClick={() => saveDraft(true)}
                  variant="outline"
                  className="w-full" 
                  size="lg" 
                  disabled={isSavingDraft || (!selectedLocation && !selectedSpot && machineAudits.length === 0)}
                >
                  {isSavingDraft ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Draft...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Draft
                    </>
                  )}
                </Button>
              )}

              {/* Submit Button */}
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
            </div>
          </CardContent>
        </Card>
      </main>

      <MobileNav />
    </div>
  );
}