import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';

const screens = [
  'dashboard', 'pages', 'menu', 'media', 'events', 'resources', 'sevas',
  'orders', 'puja-manifest', 'devotees', 'whatsapp', 'settings', 'users',
] as const;

function Placeholder({ name }: { name: string }) {
  return (
    <main className="p-8">
      <h1 className="font-serif text-2xl text-maroon">{name}</h1>
      <p className="mt-2">CMS screen placeholder. Built in its own step.</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <nav className="w-56 bg-charcoal p-4 text-sm text-white">
          <p className="mb-4 font-serif text-lg">VedaNeri CMS</p>
          <ul className="space-y-1">
            {screens.map((s) => (
              <li key={s}>
                <NavLink to={`/${s}`} className={({ isActive }) => `block rounded px-2 py-1 ${isActive ? 'bg-saffron text-charcoal' : 'hover:bg-white/10'}`}>
                  {s}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Placeholder name="login" />} />
            {screens.map((s) => (
              <Route key={s} path={`/${s}`} element={<Placeholder name={s} />} />
            ))}
            <Route path="*" element={<Placeholder name="not found" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
