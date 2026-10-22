// currentExp is the remainder at the user's current game level. Include the
// thresholds already spent on earlier levels when displaying lifetime EXP.
export const totalExperience = (user: {
  level: number;
  currentExp: number;
}): number => user.currentExp + 500 * user.level * (user.level - 1);
