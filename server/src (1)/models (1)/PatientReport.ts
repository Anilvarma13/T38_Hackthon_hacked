import mongoose, { Schema, Document } from 'mongoose';

export interface IRiskItem {
  type: string;
  severity: string;
  value: string;
  normal_range: string;
  explanation: string;
}

export interface IVitalsNumeric {
  hemoglobin?: number;
  blood_pressure?: number;
  sugar?: number;
  oxygen?: number;
  heart_rate?: number;
}

export interface ICriticalAlert {
  title: string;
  dataPoint: string;
  explanation: string;
  level: string;
}

export interface IPatientReport extends Document {
  patient_name: string;
  age: string;
  gender: string;
  report_date: string;
  vitals: IVitalsNumeric;
  /** Human-readable vitals and notes extracted from the report (not raw files). */
  clinical_snapshot?: {
    hemoglobin?: string;
    blood_pressure?: string;
    sugar?: string;
    oxygen?: string;
    heart_rate?: string;
    cholesterol?: string;
    diagnosis?: string;
    notes?: string;
    prescriptions?: string[];
    recommended_tests?: string[];
  };
  risks: IRiskItem[];
  missed_actions: string[];
  risk_score: string;
  ai_summary: string;
  critical_alerts: ICriticalAlert[];
  is_favorite: boolean;
  created_at: Date;
}

const RiskItemSchema = new Schema<IRiskItem>(
  {
    type: { type: String, default: '' },
    severity: { type: String, default: 'MODERATE' },
    value: { type: String, default: '' },
    normal_range: { type: String, default: '' },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const VitalsNumericSchema = new Schema<IVitalsNumeric>(
  {
    hemoglobin: { type: Number },
    blood_pressure: { type: Number },
    sugar: { type: Number },
    oxygen: { type: Number },
    heart_rate: { type: Number },
  },
  { _id: false }
);

const ClinicalSnapshotSchema = new Schema(
  {
    hemoglobin: String,
    blood_pressure: String,
    sugar: String,
    oxygen: String,
    heart_rate: String,
    cholesterol: String,
    diagnosis: String,
    notes: String,
    prescriptions: [String],
    recommended_tests: [String],
  },
  { _id: false }
);

const CriticalAlertSchema = new Schema<ICriticalAlert>(
  {
    title: { type: String, default: '' },
    dataPoint: { type: String, default: '' },
    explanation: { type: String, default: '' },
    level: { type: String, default: 'warning' },
  },
  { _id: false }
);

const PatientReportSchema = new Schema<IPatientReport>(
  {
    patient_name: { type: String, required: true, maxlength: 200, index: true },
    age: { type: String, default: '', maxlength: 32 },
    gender: { type: String, default: '', maxlength: 64 },
    report_date: { type: String, default: '', maxlength: 64 },
    vitals: { type: VitalsNumericSchema, default: {} },
    clinical_snapshot: { type: ClinicalSnapshotSchema },
    risks: { type: [RiskItemSchema], default: [] },
    missed_actions: { type: [String], default: [] },
    risk_score: {
      type: String,
      default: 'LOW',
      index: true,
      enum: ['LOW', 'MODERATE', 'MEDIUM', 'HIGH', 'CRITICAL'],
    },
    ai_summary: { type: String, default: '', maxlength: 20000 },
    critical_alerts: { type: [CriticalAlertSchema], default: [] },
    is_favorite: { type: Boolean, default: false, index: true },
    created_at: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'patient_reports',
    versionKey: false,
  }
);

PatientReportSchema.index({ patient_name: 'text', ai_summary: 'text' });
PatientReportSchema.index({ created_at: -1 });

import fs from 'fs';
import path from 'path';

// Define the file paths
const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DB_DIR, 'patient_reports.json');

// Ensure data directory and file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const generateId = () => Math.random().toString(36).substring(2, 15);

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeData(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Emulate Mongoose Query Chain
class MockQuery {
  private data: any[];
  constructor(data: any[]) {
    this.data = data;
  }
  sort(rule: any) {
    if (rule && rule.created_at === -1) {
      this.data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return this;
  }
  lean() {
    return this.data; // Already raw POJOs
  }
}

export const PatientReport = {
  find: (filter: any = {}) => {
    let data = readData();
    
    // Apply filters matching mongoose operators
    if (filter.patient_name) {
      if (filter.patient_name instanceof RegExp) {
        data = data.filter((r: any) => filter.patient_name.test(r.patient_name));
      }
    }
    if (filter.risk_score && filter.risk_score.$in) {
      data = data.filter((r: any) => filter.risk_score.$in.includes(r.risk_score));
    }
    if (filter.created_at) {
      if (filter.created_at.$gte) {
        data = data.filter((r: any) => new Date(r.created_at) >= filter.created_at.$gte);
      }
      if (filter.created_at.$lte) {
        data = data.filter((r: any) => new Date(r.created_at) <= filter.created_at.$lte);
      }
    }
    // Also support patient_name exact string if used in trendsForPatient
    if (typeof filter.patient_name === 'string') {
      data = data.filter((r: any) => r.patient_name === filter.patient_name);
    }
    // and _id exact string
    if (filter._id) {
       data = data.filter((r: any) => r._id === filter._id);
    }

    return new MockQuery(data);
  },
  
  findById: (id: string) => {
    const data = readData();
    const item = data.find((r: any) => r._id === id || r.id === id) || null;
    return new MockQuery(item ? [item] : []);
  },

  findByIdAndDelete: (id: string) => {
    let data = readData();
    const index = data.findIndex((r: any) => r._id === id || r.id === id);
    let item = null;
    if (index !== -1) {
      item = data.splice(index, 1)[0];
      writeData(data);
    }
    return new MockQuery(item ? [item] : []);
  },

  findByIdAndUpdate: (id: string, update: any) => {
    let data = readData();
    const index = data.findIndex((r: any) => r._id === id || r.id === id);
    let item = null;
    if (index !== -1) {
      data[index] = { ...data[index], ...update };
      item = data[index];
      writeData(data);
    }
    return new MockQuery(item ? [item] : []);
  },

  create: async (payload: any) => {
    const records = readData();
    const doc = { ...payload, _id: generateId(), id: generateId() };
    if (!doc.created_at) doc.created_at = new Date().toISOString();
    records.push(doc);
    writeData(records);
    return doc;
  }
};

// Export Constructor for saving (new PatientReport).save()
export function PatientReportModel(this: any, data: any) {
  Object.assign(this, data);
  this._id = generateId();
  if (!this.created_at) {
    this.created_at = new Date().toISOString();
  }
  
  this.save = async () => {
    const records = readData();
    records.push(this);
    writeData(records);
    return this;
  };
}

(PatientReport as any).Model = PatientReportModel;
