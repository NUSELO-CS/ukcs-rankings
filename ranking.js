const { grabData } = require('../data_loader/grabData.js'); // data loading from the database is handled in a separate file, returning teams and players data
const { calculateLeaguePoints } = require('./league.js');
const { calculateEventPoints } = require('./events.js');
const { generateReports } = require('./report.js');
const Player = require('./Player.js');
const Team = require('./Team.js');

async function main(pool) {
  const date = new Date();
  const { teams, playersData, seasonData } = await grabData(pool);

  const players = {};
  for (const [steam_id, data] of Object.entries(playersData)) {
    players[steam_id] = new Player(steam_id, data);
  }

  const teamInstances = {};
  for (const [nuselo_team_id, data] of Object.entries(teams)) {
    teamInstances[nuselo_team_id] = new Team(nuselo_team_id, data, players); 
  }

  const seasonMap = {};
  for (const row of seasonData) {
    seasonMap[row.organizer] = Number(row.max || row.max_season || row.season); 
  }

  await calculateLeaguePoints(players, seasonMap);

  await calculateEventPoints(players);

  for (const player of Object.values(players)) {
    player.totalPoints = (player.leaguePoints ?? 0) + (player.eventPoints ?? 0);
  }

  for (const team of Object.values(teamInstances)) {
    team.totalPoints = team.calculateTotalPoints();
  }

  // Sort teams 
  const rankedTeams = Object.values(teamInstances)
    //.filter(team => team.totalPoints > 100)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  console.log('Completed');

  generateReports(rankedTeams, players, date);

  return { rankedTeams, players };
}

module.exports = { main };
