import React from "react";
import { motion } from "framer-motion";

const Background: React.FC = () => (
  <>
    {/* Still Background */}
    <div
      className="fixed inset-0 -z-30"
      style={{
        backgroundColor: "#143D4D",
      }}
    />

    {/* Grid Floor */}
    <div
      className="fixed inset-0 -z-20 pointer-events-none"
      style={{
        perspective: "1200px",
        perspectiveOrigin: "50% 85%",
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to right, rgba(15, 193, 233, 0.6) 2px, transparent 2px),
            linear-gradient(to bottom, rgba(15, 193, 233, 0.6) 2px, transparent 2px)
          `,
          backgroundSize: "60px 60px",
          transform: "rotateX(75deg) translateY(40%) scale(1.8)",
          transformOrigin: "center bottom",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
        animate={{
          backgroundPosition: ["0px 0px", "60px 60px"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
      />

      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to right, rgba(15, 193, 233, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 193, 233, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px",
          transform: "rotateX(75deg) translateY(60%) scale(2.2)",
          transformOrigin: "center bottom",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
        animate={{
          backgroundPosition: ["0px 0px", "-120px -120px"],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 100% at center bottom,
              transparent 0%,
              transparent 20%,
              rgba(20, 61, 77, 0.2) 40%,
              rgba(20, 61, 77, 0.4) 60%,
              rgba(20, 61, 77, 0.7) 80%,
              #143D4D 100%
            )
          `,
        }}
      />
    </div>

    {/* Gradient Animation (Only top half of screen) */}
    <motion.div
      className="fixed inset-x-0 top-0 h-3/4 -z-15 pointer-events-none"
      style={{
        backgroundColor: "transparent",
        backgroundImage: `
          radial-gradient(circle at 50% 40%, #0FC1E9 0%, transparent 65%),
          radial-gradient(circle at 60% 60%, #90A4AB 0%, transparent 70%),
          radial-gradient(circle at 75% 75%, #274D5B 0%, transparent 50%)
        `,
        backgroundSize: "250% 250%",
        mixBlendMode: "screen",
      }}
      initial={{ backgroundPosition: "0% 0%" }}
      animate={{
        backgroundPosition: [
          "30% 20%",
          "60% 40%",
          "40% 75%",
          "70% 60%",
          "20% 70%",
          "50% 50%",
          "30% 20%",
        ],
      }}
      transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Noise Overlay */}
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundImage: "url('/noise.png')",
        opacity: 0.3,
        mixBlendMode: "overlay",
        backgroundRepeat: "repeat",
      }}
    />
  </>
);

export default Background;
