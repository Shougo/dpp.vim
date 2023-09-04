function dpp#load_state(path) abort
endfunction

function dpp#_request(method, args) abort
  if s:init()
    return {}
  endif

  if !dpp#_denops_running()
    " Lazy call request
    execute printf('autocmd User DenopsPluginPost:dpp call '
          \ .. 's:notify("%s", %s)', a:method, a:args->string())
    return {}
  endif

  if denops#plugin#wait('dpp')
    return {}
  endif
  return denops#request('dpp', a:method, a:args)
endfunction
function dpp#_notify(method, args) abort
  if s:init()
    return {}
  endif

  if !dpp#_denops_running()
    " Lazy call notify
    execute printf('autocmd User DenopsPluginPost:dpp call '
          \ .. 's:notify("%s", %s)', a:method, a:args->string())
    return {}
  endif

  return s:notify(a:method, a:args)
endfunction

const s:root_dir = '<sfile>'->expand()->fnamemodify(':h:h')
const s:sep = has('win32') ? '\' : '/'
function dpp#_register() abort
  call denops#plugin#register('dpp',
        \ [s:root_dir, 'denops', 'dpp', 'app.ts']->join(s:sep),
        \ #{ mode: 'skip' })

  autocmd dpp User DenopsClosed call s:stopped()
endfunction

function dpp#_denops_running() abort
  return 'g:loaded_denops'->exists()
        \ && denops#server#status() ==# 'running'
        \ && denops#plugin#is_loaded('dpp')
endfunction

function dpp#_lazy_redraw(name, args = {}) abort
  call timer_start(0, { -> dpp#redraw(a:name, a:args) })
endfunction

function s:init() abort
  if 's:initialized'->exists()
    return
  endif

  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return 1
  endif

  augroup dpp
    autocmd!
    autocmd User DenopsPluginPost:dpp let s:initialized = v:true
  augroup END

  let g:dpp#_started = reltime()

  " NOTE: dpp.vim must be registered manually.

  " NOTE: denops load may be started
  autocmd dpp User DenopsReady silent! call dpp#_register()
  if 'g:loaded_denops'->exists() && denops#server#status() ==# 'running'
    silent! call dpp#_register()
  endif
endfunction

function s:stopped() abort
  unlet! s:initialized
endfunction

function dpp#begin(path, options = {}) abort
  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return 1
  endif

  if !('#dpp'->exists())
    call dpp#_init()
  endif

  if a:path ==# '' || g:dpp#_block_level != 0
    call dpp#util#_error('Invalid begin/end block usage.')
    return 1
  endif

  let g:dpp#_options = extend(g:dpp#_options, a:options)

  let g:dpp#_block_level += 1

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
  if g:dpp#_block_level != 1
    call dpp#util#_error('Invalid begin/end block usage.')
    return 1
  endif

  let g:dpp#_block_level -= 1

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

  if !has('vim_starting')
    call dpp#call_hook('add')
    call dpp#call_hook('source')
    call dpp#call_hook('post_source')
  endif
endfunction

function dpp#get(name = '') abort
  return a:name ==# '' ?
        \ g:dpp#_plugins->copy() : g:dpp#_plugins->get(a:name, {})
endfunction

function dpp#source(plugins = g:dpp#_plugins->values()) abort
  return dpp#source#_source(a:plugins)
endfunction

function dpp#is_sudo() abort
  return $SUDO_USER !=# '' && $USER !=# $SUDO_USER
        \ && $HOME !=# ('~'.$USER)->expand()
        \ && $HOME ==# ('~'.$SUDO_USER)->expand()
endfunction

function dpp#_init() abort
  let g:dpp#_plugins = {}
  let g:dpp#_options = {}

  let g:dpp#_block_level = 0

  const g:dpp#_progname = has('nvim') && exists('$NVIM_APPNAME') ?
        \ $NVIM_APPNAME : v:progname->fnamemodify(':r')
  const g:dpp#_init_runtimepath = &runtimepath

  augroup dpp
    autocmd!
  augroup END
endfunction
