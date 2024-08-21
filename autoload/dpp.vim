function dpp#get(name = '') abort
  return a:name ==# '' ?
        \ g:dpp#_plugins->copy() : g:dpp#_plugins->get(a:name, {})
endfunction

function dpp#source(
      \ plugins = g:dpp#_plugins->values(), function_prefix = '') abort
  return dpp#source#_source(a:plugins, a:function_prefix)
endfunction

function dpp#sync_ext_action(ext_name, action_name, action_params={}) abort
  if !'g:dpp#_base_path'->exists() || !'g:dpp#_config_path'->exists()
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() is suceeded.')
    return
  endif

  if !'g:loaded_denops'->exists()
    call dpp#util#_error(
          \ 'denops.vim must be loaded before "dpp#sync_ext_action()".')
    return
  endif

  return dpp#denops#_request('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#async_ext_action(ext_name, action_name, action_params={}) abort
  if !'g:dpp#_base_path'->exists() || !'g:dpp#_config_path'->exists()
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() is suceeded.')
    return
  endif

  return dpp#denops#_notify('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#make_state(
      \   base_path=g:->get('dpp#_base_path', ''),
      \   config_path=g:->get('dpp#_config_path', ''),
      \   name=g:->get('dpp#_name', v:progname->fnamemodify(':r')),
      \ ) abort
  const base_path = a:base_path->dpp#util#_expand()
  const config_path = a:config_path->dpp#util#_expand()

  if base_path ==# ''
    call dpp#util#_error('dpp#make_state() base_path is empty.')
    return 1
  endif

  if !config_path->filereadable()
    call dpp#util#_error(printf(
          \ 'dpp#make_state() config_path: "%s" is not found.',
          \ a:config_path))
    return 1
  endif

  return dpp#denops#_notify('makeState', [base_path, config_path, a:name])
endfunction

function dpp#clear_state(
      \   name=g:->get('dpp#_name', v:progname->fnamemodify(':r'))
      \ ) abort
  call dpp#util#_clear_state(a:name)
endfunction

function dpp#check_files(
      \   name=g:->get('dpp#_name', v:progname->fnamemodify(':r'))
      \ ) abort
  return dpp#util#_check_files(a:name)
endfunction

function dpp#check_clean() abort
  return dpp#util#_check_clean()
endfunction
