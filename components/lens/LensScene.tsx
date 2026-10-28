import { caseMeta } from "@/lib/case";
import { AssessmentPanel } from "./AssessmentPanel";
import { CorePanel } from "./CorePanel";
import { EnergyGraph } from "./EnergyGraph";
import { EvidenceQueue } from "./EvidenceQueue";
import { FindingsFeed } from "./FindingsFeed";
import { mono, pixel } from "./fonts";
import { LensHandsFree } from "./LensHandsFree";
import { LensSessionProvider } from "./LensSession";
import { LensStage } from "./LensStage";
import { SaveButton } from "./SaveButton";
import { ScanPanel } from "./ScanPanel";
import { StatusBar } from "./StatusBar";

/**
 * eXunLens, on lens1's framework: three columns (queue + scan / core + energy / findings +
 * assessment) and a bottom row (case title, LENS status, Save). The stage is laid out at
 * 1595 x 927 (lens1's content box, compressed to fit a 1728 x 1117 screen) and zoomed to the
 * width it has; below 1024px it stacks in one 433px column. Layers: background, content,
 * overlay and HUD, for the animations still to come.
 */
export function LensScene() {
  return (
    <div className={`${mono.variable} ${pixel.variable} pt-(--lens-top) pr-(--trace-inset-r) pb-(--lens-bottom) pl-(--trace-inset-l)`}>
      <h1 className="sr-only">eXunLens</h1>
      <div className="[container-type:inline-size]">
        <LensSessionProvider>
          <LensStage>
            <div data-anim="lens-layer-background" aria-hidden className="pointer-events-none absolute inset-0 z-background" />
            <div
              data-anim="lens-layer-content"
              className="relative z-content flex flex-col gap-[22px] lg:grid lg:grid-cols-[433px_781px_336px] lg:grid-rows-[841px_64px] lg:gap-[22px]"
            >
              <div className="flex flex-col gap-[22px] max-lg:order-3">
                <EvidenceQueue className="lg:h-[452px]" />
                <ScanPanel className="h-[367px] lg:min-h-0 lg:flex-1" />
              </div>
              <div className="flex flex-col gap-[22px] max-lg:order-2">
                <CorePanel className="lg:h-[601px]" />
                <EnergyGraph className="lg:min-h-0 lg:flex-1" />
              </div>
              <div className="flex flex-col gap-[22px] max-lg:order-4">
                <FindingsFeed className="h-[445px] lg:min-h-0" />
                <AssessmentPanel className="h-[374px] lg:min-h-0 lg:flex-1" />
              </div>
              <p
                data-anim="lens-title"
                className="flex items-center font-(family-name:--font-lens-pixel) text-[34px] leading-none font-bold max-lg:order-1"
              >
                Case {caseMeta.caseId}
              </p>
              <StatusBar className="h-16 max-lg:order-5 max-lg:flex-wrap max-lg:py-3 max-lg:h-auto" />
              <SaveButton className="h-16 max-lg:order-6" />
            </div>
            <div data-anim="lens-layer-overlay" aria-hidden className="pointer-events-none absolute inset-0 z-overlay" />
            {/* Hand tracking draws only its reticle here; no camera image is ever shown. */}
            <div data-anim="lens-layer-hud" aria-hidden className="pointer-events-none absolute inset-0 z-hud" />
          </LensStage>
          <LensHandsFree />
        </LensSessionProvider>
      </div>
    </div>
  );
}
