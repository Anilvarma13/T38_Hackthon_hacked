import { Router, Request, Response } from 'express';
import { query, param, body, validationResult } from 'express-validator';
import { PatientReport } from '../models/PatientReport';
import { compareTwoReports, trendsForPatient, recurringRisksForReport } from '../services/reportInsights';

const router = Router();

const RISK_LEVELS = new Set(['LOW', 'MODERATE', 'MEDIUM', 'HIGH', 'CRITICAL']);

function serialize(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const o = { ...doc };
  if (o._id) {
    o._id = String(o._id);
    o.id = o._id;
  }
  return o;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/v1/reports/trends?patient=Name
router.get(
  '/trends',
  query('patient').trim().notEmpty().isLength({ max: 200 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid patient query', details: errors.array() });
    }
    const patient = String(req.query.patient);
    const data = await trendsForPatient(patient);
    if (!data) {
      return res.status(404).json({ error: 'No reports found for patient' });
    }
    res.json(data);
  }
);

// GET /api/v1/reports/:id/compare?baseline=<otherId>
router.get(
  '/:id/compare',
  param('id').isMongoId(),
  query('baseline').isMongoId(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid ids', details: errors.array() });
    }
    const currentId = req.params.id;
    const baselineId = String(req.query.baseline);
    const data = await compareTwoReports(currentId, baselineId);
    if (!data) {
      return res.status(404).json({ error: 'One or both reports not found' });
    }
    res.json({
      ...data,
      current: serialize(data.current as Record<string, unknown>),
      baseline: serialize(data.baseline as Record<string, unknown>),
    });
  }
);

// GET /api/v1/reports/:id/recurring-risks
router.get('/:id/recurring-risks', param('id').isMongoId(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid report id', details: errors.array() });
  }
  const data = await recurringRisksForReport(req.params.id);
  if (!data) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.json(data);
});

// PATCH /api/v1/reports/:id/favorite
router.patch(
  '/:id/favorite',
  param('id').isMongoId(),
  body('is_favorite').isBoolean(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid payload', details: errors.array() });
    }
    const updatedArray = await PatientReport.findByIdAndUpdate(
      req.params.id,
      { is_favorite: Boolean(req.body.is_favorite) }
    ).lean();
    const updated = Array.isArray(updatedArray) ? updatedArray[0] : updatedArray;
    if (!updated) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(serialize(updated));
  }
);

// GET /api/v1/reports — list with search & filters
router.get(
  '/',
  query('search').optional().isString().isLength({ max: 200 }),
  query('risk_level').optional().isString(),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid query', details: errors.array() });
    }

    const filter: Record<string, unknown> = {};

    const search = req.query.search ? String(req.query.search).trim() : '';
    if (search) {
      filter.patient_name = new RegExp(escapeRegex(search), 'i');
    }

    const riskRaw = req.query.risk_level ? String(req.query.risk_level).toUpperCase() : '';
    if (riskRaw) {
      const parts = riskRaw.split(',').map((s) => s.trim()).filter(Boolean);
      const levels = parts.filter((p) => RISK_LEVELS.has(p));
      if (levels.length) {
        filter.risk_score = { $in: levels };
      }
    }

    const dateFrom = req.query.date_from ? new Date(String(req.query.date_from)) : null;
    const dateTo = req.query.date_to ? new Date(String(req.query.date_to)) : null;
    if (dateFrom || dateTo) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (dateFrom && !isNaN(dateFrom.getTime())) range.$gte = dateFrom;
      if (dateTo && !isNaN(dateTo.getTime())) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      if (Object.keys(range).length) filter.created_at = range;
    }

    try {
      const reports = await PatientReport.find(filter).sort({ created_at: -1 }).lean();
      res.json(reports.map((r) => serialize(r as Record<string, unknown>)));
    } catch (error: unknown) {
      console.error('Fetch Reports Error:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
);

// GET /api/v1/reports/:id
router.get('/:id', param('id').isMongoId(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid report id', details: errors.array() });
  }
  try {
    const reportArray = await PatientReport.findById(req.params.id).lean();
    const report = Array.isArray(reportArray) ? reportArray[0] : reportArray;
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(serialize(report as Record<string, unknown>));
  } catch (error: unknown) {
    console.error('Fetch Report Error:', error);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

// DELETE /api/v1/reports/:id
router.delete('/:id', param('id').isMongoId(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid report id', details: errors.array() });
  }
  try {
    const reportArray = await PatientReport.findByIdAndDelete(req.params.id).lean();
    const report = Array.isArray(reportArray) ? reportArray[0] : reportArray;
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error: unknown) {
    console.error('Delete Report Error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// POST /api/v1/reports/:id/notes
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Note text required' });

    const doctorName = req.user?.username || 'Unknown Doctor';
    const newNote = {
      note,
      doctor: doctorName,
      timestamp: new Date().toISOString()
    };

    const reportQuery = PatientReport.findById(req.params.id).lean();
    if (!reportQuery || reportQuery.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // We update using our local DB mock
    const report = reportQuery[0];
    const notes = report.doctor_notes || [];
    notes.push(newNote);
    
    const updated = PatientReport.findByIdAndUpdate(req.params.id, { doctor_notes: notes });
    res.json({ success: true, doctor_notes: notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
