
export const timeBonusPtSystem: Record<string, Record<number, { time: number; points: number }[]>> = {
  classic: {
    3: [
      { time: 2, points: 900 },
      { time: 4, points: 600 },
      { time: 6, points: 300 },
    ],
    5: [
      { time: 2, points: 900 },
      { time: 4, points: 700 },
      { time: 5, points: 500 },
      { time: 7, points: 300 },
      { time: 8, points: 100 },
    ],
    10: [
      { time: 1, points: 900 },
      { time: 2, points: 800 },
      { time: 3, points: 700 },
      { time: 4, points: 600 },
      { time: 5, points: 500 },
      { time: 6, points: 400 },
      { time: 7, points: 300 },
      { time: 8, points: 200 },
      { time: 9, points: 100 },
    ],
  },
};