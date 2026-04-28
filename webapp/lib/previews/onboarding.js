function isoDaysFromToday(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

const raceCatalog = [
  {
    id: 'race-demo-1',
    name: 'Leadville 100',
    event_date: isoDaysFromToday(112).slice(0, 10),
    distance_miles: 100,
    sport_type: 'Ultrarunner',
    city: 'Leadville',
    state: 'CO',
    country: 'USA',
  },
  {
    id: 'race-demo-2',
    name: 'Javelina 100K',
    event_date: isoDaysFromToday(168).slice(0, 10),
    distance_miles: 62.1,
    sport_type: 'Trail Runner',
    city: 'Fountain Hills',
    state: 'AZ',
    country: 'USA',
  },
  {
    id: 'race-demo-3',
    name: 'Black Canyon 100K',
    event_date: isoDaysFromToday(73).slice(0, 10),
    distance_miles: 62.1,
    sport_type: 'Ultrarunner',
    city: 'Black Canyon City',
    state: 'AZ',
    country: 'USA',
  },
];

const onboardingPreview = {
  step: 1,
  stravaName: 'Maya Chen',
  catalogQuery: 'Lead',
  catalogResults: raceCatalog.filter((race) => race.name.toLowerCase().includes('lead')),
  raceCatalog,
  form: {
    target_race_id: '',
    target_race: {
      name: 'Leadville 100',
      event_date: isoDaysFromToday(112).slice(0, 10),
      distance_miles: 100,
      location: 'Leadville, CO',
      race_type: 'Mountain Ultra',
    },
    primary_sports: ['Ultrarunner', 'Trail Runner'],
    years_racing_band: '4-6',
    weekly_training_hours_band: '12-16',
    home_elevation_ft: '5400',
  },
};

export function getOnboardingPreview(previewKey = 'onboarding-demo') {
  if (previewKey === 'onboarding-demo') {
    return {
      key: 'onboarding-demo',
      label: 'Onboarding Demo',
      ...onboardingPreview,
    };
  }

  return null;
}
