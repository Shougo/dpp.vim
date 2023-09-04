function dpp#util#_error(msg) abort
  for mes in s:msg2list(a:msg)
    echohl WarningMsg | echomsg '[dpp] ' .. mes | echohl None
  endfor
endfunction

function dpp#util#_get_plugins(plugins) abort
  return a:plugins->empty() ?
        \ g:dpp#_plugins->values() :
        \ dpp#util#_convert2list(a:plugins)
        \ ->map({ _, val -> val->type() == v:t_dict ? val : dpp#get(val) })
        \ ->filter({ _, val -> !(val->empty()) })
endfunction

function dpp#util#_get_base_path() abort
  return g:dpp#_base_path
endfunction
function dpp#util#_get_runtime_path() abort
  if g:dpp#_runtime_path !=# ''
    return g:dpp#_runtime_path
  endif

  const g:dpp#_runtime_path = dpp#util#_get_cache_path() .. '/.dpp'
  call dpp#util#_safe_mkdir(g:dpp#_runtime_path)
  return g:dpp#_runtime_path
endfunction
function dpp#util#_get_cache_path() abort
  if g:dpp#_cache_path !=# ''
    return g:dpp#_cache_path
  endif

  const vimrc_path = has('nvim') && exists('$NVIM_APPNAME') ?
        \ $NVIM_APPNAME :
        \ dpp#util#_get_myvimrc()->fnamemodify(':t')
  const g:dpp#_cache_path = dpp#util#_substitute_path(
        \ g:->get('dpp#cache_directory', g:dpp#_base_path)
        \ .. '/.cache/' .. vimrc_path)
  call dpp#util#_safe_mkdir(g:dpp#_cache_path)
  return g:dpp#_cache_path
endfunction
function dpp#util#_get_vimrcs(vimrcs) abort
  return !(a:vimrcs->empty()) ?
        \ dpp#util#_convert2list(a:vimrcs)
        \ ->map({ _, val -> dpp#util#_substitute_path(val->expand()) }) :
        \ [dpp#util#_get_myvimrc()]
endfunction
function dpp#util#_get_myvimrc() abort
  const vimrc = $MYVIMRC !=# '' ? $MYVIMRC :
        \ 'scriptnames'->execute()->split('\n')[0]
        \  ->matchstr('^\s*\d\+:\s\zs.*')
  return dpp#util#_substitute_path(vimrc)
endfunction

function dpp#util#_convert2list(expr) abort
  return a:expr->type() ==# v:t_list ? a:expr->copy() :
        \ a:expr->type() ==# v:t_string ?
        \   (a:expr ==# '' ? [] : a:expr->split('\r\?\n', 1))
        \ : [a:expr]
endfunction

function dpp#util#_split_rtp(runtimepath) abort
  if a:runtimepath->stridx('\,') < 0
    let rtps = a:runtimepath->split(',')
  else
    const split = a:runtimepath->split('\\\@<!\%(\\\\\)*\zs,')
    let rtps = split
          \ ->map({ _, val -> val->substitute('\\\([\\,]\)', '\1', 'g') })
  endif
  return rtps->map({ _, val -> dpp#util#_substitute_path(val) })
endfunction
function dpp#util#_join_rtp(list, runtimepath, rtp) abort
  return (a:runtimepath->stridx('\,') < 0 && a:rtp->stridx(',') < 0) ?
        \ a:list->join(',') : a:list->copy()
        \ ->map({ _, val -> s:escape(val) })->join(',')
endfunction

function dpp#util#_add_after(rtps, path) abort
  const idx = a:rtps->index(dpp#util#_substitute_path($VIMRUNTIME))
  call insert(a:rtps, a:path, (idx <= 0 ? -1 : idx + 1))
endfunction

function dpp#util#_expand(path) abort
  const path = (a:path =~# '^\~') ? a:path->fnamemodify(':p') :
        \ (a:path =~# '^\$\h\w*') ? a:path
        \ ->substitute('^\$\h\w*', '\=eval(submatch(0))', '') :
        \ a:path
  return (s:is_windows && path =~# '\\') ?
        \ dpp#util#_substitute_path(path) : path
endfunction
function dpp#util#_substitute_path(path) abort
  return ((s:is_windows || has('win32unix')) && a:path =~# '\\') ?
        \ a:path->tr('\', '/') : a:path
endfunction

function dpp#util#_call_hook(hook_name, plugins = []) abort
  const hook = 'hook_' .. a:hook_name
  let plugins = dpp#util#_tsort(dpp#util#_get_plugins(a:plugins))
        \ ->filter({ _, val ->
        \    ((a:hook_name !=# 'source'
        \      && a:hook_name !=# 'post_source') || val.sourced)
        \    && val->has_key(hook) && val.path->isdirectory()
        \    && (!(val->has_key('if')) || val.if->eval())
        \ })
  for plugin in plugins
    call dpp#util#_execute_hook(plugin, hook, plugin[hook])
  endfor
endfunction
function dpp#util#_execute_hook(plugin, hook_name, hook) abort
  " Skip twice call
  if !(a:plugin->has_key('called'))
    let a:plugin.called = {}
  endif
  if a:plugin.called->has_key(a:hook->string())
    return
  endif

  try
    if a:hook->type() == v:t_string
      let cmds = a:hook->split('\n')
      if !(cmds->empty()) && cmds[0] =~# '^\s*vim9script' && exists(':vim9')
        vim9 call execute(cmds[1 : ], '')
      else
        call execute(cmds, '')
      endif
    else
      call call(a:hook, [])
    endif

    let a:plugin.called[string(a:hook)] = v:true
  catch
    call dpp#util#_error(
          \ printf('Error occurred while executing %s: %s',
          \        a:hook_name,
          \        a:plugin->get('name', 'g:dpp#_hook_add')))
    call dpp#util#_error(v:exception)
  endtry
endfunction

function dpp#util#_tsort(plugins) abort
  let sorted = []
  let mark = {}
  for target in a:plugins
    call s:tsort_impl(target, mark, sorted)
  endfor

  return sorted
endfunction
function s:msg2list(expr) abort
  return a:expr->type() ==# v:t_list ? a:expr : a:expr->split('\n')
endfunction

function s:tsort_impl(target, mark, sorted) abort
  if a:target->empty() || a:mark->has_key(a:target.name)
    return
  endif

  let a:mark[a:target.name] = 1
  if a:target->has_key('depends')
    for depend in a:target.depends
      call s:tsort_impl(dpp#get(depend), a:mark, a:sorted)
    endfor
  endif

  call add(a:sorted, a:target)
endfunction
