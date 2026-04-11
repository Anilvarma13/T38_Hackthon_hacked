import React, { createContext, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import PatientPage from './pages/PatientPage';
import SummaryPage from './pages/SummaryPage';
import HandoffPage from './pages/HandoffPage';
import DashboardPage from './pages/DashboardPage';

export const AppContext = createContext();

export default function App() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [patientData, setPatientData] = useState(null);

  return (
    <AppContext.Provider value={{ uploadedFile, setUploadedFile, patientData, setPatientData }}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/handoff" element={<HandoffPage />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
