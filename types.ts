
export interface VitalSigns {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  bloodSugar: number;
  spo2: number;
  temperature: number;
}


export interface EcgDataPoint {
  name: string;
  uv: number;
}

export interface VitalAnalysis {
  overall_assessment: string;
  detailed_analysis: {
    heart_rate: {
      value: string;
      status: string;
      explanation: string;
    };
    blood_pressure: {
      value: string;
      status: string;
      explanation: string;
    };
    blood_sugar: {
      value: string;
      status: string;
      explanation: string;
    };
    spo2: {
      value: string;
      status: string;
      explanation: string;
    };
    temperature: {
      value: string;
      status: string;
      explanation: string;
    };
  };
  potential_diagnosis: string;
  recommendations: string[];
  hubert_ecg_analysis?: any;
}
