// server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const PROPERTYDATA_API_KEY = process.env.PROPERTYDATA_API_KEY;

if (!PROPERTYDATA_API_KEY) {
  console.warn("⚠️  PROPERTYDATA_API_KEY is not set in .env");
}

// ================================
// 🛠️ Helper Functions
// ================================

function normalizePostcode(pc) {
  if (!pc) return "";
  return pc.trim().toUpperCase().replace(/\s+/g, " ");
}

function getOutcode(fullPostcode) {
  return fullPostcode.split(" ")[0];
}

function isValidUKPostcode(postcode) {
  const regex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;
  return regex.test(postcode);
}

function tryAutoFormatPostcode(input) {
  let cleaned = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleaned.length < 5 || cleaned.length > 7) return null;
  const formatted = cleaned.slice(0, -3) + " " + cleaned.slice(-3);
  return isValidUKPostcode(formatted) ? formatted : null;
}

async function callPropertyDataAPI(url) {
  console.log(`🌐 Calling PropertyData API: ${url}`);
  try {
    const response = await axios.get(url, { timeout: 10000 });
    console.log(`✅ API responded with status: ${response.status}`);
    return response;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error("❌ API call timed out");
    } else if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, error.response.data);
    } else {
      console.error("❌ Network/Unknown error:", error.message);
    }
    throw error;
  }
}

// ================================
// 🚀 Main Valuation Route
// ================================

