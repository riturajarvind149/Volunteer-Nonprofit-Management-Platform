import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { OpportunityProvider } from './context/OpportunityContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
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
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('servehub_theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('servehub_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <AuthProvider>
      <OpportunityProvider>
        <div className="app">
          <Navbar theme={theme} onToggleTheme={toggleTheme} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/organizations" element={<Organizations />} />
            <Route path="/organizations/:id" element={<OrganizationDetails />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<OpportunityDetails />} />
            <Route path="/manage-opportunities" element={<ManageOpportunities />} />
            <Route path="/opportunities/create" element={<ManageOpportunities initialMode="create" />} />
            <Route path="/opportunities/:id/edit" element={<ManageOpportunities initialMode="edit" />} />
            <Route path="/my-signups" element={<MySignups />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
          <Footer />
        </div>
      </OpportunityProvider>
    </AuthProvider>
  )
}

export default App
