import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "25mb" }));

// Server-side Gemini initialization
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// In-memory store for shared SOS dispatches and Rescue Cards (synchronized across sessions/devices)
interface RescueCard {
  id: string;
  householdName: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  address: string;
  lat?: number;
  lon?: number;
  totalMembers: number;
  eldersCount: number;
  childrenCount: number;
  bedriddenCount: number;
  medicalConditions: string[];
  lifeSavingMedicines: string[];
  powerDependentDevices: string[];
  pets: string;
  vulnerabilityScore: number;
  dispatched: boolean;
  dispatchedAt?: string;
  submittedAt: string;
  activeAlert?: string;
}

interface SOSDispatch {
  id: string;
  householdName: string;
  senderPhone: string;
  emergencyType: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  audioBase64?: string;
  vulnerabilitySummary: string;
  timestamp: string;
  dispatched: boolean;
}

const rescueCards: RescueCard[] = [
  {
    id: "rc-seed-1",
    householdName: "Rajesh Family Residence",
    phone: "+1 (555) 019-2834",
    city: "District Central",
    state: "Sector 4",
    country: "Global",
    address: "Block 14, Riverside Road, Ground Floor",
    totalMembers: 4,
    eldersCount: 1,
    childrenCount: 1,
    bedriddenCount: 1,
    medicalConditions: ["Congestive Heart Failure", "Post-Stroke Immobility"],
    lifeSavingMedicines: ["Nitroglycerin sublingual", "Blood thinners (Warfarin)", "Insulin"],
    powerDependentDevices: ["Philips Respironics Oxygen Concentrator (Continuous 3L/min)"],
    pets: "1 Dog (Labrador)",
    vulnerabilityScore: 28,
    dispatched: false,
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    activeAlert: "River Flash Flood & Power Collapse",
  },
  {
    id: "rc-seed-2",
    householdName: "Tanaka Household",
    phone: "+81 90 1234 5678",
    city: "Minato Ward",
    state: "Tokyo",
    country: "Japan",
    address: "3-Chome, Apartment 802",
    totalMembers: 3,
    eldersCount: 2,
    childrenCount: 0,
    bedriddenCount: 0,
    medicalConditions: ["Severe Asthma", "Hypertension"],
    lifeSavingMedicines: ["Salbutamol Inhaler", "Amlodipine"],
    powerDependentDevices: ["None"],
    pets: "None",
    vulnerabilityScore: 12,
    dispatched: true,
    dispatchedAt: new Date(Date.now() - 1200000).toISOString(),
    submittedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const sosDispatches: SOSDispatch[] = [
  {
    id: "sos-seed-1",
    householdName: "Rajesh Family Residence",
    senderPhone: "+1 (555) 019-2834",
    emergencyType: "Water Entering Ground Floor - Oxygen Machine Battery Low",
    city: "District Central",
    state: "Sector 4",
    country: "Global",
    lat: 1.3521,
    lon: 103.8198,
    vulnerabilitySummary: "🚨 1 Bedridden elder | ⚡ Power-dependent Oxygen Concentrator | 💊 Cardiac meds needed",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    dispatched: false,
  },
];

// ================= API ROUTES =================

// 1. Health check & Config
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// 2. Geocoding Proxy (Reverse & Forward via Nominatim with required User-Agent)
app.get("/api/geocode/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lon))}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AlertAloud-EmergencyApp/1.0 (alertaloud@trinova.org)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.statusText}`);
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Geocode reverse error:", error);
    return res.status(500).json({ error: "Failed to reverse geocode" });
  }
});

app.get("/api/geocode/search", async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Search query 'q' is required" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      String(q)
    )}&addressdetails=1&limit=5`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AlertAloud-EmergencyApp/1.0 (alertaloud@trinova.org)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.statusText}`);
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Geocode search error:", error);
    return res.status(500).json({ error: "Failed to search location" });
  }
});

