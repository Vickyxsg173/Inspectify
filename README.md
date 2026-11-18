# 📱 AI Defect & Screen Scratch Inspection App

A modern, full-stack AI mobile application built with **React Native (Expo SDK 57)** and **FastAPI / PyTorch**. The platform provides real-time physical package inspection, dedicated screen scratch/crack detection using custom YOLO models, and an intelligent **AI Support Assistant** for automated customer care extraction and contact resolution.

---

## ✨ Features & Capabilities

### 🔍 1. Physical Package Defect Detection
- Upload or capture images of shipping packages.
- Real-time computer vision analysis identifying damage types: **Scratches**, **Dents**, **Tears**, and **Structural Box Integrity**.
- Visual feedback with colored bounding boxes and severity metrics.

### 📱 2. Screen Scratch & Crack Check (Dedicated Section)
- Specialized inspection for mobile display glass.
- Powered by a custom-trained **YOLO Screen Scratch Detection model** (`screen_scratch_model.pt`).
- Highlights micro-scratches, cracks, and display abrasions with pixel-level bounding boxes.

### 🤖 3. AI Support & Customer Care Resolution (Beta)
- **Automatic Brand Extraction**: Uses Gemini / Vision AI to detect product brand names directly from package or device images.
- **Direct Phone Helpline**: Instantly extract and tap to call official brand customer care lines.
- **3-Tier Verified Email Lookup**:
  1. **Tier 1**: Official India-specific Customer Care Email.
  2. **Tier 2**: Universal / Global Support Email (if India-specific email is unavailable).
  3. **Tier 3**: Verified Web Search fallback (marks as `Not Found` if no verified email exists to prevent hallucinated/misleading addresses).
- **One-Tap Email Composer**: Launch native email client with pre-filled brand info, issue category, and verified support email.

---

## 🛠️ Tech Stack & Architecture

### **Frontend (Mobile App)**
- **Framework**: React Native with Expo SDK 57 (Expo Router)
- **Styling & UI**: Custom dark mode glassmorphism UI with smooth animations
- **Native APIs**: `expo-camera`, `expo-image-picker`, `expo-file-system/legacy` (high-performance async multipart file transfers), `linking`

### **Backend (AI Inference Server)**
- **Framework**: Python FastAPI & Uvicorn
- **AI Models**: Custom PyTorch YOLO Models & Google Gemini 1.5 Flash / Vision APIs
- **Image Processing**: OpenCV, PIL, NumPy
- **CORS & Networking**: Configured for local network execution (Wi-Fi IP configurable)

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **Python 3.9+** with PyTorch installed
- **Expo Go App** on iOS/Android or an emulator

---

## ⚙️ Environment Setup (`.env`)

Create a `.env` file in the root of `yolo_mobile_app` (or copy `.env.example`):

```env
# Network IP Configuration (Change this IP when switching Wi-Fi networks)
EXPO_PUBLIC_HOST_IP=192.168.29.140

# Backend Secrets & API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

> ⚠️ **Note**: `.env` is included in `.gitignore` to keep API keys and local IPs private.

---

## 🖥️ Commands to Run the Project

### 1️⃣ Start the FastAPI Backend Server
Open terminal, navigate to the backend directory, and run:

```bash
cd aidefect/backend
/opt/anaconda3/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*The backend will start listening at `http://0.0.0.0:8000` (accessible from your mobile phone via local Wi-Fi).*

---

### 2️⃣ Start the Expo Mobile App
Open a new terminal window, navigate to `yolo_mobile_app`, and run:

```bash
cd yolo_mobile_app
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.29.140 npx expo start --host lan --clear
```

- Scan the generated QR code with **Expo Go** on Android/iOS.
- Ensure both your computer and mobile device are connected to the **same Wi-Fi network**.

---

## 📁 Project Structure

