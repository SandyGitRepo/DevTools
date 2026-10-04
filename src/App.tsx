import { Route, Routes } from 'react-router-dom';
import Layout from './components/shell/Layout';
import Home from './pages/Home';
import ToolHost from './pages/ToolHost';
import ModulePage from './pages/ModulePage';
import About from './pages/About';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="module/:moduleId" element={<ModulePage />} />
        <Route path="tool/:toolId" element={<ToolHost />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
