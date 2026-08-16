import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import DeskLayout from './components/Layout'
import AgentsPage from './pages/Agents'
import ChangePasswordPage from './pages/ChangePassword'
import InboxPage from './pages/Inbox'
import LoginPage from './pages/Login'
import TicketDetailPage from './pages/TicketDetail'
import { deskSession } from './session'

function RequireAuth() {
  const token = deskSession.getToken()
  const agent = deskSession.getAgent()
  if (!token || !agent) return <Navigate to="/login" replace />
  if (agent.mustChangePassword) return <Navigate to="/trocar-senha" replace />
  return <Outlet />
}

function RequireMaster() {
  const agent = deskSession.getAgent()
  if (agent?.role !== 'master') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/trocar-senha" element={<ChangePasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<DeskLayout />}>
            <Route path="/" element={<InboxPage kind="support" />} />
            <Route path="/desenvolvimento" element={<InboxPage kind="development" />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route element={<RequireMaster />}>
              <Route path="/usuarios" element={<AgentsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