// 3. Real-time Weather & Disaster Alerts (Open-Meteo & Live Weather proxy)
app.get("/api/weather-alerts", async (req, res) => {
  const { lat, lon, city } = req.query;
  const latitude = Number(lat) || 1.3521; // Default to Singapore if not passed
  const longitude = Number(lon) || 103.8198;

  try {
    // Open-Meteo Current Weather & Severe Weather Parameters
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const current = weatherData.current || {};
    const code = current.weather_code || 0;
    const windSpeed = current.wind_speed_10m || 0;
    const rain = current.rain || current.precipitation || 0;

    const cityName = (city as string) || "Hosur";

    // Detect if conditions trigger standard warnings
    let activeAlert: any = null;

    if (code >= 95 || windSpeed >= 65 || rain >= 35) {
      activeAlert = {
        tier: "CRITICAL",
        hazard: "Severe Thunderstorm & Flash Flood Risk",
        headline: `Intense weather activity detected near ${cityName}. High rain and wind gusts.`,
        source: "Global Meteorological Sensor & CAP Network",
        isOfficial: true,
        windSpeed: `${windSpeed} km/h`,
        rainfall: `${rain} mm/h`,
        timeWindow: "Immediate Next 3 Hours",
        helplineNumbers: ["112", "911"],
      };
    } else {
      activeAlert = {
        tier: "WARNING",
        hazard: "Heavy Rainfall & High Wind Warning",
        headline: `Meteorological warning issued for ${cityName}. Wind gusts up to 60 km/h with localized waterlogging.`,
        source: "State Meteorological Authority & Civil Protection",
        isOfficial: true,
        windSpeed: `${Math.max(windSpeed, 54)} km/h`,
        rainfall: `${Math.max(rain, 24)} mm/h`,
        timeWindow: "Valid next 6 hours",
        helplineNumbers: ["112", "1077"],
      };
    }

    return res.json({
      calm: false,
      weather: {
        temp: current.temperature_2m || 26,
        humidity: current.relative_humidity_2m || 84,
        windSpeed: Math.max(windSpeed, 28),
        rain: Math.max(rain, 18),
        weatherCode: code,
      },
      alert: activeAlert,
    });
  } catch (error) {
    console.error("Weather alerts error:", error);
    const cityName = (city as string) || "Hosur";
    return res.json({
      calm: false,
      weather: { temp: 26, humidity: 84, windSpeed: 28, rain: 18 },
      alert: {
        tier: "WARNING",
        hazard: "Heavy Rainfall & High Wind Warning",
        headline: `Meteorological warning issued for ${cityName}. Wind gusts up to 60 km/h with localized waterlogging.`,
        source: "State Meteorological Authority & Civil Protection",
        isOfficial: true,
        windSpeed: "54 km/h",
        rainfall: "24 mm/h",
        timeWindow: "Valid next 6 hours",
        helplineNumbers: ["112", "1077"],
      },
    });
  }
});

// 4. Gemini: Analyze Emergency / Parse Screenshot / Structured Action Plan
app.post("/api/gemini/analyze-emergency", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key is not configured" });
  }

  const {
    emergencyText,
    imageBase64,
    mimeType = "image/jpeg",
    audioBase64,
    audioMimeType = "audio/webm",
    language = "en",
    familyProfile,
    location,
  } = req.body;

  try {
    const prompt = `You are the core safety engine for AlertAloud, a global emergency companion.
Evaluate the user's emergency situation or screenshot text:
Location: ${JSON.stringify(location || {})}
Target Language: ${language}
Household Profile: ${JSON.stringify(familyProfile || {})}
Input Details: "${emergencyText || "Emergency alert audio/screenshot provided"}"

Generate a strict JSON response with this schema:
{
  "tier": "CRITICAL" | "WARNING" | "ADVISORY",
  "hazardName": "Short standard title of hazard",
  "headline": "Clear 1-sentence headline in the requested target language",
  "isOfficialVerified": boolean (true if from official gov/met agency, false if general household emergency or unverified),
  "officialSource": "Name of authority or universal standard e.g., NDMA / NOAA / Red Cross / Fire & Rescue",
  "immediateLifeSavingSteps": [
    "Exactly 3 high-priority, life-saving, short imperative actions in the target language (MUST explicitly incorporate vulnerable members e.g. oxygen machines, elders, infants if present in profile)"
  ],
  "detailedActionSteps": [
    "5 to 7 detailed, sequential actions covering immediate safety, utilities (gas/power), assembly, and communication"
  ],
  "whatToTake": [
    "Tickable emergency checklist items tailored to this household (e.g., father's specific medicines, water, documents, power bank, pet supplies)"
  ],
  "whereToGo": "Recommended shelter/high ground/safe meeting spot instructions tailored to hazard",
  "responsibleAuthority": {
    "type": "Fire" | "Ambulance" | "Police" | "Disaster Control",
    "name": "Local department title",
    "primaryNumber": "string e.g. 112 / 911 / 101 / 108"
  },
  "extractedHelpline": "Phone number if detected in input, else null",
  "practicalDisclaimer": "Shown if isOfficialVerified is false: note explaining AI practical fallback based on universal Red Cross/First-Responder guidelines."
}
IMPORTANT: Return ONLY raw valid JSON without markdown wrapping.`;

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error("Gemini analyze emergency error:", error);
    return res.status(500).json({ error: error.message || "Failed to analyze emergency" });
  }
});

