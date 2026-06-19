import type { Meta, StoryObj } from "@storybook/react";
import { Home, CalendarDays, Users, Settings } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "./sidebar";

const meta: Meta = {
  title: "Primitivos/Sidebar",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

const items = [
  { title: "Inicio", icon: Home },
  { title: "Reservas", icon: CalendarDays },
  { title: "Usuarios", icon: Users },
  { title: "Ajustes", icon: Settings },
];

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-2 font-bold">SmartMenu</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <SidebarMenuItem key={it.title}>
                      <SidebarMenuButton tooltip={it.title}>
                        <Icon />
                        <span>{it.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-2 text-xs text-sidebar-foreground/70">v0.1</SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">Contenido</span>
        </header>
        <main className="p-4 text-sm text-muted-foreground">Área principal — togglealo con el botón o Ctrl/Cmd+B.</main>
      </SidebarInset>
    </SidebarProvider>
  ),
};
