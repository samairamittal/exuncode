/* eslint-disable @next/next/no-img-element -- 1x crops of the design, drawn pixel for pixel */
import { City3D } from "./City3D";
import { legend, mapSize, markerColor, markers, sightingSteps, spreadLevel, timeline } from "./data";
import { TrackerMarker } from "./TrackerMarker";

const tight = "tracking-(--trace-tracking)";
const card = "rounded-(--trace-card-radius) bg-(--surface-0)";
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

function SpreadBar() {
  return (
    <div
      data-anim="spread"
      role="meter"
      aria-label="Spread level"
      aria-valuenow={spreadLevel}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative flex h-(--spread-h) items-center justify-end overflow-hidden rounded-full bg-[linear-gradient(90deg,var(--exun-blue),var(--surface-0)_var(--spread-fade))] pr-(--spread-label-r)"
    >
      <div data-anim="spread-fill" className="absolute inset-y-0 left-0 w-(--spread-fill) rounded-full bg-exun-blue" />
      <p className={`relative top-(--spread-dy) text-nav leading-none ${tight}`}>Spread level : {spreadLevel}%</p>
    </div>
  );
}

function Tracker() {
  return (
    // The card is 4px narrower than its header on the left, as drawn.
    <section data-anim="tracker" aria-labelledby="tracker-title" className={`${card} ml-(--trace-card-inset) pb-(--legend-top)`}>
      <h2
        id="tracker-title"
        className="-ml-(--trace-card-inset) flex h-(--trace-head-h) items-center justify-center rounded-(--trace-head-radius) bg-exun-blue pt-[calc(var(--trace-head-dy)*2)] text-(length:--text-trace-head) leading-none tracking-(--trace-tracking-head)"
      >
        Tracker
      </h2>
      <div
        data-anim="map"
        className="relative mt-(--map-top) ml-(--map-x) aspect-476/430 max-[1023px]:mx-auto w-(--map-w) max-w-[calc(100%-var(--map-x)*2)] overflow-hidden rounded-(--map-radius)"
      >
        <img src="/trace/map.webp" alt="Map of nuxEland" width={mapSize.width} height={mapSize.height} className="block size-full [image-rendering:pixelated]" />
        {markers.map((m, i) => (
          <TrackerMarker key={i} marker={m} index={i} style={{ left: pct(m.x, mapSize.width), top: pct(m.y, mapSize.height) }} />
        ))}
      </div>
      <ul
        data-anim="legend"
        className={`mt-(--legend-top) grid grid-cols-[var(--legend-col-1)_var(--legend-col-2)_auto] pl-(--legend-x) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 text-(length:--text-trace-legend) leading-none ${tight}`}
      >
        {legend.map((item) => (
          <li key={item.kind} className="flex items-center gap-(--legend-gap) whitespace-nowrap">
            <span aria-hidden className={`size-(--legend-dot) shrink-0 rounded-full ${markerColor[item.kind]}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SightingLog() {
  return (
    <section
      data-anim="sighting-log"
      aria-labelledby="sighting-title"
      className={`${card} relative ml-(--trace-card-inset) h-(--sighting-h)`}
    >
      <h2
        id="sighting-title"
        className={`absolute inset-x-0 top-(--sighting-title-top) text-center text-(length:--text-trace-head) leading-none ${tight}`}
      >
        Sighting Log
      </h2>
      <ol
        data-anim="sighting-steps"
        // The connecting line runs between the first and last circle centres.
        className="absolute top-(--steps-top) left-1/2 flex w-(--steps-w) -translate-x-1/2 justify-between before:absolute before:inset-x-[calc(var(--step)/2)] before:top-1/2 before:h-(--step-line) before:-translate-y-1/2 before:bg-snow before:content-['']"
      >
        {sightingSteps.map((step) => (
          <li
            key={step}
            className="relative flex size-(--step) items-center justify-center rounded-full bg-snow pt-[calc(var(--step-dy)*2)] text-(length:--text-trace-step) leading-none text-exun-blue"
          >
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Timeline() {
  return (
    <ol
      data-anim="timeline"
      className="mt-(--days-top) flex flex-wrap justify-between gap-y-8 pr-(--days-inset-r) pl-(--days-inset-l) max-[1023px]:justify-center max-[1023px]:gap-x-8"
    >
      {timeline.map((day) => (
        <li key={day.date} data-anim="day" className="w-(--day-w) text-center">
          <p
            className="flex h-(--day-h) items-center justify-center rounded-(--day-radius) bg-exun-blue pt-[calc(var(--day-dy)*2)] text-(length:--text-trace-day) leading-none tracking-(--trace-tracking-day)"
          >
            {day.date}
          </p>
          <p className="mt-(--day-note-top) text-(length:--text-trace-note) leading-(--day-note-lh) tracking-(--trace-tracking-note)">{day.note}</p>
        </li>
      ))}
    </ol>
  );
}

export function TraceScene() {
  return (
    // The outer div is the size container that .trace-scale measures (see globals.css).
    <div className="[container-type:inline-size]">
      <div
        data-anim="trace"
        className="trace-scale pt-(--trace-top) pr-(--trace-inset-r) pb-(--trace-bottom) pl-(--trace-inset-l)"
      >
        <h1 className="sr-only">eXunTrace</h1>
        <SpreadBar />
        <div className="mt-(--trace-gap-top) grid grid-cols-1 gap-(--trace-col-gap) min-[1024px]:grid-cols-[var(--trace-col-l)_1fr]">
          <div className="flex min-w-0 flex-col gap-(--trace-card-gap)">
            <Tracker />
            <SightingLog />
          </div>
          <City3D className={`${card} max-[1023px]:aspect-1055/824`} />
        </div>
        <Timeline />
      </div>
    </div>
  );
}
