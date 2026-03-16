"use client";

import { useState } from "react";

interface InputFormProps {
  onSubmit: (data: {
    address: string;
    latitude?: number;
    longitude?: number;
    perspective: string;
  }) => void;
}

const perspectives = [
  { value: "comprehensive", label: "総合", description: "バランスの良い総合分析" },
  { value: "child_rearing", label: "子育て重視", description: "教育・医療・安全性を重視" },
  { value: "disaster", label: "災害重視", description: "防災・安全性を重点分析" },
  { value: "livability", label: "生活利便重視", description: "施設・交通アクセスを重視" },
];

export function InputForm({ onSubmit }: InputFormProps) {
  const [address, setAddress] = useState("");
  const [useCoords, setUseCoords] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [perspective, setPerspective] = useState("comprehensive");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (useCoords) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lon)) return;
      onSubmit({
        address: address || `${lat}, ${lon}`,
        latitude: lat,
        longitude: lon,
        perspective,
      });
    } else {
      if (!address.trim()) return;
      onSubmit({ address, perspective });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        {/* Address / Coordinates toggle */}
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setUseCoords(false)}
            className={`rounded-full px-4 py-1.5 transition ${!useCoords ? "bg-white text-slate-900 shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"}`}
          >
            住所で入力
          </button>
          <button
            type="button"
            onClick={() => setUseCoords(true)}
            className={`rounded-full px-4 py-1.5 transition ${useCoords ? "bg-white text-slate-900 shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"}`}
          >
            緯度経度で入力
          </button>
        </div>

        {/* Address input */}
        {!useCoords ? (
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
              住所
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="例: 東京都世田谷区三軒茶屋2丁目"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base focus:border-terra-500 focus:outline-none focus:ring-1 focus:ring-terra-500"
              required={!useCoords}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium text-slate-700 mb-1">
                緯度
              </label>
              <input
                id="lat"
                type="number"
                step="any"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder="35.6586"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base focus:border-terra-500 focus:outline-none focus:ring-1 focus:ring-terra-500"
                required={useCoords}
              />
            </div>
            <div>
              <label htmlFor="lon" className="block text-sm font-medium text-slate-700 mb-1">
                経度
              </label>
              <input
                id="lon"
                type="number"
                step="any"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder="139.7454"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base focus:border-terra-500 focus:outline-none focus:ring-1 focus:ring-terra-500"
                required={useCoords}
              />
            </div>
          </div>
        )}

        {/* Perspective selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">重視する観点</label>
          <div className="grid grid-cols-2 gap-2">
            {perspectives.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPerspective(p.value)}
                className={`rounded-xl border p-4 text-left text-sm transition ${
                  perspective === p.value
                    ? "border-terra-500 bg-terra-50 ring-1 ring-terra-500"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="font-medium">{p.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-terra-600 hover:bg-terra-700 h-12 rounded-xl text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-terra-500 focus:ring-offset-2 transition"
      >
        分析を開始
      </button>
    </form>
  );
}
