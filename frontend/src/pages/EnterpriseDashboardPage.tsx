import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  Group,
  Description,
  Security,
  Storage,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  MoreVert,
  Download,
  Refresh,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const EnterpriseDashboardPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pilotStats, setPilotStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [complianceRes, teamsRes, pilotRes] = await Promise.all([
        axios.get('/api/compliance/dashboard?timeRange=month'),
        axios.get('/api/teams'),
        axios.get('/api/pilots/stats').catch(() => ({ data: { data: null } })),
      ]);

      setComplianceData(complianceRes.data.data);
      setTeams(teamsRes.data.data);
      setPilotStats(pilotRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      toast.loading('Generating compliance report...');
      const response = await axios.post('/api/compliance/report', {
        framework: 'ALL',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });
      toast.dismiss();
      toast.success('Compliance report generated successfully');
      loadDashboardData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate compliance report');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const complianceScore = complianceData?.overview?.complianceScore || 0;
  const totalDocuments = complianceData?.overview?.totalDocuments || 0;
  const activeViolations = complianceData?.overview?.violations || 0;
  const criticalViolations = complianceData?.overview?.criticalViolations || 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Enterprise Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive overview of your organization's document management and compliance
          </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDashboardData}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleGenerateReport}
          >
            Generate Report
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Compliance Score
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {complianceScore}%
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'primary.light', p: 1.5, borderRadius: 2 }}>
                  <Security sx={{ fontSize: 32, color: 'primary.main' }} />
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={complianceScore}
                sx={{ mt: 2, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Documents
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {totalDocuments}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'info.light', p: 1.5, borderRadius: 2 }}>
                  <Description sx={{ fontSize: 32, color: 'info.main' }} />
                </Box>
              </Box>
              <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
                <TrendingUp sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                +12% from last month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Teams
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {teams.length}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'success.light', p: 1.5, borderRadius: 2 }}>
                  <Group sx={{ fontSize: 32, color: 'success.main' }} />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Total members: {teams.reduce((sum, team) => sum + (team._count?.members || 0), 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Violations
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color={criticalViolations > 0 ? 'error.main' : 'text.primary'}>
                    {activeViolations}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: activeViolations > 0 ? 'error.light' : 'success.light', p: 1.5, borderRadius: 2 }}>
                  {activeViolations > 0 ? (
                    <Warning sx={{ fontSize: 32, color: 'error.main' }} />
                  ) : (
                    <CheckCircle sx={{ fontSize: 32, color: 'success.main' }} />
                  )}
                </Box>
              </Box>
              {criticalViolations > 0 && (
                <Alert severity="error" sx={{ mt: 2, py: 0 }}>
                  {criticalViolations} critical
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pilot Program Alert */}
      {pilotStats && pilotStats.activePilots > 0 && (
        <Alert severity="info" icon={<TrendingUp />} sx={{ mb: 3 }}>
          <strong>Active Pilot Programs:</strong> {pilotStats.activePilots} pilot(s) running with{' '}
          {pilotStats.totalParticipants} participant(s). Average satisfaction: {pilotStats.avgSatisfaction?.toFixed(1)}/5
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)}>
          <Tab label="Overview" />
          <Tab label="Teams" />
          <Tab label="Compliance" />
          <Tab label="Activity" />
          {pilotStats && <Tab label="Pilot Programs" />}
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Compliance Trends
              </Typography>
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography color="text.secondary">Chart visualization would go here</Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Storage Usage
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Total Storage</Typography>
                  <Typography variant="body2" fontWeight="bold">2.4 GB / 10 GB</Typography>
                </Box>
                <LinearProgress variant="determinate" value={24} sx={{ height: 8, borderRadius: 4 }} />
                
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Storage by Type
                  </Typography>
                  {[
                    { type: 'Documents', value: 45, color: 'primary' },
                    { type: 'Images', value: 30, color: 'success' },
                    { type: 'Others', value: 25, color: 'warning' },
                  ].map((item) => (
                    <Box key={item.type} sx={{ mb: 1.5 }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">{item.type}</Typography>
                        <Typography variant="caption">{item.value}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={item.value}
                        color={item.color as any}
                        sx={{ height: 4, borderRadius: 2 }}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Documents</Typography>
                <Button size="small">View All</Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Document Name</TableCell>
                      <TableCell>Team</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Uploaded</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell>Document {i}</TableCell>
                        <TableCell>Team Alpha</TableCell>
                        <TableCell>
                          <Chip label="Signed" color="success" size="small" />
                        </TableCell>
                        <TableCell>2 hours ago</TableCell>
                        <TableCell align="right">
                          <IconButton size="small">
                            <MoreVert />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Teams Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {teams.map((team) => (
            <Grid item xs={12} md={6} key={team.id}>
              <Card elevation={2}>
                <CardHeader
                  title={team.name}
                  subheader={team.description || 'No description'}
                  action={
                    <IconButton>
                      <MoreVert />
                    </IconButton>
                  }
                />
                <CardContent>
                  <Box display="flex" gap={2} mb={2}>
                    <Chip
                      icon={<Group />}
                      label={`${team._count?.members || 0} members`}
                      size="small"
                    />
                    <Chip
                      icon={<Description />}
                      label={`${team._count?.documents || 0} documents`}
                      size="small"
                    />
                    {team.subscription && (
                      <Chip
                        label={team.subscription.tier}
                        color="primary"
                        size="small"
                      />
                    )}
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Owner: {team.owner.displayName || team.owner.email}
                    </Typography>
                    <Button size="small" variant="outlined">
                      Manage
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {teams.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Group sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No teams yet
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Create your first team to start collaborating
                </Typography>
                <Button variant="contained">
                  Create Team
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Compliance Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {complianceData?.alerts?.active && complianceData.alerts.active.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {complianceData.alerts.active.length} Active Compliance Issues
                </Typography>
                <Typography variant="body2">
                  Immediate action required on critical violations
                </Typography>
              </Alert>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Compliance by Framework
              </Typography>
              <Box sx={{ mt: 2 }}>
                {['HIPAA', 'SOX', 'GDPR', 'SOC2'].map((framework) => (
                  <Box key={framework} sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">{framework}</Typography>
                      <Chip
                        label="Compliant"
                        color="success"
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Compliance Reports
              </Typography>
              <Box sx={{ mt: 2 }}>
                {[1, 2, 3].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      mb: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        Monthly Compliance Report
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Generated {i} day(s) ago
                      </Typography>
                    </Box>
                    <Button size="small" startIcon={<Download />}>
                      Download
                    </Button>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Activity Tab */}
      <TabPanel value={tabValue} index={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell>Document Signed</TableCell>
                    <TableCell>user{i}@example.com</TableCell>
                    <TableCell>contract_{i}.pdf</TableCell>
                    <TableCell>{i} hour(s) ago</TableCell>
                    <TableCell>
                      <Chip
                        icon={<CheckCircle />}
                        label="Success"
                        color="success"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* Pilot Programs Tab */}
      {pilotStats && (
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Pilots
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {pilotStats.activePilots || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Participants
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {pilotStats.totalParticipants || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Participants
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {pilotStats.activeParticipants || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Avg Satisfaction
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {pilotStats.avgSatisfaction?.toFixed(1) || 'N/A'}/5
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Recent Pilot Activity</Typography>
                  <Button variant="outlined" href="/pilots">
                    View All Pilots
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  {pilotStats.recentPilots?.map((pilot: any) => (
                    <Grid item xs={12} md={6} key={pilot.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                            <Typography variant="h6">{pilot.name}</Typography>
                            <Chip label={pilot.status} size="small" color={pilot.status === 'ACTIVE' ? 'success' : 'default'} />
                          </Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {pilot.industry}
                          </Typography>
                          <Box mt={2}>
                            <Typography variant="body2" color="text.secondary">
                              Progress: {pilot.currentParticipants}/{pilot.targetParticipants}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(pilot.currentParticipants / pilot.targetParticipants) * 100}
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  )) || (
                    <Grid item xs={12}>
                      <Alert severity="info">No pilot programs active yet.</Alert>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      )}
    </Box>
  );
};

export default EnterpriseDashboardPage;
