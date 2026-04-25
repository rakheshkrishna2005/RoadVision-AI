from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import cv2, tempfile, time, os
from datetime import datetime, timezone
import detection
from detection import process_frame
import threading, configs
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

try:
    import pygame
    pygame.mixer.init()
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    print("[WARNING] pygame not installed. Audio alerts disabled.")

app = FastAPI()

# Allow frontend dev server (localhost:3000) to access this API
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

client = MongoClient(os.getenv("MONGODB_URI", configs.MONGODB_URI))
db = client[os.getenv("DB_NAME", configs.DB_NAME)]
pothole_collection = db[os.getenv("COLLECTION_NAME", configs.COLLECTION_NAME)]

geolocator = Nominatim(user_agent="roadvision_ai")

def get_location_details(lat, lng):
    """Get location details using reverse geocoding with improved timeout and retry"""
    try:
        # Increased timeout to 20 seconds to be more robust
        location = geolocator.reverse((lat, lng), timeout=20)
        if location and location.raw.get('address'):
            address = location.raw['address']
            # Get the most specific name available
            street = address.get('road', address.get('suburb', address.get('neighbourhood', '')))
            city = address.get('city', address.get('town', address.get('village', address.get('county', ''))))
            
            return {
                'street_name': street,
                'city': city,
                'country': address.get('country', ''),
                'postal_code': address.get('postcode', '')
            }
    except Exception as e:
        print(f"[GEO] Geocoding error: {e}")
    return {}

def calculate_severity(distance, diameter):
    """Categorize pothole into 3 levels based on diameter"""
    # Simple categorization
    if diameter > 0.6:  # Above 60cm
        return "HIGH"
    elif diameter >= 0.3:  # Between 30-60cm
        return "MEDIUM"
    else:  # Below 30cm
        return "LOW"

video_path = None
stop_flag = False
last_saved_time = 0
last_beep_time = 0
last_detection_flag_time = 0
pothole_detection_interval = configs.POTHOLE_DETECTION_INTERVAL  # seconds
detection_flag_timeout = 5  # seconds visibility for frontend polling

# Store last detected pothole data
last_pothole_data = None
pothole_count = 0

def play_beep_sound():
    """Play beep sound alert"""
    global last_beep_time
    now = time.time()
    
    # Only play beep if enough time has passed (10 seconds)
    if now - last_beep_time < pothole_detection_interval:
        return
        
    last_beep_time = now
    
    if not AUDIO_AVAILABLE:
        print("[AUDIO] pygame not available, skipping beep")
        return
    
    beep_file = os.getenv("BEEP_FILE_PATH", configs.BEEP_FILE_PATH)
    if os.path.exists(beep_file):
        try:
            pygame.mixer.Sound(beep_file).play()
            print(f"[AUDIO] Beep played from {beep_file}")
        except Exception as e:
            print(f"[AUDIO] Error playing sound: {e}")
    else:
        print(f"[AUDIO] Beep file not found: {beep_file}")

def mark_pothole_detected():
    """Record the timestamp of the most recent pothole detection"""
    global last_detection_flag_time
    last_detection_flag_time = time.time()


def save_pothole_location(lat, lng, source="AI"):
    """Save detected pothole with reverse geocoding and metrics"""
    global last_pothole_data, pothole_count
    try:
        location_details = get_location_details(lat, lng)
        
        distance = 0.0  # manual/default
        diameter = 0.0  # manual/default
        severity = "MEDIUM" # default
        
        if source == "AI" and last_pothole_data:
            distance = last_pothole_data.get('distance', 3.0)
            diameter = last_pothole_data.get('diameter', 0.15)
            if diameter < 0.05: diameter = 0.15
            severity = calculate_severity(distance, diameter)
        elif source == "MANUAL":
            severity = "HIGH" # Treat manual reports as urgent
        
        doc = {
            "latitude": float(lat),
            "longitude": float(lng),
            "timestamp": datetime.now(timezone.utc),
            "severity_level": severity,
            "distance": float(distance),
            "diameter": float(diameter),
            "source": source,
            "street_name": location_details.get('street_name', 'Street Near Coordinates'),
            "city": location_details.get('city', 'Detected City'),
            "country": location_details.get('country', ''),
            "postal_code": location_details.get('postal_code', '')
        }
        
        result = pothole_collection.insert_one(doc)
        print(f"[DB] Pothole saved ({source}) at {lat}, {lng} - Severity: {severity}")
        
        # Audio alert per 2 potholes
        pothole_count += 1
        if pothole_count % 2 == 0:
            beep_thread = threading.Thread(target=play_beep_sound, daemon=True)
            beep_thread.start()
    except Exception as e:
        print(f"[DB] Error saving pothole: {e}")

