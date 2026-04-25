<h1 align="center">🛣️ RoadVision AI</h1>

<p align="center">
AI-powered <b>Pothole Detection & Measurement</b> using YOLOv11 and Next.js with FastAPI backend.
</p>

<p align="center">
  <!-- Tech Stack Badges -->
  <img src="https://img.shields.io/badge/Python-3.9%2B-blue?logo=python&logoColor=white" alt="Python Badge">
  <img src="https://img.shields.io/badge/Next.js-Frontend-000000?logo=next.js&logoColor=white" alt="Next.js Badge">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" alt="FastAPI Badge">
  <img src="https://img.shields.io/badge/YOLOv8, YOLOv11-Detection-success?logo=github&logoColor=white" alt="YOLOv8 Badge">
  <img src="https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8?logo=opencv&logoColor=white" alt="OpenCV Badge">
  <img src="https://img.shields.io/badge/PyTorch-Deep%20Learning-EE4C2C?logo=pytorch&logoColor=white" alt="PyTorch Badge">
</p>

---

## 📖 Project Description  

RoadVision AI is designed to work with a **fixed dashboard-mounted smartphone camera** (90° aligned, slightly tilted down).  
It automatically detects potholes, computes how far they are from your car, and estimates their diameter — in real-time.

Key features:
- ✅ **YOLOv8/11-based pothole detection** (fast & lightweight)  
- ✅ **Distance + diameter calculation** from camera intrinsics  
- ✅ **Web-based UI** built with Next.js and React  
- ✅ **Real-time video streaming** with webcam support  
- ✅ **Geolocation tracking** for detected potholes  
- ✅ **Audio alerts** for pothole detection  
- ✅ **Interactive map visualization** of pothole locations  
- ✅ **Configurable camera setup** via `configs.py`  

---

## 🛠️ Tech Stack  

| Component         | Technology Used          | Purpose                                   |
|------------------|-----------------------|-----------------------------------------|
| **Frontend/UI**   | Next.js, React, TypeScript, Tailwind CSS | Modern web dashboard for video preview & metrics |
| **Backend/API**   | FastAPI, Python       | REST API for video processing and data management |
| **Database**      | MongoDB               | Storage for pothole geolocation data |
| **Model**         | Ultralytics YOLOv8/11 | Object detection (potholes)              |
| **Backend Logic** | Python (OpenCV, NumPy) | Frame processing, bounding box math       |
| **ML Engine**     | PyTorch               | Model inference (CPU/GPU support)        |
| **Visualization** | OpenCV Drawing APIs, Leaflet.js | Annotated bounding boxes + map visualization |
| **Alerts**        | Pygame                | Audio beep alerts for pothole detection |

---

## ⚙️ Configuration  

All user-specific camera settings and model parameters are kept in **`configs.py`** for easy calibration.

```python
# Camera Setup
CAMERA_HEIGHT_M = 1.15      # Height from road to camera lens (meters)
CAMERA_PITCH_DEG = 20       # Pitch angle of camera (degrees)
CAMERA_PITCH_RAD = math.radians(CAMERA_PITCH_DEG)

# Camera Intrinsics
FX = 1387                   # Focal length (x-axis, px)
FY = 1040                   # Focal length (y-axis, px)
CX = 960                    # Principal point x (px)
CY = 540                    # Principal point y (px)

# YOLO Model
MODEL_PATH = "YOLOv11n.pt"  # Path to trained YOLO model
DEFAULT_CLASSES = ["pothole"]
```

---

## 🧮 How Distance & Diameter Are Calculated

This project uses **camera geometry** to convert bounding boxes into real-world distances.

### 1️⃣ From YOLO Detection

YOLO gives bounding box coordinates `(x1, y1, x2, y2)` in pixels.

### 2️⃣ Distance Calculation

We use the bottom of the box (`y2`) to estimate distance:

$$
y_\text{cam} = \frac{(y_2 - c_y)}{f_y}
$$

$$
Z = \frac{h}{\sin(\theta) + y_\text{cam} \cdot \cos(\theta)}
$$

Where:

* $h$ = camera height (meters)
* $\theta$ = camera pitch angle (radians)
* $c_y, f_y$ = principal point y & focal length y (px)

This gives **Z** = forward distance (meters) from camera to pothole.

### 3️⃣ Diameter Calculation

Bounding box width in pixels:

$$
w_\text{px} = x_2 - x_1
$$

Convert to meters:

$$
\text{Diameter (m)} = \left(\frac{w_\text{px}}{f_x}\right) \cdot Z
$$

Where:

* $f_x$ = focal length x (px)

---

## 🔊 Audio Alerts

When a pothole is detected, the system plays an audible beep sound to alert the driver. This feature uses Pygame for audio playback and is designed to reduce driver distraction by only playing alerts at reasonable intervals (10-second cooldown period).

---

## 🌍 Geolocation Features

The system captures GPS coordinates when potholes are detected and stores them in MongoDB. These coordinates can be visualized on an interactive map using Leaflet.js, allowing users to see all detected potholes in their area.

---
## 📷 Screenshots

<p align="center">
  <img src="/screenshots/screenshot1.png" alt="Dashboard View" width="340" />
  <img src="/screenshots/screenshot2.png" alt="Map View" width="340" />
</p>

---
## 🚀 How to Run

### Backend (FastAPI Server)

1. **Navigate to the backend directory**

```bash
cd backend
```

2. **Install Python dependencies**

```bash
pip install -r requirements.txt
```

3. **Run the FastAPI server**

```bash
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend (Next.js App)

1. **Install dependencies**

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. **Run the development server**

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

3. **Open your browser**
   Visit `http://localhost:3000` to see the dashboard.

### Current Detection Flow

- Use the Upload workflow (`/upload/` + `/stream/`) for pothole detection.
- The frontend has camera-start calls (`/start-camera/`), but that backend endpoint is not currently defined in `server.py`.

### MongoDB Setup

Make sure MongoDB is running on your system. By default, the application connects to `mongodb://localhost:27017/`. You can customize the connection using environment variables:

- `MONGODB_URI`: MongoDB connection string
- `DB_NAME`: Database name (default: roadvision_ai)
- `COLLECTION_NAME`: Collection name (default: pothole_coordinates)

---

## 👥 Team

- **Rakhesh Krishna P** — rakheshkrishnap@gmail.com — [GitHub](https://github.com/rakheshkrishna2005)
- **Mohnish K J** — mohnishkj@gmail.com — [GitHub](https://github.com/MohnishKJ)

---



