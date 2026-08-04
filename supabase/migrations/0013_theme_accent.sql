-- User-selectable app accent color (recolors the sent-bubble, icons, tab bar highlight, etc.
-- everywhere the app currently uses the fixed "Hearth" terracotta accent). Nullable — null means
-- "use the default." No new RLS needed: users_update_self already covers self-updates to any
-- column on the caller's own row.

alter table public.users add column if not exists theme_accent text;
