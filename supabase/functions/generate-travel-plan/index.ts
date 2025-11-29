import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback mapping (used only if Gemini fails to return usable IATA codes)
const COUNTRY_AIRPORTS: Record<string, string[]> = {
  "germany": ["FRA", "MUC", "BER", "DUS", "HAM"],
  "france": ["CDG", "ORY", "NCE", "LYS", "MRS"],
  "italy": ["FCO", "MXP", "VCE", "NAP", "BGY"],
  "spain": ["MAD", "BCN", "PMI", "AGP", "SVQ"],
  "uk": ["LHR", "LGW", "MAN", "EDI", "BHX"],
  "united kingdom": ["LHR", "LGW", "MAN", "EDI", "BHX"],
  "usa": ["JFK", "LAX", "ORD", "DFW", "ATL"],
  "united states": ["JFK", "LAX", "ORD", "DFW", "ATL"],
  "canada": ["YYZ", "YVR", "YUL", "YYC", "YOW"],
  "japan": ["NRT", "HND", "KIX", "NGO", "FUK"],
  "australia": ["SYD", "MEL", "BNE", "PER", "ADL"],
  "india": ["DEL", "BOM", "BLR", "CCU", "MAA"],
  "china": ["PEK", "PVG", "CAN", "CTU", "SZX"],
  "brazil": ["GRU", "GIG", "BSB", "CGH", "SSA"],
  "mexico": ["MEX", "CUN", "GDL", "MTY", "TIJ"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, destination, startDate, endDate, budget, travelers, interests, includeFlights } =
      await req.json();

    console.log("Generating travel plan with params:", { source, destination, startDate, endDate, budget, travelers, includeFlights });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Helper: clean a model text output and extract the first top-level JSON object by balanced-brace scanning
    function extractFirstJsonObject(text: string): string | null {
      const firstBrace = text.indexOf("{");
      if (firstBrace === -1) return null;
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' && !escaped) {
          inString = !inString;
        }
        if (!inString) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        if (ch === "\\" && !escaped) {
          escaped = true;
        } else {
          escaped = false;
        }
        if (depth === 0) {
          // substring from firstBrace to i inclusive
          return text.slice(firstBrace, i + 1);
        }
      }
      return null;
    }

    // Helper: try to parse extracted JSON safely
    function safeParseJsonCandidate(text: string | null): any | null {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (err) {
        console.warn("JSON.parse failed on candidate:", err);
        return null;
      }
    }

    // Helper: try to extract IATA codes from free text (e.g. fallback)
    function extractIataCodesFromText(text: string | null): string[] {
      if (!text) return [];
      // Match sequences of 3 letters (uppercase or lowercase)
      const matches = text.match(/\b[A-Za-z]{3}\b/g);
      if (!matches) return [];
      // Filter to uppercase 3-letter codes and dedupe
      const upper = Array.from(new Set(matches.map((m) => m.toUpperCase())));
      // Heuristic: keep tokens of length 3 and letters only
      return upper.filter((t) => /^[A-Z]{3}$/.test(t));
    }

    // Build Gemini prompt for retrieving airport codes for source and destination
    function buildAirportPrompt(src: string, dst: string) {
      // Explicit instructions to return ONLY JSON (no commentary).
      // If the input is a country, choose capital or a popular tourist city and return airports for that city.
      // If the input is already a single IATA code, return it as single-element array.
      return `You are a precise data assistant. Given the inputs below, return ONLY a single JSON object and NOTHING ELSE (no explanation, no markdown). The JSON must contain exactly two keys: "source_airports" and "destination_airports". Each value must be an array of IATA 3-letter airport codes (strings), ordered with the most relevant / largest / closest airports first.

Inputs:
- source: "${src}"
- destination: "${dst}"

Rules:
1) If a value (source or destination) appears to already be an IATA 3-letter airport code, return it as a single-element array for that side.
2) If a value is a city or region name, return major airports serving that city/region (IATA codes).
3) If a value is a country name, pick either the country's capital city or a popular tourist city (choose whichever yields the most useful airports) and return major airports for that city.
4) Only return valid IATA codes in uppercase.
5) Example of the exact shape to return:
{"source_airports":["JFK"],"destination_airports":["CDG","ORY"]}`;
    }

    // Call Gemini to get airport codes
    async function fetchAirportCodesFromGemini(src: string, dst: string) {
      const prompt = buildAirportPrompt(src, dst);

      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.0,
            },
          }),
        },
      );

      if (!resp.ok) {
        const txt = await resp.text();
        console.error("Gemini airport lookup error:", resp.status, txt);
        throw new Error(`Gemini airport lookup error: ${resp.status}`);
      }

      const payload = await resp.json();
      // Defensive navigation
      const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(payload);
      console.log("Raw Gemini airport response text:", rawText);

      // Try to extract a balanced JSON object substring
      const jsonCandidate = extractFirstJsonObject(rawText);
      let parsed = safeParseJsonCandidate(jsonCandidate);

      // If parsing failed, try fallback extraction of IATA tokens from the whole text
      if (!parsed) {
        console.warn("Primary JSON extraction failed, attempting regex extraction of IATA codes.");
        const tokens = extractIataCodesFromText(rawText);
        // Heuristic split: attempt to split tokens equally into source/destination if possible
        if (tokens.length >= 2) {
          // If we see tokens like XYZ,ABC,... assume first tokens belong to source till we find typical airport lists
          // Simpler approach: try to find mentions of 'source' or 'destination' around codes (naive)
          parsed = {
            source_airports: tokens.slice(0, 1),
            destination_airports: tokens.slice(1),
          };
        } else {
          parsed = null;
        }
      }

      // If still no parsed result, return null to let caller fall back to local mapping
      return parsed;
    }

    // Attempt Gemini lookup for the airports
    let airportLookup: any | null = null;
    try {
      airportLookup = await fetchAirportCodesFromGemini(source, destination);
    } catch (err) {
      console.warn("Gemini airport lookup failed:", err);
      airportLookup = null;
    }

    // Normalize airport arrays or fallback to COUNTRY_AIRPORTS
    function arrayifyCodes(value: any): string[] {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((s) => String(s).toUpperCase());
      if (typeof value === "string") return [value.toUpperCase()];
      return [];
    }

    let sourceAirports: string[] = [];
    let destinationAirports: string[] = [];

    if (airportLookup && (airportLookup.source_airports || airportLookup.destination_airports)) {
      sourceAirports = arrayifyCodes(airportLookup.source_airports);
      destinationAirports = arrayifyCodes(airportLookup.destination_airports);
      console.log("Gemini-provided airports:", { sourceAirports, destinationAirports });
    }

    // If Gemini failed to produce arrays, attempt fallback logic:
    if (sourceAirports.length === 0) {
      // If source looks like a single IATA code already, use it
      const s = (source || "").trim();
      if (/^[A-Za-z]{3}$/.test(s)) {
        sourceAirports = [s.toUpperCase()];
      } else {
        // try country fallback map
        const lookupKey = s.toLowerCase().trim();
        if (COUNTRY_AIRPORTS[lookupKey]) {
          sourceAirports = COUNTRY_AIRPORTS[lookupKey];
        }
      }
    }
    if (destinationAirports.length === 0) {
      const d = (destination || "").trim();
      if (/^[A-Za-z]{3}$/.test(d)) {
        destinationAirports = [d.toUpperCase()];
      } else {
        const lookupKey = d.toLowerCase().trim();
        if (COUNTRY_AIRPORTS[lookupKey]) {
          destinationAirports = COUNTRY_AIRPORTS[lookupKey];
        }
      }
    }

    // As a final fallback, if any side is still empty, set it to the other side or a common hub
    if (sourceAirports.length === 0 && destinationAirports.length > 0) {
      // use the first destination as origin (best-effort)
      sourceAirports = [destinationAirports[0]];
    }
    if (destinationAirports.length === 0 && sourceAirports.length > 0) {
      destinationAirports = [sourceAirports[0]];
    }

    console.log("Resolved airport lists (final):", { sourceAirports, destinationAirports });

    // Use first source airport as the departure_id for SerpAPI requests
    const originAirportForSearch = sourceAirports.length > 0 ? sourceAirports[0] : source;
    console.log("Using origin airport for search:", originAirportForSearch);

    let flightData: any[] = [];
    let selectedAirportCode: string | null = null;

    // Fetch flight details if requested
    if (includeFlights) {
      const SERPAPI_API_KEY = Deno.env.get("SERPAPI_API_KEY");
      if (!SERPAPI_API_KEY) {
        console.warn("SERPAPI_API_KEY not configured, skipping flight details");
      } else {
        try {
          const flightDate = new Date(startDate).toISOString().split("T")[0];

          console.log("Fetching flights from", originAirportForSearch, "to destinations:", destinationAirports);

          const flightPromises = destinationAirports.map(async (destAirport) => {
            try {
              const serpApiUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${encodeURIComponent(
                originAirportForSearch,
              )}&arrival_id=${encodeURIComponent(destAirport)}&outbound_date=${flightDate}&type=2&api_key=${SERPAPI_API_KEY}`;

              const response = await fetch(serpApiUrl);

              if (response.ok) {
                const data = await response.json();

                if (data.best_flights && data.best_flights.length > 0) {
                  return data.best_flights.map((flight: any) => ({
                    destination: destAirport,
                    destinationName: flight.flights?.[flight.flights.length - 1]?.arrival_airport?.name || destAirport,
                    price: flight.price,
                    duration: flight.total_duration,
                    airline: flight.flights?.[0]?.airline || "Unknown",
                    route:
                      flight.flights?.map((leg: any) => ({
                        from: leg.departure_airport.id,
                        to: leg.arrival_airport.id,
                        fromName: leg.departure_airport.name,
                        toName: leg.arrival_airport.name,
                      })) || [],
                    departureTime: flight.flights?.[0]?.departure_airport?.time || "",
                    arrivalTime: flight.flights?.[flight.flights.length - 1]?.arrival_airport?.time || "",
                  }));
                }
              } else {
                console.error(`SerpAPI error for ${destAirport}:`, response.status);
              }
            } catch (error) {
              console.error(`Error fetching flights to ${destAirport}:`, error);
            }
            return [];
          });

          const allFlightResults = await Promise.all(flightPromises);
          flightData = allFlightResults.flat().sort((a, b) => (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER));

          // Select the cheapest airport code for the itinerary (if available)
          if (flightData.length > 0) {
            selectedAirportCode = flightData[0].destination || destinationAirports[0] || null;
            console.log("Selected airport code for itinerary:", selectedAirportCode);
          }
        } catch (flightError) {
          console.error("Error fetching flights:", flightError);
        }
      }
    }

    // Build the itinerary prompt (use original destination name for human-friendly location,
    // and include selectedAirportCode so model knows which airport traveler will arrive at)
    const arrivalInfo = selectedAirportCode ? `${destination} (arriving at airport ${selectedAirportCode})` : destination;
    const itineraryPrompt = `You are a professional travel planner with extensive knowledge of destinations worldwide. Create detailed, practical, and exciting travel itineraries.

Create a detailed, day-by-day travel itinerary with the following information:

Source: ${source}
Destination: ${arrivalInfo}
Travel Dates: ${startDate} to ${endDate}
Budget: $${budget} USD
Number of Travelers: ${travelers}
Interests: ${interests}

${flightData.length > 0 ? `Note: The traveler will be arriving at ${selectedAirportCode}, which has the best flight options. Base the itinerary starting from this location.` : ""}

Please provide:
1. A brief introduction to the destination
2. Day-by-day itinerary starting from Day 1 (first day after arrival) with specific activities, attractions, and restaurants
3. Accommodation suggestions within budget
4. Transportation tips
5. Budget breakdown
6. Important travel tips and local customs

Format the response in a clear, organized manner using markdown formatting with headers and bullet points. Do NOT include flight information in your response as it will be displayed separately.`;

    // Call Gemini to generate the itinerary
    const itineraryResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: itineraryPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
          },
        }),
      },
    );

    if (!itineraryResp.ok) {
      const errorText = await itineraryResp.text();
      console.error("AI Gateway error (itinerary):", itineraryResp.status, errorText);
      throw new Error(`AI Gateway error: ${itineraryResp.status}`);
    }

    const itineraryPayload = await itineraryResp.json();
    const itineraryText = itineraryPayload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    console.log("AI itinerary generated.");

    // Build final response object
    const responseBody = {
      airportCodes: {
        source: sourceAirports.length > 0 ? sourceAirports : null,
        destination: destinationAirports.length > 0 ? destinationAirports : null,
      },
      selectedAirportCode: selectedAirportCode, // null if none selected / no flight search done
      flightData: flightData.length > 0 ? flightData : null,
      itinerary: itineraryText,
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-travel-plan function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

