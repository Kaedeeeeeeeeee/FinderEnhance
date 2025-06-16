const fs = require('fs').promises;
const path = require('path');
const yauzl = require('yauzl');
const tar = require('tar');

class PreviewService {
  constructor() {
    this.supportedArchives = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2'];
  }

  async initialize() {
    console.log('预览服务已初始化');
  }

  async getPreview(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        return await this.getDirectoryPreview(filePath);
      } else if (this.isArchive(filePath)) {
        return await this.getArchivePreview(filePath);
      } else {
        return {
          type: 'file',
          name: path.basename(filePath),
          size: stats.size,
          message: '不支持此文件类型的预览'
        };
      }
    } catch (error) {
      console.error('获取预览时出错:', error);
      return {
        type: 'error',
        message: '无法读取文件: ' + error.message
      };
    }
  }

  async getDirectoryPreview(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const preview = {
        type: 'directory',
        name: path.basename(dirPath),
        path: dirPath,
        totalItems: items.length,
        items: []
      };

      for (const item of items.slice(0, 50)) { // 限制显示前50个项目
        try {
          const itemPath = path.join(dirPath, item.name);
          const stats = await fs.stat(itemPath);
          
          preview.items.push({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: item.isDirectory() ? null : stats.size,
            modified: stats.mtime,
            isHidden: item.name.startsWith('.')
          });
        } catch (err) {
          // 跳过无法访问的文件
          continue;
        }
      }

      // 按类型和名称排序
      preview.items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return preview;
    } catch (error) {
      throw new Error('无法读取目录内容: ' + error.message);
    }
  }

  async getArchivePreview(archivePath) {
    const ext = path.extname(archivePath).toLowerCase();
    
    try {
      if (ext === '.zip') {
        return await this.getZipPreview(archivePath);
      } else if (ext === '.tar' || ext === '.gz' || ext === '.tgz' || ext === '.bz2') {
        return await this.getTarPreview(archivePath);
      } else {
        throw new Error('不支持的压缩包格式');
      }
    } catch (error) {
      throw new Error('读取压缩包失败: ' + error.message);
    }
  }

  async getZipPreview(zipPath) {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }

        const preview = {
          type: 'archive',
          archiveType: 'zip',
          name: path.basename(zipPath),
          path: zipPath,
          items: []
        };

        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (preview.items.length < 100) { // 限制显示前100个条目
            preview.items.push({
              name: entry.fileName,
              type: entry.fileName.endsWith('/') ? 'directory' : 'file',
              size: entry.uncompressedSize,
              compressedSize: entry.compressedSize,
              modified: entry.getLastModDate()
            });
          }
          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          preview.totalItems = preview.items.length;
          resolve(preview);
        });

        zipfile.on('error', reject);
      });
    });
  }

  async getTarPreview(tarPath) {
    return new Promise((resolve, reject) => {
      const preview = {
        type: 'archive',
        archiveType: 'tar',
        name: path.basename(tarPath),
        path: tarPath,
        items: []
      };

      let entryCount = 0;
      
      tar.list({
        file: tarPath,
        onentry: (entry) => {
          if (entryCount < 100) { // 限制显示前100个条目
            preview.items.push({
              name: entry.path,
              type: entry.type === 'Directory' ? 'directory' : 'file',
              size: entry.size,
              modified: entry.mtime
            });
          }
          entryCount++;
        }
      })
      .then(() => {
        preview.totalItems = entryCount;
        resolve(preview);
      })
      .catch(reject);
    });
  }

  isArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedArchives.includes(ext) || 
           filePath.toLowerCase().endsWith('.tar.gz') ||
           filePath.toLowerCase().endsWith('.tar.bz2');
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(fileName, isDirectory) {
    if (isDirectory) return '📁';
    
    const ext = path.extname(fileName).toLowerCase();
    const iconMap = {
      '.txt': '📄',
      '.md': '📝',
      '.js': '⚡',
      '.html': '🌐',
      '.css': '🎨',
      '.json': '📋',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.pdf': '📕',
      '.zip': '📦',
      '.tar': '📦',
      '.gz': '📦'
    };
    
    return iconMap[ext] || '📄';
  }
}

module.exports = PreviewService; 