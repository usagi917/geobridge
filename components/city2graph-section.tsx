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
import { AnalysisMap } from "./maps/analysis-map";

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
  radiusM,
}: City2GraphSectionProps) {
  if (!shouldShowCity2GraphSection(proximity, morphology, isochrone)) {
    return null;
  }

  const hasBothCards = proximity != null && morphology != null;
  const showMap = isochrone != null || (facilities.length > 0);

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">都市構造分析</h3>

      {showMap && (
        <AnalysisMap
          lat={lat}
          lng={lng}
          radiusM={radiusM}
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
