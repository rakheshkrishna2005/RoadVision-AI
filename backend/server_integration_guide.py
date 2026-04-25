"""
Integration Guide: Connecting Enhanced Detection Logging to server.py

This file shows how to integrate the new analytics system with your existing server.py
"""

# ============================================
# STEP 1: Add imports at top of server.py
# ============================================

# Add these imports after existing imports in server.py:
"""
from detection_logger import DetectionLogger
from analytics_api import setup_analytics_routes
from analytics_processor import AnalyticsProcessor
from database_schema import COLLECTIONS
"""

# ============================================
# STEP 2: Initialize detection logger and analytics processor
# ============================================

# Add after MongoDB client initialization (around line 35-37):
"""
# Initialize detection logger
detection_logger = DetectionLogger(
    db_client=db,
    crop_save_dir="pothole_crops",
    save_crops=True
)

# Initialize analytics processor (runs every 5 minutes)
analytics_processor = AnalyticsProcessor(
    db_client=db,
    clustering_method="dbscan",  # or "time_window"
    run_interval_seconds=300,  # 5 minutes
    auto_start=True  # Start automatically
)
"""

# ============================================
# STEP 3: Modify video_generator to log detections
# ============================================

# Replace the existing video_generator function (lines 105-124) with:
"""
def video_generator():
    global stop_flag
    cap = cv2.VideoCapture(video_path)
    
    frame_id = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    while cap.isOpened() and not stop_flag:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Calculate video time
        video_time = frame_id / fps
        
        # Process frame
        annotated, pothole_data = process_frame(frame)

        # Log detections to database
        if len(pothole_data) > 0:
            print(f"[DETECTION] {len(pothole_data)} pothole(s) detected in frame {frame_id}")
            mark_pothole_detected()
            
            # Save each detection to extended database
            for pothole in pothole_data:
                try:
                    detection_id = detection_logger.save_detection(
                        frame=frame,
                        frame_id=frame_id,
                        video_time=video_time,
                        bbox=pothole['bbox'],
                        confidence=pothole['confidence'],
                        distance=pothole['distance'],
                        diameter=pothole['diameter'],
                        is_wet=pothole['is_wet'],
                        variance=pothole['variance'],
                        latitude=None,  # Can be populated from GPS if available
                        longitude=None
                    )
                    print(f"[DB] Saved detection: {detection_id}")
                except Exception as e:
                    print(f"[DB] Error saving detection: {e}")

        _, buffer = cv2.imencode('.jpg', annotated)
        yield (b'--frame\\r\\n'
               b'Content-Type: image/jpeg\\r\\n\\r\\n' + buffer.tobytes() + b'\\r\\n')
        
        frame_id += 1
    
    cap.release()
    
    # Trigger analytics after video completes
    print("[ANALYTICS] Video processing complete, triggering analytics...")
    analytics_processor.trigger_manual_run()
"""

# ============================================
# STEP 4: Add analytics API routes
# ============================================

# Add before the if __name__ == "__main__" block:
"""
# Setup analytics API routes
setup_analytics_routes(app, db)

# Setup analytics processor control routes
from analytics_processor import setup_analytics_processor_routes
setup_analytics_processor_routes(app, analytics_processor)
"""

# ============================================
# STEP 5: Add cleanup on shutdown
# ============================================

# Add at the end of the file:
"""
@app.on_event("shutdown")
async def shutdown_event():
    '''Cleanup on server shutdown'''
    analytics_processor.stop()
    print("[ANALYTICS] Analytics processor stopped")
"""

# ============================================
# COMPLETE UPDATED server.py EXAMPLE
# ============================================

