# FinderEnhance v3.0.2 发布说明

**发布日期**: 2024年6月17日

FinderEnhance v3.0.2 现已发布！这是一个专门修复剪切功能bug的重要更新版本。

## 🎯 关键修复

### 🔧 剪切功能彻底修复
- **彻底解决多次按键问题**：修复了在非Finder环境下需要连续按4-5次Cmd+X才能剪切的bug
- **采用动态快捷键管理**：全新的智能策略，只在需要时注册快捷键，其他时候让系统自然处理
- **完全避免权限问题**：不再使用AppleScript模拟按键，避免macOS权限限制
- **一次按键成功**：在任何应用中（TextEdit、Notes、VS Code等）剪切文本都能一次成功

### 💡 技术改进
- **智能快捷键注册**：根据当前环境动态注册/注销快捷键
- **无延迟响应**：避免了临时释放快捷键导致的按键丢失问题
- **完美兼容性**：保持Finder中的文件剪切功能完全正常
- **稳定性提升**：消除了AppleScript权限错误和连续失败问题

## 📦 下载信息

### Apple Silicon版本 (推荐)
- **文件名**: `FinderEnhance-3.0.2-arm64.dmg`
- **大小**: 约101MB
- **支持**: M1/M2/M3 Mac
- **下载**: [点击下载](https://github.com/Kaedeeeeeeeeee/FinderEnhance/releases/download/v3.0.2/FinderEnhance-3.0.2-arm64.dmg)

### Intel版本
- **文件名**: `FinderEnhance-3.0.2.dmg`
- **大小**: 约106MB
- **支持**: Intel Mac
- **下载**: [点击下载](https://github.com/Kaedeeeeeeeeee/FinderEnhance/releases/download/v3.0.2/FinderEnhance-3.0.2.dmg)

## 🔍 验证文件完整性

```bash
shasum -a 256 FinderEnhance-3.0.2-arm64.dmg  # Apple Silicon版本
shasum -a 256 FinderEnhance-3.0.2.dmg         # Intel版本
```

## 🚀 升级说明

### 从v3.0.0升级
1. 下载新版本DMG文件
2. 退出当前运行的FinderEnhance
3. 安装新版本（替换Applications文件夹中的旧版本）
4. 重新启动应用

### 新安装用户
按照README.md中的安装指南进行安装。

## ✅ 测试验证

升级后请验证以下功能：
- 在TextEdit中选中文字，按Cmd+X应该一次成功
- 在Notes中选中文字，按Cmd+X应该一次成功  
- 在VS Code中选中代码，按Cmd+X应该一次成功
- 在Finder中选中文件，按Cmd+X进行文件剪切应该正常工作

## 🐛 问题报告

如果遇到任何问题，请在GitHub Issues中报告：
https://github.com/Kaedeeeeeeeeee/FinderEnhance/issues

## 📋 版本历史

- **v3.0.2**: 剪切功能完美修复
- **v3.0.0**: UI革新与体验升级
- **v2.0.0**: 性能革命
- **v1.0.0**: 基础功能

---

感谢您使用FinderEnhance！这个版本应该彻底解决了剪切功能的所有问题。 