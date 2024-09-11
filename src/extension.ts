import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class FileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly path: string,
    public isChecked: boolean = false
  ) {
    super(label, collapsibleState);
    this.checkboxState = isChecked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
  }
}

class FileTreeDataProvider implements vscode.TreeDataProvider<FileTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined | null | void> = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private rootPath: string;
  private checkedItems: Set<string> = new Set();
  private initiallyExcludedPaths: Set<string> = new Set([
    'node_modules',
    '.env',
    '.git',
    '.vscode',
    'dist',
    'build',
    '.DS_Store'
  ]);

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.initializeCheckedItems(this.rootPath);
  }

  private initializeCheckedItems(dir: string) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const relativePath = path.relative(this.rootPath, filePath);

      if (!this.isInitiallyExcludedPath(relativePath)) {
        this.checkedItems.add(filePath);
        if (stat.isDirectory()) {
          this.initializeCheckedItems(filePath);
        }
      }
    });
  }

  private isInitiallyExcludedPath(relativePath: string): boolean {
    return this.initiallyExcludedPaths.has(relativePath.split(path.sep)[0]);
  }

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

  toggleChecked(item: FileTreeItem): void {
    this.setCheckedRecursively(item.path, !this.checkedItems.has(item.path));
    this.refresh();
  }

  private setCheckedRecursively(itemPath: string, isChecked: boolean): void {
    if (isChecked) {
      this.checkedItems.add(itemPath);
    } else {
      this.checkedItems.delete(itemPath);
    }

    if (fs.statSync(itemPath).isDirectory()) {
      fs.readdirSync(itemPath).forEach(file => {
        const filePath = path.join(itemPath, file);
        this.setCheckedRecursively(filePath, isChecked);
      });
    }
  }

  getCheckedItems(): Set<string> {
    return this.checkedItems;
  }

  setCheckedItem(path: string, isChecked: boolean): void {
    this.setCheckedRecursively(path, isChecked);
  }

  isItemChecked(itemPath: string): boolean {
    while (itemPath !== this.rootPath) {
      if (this.checkedItems.has(itemPath)) {
        return true;
      }
      itemPath = path.dirname(itemPath);
    }
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "llm-context" is now active!');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace opened');
      return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const treeDataProvider = new FileTreeDataProvider(rootPath);
  const treeView = vscode.window.createTreeView('llmContextView', { 
      treeDataProvider,
      canSelectMany: true
  });

  // Handle checkbox state changes
  treeView.onDidChangeCheckboxState((event) => {
      event.items.forEach(([item, state]) => {
          treeDataProvider.setCheckedItem(item.path, state === vscode.TreeItemCheckboxState.Checked);
      });
      treeDataProvider.refresh();
  });

  let copyDisposable = vscode.commands.registerCommand('llm-context.copySelectedFiles', async () => {
      vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Copying selected files...",
          cancellable: false
      }, async (progress) => {
          const allContent = await getSelectedFilesContent(treeDataProvider, rootPath, progress);
          try {
              await vscode.env.clipboard.writeText(allContent);
              vscode.window.showInformationMessage('Selected files have been successfully copied to the clipboard!');
          } catch (error) {
              vscode.window.showErrorMessage('Error copying to clipboard: ' + error);
          }
      });
  });

  let downloadDisposable = vscode.commands.registerCommand('llm-context.downloadSelectedFiles', async () => {
      vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Preparing selected files for download...",
          cancellable: false
      }, async (progress) => {
          const allContent = await getSelectedFilesContent(treeDataProvider, rootPath, progress);
          try {
              const saveUri = await vscode.window.showSaveDialog({
                  defaultUri: vscode.Uri.file('selected_files.txt'),
                  filters: { 'Text files': ['txt'] }
              });
              if (saveUri) {
                  fs.writeFileSync(saveUri.fsPath, allContent);
                  vscode.window.showInformationMessage('Selected files have been successfully downloaded!');
              }
          } catch (error) {
              vscode.window.showErrorMessage('Error downloading files: ' + error);
          }
      });
  });

  context.subscriptions.push(copyDisposable, downloadDisposable);
}

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

export function deactivate() {}