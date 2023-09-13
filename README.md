# dpp.vim

> Dark Powered Plugin manager for Vim/neovim

If you don't want to configure plugins, you don't have to use the plugin. It
does not work with zero configuration. You can use other plugins.

[![Doc](https://img.shields.io/badge/doc-%3Ah%20dpp-orange.svg)](doc/dpp.txt)

Please read [help](doc/dpp.txt) for details.

Dpp is the abbreviation of "Dark Powered Plugin manager".

The development is supported by
[github sponsors](https://github.com/sponsors/Shougo/). Thank you!

<!-- vim-markdown-toc GFM -->

- [Introduction](#introduction)
- [Install](#install)
  - [Requirements](#requirements)
  - [Basic installation](#basic-installation)
  - [Config example](#config-example)

<!-- vim-markdown-toc -->

## Introduction

## Install

**Note:** Dpp.vim requires Neovim (0.10.0+ and of course, **latest** is
recommended) or Vim 9.0.1276. See [requirements](#requirements) if you aren't
sure whether you have this.

### Requirements

Dpp.vim requires both Deno and denops.vim.

- <https://deno.land/>
- <https://github.com/vim-denops/denops.vim>

### Basic installation

You can install dpp.vim by your vimrc/init.vim.

```vim
let $CACHE = expand('~/.cache')
if !($CACHE->isdirectory())
  call mkdir($CACHE, 'p')
endif
if &runtimepath !~# '/dpp.vim'
  let s:dir = 'dpp.vim'->fnamemodify(':p')
  if !(s:dir->isdirectory())
    let s:dir = $CACHE .. '/dpp/repos/github.com/Shougo/dpp.vim'
    if !(s:dir->isdirectory())
      execute '!git clone https://github.com/Shougo/dpp.vim' s:dir
    endif
  endif
  execute 'set runtimepath^='
        \ .. s:dir->fnamemodify(':p')->substitute('[/\\]$', '', '')
endif
```

### Config example

<details>
  <summary>
    Show a UNIX installation example using <strong>"~/.cache/dpp"</strong> as
    the base path location.
  </summary>

```vim
" Ward off unexpected things that your distro might have made, as
" well as sanely reset options when re-sourcing .vimrc
set nocompatible

" Set dpp base path (required)
const s:dpp_base = '~/.cache/dpp/'

" Set dpp source path (required)
const s:dpp_src = '~/.cache/dpp/repos/github.com/Shougo/dpp.vim'
const s:denops_src = '~/.cache/dpp/repos/github.com/denops/denops.vim'

" Set dpp runtime path (required)
execute 'set runtimepath+=' .. s:dpp_src

if dpp#load_state(s:dpp_base)
  " NOTE: dpp#make_state() requires denops.vim
  execute 'set runtimepath+=' .. s:denops_src
  autocmd User DenopsReady
  \ call dpp#make_state(s:dpp_base, '{your script path}')
endif

" Attempt to determine the type of a file based on its name and
" possibly its " contents. Use this to allow intelligent
" auto-indenting " for each filetype, and for plugins that are
" filetype specific.
filetype indent plugin on

" Enable syntax highlighting
if has('syntax')
  syntax on
endif
```

</details>
