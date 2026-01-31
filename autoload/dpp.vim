function dpp#get(name = '') abort
  return !'g:dpp'->exists()
        \ ? {}
        \ : a:name ==# ''
        \ ? g:dpp.state.plugins->copy()
        \ : g:dpp.state.plugins->get(a:name, {})
endfunction

function dpp#source(
      \ plugins = g:dpp.state.plugins->values(), function_prefix = '') abort
  return dpp#source#_source(a:plugins, a:function_prefix)
endfunction

function dpp#sync_ext_action(ext_name, action_name, action_params={}) abort
  if !'g:dpp'->exists() || !g:dpp.settings->has_key('base_path') 
        \ || !g:dpp.settings->has_key('config_path')
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() is suceeded.')
    return
  endif

  if !'g:loaded_denops'->exists() && !dpp#get('denops.vim')->empty()
    " Load denops.vim
    call dpp#source('denops.vim')
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
  if !'g:dpp'->exists() || !g:dpp.settings->has_key('base_path') 
        \ || !g:dpp.settings->has_key('config_path')
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() is suceeded.')
    return
  endif

  if !'g:loaded_denops'->exists() && !dpp#get('denops.vim')->empty()
    " Load denops.vim
    call dpp#source('denops.vim')
  endif

  return dpp#denops#_notify('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#make_state(
      \   base_path=g:dpp.settings->get('base_path', ''),
      \   config_path=g:dpp.settings->get('config_path', ''),
      \   name=g:dpp.settings->get('name', v:progname->fnamemodify(':r')),
      \   extra_args=g:dpp.settings->get('extra_args', {}),
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

  if !'g:loaded_denops'->exists() && !dpp#get('denops.vim')->empty()
    " Load denops.vim
    call dpp#source('denops.vim')
  endif

  " Remove old state files
  call dpp#util#_clear_state(a:name)

  return dpp#denops#_notify('makeState', [
        \   base_path, config_path, a:name, a:extra_args,
        \ ])
endfunction

function dpp#clear_state(
      \   name=g:dpp.settings->get('name', v:progname->fnamemodify(':r'))
      \ ) abort
  call dpp#util#_clear_state(a:name)
endfunction

function dpp#check_files(
      \   base_path=g:dpp.settings->get('base_path', ''),
      \   name=g:dpp.settings->get('name', v:progname->fnamemodify(':r')),
      \ ) abort
  return dpp#util#_check_files(a:base_path, a:name)
endfunction

function dpp#check_clean() abort
  return dpp#util#_check_clean()
endfunction
