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
  const filterStyle = inverted ? { filter: 'brightness(0) invert(1)' } : {};

  return (
    <img 
      src="/logo.png" 
      alt="Weeber" 
      height={height}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", height: height, ...filterStyle }}
    />
  );
}
