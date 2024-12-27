import { Box, Container } from '@mui/material';
import FolderTree from '../components/SourceFiles/FolderTree';

const SourceFiles = () => {
  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Left side - Folder Tree */}
        <Box
          sx={{
            width: 360,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            height: 'calc(100vh - 64px)',
            overflow: 'auto'
          }}
        >
          <FolderTree />
        </Box>
        
        {/* Right side - Content area (empty for now) */}
        <Box sx={{ flexGrow: 1 }}>
          {/* Content will be added later */}
        </Box>
      </Box>
    </Container>
  );
};

export default SourceFiles; 