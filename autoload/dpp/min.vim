function dpp#min#load_state(path, name=v:progname->fnamemodify(':r')) abort
  if !'#dpp'->exists()
    call dpp#min#_init()
  endif
  if g:dpp._is_sudo | return 1 | endif
  let g:dpp.settings.base_path = a:path->expand()
  let g:dpp.settings.name = a:name
  const startup = printf('%s/%s/startup.vim',
        \ g:dpp.settings.base_path, a:name)
  const state = printf('%s/%s/state.vim',
        \ g:dpp.settings.base_path, a:name)
  if !startup->filereadable() || !state->filereadable() | return 1 | endif
  try
    let g:dpp.cache._state =
          \   has('nvim')
          \ ? state->readfile()->json_decode()
          \ : state->readfile()[0]->js_decode()
    execute 'source' startup->fnameescape()
    unlet g:dpp.cache._state
  catch
    call dpp#util#_error('Loading state error: ' .. v:exception)
    call dpp#util#_clear_state(a:name)
    return 1
  endtry
endfunction
function dpp#min#_init() abort
  " Initialize the unified g:dpp namespace with structured sections
  " Skip if already initialized
  if exists('g:dpp') && has_key(g:dpp, '_state_version')
    return
  endif

  let g:dpp = {}

  " Settings: Configuration options
  let g:dpp.settings = {}

  " State: Dynamic plugin states
  let g:dpp.state = {}
  let g:dpp.state.plugins = {}
  let g:dpp.state.options = {}
  let g:dpp.state.check_files = []
  let g:dpp.state.multiple_hooks = []

  " Cache: Temporary cache data
  let g:dpp.cache = {}

  " Version and initialization flags (at root level)
  let g:dpp._state_version = 5
  let g:dpp._is_sudo =
        \    $SUDO_USER !=# '' && $USER !=# $SUDO_USER
        \ && $HOME !=# ('~'.$USER)->expand()
        \ && $HOME ==# ('~'.$SUDO_USER)->expand()
  let g:dpp._init_runtimepath = &runtimepath
  let g:dpp._did_load_filetypes =
        \    g:->get('did_load_filetypes', v:false)
        \ || has('nvim')
  let g:dpp._did_load_ftplugin =
        \    b:->get('did_ftplugin', v:false)
        \ || b:->get('did_indent', v:false)
        \ || has('nvim')

  augroup dpp
    autocmd!
  augroup END
endfunction
