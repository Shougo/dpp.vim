function dpp#min#load_state(path, name=v:progname->fnamemodify(':r')) abort
  if !'#dpp'->exists()
    call dpp#min#_init()
  endif
  if g:dpp#_is_sudo | return 1 | endif
  let g:dpp#_base_path = a:path->expand()
  let g:dpp#_name = a:name
  const startup = printf('%s/%s/startup.vim', g:dpp#_base_path, a:name)
  const state = printf('%s/%s/state.vim', g:dpp#_base_path, a:name)
  if !startup->filereadable() || !state->filereadable() | return 1 | endif
  try
    let g:dpp#_state = has('nvim') ? state->readfile()->json_decode()
          \ : state->readfile()[0]->js_decode()
    execute 'source' startup->fnameescape()
    unlet g:dpp#_state
  catch
    call dpp#util#_error('Loading state error: ' .. v:exception)
    call dpp#util#_clear_state(a:name)
    return 1
  endtry
endfunction
function dpp#min#_init() abort
  const g:dpp#_state_version = 1
  const g:dpp#_is_sudo = $SUDO_USER !=# '' && $USER !=# $SUDO_USER
        \ && $HOME !=# ('~'.$USER)->expand()
        \ && $HOME ==# ('~'.$SUDO_USER)->expand()
  const g:dpp#_init_runtimepath = &runtimepath
  const g:dpp#_did_load_filetypes =
        \    g:->get('did_load_filetypes', v:false)
        \ || has('nvim')
  const g:dpp#_did_load_ftplugin =
        \    b:->get('did_ftplugin', v:false)
        \ || b:->get('did_indent', v:false)
        \ || has('nvim')

  let g:dpp#_plugins = {}
  let g:dpp#_options = {}
  let g:dpp#_check_files = []

  augroup dpp
    autocmd!
    autocmd User Dpp:makeStatePost ++nested :
  augroup END
endfunction
