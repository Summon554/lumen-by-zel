export type Verse = { text: string; ref: string };

export const VERSES: Verse[] = [
  { text: "Your word is a lamp to my foot, and a light to my path.", ref: "Psalm 119:105" },
  { text: "Let your light shine before men, so that they may see your fine works.", ref: "Matthew 5:16" },
  { text: "Throw all your anxiety on him, because he cares for you.", ref: "1 Peter 5:7" },
  { text: "Keep encouraging one another and building one another up.", ref: "1 Thessalonians 5:11" },
  { text: "Hope in God, for I will yet praise him.", ref: "Psalm 42:5" },
  { text: "Do not be anxious over anything, but in everything by prayer make your petitions known.", ref: "Philippians 4:6" },
  { text: "A true friend shows love at all times.", ref: "Proverbs 17:17" },
  { text: "Be kind to one another, tenderly compassionate, freely forgiving.", ref: "Ephesians 4:32" },
  { text: "The joy of Jehovah is your stronghold.", ref: "Nehemiah 8:10" },
  { text: "Taste and see that Jehovah is good.", ref: "Psalm 34:8" },
  { text: "Love is patient and kind. It does not brag.", ref: "1 Corinthians 13:4" },
  { text: "Trust in Jehovah with all your heart, and do not rely on your own understanding.", ref: "Proverbs 3:5" },
  { text: "He heals the brokenhearted; he binds up their wounds.", ref: "Psalm 147:3" },
  { text: "Whatever you do, work at it whole-souled.", ref: "Colossians 3:23" },
];

/** Deterministic daily rotation — same verse for everyone, changes at midnight local time. */
export function verseOfTheDay(now: Date = new Date()): Verse {
  const day = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000,
  );
  return VERSES[((day % VERSES.length) + VERSES.length) % VERSES.length];
}
