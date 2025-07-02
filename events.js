const eventPointsDist = require('./values/event.json');

function calculateDecayWeight(endDate) {
  if (!endDate) {
    return 1;
  }
  const now = new Date();
  const eventEnd = new Date(endDate);
  const daysAgo = (now - eventEnd) / (1000 * 60 * 60 * 24);
  const maxDays = 365;
  let x = daysAgo / maxDays; // calculate ratio of event distance from current date
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  const y = Math.pow(x, 5 / 2); // put that ratio to a power of 5/2
  const weight = 1 - y;
  return Math.max(0, Math.min(1, weight));
}

async function calculateEventPoints(players) {
  // Event points are calculated by looking at player accomplishments in the past 12 months.
  // Points are determined via the tier of the event and the players placement in it then combined with the decay weight of that event.
  // More recent events are rated higher, with that weighting tailing off the further and event was a go.
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  for (const [steam_id, player] of Object.entries(players)) {
    const eventAll = player.events || [];
    const filteredEvents = eventAll.filter((event) => {
      if (!event.end_date) return true;
      const endDate = new Date(event.end_date);
      return endDate >= twelveMonthsAgo;
    });

    let totalPoints = 0;

    for (const event of filteredEvents) {
      const tier = event.tier;
      const placement = Number(event.placement);
      if (!tier || isNaN(placement)) continue;

      const tierArray = eventPointsDist[tier];
      if (!Array.isArray(tierArray)) continue;

      // Find the points for this placement
      const placementObj = tierArray.find((obj) => obj.placement === placement);
      if (!placementObj) continue;

      const points = placementObj.points;
      const weight = calculateDecayWeight(event.end_date);
      const weightedPoints = points * weight;
      event.weightedPoints = weightedPoints;
      totalPoints += weightedPoints;
    }

    player.eventPoints = totalPoints;
  }
  return players;
}

module.exports = { calculateEventPoints };
