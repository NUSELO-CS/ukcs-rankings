const ukicPointsDist = require('./values/ukic.json');
const eseaPointsDist = require('./values/esea.json');

function parseFraction(str) {
  if (!str) return [null, null];
  const parts = str.split('/');
  if (parts.length !== 2) return [null, null];
  const num1 = Number(parts[0]);
  const num2 = Number(parts[1]);
  if (isNaN(num1) || isNaN(num2)) return [null, null];
  return [num1, num2];
}

function parseDash(str) {
  if (!str) return [null, null];
  const parts = str.split('-');
  if (parts.length !== 2) return [null, null];
  const num1 = Number(parts[0]);
  const num2 = Number(parts[1]);
  if (isNaN(num1) || isNaN(num2)) return [null, null];
  return [num1, num2];
}

function calcUKICPoints(seasonRows) {
  let maxPoints = 0;
  // UKIC Points are calculated on a per-season basis for later weighting.
  // Points are awarded at both a base stage and then performance based.
  // Base points are awarded depending on the division a team was competing in.
  // Variable points are awarded depending on performance within that division, enabling overlap with a higher division.

  for (const row of seasonRows) {
    const division = row.division;
    const ukicConfig = ukicPointsDist[division];
    if (!ukicConfig) continue;

    const { base_points, variable_points } = ukicConfig;

    const [placement, totalTeams] = parseFraction(row.placement); // ukic placements are sent as (placement(provisional if in season))/(total teams) 

    let points = base_points;

    if (placement !== null && totalTeams !== null && totalTeams > 0) {
      points +=
        variable_points * Math.pow((totalTeams - placement) / totalTeams, 1.67); // raise variable points to a power of 1.67 to exaggerate gaps between teams of varying variable points
    } else {
      points += 0;
    }

    if (points > maxPoints) {
      maxPoints = points;
    }
  }

  const ukicPoints = Math.pow(maxPoints, 1.3);

  return ukicPoints;
}

function calcESEAPoints(current, prev, prev2, relPeriod) {
  let maxPoints = 0;
  let peakPoints = 0;
  //// could definitely tidy this sectuon up due to repetition
  // ESEA points are calculated from a players performance across multiple previous seasons
  // Points are awarded at both a base stage and then performance based within that division.
  // Base points are again awarded depending on the division
  // Variable points (in this case win points) are awarded depending on how many wins that team got during the regular season
  for (const row of current) {
    const division = row.division;
    const eseaConfig = eseaPointsDist[division];
    if (!eseaConfig) continue;

    const { base_points, win_points } = eseaConfig;

    let cappedWins;
    const [wins, losses] = parseDash(row.record); // esea records are sent as {wins}-{losses}

    if (wins > 14) {
      cappedWins = 14; // cap wins values as FACEIT reports some of the older seasons incorrectly with >20 wins
    } else {
      cappedWins = wins;
    }
    cappedWins = Math.min(cappedWins - 4, 0);
    let points = base_points + cappedWins * win_points;
    if (points > maxPoints) {
      maxPoints = points;
    }
  }

  for (const row of prev) {
    const division = row.division;
    const eseaConfig = eseaPointsDist[division];
    if (!eseaConfig) continue;

    const { base_points, win_points } = eseaConfig;

    let cappedWins;
    const [wins, losses] = parseDash(row.record);

    if (wins > 14) {
      cappedWins = 14;
    } else {
      cappedWins = wins;
    }
    cappedWins = Math.min(cappedWins - 4, 0);
    let points = (base_points + cappedWins * win_points) * 0.75; // apply a punishment on the previous season's points to 75% of original value
    if (points > maxPoints) {
      maxPoints = points;
    }
  }

  for (const row of prev2) {
    const division = row.division;
    const eseaConfig = eseaPointsDist[division];
    if (!eseaConfig) continue;

    const { base_points, win_points } = eseaConfig;

    let cappedWins;
    const [wins, losses] = parseDash(row.record);

    if (wins > 14) {
      cappedWins = 14;
    } else {
      cappedWins = wins;
    }
    cappedWins = Math.min(cappedWins - 4, 0);
    let points = (base_points + cappedWins * win_points) * 0.5; // apply a punishment on the previous season's points to 50% of original value
    if (points > maxPoints) {
      maxPoints = points;
    }
  }

  // For a relevant snapshot of the players history within ESEA, the peak points are calculated for a player without applying a decay punishment.
  // This is then used to comapre against the players more recent snapshot's performance to apply a harsher decay factor if the player is now competing at a lower level
  // This originally was used on an average of relevant period season points and not peak. This may need to be changed
  for (const row of relPeriod) {
    const division = row.division;
    const eseaConfig = eseaPointsDist[division];
    if (!eseaConfig) continue;

    const { base_points, win_points } = eseaConfig;

    let cappedWins;
    const [wins, losses] = parseDash(row.record);

    if (wins > 14) {
      cappedWins = 14;
    } else {
      cappedWins = wins;
    }
    let points = (base_points + wins * win_points); // calculate the peak points a player earned (without decay in the past 5 seasons)
    if (points > peakPoints) {
      peakPoints = points;
    }
  }
  const ratio = maxPoints / peakPoints; //get a ratio of what the players current ESEA points are compared to the undecayed peak. This then will produce a modifier in which the players eseaPoints are further punished by
  const modifier = Math.pow(Math.min(Math.max(ratio, 0), 1), 0.66);

  const eseaPointsPre = maxPoints * modifier;

  const eseaPoints = Math.pow(eseaPointsPre, 1.5); // raise final eseaPoints to power of 1.5 to exaggerate differences.

  return eseaPoints;
}

