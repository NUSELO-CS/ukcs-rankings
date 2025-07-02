const fs = require('fs');
const path = require('path');
const ukicPointsDist = require('./values/ukic.json');
const eseaPointsDist = require('./values/esea.json');

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '');
}

function formatDate(date) {
  // Format as YYYY-MM-DD
  return date instanceof Date
    ? date.toISOString().slice(0, 10)
    : String(date);
}

function getUkicBasePoints(division) {
  if (!division) return '-';
  const entry = ukicPointsDist[division];
  return entry ? entry.base_points : '-';
}

function getEseaBasePoints(division) {
  if (!division) return '-';
  const entry = eseaPointsDist[division];
  return entry ? entry.base_points : '-';
}

function generateReports(rankedTeams, players, date) {
  const dateStr = formatDate(date);
  const baseDir = path.join(__dirname, `./rankings/${dateStr}`);
  const teamsDir = path.join(baseDir, 'details');
  fs.mkdirSync(teamsDir, { recursive: true });

  // Team reports with player sections
  for (const team of rankedTeams) {
    const md = [
      `# Team: ${team.team_name}`,
      ``,
      `**Total Points:** ${team.totalPoints?.toFixed(2) ?? 0}`,
      `**Penalty applied:** ${team.penalty?.toFixed(2) ?? 0}`,
      `**Penalty percent:** ${team.penaltyPercent?.toFixed(2) ?? 0}%`,
      ``,
      `## Roster`,
      `| Player Name | League Points | Event Points | Total Points |`,
      `|-------------|--------------|--------------|-------------|`,
      ...team.players.map(p =>
        `| ${p.player_name} | ${p.leaguePoints?.toFixed(2) ?? 0} | ${p.eventPoints?.toFixed(2) ?? 0} | ${p.totalPoints?.toFixed(2) ?? 0} |`
      ),
      ``
    ];

    // Have a breakdown section for each player on the roster
    for (const player of team.players) {
      md.push(
        `---`,
        ``,
        `## ${player.player_name}`,
        ``,
        `**Total Points:** ${player.totalPoints?.toFixed(2) ?? 0}`,
        ``,
        `- League Points: ${player.leaguePoints?.toFixed(2) ?? 0}`,
        `  - UKIC Points: ${player.ukicPoints?.toFixed(2) ?? 0}`,
        `  - ESEA Points: ${player.eseaPoints?.toFixed(2) ?? 0}`,
        `- Event Points: ${player.eventPoints?.toFixed(2) ?? 0}`,
        ``,
        '### Events',
        '| Event | Date | Points |',
        '|-------|------|--------|',
        ...(player.events
          ?.slice()
          .sort((a, b) => {
            // Sort descending events
            const dateA = a.end_date ? new Date(a.end_date) : new Date(0);
            const dateB = b.end_date ? new Date(b.end_date) : new Date(0);
            return dateB - dateA;
          })
          .filter(e => e.weightedPoints && e.weightedPoints !== 0)
          .map(e =>
            `| ${e.name || e.event_name || 'Event'} | ${e.end_date ? new Date(e.end_date).toISOString().slice(0,10) : '-'} | ${e.weightedPoints.toFixed(2)} |`
          ) ?? []),
        '### Leagues',
        '| Season | Division | Base Points |',
        '|--------|----------|-------------|',
        ...(player.ukic
          ?.slice() 
          .sort((a, b) => (Number(b.season) || 0) - (Number(a.season) || 0))
          .map(u =>
            `| UKIC Season ${u.season ?? '-'} | ${u.division ?? '-'} | ${getUkicBasePoints(u.division)} |`
          ) ?? []),
        ...(player.esea
          ?.slice()
          .sort((a, b) => (Number(b.season) || 0) - (Number(a.season) || 0))
          .map(e =>
            `| ESEA Season ${e.season ?? '-'} | ${e.division ?? '-'} | ${getEseaBasePoints(e.division)} |`
          ) ?? []),
      );
    }

    fs.writeFileSync(path.join(teamsDir, `${sanitizeFilename(team.team_name)}.md`), md.join('\n'));
  }

  // Rankings summary 
  const rankingsMd = [
    `# Team Rankings (${dateStr})`,
    ``,
    `| Rank | Team Name | Roster | Points |`,
    `|------|-----------|--------|--------|`,
    ...rankedTeams.map((team, idx) =>
      `| ${idx + 1} | ${team.team_name} | ${team.players.map(p => p.player_name).join(', ')} | ${team.totalPoints?.toFixed(2) ?? 0} |`
    ),
    ``
  ].join('\n');
  fs.writeFileSync(path.join(baseDir, 'rankings.md'), rankingsMd);
}

module.exports = { generateReports };