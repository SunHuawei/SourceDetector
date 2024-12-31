import { Box, Typography, Paper, Container, Grid, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { StorageStats } from '../../electron/main/database-operations';
import { Language, Extension, Web, Archive, Source } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon, onClick }: { title: string; value: string | number; icon: React.ReactNode; onClick?: () => void }) => (
  <Paper 
    elevation={2} 
    sx={{ 
      p: 3, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 2,
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? {
        backgroundColor: 'action.hover',
      } : {}
    }}
    onClick={onClick}
  >
    {icon}
    <Typography variant="h4" component="div" align="center">
      {value}
    </Typography>
    <Typography variant="subtitle1" color="text.secondary" align="center">
      {title}
    </Typography>
  </Paper>
);

const Home = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await window.database.getStorageStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const handleNavigate = (route: string, url?: string) => {
    if (url) {
      navigate(`${route}?url=${encodeURIComponent(url)}`);
    } else {
      navigate(route);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to Source Detector
        </Typography>

        {stats && (
          <Box sx={{ mt: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Websites"
                  value={stats.uniqueSiteCount}
                  icon={<Language sx={{ fontSize: 40, color: 'primary.main' }} />}
                  onClick={() => handleNavigate('/source-files')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Pages"
                  value={stats.pagesCount}
                  icon={<Web sx={{ fontSize: 40, color: 'primary.main' }} />}
                  onClick={() => handleNavigate('/source-files')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Source Maps"
                  value={stats.fileCount}
                  icon={<Source sx={{ fontSize: 40, color: 'primary.main' }} />}
                  onClick={() => handleNavigate('/source-files')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="CRX Files"
                  value={stats.crxFileCount}
                  icon={<Extension sx={{ fontSize: 40, color: 'primary.main' }} />}
                  onClick={() => handleNavigate('/crx-files')}
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Home; 