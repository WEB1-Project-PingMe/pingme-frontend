import './App.css'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'
import { ThemeProvider } from './components/theme-provider'

function App() {

  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
