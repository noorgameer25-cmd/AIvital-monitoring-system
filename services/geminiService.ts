
import { GoogleGenAI } from "@google/genai";
import type { VitalSigns } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getVitalAnalysis = async (vitals: VitalSigns, age?: number): Promise<string> => {
  const prompt = `
    You are a highly intelligent medical AI assistant. Your task is to analyze the following patient vital signs and produce a detailed, easy-to-understand health report.

---

Patient Information:
- Age: ${age || 'Not specified'}
- Heart Rate: ${vitals.heartRate} bpm
- Blood Pressure: ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg
- Blood Sugar: ${vitals.bloodSugar} mg/dL
- SpO2: ${vitals.spo2}%
- Temperature: ${vitals.temperature}°F

---

You must return your response strictly as a valid JSON object in the following structure:

{
  "overall_assessment": "string - clear, concise summary of the patient's overall condition (2–3 sentences).",
  "detailed_analysis": {
    "heart_rate": {
      "value": "number + unit",
      "status": "Normal/High/Low",
      "explanation": "2–4 sentence professional-level explanation in plain text (medium length, no markdown)."
    },
    "blood_pressure": {
      "value": "systolic/diastolic mmHg",
      "status": "Normal/High/Low",
      "explanation": "2–4 sentence professional-level explanation in plain text (medium length, no markdown)."
    },
    "blood_sugar": {
      "value": "number + unit",
      "status": "Normal/High/Low",
      "explanation": "2–4 sentence professional-level explanation in plain text (medium length, no markdown)."
    },
    "spo2": {
      "value": "number + unit",
      "status": "Normal/High/Low",
      "explanation": "2–4 sentence professional-level explanation in plain text (medium length, no markdown)."
    },
    "temperature": {
      "value": "number + unit",
      "status": "Normal/High/Low",
      "explanation": "2–4 sentence professional-level explanation in plain text (medium length, no markdown)."
    }
  },
  "potential_diagnosis": "string - cautious interpretation using phrases like 'These readings might suggest...' or 'It’s worth considering...' (2–3 sentences). Avoid definitive statements.",
  "recommendations": [
    "Adequate rest and sleep (7–9 hours nightly)",
    "Proper hydration with electrolytes",
    "Light physical activity if appropriate",
    "Stress management techniques",
    "Regular health monitoring"
  ]
}

---

Reference Ranges:
- Heart Rate: 60–100 bpm (normal)
- Blood Pressure: 
  * Ages 10-29: 139-155/78-93 mmHg (normal for this age group)
  * Ages 30+: 120-142/72-88 mmHg (normal for this age group)
  * General: less than 120/80 mmHg (traditional normal)
- Blood Sugar (post-meal): less than 140 mg/dL (normal)
- SpO2: 95–100% (normal)
- Temperature: 97.8–99.0°F (normal)

---

Formatting Rules:
1. Output only valid JSON — no markdown, no headings, no bullet symbols outside arrays.
2. Keep tone professional, objective, and medical-grade.
3. Explanations should be medium length — detailed enough to sound clinical but easy for a patient to understand.
4. Do not include disclaimers, AI mentions, or trailing comments.
5. No text outside the JSON object.

---

Example Output:

{
  "overall_assessment": "The patient's vital signs are mostly within healthy limits, though the blood pressure and sugar levels indicate mild elevations. Overall, the cardiovascular and respiratory parameters appear stable.",
  "detailed_analysis": {
    "heart_rate": {
      "value": "85 bpm",
      "status": "Normal",
      "explanation": "The heart rate is within the healthy range for adults, indicating proper cardiac rhythm and stable circulation. This suggests the heart is functioning effectively without signs of stress or overexertion."
    },
    "blood_pressure": {
      "value": "128/86 mmHg",
      "status": "Slightly High",
      "explanation": "This reading is slightly above the normal range, which could indicate mild prehypertension. It may result from temporary stress, caffeine intake, or an early sign of elevated blood pressure that should be monitored over time."
    },
    "blood_sugar": {
      "value": "160 mg/dL",
      "status": "High",
      "explanation": "A blood sugar level above 140 mg/dL after eating is higher than normal and could point to early insulin resistance. Monitoring dietary habits and reducing sugary food intake may help maintain better glucose control."
    },
    "spo2": {
      "value": "97%",
      "status": "Normal",
      "explanation": "Oxygen saturation is within the normal range, showing that the lungs and cardiovascular system are efficiently delivering oxygen throughout the body. No signs of respiratory distress are present."
    },
    "temperature": {
      "value": "98.4°F",
      "status": "Normal",
      "explanation": "The body temperature falls comfortably within the normal range, indicating no signs of fever, infection, or inflammation at this time."
    }
  },
  "potential_diagnosis": "These readings might suggest mild hypertension and slightly elevated blood sugar, which could indicate early metabolic imbalance or lifestyle-related stress factors. It’s worth considering follow-up monitoring to prevent long-term complications.",
  "recommendations": [
    "Maintain consistent sleep schedule (7–9 hours per night)",
    "Stay hydrated and limit caffeine and sodium intake",
    "Adopt a balanced diet with reduced sugar and processed food",
    "Engage in light to moderate exercise such as walking or yoga",
    "Regularly monitor blood pressure and sugar levels for trends"
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating analysis from Gemini:", error);
    return "An error occurred while analyzing the vital signs. The AI service may be unavailable. Please try again later.";
  }
};
