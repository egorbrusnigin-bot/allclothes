"use client";

import { useState, useEffect } from "react";
import { Map, Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { getCountryFlag } from "../lib/countryFlags";
import { useIsMobile } from "../lib/useIsMobile";

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  description: string | null;
}

interface MapComponentProps {
  brands: Brand[];
}

export default function MapComponent({ brands }: MapComponentProps) {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const isMobile = useIsMobile();

  // Всегда показываем широкий обзор Европы
  const [viewState, setViewState] = useState({
    longitude: 15.0, // Центр Европы
    latitude: 50.0,
    zoom: 2.5,
    pitch: 0,
    bearing: 0,
  });

  // Попап рендерится сразу, но будет невидимым из-за CSS анимации
  useEffect(() => {
    setShowPopup(!!selectedBrand);
  }, [selectedBrand]);

  // MapTiler ключ (бесплатно 100k запросов/месяц)
  const MAPTILER_KEY = "9hHsiyw0AhSLha7YVTQ0";

  // Темный минималистичный стиль: черная земля, белое море
  const mapStyle = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;

  return (
    <Map
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ height: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 300px)", minHeight: isMobile ? 350 : 500, width: "100%" }}
      mapStyle={mapStyle}
      projection="globe"
    >
      {brands.map((brand) => {
        if (!brand.latitude || !brand.longitude) return null;

        return (
          <Marker
            key={brand.id}
            longitude={brand.longitude}
            latitude={brand.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedBrand(brand);
            }}
          >
            <div
              style={{
                cursor: "pointer",
                background: "#fff",
                border: "2px solid #000",
                borderRadius: "50%",
                width: isMobile ? 36 : 48,
                height: isMobile ? 36 : 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                willChange: "transform",
              }}
            >
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  loading="lazy"
                  style={{
                    width: isMobile ? 22 : 30,
                    height: isMobile ? 22 : 30,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#000",
                }}>
                  {brand.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </Marker>
        );
      })}

      {selectedBrand && showPopup && (
        <Popup
          longitude={selectedBrand.longitude || 0}
          latitude={selectedBrand.latitude || 0}
          anchor="top"
          onClose={() => setSelectedBrand(null)}
          closeButton={true}
          closeOnClick={false}
          offset={15}
          maxWidth="none"
        >
          <Link
            href={`/brand/${selectedBrand.slug}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              width: 240,
              maxWidth: 240,
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {selectedBrand.logo_url ? (
              <img
                src={selectedBrand.logo_url}
                alt={selectedBrand.name}
                style={{
                  width: 44,
                  height: 44,
                  objectFit: "contain",
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "#f5f5f5",
                  padding: 4,
                }}
              />
            ) : (
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {selectedBrand.name.charAt(0)}
              </div>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                marginBottom: 3,
                color: "#000",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {selectedBrand.name}
              </div>

              {selectedBrand.city && (
                <div style={{
                  fontSize: 10,
                  color: "#888",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  marginBottom: 4,
                }}>
                  {selectedBrand.city}, {selectedBrand.country} {selectedBrand.country && getCountryFlag(selectedBrand.country)}
                </div>
              )}

              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#000",
                opacity: 0.5,
              }}>
                View brand →
              </div>
            </div>
          </Link>
        </Popup>
      )}

      <style jsx global>{`
        @keyframes popupSmoothAppear {
          0%, 70% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        .maplibregl-popup,
        .mapboxgl-popup {
          animation: popupSmoothAppear 0.35s ease-out forwards !important;
        }

        .maplibregl-popup-content,
        .mapboxgl-popup-content {
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
          background: #fff !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          overflow: hidden !important;
        }

        .maplibregl-popup-close-button,
        .mapboxgl-popup-close-button {
          font-size: 18px !important;
          padding: 8px 12px !important;
          color: #000 !important;
          transition: all 0.2s ease !important;
          font-weight: 400 !important;
          opacity: 0.5 !important;
        }

        .maplibregl-popup-close-button:hover,
        .mapboxgl-popup-close-button:hover {
          opacity: 1 !important;
          color: #000 !important;
          background: rgba(0, 0, 0, 0.05) !important;
        }

        .maplibregl-popup-anchor-top .maplibregl-popup-tip,
        .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
          border-bottom-color: rgba(255, 255, 255, 0.98) !important;
          border-left-color: transparent !important;
          border-right-color: transparent !important;
        }

        .maplibregl-ctrl-attrib,
        .mapboxgl-ctrl-attrib {
          font-size: 8px !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #fff !important;
        }

        .maplibregl-ctrl-attrib a,
        .mapboxgl-ctrl-attrib a {
          color: #fff !important;
        }

        .maplibregl-ctrl-logo,
        .mapboxgl-ctrl-logo {
          opacity: 0.2 !important;
          filter: invert(1);
        }
      `}</style>
    </Map>
  );
}
