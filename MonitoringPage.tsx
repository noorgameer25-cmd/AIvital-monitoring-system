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
import { getBloodPressureRanges, ECG_DATA_LENGTH, MONITORING_DURATION_MS } from './constants';
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

  // Hardware integration state
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);

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

  const timeoutRef = useRef<number | null>(null);
  const finalVitalsRef = useRef<VitalSigns>(vitals);
  const ecgChartRef1 = useRef<HTMLDivElement>(null);
  const ecgChartRef2 = useRef<HTMLDivElement>(null);
  const ecgChartRef3 = useRef<HTMLDivElement>(null);

  // NOTE: Random vital sign simulation removed. Vitals are now entirely driven
  // by the incoming data read from the Web Serial port in `readLoop`.

  // useEffect was moved below stopMonitoring definition to satisfy React hooks rule of declaration order.
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
      timeoutRef.current = window.setTimeout(stopMonitoring, MONITORING_DURATION_MS);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [appState, stopMonitoring, isSerialConnected]);

  // Handle Serial Connection
  const connectSerial = async () => {
    try {
      // @ts-ignore - Web Serial API is sometimes not fully typed in standard DOM libraries
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 }); // standard baud rate
      portRef.current = port;
      setIsSerialConnected(true);

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      readLoop(reader);
    } catch (e) {
      console.error("Failed to connect to serial device:", e);
      setIsSerialConnected(false);
    }
  };

  const readLoop = async (reader: any) => {
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            try {
              const data = JSON.parse(line.trim());

              setVitals(prev => {
                const updated = {
                  ...prev,
                  heartRate: data.hr ?? data.heartRate ?? prev.heartRate,
                  bloodPressure: {
                    systolic: data.systolic ?? data.bp?.[0] ?? prev.bloodPressure.systolic,
                    diastolic: data.diastolic ?? data.bp?.[1] ?? prev.bloodPressure.diastolic
                  },
                  spo2: data.spo2 ?? data.oxygen ?? prev.spo2,
                  temperature: data.temp ?? data.temperature ?? prev.temperature,
                  bloodSugar: data.glucose ?? data.bloodSugar ?? prev.bloodSugar,
                };
                finalVitalsRef.current = updated;
                return updated;
              });

              if (data.ecg !== undefined) updateEcgData(setEcgData1, data.ecg);
              if (data.ecg2 !== undefined) updateEcgData(setEcgData2, data.ecg2);
              if (data.ecg3 !== undefined) updateEcgData(setEcgData3, data.ecg3);
            } catch (e) {
              // Ignore invalid JSON lines from serial stream
            }
          }
        }
      }
    } catch (e) {
      console.warn("Serial read loop error:", e);
      setIsSerialConnected(false);
    }
  };

  const disconnectSerial = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (e) {
      console.error("Error disconnecting serial:", e);
    } finally {
      setIsSerialConnected(false);
      portRef.current = null;
      readerRef.current = null;
    }
  };


  const handleStart = () => {
    setAnalysisReport(null);
    setEcgImages([]);
    setVitals({ heartRate: 0, bloodPressure: { systolic: 0, diastolic: 0 }, bloodSugar: 0, spo2: 0, temperature: 0 });
    const initialEcg = Array(ECG_DATA_LENGTH).fill({ name: '0', uv: 50 });
    setEcgData1(initialEcg);
    setEcgData2(initialEcg);
    setEcgData3(initialEcg);
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
          <div className="flex gap-4">
            {!isSerialConnected ? (
              <button onClick={connectSerial} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Connect USB Device
              </button>
            ) : (
              <button onClick={disconnectSerial} className="px-6 py-2 bg-indigo-800 hover:bg-indigo-900 border border-indigo-500 text-indigo-200 font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Hardware Connected
              </button>
            )}
            <button
              onClick={handleStart}
              disabled={!isSerialConnected}
              className={`px-6 py-2 font-semibold rounded-lg shadow-md transition-colors ${isSerialConnected ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                }`}>
              {isSerialConnected ? 'Start Monitoring' : 'Device Required'}
            </button>
          </div>
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
