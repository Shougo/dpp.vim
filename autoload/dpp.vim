function dpp#load_state(base_path) abort
  if !('#dpp'->exists())
    call dpp#min#_init()
  endif
endfunction

function dpp#begin(path, options = {}) abort
  if !('#dpp'->exists())
    call dpp#min#_init()
  endif

  let g:dpp#_options = extend(g:dpp#_options, a:options)

  let g:dpp#_base_path = dpp#util#_expand(a:path)
  if g:dpp#_base_path[-1:] ==# '/'
    let g:dpp#_base_path = g:dpp#_base_path[: -2]
  endif

  " Cache paths
  call dpp#util#_get_runtime_path()
  call dpp#util#_get_cache_path()

  const inline_vimrcs = g:dpp#_options->get('inline_vimrcs', [])

  let g:dpp#_vimrcs = dpp#util#_get_vimrcs(g:dpp#_options->get('vimrcs', []))
  let g:dpp#_vimrcs += inline_vimrcs
  call map(g:dpp#_vimrcs, { _, val -> dpp#util#_expand(val) })

  let g:dpp#_hook_add = ''

  if has('vim_starting')
    " Filetype off
    if g:->get('did_load_filetypes', v:false)
      let g:dpp#_off1 = 'filetype off'
      execute g:dpp#_off1
    endif
    if 'b:did_indent'->exists() || 'b:did_ftplugin'->exists()
      let g:dpp#_off2 = 'filetype plugin indent off'
      execute g:dpp#_off2
    endif
  else
    execute 'set rtp-=' .. g:dpp#_runtime_path->fnameescape()
    execute 'set rtp-=' .. (g:dpp#_runtime_path .. '/after')->fnameescape()
  endif

  " Insert dpp runtimepath to the head of 'runtimepath'.
  let rtps = dpp#util#_split_rtp(&runtimepath)
  const idx = rtps->index(dpp#util#_substitute_path($VIMRUNTIME))
  if idx < 0
    call dpp#util#_error(printf(
          \ '%s is not contained in "runtimepath".', $VIMRUNTIME))
    call dpp#util#_error('verbose set runtimepath?'->execute())
    return 1
  endif
  if a:path->fnamemodify(':t') ==# 'plugin'
        \ && rtps->index(a:path->fnamemodify(':h')) >= 0
    call dpp#util#_error('You must not set the installation directory'
          \ .. ' under "&runtimepath/plugin"')
    return 1
  endif
  call insert(rtps, g:dpp#_runtime_path, idx)
  call dpp#util#_add_after(rtps, g:dpp#_runtime_path .. '/after')
  let &runtimepath = dpp#util#_join_rtp(rtps,
        \ &runtimepath, g:dpp#_runtime_path)

  for vimrc in inline_vimrcs
    execute (vimrc->fnamemodify(':e') ==# 'lua' ? 'luafile' : 'source')
          \ vimrc->fnameescape()
  endfor
endfunction
function dpp#end() abort
  if !has('vim_starting')
    call dpp#source(g:dpp#_plugins->values()
          \ ->filter({ _, val ->
          \          !val.lazy && !val.sourced && val.rtp !=# '' }))
  endif

  " Add runtimepath
  const rtps = dpp#util#_split_rtp(&runtimepath)
  const index = rtps->index(g:dpp#_runtime_path)
  if index < 0
    call dpp#util#_error(printf(
          \ '%s is not contained in "runtimepath".', $VIMRUNTIME))
    call dpp#util#_error('verbose set runtimepath?'->execute())
    return 1
  endif

  let depends = []
  const sourced = has('vim_starting') &&
        \ (!('&loadplugins'->exists()) || &loadplugins)
  for plugin in g:dpp#_plugins->values()
        \ ->filter({ _, val ->
        \          !(val->empty())
        \          && !val.lazy && !val.sourced && val.rtp !=# ''
        \          && (!(v:val->has_key('if')) || v:val.if->eval())
        \          && v:val.path->isdirectory()
        \ })

    " Load dependencies
    if plugin->has_key('depends')
      let depends += plugin.depends
    endif

    if !plugin.merged
      call insert(rtps, plugin.rtp, index)

      if (plugin.rtp .. '/after')->isdirectory()
        call dpp#util#_add_after(rtps, plugin.rtp .. '/after')
      endif
    endif

    let plugin.sourced = sourced
  endfor

  let &runtimepath = dpp#util#_join_rtp(rtps, &runtimepath, '')

  if !(depends->empty())
    call dpp#source(depends)
  endif
endfunction

function dpp#get(name = '') abort
  return a:name ==# '' ?
        \ g:dpp#_plugins->copy() : g:dpp#_plugins->get(a:name, {})
endfunction

function dpp#source(plugins = g:dpp#_plugins->values()) abort
  return dpp#source#_source(a:plugins)
endfunction

function dpp#make_state(base_path, config_path) abort
  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return 1
  endif

  if !(a:config_path->filereadable())
    call dpp#util#print_error(printf('"%s" is not found.', a:config_path))
    return 1
  endif

  if !('#dpp'->exists())
    call dpp#min#_init()
  endif

  " Check sudo
  if g:dpp#_is_sudo
    return
  endif

  return dpp#denops#_notify('makeState', [a:base_path, a:config_path])
endfunction
