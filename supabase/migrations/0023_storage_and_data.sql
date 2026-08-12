-- Media auto-download preference for the Storage and data settings screen. No 'wifi' tier --
-- that needs a network-state signal this app has no dependency for (expo-network/NetInfo aren't
-- installed, and adding one means another native rebuild cycle) -- just an on/off toggle for
-- whether media decrypts automatically on chat open, or waits for an explicit tap.

alter table public.users
  add column if not exists media_autodownload text not null default 'always'
    check (media_autodownload in ('always', 'never'));
