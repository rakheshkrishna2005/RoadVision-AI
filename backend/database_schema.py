"""
Enhanced Database Schema for RoadVision-AI with Location and Severity Details
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class PotholeDetection(BaseModel):
    """
    Enhanced detection record with location and severity details
    """
    detection_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    severity_level: str  # LOW, MEDIUM, HIGH
    distance: float  # meters
    diameter: float  # meters
    street_name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

COLLECTIONS = {
    "detections": "pothole_detections",
}
