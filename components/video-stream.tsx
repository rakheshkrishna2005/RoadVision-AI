"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"

interface PotholeCoordinates {
  lat: string
  lng: string
}

export default function VideoStream() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [coordinates, setCoordinates] = useState<PotholeCoordinates | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [device, setDevice] = useState("cpu")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getFileDisplayName = (file: File | null) => {
    if (!file) return "No file chosen"
    return file.name.length > 40 ? file.name.substring(0, 37) + "..." : file.name
  }

  const getCurrentLocation = () => {
    setIsGettingLocation(true)
    setLocationError("")

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser")
      setIsGettingLocation(false)
      return
    }

    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      setLocationError("Geolocation requires HTTPS connection. Please use HTTPS or localhost.")
      setIsGettingLocation(false)
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        })
        setIsGettingLocation(false)
      },
      (error) => {
        let errorMessage = "Unable to retrieve your location. "
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Permission denied."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location unavailable."
            break
          case error.TIMEOUT:
            errorMessage += "Request timed out."
            break
          default:
            errorMessage += "Unknown error."
        }
        setLocationError(errorMessage)
        setIsGettingLocation(false)
      },
      options,
    )
  }

  // Start streaming: upload a file if one is selected, otherwise request backend to start camera
  const startStream = async () => {
    setLocationError("")
    if (videoFile) {
      const formData = new FormData()
      formData.append("file", videoFile)
      try {
        await axios.post("http://127.0.0.1:8000/upload/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 15000,
        })
        setStreaming(true)
        setUploadProgress(0)
      } catch (err) {
        console.error("Upload error:", err)
        const message = err instanceof axios.AxiosError ? err.response?.data?.detail || err.message : "Network error"
        alert("Upload failed: " + message + "\nMake sure the backend (uvicorn) is running on port 8000.")
      }
    } else {
      // No file selected: start backend camera capture
      try {
        await axios.post("http://127.0.0.1:8000/start-camera/", null, { timeout: 5000 })
        setStreaming(true)
      } catch (err) {
        console.error("Start camera error:", err)
        alert("Could not start camera stream. Make sure the backend can access a camera device and uvicorn is running on port 8000.")
      }
    }
  }

  const stopStream = async () => {
    try {
      await axios.post("http://127.0.0.1:8000/stop/", null, { timeout: 5000 })
    } catch (err) {
      console.error("Stop stream error:", err)
    }
    setStreaming(false)
  }

  // Backend camera streaming controls for Live Camera panel
  const startCamera = async () => {
    setCameraError("")
    try {
      await axios.post("http://127.0.0.1:8000/start-camera/", null, { timeout: 5000 })
      setCameraActive(true)
    } catch (err) {
      setCameraError("Could not start backend camera stream. Make sure the backend can access a camera device and uvicorn is running on port 8000.")
      console.error("Start backend camera error:", err)
    }
  }

  const stopCamera = async () => {
    try {
      await axios.post("http://127.0.0.1:8000/stop/", null, { timeout: 5000 })
    } catch (err) {
      setCameraError("Could not stop backend camera stream.")
      console.error("Stop backend camera error:", err)
    }
    setCameraActive(false)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (streaming) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get("http://127.0.0.1:8000/stream-status/")
          if (res.data.device) setDevice(res.data.device)
          if (res.data.pothole_detected) {
            console.log("Pothole detected — capturing location...")
            getCurrentLocation()
          }
        } catch (error) {
          console.error("Error polling status:", error)
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [streaming])

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/stream-status/")
      .then((res) => res.data?.device && setDevice(res.data.device))
      .catch((err) => console.warn("Could not fetch device info:", err))
  }, [])

  useEffect(() => {
    if (coordinates) {
      axios
        .post("http://127.0.0.1:8000/save-coordinates/", coordinates)
        .then(() => {
          console.log("Sent coordinates to backend:", coordinates)
        })
        .catch((err) => console.error("Error sending coordinates:", err))
    }
  }, [coordinates])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Column: 3 Control Boxes */}
        <div className="lg:col-span-1 space-y-5">
          {/* File Upload Section */}
          <div className="space-y-2">
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                Upload
              </h2>

              <div className="space-y-2 flex-1 flex flex-col">
                <label className="flex items-center justify-center w-full border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all bg-muted/30 flex-1">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      setVideoFile(e.target.files?.[0] || null)
                      setLocationError("")
                    }}
                    className="hidden"
                  />
                  <div className="text-center">
                    <svg
                      className="w-6 h-6 mx-auto mb-1 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs font-semibold text-foreground">{getFileDisplayName(videoFile)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click to select</p>
                  </div>
                </label>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!videoFile) return alert("Please select a video first")
                      const formData = new FormData()
                      formData.append("file", videoFile)
                      try {
                        await axios.post("http://127.0.0.1:8000/upload/", formData, {
                          headers: { "Content-Type": "multipart/form-data" },
                          timeout: 15000,
                        })
                        setStreaming(true)
                        setUploadProgress(0)
                      } catch (err) {
                        console.error("Upload error:", err)
                        const message = err instanceof axios.AxiosError ? err.response?.data?.detail || err.message : "Network error"
                        alert("Upload failed: " + message + "\nMake sure the backend (uvicorn) is running on port 8000.")
                      }
                    }}
                    disabled={!videoFile || streaming}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1 text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {streaming ? "Streaming..." : "Upload"}
                  </button>

                  <button
                    onClick={stopStream}
                    disabled={!streaming}
                    className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold py-2 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs border border-destructive/20"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-info/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              Status
            </h2>

            <div className="space-y-2">
              {/* Live Indicator - Colorful Badge */}
              <div className="flex items-center justify-between p-2 bg-muted/40 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Stream Status</p>
                </div>
                <div className={streaming ? "status-live" : "status-offline"}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${streaming ? "bg-current animate-pulse" : ""}`} />
                  {streaming ? "Live" : "Offline"}
                </div>
              </div>

              {/* Device Info - Colorful Badge */}
              <div className="flex items-center justify-between p-2 bg-muted/40 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Computing</p>
                </div>
                <div className="badge-accent">
                  <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {device.toUpperCase()}
                </div>
              </div>

              {/* Location Status */}
              {isGettingLocation && (
                <div className="flex items-center justify-between p-2 bg-info/10 rounded-lg border border-info/20">
                  <p className="text-xs text-info font-semibold">Getting location...</p>
                  <svg
                    className="w-3 h-3 text-info animate-spin flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              )}

              {coordinates && (
                <div className="p-2 bg-success/10 rounded-lg border border-success/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-semibold">📍 Location</p>
                    <span className="badge-success">Detected</span>
                  </div>
                  <div className="space-y-0.5 bg-white rounded p-1.5">
                    <p className="text-xs font-mono text-foreground">Lat: {coordinates.lat}</p>
                    <p className="text-xs font-mono text-foreground">Lng: {coordinates.lng}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Camera Panel */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              Live Camera
            </h2>

            <div className="space-y-2 flex flex-col">
              {/* Camera Status */}
              <div className="flex items-center justify-between p-2 bg-muted/40 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Camera Status</p>
                </div>
                <div className={cameraActive ? "status-live" : "status-offline"}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${cameraActive ? "bg-current animate-pulse" : ""}`} />
                  {cameraActive ? "Active" : "Inactive"}
                </div>
              </div>

              {/* Error Message */}
              {cameraError && (
                <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-xs text-destructive font-semibold">{cameraError}</p>
                </div>
              )}

              {/* Camera Control Buttons */}
              <div className="flex gap-2 flex-1">
                <button
                  onClick={startCamera}
                  disabled={cameraActive}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1 text-xs"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Turn On
                </button>

                <button
                  onClick={stopCamera}
                  disabled={!cameraActive}
                  className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold py-2 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs border border-destructive/20"
                >
                  Turn Off
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Video Display */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="relative bg-black/80 flex items-center justify-center flex-1">
              {(streaming || cameraActive) ? (
                <>
                  <img
                    src="http://127.0.0.1:8000/stream/"
                    alt={cameraActive ? "Camera stream" : "Video stream"}
                    className="w-full h-full object-contain"
                    onError={() => cameraActive ? setCameraError("Stream disconnected. Please try again.") : setLocationError("Stream disconnected. Please try again.")}
                  />
                  <div className={`absolute top-4 right-4 flex items-center gap-2 ${cameraActive ? "bg-purple-600" : "bg-success"} text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg`}>
                    <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                    {cameraActive ? "Camera Active" : "Live Feed"}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground py-24">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-center text-sm max-w-xs font-medium">
                    {"Turn on live camera to stream from backend device camera or upload a video file."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {locationError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 flex items-start gap-3 text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="font-semibold">{locationError}</p>
        </div>
      )}
    </div>
  )
}