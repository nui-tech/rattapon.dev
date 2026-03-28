const certs = [
  {
    title: "Model Context Protocol (MCP): Hands-On with Agentic AI",
    issuer: "LinkedIn Learning",
    date: "Mar 2026",
    icon: "🤖",
    highlight: true,
  },
  {
    title: "Unboxing AI: Visual Studio Code and GitHub Copilot Deep Dive",
    issuer: "LinkedIn Learning",
    date: "Feb 2026",
    icon: "⚡",
    highlight: true,
  },
  {
    title: "ICAgile Certified Professional – Agile Software Design",
    issuer: "ICAgile",
    date: "Jun 2025",
    icon: "◈",
    highlight: false,
  },
  {
    title: "MTA: HTML5 Application Development Fundamentals",
    issuer: "Microsoft",
    date: "Aug 2017",
    icon: "▣",
    highlight: false,
  },
];

export default function Certifications() {
  return (
    <section id="certifications" className="py-24 px-6 max-w-4xl mx-auto">
      <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">Certifications</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-14">Credentials</h2>

      <div className="grid sm:grid-cols-2 gap-5">
        {certs.map((cert, i) => (
          <div
            key={i}
            className={`p-6 rounded-xl border transition-all duration-200 ${
              cert.highlight
                ? "bg-gray-900 border-cyan-500/30 hover:border-cyan-400/50"
                : "bg-gray-900 border-gray-800 hover:border-gray-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{cert.icon}</span>
              <div>
                <p className={`font-semibold text-sm leading-snug mb-1 ${cert.highlight ? "text-white" : "text-gray-300"}`}>
                  {cert.title}
                </p>
                <p className="text-gray-500 text-xs font-mono">
                  {cert.issuer} · {cert.date}
                </p>
                {cert.highlight && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                    Recent
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
