import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Home, Extension, Source } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <AppBar 
            position="sticky" 
            color="default" 
            elevation={1}
            sx={{
                backgroundColor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
                zIndex: (theme) => theme.zIndex.drawer + 1
            }}
        >
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
                    Source Detector
                </Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
                    <Button
                        color={isActive('/') ? 'primary' : 'inherit'}
                        startIcon={<Home />}
                        onClick={() => navigate('/')}
                    >
                        Home
                    </Button>
                    <Button
                        color={isActive('/source-files') ? 'primary' : 'inherit'}
                        startIcon={<Source />}
                        onClick={() => navigate('/source-files')}
                    >
                        Source Files
                    </Button>
                    <Button
                        color={isActive('/crx-files') ? 'primary' : 'inherit'}
                        startIcon={<Extension />}
                        onClick={() => navigate('/crx-files')}
                    >
                        CRX Files
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Header; 