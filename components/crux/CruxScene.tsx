import { CruxBoard } from "./CruxBoard";

/** eXunCrux: the evidence board from design/exuncrux.png. */
export function CruxScene() {
  return (
    <div className="pt-(--crux-top) pr-(--trace-inset-r) pb-(--crux-bottom) pl-(--trace-inset-l)">
      <h1 className="sr-only">eXunCrux evidence board</h1>
      <CruxBoard />
    </div>
  );
}
