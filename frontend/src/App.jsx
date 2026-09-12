import { useState } from 'react';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import './App.css';

/**
 * Root Application Component
 * Volunteer & Nonprofit Management Platform
 */
function App() {
  const [currentPage, setCurrentPage] = useState('login');

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'signup' ? (
        <SignupPage onNavigate={handleNavigate} />
      ) : (
        <LoginPage onNavigate={handleNavigate} />
      )}
    </Layout>
  );
}

export default App;
