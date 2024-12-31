import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <Box sx={{ flexGrow: 1, overflow: 'auto', height: 'calc(100vh - 64px)' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout; 