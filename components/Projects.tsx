const projects = [
  {
    title: "360° Panoramic Calibration System",
    description:
      "Architected and led development of an internal R&D tool for calibrating panoramic imagery used in urban-planning products. The project matured from a research prototype into a core product feature, now the foundation for multiple client deployments across New Zealand councils.",
    outcome: "Core product feature · Used in multiple council/govt deployments",
    stack: ["Angular", "Three.js", "Marzipano", "TypeScript", "Node.js", "AWS"],
    category: "3D Visualisation",
  },
  {
    title: "Interactive 3D Urban Planning Visualiser",
    description:
      "Designed and built client-facing 3D spatial applications that let councils and government agencies visualise infrastructure proposals in real-time. Embedded into decision-making workflows for urban development projects.",
    outcome: "Adopted by NZ councils and government agencies",
    stack: ["Three.js", "Angular", "TypeScript", "Leaflet", "D3.js", "AWS"],
    category: "3D Visualisation",
  },
  {
    title: "AI Adoption Pilot — Engineering Team",
    description:
      "Appointed as lead developer for the company-wide AI adoption initiative. Evaluated and recommended AI tooling for the engineering team, defined usage guidelines, and continue to drive ongoing AI productivity improvements — including spec-driven development workflows with GitHub Copilot.",
    outcome: "Company-wide adoption · Measurable productivity improvement",
    stack: ["GitHub Copilot", "MCP (Agentic AI)", "AI Spec-driven Dev"],
    category: "AI & Tooling",
  },
  {
    title: "Internal Admin & Content Management Tooling",
    description:
      "Built and maintained internal admin systems that streamline content management and project delivery workflows, reducing manual operations and freeing up the team for higher-value work.",
    outcome: "Reduced delivery cycle time across project teams",
    stack: ["Angular", "TypeScript", "Node.js", "REST APIs", "AWS"],
    category: "Tooling",
  },
  {
    title: "NZ Courier Group — Web Platform",
    description:
      "Delivered websites and web applications for New Zealand Couriers, Posthaste, Castle Parcel and Now Couriers. Full project lifecycle from interaction design and wireframes through to production build and ongoing client support.",
    outcome: "Live production sites serving NZ courier customers",
    stack: ["Angular", "React", "Next.js", "Node.js", "WordPress", "AWS"],
    category: "Full-Stack",
  },
  {
    title: "Engineering Process Improvements",
    description:
      "Drove a systematic uplift of engineering practices at Truescape: introduced ESLint code-linting, GitLab CI PR checks, automated code-review assignment, git pre-commit hooks, and branch protection rules. Created a developer estimation script and code-review guideline adopted team-wide.",
    outcome: "Reduced review cycle time · Lower defect rate",
    stack: ["ESLint", "GitLab CI", "Git Hooks", "Playwright"],
    category: "DevX / Process",
  },
];

const categoryColors: Record<string, string> = {
  "3D Visualisation": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "AI & Tooling": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "Tooling": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Full-Stack": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "DevX / Process": "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default function Projects() {
  return (
    <section id="projects" className="py-24 px-6 max-w-6xl mx-auto">
      <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">Portfolio</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Featured Work</h2>
      <p className="text-gray-500 mb-14 max-w-xl">
        Most work is client or internal — live demos aren&apos;t public, but here&apos;s what I built and why it mattered.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p, i) => (
          <div
            key={i}
            className="flex flex-col p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-900/80 transition-all duration-200 glow-box-cyan"
          >
            <div className="flex items-start justify-between mb-4">
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${categoryColors[p.category] ?? "text-gray-400 bg-gray-800 border-gray-700"}`}>
                {p.category}
              </span>
            </div>

            <h3 className="text-white font-semibold text-base mb-2 leading-snug">{p.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1">{p.description}</p>

            <div className="mt-auto">
              <p className="text-xs text-cyan-500/80 font-mono mb-3">
                ✓ {p.outcome}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-500 font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <a
          href="https://github.com/nui-tech"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors duration-200 text-sm font-mono"
        >
          View GitHub profile
          <span>→</span>
        </a>
      </div>
    </section>
  );
}