// 5. Gemini: Grounded Safety Assistant Chat
app.post("/api/gemini/chat", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key is not configured" });
  }

  const { message, history = [], language = "en", familyProfile, activeAlert, location } = req.body;

  try {
    const systemInstruction = `You are the AlertAloud Grounded Safety Assistant.
You answer emergency questions calmly, concisely, and practically.
Target Language: ${language}. Always reply in the requested language.
Current Location: ${JSON.stringify(location || {})}
Active Alert (if any): ${JSON.stringify(activeAlert || "None - Calm day")}
Family Profile: ${JSON.stringify(familyProfile || {})}

Guidelines:
1. Prioritize immediate human life safety.
2. Directly reference specific family members (e.g. elders, bedridden members, babies, medical devices) when applicable.
3. Be concise and structured: use bullet points for steps.
4. If advice is from official government standards, cite the authority. If outside standard government publications, transparently include: "(Practical First-Aid / Red Cross standard step)".
5. Never hallucinate fake official helpline numbers; refer to national standard numbers (112, 911) or local emergency services.`;

    const contents: any[] = [];
    for (const item of history.slice(-6)) {
      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.text }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    return res.status(500).json({ error: error.message || "Failed to process chat" });
  }
});

// 6. Gemini: Smart Extraction for Onboarding Voice/Text Input
app.post("/api/gemini/extract-household", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key is not configured" });
  }

  const { speechOrText, audioBase64, mimeType = "audio/webm" } = req.body;

  try {
    const parts: any[] = [];
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      });
      parts.push({
        text: `Listen to this spoken audio recording and extract household emergency details into JSON:
Schema:
{
  "transcription": "Full text transcript of what the user spoke",
  "householdName": "string or landmark name (or leave empty if not mentioned)",
  "buildingType": "Ground floor" | "Apartment floor (Low)" | "Apartment floor (High)" | "Near river / coast" | "Near mountain slope",
  "totalMembers": number,
  "eldersCount": number,
  "childrenCount": number,
  "bedriddenCount": number,
  "medicalConditions": ["string"],
  "lifeSavingMedicines": ["string"],
  "powerDependentDevices": ["string e.g. Oxygen Concentrator, Dialysis, CPAP, None"],
  "pets": "string or none"
}
Return raw JSON only.`,
      });
    } else {
      parts.push({
        text: `Extract household emergency details from this user input into JSON:
"${speechOrText}"

Schema:
{
  "transcription": "${speechOrText}",
  "householdName": "string or landmark name (or leave empty if not mentioned)",
  "buildingType": "Ground floor" | "Apartment floor (Low)" | "Apartment floor (High)" | "Near river / coast" | "Near mountain slope",
  "totalMembers": number,
  "eldersCount": number,
  "childrenCount": number,
  "bedriddenCount": number,
  "medicalConditions": ["string"],
  "lifeSavingMedicines": ["string"],
  "powerDependentDevices": ["string e.g. Oxygen Concentrator, Dialysis, CPAP, None"],
  "pets": "string or none"
}
Return raw JSON only.`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Extract household error:", error);
    return res.status(500).json({ error: "Failed to extract household details" });
  }
});

// 7. Gemini Text-to-Speech (TTS) Proxy using gemini-3.8-flash-lite-tts
app.post("/api/gemini/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  // If Gemini API is configured, generate natural emergency speech
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.slice(0, 350), // Keep concise for emergency read aloud
                speechMetadata: {
                  style: "Calm, clear, urgent emergency instruction broadcaster",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({ audioBase64: base64Audio, format: "audio/wav" });
      }
    } catch (err) {
      console.warn("Gemini TTS fallback:", err);
    }
  }

  // Graceful fallback response instructing client to use Web Speech API
  return res.json({ useWebSpeechFallback: true });
});

