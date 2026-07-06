import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
      <span className="text-7xl font-bold font-mono text-muted-foreground/30">404</span>
      <h1 className="text-xl font-semibold tracking-tight mt-4">Page not found</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild size="sm" className="mt-6">
        <Link to="/">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}
