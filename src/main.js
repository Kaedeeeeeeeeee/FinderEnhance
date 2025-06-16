const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const PreviewService = require('./services/previewService');
const ClipboardService = require('./services/clipboardService');

class FinderEnhanceApp {
  constructor() {
    this.tray = null;
    this.previewWindow = null;
    this.previewService = new PreviewService();
    this.clipboardService = new ClipboardService();
    
    // 后台监控相关
    this.backgroundMonitor = null;
    this.isFinderActive = false;
    this.currentSelectedFile = null;
    this.lastFinderCheck = 0;
    this.monitorInterval = 200; // 每200ms检查一次，平衡性能和响应速度
    
    this.settings = {
      enableSpacePreview: true,
      enableCutShortcut: true,
      showCutFeedback: true,
      previewLimit: 50,
      showHiddenFiles: false,
      defaultView: 'list',
      previewWindowSize: 'medium',
      autoStart: false,
      checkUpdates: true
    };
  }

  async initialize() {
    // 设置应用不在Dock中显示
    if (process.platform === 'darwin') {
      app.dock.hide();
    }

    // 检查并请求辅助功能权限
    await this.checkAccessibilityPermissions();

    // 创建托盘图标
    this.createTray();
    
    // 注册全局快捷键
    this.registerGlobalShortcuts();

    // 启动服务
    await this.previewService.initialize();
    await this.clipboardService.initialize();
    
    // 启动后台监控
    this.startBackgroundMonitor();
  }

  async checkAccessibilityPermissions() {
    if (process.platform !== 'darwin') return;
    
    try {
      // 检查是否有辅助功能权限
      const script = `
        tell application "System Events"
          try
            get processes
            return "granted"
          on error
            return "denied"
          end try
        end tell
      `;
      
      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          const result = stdout.trim();
          if (result === 'denied') {
            console.log('需要辅助功能权限才能使用剪切功能');
            // 显示权限提示
            this.showPermissionDialog();
          } else {
            console.log('辅助功能权限已授予');
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('检查权限时出错:', error);
    }
  }

  showPermissionDialog() {
    const { dialog } = require('electron');
    dialog.showMessageBox(null, {
      type: 'info',
      title: 'Finder增强工具',
      message: '需要辅助功能权限',
      detail: '为了使用剪切功能，请在"系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能"中添加此应用程序。',
      buttons: ['打开系统偏好设置', '稍后设置'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        // 打开系统偏好设置
        exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
      }
    });
  }

  createTray() {
    // 使用系统默认模板图标
    console.log('创建托盘图标...');
    try {
      const { nativeImage } = require('electron');
      
      // 创建一个简单的16x16黑色方块作为托盘图标
      const size = 16;
      const buffer = Buffer.alloc(size * size * 4); // RGBA
      
      // 填充为黑色
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 0;     // R
        buffer[i + 1] = 0; // G  
        buffer[i + 2] = 0; // B
        buffer[i + 3] = 255; // A (不透明)
      }
      
      const icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
      icon.setTemplateImage(true); // 模板图标会自动适应系统主题
      
      this.tray = new Tray(icon);
      console.log('托盘图标创建成功');
    } catch (error) {
      console.log('创建托盘图标失败，使用空图标:', error);
      // 使用空图标作为最后的备选方案
      try {
        this.tray = new Tray(require('electron').nativeImage.createEmpty());
        console.log('使用空图标创建托盘');
      } catch (e) {
        console.error('无法创建托盘:', e);
        return;
      }
    }
    
    // 验证托盘是否创建成功
    if (this.tray) {
      console.log('✓ 托盘图标已成功创建并应该显示在系统托盘中');
    } else {
      console.error('✗ 托盘图标创建失败');
      return;
    }
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Finder增强工具',
        type: 'normal',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '预览功能: 开启 (Cmd+Shift+P)',
        type: 'normal',
        click: () => {
          this.showStatus();
        }
      },
      {
        label: '剪切: Cmd+Shift+X',
        type: 'normal',
        click: () => {
          this.showStatus();
        }
      },
      {
        label: '粘贴: Cmd+Shift+V',
        type: 'normal',
        click: () => {
          this.showStatus();
        }
      },
      { type: 'separator' },
      {
        label: '设置',
        type: 'normal',
        click: () => {
          this.showPreferences();
        }
      },
      {
        label: '关于',
        type: 'normal',
        click: () => {
          this.showAbout();
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        type: 'normal',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setToolTip('Finder增强工具');
    this.tray.setContextMenu(contextMenu);
  }

  registerGlobalShortcuts() {
    console.log('注册全局快捷键...');
    
    // 注册原生的 Cmd+X 快捷键，但只在特定条件下处理
    const cutRegistered = globalShortcut.register('CommandOrControl+X', async () => {
      console.log('Cmd+X 快捷键被触发');
      const shouldHandle = await this.shouldHandleFinderShortcut();
      if (shouldHandle) {
        console.log('在Finder中处理剪切操作');
        this.handleCutShortcut();
      } else {
        console.log('不在Finder中或不满足条件，模拟系统快捷键');
        // 模拟系统快捷键
        this.simulateSystemShortcut('x');
      }
    });
    console.log('Cmd+X 快捷键注册:', cutRegistered ? '成功' : '失败');

    // 注册原生的 Cmd+V 快捷键
    const pasteRegistered = globalShortcut.register('CommandOrControl+V', async () => {
      console.log('Cmd+V 快捷键被触发');
      const shouldHandle = await this.shouldHandlePasteShortcut();
      if (shouldHandle) {
        console.log('在Finder中处理粘贴操作');
        this.handlePasteShortcut();
      } else {
        console.log('不在Finder中或没有要粘贴的文件，模拟系统快捷键');
        // 模拟系统快捷键
        this.simulateSystemShortcut('v');
      }
    });
    console.log('Cmd+V 快捷键注册:', pasteRegistered ? '成功' : '失败');

    // 注册空格键作为智能预览快捷键
    const spaceRegistered = globalShortcut.register('Space', async () => {
      console.log('空格键被触发');
      
      // 如果预览窗口已经打开，使用动画关闭它
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        console.log('✓ 预览窗口已打开，关闭预览窗口');
        await this.animateWindowClose();
        return;
      }
      
      // 实时检查Finder状态
      const isInFinder = await this.isFinderActiveRealTime();
      console.log(`🔍 实时状态检查: Finder=${isInFinder}`);
      
      if (!isInFinder) {
        console.log('✗ 不在Finder中，使用系统默认行为');
        this.simulateSystemShortcut('space');
        return;
      }
      
      // 实时检查当前选中的文件
      const selectedFileInfo = await this.getSelectedFileRealTime();
      console.log(`📁 实时文件信息: ${selectedFileInfo || '无'}`);
      
      if (!selectedFileInfo) {
        console.log('✗ 没有选中文件，使用系统默认行为');
        this.simulateSystemShortcut('space');
        return;
      }
      
      // 解析文件类型
      const isFolder = selectedFileInfo.startsWith('folder:');
      const isArchive = selectedFileInfo.startsWith('archive:') || 
                       selectedFileInfo.includes('archive') || 
                       selectedFileInfo.includes('zip') || 
                       selectedFileInfo.includes('rar') ||
                       selectedFileInfo.includes('tar') ||
                       selectedFileInfo.includes('gz');
      
      console.log(`📂 文件类型分析: 文件夹=${isFolder}, 压缩包=${isArchive}`);
      
      if (isFolder || isArchive) {
        console.log(`✓ 检测到${isFolder ? '文件夹' : '压缩包'}，使用我们的预览功能`);
        this.handlePreviewShortcut();
      } else {
        console.log(`✗ 检测到普通文件(${selectedFileInfo})，使用系统默认行为`);
        this.simulateSystemShortcut('space');
      }
    });
    console.log('空格键注册:', spaceRegistered ? '成功' : '失败');

    // 保留备用快捷键
    const backupPreviewRegistered = globalShortcut.register('CommandOrControl+Shift+P', () => {
      console.log('Cmd+Shift+P 快捷键被触发');
      this.handlePreviewShortcut();
    });
    console.log('Cmd+Shift+P 快捷键注册:', backupPreviewRegistered ? '成功' : '失败');
    
    console.log('✓ 全局快捷键注册完成');
  }

