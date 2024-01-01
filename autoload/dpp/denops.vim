function dpp#denops#_denops_running() abort
  return 'g:loaded_denops'->exists()
        \ && denops#server#status() ==# 'running'
        \ && denops#plugin#is_loaded('dpp')
endfunction

function dpp#denops#_request(method, args) abort
  if s:init()
    return {}
  endif

  if !dpp#denops#_denops_running()
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
function dpp#denops#_notify(method, args) abort
  if s:init()
    return {}
  endif

  if !dpp#denops#_denops_running()
    " Lazy call notify
    execute printf('autocmd User DenopsPluginPost:dpp call '
          \ .. 's:notify("%s", %s)', a:method, a:args->string())
    return {}
  endif

  return s:notify(a:method, a:args)
endfunction

function dpp#denops#_load(name, path) abort
  try
    call denops#plugin#load(a:name, a:path)
  catch /^Vim\%((\a\+)\)\=:E117:/
    " Fallback to `register` for backward compatibility
    silent! call denops#plugin#register(a:name, a:path, #{ mode: 'skip' })
  endtry
endfunction

function s:init() abort
  if 's:initialized'->exists()
    return
  endif

  if !has('patch-9.0.1276') && !has('nvim-0.10')
    call dpp#util#_error('dpp.vim requires Vim 9.0.1276+ or NeoVim 0.10+.')
    return 1
  endif

  if !'#dpp'->exists()
    call dpp#min#_init()
  endif

  " Check sudo
  if g:dpp#_is_sudo
    return 1
  endif

  augroup dpp
    autocmd!
    autocmd User DenopsPluginPost:dpp let s:initialized = v:true
  augroup END

  let g:dpp#_started = reltime()

  " NOTE: dpp.vim must be registered manually.

  " NOTE: denops load may be started
  autocmd dpp User DenopsReady silent! call s:register()
  if 'g:loaded_denops'->exists() && denops#server#status() ==# 'running'
    silent! call s:register()
  endif
endfunction

function s:notify(method, args) abort
  if 'dpp'->denops#plugin#is_loaded()
    call denops#notify('dpp', a:method, a:args)
  else
    call denops#plugin#wait_async('dpp',
          \ { -> denops#notify('dpp', a:method, a:args) })
  endif
endfunction

const s:root_dir = '<sfile>'->expand()->fnamemodify(':h:h:h')
const s:sep = has('win32') ? '\' : '/'
function s:register() abort
  call dpp#denops#_load(
        \   'dpp',
        \   [s:root_dir, 'denops', 'dpp', 'app.ts']->join(s:sep)
        \ )

  autocmd dpp User DenopsClosed call s:stopped()
endfunction
function s:stopped() abort
  unlet! s:initialized
endfunction
