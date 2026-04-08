import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-black text-white font-sans selection:bg-blue-500/30">
      <main className="flex flex-col items-center gap-12 px-6 text-center">
        <div className="space-y-4">
          <h1 className="text-6xl font-black tracking-tighter sm:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
            Agentic-AI
          </h1>
          <p className="text-xl text-gray-400 max-w-[600px] leading-relaxed">
            High-performance, observable, and resilient multi-agent orchestration runtime. 
            Monitor your execution flow in real-time.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/dashboard"
            className="group relative flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-8 text-black font-bold transition-all hover:bg-gray-200 active:scale-95"
          >
            Open Dashboard
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <a
            href="https://github.com/nikkofu/agentic-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center rounded-xl border border-gray-800 px-8 font-bold transition-colors hover:bg-gray-900 active:scale-95"
          >
            View Source
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8 text-left max-w-4xl border-t border-gray-900 pt-12">
          <div className="space-y-2">
            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Real-time</h3>
            <p className="text-sm text-gray-500">Milliseconds synchronization via WebSocket proxy.</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Observable</h3>
            <p className="text-sm text-gray-500">Full event trace and cost metrics for every node.</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Scalable</h3>
            <p className="text-sm text-gray-500">From single nodes to complex parallel DAG workflows.</p>
          </div>
        </div>
      </main>
      
      <footer className="mt-auto py-8 text-gray-600 text-xs font-mono uppercase tracking-widest">
        Agentic Runtime Kernel v0.4.0
      </footer>
    </div>
  );
}
