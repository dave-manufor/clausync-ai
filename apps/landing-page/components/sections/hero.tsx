"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield, Clock, Eye } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 md:pt-48 pb-16">
      {/* Powered by badge */}
      {/* <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6"
      >
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(88,20,186,0.15)] border border-[rgba(161,124,255,0.2)] text-sm text-[#A17CFF]">
          <span className="w-2 h-2 rounded-full bg-[#A17CFF] animate-pulse" />
          Powered by Gemini 2.0 Flash
        </span>
      </motion.div> */}

      {/* Main Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-4xl md:text-6xl lg:text-7xl font-bold text-center max-w-5xl leading-[1.1] tracking-tight"
      >
        <span className="text-white">Stop Contract Surprises</span>
        <br />
        <span className="gradient-text-hero">Before They Cost You</span>
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="mt-6 text-lg md:text-xl text-[rgba(255,255,255,0.6)] text-center max-w-2xl leading-relaxed"
      >
        Vendors change their terms constantly. Most teams find out too late. 
        ClauSync monitors every update and alerts you with AI-powered risk 
        analysis—before it becomes your problem.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mt-10 flex flex-col sm:flex-row gap-4"
      >
        <Link href="#get-started" className="btn-primary flex items-center justify-center gap-2 text-base">
          Protect Your Contracts
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="#how-it-works" className="btn-secondary flex items-center justify-center gap-2 text-base">
          See How It Works
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-16 grid grid-cols-3 gap-8 md:gap-16"
      >
        <StatItem icon={<Shield className="w-5 h-5" />} value="500+" label="Contracts Monitored" />
        <StatItem icon={<Clock className="w-5 h-5" />} value="<5min" label="Detection Time" />
        <StatItem icon={<Eye className="w-5 h-5" />} value="24/7" label="AI Watching" />
      </motion.div>

      {/* Dashboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5 }}
        className="mt-16 w-full max-w-4xl"
      >
        <DashboardPreview />
      </motion.div>

      {/* Trust Logos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.7 }}
        className="mt-16"
      >
        <p className="text-sm text-[rgba(255,255,255,0.4)] text-center mb-6">
          Trusted by forward-thinking teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {["TechCorp", "LegalFlow", "CloudBase", "DataTrust", "SecureOps"].map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
              className="text-lg font-semibold text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.5)] transition-colors cursor-default"
            >
              {name}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-[#A17CFF] mb-2">{icon}</div>
      <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      <div className="text-xs md:text-sm text-[rgba(255,255,255,0.5)] mt-1">{label}</div>
    </div>
  );
}

function DashboardPreview() {
  const contracts = [
    {
      name: "OpenAI Terms of Service",
      change: "Changed 2 hours ago • New arbitration clause",
      status: "High Risk",
      statusClass: "badge-risk",
    },
    {
      name: "Stripe Service Agreement",
      change: "Modified 6 hours ago • Liability terms",
      status: "Medium",
      statusClass: "badge-warning",
    },
    {
      name: "AWS Service Terms",
      change: "No changes in 30 days",
      status: "Stable",
      statusClass: "badge-safe",
    },
  ];

  return (
    <div className="card-dashboard p-6 relative overflow-hidden">
      {/* Browser Chrome */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[rgba(161,124,255,0.1)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-[rgba(255,255,255,0.05)] rounded-md px-3 py-1.5 text-xs text-[rgba(255,255,255,0.4)]">
            app.clausync.ai/dashboard
          </div>
        </div>
      </div>

      {/* Contract List */}
      <div className="space-y-3">
        {contracts.map((contract, index) => (
          <motion.div
            key={contract.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 + index * 0.15 }}
            className="flex items-center justify-between p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(161,124,255,0.08)] hover:border-[rgba(161,124,255,0.15)] transition-colors"
          >
            <div>
              <h4 className="font-medium text-white text-sm">{contract.name}</h4>
              <p className="text-xs text-[rgba(255,255,255,0.4)] mt-0.5">{contract.change}</p>
            </div>
            <span className={contract.statusClass}>{contract.status}</span>
          </motion.div>
        ))}
      </div>

      {/* Subtle glow effect */}
      <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-[#5814BA] rounded-full filter blur-[100px] opacity-20" />
    </div>
  );
}
