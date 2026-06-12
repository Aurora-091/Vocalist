type WeeberLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
};

const SIZE_MAP = {
  sm: { height: 18, fontSize: 15, letterSpacing: -0.5 },
  md: { height: 22, fontSize: 19, letterSpacing: -0.8 },
  lg: { height: 32, fontSize: 28, letterSpacing: -1.2 },
};

export function WeeberLogo({ className = "", size = "md", inverted = false }: WeeberLogoProps) {
  const { height, fontSize, letterSpacing } = SIZE_MAP[size];
  const fill = inverted ? "#ffffff" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${fontSize * 4.2} ${height}`}
      height={height}
      aria-label="Weeber"
      role="img"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <text
        x="0"
        y={height - 2}
        fill={fill}
        fontFamily="'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="600"
        letterSpacing={letterSpacing}
        dominantBaseline="auto"
      >
        Weeber
      </text>
    </svg>
  );
}
