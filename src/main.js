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
    this.isPreviewCreating = false; // 添加创建中标记
    this.previewService = new PreviewService();
    this.clipboardService = new ClipboardService();
    
    // 💡 应用退出控制
    this.isQuitting = false; // 控制应用是否正在退出
    
    // 💡 完全接管模式 - 高效状态缓存
    this.cachedFinderActive = false;
    this.cachedSelectedFile = null;
    this.lastStateUpdate = 0;
    this.stateUpdateInterval = 150; // 150ms 更新状态，平衡性能和响应性
    this.monitorTimer = null;
    
    // 💡 空格键智能管理相关
    this.spaceKeyBlocked = false; // 防止重复触发
    this.lastSpaceKeyTime = 0;
    this.spaceKeyThrottle = 50; // 50ms 防抖
    this.isForwarding = false; // 防止系统快捷键转发循环
    this.isSimulating = false; // 防止快捷键模拟循环
    this.spaceKeyRegistered = false; // 记录空格键是否已注册
    
    // 💡 快捷键健康监控
    this.healthCheckTimer = null;
    this.cutShortcutRegistered = false;
    this.pasteShortcutRegistered = false;
    
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
    console.log('🚀 Finder增强工具启动中...');
    
    // 💡 隐藏Dock图标，让应用完全在后台运行
    if (process.platform === 'darwin') {
      app.dock.hide();
      console.log('✅ 已隐藏Dock图标，应用将在后台运行');
    }
    
    // 检查辅助功能权限
    const hasPermissions = await this.checkAccessibilityPermissions();
    if (!hasPermissions) {
      this.showPermissionDialog();
      return;
    }
    console.log('辅助功能权限已授予');

    // 创建托盘图标
    await this.createTray();
    
    // 启动高效状态监控
    this.startOptimizedMonitor();
    
    // 注册完全接管的全局快捷键
    this.registerOptimizedShortcuts();
    
    // 启动快捷键健康监控
    this.startShortcutHealthCheck();
    
    // 初始化服务
    console.log('预览服务已初始化');
    console.log('剪贴板服务已初始化');
    
    console.log('✅ Finder增强工具启动完成');
  }

  async checkAccessibilityPermissions() {
    if (process.platform !== 'darwin') return true;
    
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
          if (result === 'denied' || error) {
            console.log('❌ 需要辅助功能权限才能正常运行');
            resolve(false);
          } else {
            console.log('✅ 辅助功能权限已授予');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('检查权限时出错:', error);
      return false;
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
    console.log('创建托盘图标...');
    try {
      const { nativeImage } = require('electron');
      const path = require('path');
      
      // 尝试加载自定义图标
      const iconPath = path.join(__dirname, '..', 'assets', 'icon4.png');
      console.log('尝试加载图标:', iconPath);
      
      let icon;
      try {
        // 加载并调整图标大小适合托盘
        icon = nativeImage.createFromPath(iconPath);
        
        if (icon.isEmpty()) {
          throw new Error('图标文件为空或无法读取');
        }
        
        // 调整图标大小为16x16（macOS托盘标准大小）
        icon = icon.resize({ width: 16, height: 16 });
        
        // 设置为模板图标，这样会自动适应系统主题（深色/浅色模式）
        icon.setTemplateImage(true);
        
        console.log('✅ 成功加载自定义图标');
      } catch (iconError) {
        console.log('❌ 无法加载自定义图标，使用默认图标:', iconError.message);
        
        // 回退到默认的黑色方块图标
        const size = 16;
        const buffer = Buffer.alloc(size * size * 4); // RGBA
        
        // 填充为黑色
        for (let i = 0; i < buffer.length; i += 4) {
          buffer[i] = 0;     // R
          buffer[i + 1] = 0; // G  
          buffer[i + 2] = 0; // B
          buffer[i + 3] = 255; // A (不透明)
        }
        
        icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
        icon.setTemplateImage(true);
      }
      
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
        label: '预览功能: 开启 (Space)',
        type: 'normal',
        click: () => {
          this.showStatus();
        }
      },
      {
        label: '剪切: Cmd+X',
        type: 'normal',
        click: () => {
          this.showStatus();
        }
      },
      {
        label: '粘贴: Cmd+V',
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
          this.quitApp();
        }
      }
    ]);

    this.tray.setToolTip('Finder增强工具');
    this.tray.setContextMenu(contextMenu);
  }

  // 💡 完全接管的高效状态监控
  startOptimizedMonitor() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    
    console.log('🔄 启动高效状态监控...');
    
    // 立即更新一次状态并管理空格键
    this.updateCachedState();
    
    // 初始化时也检查一次空格键状态
    setTimeout(() => {
      this.manageSpaceKeyRegistration();
    }, 500);
    
    // 设置定时器持续监控
    this.monitorTimer = setInterval(() => {
      this.updateCachedState();
    }, this.stateUpdateInterval);
  }

  async updateCachedState() {
    try {
      const now = Date.now();
      
      // 使用单个优化的 AppleScript 获取所有需要的信息
      const script = `
        set results to {}
        
        -- 检查前台应用
        tell application "System Events"
          try
            set frontApp to name of first application process whose frontmost is true
            if frontApp is "Finder" then
              set end of results to "finder_active"
            else
              set end of results to "finder_inactive"
            end if
          on error
            set end of results to "finder_error"
          end try
        end tell
        
        -- 如果 Finder 活跃，获取选中文件信息
        if item 1 of results is "finder_active" then
          tell application "Finder"
            try
              set sel to selection
              if (count of sel) > 0 then
                set selectedItem to item 1 of sel
                set itemClass to class of selectedItem
                set itemName to name of selectedItem
                
                if itemClass is folder then
                  set end of results to "folder:" & itemName
                else
                  set itemKind to kind of selectedItem
                  if itemKind contains "Archive" or itemKind contains "ZIP" or itemKind contains "zip" or itemKind contains "RAR" or itemKind contains "rar" or itemKind contains "tar" or itemKind contains "gz" then
                    set end of results to "archive:" & itemName
                  else
                    set end of results to "file:" & itemName
                  end if
                end if
              else
                set end of results to "no_selection"
              end if
            on error
              set end of results to "selection_error"
            end try
          end tell
        else
          set end of results to "not_in_finder"
        end if
        
        return (item 1 of results) & "|" & (item 2 of results)
      `;

      exec(`osascript -e '${script}'`, { timeout: 300 }, (error, stdout) => {
        if (error) {
          // 出错时保持上次状态，避免频繁状态切换
          return;
        }

        const result = stdout.trim();
        const [finderStatus, fileStatus] = result.split('|');
        
        // 更新缓存状态
        const wasFinderActive = this.cachedFinderActive;
        this.cachedFinderActive = (finderStatus === 'finder_active');
        
        const oldSelectedFile = this.cachedSelectedFile;
        if (fileStatus === 'no_selection' || fileStatus === 'not_in_finder' || fileStatus === 'selection_error') {
          this.cachedSelectedFile = null;
        } else {
          this.cachedSelectedFile = fileStatus;
        }
        
        this.lastStateUpdate = now;
        
        // 只在状态真正变化时输出日志和动态管理空格键
        if (wasFinderActive !== this.cachedFinderActive || oldSelectedFile !== this.cachedSelectedFile) {
          console.log(`📊 状态更新: Finder=${this.cachedFinderActive}, 文件=${this.cachedSelectedFile || '无'}`);
          
          // 💡 动态管理空格键注册
          this.manageSpaceKeyRegistration();
          
          // 💡 动态管理剪切/粘贴快捷键
          this.manageCutPasteShortcuts();
        }
      });
    } catch (error) {
      // 静默处理错误
    }
  }

  // 💡 动态快捷键管理 - 只在需要时才注册
  registerOptimizedShortcuts() {
    console.log('🎯 启动动态快捷键管理...');
    
    // 🔄 最新策略：动态注册/注销快捷键，而不是一直注册然后临时释放
    // 这样可以完全避免按键丢失问题
    
    this.cutShortcutRegistered = false;
    this.pasteShortcutRegistered = false;
    
    // 初始状态下不注册任何快捷键，让系统自然处理
    // 只有当进入Finder且满足条件时才动态注册
    
    console.log('✅ 动态快捷键管理已启动，初始状态：让系统自然处理所有快捷键');

    // 💡 空格键智能管理 - 不是全局注册，而是按需注册
    this.setupSpaceKeyManagement();
    
    // 智能空格键管理 - 根据当前选中的文件类型决定是否注册
    // 不再强制注册空格键，改为按需智能注册

    // 备用快捷键
    const backupRegistered = globalShortcut.register('CommandOrControl+Shift+P', () => {
      console.log('🔄 Cmd+Shift+P: 强制预览');
      this.handlePreviewShortcut();
    });
    console.log('Cmd+Shift+P 快捷键注册:', backupRegistered ? '成功' : '失败');
    
    console.log('✅ 智能快捷键注册完成');
  }







  // 💡 空格键智能管理 - 按需注册/注销
  setupSpaceKeyManagement() {
    console.log('🎯 设置空格键智能管理（按需注册）');
    // 初始状态不注册空格键，让系统自然处理
  }

  // 注册空格键
  registerSpaceKey() {
    if (this.spaceKeyRegistered) return;
    
    if (globalShortcut.isRegistered('Space')) {
      globalShortcut.unregister('Space');
    }
    
    const registered = globalShortcut.register('Space', async () => {
      await this.handleSpaceKeyFullTakeover();
    });
    
    if (registered) {
      this.spaceKeyRegistered = true;
      console.log('🔒 空格键已注册拦截（文件夹预览模式）');
    } else {
      console.log('❌ 无法注册空格键');
    }
  }

  // 注销空格键
  unregisterSpaceKey() {
    if (!this.spaceKeyRegistered) return;
    
    if (globalShortcut.isRegistered('Space')) {
      globalShortcut.unregister('Space');
      this.spaceKeyRegistered = false;
      console.log('📤 空格键已释放给系统（PDF/文档模式）');
    }
  }

  // 💡 智能管理空格键注册 - 根据当前状态决定是否需要拦截
  manageSpaceKeyRegistration() {
    const shouldRegister = this.shouldInterceptSpaceKey();
    
    if (shouldRegister && !this.spaceKeyRegistered) {
      this.registerSpaceKey();
    } else if (!shouldRegister && this.spaceKeyRegistered) {
      this.unregisterSpaceKey();
    }
  }

  // 💡 动态管理剪切/粘贴快捷键
  manageCutPasteShortcuts() {
    // 判断是否需要注册Cmd+X
    const shouldRegisterCut = this.cachedFinderActive && this.cachedSelectedFile;
    
    if (shouldRegisterCut && !this.cutShortcutRegistered) {
      console.log('📌 注册 Cmd+X 快捷键（Finder中有选中文件）');
      this.registerCutShortcut();
    } else if (!shouldRegisterCut && this.cutShortcutRegistered) {
      console.log('📤 注销 Cmd+X 快捷键（让系统自然处理）');
      this.unregisterCutShortcut();
    }
    
    // 判断是否需要注册Cmd+V
    const shouldRegisterPaste = this.cachedFinderActive && this.clipboardService.hasCutFiles();
    
    if (shouldRegisterPaste && !this.pasteShortcutRegistered) {
      console.log('📌 注册 Cmd+V 快捷键（Finder中有我们剪切的文件）');
      this.registerPasteShortcut();
    } else if (!shouldRegisterPaste && this.pasteShortcutRegistered) {
      console.log('📤 注销 Cmd+V 快捷键（让系统自然处理）');
      this.unregisterPasteShortcut();
    }
  }

  // 注册Cmd+X快捷键
  registerCutShortcut() {
    if (this.cutShortcutRegistered) return;
    
    const registered = globalShortcut.register('CommandOrControl+X', () => {
      console.log('✂️ Cmd+X: 在Finder中处理剪切');
      this.handleCutShortcut();
    });
    
    if (registered) {
      this.cutShortcutRegistered = true;
      console.log('✅ Cmd+X 快捷键注册成功');
    } else {
      console.log('❌ Cmd+X 快捷键注册失败');
    }
  }

  // 注销Cmd+X快捷键
  unregisterCutShortcut() {
    if (!this.cutShortcutRegistered) return;
    
    if (globalShortcut.isRegistered('CommandOrControl+X')) {
      globalShortcut.unregister('CommandOrControl+X');
      this.cutShortcutRegistered = false;
      console.log('✅ Cmd+X 快捷键已注销');
    }
  }

  // 注册Cmd+V快捷键
  registerPasteShortcut() {
    if (this.pasteShortcutRegistered) return;
    
    const registered = globalShortcut.register('CommandOrControl+V', () => {
      console.log('📋 Cmd+V: 在Finder中处理粘贴');
      this.handlePasteShortcut();
    });
    
    if (registered) {
      this.pasteShortcutRegistered = true;
      console.log('✅ Cmd+V 快捷键注册成功');
    } else {
      console.log('❌ Cmd+V 快捷键注册失败');
    }
  }

  // 注销Cmd+V快捷键
  unregisterPasteShortcut() {
    if (!this.pasteShortcutRegistered) return;
    
    if (globalShortcut.isRegistered('CommandOrControl+V')) {
      globalShortcut.unregister('CommandOrControl+V');
      this.pasteShortcutRegistered = false;
      console.log('✅ Cmd+V 快捷键已注销');
    }
  }

  // 判断是否需要拦截空格键
  shouldInterceptSpaceKey() {
    // 只要在 Finder 激活且选中了文件夹或压缩包就拦截空格键进行预览
    if (!this.cachedFinderActive || !this.cachedSelectedFile) {
      return false;
    }

    // 只对文件夹和压缩包启用自定义预览，普通文件让macOS原生Quick Look处理
    return this.cachedSelectedFile.startsWith('folder:') || 
           this.cachedSelectedFile.startsWith('archive:');
  }

  // 💡 空格键智能拦截处理 - 改进版本，解决窗口状态混乱问题
  async handleSpaceKeyFullTakeover() {
    const now = Date.now();
    
    // 增强防抖处理
    if (this.spaceKeyBlocked || (now - this.lastSpaceKeyTime) < this.spaceKeyThrottle) {
      console.log('🔄 空格键防抖中，跳过');
      return;
    }
    
    this.lastSpaceKeyTime = now;
    this.spaceKeyBlocked = true;
    
    try {
      console.log('⚡ 空格键拦截 - 处理预览');
      
      // 检查是否正在创建预览窗口
      if (this.isPreviewCreating) {
        console.log('🔄 预览窗口正在创建中，跳过 (isPreviewCreating=true)');
        return;
      }
      
      // 改进的窗口状态检查：确保窗口真正存在且可用
      const windowExists = this.previewWindow && 
                          !this.previewWindow.isDestroyed();
      
      if (windowExists) {
        console.log('⚡ 预览窗口存在，关闭窗口');
        await this.animateWindowClose();
        return;
      }
      
      // 如果窗口存在，先彻底清理
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        console.log('🧹 清理现有预览窗口');
        this.previewWindow.destroy();
        this.previewWindow = null;
        this.isPreviewCreating = false;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 获取当前选中的文件路径
      const filePath = await this.getSelectedFilePathQuick();
      if (filePath) {
        console.log('✅ 显示自定义预览:', filePath);
        await this.showPreview(filePath);
      } else {
        console.log('❌ 无法获取文件路径，可能没有选中文件');
      }
      
    } catch (error) {
      console.error('❌ 空格键处理异常:', error);
    } finally {
      // 延迟解除阻塞，确保动画完成
      setTimeout(() => {
        this.spaceKeyBlocked = false;
      }, 200);
    }
  }



  async handleSpaceKeyPress(filePath = null) {
    try {
      // 如果没有提供文件路径，则获取当前选中的文件
      const selectedFile = filePath || await this.getSelectedFilePathQuick();
      if (selectedFile) {
        console.log('显示预览窗口:', selectedFile);
        this.showPreview(selectedFile);
      } else {
        console.log('未找到选中的文件');
      }
    } catch (error) {
      console.error('处理空格键按下时出错:', error);
    }
  }

  async handlePreviewShortcut() {
    try {
      // 💡 优化: 使用缓存状态和实时获取文件路径
      if (this.cachedFinderActive && this.cachedSelectedFile) {
        // 获取完整的文件路径
        const selectedFile = await this.getSelectedFilePathQuick();
        if (selectedFile) {
          console.log('快捷键触发预览:', selectedFile);
          this.showPreview(selectedFile);
        } else {
          console.log('未能获取文件路径');
        }
      } else {
        console.log('Finder未激活或未选中文件');
      }
    } catch (error) {
      console.error('处理预览快捷键时出错:', error);
    }
  }

  // 💡 快速获取选中文件的完整路径
  async getSelectedFilePathQuick() {
    const script = `
      tell application "Finder"
        try
          set sel to selection
          if (count of sel) > 0 then
            return POSIX path of (item 1 of sel as alias)
          else
            return ""
          end if
        on error
          return ""
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { timeout: 500 }, (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
        } else {
          const result = stdout.trim();
          resolve(result || null);
        }
      });
    });
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

  async showPreview(filePath) {
    console.log('🎬 开始显示预览:', filePath);
    
    // 防止重复创建
    if (this.isPreviewCreating) {
      console.log('🔄 预览窗口正在创建中，跳过重复创建 (isPreviewCreating=true)');
      return;
    }
    
    console.log('🚀 开始创建预览窗口，设置 isPreviewCreating=true');
    this.isPreviewCreating = true;
    
    try {
      // 如果预览窗口已存在且未被销毁，先清理
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        try {
          console.log('🧹 清理旧的预览窗口');
          // 直接销毁窗口
          this.previewWindow.destroy();
          this.previewWindow = null;
          this.isPreviewCreating = false;
          
          // 等待一小段时间确保窗口完全清理
          await new Promise(resolve => setTimeout(resolve, 50));
          console.log('✅ 旧预览窗口已销毁清理');
        } catch (error) {
          console.log('销毁旧预览窗口时出错:', error);
          this.previewWindow = null;
          this.isPreviewCreating = false; // 重置创建中标记
        }
      }
    } catch (error) {
      console.error('预览窗口预处理出错:', error);
      this.isPreviewCreating = false;
      return;
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

    try {
      console.log('🏗️ 创建预览窗口');
      this.previewWindow = new BrowserWindow({
        width: initialSize,
        height: initialSize,
        x: initialX,
        y: initialY,
        resizable: false,
        frame: false,
        show: false,
        transparent: true,
        opacity: 0,
        alwaysOnTop: true,
        skipTaskbar: true,
        vibrancy: 'fullscreen-ui',
        visualEffectState: 'active',
        backgroundMaterial: 'acrylic',
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        hasShadow: false,
        thickFrame: false,
        minimizable: false,
        maximizable: false,
        closable: false, // 完全禁用关闭按钮
        focusable: true,
        fullscreenable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          backgroundThrottling: false,
          hardwareAcceleration: true,
          enableRemoteModule: false,
          webSecurity: false,
          allowRunningInsecureContent: false,
          experimentalFeatures: true,
          offscreen: false,
          paintWhenInitiallyHidden: false,
          v8CacheOptions: 'code',
          enableWebSQL: false,
          enableBlinkFeatures: 'CSSBackdropFilter',
          devTools: false,
          sandbox: false,
          partition: null,
          preload: null,
          additionalArguments: ['--disable-dev-shm-usage', '--disable-web-security']
        }
      });

      // 添加错误处理
      this.previewWindow.on('unresponsive', () => {
        console.log('预览窗口无响应，将重启');
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.previewWindow.destroy();
          this.previewWindow = null;
        }
        this.isPreviewCreating = false; // 重置创建中标记
      });

      this.previewWindow.on('closed', () => {
        // 这个事件可能不会被触发（如果使用destroy），所以不依赖它来重置状态
        console.log('预览窗口 closed 事件触发');
      });

      // 阻止开发者工具打开
      this.previewWindow.webContents.on('devtools-opened', () => {
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.previewWindow.webContents.closeDevTools();
        }
      });

      // 简化和增强DOM加载处理
      let domReady = false;
      let loadTimeout = null;
      
      // 多重DOM准备就绪检测机制
      const handleDOMReady = () => {
        if (domReady) return; // 防止重复执行
        domReady = true;
        
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        
        console.log('🎯 DOM已准备就绪，开始设置预览');
        if (!this.previewWindow || this.previewWindow.isDestroyed()) {
          console.log('❌ 预览窗口已被销毁，退出设置');
          return;
        }
        
        console.log('📤 发送预览数据到渲染进程:', filePath);
        this.previewWindow.webContents.send('show-preview', filePath);
        
        // 简化按钮隐藏代码
        this.previewWindow.webContents.executeJavaScript(`
          // 隐藏body直到动画开始
          document.body.style.visibility = 'hidden';
          document.body.style.opacity = '0';
          
          // 强制隐藏所有按钮
          const hideButtons = () => {
            const buttons = document.querySelectorAll('button, input[type="button"], .close-button, .minimize-button, .zoom-button');
            buttons.forEach(btn => {
              btn.style.display = 'none !important';
              btn.style.visibility = 'hidden !important';
              btn.disabled = true;
            });
          };
          
          hideButtons();
          setInterval(hideButtons, 500);
        `).catch(() => {});
        
        // 显示窗口并开始动画
        if (!this.previewWindow || this.previewWindow.isDestroyed()) {
          return;
        }
        
        this.previewWindow.show();
        
        // 立即开始动画
        this.animateWindowOpen(iconPosition.x - 25, iconPosition.y - 25, 50, finalX, finalY, finalWidth, finalHeight);
        
        // 重置创建中标记
        console.log('✅ DOM准备完成，重置 isPreviewCreating=false');
        this.isPreviewCreating = false;
      };
      
      // 注册多个DOM准备事件监听器
      this.previewWindow.webContents.once('dom-ready', handleDOMReady);
      this.previewWindow.webContents.once('did-finish-load', handleDOMReady);
      
      // 设置超时强制执行机制（缩短为3秒）
      loadTimeout = setTimeout(() => {
        if (!domReady) {
          console.log('⚠️ DOM加载超时，强制执行');
          handleDOMReady();
        } else {
          // 如果DOM已经准备好但标记还没重置，确保重置
          this.isPreviewCreating = false;
        }
      }, 3000);

      // 加载预览页面
      console.log('📄 加载预览页面');
      await this.previewWindow.loadFile('src/windows/preview.html');
      console.log('✅ 预览页面加载完成');
      
      // 添加窗口失去焦点时的处理（可选）
      this.previewWindow.on('blur', () => {
        // 可以在这里添加失去焦点时的逻辑，比如改变窗口透明度等
      });

    } catch (error) {
      console.error('❌ 创建预览窗口时出错:', error);
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        try {
          this.previewWindow.destroy();
        } catch (destroyError) {
          console.error('销毁预览窗口时出错:', destroyError);
        }
        this.previewWindow = null;
      }
      // 重置创建中标记
      this.isPreviewCreating = false;
      // 不要抛出错误，而是显示错误信息
      console.error('预览功能暂时不可用，请稍后重试');
    }
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

  // 🎬 改进的CSS变换动画 - 更稳定的版本
  animateWindowOpenCSS(iconX, iconY, finalX, finalY, finalWidth, finalHeight) {
    const duration = 80;
    
    // 计算从图标位置到窗口中心的变换
    const windowCenterX = finalX + finalWidth / 2;
    const windowCenterY = finalY + finalHeight / 2;
    const translateX = iconX - windowCenterX;
    const translateY = iconY - windowCenterY;
    const initialScale = 0.1;
    
    // 设置窗口透明度
    this.previewWindow.setOpacity(1);
    
    // 等待DOM准备好后再执行动画
    this.previewWindow.webContents.executeJavaScript(`
      // 确保DOM已加载
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAnimation);
      } else {
        startAnimation();
      }
      
      function startAnimation() {
        const container = document.querySelector('.preview-container');
        if (!container) {
          console.error('找不到 .preview-container 元素');
          return;
        }
        
        // 清除可能存在的动画类
        container.classList.remove('animate-in', 'animate-out');
        
        // 设置初始状态
        container.style.transform = 'translate(${translateX}px, ${translateY}px) scale(${initialScale})';
        container.style.opacity = '0';
        container.style.transition = 'all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        // 强制重绘
        container.offsetHeight;
        
        // 开始动画到最终状态
        setTimeout(() => {
          container.style.transform = 'translate(0, 0) scale(1)';
          container.style.opacity = '1';
        }, 10);
      }
    `).then(() => {
      // 动画完成后发送信号
      setTimeout(() => {
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.previewWindow.webContents.send('window-animation-complete');
          console.log('🎬 预览窗口打开动画完成 (CSS变换)');
        }
      }, duration + 20);
    }).catch(error => {
      console.error('CSS动画执行失败:', error);
      // 回退到原始动画方法
      this.animateWindowOpen(iconX - 25, iconY - 25, 50, finalX, finalY, finalWidth, finalHeight);
    });
  }

  // 🎬 超稳定动画 - 打开窗口 (备用方法)
  animateWindowOpen(startX, startY, startSize, endX, endY, endWidth, endHeight) {
    const duration = 80; // 加速到0.15秒，更快响应
    const steps = 8; // 减少步数保持流畅
    const stepDuration = duration / steps;
    const startTime = performance.now();
    
    // 💡 简单但稳定的缓动函数
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    
    let currentStep = 0;
    let animationId;
    
    const animate = () => {
      if (!this.previewWindow || this.previewWindow.isDestroyed()) {
        if (animationId) clearTimeout(animationId);
        return;
      }
      
      currentStep++;
      const progress = currentStep / steps;
      const eased = easeOutCubic(progress);
      
      // 🚫 在第一帧恢复body可见性
      if (currentStep === 1) {
        this.previewWindow.webContents.executeJavaScript(`
          document.body.style.visibility = 'visible';
          document.body.style.opacity = '1';
        `).catch(() => {});
      }
      
      // 💡 简单直接的计算 - 避免复杂运算
      const currentX = startX + (endX - startX) * eased;
      const currentY = startY + (endY - startY) * eased;
      const currentWidth = startSize + (endWidth - startSize) * eased;
      const currentHeight = startSize + (endHeight - startSize) * eased;
      
      // 💡 透明度动画
      const opacity = Math.min(1, progress * 1.8);
      
      // 💡 一次性更新所有属性
      try {
        this.previewWindow.setBounds({
          x: Math.round(currentX),
          y: Math.round(currentY),
          width: Math.round(currentWidth),
          height: Math.round(currentHeight)
        });
        this.previewWindow.setOpacity(opacity);
      } catch (error) {
        // 静默处理窗口更新错误
        return;
      }
      
      if (currentStep < steps) {
        // 💡 固定间隔，确保稳定性
        animationId = setTimeout(animate, stepDuration);
      } else {
        // 动画完成，确保最终状态精确
        try {
          this.previewWindow.setBounds({
            x: endX,
            y: endY,
            width: endWidth,
            height: endHeight
          });
          this.previewWindow.setOpacity(1);
          this.previewWindow.focus();
          
          // 🎬 窗口动画完成，通知渲染进程显示内容
          console.log('🎬 发送窗口动画完成信号');
          // 确保渲染进程准备好接收信号
          setTimeout(() => {
            if (this.previewWindow && !this.previewWindow.isDestroyed()) {
              this.previewWindow.webContents.send('window-animation-complete');
            }
          }, 10);
        } catch (error) {
          // 静默处理
        }
        console.log('🎬 预览窗口打开动画完成 (超稳定)');
      }
    };
    
    // 立即开始动画
    animate();
  }

  // 🎬 超稳定动画 - 关闭窗口
  async animateWindowCloseCSS() {
    if (!this.previewWindow || this.previewWindow.isDestroyed()) {
      return;
    }

    const duration = 60;
    
    try {
      // 执行关闭动画
      await this.previewWindow.webContents.executeJavaScript(`
        const container = document.querySelector('.preview-container');
        if (!container) {
          console.error('找不到 .preview-container 元素');
          return false;
        }
        
        // 设置关闭动画
        container.style.transition = 'all ${duration}ms cubic-bezier(0.55, 0.055, 0.675, 0.19)';
        container.style.transform = 'scale(0.1)';
        container.style.opacity = '0';
        
        return true;
      `);
      
      // 等待动画完成后关闭窗口
      setTimeout(() => {
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.previewWindow.close();
          console.log('🎬 预览窗口关闭动画完成 (CSS变换)');
        }
      }, duration + 10);
      
    } catch (error) {
      console.error('关闭动画执行失败:', error);
      // 直接关闭窗口
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        this.previewWindow.close();
      }
    }
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
      const duration = 80; // 关闭动画更快，0.12秒
      const steps = 8; // 减少步数保持流畅
      const stepDuration = duration / steps;
      
      // 💡 简单但稳定的关闭缓动
      const easeInCubic = (t) => t * t * t;
      
      let currentStep = 0;
      let animationId;
      
      const animate = () => {
        if (!this.previewWindow || this.previewWindow.isDestroyed()) {
          if (animationId) clearTimeout(animationId);
          resolve();
          return;
        }
        
        currentStep++;
        const progress = currentStep / steps;
        const eased = easeInCubic(progress);
        
        // 💡 简单直接的计算
        const currentX = startX + (endX - startX) * eased;
        const currentY = startY + (endY - startY) * eased;
        const currentWidth = startWidth + (endSize - startWidth) * eased;
        const currentHeight = startHeight + (endSize - startHeight) * eased;
        
        // 💡 简单的透明度渐变
        let opacity;
        if (progress < 0.7) {
          opacity = 1; // 前70%保持不透明
        } else {
          // 最后30%线性淡出
          const fadeProgress = (progress - 0.7) / 0.3;
          opacity = Math.max(0, 1 - fadeProgress);
        }
        
        // 💡 一次性更新所有属性
        try {
          this.previewWindow.setBounds({
            x: Math.round(currentX),
            y: Math.round(currentY),
            width: Math.round(currentWidth),
            height: Math.round(currentHeight)
          });
          this.previewWindow.setOpacity(opacity);
        } catch (error) {
          // 静默处理窗口更新错误
          resolve();
          return;
        }
        
        if (currentStep < steps) {
          // 💡 固定间隔，确保稳定性
          animationId = setTimeout(animate, stepDuration);
        } else {
          // 动画完成，直接销毁窗口并重置状态
          try {
            this.previewWindow.destroy();
            this.previewWindow = null;
            this.isPreviewCreating = false;
            console.log('🎬 预览窗口关闭动画完成，窗口已销毁，重置 isPreviewCreating=false');
          } catch (error) {
            // 静默处理销毁错误
            this.previewWindow = null;
            this.isPreviewCreating = false;
          }
          resolve();
        }
      };
      
      // 立即开始动画
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
      width: 480,
      height: 520,
      resizable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      thickFrame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false // 禁用开发者工具
      }
    });

    prefsWindow.loadFile('src/windows/preferences.html');
    
    // 居中显示
    prefsWindow.center();
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
      // 重新设置空格键管理
      this.setupSpaceKeyManagement();
    }
    
    if (settings.enableCutShortcut) {
      // 重新注册快捷键
      this.registerOptimizedShortcuts();
    } else {
      // 注销剪切快捷键
      globalShortcut.unregister('CommandOrControl+X');
      globalShortcut.unregister('CommandOrControl+V');
    }
  }

  // 快速检查方法，使用缓存的状态
  isCurrentlyInFinder() {
    return this.cachedFinderActive;
  }

  getCurrentSelectedFileInfo() {
    return this.cachedSelectedFile;
  }

  // 💡 清理监控定时器
  stopOptimizedMonitor() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      console.log('🛑 停止优化状态监控');
    }
  }

  // 启动快捷键健康检查
  startShortcutHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    console.log('🏥 启动快捷键健康监控...');
    
    // 每5秒检查一次快捷键注册状态
    this.healthCheckTimer = setInterval(() => {
      this.checkShortcutHealth();
    }, 5000);
  }

  // 检查快捷键健康状态
  checkShortcutHealth() {
    try {
      // 动态注册策略下，主要检查状态一致性
      const cutRegistered = globalShortcut.isRegistered('CommandOrControl+X');
      const pasteRegistered = globalShortcut.isRegistered('CommandOrControl+V');
      
      // 验证注册状态是否与我们的记录一致
      if (cutRegistered !== this.cutShortcutRegistered) {
        console.log(`⚠️ Cmd+X 状态不一致: 实际=${cutRegistered}, 记录=${this.cutShortcutRegistered}`);
        this.cutShortcutRegistered = cutRegistered;
      }
      
      if (pasteRegistered !== this.pasteShortcutRegistered) {
        console.log(`⚠️ Cmd+V 状态不一致: 实际=${pasteRegistered}, 记录=${this.pasteShortcutRegistered}`);
        this.pasteShortcutRegistered = pasteRegistered;
      }
      
      // 重新评估是否需要注册/注销快捷键
      this.manageCutPasteShortcuts();
      
    } catch (error) {
      console.log('❌ 快捷键健康检查时出错:', error.message);
    }
  }

  // 停止健康监控
  stopShortcutHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('🛑 快捷键健康监控已停止');
    }
  }

  // 💡 正确退出应用
  quitApp() {
    console.log('🚪 开始退出应用程序...');
    this.isQuitting = true;
    
    try {
      // 清理预览窗口
      if (this.previewWindow && !this.previewWindow.isDestroyed()) {
        this.previewWindow.destroy();
        this.previewWindow = null;
      }
      
      // 清理监控定时器
      this.stopOptimizedMonitor();
      
      // 清理快捷键健康监控
      this.stopShortcutHealthCheck();
      
      // 清理全局快捷键
      globalShortcut.unregisterAll();
      
      // 清理托盘
      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }
      
      console.log('✅ 资源清理完成，正在退出...');
      
      // 强制退出应用
      app.exit(0);
      
    } catch (error) {
      console.error('退出应用时出现错误:', error);
      // 即使出错也要退出
      app.exit(1);
    }
  }

  // 💡 快速检测系统Quick Look状态
  async checkQuickLookStatus() {
    const script = `
      tell application "System Events"
        try
          -- 检查Quick Look进程
          set quickLookApp to first application process whose name is "QuickLookUIService" or name is "Quick Look"
          if quickLookApp exists then
            -- 检查是否有可见窗口
            set quickLookWindows to (every window of quickLookApp whose visible is true)
            if (count of quickLookWindows) > 0 then
              return "open"
            else
              return "closed"
            end if
          else
            return "closed"
          end if
        on error
          return "closed"
        end try
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { timeout: 200 }, (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        const result = stdout.trim();
        resolve(result === 'open');
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
  // 如果用户明确要求退出，则允许退出
  if (finderApp.isQuitting) {
    return; // 不阻止退出
  }
  
  // 否则阻止应用退出，保持在托盘运行
  event.preventDefault();
});

app.on('activate', () => {
  // macOS上，当dock图标被点击且没有其他窗口打开时
  if (BrowserWindow.getAllWindows().length === 0) {
    finderApp.showStatus();
  }
});

app.on('will-quit', () => {
  // 如果是正常退出（通过quitApp），资源已经清理过了
  if (finderApp.isQuitting) {
    return;
  }
  
  // 清理全局快捷键
  globalShortcut.unregisterAll();
  
  // 清理优化的状态监控
  if (finderApp.stopOptimizedMonitor) {
    finderApp.stopOptimizedMonitor();
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

ipcMain.handle('minimize-window', async (event) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      senderWindow.minimize();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}); 