async function calculateLeaguePoints(players, seasonData) {
  const currentUKICSeason = seasonData['UKIC'];
  const currentESEASeason = seasonData['ESEA'];

  for (const [steam_id, player] of Object.entries(players)) {
    const ukicAll = player.ukic || [];
    const eseaAll = player.esea || [];

    const recentUKICSeasons = [currentUKICSeason, currentUKICSeason - 1];
    const recentESEASeasons = [
      currentESEASeason,
      currentESEASeason - 1,
      currentESEASeason - 2,
    ];

    // Filter UKIC and ESEA to their relevant periods
    const ukicRecent = ukicAll.filter((row) =>
      recentUKICSeasons.includes(Number(row.season))
    );
    const eseaRecent = eseaAll.filter((row) =>
      recentESEASeasons.includes(Number(row.season))
    );

    // Split seasons in to separate rows.
    const currentUKICSeasonRows = ukicRecent.filter(
      (row) => Number(row.season) === currentUKICSeason
    );
    const previousUKICSeasonRows = ukicRecent.filter(
      (row) => Number(row.season) === currentUKICSeason - 1
    );

    const currentESEASeasonRows = eseaRecent.filter(
      (row) => Number(row.season) === currentESEASeason
    );
    const previousESEASeasonRows = eseaRecent.filter(
      (row) => Number(row.season) === currentESEASeason - 1
    );
    const previousESEASeason2Rows = eseaRecent.filter(
      (row) => Number(row.season) === currentESEASeason - 2
    );
    const ESEARelPeriodRows = eseaRecent.filter(
      (row) => Number(row.season) > currentESEASeason - 6
    );
    // Calculate UKIC points
    // Calculate points for each relevant season
    const currentUKICPoints = calcUKICPoints(currentUKICSeasonRows);
    const previousUKICPoints = calcUKICPoints(previousUKICSeasonRows);

    // Weighted combine of the previous 2 UKIC seasons
    let ukicPoints = 0;
    if (currentUKICPoints > 0 && previousUKICPoints > 0) {
      ukicPoints = 0.7 * currentUKICPoints + 0.3 * previousUKICPoints;
    } else if (currentUKICPoints > 0) {
      ukicPoints = 0.8 * currentUKICPoints;
    } else if (previousUKICPoints > 0) {
      ukicPoints = 0.3 * previousUKICPoints;
    }

    //Calculate esea points

    let eseaPoints = calcESEAPoints(
      currentESEASeasonRows,
      previousESEASeasonRows,
      previousESEASeason2Rows,
      ESEARelPeriodRows
    );

    if (isNaN(eseaPoints)) eseaPoints = 0;

    player.ukicPoints = ukicPoints;
    player.eseaPoints = eseaPoints;
    player.leaguePoints = eseaPoints + ukicPoints;
  }

  return players;
}

module.exports = { calculateLeaguePoints };
