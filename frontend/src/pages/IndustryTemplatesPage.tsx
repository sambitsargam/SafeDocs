import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Gavel,
  LocalHospital,
  AccountBalance,
  Factory,
  School,
  Home,
  Description,
  CheckCircle,
  Add,
  Edit,
  Delete,
  Download,
  Visibility,
} from '@mui/icons-material';
import { IndustryType, IndustryTemplate } from '../../../shared/src/types';

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
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function IndustryTemplatesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<IndustryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNewTemplate, setOpenNewTemplate] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    industry: 'LAW_FIRM' as IndustryType,
    category: '',
    description: '',
    fields: [] as Array<{ name: string; type: string; required: boolean }>,
    complianceRules: {} as Record<string, any>,
  });

  const industries = [
    { value: 'LAW_FIRM', label: 'Law Firm', icon: <Gavel />, color: '#1976d2' },
    { value: 'HEALTHCARE', label: 'Healthcare', icon: <LocalHospital />, color: '#d32f2f' },
    { value: 'FINANCE', label: 'Finance', icon: <AccountBalance />, color: '#388e3c' },
    { value: 'MANUFACTURING', label: 'Manufacturing', icon: <Factory />, color: '#f57c00' },
    { value: 'EDUCATION', label: 'Education', icon: <School />, color: '#7b1fa2' },
    { value: 'REAL_ESTATE', label: 'Real Estate', icon: <Home />, color: '#0097a7' },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Filter templates based on active tab
    if (activeTab === 0) {
      setFilteredTemplates(templates);
    } else {
      const selectedIndustry = industries[activeTab - 1]?.value;
      setFilteredTemplates(templates.filter((t) => t.industry === selectedIndustry));
    }
  }, [activeTab, templates]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
        setFilteredTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newTemplate),
      });

      if (response.ok) {
        setOpenNewTemplate(false);
        fetchTemplates();
        // Reset form
        setNewTemplate({
          name: '',
          industry: 'LAW_FIRM',
          category: '',
          description: '',
          fields: [],
          complianceRules: {},
        });
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const documentUrl = await response.json();
        // Redirect to document editor or download
        window.location.href = `/documents/new?template=${templateId}`;
      }
    } catch (error) {
      console.error('Error using template:', error);
    }
  };

  const getIndustryInfo = (industry: IndustryType) => {
    return industries.find((i) => i.value === industry) || industries[0];
  };

  const lawFirmTemplates = [
    {
      name: 'Non-Disclosure Agreement',
      category: 'Contracts',
      description: 'Standard NDA template for confidential business discussions',
      usageCount: 150,
    },
    {
      name: 'Client Intake Form',
      category: 'Client Management',
      description: 'Comprehensive client information and conflict check form',
      usageCount: 230,
    },
    {
      name: 'Legal Opinion Letter',
      category: 'Correspondence',
      description: 'Professional legal opinion template with compliance requirements',
      usageCount: 89,
    },
    {
      name: 'Power of Attorney',
      category: 'Estate Planning',
      description: 'Durable power of attorney document template',
      usageCount: 112,
    },
  ];

  const healthcareTemplates = [
    {
      name: 'HIPAA Consent Form',
      category: 'Compliance',
      description: 'HIPAA-compliant patient consent and privacy agreement',
      usageCount: 340,
    },
    {
      name: 'Patient Medical History',
      category: 'Medical Records',
      description: 'Comprehensive patient history intake form',
      usageCount: 420,
    },
    {
      name: 'Treatment Authorization',
      category: 'Consent',
      description: 'Medical treatment and procedure authorization form',
      usageCount: 280,
    },
    {
      name: 'Prescription Records',
      category: 'Pharmacy',
      description: 'Secure prescription documentation template',
      usageCount: 195,
    },
  ];

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              📋 Industry Templates
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Pre-configured templates for law firms, healthcare, and more
            </Typography>
          </Box>
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => setOpenNewTemplate(true)}>
            Create Template
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>Industry-Specific Templates:</strong> Each template is designed with industry regulations
          and best practices in mind, including built-in compliance checks.
        </Alert>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="industry templates tabs"
          >
            <Tab label="All Templates" />
            {industries.map((industry) => (
              <Tab
                key={industry.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {industry.icon}
                    {industry.label}
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Paper>

        {/* All Templates */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((template) => {
                const industryInfo = getIndustryInfo(template.industry);
                return (
                  <Grid item xs={12} md={6} lg={4} key={template.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ color: industryInfo.color, mr: 1 }}>{industryInfo.icon}</Box>
                          <Typography variant="h6" component="div">
                            {template.name}
                          </Typography>
                        </Box>

                        <Chip label={template.category} size="small" sx={{ mb: 2 }} />

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {template.description}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          <Chip label={industryInfo.label} size="small" variant="outlined" />
                          {template.isActive && <Chip label="Active" size="small" color="success" />}
                          <Chip label={`${template.usageCount || 0} uses`} size="small" variant="outlined" />
                        </Box>

                        {template.complianceRules && Object.keys(template.complianceRules).length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircle color="success" fontSize="small" />
                            <Typography variant="caption" color="text.secondary">
                              Compliance-ready
                            </Typography>
                          </Box>
                        )}
                      </CardContent>

                      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setOpenPreview(true);
                          }}
                        >
                          Preview
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleUseTemplate(template.id)}
                        >
                          Use Template
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })
            ) : (
              <Grid item xs={12}>
                <Alert severity="info">
                  No templates available yet. Create your first template to get started!
                </Alert>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Law Firm Templates */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                  Law Firm Document Templates
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Professional legal document templates with built-in compliance checks for contracts,
                  agreements, and legal correspondence.
                </Typography>

                <Grid container spacing={2}>
                  {lawFirmTemplates.map((template, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Chip label={template.category} size="small" sx={{ mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {template.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used {template.usageCount} times
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button size="small">Preview</Button>
                          <Button size="small" variant="contained">
                            Use
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Law Firm Features
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Client-Attorney Privilege"
                      secondary="Automatic privilege marking"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="E-Discovery Ready" secondary="Metadata preservation" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Digital Signatures" secondary="Legally binding e-signatures" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Version Control" secondary="Track all document changes" />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Healthcare Templates */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                  Healthcare Document Templates
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  HIPAA-compliant medical forms and documentation templates for healthcare providers and
                  facilities.
                </Typography>

                <Grid container spacing={2}>
                  {healthcareTemplates.map((template, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Chip label={template.category} size="small" sx={{ mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {template.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used {template.usageCount} times
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button size="small">Preview</Button>
                          <Button size="small" variant="contained">
                            Use
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Healthcare Features
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="HIPAA Compliant" secondary="Full privacy protection" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="PHI Encryption" secondary="End-to-end encryption" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Audit Trails" secondary="Complete access logging" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Access Control" secondary="Role-based permissions" />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Other industry tabs can be added similarly */}
        {industries.slice(2).map((industry, idx) => (
          <TabPanel key={industry.value} value={activeTab} index={idx + 3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Box sx={{ color: industry.color, mb: 2 }}>{industry.icon}</Box>
              <Typography variant="h5" gutterBottom>
                {industry.label} Templates
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Templates for {industry.label.toLowerCase()} coming soon!
              </Typography>
              <Button variant="contained" onClick={() => setOpenNewTemplate(true)}>
                Create Custom Template
              </Button>
            </Paper>
          </TabPanel>
        ))}
      </Box>

      {/* New Template Dialog */}
      <Dialog open={openNewTemplate} onClose={() => setOpenNewTemplate(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Template Name"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Industry</InputLabel>
              <Select
                value={newTemplate.industry}
                label="Industry"
                onChange={(e) => setNewTemplate({ ...newTemplate, industry: e.target.value as IndustryType })}
              >
                {industries.map((industry) => (
                  <MenuItem key={industry.value} value={industry.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {industry.icon}
                      {industry.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Category"
              value={newTemplate.category}
              onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
              placeholder="e.g., Contracts, Medical Records, etc."
              fullWidth
            />

            <TextField
              label="Description"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <Alert severity="info">
              After creating the template, you can add fields and configure compliance rules in the template
              editor.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewTemplate(false)}>Cancel</Button>
          <Button onClick={handleCreateTemplate} variant="contained">
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate?.name}
          <IconButton
            aria-label="close"
            onClick={() => setOpenPreview(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Industry
                </Typography>
                <Chip label={getIndustryInfo(selectedTemplate.industry).label} />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Category
                </Typography>
                <Typography>{selectedTemplate.category}</Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Description
                </Typography>
                <Typography>{selectedTemplate.description}</Typography>
              </Box>

              {selectedTemplate.fields && selectedTemplate.fields.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Template Fields
                  </Typography>
                  <List>
                    {selectedTemplate.fields.map((field: any, idx: number) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={field.name}
                          secondary={`${field.type}${field.required ? ' (Required)' : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {selectedTemplate.complianceRules && Object.keys(selectedTemplate.complianceRules).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Compliance Features
                  </Typography>
                  <Alert severity="success">
                    This template includes built-in compliance checks and validation rules.
                  </Alert>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPreview(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedTemplate) {
                handleUseTemplate(selectedTemplate.id);
                setOpenPreview(false);
              }
            }}
          >
            Use Template
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
