# Finder增强工具

一个基于Electron开发的Mac Finder功能增强应用程序，提供空格预览和快捷剪切功能。

## 功能特性

### 🔍 空格预览
- 在Finder中选中文件夹或压缩包，按下空格键即可快速预览内容
- 支持文件夹内容浏览，无需打开文件夹
- 支持压缩包预览（ZIP、TAR等格式），无需解压
- 提供列表和网格两种视图模式
- 内置搜索功能，快速定位文件
- 显示文件详细信息（大小、修改时间等）

### ✂️ 快捷剪切
- 在Finder中使用 `Cmd+X` 快捷键直接剪切文件和文件夹
- 支持批量文件剪切操作
- 与系统剪贴板完美集成
- 剪切状态可视化反馈

### 🎛️ 系统集成
- 应用图标显示在系统托盘中，不占用Dock空间
- 后台常驻运行，随时可用
- 丰富的设置选项，个性化配置
- 支持开机自启动

## 系统要求

- macOS 10.14 或更高版本
- 64位处理器
- 100MB 可用磁盘空间

## 安装方法

### 方式一：从源码构建

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/finder-enhance.git
   cd finder-enhance
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **运行应用**
   ```bash
   npm start
   ```

### 方式二：打包安装

1. **构建应用**
   ```bash
   npm run build-mac
   ```

2. **安装DMG文件**
   在 `dist` 目录中找到生成的 `.dmg` 文件，双击安装

## 使用指南

### 首次启动

1. 启动应用后，图标将出现在系统托盘中
2. 右键点击托盘图标，选择"设置"配置功能选项
3. 确保"空格预览"和"Cmd+X剪切"功能已启用

### 空格预览使用

1. 在Finder中选中任意文件夹或压缩包
2. 按下空格键
3. 预览窗口将自动打开，显示文件内容
4. 使用以下快捷键：
   - `Esc` - 关闭预览窗口
   - `Cmd+F` - 聚焦搜索框
   - `F5` - 刷新内容
   - `Enter` - 打开选中的文件夹

### 剪切功能使用

1. 在Finder中选中要剪切的文件或文件夹
2. 按下 `Cmd+X`
3. 导航到目标位置
4. 按下 `Cmd+V` 粘贴

## 设置选项

### 预览功能设置
- **启用空格预览**: 开启/关闭空格预览功能
- **预览文件数量限制**: 设置预览窗口显示的最大文件数量
- **显示隐藏文件**: 在预览中显示隐藏文件
- **默认视图模式**: 选择列表或网格视图
- **预览窗口大小**: 设置窗口默认尺寸

### 剪切功能设置
- **启用Cmd+X剪切**: 开启/关闭快捷剪切功能
- **显示剪切反馈**: 剪切时显示通知提示

### 系统设置
- **开机自启动**: 系统启动时自动运行应用
- **自动检查更新**: 定期检查应用更新

## 故障排除

### 常见问题

**Q: 空格键不起作用？**
A: 请确保：
- 应用正在运行（托盘图标可见）
- 在设置中启用了"空格预览"功能
- 当前聚焦在Finder窗口中
- 已选中文件夹或支持的压缩包

**Q: Cmd+X剪切无效？**
A: 请检查：
- 设置中是否启用了"Cmd+X剪切"功能
- 是否在Finder中操作
- 文件是否有写入权限

**Q: 应用无法启动？**
A: 尝试以下解决方法：
- 检查系统兼容性
- 重新安装应用
- 查看控制台错误信息

### 权限设置

某些功能可能需要系统权限：

1. **辅助功能权限**：
   - 打开"系统偏好设置" > "安全性与隐私" > "隐私"
   - 选择"辅助功能"
   - 添加FinderEnhance应用

2. **自动化权限**：
   - 在"隐私"设置中选择"自动化"
   - 允许FinderEnhance控制Finder

## 技术架构

### 主要技术栈
- **Electron**: 跨平台桌面应用框架
- **Node.js**: 后端逻辑处理
- **AppleScript**: 系统集成和Finder交互
- **HTML/CSS/JavaScript**: 用户界面

### 项目结构
```
finder-enhance/
├── package.json          # 项目配置
├── src/
│   ├── main.js           # 主进程入口
│   ├── services/         # 业务逻辑服务
│   │   ├── previewService.js
│   │   └── clipboardService.js
│   └── windows/          # 渲染进程窗口
│       ├── preview.html
│       ├── preview.css
│       ├── preview.js
│       ├── preferences.html
│       ├── preferences.css
│       └── preferences.js
├── assets/               # 资源文件
│   └── tray-icon.png
└── README.md
```

## 开发指南

### 环境准备
```bash
# 安装Node.js 16+
# 安装项目依赖
npm install

# 开发模式运行
npm run dev

# 代码格式化
npm run lint

# 构建应用
npm run build
```

### 贡献代码

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 更新日志

### v1.0.0 (2024-XX-XX)
- 🎉 首次发布
- ✨ 空格预览功能
- ✨ Cmd+X剪切功能
- ✨ 系统托盘集成
- ✨ 设置界面

## 支持与反馈

如果您遇到问题或有建议，请：

1. 查看 [FAQ](#故障排除) 部分
2. 在 [Issues](https://github.com/your-username/finder-enhance/issues) 中搜索相关问题
3. 创建新的Issue报告问题

## 致谢

感谢以下开源项目：
- [Electron](https://electronjs.org/)
- [yauzl](https://github.com/thejoshwolfe/yauzl) - ZIP文件解析
- [tar](https://github.com/npm/node-tar) - TAR文件处理 