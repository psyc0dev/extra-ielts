import { House, BookOpen, Notebook, Gear } from "@phosphor-icons/react";
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
import logo from "../../src-tauri/icons/icon.ico";
import en from "@/locales/en";

const items = [
  { title: en.nav.dashboard, icon: House },
  { title: en.nav.tests, icon: BookOpen },
  { title: en.nav.homework, icon: Notebook },
] as const;

export default function Navbar() {
  const { state } = useSidebar();
  const { page, setPage } = useNav();

  return (
    <Sidebar collapsible="icon" className="h-full">
      <SidebarHeader className="flex flex-row items-center h-9 px-3 py-0 gap-2">
        <img src={logo} alt="logo" className="w-5 h-5 rounded-sm shrink-0" />
        {state === "expanded" && (
          <span className="text-xs font-medium text-neutral-400">extra</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={page === item.title}
                    onClick={() => setPage(item.title)}
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
