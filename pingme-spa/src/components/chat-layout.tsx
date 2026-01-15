import { AppSidebar } from "./app-sidebar";
import Header from "./app-header";
import ChatWindow from "./chat-window"
import { 
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Routes, Route } from 'react-router'

function ChatLayoutGrid() {
  return (
    <>
     <SidebarProvider
          style={
            {
              "--sidebar-width": "364px",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <SidebarInset>
            <header className="bg-background sticky top-0 flex shrink-0 items-center gap-2 border-b p-4">
              <SidebarTrigger className="-ml-1" />
            </header>
            <Routes>
              <Route path="/chat/:uuid" element={ <ChatWindow /> } />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
    </>
  )
}

export default ChatLayoutGrid
