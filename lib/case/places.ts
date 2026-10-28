import { caseMeta } from "./data";

// Places on the nuxEland map. Wenoti Arcade is from the case; every other name is
// flavour the team chose for the map (see "Our storyline" in CLAUDE.md), not evidence.

export type PlaceKind = "arcade" | "fun-zone";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Street address, when the case gives one. */
  address?: string;
}

export const places = [
  { id: "wenoti", name: caseMeta.arcade, kind: "arcade", address: caseMeta.address },
  { id: "twin-tokens", name: "Twin Tokens Arcade", kind: "arcade" },
  { id: "joystick-junction", name: "Joystick Junction", kind: "arcade" },
  { id: "high-score-hall", name: "High Score Hall", kind: "arcade" },
  { id: "claw-cove", name: "Claw Machine Cove", kind: "arcade" },
  { id: "coin-op-corner", name: "Coin-Op Corner", kind: "arcade" },
  { id: "continue-cafe", name: "Continue? Café", kind: "fun-zone" },
  { id: "8-bit-bazaar", name: "8-Bit Bazaar", kind: "arcade" },
  { id: "respawn", name: "Respawn Arcade", kind: "arcade" },
  { id: "power-up-parlour", name: "Power-Up Parlour", kind: "arcade" },
  { id: "glitch-gardens", name: "Glitch Gardens", kind: "fun-zone" },
  { id: "laser-lagoon", name: "Laser Lagoon", kind: "fun-zone" },
  { id: "neon-funhouse", name: "Neon Grid Funhouse", kind: "fun-zone" },
  { id: "turbo-kart", name: "Turbo Kart Arena", kind: "fun-zone" },
  { id: "bitwave-bowl", name: "Bitwave Bowl", kind: "fun-zone" },
  { id: "lucky-lanes", name: "Lucky Token Lanes", kind: "fun-zone" },
  { id: "starcade", name: "Starcade", kind: "arcade" },
  { id: "boss-level", name: "Boss Level Tower", kind: "arcade" },
  { id: "combo-carnival", name: "Combo Carnival", kind: "fun-zone" },
] as const satisfies readonly Place[];

export type PlaceId = (typeof places)[number]["id"];

export function getPlace(id: PlaceId): Place {
  return places.find((p) => p.id === id)!;
}
