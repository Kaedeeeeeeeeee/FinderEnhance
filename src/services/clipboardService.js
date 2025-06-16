const { exec } = require('child_process');
const { clipboard } = require('electron');

class ClipboardService {
  constructor() {
    this.cutFilesList = [];
  }

  async initialize() {
    console.log('剪贴板服务已初始化');
  }

  async cutFiles(filePaths) {
    try {
      // 简单地将文件路径存储在内存中，不操作系统剪贴板
      // 这样避免了剪贴板格式的复杂性
      this.cutFilesList = filePaths;
      
      // 验证文件是否存在
      const script = `
        tell application "Finder"
          try
            set validFiles to 0
            ${filePaths.map(path => `
            try
              set theFile to POSIX file "${path}" as alias
              set validFiles to validFiles + 1
            on error
              -- 文件不存在，跳过
            end try`).join('\n')}
            
            return "valid:" & validFiles
          on error errMsg
            return "error: " & errMsg
          end try
        end tell
      `;

      return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          if (error) {
            reject(new Error('剪切文件失败: ' + error.message));
          } else {
            const result = stdout.trim();
            if (result.startsWith('error:')) {
              reject(new Error(result.substring(7)));
            } else if (result.startsWith('valid:')) {
              const validCount = parseInt(result.substring(6));
              if (validCount > 0) {
                console.log(`已准备剪切 ${validCount} 个文件`);
                resolve({
                  success: true,
                  message: `已剪切 ${validCount} 个项目`,
                  files: filePaths
                });
              } else {
                reject(new Error('没有找到有效的文件'));
              }
            } else {
              reject(new Error('未知的响应格式'));
            }
          }
        });
      });
      
    } catch (error) {
      throw new Error('剪切操作失败: ' + error.message);
    }
  }

  markFilesCut(filePaths) {
    // 使用AppleScript标记文件为"剪切"状态（在Finder中显示为半透明）
    const script = `
      tell application "Finder"
        try
          ${filePaths.map(path => `
            set theFile to (POSIX file "${path}" as alias)
            -- 标记文件为剪切状态
          `).join('\n')}
        end try
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (error) => {
      if (error) {
        console.log('标记剪切状态时出错:', error.message);
      }
    });
  }

  async pasteFiles(destinationPath) {
    if (this.cutFilesList.length === 0) {
      throw new Error('没有要粘贴的文件');
    }

    try {
      // 使用AppleScript直接移动文件，而不是依赖剪贴板的paste命令
      const script = `
        tell application "Finder"
          try
            set destFolder to POSIX file "${destinationPath}" as alias
            set movedFiles to {}
            
            ${this.cutFilesList.map(filePath => `
            try
              set sourceFile to POSIX file "${filePath}" as alias
              set movedFile to move sourceFile to destFolder
              set end of movedFiles to movedFile
            on error moveErr
              -- 如果移动失败，记录错误但继续处理其他文件
            end try`).join('\n')}
            
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        end tell
      `;

      return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            reject(new Error('粘贴文件失败: ' + error.message));
          } else {
            const result = stdout.trim();
            if (result.startsWith('error:')) {
              reject(new Error(result.substring(7)));
            } else {
              const movedFiles = [...this.cutFilesList];
              this.cutFilesList = []; // 清空剪切列表
              resolve({
                success: true,
                message: `已移动 ${movedFiles.length} 个项目`,
                files: movedFiles
              });
            }
          }
        });
      });
    } catch (error) {
      throw new Error('粘贴操作失败: ' + error.message);
    }
  }

  async copyFiles(filePaths) {
    try {
      const scriptPaths = filePaths.map(p => `"${p}"`).join(', ');
      
      const script = `
        tell application "Finder"
          try
            set fileList to {${scriptPaths}}
            set fileItems to {}
            repeat with filePath in fileList
              set theFile to POSIX file filePath
              set end of fileItems to (theFile as alias)
            end repeat
            copy fileItems
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        end tell
      `;

      return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            reject(new Error('复制文件失败: ' + error.message));
          } else {
            const result = stdout.trim();
            if (result.startsWith('error:')) {
              reject(new Error(result.substring(7)));
            } else {
              resolve({
                success: true,
                message: `已复制 ${filePaths.length} 个项目`,
                files: filePaths
              });
            }
          }
        });
      });
    } catch (error) {
      throw new Error('复制操作失败: ' + error.message);
    }
  }

  async deleteFiles(filePaths) {
    try {
      const scriptPaths = filePaths.map(p => `"${p}"`).join(', ');
      
      const script = `
        tell application "Finder"
          try
            set fileList to {${scriptPaths}}
            repeat with filePath in fileList
              set theFile to POSIX file filePath
              set theAlias to (theFile as alias)
              move theAlias to trash
            end repeat
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        end tell
      `;

      return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            reject(new Error('删除文件失败: ' + error.message));
          } else {
            const result = stdout.trim();
            if (result.startsWith('error:')) {
              reject(new Error(result.substring(7)));
            } else {
              resolve({
                success: true,
                message: `已删除 ${filePaths.length} 个项目`,
                files: filePaths
              });
            }
          }
        });
      });
    } catch (error) {
      throw new Error('删除操作失败: ' + error.message);
    }
  }

  getCutFiles() {
    return [...this.cutFilesList];
  }

  clearCutFiles() {
    this.cutFilesList = [];
  }

  hasCutFiles() {
    return this.cutFilesList.length > 0;
  }
}

module.exports = ClipboardService; 