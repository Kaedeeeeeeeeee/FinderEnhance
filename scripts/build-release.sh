#!/bin/bash

# FinderEnhance 发布构建脚本
# 用于自动化构建和打包流程

set -e

echo "🚀 开始构建 FinderEnhance 发布版本..."

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本：$VERSION"

# 清理旧的构建文件
echo "🧹 清理旧的构建文件..."
rm -rf dist/
rm -rf build/app-icon.iconset/

# 创建图标
echo "🎨 创建应用图标..."
mkdir -p build/app-icon.iconset

# 生成不同尺寸的图标
sips -z 16 16 assets/icon4.png --out build/app-icon.iconset/icon_16x16.png
sips -z 32 32 assets/icon4.png --out build/app-icon.iconset/icon_16x16@2x.png
sips -z 32 32 assets/icon4.png --out build/app-icon.iconset/icon_32x32.png
sips -z 64 64 assets/icon4.png --out build/app-icon.iconset/icon_32x32@2x.png
sips -z 128 128 assets/icon4.png --out build/app-icon.iconset/icon_128x128.png
sips -z 256 256 assets/icon4.png --out build/app-icon.iconset/icon_128x128@2x.png
sips -z 256 256 assets/icon4.png --out build/app-icon.iconset/icon_256x256.png
sips -z 512 512 assets/icon4.png --out build/app-icon.iconset/icon_256x256@2x.png
sips -z 512 512 assets/icon4.png --out build/app-icon.iconset/icon_512x512.png
sips -z 1024 1024 assets/icon4.png --out build/app-icon.iconset/icon_512x512@2x.png

# 转换为 ICNS 格式
iconutil -c icns build/app-icon.iconset -o assets/app-icon.icns

echo "✅ 图标创建完成"

# 构建应用
echo "🔨 构建应用..."
npm run build-all

# 检查构建结果
if [ ! -f "dist/FinderEnhance-$VERSION-arm64.dmg" ] || [ ! -f "dist/FinderEnhance-$VERSION.dmg" ]; then
    echo "❌ 构建失败：DMG 文件未生成"
    exit 1
fi

# 显示构建结果
echo "✅ 构建完成！"
echo ""
echo "📁 生成的文件："
ls -lh dist/*.dmg

echo ""
echo "📊 文件大小："
du -h dist/*.dmg

echo ""
echo "🎉 发布版本 $VERSION 构建完成！"
echo ""
echo "📋 下一步："
echo "1. 测试 DMG 文件是否正常工作"
echo "2. 创建 GitHub Release"
echo "3. 上传 DMG 文件到 Release"
echo "4. 更新 README 中的下载链接"

# 清理临时文件
rm -rf build/app-icon.iconset/

echo ""
echo "🚀 准备就绪！" 