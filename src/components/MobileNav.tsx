import { NavLink } from 'react-router-dom';
import { Home, MapPin, ClipboardList, User, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export function MobileNav() {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/locations', icon: MapPin, label: 'Locations' },
    { to: '/visit-report', icon: ClipboardList, label: 'Report' },
  ];

  const menuItems = [
    { to: '/routes', label: 'Routes' },
    { to: '/maintenance', label: 'Maintenance' },
    { to: '/machines', label: 'Machines' },
    { to: '/setups', label: 'Setups' },
    { to: '/warehouse/components', label: 'Components' },
    { to: '/warehouse/products', label: 'Products' },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/purchases', label: 'Purchases' },
    { to: '/compliance', label: 'Compliance' },
    { to: '/feedback', label: 'Feedback' },
    { to: '/promotions', label: 'Promotions' },
    { to: '/profile', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="flex flex-col items-center justify-center flex-1 h-full gap-0 p-0 rounded-none">
              <Menu className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">More</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>All Features</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 mt-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'block p-4 rounded-lg transition-colors font-medium',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
