import { useState } from "react";
import { TravelForm, TravelFormData } from "@/components/TravelForm";
import { TravelPlan } from "@/components/TravelPlan";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plane } from "lucide-react";

const Index = () => {
  const [itinerary, setItinerary] = useState<string>("");
  const [flightData, setFlightData] = useState<any>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [formData, setFormData] = useState<TravelFormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (data: TravelFormData) => {
    setIsLoading(true);
    setFormData(data);

    try {
      const { data: result, error } = await supabase.functions.invoke("generate-travel-plan", {
        body: data,
      });

      if (error) throw error;

      if (result?.itinerary !== undefined) {
        setItinerary(result.itinerary);
        setFlightData(result.flightData || null);
        setSelectedAirport(result.selectedAirport || null);
      } else {
        throw new Error("No itinerary received");
      }
    } catch (error) {
      console.error("Error generating travel plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate travel plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setItinerary("");
    setFlightData(null);
    setSelectedAirport(null);
    setFormData(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-hero py-20 px-4">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl backdrop-blur-sm mb-4">
            <Plane className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
            AI Travel Planner
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            Let artificial intelligence create your perfect travel itinerary. Personalized, detailed, and ready to explore.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="py-12 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
          {!itinerary ? (
            <TravelForm onSubmit={handleSubmit} isLoading={isLoading} />
          ) : (
            <>
              <TravelPlan 
                formData={formData!} 
                itinerary={itinerary}
                flightData={flightData}
                selectedAirport={selectedAirport}
              />
              <button
                onClick={handleReset}
                className="text-primary hover:text-primary/80 underline font-medium transition-colors"
              >
                Plan Another Trip
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
