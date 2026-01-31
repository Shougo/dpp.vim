function dpp#get(name = '') abort
  return !'g:dpp'->exists()
        \ ? {}
        \ : a:name ==# ''
        \ ? g:dpp.state.plugins->copy()
        \ : g:dpp.state.plugins->get(a:name, {})
endfunction

function dpp#source(
      \ plugins = [], function_prefix = '') abort
  const plugins_val = a:plugins->empty() && 'g:dpp'->exists()
        \ ? g:dpp.state.plugins->values()
        \ : a:plugins
  return dpp#source#_source(plugins_val, a:function_prefix)
endfunction

function dpp#sync_ext_action(ext_name, action_name, action_params={}) abort
  if !'g:dpp'->exists()
        \ || !g:dpp.settings->has_key('base_path')
        \ || !g:dpp.settings->has_key('config_path')
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() succeeded.')
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
  if !'g:dpp'->exists()
        \ || !g:dpp.settings->has_key('base_path')
        \ || !g:dpp.settings->has_key('config_path')
    call dpp#util#_error('dpp.vim is not initialized yet.')
    call dpp#util#_error('Please check dpp#min#load_state() succeeded.')
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
      \   base_path='',
      \   config_path='',
      \   name='',
      \   extra_args={},
      \ ) abort
  const has_dpp = 'g:dpp'->exists()

  " Get defaults from g:dpp.settings if available
  const base_path = a:base_path ==# ''
        \ ? (has_dpp ? g:dpp.settings->get('base_path', '') : '')
        \ : a:base_path
  const config_path = a:config_path ==# ''
        \ ? (has_dpp ? g:dpp.settings->get('config_path', '') : '')
        \ : a:config_path
  const default_name = has_dpp
        \ ? g:dpp.settings->get('name', v:progname->fnamemodify(':r'))
        \ : v:progname->fnamemodify(':r')
  const name = a:name ==# '' ? default_name : a:name
  const extra_args = a:extra_args->empty()
        \ ? (has_dpp ? g:dpp.settings->get('extra_args', {}) : {})
        \ : a:extra_args

  const base_path_expanded = base_path->dpp#util#_expand()
  const config_path_expanded = config_path->dpp#util#_expand()

  if base_path_expanded ==# ''
    call dpp#util#_error('dpp#make_state() base_path is empty.')
    return 1
  endif

  if !config_path_expanded->filereadable()
    call dpp#util#_error(printf(
          \ 'dpp#make_state() config_path: "%s" is not found.',
          \ config_path))
    return 1
  endif

  if !'g:loaded_denops'->exists() && !dpp#get('denops.vim')->empty()
    " Load denops.vim
    call dpp#source('denops.vim')
  endif

  " Remove old state files
  call dpp#util#_clear_state(name)

  return dpp#denops#_notify('makeState', [
        \   base_path_expanded,
        \   config_path_expanded,
        \   name,
        \   extra_args,
        \ ])
endfunction

function dpp#clear_state(
      \   name=''
      \ ) abort
  const default_name =
        \   'g:dpp'->exists()
        \ ? g:dpp.settings->get('name', v:progname->fnamemodify(':r'))
        \ : v:progname->fnamemodify(':r')
  const name_val = a:name ==# '' ? default_name : a:name
  call dpp#util#_clear_state(name_val)
endfunction

function dpp#check_files(
      \   base_path='',
      \   name='',
      \ ) abort
  const has_dpp = 'g:dpp'->exists()
  const base_path_val = a:base_path ==# ''
        \ ? (has_dpp ? g:dpp.settings->get('base_path', '') : '')
        \ : a:base_path
  const default_name = has_dpp
        \ ? g:dpp.settings->get('name', v:progname->fnamemodify(':r'))
        \ : v:progname->fnamemodify(':r')
  const name_val = a:name ==# '' ? default_name : a:name
  return dpp#util#_check_files(base_path_val, name_val)
endfunction

function dpp#check_clean() abort
  return dpp#util#_check_clean()
endfunction
