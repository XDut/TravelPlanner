import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, DollarSign, Users, Sparkles, Plane } from "lucide-react";
import { TravelFormData } from "./TravelForm";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FlightData {
  destination: string;
  destinationName: string;
  price: number;
  duration: number;
  airline: string;
  route: Array<{ from: string; to: string; fromName: string; toName: string }>;
  departureTime: string;
  arrivalTime: string;
}

interface TravelPlanProps {
  formData: TravelFormData;
  itinerary: string;
  flightData?: FlightData[] | null;
  selectedAirport?: string | null;
}

export const TravelPlan = ({ formData, itinerary, flightData, selectedAirport }: TravelPlanProps) => {
  const formatItinerary = (text: string) => {
    const lines = text.split('\n');
    const formatted: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      if (trimmed.startsWith('Day ') || trimmed.startsWith('**Day ')) {
        formatted.push(
          <h3 key={index} className="text-xl font-bold text-primary mt-6 mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {trimmed.replace(/\*\*/g, '')}
          </h3>
        );
      } else if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
        formatted.push(
          <h4 key={index} className="text-lg font-semibold text-foreground mt-4 mb-2">
            {trimmed.replace(/#{2,3}\s*/g, '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        formatted.push(
          <li key={index} className="ml-6 mb-2 text-muted-foreground">
            {trimmed.substring(2)}
          </li>
        );
      } else {
        formatted.push(
          <p key={index} className="mb-3 text-foreground leading-relaxed">
            {trimmed}
          </p>
        );
      }
    });
    
    return formatted;
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Card className="shadow-medium border-primary/20">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-hero">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Your Personalized Itinerary</CardTitle>
                <CardDescription>AI-crafted travel plan just for you</CardDescription>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="px-3 py-1.5 bg-card">
              <MapPin className="h-4 w-4 mr-2" />
              {formData.source} → {formData.destination}
            </Badge>
            {formData.startDate && formData.endDate && (
              <Badge variant="outline" className="px-3 py-1.5 bg-card">
                <Calendar className="h-4 w-4 mr-2" />
                {format(formData.startDate, "MMM d")} - {format(formData.endDate, "MMM d, yyyy")}
              </Badge>
            )}
            <Badge variant="outline" className="px-3 py-1.5 bg-card">
              <DollarSign className="h-4 w-4 mr-2" />
              ${formData.budget}
            </Badge>
            <Badge variant="outline" className="px-3 py-1.5 bg-card">
              <Users className="h-4 w-4 mr-2" />
              {formData.travelers} {parseInt(formData.travelers) === 1 ? 'traveler' : 'travelers'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-soft gradient-card">
        <CardContent className="pt-6">
          <div className="prose prose-slate max-w-none">
            {formatItinerary(itinerary)}
          </div>
        </CardContent>
      </Card>

      {flightData && flightData.length > 0 && (
        <Card className="shadow-medium border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Plane className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Available Flights</CardTitle>
                <CardDescription>
                  Real-time flight options sorted by price
                  {selectedAirport && (
                    <span className="block mt-1 text-primary font-medium">
                      Itinerary is based on arrival at {selectedAirport}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destination</TableHead>
                    <TableHead>Airline</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flightData.map((flight, index) => (
                    <TableRow key={index} className={index === 0 ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {flight.destinationName}
                        {index === 0 && (
                          <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">
                            Best Option
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{flight.airline}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {flight.route.map((leg, i) => (
                            <div key={i}>
                              {leg.from} → {leg.to}
                              {i < flight.route.length - 1 && (
                                <span className="text-muted-foreground"> (layover)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{flight.departureTime}</TableCell>
                      <TableCell>{flight.arrivalTime}</TableCell>
                      <TableCell>
                        {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${flight.price}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
