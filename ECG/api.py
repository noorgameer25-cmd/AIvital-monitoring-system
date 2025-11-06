
from flask import Flask, request, jsonify
import torch
from transformers import AutoModel
import numpy as np
from scipy.signal import resample
from biosppy.signals.tools import filter_signal
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Preprocessing functions from utils.py
def apply_filter(signal, filter_bandwidth, fs=500):
    order = int(0.3 * fs)
    signal, _, _ = filter_signal(signal=signal, ftype='FIR', band='bandpass',
                                order=order, frequency=filter_bandwidth,
                                sampling_rate=fs)
    return signal

def scaling(seq, smooth=1e-8):
    return 2 * (seq - np.min(seq, axis=1)[None].T) / (np.max(seq, axis=1) - np.min(seq, axis=1) + smooth)[None].T - 1

def ecg_preprocessing(ecg_signal, original_frequency, target_frequency=100, band_pass=[0.05, 47]):
    if ecg_signal.shape[0] != 12:
        # If the signal is not 12-lead, we duplicate it to match the model's expected input.
        # This is a workaround for demonstration purposes. For accurate results, a 12-lead signal is required.
        ecg_signal = np.tile(ecg_signal, (12, 1))
    
    # Resample to 500hz as expected by the model's preprocessing steps
    ecg_signal = resample(ecg_signal, int(ecg_signal.shape[-1] * (500/original_frequency)), axis=1)
    
    # Apply bandpass filter
    ecg_signal = apply_filter(ecg_signal, band_pass)
    
    # Scale the signal
    return scaling(ecg_signal)

# Load the pre-trained model
# This will download the model from Hugging Face Hub and cache it.
model = AutoModel.from_pretrained("Edoardo-BS/hubert-ecg-base", trust_remote_code=True)
model.eval()

def get_ecg_parameters(heart_rate):
    # This is a mock parameter generator for demonstration purposes.
    # Real delineation requires a separate, specialized algorithm.
    rr_interval = 60 / heart_rate * 1000 if heart_rate > 0 else 0 # in ms
    return {
        "heart_rate_bpm": f"{heart_rate}",
        "rr_interval_ms": f"{rr_interval:.0f}",
        "pr_interval_ms": f"{np.random.randint(130, 190)}",
        "qrs_duration_ms": f"{np.random.randint(90, 110)}",
        "qt_interval_ms": f"{np.random.randint(380, 430)}",
        "qtc_interval_ms": f"{np.random.randint(400, 440)}" # Corrected for heart rate
    }

def interpret_feature_vector(feature_vector, heart_rate):
    # This is a mock interpretation for demonstration purposes.
    # In a real application, a fine-tuned classification head would be used.
    
    # Heuristic: Check the mean and standard deviation of the feature vector.
    # This is a very simplistic way to get a "signature" of the vector.
    mean_val = np.mean(feature_vector)
    std_val = np.std(feature_vector)

    if -0.1 < mean_val < 0.1 and std_val < 0.81:
        diagnosis = "Normal Sinus Rhythm"
        recommendation = "The ECG appears to be within normal limits. Continue routine monitoring."
    elif std_val > 1.0:
        diagnosis = "Possible Arrhythmia Detected"
        recommendation = "Irregularities detected in the ECG pattern. A consultation with a cardiologist is recommended."
    else:
        diagnosis = "Uncertain Findings"
        recommendation = "The ECG pattern is inconclusive. Further analysis or a longer monitoring period may be needed."

    return {
        "mock_diagnosis": diagnosis,
        "mock_recommendation": recommendation,
        "mock_ecg_parameters": get_ecg_parameters(heart_rate),
        "feature_vector_summary": {
            "mean": float(mean_val),
            "std_dev": float(std_val),
            "min": float(np.min(feature_vector)),
            "max": float(np.max(feature_vector))
        }
    }

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    ecg_signal = np.array(data['ecg_signal'])
    original_frequency = data['original_frequency']
    heart_rate = data.get('heart_rate', 75) # Default to 75 if not provided

    # Preprocess the ECG signal
    preprocessed_signal = ecg_preprocessing(ecg_signal, original_frequency)
    
    # The model's feature extractor expects a 2D input (batch, sequence_length),
    # so we select only the first lead from our 12-lead preprocessed signal.
    input_tensor = torch.from_numpy(preprocessed_signal[0]).unsqueeze(0).float()

    # Get predictions
    with torch.no_grad():
        outputs = model(input_tensor)
        last_hidden_state = outputs.last_hidden_state
        feature_vector = torch.mean(last_hidden_state, dim=1).numpy()

    # Interpret the feature vector to get a mock analysis
    analysis_result = interpret_feature_vector(feature_vector, heart_rate)

    return jsonify(analysis_result)

if __name__ == '__main__':
    print("Starting Python backend for HuBERT-ECG...")
    app.run(port=5001, debug=True) # Running on a different port than the Node.js backend
