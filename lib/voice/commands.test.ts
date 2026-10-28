import { describe, expect, it } from "vitest";
import { matchCommand, parseUtterance } from "./commands";

const hear = (transcript: string) => {
  const { woke, text } = parseUtterance(transcript);
  return woke ? matchCommand(text) : "no wake word";
};

describe("voice commands", () => {
  it.each([
    ["Lens, scan the energy dossier", { id: "scan-file", arg: "energy-dossier" }],
    ["lens analyse the transcript", { id: "scan-file", arg: "transcript-a" }],
    ["Lens check the code", { id: "scan-file", arg: "code" }],
    ["Lens decode the machine ID", { id: "decode" }],
    ["Lens show the energy graph", { id: "show-energy" }],
    ["Lens show the spike", { id: "show-spike" }],
    ["Lens zoom in", { id: "zoom-in" }],
    ["Lens zoom out", { id: "zoom-out" }],
    ["Lens reset zoom", { id: "reset-zoom" }],
    ["Lens next file", { id: "next-file" }],
    ["Lens previous file", { id: "previous-file" }],
    ["Lens next page", { id: "next-page" }],
    ["Lens what did you find", { id: "summarise" }],
    ["Lens summarise the case", { id: "summarise" }],
    ["Lens pin that", { id: "pin" }],
    ["Lens pin it to the board", { id: "pin" }],
    ["Lens open the map", { id: "navigate", arg: "/map" }],
    ["Lens open the board", { id: "navigate", arg: "/board" }],
    ["Lens go home", { id: "navigate", arg: "/" }],
    ["Lens read the note from Nano", { id: "read-file", arg: "nano-note" }],
    ["Lens read the suspension notice", { id: "read-file", arg: "suspension-notice" }],
    ["Lens stop", { id: "stop" }],
    ["Lens, quiet", { id: "stop" }],
    ["Lens close lens", { id: "sleep" }],
    ["Lens go to sleep", { id: "sleep" }],
    ["Lenz scan the asset report", { id: "scan-file", arg: "asset-report" }],
  ])("%s", (transcript, expected) => expect(hear(transcript)).toEqual(expected));

  it("needs the wake word", () => expect(hear("scan the energy dossier")).toBe("no wake word"));
  it("returns null for unknown commands", () => expect(hear("Lens make me a sandwich")).toBeNull());
  it("wake word alone opens the window", () => expect(parseUtterance("Lens")).toEqual({ woke: true, text: "" }));
});
