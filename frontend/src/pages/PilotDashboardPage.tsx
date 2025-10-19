import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Business,
  LocalHospital,
  Gavel,
  CheckCircle,
  Warning,
  Timeline,
} from '@mui/icons-material';
import { PilotProgram, PilotParticipant, IndustryType } from '../../../shared/src/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pilot-tabpanel-${index}`}
      aria-labelledby={`pilot-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PilotDashboardPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [pilots, setPilots] = useState<PilotProgram[]>([]);
  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNewPilot, setOpenNewPilot] = useState(false);
  const [openFeedback, setOpenFeedback] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [newPilot, setNewPilot] = useState({
    name: '',
    industry: 'LAW_FIRM' as IndustryType,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    targetParticipants: 10,
  });
  const [feedback, setFeedback] = useState({
    rating: 5,
    feedback: '',
    suggestions: '',
  });

  useEffect(() => {
    fetchPilotData();
  }, []);

  const fetchPilotData = async () => {
    try {
      setLoading(true);
      const [pilotsRes, participantsRes] = await Promise.all([
        fetch('/api/pilots', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/pilots/participants', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (pilotsRes.ok && participantsRes.ok) {
        setPilots(await pilotsRes.json());
        setParticipants(await participantsRes.json());
      }
    } catch (error) {
      console.error('Error fetching pilot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePilot = async () => {
    try {
      const response = await fetch('/api/pilots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newPilot),
      });

      if (response.ok) {
        setOpenNewPilot(false);
        fetchPilotData();
        setNewPilot({
          name: '',
          industry: 'LAW_FIRM',
          description: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          targetParticipants: 10,
        });
      }
    } catch (error) {
      console.error('Error creating pilot:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedParticipant) return;

    try {
      const response = await fetch(`/api/pilots/participants/${selectedParticipant}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(feedback),
      });

      if (response.ok) {
        setOpenFeedback(false);
        setSelectedParticipant(null);
        fetchPilotData();
        setFeedback({ rating: 5, feedback: '', suggestions: '' });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const getIndustryIcon = (industry: IndustryType) => {
    switch (industry) {
      case 'LAW_FIRM':
        return <Gavel />;
      case 'HEALTHCARE':
        return <LocalHospital />;
      default:
        return <Business />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'COMPLETED':
        return 'info';
      case 'PLANNING':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getParticipantStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'ONBOARDING':
        return 'info';
      case 'COMPLETED':
        return 'primary';
      case 'CHURNED':
        return 'error';
      default:
        return 'default';
    }
  };

  const calculatePilotMetrics = () => {
    const activePilots = pilots.filter((p) => p.status === 'ACTIVE').length;
    const totalParticipants = participants.length;
    const activeParticipants = participants.filter((p) => p.status === 'ACTIVE').length;
    const avgSatisfaction =
      participants.reduce((sum, p) => sum + (p.satisfactionScore || 0), 0) / totalParticipants || 0;

    return { activePilots, totalParticipants, activeParticipants, avgSatisfaction };
  };

  const metrics = calculatePilotMetrics();

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4 }}>
          <LinearProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            🚀 Pilot Programs Dashboard
          </Typography>
          <Button variant="contained" size="large" onClick={() => setOpenNewPilot(true)}>
            Launch New Pilot
          </Button>
        </Box>

        {/* Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Timeline color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Active Pilots
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.activePilots}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Business color="success" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Total Participants
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.totalParticipants}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CheckCircle color="info" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Active Users
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.activeParticipants}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUp color="warning" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Avg Satisfaction
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.avgSatisfaction.toFixed(1)}/5</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} aria-label="pilot tabs">
            <Tab label="Active Pilots" />
            <Tab label="Participants" />
            <Tab label="Analytics" />
          </Tabs>
        </Paper>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            {pilots.map((pilot) => (
              <Grid item xs={12} md={6} key={pilot.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getIndustryIcon(pilot.industry)}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          {pilot.name}
                        </Typography>
                      </Box>
                      <Chip label={pilot.status} color={getStatusColor(pilot.status) as any} size="small" />
                    </Box>

                    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                      {pilot.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress: {pilot.currentParticipants}/{pilot.targetParticipants} participants
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(pilot.currentParticipants / pilot.targetParticipants) * 100}
                        sx={{ mt: 1 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        Start: {new Date(pilot.startDate).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2">
                        End: {new Date(pilot.endDate).toLocaleDateString()}
                      </Typography>
                    </Box>

                    {pilot.successMetrics && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Success Metrics: {JSON.stringify(pilot.successMetrics)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {pilots.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No pilot programs yet. Launch your first pilot to get started!
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Industry</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Documents</TableCell>
                  <TableCell>Satisfaction</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell>{participant.organizationName}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getIndustryIcon(
                          pilots.find((p) => p.id === participant.pilotId)?.industry || 'LAW_FIRM'
                        )}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {pilots.find((p) => p.id === participant.pilotId)?.industry}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={participant.status}
                        color={getParticipantStatusColor(participant.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{participant.documentsProcessed || 0}</TableCell>
                    <TableCell>
                      {participant.satisfactionScore ? `${participant.satisfactionScore}/5` : 'N/A'}
                    </TableCell>
                    <TableCell>{new Date(participant.joinedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedParticipant(participant.id);
                          setOpenFeedback(true);
                        }}
                      >
                        Add Feedback
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {participants.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No participants yet. Invite organizations to join your pilot programs!
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Industry Distribution
                </Typography>
                {['LAW_FIRM', 'HEALTHCARE', 'FINANCE', 'MANUFACTURING'].map((industry) => {
                  const count = pilots.filter((p) => p.industry === industry).length;
                  const percentage = (count / pilots.length) * 100 || 0;
                  return (
                    <Box key={industry} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{industry}</Typography>
                        <Typography variant="body2">{count} pilots</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={percentage} />
                    </Box>
                  );
                })}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Participant Status
                </Typography>
                {['ONBOARDING', 'ACTIVE', 'COMPLETED', 'CHURNED'].map((status) => {
                  const count = participants.filter((p) => p.status === status).length;
                  const percentage = (count / participants.length) * 100 || 0;
                  return (
                    <Box key={status} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{status}</Typography>
                        <Typography variant="body2">{count} participants</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={percentage} />
                    </Box>
                  );
                })}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Key Insights
                </Typography>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <strong>High Engagement:</strong> {metrics.activeParticipants} out of{' '}
                  {metrics.totalParticipants} participants are actively using the platform
                </Alert>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Satisfaction Rate:</strong> Average satisfaction score is{' '}
                  {metrics.avgSatisfaction.toFixed(1)}/5
                </Alert>
                {metrics.avgSatisfaction < 3 && (
                  <Alert severity="warning">
                    <strong>Action Needed:</strong> Average satisfaction is below target. Consider
                    gathering feedback to improve the pilot experience.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>

      {/* New Pilot Dialog */}
      <Dialog open={openNewPilot} onClose={() => setOpenNewPilot(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Launch New Pilot Program</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Pilot Name"
              value={newPilot.name}
              onChange={(e) => setNewPilot({ ...newPilot, name: e.target.value })}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Industry</InputLabel>
              <Select
                value={newPilot.industry}
                label="Industry"
                onChange={(e) => setNewPilot({ ...newPilot, industry: e.target.value as IndustryType })}
              >
                <MenuItem value="LAW_FIRM">Law Firm</MenuItem>
                <MenuItem value="HEALTHCARE">Healthcare</MenuItem>
                <MenuItem value="FINANCE">Finance</MenuItem>
                <MenuItem value="MANUFACTURING">Manufacturing</MenuItem>
                <MenuItem value="EDUCATION">Education</MenuItem>
                <MenuItem value="REAL_ESTATE">Real Estate</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Description"
              value={newPilot.description}
              onChange={(e) => setNewPilot({ ...newPilot, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Start Date"
              type="date"
              value={newPilot.startDate}
              onChange={(e) => setNewPilot({ ...newPilot, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="End Date"
              type="date"
              value={newPilot.endDate}
              onChange={(e) => setNewPilot({ ...newPilot, endDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Target Participants"
              type="number"
              value={newPilot.targetParticipants}
              onChange={(e) => setNewPilot({ ...newPilot, targetParticipants: parseInt(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewPilot(false)}>Cancel</Button>
          <Button onClick={handleCreatePilot} variant="contained">
            Launch Pilot
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={openFeedback} onClose={() => setOpenFeedback(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Participant Feedback</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Rating</InputLabel>
              <Select
                value={feedback.rating}
                label="Rating"
                onChange={(e) => setFeedback({ ...feedback, rating: e.target.value as number })}
              >
                <MenuItem value={5}>5 - Excellent</MenuItem>
                <MenuItem value={4}>4 - Good</MenuItem>
                <MenuItem value={3}>3 - Average</MenuItem>
                <MenuItem value={2}>2 - Poor</MenuItem>
                <MenuItem value={1}>1 - Very Poor</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Feedback"
              value={feedback.feedback}
              onChange={(e) => setFeedback({ ...feedback, feedback: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />

            <TextField
              label="Suggestions for Improvement"
              value={feedback.suggestions}
              onChange={(e) => setFeedback({ ...feedback, suggestions: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFeedback(false)}>Cancel</Button>
          <Button onClick={handleSubmitFeedback} variant="contained">
            Submit Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
