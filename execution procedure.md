# RoadVision AI - Execution Procedure

This document explains how to run the complete RoadVision AI system (Next.js frontend + FastAPI backend + MongoDB) on Windows.

## 1. Prerequisites

Install the following before starting:

- Node.js 20+ (recommended for Next.js 16)
- PNPM (recommended) or NPM
- Python 3.10 or 3.11
- MongoDB Community Server (running locally)
- Git (optional, for source control)

Optional but recommended:

- NVIDIA GPU + CUDA-compatible PyTorch (for faster inference)

## 2. Project Structure

Workspace root contains:

- Frontend (Next.js): root folder
- Backend (FastAPI): `backend/`
- YOLO model file: `backend/YOLOv11n.pt`

## 3. First-Time Setup

### 3.1 Frontend setup

From workspace root:

```bash
pnpm install
```

If PNPM is unavailable:

```bash
npm install
```

### 3.2 Backend setup

Open a new terminal and go to backend:

```bash
cd backend
```

Create virtual environment:

```bash
python -m venv .venv
```

Activate virtual environment (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

## 4. Database Setup (MongoDB)

Ensure MongoDB is running on:

```text
mongodb://localhost:27017/
```

Default backend DB config is in `backend/configs.py`:

- `MONGODB_URI = mongodb://localhost:27017/`
- `DB_NAME = roadvision_ai`
- `COLLECTION_NAME = pothole_coordinates`

You can override these with environment variables:

- `MONGODB_URI`
- `DB_NAME`
- `COLLECTION_NAME`

## 5. Run the System

Use two terminals.

### Terminal A: Start backend

From `backend/` with virtual environment active:

```bash
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Backend API docs:

- http://127.0.0.1:8000/docs

### Terminal B: Start frontend

From workspace root:

```bash
pnpm dev
```

If using npm:

```bash
npm run dev
```

Frontend URL:

- http://localhost:3000

## 6. How to Use the App

### 6.1 Detection page

1. Open http://localhost:3000
2. Upload a video in the Upload section.
3. Click Upload to start processing.
4. Watch annotated stream and status panel.

### 6.2 Map page

1. Click View Map.
2. Confirm pothole points appear on the map.
3. Use Clear Local Data to delete all saved records.

## 7. Quick Health Checks

If something is not working, test these endpoints in browser:

- http://127.0.0.1:8000/stream-status/
- http://127.0.0.1:8000/potholes/

Expected behavior:

- `stream-status` returns JSON with `device`, `pothole_detected`, and `is_processing`.
- `potholes` returns JSON list and count.

## 8. Known Notes for This Codebase

- The frontend includes calls to `/start-camera/`, but current backend `server.py` does not define that endpoint.
- Reliable flow right now is video upload -> `/upload/` -> `/stream/`.
- Ensure `backend/YOLOv11n.pt` exists before starting backend.
- Audio alerts depend on pygame and the beep file path (`BEEP_FILE_PATH` in `backend/configs.py`).

## 9. Troubleshooting

### Backend fails at startup

- Ensure virtual environment is active.
- Reinstall dependencies:

```bash
pip install -r requirements.txt --upgrade
```

- Confirm model file exists at `backend/YOLOv11n.pt`.

### Frontend cannot connect to backend

- Ensure backend is running at port 8000.
- Ensure frontend is running at port 3000.
- Check CORS origins in `backend/server.py` (localhost:3000 already allowed).

### Map shows database error

- Start MongoDB service.
- Confirm `MONGODB_URI` is reachable.
- Retry map page after backend reconnects.

### Geolocation not working

- Allow browser location permissions.
- Use localhost or HTTPS context.

## 10. Stop the System

In each terminal press:

```text
Ctrl + C
```

Deactivate Python virtual environment if needed:

```bash
deactivate
```
