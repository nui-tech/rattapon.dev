export default function Footer() {
  return (
    <footer className="border-t border-gray-900 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-gray-600 text-sm font-mono">
          © {new Date().getFullYear()} Nui Rattapon · rattapon.dev
        </p>
        <div className="flex items-center gap-5 text-sm">
          <a href="mailto:nui@rattapon.dev" className="text-gray-600 hover:text-cyan-400 transition-colors font-mono">
            Email
          </a>
          <a href="https://linkedin.com/in/nui-tech" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-cyan-400 transition-colors font-mono">
            LinkedIn
          </a>
          <a href="https://github.com/nui-tech" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-cyan-400 transition-colors font-mono">
            GitHub
          </a>
          <a href="/Nui_Rattapon_CV.pdf" download className="text-gray-600 hover:text-cyan-400 transition-colors font-mono">
            CV ↓
          </a>
        </div>
      </div>
    </footer>
  );
}
