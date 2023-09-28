function dpp#get(name = '') abort
  return a:name ==# '' ?
        \ g:dpp#_plugins->copy() : g:dpp#_plugins->get(a:name, {})
endfunction

function dpp#source(plugins = g:dpp#_plugins->values()) abort
  return dpp#source#_source(a:plugins)
endfunction

function dpp#ext_action(ext_name, action_name, action_params={}) abort
  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return
  endif

  if !('#dpp'->exists())
    call dpp#min#_init()
  endif

  return dpp#denops#_request('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#make_state(base_path, config_path) abort
  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return 1
  endif

  const config_path = dpp#util#_expand(a:config_path)
  const base_path = dpp#util#_expand(a:base_path)

  if !(config_path->filereadable())
    call dpp#util#_error(printf('"%s" is not found.', a:config_path))
    return 1
  endif

  if !('#dpp'->exists())
    call dpp#min#_init()
  endif

  " Check sudo
  if g:dpp#_is_sudo
    return
  endif

  return dpp#denops#_notify('makeState', [base_path, config_path])
endfunction

function dpp#recache_runtimepath() abort
  call dpp#util#_clear_state()
endfunction
