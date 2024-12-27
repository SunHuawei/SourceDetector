import { Folder, InsertDriveFile } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useState } from 'react';

interface MockFolderTreeProps {
  onFileSelect: (fileId: string) => void;
}

// Mock data structure
const mockData = {
  id: 'root',
  name: 'Project',
  type: 'folder',
  children: [
    {
      id: 'src',
      name: 'src',
      type: 'folder',
      children: [
        {
          id: 'file1.js',
          name: 'file1.js',
          type: 'file'
        },
        {
          id: 'styles.css',
          name: 'styles.css',
          type: 'file'
        }
      ]
    },
    {
      id: 'public',
      name: 'public',
      type: 'folder',
      children: [
        {
          id: 'index.html',
          name: 'index.html',
          type: 'file'
        }
      ]
    }
  ]
};

const MockFolderTree = ({ onFileSelect }: MockFolderTreeProps) => {
  const [expanded, setExpanded] = useState<string[]>(['root', 'src', 'public']);

  const renderTree = (node: any) => (
    <TreeItem
      key={node.id}
      itemId={node.id}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, pr: 0 }}>
          {node.type === 'folder' ? (
            <Folder sx={{ mr: 1 }} fontSize="small" />
          ) : (
            <InsertDriveFile sx={{ mr: 1 }} fontSize="small" />
          )}
          <Typography variant="body2">{node.name}</Typography>
        </Box>
      }
      onClick={() => {
        if (node.type === 'file') {
          onFileSelect(node.id);
        }
      }}
    >
      {Array.isArray(node.children)
        ? node.children.map((child: any) => renderTree(child))
        : null}
    </TreeItem>
  );

  return (
    <Box sx={{ p: 2 }}>
      <SimpleTreeView
        expansionTrigger="iconContainer"
        defaultExpandedItems={expanded}
        onItemExpansionToggle={(event, itemId, isExpanded) => {
          setExpanded(isExpanded ? [...expanded, itemId] : expanded.filter(id => id !== itemId));
        }}
      >
        {renderTree(mockData)}
      </SimpleTreeView>
    </Box>
  );
};

export default MockFolderTree; 