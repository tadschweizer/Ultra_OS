import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVolumeTrend, compareVolumeBlocks, weekStartOf } from '../lib/volumeTrends.js';

// Wednesday, local time.
const now = new Date(2026, 8, 30, 12, 0, 0);

function activity(daysAgo, { miles = 5, minutes = 45, feet = 300 } = {}) {
  const date = new Date(now);
  date.setDate(now.getDate() - daysAgo);
  return {
    start_date: date.toISOString(),
    distance: miles * 1609.34,
    moving_time: minutes * 60,
    total_elevation_gain: feet / 3.28084,
  };
}

test('weeks start on Monday', () => {
  const start = weekStartOf(now);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 28);
});

test('buildVolumeTrend returns contiguous weeks including empty ones', () => {
  const trend = buildVolumeTrend([activity(0), activity(1, { miles: 10 }), activity(21)], { weeks: 6, now });
  assert.equal(trend.length, 6);
  const current = trend.at(-1);
  assert.equal(current.count, 2);
  assert.equal(current.miles, 15);
  assert.equal(current.longestMiles, 10);
  assert.equal(current.hours, 1.5);
  assert.equal(current.elevationFt, 600);
  assert.equal(trend.at(-2).count, 0);
  assert.equal(trend.at(-4).count, 1);
});

test('activities outside the window and invalid dates are ignored', () => {
  const trend = buildVolumeTrend([activity(200), { start_date: 'not-a-date', distance: 1000 }], { weeks: 4, now });
  assert.equal(trend.reduce((sum, week) => sum + week.count, 0), 0);
});

test('compareVolumeBlocks excludes the in-progress week and needs four prior weeks', () => {
  const recent = [7, 14, 21, 28].map((days) => activity(days, { miles: 12 }));
  const prior = [35, 42, 49, 56].map((days) => activity(days, { miles: 10 }));
  const trend = buildVolumeTrend([...recent, ...prior, activity(0, { miles: 50 })], { weeks: 12, now });
  const blocks = compareVolumeBlocks(trend);
  assert.equal(blocks.miles.recentAvg, 12);
  assert.equal(blocks.miles.priorAvg, 10);
  assert.equal(blocks.miles.changePct, 20);

  const short = compareVolumeBlocks(buildVolumeTrend(recent, { weeks: 6, now }));
  assert.equal(short.miles.changePct, null);
});
