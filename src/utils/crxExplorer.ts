import JSZip from 'jszip';

export interface CrxExplorerFileNode {
    name: string;
    path: string;
    size?: number;
    isDirectory: boolean;
    children: Record<string, CrxExplorerFileNode>;
}

export interface CrxExplorerCodeFile {
    path: string;
    size: number;
    extension: string;
    language: string;
    isSourceLike: boolean;
}

const SOURCE_LIKE_EXTENSIONS = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'sass', 'less', 'html', 'json', 'md', 'txt', 'map', 'xml', 'yml', 'yaml'
]);

export function getLanguageFromPath(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    switch (extension) {
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return 'css';
        case 'html':
            return 'html';
        case 'json':
        case 'map':
            return 'json';
        case 'md':
            return 'markdown';
        case 'xml':
            return 'xml';
        case 'yml':
        case 'yaml':
            return 'yaml';
        default:
            return 'plaintext';
    }
}

export function isSourceLikePath(path: string): boolean {
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    return SOURCE_LIKE_EXTENSIONS.has(extension);
}

export async function buildCrxFileTreeFromZip(jszip: JSZip): Promise<CrxExplorerFileNode> {
    const root: CrxExplorerFileNode = {
        name: 'root',
        path: '',
        isDirectory: true,
        children: {}
    };

    for (const [path, file] of Object.entries(jszip.files)) {
        if (file.dir) continue;

        const segments = path.split('/').filter(Boolean);
        let currentNode = root;

        for (let i = 0; i < segments.length - 1; i += 1) {
            const segment = segments[i];
            if (!currentNode.children[segment]) {
                currentNode.children[segment] = {
                    name: segment,
                    path: segments.slice(0, i + 1).join('/'),
                    isDirectory: true,
                    children: {}
                };
            }
            currentNode = currentNode.children[segment];
        }

        const fileName = segments[segments.length - 1] ?? path;
        let size = 0;
        try {
            const data = await file.async('uint8array');
            size = data.length;
        } catch {
            size = 0;
        }

        currentNode.children[fileName] = {
            name: fileName,
            path,
            size,
            isDirectory: false,
            children: {}
        };
    }

    return root;
}

export function listCrxCodeFiles(root: CrxExplorerFileNode): CrxExplorerCodeFile[] {
    const files: CrxExplorerCodeFile[] = [];

    const walk = (node: CrxExplorerFileNode) => {
        if (!node.isDirectory) {
            const extension = node.path.split('.').pop()?.toLowerCase() ?? '';
            files.push({
                path: node.path,
                size: node.size ?? 0,
                extension,
                language: getLanguageFromPath(node.path),
                isSourceLike: isSourceLikePath(node.path)
            });
            return;
        }

        Object.values(node.children)
            .sort((left, right) => {
                if (left.isDirectory !== right.isDirectory) {
                    return left.isDirectory ? -1 : 1;
                }
                return left.name.localeCompare(right.name);
            })
            .forEach(walk);
    };

    walk(root);

    return files.filter((file) => file.isSourceLike);
}

export function getDefaultCrxCodeFilePath(files: CrxExplorerCodeFile[]): string | null {
    if (files.length === 0) {
        return null;
    }

    const preferred = files.find((file) => /(^|\/)(src|source|sources|app|components)\//i.test(file.path));
    return preferred?.path ?? files[0].path;
}

export async function readZipTextFile(jszip: JSZip, path: string): Promise<string> {
    const file = jszip.files[path];
    if (!file || file.dir) {
        throw new Error(`File not found: ${path}`);
    }
    return file.async('text');
}
