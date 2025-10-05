import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Download,
  Refresh,
  Assessment,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Visibility,
  DateRange,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface ComplianceReport {
  id: string;
  framework: string;
  generatedBy: {
    displayName?: string;
    email?: string;
  };
  timeRange: {
    start: string;
    end: string;
  };
  certificationStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  summary: {
    complianceScore: number;
    totalDocuments: number;
    compliantDocuments: number;
    riskLevel: string;
  };
  createdAt: string;
}

const ComplianceReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  
  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>('ALL');
  
  // Generate report form
  const [framework, setFramework] = useState('ALL');
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    loadReports();
  }, [frameworkFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter !== 'ALL') {
        params.append('framework', frameworkFilter);
      }
      
      const response = await axios.get(`/api/compliance/reports?${params.toString()}`);
      setReports(response.data.data.reports);
    } catch (error) {
      toast.error('Failed to load compliance reports');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/compliance/report', {
        framework,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      
      toast.success('Compliance report generated successfully');
      setGenerateDialogOpen(false);
      loadReports();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      const response = await axios.get(`/api/compliance/reports/${reportId}`);
      setSelectedReport(response.data.data);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load report details');
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const response = await axios.get(`/api/compliance/reports/${reportId}`);
      const report = response.data.data;
      
      // Convert report to JSON and trigger download
      const dataStr = JSON.stringify(report, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `compliance-report-${reportId}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return 'success';
      case 'NON_COMPLIANT':
        return 'error';
      case 'NEEDS_REVIEW':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return <CheckCircle />;
      case 'NON_COMPLIANT':
        return <ErrorIcon />;
      case 'NEEDS_REVIEW':
        return <Warning />;
      default:
        return null;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              Compliance Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate and manage compliance reports for various frameworks
            </Typography>
          </div>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadReports}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Assessment />}
              onClick={() => setGenerateDialogOpen(true)}
            >
              Generate Report
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Reports
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {reports.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Compliant
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {reports.filter(r => r.certificationStatus === 'COMPLIANT').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Needs Review
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  {reports.filter(r => r.certificationStatus === 'NEEDS_REVIEW').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Non-Compliant
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {reports.filter(r => r.certificationStatus === 'NON_COMPLIANT').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Framework</InputLabel>
                <Select
                  value={frameworkFilter}
                  onChange={(e) => setFrameworkFilter(e.target.value)}
                  label="Framework"
                >
                  <MenuItem value="ALL">All Frameworks</MenuItem>
                  <MenuItem value="HIPAA">HIPAA</MenuItem>
                  <MenuItem value="SOX">SOX</MenuItem>
                  <MenuItem value="GDPR">GDPR</MenuItem>
                  <MenuItem value="SOC2">SOC2</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Reports Table */}
        <Paper sx={{ p: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : reports.length === 0 ? (
            <Box textAlign="center" p={6}>
              <Assessment sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No compliance reports yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Generate your first compliance report to get started
              </Typography>
              <Button
                variant="contained"
                onClick={() => setGenerateDialogOpen(true)}
              >
                Generate Report
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Framework</TableCell>
                    <TableCell>Time Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Documents</TableCell>
                    <TableCell>Generated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Chip label={report.framework} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(report.timeRange.start).toLocaleDateString()} -{' '}
                          {new Date(report.timeRange.end).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(report.certificationStatus)}
                          label={report.certificationStatus.replace('_', ' ')}
                          color={getStatusColor(report.certificationStatus) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {report.summary.complianceScore}%
                          </Typography>
                          <Chip
                            label={report.summary.riskLevel}
                            size="small"
                            color={
                              report.summary.riskLevel === 'LOW'
                                ? 'success'
                                : report.summary.riskLevel === 'MEDIUM'
                                ? 'warning'
                                : 'error'
                            }
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {report.summary.compliantDocuments} / {report.summary.totalDocuments}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          by {report.generatedBy.displayName || report.generatedBy.email}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleViewReport(report.id)}
                          title="View Details"
                        >
                          <Visibility />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadReport(report.id)}
                          title="Download Report"
                        >
                          <Download />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Generate Report Dialog */}
        <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Generate Compliance Report</DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Framework</InputLabel>
              <Select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                label="Framework"
              >
                <MenuItem value="ALL">All Frameworks</MenuItem>
                <MenuItem value="HIPAA">HIPAA</MenuItem>
                <MenuItem value="SOX">SOX</MenuItem>
                <MenuItem value="GDPR">GDPR</MenuItem>
                <MenuItem value="SOC2">SOC2</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(date) => setStartDate(date)}
                slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
              />
            </Box>
            
            <Box sx={{ mt: 2 }}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(date) => setEndDate(date)}
                slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
              />
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              The report will analyze all documents and audit logs within the selected time range.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateReport}
              variant="contained"
              disabled={loading || !startDate || !endDate}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Report'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* View Report Dialog */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Compliance Report Details</DialogTitle>
          <DialogContent>
            {selectedReport && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Framework
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedReport.complianceFramework}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedReport.certificationStatus}
                      color={getStatusColor(selectedReport.certificationStatus) as any}
                      size="small"
                    />
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Compliance Score
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="primary">
                          {selectedReport.summary.complianceScore}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Risk Level
                        </Typography>
                        <Chip label={selectedReport.summary.riskLevel} color="warning" />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Total Documents
                        </Typography>
                        <Typography variant="h6">
                          {selectedReport.summary.totalDocuments}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Compliant Documents
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {selectedReport.summary.compliantDocuments}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Typography variant="h6" gutterBottom>
                  Recommendations
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  {selectedReport.recommendations.map((rec: string, idx: number) => (
                    <Typography component="li" key={idx} variant="body2" sx={{ mb: 1 }}>
                      {rec}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            {selectedReport && (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleDownloadReport(selectedReport.reportId)}
              >
                Download
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ComplianceReportsPage;