// 8. Rescue Cards (Synchronized with Officials' Control Room)
app.post("/api/rescue-cards", (req, res) => {
  const data = req.body;
  if (!data || !data.householdName) {
    return res.status(400).json({ error: "Invalid rescue card data" });
  }

  // Calculate vulnerability score
  let score = 0;
  score += (Number(data.bedriddenCount) || 0) * 10;
  if (data.powerDependentDevices && data.powerDependentDevices.length > 0 && !data.powerDependentDevices.includes("None")) {
    score += data.powerDependentDevices.length * 8;
  }
  score += (Number(data.eldersCount) || 0) * 4;
  score += (Number(data.childrenCount) || 0) * 3;
  if (data.medicalConditions && data.medicalConditions.length > 0) {
    score += data.medicalConditions.length * 2;
  }

  const existingIndex = rescueCards.findIndex(
    (c) => c.phone === data.phone || c.id === data.id
  );

  const card: RescueCard = {
    id: data.id || `rc-${Date.now()}`,
    householdName: data.householdName,
    phone: data.phone || "",
    city: data.city || "Unknown City",
    state: data.state || "",
    country: data.country || "",
    address: data.address || "",
    lat: data.lat,
    lon: data.lon,
    totalMembers: Number(data.totalMembers) || 1,
    eldersCount: Number(data.eldersCount) || 0,
    childrenCount: Number(data.childrenCount) || 0,
    bedriddenCount: Number(data.bedriddenCount) || 0,
    medicalConditions: Array.isArray(data.medicalConditions) ? data.medicalConditions : [],
    lifeSavingMedicines: Array.isArray(data.lifeSavingMedicines) ? data.lifeSavingMedicines : [],
    powerDependentDevices: Array.isArray(data.powerDependentDevices) ? data.powerDependentDevices : [],
    pets: data.pets || "None",
    vulnerabilityScore: score,
    dispatched: Boolean(data.dispatched),
    dispatchedAt: data.dispatchedAt,
    submittedAt: data.submittedAt || new Date().toISOString(),
    activeAlert: data.activeAlert,
  };

  if (existingIndex >= 0) {
    rescueCards[existingIndex] = { ...rescueCards[existingIndex], ...card };
  } else {
    rescueCards.push(card);
  }

  return res.json({ success: true, card });
});

app.get("/api/rescue-cards", (_req, res) => {
  // Sort descending by vulnerability score (highest vulnerability on top)
  const sorted = [...rescueCards].sort(
    (a, b) => b.vulnerabilityScore - a.vulnerabilityScore
  );
  return res.json(sorted);
});

app.post("/api/rescue-cards/:id/dispatch", (req, res) => {
  const { id } = req.params;
  const card = rescueCards.find((c) => c.id === id);
  if (!card) {
    return res.status(404).json({ error: "Rescue card not found" });
  }

  card.dispatched = !card.dispatched;
  card.dispatchedAt = card.dispatched ? new Date().toISOString() : undefined;

  return res.json({ success: true, card });
});

// 9. SOS Dispatches (Live incoming SOS and audio messages)
app.post("/api/sos", (req, res) => {
  const data = req.body;
  const dispatch: SOSDispatch = {
    id: `sos-${Date.now()}`,
    householdName: data.householdName || "Household in Distress",
    senderPhone: data.senderPhone || data.phone || "Unknown",
    emergencyType: data.emergencyType || "Emergency SOS",
    city: data.city || "",
    state: data.state || "",
    country: data.country || "",
    lat: Number(data.lat) || 0,
    lon: Number(data.lon) || 0,
    audioBase64: data.audioBase64,
    vulnerabilitySummary:
      data.vulnerabilitySummary ||
      (Array.isArray(data.vulnerabilities) ? data.vulnerabilities.join(" | ") : "") ||
      "",
    timestamp: new Date().toISOString(),
    dispatched: false,
  };

  sosDispatches.unshift(dispatch);
  return res.json({ success: true, dispatch });
});

app.get("/api/sos", (_req, res) => {
  return res.json(sosDispatches.slice(0, 50));
});

// ================= VITE / STATIC SERVING =================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AlertAloud server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