is_processing = False

def video_generator():
    global stop_flag, last_pothole_data, is_processing
    is_processing = True
    cap = cv2.VideoCapture(video_path)
    
    try:
        while cap.isOpened() and not stop_flag:
            ret, frame = cap.read()
            if not ret:
                break
            
            annotated, pothole_data = process_frame(frame)

            if len(pothole_data) > 0:
                print(f"[DETECTION] {len(pothole_data)} pothole(s) detected in frame")
                mark_pothole_detected()
                # Store the last detected pothole data
                if pothole_data:
                    last_pothole_data = pothole_data[0]  # Take the first one

            _, buffer = cv2.imencode('.jpg', annotated)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()
        is_processing = False

@app.post("/upload/")
async def upload_video(file: UploadFile = File(...)):
    """Upload video file for streaming"""
    global video_path, stop_flag, is_processing
    stop_flag = False
    is_processing = False # Reset on new upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        temp.write(await file.read())
        video_path = temp.name
    return JSONResponse({"message": "Video uploaded successfully."})

@app.get("/stream/")
async def stream_video():
    """Stream annotated video frames"""
    return StreamingResponse(video_generator(),
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.post("/stop/")
async def stop_stream():
    """Stop stream manually"""
    global stop_flag, last_detection_flag_time, is_processing
    stop_flag = True
    is_processing = False
    last_detection_flag_time = 0
    return JSONResponse({"message": "Streaming stopped."})

@app.post("/potholes/clear/")
async def clear_potholes():
    """Delete all pothole records from the database"""
    try:
        result = pothole_collection.delete_many({})
        return JSONResponse({"message": f"Successfully deleted {result.deleted_count} records."})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/save-coordinates/")
async def save_coordinates(data: dict, background_tasks: BackgroundTasks):
    """Save coordinates when pothole detected"""
    lat = data.get("lat")
    lng = data.get("lng")
    source = data.get("source", "AI")
    if lat and lng:
        background_tasks.add_task(save_pothole_location, lat, lng, source)
        return {"status": "queued"}
    return {"error": "invalid coordinates"}

@app.post("/report-manual/")
async def report_manual(data: dict, background_tasks: BackgroundTasks):
    """Save manual coordinate report from user tap"""
    lat = data.get("lat")
    lng = data.get("lng")
    if lat and lng:
        background_tasks.add_task(save_pothole_location, lat, lng, "MANUAL")
        return {"status": "reported"}
    return {"error": "invalid coordinates"}

@app.get("/stream-status/")
async def stream_status():
    """Tells frontend if pothole was detected recently and if processing is ongoing"""
    global is_processing
    device = getattr(detection, "DEVICE", "cpu")
    pothole_recent = (time.time() - last_detection_flag_time) <= detection_flag_timeout if last_detection_flag_time else False
    return {"pothole_detected": pothole_recent, "device": device, "is_processing": is_processing}

@app.get("/potholes/")
async def get_all_potholes():
    """Fetch all pothole coordinates from MongoDB"""
    try:
        potholes = list(pothole_collection.find({}, {"_id": 0}))
        return JSONResponse({"potholes": jsonable_encoder(potholes), "count": len(potholes)})
    except Exception as e:
        print(f"[DB] Error fetching potholes: {e}")
        return JSONResponse({"potholes": [], "count": 0, "error": str(e)})

@app.get("/potholes/stats/")
async def get_pothole_stats():
    """Get statistics about detected potholes"""
    try:
        count = pothole_collection.count_documents({})
        return JSONResponse({"total_potholes": count})
    except Exception as e:
        print(f"[DB] Error getting stats: {e}")
        return JSONResponse({"total_potholes": 0, "error": str(e)})