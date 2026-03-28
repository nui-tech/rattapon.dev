const skills = [
  "Angular", "React", "Next.js", "TypeScript", "Three.js",
  "Node.js", "AWS", "D3.js", "Electron", "React Native",
  "GitLab CI", "Playwright", "Firebase", "Tailwind CSS",
];

export default function About() {
  return (
    <section id="about" className="py-24 px-6 max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">About</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Full-stack depth, architectural thinking
          </h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            I&apos;m a senior full-stack developer with 8+ years of commercial experience across Angular,
            React, and Node.js — comfortable across the whole stack and increasingly focused on AI
            integration and software architecture. At Truescape I architect complex web applications
            and lead the company&apos;s AI adoption pilot — evaluating tooling, shaping how the team
            works with AI, and continuously improving engineering productivity.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="text-cyan-500">◆</span> Christchurch, New Zealand
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-cyan-500">◆</span> Open to remote &amp; hybrid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-cyan-500">◆</span> 8+ years experience
            </span>
          </div>
        </div>

        <div>
          <p className="text-gray-500 font-mono text-xs mb-4 tracking-widest uppercase">Tech I work with</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 text-gray-300 text-sm hover:border-cyan-500/40 hover:text-cyan-300 transition-colors duration-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
