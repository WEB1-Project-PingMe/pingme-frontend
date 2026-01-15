import Header from "./app-header" 
import { SidebarProvider } from "./ui/sidebar";
import { AppSidebar } from "./app-sidebar";

function ChatLayoutGrid() {
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </>
  )
}

export default ChatLayoutGrid;
