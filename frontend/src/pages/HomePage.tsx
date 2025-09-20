import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Container,
  Stack,
  Chip,
  Avatar
} from '@mui/material';
import {
  Security,
  Cloud,
  Verified,
  Speed,
  Lock,
  AccountBalance
} from '@mui/icons-material';

const HomePage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h1" component="h1" gutterBottom>
          SafeDocs
        </Typography>
        <Typography variant="h4" component="h2" color="text.secondary" gutterBottom>
          Permanent, Compliant, and Verifiable e-Signatures
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, fontWeight: 400 }}>
          "Sign Once. Verify Forever."
        </Typography>
        <Typography variant="body1" sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}>
          Revolutionary e-signature and document compliance service built on Filecoin's 
          permanent storage infrastructure. Cryptographically verifiable, tamper-proof 
          document signing with provable audit trails that last decades.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" size="large">
            Connect Wallet to Start
          </Button>
          <Button variant="outlined" size="large">
            Learn More
          </Button>
        </Stack>
      </Box>

      {/* Key Benefits */}
      <Box sx={{ py: 8 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
          Key Value Propositions
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent sx={{ p: 4 }}>
                <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 2 }}>
                  <AccountBalance />
                </Avatar>
                <Typography variant="h5" gutterBottom>
                  80% Cost Reduction
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Significantly lower costs compared to DocuSign Enterprise
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent sx={{ p: 4 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                  <Verified />
                </Avatar>
                <Typography variant="h5" gutterBottom>
                  Cryptographically Verifiable
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Document integrity with Proof of Data Possession (PDP)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent sx={{ p: 4 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 2 }}>
                  <Cloud />
                </Avatar>
                <Typography variant="h5" gutterBottom>
                  Permanent Storage
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Through Filecoin's decentralized network
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Technology Features */}
      <Box sx={{ py: 8, bgcolor: 'background.paper', borderRadius: 2, my: 4 }}>
        <Container>
          <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
            Built on Filecoin Onchain Cloud
          </Typography>
          <Typography variant="body1" textAlign="center" sx={{ mb: 6, color: 'text.secondary' }}>
            SafeDocs leverages the full Filecoin ecosystem for enterprise-grade document management
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Security sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  WarmStorage + PDP
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tamper-proof document storage
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Speed sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  FilCDN
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Global document retrieval
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <AccountBalance sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Filecoin Pay
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Flexible business models
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Synapse SDK
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wallet-based authentication
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Compliance */}
      <Box sx={{ py: 8 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
          Compliance-Ready
        </Typography>
        <Typography variant="body1" textAlign="center" sx={{ mb: 4, color: 'text.secondary' }}>
          Built for regulated industries with comprehensive compliance frameworks
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
          <Chip label="HIPAA" color="primary" />
          <Chip label="SOX" color="primary" />
          <Chip label="GDPR" color="primary" />
          <Chip label="SOC 2" color="primary" />
          <Chip label="ISO 27001" color="primary" />
        </Stack>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'primary.main', borderRadius: 2, color: 'white' }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Ready to Get Started?
        </Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
          Join the future of digital trust on Filecoin's permanent storage infrastructure
        </Typography>
        <Button 
          variant="contained" 
          size="large"
          sx={{ 
            bgcolor: 'white', 
            color: 'primary.main',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          Connect Your Wallet
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;