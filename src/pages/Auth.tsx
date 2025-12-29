import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Building2, User, Briefcase } from 'lucide-react';
import { z } from 'zod';

// Language options
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
];

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

// Currency options
const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
];

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = authSchema.extend({
  // Required personal fields
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required for operational alerts'),
  // Required company fields
  companyName: z.string().min(1, 'Company name is required'),
  // Optional but recommended
  timezone: z.string().min(1, 'Please select your timezone'),
  preferredLanguage: z.string().min(1, 'Please select your language'),
  billingCurrency: z.string().min(1, 'Please select billing currency'),
  // Optional fields
  jobTitle: z.string().optional(),
  address: z.string().optional(),
  companyEmail: z.string().email('Invalid company email').optional().or(z.literal('')),
  taxId: z.string().optional(),
  supportPhone: z.string().optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    // Step 1: Account credentials
    email: '',
    password: '',
    // Step 2: Personal info
    firstName: '',
    lastName: '',
    phoneNumber: '',
    jobTitle: '',
    preferredLanguage: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    // Step 3: Company info
    companyName: '',
    address: '',
    companyEmail: '',
    taxId: '',
    supportPhone: '',
    billingCurrency: 'USD',
  });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      authSchema.parse(loginData);
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;
      toast.success('Welcome back!');
      navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (step: number): boolean => {
    try {
      if (step === 1) {
        authSchema.parse({ email: signupData.email, password: signupData.password });
      } else if (step === 2) {
        z.object({
          firstName: z.string().min(1, 'First name is required'),
          lastName: z.string().min(1, 'Last name is required'),
          phoneNumber: z.string().min(1, 'Phone number is required'),
          timezone: z.string().min(1, 'Timezone is required'),
          preferredLanguage: z.string().min(1, 'Language is required'),
        }).parse({
          firstName: signupData.firstName,
          lastName: signupData.lastName,
          phoneNumber: signupData.phoneNumber,
          timezone: signupData.timezone,
          preferredLanguage: signupData.preferredLanguage,
        });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep(signupStep)) {
      setSignupStep(signupStep + 1);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      signupSchema.parse(signupData);
      setLoading(true);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: signupData.firstName,
            last_name: signupData.lastName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create company with new fields
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ 
          name: signupData.companyName,
          address: signupData.address || null,
          phone_number: signupData.phoneNumber || null,
          company_email: signupData.companyEmail || null,
          tax_id: signupData.taxId || null,
          support_phone: signupData.supportPhone || null,
          billing_currency: signupData.billingCurrency,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create profile with new fields
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          company_id: company.id,
          first_name: signupData.firstName,
          last_name: signupData.lastName,
          email: signupData.email,
          phone_number: signupData.phoneNumber || null,
          job_title: signupData.jobTitle || null,
          preferred_language: signupData.preferredLanguage,
          timezone: signupData.timezone,
          start_date: new Date().toISOString().split('T')[0],
          account_status: 'active',
        });

      if (profileError) throw profileError;

      // Create admin role for company creator
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'admin',
        });

      if (roleError) throw roleError;

      toast.success('Account created successfully! You are now the company admin.');
      navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderSignupStep = () => {
    switch (signupStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Step 1 of 3: Account Credentials</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email Address *</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@company.com"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password *</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                required
              />
            </div>
            <Button type="button" className="w-full" onClick={handleNextStep}>
              Continue
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Step 2 of 3: Personal Information</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={signupData.firstName}
                  onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={signupData.lastName}
                  onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={signupData.phoneNumber}
                onChange={(e) => setSignupData({ ...signupData, phoneNumber: e.target.value })}
                placeholder="For urgent alerts & notifications"
                required
              />
              <p className="text-xs text-muted-foreground">Used for stock-out and machine issue alerts</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={signupData.jobTitle}
                onChange={(e) => setSignupData({ ...signupData, jobTitle: e.target.value })}
                placeholder="e.g., Operations Manager, Owner"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">Language *</Label>
                <Select 
                  value={signupData.preferredLanguage} 
                  onValueChange={(value) => setSignupData({ ...signupData, preferredLanguage: value })}
                >
                  <SelectTrigger id="preferredLanguage">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone *</Label>
                <Select 
                  value={signupData.timezone} 
                  onValueChange={(value) => setSignupData({ ...signupData, timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSignupStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="button" onClick={handleNextStep} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Briefcase className="h-4 w-4" />
              <span className="text-sm font-medium">Step 3 of 3: Company Information</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={signupData.companyName}
                onChange={(e) => setSignupData({ ...signupData, companyName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCurrency">Billing Currency *</Label>
              <Select 
                value={signupData.billingCurrency} 
                onValueChange={(value) => setSignupData({ ...signupData, billingCurrency: value })}
              >
                <SelectTrigger id="billingCurrency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Input
                id="address"
                value={signupData.address}
                onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={signupData.companyEmail}
                  onChange={(e) => setSignupData({ ...signupData, companyEmail: e.target.value })}
                  placeholder="info@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  type="tel"
                  value={signupData.supportPhone}
                  onChange={(e) => setSignupData({ ...signupData, supportPhone: e.target.value })}
                  placeholder="Customer hotline"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / VAT Number</Label>
              <Input
                id="taxId"
                value={signupData.taxId}
                onChange={(e) => setSignupData({ ...signupData, taxId: e.target.value })}
                placeholder="For invoices & compliance"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              As the company creator, you will be assigned the <strong>Admin</strong> role. 
              You can invite team members and assign roles later.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSignupStep(2)} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Vending ERP</CardTitle>
          <CardDescription>Manage your vending machine operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={() => setSignupStep(1)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Login'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                {renderSignupStep()}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