  // 移除危险的轮询逻辑，使用简单安全的方法

  createDefaultIcon() {
    // 创建一个简单的默认托盘图标
    const { nativeImage } = require('electron');
    
    // 创建一个简单的16x16像素的图标数据
    const canvas = document.createElement ? null : null;
    
    // 如果无法创建图标，返回空的NativeImage，Electron会使用默认图标
    try {
      // 创建一个基本的数据URL图标
      const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVDiNpZM9SwNBEIafgwQLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sLwcJCG1sL';
      return nativeImage.createFromDataURL(iconData);
    } catch (error) {
      // 如果都失败了，返回空的图标，系统会使用默认图标
      return nativeImage.createEmpty();
    }
  }

  async handleSpaceKeyPress(filePath = null) {
    try {
      // 如果没有提供文件路径，则获取当前选中的文件
      const selectedFile = filePath || await this.getSelectedFile();
      if (selectedFile) {
        console.log('显示预览窗口:', selectedFile);
        this.showPreview(selectedFile);
      }
    } catch (error) {
      console.error('处理空格键按下时出错:', error);
    }
  }

  async handlePreviewShortcut() {
    try {
      // 使用缓存的状态进行快速检查
      if (this.isCurrentlyInFinder()) {
        const selectedFile = await this.getSelectedFile();
        if (selectedFile) {
          console.log('快捷键触发预览:', selectedFile);
          this.showPreview(selectedFile);
        } else {
          console.log('未选中任何文件');
        }
      } else {
        console.log('Finder未激活');
      }
    } catch (error) {
      console.error('处理预览快捷键时出错:', error);
    }
  }

  async handleCutShortcut() {
    try {
      // 优化：直接获取选中文件，减少AppleScript调用
      const selectedFiles = await this.getSelectedFilesOptimized();
      
      if (selectedFiles && selectedFiles.length > 0) {
        console.log(`✓ 剪切 ${selectedFiles.length} 个项目`);
        const result = await this.clipboardService.cutFiles(selectedFiles);
        console.log(result.message);
      } else {
        console.log('✗ 没有选中项目');
      }
    } catch (error) {
      console.error('剪切操作失败:', error.message);
    }
  }

  async handlePasteShortcut() {
    try {
      // 优化：直接获取当前路径，减少检查步骤
      const currentPath = await this.getCurrentFinderPathOptimized();
      
      if (currentPath) {
        console.log(`✓ 粘贴文件到: ${currentPath}`);
        const result = await this.clipboardService.pasteFiles(currentPath);
        console.log(result.message);
      } else {
        console.log('✗ 无法获取当前文件夹路径');
      }
    } catch (error) {
      console.error('粘贴操作失败:', error.message);
    }
  }

