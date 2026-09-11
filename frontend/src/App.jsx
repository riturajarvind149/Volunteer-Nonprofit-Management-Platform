import React from 'react';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  return (
    <div className="app">
      <Navbar />

      <main className="main-content">
        <div className="container">
          <div className="welcome-box">
            <h1>Volunteer & Nonprofit Management Platform</h1>
            <p>
              Foundation ready. ServeHub connects passionate volunteers with
              community organizations to create meaningful impact.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
