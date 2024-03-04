local M = setmetatable({}, {
  __index = function(_, key)
    return function(...)
      -- NOTE: For keyword conflict
      if vim.endswith(key, '_') then
        key = key:sub(1, -2)
      elseif key == 'load_state' then
        key = 'min#load_state'
      end

      local ret = vim.call('dpp#' .. key, ...)

      -- NOTE: For boolean functions
      if type(ret) ~= 'table' and (vim.startswith(key, 'check_') or vim.startswith(key, 'is_')) or key == 'min#load_state' then
        ret = ret ~= 0
      end

      return ret
    end
  end,
})

return M
