import { versionName, changelogEntries } from './changelog';

describe('version names', () => {
  test('versionCode turns into major.minor.patch', () => {
    expect(versionName(2100)).toBe('2.1.0');
    expect(versionName(2203)).toBe('2.2.3');
    expect(versionName(2215)).toBe('2.2.15');
    expect(versionName(10000)).toBe('10.0.0');
    expect(versionName(10912)).toBe('10.9.12');
  });
});

describe('changelog entries', () => {
  const raw = [
    { versionCode: 2201, text: 'Health trackers: past dates.' },
    { versionCode: 2203, text: '  Fixed the start page.\n' },
    { versionCode: 2100, text: 'First release.' },
  ];

  test('newest first, with version names and trimmed text', () => {
    const list = changelogEntries(raw, 2203);
    expect(list.map((e) => e.versionCode)).toEqual([2203, 2201, 2100]);
    expect(list[0]).toEqual({ versionCode: 2203, version: '2.2.3', text: 'Fixed the start page.', installed: true });
  });

  test('only the installed version is marked', () => {
    const list = changelogEntries(raw, 2201);
    expect(list.filter((e) => e.installed).map((e) => e.versionCode)).toEqual([2201]);
  });

  test('without a releaseCode nothing is marked', () => {
    expect(changelogEntries(raw).some((e) => e.installed)).toBe(false);
    expect(changelogEntries(raw, null).some((e) => e.installed)).toBe(false);
  });

  test('empty or missing input gives an empty list', () => {
    expect(changelogEntries([], 2203)).toEqual([]);
    expect(changelogEntries(undefined, 2203)).toEqual([]);
    expect(changelogEntries(null)).toEqual([]);
    expect(changelogEntries('2203.txt')).toEqual([]);
  });

  test('junk entries are dropped', () => {
    const list = changelogEntries(
      [
        null,
        'text',
        { versionCode: NaN, text: 'Not a number.' },
        { versionCode: '2202', text: 'Name as a string.' },
        { versionCode: 22.5, text: 'Not whole.' },
        { versionCode: -1, text: 'Negative.' },
        { versionCode: 2202, text: '   \n ' },
        { versionCode: 2202 },
        { text: 'No version.' },
        { versionCode: 2200, text: 'Kept.' },
      ],
      2200,
    );
    expect(list).toEqual([{ versionCode: 2200, version: '2.2.0', text: 'Kept.', installed: true }]);
  });
});
