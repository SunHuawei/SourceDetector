export type CodeTreeNodeType = 'directory' | 'file';

export interface CodeTreeFileInput {
    path: string;
    content: string;
}

export interface CodeTreeNode {
    name: string;
    path: string;
    type: CodeTreeNodeType;
    content?: string;
    children: CodeTreeNode[];
}

function normalizePath(path: string): string {
    const normalized = path
        .replace(/\\/g, '/')
        .split('/')
        .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
        .join('/');

    return normalized;
}

function createDirectoryNode(name: string, path: string): CodeTreeNode {
    return {
        name,
        path,
        type: 'directory',
        children: []
    };
}

function createFileNode(name: string, path: string, content: string): CodeTreeNode {
    return {
        name,
        path,
        type: 'file',
        content,
        children: []
    };
}

function sortNodes(nodes: CodeTreeNode[]): CodeTreeNode[] {
    return [...nodes]
        .sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === 'directory' ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
        })
        .map((node) => ({
            ...node,
            children: sortNodes(node.children)
        }));
}

function buildTree(files: CodeTreeFileInput[]): CodeTreeNode {
    const root = createDirectoryNode('root', '');
    const directoryMap = new Map<string, CodeTreeNode>([['', root]]);

    for (const file of files) {
        const normalizedPath = normalizePath(file.path);
        if (!normalizedPath) {
            continue;
        }

        const segments = normalizedPath.split('/');
        let currentPath = '';
        let parent = root;

        for (let index = 0; index < segments.length - 1; index += 1) {
            const segment = segments[index];
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;

            let nextNode = directoryMap.get(currentPath);
            if (!nextNode) {
                nextNode = createDirectoryNode(segment, currentPath);
                directoryMap.set(currentPath, nextNode);
                parent.children.push(nextNode);
            }

            parent = nextNode;
        }

        const fileName = segments[segments.length - 1];
        parent.children.push(createFileNode(fileName, normalizedPath, file.content));
    }

    return {
        ...root,
        children: sortNodes(root.children)
    };
}

export function buildSourceCodeTree(files: CodeTreeFileInput[]): CodeTreeNode {
    return buildTree(files);
}

export function buildCrxCodeTree(files: CodeTreeFileInput[]): CodeTreeNode {
    return buildTree(files);
}

const TEXT_FILE_EXTENSIONS = new Set([
    'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'json', 'html', 'htm', 'xml', 'yml', 'yaml', 'md', 'txt',
    'map', 'mjs', 'cjs', 'svg'
]);

export function isTextLikeFile(path: string): boolean {
    const extension = path.split('.').pop()?.toLowerCase();
    return Boolean(extension && TEXT_FILE_EXTENSIONS.has(extension));
}

export function detectCodeLanguage(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'ts':
            return 'typescript';
        case 'tsx':
            return 'tsx';
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'jsx':
            return 'jsx';
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return 'css';
        case 'json':
        case 'map':
            return 'json';
        case 'html':
        case 'htm':
            return 'html';
        case 'md':
            return 'markdown';
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'xml':
        case 'svg':
            return 'xml';
        default:
            return 'plaintext';
    }
}
