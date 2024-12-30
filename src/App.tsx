import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import Sidebar from './components/Layout/Sidebar';
import Home from './pages/Home';
import SourceFiles from './pages/SourceFiles';
import './App.css';

function App() {
  return (
    <Router>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: '16px',
            minHeight: '100vh',
            bgcolor: 'background.default'
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/source-files" element={<SourceFiles />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;