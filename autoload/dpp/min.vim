function dpp#min#_init() abort
  let g:dpp#_cache_version = 1
  let g:dpp#_plugins = {}
  let g:dpp#_options = {}
  let g:dpp#_is_sudo = $SUDO_USER !=# '' && $USER !=# $SUDO_USER
        \ && $HOME !=# ('~'.$USER)->expand()
        \ && $HOME ==# ('~'.$SUDO_USER)->expand()

  const g:dpp#_progname = has('nvim') && exists('$NVIM_APPNAME') ?
        \ $NVIM_APPNAME : v:progname->fnamemodify(':r')
  const g:dpp#_init_runtimepath = &runtimepath

  augroup dpp
    autocmd!
  augroup END
endfunction
function! dpp#min#_load_cache_raw(vimrcs=[]) abort
  let g:dpp#_vimrcs = a:vimrcs
  const cache = g:dpp#_base_path .. '/cache_' .. g:dpp#_progname
  const time = cache->getftime()
  if !(g:dpp#_vimrcs->copy()
        \ ->map({ _, val -> getftime(expand(val)) })
        \ ->filter({ _, val -> time < val })->empty())
    return [{}, {}]
  endif
  return has('nvim') ? cache->readfile()->json_decode()
        \ : cache->readfile()[0]->js_decode()
endfunction
function! dpp#min#load_state(path) abort
  if !('#dpp'->exists())
    call dpp#min#_init()
  endif
  if g:dpp#_is_sudo | return 1 | endif
  let g:dpp#_base_path = a:path->expand()

  const state = g:dpp#_base_path .. '/state_' .. g:dpp#_progname .. '.vim'
  if !(state->filereadable()) | return 1 | endif
  try
    execute 'source' state->fnameescape()
  catch
    if v:exception !=# 'Cache loading error'
      call dpp#util#_error('Loading state error: ' .. v:exception)
    endif
    call dpp#util#_clear_state()
    return 1
  endtry
endfunction
