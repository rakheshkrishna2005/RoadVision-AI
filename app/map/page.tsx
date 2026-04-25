"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Loader, Trash2, Calendar, MapPin, ZoomIn, Zap, Radio } from "lucide-react"
import Link from "next/link"

const Map = dynamic(() => import("@/components/pothole-map"), { ssr: false })

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

export default function MapPage() {
  const [potholes, setPotholes] = useState<Pothole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null)
  const isInitialFetch = useRef(true)

  const fetchPotholes = async () => {
    try {
      if (isInitialFetch.current) {
        setLoading(true)
      }
      const response = await fetch("http://127.0.0.1:8000/potholes/")
      const data = await response.json()

      if (data.error) {
        setError(`Database Error: ${data.error}. Make sure MongoDB is running.`)
      } else {
        setPotholes(data.potholes || [])
        setError(null)
      }
    } catch (err) {
      setError("Could not connect to the backend server. Make sure it is running on port 8000.")
      console.error("Error fetching potholes:", err)
    } finally {
      if (isInitialFetch.current) {
        setLoading(false)
        isInitialFetch.current = false
      }
    }
  }

  useEffect(() => {
    fetchPotholes()
    const interval = setInterval(fetchPotholes, 5000)
    return () => clearInterval(interval)
  }, [])

  const clearData = async () => {
    if (!confirm("Are you sure you want to delete all pothole history? This cannot be undone.")) return
    try {
      const response = await fetch("http://127.0.0.1:8000/potholes/clear/", { method: "POST" })
      if (!response.ok) throw new Error("Failed to clear data")
      setPotholes([])
      setSelectedPothole(null)
      alert("Search history cleared successfully.")
    } catch (err) {
      console.error("Error clearing data:", err)
      alert("Failed to clear data.")
    }
  }

  // Group potholes by date
  const groupedPotholes = potholes.reduce((acc: Record<string, Pothole[]>, pothole: Pothole) => {
    const date = new Date(pothole.timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(pothole)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm">Back</span>
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Detection Analytics</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Map & Historical Data Visualization</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={clearData}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-semibold border border-destructive/20 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Clear Local Data
              </button>
              <div className="h-10 w-[1px] bg-border mx-2" />
              <div className="text-right">
                <p className="text-lg font-bold text-foreground leading-none">{potholes.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Total Found</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading && (
          <div className="w-full h-96 bg-card border border-border rounded-xl flex items-center justify-center gap-3">
            <Loader className="w-6 h-6 text-primary animate-spin" />
            <p className="text-foreground">Syncing with database...</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-start gap-3">
            <div className="bg-destructive text-white p-1 rounded-full">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold">Sync Failure</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Total Count Widget */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Sighted</span>
              </div>
              <p className="text-3xl font-black text-foreground">{potholes.length}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                <span className="text-success font-bold">Live</span> Synchronized with DB
              </p>
            </div>

            {/* High Priority Widget */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">High Risk</span>
              </div>
              <p className="text-3xl font-black text-foreground">
                {potholes.filter(p => p.severity_level === "HIGH").length}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Requiring immediate attention</p>
            </div>

            {/* Hotspot Widget */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Main Hotspot</span>
              </div>
              <div className="h-9 flex items-center">
                <p className="text-sm font-bold text-foreground truncate leading-tight">
                  {(() => {
                    const counts = potholes.reduce((acc, p) => {
                      const name = p.street_name || "Unknown";
                      acc[name] = (acc[name] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None Detected";
                  })()}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-bold">MOST FREQUENT LOCATION</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
            <Map potholes={potholes} onPotholeSelect={setSelectedPothole} />
          </div>
        )}

        {/* Info Grid */}
        {!loading && !error && potholes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">Severity Distribution</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                    <span className="text-sm font-medium">Critical (High)</span>
                  </div>
                  <span className="text-sm font-bold bg-red-500/10 text-red-600 px-2.5 py-1 rounded-md">
                    {potholes.filter((p: Pothole) => p.severity_level === "HIGH").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                    <span className="text-sm font-medium">Moderate (Med)</span>
                  </div>
                  <span className="text-sm font-bold bg-orange-500/10 text-orange-600 px-2.5 py-1 rounded-md">
                    {potholes.filter((p: Pothole) => p.severity_level === "MEDIUM").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                    <span className="text-sm font-medium">Minor (Low)</span>
                  </div>
                  <span className="text-sm font-bold bg-yellow-500/10 text-yellow-600 px-2.5 py-1 rounded-md">
                    {potholes.filter((p: Pothole) => p.severity_level === "LOW").length}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Details Card */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Snapshot Details</h3>
                {selectedPothole && <span className="text-[10px] font-mono text-muted-foreground">ID: {selectedPothole.timestamp.slice(-6)}</span>}
              </div>

              {selectedPothole ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Geo-Coordinates</span>
                      <div className="flex items-center gap-2 text-sm font-mono bg-muted/50 p-2 rounded-lg border border-border/50">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {selectedPothole.latitude.toFixed(6)}, {selectedPothole.longitude.toFixed(6)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Estimated Size</span>
                      <div className="text-xl font-bold text-foreground">
                        {selectedPothole.diameter ? `${(selectedPothole.diameter * 100).toFixed(0)} cm` : "N/A"}
                        <span className="text-xs font-normal text-muted-foreground ml-2">diameter</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Nearest Reference</span>
                      <p className="text-sm font-semibold leading-snug">
                        {[selectedPothole.street_name, selectedPothole.city]
                          .filter(Boolean)
                          .join(", ") || "Active Navigation Point"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-4 py-1.5 rounded-full text-xs font-black text-white ${selectedPothole.severity_level === "HIGH" ? "bg-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.3)]" :
                        selectedPothole.severity_level === "MEDIUM" ? "bg-orange-500 shadow-[0_4px_12px_rgba(249,115,22,0.3)]" :
                          "bg-yellow-500 shadow-[0_4px_12px_rgba(234,179,8,0.3)]"
                        }`}>
                        {selectedPothole.severity_level} RISK
                      </div>
                      <span className="text-xs text-muted-foreground font-medium italic">
                        Captured at {new Date(selectedPothole.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <ZoomIn className="w-6 h-6 text-primary/30" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[200px]">Select any marker on the map to inspect granular data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Table - Grouped by Run Session */}
        {!loading && !error && potholes.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Longitudinal History</h3>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Historical Logs Grouped by Date</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {(Object.entries(groupedPotholes) as [string, Pothole[]][]).map(([date, items]) => (
                <div key={date} className="overflow-hidden group">
                  <div className="bg-muted/5 px-6 py-3 border-b border-border flex items-center gap-3">
                    <span className="text-xs font-black text-primary/70">{items.length} SESSIONS</span>
                    <h4 className="text-sm font-bold text-foreground">{date}</h4>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-muted/5 border-b border-border/40">
                          <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground/70">Timestamp</th>
                          <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground/70">Risk Profile</th>
                          <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground/70">Dimension</th>
                          <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground/70">Location Reference</th>
                          <th className="px-6 py-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {items
                          .sort((a: Pothole, b: Pothole) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .map((item: Pothole, idx: number) => (
                            <tr key={idx} className="hover:bg-primary/[0.02] transition-colors">
                              <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black tracking-tighter uppercase text-white ${item.severity_level === "HIGH" ? "bg-red-500" :
                                  item.severity_level === "MEDIUM" ? "bg-orange-500" :
                                    "bg-yellow-500"
                                  }`}>
                                  {item.severity_level}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-foreground">
                                {item.diameter ? `${(item.diameter * 100).toFixed(0)}cm` : "N/A"}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-muted-foreground truncate max-w-[200px]">
                                {item.street_name || "Regional Road Network"}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedPothole(item)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                  }}
                                  className="p-1.5 rounded-lg border border-border bg-white shadow-sm hover:border-primary/50 hover:bg-primary/5 text-primary transition-all"
                                  title="View Location"
                                >
                                  <ZoomIn className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && potholes.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-20 flex flex-col items-center justify-center text-center shadow-inner bg-gradient-to-b from-card to-muted/10">
            <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
              <MapPin className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Survey Data Found</h3>
            <p className="text-sm text-muted-foreground max-w-[300px]">The database is currently clear. Run the AI live stream to populate this dashboard with real-time detections.</p>
          </div>
        )}
      </main>
    </div>
  )
}