app.post("/api/valuation", async (req, res) => {
  console.log("\n" + "=".repeat(50));
  console.log("📩 Incoming Valuation Request");
  console.log("=".repeat(50));

  try {
    const { postalCode, propertyType, purpose, bedrooms } = req.body;
    console.log("➡️ Raw Request Body:", req.body);

    // === Validation: Required fields ===
    if (!postalCode || !propertyType || !purpose) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "Missing required fields: postalCode, propertyType, purpose" });
    }

    const validPropertyTypes = ["detached", "semi-detached", "terraced", "flat", "maisonette", "bungalow"];
    if (!validPropertyTypes.includes(propertyType)) {
      console.log("❌ Invalid property type:", propertyType);
      return res.status(400).json({ error: `Invalid property type. Must be one of: ${validPropertyTypes.join(", ")}` });
    }

    if (!["sale", "rent"].includes(purpose)) {
      console.log("❌ Invalid purpose:", purpose);
      return res.status(400).json({ error: "Purpose must be 'sale' or 'rent'" });
    }

    // For rent, bedrooms is required
    if (purpose === "rent") {
      if (!bedrooms || !["1", "2", "3", "4"].includes(bedrooms)) {
        console.log("❌ Missing or invalid bedrooms for rent");
        return res.status(400).json({ error: "Number of bedrooms (1-4) is required for rental estimates" });
      }
    }

    // === Step 1: Normalize & validate postcode ===
    let fullPostcode = normalizePostcode(postalCode);
    console.log(`📝 Normalized postcode: "${fullPostcode}"`);

    if (!isValidUKPostcode(fullPostcode)) {
      console.log("🔍 Postcode invalid — attempting auto-format...");
      const autoFormatted = tryAutoFormatPostcode(postalCode);
      if (autoFormatted) {
        fullPostcode = autoFormatted;
        console.log(`✅ Auto-formatted to: "${fullPostcode}"`);
      } else {
        console.log("❌ Could not auto-format postcode");
        return res.status(400).json({ error: "Invalid UK postcode format. Example: SW1A 1AA" });
      }
    }

    const outcode = getOutcode(fullPostcode);
    console.log(`📍 Full postcode: ${fullPostcode} | Outcode: ${outcode}`);

    // === Step 2: Handle based on purpose ===
    if (purpose === "rent") {
      console.log("🏠 Handling RENT valuation...");

      let data = null;

      // Try 1: demand-rent with outcode
      try {
        const url = `https://api.propertydata.co.uk/demand-rent?key=${PROPERTYDATA_API_KEY}&postcode=${outcode}`;
        const response = await callPropertyDataAPI(url);
        if (response.data.status !== "error") {
          data = response.data;
          console.log("✅ Got rental data from /demand-rent (outcode)");
        }
      } catch (e) {
        console.warn("⚠️ /demand-rent failed for outcode:", outcode);
      }

      // Try 2: Parent outcode
      if (!data && outcode.length > 3) {
        const parentOutcode = outcode.slice(0, -1);
        console.log(`🔄 Trying parent outcode: ${parentOutcode}`);
        try {
          const url = `https://api.propertydata.co.uk/demand-rent?key=${PROPERTYDATA_API_KEY}&postcode=${parentOutcode}`;
          const response = await callPropertyDataAPI(url);
          if (response.data.status !== "error") {
            data = response.data;
            console.log("✅ Got rental data from parent outcode");
          }
        } catch (e) {
          console.warn("⚠️ /demand-rent failed for parent outcode:", parentOutcode);
        }
      }

      // Try 3: Fallback to /local-market
      if (!data) {
        console.log("🔁 Fallback: using /local-market with full postcode");
        try {
          const url = `https://api.propertydata.co.uk/local-market?key=${PROPERTYDATA_API_KEY}&postcode=${fullPostcode}`;
          const response = await callPropertyDataAPI(url);
          data = response.data;
          console.log("✅ Got fallback data from /local-market");
        } catch (e) {
          console.error("💥 All rent data sources failed");
          return res.status(404).json({
            error: "No rental market data available for this area. Try a nearby postcode.",
          });
        }
      }

      // Extract base rent
      let baseRent = data.rent?.average;
      let adjustedRent = "N/A";
      let adjustmentNote = "";

      if (baseRent && !isNaN(baseRent)) {
        const base = parseFloat(baseRent);
        const bed = parseInt(bedrooms, 10);

        // UK rental multipliers (based on national trends)
        const multipliers = { 1: 0.8, 2: 1.0, 3: 1.3, 4: 1.6 };
        const multiplier = multipliers[bed] || 1.0;

        adjustedRent = Math.round(base * multiplier);
        adjustmentNote = `Adjusted from area average (£${base.toLocaleString()}) for a ${bed}-bedroom property.`;
      }

      const result = {
        type: "rent",
        postcode: data.postcode || fullPostcode,
        rentalDemand: data.rental_demand_rating || data.demand_rating || "N/A",
        totalForRent: data.total_for_rent || "N/A",
        daysOnMarket: data.days_on_market || "N/A",
        monthsOfInventory: data.months_of_inventory || "N/A",
        averageRent: adjustedRent,
        originalAverageRent: baseRent || "N/A",
        yield: data.yield?.average || "N/A",
        note: adjustmentNote || null,
      };

      console.log("📊 Final RENT result:", result);
      return res.json(result);
    }

    // === SALE PURPOSE ===
    if (purpose === "sale") {
      console.log("💰 Handling SALE valuation...");

      let saleData = null;
      let usedType = propertyType;

      try {
        const url = `https://api.propertydata.co.uk/sold-prices?key=${PROPERTYDATA_API_KEY}&postcode=${fullPostcode}&type=${propertyType}&max_age=12`;
        const response = await callPropertyDataAPI(url);
        saleData = response.data;

        if (saleData.status === "error") {
          throw new Error(JSON.stringify(saleData));
        }
      } catch (error) {
        if (error.response?.data?.code === "902" && error.response.data.message.includes("type")) {
          console.warn(`⚠️ Property type '${propertyType}' not available in ${fullPostcode}. Falling back to all types.`);
          try {
            const fallbackUrl = `https://api.propertydata.co.uk/sold-prices?key=${PROPERTYDATA_API_KEY}&postcode=${fullPostcode}&max_age=12`;
            const fallbackRes = await callPropertyDataAPI(fallbackUrl);
            saleData = fallbackRes.data;
            usedType = "all";
            if (saleData.status === "error") {
              throw new Error("Fallback also failed");
            }
          } catch (fallbackError) {
            console.error("💥 Fallback to unfiltered sale data also failed");
            return res.status(404).json({
              error: `No recent sale data for ${propertyType} properties in ${fullPostcode}. This area may not have this property type.`,
            });
          }
        } else {
          throw error;
        }
      }

      const result = {
        type: "sale",
        postcode: saleData.postcode || fullPostcode,
        propertyType: usedType === "all" ? `${propertyType} (not found – showing area average)` : propertyType,
        average: saleData.data?.average || "N/A",
        range70: saleData.data?.["70pc_range"] || [],
        range90: saleData.data?.["90pc_range"] || [],
        pointsAnalysed: saleData.data?.points_analysed || 0,
        note: usedType === "all"
          ? `⚠️ No recent sales for "${propertyType}" in this postcode. Showing overall area average.`
          : null,
      };

      console.log("📊 Final SALE result:", result);
      return res.json(result);
    }

  } catch (error) {
    console.log("🚨 UNEXPECTED ERROR in /api/valuation");
    console.error("❗ Error:", error.message);
    console.error("Stack:", error.stack);

    res.status(500).json({
      error: "Failed to fetch valuation. Please try again later.",
    });
  }

  console.log("=".repeat(50) + "\n");
});

app.listen(PORT, () => {
  console.log(`🚀 Valuation API server running on http://localhost:${PORT}`);
  console.log(`🔑 Using PropertyData API key: ${PROPERTYDATA_API_KEY ? "✅ Set" : "❌ Missing"}`);
});