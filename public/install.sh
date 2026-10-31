#!/bin/sh
# Installs the ant binary for this machine from the GitHub releases of ant-src/ant.
#
#   curl -fsSL https://ant-lang.org/install.sh | sh
#
# ANT_VERSION=vX.Y.Z installs that release instead of the latest one.
# ANT_INSTALL_DIR names the directory to install into: /usr/local/bin by default, ~/bin on Windows.

# Everything is in main, called on the last line, so a download cut short runs nothing.
main() {
  set -eu

  repo='ant-src/ant'
  version=${ANT_VERSION:-latest}

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

  # A shell under Rosetta reports x86_64 on Apple silicon; the native binary is the one to install.
  if [ "$os" = darwin ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
    arch=arm64
  fi

  ext=''
  default_dir=/usr/local/bin
  # Git Bash has no sudo, and puts ~/bin on PATH.
  if [ "$os" = windows ]; then
    ext='.exe'
    default_dir="$HOME/bin"
  fi
  dir=${ANT_INSTALL_DIR:-$default_dir}
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

  target="${dir}/ant${ext}"
  mkdir -p "$dir" 2>/dev/null || true
  if [ -w "$dir" ]; then
    install -m 755 "$tmp" "$target"
  else
    echo "Installing to ${dir} with sudo"
    sudo mkdir -p "$dir"
    sudo install -m 755 "$tmp" "$target"
  fi

  echo "Installed ${target}"
}

main "$@"
