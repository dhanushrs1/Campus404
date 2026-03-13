import React from 'react';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';

const Dashboard = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F4F4F2' }}>
      <Header />
      <main style={{ flex: 1, paddingTop: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", color: '#0047FF', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          Welcome back! 👋
        </h1>
        <p style={{ fontFamily: "'Nunito', sans-serif", color: '#666', fontSize: '1.1rem' }}>
          Your personalized dashboard is coming soon. Labs, challenges, and XP await.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
