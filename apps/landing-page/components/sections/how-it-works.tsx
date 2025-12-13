"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link2, Bot, Bell, ArrowRight } from "lucide-react";

export function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      number: "1",
      icon: <Link2 className="w-6 h-6" />,
      title: "Add Any URL",
      description: "Paste the link to any vendor's Terms of Service or service agreement.",
    },
    {
      number: "2",
      icon: <Bot className="w-6 h-6" />,
      title: "AI Monitors 24/7",
      description: "Gemini 2.0 Flash continuously watches for changes to every clause.",
    },
    {
      number: "3",
      icon: <Bell className="w-6 h-6" />,
      title: "Instant Risk Alerts",
      description: "Get notified the moment something changes with AI-powered risk analysis.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-[#A17CFF] uppercase tracking-wider">
            Simple Setup
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white">
            Three Steps to Peace of Mind
          </h2>
          <p className="mt-4 text-lg text-[rgba(255,255,255,0.6)] max-w-xl mx-auto">
            No integrations needed. Just paste a URL and start protecting your business.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-[#5814BA] to-transparent" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative"
            >
              <div className="card p-8 h-full text-center group">
                {/* Step Number */}
                <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#5814BA] to-[#A17CFF] flex items-center justify-center text-white font-bold text-xl relative z-10">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="text-[#A17CFF] mb-4 flex justify-center group-hover:scale-110 transition-transform">
                  {step.icon}
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-[rgba(255,255,255,0.6)] text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href="#get-started"
            className="btn-primary inline-flex items-center gap-2"
          >
            Start Monitoring in 60 Seconds
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="mt-4 text-sm text-[rgba(255,255,255,0.4)]">
            Free tier available • No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
