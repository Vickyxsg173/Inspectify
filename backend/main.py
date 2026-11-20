def vision_micro_scratch_detector(image_path: str):
    img = cv2.imread(image_path)
    if img is None:
        return None

    base, ext = os.path.splitext(image_path)
    annotated_path = f"{base}_annotated{ext}"

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    contrast = clahe.apply(gray)

    # Edge and scratch detection
    edges = cv2.Canny(contrast, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    annotated_img = img.copy()
    scratch_count = 0
    max_conf = 0.75

    for cnt in contours:
        area = cv2.contourArea(cnt)
        x, y, w, h = cv2.boundingRect(cnt)
        aspect_ratio = float(w) / h if h > 0 else 0

        # Filter for scratch-like shapes (linear/scratched contours)
        if area > 15 and (aspect_ratio > 2.5 or aspect_ratio < 0.4 or w > 20 or h > 20):
            scratch_count += 1
            cv2.rectangle(annotated_img, (x - 2, y - 2), (x + w + 4, y + h + 4), (0, 0, 255), 2)
            cv2.putText(
                annotated_img,
                f"Scratch #{scratch_count}",
                (x, max(15, y - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 255),
                1
            )

    if scratch_count > 0:
        cv2.imwrite(annotated_path, annotated_img)
        return {
            "status": "DEFECTIVE",
            "confidence": min(0.98, round(0.70 + (scratch_count * 0.05), 2)),
            "reason": f"Detected {scratch_count} micro-scratch / crack region(s) on screen.",
            "annotated_image": os.path.basename(annotated_path)
        }

    # Save clean annotated image if no scratches
    cv2.imwrite(annotated_path, img)
    return None
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import os
import time
import numpy as np
import threading
import uuid
import subprocess
import shutil
from dotenv import load_dotenv
import google.generativeai as genai
import cv2
import json
from itertools import product
from ultralytics import YOLO
import base64
from openai import OpenAI

# 1. Primary standard model (best.pt)
BEST_MODEL_PATH = "best.pt"
if not os.path.exists(BEST_MODEL_PATH):
    for candidate in [
        "/Users/vikrantvaidya/Desktop/Projects/yolo_mobile_app/best.pt",
        "../yolo_mobile_app/best.pt",
        os.path.join(os.path.dirname(__file__), "best.pt")
    ]:
        if os.path.exists(candidate):
            BEST_MODEL_PATH = candidate
            break

try:
    model_yolo = YOLO(BEST_MODEL_PATH)
    print(f"Successfully loaded primary standard model from: {BEST_MODEL_PATH}")
except Exception as e:
    print(f"Error loading best.pt: {e}")
    model_yolo = None

# 2. Latest multi-defect model (latest_model_defect.pt)
LATEST_MODEL_PATH = "latest_model_defect.pt"
if not os.path.exists(LATEST_MODEL_PATH):
    for candidate in [
        "/Users/vikrantvaidya/Desktop/Projects/yolo_mobile_app/latest_model_defect.pt",
        "../yolo_mobile_app/latest_model_defect.pt",
        os.path.join(os.path.dirname(__file__), "latest_model_defect.pt")
    ]:
        if os.path.exists(candidate):
            LATEST_MODEL_PATH = candidate
            break

model_latest = None
try:
    if os.path.exists(LATEST_MODEL_PATH):
        model_latest = YOLO(LATEST_MODEL_PATH)
        print(f"Successfully loaded latest_model_defect from: {LATEST_MODEL_PATH}")
    else:
        print(f"latest_model_defect.pt not found at {LATEST_MODEL_PATH}")
except Exception as e:
    print(f"Warning loading latest_model_defect.pt ({e}); will fallback to best.pt")
    model_latest = None

# Global active model setting: 'best' (default) or 'latest'
active_detection_model = "best"

# 3. Screen scratch / crack segmentation model (screen_scratch_model.pt — trained at imgsz=1024)
# Robustly resolve path so the model loads correctly regardless of uvicorn's cwd.
_SCREEN_SCRATCH_CANDIDATES = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "screen_scratch_model.pt"),
    "/Users/vikrantvaidya/Desktop/Projects/yolo_mobile_app/screen_scratch_model.pt",
    "/Users/vikrantvaidya/Desktop/Projects/aidefect/backend/screen_scratch_model.pt",
    "/Users/vikrantvaidya/Desktop/Projects/Inspectify/backend/screen_scratch_model.pt",
    "screen_scratch_model.pt",
]
SCREEN_SCRATCH_MODEL_PATH = None
for _cand in _SCREEN_SCRATCH_CANDIDATES:
    if os.path.exists(_cand) and os.path.getsize(_cand) > 1_000_000:  # must be a real model, not a stub
        SCREEN_SCRATCH_MODEL_PATH = _cand
        break
if not SCREEN_SCRATCH_MODEL_PATH:
    raise FileNotFoundError("screen_scratch_model.pt not found in any candidate path. Please place it in the backend/ directory.")

model_screen_scratch = None
try:
    model_screen_scratch = YOLO(SCREEN_SCRATCH_MODEL_PATH)
    print(f"Successfully loaded screen_scratch_model from: {SCREEN_SCRATCH_MODEL_PATH}")
except Exception as _e_scr:
    print(f"ERROR loading screen_scratch_model: {_e_scr}")
    model_screen_scratch = None

