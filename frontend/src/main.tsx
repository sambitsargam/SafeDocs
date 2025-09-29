import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { createAppKit } from '@reown/appkit';
import { base } from '@reown/appkit/networks';

import App from './App';
import { apolloClient } from './services/apollo';
import { theme } from './theme';

import './index.css';

// Get your project ID from https://cloud.reown.com
const projectId = process.env.VITE_REOWN_PROJECT_ID || 'your-project-id-here';

createAppKit({
  projectId,
  metadata: {
    name: 'SafeDocs',
    description: 'Secure Document Signing and Verification',
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`],
  },
  networks: [base],
  defaultNetwork: base,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppKitProvider client={appKit}>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <App />
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 5000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </BrowserRouter>
        </ThemeProvider>
      </ApolloProvider>
    </AppKitProvider>
  </React.StrictMode>
);