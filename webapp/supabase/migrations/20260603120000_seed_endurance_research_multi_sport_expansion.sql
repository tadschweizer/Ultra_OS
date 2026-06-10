-- Seed 20 new research library entries covering broad endurance disciplines:
-- ultra-marathon physiology, sub-2-hour marathon science, trail running pacing,
-- personalized training intensity, cross-country skiing & winter sport pacing,
-- Olympic snow sports, rowing physiology (tier profiling, altitude training),
-- ultra-endurance swimming, cycling CGM & mountain biking core strength,
-- UCI cycling nutrition in extreme environments, female athlete menstrual cycle
-- & sex hormones, altitude training best practice, caffeine + taurine meta-analysis,
-- thermoregulation in tropical ultras, iron deficiency in female athletes,
-- ultra-endurance life-history trade-offs, Atlantic rowing mental health.
-- Sources retrieved from PubMed (National Library of Medicine).

insert into public.research_library_entries (
  pubmed_id,
  title,
  authors,
  journal,
  publication_year,
  publication_date,
  pubmed_url,
  topic_tags,
  plain_english_summary,
  practical_takeaway,
  commentary,
  ultra_score,
  gravel_score,
  triathlon_score,
  published
)
values
  -- 1. Comrades ultra-marathon narrative review
  (
    '42232809',
    'A narrative review of physiological responses and health implications in the world''s oldest ultra-marathon.',
    'Knechtle B, Scheer V, Nikolaidis PT, Thuany M, Chlíbková D, Forte P, Leite LB, Weiss K, Rosemann T, Duric S',
    'Frontiers in physiology',
    2026,
    '2026-05-18',
    'https://pubmed.ncbi.nlm.nih.gov/42232809/',
    array['Hydration', 'Recovery', 'Cardiac Health', 'Injury Prevention'],
    'This review synthesizes 42 studies on the Comrades Marathon, the world''s oldest ultra-marathon held annually between Durban and Pietermaritzburg since 1921. Medical encounters occurred at rates up to 20 per 1000 starters, with dehydration (7.5%) and exercise-associated muscle cramping (3.2%) the most common diagnoses. Hypernatremia was substantially more prevalent than hyponatremia, and the event demonstrates an unusually high prevalence of acute kidney injury compared to other ultra-endurance races. Cardiac biomarker elevations post-race were transient.',
    'In hot, hilly ultras, hypernatremia may be a bigger risk than over-hydration. Prioritize sodium-containing electrolyte strategies and monitor kidney stress markers after races exceeding 50 miles. Do not assume post-race cardiac marker elevations indicate lasting damage, but allow adequate recovery before returning to hard training.',
    'The Comrades provides over a century of race data, making this one of the richest single-event reviews in ultra-endurance literature. The hypernatremia finding challenges the narrative that endurance athletes mainly need to worry about drinking too much.',
    5,
    2,
    2,
    true
  ),
  -- 2. Life history trade-offs during ultra-endurance
  (
    '42137885',
    'Experimental evidence of life history trade-offs during ultra-endurance physical activity.',
    'Longman DP, Murray A, Brown EL, Lewis C, Millis RM, Nowak TJ, Udquim KT, Muehlenbein MP, Wells JCK, Stock JT',
    'Evolutionary human sciences',
    2026,
    '2026-03-06',
    'https://pubmed.ncbi.nlm.nih.gov/42137885/',
    array['Recovery', 'Injury Prevention'],
    'Researchers tracked 147 ultra-endurance athletes across four multiday ultramarathons and one multiweek ocean rowing event to test whether the body prioritizes certain biological functions under extreme energetic stress. The immune system (defense) was broadly prioritized over energy storage, reproduction, and tissue maintenance, demonstrating measurable biological trade-offs during prolonged endurance activity.',
    'During multi-day events or heavy training blocks, your body diverts resources to immune defense at the expense of recovery and hormonal health. Support these trade-offs by maintaining caloric intake, prioritizing sleep, and scheduling lighter training after multi-day efforts to allow maintenance systems to catch up.',
    'A rare study that bridges evolutionary biology and endurance sport. The finding that the immune system gets priority resources while reproduction and tissue repair take a back seat explains the hormonal suppression and lingering soreness many ultra athletes experience.',
    5,
    3,
    3,
    true
  ),
  -- 3. CGM in elite athletes during record cycling events
  (
    '41829603',
    'Beyond Euglycemia: Case Studies Using Continuous Glucose Monitoring in Elite Athletes Without Diabetes During Record Athletic Events.',
    'Skroce K, Turner LV, Zignoli A, Lipman DJ, Zisser HC, Riddell MC',
    'Sensors',
    2026,
    '2026-03-05',
    'https://pubmed.ncbi.nlm.nih.gov/41829603/',
    array['Fueling & Nutrition'],
    'Three elite athletes wore continuous glucose monitors during extreme performances: a 44-hour ultra-cycling relay world record (Race Across the West), an Everesting cycling record attempt, and a competitive breath-hold dive. During ultra-cycling, mean glucose was 91 mg/dL with significant time below 70 mg/dL (9.15%) during riding. The Everesting attempt showed persistently elevated glucose (160 mg/dL, 100% above 140). These case studies demonstrate that substantial deviations from normal glucose ranges are common during elite performance.',
    'CGM data during long efforts should be interpreted in context, not by clinical diabetes thresholds. If you use a CGM during ultra events, expect glucose dips during sustained lower-intensity efforts and spikes during maximal work. Tailor your fueling to keep glucose stable for your event intensity rather than chasing a single ''normal'' range.',
    'First published CGM data from a world-record ultra-cycling relay. The contrast between steady-state ultra-endurance glucose patterns and maximal Everesting glucose patterns is striking and should reshape how athletes and coaches interpret CGM data during competition.',
    4,
    5,
    3,
    true
  ),
  -- 4. Atlantic rowing mental health (all-female crew)
  (
    '41806967',
    'Rowing across the Atlantic in an all-female team: Impact on mental health and mood changes - a cohort study.',
    'Scheer V, de Sá Souza H, Mendes PHV, O''Brien I, Glover R, Morris G, Kaulback K',
    'The Journal of international medical research',
    2026,
    '2026-03-10',
    'https://pubmed.ncbi.nlm.nih.gov/41806967/',
    array['Recovery', 'Female Athletes'],
    'Four women (mean age 32.3 years) rowed 3000 miles across the Atlantic in 46 days. Mood states deteriorated during the race with tension-anxiety increasing over time, yet neuroticism scores decreased, reflecting fewer negative emotions that may have been beneficial for team dynamics. One rower screened positive for major depression post-race and another showed exercise addiction. Personal accounts demonstrated good team coherence despite brutal conditions.',
    'Extended ultra-endurance events carry real mental health risks alongside physical ones. Pre-event mental health screening, planned psychological support during multi-day efforts, and structured post-event monitoring are not luxuries but necessities. Team environments can be protective but do not eliminate individual vulnerability.',
    'Unique dataset from one of the most extreme team endurance challenges on earth. The post-race depression finding underscores that the psychological cost of extreme endurance deserves the same attention as the physiological cost.',
    5,
    2,
    2,
    true
  ),
  -- 5. Sub-2-hour marathon integrative framework
  (
    '41351755',
    'Toward a record-eligible sub-2-hour marathon: an updated integrative framework of Physiological, technological, and cognitive determinants.',
    'Grivas GV',
    'European journal of applied physiology',
    2025,
    '2025-12-06',
    'https://pubmed.ncbi.nlm.nih.gov/41351755/',
    array['VO2max', 'Running Economy', 'Pacing', 'Fueling & Nutrition', 'Caffeine'],
    'This review proposes that breaking the sub-2-hour marathon under official conditions requires VO2max of 75-85 mL/kg/min, running economy at or below 190 mL/kg/km at 21 km/h, fractional utilization of 90-94% VO2max, carbohydrate intake of 60-100 g/h, caffeine dosing of 3-6 mg/kg, and ideal environmental conditions around 10°C with low wind. Carbon-fiber-plated shoes, AI-assisted training, and cognitive endurance are also integrated into the framework.',
    'Even if you are not chasing a sub-2 marathon, the physiological benchmarks here help frame what elite performance demands. For age-group athletes, the principles scale: maximize running economy, fuel aggressively, time your caffeine, and choose races with favorable weather. The framework confirms that no single factor breaks the barrier alone.',
    'The most comprehensive systems-level review of sub-2-hour marathon physiology to date. Incorporating cognitive endurance and AI-assisted training into the framework acknowledges that the final frontier is not just the body but the brain''s willingness to sustain near-threshold effort.',
    5,
    2,
    3,
    true
  ),
  -- 6. ML-based personalized training: pyramidal vs polarized
  (
    '41286008',
    'Machine learning-based personalized training models for optimizing marathon performance through pyramidal and polarized training intensity distributions.',
    'Qin G, Lee S, Kim S',
    'Scientific reports',
    2025,
    '2025-11-24',
    'https://pubmed.ncbi.nlm.nih.gov/41286008/',
    array['Periodization', 'VO2max', 'Lactate Threshold'],
    'In 120 recreational marathon runners randomized to 16-week pyramidal or polarized training, polarized training produced 30% greater performance improvements despite reduced volume. However, clustering revealed four response types: polarized responders (31.5%), pyramidal responders (31.9%), dual responders (18.7%), and non-responders (17.9%). Training experience was the strongest predictor: novice athletes favored pyramidal, experienced athletes responded better to polarized.',
    'Do not assume one training intensity distribution fits everyone. If you are newer to structured training, a pyramidal model (lots of easy, some moderate, less hard) may serve you better. Experienced athletes who have plateaued should experiment with polarized training. Track your response and be willing to switch approaches.',
    'The randomized design and response clustering elevate this above typical training-distribution studies. The finding that nearly a third of athletes responded to either approach validates individualization over dogma.',
    5,
    4,
    4,
    true
  ),
  -- 7. Real-time performance prediction in trail running
  (
    '41295769',
    'Real-Time Performance Prediction in Long-Distance Trail Running: A Practical Model Based on Terrain Difficulty and Pacing Variability.',
    'Gutiérrez H, Piedrafita E, Bascuas PJ, Arbonés I, Berzosa C, Bataller-Cervero AV',
    'Sports',
    2025,
    '2025-11-04',
    'https://pubmed.ncbi.nlm.nih.gov/41295769/',
    array['Pacing'],
    'Analyzing 947 runners in a Spanish trail event, researchers developed a real-time model predicting total race time using only the first third of the race. Using weighted time, pacing variability, and checkpoint ranking, the model showed strong predictive power (R² > 0.95). Athletes who maintained consistent pacing over varied terrain finished faster, confirming that discipline in the early stages is a stronger predictor of success than raw speed.',
    'Your first third dictates your final time in trail races. Use early checkpoints to calibrate effort rather than racing position. If your pacing variability is high (yo-yoing between fast downhills and slow uphills), you are likely costing yourself time overall. Practice steady-effort pacing over varied terrain in training.',
    'A rare field-validated pacing model that actually works in real time. Coaches and crew at ultramarathons could use this kind of checkpoint-based projection to make data-driven decisions about athlete support and pacing adjustments.',
    5,
    3,
    2,
    true
  ),
  -- 8. Pacing in Olympic winter endurance sports
  (
    '41665741',
    'Mind-Muscle-Environment Interactions: Psychophysiological Determinants of Optimal Pacing in Olympic Winter Endurance Sports.',
    'Edholm P, Bouten LJL, Holmberg HC, Losnegard T, Hettinga FJ',
    'Scandinavian journal of medicine & science in sports',
    2026,
    '2026-02-01',
    'https://pubmed.ncbi.nlm.nih.gov/41665741/',
    array['Pacing', 'Periodization'],
    'This review synthesizes pacing research across cross-country skiing, biathlon, and speed skating. Performance depends on integrating the physiological engine (energy systems, fatigue, afferent feedback) with the psychological operator (self-regulation, expectations, cognition) in dynamic environments with variable weather, terrain, and head-to-head racing. The ''affordance competition hypothesis'' is proposed as a framework where pacing is a continuous decision-making process.',
    'Pacing in endurance sport is not just about holding a number. Train in conditions that match race demands, including variable terrain, head-to-head racing, and environmental stress. Developing your ability to read effort against external cues and adjust in real time is a skill that requires deliberate practice.',
    'While focused on winter sports, the psychophysiological pacing framework applies broadly to any endurance discipline with variable conditions: trail running, gravel cycling, adventure racing. The recommendation to integrate physiological and psychological training in ecologically valid settings is advice most programs miss.',
    3,
    3,
    3,
    true
  ),
  -- 9. Olympic snow sports review
  (
    '41653367',
    'Olympic Snow Sports: Current Insights and Future Directions for Milano Cortina 2026 and Beyond.',
    'Zoppirolli C, Fornasiero A, Spörri J, Losnegard T, Elfmark OA, Sandbakk Ø, Holmberg HC',
    'Scandinavian journal of medicine & science in sports',
    2026,
    '2026-02-01',
    'https://pubmed.ncbi.nlm.nih.gov/41653367/',
    array['Periodization', 'VO2max', 'Strength Training'],
    'A comprehensive review of performance determinants across all Olympic snow sports heading into Milano Cortina 2026. Endurance-dominant disciplines like cross-country skiing and biathlon rely on high aerobic capacity and movement efficiency, while gravity sports emphasize neuromuscular power. The review identifies major knowledge gaps in sex-specific analyses, on-snow monitoring technologies, and energy availability research.',
    'Cross-country skiing and biathlon share the same aerobic demands as running and cycling but add upper-body contribution. Off-season training for winter endurance athletes should include dedicated upper-body endurance work alongside traditional lower-body aerobic base building. Strength-power work is critical for transitions and terrain changes.',
    'The broadest review of Olympic snow sport science to date. The identification of sex-specific research gaps is notable given how much of endurance sport science still defaults to male athlete data.',
    2,
    2,
    2,
    true
  ),
  -- 10. Tier-specific physiological profiling in rowers
  (
    '41645331',
    'Tier-specific physiological profiling in male rowers: insights from an integrated three-phase performance diagnostic framework.',
    'Gong Z, Hu Y, Lai H, Guo P, Qiu S, Huang W',
    'BMC sports science, medicine & rehabilitation',
    2026,
    '2026-02-05',
    'https://pubmed.ncbi.nlm.nih.gov/41645331/',
    array['VO2max', 'Lactate Threshold'],
    'Fifty-one single scull rowers were classified as Elite, Sub-elite, or Developmental and tested through a three-phase protocol: 30-second all-out anaerobic, incremental aerobic, and 120-second all-out fatigue resistance tests. Elite rowers distinguished themselves not just by higher VO2max and power output, but by superior fatigue resistance and metabolic regulation under duress, maintaining higher power and stroke rate despite similar lactate levels.',
    'For rowers and other endurance athletes, raw aerobic capacity is not the only differentiator at the top. The ability to sustain power when fatigued, essentially metabolic composure, separates elite from sub-elite. Include fatigue-resistance testing (e.g., back-to-back intervals with short rest) in your assessment toolkit.',
    'The three-phase testing protocol is an elegant framework that any endurance sport could adopt. Too many athletes and coaches test aerobic capacity in isolation without examining how performance holds up under accumulated fatigue.',
    2,
    2,
    3,
    true
  ),
  -- 11. Live high-train low in elite rowers
  (
    '42222289',
    'Hematological, inflammatory, and hypoxia-responsive adaptations to 18-day normobaric live high-train low training in elite rowers.',
    'Kasperska A, Dziewiecka H, Jankowski W, Mikulski T, Czerniec I, Skarpańska-Stejnborn A, Ostapiuk-Karolczuk J',
    'Frontiers in physiology',
    2026,
    '2026-05-13',
    'https://pubmed.ncbi.nlm.nih.gov/42222289/',
    array['Altitude'],
    'Thirteen national-level male rowers completed an 18-day live high-train low protocol using normobaric hypoxic rooms. EPO levels were higher after 18 days, reticulocyte counts increased within 6 days, and hematocrit was significantly higher. CRP levels increased at days 6 and 18 indicating a transient inflammatory response, and CK showed a biphasic pattern. The protocol induced moderate hematological adaptations but also added physiological load.',
    'Altitude camps stimulate red blood cell production within the first week, but they also increase inflammation and training stress. Factor this added load into your overall periodization: reduce training volume slightly during altitude blocks to avoid overreaching, and monitor inflammatory markers if possible.',
    'Confirms the expected hematological adaptations from LH-TL but adds an important nuance: the inflammatory and immune modulation response means altitude training is not free adaptation, it carries a physiological cost that must be managed.',
    3,
    3,
    3,
    true
  ),
  -- 12. Altitude training best-practice review
  (
    '42200179',
    'Live high, train smart: translating altitude physiology to best practice with mechanistic insights.',
    'Faiss R, Girard O',
    'Frontiers in physiology',
    2026,
    '2026-05-11',
    'https://pubmed.ncbi.nlm.nih.gov/42200179/',
    array['Altitude', 'VO2max'],
    'Sixty years after the first altitude training symposium, this perspective reconceptualizes the performance benefits of altitude training beyond just increased hemoglobin mass. The authors map how different altitude strategies (live high-train high, live high-train low, intermittent hypoxia) affect erythropoiesis, muscle efficiency, ventilatory response, and immune function. Key practical lessons include optimal altitude severity (2000-2500m), minimum exposure duration (2-3 weeks), and the importance of accounting for inter-individual variability.',
    'For altitude camps to pay off, target 2000-2500m equivalent, stay for at least 14 days (21 is better), and accept that not everyone responds the same way. The primary target is total hemoglobin mass, but non-hematological benefits like improved muscle efficiency may also contribute. Track your response across multiple altitude blocks.',
    'An excellent synthesis that moves past the simplistic ''altitude = more red blood cells'' narrative. The framework mapping each altitude strategy to its physiological mechanisms is the most useful altitude training decision tool published in recent years.',
    4,
    4,
    4,
    true
  ),
  -- 13. Menstrual cycle and fat oxidation during cycling
  (
    '41838469',
    'Effects of the Menstrual Cycle on Fat Utilization During 1 Hour of Cycling at Fatmax.',
    'García-Ortiz C, Fernández-Sánchez J, García-Albín D, Ranieri LE, Trujillo-Colmena D, Solano-Lizcano V, Rodríguez-Castaño A, Collado-Mateo D, Casado A, Del Coso J',
    'International journal of sports physiology and performance',
    2026,
    '2026-03-14',
    'https://pubmed.ncbi.nlm.nih.gov/41838469/',
    array['Female Athletes', 'Fueling & Nutrition'],
    'Fifteen physically active women completed 1-hour cycling at maximal fat oxidation intensity during three menstrual cycle phases in a randomized crossover design. Total fat oxidized, total carbohydrate oxidized, and total energy expended did not differ across phases. However, heart rate was higher in the peri-ovulatory phase and perceived exertion was higher in the midluteal phase, suggesting the subjective experience of exercise changes even when metabolic output does not.',
    'Women can rely on the same fueling strategies regardless of menstrual cycle phase since fat and carbohydrate oxidation rates remain stable. However, be aware that RPE may feel harder in the luteal phase and heart rate may read higher around ovulation, so do not interpret these as fitness changes. Use power or pace rather than HR or feel for intensity targets during these phases.',
    'A well-designed crossover trial that adds important nuance: the metabolism stays steady across the cycle even though how hard it feels changes. This is practically valuable for female athletes who worry about cycle phase affecting their fueling or fat-adaptation strategies.',
    3,
    4,
    3,
    true
  ),
  -- 14. Core strength training for female mountain bikers
  (
    '41801641',
    'Effects of Core Strength Training on Maximal Trunk Muscle Strength and Cycling Economy in Female Mountain Bikers.',
    'Blechschmied R, Strahler J, Granacher U',
    'Sports medicine - open',
    2026,
    '2026-03-09',
    'https://pubmed.ncbi.nlm.nih.gov/41801641/',
    array['Strength Training', 'Concurrent Training'],
    'Twenty-four trained female mountain bikers were randomized to 8 weeks of core strength training or active control. The core group significantly improved trunk flexor and extensor strength and reduced lateral bike displacement during a simulated course. Physiological cycling economy measures did not differ between groups, and hormonal menstrual cycle measures did not moderate the effects.',
    'Off-season core work improves on-bike stability in mountain biking: less lateral sway means more power directed to the pedals on technical terrain. Three sessions per week for 8 weeks is enough to see meaningful gains. The lack of change in physiological economy suggests the benefits are mechanical rather than metabolic.',
    'A rare randomized controlled trial in female mountain bikers. The lateral displacement finding is the practical gem: riders waste energy through lateral sway on rough terrain, and core strength directly addresses that.',
    2,
    5,
    2,
    true
  ),
  -- 15. Sex hormones and maximal metabolic steady state
  (
    '41460237',
    'The impact of biological sex and female sex hormone concentration on the maximal metabolic steady state.',
    'Schoeberlein MI, Hudgins JH, DeVelasco O, Wilkins BW',
    'Journal of applied physiology',
    2025,
    '2025-12-29',
    'https://pubmed.ncbi.nlm.nih.gov/41460237/',
    array['Female Athletes', 'Lactate Threshold'],
    'Thirty endurance-trained participants (15 women, 15 men) completed maximal metabolic steady state testing at four distinct sex hormone profiles. When normalized to lean body mass, the work rate at the heavy-to-severe exercise domain boundary was similar between men and women. Fluctuations in estradiol and progesterone across the menstrual cycle were not associated with changes in the critical power threshold.',
    'Female athletes do not need to adjust threshold-based training zones across their menstrual cycle. The heavy-to-severe boundary, where sustainable meets unsustainable effort, stays the same regardless of hormone fluctuations. Set your training zones from testing done in any cycle phase and keep them consistent.',
    'An important finding that simplifies training prescription for female athletes. The lean-body-mass normalization revealing no sex difference in threshold intensity is a subtle but powerful result with implications for how we think about sex-based performance gaps.',
    4,
    4,
    4,
    true
  ),
  -- 16. UCI cycling nutrition in extreme environments
  (
    '41468209',
    'UCI Sports Nutrition Project: Special Environments.',
    'Cheung S, Stellingwerff T, Stanley J, Mujika I, Nybo L, Girard O',
    'International journal of sport nutrition and exercise metabolism',
    2025,
    '2025-12-29',
    'https://pubmed.ncbi.nlm.nih.gov/41468209/',
    array['Fueling & Nutrition', 'Hydration', 'Heat Acclimation', 'Altitude', 'Supplementation'],
    'This UCI consensus addresses nutritional challenges in heat, cold, and altitude for elite cyclists. Heat increases energy and carbohydrate oxidation rates, requiring adjusted fueling. Altitude raises energy expenditure while suppressing appetite. Cold conditions increase carbohydrate reliance and fluid losses through respiration. The review provides evidence-based pre-, during-, and post-exercise nutrition and hydration strategies for each environment.',
    'Adjust your fueling plan for the conditions, not just the distance. In heat, increase carbohydrate intake by 10-20% and front-load sodium. At altitude, eat more despite reduced appetite and supplement iron if ferritin is low. In cold, carry warm fluids and increase carbohydrate availability. One-size-fits-all fueling plans break down in extreme environments.',
    'The UCI consensus carries institutional weight and practical specificity that most reviews lack. Having heat, cold, and altitude nutrition addressed in a single framework makes this a reference document for any cyclist or multisport athlete facing environmental extremes.',
    3,
    5,
    4,
    true
  ),
  -- 17. Record-breaking female ultra-endurance swim
  (
    '41106848',
    'Breathless but buoyed: a female athlete''s record-breaking ultraendurance swim 1,900 m above sea level.',
    'Paris HL, Ganey AE, Goll AF, Kroeze AW, Thomas TM, Webster FE, Pennell A',
    'Journal of applied physiology',
    2025,
    '2025-10-17',
    'https://pubmed.ncbi.nlm.nih.gov/41106848/',
    array['Female Athletes', 'Altitude'],
    'This case study documents a female swimmer''s record-setting 34.3 km solo swim across Lake Tahoe at 1,900 m elevation in 10:34:48, the fastest time ever by a woman. Over a 3-month training block, resting metabolic rate increased from 1,383 to 1,648 kcal/day. Body mass changed less than 1 kg during the 10.5-hour swim. Post-swim, simple reaction time was strongly compromised while grip strength showed mixed changes, suggesting the primary cost of ultra-endurance swimming is cognitive.',
    'Ultra-endurance swimming at altitude combines cold immersion, phase-locked breathing, and hypoxia into a uniquely demanding challenge. Metabolic rate increases substantially during training blocks of this intensity, so adjust caloric intake upward. Expect significant cognitive impairment after events lasting 10+ hours, even when physical markers remain relatively stable.',
    'A rare physiological window into elite female ultra-endurance swimming. The finding that cognitive processing speed is the primary casualty rather than physical capacity aligns with emerging research on central fatigue in extreme endurance.',
    5,
    1,
    4,
    true
  ),
  -- 18. Caffeine and taurine systematic review and meta-analysis
  (
    '41032459',
    'Caffeine and taurine: a systematic review and network meta-analysis of their individual and combined effects on physical capacity, cognitive function, and physiological markers.',
    'Deng H, Wang L, Liu P, Bin Naharudin MN, Fan X',
    'Journal of the International Society of Sports Nutrition',
    2025,
    '2025-10-01',
    'https://pubmed.ncbi.nlm.nih.gov/41032459/',
    array['Caffeine', 'Supplementation'],
    'This Bayesian network meta-analysis of 12 studies found that combining caffeine and taurine improved anaerobic capacity and reaction time more than either supplement alone. Caffeine alone showed the greatest reduction in perceived exertion. Taurine may help offset the lactate increase seen with caffeine. Effects on aerobic performance were variable and context-dependent.',
    'If you are already using caffeine before competition, adding taurine (commonly 1-2 g) may provide additional benefit for anaerobic bursts and reaction time without increasing side effects. For steady-state endurance, caffeine alone remains the primary ergogenic aid. Consider the combination for events demanding both sustained effort and tactical decision-making.',
    'The Bayesian network design allows direct and indirect treatment comparisons that traditional meta-analyses miss. The complementary mechanism, caffeine for central stimulation plus taurine for metabolic buffering, is mechanistically plausible and practically simple to implement.',
    3,
    3,
    3,
    true
  ),
  -- 19. Thermoregulation in 160 km tropical ultra
  (
    '41343039',
    'Thermoregulation and Hydration Dynamics in a 160-km Ultra-Endurance Race in a Tropical Environment: A Field Study on 80 Runners.',
    'Bouscaren N, Berly L, Descombes G, Tounkara B, Lacroix E, Lemarchand B, Racinais S, Millet GY',
    'Sports medicine',
    2025,
    '2025-12-04',
    'https://pubmed.ncbi.nlm.nih.gov/41343039/',
    array['Heat Acclimation', 'Hydration', 'Pacing'],
    'Eighty runners (33 women, 47 men) were tracked with ingestible core temperature sensors during a 160 km tropical ultra with 9400 m elevation gain. Mean core temperature was 37.9°C with a peak of 38.9°C, staying below 40°C in all athletes. Faster runners ran hotter. Mean body mass loss was 4.8% with 31% losing more than 6%, yet body mass loss showed no correlation with core temperature or performance. Key predictors of core temperature were BMI, age, speed, air temperature, humidity, and elevation.',
    'Significant body mass loss during ultras may be a normal physiological adaptation rather than a sign of dangerous dehydration. Do not force fluid intake to prevent all weight loss. Instead, drink to thirst and monitor core temperature signs (confusion, stumbling) rather than scale weight. Faster runners should expect to run hotter and plan cooling strategies accordingly.',
    'The largest field study of core temperature in a tropical ultra. The finding that 4-8% body mass loss did not predict hyperthermia or slower performance directly challenges weight-loss-based hydration guidelines that still dominate many race medical tents.',
    5,
    3,
    3,
    true
  ),
  -- 20. Iron deficiency and supplementation in female athletes
  (
    '39536912',
    'Iron deficiency, supplementation, and sports performance in female athletes: A systematic review.',
    'Pengelly M, Pumpa K, Pyne DB, Etxebarria N',
    'Journal of sport and health science',
    2024,
    '2024-11-12',
    'https://pubmed.ncbi.nlm.nih.gov/39536912/',
    array['Iron Deficiency', 'Supplementation', 'Female Athletes'],
    'This systematic review of 23 studies covering 669 female athletes across 16 sports found that iron deficiency negatively affects endurance performance by 3-4%. Supplementing with approximately 100 mg/day of elemental iron for up to 56 days improved endurance performance by 2-20% and maximal aerobic capacity by 6-15%. Up to 60% of female athletes experience iron deficiency. Even non-anemic athletes with low ferritin may have reduced aerobic capacity.',
    'Every female endurance athlete should monitor ferritin levels at least twice per year. If ferritin drops below 40 µg/L, begin supplementation with approximately 100 mg elemental iron daily (with vitamin C for absorption, away from calcium and caffeine). Do not wait for anemia: low ferritin without anemia already costs 3-4% in endurance performance.',
    'The most comprehensive sport-specific review of iron deficiency in female athletes. The 3-4% performance decrement from iron deficiency alone is comparable to many ergogenic supplements, making ferritin monitoring one of the highest-return investments in female athlete health.',
    5,
    5,
    5,
    true
  )
