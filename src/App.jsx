import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import SubjectList from "./pages/SubjectList";
import Subject from "./pages/Subject";
import StudyPlan from "./pages/StudyPlan";

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", direction: "rtl" }}>
        <Sidebar />
        <Routes>
          <Route path="/" element={<SubjectList mode="all" />} />
          <Route path="/all" element={<SubjectList mode="all" />} />
          <Route path="/favorites" element={<SubjectList mode="favorites" />} />
          <Route path="/recent" element={<SubjectList mode="recent" />} />
          <Route path="/most-visited" element={<SubjectList mode="most-visited" />} />
          <Route path="/subject/:id" element={<Subject />} />
          <Route path="/study-plan" element={<StudyPlan />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;