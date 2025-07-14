class Team {
  constructor(nuselo_team_id, data, playerMap = {}) {
    this.nuselo_team_id = nuselo_team_id;
    this.team_name = data.team_name || 'Team';
    this.end_date = data.end_date;
    this.roster = data.roster || [];
    this.totalPoints = 0;
    this.penalty = 0;
    this.penaltyPercent = 0;

    this.players = this.roster.map((id) => playerMap[id]).filter(Boolean);
  }

  // Calculate total points for the team (constituting player totalPoints)
  // When a team has players of heavily varying points, a punishment is applied to reduce the total number of points within the team.
  // This variance would indicate that while the teams points have greatly risen, its not indicative of the rosters acocmplishments as logically a majority of players would also have these points
  calculateTotalPoints() {
    // Apply potential adjustments based on eseaPoints comparison
    const players = this.players;

    players.forEach((player, idx) => {
      const { eventPoints = 0, ukicPoints = 0, eseaPoints = 0, totalPoints = 0 } = player;

      if (eventPoints === 0 || ukicPoints === 0) {
        // Some players joining teams will have potentially not played in UKCS previously
        // For this, player total will be slightly adjusted, pulling from a nerfed point pool of the median value of the team
        // Exclude the current player and sort others by eseaPoints descending
        const otherPlayers = players.filter((_, i) => i !== idx);
        const sortedByEsea = otherPlayers
          .filter(p => p.eseaPoints !== undefined)
          .sort((a, b) => b.eseaPoints - a.eseaPoints);

        if (sortedByEsea.length >= 2) {
          const secondTop = sortedByEsea[1]; // 2nd top ESEA points (excluding self)
          const tolerance = secondTop.eseaPoints * 0.15;

          if (
            eseaPoints >= (secondTop.eseaPoints - tolerance) &&
            eseaPoints <= (secondTop.eseaPoints + tolerance)
          ) {
            const potentialPoints = secondTop.totalPoints * 0.8;

            if (potentialPoints > totalPoints) {
              player.totalPoints = potentialPoints;
            }
          }
        }
      }
    });

    // Recalculate total points after adjustments
    const points = players.map((player) => player.totalPoints || 0);
    const sum = points.reduce((a, b) => a + b, 0);
    if (points.length === 0 || sum === 0) return 0;

    const mean = sum / points.length;
    const variance =
      points.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      points.length;
    const stdev = Math.sqrt(variance);

    const penalty = Math.pow(stdev / sum, 2.5) * sum;
    this.penalty = penalty;
    this.penaltyPercent = (penalty / sum) * 100;

    return sum - penalty;
  }
}

module.exports = Team;
