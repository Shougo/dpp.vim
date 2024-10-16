# dpp.vim

> Dark Powered Plugin manager for Vim/NeoVim

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

**Note:** Dpp.vim requires NeoVim (0.10.0+ and of course, **latest** is
recommended) or Vim 9.0.1276. See [requirements](#requirements) if you aren't
sure whether you have this.

NOTE: To install plugins from remote, you need to install
[dpp-ext-installer](https://github.com/Shougo/dpp-ext-installer).

### Requirements

Please install both Deno 1.45+ and "denops.vim" v7.0+.

- <https://deno.land/>
- <https://github.com/vim-denops/denops.vim>

### Config example

<details>
  <summary>
    Show Vim script configuration example using
    <strong>"~/.cache/dpp"</strong> as the base path location.
  </summary>

```vim
" Ward off unexpected things that your distro might have made, as
" well as sanely reset options when re-sourcing .vimrc
set nocompatible

" Set dpp base path (required)
const s:dpp_base = '~/.cache/dpp/'

" Set dpp source path (required)
" NOTE: The plugins must be cloned before.
const s:dpp_src = '~/.cache/dpp/repos/github.com/Shougo/dpp.vim'
const s:denops_src = '~/.cache/dpp/repos/github.com/denops/denops.vim'
"const s:denops_installer =
"\ '~/.cache/dpp/repos/github.com/Shougo/dpp-ext-installer'

" Set dpp runtime path (required)
execute 'set runtimepath^=' .. s:dpp_src

if s:dpp_base->dpp#min#load_state()
  " NOTE: dpp#make_state() requires denops.vim
  " NOTE: denops.vim and dpp plugins are must be added
  execute 'set runtimepath^=' .. s:denops_src
  "execute 'set runtimepath^=' .. s:denops_installer

  autocmd User DenopsReady
  \ : echohl WarningMsg
  \ | echomsg 'dpp load_state() is failed'
  \ | echohl NONE
  \ | call dpp#make_state(s:dpp_base, '{TypeScript config file path}')
endif

autocmd User Dpp:makeStatePost
      \ : echohl WarningMsg
      \ | echomsg 'dpp make_state() is done'
      \ | echohl NONE

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

<details>
  <summary>
    Show Lua configuration using <strong>"~/.cache/dpp"</strong> as the base
    path location.
  </summary>

```lua
local dppSrc = "~/.cache/dpp/repos/github.com/Shougo/dpp.vim"
local denopsSrc = "~/.cache/dpp/repos/github.com/denops/denops.vim"
--local denopsInstaller =
--  "~/.cache/dpp/repos/github.com/Shougo/dpp-ext-installer"

vim.opt.runtimepath:prepend(dppSrc)

local dpp = require("dpp")

local dppBase = "~/.cache/dpp"
if dpp.load_state(dppBase) then
  vim.opt.runtimepath:prepend(denopsSrc)
  --vim.opt.runtimepath:prepend(denopsInstaller)

  vim.api.nvim_create_autocmd("User", {
    pattern = "DenopsReady",
    callback = function()
      vim.notify("dpp load_state() is failed")
      dpp.make_state(dppBase, {TypeScript config file path})
    end,
  })
end

vim.api.nvim_create_autocmd("User", {
  pattern = "Dpp:makeStatePost",
  callback = function()
    vim.notify("dpp make_state() is done")
  end,
})

vim.cmd("filetype indent plugin on")
vim.cmd("syntax on")
```

</details>

## Extensions

Extensions implement fancy features like other plugin managers.

- <https://github.com/Shougo/dpp-ext-installer/>

- <https://github.com/Shougo/dpp-ext-local>

- <https://github.com/Shougo/dpp-ext-lazy>

- <https://github.com/Shougo/dpp-ext-toml>

You can find other extensions by
[the topic](https://github.com/topics/dpp-exts).

## Protocols

Protocols implement VCS related features.

- <https://github.com/Shougo/dpp-protocol-git>

You can find other protocols by
[the topic](https://github.com/Shougo/dpp-protocols).
