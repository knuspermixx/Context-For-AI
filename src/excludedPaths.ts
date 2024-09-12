// List of initially excluded paths and files
export const initiallyExcludedPaths: Set<string> = new Set([
    // Development-related
    'node_modules',
    'bower_components',
    'vendor',
    'jspm_packages',
    '.npm',

    // Build outputs
    'dist',
    'build',
    'out',
    'output',

    // Version control
    '.git',
    '.svn',
    '.hg',
    '.bzr',

    // IDE and editor files
    '.vscode',
    '.idea',
    '.vs',
    '*.sublime-*',

    // OS-generated files
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',

    // Temporary and cache files
    'tmp',
    'temp',
    'cache',
    '*.log',
    'logs',

    // Configuration files that might contain sensitive information
    '.env',
    '.env.local',
    '.env.*.local',
    '*.config',

    // Package manager files
    'package-lock.json',
    'yarn.lock',
    'composer.lock',

    // Test coverage
    'coverage',

    // Documentation
    'docs',

    // Miscellaneous
    '.sass-cache',
    '*.bak',
    '*.swp',
    '*.swo'
]);

// List of non-text file extensions
export const nonTextExtensions: string[] = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', '.tiff', '.webp',

    // Videos
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',

    // Audio
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',

    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',

    // Executables and libraries
    '.exe', '.dll', '.so', '.dylib',

    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',

    // Database files
    '.db', '.sqlite', '.mdb',

    // Font files
    '.ttf', '.otf', '.woff', '.woff2', '.eot',

    // 3D model files
    '.obj', '.fbx', '.gltf', '.glb',

    // Adobe files
    '.psd', '.ai', '.indd',

    // Binary data files
    '.bin', '.dat',

    // Disk images
    '.iso', '.img',

    // Compiled code
    '.pyc', '.class',

    // Package files
    '.pkg', '.deb', '.rpm',

    // System-specific files
    '.sys', '.ini'
];

// Function to check if a file should be excluded based on its extension
export function isNonTextFile(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return nonTextExtensions.includes(ext);
}

// Function to check if a path should be excluded
export function shouldExcludePath(path: string): boolean {
    return initiallyExcludedPaths.has(path.split('/').pop() || '');
}