import math

CAMERA_HEIGHT_M = 1.15
CAMERA_PITCH_DEG = 20
CAMERA_PITCH_RAD = math.radians(CAMERA_PITCH_DEG)
FX = 1387
FY = 1040
CX = 960
CY = 540
MODEL_PATH = "YOLOv11n.pt"
DEFAULT_CLASSES = ["pothole"]

# MongoDB Configuration
MONGODB_URI = "mongodb://localhost:27017/"
DB_NAME = "roadvision_ai"
COLLECTION_NAME = "pothole_coordinates"

# Detection Configuration
POTHOLE_DETECTION_INTERVAL = 10  # seconds between saves/beeps for consecutive detections
BEEP_FILE_PATH = "beep.mp3"
