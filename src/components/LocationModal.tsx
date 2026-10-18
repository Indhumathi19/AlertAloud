import React, { useState } from "react";
import { UserLocation } from "../types";
import { searchLocationsWorldwide, discoverNearbyServices } from "../utils/location";
import { detectNativeLanguage } from "../utils/languages";
import { Search, MapPin, X, Loader2, Navigation, Check } from "lucide-react";

interface LocationModalProps {
  currentLocation: UserLocation;
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: UserLocation) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<UserLocation[]>([]);
  const [manualCity, setManualCity] = useState(currentLocation.city);
  const [manualState, setManualState] = useState(currentLocation.state);
  const [manualCountry, setManualCountry] = useState(currentLocation.country);
  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const found = await searchLocationsWorldwide(query.trim());
      setResults(found);
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualApply = () => {
    if (!manualCity.trim()) return;
    const lang = detectNativeLanguage(manualCountry, manualState);
    const updated: UserLocation = {
      city: manualCity.trim(),
      state: manualState.trim(),
      country: manualCountry.trim() || "Earth",
      countryCode: "GL",
      lat: currentLocation.lat || 0,
      lon: currentLocation.lon || 0,
      displayName: `${manualCity}${manualState ? ", " + manualState : ""}, ${manualCountry}`,
      detectedNativeLanguage: lang.code,
    };
    onSelectLocation(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-850 border-b border-slate-750 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500 shrink-0" />
            <h3 className="font-bold text-base sm:text-lg text-white">Select Your Location</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-750 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 gap-1">
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-2 px-1 text-xs sm:text-sm font-semibold rounded-lg transition text-center truncate ${
              activeTab === "search"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔍 Search Worldwide
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-2 px-1 text-xs sm:text-sm font-semibold rounded-lg transition text-center truncate ${
              activeTab === "manual"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Manual Input
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span className="text-slate-400">Current detected:</span>{" "}
              <strong className="text-white">{currentLocation.displayName}</strong>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
              Active
            </span>
          </div>

          {activeTab === "search" ? (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter city, town, or country (e.g. Tokyo, Munich, Chennai, Austin)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </button>
              </form>

              {/* Results list */}
              <div className="space-y-2 max-h-60 overflow-y-auto pt-1">
                {results.map((loc, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-800/50 hover:bg-red-950/30 border border-slate-750 hover:border-red-500/50 transition flex items-start justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-white group-hover:text-red-400 text-sm">
                        {loc.city} {loc.state ? `· ${loc.state}` : ""}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{loc.displayName}</div>
                      <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                        🌐 Native Language: {loc.detectedNativeLanguage.toUpperCase()}
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-slate-500 group-hover:text-red-400 mt-1" />
                  </button>
                ))}

                {results.length === 0 && !isSearching && query && (
                  <p className="text-center text-xs text-slate-400 py-4">
                    No matching location found. Try checking spelling or switch to Manual tab.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">City or Town</label>
                <input
                  type="text"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  placeholder="e.g. San Francisco, Tokyo, Bengaluru"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">State / Province / Region</label>
                <input
                  type="text"
                  value={manualState}
                  onChange={(e) => setManualState(e.target.value)}
                  placeholder="e.g. California, Bavaria, Kerala"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Country</label>
                <input
                  type="text"
                  value={manualCountry}
                  onChange={(e) => setManualCountry(e.target.value)}
                  placeholder="e.g. United States, Japan, India"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                type="button"
                onClick={handleManualApply}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-semibold text-sm transition"
              >
                Apply Location
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 text-center">
          AlertAloud dynamically fetches real-time CAP weather feeds and emergency stations for any chosen location worldwide.
        </div>
      </div>
    </div>
  );
};
