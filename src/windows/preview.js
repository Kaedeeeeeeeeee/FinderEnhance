const { ipcRenderer, shell } = require('electron');
const path = require('path');

class PreviewWindow {
  constructor() {
    this.currentPath = '';
    this.currentData = null;
    this.filteredItems = [];
    
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    // 获取DOM元素 - 只保留极简界面需要的元素
    this.elements = {
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      fileList: document.getElementById('fileList'),
      emptyState: document.getElementById('emptyState')
    };
  }

  bindEvents() {
    // IPC事件监听
    ipcRenderer.on('show-preview', (event, filePath) => {
      this.loadPreview(filePath);
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });
  }

  async loadPreview(filePath) {
    this.currentPath = filePath;
    this.showLoading();

    try {
      const data = await ipcRenderer.invoke('get-file-preview', filePath);
      this.currentData = data;
      this.displayPreview(data);
    } catch (error) {
      this.showError(error.message);
    }
  }

  displayPreview(data) {
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
    const listHtml = this.filteredItems.map((item, index) => {
      const icon = this.getItemIcon(item);
      const size = this.formatFileSize(item.size);
      const modified = this.formatDate(item.modified);

      return `
        <div class="file-item" data-index="${index}" data-name="${item.name}">
          <span class="file-item-icon">${icon}</span>
          <div class="file-item-details">
            <div class="file-item-name" title="${item.name}">${item.name}</div>
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
  }

  showLoading() {
    this.hideAllStates();
    this.elements.loading.style.display = 'flex';
  }

  showError(message) {
    this.hideAllStates();
    this.elements.error.style.display = 'flex';
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      errorMessage.textContent = message || '无法读取内容';
    }
  }

  showEmptyState() {
    this.hideAllStates();
    this.elements.emptyState.style.display = 'flex';
  }

  showFileList() {
    this.hideAllStates();
    this.elements.fileList.style.display = 'block';
  }

  hideAllStates() {
    this.elements.loading.style.display = 'none';
    this.elements.error.style.display = 'none';
    this.elements.fileList.style.display = 'none';
    this.elements.emptyState.style.display = 'none';
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
      window.close();
    }
    // ESC键关闭窗口
    else if (e.code === 'Escape') {
      e.preventDefault();
      window.close();
    }
  }
}

// 初始化预览窗口
document.addEventListener('DOMContentLoaded', () => {
  new PreviewWindow();
}); 