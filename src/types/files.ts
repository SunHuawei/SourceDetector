export interface FileNode {
    name: string;
    path: string;
    size?: number;
    isDirectory: boolean;
    children: { [key: string]: FileNode };
    content?: string;
} 