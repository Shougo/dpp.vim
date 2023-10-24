function dpp#get(name = '') abort
  return a:name ==# '' ?
        \ g:dpp#_plugins->copy() : g:dpp#_plugins->get(a:name, {})
endfunction

function dpp#source(plugins = g:dpp#_plugins->values()) abort
  return dpp#source#_source(a:plugins)
endfunction

function dpp#sync_ext_action(ext_name, action_name, action_params={}) abort
  return dpp#denops#_request('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#async_ext_action(ext_name, action_name, action_params={}) abort
  return dpp#denops#_notify('extAction', [
        \ a:ext_name, a:action_name, a:action_params])
endfunction

function dpp#make_state(
      \ base_path, config_path, name=v:progname->fnamemodify(':r')) abort
  const config_path = dpp#util#_expand(a:config_path)
  const base_path = dpp#util#_expand(a:base_path)

  if !(config_path->filereadable())
    call dpp#util#_error(printf('"%s" is not found.', a:config_path))
    return 1
  endif

  return dpp#denops#_notify('makeState', [base_path, config_path, a:name])
endfunction

function dpp#clear_state(name=v:progname->fnamemodify(':r')) abort
  call dpp#util#_clear_state(a:name)
endfunction

function dpp#check_files(name=v:progname->fnamemodify(':r')) abort
  return dpp#util#_check_files(a:name)
endfunction
