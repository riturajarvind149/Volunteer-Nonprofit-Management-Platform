import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OpportunityProvider } from './context/OpportunityContext'
import PublicLayout from './components/layout/PublicLayout'
import AppLayout from './components/layout/AppLayout'
import { LoadingState } from './components/ui'
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
import OpportunityForm from './pages/OpportunityForm/OpportunityForm'
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

const THEME_KEY = 'servehub_theme'

function useTheme() {
  // index.html sets data-theme before first paint; start from that value.
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  }, [theme])

  return [theme, () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))]
}

// BrowserRouter keeps the previous scroll position; start each new page at the top.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RequireAuth({ roles }) {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking your session…" />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()
  const [theme, toggleTheme] = useTheme()
  const themeProps = { theme, onToggleTheme: toggleTheme }

  return (
    <Routes>
      <Route element={<PublicLayout {...themeProps} />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout {...themeProps} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/opportunities/:id" element={<OpportunityDetails />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetails />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<RequireAuth roles={['VOLUNTEER']} />}>
            <Route path="/my-signups" element={<MySignups />} />
            <Route path="/my-hours" element={<VolunteerHours />} />
          </Route>

          <Route element={<RequireAuth roles={['COORDINATOR']} />}>
            <Route path="/manage-opportunities" element={<ManageOpportunities />} />
            <Route path="/opportunities/create" element={<OpportunityForm />} />
            <Route path="/opportunities/:id/edit" element={<OpportunityForm />} />
            <Route path="/opportunities/:id/attendees" element={<OpportunityAttendees />} />
            <Route path="/volunteers" element={<OpportunityAttendees />} />
            <Route path="/coordinator-hours" element={<CoordinatorHours />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/organization-profile" element={<OrgProfile />} />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={
          loading ? <LoadingState /> : isAuthenticated
            ? <AppLayout {...themeProps}><NotFound /></AppLayout>
            : <PublicLayout {...themeProps}><NotFound /></PublicLayout>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <OpportunityProvider>
        <ScrollToTop />
        <AppRoutes />
      </OpportunityProvider>
    </AuthProvider>
  )
}

export default App
