import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { initiallyExcludedPaths, nonTextExtensions } from './excludedPaths';

// Represents an item in the file tree
class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly path: string,
        public isChecked: boolean = false
    ) {
        super(label, collapsibleState);
        this.checkboxState = isChecked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
        this.tooltip = path; 
        this.iconPath = this.getIcon(); 
    }

    // Set appropriate icon based on file type
    private getIcon(): { light: string; dark: string } | vscode.ThemeIcon {
        if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            return new vscode.ThemeIcon("file");
        } else {
            return new vscode.ThemeIcon("folder");
        }
    }
}

// Manages the file tree data and operations
class FileTreeDataProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined | null | void> = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string;
    private checkedItems: Set<string> = new Set();
    private fileWatcher: vscode.FileSystemWatcher;

    constructor(rootPath: string, private context: vscode.ExtensionContext) {
        this.rootPath = rootPath;
        this.loadCheckedItems();
        this.initializeCheckedItems(this.rootPath);
        this.fileWatcher = this.setupFileWatcher();
    }

    // Set up file watcher to refresh tree on file system changes
    private setupFileWatcher(): vscode.FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        watcher.onDidChange(() => this.refresh());
        return watcher;
    }

    // Load previously checked items from workspace state
    private loadCheckedItems() {
        const storedItems = this.context.workspaceState.get<string[]>('checkedItems', []);
        this.checkedItems = new Set(storedItems);
    }

    // Save checked items to workspace state
    private saveCheckedItems() {
        this.context.workspaceState.update('checkedItems', Array.from(this.checkedItems));
    }

    // Initialize checked items based on excluded paths and non-text files
    private initializeCheckedItems(dir: string) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            const relativePath = path.relative(this.rootPath, filePath);

            if (!this.isExcludedPath(relativePath)) {
                if (stat.isDirectory()) {
                    this.initializeCheckedItems(filePath);
                    if (this.areAllChildrenChecked(filePath)) {
                        this.checkedItems.add(filePath);
                    }
                } else if (!this.isNonTextFile(filePath)) {
                    this.checkedItems.add(filePath);
                }
            }
        });
    }

    // Check if all children of a directory are checked
    private areAllChildrenChecked(dir: string): boolean {
        const files = fs.readdirSync(dir);
        return files.every(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                return this.areAllChildrenChecked(filePath);
            }
            return this.checkedItems.has(filePath);
        });
    }

    // Check if a path is in the excluded list
    private isExcludedPath(relativePath: string): boolean {
        return initiallyExcludedPaths.has(relativePath.split(path.sep)[0]);
    }

    // Check if a file is a non-text file based on its extension
    private isNonTextFile(filePath: string): boolean {
        return nonTextExtensions.includes(path.extname(filePath).toLowerCase());
    }

    // Refresh the tree view
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileTreeItem): Thenable<FileTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.getFileTree(this.rootPath));
        }
        return Promise.resolve(this.getFileTree(element.path));
    }

    // Get the file tree for a given directory
    private getFileTree(dir: string): FileTreeItem[] {
        const items: FileTreeItem[] = [];
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            const isChecked = this.checkedItems.has(filePath);

            if (stat.isDirectory()) {
                items.push(new FileTreeItem(file, vscode.TreeItemCollapsibleState.Collapsed, filePath, isChecked));
            } else {
                items.push(new FileTreeItem(file, vscode.TreeItemCollapsibleState.None, filePath, isChecked));
            }
        });

        return items;
    }

    // Toggle the checked state of an item
    toggleChecked(item: FileTreeItem): void {
        const newState = !this.isItemChecked(item.path);
        this.setCheckedRecursively(item.path, newState);
        this.updateParentState(path.dirname(item.path));
        this.saveCheckedItems();
        this.refresh();
    }

    // Set the checked state recursively for a directory
    private setCheckedRecursively(itemPath: string, isChecked: boolean): void {
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            if (isChecked) {
                this.checkedItems.add(itemPath);
            } else {
                this.checkedItems.delete(itemPath);
            }
            
            fs.readdirSync(itemPath).forEach(file => {
                const filePath = path.join(itemPath, file);
                this.setCheckedRecursively(filePath, isChecked);
            });
        } else {
            if (isChecked) {
                this.checkedItems.add(itemPath);
            } else {
                this.checkedItems.delete(itemPath);
            }
        }
    }

    // Update the state of parent directories
    private updateParentState(parentPath: string): void {
        if (parentPath === this.rootPath || parentPath === path.dirname(parentPath)) {
            return;
        }

        const allChildrenChecked = this.areAllChildrenChecked(parentPath);
        
        if (allChildrenChecked) {
            this.checkedItems.add(parentPath);
        } else {
            this.checkedItems.delete(parentPath);
        }

        this.updateParentState(path.dirname(parentPath));
    }

    getCheckedItems(): Set<string> {
        return this.checkedItems;
    }

    setCheckedItem(itemPath: string, isChecked: boolean): void {
        this.setCheckedRecursively(itemPath, isChecked);
        this.updateParentState(path.dirname(itemPath));
    }

    isItemChecked(itemPath: string): boolean {
        return this.checkedItems.has(itemPath);
    }
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {
    console.log('LLM Context extension is now active!');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace opened');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const treeDataProvider = new FileTreeDataProvider(rootPath, context);
    const treeView = vscode.window.createTreeView('llmContextView', { 
        treeDataProvider,
        canSelectMany: true
    });

    treeView.description = "Select files/folders for LLM context";

    treeView.onDidChangeCheckboxState((event) => {
        event.items.forEach(([item, state]) => {
            treeDataProvider.setCheckedItem(item.path, state === vscode.TreeItemCheckboxState.Checked);
        });
        treeDataProvider.refresh();
    });

    // Register command to copy selected files
    let copyDisposable = vscode.commands.registerCommand('llm-context.copySelectedFiles', async () => {
        await handleSelectedFiles(treeDataProvider, rootPath, 'copy');
    });

    // Register command to download selected files
    let downloadDisposable = vscode.commands.registerCommand('llm-context.downloadSelectedFiles', async () => {
        await handleSelectedFiles(treeDataProvider, rootPath, 'download');
    });

    context.subscriptions.push(copyDisposable, downloadDisposable);
}