```text
├── yolo_mobile_app/                   # React Native Expo Mobile App
│   ├── src/
│   │   ├── app/
│   │   │   ├── _layout.tsx            # Main layout & navigation
│   │   │   ├── index.tsx              # Package defect inspection screen
│   │   │   ├── screen-scratch.tsx     # Dedicated screen scratch check tab
│   │   │   └── support-beta.tsx      # AI Support & Customer Care tab
│   │   └── components/               # Custom UI components & tab bars
│   ├── .env                           # Local environment config (Git ignored)
│   ├── .env.example                   # Environment variable template
│   └── package.json
│
└── aidefect/backend/                  # FastAPI Backend Server
    ├── main.py                        # API routes, YOLO inference & Gemini integration
    ├── screen_scratch_model.pt        # Trained screen scratch detection weights
    └── requirements.txt               # Python dependencies
```

---

## 🔒 Security & Best Practices
- **No Hardcoded Secrets**: All API keys and environment parameters are loaded dynamically via `.env`.
- **Verified Information**: AI Support utilizes strictly validated web search verification to eliminate false or hallucinated customer support contacts.

## 🎞️ Video Inspection (Beta)

The mobile app now has a separate **Video Beta** tab for selecting packaging videos and submitting them to a video inspection API. It validates MP4/MOV, a 100 MB client-side size ceiling, and a 3 minute duration ceiling; offers 1, 2, or 5 FPS sampling; polls asynchronous job status; displays frame counts/categories/timestamps returned by the server; and can share a text inspection report. Its API base URL is derived from the existing `BACKEND_URL` configuration.

### Repository audit and integration status

- This checkout contains the Expo Router frontend and no backend source, Railway configuration, backend dependency manifest, or API definitions beyond the existing image endpoints documented by the mobile callers (`POST /upload/` and `POST /upload_screen_scratch/`). The deployed backend could not be inspected from this repository.
- `best.pt` and the `screen-scratch-detection/` artifact directory are present, along with a `best.pt.zip` archive. They are binary PyTorch-style model artifacts, but this frontend-only checkout provides no loader, model metadata, class map, or inference code to establish their architectures or capabilities. No video model is configured or confirmed.
- The current packaging image flow calls `/upload/`; screen checks call `/upload_screen_scratch/`. The app also has Gemini Vision summary/fallback code in `src/services/geminiVision.ts`. That fallback is deliberately not called per extracted video frame.
- The video flow expects `POST /api/video-inspection/upload` (multipart `file`, `extraction_fps`; response `inspection_id` or `job_id`), `GET /api/video-inspection/status/{inspection_id}`, and `GET /api/video-inspection/results/{inspection_id}`. Status fields: `status` (`queued`, `processing`, `completed`, `failed`), optional `progress`, `stage`, `error`. Results use the `VideoInspectionResults` shape in `src/services/videoInspectionApi.ts`. An optional `annotated_video_url` may be returned, but playback is not enabled in this build.
- No backend endpoint implementation is included here, so a deployed API that implements this contract is required for an inspection to succeed. Railway storage, background task behavior, decoder compatibility, model adapter and persistence need to be implemented/verified in the backend repository. The selected model remains unconfirmed; this feature does not run mock or client-side predictions.

### Test in the app

1. Configure `EXPO_PUBLIC_HOST_IP` in `.env` to the address of the backend reachable from the phone, using the same existing setup as image inspection. For a deployed host, update the existing `BACKEND_URL` configuration in `src/constants/api.ts` to use the deployed HTTPS base URL; do not add a separate video URL.
2. Start the Expo app using the existing command, open **Video Beta**, and select an MP4 or MOV under 100 MB and 3 minutes. Confirm the displayed metadata, select 1/2/5 FPS, and press **Start video inspection**.
3. With the backend endpoints available, confirm upload/status progress, then check frame totals, defect categories and timestamp list. **Share inspection report** opens the native share sheet. Timestamps are frame events and are not unique package counts.
4. If the backend does not yet implement the endpoints, the screen will show the API error. That is the expected result with this frontend-only repository; do not treat a successful UI selection as an AI inspection.

Current beta limits: playback preview and annotated video playback are not wired because `expo-video` is declared in the workspace manifest but is not installed in the available offline environment; this screen reports that explicitly. The UI displays selected metadata and server-returned timestamps, but seeking requires the later video-player integration. The provided Railway deployment and end-to-end testing steps cannot be completed from this repository alone. Live camera acquisition is not implemented; a future camera input adapter should feed the same backend frame processing/aggregation engine as uploaded video.

---

## 📄 License
This project is developed for educational and research purposes as part of the Major Project initiative.
