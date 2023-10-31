# dpp.vim

> Dark Powered Plugin manager for Vim/neovim

If you don't want to configure plugins, you don't have to use the plugin
manager. It does not work with zero configuration. You can use other plugin
managers.

[![Doc](https://img.shields.io/badge/doc-%3Ah%20dpp-orange.svg)](doc/dpp.txt)

Please read [help](doc/dpp.txt) for details.

The development is supported by
[github sponsors](https://github.com/sponsors/Shougo/). Thank you!

Note: If you want to know why I use Deno or what means "dark powered", please
see "FAQ" section in [help](doc/dpp.txt).

<!-- vim-markdown-toc GFM -->

- [Introduction](#introduction)
- [Install](#install)
  - [Requirements](#requirements)
  - [Config example](#config-example)
- [Extensions](#extensions)
- [Protocols](#protocols)

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
execute 'set runtimepath^=' .. s:dpp_src

if dpp#min#load_state(s:dpp_base)
  " NOTE: dpp#make_state() requires denops.vim
  execute 'set runtimepath^=' .. s:denops_src
  autocmd User DenopsReady
  \ call dpp#make_state(s:dpp_base, '{TypeScript config file path}')
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

## Extensions

Extensions implement fancy features like other plugin managers.

- <https://github.com/Shougo/dpp-ext-installer/>

- <https://github.com/Shougo/dpp-ext-local>

- <https://github.com/Shougo/dpp-ext-lazy>

- <https://github.com/Shougo/dpp-ext-toml>

You can find other extensions by [the topic](https://github.com/topics/dpp-ext).

## Protocols

Protocols implement VCS related features.

- <https://github.com/Shougo/dpp-protocol-git>

You can find other protocols by
[the topic](https://github.com/Shougo/dpp-protocol-git).