// Handle selected files for copy or download
async function handleSelectedFiles(treeDataProvider: FileTreeDataProvider, rootPath: string, action: 'copy' | 'download') {
    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: action === 'copy' ? "Copying selected files..." : "Preparing selected files for download...",
        cancellable: false
    };

    vscode.window.withProgress(progressOptions, async (progress) => {
        const allContent = await getSelectedFilesContent(treeDataProvider, rootPath, progress);
        try {
            if (action === 'copy') {
                await vscode.env.clipboard.writeText(allContent);
                vscode.window.showInformationMessage('Selected files have been successfully copied to the clipboard!');
            } else {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file('selected_files.txt'),
                    filters: { 'Text files': ['txt'] }
                });
                if (saveUri) {
                    fs.writeFileSync(saveUri.fsPath, allContent);
                    vscode.window.showInformationMessage('Selected files have been successfully downloaded!');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error ${action === 'copy' ? 'copying to clipboard' : 'downloading files'}: ${error}`);
        }
    });
}

// Get content of selected files
async function getSelectedFilesContent(treeDataProvider: FileTreeDataProvider, rootPath: string, progress: vscode.Progress<{ message?: string; increment?: number }>): Promise<string> {
    let allContent = '';

    const copyFile = (filePath: string, relativePath: string) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            allContent += `\n--- File: ${relativePath} ---\n`;
            allContent += content + '\n';
            progress.report({ message: `Processing: ${relativePath}` });
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    };

    const processCheckedItems = (itemPath: string) => {
        const relativePath = path.relative(rootPath, itemPath);
        const stat = fs.statSync(itemPath);

        if (stat.isFile()) {
            if (treeDataProvider.isItemChecked(itemPath)) {
                copyFile(itemPath, relativePath);
            }
        } else if (stat.isDirectory()) {
            fs.readdirSync(itemPath).forEach(file => {
                const filePath = path.join(itemPath, file);
                processCheckedItems(filePath);
            });
        }
    };

    processCheckedItems(rootPath);

    return allContent;
}

// Deactivate the extension
export function deactivate() {
    console.log('LLM Context extension is now deactivated.');
}