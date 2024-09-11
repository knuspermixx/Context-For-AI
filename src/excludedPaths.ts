// List of initially excluded paths and files
export const initiallyExcludedPaths: Set<string> = new Set([
    'node_modules',
    '.env',
    '.git',
    '.vscode',
    'dist',
    'build',
    '.DS_Store'
]);

// List of non-text file extensions
export const nonTextExtensions: string[] = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
    '.mp4', '.avi', '.mov', '.wmv',
    '.mp3', '.wav',
    '.zip', '.rar',
    '.exe', '.dll'
];