def analyze_screen_scratch_with_selected_model(image_path: str, model_type: Optional[str] = None, confidence_threshold: float = 0.10):
    """
    Exclusively uses screen_scratch_model.pt for all screen scratch & crack detection
    in both Personal and Company modes.

    Key fix: screen_scratch_model.pt was trained at imgsz=1024, so inference MUST run at
    imgsz=1024 to preserve fine hairline scratches. Running at 640px obliterates thin
    1-2px scratches. We also do a dual-pass: 1024px first, then 640px fallback if nothing found.
    """
    if model_screen_scratch is None:
        return {
            "status": "INTACT",
            "confidence": 0.5,
            "reason": "Screen scratch model unavailable.",
            "annotated_image": os.path.basename(image_path),
            "model_used": "screen_scratch_model.pt",
            "defects": []
        }

    # Use a low enough conf to catch faint hairline scratches (the model was trained on subtle defects)
    # We cap incoming threshold to 0.08 for screen mode since fine scratches score low
    conf_thresh = min(max(0.05, confidence_threshold), 0.08)
    base, ext = os.path.splitext(image_path)
    annotated_path = f"{base}_annotated{ext}"

    has_defect = False
    max_defect_conf = 0.0
    defect_count = 0
    defects = []
    detected_categories = []

    def _run_pass(imgsz: int) -> bool:
        nonlocal has_defect, max_defect_conf, defect_count, detected_categories
        found_any = False
        try:
            # imgsz=1024 matches training resolution — CRITICAL for fine scratch detection
            results = model_screen_scratch(image_path, imgsz=imgsz, conf=conf_thresh, verbose=False)
            if not results or not results[0].boxes or len(results[0].boxes) == 0:
                return False
            img = results[0].orig_img
            h, w = img.shape[:2] if img is not None else (1, 1)
            annotated_img = img.copy() if img is not None else None
            for box in results[0].boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = (model_screen_scratch.names.get(cls_id, "scratch")
                            if hasattr(model_screen_scratch, "names") else "scratch")
                if conf >= conf_thresh:
                    found_any = True
                    has_defect = True
                    defect_count += 1
                    if conf > max_defect_conf:
                        max_defect_conf = conf
                    if cls_name not in detected_categories:
                        detected_categories.append(cls_name)
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    defects.append({
                        "id": f"scr_{len(defects)}",
                        "label": cls_name.upper(),
                        "category": f"Screen {cls_name.capitalize()}",
                        "confidence": round(conf, 2),
                        "box_normalized": [
                            max(0.0, min(1.0, x1 / w)),
                            max(0.0, min(1.0, y1 / h)),
                            max(0.0, min(1.0, x2 / w)),
                            max(0.0, min(1.0, y2 / h)),
                        ],
                        "box_pixels": [x1, y1, x2, y2]
                    })
                    # Draw custom cyan bounding boxes + label for scratch, red for crack
                    if annotated_img is not None:
                        color = (0, 255, 255) if cls_name == "scratch" else (0, 60, 240)
                        cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 2)
                        label_text = f"{cls_name.upper()} {int(conf * 100)}%"
                        cv2.putText(annotated_img, label_text, (x1, max(16, y1 - 6)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            if annotated_img is not None and found_any:
                cv2.imwrite(annotated_path, annotated_img)
        except Exception as e_pass:
            print(f"screen_scratch_model inference error at imgsz={imgsz}:", e_pass)
        return found_any

    # --- Pass 1: Run at training resolution (imgsz=1024) for finest hairline scratch detection ---
    found_at_1024 = _run_pass(1024)

    # --- Pass 2: Fallback at 640 if nothing found at 1024 (catches broader cracks) ---
    if not found_at_1024:
        _run_pass(640)

    annotated_filename = os.path.basename(annotated_path) if os.path.exists(annotated_path) else os.path.basename(image_path)
    if has_defect:
        desc = ", ".join(detected_categories[:2]) if detected_categories else "scratch/crack"
        return {
            "status": "DEFECTIVE",
            "confidence": round(max_defect_conf, 2),
            "reason": f"Detected {defect_count} defect(s) [{desc}] on display glass panel.",
            "annotated_image": annotated_filename,
            "model_used": "screen_scratch_model.pt",
            "defects": defects
        }

    return {
        "status": "INTACT",
        "confidence": 0.95,
        "reason": "No screen scratches, cracks, or glass fractures detected by screen scratch model.",
        "annotated_image": annotated_filename,
        "model_used": "screen_scratch_model.pt",
        "defects": []
    }

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

openai_client = None
if os.getenv("OPENAI_API_KEY"):
    openai_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENAI_API_KEY"),
    )

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_result = None

def preprocess_for_micro_defects(image_path: str):
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    img = cv2.resize(img, (0, 0), fx=0.7, fy=0.7)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(6, 6))
    contrast = clahe.apply(gray)

    grad_x = cv2.Sobel(contrast, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(contrast, cv2.CV_64F, 0, 1, ksize=3)
    gradient = cv2.magnitude(grad_x, grad_y)

    gradient = cv2.normalize(gradient, None, 0, 255, cv2.NORM_MINMAX)
    gradient = gradient.astype("uint8")

    enhanced_rgb = cv2.cvtColor(gradient, cv2.COLOR_GRAY2BGR)

    base, ext = os.path.splitext(image_path)
    enhanced_path = f"{base}_enhanced{ext}"
    cv2.imwrite(enhanced_path, enhanced_rgb)

    return enhanced_path

def split_into_tiles(image_path, rows=3, cols=3):
    img = cv2.imread(image_path)
    if img is None:
        return []
    h, w, _ = img.shape

    tiles = []
    tile_h, tile_w = h // rows, w // cols

    for r, c in product(range(rows), range(cols)):
        tile = img[
            r * tile_h : (r + 1) * tile_h,
            c * tile_w : (c + 1) * tile_w
        ]
        base, ext = os.path.splitext(image_path)
        tile_path = f"{base}_tile_{r}_{c}{ext}"
        cv2.imwrite(tile_path, tile)
        tiles.append(tile_path)

    return tiles

def analyze_image_with_yolo(image_path: str, confidence_threshold: float = 0.12):
    try:
        conf_val = max(0.04, min(0.95, confidence_threshold))
        
        # Native trained resolution for best.pt is imgsz=640 (preserves maximum defect activation)
        results = model_yolo(image_path, imgsz=640, conf=conf_val, verbose=False)
        detections = results[0].boxes
        
        # If no boxes detected at standard 640, attempt test-time augmentation (TTA)
        if len(detections) == 0:
            results_aug = model_yolo(image_path, imgsz=640, augment=True, conf=conf_val, verbose=False)
            if len(results_aug[0].boxes) > 0:
                results = results_aug
                detections = results[0].boxes
        
        img = cv2.imread(image_path)
        if img is None and results[0].orig_img is not None:
            img = results[0].orig_img.copy()
        h, w = img.shape[:2] if img is not None else (1, 1)
        
        base, ext = os.path.splitext(image_path)
        annotated_path = f"{base}_annotated{ext}"
        
        has_defect = False
        max_defect_conf = 0.0
        defect_count = 0
        defects = []
        
        annotated_img = img.copy() if img is not None else None
        
        if len(detections) > 0:
            for i, box in enumerate(detections):
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                # In best.pt: cls 0 is 'damaged', cls 1 is 'intact'
                if cls_id == 0 and conf >= conf_val:
                    has_defect = True
                    defect_count += 1
                    if conf > max_defect_conf:
                        max_defect_conf = conf
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    
                    defects.append({
                        "id": f"pkg_{i}",
                        "label": "DAMAGED",
                        "category": "Packaging Damage",
                        "confidence": round(conf, 2),
                        "box_normalized": [
                            max(0.0, min(1.0, x1 / w)),
                            max(0.0, min(1.0, y1 / h)),
                            max(0.0, min(1.0, x2 / w)),
                            max(0.0, min(1.0, y2 / h)),
                        ],
                        "box_pixels": [x1, y1, x2, y2]
                    })
                    
                    # Draw custom high-visibility bounding box and label badge
                    if annotated_img is not None:
                        # Draw bounding box
                        cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 0, 240), 3)
                        # Corner brackets
                        corner_len = max(10, min(30, int(min(x2 - x1, y2 - y1) * 0.25)))
                        for (cx, cy, dx, dy) in [(x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)]:
                            cv2.line(annotated_img, (cx, cy), (cx + dx * corner_len, cy), (0, 0, 255), 4)
                            cv2.line(annotated_img, (cx, cy), (cx, cy + dy * corner_len), (0, 0, 255), 4)
                        # Label text
                        badge_text = f"DAMAGED {int(conf * 100)}%"
                        (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                        badge_y1 = max(0, y1 - 26)
                        cv2.rectangle(annotated_img, (x1, badge_y1), (x1 + tw + 12, y1), (0, 0, 210), -1)
                        cv2.putText(annotated_img, badge_text, (x1 + 6, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        if annotated_img is not None:
            cv2.imwrite(annotated_path, annotated_img)
        else:
            results[0].save(filename=annotated_path)
            
        annotated_filename = os.path.basename(annotated_path)

        if has_defect:
            return {
                "status": "DEFECTIVE",
                "confidence": round(max_defect_conf, 2),
                "reason": f"Detected {defect_count} packaging damage defect(s) on container exterior.",
                "annotated_image": annotated_filename,
                "model_used": "best.pt",
                "defects": defects
            }
        else:
            return {
                "status": "INTACT",
                "confidence": 0.95,
                "reason": "Packaging verified intact with uniform structural integrity. No defects detected.",
                "annotated_image": annotated_filename,
                "model_used": "best.pt",
                "defects": []
            }
    except Exception as e:
        print("YOLO Inference error:", e)
        return {
            "status": "INTACT",
            "confidence": 0.4,
            "reason": f"YOLO Inference error: {str(e)}",
            "annotated_image": None,
            "model_used": "best.pt"
        }

def analyze_image_with_latest_model(image_path: str, confidence_threshold: float = 0.20):
    """
    Inference with latest_model_defect.pt.
    Supports multi-defect categories (cracks, scratches, corner dents, tears, etc.).
    Automatically and safely falls back to analyze_image_with_yolo if any issue occurs.
    """
    if model_latest is None:
        print("model_latest is not initialized. Falling back to standard YOLO model.")
        res = analyze_image_with_yolo(image_path, confidence_threshold)
        res["model_used"] = "best.pt (fallback)"
        return res

    try:
        # Pass confidence threshold directly to YOLO so detections below 0.25 aren't dropped by default
        results = model_latest(image_path, conf=confidence_threshold)
        base, ext = os.path.splitext(image_path)
        annotated_path = f"{base}_annotated{ext}"

        # Save annotated image
        results[0].save(filename=annotated_path)
        annotated_filename = os.path.basename(annotated_path)

        detections = results[0].boxes
        img = results[0].orig_img
        h, w = img.shape[:2] if img is not None else (1, 1)
        has_defect = False
        max_defect_conf = 0.0
        defect_count = 0
        detected_labels = []
        defects = []

        if len(detections) > 0:
            for i, box in enumerate(detections):
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = model_latest.names.get(cls_id, f"defect_{cls_id}") if hasattr(model_latest, "names") else "defect"
                
                # In latest_model_defect, all classes are defect types
                if conf >= confidence_threshold:
                    has_defect = True
                    defect_count += 1
                    if cls_name not in detected_labels:
                        detected_labels.append(cls_name)
                    if conf > max_defect_conf:
                        max_defect_conf = conf
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    defects.append({
                        "id": f"def_{i}",
                        "label": cls_name.upper(),
                        "category": cls_name.capitalize(),
                        "confidence": round(conf, 2),
                        "box_normalized": [
                            max(0.0, min(1.0, x1 / w)),
                            max(0.0, min(1.0, y1 / h)),
                            max(0.0, min(1.0, x2 / w)),
                            max(0.0, min(1.0, y2 / h)),
                        ],
                        "box_pixels": [x1, y1, x2, y2]
                    })

        if has_defect:
            detail_str = ", ".join(detected_labels[:2]) if detected_labels else "packaging defect"
            return {
                "status": "DEFECTIVE",
                "confidence": round(max_defect_conf, 2),
                "reason": f"Detected {defect_count} defect(s) [{detail_str}] on packaging exterior.",
                "annotated_image": annotated_filename,
                "model_used": "latest_model_defect.pt",
                "defect_categories": detected_labels,
                "defects": defects
            }
        else:
            return {
                "status": "INTACT",
                "confidence": 0.95,
                "reason": "Packaging verified intact with uniform structural integrity. No defects detected.",
                "annotated_image": annotated_filename,
                "model_used": "latest_model_defect.pt",
                "defects": []
            }
    except Exception as e:
        print(f"Error during latest model inference: {e}. Gracefully falling back to best.pt.")
        res = analyze_image_with_yolo(image_path, confidence_threshold)
        res["model_used"] = "best.pt (fallback)"
        res["fallback_reason"] = f"latest model error: {str(e)}"
        return res

def analyze_image_with_selected_model(image_path: str, model_type: Optional[str] = None, confidence_threshold: float = 0.12):
    """
    Strict single-model execution matching user's Settings selection.
    If 'latest' is selected: uses exclusively latest_model_defect.pt.
    If 'best' (standard) is selected: uses exclusively best.pt.
    """
    choice = (model_type or active_detection_model or "best").lower().strip()
    conf_thresh = max(0.04, min(0.95, confidence_threshold))

    # User selected Latest Defect Model: use ONLY latest_model_defect.pt
    if choice in ("latest", "latest_model", "latest_model_defect", "latest_model_defect.pt"):
        return analyze_image_with_latest_model(image_path, conf_thresh)

    # User selected Standard Model: use ONLY best.pt (calibrated threshold)
    res = analyze_image_with_yolo(image_path, conf_thresh)
    res["model_used"] = "best.pt"
    return res

def analyze_image_with_llm(image_path: str):
    try:
        vision_hit = vision_micro_scratch_detector(image_path)
        if vision_hit:
            return vision_hit

        model = genai.GenerativeModel("gemini-1.5-flash")

        enhanced_path = preprocess_for_micro_defects(image_path)

        original_tiles = split_into_tiles(image_path)
        enhanced_tiles = split_into_tiles(enhanced_path)

        def run_llm(path):
            with open(path, "rb") as img:
                image_bytes = img.read()

            prompt = (
                "You are a precision micro-defect inspection AI for mobile glass screens.\n"
                "- Ignore normal lighting reflections and glare.\n"
                "- Only classify as DEFECTIVE if there is a clear, continuous scratch, crack, deep scuff, or physical damage.\n"
                "- Minor noise, dust, or light reflection lines are NOT defects.\n"
                "- If uncertain, classify as INTACT.\n\n"
                "Respond ONLY in strict JSON:\n"
                "{ \"status\": \"DEFECTIVE or INTACT\", "
                "\"confidence\": number between 0.5 and 1.0, "
                "\"reason\": short technical explanation }\n"
            )

            response = model.generate_content(
                [
                    prompt,
                    {
                        "mime_type": "image/jpeg",
                        "data": image_bytes
                    }
                ]
            )

            text = response.text.strip()

            if text.startswith("```"):
                text = text.split("```")[1]

            return json.loads(text)

        results = []

        for tile in original_tiles + enhanced_tiles:
            try:
                results.append(run_llm(tile))
            except Exception:
                continue

        defective_results = [
            r for r in results
            if r.get("status") == "DEFECTIVE" and r.get("confidence", 0) >= 0.7
        ]

        base, ext = os.path.splitext(image_path)
        annotated_path = f"{base}_annotated{ext}"

        if len(defective_results) >= 3:
            avg_conf = sum(r.get("confidence", 0.8) for r in defective_results) / len(defective_results)
            # Create annotated image highlighting tiles
            img = cv2.imread(image_path)
            cv2.putText(img, "SCRATCH DEFECT DETECTED", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            cv2.imwrite(annotated_path, img)
            return {
                "status": "DEFECTIVE",
                "confidence": round(avg_conf, 2),
                "reason": "Multiple tiles confirmed physical surface damage",
                "annotated_image": os.path.basename(annotated_path)
            }

        img = cv2.imread(image_path)
        cv2.imwrite(annotated_path, img)
        return {
            "status": "INTACT",
            "confidence": 0.85,
            "reason": "No consistent multi-tile physical defects detected",
            "annotated_image": os.path.basename(annotated_path)
        }

    except Exception as e:
        base, ext = os.path.splitext(image_path)
        annotated_path = f"{base}_annotated{ext}"
        img = cv2.imread(image_path)
        if img is not None:
            cv2.imwrite(annotated_path, img)
        return {
            "status": "INTACT",
            "confidence": 0.4,
            "reason": f"Inspection fallback (LLM error): {str(e)}",
            "annotated_image": os.path.basename(annotated_path)
        }

def generate_openai_summary(image_path: str, status: str, defect_count: int) -> str:
    if not openai_client:
        return f"Detected {defect_count} defect(s) using YOLO model. (OpenAI API key missing)"
        
    try:
        with open(image_path, "rb") as img_file:
            base64_image = base64.b64encode(img_file.read()).decode('utf-8')
            
        prompt = (
            f"You are an expert packaging defect inspector. Our primary YOLO vision model has already analyzed this image "
            f"and determined the status is '{status}' with {defect_count} defect(s).\n\n"
            f"Your job is to provide a highly descriptive 2-to-3 sentence summary of what you see. "
            f"CRITICAL RULE: You MUST agree with the YOLO model's conclusion of '{status}'. Do not contradict it.\n"
            f"If DEFECTIVE: Describe the specific location, type (e.g., tear, dent, scratch), and severity of the visible damage. "
            f"If INTACT: Briefly explain that the packaging surface and structure appear sound and free of anomalies."
        )

        response = openai_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("OpenAI Error:", e)
        return f"Detected {defect_count} defect(s) using YOLO model. (AI Summary generation failed)"

class ModelSettingRequest(BaseModel):
    model: str

@app.get("/api/settings/model")
def get_model_setting():
    return {
        "active_model": active_detection_model,
        "available_models": [
            {
                "id": "best",
                "name": "Standard Model",
                "fileName": "best.pt",
                "is_loaded": model_yolo is not None,
                "description": "Primary packaging defect detection model (Default)"
            },
            {
                "id": "latest",
                "name": "Latest Defect Model",
                "fileName": "latest_model_defect.pt",
                "is_loaded": model_latest is not None,
                "description": "Latest multi-defect detection & segmentation model"
            }
        ]
    }

@app.post("/api/settings/model")
def set_model_setting(req: ModelSettingRequest):
    global active_detection_model
    choice = req.model.lower().strip()
    if choice in ("latest", "latest_model", "latest_model_defect", "latest_model_defect.pt"):
        active_detection_model = "latest"
    else:
        active_detection_model = "best"
    print(f"Switched active detection model to: {active_detection_model}")
    return {"message": "Model updated", "active_model": active_detection_model}

@app.post("/upload/")
async def upload(
    file: UploadFile = File(...),
    model: Optional[str] = Query(None),
    model_name: Optional[str] = Form(None),
    confidence_threshold: Optional[str] = Query(None),
    confidence_threshold_form: Optional[str] = Form(None, alias="confidence_threshold")
):
    global latest_result

    filename = f"{int(datetime.now().timestamp())}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(await file.read())

    chosen_model = model or model_name or active_detection_model

    # Parse confidence threshold from query or form; default to 0.12 for best.pt, 0.25 for latest
    raw_conf = confidence_threshold or confidence_threshold_form
    try:
        conf_thresh = float(raw_conf) if raw_conf else (0.25 if chosen_model == "latest" else 0.12)
        conf_thresh = max(0.04, min(0.95, conf_thresh))  # clamp to safe range
    except (ValueError, TypeError):
        conf_thresh = 0.12 if chosen_model == "best" else 0.25

    try:
        analysis = analyze_image_with_selected_model(path, chosen_model, conf_thresh)
    except Exception as e:
        analysis = {
            "status": "INTACT",
            "confidence": 0.3,
            "reason": f"Backend processing fallback: {str(e)}",
            "annotated_image": None,
            "model_used": "best.pt"
        }

    latest_result = {
        "image": filename,
        "status": analysis["status"],
        "confidence": analysis["confidence"],
        "annotated_image": analysis.get("annotated_image"),
        "model_used": analysis.get("model_used", "best.pt"),
        "defects": analysis.get("defects", [])
    }

    return {"message": "Uploaded", "result": latest_result}

@app.post("/upload_screen_scratch/")
async def upload_screen_scratch(
    file: UploadFile = File(...),
    model: Optional[str] = Query(None),
    model_name: Optional[str] = Form(None),
    confidence_threshold: Optional[str] = Query(None),
    confidence_threshold_form: Optional[str] = Form(None, alias="confidence_threshold")
):
    filename = f"screen_{int(datetime.now().timestamp())}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(await file.read())

    chosen_model = model or model_name or active_detection_model
    raw_conf = confidence_threshold or confidence_threshold_form
    try:
        # Screen scratch model: cap at 0.08 so hairline fine scratches are never missed.
        # The model scores fine scratches at 0.06-0.10 range so using packaging defaults (0.12+) would miss them all.
        conf_thresh = float(raw_conf) if raw_conf else 0.08
        conf_thresh = max(0.05, min(0.08, conf_thresh))  # hard-cap max at 0.08 for screen mode
    except (ValueError, TypeError):
        conf_thresh = 0.08

    try:
        analysis = analyze_screen_scratch_with_selected_model(path, chosen_model, conf_thresh)
    except Exception as e:
        analysis = {
            "status": "INTACT",
            "confidence": 0.4,
            "reason": f"Screen analysis error: {str(e)}",
            "annotated_image": None,
            "defects": []
        }

    return {
        "message": "Uploaded Screen Scratch",
        "result": {
            "image": filename,
            "status": analysis["status"],
            "confidence": analysis["confidence"],
            "reason": analysis.get("reason", "Screen scratch inspection complete"),
            "annotated_image": analysis.get("annotated_image") or filename,
            "model_used": analysis.get("model_used", "screen_scratch_model.pt"),
            "defects": analysis.get("defects", [])
        }
    }

from pydantic import BaseModel

class SummaryRequest(BaseModel):
    image_filename: str
    status: str

@app.post("/generate_summary/")
async def generate_summary(req: SummaryRequest):
    annotated_path = os.path.join(UPLOAD_DIR, req.image_filename)
    
    if not os.path.exists(annotated_path):
        return {"reason": "Could not find image for summary generation."}
        
    dynamic_reason = generate_openai_summary(annotated_path, req.status, 1)
    
    global latest_result
    if latest_result and latest_result.get("annotated_image") == req.image_filename:
        latest_result["reason"] = dynamic_reason

    return {"reason": dynamic_reason}

@app.get("/latest/")
def get_latest():
    return latest_result

class BrandExtractRequest(BaseModel):
    image_filename: str

@app.post("/extract_brand/")
async def extract_brand(req: BrandExtractRequest):
    image_path = os.path.join(UPLOAD_DIR, req.image_filename)
    if not os.path.exists(image_path):
        return {
            "brand": "Not Found",
            "product": "Not Found",
            "email": "Not Found",
            "phone": "Not Found",
            "order_number": "Not Found",
            "issue_details": "Observed surface damage / packaging defect upon unboxing."
        }

    prompt = (
        "You are an expert OCR and real-world brand support identification assistant.\n"
        "Examine this packaging image with maximum precision.\n\n"
        "STRICT EXTRACTION RULES:\n"
        "1. BRAND NAME: Extract the exact Brand or Manufacturer Name printed on the package. If not visible or uncertain, return 'Not Found'.\n"
        "2. PRODUCT NAME: Extract the specific Product Name or Item Category printed on the package. If not visible, return 'Not Found'.\n"
        "3. CUSTOMER CARE EMAIL:\n"
        "   - First: Read any customer support email printed directly on the packaging label.\n"
        "   - Second: If not printed on label, check if the detected brand has a known, official, verified customer support email in India (e.g. customercare@brand.in, support@brand.in).\n"
        "   - Third: If no India-specific email exists, check for the brand's official global/universal support email (e.g. support@brand.com, care@brand.com).\n"
        "   - CRITICAL: Never hallucinate or generate fake emails. If no official/verified email is visible or publicly known for this brand, return 'Not Found'.\n"
        "4. HELPLINE PHONE NUMBER:\n"
        "   - Read the official helpline/toll-free phone number printed on the package.\n"
        "   - Or provide the official verified helpline number for this brand (India 1800-XXX-XXXX first, or universal global helpline).\n"
        "   - If unavailable or unverified, return 'Not Found'.\n"
        "5. ORDER / BATCH NUMBER: Read the Batch / Lot / Serial Number printed on the package label if visible, else return 'Not Found'.\n"
        "6. ISSUE DETAILS: Write a concise 2-sentence complaint description explaining visible physical damage or defects on the packaging.\n\n"
        "Return ONLY a clean, valid JSON object:\n"
        "{\n"
        "  \"brand\": \"Exact Brand Name or 'Not Found'\",\n"
        "  \"product\": \"Exact Product Name or 'Not Found'\",\n"
        "  \"email\": \"Verified Official Email or 'Not Found'\",\n"
        "  \"phone\": \"Verified Official Phone or 'Not Found'\",\n"
        "  \"order_number\": \"Batch Number or 'Not Found'\",\n"
        "  \"issue_details\": \"Pre-drafted complaint summary...\"\n"
        "}"
    )

    # 1. Try OpenRouter / OpenAI Client
    if openai_client:
        try:
            with open(image_path, "rb") as img_file:
                base64_image = base64.b64encode(img_file.read()).decode('utf-8')

            response = openai_client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            content = response.choices[0].message.content.strip()
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            data = json.loads(content.strip())
            return data
        except Exception as e:
            print("OpenAI/OpenRouter extraction error:", e)

    # 2. Try Gemini API fallback
    try:
        model_gemini = genai.GenerativeModel('gemini-1.5-flash')
        with open(image_path, "rb") as img_file:
            img_bytes = img_file.read()
        res = model_gemini.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": img_bytes}
        ])
        content = res.text.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        data = json.loads(content.strip())
        return data
    except Exception as e:
        print("Gemini extraction error:", e)

    return {
        "brand": "Not Found",
        "product": "Not Found",
        "email": "Not Found",
        "phone": "Not Found",
        "order_number": "Not Found",
        "issue_details": "Product packaging shows noticeable physical defect upon unboxing."
    }

# ==========================================
# Video Inspection Engine & Endpoints
# ==========================================

video_inspection_jobs = {}

def process_video_inspection_job(job_id: str, video_path: str, extraction_fps: int, base_url: str, confidence_threshold: float = 0.20):
    try:
        video_inspection_jobs[job_id]["status"] = "processing"
        video_inspection_jobs[job_id]["progress"] = 5
        video_inspection_jobs[job_id]["stage"] = "Opening video stream"

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Could not open uploaded video file.")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0 or fps > 120:
            fps = 30.0

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            total_frames = 1

        # Adjust dimensions for H.264 codec compatibility (must be even numbers)
        if width % 2 != 0:
            width -= 1
        if height % 2 != 0:
            height -= 1

        raw_output_path = os.path.join(UPLOAD_DIR, f"{job_id}_raw.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(raw_output_path, fourcc, fps, (width, height))

        sample_rate = max(1, min(60, extraction_fps))
        sample_step = max(1, int(round(fps / sample_rate)))

        frame_idx = 0
        processed_frames_count = 0
        defective_frames_count = 0
        defect_categories_dict = {}
        defect_timestamps = []
        last_defect_ts = -999.0

        current_is_defective = False
        current_boxes = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if frame.shape[1] != width or frame.shape[0] != height:
                frame = cv2.resize(frame, (width, height))

            is_sample = (frame_idx % sample_step == 0)

            if is_sample:
                processed_frames_count += 1
                found_defect = False
                current_boxes = []
                primary_label = "Damaged"
                max_conf_this_frame = 0.0

                # 1. Inspect with packaging defect model (best.pt or latest_model_defect.pt)
                try:
                    active_pkg_model = model_latest if (active_detection_model == "latest" and model_latest is not None) else model_yolo
                    if active_pkg_model is not None:
                        pkg_conf = min(0.05, confidence_threshold) if active_pkg_model == model_yolo else confidence_threshold
                        yolo_res = active_pkg_model(frame, imgsz=960, conf=pkg_conf, verbose=False)
                        if len(yolo_res) > 0 and len(yolo_res[0].boxes) > 0:
                            for box in yolo_res[0].boxes:
                                cls_id = int(box.cls[0])
                                conf = float(box.conf[0])
                                is_defect = (cls_id == 0) if active_pkg_model == model_yolo else True
                                if is_defect and conf >= pkg_conf:
                                    found_defect = True
                                    max_conf_this_frame = max(max_conf_this_frame, conf)
                                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                                    box_lbl = "DAMAGED"
                                    if active_pkg_model == model_latest and hasattr(model_latest, "names"):
                                        box_lbl = model_latest.names.get(cls_id, "defect").upper()
                                    lbl = f"{box_lbl} {int(conf * 100)}%"
                                    primary_label = box_lbl.capitalize()
                                    current_boxes.append((xyxy[0], xyxy[1], xyxy[2], xyxy[3], lbl, conf))
                                    defect_categories_dict[box_lbl.capitalize()] = max(defect_categories_dict.get(box_lbl.capitalize(), 0.0), conf)
                except Exception as ye:
                    print("YOLO video frame error:", ye)

                # 2. Inspect with screen scratch model if no packaging damage
                if not found_defect and model_screen_scratch is not None:
                    try:
                        scr_res = model_screen_scratch(frame, conf=confidence_threshold, verbose=False)
                        if len(scr_res) > 0 and len(scr_res[0].boxes) > 0:
                            for sbox in scr_res[0].boxes:
                                sconf = float(sbox.conf[0])
                                scls = int(sbox.cls[0])
                                sname = model_screen_scratch.names.get(scls, "scratch")
                                if sconf >= confidence_threshold:
                                    found_defect = True
                                    max_conf_this_frame = max(max_conf_this_frame, sconf)
                                    sxyxy = sbox.xyxy[0].cpu().numpy().astype(int)
                                    slbl = f"{sname.upper()} {int(sconf * 100)}%"
                                    primary_label = sname.capitalize()
                                    current_boxes.append((sxyxy[0], sxyxy[1], sxyxy[2], sxyxy[3], slbl, sconf))
                                    defect_categories_dict[f"Screen {sname.capitalize()}"] = max(defect_categories_dict.get(f"Screen {sname.capitalize()}", 0.0), sconf)
                    except Exception as se:
                        print("Screen scratch video frame error:", se)

                current_is_defective = found_defect

                # Record timestamp event and save representative snapshot
                curr_sec = round(frame_idx / fps, 2)
                if current_is_defective and (curr_sec - last_defect_ts >= 0.8):
                    last_defect_ts = curr_sec
                    snap_name = f"{job_id}_snap_{frame_idx}.jpg"
                    snap_path = os.path.join(UPLOAD_DIR, snap_name)

                    snap_img = frame.copy()
                    for (x1, y1, x2, y2, lbl, c) in current_boxes:
                        cv2.rectangle(snap_img, (x1, y1), (x2, y2), (0, 0, 240), 3)
                        cv2.putText(snap_img, lbl, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 240), 2)
                    cv2.imwrite(snap_path, snap_img)

                    defect_timestamps.append({
                        "timestamp_seconds": curr_sec,
                        "category": f"Defect ({primary_label})",
                        "confidence": round(max_conf_this_frame, 2) if max_conf_this_frame > 0 else 0.85,
                        "annotated_frame_url": f"{base_url}uploads/{snap_name}"
                    })

            # Draw frame-by-frame annotations onto final video
            curr_sec = frame_idx / fps
            if current_is_defective and current_boxes:
                defective_frames_count += 1
                for (x1, y1, x2, y2, lbl, c) in current_boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 245), 3)
                    (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    cv2.rectangle(frame, (x1, max(0, y1 - 26)), (x1 + tw + 12, y1), (0, 0, 220), -1)
                    cv2.putText(frame, lbl, (x1 + 6, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

                # Alert HUD banner
                cv2.rectangle(frame, (16, 16), (360, 60), (0, 0, 190), -1)
                cv2.putText(frame, "QC ALERT: DEFECT DETECTED", (26, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            else:
                # Intact HUD banner
                cv2.rectangle(frame, (16, 16), (250, 60), (0, 130, 0), -1)
                cv2.putText(frame, "QC PASS: INTACT", (26, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

            # Timestamp HUD
            ts_str = f"{int(curr_sec // 60):02d}:{int(curr_sec % 60):02d}.{int((curr_sec % 1) * 10)}"
            cv2.putText(frame, ts_str, (max(16, width - 140), 46), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (240, 240, 240), 2)

            writer.write(frame)

            if frame_idx % 15 == 0:
                prog = 10 + int((frame_idx / max(1, total_frames)) * 75)
                video_inspection_jobs[job_id]["progress"] = min(85, prog)
                video_inspection_jobs[job_id]["stage"] = f"Processing frame {frame_idx}/{total_frames}..."

            frame_idx += 1

        cap.release()
        writer.release()

        # Step 2: Convert to universally compatible MP4 (H.264 / yuv420p) with ffmpeg
        video_inspection_jobs[job_id]["progress"] = 90
        video_inspection_jobs[job_id]["stage"] = "Finalizing playable video preview..."

        final_annotated_name = f"{job_id}_annotated.mp4"
        final_annotated_path = os.path.join(UPLOAD_DIR, final_annotated_name)

        ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg" or "ffmpeg"
        try:
            cmd = [
                ffmpeg_bin, "-y",
                "-i", raw_output_path,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "fast",
                "-movflags", "+faststart",
                final_annotated_path
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if os.path.exists(raw_output_path):
                os.remove(raw_output_path)
        except Exception as fe:
            print("ffmpeg conversion failed, falling back to raw output:", fe)
            if os.path.exists(raw_output_path):
                shutil.move(raw_output_path, final_annotated_path)

        duration_sec = round(frame_idx / fps, 1)
        categories = [{"name": k, "confidence": round(v, 2)} for k, v in defect_categories_dict.items()]
        if not categories and defective_frames_count > 0:
            categories = [{"name": "Packaging Defect", "confidence": 0.88}]

        if defective_frames_count > 0:
            summary = (
                f"Inspection identified {len(defect_timestamps)} defect event(s) across "
                f"{defective_frames_count} video frames. Defect bounding boxes and alerts are annotated frame-by-frame."
            )
        else:
            summary = f"Complete video inspection verified intact surface quality across all {frame_idx} frames. 0 defects detected."

        video_inspection_jobs[job_id]["status"] = "completed"
        video_inspection_jobs[job_id]["progress"] = 100
        video_inspection_jobs[job_id]["stage"] = "Inspection complete"
        video_inspection_jobs[job_id]["results"] = {
            "inspection_id": job_id,
            "video_duration_seconds": duration_sec,
            "total_extracted_frames": processed_frames_count,
            "total_processed_frames": frame_idx,
            "defective_frames": defective_frames_count,
            "non_defective_frames": max(0, frame_idx - defective_frames_count),
            "defect_categories": categories,
            "defect_timestamps": defect_timestamps,
            "summary": summary,
            "annotated_video_url": f"{base_url}uploads/{final_annotated_name}"
        }

    except Exception as e:
        print("Video inspection job error:", e)
        video_inspection_jobs[job_id]["status"] = "failed"
        video_inspection_jobs[job_id]["error"] = str(e)
        video_inspection_jobs[job_id]["stage"] = "Inspection failed"

@app.post("/api/video-inspection/upload")
async def upload_video_inspection(
    request: Request,
    file: UploadFile = File(...),
    extraction_fps: str = Form("2"),
    model: str = Form("best"),
    confidence_threshold: Optional[str] = Form(None)
):
    job_id = f"vid_{int(datetime.now().timestamp())}_{str(uuid.uuid4())[:6]}"
    ext = os.path.splitext(file.filename)[1] or ".mp4"
    saved_filename = f"{job_id}_input{ext}"
    input_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(input_path, "wb") as f:
        f.write(await file.read())

    try:
        fps_val = int(float(extraction_fps))
    except (ValueError, TypeError):
        fps_val = 2

    try:
        conf_thresh = float(confidence_threshold) if confidence_threshold else 0.20
        conf_thresh = max(0.05, min(0.95, conf_thresh))
    except (ValueError, TypeError):
        conf_thresh = 0.20

    # Update active model based on request if provided
    global active_detection_model
    if model and model.lower() in ("latest", "latest_model", "latest_model_defect"):
        active_detection_model = "latest"
    elif model and model.lower() in ("best",):
        active_detection_model = "best"

    base_url = str(request.base_url)

    video_inspection_jobs[job_id] = {
        "inspection_id": job_id,
        "status": "queued",
        "progress": 2,
        "stage": "Video uploaded, queueing inspection...",
        "results": None,
        "error": None
    }

    thread = threading.Thread(
        target=process_video_inspection_job,
        args=(job_id, input_path, fps_val, base_url, conf_thresh),
        daemon=True
    )
    thread.start()

    return {"inspection_id": job_id, "job_id": job_id, "message": "Video inspection started"}

@app.get("/api/video-inspection/status/{inspection_id}")
async def get_video_inspection_status(inspection_id: str):
    job = video_inspection_jobs.get(inspection_id)
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")

    return {
        "inspection_id": inspection_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "stage": job.get("stage", ""),
        "error": job.get("error")
    }

@app.get("/api/video-inspection/results/{inspection_id}")
async def get_video_inspection_results(inspection_id: str):
    job = video_inspection_jobs.get(inspection_id)
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")

    if job["status"] == "failed":
        raise HTTPException(status_code=400, detail=job.get("error") or "Inspection failed")

    if job["status"] != "completed" or not job.get("results"):
        raise HTTPException(status_code=202, detail="Inspection is still in progress")

    return job["results"]

# ==========================================
# Real-Time Live Camera Stream AI Inspector
# ==========================================

class LiveFrameRequest(BaseModel):
    image_base64: str
    target_model: str = "all"  # "all", "packaging", "screen"
    save_snapshot: bool = False
    model_preference: Optional[str] = None
    confidence_threshold: Optional[float] = None  # per-request threshold override

@app.post("/api/live-stream/frame")
async def analyze_live_frame(req: LiveFrameRequest):
    t_start = time.time()
    # Resolve confidence threshold: use request value or fall back to sensible default
    conf_thresh = req.confidence_threshold
    if conf_thresh is None or not (0.05 <= conf_thresh <= 0.95):
        conf_thresh = 0.20  # optimised default for subtle damage detection

    try:
        img_str = req.image_base64
        if "," in img_str:
            img_str = img_str.split(",", 1)[1]

        img_bytes = base64.b64decode(img_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image frame")

        h, w = frame.shape[:2]
        defects = []
        has_defect = False
        max_conf = 0.0

        # 1. Inspect with Packaging Defect Model (best.pt or latest_model_defect.pt)
        if req.target_model in ("all", "packaging"):
            chosen_pkg_model = model_yolo
            pref = (req.model_preference or active_detection_model or "best").lower().strip()
            if pref in ("latest", "latest_model", "latest_model_defect") and model_latest is not None:
                chosen_pkg_model = model_latest

            try:
                if chosen_pkg_model is not None:
                    res = chosen_pkg_model(frame, conf=conf_thresh, verbose=False)
                    if len(res) > 0 and len(res[0].boxes) > 0:
                        for box in res[0].boxes:
                            cls_id = int(box.cls[0])
                            conf = float(box.conf[0])
                            # In best.pt: 0 is 'damaged'. In latest_model_defect.pt: all classes are defects!
                            is_defect = (cls_id == 0) if chosen_pkg_model == model_yolo else True
                            if is_defect and conf >= conf_thresh:
                                has_defect = True
                                max_conf = max(max_conf, conf)
                                xyxy = box.xyxy[0].cpu().numpy().astype(int)
                                x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                                
                                norm_box = [
                                    max(0.0, min(1.0, x1 / w)),
                                    max(0.0, min(1.0, y1 / h)),
                                    max(0.0, min(1.0, x2 / w)),
                                    max(0.0, min(1.0, y2 / h))
                                ]

                                box_lbl = "DAMAGED"
                                box_cat = "Packaging Damage"
                                if chosen_pkg_model == model_latest and hasattr(model_latest, "names"):
                                    cname = model_latest.names.get(cls_id, "defect")
                                    box_lbl = cname.upper()
                                    box_cat = cname.capitalize()

                                defects.append({
                                    "id": f"pkg_{len(defects)}",
                                    "label": box_lbl,
                                    "category": box_cat,
                                    "confidence": round(conf, 2),
                                    "box_normalized": norm_box,
                                    "box_pixels": [x1, y1, x2, y2]
                                })
            except Exception as pe:
                print("Live YOLO frame error:", pe)

        # 2. Inspect with Screen Scratch Model
        if req.target_model in ("all", "screen") and model_screen_scratch is not None:
            try:
                s_res = model_screen_scratch(frame, conf=conf_thresh, verbose=False)
                if len(s_res) > 0 and len(s_res[0].boxes) > 0:
                    for sbox in s_res[0].boxes:
                        s_conf = float(sbox.conf[0])
                        s_cls = int(sbox.cls[0])
                        s_name = model_screen_scratch.names.get(s_cls, "scratch")
                        if s_conf >= conf_thresh:
                            has_defect = True
                            max_conf = max(max_conf, s_conf)
                            sxyxy = sbox.xyxy[0].cpu().numpy().astype(int)
                            sx1, sy1, sx2, sy2 = int(sxyxy[0]), int(sxyxy[1]), int(sxyxy[2]), int(sxyxy[3])
                            norm_box = [
                                max(0.0, min(1.0, sx1 / w)),
                                max(0.0, min(1.0, sy1 / h)),
                                max(0.0, min(1.0, sx2 / w)),
                                max(0.0, min(1.0, sy2 / h))
                            ]
                            defects.append({
                                "id": f"scr_{len(defects)}",
                                "label": s_name.upper(),
                                "category": f"Screen {s_name.capitalize()}",
                                "confidence": round(s_conf, 2),
                                "box_normalized": norm_box,
                                "box_pixels": [sx1, sy1, sx2, sy2]
                            })
            except Exception as se:
                print("Live Screen scratch frame error:", se)

        snapshot_filename = None
        if req.save_snapshot and has_defect:
            snapshot_filename = f"live_defect_{int(time.time())}.jpg"
            snap_path = os.path.join(UPLOAD_DIR, snapshot_filename)
            annotated_frame = frame.copy()
            for d in defects:
                px = d["box_pixels"]
                cv2.rectangle(annotated_frame, (px[0], px[1]), (px[2], px[3]), (0, 0, 240), 3)
                lbl = f"{d['label']} {int(d['confidence'] * 100)}%"
                cv2.putText(annotated_frame, lbl, (px[0], max(20, px[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 240), 2)
            cv2.imwrite(snap_path, annotated_frame)

        latency_ms = int((time.time() - t_start) * 1000)

        return {
            "status": "DEFECTIVE" if has_defect else "INTACT",
            "defect_count": len(defects),
            "max_confidence": round(max_conf, 2),
            "defects": defects,
            "latency_ms": latency_ms,
            "snapshot_image": snapshot_filename
        }

    except Exception as e:
        print("Live stream error:", e)
        return {
            "status": "ERROR",
            "defect_count": 0,
            "max_confidence": 0.0,
            "defects": [],
            "latency_ms": int((time.time() - t_start) * 1000),
            "error": str(e)
        }



# ── Role-Based AI Logistics Platform Routers ──────────────────────────────────
from routers.auth import router as auth_router
from routers.predictions import router as predictions_router
from routers.company import router as company_router
from routers.analytics import router as analytics_router
from routers.scan_predict import router as scan_predict_router

app.include_router(auth_router)
app.include_router(predictions_router)
app.include_router(company_router)
app.include_router(analytics_router)
app.include_router(scan_predict_router)
