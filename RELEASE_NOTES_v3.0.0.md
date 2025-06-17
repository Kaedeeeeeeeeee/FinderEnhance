# FinderEnhance v3.0.0 发布说明

## 重大版本发布

FinderEnhance v3.0.0 现已发布！这是一个包含重大改进和全新打包系统的里程碑版本。

## 下载链接

选择适合您系统的版本：

### Apple Silicon Mac (M1/M2/M3)
- **文件名**: `FinderEnhance-3.0.0-arm64.dmg`
- **大小**: 96MB
- **SHA256**: `f93f0cca0ab2ab32526407bba70fcb558a2f0c56b4385252b0d1f03b5b2f01b0`
- **下载**: [点击下载](https://github.com/Kaedeeeeeeeeee/FinderEnhance/releases/download/v3.0.0/FinderEnhance-3.0.0-arm64.dmg)

### Intel Mac
- **文件名**: `FinderEnhance-3.0.0.dmg`
- **大小**: 101MB
- **SHA256**: `3fdae56a2b883ecafcaae2c5cc7b8994b1fbbf12e79d3bd6f8132915f6b136d0`
- **下载**: [点击下载](https://github.com/Kaedeeeeeeeeee/FinderEnhance/releases/download/v3.0.0/FinderEnhance-3.0.0.dmg)

### 校验和验证
下载完成后，可以使用以下命令验证文件完整性：
```bash
shasum -a 256 FinderEnhance-3.0.0-arm64.dmg  # Apple Silicon版本
shasum -a 256 FinderEnhance-3.0.0.dmg         # Intel版本
```

## 新功能和改进

### 全新打包系统
- **专业级DMG安装包**: 支持Intel和Apple Silicon双架构
- **自动化构建流程**: 一键生成发布版本
- **优化的应用图标**: 高质量ICNS格式图标
- **标准macOS安装体验**: 拖拽到Applications文件夹即可安装

### 完善的文档系统
- **详细安装指南**: 包含故障排除和权限设置说明
- **自动化构建脚本**: 开发者可轻松构建自定义版本
- **更新的README**: 清晰的下载和使用说明

### 技术优化
- **版本管理**: 正确的语义化版本控制
- **构建配置**: 优化的electron-builder配置
- **文件过滤**: 精简的打包内容，减少安装包大小
- **跨架构支持**: 原生支持M系列和Intel处理器

## UI/UX 持续改进

基于v3.0系列的毛玻璃设计：
- 现代化的半透明界面
- 流畅的动画效果
- macOS原生风格的窗口控制
- 智能的设置管理系统

## 核心功能

### 智能空格预览
- 文件夹内容快速预览
- 压缩包内容浏览
- 美观的毛玻璃界面
- 流畅的动画效果

### 智能剪切系统
- Cmd+X 智能剪切
- 条件拦截，不影响其他应用
- 支持文件和文件夹批量操作
- 可视化操作反馈

## 安装说明

### 快速安装
1. 下载适合您处理器的DMG文件
2. 双击打开DMG文件
3. 将FinderEnhance.app拖拽到Applications文件夹
4. 右键点击应用选择"打开"（首次运行）
5. 在系统偏好设置中授予必要权限

### 详细说明
查看 [INSTALLATION.md](https://github.com/Kaedeeeeeeeeee/FinderEnhance/blob/main/INSTALLATION.md) 获取完整的安装和配置指南。

## 重要提醒

- **首次运行**: 由于应用未签名，需要右键选择"打开"
- **系统权限**: 需要授予辅助功能和输入监控权限
- **系统要求**: macOS 10.14 或更高版本

## 已知问题

- 某些情况下首次启动可能需要手动授权权限
- 在某些macOS版本中可能出现安全警告（正常现象）

## 从旧版本升级

如果您使用的是v2.0或更早版本：
1. 退出旧版本应用
2. 删除旧的应用文件
3. 按照上述步骤安装新版本
4. 重新配置设置（如有需要）

## 致谢

感谢所有用户的反馈和建议，让FinderEnhance变得更加完善！

## 支持

如遇问题，请：
- 查看 [安装指南](https://github.com/Kaedeeeeeeeeee/FinderEnhance/blob/main/INSTALLATION.md)
- 提交 [GitHub Issue](https://github.com/Kaedeeeeeeeeee/FinderEnhance/issues)
- 访问 [项目主页](https://github.com/Kaedeeeeeeeeee/FinderEnhance)

---

**FinderEnhance Team**  
2025年6月17日 