/**
 * MONITORING PAGE COMPONENT
 * 
 * This is the main monitoring interface where users can:
 * 1. Enter their email to start a session
 * 2. Monitor real-time vital signs (Heart Rate, Blood Pressure, Blood Sugar, SpO2, Temperature)
 * 3. View live ECG readings from 3 different leads
 * 4. Start AI analysis after monitoring period
 * 5. Navigate to report page to view results
 * 
 * Key Features:
 * - Real-time vital sign simulation with medical accuracy
 * - Live ECG waveform generation with arrhythmia patterns
 * - State management for monitoring session flow
 * - Navigation to report page after analysis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import type { VitalSigns, EcgDataPoint, VitalAnalysis } from './types';
import { VITAL_RANGES, getBloodPressureRanges, ECG_PATTERN_1, ECG_PATTERN_2, ECG_PATTERN_3, ECG_DATA_LENGTH, MONITORING_DURATION_MS, PVC_PATTERN_1, PVC_PATTERN_2, PVC_PATTERN_3 } from './constants';
import ttsService, { HINDI_MESSAGES } from './services/ttsService';
import VitalSignCard from './components/VitalSignCard';
import EcgChart from './components/EcgChart';
import { HeartIcon, BloodPressureIcon, DropletIcon, EcgIcon, SpO2Icon, TemperatureIcon } from './components/icons';

// Application states for the monitoring session flow
type AppState = 'READY' | 'MONITORING' | 'ANALYZING' | 'COMPLETE';

const MonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [appState, setAppState] = useState<AppState>('READY');
  const [userEmail, setUserEmail] = useState<string>('');

  // Hidden age override for testing (Ctrl+Shift+A to cycle through ages)
  const [hiddenAgeOverride, setHiddenAgeOverride] = useState<number | null>(null);

  // Set user email from authenticated user
  React.useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user]);

  // Hidden key combination handler (Ctrl+Shift+A to cycle through test ages)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();

        // Cycle through different test ages: 20, 25, 35, 45, 55, null (original)
        const testAges = [20, 25, 35, 45, 55, null];
        const currentIndex = testAges.findIndex(age => age === hiddenAgeOverride);
        const nextIndex = (currentIndex + 1) % testAges.length;
        const nextAge = testAges[nextIndex];

        setHiddenAgeOverride(nextAge);

        // Reset blood pressure when age override changes to ensure proper range
        setVitals(prev => ({
          ...prev,
          bloodPressure: { systolic: 0, diastolic: 0 }
        }));

        if (nextAge === null) {
          console.log('🔓 Age override disabled - using original user age');
        } else {
          console.log(`🔧 Age override set to: ${nextAge} years`);
          // Get the actual ranges that will be used
          const bpRanges = getBloodPressureRanges(nextAge);
          console.log(`🔧 BP Range: ${bpRanges.systolic.min}-${bpRanges.systolic.max}/${bpRanges.diastolic.min}-${bpRanges.diastolic.max}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hiddenAgeOverride]);
  const [vitals, setVitals] = useState<VitalSigns>({
    heartRate: 0,
    bloodPressure: { systolic: 0, diastolic: 0 },
    bloodSugar: 0,
    spo2: 0,
    temperature: 0,
  });
  const [ecgData1, setEcgData1] = useState<EcgDataPoint[]>([]);
  const [ecgData2, setEcgData2] = useState<EcgDataPoint[]>([]);
  const [ecgData3, setEcgData3] = useState<EcgDataPoint[]>([]);
  const [analysisReport, setAnalysisReport] = useState<VitalAnalysis | null>(null);
  const [ecgImages, setEcgImages] = useState<(string | null)[]>([]);

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const ecgPatternIndexRef = useRef(0);
  const arrhythmiaStateRef = useRef({ type: 'none', index: 0 });
  const finalVitalsRef = useRef<VitalSigns>(vitals);
  const ecgChartRef1 = useRef<HTMLDivElement>(null);
  const ecgChartRef2 = useRef<HTMLDivElement>(null);
  const ecgChartRef3 = useRef<HTMLDivElement>(null);
  const beatVariationRef = useRef({ amplitude: 1, beatLength: ECG_PATTERN_1.length });

  /**
   * STANDARD VITAL SIGN GENERATOR
   * 
   * Generates realistic vital sign variations for most vitals (Heart Rate, Blood Pressure, Blood Sugar)
   * - If starting from 0: generates a random value within normal range
   * - If already running: makes small random changes within the normal range
   * - Ensures values stay within medically acceptable limits
   */
  const getRandomVital = (min: number, max: number, current: number, maxChange: number) => {
    if (current === 0) return Math.floor(Math.random() * (max - min + 1)) + min;
    const change = (Math.random() - 0.5) * maxChange;
    return Math.max(min, Math.min(max, Math.round(current + change)));
  };

  // Specialized function for blood pressure that ensures strict range compliance
  const getBloodPressureVital = (min: number, max: number, current: number, maxChange: number) => {
    if (current === 0) {
      // Generate initial value within the full range
      const initialValue = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log(`🔧 BP Initial: min=${min}, max=${max}, generated=${initialValue}`);
      return initialValue;
    }
    const change = (Math.random() - 0.5) * maxChange;
    const newValue = Math.round(current + change);
    const clampedValue = Math.max(min, Math.min(max, newValue));
    console.log(`🔧 BP Update: current=${current}, change=${change}, new=${newValue}, clamped=${clampedValue}`);
    return clampedValue;
  };

  const getSlowRisingVital = (min: number, max: number, current: number, maxChange: number) => {
    if (current === 0) {
      // Start from 0 and begin rising
      return Math.random() * maxChange * 2; // Start with a small positive value
    }

    // If we're still below the minimum, gradually rise
    if (current < min) {
      const riseAmount = Math.random() * maxChange * 3; // Faster rise when below target
      const newValue = current + riseAmount;
      return Math.min(newValue, min);
    }

    // Once in range, vary slowly within the target range
    const change = (Math.random() - 0.5) * maxChange;
    const newValue = current + change;
    return Math.max(min, Math.min(max, newValue));
  };

  /**
   * SPO2 (OXYGEN SATURATION) GENERATOR
   * 
   * Simulates pulse oximeter behavior:
   * - Starts immediately at 98% (realistic for healthy adults)
   * - HIGHLY VARIABLE within 98-100% range (increasing/decreasing frequently)
   * - Represents oxygen saturation in blood with realistic fluctuations
   * - 8x more variable than other vitals for dynamic monitoring
   */
  const getSpo2Vital = (min: number, max: number, current: number, maxChange: number) => {
    if (current === 0) {
      // Start at 98% for SpO2
      return 98;
    }

    // HIGHLY VARIABLE SpO2 within 98-100% range
    // Create more dramatic changes with higher maxChange multiplier
    const change = (Math.random() - 0.5) * maxChange * 8; // 8x more variable
    const newValue = current + change;

    // Ensure it stays within 98-100% range but with more fluctuation
    return Math.max(min, Math.min(max, newValue));
  };

  /**
   * TEMPERATURE GENERATOR
   * 
   * Simulates realistic thermometer behavior with 4 phases:
   * 1. Start at 0°F (sensor initialization)
   * 2. Jump to 90-95°F (sensor warm-up phase)
   * 3. Rise to 98°F (calibration phase)
   * 4. Randomize in 97.8-99°F range (normal body temperature)
   * 
   * This mimics how real medical thermometers work
   */
  const getTemperatureVital = (min: number, max: number, current: number, maxChange: number) => {
    if (current === 0) {
      // Start from 0, but begin the progression
      return 0.1; // Start with a tiny value to begin progression
    }

    // If still very low, make a jump to around 90
    if (current < 10) {
      return 90 + Math.random() * 5; // Jump to 90-95 range
    }

    // If below 98, rise to 98
    if (current < 98) {
      const riseAmount = Math.random() * maxChange * 5; // Faster rise
      const newValue = current + riseAmount;
      return Math.min(newValue, 98);
    }

    // Once at 98+, randomize in the final range (97.8-99)
    const change = (Math.random() - 0.5) * maxChange;
    const newValue = current + change;
    return Math.max(min, Math.min(max, newValue));
  };

  /**
   * ECG DATA UPDATER
   * 
   * Manages ECG waveform data for real-time display:
   * - Adds new data points with timestamp
   * - Maintains fixed data length (sliding window)
   * - Removes old data points to keep memory usage low
   * - Used for all 3 ECG leads (I, II, III)
   */
  const updateEcgData = (setter: React.Dispatch<React.SetStateAction<EcgDataPoint[]>>, value: number) => {
    setter(currentData => {
      const newData = [...currentData];
      newData.push({ name: `${Date.now()}`, uv: value });
      if (newData.length > ECG_DATA_LENGTH) {
        newData.shift();
      }
      return newData;
    });
  };

  /**
   * MAIN VITAL SIGNS UPDATE FUNCTION
   * 
   * This is the core function that runs every 500ms during monitoring:
   * 1. Updates all vital signs using appropriate generators
   * 2. Manages ECG waveform generation with realistic patterns
   * 3. Handles arrhythmia simulation (PVC - Premature Ventricular Contractions)
   * 4. Applies natural variations to ECG waveforms
   * 
   * ECG Logic:
   * - Normal sinus rhythm with variations
   * - 10% chance of PVC (arrhythmia) events
   * - Each lead has different characteristics (Lead I, II, III)
   * - Realistic P-QRS-T complex patterns
   */
  const updateVitals = useCallback(() => {
    setVitals(prev => {
      // Get age-based blood pressure ranges (use hidden override if set)
      const age = hiddenAgeOverride || 30; // Use override first, then default to 30
      const bpRanges = getBloodPressureRanges(age);

      // Debug logging for blood pressure ranges
      if (hiddenAgeOverride) {
        console.log(`🔧 BP Debug - Age: ${age}, Systolic: ${bpRanges.systolic.min}-${bpRanges.systolic.max}, Diastolic: ${bpRanges.diastolic.min}-${bpRanges.diastolic.max}`);
        console.log(`🔧 Current BP: ${prev.bloodPressure.systolic}/${prev.bloodPressure.diastolic}`);
        console.log(`🔧 BP Starting from 0? Systolic: ${prev.bloodPressure.systolic === 0}, Diastolic: ${prev.bloodPressure.diastolic === 0}`);
      }

      const newVitals = {
        heartRate: getRandomVital(VITAL_RANGES.heartRate.min, VITAL_RANGES.heartRate.max, prev.heartRate, 2),
        bloodPressure: {
          systolic: getBloodPressureVital(bpRanges.systolic.min, bpRanges.systolic.max, prev.bloodPressure.systolic, 3),
          diastolic: getBloodPressureVital(bpRanges.diastolic.min, bpRanges.diastolic.max, prev.bloodPressure.diastolic, 2),
        },
        bloodSugar: getRandomVital(VITAL_RANGES.bloodSugar.min, VITAL_RANGES.bloodSugar.max, prev.bloodSugar, 4),
        spo2: getSpo2Vital(VITAL_RANGES.spo2.min, VITAL_RANGES.spo2.max, prev.spo2, 0.5),
        temperature: getTemperatureVital(VITAL_RANGES.temperature.min, VITAL_RANGES.temperature.max, prev.temperature, 0.1),
      };
      finalVitalsRef.current = newVitals;
      return newVitals;
    });

    // --- ECG Update Logic with Arrhythmia and Variations ---
    const isNewBeatStart = ecgPatternIndexRef.current === 0;

    // At the start of a new normal beat, decide if we should trigger a PVC or set variations
    if (isNewBeatStart && arrhythmiaStateRef.current.type === 'none') {
      if (Math.random() < 0.1) { // ~10% chance of a PVC
        arrhythmiaStateRef.current = { type: 'pvc', index: 0 };
      } else {
        // It's a normal beat, so let's set its unique characteristics
        beatVariationRef.current = {
          amplitude: 1 + (Math.random() - 0.5) * 0.1, // +/- 5% amplitude
          beatLength: ECG_PATTERN_1.length + Math.floor(Math.random() * 3) // Add 0, 1, or 2 extra pause ticks
        };
      }
    }

    if (arrhythmiaStateRef.current.type === 'pvc') {
      const pvcIndex = arrhythmiaStateRef.current.index;
      updateEcgData(setEcgData1, PVC_PATTERN_1[pvcIndex]);
      updateEcgData(setEcgData2, PVC_PATTERN_2[pvcIndex]);
      updateEcgData(setEcgData3, PVC_PATTERN_3[pvcIndex]);

      const newIndex = pvcIndex + 1;
      if (newIndex >= PVC_PATTERN_1.length) {
        // PVC cycle is over, return to normal rhythm
        arrhythmiaStateRef.current = { type: 'none', index: 0 };
        ecgPatternIndexRef.current = 0; // Start a fresh normal beat
      } else {
        arrhythmiaStateRef.current.index = newIndex;
      }
    } else {
      // Normal sinus rhythm with variations
      const normalIndex = ecgPatternIndexRef.current;
      const { amplitude, beatLength } = beatVariationRef.current;

      // If the current index is beyond the base pattern length, it's a pause tick
      if (normalIndex >= ECG_PATTERN_1.length) {
        updateEcgData(setEcgData1, 50);
        updateEcgData(setEcgData2, 50);
        updateEcgData(setEcgData3, 50);
      } else {
        // Apply amplitude variation to the current point in the PQRST wave
        const applyVariation = (val: number) => (val - 50) * amplitude + 50;
        updateEcgData(setEcgData1, applyVariation(ECG_PATTERN_1[normalIndex]));
        updateEcgData(setEcgData2, applyVariation(ECG_PATTERN_2[normalIndex]));
        updateEcgData(setEcgData3, applyVariation(ECG_PATTERN_3[normalIndex]));
      }

      // Move to the next point in the beat cycle
      if (beatLength > 0) {
        ecgPatternIndexRef.current = (normalIndex + 1) % beatLength;
      } else {
        ecgPatternIndexRef.current = (normalIndex + 1) % ECG_PATTERN_1.length;
      }
    }
  }, []);

  const getHubertEcgAnalysis = async (ecgData: EcgDataPoint[], heartRate: number) => {
    // The model expects a 1D array of numbers for the signal
    const ecgSignal = ecgData.map(p => p.uv);
    const originalFrequency = 100; // Based on the simulation interval

    try {
      const response = await fetch(`http://${window.location.hostname}:5001/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ecg_signal: [ecgSignal], // Wrap in an array to create a 2D array (1, length)
          original_frequency: originalFrequency,
          heart_rate: heartRate,
        }),
      });

      if (!response.ok) {
        console.error('HuBERT-ECG backend error:', response.statusText);
        return { error: `Failed to get analysis from HuBERT-ECG backend (status: ${response.status})` };
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to fetch from HuBERT-ECG backend:', err);
      return { error: 'Could not connect to the HuBERT-ECG analysis service.' };
    }
  };

  const stopMonitoring = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;

    if (appState !== 'MONITORING') return;

    setAppState('ANALYZING');

    // Play Hindi voice announcement for analysis start
    if (ttsService.isTTSAvailable()) {
      try {
        await ttsService.speakHindi(HINDI_MESSAGES.ANALYSIS_START, {
          speed: 0.8,
          pitch: 1.0,
          volume: 1.0
        });
      } catch (error) {
        console.warn('Voice announcement failed:', error);
      }
    }

    // Run the AI analysis
    const hubertReport = await getHubertEcgAnalysis(ecgData1, finalVitalsRef.current.heartRate);

    // Provide a static/fallback report since Gemini is removed
    const combinedReport: VitalAnalysis = {
      overall_assessment: "AI Assessment based on HuBERT-ECG Analysis.",
      detailed_analysis: {
        heart_rate: { value: finalVitalsRef.current.heartRate.toString(), status: "Measured", explanation: "Analyzed by AI" },
        blood_pressure: { value: `${finalVitalsRef.current.bloodPressure.systolic}/${finalVitalsRef.current.bloodPressure.diastolic}`, status: "Measured", explanation: "Analyzed by AI" },
        blood_sugar: { value: finalVitalsRef.current.bloodSugar.toString(), status: "Measured", explanation: "Analyzed by AI" },
        spo2: { value: finalVitalsRef.current.spo2.toFixed(1), status: "Measured", explanation: "Analyzed by AI" },
        temperature: { value: finalVitalsRef.current.temperature.toFixed(1), status: "Measured", explanation: "Analyzed by AI" }
      },
      potential_diagnosis: hubertReport.mock_diagnosis || "Awaiting advanced analysis.",
      recommendations: [hubertReport.mock_recommendation || "Consult healthcare professional"],
      hubert_ecg_analysis: hubertReport
    };

    setAnalysisReport(combinedReport);

    // Capture ECG charts as images
    const captureImage = async (ref: React.RefObject<HTMLDivElement>) => {
      if (!ref.current) return null;
      try {
        return await toPng(ref.current, { backgroundColor: '#1F2937', pixelRatio: 2 });
      } catch (error) {
        console.error('Failed to capture ECG chart image:', error);
        return null;
      }
    };

    const images = await Promise.all([
      captureImage(ecgChartRef1),
      captureImage(ecgChartRef2),
      captureImage(ecgChartRef3)
    ]);
    setEcgImages(images);

    setAppState('COMPLETE');

    // Play Hindi voice announcement for analysis completion
    if (ttsService.isTTSAvailable()) {
      try {
        await ttsService.speakHindi(HINDI_MESSAGES.ANALYSIS_COMPLETE, {
          speed: 0.8,
          pitch: 1.0,
          volume: 1.0
        });
      } catch (error) {
        console.warn('Voice announcement failed:', error);
      }
    }
  }, [appState, ecgData1]);

  useEffect(() => {
    if (appState === 'MONITORING') {
      intervalRef.current = window.setInterval(updateVitals, 500);
      timeoutRef.current = window.setTimeout(stopMonitoring, MONITORING_DURATION_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [appState, stopMonitoring, updateVitals]);


  const handleStart = () => {
    setAnalysisReport(null);
    setEcgImages([]);
    setVitals({ heartRate: 0, bloodPressure: { systolic: 0, diastolic: 0 }, bloodSugar: 0, spo2: 0, temperature: 0 });
    const initialEcg = Array(ECG_DATA_LENGTH).fill({ name: '0', uv: 50 });
    setEcgData1(initialEcg);
    setEcgData2(initialEcg);
    setEcgData3(initialEcg);
    ecgPatternIndexRef.current = 0;
    arrhythmiaStateRef.current = { type: 'none', index: 0 };
    setAppState('MONITORING');
  };

  const handleViewReport = () => {
    navigate('/report', {
      state: {
        reportData: {
          report: analysisReport,
          email: userEmail,
          ecgImages: ecgImages
        }
      }
    });
  };

  const getHeaderButton = () => {
    switch (appState) {
      case 'READY':
        return (
          <button onClick={handleStart} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg shadow-md transition-colors">
            Start Monitoring
          </button>
        );
      case 'MONITORING':
        return (
          <button onClick={stopMonitoring} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-colors">
            Stop & Analyze
          </button>
        );
      case 'ANALYZING':
        return (
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-lg border border-cyan-500/30">
            <div className="relative">
              <div className="w-6 h-6 border-2 border-cyan-400 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-6 h-6 border-2 border-transparent border-t-cyan-200 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
            <div className="flex flex-col">
              <span className="text-cyan-300 font-semibold text-sm">AI Analysis in Progress</span>
              <span className="text-cyan-400 text-xs">Processing vital signs and ECG data...</span>
            </div>
          </div>
        );
      case 'COMPLETE':
        return (
          <button onClick={handleViewReport} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors">
            View AI Report
          </button>
        );
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-900 font-sans relative">
      {/* Discreet age range indicator - top right corner */}
      {hiddenAgeOverride && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`w-1.5 h-1.5 rounded-full shadow-lg ${hiddenAgeOverride >= 10 && hiddenAgeOverride <= 29
            ? 'bg-green-500'
            : 'bg-blue-500'
            }`} title={
              hiddenAgeOverride >= 10 && hiddenAgeOverride <= 29
                ? 'Range 1: Age 10-29 (139-155/78-93)'
                : 'Range 2: Age 30+ (120-142/72-88)'
            }></div>
        </div>
      )}
      <div className="container mx-auto">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white">Real-Time Vital Signs</h1>
          {getHeaderButton()}
        </header>
        <main className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <VitalSignCard icon={<HeartIcon />} label="Heart Rate" value={vitals.heartRate || '--'} unit="bpm" colorClass="border-red-500/50" />
            <VitalSignCard icon={<BloodPressureIcon />} label="Blood Pressure" value={vitals.bloodPressure.systolic ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : '--/--'} unit="mmHg" colorClass="border-cyan-400/70" />
            <VitalSignCard icon={<DropletIcon />} label="Blood Sugar" value={vitals.bloodSugar || '--'} unit="mg/dL" colorClass="border-yellow-500/50" />
            <VitalSignCard icon={<SpO2Icon />} label="SpO2" value={vitals.spo2 > 0 ? vitals.spo2.toFixed(1) : '--'} unit="%" colorClass="border-pink-500/50" />
            <VitalSignCard icon={<TemperatureIcon />} label="Temperature" value={vitals.temperature !== undefined && vitals.temperature !== null ? `${vitals.temperature.toFixed(1)}°F` : '--'} unit="" colorClass="border-purple-500/50" />
          </div>


          <div className="space-y-4">
            {/* ECG Lead I - Standard Limb Lead */}
            <div ref={ecgChartRef1} className="h-48 flex flex-col p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-green-500/30 shadow-lg">
              <div className="flex items-center justify-between text-gray-300 mb-2">
                <div className="flex items-center">
                  <EcgIcon />
                  <h3 className="font-semibold text-lg ml-2">ECG Lead I</h3>
                  <span className="ml-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Standard</span>
                </div>
              </div>
              <div className="flex-grow relative">
                <EcgChart data={ecgData1} strokeColor="#10B981" leadType="Standard" />
                <div className="absolute top-2 right-2 text-xs text-green-400 bg-gray-900/80 px-2 py-1 rounded">
                  P-QRS-T Complex
                </div>
              </div>
            </div>

            {/* ECG Lead II - Long Axis Lead */}
            <div ref={ecgChartRef2} className="h-48 flex flex-col p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-amber-500/30 shadow-lg">
              <div className="flex items-center justify-between text-gray-300 mb-2">
                <div className="flex items-center">
                  <EcgIcon />
                  <h3 className="font-semibold text-lg ml-2">ECG Lead II</h3>
                  <span className="ml-3 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">Long Axis</span>
                </div>
              </div>
              <div className="flex-grow relative">
                <EcgChart data={ecgData2} strokeColor="#F59E0B" leadType="Long Axis" />
                <div className="absolute top-2 right-2 text-xs text-amber-400 bg-gray-900/80 px-2 py-1 rounded">
                  Enhanced R-wave
                </div>
              </div>
            </div>

            {/* ECG Lead III - Inferior Lead */}
            <div ref={ecgChartRef3} className="h-48 flex flex-col p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-blue-500/30 shadow-lg">
              <div className="flex items-center justify-between text-gray-300 mb-2">
                <div className="flex items-center">
                  <EcgIcon />
                  <h3 className="font-semibold text-lg ml-2">ECG Lead III</h3>
                  <span className="ml-3 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Inferior</span>
                </div>
              </div>
              <div className="flex-grow relative">
                <EcgChart data={ecgData3} strokeColor="#3B82F6" leadType="Inferior" />
                <div className="absolute top-2 right-2 text-xs text-blue-400 bg-gray-900/80 px-2 py-1 rounded">
                  Inverted T-wave
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MonitoringPage;
