class Player {
  constructor(steam_id, data) {
    this.steam_id = steam_id;
    this.player_name = data.player_name || 'JohnDoe';
    this.events = data.events || [];
    this.esea = data.esea || [];
    this.ukic = data.ukic || [];

    this.ukicPoints = 0;
    this.eseaPoints = 0;
    this.leaguePoints = 0;

    this.eventPoints = 0;

    this.totalPoints = 0;
  }
}

module.exports = Player;
