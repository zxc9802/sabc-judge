#!/bin/bash
# 立项裁判：macOS 双击安装。无 Node / Git 也可运行。
set -e

REPO_ZIP_OFFICIAL="https://github.com/zxc9802/sabc-judge/archive/refs/heads/main.zip"
NODE_FALLBACK_VER="22.23.2"
APP_DIR="$HOME/sabc-judge"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

trap 'echo; echo "安装失败。请把上面的报错截图发回来。"; echo "按回车关闭窗口。"; read -r _' ERR

pause_end() {
  echo
  echo "按回车关闭窗口。"
  read -r _
}

say() {
  echo
  echo "==> $1"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

refresh_path() {
  export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
}

download() {
  local url="$1"
  local dest="$2"
  if curl -fL --connect-timeout 20 --retry 2 -o "$dest" "$url"; then
    return 0
  fi
  return 1
}

node_ok() {
  refresh_path
  need_cmd node && need_cmd npm
}

install_node() {
  if node_ok; then
    say "已检测到 Node.js $(node -v)，跳过安装"
    return 0
  fi

  if need_cmd brew; then
    say "用 Homebrew 安装 Node.js"
    brew install node
    refresh_path
    node_ok && return 0
  fi

  say "正在下载 Node.js（需要输入本机登录密码）"
  local tmp="/tmp/sabc-node.pkg"
  rm -f "$tmp"

  local official="https://nodejs.org/dist/latest-v22.x/node-v${NODE_FALLBACK_VER}.pkg"
  local mirror="https://npmmirror.com/mirrors/node/v${NODE_FALLBACK_VER}/node-v${NODE_FALLBACK_VER}.pkg"
  local latest_txt
  latest_txt="$(curl -fsSL --connect-timeout 15 "https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt" 2>/dev/null || true)"
  if [ -n "$latest_txt" ]; then
    local pkg_name
    pkg_name="$(printf '%s\n' "$latest_txt" | awk '/node-v.*\.pkg$/{print $2; exit}')"
    if [ -n "$pkg_name" ]; then
      official="https://nodejs.org/dist/latest-v22.x/${pkg_name}"
    fi
  fi

  if ! download "$official" "$tmp"; then
    say "官方源较慢，改用国内镜像"
    download "$mirror" "$tmp"
  fi

  sudo installer -pkg "$tmp" -target /
  rm -f "$tmp"
  refresh_path

  if ! node_ok; then
    echo "Node.js 安装后仍找不到 node 命令。"
    exit 1
  fi
  say "Node.js 已安装：$(node -v)"
}

ensure_project() {
  if [ -f "$SCRIPT_DIR/package.json" ] && grep -q '"name": "sabc-judge"' "$SCRIPT_DIR/package.json"; then
    APP_DIR="$SCRIPT_DIR"
    say "使用当前文件夹的项目：$APP_DIR"
    return 0
  fi

  if [ -f "$APP_DIR/package.json" ]; then
    say "使用已下载的项目：$APP_DIR"
    return 0
  fi

  say "正在下载立项裁判源码"
  local zip="/tmp/sabc-judge.zip"
  local extract="/tmp/sabc-judge-extract"
  rm -f "$zip"
  rm -rf "$extract"
  mkdir -p "$extract"

  if ! download "$REPO_ZIP_OFFICIAL" "$zip"; then
    echo "下载源码失败。请检查网络，或把整个项目文件夹拷到这台电脑后再双击。"
    exit 1
  fi

  unzip -q "$zip" -d "$extract"
  local unpacked
  unpacked="$(find "$extract" -maxdepth 1 -type d -name 'sabc-judge-*' | head -n 1)"
  if [ -z "$unpacked" ] || [ ! -f "$unpacked/package.json" ]; then
    echo "解压后的源码不完整。"
    exit 1
  fi

  mkdir -p "$(dirname "$APP_DIR")"
  rm -rf "$APP_DIR"
  mv "$unpacked" "$APP_DIR"
  rm -f "$zip"
  rm -rf "$extract"
  say "源码已放到 $APP_DIR"
}

setup_env() {
  cd "$APP_DIR"
  mkdir -p data/uploads data/kb
  if [ ! -f .env.local ]; then
    cp .env.example .env.local
  fi

  if grep -q 'LLM_API_KEY=sk-your-key' .env.local; then
    echo
    echo "请输入 OpenLux API Key（直接回车可稍后自己改 .env.local）"
    printf "API Key: "
    read -r KEY || true
    if [ -n "${KEY:-}" ]; then
      sed -i '' "s|LLM_API_KEY=.*|LLM_API_KEY=${KEY}|" .env.local
    fi
  fi
}

install_deps() {
  cd "$APP_DIR"
  say "正在安装项目依赖（第一次会比较久）"
  if ! npm install; then
    say "官方 npm 源失败，改用国内镜像重试"
    npm install --registry=https://registry.npmmirror.com
  fi
}

install_python_optional() {
  if ! need_cmd python3; then
    echo "未检测到 Python3。主程序能用，知识库向量加速可能不可用。"
    return 0
  fi
  say "尝试安装知识库加速组件（失败也不影响主程序）"
  python3 -m pip install --user numpy faiss-cpu >/dev/null 2>&1 || true
}

start_app() {
  cd "$APP_DIR"
  trap - ERR
  say "正在启动，浏览器稍后会打开 http://localhost:3000"
  echo "关闭这个窗口就会停止服务。"
  echo
  (sleep 5; open "http://localhost:3000") >/dev/null 2>&1 &
  npm run dev
}

clear
echo "立项裁判 一键安装"
echo "----------------"
install_node
ensure_project
setup_env
install_deps
install_python_optional
start_app
pause_end
