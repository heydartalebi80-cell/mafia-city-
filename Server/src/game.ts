
export type Role =
  | "mafia"
  | "doctor"
  | "detective"
  | "citizen";

export type GamePhase =
  | "lobby"
  | "night"
  | "day"
  | "finished";

export interface Player {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
}

export interface GameState {
  players: Player[];
  phase: GamePhase;
  round: number;
  votes: Record<string, string>;
  mafiaTarget: string | null;
  protectedPlayer: string | null;
  detectiveTarget: string | null;
  winner: "mafia" | "citizens" | null;
}

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

export function createGame(
  players: { id: string; name: string }[]
): GameState {
  if (players.length !== 12) {
    throw new Error("Exactly 12 players are required");
  }

  if (new Set(players.map(p => p.id)).size !== 12) {
    throw new Error("Duplicate player IDs");
  }

  const roles: Role[] = [
    "mafia", "mafia", "mafia",
    "doctor", "detective",
    "citizen", "citizen", "citizen",
    "citizen", "citizen", "citizen",
    "citizen"
  ];

  const assignedRoles = shuffle(roles);

  return {
    players: players.map((player, index) => ({
      id: player.id,
      name: player.name,
      role: assignedRoles[index],
      alive: true
    })),
    phase: "night",
    round: 1,
    votes: {},
    mafiaTarget: null,
    protectedPlayer: null,
    detectiveTarget: null,
    winner: null
  };
}

export function getPublicPlayers(game: GameState) {
  return game.players.map(player => ({
    id: player.id,
    name: player.name,
    alive: player.alive
  }));
}

export function getPlayerRole(
  game: GameState,
  playerId: string
): Role | null {
  const player = game.players.find(p => p.id === playerId);
  return player?.role ?? null;
}

function checkWinner(game: GameState) {
  const alive = game.players.filter(p => p.alive);
  const mafia = alive.filter(p => p.role === "mafia").length;
  const citizens = alive.length - mafia;

  if (mafia === 0) {
    game.winner = "citizens";
    game.phase = "finished";
  } else if (mafia >= citizens) {
    game.winner = "mafia";
    game.phase = "finished";
  }
}

export function submitNightAction(
  game: GameState,
  playerId: string,
  targetId: string
): boolean {
  if (game.phase !== "night") return false;

  const player = game.players.find(p => p.id === playerId);
  const target = game.players.find(p => p.id === targetId);

  if (!player || !player.alive || !target || !target.alive) {
    return false;
  }

  if (player.id === target.id) return false;

  if (player.role === "mafia") {
    if (target.role === "mafia") return false;
    game.mafiaTarget = targetId;
    return true;
  }

  if (player.role === "doctor") {
    game.protectedPlayer = targetId;
    return true;
  }

  if (player.role === "detective") {
    game.detectiveTarget = targetId;
    return true;
  }

  return false;
}

export function resolveNight(game: GameState) {
  if (game.phase !== "night") {
    throw new Error("It is not night");
  }

  const target = game.mafiaTarget;
  const protectedId = game.protectedPlayer;

  let eliminated: string | null = null;

  if (target && target !== protectedId) {
    const victim = game.players.find(p => p.id === target);

    if (victim?.alive) {
      victim.alive = false;
      eliminated = victim.id;
    }
  }

  const investigated = game.detectiveTarget
    ? game.players.find(p => p.id === game.detectiveTarget)
    : null;

  const detectiveResult = investigated
    ? investigated.role === "mafia"
    : null;

  game.mafiaTarget = null;
  game.protectedPlayer = null;
  game.detectiveTarget = null;
  game.votes = {};

  checkWinner(game);

  if (game.winner === null) {
    game.phase = "day";
  }

  return {
    eliminated,
    detectiveResult
  };
}

export function castVote(
  game: GameState,
  voterId: string,
  targetId: string
): boolean {
  if (game.phase !== "day") return false;

  const voter = game.players.find(p => p.id === voterId);
  const target = game.players.find(p => p.id === targetId);

  if (!voter?.alive || !target?.alive) return false;
  if (voterId === targetId) return false;

  game.votes[voterId] = targetId;
  return true;
}

export function resolveDayVote(game: GameState) {
  if (game.phase !== "day") {
    throw new Error("It is not day");
  }

  const counts: Record<string, number> = {};

  for (const targetId of Object.values(game.votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }

  const maxVotes = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter(
    id => counts[id] === maxVotes
  );

  let eliminated: string | null = null;

  if (leaders.length === 1 && maxVotes > 0) {
    const victim = game.players.find(p => p.id === leaders[0]);

    if (victim?.alive) {
      victim.alive = false;
      eliminated = victim.id;
    }
  }

  game.votes = {};
  checkWinner(game);

  if (game.winner === null) {
    game.phase = "night";
    game.round++;
  }

  return { eliminated, winner: game.winner };
}
