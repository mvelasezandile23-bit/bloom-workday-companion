import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck2, LayoutDashboard, Mail, MessageSquareHeart, ShieldCheck, Sparkles } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Email Generator", url: "/email", icon: Mail },
  { title: "Task Planner", url: "/planner", icon: CalendarCheck2 },
  { title: "Workplace Chat", url: "/chat", icon: MessageSquareHeart },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4">
        <Link to="/" onClick={close} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elevated">
            <Sparkles className="size-4.5" />
          </span>
          {!collapsed && (
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold text-foreground">Workplace AI</span>
              <span className="block text-xs text-muted-foreground">Productivity Assistant</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 rounded-xl font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link to={item.url} onClick={close}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Trust</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/responsible-ai"}
                  tooltip="Responsible AI"
                  className="h-10 rounded-xl font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                >
                  <Link to="/responsible-ai" onClick={close}>
                    <ShieldCheck />
                    <span>Responsible AI</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-3">
          <div className="rounded-2xl bg-gradient-soft border border-border p-4">
            <p className="text-sm font-semibold text-foreground">Private by design</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Everything runs in your browser. Your drafts and tasks never leave this device.
            </p>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
