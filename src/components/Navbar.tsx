import { House, BookOpen, Notebook, Gear, ShieldCheck } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { useNav } from "@/hooks/use-nav";
import { useAuth } from "@/hooks/use-auth";
import logo from "../icons/extra.jpg";
import en from "@/locales/en";

export default function Navbar() {
  const { state } = useSidebar();
  const { page, setPage, timerActive } = useNav();
  const { user } = useAuth();

  const items = [
    { id: "Dashboard", title: en.nav.dashboard, icon: House },
    { id: "Tests", title: en.nav.tests, icon: BookOpen },
    { id: "Homework", title: en.nav.homework, icon: Notebook },
  ] as const;

  const adminItems = user?.role === "admin"
    ? [{ id: "Admin", title: en.nav.admin, icon: ShieldCheck } as const]
    : [];

  return (
    <Sidebar collapsible="icon" className="h-full">
      <SidebarHeader className="flex flex-row items-center h-9 px-3 py-0 gap-2">
        <img src={logo} alt={en.nav.logoAlt} className="w-5 h-5 rounded-sm shrink-0" />
        {state === "expanded" && (
          <span className="text-xs font-medium text-neutral-400">{en.nav.brand}</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={page === item.id}
                    onClick={() => setPage(item.id)}
                    disabled={timerActive && page !== item.id}
                  >
                    <item.icon weight="bold" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={page === item.id}
                    onClick={() => setPage(item.id)}
                    disabled={timerActive && page !== item.id}
                  >
                    <item.icon weight="bold" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={en.nav.settings}
              isActive={page === "Settings"}
              onClick={() => setPage("Settings")}
              disabled={timerActive}
            >
              <Gear weight="bold" />
              <span>{en.nav.settings}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