on conflict (pubmed_id) do nothing;

-- Backfill expanded sport scores for the new articles

update public.research_library_entries
set running_score = 5, cycling_score = 2, swimming_score = 1, rowing_score = 1, skating_score = 1, ski_score = 1
where pubmed_id = '42232809';

update public.research_library_entries
set running_score = 5, cycling_score = 3, swimming_score = 3, rowing_score = 4, skating_score = 2, ski_score = 2
where pubmed_id = '42137885';

update public.research_library_entries
set running_score = 2, cycling_score = 5, swimming_score = 1, rowing_score = 1, skating_score = 0, ski_score = 0
where pubmed_id = '41829603';

update public.research_library_entries
set running_score = 2, cycling_score = 1, swimming_score = 2, rowing_score = 5, skating_score = 0, ski_score = 0
where pubmed_id = '41806967';

update public.research_library_entries
set running_score = 5, cycling_score = 2, swimming_score = 1, rowing_score = 1, skating_score = 1, ski_score = 1
where pubmed_id = '41351755';

update public.research_library_entries
set running_score = 5, cycling_score = 4, swimming_score = 2, rowing_score = 3, skating_score = 2, ski_score = 3
where pubmed_id = '41286008';

update public.research_library_entries
set running_score = 5, cycling_score = 2, swimming_score = 0, rowing_score = 0, skating_score = 0, ski_score = 1
where pubmed_id = '41295769';