  async getCurrentFinderPath() {
    return new Promise((resolve, reject) => {
      exec(`osascript -e '
        tell application "Finder"
          try
            set currentFolder to target of front window
            return POSIX path of (currentFolder as alias)
          on error
            return ""
          end try
        end tell
      '`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          const path = stdout.trim();
          resolve(path || null);
        }
      });
    });
  }

  async getCurrentFinderPathOptimized() {
    return new Promise((resolve) => {
      const script = `
        tell application "Finder"
          try
            set currentFolder to target of front window
            return POSIX path of (currentFolder as alias)
          on error
            return ""
          end try
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          resolve(null);
        } else {
          const path = stdout.trim();
          resolve(path || null);
        }
      });
    });
  }

  async getSelectedFilesOptimized() {
    return new Promise((resolve) => {
      const script = `
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) = 0 then
              return ""
            end if
            
            set pathList to ""
            repeat with anItem in selectedItems
              if pathList is not "" then
                set pathList to pathList & "|||"
              end if
              set pathList to pathList & POSIX path of (anItem as alias)
            end repeat
            
            return pathList
          on error
            return ""
          end try
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          resolve([]);
        } else {
          const result = stdout.trim();
          if (result === '') {
            resolve([]);
          } else {
            const paths = result.split('|||').map(p => p.trim()).filter(p => p);
            resolve(paths);
          }
        }
      });
    });
  }

  async shouldHandleFinderShortcut() {
    try {
      // 优化：使用单个AppleScript调用完成所有检查
      const script = `
        tell application "System Events"
          try
            -- 检查前台应用是否是Finder
            set frontApp to name of first application process whose frontmost is true
            if frontApp is not "Finder" then
              return "not_finder"
            end if
          on error
            return "not_finder"
          end try
        end tell
        
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) = 0 then
              return "no_selection"
            end if
            return "ok"
          on error
            return "error"
          end try
        end tell
      `;

      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            console.log('快捷键检查失败，使用系统默认');
            resolve(false);
            return;
          }
          
          const result = stdout.trim();
          const shouldHandle = result === "ok";
          
          if (shouldHandle) {
            console.log('✓ 在Finder中且有选中文件，处理剪切操作');
          } else {
            console.log('✗ 条件不满足，使用系统默认行为');
          }
          
          resolve(shouldHandle);
        });
      });
      
    } catch (error) {
      console.log('shouldHandleFinderShortcut异常:', error.message);
      return false;
    }
  }



  async shouldHandlePasteShortcut() {
    try {
      // 优化：先检查本地状态，再检查Finder状态
      const hasCutFiles = this.clipboardService.hasCutFiles();
      
      if (!hasCutFiles) {
        console.log('✗ 没有剪切的文件，使用系统默认行为');
        return false;
      }
      
      // 只有在有剪切文件时才检查Finder状态
      const script = `
        tell application "System Events"
          try
            set frontApp to name of first application process whose frontmost is true
            if frontApp is "Finder" then
              return "ok"
            else
              return "not_finder"
            end if
          on error
            return "not_finder"
          end try
        end tell
      `;

      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            console.log('粘贴检查失败，使用系统默认');
            resolve(false);
            return;
          }
          
          const result = stdout.trim();
          const shouldHandle = result === "ok";
          
          if (shouldHandle) {
            console.log('✓ 在Finder中且有剪切文件，处理粘贴操作');
          } else {
            console.log('✗ 不在Finder中，使用系统默认行为');
          }
          
          resolve(shouldHandle);
        });
      });
      
    } catch (error) {
      console.log('shouldHandlePasteShortcut异常:', error.message);
      return false;
    }
  }

  async shouldHandleSpacePreview() {
    try {
      // 优化：使用更简单可靠的AppleScript检查Finder状态和选中项目类型
      const script = `
        tell application "System Events"
          try
            -- 检查前台应用是否是Finder
            set frontApp to name of first application process whose frontmost is true
            if frontApp is not "Finder" then
              return "not_finder"
            end if
          on error
            return "not_finder"
          end try
        end tell
        
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) = 0 then
              return "no_selection"
            end if
            
            -- 只检查第一个选中的项目
            set firstItem to item 1 of selectedItems
            
            -- 使用class属性检查是否是文件夹
            try
              set itemClass to class of firstItem
              if itemClass is folder then
                return "folder"
              end if
            on error
              -- 如果class检查失败，尝试其他方法
            end try
            
            -- 获取文件类型信息
            try
              set itemKind to kind of firstItem
              
              -- 检查是否是压缩包（常见的压缩包类型）
              if itemKind contains "archive" or itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" or itemKind contains "7Z" or itemKind contains "7z" or itemKind contains "TAR" or itemKind contains "tar" or itemKind contains "GZ" or itemKind contains "gz" then
                return "archive"
              end if
              
              -- 返回文件类型以便调试
              return "file:" & itemKind
            on error errMsg2
              return "kind_error:" & errMsg2
            end try
            
          on error errMsg
            return "error:" & errMsg
          end try
        end tell
      `;

      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            console.log('预览检查失败，使用系统默认');
            resolve(false);
            return;
          }
          
          const result = stdout.trim();
          const shouldHandle = result === "folder" || result === "archive";
          
          if (shouldHandle) {
            console.log(`✓ 检测到${result === "folder" ? "文件夹" : "压缩包"}，使用我们的预览功能`);
          } else {
            console.log(`✗ 检测到普通文件或其他情况(${result})，使用系统默认行为`);
          }
          
          resolve(shouldHandle);
        });
      });
      
    } catch (error) {
      console.log('shouldHandleSpacePreview异常:', error.message);
      return false;
    }
  }

  async shouldHandleSpacePreviewInFinder() {
    try {
      // 只检查选中项目类型，不重复检查Finder状态
      const script = `
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) = 0 then
              return "no_selection"
            end if
            
            -- 只检查第一个选中的项目
            set firstItem to item 1 of selectedItems
            
            -- 使用class属性检查是否是文件夹
            try
              set itemClass to class of firstItem
              if itemClass is folder then
                return "folder"
              end if
            on error
              -- 如果class检查失败，尝试其他方法
            end try
            
            -- 获取文件类型信息
            try
              set itemKind to kind of firstItem
              
              -- 检查是否是压缩包（常见的压缩包类型）
              if itemKind contains "archive" or itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" or itemKind contains "7Z" or itemKind contains "7z" or itemKind contains "TAR" or itemKind contains "tar" or itemKind contains "GZ" or itemKind contains "gz" then
                return "archive"
              end if
              
              -- 返回文件类型以便调试
              return "file:" & itemKind
            on error errMsg2
              return "kind_error:" & errMsg2
            end try
            
          on error errMsg
            return "error:" & errMsg
          end try
        end tell
      `;

      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout) => {
          if (error) {
            console.log('文件类型检查失败，使用系统默认');
            resolve(false);
            return;
          }
          
          const result = stdout.trim();
          const shouldHandle = result === "folder" || result === "archive";
          
          if (shouldHandle) {
            console.log(`✓ 检测到${result === "folder" ? "文件夹" : "压缩包"}，使用我们的预览功能`);
          } else {
            console.log(`✗ 检测到普通文件或其他情况(${result})，使用系统默认行为`);
          }
          
          resolve(shouldHandle);
        });
      });
      
    } catch (error) {
      console.log('shouldHandleSpacePreviewInFinder异常:', error.message);
      return false;
    }
  }

  simulateSystemShortcut(key) {
    // 暂时注销我们的快捷键，发送系统快捷键，然后重新注册
    let shortcutKey;
    let keyCode;
    let modifiers = '';
    
    if (key === 'space') {
      shortcutKey = 'Space';
      keyCode = 49; // 空格键的键码
      modifiers = '{}'; // 无修饰键
    } else {
      shortcutKey = `CommandOrControl+${key.toUpperCase()}`;
      keyCode = key === 'x' ? 7 : (key === 'v' ? 9 : 0); // x=7, v=9
      modifiers = '{command down}';
    }
    
    // 注销快捷键
    globalShortcut.unregister(shortcutKey);
    
    // 使用AppleScript模拟系统快捷键
    const script = `
      tell application "System Events"
        try
          key code ${keyCode} using ${modifiers}
        on error
          -- 忽略错误
        end try
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (error) => {
      if (error) {
        console.log(`模拟快捷键 ${key === 'space' ? '空格' : 'Cmd+' + key.toUpperCase()} 时出错:`, error.message);
      }
      
      // 延迟重新注册快捷键，避免立即捕获我们刚发送的快捷键
      setTimeout(() => {
        this.reregisterShortcut(key);
      }, 100);
    });
  }

  reregisterShortcut(key) {
    try {
      if (key === 'x') {
        const cutRegistered = globalShortcut.register('CommandOrControl+Shift+X', async () => {
          console.log('Cmd+Shift+X 快捷键被触发');
          const shouldHandle = await this.shouldHandleCutShortcut();
          if (shouldHandle) {
            console.log('✓ 在Finder中，处理剪切操作');
            this.handleCutShortcut();
          } else {
            console.log('✗ 不在Finder中，使用系统默认行为');
            this.simulateSystemShortcut('x');
          }
        });
        console.log('重新注册 Cmd+Shift+X:', cutRegistered ? '成功' : '失败');
      } else if (key === 'v') {
        const pasteRegistered = globalShortcut.register('CommandOrControl+Shift+V', async () => {
          console.log('Cmd+Shift+V 快捷键被触发');
          const shouldHandle = await this.shouldHandlePasteShortcut();
          if (shouldHandle) {
            console.log('✓ 在Finder中且有剪切文件，处理粘贴操作');
            this.handlePasteShortcut();
          } else {
            console.log('✗ 不在Finder中或无剪切文件，使用系统默认行为');
            this.simulateSystemShortcut('v');
          }
        });
        console.log('重新注册 Cmd+Shift+V:', pasteRegistered ? '成功' : '失败');
      } else if (key === 'space') {
        const spaceRegistered = globalShortcut.register('Space', async () => {
          console.log('空格键被触发');
          
          // 如果预览窗口已经打开，使用动画关闭它
          if (this.previewWindow && !this.previewWindow.isDestroyed()) {
            console.log('✓ 预览窗口已打开，关闭预览窗口');
            await this.animateWindowClose();
            return;
          }
          
          // 实时检查Finder状态
          const isInFinder = await this.isFinderActiveRealTime();
          console.log(`🔍 实时状态检查: Finder=${isInFinder}`);
          
          if (!isInFinder) {
            console.log('✗ 不在Finder中，使用系统默认行为');
            this.simulateSystemShortcut('space');
            return;
          }
          
          // 实时检查当前选中的文件
          const selectedFileInfo = await this.getSelectedFileRealTime();
          console.log(`📁 实时文件信息: ${selectedFileInfo || '无'}`);
          
          if (!selectedFileInfo) {
            console.log('✗ 没有选中文件，使用系统默认行为');
            this.simulateSystemShortcut('space');
            return;
          }
          
          // 解析文件类型
          const isFolder = selectedFileInfo.startsWith('folder:');
          const isArchive = selectedFileInfo.startsWith('archive:') || 
                           selectedFileInfo.includes('archive') || 
                           selectedFileInfo.includes('zip') || 
                           selectedFileInfo.includes('rar') ||
                           selectedFileInfo.includes('tar') ||
                           selectedFileInfo.includes('gz');
          
          console.log(`📂 文件类型分析: 文件夹=${isFolder}, 压缩包=${isArchive}`);
          
          if (isFolder || isArchive) {
            console.log(`✓ 检测到${isFolder ? '文件夹' : '压缩包'}，使用我们的预览功能`);
            this.handlePreviewShortcut();
          } else {
            console.log(`✗ 检测到普通文件(${selectedFileInfo})，使用系统默认行为`);
            this.simulateSystemShortcut('space');
          }
        });
        console.log('重新注册空格键:', spaceRegistered ? '成功' : '失败');
      }
    } catch (error) {
      console.log(`重新注册快捷键 ${key} 时出错:`, error.message);
    }
  }



  async getSelectedFile() {
    return new Promise((resolve, reject) => {
      console.log('尝试获取选中的文件...');
      exec(`osascript -e '
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) > 0 then
              set firstItem to item 1 of selectedItems
              return POSIX path of (firstItem as alias)
            else
              return ""
            end if
          on error errMsg
            return "ERROR: " & errMsg
          end try
        end tell
      '`, (error, stdout) => {
        console.log('AppleScript输出:', stdout);
        if (error) {
          console.error('AppleScript错误:', error);
          reject(error);
        } else {
          const result = stdout.trim();
          if (result.startsWith('ERROR:')) {
            console.error('Finder访问错误:', result);
            resolve('');
          } else {
            resolve(result);
          }
        }
      });
    });
  }

  async getSelectedFiles() {
    return new Promise((resolve, reject) => {
      const script = `
        tell application "Finder"
          try
            set selectedItems to selection
            if (count of selectedItems) = 0 then
              return ""
            end if
            
            set pathList to ""
            repeat with anItem in selectedItems
              if pathList is not "" then
                set pathList to pathList & "|||"
              end if
              set pathList to pathList & POSIX path of (anItem as alias)
            end repeat
            
            return pathList
          on error errMsg
            return "ERROR:" & errMsg
          end try
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        console.log('getSelectedFiles AppleScript输出:', stdout);
        if (error) {
          console.log('getSelectedFiles AppleScript错误:', error.message);
          resolve([]);
        } else {
          const result = stdout.trim();
          if (result.startsWith('ERROR:')) {
            console.log('Finder选择获取错误:', result);
            resolve([]);
          } else if (result === '') {
            console.log('没有选中的文件');
            resolve([]);
          } else {
            const paths = result.split('|||').map(p => p.trim()).filter(p => p);
            console.log('解析的文件路径:', paths);
            resolve(paths);
          }
        }
      });
    });
  }

  async isFinderActive() {
    return new Promise((resolve) => {
      exec(`osascript -e '
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          if frontApp is "Finder" then
            return "true"
          else
            return "false"
          end if
        end tell
      '`, (error, stdout) => {
        console.log('Finder激活检查结果:', stdout.trim());
        if (error) {
          console.error('检查Finder激活状态时出错:', error);
          resolve(false);
        } else {
          resolve(stdout.trim() === 'true');
        }
      });
    });
  }

  async showPreview(filePath) {
    if (this.previewWindow) {
      this.previewWindow.close();
    }

    // 获取选中文件的屏幕位置
    const iconPosition = await this.getSelectedFileIconPosition();
    
    // 计算最终窗口位置（屏幕中央）
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    const finalWidth = 800;
    const finalHeight = 600;
    const finalX = Math.round((screenWidth - finalWidth) / 2);
    const finalY = Math.round((screenHeight - finalHeight) / 2);
    
    // 计算初始位置和尺寸（从图标位置开始）
    const initialSize = 50; // 初始很小的尺寸
    const initialX = iconPosition.x - initialSize / 2;
    const initialY = iconPosition.y - initialSize / 2;

    this.previewWindow = new BrowserWindow({
      width: initialSize,
      height: initialSize,
      x: initialX,
      y: initialY,
      resizable: false,
      frame: false, // 移除窗口边框和标题栏
      show: false,
      transparent: true, // 启用透明背景支持毛玻璃效果
      opacity: 1,
      alwaysOnTop: true, // 保持在最前面
      skipTaskbar: true, // 不在任务栏显示
      vibrancy: 'fullscreen-ui', // macOS毛玻璃效果
      visualEffectState: 'active', // 确保毛玻璃效果始终激活
      backgroundMaterial: 'acrylic', // Windows毛玻璃效果
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false // 防止背景节流影响毛玻璃效果
      }
    });

    this.previewWindow.loadFile('src/windows/preview.html');
    
    // 发送文件路径到渲染进程
    this.previewWindow.webContents.once('dom-ready', () => {
      this.previewWindow.webContents.send('show-preview', filePath);
      
      // 显示窗口并开始动画
      this.previewWindow.show();
      this.animateWindowOpen(initialX, initialY, initialSize, finalX, finalY, finalWidth, finalHeight);
    });

    this.previewWindow.on('closed', () => {
      this.previewWindow = null;
      console.log('预览窗口已关闭');
    });
    
    // 添加窗口失去焦点时的处理（可选）
    this.previewWindow.on('blur', () => {
      // 可以在这里添加失去焦点时的逻辑，比如改变窗口透明度等
    });
  }

  async getSelectedFileIconPosition() {
    // 使用Electron的原生API获取鼠标位置
    return new Promise((resolve) => {
      try {
        // 使用Electron的screen模块获取鼠标位置
        const { screen } = require('electron');
        const mousePos = screen.getCursorScreenPoint();
        
        console.log(`✅ 使用鼠标位置: x=${mousePos.x}, y=${mousePos.y}`);
        resolve({ x: mousePos.x, y: mousePos.y });
      } catch (error) {
        console.log('Electron鼠标位置获取失败，使用备用方案:', error.message);
        
        // 备用方案：基于Finder窗口的智能估算
        const fallbackScript = `
          tell application "System Events"
            tell application process "Finder"
              if (count of windows) > 0 then
                set w to window 1
                set pos to position of w
                set siz to size of w
                set winX to item 1 of pos
                set winY to item 2 of pos
                set winW to item 1 of siz
                set winH to item 2 of siz
                return winX & ":" & winY & ":" & winW & ":" & winH
              else
                return "100:100:800:600"
              end if
            end tell
          end tell
        `;
        
        exec(`osascript -e '${fallbackScript}'`, (fallbackError, fallbackStdout) => {
          if (fallbackError) {
            console.log('备用方案也失败，使用默认位置');
            resolve({ x: 960, y: 540 });
            return;
          }
          
          const parts = fallbackStdout.trim().split(':');
          if (parts.length >= 4) {
            const windowX = parseInt(parts[0]) || 100;
            const windowY = parseInt(parts[1]) || 100;
            const windowWidth = parseInt(parts[2]) || 800;
            const windowHeight = parseInt(parts[3]) || 600;
            
            // 在窗口内容区域随机选择一个位置
            const contentX = windowX + 200; // 侧边栏宽度
            const contentY = windowY + 88;  // 工具栏高度
            const contentWidth = windowWidth - 200;
            const contentHeight = windowHeight - 88;
            
            const randomX = contentX + Math.random() * (contentWidth - 100);
            const randomY = contentY + Math.random() * (contentHeight - 100);
            
            console.log(`备用位置: x=${Math.round(randomX)}, y=${Math.round(randomY)}`);
            resolve({ x: Math.round(randomX), y: Math.round(randomY) });
          } else {
            resolve({ x: 960, y: 540 });
          }
        });
      }
    });
  }

  animateWindowOpen(startX, startY, startSize, endX, endY, endWidth, endHeight) {
    const steps = 20; // 减少步数，加快动画
    const duration = 250; // 减少时长，让动画更快
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const animate = () => {
      if (!this.previewWindow || this.previewWindow.isDestroyed()) {
        return;
      }
      
      currentStep++;
      const progress = currentStep / steps;
      
      // 使用平滑的ease-out缓动，去除弹性效果避免颤抖
      const eased = 1 - Math.pow(1 - progress, 3.5);
      
      // 计算当前位置和尺寸
      const currentX = Math.round(startX + (endX - startX) * eased);
      const currentY = Math.round(startY + (endY - startY) * eased);
      const currentWidth = Math.round(startSize + (endWidth - startSize) * eased);
      const currentHeight = Math.round(startSize + (endHeight - startSize) * eased);
      
      // 应用变换（保持完全不透明）
      this.previewWindow.setBounds({
        x: currentX,
        y: currentY,
        width: currentWidth,
        height: currentHeight
      });
      
      if (currentStep < steps) {
        setTimeout(animate, stepDuration);
      } else {
        // 动画完成，确保最终状态精确
        this.previewWindow.setBounds({
          x: endX,
          y: endY,
          width: endWidth,
          height: endHeight
        });
        this.previewWindow.setOpacity(1);
        this.previewWindow.focus();
        console.log('预览窗口打开动画完成');
      }
    };
    
    animate();
  }

  async animateWindowClose() {
    if (!this.previewWindow || this.previewWindow.isDestroyed()) {
      return;
    }

    // 获取当前窗口位置和尺寸
    const currentBounds = this.previewWindow.getBounds();
    const startX = currentBounds.x;
    const startY = currentBounds.y;
    const startWidth = currentBounds.width;
    const startHeight = currentBounds.height;

    // 获取目标位置（图标位置）
    const iconPosition = await this.getSelectedFileIconPosition();
    const endSize = 50;
    const endX = iconPosition.x - endSize / 2;
    const endY = iconPosition.y - endSize / 2;

    return new Promise((resolve) => {
      const steps = 15; // 减少步数，让关闭动画更快
      const duration = 200; // 减少时长，让关闭更快
      const stepDuration = duration / steps;
      
      let currentStep = 0;
      
      const animate = () => {
        if (!this.previewWindow || this.previewWindow.isDestroyed()) {
          resolve();
          return;
        }
        
        currentStep++;
        const progress = currentStep / steps;
        
        // 使用平滑的ease-in缓动函数
        const easeIn = Math.pow(progress, 2.5);
        
        // 计算当前位置和尺寸
        const currentX = Math.round(startX + (endX - startX) * easeIn);
        const currentY = Math.round(startY + (endY - startY) * easeIn);
        const currentWidth = Math.round(startWidth + (endSize - startWidth) * easeIn);
        const currentHeight = Math.round(startHeight + (endSize - startHeight) * easeIn);
        
        // 应用变换（保持完全不透明直到最后）
        this.previewWindow.setBounds({
          x: currentX,
          y: currentY,
          width: currentWidth,
          height: currentHeight
        });
        
        if (currentStep < steps) {
          setTimeout(animate, stepDuration);
        } else {
          // 动画完成，关闭窗口
          this.previewWindow.close();
          console.log('预览窗口关闭动画完成');
          resolve();
        }
      };
      
      animate();
    });
  }

  showStatus() {
    dialog.showMessageBox({
      type: 'info',
      title: 'Finder增强工具',
      message: '功能状态',
      detail: '智能预览功能: 开启\n• 空格键: 智能预览文件夹/压缩包\n  - 第一次按空格键: 从图标位置动画打开预览窗口\n  - 再次按空格键: 动画缩小回图标位置并关闭\n• Cmd+Shift+P: 备用预览快捷键\n\n智能剪切粘贴功能: 开启\n• Cmd+Shift+X: 剪切文件/文件夹\n• Cmd+Shift+V: 粘贴文件/文件夹\n\n应用正在后台运行，可通过托盘图标访问。\n\n智能特性:\n• 空格键只对文件夹/压缩包使用预览功能\n• 对普通文件保持系统原生Quick Look\n• 预览窗口支持优雅的打开/关闭动画\n• 动画效果模仿macOS原生Quick Look体验\n• 剪切粘贴只在Finder中生效，不影响其他应用'
    });
  }

  showPreferences() {
    // 显示设置窗口
    const prefsWindow = new BrowserWindow({
      width: 500,
      height: 400,
      resizable: false,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    prefsWindow.loadFile('src/windows/preferences.html');
  }

  showAbout() {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 Finder增强工具',
      message: 'Finder增强工具 v1.0.0',
      detail: '一个用于增强Mac Finder功能的实用工具。\n\n功能特性:\n• 空格键快速预览文件夹和压缩包内容\n• Cmd+X快捷键剪切文件夹\n• 系统托盘常驻运行'
    });
  }

  updateSettings(settings) {
    // 更新应用设置
    this.settings = settings;
    
    // 根据设置更新功能状态
    if (settings.enableSpacePreview) {
      this.setupSpaceKeyListener();
    }
    
    if (settings.enableCutShortcut) {
      // 重新注册快捷键
      globalShortcut.unregister('CommandOrControl+X');
      globalShortcut.register('CommandOrControl+X', () => {
        this.handleCutShortcut();
      });
    } else {
      globalShortcut.unregister('CommandOrControl+X');
    }
  }

  // 后台监控方法
  startBackgroundMonitor() {
    if (this.backgroundMonitor) {
      clearInterval(this.backgroundMonitor);
    }
    
    console.log('🔍 启动后台Finder状态监控...');
    
    // 立即执行一次初始化
    this.updateFinderStatus().then(() => {
      console.log(`📊 初始状态: Finder=${this.isFinderActive}, 选中文件=${this.currentSelectedFile || '无'}`);
    });
    
    this.backgroundMonitor = setInterval(async () => {
      try {
        await this.updateFinderStatus();
      } catch (error) {
        // 静默处理错误，避免日志过多
        if (Date.now() - this.lastFinderCheck > 5000) {
          console.log('后台监控遇到错误:', error.message);
          this.lastFinderCheck = Date.now();
        }
      }
    }, this.monitorInterval);
  }

  stopBackgroundMonitor() {
    if (this.backgroundMonitor) {
      clearInterval(this.backgroundMonitor);
      this.backgroundMonitor = null;
      console.log('🛑 停止后台Finder状态监控');
    }
  }

  async updateFinderStatus() {
    const now = Date.now();
    
    // 检查Finder是否为活动应用
    const script = `
      tell application "System Events"
        try
          set frontApp to name of first application process whose frontmost is true
          if frontApp is "Finder" then
            return "active"
          else
            return "inactive"
          end if
        on error
          return "error"
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { timeout: 500 }, (error, stdout) => {
        if (error) {
          resolve();
          return;
        }

        const result = stdout.trim();
        const wasFinderActive = this.isFinderActive;
        this.isFinderActive = (result === 'active');

        // 如果Finder状态发生变化，更新选中文件信息
        if (this.isFinderActive && (!wasFinderActive || now - this.lastFinderCheck > 1000)) {
          this.updateSelectedFileInfo();
        }
        
        // 即使Finder不活动，也定期更新选中文件信息（但频率较低）
        if (!this.isFinderActive && now - this.lastFinderCheck > 2000) {
          this.updateSelectedFileInfo();
        }

        this.lastFinderCheck = now;
        resolve();
      });
    });
  }

  async updateSelectedFileInfo() {
    // 不管Finder是否活动，都尝试获取选择信息
    // 这样即使用户切换到其他应用，我们也能保持最新的选择状态
    
    try {
      const script = `
        tell application "Finder"
          try
            set selectionCount to count of selection
            if selectionCount > 0 then
              set selectedItem to item 1 of selection
              set itemClass to class of selectedItem
              set itemName to name of selectedItem
              
              if itemClass is folder then
                return "folder:" & itemName
              else
                set itemKind to kind of selectedItem
                -- 简化压缩包检测
                if itemKind contains "archive" or itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" then
                  return "archive:" & itemName
                else
                  return "file:" & itemName
                end if
              end if
            else
              return "none"
            end if
          on error errMsg
            return "none"
          end try
        end tell
      `;

      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, { timeout: 1000 }, (error, stdout) => {
          console.log(`🔍 AppleScript执行结果: error=${!!error}, stdout="${stdout ? stdout.trim() : '空'}"`);
          
          if (!error && stdout) {
            const result = stdout.trim();
            console.log(`📋 解析结果: "${result}"`);
            
            if (result !== 'none' && !result.startsWith('error:')) {
              const oldFile = this.currentSelectedFile;
              this.currentSelectedFile = result;
              
              // 只有当文件发生变化时才显示更新信息
              if (oldFile !== result) {
                console.log(`📁 选中文件更新: ${oldFile || '无'} → ${result}`);
              }
            } else {
              if (this.currentSelectedFile !== null) {
                console.log(`📁 选中文件清空: ${this.currentSelectedFile} → 无`);
              }
              this.currentSelectedFile = null;
            }
          } else {
            if (error) {
              console.log(`❌ AppleScript错误: ${error.message}`);
            }
            if (this.currentSelectedFile !== null) {
              console.log(`📁 选中文件清空: ${this.currentSelectedFile} → 无 (错误)`);
            }
            this.currentSelectedFile = null;
          }
          resolve();
        });
      });
    } catch (error) {
      console.log(`💥 updateSelectedFileInfo异常: ${error.message}`);
      this.currentSelectedFile = null;
    }
  }

  // 快速检查方法，使用缓存的状态
  isCurrentlyInFinder() {
    return this.isFinderActive;
  }

  getCurrentSelectedFileInfo() {
    return this.currentSelectedFile;
  }



  // 实时检查Finder是否为活动应用
  async isFinderActiveRealTime() {
    const script = `
      tell application "System Events"
        try
          set frontApp to name of first application process whose frontmost is true
          if frontApp is "Finder" then
            return "true"
          else
            return "false"
          end if
        on error
          return "false"
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { timeout: 500 }, (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        const result = stdout.trim();
        resolve(result === 'true');
      });
    });
  }

  // 实时获取选中文件信息
  async getSelectedFileRealTime() {
    // 方法1: 尝试不激活Finder的检测
    const script1 = `
      tell application "Finder"
        try
          set sel to selection
          if (count of sel) > 0 then
            set selectedItem to item 1 of sel
            set itemClass to class of selectedItem
            set itemName to name of selectedItem
            
            if itemClass is folder then
              return "folder:" & itemName
            else
              set itemKind to kind of selectedItem
              if itemKind contains "archive" or itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" then
                return "archive:" & itemName
              else
                return "file:" & itemName
              end if
            end if
          else
            return "none"
          end if
        on error errMsg
          return "error"
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script1}'`, { timeout: 1000 }, (error, stdout) => {
        if (!error && stdout) {
          const result = stdout.trim();
          if (result !== 'none' && result !== 'error') {
            resolve(result);
            return;
          }
        }
        
        // 方法2: 如果方法1失败，尝试激活Finder
        const script2 = `
          tell application "Finder"
            activate
            delay 0.1
            try
              set sel to selection
              if (count of sel) > 0 then
                set selectedItem to item 1 of sel
                set itemClass to class of selectedItem
                set itemName to name of selectedItem
                
                if itemClass is folder then
                  return "folder:" & itemName
                else
                  set itemKind to kind of selectedItem
                  if itemKind contains "archive" or itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" then
                    return "archive:" & itemName
                  else
                    return "file:" & itemName
                  end if
                end if
              else
                return "none"
              end if
            on error errMsg
              return "none"
            end try
          end tell
        `;
        
        exec(`osascript -e '${script2}'`, { timeout: 2000 }, (error2, stdout2) => {
          if (error2 || !stdout2) {
            resolve(null);
            return;
          }
          const result = stdout2.trim();
          if (result === 'none') {
            resolve(null);
          } else {
            resolve(result);
          }
        });
      });
    });
  }

  // 检查Quick Look是否已经打开（更精确的检测）
  async isQuickLookOpen() {
    const script = `
      tell application "System Events"
        try
          -- 检查是否有Quick Look窗口打开
          set quickLookWindows to (every window whose name contains "Quick Look" or name contains "预览")
          if (count of quickLookWindows) > 0 then
            return "true"
          else
            return "false"
          end if
        on error
          return "false"
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { timeout: 300 }, (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        const result = stdout.trim();
        resolve(result === 'true');
      });
    });
  }
}

// 应用初始化
const finderApp = new FinderEnhanceApp();

app.whenReady().then(async () => {
  await finderApp.initialize();
});

app.on('window-all-closed', (event) => {
  // 阻止应用退出，保持在托盘运行
  event.preventDefault();
});

app.on('activate', () => {
  // macOS上，当dock图标被点击且没有其他窗口打开时
  if (BrowserWindow.getAllWindows().length === 0) {
    finderApp.showStatus();
  }
});

app.on('will-quit', () => {
  // 清理全局快捷键
  globalShortcut.unregisterAll();
  
  // 清理后台监控
  if (finderApp.backgroundMonitor) {
    finderApp.stopBackgroundMonitor();
  }
  
  // 清理定时器（如果存在）
  if (finderApp.spaceKeyInterval) {
    clearInterval(finderApp.spaceKeyInterval);
  }
});

// IPC事件处理
ipcMain.handle('get-file-preview', async (event, filePath) => {
  return await finderApp.previewService.getPreview(filePath);
});

ipcMain.handle('cut-files', async (event, filePaths) => {
  return await finderApp.clipboardService.cutFiles(filePaths);
});

ipcMain.handle('update-settings', async (event, settings) => {
  // 更新应用设置
  finderApp.updateSettings(settings);
  return { success: true };
});

ipcMain.handle('set-auto-start', async (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}); 