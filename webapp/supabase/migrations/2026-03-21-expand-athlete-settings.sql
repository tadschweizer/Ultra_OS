alter table public.athlete_settings
add column if not exists body_weight_lb integer,
add column if not exists normal_long_run_carb_g_per_hr integer,
add column if not exists sweat_rate_l_per_hr numeric,
add column if not exists sodium_target_mg_per_hr integer,
add column if not exists typical_sleep_hours numeric;
