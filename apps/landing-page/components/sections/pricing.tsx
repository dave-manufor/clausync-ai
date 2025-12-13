"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Check, ArrowRight } from "lucide-react";

export function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "For individuals getting started",
      price: "Free",
      priceNote: null,
      features: [
        "Up to 5 monitored URLs",
        "Daily change detection",
        "Email alerts",
        "Basic AI risk scoring",
      ],
      cta: "Start Free",
      ctaStyle: "btn-secondary",
      popular: false,
    },
    {
      name: "Professional",
      description: "For growing teams",
      price: isAnnual ? "$31" : "$39",
      priceNote: "/mo",
      features: [
        "Up to 50 monitored URLs",
        "Real-time detection",
        "Email + Slack alerts",
        "Advanced AI analysis",
        "Policy RAG (5 policies)",
        "Priority support",
      ],
      cta: "Start 14-Day Trial",
      ctaStyle: "btn-primary",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      price: "Custom",
      priceNote: null,
      features: [
        "Unlimited URLs",
        "All alert channels",
        "Custom AI rules",
        "Unlimited policies",
        "SSO + SCIM",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      ctaStyle: "btn-secondary",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-sm font-medium text-[#A17CFF] uppercase tracking-wider">
            Pricing
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white">
            Simple, Transparent Pricing
          </h2>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={`text-sm ${!isAnnual ? "text-white" : "text-[rgba(255,255,255,0.5)]"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isAnnual ? "bg-[#5814BA]" : "bg-[rgba(255,255,255,0.1)]"
            }`}
            aria-label="Toggle billing period"
          >
            <motion.div
              className="absolute top-1 w-5 h-5 rounded-full bg-white"
              animate={{ left: isAnnual ? "calc(100% - 24px)" : "4px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-sm ${isAnnual ? "text-white" : "text-[rgba(255,255,255,0.5)]"}`}>
            Annual <span className="text-[#A17CFF]">(-20%)</span>
          </span>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
              className={`card p-8 relative ${
                plan.popular
                  ? "border-[#5814BA] bg-gradient-to-b from-[rgba(88,20,186,0.1)] to-transparent"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-[#5814BA] to-[#A17CFF] rounded-full text-xs font-medium text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="text-sm text-[rgba(255,255,255,0.5)] mt-1">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                {plan.priceNote && (
                  <span className="text-[rgba(255,255,255,0.5)]">{plan.priceNote}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#A17CFF] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[rgba(255,255,255,0.7)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <button className={`${plan.ctaStyle} w-full flex items-center justify-center gap-2`}>
                {plan.cta}
                {plan.popular && <ArrowRight className="w-4 h-4" />}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
