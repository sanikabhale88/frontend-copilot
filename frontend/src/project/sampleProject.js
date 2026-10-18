// Hardcoded sample project for Project Mode (Phase 1).
// File contents are template literals, so the sample code must not contain
// backticks or "${" — they would end or interpolate the outer string.

const sampleProject = {
  name: "Portfolio Starter",
  description: "A personal portfolio with home, projects and contact pages.",

  pages: [
    { name: "Home", route: "/", file: "src/pages/Home.jsx" },
    { name: "Projects", route: "/projects", file: "src/pages/Projects.jsx" },
    { name: "Contact", route: "/contact", file: "src/pages/Contact.jsx" },
  ],

  components: [
    { name: "Navbar", file: "src/components/Navbar.jsx", purpose: "Top navigation links" },
    { name: "ProjectCard", file: "src/components/ProjectCard.jsx", purpose: "Card for a single project" },
    { name: "Footer", file: "src/components/Footer.jsx", purpose: "Site footer" },
  ],

  files: {
    "src/App.jsx": `import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Contact from "./pages/Contact";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
`,

    "src/pages/Home.jsx": `import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="text-center py-16">
      <h1 className="text-4xl font-bold text-slate-900">Hi, I'm Alex.</h1>
      <p className="mt-4 text-lg text-slate-600">
        Frontend developer building clean, accessible interfaces.
      </p>
      <Link
        to="/projects"
        className="inline-block mt-8 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-500"
      >
        View my work
      </Link>
    </section>
  );
}
`,

    "src/pages/Projects.jsx": `import ProjectCard from "../components/ProjectCard";

const projects = [
  { title: "Weather App", description: "Forecasts with a clean, responsive UI.", tag: "React" },
  { title: "Task Board", description: "Drag-and-drop kanban for small teams.", tag: "React" },
  { title: "Recipe Finder", description: "Search recipes by ingredients.", tag: "JavaScript" },
];

export default function Projects() {
  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Projects</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.title} {...project} />
        ))}
      </div>
    </section>
  );
}
`,

    "src/pages/Contact.jsx": `import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSent(true);
  };

  if (sent) {
    return <p className="text-lg text-emerald-600">Thanks! I'll get back to you soon.</p>;
  }

  return (
    <section className="max-w-md">
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Contact</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input required placeholder="Your name" className="border border-slate-300 rounded-lg px-3 py-2" />
        <input required type="email" placeholder="Your email" className="border border-slate-300 rounded-lg px-3 py-2" />
        <textarea required rows={4} placeholder="Message" className="border border-slate-300 rounded-lg px-3 py-2" />
        <button className="bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-500">
          Send message
        </button>
      </form>
    </section>
  );
}
`,

    "src/components/Navbar.jsx": `import { Link } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-slate-900">Alex.dev</span>
        <div className="flex gap-6 text-sm font-medium text-slate-600">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-indigo-600">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
`,

    "src/components/ProjectCard.jsx": `export default function ProjectCard({ title, description, tag }) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
        {tag}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </article>
  );
}
`,

    "src/components/Footer.jsx": `export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
      © 2026 Alex. Built with React + Tailwind.
    </footer>
  );
}
`,
  },
};

export default sampleProject;
