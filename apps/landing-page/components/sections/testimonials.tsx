"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Star, Quote } from "lucide-react";

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const testimonials = [
    {
      quote: "ClauSync caught a data usage change in Notion's terms that would have let them train AI on our docs.",
      author: "Sarah Chen",
      role: "VP Legal at TechFlow",
      initials: "SC",
    },
    {
      quote: "We were manually checking 30+ vendor agreements quarterly. Now we get alerts in real-time.",
      author: "Michael Torres",
      role: "General Counsel at DataTrust",
      initials: "MT",
    },
    {
      quote: "The AI risk scoring is incredibly accurate. High-priority changes get escalated immediately.",
      author: "Emma Richardson",
      role: "Compliance Manager at SecureOps",
      initials: "ER",
    },
    {
      quote: "Integrating our internal policies was a game-changer for compliance monitoring.",
      author: "David Park",
      role: "Head of Procurement at CloudBase",
      initials: "DP",
    },
  ];

  return (
    <section id="testimonials" className="py-24 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-[#A17CFF] uppercase tracking-wider">
            Testimonials
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white">
            Trusted by Legal Teams
          </h2>
        </motion.div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card p-6 group"
            >
              {/* Quote Icon */}
              <Quote className="w-8 h-8 text-[#5814BA] mb-4 opacity-50" />

              {/* Quote */}
              <p className="text-[rgba(255,255,255,0.8)] leading-relaxed mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5814BA] to-[#A17CFF] flex items-center justify-center text-white font-semibold text-sm ring-2 ring-[#5814BA]/30 ring-offset-2 ring-offset-[#08041E]">
                  {testimonial.initials}
                </div>
                <div>
                  <div className="font-medium text-white">{testimonial.author}</div>
                  <div className="text-sm text-[rgba(255,255,255,0.5)]">
                    {testimonial.role}
                  </div>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-1 mt-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="w-4 h-4 text-[#A17CFF] fill-[#A17CFF]"
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
