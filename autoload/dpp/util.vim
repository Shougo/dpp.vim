const s:is_windows = has('win32') || has('win64')

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
function dpp#util#_get_lazy_plugins() abort
  return g:dpp#_plugins->values()
        \ ->filter({ _, val -> !val.sourced && val.rtp !=# '' })
endfunction

function dpp#util#_get_runtime_path() abort
  return dpp#util#_substitute_path($VIMRUNTIME)
endfunction
function! dpp#util#_check_files(name) abort
  const time = printf('%s/%s/state.vim', g:dpp#_base_path, a:name)->getftime()
  const updated = g:dpp#_check_files->copy()
        \ ->filter({ _, val -> time < dpp#util#_expand(val)->getftime() })
  if !(updated->empty())
    call dpp#util#_clear_state(a:name)
  endif

  return updated
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
  let path = (a:path =~# '^\$\h\w*') ? a:path->substitute(
        \ '^\$\h\w*', '\=eval(submatch(0))', '') : a:path
  if path =~# '^\~'
    let path = path->fnamemodify(':p')
  endif
  return ((s:is_windows && path =~# '\\') ?
        \ dpp#util#_substitute_path(path) : path)->substitute('/$', '', '')
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
    " NOTE: hook may contain \r in Windows
    const cmds = a:hook->split('\r\?\n')
    if !(cmds->empty()) && cmds[0] =~# '^\s*vim9script' && exists(':vim9')
      vim9 call execute(cmds[1 : ], '')
    else
      call execute(cmds, '')
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

function dpp#util#_clear_state(name) abort
  const state = printf('%s/%s/state.vim', g:dpp#_base_path, a:name)
  if state->filereadable()
    call delete(state)
  endif
  const cache = printf('%s/%s/cache.vim', g:dpp#_base_path, a:name)
  if cache->filereadable()
    call delete(cache)
  endif
endfunction

function dpp#util#_get_normalized_name(plugin) abort
  return a:plugin->get('normalized_name',
        \ a:plugin.name->fnamemodify(':r')->substitute(
        \ '\c^\%(n\?vim\|dps\|denops\)[_-]\|[_-]n\?vim$', '', 'g'))
endfunction

function dpp#util#_generate_ftplugin(runtimepath, ftplugin) abort
  let generated = {}

  " Merge
  let ftplugin = {}
  for [key, string] in a:ftplugin->items()
    for ft in (key ==# '_' ? ['_'] : key->split('_'))
      if !(ftplugin->has_key(ft))
        if ft ==# '_'
          let ftplugin[ft] = []
        else
          let ftplugin[ft] =<< trim END
            if 'b:undo_ftplugin'->exists()
              let b:undo_ftplugin ..= '|'
            else
              let b:undo_ftplugin = ''
            endif
          END
        endif
      endif
      let ftplugin[ft] += string->split('\n')
    endfor
  endfor

  " Generate ftplugin.vim
  let ftplugin_generated = s:get_default_ftplugin()
  let ftplugin_generated += ['function! s:after_ftplugin()']
  let ftplugin_generated += ftplugin->get('_', [])
  let ftplugin_generated += ['endfunction']
  let generated[a:runtimepath .. '/after/ftplugin.vim'] = ftplugin_generated

  " Generate after/ftplugin
  const after = a:runtimepath .. '/after/ftplugin'
  for [filetype, list] in ftplugin->items()
        \ ->filter({ _, val -> val[0] !=# '_' })
    let generated[printf('%s/%s.vim', after, filetype)] = list
  endfor

  return generated
endfunction
function s:get_default_ftplugin() abort
  let default_ftplugin =<< trim END
    if exists('g:did_load_after_ftplugin')
      finish
    endif
    let g:did_load_after_ftplugin = 1

    augroup filetypeplugin
      autocmd!
      autocmd FileType * call s:ftplugin()
    augroup END

    function! s:ftplugin()
      if 'b:undo_ftplugin'->exists()
        silent! execute b:undo_ftplugin
        unlet! b:undo_ftplugin b:did_ftplugin
      endif

      let filetype = '<amatch>'->expand()
      if filetype !=# ''
        if &cpoptions =~# 'S' && 'b:did_ftplugin'->exists()
          unlet b:did_ftplugin
        endif
        for ft in filetype->split('\.')
          execute 'runtime!'
          \ 'ftplugin/' .. ft .. '.vim'
          \ 'ftplugin/' .. ft .. '_*.vim'
          \ 'ftplugin/' .. ft .. '/*.vim'
          if has('nvim')
            execute 'runtime!'
            \ 'ftplugin/' .. ft .. '.lua'
            \ 'ftplugin/' .. ft .. '_*.lua'
            \ 'ftplugin/' .. ft .. '/*.lua'
          endif
        endfor
      endif
      call s:after_ftplugin()
    endfunction

  END
  return default_ftplugin
endfunction

function dpp#util#_dos2unix(path) abort
  call writefile(
        \   readfile(a:path)
        \     ->map({ _, val -> val->substitute('\r', '', 'g')}),
        \   a:path
        \ )
endfunction
