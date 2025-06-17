# FinderEnhance 安装指南

## 系统要求

- macOS 10.14 (Mojave) 或更高版本
- 支持 Intel 和 Apple Silicon (M1/M2/M3) 处理器

## 下载

从 [GitHub Releases](https://github.com/Kaedeeeeeeeeee/FinderEnhance/releases) 页面下载适合您系统的版本：

- **Apple Silicon Mac (M1/M2/M3)**：下载 `FinderEnhance-3.0.0-arm64.dmg`
- **Intel Mac**：下载 `FinderEnhance-3.0.0.dmg`

## 安装步骤

1. **下载DMG文件**：选择适合您处理器的版本下载

2. **打开DMG文件**：双击下载的DMG文件

3. **安装应用**：
   - 将 `FinderEnhance.app` 拖拽到 `Applications` 文件夹
   - 或者直接双击 `FinderEnhance.app` 运行

4. **首次运行**：
   - 打开 `Applications` 文件夹，找到 `FinderEnhance`
   - 右键点击选择"打开"（因为应用未签名，需要手动确认）
   - 在弹出的对话框中点击"打开"

## 权限设置

首次运行时，系统可能会要求以下权限：

1. **辅助功能权限**：
   - 打开 `系统偏好设置` > `安全性与隐私` > `隐私` > `辅助功能`
   - 点击锁图标解锁
   - 勾选 `FinderEnhance`

2. **输入监控权限**：
   - 打开 `系统偏好设置` > `安全性与隐私` > `隐私` > `输入监控`
   - 点击锁图标解锁
   - 勾选 `FinderEnhance`

## 使用方法

安装完成后，FinderEnhance 会在系统托盘中显示图标：

### 核心功能

1. **空格键预览**：
   - 在 Finder 中选中文件
   - 按空格键即可快速预览

2. **智能剪切粘贴**：
   - 选中文件后按 `Cmd+X` 剪切
   - 在目标位置按 `Cmd+V` 粘贴

3. **托盘菜单**：
   - 点击托盘图标查看菜单
   - 可以打开设置、查看快捷键等

### 设置选项

右键点击托盘图标，选择"设置"可以：
- 调整预览窗口大小
- 修改快捷键
- 启用/禁用功能

## 故障排除

### 应用无法打开
- 确保下载了正确的版本（Intel 或 Apple Silicon）
- 右键点击应用选择"打开"而不是双击

### 快捷键不工作
- 检查辅助功能权限是否已授予
- 检查输入监控权限是否已授予
- 重启应用

### 预览窗口不显示
- 确保选中了支持的文件类型
- 检查系统权限设置

## 卸载

要完全卸载 FinderEnhance：

1. 退出应用（右键托盘图标选择"退出"）
2. 将 `FinderEnhance.app` 从 Applications 文件夹删除
3. 删除配置文件：`~/Library/Application Support/FinderEnhance/`

## 支持

如遇问题，请访问：
- [GitHub Issues](https://github.com/Kaedeeeeeeeeee/FinderEnhance/issues)
- [项目主页](https://github.com/Kaedeeeeeeeeee/FinderEnhance)

---

**注意**：由于应用未经过 Apple 官方签名，首次运行时可能会显示安全警告。这是正常现象，按照上述步骤操作即可。 