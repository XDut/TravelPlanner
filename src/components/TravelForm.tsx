import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { CalendarIcon, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
interface TravelFormProps {
  onSubmit: (data: TravelFormData) => void;
  isLoading: boolean;
}
export interface TravelFormData {
  source: string;
  destination: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  budget: string;
  travelers: string;
  interests: string;
  includeFlights: boolean;
}
export const TravelForm = ({
  onSubmit,
  isLoading
}: TravelFormProps) => {
  const [formData, setFormData] = useState<TravelFormData>({
    source: "",
    destination: "",
    startDate: undefined,
    endDate: undefined,
    budget: "",
    travelers: "",
    interests: "",
    includeFlights: false
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };
  const updateField = (field: keyof TravelFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  return <Card className="w-full max-w-2xl shadow-medium">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Plan Your Journey</CardTitle>
            <CardDescription>Tell us about your dream trip and let AI create your perfect itinerary</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">From</Label>
              <Input id="source" placeholder="New York" value={formData.source} onChange={e => updateField("source", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">To</Label>
              <Input id="destination" placeholder="Paris" value={formData.destination} onChange={e => updateField("destination", e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formData.startDate} onSelect={date => updateField("startDate", date)} disabled={date => date < new Date()} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.endDate ? format(formData.endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formData.endDate} onSelect={date => updateField("endDate", date)} disabled={date => date < (formData.startDate || new Date())} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (USD)</Label>
              <Input id="budget" type="number" placeholder="5000" value={formData.budget} onChange={e => updateField("budget", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="travelers">Number of Travelers</Label>
              <Input id="travelers" type="number" min="1" placeholder="2" value={formData.travelers} onChange={e => updateField("travelers", e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interests">Interests & Preferences</Label>
            <Textarea id="interests" placeholder="E.g., adventure sports, local cuisine, historical sites, museums, beaches..." value={formData.interests} onChange={e => updateField("interests", e.target.value)} rows={4} required />
          </div>

          <div className="flex items-center space-x-2 p-4 rounded-lg border bg-muted/50">
            <Checkbox id="includeFlights" checked={formData.includeFlights} onCheckedChange={checked => updateField("includeFlights", checked)} />
            <div className="flex flex-col gap-1">
              <Label htmlFor="includeFlights" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                Include real flight details (powered by SerpAPI)
              </Label>
              
            </div>
          </div>

          <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 transition-opacity" disabled={isLoading}>
            {isLoading ? "Creating Your Itinerary..." : "Generate Travel Plan"}
          </Button>
        </form>
      </CardContent>
    </Card>;
};