"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface Pothole {
  latitude: number
  longitude: number
  timestamp: string
  severity_level: string
  distance: number
  diameter: number
  street_name?: string
  city?: string
  country?: string
  postal_code?: string
}

interface PotholeMapProps {
  potholes: Pothole[]
  onPotholeSelect?: (pothole: Pothole | null) => void
}

export default function PotholeMap({ potholes, onPotholeSelect }: PotholeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  const getPotholeIcon = (severity: string, count: number = 1) => {
    let color = "#ef4444" // red-500 for HIGH
    if (severity === "MEDIUM") color = "#f97316" // orange-500
    if (severity === "LOW") color = "#eab308" // yellow-500

    const text = count > 1 ? count.toString() : ""
    const size = count > 1 ? 26 : 18

    return L.divIcon({
      html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-family: sans-serif; font-size: 11px;">${text}</div>`,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -12],
    })
  }

  useEffect(() => {
    // Initialize map only once
    if (map.current) return
    if (!mapContainer.current) return

    // Fix for default Leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    })

    const defaultCenter: L.LatLngExpression = [12.9716, 77.5946] // Bangalore
    map.current = L.map(mapContainer.current).setView(defaultCenter, 13)

    // Try to center on user's real location if no potholes found
    if (potholes.length === 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 13)
      })
    } else if (potholes.length > 0) {
      map.current.setView([potholes[0].latitude, potholes[0].longitude], 13)
    }

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current)

    // Ensure map renders correctly
    setTimeout(() => {
      map.current?.invalidateSize()
    }, 100)
  }, [])

  useEffect(() => {
    if (!map.current) return

    // Clear existing markers
    markersRef.current.forEach((marker) => map.current?.removeLayer(marker))
    markersRef.current = []

    // Group potholes by exact matching vicinity (up to 4 decimal places)
    const groupedPotholes: Record<string, { count: number; potholes: Pothole[] }> = {}
    potholes.forEach((p) => {
      const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`
      if (!groupedPotholes[key]) {
        groupedPotholes[key] = { count: 1, potholes: [p] }
      } else {
        groupedPotholes[key].count += 1
        groupedPotholes[key].potholes.push(p)
      }
    })

    // Add new grouped markers
    Object.values(groupedPotholes).forEach((group, index) => {
      const latest = group.potholes[0]
      const icon = getPotholeIcon(latest.severity_level, group.count)
      const timestamp = new Date(latest.timestamp).toLocaleString()
      const location = [latest.street_name, latest.city, latest.country].filter(Boolean).join(", ") || "Unknown location"
      
      const title = group.count > 1 ? `${group.count} Potholes Detected Here` : `Pothole #${index + 1}`

      const marker = L.marker([latest.latitude, latest.longitude], { icon })
        .bindPopup(
          `<div style="min-width: 150px;">
             <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${title}</h3>
             <div style="font-size: 12px; line-height: 1.5;">
               <p><strong>Max Severity:</strong> <span style="background: ${latest.severity_level === 'HIGH' ? '#ef4444' : latest.severity_level === 'MEDIUM' ? '#f97316' : '#eab308'}; color: white; padding: 2px 6px; border-radius: 4px;">${latest.severity_level}</span></p>
               <p><strong>Est. Diameter:</strong> ${latest.diameter ? (latest.diameter * 100).toFixed(0) + 'cm' : 'Processing...'}</p>
               <p><strong>Location:</strong> ${location}</p>
               <p style="margin-top: 4px; color: #666;">Last seen: ${timestamp}</p>
             </div>
           </div>`,
        )
        .on("click", () => {
          if (onPotholeSelect) onPotholeSelect(latest)
        })
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds or set view
    if (potholes.length > 1 && map.current) {
      const group = new L.FeatureGroup(markersRef.current)
      map.current.fitBounds(group.getBounds().pad(0.2))
    } else if (potholes.length === 1 && map.current) {
      map.current.setView([potholes[0].latitude, potholes[0].longitude], 16)
    }
  }, [potholes])

  return <div ref={mapContainer} className="w-full h-96 md:h-[600px] bg-muted rounded-xl shadow-inner relative z-0" />
}
