import './App.css'
import ChatLayoutGrid from './components/chat-layout'
import { ThemeProvider } from './components/theme-provider' 
import { BrowserRouter } from 'react-router'

function App() {

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ChatLayoutGrid />
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
