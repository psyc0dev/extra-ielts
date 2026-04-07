import { motion } from "motion/react";
import { useNav } from "@/hooks/use-nav";

export default function NotFound() {
  const { setPage } = useNav();

  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full gap-6 select-none">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <span className="text-7xl font-bold text-neutral-700">404</span>
        <p className="text-neutral-400 text-sm">This page doesn't exist.</p>
        <button
          onClick={() => setPage("Dashboard")}
          className="mt-2 text-xs text-neutral-500 hover:text-white transition-colors underline underline-offset-4"
        >
          Go to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
