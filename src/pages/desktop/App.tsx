import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader,
  Box,
  Link,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import { styled } from '@mui/system';
import DownloadIcon from '@mui/icons-material/Download';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

// Styled components
const HeroSection = styled('section')(({ theme }) => ({
  paddingTop: theme.spacing(12),
  paddingBottom: theme.spacing(6),
  textAlign: 'center',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const DownloadSection = styled('section')(({ theme }) => ({
  padding: theme.spacing(8, 0),
  backgroundColor: theme.palette.grey[100],
}));

export default function LandingPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar position="sticky">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Source Detector
            </Typography>
            <Button color="inherit" href="#features">Features</Button>
            <Button color="inherit" href="#download">Download</Button>
          </Toolbar>
        </AppBar>

        {/* Hero Section */}
        <HeroSection>
          <Container maxWidth="md">
            <Typography variant="h2" component="h1" gutterBottom>
              Source Map & CRX File Detection Made Easy
            </Typography>
            <Typography variant="h5" color="textSecondary" paragraph>
              Powerful desktop application for detecting and managing source maps and Chrome extension files. Seamlessly sync with your browser extension.
            </Typography>
            <Box sx={{ mt: 4 }}>
              <Button variant="contained" size="large" sx={{ mr: 2 }}>
                Download Now
              </Button>
              <Button variant="outlined" size="large">
                Learn More
              </Button>
            </Box>
          </Container>
        </HeroSection>

        {/* Features Section */}
        <Container id="features" maxWidth="lg" sx={{ py: 8 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <FeatureCard>
                <CardHeader title="Smart Detection" />
                <CardContent>
                  <Typography variant="body1" color="text.secondary">
                    Automatically detect source maps and Chrome extension (CRX) files while browsing. Our intelligent system identifies and catalogs these files for easy access.
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FeatureCard>
                <CardHeader title="Organized File Management" />
                <CardContent>
                  <Typography variant="body1" color="text.secondary">
                    Keep your source maps and CRX files neatly organized by website, making it simple to find and manage your collected files.
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FeatureCard>
                <CardHeader title="Code Viewer" />
                <CardContent>
                  <Typography variant="body1" color="text.secondary">
                    View and analyze the contents of your detected files with our built-in code viewer. Syntax highlighting and file structure navigation make code exploration effortless.
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FeatureCard>
                <CardHeader title="Easy Downloads" />
                <CardContent>
                  <Typography variant="body1" color="text.secondary">
                    Download any detected source maps or CRX files with a single click. Perfect for developers who need quick access to these resources for analysis or debugging.
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
          </Grid>
        </Container>

        {/* Download Section */}
        <DownloadSection id="download">
          <Container maxWidth="md">
            <Box textAlign="center">
              <Typography variant="h3" component="h2" gutterBottom>
                Ready to Get Started?
              </Typography>
              <Typography variant="h6" color="textSecondary" paragraph>
                Download Source Detector now and take control of your source maps and Chrome extensions.
              </Typography>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<DownloadIcon />}
                sx={{ mt: 2 }}
              >
                Download for Desktop
              </Button>
            </Box>
          </Container>
        </DownloadSection>

        {/* Footer */}
        <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: 'background.paper' }}>
          <Container maxWidth="lg">
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item>
                <Typography variant="body2" color="text.secondary">
                  © 2024 Source Detector. All rights reserved.
                </Typography>
              </Grid>
              <Grid item>
                <Link href="#" color="inherit" sx={{ mr: 2 }}>Privacy</Link>
                <Link href="#" color="inherit" sx={{ mr: 2 }}>Terms</Link>
                <Link href="#" color="inherit">Contact</Link>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

