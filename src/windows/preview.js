const { ipcRenderer, shell } = require('electron');
const path = require('path');

class PreviewWindow {
  constructor() {
    this.currentPath = '';
    this.currentData = null;
    this.filteredItems = [];
    this.isLoading = false;
    
    this.initializeElements();
    this.bindEvents();
    
    // 添加初始化完成标志
    this.initialized = true;
    console.log('🎬 预览窗口初始化完成');
  }

  initializeElements() {
    // 获取DOM元素 - 只保留极简界面需要的元素
    this.elements = {
      error: document.getElementById('error'),
      fileList: document.getElementById('fileList'),
      emptyState: document.getElementById('emptyState')
    };

    // 验证所有必需的元素都存在
    Object.keys(this.elements).forEach(key => {
      if (!this.elements[key]) {
        console.error(`⚠️ 找不到元素: ${key}`);
      }
    });
  }

  bindEvents() {
    // IPC事件监听
    ipcRenderer.on('show-preview', (event, filePath) => {
      console.log('📁 收到预览请求:', filePath);
      this.loadPreview(filePath);
    });

    // 窗口动画完成信号
    ipcRenderer.on('window-animation-complete', () => {
      console.log('🎬 收到窗口动画完成信号');
      this.showContent();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // 确保窗口关闭时清理资源
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 添加错误处理
    window.addEventListener('error', (e) => {
      console.error('预览窗口发生错误:', e.error);
      this.showError('预览窗口发生错误: ' + e.message);
    });

    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (e) => {
      console.error('未处理的Promise拒绝:', e.reason);
      this.showError('加载预览时发生错误');
    });
  }

  async loadPreview(filePath) {
    // 防止重复加载
    if (this.isLoading) {
      console.log('⏳ 正在加载中，跳过重复请求');
      return;
    }

    this.isLoading = true;
    this.currentPath = filePath;
    
    // 直接隐藏所有状态，等待数据加载完成
    this.hideAllStates();

    try {
      console.log('📂 开始加载预览:', filePath);
      const data = await ipcRenderer.invoke('get-file-preview', filePath);
      
      if (!data) {
        throw new Error('未收到预览数据');
      }
      
      this.currentData = data;
      this.displayPreview(data);
      console.log('✅ 预览加载完成');
      
    } catch (error) {
      console.error('❌ 加载预览失败:', error);
      this.showError(error.message || '加载预览失败');
    } finally {
      this.isLoading = false;
    }
  }

  displayPreview(data) {
    if (!data) {
      this.showError('预览数据无效');
      return;
    }

    if (data.type === 'error') {
      this.showError(data.message);
      return;
    }

    if (!data.items || data.items.length === 0) {
      this.showEmptyState();
      return;
    }

    this.filteredItems = data.items;
    this.renderFileList();
    this.showFileList();
  }

  renderFileList() {
    if (!this.filteredItems || this.filteredItems.length === 0) {
      this.showEmptyState();
      return;
    }

    try {
      const listHtml = this.filteredItems.map((item, index) => {
        const icon = this.getItemIcon(item);
        const size = this.formatFileSize(item.size);
        const modified = this.formatDate(item.modified);

        return `
          <div class="file-item" data-index="${index}" data-name="${item.name}">
            <span class="file-item-icon">${icon}</span>
            <div class="file-item-details">
              <div class="file-item-name" title="${item.name}">${this.escapeHtml(item.name)}</div>
              <div class="file-item-meta">
                ${item.type === 'directory' ? '文件夹' : ''}
                ${item.size !== null && item.type !== 'directory' ? size : ''}
                ${modified ? ` • ${modified}` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      this.elements.fileList.innerHTML = listHtml;
      
    } catch (error) {
      console.error('渲染文件列表失败:', error);
      this.showError('渲染预览内容失败');
    }
  }

  // 添加HTML转义以防止XSS
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  showError(message) {
    console.log('❌ 显示错误:', message);
    this.hideAllStates();
    
    if (this.elements.error) {
      this.elements.error.style.display = 'flex';
      const errorMessage = document.getElementById('errorMessage');
      if (errorMessage) {
        errorMessage.textContent = message || '无法读取内容';
      }
    }
  }

  showEmptyState() {
    console.log('📭 显示空状态');
    this.hideAllStates();
    
    if (this.elements.emptyState) {
      this.elements.emptyState.style.display = 'flex';
    }
  }

  showFileList() {
    console.log('📋 显示文件列表');
    this.hideAllStates();
    
    if (this.elements.fileList) {
      this.elements.fileList.style.display = 'block';
    }
  }

  hideAllStates() {
    Object.values(this.elements).forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  getItemIcon(item) {
    if (item.type === 'directory') {
      return '📁';
    }
    
    const ext = path.extname(item.name).toLowerCase();
    const iconMap = {
      '.txt': '📄',
      '.md': '📝',
      '.pdf': '📕',
      '.doc': '📘',
      '.docx': '📘',
      '.xls': '📗',
      '.xlsx': '📗',
      '.ppt': '📙',
      '.pptx': '📙',
      '.zip': '🗜️',
      '.rar': '🗜️',
      '.7z': '🗜️',
      '.tar': '🗜️',
      '.gz': '🗜️',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.bmp': '🖼️',
      '.svg': '🖼️',
      '.mp3': '🎵',
      '.wav': '🎵',
      '.flac': '🎵',
      '.mp4': '🎬',
      '.avi': '🎬',
      '.mov': '🎬',
      '.mkv': '🎬',
      '.js': '⚡',
      '.html': '🌐',
      '.css': '🎨',
      '.json': '⚙️',
      '.xml': '⚙️',
      '.py': '🐍',
      '.java': '☕',
      '.cpp': '⚡',
      '.c': '⚡',
      '.swift': '🦉',
      '.php': '🐘',
      '.rb': '💎',
      '.go': '🐹'
    };
    
    return iconMap[ext] || '📄';
  }

  formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(date) {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      const now = new Date();
      const diffTime = Math.abs(now - d);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        return '今天';
      } else if (diffDays === 2) {
        return '昨天';
      } else if (diffDays <= 7) {
        return `${diffDays - 1}天前`;
      } else {
        return d.toLocaleDateString('zh-CN', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      return '';
    }
  }

  handleKeyDown(e) {
    // 空格键关闭窗口
    if (e.code === 'Space') {
      e.preventDefault();
      this.closeWithAnimation();
    }
    // ESC键关闭窗口
    else if (e.code === 'Escape') {
      e.preventDefault();
      this.closeWithAnimation();
    }
  }

  closeWithAnimation() {
    // 先隐藏内容
    this.hideContent();
    // 直接关闭窗口，让主进程处理关闭动画
    window.close();
  }

  // 🎬 显示内容 - 窗口动画完成后调用
  showContent() {
    const content = document.querySelector('.content');
    if (content) {
      content.classList.add('visible');
      console.log('🎬 内容区域显示完成');
    }
  }

  // 🎬 隐藏内容 - 关闭时调用
  hideContent() {
    const content = document.querySelector('.content');
    if (content) {
      content.classList.remove('visible');
      console.log('🎬 内容区域隐藏完成');
    }
  }

  cleanup() {
    // 清理资源
    this.currentPath = '';
    this.currentData = null;
    this.filteredItems = [];
    this.isLoading = false;
    console.log('🎬 预览窗口清理完成');
  }
}

// 初始化预览窗口
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 渲染进程 - DOMContentLoaded事件触发');
  new PreviewWindow();
  console.log('🎯 渲染进程 - PreviewWindow实例已创建');
});

// 添加备用初始化机制
if (document.readyState === 'loading') {
  // DOM还在加载中，等待DOMContentLoaded
  console.log('📋 渲染进程 - DOM正在加载，等待DOMContentLoaded');
} else {
  // DOM已经加载完成，直接初始化
  console.log('📋 渲染进程 - DOM已加载完成，直接初始化');
  setTimeout(() => {
    new PreviewWindow();
    console.log('📋 渲染进程 - 备用初始化完成');
  }, 100);
} 