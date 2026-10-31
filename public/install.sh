#!/bin/sh
# Installs the ant binary for this machine from the GitHub releases of ant-src/ant.
#
#   curl -fsSL https://ant-lang.org/install.sh | sh
#
# ANT_VERSION=vX.Y.Z installs that release instead of the latest one.
# ANT_INSTALL_DIR names the directory to install into; /usr/local/bin by default.

set -eu

repo='ant-src/ant'
version=${ANT_VERSION:-latest}
dir=${ANT_INSTALL_DIR:-/usr/local/bin}

case $(uname -s) in
Linux) os=linux ;;
Darwin) os=darwin ;;
MINGW* | MSYS* | CYGWIN*) os=windows ;;
*)
  echo "Unsupported OS: $(uname -s)" >&2
  exit 1
  ;;
esac

case $(uname -m) in
x86_64 | amd64) arch=amd64 ;;
arm64 | aarch64) arch=arm64 ;;
*)
  echo "Unsupported architecture: $(uname -m)" >&2
  exit 1
  ;;
esac

ext=''
if [ "$os" = windows ]; then ext='.exe'; fi
asset="ant_${os}_${arch}${ext}"

if [ "$version" = latest ]; then
  url="https://github.com/${repo}/releases/latest/download/${asset}"
else
  url="https://github.com/${repo}/releases/download/${version}/${asset}"
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

echo "Downloading ${asset} (${version})"
curl -fL --progress-bar "$url" -o "$tmp"
chmod 755 "$tmp"

target="${dir}/ant${ext}"
mkdir -p "$dir" 2>/dev/null || true
if [ -w "$dir" ]; then
  mv "$tmp" "$target"
else
  echo "Installing to ${dir} with sudo"
  sudo mkdir -p "$dir"
  sudo mv "$tmp" "$target"
fi

echo "Installed ${target}"
