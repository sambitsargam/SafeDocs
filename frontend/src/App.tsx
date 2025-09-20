import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import DocumentsPage from './pages/DocumentsPage';
import SigningPage from './pages/SigningPage';
import VerificationPage from './pages/VerificationPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './store/authStore';

function App(): JSX.Element {
  const { isAuthenticated } = useAuthStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route 
            path="/dashboard" 
            element={isAuthenticated ? <DashboardPage /> : <Navigate to="/" />} 
          />
          <Route 
            path="/documents" 
            element={isAuthenticated ? <DocumentsPage /> : <Navigate to="/" />} 
          />
          <Route 
            path="/documents/:id/sign" 
            element={isAuthenticated ? <SigningPage /> : <Navigate to="/" />} 
          />
          <Route path="/verify/:id" element={<VerificationPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Box>
  );
}

export default App;