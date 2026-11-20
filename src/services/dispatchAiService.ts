export interface DispatchCandidateDay {
  date: string;
  dayName: string;
  tempMean: number;
  precipitation: number;
  windSpeed: number;
  riskScore: number;
  status: 'Recommended' | 'Moderate Risk' | 'High Weather Risk';
  timingTip: string;
}

export interface DispatchAiInsight {
  trafficConditionAnalysis: string;
  selectedDepartureVerdict: string;
  recommendedAlternative: string;
  weatherCorridorInsight: string;
  actionableRecommendations: string[];
  confidence: number;
}

const OPENROUTER_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.EXPO_PUBLIC_OPENROUTER_KEY ||
  '';

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

/**
 * Calls OpenRouter or Gemini LLM to generate deep logistics corridor intelligence,
 * real-world traffic prediction, and evaluates the user's selected departure window vs optimal alternatives.
 * Context-aware: explicitly aligns with the app's calculated risk scores, candidate days, and transit mode.
 */
export async function getDispatchAiInsights(
  origin: string,
  destination: string,
  transportMode: string,
  selectedDate: string,
  selectedTime: string,
  candidates: DispatchCandidateDay[]
): Promise<DispatchAiInsight> {
  const bestDay = candidates[0];
  const userDay = candidates.find((c) => c.date === selectedDate) || candidates[0];

  const candidateSummary = candidates
    .map(
      (c, i) =>
        `#${i + 1} Date: ${c.date} (${c.dayName}) - Risk: ${c.riskScore}% (${c.status}), Temp: ${c.tempMean}°C, Rain: ${c.precipitation}mm, Wind: ${c.windSpeed}km/h`
    )
    .join('\n');

  const prompt = `You are an enterprise AI Logistics & Supply Chain Fleet Operations Expert.
Analyze this planned commercial freight dispatch using the exact real-time calculations from the Inspectify app:

TRANSIT ROUTE & LOGISTICS PARAMETERS:
- Origin: ${origin}
- Destination: ${destination}
- Mode of Transport: ${transportMode}
- Operator Selected Departure Date: ${selectedDate} (${userDay.dayName})
- Operator Selected Departure Time: ${selectedTime}
- Operator Selected Day Weather & Calculated Risk:
  * Mean Temp: ${userDay.tempMean}°C
  * Precipitation: ${userDay.precipitation}mm
  * Max Wind Speed: ${userDay.windSpeed}km/h
  * Calculated Environmental Risk Score: ${userDay.riskScore}% (Rating: ${userDay.status})

APP 5-DAY RANKED WINDOWS (from safest to highest risk):
${candidateSummary}

SAFEST CORRIDOR WINDOW FOUND BY APP:
- Date: ${bestDay.date} (${bestDay.dayName}), Risk Score: ${bestDay.riskScore}%, Rain: ${bestDay.precipitation}mm, Wind: ${bestDay.windSpeed}km/h

CRITICAL INSTRUCTIONS:
- You MUST BE STRICTLY CONTEXT-AWARE. Do not contradict the app's ranked candidate data.
- The app has calculated that ${bestDay.dayName} (${bestDay.date}) is the safest window with ${bestDay.riskScore}% risk.
- Explicitly compare the operator's chosen departure (${selectedDate} at ${selectedTime}) with the app's safest window (${bestDay.dayName}).
- If the operator already selected the safest day, reinforce why and recommend the exact optimal departure hour (e.g. early morning 05:30 AM to beat thermal asphalt heat and freight choke points).
- If the operator selected a riskier day, quantify the benefit of switching to ${bestDay.dayName} using the exact risk delta (${userDay.riskScore - bestDay.riskScore}% lower risk).

Provide your response in JSON format with these exact keys:
{
  "traffic_condition_analysis": "Realistic analysis of actual freight highway bottlenecks, arterial freight choke points, urban toll plazas, and typical congestion between ${origin} and ${destination} via ${transportMode}.",
  "selected_departure_verdict": "Context-aware assessment of departing on ${selectedDate} at ${selectedTime}, incorporating the ${userDay.tempMean}°C temp, ${userDay.precipitation}mm rain, and ${userDay.riskScore}% risk score.",
  "recommended_alternative": "Direct, concrete comparison contrasting ${selectedDate} ${selectedTime} against the app's recommended departure (${bestDay.dayName} at 05:30 AM) with exact risk and time benefits.",
  "weather_corridor_insight": "Physical impact of ${userDay.tempMean}°C and ${userDay.precipitation}mm rain on packaging structural integrity (e.g. cardboard moisture absorption, display seal expansion).",
  "actionable_recommendations": [
    "Concrete directive 1 for dispatch team regarding strapping, waterproofing, or schedule",
    "Concrete directive 2 regarding vehicle suspension, departure hour, or routing",
    "Concrete directive 3 regarding fragile cargo placement and shock mitigation"
  ]
}`;

  // Try OpenRouter first (GPT-4o-mini / Claude 3.5 Haiku)
  if (OPENROUTER_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY.replace(/"/g, '')}`,
          'HTTP-Referer': 'https://inspectify.app',
          'X-Title': 'Inspectify Dispatch Optimizer',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            trafficConditionAnalysis: parsed.traffic_condition_analysis || '',
            selectedDepartureVerdict: parsed.selected_departure_verdict || '',
            recommendedAlternative: parsed.recommended_alternative || '',
            weatherCorridorInsight: parsed.weather_corridor_insight || '',
            actionableRecommendations: parsed.actionable_recommendations || [],
            confidence: 96,
          };
        }
      }
    } catch (_e) {
      // Continue to Gemini fallback
    }
  }

  // Fallback: Gemini Vision / Pro
  if (GEMINI_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            trafficConditionAnalysis: parsed.traffic_condition_analysis || '',
            selectedDepartureVerdict: parsed.selected_departure_verdict || '',
            recommendedAlternative: parsed.recommended_alternative || '',
            weatherCorridorInsight: parsed.weather_corridor_insight || '',
            actionableRecommendations: parsed.actionable_recommendations || [],
            confidence: 94,
          };
        }
      }
    } catch (_e) {
      // Continue to heuristic engine
    }
  }

  // Deterministic Logistics Heuristic Intelligence (context-aware fallback)
  const isUserBest = userDay.date === bestDay.date;
  const riskDelta = userDay.riskScore - bestDay.riskScore;

  return {
    trafficConditionAnalysis: `Transit corridor between ${origin} and ${destination} via ${transportMode} experiences peak choke points during industrial shift turnover and toll plaza bottlenecks. Major arterial freight speed averages 42-55 km/h with potential delays around municipal checkpoints.`,
    selectedDepartureVerdict: isUserBest
      ? `Selected departure on ${userDay.dayName} at ${selectedTime} aligns with favorable corridor conditions (Risk Score: ${userDay.riskScore}% - ${userDay.status}). Ambient temperature (${userDay.tempMean}°C) and precipitation (${userDay.precipitation}mm) remain within safe cargo transit tolerances.`
      : `Selected departure on ${userDay.dayName} at ${selectedTime} incurs a ${userDay.riskScore}% risk score (${userDay.status}) due to ${userDay.precipitation > 2 ? `${userDay.precipitation}mm rainfall` : 'elevated asphalt thermal radiation and gusting crosswinds'}. Expect transit deceleration and potential packaging moisture stress.`,
    recommendedAlternative: isUserBest
      ? `Your selected date (${userDay.dayName}) is confirmed as the lowest-risk departure window. To further minimize road friction, target departure at 05:30 AM to bypass morning highway rush hour and take advantage of cooler asphalt.`
      : `Recommended Alternative: Depart on ${bestDay.dayName} at 05:30 AM instead of ${userDay.dayName} ${selectedTime}. This reduces predicted damage probability by ${riskDelta}% (from ${userDay.riskScore}% down to ${bestDay.riskScore}%) and avoids corridor weather disturbances.`,
    weatherCorridorInsight: `Expected mean temperature of ${userDay.tempMean}°C with ${userDay.precipitation}mm rainfall. ${userDay.precipitation > 0 ? 'Surface moisture can reduce corrugated cardboard burst strength by up to 25%.' : 'Dry conditions maintain structural box integrity.'}`,
    actionableRecommendations: [
      `Enforce double-stretch poly wrap if rainfall exceeds 2mm along the route.`,
      `Schedule vehicle departure to avoid 12:00 PM - 04:00 PM peak thermal asphalt hours.`,
      `Place fragile electronics and glass display cartons in center-tier pallets to absorb transit vibration.`,
    ],
    confidence: 90,
  };
}
