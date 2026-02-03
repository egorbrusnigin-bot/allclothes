"use client";

import { useState, useEffect } from "react";
import { Map, Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { getCountryFlag } from "../lib/countryFlags";

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

  // Всегда показываем широкий обзор Европы
  const [viewState, setViewState] = useState({
    longitude: 15.0, // Центр Европы
    latitude: 50.0,
    zoom: 3.5, // Широкий обзор
    pitch: 60, // 3D наклон
    bearing: -17, // Поворот
  });

  // Попап рендерится сразу, но будет невидимым из-за CSS анимации
  useEffect(() => {
    setShowPopup(!!selectedBrand);
  }, [selectedBrand]);

  // MapTiler ключ (бесплатно 100k запросов/месяц)
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "get_your_own_OpIi9ZULNHzrESv6T2vL";

  // Темный минималистичный стиль: черная земля, белое море
  const mapStyle = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;

  // Если нет ключа, показываем сообщение
  if (!MAPTILER_KEY || MAPTILER_KEY === "get_your_own_OpIi9ZULNHzrESv6T2vL") {
    return (
      <div style={{
        height: "calc(100vh - 300px)",
        minHeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "#fff",
        textAlign: "center",
        padding: 40
      }}>
        <div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 16,
            color: "#fff"
          }}>
            3D Карта Брендов
          </div>
          <div style={{
            fontSize: 11,
            lineHeight: 1.8,
            color: "#999",
            marginBottom: 20,
            maxWidth: 400
          }}>
            Для отображения 3D карты нужен бесплатный ключ MapTiler<br/>
            (100,000 запросов/месяц бесплатно)
          </div>
          <a
            href="https://cloud.maptiler.com/auth/widget"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#fff",
              background: "#000",
              padding: "12px 24px",
              textDecoration: "none",
              transition: "all 0.2s ease",
              border: "1px solid #333"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.color = "#000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#000";
              e.currentTarget.style.color = "#fff";
            }}
          >
            Получить Бесплатный Ключ →
          </a>
          <div style={{
            fontSize: 9,
            color: "#666",
            marginTop: 20,
            lineHeight: 1.6
          }}>
            После регистрации добавь ключ в .env.local:<br/>
            NEXT_PUBLIC_MAPTILER_KEY=твой_ключ_здесь
          </div>
        </div>
      </div>
    );
  }

  return (
    <Map
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ height: "calc(100vh - 300px)", minHeight: 500, width: "100%" }}
      mapStyle={mapStyle}
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
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.6)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.15)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 12px rgba(0, 0, 0, 0.6)";
              }}
            >
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  style={{
                    width: 30,
                    height: 30,
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
              display: "block",
              padding: 8,
              width: 160,
              maxWidth: 160,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
              const arrow = e.currentTarget.querySelector(".popup-arrow");
              if (arrow) (arrow as HTMLElement).style.color = "#000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              const arrow = e.currentTarget.querySelector(".popup-arrow");
              if (arrow) (arrow as HTMLElement).style.color = "#666";
            }}
          >
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 4,
              color: "#000",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              {selectedBrand.name}
            </div>

            {selectedBrand.city && (
              <div style={{
                fontSize: 9,
                color: "#666",
                marginBottom: 8,
                letterSpacing: 0.3,
                display: "flex",
                alignItems: "center",
                gap: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {selectedBrand.city}, {selectedBrand.country} {selectedBrand.country && getCountryFlag(selectedBrand.country)}
              </div>
            )}

            {selectedBrand.description && (
              <div style={{
                fontSize: 9,
                color: "#999",
                lineHeight: 1.5,
                marginBottom: 8
              }}>
                {selectedBrand.description.length > 50
                  ? selectedBrand.description.slice(0, 50) + "..."
                  : selectedBrand.description}
              </div>
            )}

            <div
              className="popup-arrow"
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "#666",
                transition: "color 0.2s ease"
              }}
            >
              →
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
          border-radius: 2px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
          background: rgba(255, 255, 255, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          transition: all 0.2s ease !important;
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
