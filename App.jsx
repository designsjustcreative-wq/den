import React, { useState } from "react";
import "./App.css";

const ValuationForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    postalCode: "",
    propertyType: "",
    purpose: "",
    bedrooms: "",
    floorArea: "",
  });

  const [showResult, setShowResult] = useState(false);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "postalCode") {
      const formatted = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/(.{3})$/, " $1");
      setFormData({ ...formData, postalCode: formatted.trim() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;
    if (!postcodeRegex.test(formData.postalCode)) {
      alert("Please enter a valid UK postcode (e.g. SW1A 1AA)");
      return;
    }

    if (formData.purpose === "rent" && !formData.bedrooms) {
      alert("Please select number of bedrooms for rental estimate");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        postalCode: formData.postalCode.trim().toUpperCase(),
        propertyType: formData.propertyType,
        purpose: formData.purpose,
      };

      if (formData.purpose === "rent") {
        payload.bedrooms = formData.bedrooms;
        // floorArea is optional, omit if empty
        if (formData.floorArea) payload.floorArea = formData.floorArea;
      }

      const res = await fetch("http://localhost:5000/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setValuation(data);
        setShowResult(true);
      } else {
        setValuation(null);
        setShowResult(true);
      }
    } catch (error) {
      console.error("❌ Error fetching valuation:", error);
      setValuation(null);
      setShowResult(true);
    } finally {
      setLoading(false);
    }
  };

  const closePopup = () => {
    setShowResult(false);
    setValuation(null);
  };

  const getPropertyTypeName = (type) => {
    const map = {
      detached: "Detached House",
      "semi-detached": "Semi-Detached",
      terraced: "Terraced House",
      flat: "Flat / Apartment",
      maisonette: "Maisonette",
      bungalow: "Bungalow",
    };
    return map[type] || type;
  };

  return (
    <div className="valuation-container">
      <div className="header">
        <h1>ONLINE ESTATE AGENT</h1>
        <h2>Free Instant Online Valuation</h2>
      </div>

      <div className="form-wrapper">
        <form className="valuation-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <div className="input-icon">
              <i className="icon-user"></i>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <div className="input-icon">
              <i className="icon-email"></i>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Postcode */}
          <div className="form-group">
            <div className="input-icon">
              <i className="icon-postal"></i>
              <input
                type="text"
                name="postalCode"
                placeholder="Postcode (e.g. SW1A 1AA)"
                value={formData.postalCode}
                onChange={handleChange}
                required
                maxLength="8"
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="form-group">
            <div className="input-icon">
              <i className="icon-property"></i>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleChange}
                required
              >
                <option value="">Property Type</option>
                <option value="detached">Detached House</option>
                <option value="semi-detached">Semi-Detached</option>
                <option value="terraced">Terraced House</option>
                <option value="flat">Flat / Apartment</option>
                <option value="maisonette">Maisonette</option>
                <option value="bungalow">Bungalow</option>
              </select>
            </div>
          </div>

          {/* Purpose */}
          <div className="form-group">
            <div className="input-icon">
              <i className="icon-purpose"></i>
              <select
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
              >
                <option value="">Purpose</option>
                <option value="sale">Sell / Purchase</option>
                <option value="rent">Rent</option>
              </select>
            </div>
          </div>

          {/* Bedrooms (only for rent) */}
          {formData.purpose === "rent" && (
            <div className="form-group">
              <div className="input-icon">
                <i className="icon-bed"></i>
                <select
                  name="bedrooms"
                  value={formData.bedrooms}
                  onChange={handleChange}
                  required
                >
                  <option value="">Number of Bedrooms</option>
                  <option value="1">1 Bedroom</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                </select>
              </div>
            </div>
          )}

          {/* Floor Area (optional, for rent) */}
          {formData.purpose === "rent" && (
            <div className="form-group">
              <div className="input-icon">
                <i className="icon-size"></i>
                <input
                  type="number"
                  name="floorArea"
                  placeholder="Floor Area (sq ft)"
                  value={formData.floorArea}
                  onChange={handleChange}
                  min="200"
                  max="5000"
                />
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="terms">
            <p>
              By selecting "Get my Valuation," you agree to be contacted via
              email regarding your property valuation request. You can opt out
              at any time. You also confirm that you have read and accepted our
              Terms.
            </p>
          </div>

          <button type="submit" className="valuation-button" disabled={loading}>
            {loading ? "Fetching..." : "GET MY VALUATION"}
          </button>
        </form>
      </div>

      {/* Popup for Valuation Result */}
      {showResult && (
        <div className="popup-overlay">
          <div
            className={`popup-content ${
              valuation?.type === "rent" ? "rent-popup" : "sale-popup"
            }`}
          >
            <button className="close-btn" onClick={closePopup}>
              ×
            </button>

            {!valuation ? (
              <>
                <h2>⚠️ Valuation Unavailable</h2>
                <p>
                  We couldn't fetch valuation data for this postcode and property type.
                  Please try a nearby area or contact us for a manual estimate.
                </p>
              </>
            ) : (
              <>
                <h2>
                  {valuation.type === "rent"
                    ? "Rental Market Insights"
                    : "Property Valuation Estimate"}
                </h2>

                {valuation.note && (
                  <div className="warning-note">
                    <strong>ℹ️ Estimate adjusted:</strong> {valuation.note}
                  </div>
                )}

                <div className="valuation-result">
                  <div className="result-item">
                    <span className="label">Postcode:</span>
                    <span className="value">{valuation.postcode}</span>
                  </div>

                  {/* SALE RESULTS */}
                  {valuation.type === "sale" && (
                    <>
                      <div className="result-item">
                        <span className="label">
                          {valuation.note
                            ? "Area Average Sale Value (all types):"
                            : `Estimated Value for ${getPropertyTypeName(formData.propertyType)}:`}
                        </span>
                        <span className="value">
                          {valuation.average !== "N/A"
                            ? `£${Number(valuation.average).toLocaleString()}`
                            : "N/A"}
                        </span>
                      </div>

                      {valuation.range70?.length === 2 && (
                        <div className="result-item">
                          <span className="label">Typical Range (70%):</span>
                          <span className="value">
                            £{Number(valuation.range70[0]).toLocaleString()} – £
                            {Number(valuation.range70[1]).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="result-item">
                        <span className="label">Data Points Analyzed:</span>
                        <span className="value">{valuation.pointsAnalysed}</span>
                      </div>
                    </>
                  )}

                  {/* RENT RESULTS */}
                  {valuation.type === "rent" && (
                    <>
                      <div className="result-item">
                        <span className="label">Estimated Monthly Rent:</span>
                        <span className="value">
                          {valuation.averageRent !== "N/A"
                            ? `£${Number(valuation.averageRent).toLocaleString()}/month`
                            : "N/A"}
                        </span>
                      </div>

                      {valuation.originalAverageRent &&
                        valuation.originalAverageRent !== valuation.averageRent && (
                          <div className="result-item">
                            <span className="label">Area Average Rent:</span>
                            <span className="value">
                              £{Number(valuation.originalAverageRent).toLocaleString()}/month
                            </span>
                          </div>
                        )}

                      <div className="result-item">
                        <span className="label">Rental Demand:</span>
                        <span className="value">{valuation.rentalDemand}</span>
                      </div>
                      <div className="result-item">
                        <span className="label">Total for Rent:</span>
                        <span className="value">{valuation.totalForRent}</span>
                      </div>
                      <div className="result-item">
                        <span className="label">Days on Market:</span>
                        <span className="value">{valuation.daysOnMarket}</span>
                      </div>
                      <div className="result-item">
                        <span className="label">Months of Inventory:</span>
                        <span className="value">{valuation.monthsOfInventory}</span>
                      </div>
                    </>
                  )}
                </div>

                <p className="valuation-note">
                  {valuation.type === "rent"
                    ? "This rental estimate is adjusted based on number of bedrooms and local market data."
                    : "This estimate is based on recent market data from PropertyData."}
                  Actual values may vary based on property condition, size, and features.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValuationForm;