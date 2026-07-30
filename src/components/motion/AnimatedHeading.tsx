"use client";

import { motion } from "framer-motion";

interface AnimatedHeadingProps {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
}

const wordVariants = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    transition: {
      duration: 0.6,
      delay: i * 0.07,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function AnimatedHeading({
  text,
  className = "",
  delay = 0,
  as: Tag = "h2",
}: AnimatedHeadingProps) {
  const words = text.split(" ");

  return (
    <Tag className={`flex flex-wrap gap-x-[0.3em] ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="overflow-hidden inline-block">
          <motion.span
            className="inline-block"
            variants={wordVariants}
            custom={i + delay / 0.07}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
