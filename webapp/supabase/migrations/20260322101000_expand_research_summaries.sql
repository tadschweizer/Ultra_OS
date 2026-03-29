update public.research_library_entries
set
  plain_english_summary = 'Heat acclimation works best when it is dosed like a training block rather than treated like random extra stress. The benefits come from repeated enough exposure to improve plasma volume and heat tolerance, but they fade fast when the athlete is so cooked from the heat sessions that the quality work in the rest of the week drops off. For most long-endurance athletes, the real win is better thermal control without sacrificing the sessions that still drive race fitness.',
  practical_takeaway = 'Best fit: attach heat blocks to lower-stakes aerobic days, then keep long-run quality and race-specific sessions intact. If the athlete starts missing quality because of heat fatigue, the block is too aggressive.'
where pubmed_id = '31749712';

update public.research_library_entries
set
  plain_english_summary = 'Sodium bicarbonate is not a blanket endurance supplement. It is most useful when the event or session includes repeated hard surges, long climbs, or threshold pressure that drives acid accumulation. In steady aerobic work, the upside is smaller and the GI downside matters more, so context determines whether it is worth testing.',
  practical_takeaway = 'Apply it to key sessions that actually simulate the stress you want help with. If the event is mostly steady aerobic work, the return is lower and the GI risk may not be worth it.'
where pubmed_id = '34503527';

update public.research_library_entries
set
  plain_english_summary = 'Gut training improves when athletes practice race fueling during actual movement, not when they only make a plan on paper. Repeated exposure teaches the gut to tolerate the carbohydrate load, fluid mix, and timing that race day demands. The response is progressive, so athletes usually need several weeks of rehearsal to move from current intake to goal intake.',
  practical_takeaway = 'Build from the athlete''s current intake toward race targets over several weeks, and use long runs or long rides to pressure-test the dose, fluid mix, and timing.'
where pubmed_id = '28177715';

update public.research_library_entries
set
  plain_english_summary = 'Sleep loss in long-endurance sport often shows up in perception, decision quality, and mental steadiness before it obviously shows up in pace. That means athletes can keep posting acceptable splits while the cost of training is climbing in the background. When a block feels flat, heavy, or mentally noisy, sleep debt is often part of the explanation even if the headline metrics still look fine.',
  practical_takeaway = 'Use sleep as a training variable. If an athlete is entering long sessions flat, heavy, or mentally noisy, sleep debt may be degrading the block even when the watch data looks acceptable.'
where pubmed_id = '41753086';

update public.research_library_entries
set
  plain_english_summary = 'Altitude strategies only help when the athlete can stack enough hypoxic exposure without wrecking the quality of key workouts. The signal to watch is not just whether exposure happened, but whether threshold work, long sessions, and race-specific quality still held together during the block. Exposure that replaces useful training is usually a poor trade.',
  practical_takeaway = 'Use tents, camps, or live-high train-low blocks to support the race build, not to replace it. The key check is whether threshold and long-session quality still hold.'
where pubmed_id = '38107789';
