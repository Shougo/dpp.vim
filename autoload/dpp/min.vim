function dpp#min#load_state(path, name=v:progname->fnamemodify(':r')) abort
  if !('#dpp'->exists())
    call dpp#min#_init()
  endif
  if g:dpp#_is_sudo | return 1 | endif
  let g:dpp#_base_path = a:path->expand()
  const state = printf('%s/state_%s.vim', g:dpp#_base_path, a:name)
  const cache = printf('%s/cache_%s.vim', g:dpp#_base_path, a:name)
  if !(cache->filereadable() || state->filereadable()) | return 1 | endif
  try
    let g:dpp#_cache = has('nvim') ? cache->readfile()->json_decode()
          \ : cache->readfile()[0]->js_decode()
    execute 'source' state->fnameescape()
    unlet g:dpp#_cache
  catch
    if v:exception !=# 'Cache loading error'
      call dpp#util#_error('Loading state error: ' .. v:exception)
    endif
    call dpp#util#_clear_state()
    return 1
  endtry
endfunction
function dpp#min#_init() abort
  let g:dpp#_cache_version = 1
  let g:dpp#_plugins = {}
  let g:dpp#_options = {}
  let g:dpp#_check_files = []
  let g:dpp#_is_sudo = $SUDO_USER !=# '' && $USER !=# $SUDO_USER
        \ && $HOME !=# ('~'.$USER)->expand()
        \ && $HOME ==# ('~'.$SUDO_USER)->expand()
  const g:dpp#_init_runtimepath = &runtimepath

  augroup dpp
    autocmd!
    autocmd BufWritePost *.lua,*.vim,*.toml,vimrc,.vimrc
          \ call dpp#util#_check_files()
    autocmd User Dpp:makeStatePost :
  augroup END
endfunction
