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

// Generate random ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Create a Mongoose-like interface 
// To keep the controllers completely unmodified!

export const Report = {
  find: () => {
    return {
      sort: (rule: any) => {
        return {
          select: (filter: any) => {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            // sort by created_at desc if rule { created_at: -1 }
            if (rule && rule.created_at === -1) {
              data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            return data;
          }
        }
      }
    };
  },
  
  findById: (id: string) => {
    return {
      select: (filter: any) => {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        return data.find((r: any) => r._id === id) || null;
      }
    }
  },

  findByIdAndDelete: async (id: string) => {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const index = data.findIndex((r: any) => r._id === id);
    if (index === -1) return null;
    const deleted = data.splice(index, 1)[0];
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return deleted;
  }
};

// Instead of setting up new Report({ ... }).save() using Mongoose,
// We will export a generic constructor.
export function ReportModel(this: any, data: any) {
  Object.assign(this, data);
  this._id = generateId();
  if (!this.created_at) {
    this.created_at = new Date().toISOString();
  }
  
  this.save = async () => {
    const records = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    records.push(this);
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2));
    return this;
  };
}

export { ReportModel as ReportClass };
