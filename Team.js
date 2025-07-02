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
    const points = this.players.map((player) => player.totalPoints || 0);
    const sum = points.reduce((a, b) => a + b, 0);
    if (points.length === 0 || sum === 0) return 0;


    const mean = sum / points.length;
    const variance =
      points.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      points.length;
    const stdev = Math.sqrt(variance);

    // Penalty applied for team points variance
    const penalty = Math.pow(stdev / sum, 2.5) * sum;
    this.penalty = penalty;
    this.penaltyPercent = (penalty / sum) * 100;
    return sum - penalty;
  }
}

module.exports = Team;
