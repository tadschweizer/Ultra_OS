-- Seed 20 new research library entries spanning broad endurance disciplines:
-- ultramarathon biomarkers, ultra-triathlon sex differences, cardiac health in
-- triathlon, altitude training in rowing and cycling, brain oxygenation, speed
-- skating HIIT, open-water swimming safety, menstrual cycle in female endurance
-- athletes, gut microbiome and resistance training, supplementation in cycling
-- and swimming, and muscle architecture in ultra-trail.
-- Sources retrieved from PubMed (National Library of Medicine).

insert into public.research_library_entries (
  pubmed_id,
  title,
  authors,
  journal,
  publication_year,
  pubmed_url,
  topic_tags,
  plain_english_summary,
  practical_takeaway,
  commentary,
  ultra_score,
  gravel_score,
  triathlon_score,
  running_score,
  cycling_score,
  swimming_score,
  rowing_score,
  skating_score,
  ski_score,
  team_sport_score,
  published
)
values
  -- ===== ULTRA / TRAIL RUNNING =====

  -- 1. Tor des Géants stress biomarkers from multiple biological matrices
  (
    '42237705',
    'Effects of extreme mountain ultramarathon on stress-related biomarkers from multiple biological matrices in adult male runners.',
    'Purcaro C, Di Filippo ES, Vezzoli A, Bondi D, Giardini G, Fulle S, Verratti V, Mrakic-Sposta S',
    'Physiological reports',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42237705/',
    array['Ultra-Endurance', 'Recovery', 'Biomarkers'],
    'Seven male finishers of the 330-km Tor des Géants were sampled from blood, saliva, and urine before and immediately after the race. Reactive oxygen species production increased while antioxidant capacity held steady, and urinary creatinine and neopterin rose sharply, indicating cumulative muscle damage and immune activation. Salivary microRNAs (miR-21 and miR-210) did not respond acutely, suggesting finishers may possess adaptive mechanisms that buffer the combined hypoxia-plus-exertion stressor.',
    'Ultra finishers may develop protective adaptations against extreme oxidative and immune stress. Athletes preparing for multi-day mountain races should build resilience through progressive volume at altitude. Post-race recovery monitoring should focus on urinary and blood markers rather than saliva-based biomarkers, which appear less responsive in adapted athletes.',
    'Rare multi-matrix biomarker data from one of the world''s hardest mountain ultras. The finding that salivary miRNAs did not spike in finishers hints at a tolerance phenotype worth further study.',
    5,
    2,
    2,
    4,
    2,
    1,
    1,
    1,
    2,
    0,
    true
  ),

  -- 2. 230-km ultramarathon: inflammatory, hemorheological, vascular responses
  (
    '42225862',
    'Concurrent inflammatory, hemorheological and macrovascular responses to a 230-km ultramarathon: an exploratory study.',
    'Grau M, Bruns J, John L, Munk M, Siebers M, Bloch W, Bizjak DA',
    'Scientific reports',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42225862/',
    array['Cardiac Health', 'Recovery', 'Ultra-Endurance'],
    'Twelve runners were assessed before and immediately after a 230-km non-stop ultramarathon. White blood cell count, IL-6, IL-10, and CRP all increased dramatically post-race, while red blood cell aggregation rose in concert with elevated fibrinogen. Despite this systemic inflammatory storm, macrovascular properties including arterial stiffness and central blood pressures remained largely preserved. Plasma nitrite levels increased, suggesting active endothelial compensation that may protect large arteries during extreme exertion.',
    'The cardiovascular system appears remarkably resilient to ultra-distance stress at the macrovascular level, even when inflammation and blood viscosity markers spike. Athletes and medical crews should monitor inflammatory and blood markers post-race but can be somewhat reassured that central arterial function is preserved in healthy ultra runners.',
    'First study to simultaneously assess inflammatory, hemorheological, endothelial, and macrovascular responses in a single ultra cohort. The nitric oxide compensation finding is clinically meaningful.',
    5,
    3,
    3,
    4,
    2,
    1,
    1,
    1,
    1,
    0,
    true
  ),

  -- 3. Electrolyte and acid-base disturbances in mountain ultramarathon
  (
    '42222487',
    'Electrolyte imbalance markers and acid-base disturbances in Brazilian male runners during a 45-km mountain ultramarathon.',
    'Ribas MR, Ribas DIR, Badicu G, Ferreira S, Matta MAT, Legnani E, Ardigò LP, Bassan JC',
    'PeerJ',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42222487/',
    array['Fueling & Nutrition', 'Hydration', 'Ultra-Endurance'],
    'Forty male runners were tracked through a 45-km mountain ultra. Potassium levels dropped significantly in all performance groups while lactate rose. Faster runners maintained better acid-base equilibrium, with higher pH and more stable electrolyte profiles. In the slowest group, the change in potassium was strongly correlated with race time, suggesting that the ability to preserve electrolyte homeostasis is a key differentiator between finishers and those who struggle.',
    'Electrolyte management, particularly potassium, is directly tied to performance in mountain ultras. Athletes should practice electrolyte replacement strategies in training and not wait until race day to experiment. Faster runners appear to tolerate metabolic acid-base shifts better, pointing to the value of threshold work and race-pace simulation.',
    'Clean study design with four performance tiers. The potassium-race time correlation in slower runners is the standout practical finding for coaches planning fueling strategies.',
    5,
    3,
    3,
    4,
    2,
    1,
    1,
    1,
    1,
    0,
    true
  ),

  -- 4. Comrades Marathon: comprehensive review of physiological responses
  (
    '42232809',
    'A narrative review of physiological responses and health implications in the world''s oldest ultra-marathon.',
    'Knechtle B, Scheer V, Nikolaidis PT, Thuany M, Chlíbková D, Forte P, Leite LB, Weiss K, Rosemann T, Duric S',
    'Frontiers in physiology',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42232809/',
    array['Ultra-Endurance', 'Hydration', 'Cardiac Health', 'Race Safety'],
    'This review synthesizes 42 publications on the Comrades Marathon, the world''s oldest and largest ultra run held since 1921. Medical encounter rates reach 20 per 1000 starters. Dehydration and muscle cramping are the most common diagnoses. The race shows an unusually high prevalence of acute kidney injury and hypernatremia compared to other ultras. Peak performance occurs around age 30 in men and 36 in women. The sex performance gap has narrowed over time, and cardiac biomarker elevations observed post-race are transient.',
    'The Comrades data is a century-long dataset for ultra medicine. Hypernatremia, not hyponatremia, is the bigger electrolyte risk in hot ultra events. Athletes should calibrate hydration to avoid both over- and under-drinking. Post-race kidney stress warrants monitoring, especially in faster runners who push harder in heat.',
    'Landmark review drawing on over 100 years of data from a single event. The finding that hypernatremia outpaces hyponatremia challenges conventional hydration messaging in the ultra community.',
    5,
    3,
    3,
    5,
    2,
    1,
    1,
    1,
    1,
    0,
    true
  ),

  -- 5. Muscle architecture in ultramarathon: lab vs race comparison
  (
    '41975791',
    'Context-Dependent Differences in Muscle Architecture Following Fatigue in Ultramarathon Athletes: A Comparison Between Laboratory and Real Race Settings.',
    'Vicente-Mampel J, Martinez-Navarro I, Collado E, Lopez-Grueso R, Jaenada-Carrilero E, Hernando C',
    'Diagnostics',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/41975791/',
    array['Recovery', 'Training Methodology', 'Ultra-Endurance'],
    'Forty ultra-trail runners completed both a standardized laboratory downhill running protocol and a 106-km ultra race with 5,600 meters of climbing. Muscle thickness remained stable after both conditions, but pennation angle showed significant differences between the lab and race contexts, with muscle-specific patterns. The vastus lateralis responded differently from the rectus femoris and gastrocnemius depending on the setting.',
    'Ultrasound-based muscle assessments taken after a lab test may not reflect what actually happens in a race. Coaches and physiotherapists using muscle imaging to guide recovery should interpret findings in context. What you measure in a controlled lab fatigue protocol is not the same as what a 100-km mountain race produces.',
    'Important methodological finding. The within-subject design comparing lab and race is rare and directly relevant for any practitioner using ultrasound to assess ultra runners pre- and post-event.',
    5,
    2,
    3,
    4,
    2,
    1,
    1,
    1,
    1,
    0,
    true
  ),

  -- ===== TRIATHLON & MULTI-SPORT =====

  -- 6. Cardiac event during Ironman: De Winter STEMI equivalent
  (
    '42222631',
    'De Winter Is Coming: A Rare ST-Segment Elevation Myocardial Infarction (STEMI) Equivalent in an Ironman Competitor.',
    'Griffus A, Bose G, Thomas S, Thakkar A, Puri P',
    'Cureus',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42222631/',
    array['Cardiac Health', 'Race Safety'],
    'A 56-year-old male collapsed during an Ironman triathlon after developing severe chest pain. His ECG showed a rare De Winter pattern, a STEMI equivalent seen in only two to three percent of proximal LAD occlusions, often missed by automated interpretation. Urgent catheterization revealed an acute mid-LAD occlusion. Primary percutaneous revascularization restored flow, and the athlete was discharged with an uncomplicated recovery on guideline-directed medical therapy.',
    'Race medical teams should train to recognize De Winter''s ECG pattern as a STEMI equivalent that automated ECG machines can miss. Age-group athletes over 50 should consider cardiac screening before long-distance triathlons. Rapid recognition and intervention saved this athlete''s life.',
    'Important case report for race medical directors. The De Winter pattern is rare but lethal if missed. Adds to the growing literature on cardiac events during Ironman-distance racing.',
    3,
    3,
    5,
    3,
    3,
    3,
    1,
    1,
    1,
    1,
    true
  ),

  -- 7. Cardiac troponin dynamics in Norseman Xtreme Triathlon
  (
    '42158294',
    'Cardiac troponin patterns in athletes completing Norseman Xtreme Triathlon.',
    'Bonnevie-Svendsen M, Edvardsson EV, Oppen K, Melau J, Nyborg C, Wirum Sæter F, Berge K, Omland T, Hisdal J',
    'BMJ open sport & exercise medicine',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42158294/',
    array['Cardiac Health', 'Recovery', 'Ultra-Endurance'],
    'Ninety-three triathletes had cardiac troponin I and T measured before, immediately after, and the day after completing the Norseman Xtreme Triathlon. Both troponin markers and their ratio spiked immediately post-race but trended toward normalization the next day. Three participants showed persistently elevated cTnI the day after, and 14 had elevated cTnI/cTnT ratios, which may warrant further investigation. The clinical significance of these exercise-induced troponin elevations remains unknown.',
    'Transient troponin elevation after an extreme triathlon is common and appears to resolve within 24 hours in most athletes. However, a small percentage show delayed normalization that could signal underlying cardiac vulnerability. Post-race cardiac screening protocols should include next-day follow-up for athletes with abnormal initial results.',
    'Largest troponin study from the Norseman with 93 athletes and dual-assay approach. The cTnI/cTnT ratio is a novel metric that may help distinguish benign exercise-induced elevations from pathological cardiac damage.',
    4,
    3,
    5,
    3,
    3,
    3,
    2,
    1,
    1,
    1,
    true
  ),

  -- 8. Sex differences in the world''s longest triathlon (Triple Deca)
  (
    '40770400',
    'Sex-specific differences in performance and pacing in the world''s longest triathlon in history.',
    'Knechtle B, Leite LB, Forte P, Andrade MS, Nikolaidis PT, Scheer V, Duric S, Cuk I, Rosemann T',
    'Scientific reports',
    2025,
    'https://pubmed.ncbi.nlm.nih.gov/40770400/',
    array['Pacing', 'Female Athletes', 'Ultra-Endurance'],
    'Fourteen triathletes competed in the 2024 Triple Deca Ultra Triathlon covering 114 km of swimming, 5,400 km of cycling, and 1,266 km of running, the longest triathlon ever held. Men were faster in all three disciplines, with the largest sex gap in cycling at 24.8 percent and the smallest in running at 8.5 percent. Cycling showed the greatest pacing variability, while running exhibited steadier pacing. More consistent pacing correlated with better overall performance and final rankings.',
    'Even at the extreme end of ultra-triathlon, the sex performance gap is smallest in running, supporting the hypothesis that women narrow the gap as distance increases. Pacing discipline, especially in cycling, is the biggest controllable factor in ultra-distance multi-sport events. Train pacing strategies aggressively in the bike leg.',
    'Unprecedented data from the most extreme triathlon distance ever completed. The 8.5 percent running sex gap versus 24.8 percent in cycling adds nuance to the ultra-endurance sex-difference debate.',
    5,
    4,
    5,
    4,
    4,
    4,
    2,
    1,
    1,
    0,
    true
  ),

  -- 9. Menstrual cycle and female endurance athletes
  (
    '42188550',
    'Every Woman Has a Different Cycle and Feels Differently: A Qualitative Study of Athlete-Centred Perspectives on Menstrual Cycle Symptoms and Management in Female Endurance Sports.',
    'Liebrenz E, Smith A, Liebrenz M, Colangelo J, Buadze A',
    'Sports',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42188550/',
    array['Female Athletes', 'Training Methodology'],
    'Twelve female endurance athletes across triathlon, running, swimming, cycling, and skiing were interviewed about their menstrual cycle experiences. Six themes emerged: body awareness, the influence of expectations on perceived performance, inconsistent approaches to cycle-based training, recovery adjustments, the mixed value of digital tracking, and communication barriers. Cycle-based training was applied more as a framework for interpreting symptoms than as a performance optimization tool. Rigid cycle-phase training plans risk reinforcing negative expectancies.',
    'Cycle-based training should be athlete-centred and flexible rather than deterministic. Coaches should discuss menstrual cycle effects openly but avoid prescriptive approaches that create negative expectations. Each athlete responds differently, and the biopsychosocial context matters as much as hormonal physiology. Digital tracking tools can help but should not replace athlete self-awareness.',
    'Qualitative research filling a critical gap. Most menstrual cycle sport science focuses on lab metrics. This study centers the athletes'' lived experiences, which is where training decisions actually happen.',
    4,
    4,
    5,
    4,
    4,
    3,
    2,
    2,
    3,
    1,
    true
  ),

  -- ===== OPEN-WATER SWIMMING =====

  -- 10. Swimming-induced pulmonary edema at moderate elevation
  (
    '42131935',
    'Prospective Assessment of Swimming-Induced Pulmonary Edema in Open-Water Athletes at Moderate Elevations: Incidence and Diagnostic Utility of Point-of-Care Ultrasound.',
    'Steins H, Patterson B, Payton M, Vidlock K',
    'Wilderness & environmental medicine',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42131935/',
    array['Race Safety', 'Cardiac Health'],
    'Among 7,866 endurance athletes at half-Ironman triathlons and open-water swims at moderate elevation, 29 athletes (0.37 percent) developed ultrasound-confirmed swimming-induced pulmonary edema (SIPE). Female incidence matched sea-level data, but male incidence was significantly higher than previously reported at lower elevations. Nontraditional symptoms like anxiety, tachycardia, and wetsuit tightness were associated with positive cases. Standard oxygen saturation cutoffs overestimate SIPE at altitude; a revised threshold of 93 percent or below improves diagnostic accuracy.',
    'SIPE is a real and under-recognized risk in open-water events, especially at moderate elevation. Race medical teams should carry handheld lung ultrasound devices and use an altitude-adjusted SpO2 threshold of 93 percent or below. Athletes experiencing unexplained anxiety or wetsuit tightness during the swim should be evaluated for SIPE, not just hyperventilation.',
    'Largest prospective SIPE study to date with nearly 8,000 athletes. The altitude-adjusted SpO2 threshold is an immediately actionable finding for event medical directors.',
    3,
    2,
    5,
    1,
    1,
    5,
    2,
    0,
    0,
    0,
    true
  ),

  -- ===== ALTITUDE TRAINING =====

  -- 11. Live high-train low in elite rowers: hematological and hypoxia adaptations
  (
    '42222289',
    'Hematological, inflammatory, and hypoxia-responsive adaptations to 18-day normobaric live high-train low training in elite rowers.',
    'Kasperska A, Dziewiecka H, Jankowski W, Mikulski T, Czerniec I, Skarpańska-Stejnborn A, Ostapiuk-Karolczuk J',
    'Frontiers in physiology',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42222289/',
    array['Altitude', 'Training Methodology'],
    'Thirteen national-level male rowers completed an 18-day normobaric live-high-train-low protocol. The hypoxic group showed higher EPO levels and increased reticulocyte counts after just 6 days, with elevated hematocrit by day 18. CRP levels increased transiently, indicating a mild inflammatory response without clinical concern. White blood cell counts showed subtle immune modulation. The protocol induced measurable hematological adaptations but performance was not directly measured.',
    'Even 18 days of normobaric altitude simulation produces measurable erythropoietic responses in elite rowers. The reticulocyte response appears within the first week. Coaches should monitor inflammatory markers during altitude camps and be aware that the immune system faces additional load, which may increase illness risk if training volume is not adjusted.',
    'Well-designed study with time-course sampling at days 6, 12, and 18. The early reticulocyte response confirms that altitude adaptations begin faster than many protocols assume.',
    3,
    4,
    4,
    3,
    3,
    2,
    5,
    2,
    3,
    1,
    true
  ),

  -- 12. Altitude training best-practice framework
  (
    '42200179',
    'Live high, train smart: translating altitude physiology to best practice with mechanistic insights.',
    'Faiss R, Girard O',
    'Frontiers in physiology',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42200179/',
    array['Altitude', 'Training Methodology'],
    'This perspective article reconceptualizes altitude training strategies by mapping contemporary live-high-train-high and live-high-train-low protocols alongside their physiological mechanisms. The principal target remains increased total hemoglobin mass for enhanced oxygen delivery. The authors propose a framework integrating hypoxic dose, exposure timing, and inter-individual variability to guide evidence-informed practice. They note that at least 12 comprehensive reviews or meta-analyses on altitude training have been published in the past five years alone, reflecting sustained scientific interest.',
    'Altitude training is not one-size-fits-all. Athletes and coaches need to consider the hypoxic dose, duration, timing in the season, and individual response variability. The framework in this paper can help practitioners decide between live-high-train-high versus live-high-train-low approaches based on specific performance targets and available resources.',
    'Outstanding conceptual synthesis from two leading altitude researchers. The framework approach is more useful than yet another meta-analysis because it helps practitioners make decisions rather than just summarize effect sizes.',
    4,
    5,
    5,
    4,
    5,
    2,
    3,
    2,
    4,
    1,
    true
  ),

  -- 13. LHTL hematological and performance enhancements in cycling (meta-analysis)
  (
    '41885723',
    'Hematological and performance enhancements using live high-train low in cycling, a review with meta-analysis.',
    'Torres-Pérez J, Fernández-Peña E, Pinedo-Jauregi A',
    'The Journal of sports medicine and physical fitness',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/41885723/',
    array['Altitude', 'Cycling Performance'],
    'This meta-analysis reviewed 34 studies on live-high-train-low in cycling, with six meeting strict inclusion criteria. Results showed improvements in red cell mass, hemoglobin concentration, hemoglobin mass, reticulocyte count, VO2max, and time trial performance. The meta-analysis on hemoglobin concentration and hemoglobin mass indicated a significant positive effect of 0.82 percent. Studies with lower quality scores reported more modest or non-significant results.',
    'Live-high-train-low works for cyclists, but the quality of the altitude camp matters enormously. A 0.82 percent hemoglobin mass increase is meaningful at the elite level. Coaches should ensure proper altitude dose and camp structure. Poorly designed altitude interventions may waste time and resources without delivering measurable gains.',
    'Honest meta-analysis that acknowledges the limited number of high-quality LHTL cycling studies. The influence and bias analyses are a strength, urging appropriate caution in interpretation.',
    3,
    5,
    4,
    3,
    5,
    1,
    2,
    2,
    3,
    0,
    true
  ),

  -- 14. Altitude and heat acclimation in elite cyclists
  (
    '40929090',
    'Haematological adaptations to high-altitude and heat acclimation training in elite male cyclists.',
    'Cubel C, Klaris MB, Larsen JV, Faiss R, Nybo L, Lundby C',
    'Experimental physiology',
    2025,
    'https://pubmed.ncbi.nlm.nih.gov/40929090/',
    array['Altitude', 'Heat Acclimation', 'Cycling Performance'],
    'Twelve elite cyclists completed an in-season 21-day live-high-train-high altitude camp at 3,000 meters immediately after national championships. Total hemoglobin mass increased by 3.5 percent but decayed to pre-camp levels within 10 days of returning to sea level. Importantly, exercise performance and VO2max were not improved at any post-camp time point. For seven cyclists followed over 9 months, the altitude hemoglobin mass effect was comparable to an off-season heat acclimation intervention that produced a 5.4 percent increase.',
    'The rapid decay of hemoglobin mass gains after an altitude camp means timing is everything. If you cannot race within days of descending, the hematological benefit may be lost. Heat acclimation produced comparable hemoglobin mass gains in the off-season, offering an accessible alternative for cyclists without altitude access. Neither intervention reliably translated to performance gains in these elite athletes.',
    'Sobering data for altitude training advocates. The performance null result in genuinely elite cyclists, despite clear hematological adaptations, highlights the gap between biomarkers and race results at the top level.',
    3,
    5,
    4,
    3,
    5,
    1,
    2,
    1,
    2,
    0,
    true
  ),

  -- 15. Carbon monoxide exposure simulating live-high-train-low
  (
    '41527186',
    'Effect of live-high, train-low strategy induced by chronic low-dose carbon monoxide exposure on haematological parameters and performance in trained individuals.',
    'Villanova S, Porcelli S, Ekström L, Cardinale DA',
    'Experimental physiology',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/41527186/',
    array['Altitude', 'Training Methodology'],
    'Eight well-trained individuals completed a randomized crossover study comparing 4 weeks of daily low-dose carbon monoxide inhalation at sea level against a control period with ambient air. The CO group showed significant increases in hemoglobin mass, red blood cell volume, and blood volume compared to the control condition. However, muscle oxidative capacity and performance metrics remained unchanged, suggesting that the hematological gains did not translate to functional improvements in this timeframe.',
    'Low-dose CO inhalation can mimic some altitude adaptations at sea level, but the performance translation is not guaranteed. This is an emerging area of interest for athletes who cannot access altitude facilities. The hematological response is real, but coaches should not expect automatic performance gains. More research is needed before this becomes a recommended practice.',
    'Novel randomized crossover design with a strong control condition. The dissociation between hematological gains and performance is the key cautionary finding, echoing the altitude camp data from other recent studies.',
    3,
    4,
    4,
    3,
    3,
    2,
    2,
    2,
    3,
    1,
    true
  ),

  -- ===== BRAIN & NEUROSCIENCE =====

  -- 16. Brain oxygenation adaptations from endurance training
  (
    '41343066',
    'Endurance training induces asymmetric brain oxygenation adaptations in the left and right prefrontal cortex during submaximal exercise.',
    'Loukas I, Koskolou M, Bogdanis G, Geladas N',
    'European journal of applied physiology',
    2025,
    'https://pubmed.ncbi.nlm.nih.gov/41343066/',
    array['Training Methodology', 'VO2max'],
    'Sixteen male distance runners trained five times per week for eight weeks with a mix of high-intensity intervals and continuous sessions. After training, VO2max increased in both running and cycling. Near-infrared spectroscopy revealed that blood volume redistributed from working muscles to the brain during submaximal exercise, with increased oxyhemoglobin and total hemoglobin in both prefrontal regions. However, tissue saturation decreased in the left prefrontal cortex but not the right, suggesting asymmetric brain adaptations to endurance training.',
    'Endurance training does not just adapt muscles and the cardiovascular system. It also reshapes how the brain receives oxygen during exercise. The asymmetric response between left and right prefrontal cortex suggests these brain regions play different roles in regulating exercise tolerance. This may have implications for mental fatigue management and pacing strategies.',
    'Fascinating neuroscience angle on endurance training. The redistribution of blood volume from muscle to brain post-training is counterintuitive and opens new questions about central regulation of exercise performance.',
    4,
    4,
    4,
    4,
    4,
    2,
    2,
    2,
    2,
    2,
    true
  ),

  -- ===== SPEED SKATING =====

  -- 17. HIIT vs MICT slide-board training in young speed skaters
  (
    '41758881',
    'Effects of slide-board-based high-intensity interval versus moderate-intensity continuous training on aerobic and anaerobic capacity in young speed skaters.',
    'Zhang K, Qi J, Shi P, Xue X, Liu Y',
    'PLoS one',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/41758881/',
    array['Training Methodology', 'VO2max'],
    'Twenty-seven youth speed skaters were randomly assigned to three slide-board training groups for 4 weeks: two high-intensity interval protocols (3-min work/2-min rest and 4-min work/1-min rest) and one moderate-intensity continuous protocol. Both HIIT groups significantly improved VO2max, peak power, and mean power while reducing fatigue index. The moderate-intensity group showed no significant changes in any variable. The 4+1 structure appeared better for explosive power while the 3+2 structure enhanced fatigue resistance.',
    'HIIT on a slide board is effective for developing both aerobic and anaerobic capacity in just 4 weeks. The specific work-rest ratio matters: longer work intervals suit sprint-oriented skaters, while more recovery time benefits distance skaters. Moderate-intensity continuous training alone is insufficient for meaningful short-term physiological adaptation in already-trained youth athletes.',
    'Clean RCT design with three groups. Directly applicable to speed skating coaches but the HIIT principles transfer to any endurance sport using sport-specific simulators for off-season training.',
    2,
    3,
    3,
    2,
    2,
    1,
    1,
    5,
    2,
    1,
    true
  ),

  -- ===== SUPPLEMENTATION =====

  -- 18. Coffee cherry extract improves cycling time trial
  (
    '42234539',
    'An extract from whole Coffea arabica cherry improves time trial performance, but not muscle glycogen resynthesis, in trained cyclists.',
    'Pavis GF, Kingma RL, Nemzer BV, Abshiru N, Wall BT, Stephens FB',
    'Journal of the International Society of Sports Nutrition',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42234539/',
    array['Supplementation', 'Cycling Performance', 'Fueling & Nutrition'],
    'Twelve trained cyclists completed a double-blind crossover trial comparing a whole coffee cherry extract containing 200 mg caffeine and 15 mg polyphenols against placebo. The extract improved 15-minute time trial performance by 4.6 percent and lowered perceived exertion during steady-state exercise. Plasma caffeine and chlorogenic acid concentrations increased as expected. However, muscle glycogen resynthesis rates were identical between conditions when athletes consumed carbohydrate during recovery.',
    'A low-dose caffeine supplement from whole coffee cherry can meaningfully improve cycling time trial output and reduce perceived effort. The 200 mg caffeine dose is moderate and well-tolerated. However, do not rely on coffee cherry extract to speed glycogen recovery. Carbohydrate intake remains the primary driver of post-exercise glycogen restoration.',
    'Well-designed crossover trial with muscle biopsies. The 4.6 percent time trial improvement is substantial and practically meaningful. The null result on glycogen resynthesis is equally important and prevents over-claiming.',
    3,
    5,
    4,
    3,
    5,
    2,
    2,
    2,
    2,
    1,
    true
  ),

  -- 19. Beta-alanine and plyometric training in swimmers
  (
    '42218755',
    'Selected immunoendocrine and performance adaptations to upper-body plyometric training and beta-alanine supplementation in male swimmers.',
    'Gao H, Yu X, Guo Z',
    'Journal of the International Society of Sports Nutrition',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/42218755/',
    array['Supplementation', 'Strength Training'],
    'Thirty trained male swimmers were randomized into three groups: plyometric training plus beta-alanine, plyometric training plus placebo, or control. After eight weeks, both plyometric groups improved medicine ball throw, push-up endurance, bench press strength, swim ergometer power, and 50 to 200 meter freestyle times. Beta-alanine supplementation amplified the training-induced improvements and promoted a more favorable testosterone-to-cortisol ratio and immunoglobulin A response.',
    'Upper-body plyometric training is an effective dryland strategy for swimmers seeking to improve power and race performance across sprint and middle distances. Adding beta-alanine supplementation provides an additive benefit beyond plyometrics alone. The immunoendocrine improvements suggest beta-alanine may help swimmers tolerate higher training loads without immunosuppression.',
    'Rare RCT combining dry-land plyometrics with supplementation in competitive swimmers. The additive effect of beta-alanine on both performance and immune markers is a strong practical finding.',
    2,
    2,
    4,
    2,
    2,
    5,
    2,
    1,
    1,
    1,
    true
  ),

  -- ===== GUT MICROBIOME & CROSS-TRAINING =====

  -- 20. Resistance training reshapes the gut microbiome
  (
    '41834018',
    'Resistance Training Reshapes the Gut Microbiome in a Longitudinal 8-Week Intervention in Sedentary Adults.',
    'Straub D, Englert T, Beller A, Stadelmaier J, Stahl M, Kilian J, Borzym J, Rotermund C, Akbuğa-Schön T, Krakau S, Czemmel S, Weiler S, Pettenkofer M, Pettenkofer J, Maser U, Dammeier S, Nieß AM, Enderle MD, Nahnsen S',
    'Sports medicine - open',
    2026,
    'https://pubmed.ncbi.nlm.nih.gov/41834018/',
    array['Recovery', 'Fueling & Nutrition'],
    'One hundred fifty sedentary adults completed an 8-week supervised resistance training program with fecal sampling for microbiome analysis. While no group-level diversity changes were observed, within-individual microbial community changes significantly correlated with strength improvement. Participants with the greatest strength gains showed enrichment of Faecalibacterium and Roseburia hominis, both associated with anti-inflammatory and healthier gut profiles. These shifts mirror changes previously seen only with endurance training.',
    'Strength training can reshape the gut microbiome in ways similar to endurance training, but the effect scales with how much an individual actually adapts. For endurance athletes adding strength work, the gut health benefits may compound with their existing aerobic training effects. This supports the case for concurrent training from a microbiome health perspective.',
    'Largest resistance training microbiome study to date with 150 participants. The correlation between strength gains and microbiome shifts is the key novel finding, suggesting the gut responds to the adaptation signal, not just the exercise itself.',
    3,
    3,
    3,
    3,
    3,
    2,
    2,
    2,
    2,
    2,
    true
  )
on conflict (pubmed_id) do nothing;
