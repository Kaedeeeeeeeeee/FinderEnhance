const { ipcRenderer } = require('electron');

class PreferencesWindow {
  constructor() {
    this.settings = this.getDefaultSettings();
    this.elements = {};
    
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
  }

  getDefaultSettings() {
    return {
      enableSpacePreview: true,
      previewLimit: 50,
      showHiddenFiles: false,
      enableCutShortcut: true,
      showCutFeedback: true,
      autoStart: false,
      checkUpdates: true
    };
  }

  initializeElements() {
    this.elements = {
      enableSpacePreview: document.getElementById('enableSpacePreview'),
      previewLimit: document.getElementById('previewLimit'),
      showHiddenFiles: document.getElementById('showHiddenFiles'),
      enableCutShortcut: document.getElementById('enableCutShortcut'),
      showCutFeedback: document.getElementById('showCutFeedback'),
      autoStart: document.getElementById('autoStart'),
      checkUpdates: document.getElementById('checkUpdates'),
      
      saveBtn: document.getElementById('saveBtn'),
      cancelBtn: document.getElementById('cancelBtn'),
      resetBtn: document.getElementById('resetBtn'),
      closeBtn: document.getElementById('closeBtn'),
      minimizeBtn: document.getElementById('minimizeBtn'),
      zoomBtn: document.getElementById('zoomBtn')
    };
  }

  bindEvents() {
    // 保存设置
    this.elements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // 取消
    this.elements.cancelBtn.addEventListener('click', () => {
      window.close();
    });

    // 关闭按钮
    this.elements.closeBtn.addEventListener('click', () => {
      window.close();
    });

    // 最小化按钮
    this.elements.minimizeBtn.addEventListener('click', () => {
      // 通过IPC与主进程通信来最小化窗口
      ipcRenderer.invoke('minimize-window').catch(() => {
        // 如果IPC失败，暂时不做处理
        console.log('最小化功能暂不可用');
      });
    });

    // 缩放按钮（无功能，仅装饰）
    this.elements.zoomBtn.addEventListener('click', () => {
      // macOS中缩放按钮通常用于全屏，这里暂不实现
      console.log('缩放按钮被点击');
    });

    // 重置默认
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetToDefaults();
    });

    // 监听设置变化
    Object.keys(this.elements).forEach(key => {
      const element = this.elements[key];
      if (element && (element.type === 'checkbox' || element.tagName === 'SELECT')) {
        element.addEventListener('change', () => {
          this.updateSetting(key, this.getElementValue(element));
        });
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        this.saveSettings();
      }
    });
  }

  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('finderEnhanceSettings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }

    // 应用设置到界面
    this.applySettingsToUI();
  }

  applySettingsToUI() {
    Object.keys(this.settings).forEach(key => {
      const element = this.elements[key];
      if (element) {
        this.setElementValue(element, this.settings[key]);
      }
    });
  }

  getElementValue(element) {
    if (element.type === 'checkbox') {
      return element.checked;
    } else if (element.tagName === 'SELECT') {
      return element.value;
    }
    return element.value;
  }

  setElementValue(element, value) {
    if (element.type === 'checkbox') {
      element.checked = value;
    } else if (element.tagName === 'SELECT') {
      element.value = value;
    } else {
      element.value = value;
    }
  }

  updateSetting(key, value) {
    this.settings[key] = value;
  }

  async saveSettings() {
    try {
      // 收集当前界面的所有设置
      const currentSettings = {};
      Object.keys(this.elements).forEach(key => {
        const element = this.elements[key];
        if (element && (element.type === 'checkbox' || element.tagName === 'SELECT')) {
          currentSettings[key] = this.getElementValue(element);
        }
      });

      // 合并设置
      this.settings = { ...this.settings, ...currentSettings };

      // 保存到本地存储
      localStorage.setItem('finderEnhanceSettings', JSON.stringify(this.settings));

      // 通知主进程更新设置
      await ipcRenderer.invoke('update-settings', this.settings);

      // 显示成功提示
      this.showNotification('设置已保存', 'success');

      // 延迟关闭窗口
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error('保存设置失败:', error);
      this.showNotification('保存设置失败: ' + error.message, 'error');
    }
  }

  resetToDefaults() {
    if (confirm('确定要重置所有设置为默认值吗？这将无法撤销。')) {
      this.settings = this.getDefaultSettings();
      this.applySettingsToUI();
      this.showNotification('已重置为默认设置', 'success');
    }
  }

  showNotification(message, type = 'success') {
    // 移除已存在的通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // 创建新通知
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  // 获取当前设置
  getSettings() {
    return { ...this.settings };
  }

  // 应用开机自启动设置
  async applyAutoStartSetting() {
    try {
      await ipcRenderer.invoke('set-auto-start', this.settings.autoStart);
    } catch (error) {
      console.error('设置开机自启动失败:', error);
    }
  }

  // 验证设置有效性
  validateSettings() {
    const errors = [];

    // 验证预览限制
    const previewLimit = parseInt(this.settings.previewLimit);
    if (isNaN(previewLimit) || previewLimit < 10 || previewLimit > 1000) {
      errors.push('预览文件数量限制必须在10-1000之间');
    }

    return errors;
  }

  // 导出设置
  exportSettings() {
    const dataStr = JSON.stringify(this.settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'finder-enhance-settings.json';
    link.click();
    
    this.showNotification('设置已导出', 'success');
  }

  // 导入设置
  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target.result);
            this.settings = { ...this.getDefaultSettings(), ...importedSettings };
            this.applySettingsToUI();
            this.showNotification('设置已导入', 'success');
          } catch (error) {
            this.showNotification('导入失败: 文件格式错误', 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }
}

// 初始化设置窗口
document.addEventListener('DOMContentLoaded', () => {
  window.preferencesWindow = new PreferencesWindow();
});

// 暴露一些方法给全局使用
window.exportSettings = () => window.preferencesWindow.exportSettings();
window.importSettings = () => window.preferencesWindow.importSettings(); 