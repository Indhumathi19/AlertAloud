import { Household, ActiveUserSession, AlertData } from "../types";

const STORAGE_ACTIVE_USER = "alertaloud_active_user";
const STORAGE_HOUSEHOLDS = "alertaloud_households";
const STORAGE_ACTIVE_ALERT = "alertaloud_active_alert";
const STORAGE_SELECTED_LANG = "alertaloud_selected_lang";

// 1. User Session Management
export function getActiveUserSession(): ActiveUserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveUserSession(session: ActiveUserSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_ACTIVE_USER);
  } else {
    localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(session));
  }
}

// 2. Household Management & Family Shared Lookup
export function getAllHouseholds(): Household[] {
  try {
    const raw = localStorage.getItem(STORAGE_HOUSEHOLDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHousehold(household: Household): Household {
  const households = getAllHouseholds();
  const index = households.findIndex((h) => h.id === household.id);

  const updated: Household = {
    ...household,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    households[index] = updated;
  } else {
    households.push(updated);
  }

  localStorage.setItem(STORAGE_HOUSEHOLDS, JSON.stringify(households));

  // Sync with backend rescue card registry
  syncRescueCardWithServer(updated);

  return updated;
}

export function findHouseholdByPhone(phone: string): { household: Household; matchedMemberName: string } | null {
  const cleanPhone = phone.replace(/[^0-9+]/g, "").trim();
  if (!cleanPhone) return null;

  const households = getAllHouseholds();

  for (const h of households) {
    const cleanPrimary = h.primaryPhone.replace(/[^0-9+]/g, "").trim();
    if (cleanPrimary.endsWith(cleanPhone) || cleanPhone.endsWith(cleanPrimary)) {
      return { household: h, matchedMemberName: h.householdName || "Head of Household" };
    }

    // Check family members' registered phones
    for (const member of h.familyMembers || []) {
      const cleanMemberPhone = (member.phone || "").replace(/[^0-9+]/g, "").trim();
      if (cleanMemberPhone && (cleanMemberPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cleanMemberPhone))) {
        return { household: h, matchedMemberName: member.name || "Family Member" };
      }
    }
  }

  return null;
}

export function getHouseholdById(id: string): Household | null {
  const households = getAllHouseholds();
  return households.find((h) => h.id === id) || null;
}

// 3. Active Alert State (Live or Simulated)
export function getStoredActiveAlert(): AlertData | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_ALERT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredActiveAlert(alert: AlertData | null) {
  if (!alert) {
    localStorage.removeItem(STORAGE_ACTIVE_ALERT);
  } else {
    localStorage.setItem(STORAGE_ACTIVE_ALERT, JSON.stringify(alert));
  }
}

// 4. Stored Language Preference
export function getStoredLanguage(): string | null {
  return localStorage.getItem(STORAGE_SELECTED_LANG);
}

export function setStoredLanguage(langCode: string) {
  localStorage.setItem(STORAGE_SELECTED_LANG, langCode);
}

// 5. Backend sync for Rescue Cards
async function syncRescueCardWithServer(household: Household) {
  try {
    await fetch("/api/rescue-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: household.id,
        householdName: household.householdName,
        phone: household.primaryPhone,
        city: household.location.city,
        state: household.location.state,
        country: household.location.country,
        address: household.address,
        lat: household.location.lat,
        lon: household.location.lon,
        totalMembers: household.totalMembers,
        eldersCount: household.eldersCount,
        childrenCount: household.childrenCount,
        bedriddenCount: household.bedriddenCount,
        medicalConditions: household.medicalConditions,
        lifeSavingMedicines: household.lifeSavingMedicines,
        powerDependentDevices: household.powerDependentDevices,
        pets: household.pets,
        dispatched: Boolean(household.rescueDispatched),
        dispatchedAt: household.rescueDispatchedAt,
      }),
    });
  } catch (err) {
    console.warn("Failed to sync rescue card with server:", err);
  }
}
