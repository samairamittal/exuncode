// eXunTrace content, transcribed from design/exuntrace.png (copy kept as drawn).
import type { PlaceId } from "@/lib/case";

export type MarkerKind = "sighting" | "outage" | "target";

export const legend: { kind: MarkerKind; label: string }[] = [
  { kind: "sighting", label: "POI-1 latest spotting" },
  { kind: "outage", label: "Latest outage" },
  { kind: "target", label: "Predicted targets" },
];

/** Marker centres in map px (the map image is 476×430), and the place each one marks. */
export const markers: { kind: MarkerKind; x: number; y: number; place: PlaceId }[] = [
  { kind: "outage", x: 181.5, y: 100.5, place: "starcade" },
  { kind: "outage", x: 394.5, y: 100.5, place: "high-score-hall" },
  { kind: "outage", x: 347.5, y: 392.5, place: "joystick-junction" },
  { kind: "sighting", x: 294.5, y: 216.5, place: "wenoti" },
  { kind: "target", x: 115.5, y: 238.5, place: "boss-level" },
  { kind: "target", x: 85.5, y: 330.5, place: "respawn" },
];

export const markerColor: Record<MarkerKind, string> = {
  sighting: "bg-snow",
  outage: "bg-(--marker-outage)",
  target: "bg-exun-blue",
};

export const markerLabel: Record<MarkerKind, string> = {
  sighting: "POI-1 latest spotting",
  outage: "Latest outage",
  target: "Predicted target",
};

/** Tracker status of a place, if it has a marker. */
export function placeStatus(place: PlaceId): MarkerKind | undefined {
  return markers.find((m) => m.place === place)?.kind;
}

/** The place each city building sprite shows (index into cityLayers.buildings). */
export const cityPlaces: PlaceId[] = [
  "twin-tokens",
  "joystick-junction",
  "high-score-hall",
  "claw-cove",
  "coin-op-corner",
  "continue-cafe",
  "8-bit-bazaar",
  "respawn",
  "power-up-parlour",
  "glitch-gardens",
  "laser-lagoon",
  "neon-funhouse",
  "turbo-kart",
  "wenoti", // the big building in the centre
  "bitwave-bowl",
  "lucky-lanes",
  "starcade",
  "boss-level",
  "combo-carnival",
];

export const mapSize = { width: 476, height: 430 };

export const spreadLevel = 45;

export const sightingSteps = [1, 2, 3];

export const timeline: { date: string; note: string }[] = [
  { date: "23rd October", note: "POI-1 spotted at Wenoti arcade by Agent Nano and Agent Mega" },
  { date: "24th October", note: "Daily usage differed from meter readiing" },
  { date: "25th October", note: "Daily usage slowly becoming stablized." },
  { date: "26th October", note: "Daily usage slowly becoming stablized." },
  { date: "27th October", note: "-(TBD)" },
];
