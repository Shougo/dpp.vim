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
