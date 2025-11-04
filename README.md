# 🏥 AI Vital Signs Monitoring System

**A real-time, AI-powered vital signs monitoring system for hackathon submission.**

This project provides a comprehensive solution for monitoring vital signs, analyzing ECG data, and generating detailed health reports using cutting-edge AI models. It's designed to be a powerful tool for remote patient monitoring and health analysis.

## ✨ Features

*   **Real-time Vital Signs Monitoring**: Tracks Heart Rate, Blood Pressure, Blood Sugar, SpO2, and Temperature.
*   **Live ECG Waveform**: Displays live ECG readings from three different leads (I, II, III) with arrhythmia simulation.
*   **AI-Powered Analysis**:
    *   **Gemini**: Analyzes vital signs to provide a detailed health assessment, potential diagnosis, and recommendations.
    *   **HuBERT-ECG**: A specialized model for ECG analysis, providing clinical parameters and diagnosis.
*   **Detailed Health Reports**: Generates comprehensive health reports that can be viewed, printed, and sent via email.
*   **User Authentication**: Secure user authentication with Firebase.
*   **Personalized Dashboard**: Users can manage their profile and calculate their "Body Age".
*   **Text-to-Speech**: Hindi voice announcements for key events.

## 🛠️ Tech Stack

*   **Frontend**: React, TypeScript, Vite, Tailwind CSS
*   **Backend**: Node.js, Express.js
*   **Authentication**: Firebase Authentication
*   **Database**: Firestore
*   **AI Models**:
    *   HuBERT-ECG
*   **Email**: Resend API
*   **Deployment**: (e.g., Vercel, Netlify, Heroku)

## 📂 Project Structure

```
projecsoviet/
├── backend/
│   ├── .env
│   ├── auth-middleware.js
│   ├── auth-routes.js
│   ├── firebase-config.js
│   ├── package.json
│   ├── server.js
│   └── utils/
│       └── bodyAgeCalculator.js
├── components/
│   ├── AiAnalysisReport.tsx
│   ├── DashboardPage.tsx
│   ├── EcgChart.tsx
│   ├── ReportPage.tsx
│   └── ...
├── contexts/
│   └── AuthContext.tsx
├── ECG/
│   ├── api.py
│   ├── code/
│   └── ...
├── services/
│   ├── firebase.ts
│   ├── geminiService.ts
│   └── ttsService.ts
├── App.tsx
├── index.tsx
└── ...
```

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   npm
*   Python (for the ECG model)
*   Firebase project
*   Google Cloud project with Gemini and Text-to-Speech APIs enabled
*   Resend API key

### Frontend Setup

1.  **Navigate to the project directory**:
    ```bash
    cd projecsoviet
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Create a `.env` file** in the root of the project and add the following environment variables:
    ```
    REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
    REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
    REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
    REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
    REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
    REACT_APP_BACKEND_URL=http://localhost:3001
    ```
4.  **Start the frontend development server**:
    ```bash
    npm run dev
    ```

### Backend Setup

1.  **Navigate to the backend directory**:
    ```bash
    cd projecsoviet/backend
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Create a `.env` file** in the `backend` directory and add the following environment variables:
    ```
    RESEND_API_KEY=your_resend_api_key
    FROM_EMAIL=your_verified_resend_from_email
    TO_EMAIL=your_admin_email_for_reports
    FIREBASE_PROJECT_ID=your_firebase_project_id
    FIREBASE_PRIVATE_KEY=your_firebase_private_key
    FIREBASE_CLIENT_EMAIL=your_firebase_client_email
    ```
4.  **Start the backend server**:
    ```bash
    npm start
    ```

### ECG Model Setup

1.  **Navigate to the `HuBERT-ECG` directory**:
    ```bash
    cd projecsoviet/HECG
    ```
2.  **Create a Python virtual environment**:
    ```bash
    python -m venv hubert_ecg_env
    ```
3.  **Activate the virtual environment**:
    *   **Windows**: `ecg_env\Scripts\activate`
    *   **macOS/Linux**: `source hubert_ecg_env/bin/activate`
4.  **Install the required Python packages**:
    ```bash
    pip install -r requirements.txt
    ```
5.  **Start the Flask API for the model**:
    ```bash
    python api.py
    ```

## 🧠 AI Model

This project leverages two powerful AI models for its analysis capabilities:

### Gemini

*   **Purpose**: Analyzes the user's vital signs (Heart Rate, Blood Pressure, Blood Sugar, SpO2, Temperature) to provide a comprehensive health assessment.
*   **Functionality**:
    *   Generates an overall assessment of the user's health.
    *   Provides a detailed analysis of each vital sign, including its status (normal, high, low) and an explanation.
    *   Suggests a potential diagnosis based on the vital signs.
    *   Offers actionable recommendations for improving health.

### HuBERT-ECG

*   **Purpose**: A specialized, pre-trained model for analyzing Electrocardiogram (ECG) data.
*   **Functionality**:
    *   Processes raw ECG signals to identify clinical parameters.
    *   Provides a diagnosis based on the ECG waveform (e.g., "Normal Sinus Rhythm").
    *   Offers recommendations based on the ECG analysis.

## 📊 Diagrams

### System Architecture

![WhatsApp Image 2025-11-04 at 09 52 59_101a60c3](https://github.com/user-attachments/assets/7f4737e5-ee23-479d-91ea-1cb646ae0f69)


*(This diagram should show the overall hardware architecture of the system.)*

### Data Flow

![Data Flow Diagram](placeholder_for_data_flow_diagram.png)

*(This diagram should illustrate how data flows through the system, from the user's input to the AI analysis and the final report.)*

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature`).
6.  Open a pull request.

## 📜 License

This project is licensed under the [MIT License](LICENSE).
