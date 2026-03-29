"use client";

import type {
  ProximityResult,
  MorphologyResult,
  IsochroneResult,
  ProximityFacility,
} from "@/lib/city2graph/types";
import { shouldShowCity2GraphSection } from "@/lib/city2graph/data-status";
import { ProximityCard } from "./proximity-card";
import { MorphologyCard } from "./morphology-card";
import { IsochroneMap } from "./maps/isochrone-map";

interface City2GraphSectionProps {
  proximity: ProximityResult | null | undefined;
  morphology: MorphologyResult | null | undefined;
  isochrone: IsochroneResult | null | undefined;
  facilities: ProximityFacility[];
  lat: number;
  lng: number;
  radiusM: number;
}

export function City2GraphSection({
  proximity,
  morphology,
  isochrone,
  facilities,
  lat,
  lng,
}: City2GraphSectionProps) {
  if (!shouldShowCity2GraphSection(proximity, morphology, isochrone)) {
    return null;
  }

  const hasBothCards = proximity != null && morphology != null;

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">都市構造分析</h3>

      {/* Phase 2 で AnalysisMap に置換予定 */}
      {isochrone && isochrone.features.length > 0 && (
        <IsochroneMap
          latitude={lat}
          longitude={lng}
          isochrone={isochrone}
          facilities={facilities.length > 0 ? facilities : undefined}
        />
      )}

      <div className={`grid gap-4 ${hasBothCards ? "md:grid-cols-2" : ""}`}>
        {proximity && <ProximityCard data={proximity} />}
        {morphology && <MorphologyCard data={morphology} />}
      </div>
    </section>
  );
}
