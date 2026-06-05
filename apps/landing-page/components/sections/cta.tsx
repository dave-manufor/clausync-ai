"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, Check, Rocket } from "lucide-react";

export function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [email, setEmail] = useState("");

  return (
    <section id="get-started" className="py-24 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary/30 via-[#5814BA]/10 to-transparent border border-[rgba(161,124,255,0.2)] p-8 md:p-12 text-center"
        >
          {/* Background Glow */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary rounded-full filter blur-[150px] opacity-30" 
            aria-hidden="true" 
          />

          {/* Emoji Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(88,20,186,0.3)] border border-[rgba(161,124,255,0.3)] text-sm text-accent mb-6"
          >
            <Rocket className="w-4 h-4" />
            Get Started Today
          </motion.div>

          {/* Headline */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 relative z-10">
            Stop Guessing.<br />
            <span className="gradient-text">Start Knowing.</span>
          </h2>

          <p className="text-[rgba(255,255,255,0.6)] max-w-md mx-auto mb-8 relative z-10">
            Join hundreds of legal teams who never miss a contract change.
          </p>

          {/* Email Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative z-10"
            onSubmit={(e) => {
              e.preventDefault();
              // Handle form submission
              console.log("Email submitted:", email);
            }}
          >
            <input
              type="email"
              placeholder="Enter your work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(161,124,255,0.2)] text-white placeholder:text-[rgba(255,255,255,0.4)] focus:outline-none focus:border-accent transition-colors"
              required
            />
            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.form>

          {/* Trust Signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-6 text-sm text-[rgba(255,255,255,0.5)] relative z-10"
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-safe" />
              Free tier available
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-safe" />
              No credit card required
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
