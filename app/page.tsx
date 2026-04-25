"use client"
import VideoStream from "@/components/video-stream"
import { MapPin, Radio, Zap, Map, Lock } from 'lucide-react'
import Link from "next/link"
import { useState } from "react"

export default function Page() {
  const [isStreaming, setIsStreaming] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <MapPin className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">RoadVision AI</h1>
                  <div className="flex items-center gap-1.5 badge-success">
                    <Radio className="w-3 h-3" />
                    <span>LIVE</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-accent" />
                  <p className="text-xs text-muted-foreground font-medium">Real-time Pothole Detection</p>
                </div>
              </div>
            </div>

            {isStreaming ? (
              <div className="flex items-center gap-2 bg-muted text-muted-foreground py-2.5 px-4 rounded-lg cursor-not-allowed border border-border">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-semibold text-foreground italic">Processing Video...</span>
              </div>
            ) : (
              <Link href="/map">
                <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md">
                  <Map className="w-4 h-4" />
                  <span className="text-sm">View Map</span>
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VideoStream onStreamingChange={setIsStreaming} />
      </main>
    </div>
  )
}
