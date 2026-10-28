"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FindingRecord } from "@/lib/data";
import { analyseFile, getLensFile, lensFiles } from "@/lib/lens";
import { lens, prefersReducedMotion } from "@/lib/motion";
import { bus } from "@/lib/events";
import { useInvestigator } from "@/lib/store";
import { useHandsFree } from "@/lib/store/handsfree";
import { speak as voiceSpeak, stopSpeaking } from "@/lib/voice/speak";

export type FileStatus = "new" | "scanning" | "done" | "pending";

export interface LensFinding extends FindingRecord {
  fileId: string;
}

interface LensSession {
  selectedId: string;
  /** File being scanned, and how far (0–1). */
  scanning: { id: string; progress: number } | null;
  statusOf: (id: string) => FileStatus;
  /** Every finding surfaced so far, most recently analysed file first. */
  findings: LensFinding[];
  analysedCount: number;
  voice: { line: string; speaking: boolean };
  muted: boolean;
  select: (id: string) => void;
  /** Next (1) or previous (-1) file in the queue. */
  step: (direction: 1 | -1) => void;
  /** LENS says a line: spoken (unless muted) and captioned in the status bar. */
  say: (line: string) => void;
  toggleMute: () => void;
}

const Context = createContext<LensSession | null>(null);

export function useLensSession(): LensSession {
  const session = useContext(Context);
  if (!session) throw new Error("useLensSession must be used inside <LensSessionProvider>");
  return session;
}

const scannable = lensFiles.filter((f) => f.caseFileIds.length);
const say = (f: FindingRecord | undefined) => (typeof f?.data.say === "string" ? f.data.say : undefined);

export function LensSessionProvider({ children }: { children: ReactNode }) {
  const stored = useInvestigator((s) => s.findings);
  const saveFindings = useInvestigator((s) => s.saveFindings);
  const markFileOpened = useInvestigator((s) => s.markFileOpened);
  const logActivity = useInvestigator((s) => s.logActivity);

  const [selectedId, setSelectedId] = useState("energy-dossier");
  const [scanning, setScanning] = useState<LensSession["scanning"]>(null);
  const [voice, setVoice] = useState({ line: `LENS ready. ${scannable.length} files to analyse.`, speaking: false });
  const [muted, setMuted] = useState(false);
  const frame = useRef(0);
  const quiet = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(quiet.current);
      stopSpeaking();
    },
    [],
  );

  // The greeting is voiced by lib/voice/robot.ts; caption it like any other line.
  useEffect(() => {
    const offs = [
      bus.on("lens:greet", ({ text }) => setVoice({ line: text, speaking: true })),
      bus.on("voice:done", ({ text }) => setVoice((v) => (v.line === text ? { ...v, speaking: false } : v))),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const analysed = useMemo(() => new Map(stored.filter((f) => getLensFile(f.fileId)).map((f) => [f.fileId, f])), [stored]);

  const findings = useMemo(
    () =>
      [...analysed.values()]
        .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
        .flatMap((f) => f.findings.map((finding) => ({ ...finding, fileId: f.fileId }))),
    [analysed],
  );

  const speak = useCallback(
    (line: string) => {
      clearTimeout(quiet.current);
      setVoice({ line, speaking: true });
      const done = () => setVoice((v) => (v.line === line ? { ...v, speaking: false } : v));
      if (!muted) {
        void voiceSpeak(line).then(done);
      } else {
        // Muted: LENS still "talks" (captions, waveform) for as long as the line takes to type.
        quiet.current = setTimeout(done, line.length * lens.typeStep * 1000 + 600);
      }
    },
    [muted],
  );

  const finish = useCallback(
    async (id: string) => {
      const file = getLensFile(id)!;
      const result = analyseFile(id);
      await saveFindings({ fileId: id, fileName: file.title, findings: result, analyzedAt: new Date().toISOString() });
      for (const caseFileId of file.caseFileIds) await markFileOpened(caseFileId);
      await logActivity({ type: "file:analyzed", message: `Analysed ${file.title}: ${result.length} findings` });
      setScanning(null);
      useHandsFree.setState({ thinking: false });
      speak(say(result.find((f) => f.severity === "critical") ?? result[0]) ?? `${file.title}: nothing found.`);
    },
    [logActivity, markFileOpened, saveFindings, speak],
  );

  const select = useCallback(
    (id: string) => {
      const file = getLensFile(id);
      if (!file || scanning) return;
      setSelectedId(id);
      if (!file.caseFileIds.length) {
        speak(`${file.title}: file not received yet.`);
        return;
      }
      if (analysed.has(id)) {
        const count = analysed.get(id)!.findings.length;
        speak(`${file.title}: ${count} ${count === 1 ? "finding" : "findings"} on record.`);
        return;
      }
      speak(`Analysing ${file.title}.`);
      useHandsFree.setState({ thinking: true });
      if (prefersReducedMotion()) {
        void finish(id);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / (lens.scanDuration * 1000));
        setScanning({ id, progress });
        if (progress < 1) frame.current = requestAnimationFrame(tick);
        else void finish(id);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [analysed, finish, scanning, speak],
  );

  const statusOf = useCallback(
    (id: string): FileStatus => {
      if (!getLensFile(id)?.caseFileIds.length) return "pending";
      if (scanning?.id === id) return "scanning";
      return analysed.has(id) ? "done" : "new";
    },
    [analysed, scanning],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopSpeaking();
      return !m;
    });
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      const i = lensFiles.findIndex((f) => f.id === selectedId);
      const next = lensFiles[(i + direction + lensFiles.length) % lensFiles.length];
      select(next.id);
    },
    [select, selectedId],
  );

  const value = useMemo<LensSession>(
    () => ({ selectedId, scanning, statusOf, findings, analysedCount: analysed.size, voice, muted, select, step, say: speak, toggleMute }),
    [selectedId, scanning, statusOf, findings, analysed.size, voice, muted, select, step, speak, toggleMute],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Total findings Lens can surface across every supplied file (for the findings ring). */
export const findingTotal = scannable.reduce((n, f) => n + analyseFile(f.id).length, 0);
