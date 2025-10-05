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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Divider,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  MoreVert,
  Group,
  PersonAdd,
  Settings,
  Upgrade,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  description?: string;
  memberRole: string;
  subscription?: any;
  _count?: {
    members: number;
    documents: number;
  };
}

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    displayName?: string;
    email?: string;
    walletAddress: string;
  };
}

const TeamManagementPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [manageSubscriptionOpen, setManageSubscriptionOpen] = useState(false);
  
  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('MEMBER');
  const [subscriptionTier, setSubscriptionTier] = useState('FREE');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/teams');
      setTeams(response.data.data);
    } catch (error) {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    try {
      const response = await axios.get(`/api/teams/${teamId}`);
      setSelectedTeam(response.data.data);
      setTeamMembers(response.data.data.members || []);
    } catch (error) {
      toast.error('Failed to load team details');
    }
  };

  const handleCreateTeam = async () => {
    try {
      await axios.post('/api/teams', {
        name: newTeamName,
        description: newTeamDescription,
      });
      toast.success('Team created successfully');
      setCreateTeamOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
      loadTeams();
    } catch (error) {
      toast.error('Failed to create team');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam) return;
    
    try {
      await axios.post(`/api/teams/${selectedTeam.id}/members`, {
        userId: newMemberAddress,
        role: newMemberRole,
      });
      toast.success('Member added successfully');
      setAddMemberOpen(false);
      setNewMemberAddress('');
      setNewMemberRole('MEMBER');
      loadTeamDetails(selectedTeam.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await axios.delete(`/api/teams/${selectedTeam.id}/members/${memberId}`);
      toast.success('Member removed successfully');
      loadTeamDetails(selectedTeam.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!selectedTeam) return;
    
    try {
      await axios.patch(`/api/teams/${selectedTeam.id}/members/${memberId}/role`, {
        role: newRole,
      });
      toast.success('Member role updated successfully');
      loadTeamDetails(selectedTeam.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update member role');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedTeam) return;
    
    try {
      await axios.post(`/api/teams/${selectedTeam.id}/subscription`, {
        tier: subscriptionTier,
        billingCycle: 'monthly',
      });
      toast.success('Subscription updated successfully');
      setManageSubscriptionOpen(false);
      loadTeamDetails(selectedTeam.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update subscription');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Team Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your teams, members, and subscriptions
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateTeamOpen(true)}
        >
          Create Team
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Teams List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Your Teams
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {teams.map((team) => (
              <Card
                key={team.id}
                sx={{
                  mb: 2,
                  cursor: 'pointer',
                  border: selectedTeam?.id === team.id ? 2 : 0,
                  borderColor: 'primary.main',
                }}
                onClick={() => loadTeamDetails(team.id)}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {team.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {team.description || 'No description'}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<Group />}
                      label={`${team._count?.members || 0} members`}
                      size="small"
                    />
                    <Chip
                      label={team.memberRole}
                      color="primary"
                      size="small"
                    />
                    {team.subscription && (
                      <Chip
                        label={team.subscription.tier}
                        color="secondary"
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
            {teams.length === 0 && (
              <Alert severity="info">
                You're not part of any teams yet. Create one to get started!
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Team Details */}
        <Grid item xs={12} md={8}>
          {selectedTeam ? (
            <>
              {/* Team Info */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h5" fontWeight="bold">
                    {selectedTeam.name}
                  </Typography>
                  <Box>
                    <IconButton>
                      <Settings />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {selectedTeam.description || 'No description'}
                </Typography>
                
                {/* Subscription Info */}
                {selectedTeam.subscription && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <div>
                          <Typography variant="subtitle2" color="text.secondary">
                            Current Plan
                          </Typography>
                          <Typography variant="h6">
                            {selectedTeam.subscription.tier}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ${selectedTeam.subscription.price}/month
                          </Typography>
                        </div>
                        <Button
                          variant="outlined"
                          startIcon={<Upgrade />}
                          onClick={() => {
                            setSubscriptionTier(selectedTeam.subscription.tier);
                            setManageSubscriptionOpen(true);
                          }}
                        >
                          Manage
                        </Button>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Limits: {selectedTeam.statistics?.memberCount || 0}/{selectedTeam.subscription.maxMembers} members • {selectedTeam.statistics?.documentCount || 0}/{selectedTeam.subscription.maxDocuments} documents
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Paper>

              {/* Team Members */}
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Team Members ({teamMembers.length})
                  </Typography>
                  {(selectedTeam.memberRole === 'OWNER' || selectedTeam.memberRole === 'ADMIN') && (
                    <Button
                      variant="outlined"
                      startIcon={<PersonAdd />}
                      onClick={() => setAddMemberOpen(true)}
                    >
                      Add Member
                    </Button>
                  )}
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email / Wallet</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Joined</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            {member.user.displayName || 'Unnamed User'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {member.user.email || member.user.walletAddress.slice(0, 10) + '...'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {(selectedTeam.memberRole === 'OWNER' && member.role !== 'OWNER') ? (
                              <Select
                                value={member.role}
                                size="small"
                                onChange={(e) => handleUpdateMemberRole(member.user.id, e.target.value)}
                              >
                                <MenuItem value="ADMIN">Admin</MenuItem>
                                <MenuItem value="MEMBER">Member</MenuItem>
                                <MenuItem value="VIEWER">Viewer</MenuItem>
                              </Select>
                            ) : (
                              <Chip label={member.role} size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="right">
                            {member.role !== 'OWNER' && (selectedTeam.memberRole === 'OWNER' || selectedTeam.memberRole === 'ADMIN') && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveMember(member.user.id)}
                              >
                                <Delete />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          ) : (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Group sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Select a team to view details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a team from the list to manage members and settings
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Create Team Dialog */}
      <Dialog open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={newTeamDescription}
            onChange={(e) => setNewTeamDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTeamOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTeam}
            variant="contained"
            disabled={!newTeamName.trim()}
          >
            Create Team
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="User ID or Wallet Address"
            value={newMemberAddress}
            onChange={(e) => setNewMemberAddress(e.target.value)}
            margin="normal"
            required
            helperText="Enter the user's ID or wallet address"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              label="Role"
            >
              <MenuItem value="MEMBER">Member</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="VIEWER">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={!newMemberAddress.trim()}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Subscription Dialog */}
      <Dialog open={manageSubscriptionOpen} onClose={() => setManageSubscriptionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Subscription</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Subscription Tier</InputLabel>
            <Select
              value={subscriptionTier}
              onChange={(e) => setSubscriptionTier(e.target.value)}
              label="Subscription Tier"
            >
              <MenuItem value="FREE">Free - $0/month</MenuItem>
              <MenuItem value="PROFESSIONAL">Professional - $29/month</MenuItem>
              <MenuItem value="TEAM">Team - $99/month</MenuItem>
              <MenuItem value="ENTERPRISE">Enterprise - $499/month</MenuItem>
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }}>
            Changes will take effect immediately. You'll be charged a prorated amount.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageSubscriptionOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateSubscription}
            variant="contained"
            color="primary"
          >
            Update Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamManagementPage;