COMPLETE_SERVER_EXAMPLE = '''
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import cv2, tempfile, time, os
from datetime import datetime
import detection
from detection import process_frame
import threading

# NEW IMPORTS
from detection_logger import DetectionLogger
from analytics_api import setup_analytics_routes
from analytics_processor import AnalyticsProcessor, setup_analytics_processor_routes
from database_schema import COLLECTIONS

try:
    import pygame
    pygame.mixer.init()
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    print("[WARNING] pygame not installed. Audio alerts disabled.")

app = FastAPI()

# CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
db = client[os.getenv("DB_NAME", "roadvision_ai")]
pothole_collection = db[os.getenv("COLLECTION_NAME", "pothole_coordinates")]

# NEW: Initialize detection logger
detection_logger = DetectionLogger(
    db_client=db,
    crop_save_dir="pothole_crops",
    save_crops=True
)

# NEW: Initialize analytics processor
analytics_processor = AnalyticsProcessor(
    db_client=db,
    clustering_method="dbscan",
    run_interval_seconds=300,
    auto_start=True
)

video_path = None
stop_flag = False
last_saved_time = 0
last_beep_time = 0
last_detection_flag_time = 0
pothole_detection_interval = 10
detection_flag_timeout = 5

def play_beep_sound():
    global last_beep_time
    now = time.time()
    
    if now - last_beep_time < pothole_detection_interval:
        return
    
    last_beep_time = now
    
    if not AUDIO_AVAILABLE:
        print("[AUDIO] pygame not available, skipping beep")
        return
    
    beep_file = os.getenv("BEEP_FILE_PATH", "beep.mp3")
    if os.path.exists(beep_file):
        try:
            pygame.mixer.Sound(beep_file).play()
            print(f"[AUDIO] Beep played from {beep_file}")
        except Exception as e:
            print(f"[AUDIO] Error playing sound: {e}")
    else:
        print(f"[AUDIO] Beep file not found: {beep_file}")

def mark_pothole_detected():
    global last_detection_flag_time
    last_detection_flag_time = time.time()

def save_pothole_location(lat, lng):
    global last_saved_time
    now = time.time()
    
    if now - last_saved_time < pothole_detection_interval:
        print("[DB] Skipped — within 10-second cooldown window.")
        return
    
    last_saved_time = now
    
    try:
        doc = {
            "latitude": float(lat),
            "longitude": float(lng),
            "timestamp": datetime.utcnow(),
            "distance_category": "detected"
        }
        result = pothole_collection.insert_one(doc)
        print(f"[DB] Pothole stored at ({lat}, {lng}) - ID: {result.inserted_id}")
        
        beep_thread = threading.Thread(target=play_beep_sound, daemon=True)
        beep_thread.start()
    except Exception as e:
        print(f"[DB] Error saving pothole: {e}")

# UPDATED: Enhanced video generator with detection logging
def video_generator():
    global stop_flag
    cap = cv2.VideoCapture(video_path)
    
    frame_id = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    while cap.isOpened() and not stop_flag:
        ret, frame = cap.read()
        if not ret:
            break
        
        video_time = frame_id / fps
        
        annotated, pothole_data = process_frame(frame)

        if len(pothole_data) > 0:
            print(f"[DETECTION] {len(pothole_data)} pothole(s) detected in frame {frame_id}")
            mark_pothole_detected()
            
            for pothole in pothole_data:
                try:
                    detection_id = detection_logger.save_detection(
                        frame=frame,
                        frame_id=frame_id,
                        video_time=video_time,
                        bbox=pothole['bbox'],
                        confidence=pothole['confidence'],
                        distance=pothole['distance'],
                        diameter=pothole['diameter'],
                        is_wet=pothole['is_wet'],
                        variance=pothole['variance']
                    )
                    print(f"[DB] Saved: {detection_id}")
                except Exception as e:
                    print(f"[DB] Error: {e}")

        _, buffer = cv2.imencode('.jpg', annotated)
        yield (b'--frame\\r\\n'
               b'Content-Type: image/jpeg\\r\\n\\r\\n' + buffer.tobytes() + b'\\r\\n')
        
        frame_id += 1
    
    cap.release()
    print("[ANALYTICS] Triggering analytics...")
    analytics_processor.trigger_manual_run()

@app.post("/upload/")
async def upload_video(file: UploadFile = File(...)):
    global video_path, stop_flag
    stop_flag = False
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        temp.write(await file.read())
        video_path = temp.name
    return JSONResponse({"message": "Video uploaded successfully."})

@app.get("/stream/")
async def stream_video():
    return StreamingResponse(video_generator(),
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.post("/stop/")
async def stop_stream():
    global stop_flag, last_detection_flag_time
    stop_flag = True
    last_detection_flag_time = 0
    return JSONResponse({"message": "Streaming stopped."})

@app.post("/save-coordinates/")
async def save_coordinates(data: dict, background_tasks: BackgroundTasks):
    lat = data.get("lat")
    lng = data.get("lng")
    if lat and lng:
        background_tasks.add_task(save_pothole_location, lat, lng)
        return {"status": "queued"}
    return {"error": "invalid coordinates"}

@app.get("/stream-status/")
async def stream_status():
    device = getattr(detection, "DEVICE", "cpu")
    pothole_recent = (time.time() - last_detection_flag_time) <= detection_flag_timeout if last_detection_flag_time else False
    return {"pothole_detected": pothole_recent, "device": device}

@app.get("/potholes/")
async def get_all_potholes():
    try:
        potholes = list(pothole_collection.find({}, {"_id": 0, "timestamp": 0}))
        return JSONResponse({"potholes": potholes, "count": len(potholes)})
    except Exception as e:
        print(f"[DB] Error fetching potholes: {e}")
        return JSONResponse({"potholes": [], "count": 0, "error": str(e)})

@app.get("/potholes/stats/")
async def get_pothole_stats():
    try:
        count = pothole_collection.count_documents({})
        return JSONResponse({"total_potholes": count})
    except Exception as e:
        print(f"[DB] Error getting stats: {e}")
        return JSONResponse({"total_potholes": 0, "error": str(e)})

# NEW: Setup analytics routes
setup_analytics_routes(app, db)
setup_analytics_processor_routes(app, analytics_processor)

@app.on_event("shutdown")
async def shutdown_event():
    analytics_processor.stop()
    print("[ANALYTICS] Processor stopped")
'''

if __name__ == "__main__":
    print("Server Integration Guide")
    print("=" * 50)
    print("\nFollow the steps above to integrate analytics into server.py")
    print("\nOr use the COMPLETE_SERVER_EXAMPLE as reference")
