// Simulates data extracted from an uploaded patient PDF
export const mockPatientData = {
  id: "PT-2024-0847",
  name: "Rajan Mehta",
  age: 62,
  gender: "Male",
  ward: "Cardiology ICU — Ward 4B",
  caseType: "Cardiac Emergency",
  admittedDate: "2024-04-08",
  attendingDoctor: "Dr. Priya Sharma",
  nextAppointment: {
    date: "2024-04-14",
    time: "09:30 AM",
    department: "Cardiology OPD",
    doctor: "Dr. Priya Sharma",
  },

  vitals: {
    heartRate: 112,
    bloodPressureSystolic: 158,
    bloodPressureDiastolic: 98,
    temperature: 38.4,
    spo2: 94,
    respiratoryRate: 22,
    gcs: 14,
  },

  clinicalNotes:
    "Patient admitted with acute hypertensive crisis. History of Type 2 Diabetes and CAD. Currently on antihypertensive therapy. Patient reports persistent headache and mild chest discomfort. ECG showed T-wave inversion in V4-V6. Echo pending. Renal function borderline.",

  medications: [
    { name: "Amlodipine 10mg", status: "administered", time: "08:00" },
    { name: "Metoprolol 50mg", status: "missed", time: "12:00", note: "Not administered — nurse unavailable" },
    { name: "Aspirin 150mg", status: "administered", time: "08:00" },
    { name: "Atorvastatin 40mg", status: "pending", time: null },
    { name: "Insulin (Glargine 20U)", status: "administered", time: "07:30" },
  ],

  labs: [
    { name: "Serum Creatinine", value: 1.8, unit: "mg/dL", normal: "0.7–1.3", status: "high" },
    { name: "eGFR", value: 42, unit: "mL/min/1.73m²", normal: ">60", status: "low" },
    { name: "Troponin I", value: 0.08, unit: "ng/mL", normal: "<0.04", status: "high" },
    { name: "HbA1c", value: 8.9, unit: "%", normal: "<7.0", status: "high" },
    { name: "BNP", value: 780, unit: "pg/mL", normal: "<100", status: "high" },
    { name: "Potassium", value: 3.3, unit: "mEq/L", normal: "3.5–5.0", status: "low" },
    { name: "WBC", value: 11.4, unit: "×10³/μL", normal: "4–11", status: "high" },
  ],

  // Historical readings for trend charts (6 data points over 24 hours)
  bpHistory: [
    { time: "00:00", systolic: 142, diastolic: 88 },
    { time: "04:00", systolic: 149, diastolic: 91 },
    { time: "08:00", systolic: 155, diastolic: 95 },
    { time: "12:00", systolic: 167, diastolic: 101 },
    { time: "16:00", systolic: 163, diastolic: 99 },
    { time: "20:00", systolic: 158, diastolic: 98 },
  ],

  hrHistory: [
    { time: "00:00", hr: 88 },
    { time: "04:00", hr: 95 },
    { time: "08:00", hr: 104 },
    { time: "12:00", hr: 118 },
    { time: "16:00", hr: 109 },
    { time: "20:00", hr: 112 },
  ],

  lastVitalsUpdate: "2024-04-11T18:45:00",
  lastNurseNote: "2024-04-11T14:20:00",
  echoStatus: "pending",
  allergyInfo: null, // intentionally missing
  codeStatus: "Full Code",
  isolation: false,
};
