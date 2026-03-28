"use client"

import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import type { ProjectRecord } from "@/shared/contracts/desktop-api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"

export function ProjectSwitcher({
  projects,
  selectedProjectId,
  onSelectProject,
}: {
  projects: ProjectRecord[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
}) {
  const [search, setSearch] = React.useState("")

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  const filtered = [null, ...projects].filter((p) => {
    if (!search) return true
    const name = p === null ? "Все проекты" : p.name
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function getInitials(name: string) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={() => setSearch("")}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  {selectedProject ? getInitials(selectedProject.name) : "АП"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none min-w-0">
                <span className="font-medium truncate">
                  {selectedProject ? selectedProject.name : "Все проекты"}
                </span>
                {selectedProject?.rootPath && (
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedProject.rootPath}
                  </span>
                )}
              </div>
              <ChevronsUpDownIcon className="ml-auto shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width)"
            align="start"
          >
            <div className="px-2 py-1.5">
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            {filtered.map((p) => {
              const id = p === null ? null : p.id
              const name = p === null ? "Все проекты" : p.name
              const path = p === null ? null : p.rootPath
              const isActive = selectedProjectId === id
              return (
                <DropdownMenuItem
                  key={id ?? "__all__"}
                  onSelect={() => onSelectProject(id)}
                  className="gap-2"
                  data-active={isActive}
                >
                  <Avatar className="size-6 rounded-md shrink-0">
                    <AvatarFallback className="rounded-md text-[10px]">
                      {p === null ? "АП" : getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{name}</span>
                    {path && (
                      <span className="text-xs text-muted-foreground truncate">{path}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
