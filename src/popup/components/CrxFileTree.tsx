import { getFileIcon } from '@/components/fileIcon';
import { ParsedCrxFile } from '@/types';
import { formatBytes } from '@/utils/format';
import { ChevronRight, CloudDownload, ExpandMore, Folder } from '@mui/icons-material';
import {
  Alert,
  Box,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { TreeItem as MuiTreeItem, SimpleTreeView as MuiTreeView } from '@mui/x-tree-view';
import React, { useEffect, useMemo, useState } from 'react';

interface FileNode {
  name: string;
  path: string;
  size?: number;
  isDirectory: boolean;
  children: Record<string, FileNode>;
}

interface BuildFileTreeResult {
  root: FileNode;
}

interface Props {
  parsed: ParsedCrxFile | null;
  onDownload: (path: string) => void;
}

const TreeItem = MuiTreeItem as any;
const TreeView = MuiTreeView as any;

function getAncestorPaths(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 0; index < segments.length - 1; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join('/'));
  }

  return ancestors;
}

function buildFileTree(parsed: ParsedCrxFile): BuildFileTreeResult {
  const root: FileNode = {
    name: 'root',
    path: '',
    isDirectory: true,
    children: {},
  };

  for (const [path, file] of Object.entries(parsed.zip.files)) {
    if (file.dir) {
      continue;
    }

    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    let currentNode = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      const nextPath = segments.slice(0, index + 1).join('/');

      if (!currentNode.children[segment]) {
        currentNode.children[segment] = {
          name: segment,
          path: nextPath,
          isDirectory: true,
          children: {},
        };
      }

      currentNode = currentNode.children[segment];
    }

    const fileName = segments[segments.length - 1];
    currentNode.children[fileName] = {
      name: fileName,
      path,
      isDirectory: false,
      children: {},
    };

  }

  return { root };
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function CrxFileTree({ parsed, onDownload }: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const treeData = useMemo(() => {
    if (!parsed) return null;
    return buildFileTree(parsed);
  }, [parsed]);
  const fileTree = treeData?.root ?? null;

  useEffect(() => {
    if (!treeData) {
      setExpanded([]);
      return;
    }

    const firstPath = Object.keys(parsed?.zip.files ?? {}).find(path => {
      const file = parsed?.zip.files[path];
      return file && !file.dir;
    });
    setExpanded(firstPath ? getAncestorPaths(firstPath) : []);
  }, [parsed, treeData]);

  const handleToggle = (_event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  const renderTree = (node: FileNode, nodeId: string) => {
    const sortedChildren = sortNodes(Object.values(node.children));

    const label = (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          pr: 0.5,
          minWidth: 0,
          borderRadius: 0.75,
        }}
      >
        {node.isDirectory ? <Folder fontSize="small" /> : getFileIcon(node.name)}
        <Tooltip title={`${node.path}${node.size ? ` (${formatBytes(node.size)})` : ''}`}>
          <Typography
            variant="body2"
            component="span"
            sx={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexGrow: 1,
            }}
          >
            {node.name}
          </Typography>
        </Tooltip>
        {!node.isDirectory && (
          <IconButton
            size="small"
            onClick={event => {
              event.stopPropagation();
              onDownload(node.path);
            }}
            sx={{ ml: 'auto', flexShrink: 0 }}
          >
            <CloudDownload fontSize="small" />
          </IconButton>
        )}
      </Box>
    );

    return (
      <TreeItem key={nodeId} itemId={node.path || nodeId} label={label}>
        {sortedChildren.map(childNode =>
          renderTree(childNode, childNode.path || `${nodeId}-${childNode.name}`)
        )}
      </TreeItem>
    );
  };

  if (!fileTree) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No files found in this extension package.
      </Alert>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">Package Files</Typography>
          <Typography variant="caption" color="text.secondary">
            Browse the extension tree directly in the popup
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', px: 1, py: 1 }}>
          <TreeView
            defaultCollapseIcon={<ExpandMore />}
            defaultExpandIcon={<ChevronRight />}
            expanded={expanded}
            onNodeToggle={handleToggle}
            sx={{ flexGrow: 1 }}
          >
            {sortNodes(Object.values(fileTree.children)).map(node =>
              renderTree(node, node.path || node.name)
            )}
          </TreeView>
        </Box>
    </Paper>
  );
}
