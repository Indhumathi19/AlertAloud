import React from "react";

interface LogoIconProps {
  className?: string;
  size?: number | string;
}

/**
 * AlertAloud App Icon
 * Exact recreation of the official logo:
 * - Rose-red gradient squircle
 * - White speech bubble with lower-left tail
 * - Rose-red exclamation mark (!) centered inside
 */
export const AlertAloudIcon: React.FC<LogoIconProps> = ({
  className = "w-8 h-8",
  size,
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={style}
    >
      <defs>
        {/* Rose-red gradient matching official brand image */}
        <linearGradient id="alertAloudGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FB5A78" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#D91B42" />
        </linearGradient>

        <linearGradient id="alertAloudExclamation" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FB5A78" />
          <stop offset="100%" stopColor="#D91B42" />
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="24"
        fill="url(#alertAloudGradient)"
      />

      {/* Subtle Inner Glow for depth */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="24"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1.5"
      />

      {/* White Speech Bubble with bottom-left pointing tail */}
      <path
        d="M50 18 C33 18 20 31 20 47 C20 56.5 24.8 64.9 32.3 70 C31.2 74.8 28.5 78.8 24.5 81.8 C24 82.2 24.3 83 25 83 C31.8 83 37.8 79.2 41.5 74.5 C44.2 75.5 47 76 50 76 C66.5 76 80 63 80 47 C80 31 66.5 18 50 18 Z"
        fill="#FFFFFF"
      />

      {/* Exclamation Mark Bar */}
      <path
        d="M50 30 C52.5 30 54.3 32.2 54 34.8 L52.2 52.8 C52 54.5 50.8 55.8 49.2 55.8 C47.6 55.8 46.4 54.5 46.2 52.8 L44.4 34.8 C44.1 32.2 45.9 30 48.4 30 L50 30 Z"
        fill="url(#alertAloudExclamation)"
      />

      {/* Exclamation Mark Dot */}
      <circle
        cx="49.2"
        cy="64"
        r="4.2"
        fill="url(#alertAloudExclamation)"
      />
    </svg>
  );
};

interface AlertAloudLogoProps {
  className?: string;
  iconSize?: string;
  textSize?: "sm" | "base" | "lg" | "xl" | "2xl";
  showSubtitle?: boolean;
  showLivePulse?: boolean;
}

/**
 * AlertAloud Full Logo
 * Combines the icon with the brand typography:
 * "Alert" in white + "Aloud" in rose-coral (#F43F5E)
 */
export const AlertAloudLogo: React.FC<AlertAloudLogoProps> = ({
  className = "",
  iconSize = "w-8 h-8",
  textSize = "base",
  showSubtitle = false,
  showLivePulse = true,
}) => {
  const fontSizes = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
  };

  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      {/* Brand Icon */}
      <AlertAloudIcon className={iconSize} />

      {/* Brand Wordmark */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold tracking-tight ${fontSizes[textSize]} select-none whitespace-nowrap`}>
            <span className="text-white">Alert</span>
            <span className="text-rose-500">Aloud</span>
          </span>
          {showLivePulse && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"
              title="Official Alert Monitoring Live"
            />
          )}
        </div>
        {showSubtitle && (
          <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
            One alert. Read aloud.
          </p>
        )}
      </div>
    </div>
  );
};
