import { Box, Typography, Paper, Container } from '@mui/material';

const Home = () => {
  return (
    <Container>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to Source Detector
        </Typography>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="body1">
            This is your dashboard for managing and analyzing source files. Use the sidebar navigation to explore different sections of the application.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Home; 