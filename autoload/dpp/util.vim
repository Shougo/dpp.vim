const s:is_windows = has('win32') || has('win64')

function dpp#util#_error(string, name = 'dpp') abort
  echohl Error
  for line in
        \ (a:string->type() ==# v:t_string ? a:string : a:string->string())
        \ ->split("\n")->filter({ _, val -> val != ''})
    echomsg printf('[%s] %s', a:name, line)
  endfor
  echohl None
endfunction

function dpp#util#_get_plugins(plugins) abort
  return a:plugins->empty() ?
        \ g:dpp#_plugins->values() :
        \ a:plugins->dpp#util#_convert2list()
        \ ->map({ _, val -> val->type() == v:t_dict ? val : val->dpp#get() })
        \ ->filter({ _, val -> !val->empty() })
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
        \ ->filter({ _, val -> time < val->dpp#util#_expand()->getftime() })
  if !updated->empty() && 'g:dpp#_config_path'->exists()
    call dpp#make_state(g:dpp#_base_path, g:dpp#_config_path, a:name)
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

  return rtps->map({ _, val ->
        \   val->dpp#util#_substitute_path()
        \ })->filter({ _, val -> val->dpp#util#_expand()->isdirectory() })
endfunction
function dpp#util#_join_rtp(list, runtimepath, rtp) abort
  return (a:runtimepath->stridx('\,') < 0 && a:rtp->stridx(',') < 0) ?
        \ a:list->join(',') : a:list->copy()
        \ ->map({ _, val -> s:escape(val) })->join(',')
endfunction

function dpp#util#_add_after(rtps, path) abort
  const idx = a:rtps->index($VIMRUNTIME->dpp#util#_substitute_path())
  call insert(a:rtps, a:path, (idx <= 0 ? -1 : idx + 1))
endfunction

function dpp#util#_expand(path) abort
  if a:path is v:null
    return ''
  endif

  let path = (a:path =~# '^\$\h\w*') ? a:path->substitute(
        \ '^\$\h\w*', '\=eval(submatch(0))', '') : a:path
  if path =~# '^\~'
    let path = path->fnamemodify(':p')
  endif
  return ((s:is_windows && path =~# '\\') ?
        \ path->dpp#util#_substitute_path() : path)->substitute('/$', '', '')
endfunction
function dpp#util#_substitute_path(path) abort
  return ((s:is_windows || has('win32unix')) && a:path =~# '\\') ?
        \ a:path->tr('\', '/') : a:path
endfunction

function dpp#util#_call_hook(hook_name, plugins = []) abort
  const hook = 'hook_' .. a:hook_name
  let plugins = a:plugins->dpp#util#_get_plugins()->dpp#util#_tsort()
        \ ->filter({ _, val ->
        \    ((a:hook_name !=# 'source'
        \      && a:hook_name !=# 'post_source') || val.sourced)
        \    && val->has_key(hook) && val.path->isdirectory()
        \    && (!val->has_key('if') || val.if->eval())
        \ })
  for plugin in plugins
    call dpp#util#_execute_hook(plugin, hook, plugin.name, plugin[hook])
  endfor

  if a:hook_name ==# 'source' || a:hook_name ==# 'post_source'
    " Check multiple_hooks
    for hooks in g:dpp#_multiple_hooks
      if hooks->get(hook, '') ==# ''
        continue
      endif

      if hooks.plugins->len() ==#
            \ dpp#util#_get_plugins(hooks.plugins)
            \ ->filter({ _, val -> val.sourced })->len()
        " All plugins are sourced

        call dpp#util#_execute_hook(
              \ {}, hook, string(hooks.plugins), hooks[hook])

        " Skip twice call
        let hooks[hook] = ''
      endif
    endfor
  endif
endfunction
function dpp#util#_execute_hook(plugin, hook_name, plugin_name, hook) abort
  " Skip twice call
  if !a:plugin->empty()
    if !a:plugin->has_key('called')
      let a:plugin.called = {}
    endif
    if a:plugin.called->has_key(a:hook->string())
      return
    endif
  endif

  try
    " NOTE: hook may contain \r in Windows
    const cmds = a:hook->split('\r\?\n')
          \ ->map({ _, val -> val->substitute('\r', '', 'g')})
    if !cmds->empty() && cmds[0] =~# '^\s*vim9script' && exists(':vim9')
      vim9 call execute(cmds[1 : ], '')
    else
      call execute(cmds, '')
    endif
  catch
    call dpp#util#_error(
          \ printf('Error occurred while executing %s: %s',
          \        a:hook_name,
          \        a:plugin_name))
    call dpp#util#_error(v:exception)
  endtry

  if !a:plugin->empty()
    let a:plugin.called[string(a:hook)] = v:true
  endif
endfunction

function dpp#util#_tsort(plugins) abort
  let sorted = []
  let mark = {}
  for target in a:plugins
    call s:tsort_impl(target, mark, sorted)
  endfor

  return sorted
endfunction

function s:tsort_impl(target, mark, sorted) abort
  if a:target->empty() || a:mark->has_key(a:target.name)
    return
  endif

  let a:mark[a:target.name] = 1
  if a:target->has_key('depends')
    for depend in a:target.depends
      call s:tsort_impl(depend->dpp#get(), a:mark, a:sorted)
    endfor
  endif

  call add(a:sorted, a:target)
endfunction

function dpp#util#_clear_state(name) abort
  const startup = printf('%s/%s/startup.vim', g:dpp#_base_path, a:name)
  if startup->filereadable()
    call delete(startup)
  endif
  const state = printf('%s/%s/state.vim', g:dpp#_base_path, a:name)
  if state->filereadable()
    call delete(state)
  endif
endfunction

function dpp#util#_get_normalized_name(plugin) abort
  return a:plugin.name->fnamemodify(':r')->substitute(
        \ '\c^\%(n\?vim\|dps\|denops\)[_-]\|[_-]n\?vim$', '', 'g')
endfunction

function dpp#util#_generate_ftplugin(runtimepath, ftplugin) abort
  let generated = {}

  " Merge
  let ftplugin = {}
  for [key, string] in a:ftplugin->items()
    for ft in (key ==# '_' ? ['_'] : key->split('_'))
      if !ftplugin->has_key(ft)
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
  let generated[a:runtimepath .. '/ftplugin.vim'] = ftplugin_generated

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
    if exists('g:did_load_ftplugin')
      finish
    endif
    let g:did_load_ftplugin = 1

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
            silent! execute 'runtime!'
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

function! dpp#util#_check_clean() abort
  const plugins_directories = dpp#get()->values()
        \ ->map({ _, val -> val.path })
  const path = dpp#util#_substitute_path(
        \ 'repos/*/*/*'->globpath(g:dpp#_base_path, v:true))
  return path->split("\n")->filter( { _, val ->
        \  val->isdirectory() && val->fnamemodify(':t') !=# 'dpp.vim'
        \  && plugins_directories->index(val) < 0
        \ })
endfunction
