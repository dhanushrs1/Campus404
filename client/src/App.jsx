import { Routes, Route } from 'react-router-dom'
import Home      from './pages/Home'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Labs      from './pages/Labs'
import Lab       from './pages/Lab'
import Workspace from './pages/Workspace'

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Home />} />
      <Route path="/login"     element={<Login />} />
      <Route path="/register"  element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/labs"      element={<Labs />} />
      <Route path="/labs/:labId" element={<Lab />} />
      <Route path="/workspace" element={<Workspace />} />
    </Routes>
  )
}
