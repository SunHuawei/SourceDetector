import { Folder, InsertDriveFile } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useState, useEffect } from 'react';
import { FileNode } from '../../types/files';

interface MockFolderTreeProps {
    onFileSelect: (file: FileNode) => void;
    files: FileNode[];
    selectedNodePath: string[];
}

const ParsedSourceFileTree = ({ onFileSelect, files, selectedNodePath }: MockFolderTreeProps) => {
    console.log('selectedNodePath', selectedNodePath, selectedNodePath[selectedNodePath.length - 1]);
    const renderTree = (node: FileNode) => (
        <TreeItem
            key={node.path}
            itemId={node.path}
            label={
                <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, pr: 0 }}>
                    {node.isDirectory ? (
                        <Folder sx={{ mr: 1 }} fontSize="small" />
                    ) : (
                        <InsertDriveFile sx={{ mr: 1 }} fontSize="small" />
                    )}
                    <Typography variant="body2">{node.name}</Typography>
                </Box>
            }
            onClick={() => {
                if (!node.isDirectory) {
                    onFileSelect(node);
                }
            }}
        >
            {Object.values(node.children).map((child) => renderTree(child))}
        </TreeItem>
    );

    if (selectedNodePath.length === 0) {
        return null;
    }

    return (
        <Box sx={{ p: 2 }}>
            <SimpleTreeView
                expansionTrigger="iconContainer"
                defaultExpandedItems={selectedNodePath}
                defaultSelectedItems={selectedNodePath[selectedNodePath.length - 1]}
            >
                {files.map(file => renderTree(file))}
            </SimpleTreeView>
        </Box>
    );
};

export default ParsedSourceFileTree; 