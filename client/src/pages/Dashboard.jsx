import React from 'react';

const Dashboard = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F4F4F2', /* --bg-canvas */
      color: '#111111', /* --text-main */
      fontFamily: "'Nunito', sans-serif"
    }}>
      <h1 style={{ fontFamily: "'Sura', 'Sora', sans-serif", color: '#0047FF' }}>User Dashboard</h1>
      <p style={{ color: '#666666' }}>Manage your active Labs and view your XP here.</p>
    </div>
  );
};

export default Dashboard;
