function dpp#ext#toml#syntax() abort
  if has('nvim') && ':TSBufDisable'->exists()
    TSBufDisable highlight
  endif

  syntax clear

  unlet! b:current_syntax
  runtime! syntax/toml.vim

  unlet! b:current_syntax
  silent! syntax include @tomlVim syntax/vim.vim
  syntax region tomlVim matchgroup=tomlString
        \ start=+\<[[:alnum:]_][[:alnum:]_-]*\s*=\s*\z('''\|"""\)+
        \ end=+\z1+ contains=@tomlVim keepend

  unlet! b:current_syntax
  silent! syntax include @tomlLua syntax/lua.vim
  syntax region tomlLua matchgroup=tomlString
        \ start=+\<lua_\w*\s*=\s*\z('''\|"""\)+
        \ end=+\z1+ contains=@tomlLua keepend

  unlet! b:current_syntax
  silent! syntax include @tomlLuaFtplugin syntax/lua.vim
  syntax region tomlLuaFtplugin matchgroup=tomlString
        \ start=+\<\[\%(plugins\.\)\?ftplugin\]\n
        \\<lua_\w*\s*=\s*\z('''\|"""\)+
        \ end=+\z1+ contains=@tomlLuaFtplugin keepend

  unlet! b:current_syntax
  silent! syntax include @tomlVimFtplugin syntax/vim.vim
  syntax region tomlVimFtplugin matchgroup=tomlString
        \ start=+\<\[\%(plugins\.\)\?ftplugin\]\n
        \[[:alnum:]_-]*\s*=\s*\z('''\|"""\)+
        \ end=+\z1+ contains=@tomlVimFtplugin keepend
endfunction
