import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OpportunityProvider } from './context/OpportunityContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import AppLayout from './components/layout/AppLayout'
import Home from './pages/Home/Home'
import Organizations from './pages/Organizations/Organizations'
import OrganizationDetails from './pages/OrganizationDetails/OrganizationDetails'
import Opportunities from './pages/Opportunities/Opportunities'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import Profile from './pages/Profile/Profile'
import Dashboard from './pages/Dashboard/Dashboard'
import OpportunityDetails from './pages/OpportunityDetails/OpportunityDetails'
import MySignups from './pages/MySignups/MySignups'
import ManageOpportunities from './pages/ManageOpportunities/ManageOpportunities'
import VolunteerHours from './pages/VolunteerHours/VolunteerHours'
import CoordinatorHours from './pages/CoordinatorHours/CoordinatorHours'
import OpportunityAttendees from './pages/OpportunityAttendees/OpportunityAttendees'
import Analytics from './pages/Analytics/Analytics'
import Reports from './pages/Reports/Reports'
import Notifications from './pages/Notifications/Notifications'
import OrgProfile from './pages/OrgProfile/OrgProfile'
import Privacy from './pages/Privacy/Privacy'
import Terms from './pages/Terms/Terms'
import NotFound from './pages/NotFound/NotFound'
import './App.css'

const PUBLIC_ONLY_ROUTES = ['/', '/login', '/register', '/privacy', '/terms']

function AppInner() {
  const location = useLocation()
  const { isAuthenticated, loading } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('servehub_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('servehub_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  const useAppLayout = !loading && isAuthenticated && !PUBLIC_ONLY_ROUTES.includes(location.pathname)

  if (useAppLayout) {
    return (
      <AppLayout theme={theme} onToggleTheme={toggleTheme}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetails />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/opportunities/create" element={<ManageOpportunities initialMode="create" />} />
          <Route path="/opportunities/:id/edit" element={<ManageOpportunities initialMode="edit" />} />
          <Route path="/opportunities/:id/attendees" element={<OpportunityAttendees />} />
          <Route path="/opportunities/:id" element={<OpportunityDetails />} />
          <Route path="/manage-opportunities" element={<ManageOpportunities />} />
          <Route path="/my-signups" element={<MySignups />} />
          <Route path="/my-hours" element={<VolunteerHours />} />
          <Route path="/coordinator-hours" element={<CoordinatorHours />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/organization-profile" element={<OrgProfile />} />
          <Route path="/volunteers" element={<OpportunityAttendees />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    )
  }

  return (
    <div className="app">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/opportunities/:id" element={<OpportunityDetails />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/:id" element={<OrganizationDetails />} />
        <Route path="/opportunities/create" element={<ManageOpportunities initialMode="create" />} />
        <Route path="/opportunities/:id/edit" element={<ManageOpportunities initialMode="edit" />} />
        <Route path="/opportunities/:id/attendees" element={<OpportunityAttendees />} />
        <Route path="/manage-opportunities" element={<ManageOpportunities />} />
        <Route path="/my-signups" element={<MySignups />} />
        <Route path="/my-hours" element={<VolunteerHours />} />
        <Route path="/coordinator-hours" element={<CoordinatorHours />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/organization-profile" element={<OrgProfile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <OpportunityProvider>
        <AppInner />
      </OpportunityProvider>
    </AuthProvider>
  )
}

export default App
