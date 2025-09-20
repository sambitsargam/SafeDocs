import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWallet, formatAddress, getNetworkInfo } from '../../hooks/useWallet';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { connectWallet, disconnectWallet, isConnecting, isConnected, address, chainId } = useWallet();

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  const handleLogout = () => {
    disconnectWallet();
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              flexGrow: 1, 
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'primary.main'
            }}
            onClick={() => navigate('/')}
          >
            SafeDocs
          </Typography>
          
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button color="inherit" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button color="inherit" onClick={() => navigate('/documents')}>
                Documents
              </Button>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {user?.displayName || `${user?.walletAddress?.slice(0, 6)}...${user?.walletAddress?.slice(-4)}`}
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleLogout}
                sx={{ color: 'primary.main', borderColor: 'primary.main' }}
              >
                Disconnect
              </Button>
            </Box>
          ) : (
            <Button 
              variant="contained" 
              onClick={handleConnectWallet}
              disabled={isConnecting}
              sx={{ ml: 2 }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {children}
        </Container>
      </Box>

      <Box 
        component="footer" 
        sx={{ 
          bgcolor: 'background.paper', 
          borderTop: 1, 
          borderColor: 'divider',
          py: 2
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 SafeDocs. Built on Filecoin for permanent, verifiable document storage.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;