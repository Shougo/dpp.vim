const s:sep = has('win32') ? '\' : '/'
function dpp#source#_source(plugins, function_prefix) abort
  let plugins = a:plugins->dpp#util#_convert2list()
  if plugins->empty()
    return []
  endif

  if plugins[0]->type() != v:t_dict
    let plugins = a:plugins->dpp#util#_convert2list()
          \ ->map({ _, val -> g:dpp#_plugins->get(val, {}) })
  endif

  let rtps = &runtimepath->dpp#util#_split_rtp()
  const index = rtps->index(dpp#util#_get_runtime_path())
  if index < 0
    return []
  endif

  let sourced = []
  for plugin in plugins
        \ ->filter({ _, val ->
        \  !val->empty() && !val.sourced && val.rtp !=# ''
        \  && (!v:val->has_key('if') || v:val.if->eval())
        \  && v:val.path->isdirectory()
        \ })
    call s:source_plugin(rtps, index, plugin, sourced)
  endfor

  const filetype_before = 'autocmd FileType'->execute()

  let &runtimepath = rtps->dpp#util#_join_rtp(&runtimepath, '')

  call dpp#util#_call_hook('source', sourced)

  if a:function_prefix->stridx('#') > 0
    " NOTE: Reload autoload script
    " Because autoload script is not loaded twice.
    execute 'runtime' 'autoload/' .. a:function_prefix
          \ ->substitute('#$', '.vim', '')->substitute('#', '/', 'g')
  endif

  " Reload script files.
  for plugin in sourced
    for directory in
          \ ['ftdetect', 'after/ftdetect', 'plugin', 'after/plugin']
          \ ->filter({ _, val -> (plugin.rtp .. '/' .. val)->isdirectory() })
          \ ->map({ _, val -> plugin.rtp .. '/' .. val })
      if directory =~# 'ftdetect'
        if !plugin->get('merge_ftdetect')
          execute 'augroup filetypedetect'
        endif
      endif

      let files = []
      let files += (directory .. '/**/*.vim')->glob(v:true, v:true)
      if has('nvim')
        let files += (directory .. '/**/*.lua')->glob(v:true, v:true)
      endif

      for file in files
        execute 'source' file->fnameescape()
      endfor

      if directory =~# 'ftdetect'
        execute 'augroup END'
      endif
    endfor

    if !has('vim_starting')
      let augroup = plugin->get('augroup',
            \ plugin->dpp#util#_get_normalized_name())
      let events = [
            \   'VimEnter', 'BufRead', 'BufEnter',
            \   'BufWinEnter', 'WinEnter',
            \ ]
      if has('gui_running') && &term ==# 'builtin_gui'
        call add(events, 'GUIEnter')
      endif
      for event in events
        if ('#' .. augroup .. '#' .. event)->exists()
          silent execute 'doautocmd' augroup event
        endif
      endfor

      " Register for lazy loaded denops plugin
      if (plugin.rtp .. '/denops')->isdirectory()
        for name in 'denops/*/main.ts'
              \ ->globpath(plugin.rtp, v:true, v:true)
              \ ->map({ _, val -> val->fnamemodify(':h:t')})
              \ ->filter({ _, val -> !val->denops#plugin#is_loaded() })

          if denops#server#status() ==# 'running'
            call denops#plugin#load(
                  \   name,
                  \   [plugin.rtp, 'denops', name, 'main.ts']->join(s:sep),
                  \ )
          endif

          if denops#server#status() !=# 'stopped'
                \ && plugin->get('denops_wait', v:true)
            call denops#plugin#wait(name)
            redraw
          endif
        endfor
      endif
    endif
  endfor

  const filetype_after = 'autocmd FileType'->execute()

  const is_reset = sourced->s:is_reset_ftplugin()
  if is_reset
    " NOTE: filetype plugins must be reset to load new ftplugins
    call s:reset_ftplugin()
  endif

  if (is_reset || filetype_before !=# filetype_after) && &l:filetype !=# ''
    " Recall FileType autocmd
    " NOTE: ftplugins may be broken.
    silent! let &l:filetype = &l:filetype
  endif

  if !has('vim_starting')
    call dpp#util#_call_hook('post_source', sourced)
  endif

  return sourced
endfunction

function s:source_plugin(rtps, index, plugin, sourced) abort
  if a:plugin.sourced || a:sourced->index(a:plugin) >= 0
    \ || (a:plugin->has_key('if') && !a:plugin.if->eval())
    return
  endif

  call insert(a:sourced, a:plugin)

  let index = a:index

  " NOTE: on_source must be sourced before depends
  for source in dpp#util#_get_lazy_plugins()
        \ ->filter({ _, val ->
        \   val->get('on_source', [])
        \   ->dpp#util#_convert2list()
        \   ->index(a:plugin.name) >= 0
        \ })
    if s:source_plugin(a:rtps, index, source, a:sourced)
      let index += 1
    endif
  endfor

  " Load dependencies
  for name in a:plugin->get('depends', [])
    if !g:dpp#_plugins->has_key(name)
      call dpp#util#_error(printf(
            \ 'Plugin "%s" depends "%s" but it is not found.',
            \ a:plugin.name, name))
      continue
    endif

    if !a:plugin.lazy && g:dpp#_plugins[name].lazy
      call dpp#util#_error(printf(
            \ 'Not lazy plugin "%s" depends lazy "%s" plugin.',
            \ a:plugin.name, name))
      continue
    endif

    if s:source_plugin(a:rtps, index, g:dpp#_plugins[name], a:sourced)
      let index += 1
    endif
  endfor

  let a:plugin.sourced = v:true

  if a:plugin->has_key('dummy_commands')
    for command in a:plugin.dummy_commands
      " NOTE: exists() check does not work well
      silent! execute 'delcommand' command
    endfor
    let a:plugin.dummy_commands = []
  endif

  if a:plugin->has_key('dummy_mappings')
    for [mode, map] in a:plugin.dummy_mappings
      if map->hasmapto(mode)
        " NOTE: unmap may be failed
        silent! execute mode..'unmap' map
      endif
    endfor
    let a:plugin.dummy_mappings = []
  endif

  if !a:plugin.merged || a:plugin->get('local', 0)
    call insert(a:rtps, a:plugin.rtp, index)
    if (a:plugin.rtp .. '/after')->isdirectory()
      call dpp#util#_add_after(a:rtps, a:plugin.rtp .. '/after')
    endif
  endif

  " Load on_post_source
  for source in dpp#util#_get_lazy_plugins()
        \ ->filter({ _, val ->
        \   val->get('on_post_source', [])
        \   ->dpp#util#_convert2list()
        \   ->index(a:plugin.name) >= 0
        \ })
    if s:source_plugin(a:rtps, index, source, a:sourced)
      let index += 1
    endif
  endfor
endfunction

function s:is_reset_ftplugin(plugins) abort
  if &l:filetype ==# ''
    return 0
  endif

  for plugin in a:plugins
    let ftplugin = plugin.rtp .. '/ftplugin/' .. &l:filetype
    let after = plugin.rtp .. '/after/ftplugin/' .. &l:filetype
    let check_ftplugin = !(['ftplugin', 'indent',
          \ 'after/ftplugin', 'after/indent',]
          \ ->filter({ _, val -> printf('%s/%s/%s.vim',
          \          plugin.rtp, val, &l:filetype)->filereadable()
          \          || printf('%s/%s/%s.lua',
          \          plugin.rtp, val, &l:filetype)->filereadable()
        \ })->empty())
    if check_ftplugin
          \ || ftplugin->isdirectory()
          \ || after->isdirectory()
          \ || (ftplugin .. '_*.vim')->glob(v:true) !=# ''
          \ || (after .. '_*.vim')->glob(v:true) !=# ''
          \ || (ftplugin .. '_*.lua')->glob(v:true) !=# ''
          \ || (after .. '_*.lua')->glob(v:true) !=# ''
      return 1
    endif
  endfor

  return 0
endfunction

function s:reset_ftplugin() abort
  const filetype_state = 'filetype'->execute()

  if 'b:did_indent'->exists() || 'b:did_ftplugin'->exists()
    filetype plugin indent off
  endif

  if filetype_state =~# 'plugin:ON'
    silent! filetype plugin on
  endif

  if filetype_state =~# 'indent:ON'
    silent! filetype indent on
  endif
endfunction
