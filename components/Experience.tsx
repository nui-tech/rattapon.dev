const experiences = [
  {
    role: "Full Stack Web Application Developer",
    company: "Truescape",
    period: "Sep 2022 – Present",
    duration: "3 yrs 7 mos",
    location: "Christchurch, NZ",
    highlights: [
      "Architect and develop interactive 3D visualisation applications using Three.js and Angular, embedded in urban-planning and infrastructure products used by councils and government agencies.",
      "Conceived and led a full architectural migration from Three.js to Unity on the BOEM (US federal agency) project — designed an Interface Control Document (ICD) abstraction layer to decouple the UI from the 3D engine, enabling parallel cross-team development and a seamless production engine swap with no UI disruption. Also architected the NgRx state management system including versioning strategy and graceful backward compatibility.",
      "Led architecture and development of a 360° panoramic view calibration system — an internal research project that matured into a core product feature.",
      "Designed a reusable 360° panoramic visualisation application template now used as the foundation for multiple client projects.",
      "Led the company's AI adoption pilot — evaluated and recommended AI tooling for the engineering team, defined usage guidelines, and continue to drive ongoing AI integration and productivity improvements across the team.",
      "Appointed to establish and lead the company's AI engineering community of practice — defining how teams adopt AI tooling, manage shared AI assets (instructions, rules, skills) within a monorepo, and share knowledge on AI usage across the organisation.",
      "Drove significant engineering process improvements: ESLint, GitLab CI PR checks, automated code-review assignment, git pre-commit hooks, and branch protection rules.",
    ],
    stack: ["Angular", "Three.js", "TypeScript", "Node.js", "NgRx", "Marzipano", "Leaflet", "D3.js", "AWS", "GitLab CI", "GitHub Copilot"],
  },
  {
    role: "Web Developer",
    company: "Maker Design",
    period: "Oct 2017 – Sep 2022",
    duration: "5 yrs",
    location: "Christchurch, NZ",
    highlights: [
      "Designed and developed websites and web applications for NZ Couriers, Posthaste, Castle Parcel, and Now Couriers.",
      "Delivered full project lifecycle: interaction design, wireframes, prototypes, and production builds.",
      "Introduced React Native / Xamarin mobile development capability to the team.",
    ],
    stack: ["Angular", "React", "React Native", "Next.js", "WordPress", "Silverstripe", "Xamarin", "Node.js", "AWS", "Azure DevOps"],
  },
  {
    role: "Intern Full Stack Web Developer",
    company: "MVP Studio – Uptown Innovation",
    period: "Feb 2017 – Oct 2017",
    duration: "9 mos",
    location: "Auckland, NZ",
    highlights: [
      "Built a back-end Windows Service for geolocation functionality on the Alex Swift Emergency Contact product.",
      "Redesigned account/profile pages and refactored site CSS architecture.",
      "Presented at Demo Day — awarded Best Performance of May 2017.",
    ],
    stack: ["C# ASP.NET MVC", "AngularJS", "MsSQL"],
  },
  {
    role: "Software Engineer Intern",
    company: "Thomson Reuters",
    period: "Oct 2012 – Feb 2013",
    duration: "5 mos",
    location: "Bangkok, Thailand",
    highlights: [
      "Researched and developed an end-to-end automated testing framework using Selenium and NUnit for the EIKON product CI pipeline.",
      "Built a test-report generator tool used by the QA team.",
    ],
    stack: ["C# .NET", "Selenium", "NUnit"],
  },
];

export default function Experience() {
  return (
    <section id="experience" className="py-24 px-6 max-w-4xl mx-auto">
      <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">Experience</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-16">Work History</h2>

      <div className="relative">
        {/*
          Line: starts at top-[10px] = first dot's centre (top-1 + half h-3 = 4+6 = 10px).
          Left-0 keeps it on the same axis as the dots.
        */}
        <div className="absolute left-0 top-[10px] bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-gray-700/40 to-transparent" />

        {experiences.map((exp, i) => (
          <div key={i} className={`relative pl-8 ${i < experiences.length - 1 ? "pb-14" : ""}`}>

            {/* Dot: left-0 aligns with the line, -translate-x-1/2 centres it perfectly */}
            <div className="absolute left-0 top-1 w-3 h-3 -translate-x-1/2 rounded-full border-2 border-cyan-500 bg-gray-950" />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{exp.role}</h3>
                <p className="text-cyan-400 font-medium">{exp.company}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-400 text-sm font-mono">{exp.period}</p>
                <p className="text-gray-600 text-xs">{exp.duration} · {exp.location}</p>
              </div>
            </div>

            <ul className="space-y-1.5 mb-4">
              {exp.highlights.map((h, j) => (
                <li key={j} className="text-gray-400 text-sm leading-relaxed flex gap-2">
                  <span className="text-cyan-600 mt-0.5 shrink-0">›</span>
                  {h}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-1.5">
              {exp.stack.map((s) => (
                <span key={s} className="px-2 py-0.5 text-xs rounded bg-gray-900 border border-gray-800 text-gray-500 font-mono">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
