"use client"

import * as React from "react"
import { ArchiveX, Command, File, Inbox, Send, Trash2, CircleUser } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Link } from 'react-router'

// This is sample data
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "pingME",
      url: "#",
      icon: Inbox,
      isActive: true,
    },
    {
      title: "Drafts",
      url: "#",
      icon: File,
      isActive: false,
    },
  ],

  chats: [
    {
      name: "William Smith",
      userImage: "example.png",
      date: "09:34 AM",
      message: "test message",
      id: "124566"
    },
    {
      name: "Alice Smith",
      userImage: "example.png",
      date: "Yesterday",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Bob Johnson",
      userImage: "example.png",
      date: "2 days ago",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Emily Davis",
      userImage: "example.png",
      date: "2 days ago",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Michael Wilson",
      date: "1 week ago",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Sarah Brown",
      email: "sarahbrown@example.com",
      userImage: "example.png",
      message: "test message",
      id: "1235343"
    },
    {
      name: "David Lee",
      email: "davidlee@example.com",
      userImage: "example.png",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Olivia Wilson",
      userImage: "example.png",
      date: "1 week ago",
      message: "test message",
      id: "1235343"
    },
    {
      name: "James Martin",
      userImage: "example.png",
      date: "1 week ago",
      message: "test message",
      id: "1235343"
    },
    {
      name: "Sophia White",
      email: "sophiawhite@example.com",
      userImage: "example.png",
      message: "test message",
      id: "1235343"
    }
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Note: I'm using state to show active item.
  // IRL you should use the url/router.
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const [chats, setchats] = React.useState(data.chats)
  const { setOpen } = useSidebar()

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                {/* TODO: update this */}
                <a href="#">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Acme Inc</span>
                    <span className="truncate text-xs">Enterprise</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item)
                        const chat = data.chats.sort(() => Math.random() - 0.5)
                        setchats(
                          chat.slice(
                            0,
                            Math.max(5, Math.floor(Math.random() * 10) + 1)
                          )
                        )
                        setOpen(true)
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground text-base font-medium">
              {activeItem?.title}
            </div>
          </div>
          <SidebarInput placeholder="Type to search..." />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
             {chats.map((chat) => (
                <Link
                  to={"/chat/" + chat.id}
                  key={chat.name}
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-4 border-b pl-4 py-4 text-sm leading-tight whitespace-nowrap last:border-b-0"
                >
                  <CircleUser size={32} />
                  <div className="flex w-[75%] flex-col">
                    <div className="flex w-full items-center gap-2">
                      <span>{chat.name}</span>{" "}
                      <span className="ml-auto text-xs">{chat.date}</span>
                    </div>
                    <span className="line-clamp-2 w-[260px] text-xs whitespace-break-spaces">
                      {chat.message}
                    </span>
                  </div>
                </Link>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
