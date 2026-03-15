import React from 'react';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="user-dashboard">
      <Header />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1>Welcome back, <span>Developer!</span> 👋</h1>
          <p>Your personalized dashboard is coming soon. Labs, challenges, and XP await.</p>
        </div>

        <div className="dashboard-grid">
          <div className="floating-card">
            <h3>Active Labs</h3>
            <p>You have new labs available. Dive in to start earning some XP!</p>
          </div>
          <div className="floating-card">
            <h3>Recent Achievements</h3>
            <p>Complete more challenges to unlock exclusive badges and rewards.</p>
          </div>
          <div className="floating-card">
            <h3>Suggested Challenges</h3>
            <p>Based on your current level, we recommend checking out the new modules.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
