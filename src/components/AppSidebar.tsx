import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Route,
  Wrench,
  Cpu,
  Settings2,
  Package,
  BoxIcon,
  Truck,
  ShoppingCart,
  Shield,
  MessageSquare,
  Megaphone,
  User,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
];

const operationsItems = [
  { title: "Locations", url: "/locations", icon: MapPin },
  { title: "Visit Reports", url: "/visit-reports", icon: ClipboardList },
  { title: "Routes", url: "/routes", icon: Route },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
];

const assetsItems = [
  { title: "Machines", url: "/machines", icon: Cpu },
  { title: "Setups", url: "/setups", icon: Settings2 },
];

const warehouseItems = [
  { title: "Components", url: "/warehouse/components", icon: Package },
  { title: "Products", url: "/warehouse/products", icon: BoxIcon },
];

const supplyChainItems = [
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Purchases", url: "/purchases", icon: ShoppingCart },
];

const businessItems = [
  { title: "Compliance", url: "/compliance", icon: Shield },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
  { title: "Promotions", url: "/promotions", icon: Megaphone },
];

interface NavGroupProps {
  label: string;
  items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
  currentPath: string;
  collapsed: boolean;
  navigate: (url: string) => void;
}

function NavGroup({ label, items, currentPath, collapsed, navigate }: NavGroupProps) {
  const isActive = items.some((item) => item.url === currentPath);

  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger className="w-full">
          <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2">
            {!collapsed && <span>{label}</span>}
            {!collapsed && (
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    className={cn(
                      "cursor-pointer",
                      currentPath === item.url && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        {/* Dashboard - no collapsible */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    className={cn(
                      "cursor-pointer",
                      currentPath === item.url && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavGroup
          label="Operations"
          items={operationsItems}
          currentPath={currentPath}
          collapsed={collapsed}
          navigate={navigate}
        />

        <NavGroup
          label="Assets"
          items={assetsItems}
          currentPath={currentPath}
          collapsed={collapsed}
          navigate={navigate}
        />

        <NavGroup
          label="Warehouse"
          items={warehouseItems}
          currentPath={currentPath}
          collapsed={collapsed}
          navigate={navigate}
        />

        <NavGroup
          label="Supply Chain"
          items={supplyChainItems}
          currentPath={currentPath}
          collapsed={collapsed}
          navigate={navigate}
        />

        <NavGroup
          label="Business"
          items={businessItems}
          currentPath={currentPath}
          collapsed={collapsed}
          navigate={navigate}
        />

        {/* Profile at bottom */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/profile")}
                  className={cn(
                    "cursor-pointer",
                    currentPath === "/profile" && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <User className="h-4 w-4" />
                  {!collapsed && <span>Profile</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
