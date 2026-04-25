import cv2, math, numpy as np, configs
import torch
from ultralytics import YOLO

# Device setup
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("====================================")
print(f"Device: {'GPU' if DEVICE == 'cuda' else 'CPU'}")
print("====================================")

model = YOLO(configs.MODEL_PATH)
model.to(DEVICE)


def get_pothole_metrics(x1, y1, x2, y2, frame_w, frame_h):
    """
    Computes real-world metrics based on dynamically adjusted frame resolution.
    - Z: distance ahead (meters)
    - diameter_m: pothole width in meters
    """
    # Adjust camera intrinsics based on current frame resolution
    scale_x = frame_w / 1920.0
    scale_y = frame_h / 1080.0
    
    fx = configs.FX * scale_x
    fy = configs.FY * scale_y
    cx = frame_w / 2.0
    cy = frame_h * (configs.CY / 1080.0)

    v_bottom = y2

    # Vertical pixel location relative to camera center
    y_cam = (v_bottom - cy) / fy

    # Distance ahead (meters)
    denom = math.sin(configs.CAMERA_PITCH_RAD) + y_cam * math.cos(configs.CAMERA_PITCH_RAD)
    if denom <= 0.01: 
        return 0.0, 0.0

    Z = configs.CAMERA_HEIGHT_M / denom

    # Pixel width of bounding box → real-world width
    w_px = x2 - x1
    diameter_m = (w_px / fx) * Z

    return Z, diameter_m

def process_frame(frame):
    """
    Annotate the frame EXACTLY like Streamlit:
    → '3.25 m ahead, 28 cm'
    """
    results = model(frame, conf=0.3, classes=[0])
    annotated_frame = frame.copy()
    h, w = frame.shape[:2]
    pothole_data = []

    for box, score in zip(
        results[0].boxes.xyxy.cpu().numpy(),
        results[0].boxes.conf.cpu().numpy()
    ):
        x1, y1, x2, y2 = box

        # Compute distance + diameter with frame dimensions
        Z, diameter = get_pothole_metrics(x1, y1, x2, y2, w, h)
        
        # Ensure we don't return plain 0 for detections
        Z = max(Z, 0.5) 
        diameter = max(diameter, 0.05)
        if diameter < 0.05: diameter = 0.15 # Fallback

        # Format label
        label = f"{Z:.2f} m ahead, {diameter*100:.0f} cm"

        # Draw bounding box
        cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
        
        # Draw label background
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(annotated_frame, (int(x1), int(y1) - th - 10), (int(x1) + tw, int(y1)), (0, 0, 255), -1)
        
        # Draw text
        cv2.putText(annotated_frame, label, (int(x1), int(y1) - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        pothole_data.append({
            "distance": Z,
            "diameter": diameter,
            "bbox": [float(x1), float(y1), float(x2), float(y2)]
        })

    return annotated_frame, pothole_data
