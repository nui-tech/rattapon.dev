const skillGroups = [
  {
    label: "Frontend",
    icon: "◈",
    color: "cyan",
    skills: ["Angular", "React", "Next.js", "TypeScript", "JavaScript", "HTML5 / CSS3 / SCSS", "Tailwind CSS"],
  },
  {
    label: "3D & Visualisation",
    icon: "◉",
    color: "violet",
    skills: ["Three.js", "WebGL", "Marzipano", "Leaflet", "D3.js"],
  },
  {
    label: "AI & Emerging",
    icon: "◊",
    color: "emerald",
    skills: ["MCP (Agentic AI)", "GitHub Copilot", "AI Spec-driven Development", "AI Tooling Evaluation"],
  },
  {
    label: "Backend & Cloud",
    icon: "▣",
    color: "blue",
    skills: ["Node.js", "REST APIs", "Firebase", "MySQL", "AWS"],
  },
  {
    label: "Desktop & Mobile",
    icon: "▤",
    color: "amber",
    skills: ["Electron", "React Native", "Xamarin"],
  },
  {
    label: "Tools & Workflow",
    icon: "▦",
    color: "rose",
    skills: ["GitLab CI", "Git", "Playwright", "ESLint", "Jira", "Agile / Scrum"],
  },
];

const colorMap: Record<string, { border: string; text: string; bg: string; tag: string }> = {
  cyan:    { border: "border-cyan-500/30",    text: "text-cyan-400",    bg: "bg-cyan-500/5",    tag: "bg-cyan-500/10 text-cyan-300" },
  violet:  { border: "border-violet-500/30",  text: "text-violet-400",  bg: "bg-violet-500/5",  tag: "bg-violet-500/10 text-violet-300" },
  emerald: { border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-500/5", tag: "bg-emerald-500/10 text-emerald-300" },
  blue:    { border: "border-blue-500/30",    text: "text-blue-400",    bg: "bg-blue-500/5",    tag: "bg-blue-500/10 text-blue-300" },
  amber:   { border: "border-amber-500/30",   text: "text-amber-400",   bg: "bg-amber-500/5",   tag: "bg-amber-500/10 text-amber-300" },
  rose:    { border: "border-rose-500/30",    text: "text-rose-400",    bg: "bg-rose-500/5",    tag: "bg-rose-500/10 text-rose-300" },
};

export default function Skills() {
  return (
    <section id="skills" className="py-24 px-6 max-w-6xl mx-auto">
      <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">Skills</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-14">Technical Expertise</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {skillGroups.map((group) => {
          const c = colorMap[group.color];
          return (
            <div
              key={group.label}
              className={`p-6 rounded-xl border ${c.border} ${c.bg} bg-gray-900`}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-lg ${c.text}`}>{group.icon}</span>
                <h3 className={`font-semibold text-sm uppercase tracking-wider font-mono ${c.text}`}>
                  {group.label}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.skills.map((s) => (
                  <span key={s} className={`px-2.5 py-1 text-xs rounded-md font-mono ${c.tag}`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
