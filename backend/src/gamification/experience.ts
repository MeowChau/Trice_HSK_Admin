// The room's HSK level is authoritative; profile and client fields cannot boost awards.
export function pkExperienceMultiplier(hskLevel: number): number {
  if (!Number.isInteger(hskLevel) || hskLevel < 1 || hskLevel > 9) {
    throw new RangeError('Invalid PK HSK level.');
  }
  return 1 + (hskLevel - 1) * 0.25;
}

// currentExp is the remainder at the user's current game level. Include the
// thresholds already spent on earlier levels when displaying lifetime EXP.
export const totalExperience = (user: {
  level: number;
  currentExp: number;
}): number => user.currentExp + 500 * user.level * (user.level - 1);
