import Navbar from './Navbar';
import './Layout.css';

/**
 * Layout Component
 * Provides the application shell structure with top navigation header.
 */
function Layout({ children, currentPage, onNavigate }) {
  return (
    <div className="app-layout">
      <Navbar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="main-content">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

export default Layout;
