"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Brain,
  Gauge,
  Zap,
  FileText,
  Bell,
  Shield,
  Building2,
  Puzzle,
  Lock,
} from "lucide-react";

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI-Powered Analysis",
      description: "Gemini 2.0 Flash reads legal documents like a lawyer, understanding context and implications.",
      highlight: true,
    },
    {
      icon: <Gauge className="w-6 h-6" />,
      title: "Risk Scoring",
      description: "Every change scored 1-10 with clear rationale.",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant Detection",
      description: "Changes caught in under 5 minutes.",
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Policy RAG",
      description: "Upload your internal policies. We compare changes against YOUR requirements.",
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Multi-Channel Alerts",
      description: "Email, Slack, or webhook—get notified your way.",
    },
  ];

  const stats = [
    { value: "99.9%", label: "Uptime SLA", icon: <Shield className="w-4 h-4" /> },
    { value: "500+", label: "Contracts", icon: <FileText className="w-4 h-4" /> },
    { value: "50+", label: "Integrations", icon: <Puzzle className="w-4 h-4" /> },
    { value: "SOC 2", label: "Compliant", icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <section id="features" className="py-24 px-6 relative" ref={ref}>
      {/* Background Aurora */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5814BA] rounded-full filter blur-[200px] opacity-10 pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-[#A17CFF] uppercase tracking-wider">
            Capabilities
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white">
            Intelligence at Every Layer
          </h2>
          <p className="mt-4 text-lg text-[rgba(255,255,255,0.6)] max-w-xl mx-auto">
            From detection to action, every feature is built for teams who can&apos;t afford to miss a change.
          </p>
        </motion.div>

        {/* Feature Grid - Bento Style */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`card p-6 group ${
                feature.highlight ? "lg:col-span-2 lg:row-span-1" : ""
              }`}
            >
              <div className="text-[#A17CFF] mb-4 group-hover:scale-110 transition-transform inline-block">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-[rgba(255,255,255,0.6)] text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="card p-6 text-center"
            >
              <div className="text-[#A17CFF] mb-2 flex justify-center">
                {stat.icon}
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {stat.value}
              </div>
              <div className="text-xs text-[rgba(255,255,255,0.5)] mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