update public.research_library_entries
set running_score = 3, cycling_score = 2, swimming_score = 1, rowing_score = 2, skating_score = 5, ski_score = 5
where pubmed_id = '41665741';

update public.research_library_entries
set running_score = 2, cycling_score = 2, swimming_score = 1, rowing_score = 1, skating_score = 3, ski_score = 5
where pubmed_id = '41653367';

update public.research_library_entries
set running_score = 2, cycling_score = 2, swimming_score = 3, rowing_score = 5, skating_score = 1, ski_score = 1
where pubmed_id = '41645331';

update public.research_library_entries
set running_score = 3, cycling_score = 3, swimming_score = 2, rowing_score = 5, skating_score = 2, ski_score = 3
where pubmed_id = '42222289';

update public.research_library_entries
set running_score = 4, cycling_score = 4, swimming_score = 3, rowing_score = 4, skating_score = 3, ski_score = 4
where pubmed_id = '42200179';

update public.research_library_entries
set running_score = 3, cycling_score = 4, swimming_score = 2, rowing_score = 2, skating_score = 2, ski_score = 2
where pubmed_id = '41838469';

update public.research_library_entries
set running_score = 2, cycling_score = 5, swimming_score = 0, rowing_score = 0, skating_score = 0, ski_score = 0
where pubmed_id = '41801641';

update public.research_library_entries
set running_score = 4, cycling_score = 4, swimming_score = 3, rowing_score = 3, skating_score = 3, ski_score = 3
where pubmed_id = '41460237';

update public.research_library_entries
set running_score = 3, cycling_score = 5, swimming_score = 2, rowing_score = 2, skating_score = 1, ski_score = 2
where pubmed_id = '41468209';

update public.research_library_entries
set running_score = 2, cycling_score = 1, swimming_score = 5, rowing_score = 1, skating_score = 0, ski_score = 0
where pubmed_id = '41106848';

update public.research_library_entries
set running_score = 4, cycling_score = 4, swimming_score = 3, rowing_score = 3, skating_score = 2, ski_score = 2, team_sport_score = 2
where pubmed_id = '41032459';

update public.research_library_entries
set running_score = 5, cycling_score = 3, swimming_score = 2, rowing_score = 2, skating_score = 1, ski_score = 1
where pubmed_id = '41343039';

update public.research_library_entries
set running_score = 5, cycling_score = 5, swimming_score = 4, rowing_score = 4, skating_score = 3, ski_score = 3
where pubmed_id = '39536912';
